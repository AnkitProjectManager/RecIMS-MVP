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
import { Badge } from "@/components/ui/badge";
import { Package, Save, ArrowLeft, AlertCircle, Sparkles, Boxes, CheckCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import BinLocationSuggestion from "@/components/ai/BinLocationSuggestion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function MaterialClassification() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { tenantConfig, user } = useTenant();
  const [error, setError] = useState(null);
  const [selectedShipment, setSelectedShipment] = useState(null);

  const neumorph = {
    card: 'bg-gradient-to-br from-gray-50 to-gray-100 shadow-[8px_8px_16px_#d1d5db,-8px_-8px_16px_#ffffff] border-0',
    rounded: 'rounded-2xl'
  };
  const [capacityWarning, setCapacityWarning] = useState(null);
  const [showPrintDialog, setShowPrintDialog] = useState(false);
  const [classifiedBinData, setClassifiedBinData] = useState(null);
  const [classifiedInventory, setClassifiedInventory] = useState(null);
  
  // Determine weight unit based on tenant configuration
  const useMetric = tenantConfig?.weight_unit === 'kg' || tenantConfig?.weight_unit === 'metric';
  const weightUnit = useMetric ? 'kg' : 'lbs';
  
  const [formData, setFormData] = useState({
    material_category: '',
    quality_grade: 'B',
    weight_kg: '',
    weight_lbs: '',
    volume_cubic_feet: '',
    volume_cubic_yards: '',
    volume_cubic_meters: '',
    volume_unit: 'cubic_feet',
    contamination_percent: '0',
    contamination_notes: '',
    color: '',
    bin_location: '',
    zone: ''
  });

  const [showBinSuggestion, setShowBinSuggestion] = useState(false);



  const { data: pendingShipments = [] } = useQuery({
    queryKey: ['qcPendingShipments'],
    queryFn: async () => {
      // Fetch shipments that are either pending_inspection or arrived (for backward compatibility)
      const pending = await recims.entities.InboundShipment.filter({ 
        status: 'pending_inspection' 
      }, '-created_date', 20);
      
      const arrived = await recims.entities.InboundShipment.filter({ 
        status: 'arrived' 
      }, '-created_date', 20);
      
      // Combine both and sort by created_date
      const combined = [...pending, ...arrived].sort((a, b) => 
        new Date(b.created_date) - new Date(a.created_date)
      );
      
      return combined;
    },
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
      return await recims.entities.Zone.filter({ tenant_id: user.tenant_id, status: 'active' });
    },
    enabled: !!user?.tenant_id,
    initialData: [],
  });

  const { data: settings = [] } = useQuery({
    queryKey: ['appSettings'],
    queryFn: () => recims.entities.AppSettings.list(),
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

  const { data: tenantCategories = [] } = useQuery({
    queryKey: ['tenantCategories', user?.tenant_id],
    queryFn: async () => {
      if (!user?.tenant_id) return [];
      return await recims.entities.TenantCategory.filter({
        tenant_id: user.tenant_id,
        is_active: true
      }, 'sort_order');
    },
    enabled: !!user?.tenant_id,
    initialData: [],
  });

  const binCapacityEnabled = settings.find(s => s.setting_key === 'enable_bin_capacity_management')?.setting_value === 'true';

  // Volume conversion functions
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

  const checkBinCapacity = (binCode, newWeight, newVolumeFeet, newVolumeYards, newVolumeMeters) => {
    if (!binCapacityEnabled) return null;
    
    const selectedBin = bins.find(b => b.bin_code === binCode);
    if (!selectedBin) return null;

    const violations = [];

    if (selectedBin.track_weight !== false && selectedBin.max_weight_kg) {
      const currentWeight = selectedBin.current_weight_kg || 0;
      const capacity = selectedBin.max_weight_kg || 0;
      const availableCapacity = capacity - currentWeight;
      const weightToAdd = parseFloat(newWeight) || 0;

      if (weightToAdd > availableCapacity) {
        violations.push({
          type: 'weight',
          currentValue: currentWeight,
          maxCapacity: capacity,
          availableCapacity,
          valueToAdd: weightToAdd,
          exceededBy: weightToAdd - availableCapacity,
          unit: 'kg'
        });
      }
    }

    if (selectedBin.track_volume) {
      const volumeUnit = selectedBin.volume_unit || 'cubic_feet';
      let currentVolume = 0;
      let maxVolume = 0;
      let volumeToAdd = 0;

      if (volumeUnit === 'cubic_feet') {
        currentVolume = selectedBin.current_volume_cubic_feet || 0;
        maxVolume = selectedBin.max_volume_cubic_feet || 0;
        volumeToAdd = parseFloat(newVolumeFeet) || 0;
      } else if (volumeUnit === 'cubic_yards') {
        currentVolume = selectedBin.current_volume_cubic_yards || 0;
        maxVolume = selectedBin.max_volume_cubic_yards || 0;
        volumeToAdd = parseFloat(newVolumeYards) || 0;
      } else if (volumeUnit === 'cubic_meters') {
        currentVolume = selectedBin.current_volume_cubic_meters || 0;
        maxVolume = selectedBin.max_volume_cubic_meters || 0;
        volumeToAdd = parseFloat(newVolumeMeters) || 0;
      }

      const availableCapacity = maxVolume - currentVolume;
      if (maxVolume > 0 && volumeToAdd > availableCapacity) {
        violations.push({
          type: 'volume',
          currentValue: currentVolume,
          maxCapacity: maxVolume,
          availableCapacity,
          valueToAdd: volumeToAdd,
          exceededBy: volumeToAdd - availableCapacity,
          unit: volumeUnit === 'cubic_feet' ? 'ft³' : volumeUnit === 'cubic_yards' ? 'yd³' : 'm³'
        });
      }
    }

    if (violations.length > 0) {
      return {
        binCode: selectedBin.bin_code,
        violations
      };
    }

    return null;
  };

  const classifyMaterialMutation = useMutation({
    mutationFn: async (data) => {
      console.log('Mutation received data:', data);
      console.log('Tenant ID from data:', data.tenant_id);
      
      if (!data.tenant_id) {
        throw new Error(`Tenant ID is missing. Data: ${JSON.stringify(data)}`);
      }
      
      // Step 1: Create Material record
      const material = await recims.entities.Material.create({
        shipment_id: selectedShipment.id,
        load_id: selectedShipment.load_id,
        tenant_id: data.tenant_id,
        category: selectedShipment.load_type,
        material_category: data.material_category,
        quality_grade: data.quality_grade,
        weight_kg: parseFloat(data.weight_kg),
        volume_cubic_feet: parseFloat(data.volume_cubic_feet) || 0,
        volume_cubic_yards: parseFloat(data.volume_cubic_yards) || 0,
        volume_cubic_meters: parseFloat(data.volume_cubic_meters) || 0,
        volume_unit: data.volume_unit,
        contamination_percent: parseFloat(data.contamination_percent),
        contamination_notes: data.contamination_notes,
        color: data.color,
        bin_location: data.bin_location,
        zone: data.zone,
        inspector_name: user?.full_name,
        inspection_date: new Date().toISOString()
      });

      // Step 2: Find matching SKU based on shipment data
      let matchingSKU = null;
      if (selectedShipment.product_category && selectedShipment.product_sub_category && selectedShipment.product_type) {
        matchingSKU = skus.find(sku => 
          sku.category === selectedShipment.product_category &&
          sku.sub_category === selectedShipment.product_sub_category &&
          sku.product_type === selectedShipment.product_type &&
          (sku.purity === selectedShipment.product_purity || sku.purity === 'UNKNOWN' || !selectedShipment.product_purity)
        );
      }

      // Step 3: Create Inventory record
      const weightKg = parseFloat(data.weight_kg);
      const weightLbs = weightKg * 2.20462;
      
      const inventoryData = {
        tenant_id: data.tenant_id,
        material_id: material.id,
        shipment_id: selectedShipment.id,
        vendor_name: selectedShipment.supplier_name,
        sku_number: matchingSKU?.sku_number || selectedShipment.sku_number || '',
        item_name: data.material_category, // Consider using product_type from shipment if available and makes sense
        item_description: `${data.material_category} - Grade ${data.quality_grade}${data.color ? ` - ${data.color}` : ''}`,
        category: selectedShipment.product_category || data.material_category,
        sub_category: selectedShipment.product_sub_category || '',
        product_type: selectedShipment.product_type || '',
        format: selectedShipment.product_format || '',
        purity: selectedShipment.product_purity || 'UNKNOWN',
        quality_grade: data.quality_grade,
        measurement_type: 'weight',
        unit_of_measure: 'kg',
        quantity_on_hand: 1, // This is for one "batch" of classified material
        quantity_kg: weightKg,
        quantity_lbs: weightLbs,
        quantity_volume: parseFloat(data.volume_cubic_feet) || 0, // Store in cubic feet as a standard
        volume_unit: 'cubic_feet', // Standardize to cubic feet for inventory tracking
        bin_location: data.bin_location,
        zone: data.zone,
        sorting_status: 'classified',
        status: 'available',
        received_date: selectedShipment.arrival_time || new Date().toISOString(),
        processed_date: new Date().toISOString(),
        last_updated: new Date().toISOString()
      };

      const inventory = await recims.entities.Inventory.create(inventoryData);

      // Step 4: Update bin capacity if bin is assigned
      if (data.bin_location) {
        const bin = bins.find(b => b.bin_code === data.bin_location);
        if (bin) {
          const updateData = {
            current_weight_kg: (bin.current_weight_kg || 0) + weightKg,
            current_weight_lbs: (bin.current_weight_lbs || 0) + weightLbs,
            material_type: data.material_category, // Update bin's dominant material type
            last_updated: new Date().toISOString()
          };

          if (bin.track_volume) {
            const volumeFeet = parseFloat(data.volume_cubic_feet) || 0;
            const volumeYards = parseFloat(data.volume_cubic_yards) || 0;
            const volumeMeters = parseFloat(data.volume_cubic_meters) || 0;
            
            updateData.current_volume_cubic_feet = (bin.current_volume_cubic_feet || 0) + volumeFeet;
            updateData.current_volume_cubic_yards = (bin.current_volume_cubic_yards || 0) + volumeYards;
            updateData.current_volume_cubic_meters = (bin.current_volume_cubic_meters || 0) + volumeMeters;
          }

          if (bin.status === 'empty') {
            updateData.status = 'available';
          }

          await recims.entities.Bin.update(bin.id, updateData);
        }
      }

      return { 
        material, 
        inventory,
        binData: { 
          bin_location: data.bin_location, 
          zone: data.zone 
        } 
      };
    },
    onSuccess: async (result) => {
      // Update shipment status to 'completed_classification' instead of 'completed'
      await recims.entities.InboundShipment.update(selectedShipment.id, {
        status: 'completed_classification'
      });
      queryClient.invalidateQueries({ queryKey: ['qcPendingShipments'] }); // Invalidate the new query key
      queryClient.invalidateQueries({ queryKey: ['bins'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] }); // Invalidate inventory query
      
      console.log('Classification success - Created inventory:', result.inventory.id);
      setClassifiedBinData(result.binData);
      setClassifiedInventory(result.inventory); // NEW: Store the inventory data
      setShowPrintDialog(true);
    },
    onError: (err) => {
      console.error("Classification error:", err);
      setError(err.message || "Failed to classify material. Please try again.");
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setError(null);
    setCapacityWarning(null);

    console.log('handleSubmit - user object:', user);
    console.log('handleSubmit - user.tenant_id:', user?.tenant_id);

    if (!user?.tenant_id) {
      setError("User tenant information not loaded. Please refresh the page.");
      return;
    }

    if (!selectedShipment) {
      setError("Please select a shipment first");
      return;
    }

    if (!formData.material_category || (!formData.weight_kg && !formData.weight_lbs)) {
      setError("Material category and weight are required");
      return;
    }
    
    if (!formData.bin_location || !formData.zone) {
      setError("Bin location and Zone are required.");
      return;
    }

    const warning = checkBinCapacity(
      formData.bin_location, 
      formData.weight_kg,
      formData.volume_cubic_feet,
      formData.volume_cubic_yards,
      formData.volume_cubic_meters
    );
    
    if (warning) {
      setCapacityWarning(warning);
      return;
    }

    const dataToSubmit = {
      ...formData,
      tenant_id: user.tenant_id
    };
    console.log('handleSubmit - dataToSubmit:', dataToSubmit);

    classifyMaterialMutation.mutate(dataToSubmit);
  };

  const handleConfirmCapacityOverride = () => {
    setCapacityWarning(null);
    classifyMaterialMutation.mutate({
      ...formData,
      tenant_id: user.tenant_id
    });
  };

  const handlePrintQRCode = () => {
    if (classifiedBinData && classifiedInventory) {
      const binParam = encodeURIComponent(classifiedBinData.bin_location);
      const zoneParam = encodeURIComponent(classifiedBinData.zone);
      const skuParam = classifiedInventory.sku_number ? encodeURIComponent(classifiedInventory.sku_number) : '';
      console.log('Navigating to PrintBinQR with:', classifiedBinData.bin_location, classifiedBinData.zone, 'SKU:', skuParam);
      navigate(createPageUrl(`PrintBinQR?bin=${binParam}&zone=${zoneParam}${skuParam ? `&sku=${skuParam}` : ''}`));
    }
  };

  const handleSkipPrint = () => {
    setShowPrintDialog(false);
    setClassifiedBinData(null);
    setClassifiedInventory(null); // NEW: Clear inventory data
    setSelectedShipment(null);
    setFormData({
      material_category: '',
      quality_grade: 'B',
      weight_kg: '',
      weight_lbs: '',
      volume_cubic_feet: '',
      volume_cubic_yards: '',
      volume_cubic_meters: '',
      volume_unit: 'cubic_feet',
      contamination_percent: '0',
      contamination_notes: '',
      color: '',
      bin_location: '',
      zone: ''
    });
  };

  const handleChange = (field, value) => {
    setFormData(prev => {
      let updated = { ...prev, [field]: value };
      
      if (field === 'zone') {
        updated.bin_location = '';
      } else if (field === 'volume_cubic_feet') {
        if (value && parseFloat(value) > 0) {
          updated.volume_cubic_yards = convertVolume(value, 'cubic_feet', 'cubic_yards');
          updated.volume_cubic_meters = convertVolume(value, 'cubic_feet', 'cubic_meters');
        } else {
          updated.volume_cubic_yards = '';
          updated.volume_cubic_meters = '';
        }
      } else if (field === 'volume_cubic_yards') {
        if (value && parseFloat(value) > 0) {
          updated.volume_cubic_feet = convertVolume(value, 'cubic_yards', 'cubic_feet');
          updated.volume_cubic_meters = convertVolume(value, 'cubic_yards', 'cubic_meters');
        } else {
          updated.volume_cubic_feet = '';
          updated.volume_cubic_meters = '';
        }
      } else if (field === 'volume_cubic_meters') {
        if (value && parseFloat(value) > 0) {
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

  const handleBinSuggestionSelected = (binCode, zone) => {
    setFormData(prev => ({
      ...prev,
      bin_location: binCode,
      zone: zone
    }));
    setShowBinSuggestion(false);
  };

  // Get material categories from tenant categories based on shipment load_type
  const availableCategories = React.useMemo(() => {
    if (!selectedShipment || tenantCategories.length === 0) return [];

    const shipmentLoadType = (selectedShipment.load_type || '').toLowerCase();
    const collectCategories = (categories) => {
      const bag = new Set();
      categories.forEach((tc) => {
        if (Array.isArray(tc.sub_categories) && tc.sub_categories.length > 0) {
          tc.sub_categories.forEach((sub) => bag.add(sub));
        } else if (tc.category_name) {
          bag.add(tc.category_name);
        }
      });
      return Array.from(bag);
    };

    const matchingCategories = tenantCategories.filter((tc) => {
      if (!shipmentLoadType || shipmentLoadType === 'mixed') {
        return true;
      }
      return (tc.load_type_mapping || '').toLowerCase() === shipmentLoadType;
    });

    if (matchingCategories.length > 0) {
      return collectCategories(matchingCategories);
    }

    return collectCategories(tenantCategories);
  }, [tenantCategories, selectedShipment]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 via-gray-50 to-gray-100 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
      <div className="sticky top-12 z-40 bg-gradient-to-br from-gray-100 via-gray-50 to-gray-100 py-4 -mt-4 mb-6">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate(createPageUrl("Dashboard"))}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Material Classification</h1>
            <p className="text-sm text-gray-600">Grade and categorize incoming materials</p>
          </div>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {capacityWarning && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Bin Capacity Exceeded!</strong>
            <div className="mt-2 space-y-2">
              <p className="font-semibold">Bin: {capacityWarning.binCode}</p>
              
              {capacityWarning.violations.map((violation, idx) => (
                <div key={idx} className="p-3 bg-white rounded border-2 border-red-300">
                  <p className="font-semibold text-red-900 mb-2">
                    {violation.type === 'weight' ? '⚖️ Weight Limit Exceeded' : '📦 Volume Limit Exceeded'}
                  </p>
                  <div className="space-y-1 text-sm">
                    <p>• Current: <strong>{violation.currentValue.toFixed(2)} {violation.unit}</strong></p>
                    <p>• Max Capacity: <strong>{violation.maxCapacity.toFixed(2)} {violation.unit}</strong></p>
                    <p>• Available Space: <strong>{violation.availableCapacity.toFixed(2)} {violation.unit}</strong></p>
                    <p>• Trying to Add: <strong>{violation.valueToAdd.toFixed(2)} {violation.unit}</strong></p>
                    <p className="text-red-600 font-bold">• Exceeds by: <strong>{violation.exceededBy.toFixed(2)} {violation.unit}</strong></p>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-4 space-y-2">
              <p className="font-semibold">Do you want to proceed at your own risk?</p>
              <div className="flex gap-3">
                <Button
                  onClick={handleConfirmCapacityOverride}
                  variant="destructive"
                  size="sm"
                >
                  Yes, Proceed Anyway
                </Button>
                <Button
                  onClick={() => setCapacityWarning(null)}
                  variant="outline"
                  size="sm"
                >
                  No, Choose Another Bin
                </Button>
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {!selectedShipment && (
        <Card className={`mb-6 ${neumorph.card} ${neumorph.rounded}`}>
          <CardHeader>
            <CardTitle>Select Shipment to Classify</CardTitle>
          </CardHeader>
          <CardContent>
            {pendingShipments.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No pending shipments to classify</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingShipments.map((shipment) => (
                  <div
                    key={shipment.id}
                    onClick={() => {
                      setSelectedShipment(shipment);
                      // Prefill weight and volume from shipment
                      const netWeightLbs = shipment.net_weight_lbs || shipment.net_weight || 0;
                      const netWeightKg = (netWeightLbs / 2.20462).toFixed(2);
                      setFormData(prev => ({
                        ...prev,
                        weight_kg: netWeightKg,
                        weight_lbs: netWeightLbs.toFixed(2),
                        volume_cubic_feet: shipment.volume_cubic_feet || '',
                        volume_cubic_yards: shipment.volume_cubic_yards || '',
                        volume_cubic_meters: shipment.volume_cubic_meters || '',
                        volume_unit: shipment.volume_unit || 'cubic_feet'
                      }));
                    }}
                    className="p-4 border rounded-lg hover:border-green-500 hover:bg-green-50 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold">{shipment.load_id}</p>
                        <p className="text-sm text-gray-600">
                          {shipment.supplier_name} • {shipment.truck_number}
                        </p>
                      </div>
                      <Badge className="bg-blue-100 text-blue-800">
                        {shipment.load_type}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {selectedShipment && (
        <form onSubmit={handleSubmit}>
          <Card className={`mb-6 border-green-200 bg-green-50 ${neumorph.rounded}`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{selectedShipment.load_id}</p>
                  <p className="text-sm text-gray-600">
                    {selectedShipment.supplier_name} • {selectedShipment.load_type}
                  </p>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-gray-500">Gross:</span> <strong>{((selectedShipment.gross_weight_lbs || selectedShipment.gross_weight || 0)).toFixed(2)} lbs</strong>
                    </div>
                    <div>
                      <span className="text-gray-500">Tare:</span> <strong>{((selectedShipment.tare_weight_lbs || selectedShipment.tare_weight || 0)).toFixed(2)} lbs</strong>
                    </div>
                    <div>
                      <span className="text-gray-500">Net:</span> <strong>{((selectedShipment.net_weight_lbs || selectedShipment.net_weight || 0)).toFixed(2)} lbs</strong>
                    </div>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedShipment(null);
                    setFormData({
                      material_category: '',
                      quality_grade: 'B',
                      weight_kg: '',
                      volume_cubic_feet: '',
                      volume_cubic_yards: '',
                      volume_cubic_meters: '',
                      volume_unit: 'cubic_feet',
                      contamination_percent: '0',
                      contamination_notes: '',
                      color: '',
                      bin_location: '',
                      zone: ''
                    });
                  }}
                >
                  Change
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className={`mb-6 ${neumorph.card} ${neumorph.rounded}`}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5" />
                Material Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="category">Material Category *</Label>
                  <Select
                    value={formData.material_category}
                    onValueChange={(value) => handleChange('material_category', value)}
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

                <div className="space-y-2">
                  <Label htmlFor="weight">Weight ({weightUnit}) *</Label>
                  <Input
                    id="weight"
                    type="number"
                    step="0.01"
                    value={useMetric ? formData.weight_kg : formData.weight_lbs}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (useMetric) {
                        handleChange('weight_kg', value);
                        handleChange('weight_lbs', value ? (parseFloat(value) * 2.20462).toFixed(2) : '');
                      } else {
                        handleChange('weight_lbs', value);
                        handleChange('weight_kg', value ? (parseFloat(value) / 2.20462).toFixed(2) : '');
                      }
                    }}
                    placeholder="0.00"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contamination">Contamination %</Label>
                  <Input
                    id="contamination"
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={formData.contamination_percent}
                    onChange={(e) => handleChange('contamination_percent', e.target.value)}
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="color">Color</Label>
                  <Input
                    id="color"
                    value={formData.color}
                    onChange={(e) => handleChange('color', e.target.value)}
                    placeholder="e.g., Clear, White, Blue"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={`mb-6 border-indigo-200 bg-indigo-50 ${neumorph.rounded}`}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Boxes className="w-5 h-5 text-indigo-600" />
                Volume Measurement
                <Badge className="bg-indigo-600 text-white text-xs">PHASE III</Badge>
              </CardTitle>
              <p className="text-sm text-indigo-900">
                Enter volume in any unit - other units auto-calculate
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Primary Volume Unit (for display)</Label>
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
              
              <p className="text-xs text-indigo-700">
                💡 Auto-conversion: Enter any field and the others calculate automatically
              </p>
            </CardContent>
          </Card>

          <Card className={`mb-6 ${neumorph.card} ${neumorph.rounded}`}>
            <CardHeader>
              <CardTitle>Storage Location</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="zone">Zone *</Label>
                  <Select
                    value={formData.zone}
                    onValueChange={(value) => {
                      handleChange('zone', value);
                      handleChange('bin_location', '');
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select zone" />
                    </SelectTrigger>
                    <SelectContent>
                      {zones.length === 0 ? (
                        <SelectItem value="no-zones-available" disabled>No zones available</SelectItem>
                      ) : (
                        zones.map((zone) => (
                          <SelectItem key={zone.id} value={zone.zone_code}>
                            {zone.zone_code} - {zone.zone_name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bin">Bin Location *</Label>
                  <Select
                    value={formData.bin_location}
                    onValueChange={(value) => handleChange('bin_location', value)}
                    disabled={!formData.zone}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={formData.zone ? "Select bin" : "Select zone first"} />
                    </SelectTrigger>
                    <SelectContent>
                      {bins.filter(b => b.zone === formData.zone).length === 0 ? (
                        <SelectItem value="no-bins-available" disabled>No bins available in this zone</SelectItem>
                      ) : (
                        bins
                          .filter(b => b.zone === formData.zone)
                          .map((bin) => (
                            <SelectItem key={bin.id} value={bin.bin_code}>
                              <div className="flex items-center gap-2">
                                <div 
                                  className="w-3 h-3 rounded-full border" 
                                  style={{ backgroundColor: bin.bin_color || '#10b981' }}
                                />
                                {bin.bin_code}
                              </div>
                            </SelectItem>
                          ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {bins.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowBinSuggestion(!showBinSuggestion)}
                  className="w-full gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  {showBinSuggestion ? 'Hide' : 'Show'} AI Bin Suggestions
                </Button>
              )}
            </CardContent>
          </Card>

          {showBinSuggestion && formData.material_category && (formData.weight_kg || formData.weight_lbs) && (
            <div className="mb-6">
              <BinLocationSuggestion
                materialType={formData.material_category}
                category={selectedShipment.load_type}
                weightKg={parseFloat(formData.weight_kg) || (parseFloat(formData.weight_lbs) / 2.20462)}
                volumeCubicFeet={parseFloat(formData.volume_cubic_feet) || 0}
                volumeCubicYards={parseFloat(formData.volume_cubic_yards) || 0}
                volumeCubicMeters={parseFloat(formData.volume_cubic_meters) || 0}
                productGrouping="standard"
                bins={bins}
                onSuggestionSelected={handleBinSuggestionSelected}
              />
            </div>
          )}

          <Card className={`mb-6 ${neumorph.card} ${neumorph.rounded}`}>
            <CardHeader>
              <CardTitle>Contamination Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={formData.contamination_notes}
                onChange={(e) => handleChange('contamination_notes', e.target.value)}
                placeholder="Describe any contamination issues (oil, moisture, mixed materials, etc.)"
                rows={4}
              />
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setSelectedShipment(null)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={classifyMaterialMutation.isPending}
              className="flex-1 bg-green-600 hover:bg-green-700 gap-2"
            >
              <Save className="w-4 h-4" />
              {classifyMaterialMutation.isPending ? 'Saving...' : 'Save Classification'}
            </Button>
          </div>
        </form>
      )}

      <Dialog open={showPrintDialog} onOpenChange={setShowPrintDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Material Classified Successfully!</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Material has been classified and <strong>added to inventory</strong> in bin <strong>{classifiedBinData?.bin_location}</strong> in zone <strong>{classifiedBinData?.zone}</strong>
              </AlertDescription>
            </Alert>

            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-900 font-semibold mb-2">
                Would you like to print a QR code label for this bin?
              </p>
              <p className="text-xs text-blue-700">
                The QR code will include the BIN # and ZONE # for easy scanning and identification.
              </p>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={handleSkipPrint}
                className="flex-1"
              >
                Skip for Now
              </Button>
              <Button
                onClick={handlePrintQRCode}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                Print QR Code
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}