import React, { useState } from "react";
import { recims } from "@/api/recimsClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTenant } from "@/components/TenantContext";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { TruckIcon, Save, ArrowLeft, AlertTriangle, Package, Boxes } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

export default function EditShipment() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { tenantConfig, user } = useTenant();
  const [error, setError] = useState(null);
  const [useMetric, setUseMetric] = useState(true);
  const [shipmentId, setShipmentId] = useState(null);
  
  const [formData, setFormData] = useState({
    supplier_name: '',
    truck_number: '',
    driver_name: '',
    load_type: 'plastic',
    product_category: '',
    product_sub_category: '',
    product_type: '',
    product_format: '',
    product_purity: 'UNKNOWN',
    sku_number: '',
    container_type: '',
    gross_weight: '',
    tare_weight: '',
    volume_cubic_feet: '',
    volume_cubic_yards: '',
    volume_cubic_meters: '',
    volume_unit: 'cubic_feet',
    notes: '',
    status: 'pending_inspection'
  });

  React.useEffect(() => {
    // Get shipment ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');
    setShipmentId(id);
  }, []);

  React.useEffect(() => {
    if (tenantConfig) {
      const isMetric = tenantConfig.measurement_system === 'metric';
      setUseMetric(isMetric);
    }
  }, [tenantConfig]);

  // Fetch the shipment to edit
  const { data: shipment, isLoading: loadingShipment } = useQuery({
    queryKey: ['shipment', shipmentId],
    queryFn: async () => {
      if (!shipmentId) return null;
      const shipments = await recims.entities.InboundShipment.filter({ id: shipmentId });
      return shipments[0] || null;
    },
    enabled: !!shipmentId,
  });

  // Load form data when shipment is fetched
  React.useEffect(() => {
    if (shipment) {
      setFormData({
        supplier_name: shipment.supplier_name || '',
        truck_number: shipment.truck_number || '',
        driver_name: shipment.driver_name || '',
        load_type: shipment.load_type || 'plastic',
        product_category: shipment.product_category || '',
        product_sub_category: shipment.product_sub_category || '',
        product_type: shipment.product_type || '',
        product_format: shipment.product_format || '',
        product_purity: shipment.product_purity || 'UNKNOWN',
        sku_number: shipment.sku_number || '',
        container_type: shipment.container_type || '',
        gross_weight: useMetric ? (shipment.gross_weight || '') : (shipment.gross_weight_lbs || ''),
        tare_weight: useMetric ? (shipment.tare_weight || '') : (shipment.tare_weight_lbs || ''),
        volume_cubic_feet: shipment.volume_cubic_feet || '',
        volume_cubic_yards: shipment.volume_cubic_yards || '',
        volume_cubic_meters: shipment.volume_cubic_meters || '',
        volume_unit: shipment.volume_unit || 'cubic_feet',
        notes: shipment.notes || '',
        status: shipment.status || 'pending_inspection'
      });
    }
  }, [shipment, useMetric]);

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers'],
    queryFn: async () => {
      const allSuppliers = await recims.entities.Supplier.list();
      return allSuppliers.filter(s => s.status === 'active');
    },
    initialData: [],
  });

  const { data: containers = [] } = useQuery({
    queryKey: ['containers', user?.tenant_id],
    queryFn: async () => {
      if (!user?.tenant_id) return [];
      return await recims.entities.Container.filter({
        status: 'active',
        tenant_id: user.tenant_id
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
    const filtered = skus.filter(sku => {
      if (formData.load_type === 'plastic') {
        return sku.category === 'PLASTICS' || sku.category === 'PLASTIC-RESINS';
      } else if (formData.load_type === 'metal') {
        return sku.category === 'FERROUS' || sku.category === 'NON-FERROUS' || sku.category === 'SPECIALTY';
      }
      return true;
    });
    return [...new Set(filtered.map(sku => sku.category))];
  }, [skus, formData.load_type]);

  const availableSubCategories = React.useMemo(() => {
    if (!formData.product_category) return [];
    const filtered = skus.filter(sku => sku.category === formData.product_category);
    return [...new Set(filtered.map(sku => sku.sub_category))];
  }, [skus, formData.product_category]);

  const availableProductTypes = React.useMemo(() => {
    if (!formData.product_sub_category) return [];
    const filtered = skus.filter(sku => 
      sku.category === formData.product_category && 
      sku.sub_category === formData.product_sub_category
    );
    return [...new Set(filtered.map(sku => sku.product_type))];
  }, [skus, formData.product_category, formData.product_sub_category]);

  const formatOptions = ['Sheets', 'Rolls', 'Chipped', 'Shredded', 'Pipes', 'Wires', 'Casings', 'Mixed', 'Corrugated', 'Bales', 'Pellets', 'Regrind', 'Flakes', 'Film', 'Other', 'Unknown'];

  const convertToKg = (lbs) => lbs * 0.453592;
  const convertToLbs = (kg) => kg * 2.20462;

  const convertVolume = (value, fromUnit, toUnit) => {
    if (!value || value === '' || value === '0') return '';
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return '';

    let cubicFeet = 0;
    if (fromUnit === 'cubic_feet') {
      cubicFeet = numValue;
    } else if (fromUnit === 'cubic_yards') {
      cubicFeet = numValue * 27;
    } else if (fromUnit === 'cubic_meters') {
      cubicFeet = numValue * 35.3147;
    }

    if (toUnit === 'cubic_feet') {
      return cubicFeet.toFixed(2);
    } else if (toUnit === 'cubic_yards') {
      return (cubicFeet / 27).toFixed(2);
    } else if (toUnit === 'cubic_meters') {
      return (cubicFeet / 35.3147).toFixed(2);
    }
    return '';
  };

  const updateShipmentMutation = useMutation({
    mutationFn: async (data) => {
      let grossWeight = data.gross_weight ? parseFloat(data.gross_weight) : 0;
      let tareWeight = data.tare_weight ? parseFloat(data.tare_weight) : 0;
      
      let grossWeightKg = grossWeight;
      let tareWeightKg = tareWeight;
      let grossWeightLbs = 0;
      let tareWeightLbs = 0;
      
      if (!useMetric) {
        grossWeightKg = convertToKg(grossWeight);
        tareWeightKg = convertToKg(tareWeight);
        grossWeightLbs = grossWeight;
        tareWeightLbs = tareWeight;
      } else {
        grossWeightLbs = convertToLbs(grossWeight);
        tareWeightLbs = convertToLbs(tareWeight);
      }
      
      if (tareWeightKg > grossWeightKg && grossWeightKg > 0) {
        throw new Error("Tare weight cannot exceed gross weight");
      }

      const netWeightKg = grossWeightKg && tareWeightKg ? grossWeightKg - tareWeightKg : 0;
      const netWeightLbs = grossWeightLbs && tareWeightLbs ? grossWeightLbs - tareWeightLbs : 0;

      return await recims.entities.InboundShipment.update(shipmentId, {
        supplier_name: data.supplier_name,
        truck_number: data.truck_number,
        driver_name: data.driver_name,
        load_type: data.load_type,
        product_category: data.product_category,
        product_sub_category: data.product_sub_category,
        product_type: data.product_type,
        product_format: data.product_format,
        product_purity: data.product_purity,
        sku_number: data.sku_number,
        container_type: data.container_type,
        gross_weight: grossWeightKg > 0 ? grossWeightKg : null,
        tare_weight: tareWeightKg > 0 ? tareWeightKg : null,
        net_weight: netWeightKg > 0 ? netWeightKg : null,
        gross_weight_lbs: grossWeightLbs > 0 ? grossWeightLbs : null,
        tare_weight_lbs: tareWeightLbs > 0 ? tareWeightLbs : null,
        net_weight_lbs: netWeightLbs > 0 ? netWeightLbs : null,
        volume_cubic_feet: data.volume_cubic_feet ? parseFloat(data.volume_cubic_feet) : null,
        volume_cubic_yards: data.volume_cubic_yards ? parseFloat(data.volume_cubic_yards) : null,
        volume_cubic_meters: data.volume_cubic_meters ? parseFloat(data.volume_cubic_meters) : null,
        volume_unit: data.volume_unit,
        calculated_density: netWeightKg > 0 && parseFloat(data.volume_cubic_meters) > 0 
          ? netWeightKg / parseFloat(data.volume_cubic_meters) 
          : null,
        notes: data.notes,
        status: data.status
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inboundShipments'] });
      queryClient.invalidateQueries({ queryKey: ['shipment', shipmentId] });
      navigate(createPageUrl("InboundShipments"));
    },
    onError: (err) => {
      setError(err.message || "Failed to update shipment. Please try again.");
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setError(null);

    if (!formData.supplier_name) {
      setError("Supplier name is required");
      return;
    }
    
    if (!formData.truck_number) {
      setError("Truck number is required");
      return;
    }

    updateShipmentMutation.mutate(formData);
  };

  const handleChange = (field, value) => {
    setFormData(prev => {
      let updated = { ...prev, [field]: value };
      
      if (field === 'load_type') {
        updated.product_category = '';
        updated.product_sub_category = '';
        updated.product_type = '';
        updated.product_format = '';
      } else if (field === 'product_category') {
        updated.product_sub_category = '';
        updated.product_type = '';
      } else if (field === 'product_sub_category') {
        updated.product_type = '';
      } else if (field === 'container_type') {
        const selectedContainer = containers.find(c => c.container_code === value);
        if (selectedContainer) {
          let tareWeightValue = '';
          if (useMetric) {
            if (selectedContainer.tare_weight_kg) {
              tareWeightValue = selectedContainer.tare_weight_kg.toString();
            } else if (selectedContainer.tare_weight_lbs) {
              tareWeightValue = convertToKg(selectedContainer.tare_weight_lbs).toFixed(2);
            }
          } else {
            if (selectedContainer.tare_weight_lbs) {
              tareWeightValue = selectedContainer.tare_weight_lbs.toString();
            } else if (selectedContainer.tare_weight_kg) {
              tareWeightValue = convertToLbs(selectedContainer.tare_weight_kg).toFixed(2);
            }
          }
          updated.tare_weight = tareWeightValue;
        }
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
      }
      
      return updated;
    });
  };

  const grossWeight = parseFloat(formData.gross_weight) || 0;
  const tareWeight = parseFloat(formData.tare_weight) || 0;
  const netWeight = grossWeight && tareWeight ? (grossWeight - tareWeight).toFixed(2) : '0.00';
  const hasWeightError = grossWeight > 0 && tareWeight > 0 && tareWeight > grossWeight;
  
  const weightUnit = useMetric ? 'kg' : 'lbs';

  if (loadingShipment) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading shipment...</p>
        </div>
      </div>
    );
  }

  if (!shipment) {
    return (
      <div className="p-4 md:p-8 max-w-4xl mx-auto">
        <Alert variant="destructive">
          <AlertDescription>Shipment not found</AlertDescription>
        </Alert>
        <Button onClick={() => navigate(createPageUrl("InboundShipments"))} className="mt-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Shipments
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Button
          variant="outline"
          size="icon"
          onClick={() => navigate(createPageUrl("InboundShipments"))}
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Edit Shipment</h1>
          <p className="text-sm text-gray-600">Update shipment information - Load ID: {shipment.load_id}</p>
        </div>
        <Badge variant="outline" className="text-xs">
          {useMetric ? 'METRIC' : 'IMPERIAL'}
        </Badge>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit}>
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TruckIcon className="w-5 h-5" />
              Shipment Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="status">Shipment Status *</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => handleChange('status', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending_inspection">Pending Inspection</SelectItem>
                    <SelectItem value="arrived">Arrived</SelectItem>
                    <SelectItem value="weighing">Weighing</SelectItem>
                    <SelectItem value="inspecting">Inspecting</SelectItem>
                    <SelectItem value="classifying">Classifying</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="supplier">Supplier *</Label>
                <Input
                  id="supplier"
                  value={formData.supplier_name}
                  onChange={(e) => handleChange('supplier_name', e.target.value)}
                  placeholder="Enter supplier name"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="truck">Truck Number *</Label>
                <Input
                  id="truck"
                  value={formData.truck_number}
                  onChange={(e) => handleChange('truck_number', e.target.value)}
                  placeholder="e.g., TRK-123"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="driver">Driver Name</Label>
                <Input
                  id="driver"
                  value={formData.driver_name}
                  onChange={(e) => handleChange('driver_name', e.target.value)}
                  placeholder="Driver name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="loadType">Load Type *</Label>
                <Select
                  value={formData.load_type}
                  onValueChange={(value) => handleChange('load_type', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="plastic">Plastic</SelectItem>
                    <SelectItem value="metal">Metal</SelectItem>
                    <SelectItem value="mixed">Mixed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="container">Container Type</Label>
                <Select
                  value={formData.container_type}
                  onValueChange={(value) => handleChange('container_type', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select container type" />
                  </SelectTrigger>
                  <SelectContent>
                    {containers.map((container) => (
                      <SelectItem key={container.id} value={container.container_code}>
                        {container.container_code} - {container.container_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6 border-purple-200 bg-purple-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5 text-purple-600" />
              Product Classification
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select
                  value={formData.product_category}
                  onValueChange={(value) => handleChange('product_category', value)}
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
                  value={formData.product_sub_category}
                  onValueChange={(value) => handleChange('product_sub_category', value)}
                  disabled={!formData.product_category}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select sub-category" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSubCategories.map((sub) => (
                      <SelectItem key={sub} value={sub}>
                        {sub}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="productType">Product Type</Label>
                <Select
                  value={formData.product_type}
                  onValueChange={(value) => handleChange('product_type', value)}
                  disabled={!formData.product_sub_category}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select product type" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableProductTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="purity">Purity</Label>
                <Select
                  value={formData.product_purity}
                  onValueChange={(value) => handleChange('product_purity', value)}
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

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="format">Format</Label>
                <Select
                  value={formData.product_format}
                  onValueChange={(value) => handleChange('product_format', value)}
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
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Weight Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {hasWeightError && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Tare weight ({tareWeight} {weightUnit}) cannot exceed gross weight ({grossWeight} {weightUnit})
                </AlertDescription>
              </Alert>
            )}
            
            <div className="grid md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="gross">Gross Weight ({weightUnit})</Label>
                <Input
                  id="gross"
                  type="number"
                  step="0.01"
                  value={formData.gross_weight}
                  onChange={(e) => handleChange('gross_weight', e.target.value)}
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tare">Tare Weight ({weightUnit})</Label>
                <Input
                  id="tare"
                  type="number"
                  step="0.01"
                  value={formData.tare_weight}
                  onChange={(e) => handleChange('tare_weight', e.target.value)}
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label>Net Weight ({weightUnit})</Label>
                <div className="h-10 rounded-md px-3 flex items-center font-semibold bg-gray-100 text-gray-900">
                  {netWeight}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6 border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Boxes className="w-5 h-5 text-blue-600" />
              Volume Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
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
                <Label htmlFor="volumeFeet">Volume (ft³)</Label>
                <Input
                  id="volumeFeet"
                  type="number"
                  step="0.01"
                  value={formData.volume_cubic_feet}
                  onChange={(e) => handleChange('volume_cubic_feet', e.target.value)}
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="volumeYards">Volume (yd³)</Label>
                <Input
                  id="volumeYards"
                  type="number"
                  step="0.01"
                  value={formData.volume_cubic_yards}
                  onChange={(e) => handleChange('volume_cubic_yards', e.target.value)}
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="volumeMeters">Volume (m³)</Label>
                <Input
                  id="volumeMeters"
                  type="number"
                  step="0.01"
                  value={formData.volume_cubic_meters}
                  onChange={(e) => handleChange('volume_cubic_meters', e.target.value)}
                  placeholder="0.00"
                />
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
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              placeholder="Enter any additional notes or observations..."
              rows={4}
            />
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(createPageUrl("InboundShipments"))}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={updateShipmentMutation.isPending || hasWeightError}
            className="flex-1 bg-green-600 hover:bg-green-700 gap-2"
          >
            <Save className="w-4 h-4" />
            {updateShipmentMutation.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </div>
  );
}