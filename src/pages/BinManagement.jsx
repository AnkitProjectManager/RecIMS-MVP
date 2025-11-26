import React, { useState } from "react";
import { recims } from "@/api/recimsClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTenant } from "@/components/TenantContext";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Package,
  ArrowLeft,
  Plus,
  Edit,
  Save,
  Trash2,
  Palette,
  Scale,
  Boxes,
  Eye, // Added Eye icon
  ExternalLink // Added ExternalLink icon
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function BinManagement() {
  const queryClient = useQueryClient();
  const { tenantConfig, user } = useTenant();
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const neumorph = {
    base: 'bg-gradient-to-br from-gray-50 to-gray-100 shadow-[8px_8px_16px_#d1d5db,-8px_-8px_16px_#ffffff]',
    card: 'bg-gradient-to-br from-gray-50 to-gray-100 shadow-[8px_8px_16px_#d1d5db,-8px_-8px_16px_#ffffff] border-0',
    button: 'bg-gradient-to-br from-gray-50 to-gray-100 shadow-[4px_4px_8px_#d1d5db,-4px_-4px_8px_#ffffff] hover:shadow-[inset_4px_4px_8px_#d1d5db,inset_-4px_-4px_8px_#ffffff] border-0',
    iconBg: 'bg-gradient-to-br from-gray-100 to-gray-200 shadow-[inset_4px_4px_8px_#d1d5db,inset_-4px_-4px_8px_#ffffff]',
    cardHover: 'hover:shadow-[inset_4px_4px_8px_#d1d5db,inset_-4px_-4px_8px_#ffffff] transition-all',
    rounded: 'rounded-2xl',
    roundedLg: 'rounded-3xl'
  };
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isContentsDialogOpen, setIsContentsDialogOpen] = useState(false);
  const [selectedBinForContents, setSelectedBinForContents] = useState(null);
  const [editingBin, setEditingBin] = useState(null);
  const [formData, setFormData] = useState({
    bin_digits: '',
    bin_description: '',
    bin_color: '#10b981',
    zone: '',
    material_type: 'Empty',
    track_weight: true,
    track_volume: false,
    weight_unit: 'kg',
    volume_unit: 'cubic_feet',
    max_weight_kg: '',
    max_weight_lbs: '',
    max_volume_cubic_feet: '',
    max_volume_cubic_yards: '',
    max_volume_cubic_meters: '',
    status: 'empty'
  });

  React.useEffect(() => {
    if (tenantConfig) {
      const isMetric = tenantConfig.unit_system === 'METRIC';
      setFormData(prev => ({ ...prev, weight_unit: isMetric ? 'kg' : 'lbs' }));
    }
  }, [tenantConfig]);

  const convertKgToLbs = (kg) => {
    if (!kg || kg === '' || kg === '0') return '';
    return (parseFloat(kg) * 2.20462).toFixed(2);
  };

  const convertLbsToKg = (lbs) => {
    if (!lbs || lbs === '' || lbs === '0') return '';
    return (parseFloat(lbs) / 2.20462).toFixed(2);
  };

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

  const { data: bins = [] } = useQuery({
    queryKey: ['bins', user?.tenant_id],
    queryFn: async () => {
      if (!user?.tenant_id) return [];
      return await recims.entities.Bin.filter({ tenant_id: user.tenant_id }, 'bin_code');
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
      }, 'zone_code');
    },
    enabled: !!user?.tenant_id,
    initialData: [],
  });

  // Query for bin contents
  const { data: binContents = [], isLoading: loadingContents } = useQuery({
    queryKey: ['binContents', selectedBinForContents?.bin_code, user?.tenant_id],
    queryFn: async () => {
      if (!selectedBinForContents?.bin_code || !user?.tenant_id) return [];
      const inventory = await recims.entities.Inventory.filter({
        bin_location: selectedBinForContents.bin_code,
        tenant_id: user.tenant_id,
        status: 'available'
      }, '-created_date');
      return inventory;
    },
    enabled: !!selectedBinForContents?.bin_code && !!user?.tenant_id,
    initialData: [],
  });

  const determinePhase = () => {
    if (bins.length >= 999) return 'PHASE_III_PLUS';
    return 'PHASE_I_II';
  };

  const currentPhase = determinePhase();
  const maxDigits = currentPhase === 'PHASE_III_PLUS' ? 4 : 3;
  const maxBins = currentPhase === 'PHASE_III_PLUS' ? 9999 : 999;

  const createBinMutation = useMutation({
    mutationFn: async (binData) => {
      return await recims.entities.Bin.create({
        ...binData,
        tenant_id: user.tenant_id,
        qr_code: binData.bin_code,
        last_updated: new Date().toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bins'] });
      setSuccess("Bin created successfully");
      setTimeout(() => setSuccess(null), 3000);
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (err) => {
      setError(err.message || "Failed to create bin");
      setTimeout(() => setError(null), 3000);
    }
  });

  const updateBinMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      return await recims.entities.Bin.update(id, {
        ...data,
        last_updated: new Date().toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bins'] });
      setSuccess("Bin updated successfully");
      setTimeout(() => setSuccess(null), 3000);
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (err) => {
      setError(err.message || "Failed to update bin");
      setTimeout(() => setError(null), 3000);
    }
  });

  const deleteBinMutation = useMutation({
    mutationFn: async (id) => {
      return await recims.entities.Bin.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bins'] });
      setSuccess("Bin deleted successfully");
      setTimeout(() => setSuccess(null), 3000);
    },
    onError: (err) => {
      setError(err.message || "Failed to delete bin");
      setTimeout(() => setError(null), 3000);
    }
  });

  const handleEdit = (bin) => {
    setEditingBin(bin.id);
    const digits = bin.bin_code.replace('BIN-', '');
    setFormData({
      bin_digits: digits,
      bin_description: bin.bin_description || '',
      bin_color: bin.bin_color || '#10b981',
      zone: bin.zone || '',
      material_type: bin.material_type || 'Empty',
      track_weight: bin.track_weight !== false,
      track_volume: bin.track_volume || false,
      weight_unit: bin.weight_unit || 'kg',
      volume_unit: bin.volume_unit || 'cubic_feet',
      max_weight_kg: bin.max_weight_kg?.toString() || '',
      max_weight_lbs: bin.max_weight_lbs?.toString() || '',
      max_volume_cubic_feet: bin.max_volume_cubic_feet?.toString() || '',
      max_volume_cubic_yards: bin.max_volume_cubic_yards?.toString() || '',
      max_volume_cubic_meters: bin.max_volume_cubic_meters?.toString() || '',
      status: bin.status || 'empty'
    });
    setIsDialogOpen(true);
  };

  const handleViewContents = (bin) => {
    setSelectedBinForContents(bin);
    setIsContentsDialogOpen(true);
  };

  const handleFormChange = (field, value) => {
    setFormData(prev => {
      let updated = { ...prev, [field]: value };
      
      if (field === 'bin_digits') {
        const numericOnly = value.replace(/[^0-9]/g, '');
        updated.bin_digits = numericOnly.slice(0, maxDigits);
      }
      else if (field === 'max_weight_kg') {
        updated.max_weight_lbs = convertKgToLbs(value);
      } else if (field === 'max_weight_lbs') {
        updated.max_weight_kg = convertLbsToKg(value);
      }
      else if (field === 'max_volume_cubic_feet') {
        updated.max_volume_cubic_yards = convertVolume(value, 'cubic_feet', 'cubic_yards');
        updated.max_volume_cubic_meters = convertVolume(value, 'cubic_feet', 'cubic_meters');
      } else if (field === 'max_volume_cubic_yards') {
        updated.max_volume_cubic_feet = convertVolume(value, 'cubic_yards', 'cubic_feet');
        updated.max_volume_cubic_meters = convertVolume(value, 'cubic_yards', 'cubic_meters');
      } else if (field === 'max_volume_cubic_meters') {
        updated.max_volume_cubic_feet = convertVolume(value, 'cubic_meters', 'cubic_feet');
        updated.max_volume_cubic_yards = convertVolume(value, 'cubic_meters', 'cubic_yards');
      }
      
      return updated;
    });
  };

  const handleSave = () => {
    if (!formData.bin_digits || formData.bin_digits.length !== maxDigits) {
      setError(`Please enter exactly ${maxDigits} digits for the bin number`);
      setTimeout(() => setError(null), 3000);
      return;
    }

    const paddedDigits = formData.bin_digits.padStart(maxDigits, '0');
    const binCode = `BIN-${paddedDigits}`;

    const hasWeightCapacity = formData.track_weight && 
      (formData.max_weight_kg || formData.max_weight_lbs);
    const hasVolumeCapacity = formData.track_volume && 
      (formData.max_volume_cubic_feet || formData.max_volume_cubic_yards || formData.max_volume_cubic_meters);

    if (!hasWeightCapacity && !hasVolumeCapacity) {
      setError("Please set at least one capacity limit (weight or volume)");
      setTimeout(() => setError(null), 3000);
      return;
    }

    if (!editingBin) {
      const duplicate = bins.find(b => b.bin_code === binCode);
      if (duplicate) {
        setError(`Bin ${binCode} already exists. Bin codes must be unique.`);
        setTimeout(() => setError(null), 3000);
        return;
      }
    }

    const binData = {
      bin_code: binCode,
      bin_description: formData.bin_description,
      bin_color: formData.bin_color,
      zone: formData.zone,
      material_type: formData.material_type,
      track_weight: formData.track_weight,
      track_volume: formData.track_volume,
      weight_unit: formData.weight_unit,
      volume_unit: formData.volume_unit,
      status: formData.status,
      max_weight_kg: formData.track_weight && formData.max_weight_kg ? parseFloat(formData.max_weight_kg) : null,
      max_weight_lbs: formData.track_weight && formData.max_weight_lbs ? parseFloat(formData.max_weight_lbs) : null,
      current_weight_kg: 0,
      current_weight_lbs: 0,
      max_volume_cubic_feet: formData.track_volume && formData.max_volume_cubic_feet ? parseFloat(formData.max_volume_cubic_feet) : null,
      max_volume_cubic_yards: formData.track_volume && formData.max_volume_cubic_yards ? parseFloat(formData.max_volume_cubic_yards) : null,
      max_volume_cubic_meters: formData.track_volume && formData.max_volume_cubic_meters ? parseFloat(formData.max_volume_cubic_meters) : null,
      current_volume_cubic_feet: 0,
      current_volume_cubic_yards: 0,
      current_volume_cubic_meters: 0
    };

    if (editingBin) {
      updateBinMutation.mutate({ id: editingBin, data: binData });
    } else {
      createBinMutation.mutate(binData);
    }
  };

  const handleDelete = (id, binCode) => {
    if (window.confirm(`Are you sure you want to delete bin "${binCode}"? This action cannot be undone.`)) {
      deleteBinMutation.mutate(id);
    }
  };

  const resetForm = () => {
    setEditingBin(null);
    const isMetric = tenantConfig?.unit_system === 'METRIC';
    setFormData({
      bin_digits: '',
      bin_description: '',
      bin_color: '#10b981',
      zone: '',
      material_type: 'Empty',
      track_weight: true,
      track_volume: false,
      weight_unit: isMetric ? 'kg' : 'lbs',
      volume_unit: 'cubic_feet',
      max_weight_kg: '',
      max_weight_lbs: '',
      max_volume_cubic_feet: '',
      max_volume_cubic_yards: '',
      max_volume_cubic_meters: '',
      status: 'empty'
    });
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'empty': return 'bg-gray-100 text-gray-700';
      case 'available': return 'bg-green-100 text-green-700';
      case 'full': return 'bg-red-100 text-red-700';
      case 'reserved': return 'bg-blue-100 text-blue-700';
      case 'maintenance': return 'bg-yellow-100 text-yellow-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const formatCapacity = (bin) => {
    const capacities = [];
    
    if (bin.track_weight !== false) {
      const weightUnit = bin.weight_unit || 'kg';
      const maxWeight = weightUnit === 'kg' ? bin.max_weight_kg : bin.max_weight_lbs;
      const currentWeight = weightUnit === 'kg' ? bin.current_weight_kg : bin.current_weight_lbs;
      
      if (maxWeight) {
        const percentage = maxWeight > 0 ? ((currentWeight || 0) / maxWeight * 100).toFixed(1) : 0;
        capacities.push({
          type: 'Weight',
          max: `${maxWeight.toFixed(2)} ${weightUnit}`,
          current: `${(currentWeight || 0).toFixed(2)} ${weightUnit}`,
          percentage
        });
      }
    }
    
    if (bin.track_volume) {
      const volumeUnit = bin.volume_unit || 'cubic_feet';
      const unitDisplay = volumeUnit === 'cubic_feet' ? 'ft³' : 
                         volumeUnit === 'cubic_yards' ? 'yd³' : 'm³';
      
      let maxVolume = 0;
      let currentVolume = 0;
      
      if (volumeUnit === 'cubic_feet') {
        maxVolume = bin.max_volume_cubic_feet;
        currentVolume = bin.current_volume_cubic_feet || 0;
      } else if (volumeUnit === 'cubic_yards') {
        maxVolume = bin.max_volume_cubic_yards;
        currentVolume = bin.current_volume_cubic_yards || 0;
      } else {
        maxVolume = bin.max_volume_cubic_meters;
        currentVolume = bin.current_volume_cubic_meters || 0;
      }
      
      if (maxVolume) {
        const percentage = maxVolume > 0 ? (currentVolume / maxVolume * 100).toFixed(1) : 0;
        capacities.push({
          type: 'Volume',
          max: `${maxVolume.toFixed(2)} ${unitDisplay}`,
          current: `${currentVolume.toFixed(2)} ${unitDisplay}`,
          percentage
        });
      }
    }
    
    return capacities;
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 via-gray-50 to-gray-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link to={createPageUrl("SuperAdmin")}>
          <Button variant="outline" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Package className="w-7 h-7 text-green-600" />
            Bin Management
          </h1>
          <p className="text-sm text-gray-600">Configure dual-capacity bins (weight + volume)</p>
        </div>
        <Badge className="bg-green-600 text-white">
          {bins.length}/{maxBins} Bins
        </Badge>
        <Badge className="bg-blue-600 text-white">
          {currentPhase === 'PHASE_III_PLUS' ? 'PHASE III+' : 'PHASE I/II'}
        </Badge>
        <Button
          onClick={() => {
            resetForm();
            setIsDialogOpen(true);
          }}
          className="bg-green-600 hover:bg-green-700 gap-2"
          disabled={bins.length >= maxBins}
        >
          <Plus className="w-4 h-4" />
          Create Bin
        </Button>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="mb-6 bg-green-50 border-green-200">
          <AlertDescription className="text-green-800">{success}</AlertDescription>
        </Alert>
      )}

      <Alert className="mb-6 bg-blue-50 border-blue-200">
        <AlertDescription className="text-blue-800">
          <strong>Current Phase: {currentPhase === 'PHASE_III_PLUS' ? 'PHASE III+' : 'PHASE I/II'}</strong>
          <ul className="mt-2 space-y-1 text-sm">
            <li>• <strong>Bin Format:</strong> {currentPhase === 'PHASE_III_PLUS' ? 'BIN-0001 to BIN-9999 (4 digits)' : 'BIN-001 to BIN-999 (3 digits)'}</li>
            <li>• <strong>Max Bins:</strong> {maxBins} bins supported in this phase</li>
            <li>• <strong>Weight Limit:</strong> Ensures safety and structural integrity (kg or lbs)</li>
            <li>• <strong>Volume Limit:</strong> Optimizes space usage (ft³, yd³, or m³)</li>
            <li>• <strong>Hybrid Model:</strong> Set BOTH limits or just one based on your needs</li>
          </ul>
        </AlertDescription>
      </Alert>

      {bins.length >= 10 && bins.length < 999 && (
        <Alert className="mb-6 bg-yellow-50 border-yellow-200">
          <AlertDescription className="text-yellow-800">
            You have {bins.length} bins defined. PHASE I/II supports up to 999 bins. Upgrade to PHASE III for up to 9999 bins.
          </AlertDescription>
        </Alert>
      )}

      <Card className={`${neumorph.card} ${neumorph.roundedLg}`}>
        <CardHeader>
          <CardTitle>Storage Bins ({bins.length})</CardTitle>
          <p className="text-sm text-gray-600 mt-1">Click on a bin to view its contents</p>
        </CardHeader>
        <CardContent>
          {bins.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Package className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>No bins created yet</p>
              <p className="text-sm mt-2">Create your first bin to get started</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {bins.map((bin) => {
                const capacities = formatCapacity(bin);
                return (
                  <div 
                    key={bin.id} 
                    className={`p-4 ${neumorph.base} ${neumorph.rounded} ${neumorph.cardHover} cursor-pointer`}
                    onClick={() => handleViewContents(bin)}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-12 h-12 rounded-lg border-2 border-gray-300 flex items-center justify-center"
                          style={{ backgroundColor: bin.bin_color || '#10b981' }}
                        >
                          <Package className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <p className="font-bold text-lg">{bin.bin_code}</p>
                          <Badge className={getStatusColor(bin.status)} size="sm">
                            {bin.status}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    {bin.bin_description && (
                      <p className="text-sm text-gray-600 mb-3">{bin.bin_description}</p>
                    )}

                    <div className="space-y-2 text-xs text-gray-600 mb-3">
                      {bin.zone && (
                        <div>
                          <span className="font-semibold">Zone:</span> {bin.zone}
                        </div>
                      )}
                      
                      {capacities.map((cap, idx) => (
                        <div key={idx} className="p-2 bg-gray-50 rounded">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold flex items-center gap-1">
                              {cap.type === 'Weight' ? <Scale className="w-3 h-3" /> : <Boxes className="w-3 h-3" />}
                              {cap.type}:
                            </span>
                            <span className="text-xs">{cap.percentage}%</span>
                          </div>
                          <div className="text-xs">
                            <div>Max: {cap.max}</div>
                            <div>Current: {cap.current}</div>
                          </div>
                        </div>
                      ))}
                      
                      <div>
                        <span className="font-semibold">Material:</span> {bin.material_type}
                      </div>
                    </div>

                    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                      <Button
                        onClick={() => handleEdit(bin)}
                        variant="outline"
                        size="sm"
                        className="flex-1 gap-2"
                      >
                        <Edit className="w-3 h-3" />
                        Edit
                      </Button>
                      <Button
                        onClick={() => handleDelete(bin.id, bin.bin_code)}
                        variant="outline"
                        size="sm"
                        className="border-red-300 text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bin Contents Dialog */}
      <Dialog open={isContentsDialogOpen} onOpenChange={setIsContentsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-green-600" />
              Bin Contents: {selectedBinForContents?.bin_code}
            </DialogTitle>
            <p className="text-sm text-gray-600 mt-1">
              {selectedBinForContents?.zone && `Zone: ${selectedBinForContents.zone} • `}
              {selectedBinForContents?.bin_description}
            </p>
          </DialogHeader>

          <div className="space-y-4">
            {/* Bin Summary - FIXED: Calculate actual weight from inventory items */}
            <div className="grid md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="text-xs text-gray-600 mb-1">Status</p>
                <Badge className={getStatusColor(selectedBinForContents?.status)}>
                  {selectedBinForContents?.status}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-gray-600 mb-1">Material Type</p>
                <p className="font-semibold">{selectedBinForContents?.material_type || 'Empty'}</p>
              </div>
              {selectedBinForContents?.track_weight !== false && selectedBinForContents?.max_weight_kg && (
                <div>
                  <p className="text-xs text-gray-600 mb-1">Weight Capacity</p>
                  <p className="font-semibold">
                    {binContents.reduce((sum, i) => sum + (i.quantity_kg || 0), 0).toFixed(2)} / {selectedBinForContents?.max_weight_kg?.toFixed(2)} kg
                    <span className="ml-2 text-xs font-normal text-gray-600">
                      ({((binContents.reduce((sum, i) => sum + (i.quantity_kg || 0), 0) / selectedBinForContents?.max_weight_kg) * 100).toFixed(1)}%)
                    </span>
                  </p>
                </div>
              )}
            </div>

            {/* Alert for read-only */}
            <Alert className="bg-blue-50 border-blue-200">
              <AlertDescription className="text-blue-800 text-sm">
                <strong>Read-Only View:</strong> To update inventory quantities or move items between bins, please use the 
                <Link to={createPageUrl("InventoryManagement")} className="font-semibold underline ml-1">
                  Inventory Management
                </Link> page.
              </AlertDescription>
            </Alert>

            {/* Inventory Items */}
            {loadingContents ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
                <p className="mt-4 text-gray-600">Loading contents...</p>
              </div>
            ) : binContents.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Package className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="font-semibold">This bin is empty</p>
                <p className="text-sm mt-2">No inventory items are currently stored in this bin</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-900">
                    Inventory Items ({binContents.length})
                  </h3>
                  <Link to={createPageUrl("InventoryManagement")}>
                    <Button variant="outline" size="sm" className="gap-2">
                      <ExternalLink className="w-4 h-4" />
                      Manage in Inventory
                    </Button>
                  </Link>
                </div>

                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">SKU / Item</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Category</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700">Quantity</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700">Weight</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {binContents.map((item) => (
                        <tr key={item.id} className="border-b hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div>
                              <p className="font-semibold text-sm">{item.sku_number || 'N/A'}</p>
                              <p className="text-xs text-gray-600">{item.item_name}</p>
                              {item.purity && (
                                <Badge variant="outline" className="mt-1 text-xs">
                                  {item.purity}
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div>
                              <p className="text-sm font-medium">{item.category}</p>
                              {item.sub_category && (
                                <p className="text-xs text-gray-600">{item.sub_category}</p>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <p className="font-bold text-green-700">
                              {item.quantity_on_hand || 0}
                            </p>
                            <p className="text-xs text-gray-500">{item.unit_of_measure}</p>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <p className="font-semibold text-sm">
                              {tenantConfig?.unit_system === 'IMPERIAL' 
                                ? `${(item.quantity_lbs || 0).toFixed(2)} lbs`
                                : `${(item.quantity_kg || 0).toFixed(2)} kg`
                              }
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <Badge className={
                              item.status === 'available' ? 'bg-green-100 text-green-700' :
                              item.status === 'reserved' ? 'bg-blue-100 text-blue-700' :
                              'bg-gray-100 text-gray-700'
                            }>
                              {item.status}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Summary */}
                <div className="p-4 bg-gray-50 rounded-lg border">
                  <div className="grid md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600 mb-1">Total Items</p>
                      <p className="font-bold text-lg">{binContents.length}</p>
                    </div>
                    <div>
                      <p className="text-gray-600 mb-1">Total Weight</p>
                      <p className="font-bold text-lg">
                        {tenantConfig?.unit_system === 'IMPERIAL'
                          ? `${binContents.reduce((sum, i) => sum + (i.quantity_lbs || 0), 0).toFixed(2)} lbs`
                          : `${binContents.reduce((sum, i) => sum + (i.quantity_kg || 0), 0).toFixed(2)} kg`
                        }
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600 mb-1">Total Value</p>
                      <p className="font-bold text-lg">
                        ${binContents.reduce((sum, i) => sum + (i.total_value || 0), 0).toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-4 border-t">
              <Button
                onClick={() => {
                  setIsContentsDialogOpen(false);
                  setSelectedBinForContents(null);
                }}
                variant="outline"
                className="flex-1"
              >
                Close
              </Button>
              <Link to={createPageUrl("InventoryManagement")} className="flex-1">
                <Button className="w-full bg-green-600 hover:bg-green-700 gap-2">
                  <ExternalLink className="w-4 h-4" />
                  Go to Inventory Management
                </Button>
              </Link>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Existing Dialog for creating/editing bins */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-5 h-5 text-green-600" />
              {editingBin ? 'Edit Bin' : 'Create New Bin'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <Alert className="bg-blue-50 border-blue-200">
              <AlertDescription className="text-blue-800 text-sm">
                <strong>Current Phase: {currentPhase === 'PHASE_III_PLUS' ? 'PHASE III+' : 'PHASE I/II'}</strong>
                <br/>
                • Enter only the last {maxDigits} digits (will be auto-formatted as {currentPhase === 'PHASE_III_PLUS' ? 'BIN-xxxx' : 'BIN-xxx'})
                <br/>
                • Example: {`Enter "${currentPhase === 'PHASE_III_PLUS' ? '0042' : '042'}" → becomes "${currentPhase === 'PHASE_III_PLUS' ? 'BIN-0042' : 'BIN-042'}"`}
                <br/>
                • Bin codes must be unique within your warehouse
              </AlertDescription>
            </Alert>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Bin Number * (Enter {maxDigits} digits)</Label>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-lg text-gray-600">BIN-</span>
                  <Input
                    value={formData.bin_digits}
                    onChange={(e) => handleFormChange('bin_digits', e.target.value)}
                    placeholder={currentPhase === 'PHASE_III_PLUS' ? '0042' : '042'}
                    maxLength={maxDigits}
                    disabled={!!editingBin}
                    className="font-mono text-lg flex-1"
                  />
                </div>
                <p className="text-xs text-gray-600">
                  Will become: <span className="font-mono font-bold">
                    BIN-{formData.bin_digits ? formData.bin_digits.padStart(maxDigits, '0') : (currentPhase === 'PHASE_III_PLUS' ? 'xxxx' : 'xxx')}
                  </span>
                </p>
                {editingBin && (
                  <p className="text-xs text-orange-600">
                    ⚠️ Bin code cannot be changed when editing
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Zone</Label>
                <Select
                  value={formData.zone}
                  onValueChange={(value) => handleFormChange('zone', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select zone" />
                  </SelectTrigger>
                  <SelectContent>
                    {zones.map((zone) => (
                      <SelectItem key={zone.id} value={zone.zone_code}>
                        {zone.zone_code} - {zone.zone_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Bin Description (up to 256 characters)</Label>
              <Textarea
                value={formData.bin_description}
                onChange={(e) => handleFormChange('bin_description', e.target.value)}
                placeholder="Describe this bin's location or purpose..."
                rows={2}
                maxLength={256}
              />
              <p className="text-xs text-gray-500">{formData.bin_description.length}/256 characters</p>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Palette className="w-4 h-4" />
                Bin Color (for visual identification)
              </Label>
              <div className="flex gap-3 items-center">
                <input
                  type="color"
                  value={formData.bin_color}
                  onChange={(e) => handleFormChange('bin_color', e.target.value)}
                  className="w-20 h-20 cursor-pointer border-2 border-gray-300 rounded"
                />
                <div className="flex-1 space-y-2">
                  <Input
                    value={formData.bin_color}
                    onChange={(e) => handleFormChange('bin_color', e.target.value)}
                    placeholder="#10b981"
                    className="font-mono"
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button 
                      type="button" 
                      size="sm" 
                      variant="outline" 
                      onClick={() => handleFormChange('bin_color', '#ef4444')}
                      className="border-red-300 hover:bg-red-50"
                    >
                      🔴 Red
                      <span className="text-xs ml-1 text-gray-500">(High Priority)</span>
                    </Button>
                    <Button 
                      type="button" 
                      size="sm" 
                      variant="outline" 
                      onClick={() => handleFormChange('bin_color', '#3b82f6')}
                      className="border-blue-300 hover:bg-blue-50"
                    >
                      🔵 Blue
                    </Button>
                    <Button 
                      type="button" 
                      size="sm" 
                      variant="outline" 
                      onClick={() => handleFormChange('bin_color', '#10b981')}
                      className="border-green-300 hover:bg-green-50"
                    >
                      🟢 Green
                    </Button>
                    <Button 
                      type="button" 
                      size="sm" 
                      variant="outline" 
                      onClick={() => handleFormChange('bin_color', '#eab308')}
                      className="border-yellow-300 hover:bg-yellow-50"
                    >
                      🟡 Yellow
                      <span className="text-xs ml-1 text-gray-500">(Hazardous)</span>
                    </Button>
                    <Button 
                      type="button" 
                      size="sm" 
                      variant="outline" 
                      onClick={() => handleFormChange('bin_color', '#f97316')}
                      className="border-orange-300 hover:bg-orange-50"
                    >
                      🟠 Orange
                    </Button>
                  </div>
                </div>
              </div>
              <p className="text-xs text-gray-600 mt-1">
                <strong>Color Guide:</strong> Red for high-priority items, Yellow for hazardous materials
              </p>
            </div>

            <div className="border-t pt-4 space-y-4">
              <Label className="text-base font-semibold flex items-center gap-2">
                <Scale className="w-5 h-5" />
                Dual-Capacity Configuration
              </Label>
              <Alert className="bg-blue-50 border-blue-200">
                <AlertDescription className="text-blue-800 text-sm">
                  Set BOTH weight and volume limits for optimal bin management. Products will be validated against both constraints.
                </AlertDescription>
              </Alert>

              <div className="p-4 bg-gray-50 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="font-semibold flex items-center gap-2">
                    <Scale className="w-4 h-4" />
                    Weight Capacity (Safety/Structural)
                  </Label>
                  <Switch
                    checked={formData.track_weight}
                    onCheckedChange={(checked) => handleFormChange('track_weight', checked)}
                  />
                </div>
                
                {formData.track_weight && (
                  <div className="space-y-3 pt-2">
                    <div className="space-y-2">
                      <Label>Weight Unit</Label>
                      <Select
                        value={formData.weight_unit}
                        onValueChange={(value) => handleFormChange('weight_unit', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="kg">Kilograms (kg)</SelectItem>
                          <SelectItem value="lbs">Pounds (lbs)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="grid md:grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Max Weight (kg)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={formData.max_weight_kg}
                          onChange={(e) => handleFormChange('max_weight_kg', e.target.value)}
                          placeholder="e.g., 1000"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Max Weight (lbs)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={formData.max_weight_lbs}
                          onChange={(e) => handleFormChange('max_weight_lbs', e.target.value)}
                          placeholder="e.g., 2204.62"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-blue-600">
                      💡 Auto-conversion: Enter kg or lbs, the other field calculates automatically
                    </p>
                  </div>
                )}
              </div>

              <div className="p-4 bg-gray-50 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="font-semibold flex items-center gap-2">
                    <Boxes className="w-4 h-4" />
                    Volume Capacity (Space Optimization)
                  </Label>
                  <Switch
                    checked={formData.track_volume}
                    onCheckedChange={(checked) => handleFormChange('track_volume', checked)}
                  />
                </div>
                
                {formData.track_volume && (
                  <div className="space-y-3 pt-2">
                    <div className="space-y-2">
                      <Label>Volume Unit</Label>
                      <Select
                        value={formData.volume_unit}
                        onValueChange={(value) => handleFormChange('volume_unit', value)}
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
                    
                    <div className="grid md:grid-cols-3 gap-3">
                      <div className="space-y-2">
                        <Label>Max Volume (ft³)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={formData.max_volume_cubic_feet}
                          onChange={(e) => handleFormChange('max_volume_cubic_feet', e.target.value)}
                          placeholder="e.g., 100"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Max Volume (yd³)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={formData.max_volume_cubic_yards}
                          onChange={(e) => handleFormChange('max_volume_cubic_yards', e.target.value)}
                          placeholder="e.g., 3.7"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Max Volume (m³)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={formData.max_volume_cubic_meters}
                          onChange={(e) => handleFormChange('max_volume_cubic_meters', e.target.value)}
                          placeholder="e.g., 2.83"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-blue-600">
                      💡 Auto-conversion: Enter any volume unit, the others calculate automatically
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => handleFormChange('status', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="empty">Empty</SelectItem>
                    <SelectItem value="available">Available</SelectItem>
                    <SelectItem value="full">Full</SelectItem>
                    <SelectItem value="reserved">Reserved</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Material Type (current contents)</Label>
                <Select
                  value={formData.material_type}
                  onValueChange={(value) => handleFormChange('material_type', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Empty">Empty</SelectItem>
                    <SelectItem value="HDPE">HDPE</SelectItem>
                    <SelectItem value="PET">PET</SelectItem>
                    <SelectItem value="PP">PP</SelectItem>
                    <SelectItem value="PVC">PVC</SelectItem>
                    <SelectItem value="LDPE">LDPE</SelectItem>
                    <SelectItem value="PS">PS</SelectItem>
                    <SelectItem value="Copper">Copper</SelectItem>
                    <SelectItem value="Aluminum">Aluminum</SelectItem>
                    <SelectItem value="Steel">Steel</SelectItem>
                    <SelectItem value="Brass">Brass</SelectItem>
                    <SelectItem value="Mixed_Metal">Mixed Metal</SelectItem>
                    <SelectItem value="Mixed">Mixed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-3 pt-4 border-t">
              <Button
                onClick={() => {
                  setIsDialogOpen(false);
                  resetForm();
                }}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={createBinMutation.isPending || updateBinMutation.isPending}
                className="flex-1 bg-green-600 hover:bg-green-700 gap-2"
              >
                <Save className="w-4 h-4" />
                {editingBin ? 'Update Bin' : 'Create Bin'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}