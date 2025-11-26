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
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  FileText,
  ArrowLeft,
  Scan,
  CheckCircle,
  AlertTriangle,
  Camera,
  Save
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { format } from "date-fns";
import AnomalyDetection from "@/components/ai/AnomalyDetection"; // NEW IMPORT

export default function ReceivePurchaseOrder() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { tenantConfig, user } = useTenant();
  const [error, setError] = useState(null);
  const [scanInput, setScanInput] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [receivingData, setReceivingData] = useState({
    actual_weight_kg: '',
    actual_weight_lbs: '',
    quality_grade: 'B',
    bin_location: '',
    zone: '',
    variance_notes: '',
    inspection_notes: ''
  });
  // NEW STATE
  const [anomaliesDetected, setAnomaliesDetected] = useState([]);

  const urlParams = new URLSearchParams(window.location.search);
  const poId = urlParams.get('id');



  const { data: po } = useQuery({
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

  // Fetch SKU data for image display - PHASE V
  const { data: skuData = {} } = useQuery({
    queryKey: ['skuImages', po?.id],
    queryFn: async () => {
      if (!po || !lineItems.length) return {};

      const skuMap = {};
      for (const item of lineItems) {
        if (item.category && item.product_type) {
          const skus = await recims.entities.ProductSKU.filter({
            category: item.category,
            product_type: item.product_type,
            status: 'active'
          });
          if (skus.length > 0 && skus[0].image_url) {
            skuMap[`${item.category}_${item.product_type}`] = skus[0].image_url;
          }
        }
      }
      return skuMap;
    },
    enabled: !!po && lineItems.length > 0,
    initialData: {},
  });

  const receiveItemMutation = useMutation({
    mutationFn: async (data) => {
      // Update line item
      await recims.entities.PurchaseOrderItem.update(selectedItem.id, {
        status: 'received',
        actual_weight_kg: parseFloat(data.actual_weight_kg) || selectedItem.expected_weight_kg,
        actual_weight_lbs: parseFloat(data.actual_weight_lbs) || selectedItem.expected_weight_lbs,
        quality_grade: data.quality_grade,
        bin_location: data.bin_location,
        zone: data.zone,
        variance_notes: data.variance_notes,
        inspection_notes: data.inspection_notes,
        received_date: new Date().toISOString(),
        received_by: user?.full_name
      });

      // Check if classification is complete
      const needsSorting =
        !selectedItem.sub_category ||
        !selectedItem.product_type ||
        selectedItem.purity === 'UNKNOWN' ||
        !selectedItem.format ||
        selectedItem.format === 'Unknown';

      // Create inventory entry for this received item
      const quantityKg = parseFloat(data.actual_weight_kg) || selectedItem.expected_weight_kg;
      const quantityLbs = parseFloat(data.actual_weight_lbs) || selectedItem.expected_weight_lbs;

      const inventoryItem = await recims.entities.Inventory.create({
        inventory_id: needsSorting ? `INV-${String(Date.now()).padStart(9, '0')}` : `INV-${selectedItem.skid_number}-${Date.now()}`,
        tenant_id: user?.tenant_id,
        vendor_name: po?.vendor_name || '',
        item_name: `${selectedItem.category} - ${selectedItem.product_type || selectedItem.sub_category || 'Material'}`,
        item_description: `${selectedItem.category}${selectedItem.sub_category ? ' > ' + selectedItem.sub_category : ''}${selectedItem.product_type ? ' > ' + selectedItem.product_type : ''} | Format: ${selectedItem.format || 'N/A'} | Purity: ${selectedItem.purity}`,
        category: selectedItem.category,
        sub_category: selectedItem.sub_category || '',
        product_type: selectedItem.product_type || '',
        format: selectedItem.format || '',
        purity: selectedItem.purity,
        quality_grade: data.quality_grade,
        unit_of_measure: 'kg',
        quantity_on_hand: quantityKg,
        quantity_kg: quantityKg,
        quantity_lbs: quantityLbs,
        reserved_quantity: 0,
        available_quantity: quantityKg,
        bin_location: data.bin_location || '',
        zone: data.zone || '',
        sorting_status: needsSorting ? 'needs_sorting' : 'classified',
        status: 'available',
        received_date: new Date().toISOString().split('T')[0],
        processed_date: new Date().toISOString().split('T')[0],
        purchase_order_number: po?.po_number || '',
        lot_number: selectedItem.skid_number,
        notes: data.inspection_notes || ''
      });

      // Update PO totals
      const receivedItems = lineItems.filter(item =>
        item.status === 'received' || item.id === selectedItem.id
      );
      const totalReceivedKg = receivedItems.reduce((sum, item) =>
        sum + (item.id === selectedItem.id ? parseFloat(data.actual_weight_kg) : item.actual_weight_kg || 0), 0
      );
      const totalReceivedLbs = receivedItems.reduce((sum, item) =>
        sum + (item.id === selectedItem.id ? parseFloat(data.actual_weight_lbs) : item.actual_weight_lbs || 0), 0
      );

      const allReceived = receivedItems.length + 1 === lineItems.length;

      await recims.entities.PurchaseOrder.update(poId, {
        total_received_weight_kg: totalReceivedKg,
        total_received_weight_lbs: totalReceivedLbs,
        total_skids_received: receivedItems.length + 1,
        status: allReceived ? 'received' : 'partially_received',
        actual_delivery_date: allReceived ? new Date().toISOString().split('T')[0] : po.actual_delivery_date
      });

      return { allReceived, inventoryId: inventoryItem.id, needsSorting };
    },
    onSuccess: async ({ allReceived, inventoryId, needsSorting }) => {
      queryClient.invalidateQueries({ queryKey: ['poLineItems', poId] });
      queryClient.invalidateQueries({ queryKey: ['purchaseOrder', poId] });
      queryClient.invalidateQueries({ queryKey: ['purchaseOrders'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['unsortedInventory'] });

      setSelectedItem(null);
      setScanInput('');
      setReceivingData({
        actual_weight_kg: '',
        actual_weight_lbs: '',
        quality_grade: 'B',
        bin_location: '',
        zone: '',
        variance_notes: '',
        inspection_notes: ''
      });
      setAnomaliesDetected([]);

      if (allReceived) {
        // Check if any items need sorting (including the one just received and any others from the PO)
        const hasUnsortedItems = lineItems.some(item => {
          return !item.sub_category || !item.product_type || item.purity === 'UNKNOWN' || !item.format || item.format === 'Unknown';
        }) || needsSorting; // Check for the just-received item's sorting status too

        if (hasUnsortedItems) {
          setTimeout(() => {
            navigate(createPageUrl("InventorySorting"));
          }, 1500);
        } else {
          // Fetch all Inventory items related to this PO to get their IDs for printing labels
          const relatedInventory = await recims.entities.Inventory.filter({
            purchase_order_number: po?.po_number,
            tenant_id: user?.tenant_id
          });
          const allInventoryIds = relatedInventory.map(item => item.id);

          setTimeout(() => {
            navigate(createPageUrl(`PrintInventoryLabels?ids=${allInventoryIds.join(',')}`));
          }, 1500);
        }
      }
    },
    onError: (err) => {
      setError(err.message || "Failed to receive item");
    }
  });

  const handleAnomalyDetected = (anomalies) => {
    setAnomaliesDetected(anomalies);

    // Auto-populate variance notes with AI findings
    const criticalAnomalies = anomalies.filter(a => a.severity === 'critical' || a.severity === 'high');
    if (criticalAnomalies.length > 0) {
      const notes = criticalAnomalies.map(a => `${a.title}: ${a.message}`).join('\n\n');
      setReceivingData(prev => ({
        ...prev,
        variance_notes: notes
      }));
    }
  };

  const handleScan = (e) => {
    e.preventDefault();
    setError(null);

    const barcode = scanInput.trim();
    if (!barcode) {
      setError("Please enter or scan a barcode");
      return;
    }

    const item = lineItems.find(item => item.barcode === barcode && item.status === 'pending');

    if (!item) {
      setError(`Barcode "${barcode}" not found or already received`);
      return;
    }

    setSelectedItem(item);
    setReceivingData({
      actual_weight_kg: item.expected_weight_kg,
      actual_weight_lbs: item.expected_weight_lbs,
      quality_grade: 'B',
      bin_location: '',
      zone: '',
      variance_notes: '',
      inspection_notes: ''
    });
    // Clear anomalies when a new item is selected
    setAnomaliesDetected([]);
  };

  const handleReceive = (e) => {
    e.preventDefault();
    setError(null);

    if (!receivingData.actual_weight_kg && !receivingData.actual_weight_lbs) {
      setError("Please enter actual weight");
      return;
    }

    receiveItemMutation.mutate(receivingData);
  };

  const handleWeightChange = (field, value) => {
    setReceivingData(prev => {
      const updated = { ...prev, [field]: value };

      // Auto-convert between kg and lbs
      if (field === 'actual_weight_kg' && value) {
        updated.actual_weight_lbs = (parseFloat(value) * 2.20462).toFixed(2);
      } else if (field === 'actual_weight_lbs' && value) {
        updated.actual_weight_kg = (parseFloat(value) * 0.453592).toFixed(2);
      }

      return updated;
    });
  };

  const pendingItems = lineItems.filter(item => item.status === 'pending');
  const receivedItems = lineItems.filter(item => item.status === 'received');
  const progress = lineItems.length > 0 ? (receivedItems.length / lineItems.length) * 100 : 0;

  const useMetric = tenantConfig?.measurement_system === 'metric';

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
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
            <FileText className="w-7 h-7 text-green-600" />
            Receive Purchase Order
          </h1>
          <p className="text-sm text-gray-600">PO: {po?.po_number} • Scan barcodes to receive</p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Progress */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm text-gray-600">Receiving Progress</p>
              <p className="text-2xl font-bold">{receivedItems.length} / {lineItems.length} Skids</p>
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
        </CardContent>
      </Card>

      {/* Barcode Scanner */}
      {!selectedItem && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Scan className="w-5 h-5 text-blue-600" />
              Scan Barcode
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleScan} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="barcode">Barcode / Skid Number</Label>
                <Input
                  id="barcode"
                  value={scanInput}
                  onChange={(e) => setScanInput(e.target.value)}
                  placeholder="Scan or enter barcode (e.g., PO-123-SKD-001)"
                  autoFocus
                  className="text-lg"
                />
              </div>
              <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 gap-2">
                <Scan className="w-4 h-4" />
                Find Skid
              </Button>
            </form>

            {pendingItems.length > 0 && (
              <div className="mt-6">
                <p className="text-sm font-semibold text-gray-700 mb-3">Pending Skids ({pendingItems.length})</p>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {pendingItems.map((item) => {
                    const imageKey = `${item.category}_${item.product_type}`;
                    const productImage = skuData[imageKey];
                    return (
                      <div
                        key={item.id}
                        onClick={() => {
                          setScanInput(item.barcode);
                          handleScan({ preventDefault: () => {} });
                        }}
                        className="p-3 border rounded-lg hover:bg-blue-50 cursor-pointer transition-colors"
                      >
                        <div className="flex gap-4 items-center">
                          {/* Product Image - PHASE V */}
                          {productImage && (
                            <div className="flex-shrink-0">
                              <div className="relative group">
                                <img
                                  src={productImage}
                                  alt={item.product_type}
                                  className="w-16 h-16 object-cover rounded-md border-2 border-gray-200"
                                />
                                <Badge className="absolute top-0 right-0 bg-purple-600 text-white text-xs px-1 py-0.5 rounded-full">
                                  PHASE V
                                </Badge>
                              </div>
                            </div>
                          )}
                          <div className="flex-1 flex items-center justify-between">
                            <div>
                              <p className="font-semibold text-sm">{item.skid_number}</p>
                              <p className="text-xs text-gray-600">{item.category} • {item.expected_weight_lbs ? `${item.expected_weight_lbs.toFixed(0)} lbs` : `${item.expected_weight_kg.toFixed(0)} kg`}</p>
                            </div>
                            <Badge variant="outline">Pending</Badge>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Receiving Form */}
      {selectedItem && (
        <form onSubmit={handleReceive}>
          <Card className="mb-6 border-green-200 bg-green-50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-green-900">Scanned: {selectedItem.skid_number}</CardTitle>
                  <p className="text-sm text-gray-700 mt-1">Verify and confirm receipt</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedItem(null);
                    setScanInput('');
                    setAnomaliesDetected([]); // Clear anomalies on cancel
                  }}
                >
                  Cancel
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4">
                {/* Product Image - PHASE V */}
                {(() => {
                  const imageKey = `${selectedItem.category}_${selectedItem.product_type}`;
                  const productImage = skuData[imageKey];
                  return productImage && (
                    <div className="flex-shrink-0">
                      <div className="relative group">
                        <img
                          src={productImage}
                          alt={selectedItem.product_type}
                          className="w-24 h-24 object-cover rounded-lg border-2 border-gray-200"
                        />
                        <Badge className="absolute top-1 right-1 bg-purple-600 text-white text-xs">
                          PHASE V
                        </Badge>
                      </div>
                      <p className="text-xs text-center text-gray-600 mt-1">Reference</p>
                    </div>
                  );
                })()}

                <div className="flex-1">
                  <div className="grid md:grid-cols-2 gap-4 p-4 bg-white rounded-lg border">
                    <div>
                      <p className="text-xs text-gray-600">Category</p>
                      <p className="font-semibold">{selectedItem.category}</p>
                    </div>
                    {selectedItem.sub_category && (
                      <div>
                        <p className="text-xs text-gray-600">Sub-Category</p>
                        <p className="font-semibold">{selectedItem.sub_category}</p>
                      </div>
                    )}
                    {selectedItem.product_type && (
                      <div>
                        <p className="text-xs text-gray-600">Product Type</p>
                        <p className="font-semibold">{selectedItem.product_type}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-xs text-gray-600">Purity</p>
                      <p className="font-semibold">{selectedItem.purity}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Expected Weight</p>
                      <p className="font-semibold">
                        {useMetric
                          ? `${selectedItem.expected_weight_kg.toFixed(2)} kg`
                          : `${selectedItem.expected_weight_lbs.toFixed(2)} lbs`
                        }
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Container</p>
                      <p className="font-semibold">{selectedItem.container_type}</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* AI Anomaly Detection - NEW */}
          {receivingData.actual_weight_kg && selectedItem.expected_weight_kg && (
            <div className="mb-6">
              <AnomalyDetection
                expectedWeightKg={selectedItem.expected_weight_kg}
                actualWeightKg={parseFloat(receivingData.actual_weight_kg)}
                expectedPurity={selectedItem.purity}
                actualPurity={null} // Assuming actual purity is not yet captured here
                category={selectedItem.category}
                vendorName={po?.vendor_name}
                onAnomalyDetected={handleAnomalyDetected}
              />
            </div>
          )}

          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Actual Receipt Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="weight">Actual Weight ({useMetric ? 'kg' : 'lbs'}) *</Label>
                  <Input
                    id="weight"
                    type="number"
                    step="0.01"
                    value={useMetric ? receivingData.actual_weight_kg : receivingData.actual_weight_lbs}
                    onChange={(e) => handleWeightChange(
                      useMetric ? 'actual_weight_kg' : 'actual_weight_lbs',
                      e.target.value
                    )}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="grade">Quality Grade</Label>
                  <Select
                    value={receivingData.quality_grade}
                    onValueChange={(value) => setReceivingData(prev => ({ ...prev, quality_grade: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A">Grade A - Premium</SelectItem>
                      <SelectItem value="B">Grade B - Standard</SelectItem>
                      <SelectItem value="C">Grade C - Low Grade</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bin">Bin Location</Label>
                  <Input
                    id="bin"
                    value={receivingData.bin_location}
                    onChange={(e) => setReceivingData(prev => ({ ...prev, bin_location: e.target.value }))}
                    placeholder="e.g., A-101"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="zone">Zone</Label>
                  <Input
                    id="zone"
                    value={receivingData.zone}
                    onChange={(e) => setReceivingData(prev => ({ ...prev, zone: e.target.value }))}
                    placeholder="e.g., Zone A"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="variance">Variance Notes</Label>
                  <Textarea
                    id="variance"
                    value={receivingData.variance_notes}
                    onChange={(e) => setReceivingData(prev => ({ ...prev, variance_notes: e.target.value }))}
                    placeholder="Note any differences from expected (weight, quality, condition, etc.)"
                    rows={2}
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="inspection">Inspection Notes</Label>
                  <Textarea
                    id="inspection"
                    value={receivingData.inspection_notes}
                    onChange={(e) => setReceivingData(prev => ({ ...prev, inspection_notes: e.target.value }))}
                    placeholder="Visual inspection observations, damage, contamination, etc."
                    rows={2}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setSelectedItem(null);
                setScanInput('');
                setAnomaliesDetected([]); // Clear anomalies on cancel
              }}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={receiveItemMutation.isPending}
              className="flex-1 bg-green-600 hover:bg-green-700 gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              {receiveItemMutation.isPending ? 'Receiving...' : 'Confirm Receipt'}
            </Button>
          </div>
        </form>
      )}

      {/* Received Items */}
      {receivedItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              Received Skids ({receivedItems.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {receivedItems.map((item) => (
                <div key={item.id} className="p-3 border rounded-lg bg-green-50">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-sm">{item.skid_number}</p>
                      <p className="text-xs text-gray-600">
                        {item.actual_weight_lbs ? `${item.actual_weight_lbs.toFixed(0)} lbs` : `${item.actual_weight_kg.toFixed(0)} kg`} •
                        Grade {item.quality_grade} •
                        {item.bin_location && ` ${item.bin_location}`}
                      </p>
                    </div>
                    <Badge className="bg-green-100 text-green-700">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Received
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}