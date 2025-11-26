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
import { FileText, ArrowLeft, Save, Plus, Trash2, AlertCircle, Copy, Package } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function CreatePurchaseOrder() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { tenantConfig, user } = useTenant();
  const [error, setError] = useState(null);
  const [useMetric, setUseMetric] = useState(false);
  const [step, setStep] = useState(1);
  const [totalSkids, setTotalSkids] = useState('');

  const [showCopyDialog, setShowCopyDialog] = useState(false);
  const [copySourceSkid, setCopySourceSkid] = useState(null);
  const [copyDestination, setCopyDestination] = useState('new');

  const [poData, setPoData] = useState({
    vendor_name: '',
    vendor_id: '',
    order_date: new Date().toISOString().split('T')[0],
    expected_delivery_date: '',
    payment_terms: 'Net 30',
    payment_method_ref: 'ACH',
    shipping_address: '',
    contact_person: '',
    special_instructions: '',
    notes: ''
  });

  const [lineItems, setLineItems] = useState([{
    skid_number: 1,
    line_number: 1,
    category: '',
    sub_category: '',
    product_type: '',
    format: '',
    purity: 'UNKNOWN',
    container_type: 'skid',
    expected_weight_kg: '',
    expected_weight_lbs: '',
    unit_price: '',
    line_total: 0
  }]);

  React.useEffect(() => {
    if (tenantConfig) {
      setUseMetric(tenantConfig.measurement_system === 'metric');
    }
  }, [tenantConfig]);

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

  const availableCategories = React.useMemo(() => {
    return [...new Set(skus.map(sku => sku.category))];
  }, [skus]);

  const formatOptions = ['Sheets', 'Rolls', 'Chipped', 'Shredded', 'Pipes', 'Wires', 'Casings', 'Mixed', 'Corrugated', 'Other', 'Unknown'];

  const renumberSkids = (items) => {
    if (items.length === 0) return [];
    
    const seenSkids = new Set();
    const uniqueSkidsInOrder = [];
    items.forEach(item => {
      if (!seenSkids.has(item.skid_number)) {
        seenSkids.add(item.skid_number);
        uniqueSkidsInOrder.push(item.skid_number);
      }
    });
    
    const skidMapping = {};
    uniqueSkidsInOrder.forEach((oldSkid, index) => {
      skidMapping[oldSkid] = index + 1;
    });
    
    let currentLineNumber = 1;
    const renumberedItems = items.map(item => ({
      ...item,
      skid_number: skidMapping[item.skid_number],
      line_number: currentLineNumber++
    }));

    // Ensure line_numbers are unique and sequential across the entire PO, not just within skids
    for (let i = 0; i < renumberedItems.length; i++) {
        renumberedItems[i].line_number = i + 1;
    }
    return renumberedItems;
  };

  const createPOMutation = useMutation({
    mutationFn: async (data) => {
      const poNumber = `PO-${Date.now()}`;
      const totalWeightKg = lineItems.reduce((sum, item) => sum + (parseFloat(item.expected_weight_kg) || 0), 0);
      const totalWeightLbs = lineItems.reduce((sum, item) => sum + (parseFloat(item.expected_weight_lbs) || 0), 0);
      const totalAmount = lineItems.reduce((sum, item) => sum + (parseFloat(item.line_total) || 0), 0);

      const uniqueSkids = [...new Set(lineItems.map(item => item.skid_number))];

      const po = await recims.entities.PurchaseOrder.create({
        ...data,
        po_number: poNumber,
        barcode_prefix: poNumber,
        tenant_id: user?.tenant_id || user?.tenant,
        status: 'draft',
        total_expected_weight_kg: totalWeightKg,
        total_expected_weight_lbs: totalWeightLbs,
        total_skids_expected: uniqueSkids.length,
        total_amount: totalAmount,
        currency: tenantConfig?.default_currency || 'USD',
        created_by: user?.full_name
      });

      const createdItems = [];
      for (let index = 0; index < lineItems.length; index++) {
        const item = lineItems[index];
        const skidCode = `${poNumber}-SKD-${String(item.skid_number).padStart(3, '0')}`;
        
        const { skid_number, line_number, ...itemData } = item;
        
        const createdItem = await recims.entities.PurchaseOrderItem.create({
          po_id: po.id,
          po_number: poNumber,
          tenant: user?.tenant_id || user?.tenant,
          line_number: index + 1,
          skid_number: skidCode,
          barcode: `${skidCode}-L${index + 1}`,
          ...itemData,
          expected_weight_kg: parseFloat(item.expected_weight_kg) || 0,
          expected_weight_lbs: parseFloat(item.expected_weight_lbs) || 0,
          unit_price: parseFloat(item.unit_price) || 0,
          line_total: parseFloat(item.line_total) || 0,
          status: 'pending'
        });
        createdItems.push(createdItem);
      }

      return { po, lineItems: createdItems };
    },
    onSuccess: ({ po, lineItems: createdItems }) => {
      queryClient.setQueryData(['purchaseOrder', po.id], po);
      queryClient.setQueryData(['poLineItems', po.id], createdItems);
      queryClient.invalidateQueries({ queryKey: ['purchaseOrders'] });
      navigate(createPageUrl(`GeneratePOBarcodes?id=${po.id}`));
    },
    onError: (err) => {
      setError(err.message || "Failed to create purchase order. Please try again.");
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

      if (field === 'expected_weight_kg' && value !== '') {
        updated[index].expected_weight_lbs = (parseFloat(value) * 2.20462).toFixed(2);
      } else if (field === 'expected_weight_kg' && value === '') {
        updated[index].expected_weight_lbs = '';
      }
      
      if (field === 'expected_weight_lbs' && value !== '') {
        updated[index].expected_weight_kg = (parseFloat(value) * 0.453592).toFixed(2);
      } else if (field === 'expected_weight_lbs' && value === '') {
        updated[index].expected_weight_kg = '';
      }

      const weight = useMetric 
        ? parseFloat(updated[index].expected_weight_kg) || 0
        : parseFloat(updated[index].expected_weight_lbs) || 0;
      const price = parseFloat(updated[index].unit_price) || 0;
      updated[index].line_total = (weight * price).toFixed(2);

      return updated;
    });
  };

  const addLineItem = (skidNumber) => {
    const lastItemOfSkid = lineItems.filter(item => item.skid_number === skidNumber).pop();
    const newItems = [...lineItems, {
      skid_number: skidNumber,
      line_number: lineItems.length + 1, // Will be renumbered by renumberSkids
      category: '',
      sub_category: '',
      product_type: '',
      format: '',
      purity: 'UNKNOWN',
      container_type: lastItemOfSkid?.container_type || 'skid',
      expected_weight_kg: '',
      expected_weight_lbs: '',
      unit_price: '',
      line_total: 0
    }];
    setLineItems(renumberSkids(newItems));
  };

  const addNewSkid = () => {
    const maxSkid = lineItems.length > 0 ? Math.max(...lineItems.map(item => item.skid_number)) : 0;
    const newItems = [...lineItems, {
      skid_number: maxSkid + 1,
      line_number: lineItems.length + 1, // Will be renumbered by renumberSkids
      category: '',
      sub_category: '',
      product_type: '',
      format: '',
      purity: 'UNKNOWN',
      container_type: 'skid',
      expected_weight_kg: '',
      expected_weight_lbs: '',
      unit_price: '',
      line_total: 0
    }];
    
    setLineItems(renumberSkids(newItems));
  };

  const copySkid = (sourceSkidNumber) => {
    setCopySourceSkid(sourceSkidNumber);
    setShowCopyDialog(true);
  };

  const handleCopySkid = () => {
    const skidItemsToCopy = lineItems.filter(item => item.skid_number === copySourceSkid);
    if (skidItemsToCopy.length === 0) return;

    let newItems = [...lineItems];

    if (copyDestination === 'new') {
      const maxSkid = lineItems.length > 0 ? Math.max(...lineItems.map(item => item.skid_number)) : 0;
      const newSkidNumber = maxSkid + 1;
      
      const copiedItems = skidItemsToCopy.map((item) => ({
        ...item,
        skid_number: newSkidNumber,
        line_number: 0, // Will be renumbered by renumberSkids
        // Values from source are copied as is, including calculated ones
        expected_weight_kg: item.expected_weight_kg,
        expected_weight_lbs: item.expected_weight_lbs,
        unit_price: item.unit_price,
        line_total: item.line_total
      }));

      newItems = [...lineItems, ...copiedItems];
    } else {
      const targetSkidNumber = parseInt(copyDestination, 10);
      
      const copiedItems = skidItemsToCopy.map((item) => ({
        ...item,
        skid_number: targetSkidNumber,
        line_number: 0, // Will be renumbered by renumberSkids
        // Values from source are copied as is
        expected_weight_kg: item.expected_weight_kg,
        expected_weight_lbs: item.expected_weight_lbs,
        unit_price: item.unit_price,
        line_total: item.line_total
      }));

      newItems = [...lineItems, ...copiedItems];
    }

    setLineItems(renumberSkids(newItems));

    setShowCopyDialog(false);
    setCopySourceSkid(null);
    setCopyDestination('new');
  };

  const removeLineItem = (index) => {
    const itemToRemove = lineItems[index];
    const itemsOnSkid = lineItems.filter(item => item.skid_number === itemToRemove.skid_number);
    const uniqueSkidsAfterRemoval = new Set(lineItems.filter((_, i) => i !== index).map(item => item.skid_number));
    
    if (lineItems.length === 1) {
      setError("Cannot remove the last product from the Purchase Order.");
      return;
    }
    
    if (itemsOnSkid.length === 1 && uniqueSkidsAfterRemoval.size === 0) {
      // This means we are removing the last product on the last skid, and no other skids exist
      setError("Cannot remove the last product from the last remaining skid.");
      return;
    }
    
    setError(null);
    const newItems = lineItems.filter((_, i) => i !== index);
    setLineItems(renumberSkids(newItems));
  };

  const handleSkidSetup = () => {
    setError(null);
    const numSkids = parseInt(totalSkids, 10);
    if (isNaN(numSkids) || numSkids <= 0 || numSkids > 100) {
      setError("Please enter a valid number of skids (1-100)");
    } else {
      const items = [];
      for (let i = 1; i <= numSkids; i++) {
        items.push({
          skid_number: i,
          line_number: i,
          category: '',
          sub_category: '',
          product_type: '',
          format: '',
          purity: 'UNKNOWN',
          container_type: 'skid',
          expected_weight_kg: '',
          expected_weight_lbs: '',
          unit_price: '',
          line_total: 0
        });
      }
      setLineItems(items);
      setStep(2);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError(null);

    if (!poData.vendor_name) {
      setError("Please select a vendor");
      return;
    }

    if (lineItems.length === 0) {
      setError("Purchase order must have at least one product.");
      return;
    }

    const hasInvalidItem = lineItems.some(item => {
      const categoryMissing = !item.category;
      const weightMissing = useMetric ? !item.expected_weight_kg : !item.expected_weight_lbs;
      return categoryMissing || weightMissing;
    });

    if (hasInvalidItem) {
      setError("All products must have a category and a weight specified for the selected unit system.");
      return;
    }
    
    createPOMutation.mutate(poData);
  };

  const totalAmount = lineItems.reduce((sum, item) => sum + (parseFloat(item.line_total) || 0), 0);
  const weightUnit = useMetric ? 'kg' : 'lbs';
  const uniqueSkids = [...new Set(lineItems.map(item => item.skid_number))];

  const groupedBySkid = lineItems.reduce((acc, item) => {
    if (!acc[item.skid_number]) {
      acc[item.skid_number] = [];
    }
    acc[item.skid_number].push(item);
    return acc;
  }, {});

  if (step === 1) {
    return (
      <div className="p-4 md:p-8 max-w-2xl mx-auto">
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
              Create Purchase Order
            </h1>
            <p className="text-sm text-gray-600">Step 1: How many skids/containers?</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Number of Skids/Containers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="totalSkids">Total Number of Skids/Pallets/Containers *</Label>
              <Input
                id="totalSkids"
                type="number"
                min="1"
                max="100"
                value={totalSkids}
                onChange={(e) => setTotalSkids(e.target.value)}
                placeholder="Enter number (1-100)"
                className="text-lg"
                autoFocus
              />
              <p className="text-sm text-gray-600">
                This will create the initial structure with one product per skid. You can add more products to each skid, copy skids, or add more skids later.
              </p>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => navigate(createPageUrl("PurchaseOrders"))}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSkidSetup}
                disabled={!totalSkids || parseInt(totalSkids, 10) < 1 || parseInt(totalSkids, 10) > 100}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 gap-2"
              >
                <Package className="w-4 h-4" />
                Continue to PO Details
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setStep(1)}
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="w-7 h-7 text-indigo-600" />
            Create Purchase Order
          </h1>
          <p className="text-sm text-gray-600">Step 2: Enter PO and skid details ({uniqueSkids.length} skids)</p>
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
        <Dialog open={showCopyDialog} onOpenChange={(open) => {
          setShowCopyDialog(open);
          if (!open) {
            setCopySourceSkid(null);
            setCopyDestination('new');
          }
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Copy Skid #{copySourceSkid}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Select where to copy the products from Skid #{copySourceSkid}.
              </p>
              
              <div className="space-y-2">
                <Label>Copy To:</Label>
                <Select value={copyDestination} onValueChange={setCopyDestination}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select destination" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">Create New Skid</SelectItem>
                    {uniqueSkids.filter(num => num !== copySourceSkid).map(skidNum => (
                      <SelectItem key={skidNum} value={skidNum.toString()}>
                        Skid #{skidNum} (append to existing)
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
                    <strong>Append:</strong> All {lineItems.filter(item => item.skid_number === copySourceSkid).length} product(s) will be added to Skid #{copyDestination}.
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

        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Skids & Products ({uniqueSkids.length} skids, {lineItems.length} products)</CardTitle>
              <Button type="button" onClick={addNewSkid} size="sm" variant="outline" className="gap-2">
                <Plus className="w-4 h-4" />
                Add New Skid
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {Object.entries(groupedBySkid).map(([skidNumStr, skidItems]) => {
              const skidNum = parseInt(skidNumStr, 10);
              return (
                <div key={skidNum} className="p-4 border-2 border-indigo-200 rounded-lg bg-indigo-50">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                    <div className="flex items-center gap-2">
                      <Badge variant="default" className="bg-indigo-600 text-lg px-3 py-1">
                        Skid #{skidNum}
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
                      {((uniqueSkids.length > 1) || (uniqueSkids.length === 1 && skidItems.length > 1)) && (
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            const newItems = lineItems.filter(item => item.skid_number !== skidNum);
                            setLineItems(renumberSkids(newItems));
                          }}
                          className="gap-2"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete Skid
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4">
                    {skidItems.map((item, itemIndex) => {
                      const globalIndex = lineItems.findIndex(li => li === item);
                      return (
                        <div key={globalIndex} className="p-4 bg-white border rounded-lg">
                          <div className="flex items-center justify-between mb-3">
                            <Badge variant="secondary">Product #{itemIndex + 1}</Badge>
                            {(lineItems.length > 1) && (
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
                                  {availableCategories.map(cat => (
                                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                  ))}
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
                      onClick={() => addLineItem(skidNum)}
                      size="sm"
                      variant="outline"
                      className="w-full"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Product to Skid #{skidNum}
                    </Button>
                  </div>
                </div>
              );
            })}

            <div className="flex justify-end p-4 bg-gray-50 rounded-lg">
              <div className="text-right">
                <p className="text-sm text-gray-600">Total Amount</p>
                <p className="text-2xl font-bold text-indigo-700">${totalAmount.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

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

        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(createPageUrl("PurchaseOrders"))}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={createPOMutation.isPending || lineItems.length === 0}
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 gap-2"
          >
            <Save className="w-4 h-4" />
            {createPOMutation.isPending ? 'Creating...' : 'Create Purchase Order'}
          </Button>
        </div>
      </form>
    </div>
  );
}