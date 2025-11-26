import React from "react";
import { recims } from "@/api/recimsClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTenant } from "@/components/TenantContext";
import { useNavigate, Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import EmailSender from "@/components/email/EmailSender";
import { 
  FileText, 
  ArrowLeft,
  Printer,
  CheckCircle,
  XCircle,
  AlertTriangle,
  DollarSign,
  Package,
  Mail,
  Send
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { format } from "date-fns";
import TenantHeader from "@/components/TenantHeader";

export default function ViewInvoice() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { tenantConfig, user } = useTenant();
  const [voidReason, setVoidReason] = React.useState('');
  const [showVoidDialog, setShowVoidDialog] = React.useState(false);
  const [showEmailDialog, setShowEmailDialog] = React.useState(false);
  const [emailSuccess, setEmailSuccess] = React.useState(null);
  const [error, setError] = React.useState(null);

  const urlParams = new URLSearchParams(window.location.search);
  const invoiceId = urlParams.get('id');

  const { data: invoice, isLoading } = useQuery({
    queryKey: ['invoice', invoiceId],
    queryFn: async () => {
      const invoices = await recims.entities.Invoice.filter({ id: invoiceId });
      return invoices[0];
    },
    enabled: !!invoiceId,
  });

  const { data: invoiceLines = [] } = useQuery({
    queryKey: ['invoiceLines', invoiceId],
    queryFn: async () => {
      return await recims.entities.InvoiceLine.filter({ invoice_id: invoiceId });
    },
    enabled: !!invoiceId,
    initialData: [],
  });

  const { data: salesOrder } = useQuery({
    queryKey: ['salesOrder', invoice?.so_id],
    queryFn: async () => {
      if (!invoice?.so_id) return null;
      const sos = await recims.entities.SalesOrder.filter({ id: invoice.so_id });
      return sos[0];
    },
    enabled: !!invoice?.so_id,
  });

  const { data: customer } = useQuery({
    queryKey: ['customer', invoice?.customer_id],
    queryFn: async () => {
      if (!invoice?.customer_id) return null;
      const customers = await recims.entities.Customer.filter({ id: invoice.customer_id });
      return customers[0];
    },
    enabled: !!invoice?.customer_id,
  });

  // Void invoice mutation
  const voidInvoiceMutation = useMutation({
    mutationFn: async () => {
      if (!voidReason.trim()) {
        throw new Error("Please provide a reason for voiding the invoice");
      }

      // Update invoice status
      await recims.entities.Invoice.update(invoiceId, {
        status: 'voided',
        voided_reason: voidReason,
        notes: `${invoice.notes || ''}\n\n[VOIDED on ${new Date().toLocaleString()}]\nReason: ${voidReason}`
      });

      // Reverse inventory updates (add back quantities)
      for (const line of invoiceLines) {
        // Find the inventory items that were marked as sold
        const relatedInventory = await recims.entities.Inventory.filter({
          sku_number: line.sku_snapshot,
          status: 'sold'
        });

        // Restore quantities (simplified - in production would need better tracking)
        if (relatedInventory.length > 0) {
          const inv = relatedInventory[0];
          await recims.entities.Inventory.update(inv.id, {
            quantity_kg: (inv.quantity_kg || 0) + line.quantity_invoiced,
            status: 'available'
          });
        }

        // Update SO line - reduce quantity_invoiced
        if (line.so_line_id) {
          const soLines = await recims.entities.SalesOrderLine.filter({ id: line.so_line_id });
          if (soLines.length > 0) {
            const soLine = soLines[0];
            await recims.entities.SalesOrderLine.update(line.so_line_id, {
              quantity_invoiced: Math.max(0, (soLine.quantity_invoiced || 0) - line.quantity_invoiced)
            });
          }
        }
      }

      // Update SO status back to RELEASED if it was closed
      if (salesOrder && salesOrder.status === 'CLOSED') {
        await recims.entities.SalesOrder.update(salesOrder.id, {
          status: 'PARTIALLY_INVOICED'
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['salesOrder'] });
      queryClient.invalidateQueries({ queryKey: ['soLineItems'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      setShowVoidDialog(false);
    },
    onError: (err) => {
      setError(err.message || "Failed to void invoice");
    }
  });

  const getStatusColor = (status) => {
    switch(status) {
      case 'draft': return 'bg-gray-100 text-gray-700';
      case 'finalized': return 'bg-green-100 text-green-700';
      case 'voided': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const handleEmailSuccess = () => {
    setEmailSuccess("Invoice sent successfully!");
    setShowEmailDialog(false);
    setTimeout(() => setEmailSuccess(null), 3000);
  };

  const handleEmailError = (errorMsg) => {
    setError(errorMsg);
    setTimeout(() => setError(null), 5000);
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

  if (!invoice) {
    return (
      <div className="p-4 md:p-8 max-w-4xl mx-auto">
        <Alert variant="destructive">
          <AlertDescription>Invoice not found</AlertDescription>
        </Alert>
      </div>
    );
  }

  const totalAmount = invoiceLines.reduce((sum, line) => sum + (line.line_total || 0), 0);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <TenantHeader />
      
      <div className="flex items-center gap-3 mb-6">
        <Link to={createPageUrl("InvoiceManagement")}>
          <Button variant="outline" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="w-7 h-7 text-green-600" />
            Invoice: {invoice.invoice_number}
          </h1>
          <p className="text-sm text-gray-600">Customer: {invoice.customer_name}</p>
        </div>
        <Badge className={getStatusColor(invoice.status)}>
          {invoice.status.toUpperCase()}
        </Badge>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
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
            <Button
              onClick={() => window.print()}
              variant="outline"
              className="gap-2"
            >
              <Printer className="w-4 h-4" />
              Print Invoice
            </Button>

            {salesOrder && (
              <Button
                onClick={() => navigate(createPageUrl(`ViewSalesOrder?id=${salesOrder.id}`))}
                variant="outline"
                className="gap-2"
              >
                <Package className="w-4 h-4" />
                View Sales Order
              </Button>
            )}

            {invoice.status === 'finalized' && customer && (
              <>
                <Button
                  onClick={() => setShowEmailDialog(true)}
                  className="bg-blue-600 hover:bg-blue-700 gap-2"
                >
                  <Mail className="w-4 h-4" />
                  Email to Customer
                </Button>
                <Badge className="bg-purple-600 text-white">PHASE IV</Badge>
              </>
            )}

            {invoice.status === 'finalized' && (
              <Button
                onClick={() => setShowVoidDialog(true)}
                variant="outline"
                className="border-red-300 text-red-600 hover:bg-red-50 gap-2"
              >
                <XCircle className="w-4 h-4" />
                Void Invoice
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Email Dialog */}
      <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-blue-600" />
              Send Invoice Email
            </DialogTitle>
          </DialogHeader>
          
          <EmailSender
            templateType="invoice"
            recipientEmail={customer?.primary_email || ''}
            data={{
              invoice_number: invoice.invoice_number,
              so_number: invoice.so_number,
              customer_name: invoice.customer_name,
              invoice_date: format(new Date(invoice.invoice_date), 'MMM dd, yyyy'),
              terms: invoice.terms,
              total_amount: totalAmount.toFixed(2),
              currency: invoice.currency,
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

      {/* Void Dialog */}
      {showVoidDialog && (
        <Card className="mb-6 border-red-300">
          <CardHeader className="bg-red-50">
            <CardTitle className="text-red-700">Void Invoice</CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Warning: Voiding this invoice will reverse inventory updates and restore quantities to available stock.
              </AlertDescription>
            </Alert>
            <div>
              <label className="block text-sm font-medium mb-2">Void Reason *</label>
              <Textarea
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                placeholder="Enter reason for voiding invoice..."
                rows={3}
              />
            </div>
            <div className="flex gap-3">
              <Button
                onClick={() => {
                  setShowVoidDialog(false);
                  setVoidReason('');
                }}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={() => voidInvoiceMutation.mutate()}
                disabled={!voidReason.trim() || voidInvoiceMutation.isPending}
                className="flex-1 bg-red-600 hover:bg-red-700"
              >
                Confirm Void
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Invoice Header */}
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Invoice Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm text-gray-600">Invoice Number</p>
              <p className="font-semibold">{invoice.invoice_number}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Sales Order</p>
              <p className="font-semibold">{invoice.so_number}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Invoice Date</p>
              <p className="font-semibold">{format(new Date(invoice.invoice_date), 'MMM dd, yyyy')}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Payment Terms</p>
              <p className="font-semibold">{invoice.terms}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Customer Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm text-gray-600">Customer</p>
              <p className="font-semibold">{invoice.customer_name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Currency</p>
              <p className="font-semibold">{invoice.currency}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Amount</p>
              <p className="text-2xl font-bold text-green-700">
                {invoice.currency} {totalAmount.toFixed(2)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Invoice Lines */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Invoice Line Items</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {invoiceLines.map((line, index) => (
              <div key={line.id} className="p-4 border rounded-lg">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-semibold">{line.sku_snapshot}</p>
                    <p className="text-sm text-gray-600">{line.description}</p>
                  </div>
                  <Badge variant="outline" className="font-semibold">
                    {invoice.currency} {line.line_total.toFixed(2)}
                  </Badge>
                </div>

                <div className="grid md:grid-cols-4 gap-3 text-sm">
                  <div>
                    <p className="text-gray-600">Quantity</p>
                    <p className="font-semibold">{line.quantity_invoiced} {line.uom}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Unit Price</p>
                    <p className="font-semibold">{invoice.currency} {line.unit_price.toFixed(2)}</p>
                  </div>
                  {line.hts_code && (
                    <div>
                      <p className="text-gray-600">HTS Code</p>
                      <p className="font-semibold">{line.hts_code}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-gray-600">Line Total</p>
                    <p className="font-semibold text-green-700">
                      {invoice.currency} {line.line_total.toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
            ))}

            {/* Total */}
            <div className="flex justify-end pt-4 border-t">
              <div className="w-64">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-600">Subtotal:</span>
                  <span className="font-semibold">{invoice.currency} {totalAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t">
                  <span className="text-lg font-bold">Total:</span>
                  <span className="text-lg font-bold text-green-700">
                    {invoice.currency} {totalAmount.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      {invoice.notes && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="p-3 bg-gray-50 rounded whitespace-pre-wrap">
              {invoice.notes}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Audit Trail */}
      <Card>
        <CardHeader>
          <CardTitle>Audit Trail</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            {invoice.created_date && (
              <div className="flex justify-between">
                <span className="text-gray-600">Created:</span>
                <span className="font-semibold">
                  {format(new Date(invoice.created_date), 'MMM dd, yyyy h:mm a')} by {invoice.created_by}
                </span>
              </div>
            )}
            {invoice.finalized_at && (
              <div className="flex justify-between">
                <span className="text-gray-600">Finalized:</span>
                <span className="font-semibold">
                  {format(new Date(invoice.finalized_at), 'MMM dd, yyyy h:mm a')} by {invoice.finalized_by}
                </span>
              </div>
            )}
            {invoice.status === 'voided' && invoice.voided_reason && (
              <div className="p-3 bg-red-50 rounded mt-3">
                <p className="font-semibold text-red-700">Void Reason:</p>
                <p className="text-red-600">{invoice.voided_reason}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}