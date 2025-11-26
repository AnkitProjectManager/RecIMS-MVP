import React, { useState } from "react";
import { recims } from "@/api/recimsClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTenant } from "@/components/TenantContext";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { 
  FileText, 
  ArrowLeft, 
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle,
  Package,
  DollarSign
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { format } from "date-fns";
import TenantHeader from "@/components/TenantHeader";

export default function CreateInvoice() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { tenantConfig, user } = useTenant();
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Get SO ID from URL if coming from a specific SO
  const urlParams = new URLSearchParams(window.location.search);
  const soIdFromUrl = urlParams.get('so_id');

  const [selectedSOId, setSelectedSOId] = useState(soIdFromUrl || '');
  const [invoiceDate, setInvoiceDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [terms, setTerms] = useState('Net30');
  const [notes, setNotes] = useState('');
  const [lineItems, setLineItems] = useState([]);
  const [showPreview, setShowPreview] = useState(false);



  // Fetch released/approved sales orders
  const { data: salesOrders = [] } = useQuery({
    queryKey: ['releasedSalesOrders', user?.tenant_id],
    queryFn: async () => {
      if (!user?.tenant_id) return [];
      const orders = await recims.entities.SalesOrder.filter({
        tenant_id: user.tenant_id,
        status: 'RELEASED'
      }, '-created_date');
      return orders;
    },
    enabled: !!user?.tenant_id,
    initialData: [],
  });

  // Fetch selected SO details
  const { data: selectedSO } = useQuery({
    queryKey: ['salesOrder', selectedSOId],
    queryFn: async () => {
      if (!selectedSOId) return null;
      const sos = await recims.entities.SalesOrder.filter({ id: selectedSOId });
      return sos[0];
    },
    enabled: !!selectedSOId,
  });

  // Fetch SO line items
  const { data: soLineItems = [] } = useQuery({
    queryKey: ['soLineItems', selectedSOId],
    queryFn: async () => {
      if (!selectedSOId) return [];
      return await recims.entities.SalesOrderLine.filter({ so_id: selectedSOId }, 'line_number');
    },
    enabled: !!selectedSOId,
    initialData: [],
  });

  // Fetch inventory for allocation
  const { data: inventory = [] } = useQuery({
    queryKey: ['availableInventory', user?.tenant_id],
    queryFn: async () => {
      if (!user?.tenant_id) return [];
      return await recims.entities.Inventory.filter({
        tenant_id: user.tenant_id,
        status: 'available'
      });
    },
    enabled: !!user?.tenant_id,
    initialData: [],
  });

  // Initialize line items when SO is selected
  React.useEffect(() => {
    if (soLineItems.length > 0 && lineItems.length === 0) {
      const initialLines = soLineItems
        .filter(line => {
          const remainingToInvoice = line.quantity_allocated - (line.quantity_invoiced || 0);
          return remainingToInvoice > 0;
        })
        .map(line => ({
          so_line_id: line.id,
          line_number: line.line_number,
          product_id: line.product_id, // Added product_id
          sku: line.sku_snapshot,
          description: line.description_snapshot,
          category: line.category,
          uom: line.uom,
          hts_code: line.hts_code || '',
          quantity_allocated: line.quantity_allocated || 0,
          quantity_invoiced_prev: line.quantity_invoiced || 0,
          quantity_available: (line.quantity_allocated || 0) - (line.quantity_invoiced || 0),
          quantity_to_invoice: (line.quantity_allocated || 0) - (line.quantity_invoiced || 0),
          unit_price: 0, // Will be calculated from inventory
          line_total: 0
        }));
      setLineItems(initialLines);
    }
  }, [soLineItems, lineItems.length]);

  // Calculate unit price based on inventory
  const calculateUnitPrice = (sku, category) => {
    const matchingInventory = inventory.filter(inv => 
      inv.sku_number === sku && inv.category === category && inv.status === 'available'
    );
    if (matchingInventory.length === 0) return 0;
    const avgPrice = matchingInventory.reduce((sum, inv) => sum + (inv.price_per_kg || 0), 0) / matchingInventory.length;
    return avgPrice;
  };

  // Update line item
  const updateLineItem = (index, field, value) => {
    const updated = [...lineItems];
    updated[index][field] = value;
    
    if (field === 'quantity_to_invoice') {
      const unitPrice = updated[index].unit_price || calculateUnitPrice(updated[index].sku, updated[index].category);
      updated[index].unit_price = unitPrice;
      updated[index].line_total = value * unitPrice;
    }
    
    setLineItems(updated);
  };

  // Remove line item
  const removeLineItem = (index) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  // Calculate totals
  const totalAmount = lineItems.reduce((sum, line) => sum + (line.line_total || 0), 0);

  // Generate invoice number
  const generateInvoiceNumber = async () => {
    const prefix = tenantConfig?.tenant_code ? `${tenantConfig.tenant_code}-INV` : 'INV';
    const year = new Date().getFullYear();
    const invoices = await recims.entities.Invoice.filter({ tenant_id: user?.tenant_id });
    const count = invoices.length + 1;
    return `${prefix}-${year}-${String(count).padStart(4, '0')}`;
  };

  // Create invoice mutation
  const createInvoiceMutation = useMutation({
    mutationFn: async ({ finalize }) => {
      setError(null);
      setSuccess(null);

      if (!selectedSO) {
        throw new Error("No sales order selected");
      }

      if (lineItems.length === 0) {
        throw new Error("No line items to invoice");
      }

      // Validate quantities
      for (const line of lineItems) {
        if (line.quantity_to_invoice <= 0) {
          throw new Error(`Line ${line.line_number}: Quantity must be greater than 0`);
        }
        if (line.quantity_to_invoice > line.quantity_available) {
          throw new Error(`Line ${line.line_number}: Cannot invoice more than available quantity`);
        }
      }

      // Generate invoice number
      const invoiceNumber = await generateInvoiceNumber();

      // Create invoice
      const invoice = await recims.entities.Invoice.create({
        invoice_number: invoiceNumber,
        tenant_id: user.tenant_id,
        so_id: selectedSO.id,
        so_number: selectedSO.so_number,
        customer_id: selectedSO.customer_id,
        customer_name: selectedSO.customer_name,
        invoice_date: invoiceDate,
        terms: terms,
        currency: selectedSO.currency,
        total_amount: totalAmount,
        status: finalize ? 'finalized' : 'draft',
        finalized_by: finalize ? user.email : null,
        finalized_at: finalize ? new Date().toISOString() : null,
        notes: notes
      });

      // Create invoice lines
      for (const line of lineItems) {
        await recims.entities.InvoiceLine.create({
          invoice_id: invoice.id,
          tenant_id: user.tenant_id,
          so_line_id: line.so_line_id,
          product_id: line.product_id, // Fixed: use product_id instead of sku
          sku_snapshot: line.sku,
          description: line.description,
          quantity_invoiced: line.quantity_to_invoice,
          uom: line.uom,
          hts_code: line.hts_code || '',
          unit_price: line.unit_price,
          line_total: line.line_total
        });

        // Update SO line item
        await recims.entities.SalesOrderLine.update(line.so_line_id, {
          quantity_invoiced: (line.quantity_invoiced_prev || 0) + line.quantity_to_invoice
        });
      }

      if (finalize) {
        // Update inventory - mark items as sold
        for (const line of lineItems) {
          let remainingToSell = line.quantity_to_invoice;
          
          // Find matching inventory items
          const matchingInventory = inventory.filter(inv => 
            inv.sku_number === line.sku && 
            inv.category === line.category && 
            inv.status === 'available'
          ).sort((a, b) => (a.received_date || '').localeCompare(b.received_date || '')); // FIFO

          for (const inv of matchingInventory) {
            if (remainingToSell <= 0) break;

            const availableQty = (inv.quantity_kg || 0) - (inv.reserved_kg || 0);
            const qtyToSell = Math.min(remainingToSell, availableQty);

            if (qtyToSell > 0) {
              const newQty = (inv.quantity_kg || 0) - qtyToSell;
              
              await recims.entities.Inventory.update(inv.id, {
                quantity_kg: newQty,
                status: newQty <= 0 ? 'sold' : 'available'
              });

              remainingToSell -= qtyToSell;
            }
          }
        }

        // Update SO status
        // Check if all lines are fully invoiced
        const updatedLines = await recims.entities.SalesOrderLine.filter({ so_id: selectedSO.id });
        const allFullyInvoiced = updatedLines.every(line => 
          (line.quantity_invoiced || 0) >= (line.quantity_allocated || 0)
        );

        const newStatus = allFullyInvoiced ? 'CLOSED' : 'PARTIALLY_INVOICED';
        await recims.entities.SalesOrder.update(selectedSO.id, {
          status: newStatus
        });
      }

      return invoice;
    },
    onSuccess: (invoice, variables) => {
      queryClient.invalidateQueries({ queryKey: ['salesOrders'] });
      queryClient.invalidateQueries({ queryKey: ['salesOrder'] });
      queryClient.invalidateQueries({ queryKey: ['soLineItems'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      
      if (variables.finalize) {
        setSuccess("Invoice finalized successfully! Inventory has been updated.");
        setTimeout(() => {
          navigate(createPageUrl(`ViewInvoice?id=${invoice.id}`));
        }, 2000);
      } else {
        setSuccess("Invoice draft created successfully!");
        setTimeout(() => {
          navigate(createPageUrl(`ViewInvoice?id=${invoice.id}`));
        }, 2000);
      }
    },
    onError: (err) => {
      console.error('[CreateInvoice] Error creating invoice:', err);
      setError(`Failed to create invoice: ${err.message || 'Please check console for details'}`);
    }
  });

  const handleSaveDraft = () => {
    createInvoiceMutation.mutate({ finalize: false });
  };

  const handleFinalize = () => {
    if (window.confirm("Are you sure you want to finalize this invoice? This will update inventory and cannot be undone.")) {
      createInvoiceMutation.mutate({ finalize: true });
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <TenantHeader />
      
      <div className="flex items-center gap-3 mb-6">
        <Button
          variant="outline"
          size="icon"
          onClick={() => navigate(createPageUrl("SalesOrderManagement"))}
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="w-7 h-7 text-green-600" />
            Create Invoice
          </h1>
          <p className="text-sm text-gray-600">Invoice released sales orders and update inventory</p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="mb-6 border-green-300 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">{success}</AlertDescription>
        </Alert>
      )}

      {/* Invoice Header */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Invoice Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Sales Order *</Label>
              <Select
                value={selectedSOId}
                onValueChange={(value) => {
                  setSelectedSOId(value);
                  setLineItems([]); // Reset line items when SO changes
                }}
                disabled={!!soIdFromUrl}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select sales order..." />
                </SelectTrigger>
                <SelectContent>
                  {salesOrders.map((so) => (
                    <SelectItem key={so.id} value={so.id}>
                      {so.so_number} - {so.customer_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Invoice Date *</Label>
              <Input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Payment Terms</Label>
              <Select value={terms} onValueChange={setTerms}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="COD">COD</SelectItem>
                  <SelectItem value="PREPAID">Prepaid</SelectItem>
                  <SelectItem value="ACH">ACH</SelectItem>
                  <SelectItem value="EFT">EFT</SelectItem>
                  <SelectItem value="Net10">Net 10</SelectItem>
                  <SelectItem value="Net30">Net 30</SelectItem>
                  <SelectItem value="Net60">Net 60</SelectItem>
                  <SelectItem value="Net90">Net 90</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Currency</Label>
              <Input value={selectedSO?.currency || 'USD'} disabled />
            </div>
          </div>

          {selectedSO && (
            <div className="p-4 bg-blue-50 rounded-lg">
              <h3 className="font-semibold text-blue-900 mb-2">Sales Order Details</h3>
              <div className="grid md:grid-cols-3 gap-2 text-sm">
                <div>
                  <span className="text-blue-600">Customer:</span> {selectedSO.customer_name}
                </div>
                <div>
                  <span className="text-blue-600">PO Number:</span> {selectedSO.po_number || 'N/A'}
                </div>
                <div>
                  <span className="text-blue-600">Ship Method:</span> {selectedSO.ship_method}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Line Items */}
      {selectedSOId && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Invoice Line Items</CardTitle>
          </CardHeader>
          <CardContent>
            {lineItems.length === 0 ? (
              <Alert>
                <Package className="h-4 w-4" />
                <AlertDescription>
                  No items available to invoice. All line items may have been fully invoiced already.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-4">
                {lineItems.map((line, index) => (
                  <div key={index} className="p-4 border rounded-lg">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline">Line {line.line_number}</Badge>
                          <p className="font-semibold">{line.sku}</p>
                        </div>
                        <p className="text-sm text-gray-600">{line.description}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeLineItem(index)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>

                    <div className="grid md:grid-cols-5 gap-3">
                      <div>
                        <Label className="text-xs">Category</Label>
                        <Input value={line.category} disabled className="h-9" />
                      </div>

                      <div>
                        <Label className="text-xs">Available Qty</Label>
                        <Input
                          value={`${line.quantity_available} ${line.uom}`}
                          disabled
                          className="h-9 font-semibold text-blue-700"
                        />
                      </div>

                      <div>
                        <Label className="text-xs">Qty to Invoice *</Label>
                        <Input
                          type="number"
                          value={line.quantity_to_invoice}
                          onChange={(e) => updateLineItem(index, 'quantity_to_invoice', parseFloat(e.target.value) || 0)}
                          max={line.quantity_available}
                          min={0}
                          step="0.01"
                          className="h-9"
                        />
                      </div>

                      <div>
                        <Label className="text-xs">Unit Price</Label>
                        <Input
                          type="number"
                          value={line.unit_price}
                          onChange={(e) => {
                            const price = parseFloat(e.target.value) || 0;
                            updateLineItem(index, 'unit_price', price);
                            updateLineItem(index, 'line_total', price * line.quantity_to_invoice);
                          }}
                          step="0.01"
                          className="h-9"
                        />
                      </div>

                      <div>
                        <Label className="text-xs">Line Total</Label>
                        <Input
                          value={`${selectedSO?.currency} ${line.line_total.toFixed(2)}`}
                          disabled
                          className="h-9 font-semibold text-green-700"
                        />
                      </div>
                    </div>
                  </div>
                ))}

                {/* Total */}
                <div className="flex justify-end">
                  <div className="w-64 p-4 bg-gray-50 rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-gray-600">Subtotal:</span>
                      <span className="font-semibold">{selectedSO?.currency} {totalAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t">
                      <span className="text-lg font-bold">Total:</span>
                      <span className="text-lg font-bold text-green-700">
                        {selectedSO?.currency} {totalAmount.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Notes */}
      {selectedSOId && lineItems.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add invoice notes..."
              rows={3}
            />
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      {selectedSOId && lineItems.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-gray-600">
                <AlertTriangle className="w-4 h-4 inline mr-2" />
                Finalizing will update inventory and mark items as sold.
              </p>
              <div className="flex gap-3">
                <Button
                  onClick={handleSaveDraft}
                  disabled={createInvoiceMutation.isPending}
                  variant="outline"
                  className="gap-2"
                >
                  <FileText className="w-4 h-4" />
                  Save Draft
                </Button>
                <Button
                  onClick={handleFinalize}
                  disabled={createInvoiceMutation.isPending}
                  className="bg-green-600 hover:bg-green-700 gap-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  Finalize Invoice
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}