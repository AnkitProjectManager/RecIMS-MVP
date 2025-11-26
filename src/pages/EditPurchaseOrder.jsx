import React, { useState } from "react";
import { recims } from "@/api/recimsClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTenant } from "@/components/TenantContext";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { FileText, ArrowLeft, Save, Plus, Trash2, AlertCircle, Copy } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"; // Added Dialog imports

export default function EditPurchaseOrder() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { tenantConfig, user } = useTenant();
  const [error, setError] = useState(null);
  const [useMetric, setUseMetric] = useState(true);
  const [showCopyDialog, setShowCopyDialog] = useState(false); // New state
  const [copySourceSkid, setCopySourceSkid] = useState(null); // New state
  const [copyDestination, setCopyDestination] = useState('new'); // New state

  const urlParams = new URLSearchParams(window.location.search);
  const poId = urlParams.get('id');

  const [poData, setPoData] = useState(null);
  const [lineItems, setLineItems] = useState([]);

  React.useEffect(() => {
    if (tenantConfig) {
      setUseMetric(tenantConfig.measurement_system === 'metric');
    }
  }, [tenantConfig]);

  const { data: po, isLoading: poLoading } = useQuery({
    queryKey: ['purchaseOrder', poId],
    queryFn: async () => {
      const pos = await recims.entities.PurchaseOrder.filter({ id: poId });
      const poData = pos[0];
      setPoData({
        vendor_name: poData.vendor_name || '',
        vendor_id: poData.vendor_id || '',
        order_date: poData.order_date || new Date().toISOString().split('T')[0],
        expected_delivery_date: poData.expected_delivery_date || '',
        payment_terms: poData.payment_terms || 'Net 30',
        payment_method_ref: poData.payment_method_ref || 'ACH',
        shipping_address: poData.shipping_address || '',
        contact_person: poData.contact_person || '',
        special_instructions: poData.special_instructions || '',
        notes: poData.notes || ''
      });
      return poData;
    },
    enabled: !!poId,
  });

  const { data: existingLineItems = [], isLoading: itemsLoading } = useQuery({
    queryKey: ['poLineItems', poId],
    queryFn: async () => {
      const items = await recims.entities.PurchaseOrderItem.filter({ po_id: poId }, 'line_number');
      setLineItems(items.map(item => ({
        id: item.id,
        skid_number: item.skid_number,
        line_number: item.line_number,
        category: item.category || '',
        sub_category: item.sub_category || '',
        product_type: item.product_type || '',
        format: item.format || '',
        purity: item.purity || 'UNKNOWN',
        container_type: item.container_type || 'skid',
        expected_weight_kg: item.expected_weight_kg || '',
        expected_weight_lbs: item.expected_weight_lbs || '',
        unit_price: item.unit_price || '',
        line_total: item.line_total || 0,
        status: item.status
      })));
      return items;
    },
    enabled: !!poId,
    initialData: [],
  });

  const { data: vendors = [] } = useQuery({
    queryKey: ['vendors'],
    queryFn: () => recims.entities.Vendor.list(),
    initialData: [],
  });

  const { data: skus = [] } = useQuery({
    queryKey: ['productSKUs', user?.tenant_id],
    queryFn: async () => {
      if (!user?.tenant_id) return [];
      return await recims.entities.ProductSKU.filter({ 
        tenant_id: user.tenant_id,
        status: 'active'
      });
    },
    enabled: !!user?.tenant_id,
    initialData: [],
  });

  const formatOptions = ['Sheets', 'Rolls', 'Chipped', 'Shredded', 'Pipes', 'Wires', 'Casings', 'Mixed', 'Corrugated', 'Bales', 'Pellets', 'Regrind', 'Flakes', 'Film', 'Other', 'Unknown'];

  const updatePOMutation = useMutation({
    mutationFn: async (data) => {
      const totalWeightKg = lineItems.reduce((sum, item) => sum + (parseFloat(item.expected_weight_kg) || 0), 0);
      const totalWeightLbs = lineItems.reduce((sum, item) => sum + (parseFloat(item.expected_weight_lbs) || 0), 0);
      const totalAmount = lineItems.reduce((sum, item) => sum + (parseFloat(item.line_total) || 0), 0);
      
      // Get unique skid numbers
      const uniqueSkids = [...new Set(lineItems.map(item => item.skid_number))];

      // Update PO
      await recims.entities.PurchaseOrder.update(poId, {
        ...data,
        total_expected_weight_kg: totalWeightKg,
        total_expected_weight_lbs: totalWeightLbs,
        total_skids_expected: uniqueSkids.length,
        total_amount: totalAmount
      });

      // Update line items
      for (const item of lineItems) {
        // Exclude id from the itemData payload as it's used for the update/create decision
        const { id, ...itemFields } = item;
        
        const itemData = {
          po_id: poId,
          po_number: po.po_number,
          tenant_id: user?.tenant_id,
          line_number: itemFields.line_number,
          skid_number: itemFields.skid_number, // Use existing skid_number (already a string from DB)
          barcode: itemFields.barcode || `${po.po_number}-${itemFields.skid_number}-L${itemFields.line_number}`,
          category: itemFields.category,
          sub_category: itemFields.sub_category,
          product_type: itemFields.product_type,
          format: itemFields.format,
          purity: itemFields.purity,
          container_type: itemFields.container_type,
          expected_weight_kg: parseFloat(itemFields.expected_weight_kg) || 0,
          expected_weight_lbs: parseFloat(itemFields.expected_weight_lbs) || 0,
          unit_price: parseFloat(itemFields.unit_price) || 0,
          line_total: parseFloat(itemFields.line_total) || 0,
          status: itemFields.status || 'pending'
        };

        if (id) {
          await recims.entities.PurchaseOrderItem.update(id, itemData);
        } else {
          await recims.entities.PurchaseOrderItem.create(itemData);
        }
      }

      return { po };
    },
    onSuccess: ({ po }) => {
      queryClient.invalidateQueries({ queryKey: ['purchaseOrder', poId] });
      queryClient.invalidateQueries({ queryKey: ['poLineItems', poId] });
      queryClient.invalidateQueries({ queryKey: ['purchaseOrders'] });
      navigate(createPageUrl(`ViewPurchaseOrder?id=${poId}`));
    },
    onError: (err) => {
      setError(err.message || "Failed to update purchase order. Please try again.");
    }
  });

  const handlePOChange = (field, value) => {
    setPoData(prev => ({ ...prev, [field]: value }));
  };

  const handleVendorChange = (vendorId) => {
    const vendor = vendors.find(v => v.id === vendorId);
    if (vendor) {
      setPoData(prev => ({
        ...prev,
        vendor_id: vendor.id,
        vendor_name: vendor.display_name,
        contact_person: vendor.given_name && vendor.family_name 
          ? `${vendor.given_name} ${vendor.family_name}` 
          : vendor.contact_person || '',
        shipping_address: vendor.bill_line1 
          ? `${vendor.bill_line1}, ${vendor.bill_city}, ${vendor.bill_region} ${vendor.bill_postal_code}`
          : '',
        payment_terms: vendor.terms_ref || 'Net 30'
      }));
    }
  };

  const handleLineItemChange = (index, field, value) => {
    setLineItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };

      if (field === 'expected_weight_kg' && value) {
        updated[index].expected_weight_lbs = (parseFloat(value) * 2.20462).toFixed(2);
      } else if (field === 'expected_weight_lbs' && value) {
        updated[index].expected_weight_kg = (parseFloat(value) * 0.453592).toFixed(2);
      }

      const weight = useMetric 
        ? parseFloat(updated[index].expected_weight_kg) || 0
        : parseFloat(updated[index].expected_weight_lbs) || 0;
      const price = parseFloat(updated[index].unit_price) || 0;
      updated[index].line_total = (weight * price).toFixed(2);

      return updated;
    });
  };

  const addLineItem = () => {
    const lastItem = lineItems[lineItems.length - 1];
    setLineItems(prev => [...prev, {
      skid_number: lastItem.skid_number,
      line_number: prev.length + 1,
      category: '',
      sub_category: '',
      product_type: '',
      format: '',
      purity: 'UNKNOWN',
      container_type: lastItem.container_type || 'skid',
      expected_weight_kg: '',
      expected_weight_lbs: '',
      unit_price: '',
      line_total: 0,
      status: 'pending'
    }]);
  };

  const addNewSkid = () => {
    const existingSkidNumbers = lineItems.map(item => {
      const match = item.skid_number.match(/-SKD-(\d+)$/);
      return match ? parseInt(match[1]) : 0;
    });
    const maxSkid = Math.max(...existingSkidNumbers, 0);
    const newSkidNumber = `${po.po_number}-SKD-${String(maxSkid + 1).padStart(3, '0')}`;
    
    setLineItems(prev => [...prev, {
      skid_number: newSkidNumber,
      line_number: prev.length + 1,
      category: '',
      sub_category: '',
      product_type: '',
      format: '',
      purity: 'UNKNOWN',
      container_type: 'skid',
      expected_weight_kg: '',
      expected_weight_lbs: '',
      unit_price: '',
      line_total: 0,
      status: 'pending'
    }]);
  };

  const copySkid = (skidNumber) => {
    setCopySourceSkid(skidNumber);
    setShowCopyDialog(true);
  };

  const handleCopySkid = () => {
    const skidItems = lineItems.filter(item => item.skid_number === copySourceSkid);
    
    if (copyDestination === 'new') {
      // Create new skid
      const existingSkidNumbers = lineItems.map(item => {
        const match = item.skid_number.match(/-SKD-(\d+)$/);
        return match ? parseInt(match[1]) : 0;
      });
      const maxSkid = Math.max(...existingSkidNumbers, 0);
      const newSkidNumber = `${po.po_number}-SKD-${String(maxSkid + 1).padStart(3, '0')}`;
      
      const copiedItems = skidItems.map(item => ({
        ...item,
        id: null,
        skid_number: newSkidNumber,
        line_number: lineItems.length + 1,
        status: 'pending'
      }));

      setLineItems(prev => [...prev, ...copiedItems]);
    } else {
      // Append to existing skid
      const copiedItems = skidItems.map(item => ({
        ...item,
        id: null,
        skid_number: copyDestination,
        line_number: lineItems.length + 1,
        status: 'pending'
      }));

      setLineItems(prev => [...prev, ...copiedItems]);
    }

    setShowCopyDialog(false);
    setCopySourceSkid(null);
    setCopyDestination('new');
  };

  const removeLineItem = (index) => {
    setLineItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError(null);

    if (!poData.vendor_name) {
      setError("Please select a vendor");
      return;
    }

    if (lineItems.some(item => !item.category || (!item.expected_weight_kg && !item.expected_weight_lbs))) {
      setError("All line items must have a category and a weight specified.");
      return;
    }

    updatePOMutation.mutate(poData);
  };

  if (poLoading || itemsLoading || !poData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  const totalAmount = lineItems.reduce((sum, item) => sum + (parseFloat(item.line_total) || 0), 0);
  const weightUnit = useMetric ? 'kg' : 'lbs';
  
  const groupedBySkid = lineItems.reduce((acc, item) => {
    const skidNum = item.skid_number;
    if (!acc[skidNum]) {
      acc[skidNum] = [];
    }
    acc[skidNum].push(item);
    return acc;
  }, {});

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Button
          variant="outline"
          size="icon"
          onClick={() => navigate(createPageUrl(`ViewPurchaseOrder?id=${poId}`))}
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="w-7 h-7 text-indigo-600" />
            Edit Purchase Order: {po.po_number}
          </h1>
          <p className="text-sm text-gray-600">Modify PO details and line items</p>
        </div>
        <Badge variant="outline">{useMetric ? 'METRIC' : 'IMPERIAL'}</Badge>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit}>
        {/* PO Header - same as CreatePurchaseOrder */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Purchase Order Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="vendor">Vendor *</Label>
                <Select
                  value={poData.vendor_id}
                  onValueChange={handleVendorChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select vendor" />
                  </SelectTrigger>
                  <SelectContent>
                    {vendors.map((vendor) => (
                      <SelectItem key={vendor.id} value={vendor.id}>
                        {vendor.display_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact_person">Contact Person</Label>
                <Input
                  id="contact_person"
                  value={poData.contact_person}
                  onChange={(e) => handlePOChange('contact_person', e.target.value)}
                  placeholder="Contact person name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="order_date">Order Date *</Label>
                <Input
                  id="order_date"
                  type="date"
                  value={poData.order_date}
                  onChange={(e) => handlePOChange('order_date', e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="expected_delivery">Expected Delivery</Label>
                <Input
                  id="expected_delivery"
                  type="date"
                  value={poData.expected_delivery_date}
                  onChange={(e) => handlePOChange('expected_delivery_date', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="payment_terms">Payment Terms</Label>
                <Input
                  id="payment_terms"
                  value={poData.payment_terms}
                  onChange={(e) => handlePOChange('payment_terms', e.target.value)}
                  placeholder="Net 30, Net 15, etc."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="payment_method">Payment Method</Label>
                <Select
                  value={poData.payment_method_ref}
                  onValueChange={(v) => handlePOChange('payment_method_ref', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACH">ACH</SelectItem>
                    <SelectItem value="Check">Check</SelectItem>
                    <SelectItem value="Wire">Wire Transfer</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="shipping_address">Shipping Address</Label>
                <Textarea
                  id="shipping_address"
                  value={poData.shipping_address}
                  onChange={(e) => handlePOChange('shipping_address', e.target.value)}
                  rows={2}
                  placeholder="Delivery address"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="special_instructions">Special Instructions</Label>
                <Textarea
                  id="special_instructions"
                  value={poData.special_instructions}
                  onChange={(e) => handlePOChange('special_instructions', e.target.value)}
                  rows={2}
                  placeholder="Special handling or delivery instructions"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Line Items - same structure as CreatePurchaseOrder with copy/add functions */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Skids & Products ({Object.keys(groupedBySkid).length} skids, {lineItems.length} products)</CardTitle>
              <Button type="button" onClick={addNewSkid} size="sm" variant="outline">
                <Plus className="w-4 h-4 mr-2" />
                Add New Skid
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {Object.entries(groupedBySkid).map(([skidNum, skidItems]) => (
              <div key={skidNum} className="p-4 border-2 border-indigo-200 rounded-lg bg-indigo-50">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Badge variant="default" className="bg-indigo-600 text-lg px-3 py-1">
                      {skidNum}
                    </Badge>
                    <Badge variant="outline">{skidItems.length} product(s)</Badge>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      onClick={() => copySkid(skidNum)}
                      size="sm"
                      variant="outline"
                      className="gap-2"
                    >
                      <Copy className="w-4 h-4" />
                      Copy Skid
                    </Button>
                  </div>
                </div>

                <div className="space-y-4">
                  {skidItems.map((item, itemIndex) => {
                    const globalIndex = lineItems.findIndex(li => li === item);
                    return (
                      <div key={globalIndex} className="p-4 bg-white border rounded-lg">
                        <div className="flex items-center justify-between mb-3">
                          <Badge variant="outline">Product #{itemIndex + 1}</Badge>
                          {skidItems.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeLineItem(globalIndex)}
                            >
                              <Trash2 className="w-4 h-4 text-red-600" />
                            </Button>
                          )}
                        </div>

                        {/* Same form fields as CreatePurchaseOrder */}
                        <div className="grid md:grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <Label>Category *</Label>
                            <Select
                              value={item.category}
                              onValueChange={(v) => handleLineItemChange(globalIndex, 'category', v)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select category" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="FERROUS">FERROUS</SelectItem>
                                <SelectItem value="NON-FERROUS">NON-FERROUS</SelectItem>
                                <SelectItem value="SPECIALTY">SPECIALTY</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label>Sub-Category</Label>
                            <Input
                              value={item.sub_category}
                              onChange={(e) => handleLineItemChange(globalIndex, 'sub_category', e.target.value)}
                              placeholder="e.g., Aluminum, Steel"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label>Product Type</Label>
                            <Input
                              value={item.product_type}
                              onChange={(e) => handleLineItemChange(globalIndex, 'product_type', e.target.value)}
                              placeholder="e.g., UBC, 304 Series"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label>Format</Label>
                            <Select
                              value={item.format}
                              onValueChange={(v) => handleLineItemChange(globalIndex, 'format', v)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select format" />
                              </SelectTrigger>
                              <SelectContent>
                                {formatOptions.map((format) => (
                                  <SelectItem key={format} value={format}>
                                    {format}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label>Purity</Label>
                            <Select
                              value={item.purity}
                              onValueChange={(v) => handleLineItemChange(globalIndex, 'purity', v)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="100%">100%</SelectItem>
                                <SelectItem value="90%">90%</SelectItem>
                                <SelectItem value="80%">80%</SelectItem>
                                <SelectItem value="70%">70%</SelectItem>
                                <SelectItem value="MIXED">MIXED</SelectItem>
                                <SelectItem value="UNKNOWN">UNKNOWN</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label>Container</Label>
                            <Select
                              value={item.container_type}
                              onValueChange={(v) => handleLineItemChange(globalIndex, 'container_type', v)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="skid">Skid</SelectItem>
                                <SelectItem value="gaylord">Gaylord</SelectItem>
                                <SelectItem value="pallet">Pallet</SelectItem>
                                <SelectItem value="drum">Drum</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label>Weight ({weightUnit}) *</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={useMetric ? item.expected_weight_kg : item.expected_weight_lbs}
                              onChange={(e) => handleLineItemChange(
                                globalIndex, 
                                useMetric ? 'expected_weight_kg' : 'expected_weight_lbs', 
                                e.target.value
                              )}
                              placeholder="0.00"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label>Unit Price (${weightUnit})</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={item.unit_price}
                              onChange={(e) => handleLineItemChange(globalIndex, 'unit_price', e.target.value)}
                              placeholder="0.00"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label>Line Total</Label>
                            <div className="h-10 rounded-md border px-3 flex items-center bg-gray-50 font-semibold">
                              ${parseFloat(item.line_total || 0).toFixed(2)}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  <Button
                    type="button"
                    onClick={addLineItem}
                    size="sm"
                    variant="outline"
                    className="w-full"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Product to {skidNum}
                  </Button>
                </div>
              </div>
            ))}

            <div className="flex justify-end p-4 bg-gray-50 rounded-lg">
              <div className="text-right">
                <p className="text-sm text-gray-600">Total Amount</p>
                <p className="text-2xl font-bold text-indigo-700">${totalAmount.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notes */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Additional Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={poData.notes}
              onChange={(e) => handlePOChange('notes', e.target.value)}
              placeholder="Additional notes or comments..."
              rows={3}
            />
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(createPageUrl(`ViewPurchaseOrder?id=${poId}`))}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={updatePOMutation.isPending}
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 gap-2"
          >
            <Save className="w-4 h-4" />
            {updatePOMutation.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>

      {/* Copy Skid Dialog */}
      <Dialog open={showCopyDialog} onOpenChange={(open) => {
        setShowCopyDialog(open);
        if (!open) {
          setCopySourceSkid(null);
          setCopyDestination('new');
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Copy Skid: {copySourceSkid}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Select where to copy the products from {copySourceSkid}
            </p>
            
            <div className="space-y-2">
              <Label>Copy To:</Label>
              <Select value={copyDestination} onValueChange={setCopyDestination}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">Create New Skid</SelectItem>
                  {Object.keys(groupedBySkid).filter(num => num !== copySourceSkid).map(skidNum => (
                    <SelectItem key={skidNum} value={skidNum}>
                      {skidNum} (append to existing)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded text-sm">
              {copyDestination === 'new' ? (
                <p className="text-blue-800">
                  <strong>New Skid:</strong> All {lineItems.filter(item => item.skid_number === copySourceSkid).length} product(s) will be copied to a new skid.
                </p>
              ) : (
                <p className="text-blue-800">
                  <strong>Append:</strong> All {lineItems.filter(item => item.skid_number === copySourceSkid).length} product(s) will be added to {copyDestination}.
                </p>
              )}
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setShowCopyDialog(false);
                  setCopySourceSkid(null);
                  setCopyDestination('new');
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCopySkid}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700"
              >
                <Copy className="w-4 h-4 mr-2" />
                Copy Products
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}