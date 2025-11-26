import React, { useState } from "react";
import { recims } from "@/api/recimsClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTenant } from "@/components/TenantContext";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  FileText,
  ArrowLeft,
  Edit, // Kept Edit as it's used in existing code
  Printer,
  Barcode,
  CheckCircle,
  Package,
  AlertCircle,
  Trash2,
  Send,
  Download, // Added Download icon
  Mail,     // Added Mail icon
  XCircle,  // Added XCircle icon
  Calendar // Added Calendar icon
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { format } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"; // Added Dialog components
import EmailSender from "@/components/email/EmailSender"; // Added EmailSender

export default function ViewPurchaseOrder() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { tenantConfig, user } = useTenant();
  const [error, setError] = useState(null);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notes, setNotes] = useState('');
  const [showEmailDialog, setShowEmailDialog] = useState(false); // Added state for email dialog
  const [emailSuccess, setEmailSuccess] = useState(null); // Added state for email success message

  const urlParams = new URLSearchParams(window.location.search);
  const poId = urlParams.get('id');



  const { data: po, isLoading } = useQuery({
    queryKey: ['purchaseOrder', poId],
    queryFn: async () => {
      const pos = await recims.entities.PurchaseOrder.filter({ id: poId });
      return pos[0];
    },
    enabled: !!poId,
  });

  const { data: lineItems = [] } = useQuery({
    queryKey: ['poLineItems', poId],
    queryFn: async () => {
      return await recims.entities.PurchaseOrderItem.filter({ po_id: poId }, 'line_number');
    },
    enabled: !!poId,
    initialData: [],
  });

  // Query for vendor data
  const { data: vendor } = useQuery({
    queryKey: ['vendor', po?.vendor_id],
    queryFn: async () => {
      if (!po?.vendor_id) return null;
      const vendors = await recims.entities.Vendor.filter({ id: po.vendor_id });
      return vendors[0];
    },
    enabled: !!po?.vendor_id,
  });

  React.useEffect(() => {
    if (po) {
      setNotes(po.notes || '');
    }
  }, [po]);

  // Renamed updateStatusMutation to updatePOMutation and adjusted its signature
  const updatePOMutation = useMutation({
    mutationFn: async (updatePayload) => {
      return await recims.entities.PurchaseOrder.update(poId, updatePayload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchaseOrder', poId] });
      queryClient.invalidateQueries({ queryKey: ['purchaseOrders'] });
    },
    onError: (err) => {
      setError(err.message || "Failed to update purchase order");
    }
  });

  const updateNotesMutation = useMutation({
    mutationFn: async (newNotes) => {
      return await recims.entities.PurchaseOrder.update(poId, { notes: newNotes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchaseOrder', poId] });
      setEditingNotes(false);
    },
  });

  const obsoletePOMutation = useMutation({
    mutationFn: async () => {
      return await recims.entities.PurchaseOrder.update(poId, {
        status: 'cancelled',
        notes: `${po.notes || ''}\n\n[OBSOLETED on ${new Date().toLocaleDateString()} by ${user?.full_name}]`
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchaseOrder', poId] });
      queryClient.invalidateQueries({ queryKey: ['purchaseOrders'] });
      navigate(createPageUrl("PurchaseOrders"));
    },
  });

  const handleObsolete = () => {
    if (window.confirm('Are you sure you want to obsolete this purchase order? This action cannot be undone.')) {
      obsoletePOMutation.mutate();
    }
  };

  const handleEmailSuccess = () => {
    setEmailSuccess("Purchase order sent successfully!");
    setShowEmailDialog(false);
    setTimeout(() => setEmailSuccess(null), 3000);
    // Optionally invalidate PO query to reflect 'sent' status if applicable
    // queryClient.invalidateQueries({ queryKey: ['purchaseOrder', poId] });
  };

  const handleEmailError = (errorMsg) => {
    setError(errorMsg);
    setTimeout(() => setError(null), 5000);
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'draft': return 'bg-gray-100 text-gray-700';
      case 'sent': return 'bg-blue-100 text-blue-700';
      case 'acknowledged': return 'bg-purple-100 text-purple-700';
      case 'in_transit': return 'bg-yellow-100 text-yellow-700';
      case 'partially_received': return 'bg-orange-100 text-orange-700';
      case 'received': return 'bg-green-100 text-green-700';
      case 'completed': return 'bg-green-100 text-green-700';
      case 'cancelled': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getLineStatusColor = (status) => {
    switch(status) {
      case 'pending': return 'bg-gray-100 text-gray-700';
      case 'received': return 'bg-green-100 text-green-700';
      case 'variance': return 'bg-orange-100 text-orange-700';
      case 'rejected': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!po) {
    return (
      <div className="p-4 md:p-8 max-w-4xl mx-auto">
        <Alert variant="destructive">
          <AlertDescription>Purchase order not found</AlertDescription>
        </Alert>
      </div>
    );
  }

  const receivedItems = lineItems.filter(item => item.status === 'received');
  const progress = lineItems.length > 0 ? (receivedItems.length / lineItems.length) * 100 : 0;
  const useMetric = tenantConfig?.measurement_system === 'metric';

  // Group line items by skid
  const groupedBySkid = lineItems.reduce((acc, item) => {
    const skidNum = item.skid_number;
    if (!acc[skidNum]) {
      acc[skidNum] = [];
    }
    acc[skidNum].push(item);
    return acc;
  }, {});

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Button
          variant="outline"
          size="icon"
          onClick={() => navigate(createPageUrl("PurchaseOrders"))}
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="w-7 h-7 text-indigo-600" />
            Purchase Order: {po.po_number}
          </h1>
          <p className="text-sm text-gray-600">View and manage purchase order details</p>
        </div>
        <Badge className={getStatusColor(po.status)}>
          {po.status}
        </Badge>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {emailSuccess && (
        <Alert className="mb-6 bg-green-50 border-green-200">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">{emailSuccess}</AlertDescription>
        </Alert>
      )}

      {/* Quick Actions */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3">
            {/* NEW: Edit PO Button */}
            {po.status === 'draft' && (
              <Button
                onClick={() => navigate(createPageUrl(`EditPurchaseOrder?id=${poId}`))}
                variant="outline"
                className="gap-2"
              >
                <Edit className="w-4 h-4" />
                Edit PO
              </Button>
            )}

            {/* NEW: Generate/Reprint QR Codes Button */}
            <Button
              onClick={() => navigate(createPageUrl(`GeneratePOBarcodes?id=${poId}`))}
              variant="outline"
              className="gap-2"
            >
              <Printer className="w-4 h-4" />
              {po.barcode_generated ? 'Reprint QR Codes' : 'Generate QR Codes'}
            </Button>

            {/* NEW: Mark as Sent for draft POs */}
            {po.status === 'draft' && (
              <Button
                onClick={() => updatePOMutation.mutate({ status: 'sent' })}
                disabled={updatePOMutation.isPending}
                variant="outline"
                className="gap-2"
              >
                <Send className="w-4 h-4" />
                Mark as Sent
              </Button>
            )}

            {/* Existing: Mark as In Transit (updated to use updatePOMutation) */}
            {(po.status === 'sent' || po.status === 'acknowledged') && (
              <Button
                onClick={() => updatePOMutation.mutate({ status: 'in_transit' })}
                disabled={updatePOMutation.isPending}
                className="bg-yellow-600 hover:bg-yellow-700 gap-2"
              >
                <Package className="w-4 h-4" />
                Mark as In Transit
              </Button>
            )}

            {/* Modified: Receive Items (was Receive Shipment, icon and text changed as per outline) */}
            {(po.status === 'sent' || po.status === 'in_transit' || po.status === 'partially_received') && (
              <Button
                onClick={() => navigate(createPageUrl(`ReceivePurchaseOrder?id=${poId}`))}
                className="bg-green-600 hover:bg-green-700 gap-2"
              >
                <Package className="w-4 h-4" />
                Receive Items
              </Button>
            )}

            {/* Existing: Complete PO (updated to use updatePOMutation) */}
            {po.status === 'received' && (
              <Button
                onClick={() => updatePOMutation.mutate({ status: 'completed' })}
                disabled={updatePOMutation.isPending}
                className="bg-green-600 hover:bg-green-700 gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                Complete PO
              </Button>
            )}

            {/* Existing: Obsolete PO */}
            {po.status !== 'cancelled' && po.status !== 'completed' && (
              <Button
                onClick={handleObsolete}
                disabled={obsoletePOMutation.isPending}
                variant="outline"
                className="border-red-300 text-red-600 hover:bg-red-50 gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Obsolete PO
              </Button>
            )}

            {/* Existing: Print */}
            <Button
              onClick={() => window.print()}
              variant="outline"
              className="gap-2"
            >
              <Printer className="w-4 h-4" />
              Print
            </Button>

            {po.status !== 'cancelled' && vendor && (
              <>
                <Button
                  onClick={() => setShowEmailDialog(true)}
                  className="bg-blue-600 hover:bg-blue-700 gap-2"
                >
                  <Mail className="w-4 h-4" />
                  Email to Vendor
                </Button>
                <Badge className="bg-purple-600 text-white">PHASE IV</Badge>
              </>
            )}

            {/* NEW: Back to POs button */}
            <Button
              onClick={() => navigate(createPageUrl('PurchaseOrders'))}
              variant="outline"
            >
              Back to POs
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* PO Header */}
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Vendor Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm text-gray-600">Vendor Name</p>
              <p className="font-semibold">{po.vendor_name}</p>
            </div>
            {po.contact_person && (
              <div>
                <p className="text-sm text-gray-600">Contact Person</p>
                <p className="font-semibold">{po.contact_person}</p>
              </div>
            )}
            {po.shipping_address && (
              <div>
                <p className="text-sm text-gray-600">Shipping Address</p>
                <p className="text-sm">{po.shipping_address}</p>
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
              <div>
                <p className="text-sm text-gray-600">Order Date</p>
                <p className="font-semibold">{format(new Date(po.order_date), 'MMM dd, yyyy')}</p>
              </div>
              {po.expected_delivery_date && (
                <div>
                  <p className="text-sm text-gray-600">Expected Delivery</p>
                  <p className="font-semibold">{format(new Date(po.expected_delivery_date), 'MMM dd, yyyy')}</p>
                </div>
              )}
              {po.actual_delivery_date && (
                <div>
                  <p className="text-sm text-gray-600">Actual Delivery</p>
                  <p className="font-semibold">{format(new Date(po.actual_delivery_date), 'MMM dd, yyyy')}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-gray-600">Payment Terms</p>
                <p className="font-semibold">{po.payment_terms || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Payment Method</p>
                <p className="font-semibold">{po.payment_method_ref || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Currency</p>
                <p className="font-semibold">{po.currency}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progress */}
      {po.status !== 'draft' && po.status !== 'sent' && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Receiving Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Skids Received</p>
                  <p className="text-2xl font-bold">{po.total_skids_received || 0} / {po.total_skids_expected}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Weight Received</p>
                  <p className="text-2xl font-bold">
                    {useMetric
                      ? `${(po.total_received_weight_kg || 0).toFixed(0)} / ${(po.total_expected_weight_kg || 0).toFixed(0)} kg`
                      : `${(po.total_received_weight_lbs || 0).toFixed(0)} / ${(po.total_expected_weight_lbs || 0).toFixed(0)} lbs`
                    }
                  </p>
                </div>
                <Badge className={progress === 100 ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}>
                  {progress.toFixed(0)}% Complete
                </Badge>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-green-600 h-3 rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="items">
        <TabsList className="mb-6">
          <TabsTrigger value="items">Skids & Products ({Object.keys(groupedBySkid).length} skids, {lineItems.length} products)</TabsTrigger>
          <TabsTrigger value="notes">Notes & Instructions</TabsTrigger>
        </TabsList>

        {/* Line Items Tab */}
        <TabsContent value="items">
          <Card>
            <CardHeader>
              <CardTitle>Skids & Products</CardTitle>
            </CardHeader>
            <CardContent>
              {lineItems.length === 0 ? (
                <p className="text-center py-8 text-gray-500">No line items</p>
              ) : (
                <div className="space-y-6">
                  {Object.entries(groupedBySkid).map(([skidNum, skidItems]) => (
                    <div key={skidNum} className="p-4 border-2 border-indigo-100 rounded-lg bg-indigo-50">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <Badge variant="default" className="bg-indigo-600 text-lg px-3 py-1">
                            {skidNum}
                          </Badge>
                          <Badge variant="outline">{skidItems.length} product(s)</Badge>
                          {skidItems.every(item => item.status === 'received') && (
                            <Badge className="bg-green-100 text-green-700">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Received
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="space-y-3">
                        {skidItems.map((item) => (
                          <div key={item.id} className="p-3 bg-white border rounded-lg">
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <p className="font-semibold text-sm">Line #{item.line_number}</p>
                                  <Badge className={getLineStatusColor(item.status)}>
                                    {item.status}
                                  </Badge>
                                  {item.quality_grade && (
                                    <Badge variant="outline">Grade {item.quality_grade}</Badge>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="grid md:grid-cols-4 gap-2 text-sm">
                              <div>
                                <p className="text-gray-600">Category</p>
                                <p className="font-semibold">{item.category}</p>
                              </div>
                              {item.sub_category && (
                                <div>
                                  <p className="text-gray-600">Sub-Category</p>
                                  <p className="font-semibold">{item.sub_category}</p>
                                </div>
                              )}
                              {item.product_type && (
                                <div>
                                  <p className="text-gray-600">Product Type</p>
                                  <p className="font-semibold">{item.product_type}</p>
                                </div>
                              )}
                              {item.purity && (
                                <div>
                                  <p className="text-gray-600">Purity</p>
                                  <p className="font-semibold">{item.purity}</p>
                                </div>
                              )}
                            </div>

                            <div className="grid md:grid-cols-3 gap-2 text-sm mt-2">
                              <div>
                                <p className="text-gray-600">Expected Weight</p>
                                <p className="font-semibold">
                                  {useMetric
                                    ? `${item.expected_weight_kg.toFixed(2)} kg`
                                    : `${item.expected_weight_lbs.toFixed(2)} lbs`
                                  }
                                </p>
                              </div>
                              {item.actual_weight_kg > 0 && (
                                <div>
                                  <p className="text-gray-600">Actual Weight</p>
                                  <p className="font-semibold text-green-700">
                                    {useMetric
                                      ? `${item.actual_weight_kg.toFixed(2)} kg`
                                      : `${item.actual_weight_lbs.toFixed(2)} lbs`
                                    }
                                  </p>
                                </div>
                              )}
                              {item.bin_location && (
                                <div>
                                  <p className="text-gray-600">Location</p>
                                  <p className="font-semibold">{item.bin_location}</p>
                                </div>
                              )}
                            </div>

                            {item.variance_notes && (
                              <div className="mt-2 p-2 bg-orange-50 rounded text-xs">
                                <p className="font-semibold text-orange-900">Variance:</p>
                                <p className="text-gray-700">{item.variance_notes}</p>
                              </div>
                            )}

                            {item.inspection_notes && (
                              <div className="mt-2 p-2 bg-blue-50 rounded text-xs">
                                <p className="font-semibold text-blue-900">Inspection:</p>
                                <p className="text-gray-700">{item.inspection_notes}</p>
                              </div>
                            )}

                            {item.received_date && (
                              <div className="mt-2 text-xs text-gray-500">
                                Received: {format(new Date(item.received_date), 'MMM dd, yyyy h:mm a')} by {item.received_by}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
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
                <CardTitle>Notes & Special Instructions</CardTitle>
                {!editingNotes && (
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
                    placeholder="Add notes or special instructions..."
                  />
                  <div className="flex gap-3">
                    <Button
                      onClick={() => {
                        setEditingNotes(false);
                        setNotes(po.notes || '');
                      }}
                      variant="outline"
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={() => updateNotesMutation.mutate(notes)}
                      disabled={updateNotesMutation.isPending}
                      className="flex-1 bg-indigo-600 hover:bg-indigo-700"
                    >
                      Save Notes
                    </Button>
                  </div>
                </div>
              ) : (
                <div>
                  {po.special_instructions && (
                    <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                      <p className="text-sm font-semibold text-yellow-900 mb-1">Special Instructions:</p>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{po.special_instructions}</p>
                    </div>
                  )}
                  {notes ? (
                    <div className="p-3 bg-gray-50 rounded">
                      <p className="text-sm whitespace-pre-wrap">{notes}</p>
                    </div>
                  ) : (
                    <p className="text-gray-500 text-center py-4">No notes added</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Totals */}
      {po.total_amount > 0 && (
        <Card className="mt-6">
          <CardContent className="p-6">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-gray-600">Total Purchase Order Amount</p>
                <p className="text-3xl font-bold text-indigo-700">${po.total_amount.toFixed(2)} {po.currency}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Email Dialog */}
      <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-blue-600" />
              Send Purchase Order Email
            </DialogTitle>
          </DialogHeader>

          <EmailSender
            templateType="purchase_order"
            recipientEmail={vendor?.primary_email || ''}
            data={{
              po_number: po.po_number,
              vendor_name: po.vendor_name,
              expected_delivery_date: po.expected_delivery_date ? format(new Date(po.expected_delivery_date), 'MMM dd, yyyy') : 'TBD',
              total_amount: po.total_amount?.toFixed(2) || '0.00',
              currency: po.currency,
              total_weight_kg: po.total_expected_weight_kg || 0,
              company_name: tenantConfig?.company_name || tenantConfig?.display_name,
              company_address: tenantConfig?.address_line1 
                ? `${tenantConfig.address_line1}, ${tenantConfig.city}, ${tenantConfig.state_province} ${tenantConfig.postal_code}, ${tenantConfig.country}`
                : '',
              company_phone: tenantConfig?.phone || ''
            }}
            onSuccess={handleEmailSuccess}
            onError={handleEmailError}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}