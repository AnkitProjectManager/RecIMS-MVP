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
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Package, ArrowLeft, Save, CheckCircle2, Info, Sparkles, Loader2, AlertCircle, Scale, Boxes } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import BinLocationSuggestion from "@/components/ai/BinLocationSuggestion";

export default function AddToInventory() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { tenantConfig, user } = useTenant();
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [useMetric, setUseMetric] = useState(true);
  const [showBinSuggestion, setShowBinSuggestion] = useState(false);
  const [matchingSKU, setMatchingSKU] = useState(null); // NEW: Track matched SKU

  const [formData, setFormData] = useState({
    vendor_name: '',
    sku_number: '', // NEW: Allow manual SKU entry
    category: '',
    sub_category: '',
    product_type: '',
    format: '',
    purity: 'UNKNOWN',
    quality_grade: 'B',
    quantity_kg: '',
    quantity_lbs: '',
    volume_cubic_feet: '',
    volume_cubic_yards: '',
    volume_cubic_meters: '',
    volume_unit: 'cubic_feet',
    unit_of_measure: 'kg',
    bin_location: '',
    zone: '',
    cost_per_kg: '',
    price_per_kg: '',
    lot_number: '',
    notes: ''
  });

  React.useEffect(() => {
    if (tenantConfig) {
      const isMetric = tenantConfig.measurement_system === 'metric';
      setUseMetric(isMetric);
      setFormData(prev => ({
        ...prev,
        unit_of_measure: isMetric ? 'kg' : 'lbs'
      }));
    }
  }, [tenantConfig]);

  const { data: vendors = [] } = useQuery({
    queryKey: ['vendors', user?.tenant_id],
    queryFn: async () => {
      if (!user?.tenant_id) return [];
      return await recims.entities.Vendor.filter({
        tenant_id: user.tenant_id,
        status: 'active'
      });
    },
    enabled: !!user?.tenant_id,
    initialData: [],
  });

  const { data: bins = [] } = useQuery({
    queryKey: ['bins', user?.tenant_id],
    queryFn: async () => {
      if (!user?.tenant_id) return [];
      const allBins = await recims.entities.Bin.filter({ tenant_id: user.tenant_id });
      return allBins.filter(b =>
        b.status === 'available' ||
        b.status === 'empty'
      );
    },
    enabled: !!user?.tenant_id,
    initialData: [],
  });

  const { data: zones = [] } = useQuery({
    queryKey: ['zones', user?.tenant_id],
    queryFn: async () => {
      if (!user?.tenant_id) return [];
      return await recims.entities.Zone.filter({
        tenant_id: user.tenant_id,
        status: 'active'
      });
    },
    enabled: !!user?.tenant_id,
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

  const availableSubCategories = React.useMemo(() => {
    if (!formData.category) return [];
    const filtered = skus.filter(sku => sku.category === formData.category);
    return [...new Set(filtered.map(sku => sku.sub_category))];
  }, [skus, formData.category]);

  const availableProductTypes = React.useMemo(() => {
    if (!formData.sub_category) return [];
    const filtered = skus.filter(sku =>
      sku.category === formData.category &&
      sku.sub_category === formData.sub_category
    );
    return [...new Set(filtered.map(sku => sku.product_type))];
  }, [skus, formData.category, formData.sub_category]);

  const convertToKg = (lbs) => lbs * 0.453592;
  const convertToLbs = (kg) => kg * 2.20462;

  // Volume conversion functions
  const convertVolume = (value, fromUnit, toUnit) => {
    if (!value || value === '' || value === '0') return '';
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return '';

    // Convert to cubic feet first
    let cubicFeet = 0;
    if (fromUnit === 'cubic_feet') {
      cubicFeet = numValue;
    } else if (fromUnit === 'cubic_yards') {
      cubicFeet = numValue * 27; // 1 yd³ = 27 ft³
    } else if (fromUnit === 'cubic_meters') {
      cubicFeet = numValue * 35.3147; // 1 m³ = 35.3147 ft³
    }

    // Convert from cubic feet to target unit
    if (toUnit === 'cubic_feet') {
      return cubicFeet.toFixed(2);
    } else if (toUnit === 'cubic_yards') {
      return (cubicFeet / 27).toFixed(2);
    } else if (toUnit === 'cubic_meters') {
      return (cubicFeet / 35.3147).toFixed(2);
    }
    return '';
  };

  const formatOptions = ['Bales', 'Rolls', 'Sheets', 'Pellets', 'Regrind', 'Flakes', 'Film', 'Purge', 'Mixed', 'Wire', 'Cable', 'Castings', 'Extrusions', 'Shredded', 'Other'];

  // NEW: Auto-detect matching SKU when product details change
  React.useEffect(() => {
    if (formData.category && formData.sub_category && formData.product_type && formData.purity) {
      const match = skus.find(sku =>
        sku.category === formData.category &&
        sku.sub_category === formData.sub_category &&
        sku.product_type === formData.product_type &&
        (sku.purity === formData.purity || sku.purity === 'UNKNOWN') // If form has specific purity, match specific or UNKNOWN SKU purity.
      );
      setMatchingSKU(match);
      if (match) {
        setFormData(prev => ({ ...prev, sku_number: match.sku_number }));
      } else {
        // If no match found, and SKU number is currently the auto-set one, clear it.
        // Or if the user entered something, don't clear it.
        // For now, let's keep it simple and just don't set if no match.
        // If user manually clears category/sub_category etc., the sku_number from auto-match should probably clear.
        if (skus.some(sku => sku.sku_number === formData.sku_number)) { // Check if current sku_number was likely auto-filled
          setFormData(prev => ({ ...prev, sku_number: '' }));
        }
      }
    } else {
      setMatchingSKU(null);
      // Clear sku_number if it was auto-filled and product details are incomplete
      if (skus.some(sku => sku.sku_number === formData.sku_number)) {
        setFormData(prev => ({ ...prev, sku_number: '' }));
      }
    }
  }, [formData.category, formData.sub_category, formData.product_type, formData.purity, formData.sku_number, skus]);

  const handleBinSuggestionSelected = (binCode, zone) => {
    setFormData(prev => ({
      ...prev,
      bin_location: binCode,
      zone: zone
    }));
    setShowBinSuggestion(false);
  };

  const createInventoryMutation = useMutation({
    mutationFn: async (data) => {
      let quantityKg = 0;
      let quantityLbs = 0;

      if (data.unit_of_measure === 'kg') {
        quantityKg = parseFloat(data.quantity_kg || '0');
        quantityLbs = convertToLbs(quantityKg);
      } else if (data.unit_of_measure === 'lbs') {
        quantityLbs = parseFloat(data.quantity_lbs || '0');
        quantityKg = convertToKg(quantityLbs);
      } else if (data.unit_of_measure === 'tonnes') { // Convert tonnes to kg and lbs
        quantityKg = parseFloat(data.quantity_kg || '0') * 1000;
        quantityLbs = convertToLbs(quantityKg);
      } else if (data.unit_of_measure === 'tons') { // Convert tons to lbs and kg
        quantityLbs = parseFloat(data.quantity_lbs || '0') * 2000;
        quantityKg = convertToKg(quantityLbs);
      }


      const needsSorting =
        !data.sub_category ||
        !data.product_type ||
        data.purity === 'UNKNOWN' ||
        !data.format ||
        data.format === 'Unknown';

      const inventory = await recims.entities.Inventory.create({
        inventory_id: needsSorting ? `INV-${String(Date.now()).padStart(9, '0')}` : `INV-${Date.now()}`,
        tenant_id: user?.tenant_id,
        vendor_name: data.vendor_name,
        sku_number: data.sku_number || matchingSKU?.sku_number || '', // NEW: Use SKU from form or matched SKU
        item_name: `${data.category} - ${data.product_type || data.sub_category || 'Material'}`,
        item_description: `${data.category}${data.sub_category ? ' > ' + data.sub_category : ''}${data.product_type ? ' > ' + data.product_type : ''} | Format: ${data.format || 'N/A'} | Purity: ${data.purity}`,
        category: data.category,
        sub_category: data.sub_category || '',
        product_type: data.product_type || '',
        format: data.format || '',
        purity: data.purity,
        quality_grade: data.quality_grade,
        measurement_type: 'both',
        unit_of_measure: data.unit_of_measure,
        quantity_on_hand: data.unit_of_measure === 'kg' ? quantityKg : quantityLbs,
        quantity_kg: quantityKg,
        quantity_lbs: quantityLbs,
        quantity_volume: data.volume_cubic_feet ? parseFloat(data.volume_cubic_feet) :
                        data.volume_cubic_yards ? parseFloat(data.volume_cubic_yards) :
                        data.volume_cubic_meters ? parseFloat(data.volume_cubic_meters) : null,
        volume_unit: data.volume_unit,
        reserved_quantity: 0,
        available_quantity: data.unit_of_measure === 'kg' ? quantityKg : quantityLbs,
        bin_location: data.bin_location || '',
        zone: data.zone || '',
        sorting_status: needsSorting ? 'needs_sorting' : 'classified',
        status: 'available',
        cost_per_kg: data.cost_per_kg ? parseFloat(data.cost_per_kg) : null,
        price_per_kg: data.price_per_kg ? parseFloat(data.price_per_kg) : null,
        total_cost: data.cost_per_kg ? quantityKg * parseFloat(data.cost_per_kg) : 0,
        total_value: data.price_per_kg ? quantityKg * parseFloat(data.price_per_kg) : 0,
        received_date: new Date().toISOString().split('T')[0],
        processed_date: new Date().toISOString().split('T')[0],
        lot_number: data.lot_number || `LOT-${Date.now()}`,
        notes: data.notes || ''
      });

      // Update bin capacity
      if (data.bin_location) {
        const bin = bins.find(b => b.bin_code === data.bin_location);
        if (bin) {
          const updateData = {
            current_weight_kg: (bin.current_weight_kg || 0) + quantityKg,
            current_weight_lbs: (bin.current_weight_lbs || 0) + quantityLbs,
            material_type: data.product_type || data.sub_category || data.category,
            last_updated: new Date().toISOString()
          };

          // Update volume if tracked
          if (bin.track_volume) {
            const newVolumeFeet = parseFloat(data.volume_cubic_feet || '0');
            const newVolumeYards = parseFloat(data.volume_cubic_yards || '0');
            const newVolumeMeters = parseFloat(data.volume_cubic_meters || '0');

            updateData.current_volume_cubic_feet = (bin.current_volume_cubic_feet || 0) + newVolumeFeet;
            updateData.current_volume_cubic_yards = (bin.current_volume_cubic_yards || 0) + newVolumeYards;
            updateData.current_volume_cubic_meters = (bin.current_volume_cubic_meters || 0) + newVolumeMeters;
          }

          // Update status if needed
          if (bin.status === 'empty') {
            updateData.status = 'available';
          }

          await recims.entities.Bin.update(bin.id, updateData);
        }
      }

      return inventory;
    },
    onSuccess: (createdItem) => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['unsortedInventory'] });
      queryClient.invalidateQueries({ queryKey: ['bins'] });

      if (createdItem.sorting_status === 'needs_sorting') {
        setSuccess("Material added but needs sorting. Redirecting to sorting page...");
        setTimeout(() => {
          navigate(createPageUrl("InventorySorting"));
        }, 1500);
      } else {
        setSuccess("Material added to inventory successfully!");
        setTimeout(() => {
          navigate(createPageUrl("InventoryManagement")); // Changed navigation here
        }, 1500);
      }
    },
    onError: (err) => {
      setError(`Failed to add to inventory: ${err.message || 'Unknown error'}`);
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setError(null);

    if (!formData.vendor_name) {
      setError("Vendor/supplier name is required");
      return;
    }

    if (!formData.category) {
      setError("Category is required");
      return;
    }

    const quantity = formData.unit_of_measure === 'kg' ? formData.quantity_kg : formData.quantity_lbs;
    if (!quantity || parseFloat(quantity) <= 0) {
      setError("Valid quantity is required");
      return;
    }

    if (!formData.zone) {
      setError("Zone is required for storage.");
      return;
    }

    createInventoryMutation.mutate(formData);
  };

  const handleChange = (field, value) => {
    setFormData(prev => {
      let updated = { ...prev, [field]: value };

      if (field === 'category') {
        updated.sub_category = '';
        updated.product_type = '';
      } else if (field === 'sub_category') {
        updated.product_type = '';
      } else if (field === 'zone') {
        updated.bin_location = '';
      } else if (field === 'volume_cubic_feet') {
        if (value && value !== '0') {
          updated.volume_cubic_yards = convertVolume(value, 'cubic_feet', 'cubic_yards');
          updated.volume_cubic_meters = convertVolume(value, 'cubic_feet', 'cubic_meters');
        } else {
          updated.volume_cubic_yards = '';
          updated.volume_cubic_meters = '';
        }
      } else if (field === 'volume_cubic_yards') {
        if (value && value !== '0') {
          updated.volume_cubic_feet = convertVolume(value, 'cubic_yards', 'cubic_feet');
          updated.volume_cubic_meters = convertVolume(value, 'cubic_yards', 'cubic_meters');
        } else {
          updated.volume_cubic_feet = '';
          updated.volume_cubic_meters = '';
        }
      } else if (field === 'volume_cubic_meters') {
        if (value && value !== '0') {
          updated.volume_cubic_feet = convertVolume(value, 'cubic_meters', 'cubic_feet');
          updated.volume_cubic_yards = convertVolume(value, 'cubic_meters', 'cubic_yards');
        } else {
          updated.volume_cubic_feet = '';
          updated.volume_cubic_yards = '';
        }
      } else if (field === 'volume_unit') {
        // When volume_unit changes, keep current values
        // Don't clear the fields
      }

      return updated;
    });
  };

  const weightUnit = useMetric ? 'kg' : 'lbs';
  const weightField = useMetric ? 'quantity_kg' : 'quantity_lbs';

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Button
          variant="outline"
          size="icon"
          onClick={() => navigate(createPageUrl("InventoryManagement"))}
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Add to Inventory</h1>
          <p className="text-sm text-gray-600">Record processed materials in inventory</p>
        </div>
        <Badge variant="outline" className="text-xs">
          {useMetric ? 'METRIC (kg)' : 'IMPERIAL (lbs)'}
        </Badge>
      </div>



      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="mb-6 bg-green-50 border-green-200">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">{success}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit}>
        <Card className="mb-6 border-2" style={{ borderColor: '#388E3C', backgroundColor: 'rgba(56, 142, 60, 0.05)' }}>
          <CardHeader>
            <CardTitle className="text-lg">Vendor/Supplier *</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="vendor">Vendor/Supplier Name *</Label>
              {vendors.length > 0 ? (
                <Select
                  value={formData.vendor_name}
                  onValueChange={(value) => handleChange('vendor_name', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select vendor/supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    {vendors.map((vendor) => (
                      <SelectItem key={vendor.id} value={vendor.display_name}>
                        {vendor.display_name} {vendor.company_name && `(${vendor.company_name})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id="vendor"
                  value={formData.vendor_name}
                  onChange={(e) => handleChange('vendor_name', e.target.value)}
                  placeholder="Enter vendor/supplier name"
                  required
                />
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              Product Details *
            </CardTitle>
            <p className="text-sm text-gray-600">Select product classification</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* NEW: SKU Number Field */}
            <div className="space-y-2">
              <Label htmlFor="sku">SKU Number (Optional - will auto-match or generate)</Label>
              <Input
                id="sku"
                value={formData.sku_number}
                onChange={(e) => handleChange('sku_number', e.target.value)}
                placeholder="e.g., PLS-PP-FILM-100 or leave empty for auto"
                className="font-mono"
              />
              {matchingSKU && !formData.sku_number && (
                <Alert className="bg-green-50 border-green-200">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800 text-sm">
                    <strong>Auto-Matched SKU:</strong> {matchingSKU.sku_number}
                    <br/>
                    <span className="text-xs">{matchingSKU.description}</span>
                  </AlertDescription>
                </Alert>
              )}
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Category *</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => handleChange('category', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableCategories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="subCategory">Sub-Category</Label>
                <Select
                  value={formData.sub_category}
                  onValueChange={(value) => handleChange('sub_category', value)}
                  disabled={!formData.category}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select sub-category" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSubCategories.length > 0 ? (
                      availableSubCategories.map((sub) => (
                        <SelectItem key={sub} value={sub}>
                          {sub}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="other">Other / Unspecified</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="productType">Product Type</Label>
                <Select
                  value={formData.product_type}
                  onValueChange={(value) => handleChange('product_type', value)}
                  disabled={!formData.sub_category}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select product type" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableProductTypes.length > 0 ? (
                      availableProductTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="other">Other / Unspecified</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="format">Format</Label>
                <Select
                  value={formData.format}
                  onValueChange={(value) => handleChange('format', value)}
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
                <Label htmlFor="purity">Purity *</Label>
                <Select
                  value={formData.purity}
                  onValueChange={(value) => handleChange('purity', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="100%">100%</SelectItem>
                    <SelectItem value="90%">90%</SelectItem>
                    <SelectItem value="80%">80%</SelectItem>
                    <SelectItem value="70%">70%</SelectItem>
                    <SelectItem value="60%">60%</SelectItem>
                    <SelectItem value="50%">50%</SelectItem>
                    <SelectItem value="40%">40%</SelectItem>
                    <SelectItem value="MIXED">MIXED</SelectItem>
                    <SelectItem value="UNKNOWN">UNKNOWN</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="grade">Quality Grade *</Label>
                <Select
                  value={formData.quality_grade}
                  onValueChange={(value) => handleChange('quality_grade', value)}
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
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Weight & Volume *</CardTitle>
            <p className="text-sm text-gray-600">Specify both weight and volume for optimal bin placement</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Weight Section */}
            <div className="p-3 bg-blue-50 rounded-lg">
              <Label className="font-semibold mb-3 block flex items-center gap-2">
                <Scale className="w-4 h-4" />
                Weight Information
              </Label>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="quantity">Quantity ({weightUnit}) *</Label>
                  <Input
                    id="quantity"
                    type="number"
                    step="0.01"
                    value={formData[weightField]}
                    onChange={(e) => handleChange(weightField, e.target.value)}
                    placeholder="0.00"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="unitMeasure">Unit of Measure *</Label>
                  <Select
                    value={formData.unit_of_measure}
                    onValueChange={(value) => handleChange('unit_of_measure', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="kg">Kilograms (kg)</SelectItem>
                      <SelectItem value="lbs">Pounds (lbs)</SelectItem>
                      <SelectItem value="tonnes">Tonnes</SelectItem>
                      <SelectItem value="tons">Tons</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="lot">Lot Number</Label>
                  <Input
                    id="lot"
                    value={formData.lot_number}
                    onChange={(e) => handleChange('lot_number', e.target.value)}
                    placeholder="Auto-generated if empty"
                  />
                </div>
              </div>
            </div>

            {/* Volume Section */}
            <div className="p-3 bg-green-50 rounded-lg">
              <Label className="font-semibold mb-3 block flex items-center gap-2">
                <Boxes className="w-4 h-4" />
                Volume Information (Optional)
              </Label>

              <div className="space-y-2 mb-3">
                <Label>Primary Volume Unit</Label>
                <Select
                  value={formData.volume_unit}
                  onValueChange={(value) => handleChange('volume_unit', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cubic_feet">Cubic Feet (ft³)</SelectItem>
                    <SelectItem value="cubic_yards">Cubic Yards (yd³)</SelectItem>
                    <SelectItem value="cubic_meters">Cubic Meters (m³)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Volume (ft³)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.volume_cubic_feet}
                    onChange={(e) => handleChange('volume_cubic_feet', e.target.value)}
                    placeholder="0.00"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Volume (yd³)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.volume_cubic_yards}
                    onChange={(e) => handleChange('volume_cubic_yards', e.target.value)}
                    placeholder="0.00"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Volume (m³)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.volume_cubic_meters}
                    onChange={(e) => handleChange('volume_cubic_meters', e.target.value)}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <p className="text-xs text-green-700 mt-2">
                💡 Auto-conversion: Enter any field and the others calculate automatically
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Storage Location & Pricing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="zone">Zone *</Label>
                <Select
                  value={formData.zone}
                  onValueChange={(value) => {
                    handleChange('zone', value);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select zone" />
                  </SelectTrigger>
                  <SelectContent>
                    {zones.length === 0 ? (
                      <SelectItem value="no-zones" disabled>No zones available</SelectItem>
                    ) : (
                      zones.map((zone) => (
                        <SelectItem key={zone.id} value={zone.zone_code}>
                          {zone.zone_code} - {zone.zone_name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {zones.length === 0 && (
                  <p className="text-xs text-orange-600">
                    No zones defined. Ask admin to create zones in SuperAdmin.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="bin">Bin Location</Label>
                <Select
                  value={formData.bin_location}
                  onValueChange={(value) => handleChange('bin_location', value)}
                  disabled={!formData.zone}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={formData.zone ? "Select bin" : "Select zone first"} />
                  </SelectTrigger>
                  <SelectContent>
                    {bins.filter(b => !formData.zone || b.zone === formData.zone).length === 0 ? (
                      <SelectItem value="no-bins" disabled>No bins in this zone</SelectItem>
                    ) : (
                      bins
                        .filter(b => !formData.zone || b.zone === formData.zone)
                        .map((bin) => (
                          <SelectItem key={bin.id} value={bin.bin_code}>
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full border"
                                style={{ backgroundColor: bin.bin_color || '#10b981' }}
                              />
                              {bin.bin_code}
                              {bin.bin_description && ` - ${bin.bin_description.substring(0, 30)}`}
                            </div>
                          </SelectItem>
                        ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cost">Cost per kg</Label>
                <Input
                  id="cost"
                  type="number"
                  step="0.01"
                  value={formData.cost_per_kg}
                  onChange={(e) => handleChange('cost_per_kg', e.target.value)}
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="price">Price per kg</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  value={formData.price_per_kg}
                  onChange={(e) => handleChange('price_per_kg', e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={() => setShowBinSuggestion(!showBinSuggestion)}
              className="w-full gap-2"
            >
              <Sparkles className="w-4 h-4" />
              {showBinSuggestion ? 'Hide' : 'Show'} AI Bin Optimization
            </Button>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => handleChange('notes', e.target.value)}
                placeholder="Additional notes about this inventory item..."
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {showBinSuggestion && formData.category && (parseFloat(formData.quantity_kg || '0') > 0 || parseFloat(formData.quantity_lbs || '0') > 0) && (
          <div className="mb-6">
            <BinLocationSuggestion
              materialType={formData.product_type || formData.sub_category || formData.category}
              category={formData.category}
              weightKg={
                formData.unit_of_measure === 'kg'
                  ? parseFloat(formData.quantity_kg || '0')
                  : convertToKg(parseFloat(formData.quantity_lbs || '0'))
              }
              volumeCubicFeet={
                formData.volume_cubic_feet ? parseFloat(formData.volume_cubic_feet) :
                formData.volume_cubic_yards ? parseFloat(convertVolume(formData.volume_cubic_yards, 'cubic_yards', 'cubic_feet')) :
                formData.volume_cubic_meters ? parseFloat(convertVolume(formData.volume_cubic_meters, 'cubic_meters', 'cubic_feet')) :
                0
              }
              productGrouping="standard"
              bins={bins}
              onSuggestionSelected={handleBinSuggestionSelected}
            />
          </div>
        )}

        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(createPageUrl("InventoryManagement"))}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={createInventoryMutation.isPending}
            className="flex-1 gap-2"
            style={{ backgroundColor: '#388E3C' }}
          >
            <Save className="w-4 h-4" />
            {createInventoryMutation.isPending ? 'Saving...' : 'Add to Inventory'}
          </Button>
        </div>
      </form>
    </div>
  );
}