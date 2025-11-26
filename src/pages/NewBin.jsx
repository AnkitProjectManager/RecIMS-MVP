import React, { useState } from "react";
import { recims } from "@/api/recimsClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTenant } from "@/components/TenantContext";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Warehouse, Save, ArrowLeft, AlertCircle, CheckCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

export default function NewBin() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { tenantConfig, user } = useTenant();
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  const [formData, setFormData] = useState({
    bin_code: '',
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
      const isImperial = tenantConfig.measurement_system === 'imperial';
      setFormData(prev => ({ ...prev, weight_unit: isImperial ? 'lbs' : 'kg' }));
    }
  }, [tenantConfig]);

  // Fetch existing bins to determine available bin codes
  const { data: existingBins = [] } = useQuery({
    queryKey: ['bins', user?.tenant_id],
    queryFn: async () => {
      if (!user?.tenant_id) return [];
      return await recims.entities.Bin.filter({ tenant_id: user.tenant_id }, 'bin_code');
    },
    enabled: !!user?.tenant_id,
    initialData: [],
  });

  // Fetch zones
  const { data: zones = [] } = useQuery({
    queryKey: ['zones', user?.tenant_id],
    queryFn: async () => {
      if (!user?.tenant_id) return [];
      return await recims.entities.Zone.filter({ tenant_id: user.tenant_id, status: 'active' }, 'zone_code');
    },
    enabled: !!user?.tenant_id,
    initialData: [],
  });

  // Fetch app settings to determine PHASE
  const { data: settings = [] } = useQuery({
    queryKey: ['appSettings'],
    queryFn: () => recims.entities.AppSettings.list(),
    initialData: [],
  });

  // Determine current phase (check if we're in PHASE IV+ or PHASE I-III)
  const isPhaseIVPlus = existingBins.length >= 999 || 
    settings.some(s => s.setting_key === 'enable_phase_iv' && s.setting_value === 'true');

  // Generate available bin codes based on phase
  const availableBinCodes = React.useMemo(() => {
    const existingCodes = new Set(existingBins.map(b => b.bin_code));
    const codes = [];
    
    if (isPhaseIVPlus) {
      // PHASE IV+: BIN-0001 to BIN-9999
      for (let i = 1; i <= 9999; i++) {
        const code = `BIN-${i.toString().padStart(4, '0')}`;
        if (!existingCodes.has(code)) {
          codes.push(code);
        }
      }
    } else {
      // PHASE I-III: BIN-001 to BIN-999
      for (let i = 1; i <= 999; i++) {
        const code = `BIN-${i.toString().padStart(3, '0')}`;
        if (!existingCodes.has(code)) {
          codes.push(code);
        }
      }
    }
    
    return codes;
  }, [existingBins, isPhaseIVPlus]);

  // Weight conversion helpers
  const convertKgToLbs = (kg) => {
    if (!kg || kg === '' || kg === '0') return '';
    return (parseFloat(kg) * 2.20462).toFixed(2);
  };

  const convertLbsToKg = (lbs) => {
    if (!lbs || lbs === '' || lbs === '0') return '';
    return (parseFloat(lbs) / 2.20462).toFixed(2);
  };

  const createBinMutation = useMutation({
    mutationFn: async (data) => {
      return await recims.entities.Bin.create({
        ...data,
        tenant_id: user?.tenant_id,
        qr_code: data.bin_code,
        last_updated: new Date().toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bins'] });
      setSuccess("Bin created successfully! Redirecting...");
      setTimeout(() => {
        navigate(createPageUrl("BinManagement"));
      }, 1500);
    },
    onError: (err) => {
      setError(err.message || "Failed to create bin. Please try again.");
      setTimeout(() => setError(null), 5000);
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!formData.bin_code) {
      setError("Please select a bin code");
      setTimeout(() => setError(null), 3000);
      return;
    }

    if (!formData.zone) {
      setError("Please select a zone");
      setTimeout(() => setError(null), 3000);
      return;
    }

    // Validate at least one capacity is set
    const hasWeightCapacity = formData.track_weight && 
      (formData.max_weight_kg || formData.max_weight_lbs);
    const hasVolumeCapacity = formData.track_volume && 
      (formData.max_volume_cubic_feet || formData.max_volume_cubic_yards || formData.max_volume_cubic_meters);

    if (!hasWeightCapacity && !hasVolumeCapacity) {
      setError("Please set at least one capacity limit (weight or volume)");
      setTimeout(() => setError(null), 3000);
      return;
    }

    const binData = {
      bin_code: formData.bin_code,
      bin_description: formData.bin_description,
      bin_color: formData.bin_color,
      zone: formData.zone,
      material_type: formData.material_type,
      track_weight: formData.track_weight,
      track_volume: formData.track_volume,
      weight_unit: formData.weight_unit,
      volume_unit: formData.volume_unit,
      status: formData.status,
      // Weight capacities
      max_weight_kg: formData.track_weight && formData.max_weight_kg ? parseFloat(formData.max_weight_kg) : null,
      max_weight_lbs: formData.track_weight && formData.max_weight_lbs ? parseFloat(formData.max_weight_lbs) : null,
      current_weight_kg: 0,
      current_weight_lbs: 0,
      // Volume capacities
      max_volume_cubic_feet: formData.track_volume && formData.max_volume_cubic_feet ? parseFloat(formData.max_volume_cubic_feet) : null,
      max_volume_cubic_yards: formData.track_volume && formData.max_volume_cubic_yards ? parseFloat(formData.max_volume_cubic_yards) : null,
      max_volume_cubic_meters: formData.track_volume && formData.max_volume_cubic_meters ? parseFloat(formData.max_volume_cubic_meters) : null,
      current_volume_cubic_feet: 0,
      current_volume_cubic_yards: 0,
      current_volume_cubic_meters: 0
    };

    createBinMutation.mutate(binData);
  };

  const handleChange = (field, value) => {
    setFormData(prev => {
      let updated = { ...prev, [field]: value };
      
      // Auto-convert weight fields
      if (field === 'max_weight_kg') {
        updated.max_weight_lbs = convertKgToLbs(value);
      } else if (field === 'max_weight_lbs') {
        updated.max_weight_kg = convertLbsToKg(value);
      }
      
      return updated;
    });
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
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Button
          variant="outline"
          size="icon"
          onClick={() => navigate(createPageUrl("BinManagement"))}
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Create New Bin</h1>
          <p className="text-sm text-gray-600">Add a new storage location with dual-capacity tracking</p>
        </div>
        <Badge className={isPhaseIVPlus ? "bg-purple-600" : "bg-blue-600"}>
          {isPhaseIVPlus ? 'PHASE IV+' : 'PHASE I-III'}
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
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">{success}</AlertDescription>
        </Alert>
      )}

      {/* Info Alert */}
      <Alert className="mb-6 bg-blue-50 border-blue-200">
        <AlertCircle className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-800">
          <strong>{isPhaseIVPlus ? 'PHASE IV+' : 'PHASE I-III'} Bin Format:</strong>
          {isPhaseIVPlus 
            ? ' BIN-0001 to BIN-9999 (up to 9,999 bins available)'
            : ' BIN-001 to BIN-999 (up to 999 bins available)'
          }
          <br />
          <span className="text-sm">
            {availableBinCodes.length} bin code{availableBinCodes.length !== 1 ? 's' : ''} available • 
            {existingBins.length} bin{existingBins.length !== 1 ? 's' : ''} already created
          </span>
        </AlertDescription>
      </Alert>

      <form onSubmit={handleSubmit}>
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Warehouse className="w-5 h-5 text-green-600" />
              Basic Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="bin_code">
                  Bin Code * <span className="text-xs text-gray-500">({isPhaseIVPlus ? 'BIN-XXXX' : 'BIN-XXX'})</span>
                </Label>
                <Select
                  value={formData.bin_code}
                  onValueChange={(value) => handleChange('bin_code', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={availableBinCodes.length > 0 ? "Select bin code" : "No bins available"} />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {availableBinCodes.length === 0 ? (
                      <SelectItem value="none" disabled>
                        All bins have been created
                      </SelectItem>
                    ) : (
                      availableBinCodes.slice(0, 100).map((code) => (
                        <SelectItem key={code} value={code}>
                          {code}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500">
                  {availableBinCodes.length > 100 
                    ? `Showing first 100 of ${availableBinCodes.length} available codes`
                    : `${availableBinCodes.length} code${availableBinCodes.length !== 1 ? 's' : ''} available`
                  }
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="zone">Zone *</Label>
                <Select
                  value={formData.zone}
                  onValueChange={(value) => handleChange('zone', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={zones.length > 0 ? "Select zone" : "No zones available"} />
                  </SelectTrigger>
                  <SelectContent>
                    {zones.length === 0 ? (
                      <SelectItem value="none" disabled>
                        No active zones. Create a zone first.
                      </SelectItem>
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
                  <p className="text-xs text-red-600">
                    You must create at least one zone before creating bins.
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bin_description">Description (up to 256 characters)</Label>
              <Textarea
                id="bin_description"
                value={formData.bin_description}
                onChange={(e) => handleChange('bin_description', e.target.value)}
                placeholder="Describe this bin's location or purpose..."
                rows={2}
                maxLength={256}
              />
              <p className="text-xs text-gray-500">{formData.bin_description.length}/256 characters</p>
            </div>

            <div className="space-y-2">
              <Label>Bin Color (for visual identification)</Label>
              <div className="flex gap-3 items-center">
                <input
                  type="color"
                  value={formData.bin_color}
                  onChange={(e) => handleChange('bin_color', e.target.value)}
                  className="w-16 h-16 cursor-pointer border-2 border-gray-300 rounded"
                />
                <Input
                  value={formData.bin_color}
                  onChange={(e) => handleChange('bin_color', e.target.value)}
                  placeholder="#10b981"
                  className="font-mono flex-1"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Material Type (current contents)</Label>
                <Select
                  value={formData.material_type}
                  onValueChange={(value) => handleChange('material_type', value)}
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
                    <SelectItem value="Aluminum">Aluminum</SelectItem>
                    <SelectItem value="Steel">Steel</SelectItem>
                    <SelectItem value="Copper">Copper</SelectItem>
                    <SelectItem value="Mixed">Mixed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => handleChange('status', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="empty">Empty</SelectItem>
                    <SelectItem value="available">Available</SelectItem>
                    <SelectItem value="reserved">Reserved</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Capacity Configuration */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Dual-Capacity Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Weight Capacity */}
            <div className="p-4 bg-gray-50 rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <Label className="font-semibold">Weight Capacity (Safety/Structural)</Label>
                <Switch
                  checked={formData.track_weight}
                  onCheckedChange={(checked) => handleChange('track_weight', checked)}
                />
              </div>
              
              {formData.track_weight && (
                <div className="space-y-3 pt-2">
                  <div className="space-y-2">
                    <Label>Weight Unit</Label>
                    <Select
                      value={formData.weight_unit}
                      onValueChange={(value) => handleChange('weight_unit', value)}
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
                        onChange={(e) => handleChange('max_weight_kg', e.target.value)}
                        placeholder="e.g., 1000"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Max Weight (lbs)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.max_weight_lbs}
                        onChange={(e) => handleChange('max_weight_lbs', e.target.value)}
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

            {/* Volume Capacity */}
            <div className="p-4 bg-gray-50 rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <Label className="font-semibold">Volume Capacity (Space Optimization)</Label>
                <Switch
                  checked={formData.track_volume}
                  onCheckedChange={(checked) => handleChange('track_volume', checked)}
                />
              </div>
              
              {formData.track_volume && (
                <div className="space-y-3 pt-2">
                  <div className="space-y-2">
                    <Label>Volume Unit</Label>
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
                  
                  <div className="grid md:grid-cols-3 gap-3">
                    <div className="space-y-2">
                      <Label>Max Volume (ft³)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.max_volume_cubic_feet}
                        onChange={(e) => handleChange('max_volume_cubic_feet', e.target.value)}
                        placeholder="e.g., 100"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Max Volume (yd³)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.max_volume_cubic_yards}
                        onChange={(e) => handleChange('max_volume_cubic_yards', e.target.value)}
                        placeholder="e.g., 3.7"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Max Volume (m³)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.max_volume_cubic_meters}
                        onChange={(e) => handleChange('max_volume_cubic_meters', e.target.value)}
                        placeholder="e.g., 2.83"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(createPageUrl("BinManagement"))}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={createBinMutation.isPending || availableBinCodes.length === 0}
            className="flex-1 bg-green-600 hover:bg-green-700 gap-2"
          >
            <Save className="w-4 h-4" />
            {createBinMutation.isPending ? 'Creating...' : 'Create Bin'}
          </Button>
        </div>
      </form>
    </div>
  );
}