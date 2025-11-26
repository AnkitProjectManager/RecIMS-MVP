import React, { useState } from "react";
import { recims } from "@/api/recimsClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTenant } from "@/components/TenantContext";
import { useNavigate, Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  FileText, 
  ArrowLeft, 
  Edit,
  Printer,
  CheckCircle,
  Package,
  AlertTriangle,
  Send,
  XCircle,
  UserCheck,
  FileSignature,
  Eye,
  Clock
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { format } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TenantHeader from "@/components/TenantHeader";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function ViewSalesOrder() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { tenantConfig, user } = useTenant();
  const [error, setError] = useState(null);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notes, setNotes] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showSignatureDialog, setShowSignatureDialog] = useState(false);
  const [signerEmail, setSignerEmail] = useState('');
  const [signerName, setSignerName] = useState('');

  const urlParams = new URLSearchParams(window.location.search);
  const soId = urlParams.get('id');



  const { data: so, isLoading } = useQuery({
    queryKey: ['salesOrder', soId],
    queryFn: async () => {
      const sos = await recims.entities.SalesOrder.filter({ id: soId });
      return sos[0];
    },
    enabled: !!soId,
  });

  const { data: lineItems = [] } = useQuery({
    queryKey: ['soLineItems', soId],
    queryFn: async () => {
      return await recims.entities.SalesOrderLine.filter({ so_id: soId }, 'line_number');
    },
    enabled: !!soId,
    initialData: [],
  });

  const { data: inventory = [] } = useQuery({
    queryKey: ['inventory'],
    queryFn: () => recims.entities.Inventory.filter({ status: 'available' }),
    initialData: [],
  });

  const { data: customer } = useQuery({
    queryKey: ['customer', so?.customer_id],
    queryFn: async () => {
      if (!so?.customer_id) return null;
      const customers = await recims.entities.Customer.filter({ id: so.customer_id });
      return customers[0];
    },
    enabled: !!so?.customer_id,
  });

  const { data: signatureRequests = [] } = useQuery({
    queryKey: ['signatureRequests', soId],
    queryFn: async () => {
      if (!soId) return [];
      return await recims.entities.SignatureRequest.filter({ so_id: soId }, '-sent_at');
    },
    enabled: !!soId,
    initialData: [],
  });

  React.useEffect(() => {
    if (so) {
      setNotes(so.comments_internal || '');
    }
  }, [so]);

  React.useEffect(() => {
    if (customer) {
      setSignerEmail(customer.primary_email || '');
      setSignerName(customer.display_name || '');
    }
  }, [customer]);

  // Check inventory availability for each line item
  const inventoryCheck = React.useMemo(() => {
    return lineItems.map(line => {
      const availableInventory = inventory.filter(inv => 
        inv.sku_number === line.sku_snapshot &&
        inv.status === 'available'
      );
      
      const totalAvailable = availableInventory.reduce((accumulator, inv) => 
        accumulator + (inv.quantity_kg || 0), 0
      );
      
      const needed = line.quantity_ordered || 0;
      const allocatable = Math.min(needed, totalAvailable);
      const backordered = Math.max(0, needed - totalAvailable);
      
      return {
        line_id: line.id,
        sku: line.sku_snapshot,
        needed,
        available: totalAvailable,
        allocatable,
        backordered,
        status: backordered > 0 ? 'BACKORDERED' : 'AVAILABLE'
      };
    });
  }, [lineItems, inventory]);

  const updateSOMutation = useMutation({
    mutationFn: async (updateData) => {
      return await recims.entities.SalesOrder.update(soId, updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['salesOrder', soId] });
      queryClient.invalidateQueries({ queryKey: ['salesOrders'] });
    },
    onError: (err) => {
      setError(err.message || "Failed to update sales order");
    }
  });

  const updateLinesMutation = useMutation({
    mutationFn: async (lines) => {
      for (const line of lines) {
        await recims.entities.SalesOrderLine.update(line.id, {
          quantity_allocated: line.quantity_allocated,
          quantity_backordered: line.quantity_backordered
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['soLineItems', soId] });
    }
  });

  const sendForSignatureMutation = useMutation({
    mutationFn: async ({ signer_email, signer_name }) => {
      const response = await recims.functions.invoke('sendOrderConfirmationForSignature', {
        so_id: soId,
        signer_email,
        signer_name
      });
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['salesOrder', soId] });
      queryClient.invalidateQueries({ queryKey: ['signatureRequests', soId] });
      setShowSignatureDialog(false);
      setError(null);
      alert(`✓ Order Confirmation sent to ${signerEmail} for signature!\n\nThey will receive an email with signing instructions.`);
    },
    onError: (err) => {
      setError(err.response?.data?.error || err.message || "Failed to send signature request");
    }
  });

  const handleSendForSignature = () => {
    if (!signerEmail || !signerName) {
      setError("Please enter signer email and name");
      return;
    }

    sendForSignatureMutation.mutate({ signer_email: signerEmail, signer_name: signerName });
  };

  const handlePrintOrderConfirmation = () => {
    // Print order confirmation and mark as PENDING_APPROVAL
    updateSOMutation.mutate({
      status: 'PENDING_APPROVAL',
      printed_order_confirmation_at: new Date().toISOString()
    });
    
    navigate(createPageUrl(`PrintOrderConfirmation?id=${soId}`));
  };

  const handleApprove = async () => {
    const updates = lineItems.map(line => {
      const check = inventoryCheck.find(c => c.line_id === line.id);
      return {
        id: line.id,
        quantity_allocated: check?.allocatable || 0,
        quantity_backordered: check?.backordered || 0
      };
    });

    await updateLinesMutation.mutateAsync(updates);
    
    updateSOMutation.mutate({
      status: 'APPROVED',
      approved_by: user.email,
      approved_at: new Date().toISOString()
    });
  };

  const handleRelease = () => {
    updateSOMutation.mutate({
      status: 'RELEASED',
      released_by: user.email,
      released_at: new Date().toISOString()
    });
  };

  const handleCancel = () => {
    if (!cancelReason.trim()) {
      setError("Please provide a cancellation reason");
      return;
    }

    updateSOMutation.mutate({
      status: 'CANCELLED',
      cancelled_reason: cancelReason,
      comments_internal: `${so.comments_internal || ''}\n\n[CANCELLED on ${new Date().toLocaleString()} by ${user?.full_name}]\nReason: ${cancelReason}`
    });
    
    setShowCancelDialog(false);
  };

  const updateNotesMutation = useMutation({
    mutationFn: async (newNotes) => {
      return await recims.entities.SalesOrder.update(soId, { comments_internal: newNotes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['salesOrder', soId] });
      setEditingNotes(false);
    },
  });

  const getStatusColor = (status) => {
    switch(status) {
      case 'QUOTATION': return 'bg-purple-100 text-purple-700';
      case 'DRAFT': return 'bg-gray-100 text-gray-700';
      case 'PENDING_CUSTOMER_SIGNATURE': return 'bg-indigo-100 text-indigo-700';
      case 'PENDING_APPROVAL': return 'bg-yellow-100 text-yellow-700';
      case 'NEEDS_UPDATE': return 'bg-orange-100 text-orange-700';
      case 'APPROVED': return 'bg-blue-100 text-blue-700';
      case 'RELEASED': return 'bg-green-100 text-green-700';
      case 'PARTIALLY_INVOICED': return 'bg-indigo-100 text-indigo-700';
      case 'CLOSED': return 'bg-gray-100 text-gray-700';
      case 'CANCELLED': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getSignatureStatusBadge = (status) => {
    switch(status) {
      case 'pending': return <Badge className="bg-yellow-100 text-yellow-700 gap-1"><Clock className="w-3 h-3" />Pending</Badge>;
      case 'viewed': return <Badge className="bg-blue-100 text-blue-700 gap-1"><Eye className="w-3 h-3" />Viewed</Badge>;
      case 'signed': return <Badge className="bg-green-100 text-green-700 gap-1"><CheckCircle className="w-3 h-3" />Signed</Badge>;
      case 'declined': return <Badge className="bg-red-100 text-red-700 gap-1"><XCircle className="w-3 h-3" />Declined</Badge>;
      case 'expired': return <Badge className="bg-gray-100 text-gray-700 gap-1"><Clock className="w-3 h-3" />Expired</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!so) {
    return (
      <div className="p-4 md:p-8 max-w-4xl mx-auto">
        <Alert variant="destructive">
          <AlertDescription>Sales order not found</AlertDescription>
        </Alert>
      </div>
    );
  }

  const totalBackordered = inventoryCheck.reduce((accumulator, check) => accumulator + (check.backordered || 0), 0);
  const hasBackorders = totalBackordered > 0;
  const latestSignatureRequest = signatureRequests[0];

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <TenantHeader />
      
      <div className="flex items-center gap-3 mb-6">
        <Link to={createPageUrl("SalesOrderManagement")}>
          <Button variant="outline" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="w-7 h-7 text-green-600" />
            Sales Order: {so.so_number}
          </h1>
          <p className="text-sm text-gray-600">Customer: {so.customer_name}</p>
        </div>
        <Badge className={getStatusColor(so.status)}>
          {so.status.replace(/_/g, ' ')}
        </Badge>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* PHASE VI - Signature Status */}
      {latestSignatureRequest && (
        <Card className="mb-6 border-2 border-indigo-200 bg-indigo-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileSignature className="w-5 h-5 text-indigo-600" />
                <div>
                  <p className="font-semibold text-indigo-900">Customer Signature Status</p>
                  <p className="text-sm text-gray-600">Sent to: {latestSignatureRequest.signer_email}</p>
                </div>
              </div>
              <div className="text-right">
                {getSignatureStatusBadge(latestSignatureRequest.status)}
                <p className="text-xs text-gray-500 mt-1">
                  Sent: {format(new Date(latestSignatureRequest.sent_at), 'MMM dd, h:mm a')}
                </p>
              </div>
            </div>
            {latestSignatureRequest.status === 'signed' && latestSignatureRequest.signed_document_url && (
              <div className="mt-3 pt-3 border-t">
                <a
                  href={latestSignatureRequest.signed_document_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline"
                >
                  📄 Download Signed Document
                </a>
              </div>
            )}
            {latestSignatureRequest.status === 'declined' && (
              <div className="mt-3 pt-3 border-t">
                <p className="text-sm text-red-700">
                  <strong>Declined:</strong> {latestSignatureRequest.declined_reason}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Workflow Status Guide */}
      <Card className="mb-6 border-2 border-blue-200 bg-blue-50">
        <CardContent className="p-4">
          <h3 className="font-semibold text-blue-900 mb-3">Sales Order Workflow (PHASE VI):</h3>
          <div className="flex items-center gap-2 text-xs flex-wrap">
            <Badge className={so.status === 'QUOTATION' ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-600'}>
              1. QUOTATION
            </Badge>
            <span>→</span>
            <Badge className={so.status === 'DRAFT' ? 'bg-gray-600 text-white' : 'bg-gray-200 text-gray-600'}>
              2. DRAFT
            </Badge>
            <span>→</span>
            <Badge className={so.status === 'PENDING_CUSTOMER_SIGNATURE' ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-600'}>
              3. CUSTOMER SIGNATURE
            </Badge>
            <span>→</span>
            <Badge className={so.status === 'PENDING_APPROVAL' ? 'bg-yellow-600 text-white' : 'bg-gray-200 text-gray-600'}>
              4. MANAGER APPROVAL
            </Badge>
            <span>→</span>
            <Badge className={so.status === 'APPROVED' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'}>
              5. APPROVED
            </Badge>
            <span>→</span>
            <Badge className={so.status === 'RELEASED' ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-600'}>
              6. RELEASED
            </Badge>
          </div>
          <p className="text-xs text-gray-600 mt-2">
            <strong>PHASE VI:</strong> Customer signs Order Confirmation digitally via Dropbox Sign before internal approval
          </p>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3">
            {/* QUOTATION Stage */}
            {so.status === 'QUOTATION' && (
              <>
                <Button
                  onClick={() => navigate(createPageUrl(`EditSalesOrder?id=${soId}`))}
                  variant="outline"
                  className="gap-2"
                >
                  <Edit className="w-4 h-4" />
                  Edit Quote
                </Button>
                <Button
                  onClick={() => navigate(createPageUrl(`PrintQuotation?id=${soId}`))}
                  className="bg-purple-600 hover:bg-purple-700 gap-2"
                >
                  <Printer className="w-4 h-4" />
                  Print Quotation
                </Button>
                <Button
                  onClick={() => updateSOMutation.mutate({ status: 'DRAFT' })}
                  disabled={updateSOMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700 gap-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  Convert to Sales Order
                </Button>
              </>
            )}

            {/* DRAFT Stage - Send for Customer Signature (PHASE VI) */}
            {so.status === 'DRAFT' && (
              <>
                <Button
                  onClick={() => navigate(createPageUrl(`EditSalesOrder?id=${soId}`))}
                  variant="outline"
                  className="gap-2"
                >
                  <Edit className="w-4 h-4" />
                  Edit SO
                </Button>
                <Button
                  onClick={() => setShowSignatureDialog(true)}
                  className="bg-indigo-600 hover:bg-indigo-700 gap-2"
                >
                  <FileSignature className="w-4 h-4" />
                  Send for Customer Signature (PHASE VI)
                </Button>
                <Button
                  onClick={handlePrintOrderConfirmation}
                  variant="outline"
                  className="gap-2"
                >
                  <Printer className="w-4 h-4" />
                  Print Order Confirmation (Manual)
                </Button>
              </>
            )}

            {/* PENDING_CUSTOMER_SIGNATURE - Waiting for customer */}
            {so.status === 'PENDING_CUSTOMER_SIGNATURE' && (
              <>
                <Button
                  onClick={() => navigate(createPageUrl(`PrintOrderConfirmation?id=${soId}`))}
                  variant="outline"
                  className="gap-2"
                >
                  <Printer className="w-4 h-4" />
                  View Order Confirmation
                </Button>
                <Button
                  onClick={() => setShowSignatureDialog(true)}
                  variant="outline"
                  className="gap-2"
                >
                  <Send className="w-4 h-4" />
                  Resend Signature Request
                </Button>
              </>
            )}

            {/* PENDING_APPROVAL Stage - Sales Manager Approves (after customer signs) */}
            {so.status === 'PENDING_APPROVAL' && (
              <>
                <Button
                  onClick={handleApprove}
                  disabled={updateSOMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700 gap-2"
                >
                  <UserCheck className="w-4 h-4" />
                  Approve Order (Sales Manager)
                </Button>
                <Button
                  onClick={() => navigate(createPageUrl(`PrintOrderConfirmation?id=${soId}`))}
                  variant="outline"
                  className="gap-2"
                >
                  <Printer className="w-4 h-4" />
                  View Order Confirmation
                </Button>
                {latestSignatureRequest?.signed_document_url && (
                  <a href={latestSignatureRequest.signed_document_url} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" className="gap-2">
                      <FileSignature className="w-4 h-4" />
                      View Signed Document
                    </Button>
                  </a>
                )}
                <Button
                  onClick={() => updateSOMutation.mutate({ status: 'NEEDS_UPDATE' })}
                  variant="outline"
                  className="gap-2"
                >
                  <Edit className="w-4 h-4" />
                  Request Changes
                </Button>
              </>
            )}

            {/* APPROVED Stage - Release for Fulfillment */}
            {so.status === 'APPROVED' && (
              <>
                <Button
                  onClick={handleRelease}
                  disabled={updateSOMutation.isPending}
                  className="bg-purple-600 hover:bg-purple-700 gap-2"
                >
                  <Send className="w-4 h-4" />
                  Release for Fulfillment
                </Button>
                <Button
                  onClick={() => navigate(createPageUrl(`PrintOrderConfirmation?id=${soId}`))}
                  variant="outline"
                  className="gap-2"
                >
                  <Printer className="w-4 h-4" />
                  Print Order Confirmation
                </Button>
                <Button
                  onClick={() => navigate(createPageUrl(`PrintPackingSlip?id=${soId}`))}
                  variant="outline"
                  className="gap-2"
                >
                  <Package className="w-4 h-4" />
                  Print Packing Slip
                </Button>
              </>
            )}

            {/* RELEASED Stage - Create Waybill & Invoice */}
            {so.status === 'RELEASED' && (
              <>
                <Button
                  onClick={() => navigate(createPageUrl(`CreateWaybill?so_id=${soId}`))}
                  className="bg-blue-600 hover:bg-blue-700 gap-2"
                >
                  <FileText className="w-4 h-4" />
                  Create Waybill / BOL
                </Button>
                <Button
                  onClick={() => navigate(createPageUrl(`CreateInvoice?so_id=${soId}`))}
                  className="bg-green-600 hover:bg-green-700 gap-2"
                >
                  <FileText className="w-4 h-4" />
                  Create Invoice
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="gap-2">
                      <Printer className="w-4 h-4" />
                      Print Documents
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => navigate(createPageUrl(`PrintOrderConfirmation?id=${soId}`))}>
                      Order Confirmation
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate(createPageUrl(`PrintPackingSlip?id=${soId}`))}>
                      Packing Slip
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}

            {/* All non-terminal statuses can be cancelled */}
            {so.status !== 'CANCELLED' && so.status !== 'CLOSED' && (
              <Button
                onClick={() => setShowCancelDialog(true)}
                variant="outline"
                className="border-red-300 text-red-600 hover:bg-red-50 gap-2"
              >
                <XCircle className="w-4 h-4" />
                Cancel SO
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Send for Signature Dialog */}
      <Dialog open={showSignatureDialog} onOpenChange={setShowSignatureDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSignature className="w-5 h-5 text-indigo-600" />
              Send Order Confirmation for Signature
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Alert className="bg-indigo-50 border-indigo-200">
              <FileSignature className="h-4 w-4 text-indigo-600" />
              <AlertDescription className="text-indigo-900 text-sm">
                <strong>PHASE VI Feature:</strong> Order Confirmation will be sent via Dropbox Sign for digital signature.
                Customer will receive an email with a secure signing link.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label>Signer Name *</Label>
              <Input
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                placeholder="Customer contact name"
              />
            </div>

            <div className="space-y-2">
              <Label>Signer Email *</Label>
              <Input
                type="email"
                value={signerEmail}
                onChange={(e) => setSignerEmail(e.target.value)}
                placeholder="customer@company.com"
              />
            </div>

            <div className="p-3 bg-gray-50 rounded text-sm space-y-1">
              <p><strong>What happens next:</strong></p>
              <p>1. Order Confirmation PDF sent to customer via Dropbox Sign</p>
              <p>2. Customer receives email with signing link</p>
              <p>3. After signing, order moves to PENDING_APPROVAL</p>
              <p>4. Sales Manager can then approve internally</p>
            </div>

            <div className="flex gap-3">
              <Button
                onClick={() => setShowSignatureDialog(false)}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSendForSignature}
                disabled={sendForSignatureMutation.isPending || !signerEmail || !signerName}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700"
              >
                {sendForSignatureMutation.isPending ? 'Sending...' : 'Send for Signature'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cancel Dialog */}
      {showCancelDialog && (
        <Card className="mb-6 border-red-300">
          <CardHeader className="bg-red-50">
            <CardTitle className="text-red-700">Cancel Sales Order</CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Cancellation Reason *</label>
              <Textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Enter reason for cancellation..."
                rows={3}
              />
            </div>
            <div className="flex gap-3">
              <Button
                onClick={() => {
                  setShowCancelDialog(false);
                  setCancelReason('');
                }}
                variant="outline"
                className="flex-1"
              >
                Back
              </Button>
              <Button
                onClick={handleCancel}
                disabled={!cancelReason.trim() || updateSOMutation.isPending}
                className="flex-1 bg-red-600 hover:bg-red-700"
              >
                Confirm Cancellation
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Inventory Availability Alert */}
      {(so.status === 'DRAFT' || so.status === 'PENDING_APPROVAL') && hasBackorders && (
        <Alert className="mb-6 border-orange-300 bg-orange-50">
          <AlertTriangle className="h-4 w-4 text-orange-600" />
          <AlertDescription className="text-orange-800">
            <strong>Backorder Warning:</strong> {totalBackordered.toFixed(2)} units cannot be fulfilled from current inventory. 
            Items will be marked as backordered upon approval.
          </AlertDescription>
        </Alert>
      )}

      {/* SO Header */}
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Customer Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm text-gray-600">Customer</p>
              <p className="font-semibold">{so.customer_name}</p>
            </div>
            {so.po_number && (
              <div>
                <p className="text-sm text-gray-600">Customer PO Number</p>
                <p className="font-semibold">{so.po_number}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Order Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {so.ship_date && (
                <div>
                  <p className="text-sm text-gray-600">Ship Date</p>
                  <p className="font-semibold">{format(new Date(so.ship_date), 'MMM dd, yyyy')}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-gray-600">Ship Method</p>
                <p className="font-semibold">{so.ship_method}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Payment Terms</p>
                <p className="font-semibold">{so.terms}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Currency</p>
                <p className="font-semibold">{so.currency}</p>
              </div>
            </div>
            {so.carrier_code && (
              <div>
                <p className="text-sm text-gray-600">Carrier</p>
                <p className="font-semibold">{so.carrier_code}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="items">
        <TabsList className="mb-6">
          <TabsTrigger value="items">Line Items ({lineItems.length})</TabsTrigger>
          <TabsTrigger value="inventory">Inventory Check</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          {signatureRequests.length > 0 && (
            <TabsTrigger value="signatures">Signatures ({signatureRequests.length})</TabsTrigger>
          )}
        </TabsList>

        {/* Line Items Tab */}
        <TabsContent value="items">
          <Card>
            <CardHeader>
              <CardTitle>Order Line Items</CardTitle>
            </CardHeader>
            <CardContent>
              {lineItems.length === 0 ? (
                <p className="text-center py-8 text-gray-500">No line items</p>
              ) : (
                <div className="space-y-3">
                  {lineItems.map((item) => (
                    <div key={item.id} className="p-4 border rounded-lg">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline">Line {item.line_number}</Badge>
                            {item.quantity_backordered > 0 && (
                              <Badge className="bg-orange-100 text-orange-700">
                                Backorder: {item.quantity_backordered} {item.uom}
                              </Badge>
                            )}
                          </div>
                          <p className="font-semibold">{item.sku_snapshot}</p>
                          <p className="text-sm text-gray-600">{item.description_snapshot}</p>
                        </div>
                      </div>

                      <div className="grid md:grid-cols-4 gap-3 text-sm">
                        <div>
                          <p className="text-gray-600">Category</p>
                          <p className="font-semibold">{item.category}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Quantity Ordered</p>
                          <p className="font-semibold text-blue-700">{item.quantity_ordered} {item.uom}</p>
                        </div>
                        {item.quantity_allocated > 0 && (
                          <div>
                            <p className="text-gray-600">Allocated</p>
                            <p className="font-semibold text-green-700">{item.quantity_allocated} {item.uom}</p>
                          </div>
                        )}
                        {item.hts_code && (
                          <div>
                            <p className="text-gray-600">HTS Code</p>
                            <p className="font-semibold">{item.hts_code}</p>
                          </div>
                        )}
                      </div>

                      {item.packaging_instructions && (
                        <div className="mt-3 p-2 bg-blue-50 rounded text-sm">
                          <p className="font-semibold text-blue-900">Packaging:</p>
                          <p className="text-gray-700">{item.packaging_instructions}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Inventory Check Tab */}
        <TabsContent value="inventory">
          <Card>
            <CardHeader>
              <CardTitle>Inventory Availability Check</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {inventoryCheck.map((check) => {
                  const line = lineItems.find(l => l.id === check.line_id);
                  return (
                    <div key={check.line_id} className="p-4 border rounded-lg">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-semibold">Line {line?.line_number}: {check.sku}</p>
                          <Badge className={check.status === 'AVAILABLE' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}>
                            {check.status}
                          </Badge>
                        </div>
                      </div>

                      <div className="grid md:grid-cols-4 gap-3 text-sm">
                        <div>
                          <p className="text-gray-600">Needed</p>
                          <p className="font-bold text-blue-700">{check.needed.toFixed(2)} {line?.uom}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Available</p>
                          <p className="font-bold text-gray-700">{check.available.toFixed(2)} {line?.uom}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Can Allocate</p>
                          <p className="font-bold text-green-700">{check.allocatable.toFixed(2)} {line?.uom}</p>
                        </div>
                        {check.backordered > 0 && (
                          <div>
                            <p className="text-gray-600">Backordered</p>
                            <p className="font-bold text-orange-700">{check.backordered.toFixed(2)} {line?.uom}</p>
                          </div>
                        )}
                      </div>

                      {check.backordered > 0 && (
                        <div className="mt-3 p-2 bg-orange-50 rounded text-sm">
                          <p className="text-orange-800">
                            <AlertTriangle className="w-4 h-4 inline mr-1" />
                            Insufficient inventory. {check.backordered.toFixed(2)} {line?.uom} will be marked as backordered.
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {hasBackorders && (
                <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <h4 className="font-semibold text-yellow-900 mb-2">Backorder Summary</h4>
                  <p className="text-sm text-yellow-800">
                    Total backordered: <strong>{totalBackordered.toFixed(2)} units</strong>
                  </p>
                  <p className="text-sm text-yellow-800 mt-2">
                    When inventory becomes available, you can create additional invoices for backordered quantities.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notes Tab */}
        <TabsContent value="notes">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Internal Notes</CardTitle>
                {!editingNotes && so.status !== 'CANCELLED' && so.status !== 'CLOSED' && (
                  <Button
                    onClick={() => setEditingNotes(true)}
                    variant="outline"
                    size="sm"
                    className="gap-2"
                  >
                    <Edit className="w-4 h-4" />
                    Edit
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {editingNotes ? (
                <div className="space-y-4">
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={6}
                    placeholder="Add internal notes..."
                  />
                  <div className="flex gap-3">
                    <Button
                      onClick={() => {
                        setEditingNotes(false);
                        setNotes(so.comments_internal || '');
                      }}
                      variant="outline"
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={() => updateNotesMutation.mutate(notes)}
                      disabled={updateNotesMutation.isPending}
                      className="flex-1 bg-green-600 hover:bg-green-700"
                    >
                      Save Notes
                    </Button>
                  </div>
                </div>
              ) : (
                <div>
                  {notes ? (
                    <div className="p-3 bg-gray-50 rounded whitespace-pre-wrap">
                      {notes}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-center py-4">No notes added</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Signature History Tab */}
        {signatureRequests.length > 0 && (
          <TabsContent value="signatures">
            <Card>
              <CardHeader>
                <CardTitle>Signature Request History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {signatureRequests.map((req) => (
                    <div key={req.id} className="p-4 border rounded-lg">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-semibold">{req.signer_name}</p>
                          <p className="text-sm text-gray-600">{req.signer_email}</p>
                        </div>
                        {getSignatureStatusBadge(req.status)}
                      </div>

                      <div className="grid md:grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-gray-600">Sent By:</p>
                          <p className="font-semibold">{req.sent_by}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Sent At:</p>
                          <p className="font-semibold">{format(new Date(req.sent_at), 'MMM dd, yyyy h:mm a')}</p>
                        </div>
                        {req.signed_at && (
                          <>
                            <div>
                              <p className="text-gray-600">Signed At:</p>
                              <p className="font-semibold text-green-700">{format(new Date(req.signed_at), 'MMM dd, yyyy h:mm a')}</p>
                            </div>
                            <div>
                              <a
                                href={req.signed_document_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline text-sm"
                              >
                                📄 Download Signed PDF
                              </a>
                            </div>
                          </>
                        )}
                        {req.declined_reason && (
                          <div className="md:col-span-2">
                            <p className="text-gray-600">Decline Reason:</p>
                            <p className="text-red-700">{req.declined_reason}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Audit Trail */}
      {(so.approved_at || so.released_at || so.printed_order_confirmation_at || so.customer_signature_requested_at) && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Audit Trail</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              {so.created_date && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Created:</span>
                  <span className="font-semibold">
                    {format(new Date(so.created_date), 'MMM dd, yyyy h:mm a')} by {so.created_by}
                  </span>
                </div>
              )}
              {so.customer_signature_requested_at && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Customer Signature Requested:</span>
                  <span className="font-semibold">
                    {format(new Date(so.customer_signature_requested_at), 'MMM dd, yyyy h:mm a')}
                  </span>
                </div>
              )}
              {so.customer_signature_received_at && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Customer Signed:</span>
                  <span className="font-semibold text-green-700">
                    {format(new Date(so.customer_signature_received_at), 'MMM dd, yyyy h:mm a')}
                  </span>
                </div>
              )}
              {so.printed_order_confirmation_at && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Order Confirmation Printed:</span>
                  <span className="font-semibold">
                    {format(new Date(so.printed_order_confirmation_at), 'MMM dd, yyyy h:mm a')}
                  </span>
                </div>
              )}
              {so.approved_at && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Approved (Sales Manager):</span>
                  <span className="font-semibold">
                    {format(new Date(so.approved_at), 'MMM dd, yyyy h:mm a')} by {so.approved_by}
                  </span>
                </div>
              )}
              {so.released_at && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Released:</span>
                  <span className="font-semibold">
                    {format(new Date(so.released_at), 'MMM dd, yyyy h:mm a')} by {so.released_by}
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}