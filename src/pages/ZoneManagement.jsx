import React, { useState } from "react";
import { recims } from "@/api/recimsClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTenant } from "@/components/TenantContext";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  MapPin,
  ArrowLeft,
  Plus,
  Edit,
  Save,
  X,
  Trash2,
  Building2,
  Package,
  Eye
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

export default function ZoneManagement() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { tenantConfig, user } = useTenant();
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingZone, setEditingZone] = useState(null);
  const [selectedZone, setSelectedZone] = useState(null);
  const [isZoneDetailsOpen, setIsZoneDetailsOpen] = useState(false);
  const [formData, setFormData] = useState({
    zone_code: '',
    zone_name: '',
    zone_description: '',
    location_type: 'warehouse',
    is_main_hub: false,
    address: '',
    capacity_value: '',
    capacity_unit: 'sq_ft',
    status: 'active',
    phase: 'PHASE I'
  });



  const { data: zones = [] } = useQuery({
    queryKey: ['zones', user?.tenant_id],
    queryFn: async () => {
      if (!user?.tenant_id) return [];
      return await recims.entities.Zone.filter({ tenant_id: user.tenant_id }, 'zone_code');
    },
    enabled: !!user?.tenant_id,
    initialData: [],
  });

  const { data: bins = [] } = useQuery({
    queryKey: ['bins', user?.tenant_id],
    queryFn: async () => {
      if (!user?.tenant_id) return [];
      return await recims.entities.Bin.filter({ tenant_id: user.tenant_id }, 'bin_code');
    },
    enabled: !!user?.tenant_id,
    initialData: [],
  });

  const { data: zoneBins = [] } = useQuery({
    queryKey: ['zoneBins', selectedZone?.zone_code, user?.tenant_id],
    queryFn: async () => {
      if (!selectedZone?.zone_code || !user?.tenant_id) return [];
      return await recims.entities.Bin.filter({
        tenant_id: user.tenant_id,
        zone: selectedZone.zone_code
      }, 'bin_code');
    },
    enabled: !!selectedZone?.zone_code && !!user?.tenant_id,
    initialData: [],
  });

  const { data: settings = [] } = useQuery({
    queryKey: ['appSettings'],
    queryFn: () => recims.entities.AppSettings.list(),
    initialData: [],
  });

  const binTrackingEnabled = settings.find(s => s.setting_key === 'enable_bin_capacity_management')?.setting_value === 'true';

  // Count bins per zone
  const getBinsInZone = (zoneCode) => {
    return bins.filter(bin => bin.zone === zoneCode);
  };

  const handleViewZone = (zone) => {
    setSelectedZone(zone);
    setIsZoneDetailsOpen(true);
  };

  const createZoneMutation = useMutation({
    mutationFn: async (zoneData) => {
      return await recims.entities.Zone.create({
        ...zoneData,
        tenant_id: user.tenant_id,
        created_by: user.email
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['zones'] });
      setSuccess("Zone created successfully");
      setTimeout(() => setSuccess(null), 3000);
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (err) => {
      setError(err.message || "Failed to create zone");
      setTimeout(() => setError(null), 3000);
    }
  });

  const updateZoneMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      return await recims.entities.Zone.update(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['zones'] });
      setSuccess("Zone updated successfully");
      setTimeout(() => setSuccess(null), 3000);
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (err) => {
      setError(err.message || "Failed to update zone");
      setTimeout(() => setError(null), 3000);
    }
  });

  const deleteZoneMutation = useMutation({
    mutationFn: async (id) => {
      return await recims.entities.Zone.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['zones'] });
      setSuccess("Zone deleted successfully");
      setTimeout(() => setSuccess(null), 3000);
    },
    onError: (err) => {
      setError(err.message || "Failed to delete zone");
      setTimeout(() => setError(null), 3000);
    }
  });

  const handleCreateDefault = () => {
    createZoneMutation.mutate({
      zone_code: 'ZONE-001',
      zone_name: 'Main Warehouse',
      zone_description: 'Primary warehouse zone for PHASE I and PHASE II operations',
      location_type: 'warehouse',
      is_main_hub: true,
      status: 'active',
      phase: 'PHASE I'
    });
  };

  const handleEdit = (zone) => {
    setEditingZone(zone.id);
    
    // Parse capacity string (e.g., "5000 sq ft" -> value: 5000, unit: sq_ft)
    let capacityValue = '';
    let capacityUnit = 'sq_ft';
    if (zone.capacity) {
      const match = zone.capacity.match(/^(\d+(?:\.\d+)?)\s*(.+)$/);
      if (match) {
        capacityValue = match[1];
        const unitText = match[2].toLowerCase();
        if (unitText.includes('sq m') || unitText.includes('square m')) capacityUnit = 'sq_m';
        else if (unitText.includes('bin')) capacityUnit = 'bins';
        else if (unitText.includes('pallet')) capacityUnit = 'pallets';
        else capacityUnit = 'sq_ft';
      }
    }
    
    setFormData({
      zone_code: zone.zone_code,
      zone_name: zone.zone_name,
      zone_description: zone.zone_description || '',
      location_type: zone.location_type || 'warehouse',
      is_main_hub: zone.is_main_hub || false,
      address: zone.address || '',
      capacity_value: capacityValue,
      capacity_unit: capacityUnit,
      status: zone.status || 'active',
      phase: zone.phase || 'PHASE I'
    });
    setIsDialogOpen(true);
  };

  const handleSave = () => {
    if (!formData.zone_code || !formData.zone_name) {
      setError("Zone code and name are required");
      setTimeout(() => setError(null), 3000);
      return;
    }

    // Validate zone_code format - must be ZONE-XXX with exactly 3 digits
    const zoneCodeRegex = /^ZONE-\d{3}$/;
    if (!zoneCodeRegex.test(formData.zone_code)) {
      setError("Zone code must be in format ZONE-XXX where XXX is exactly 3 digits (001-999). No letters allowed in the numeric part.");
      setTimeout(() => setError(null), 5000);
      return;
    }
    
    // Validate the numeric part is between 001 and 999
    const numericPart = parseInt(formData.zone_code.split('-')[1]);
    if (numericPart < 1 || numericPart > 999) {
      setError("Zone number must be between 001 and 999");
      setTimeout(() => setError(null), 3000);
      return;
    }

    // Validate capacity if bin tracking is enabled
    if (binTrackingEnabled && !formData.capacity_value) {
      setError("Capacity is required when bin tracking is enabled");
      setTimeout(() => setError(null), 3000);
      return;
    }

    // Build capacity string from value and unit
    let capacity = '';
    if (formData.capacity_value) {
      const unitLabels = {
        sq_ft: 'sq ft',
        sq_m: 'sq m',
        bins: 'bins',
        pallets: 'pallets'
      };
      capacity = `${formData.capacity_value} ${unitLabels[formData.capacity_unit]}`;
    }

    const dataToSave = {
      ...formData,
      capacity
    };

    if (editingZone) {
      updateZoneMutation.mutate({ id: editingZone, data: dataToSave });
    } else {
      createZoneMutation.mutate(dataToSave);
    }
  };

  const handleDelete = (id, zoneName) => {
    if (window.confirm(`Are you sure you want to delete zone "${zoneName}"? This action cannot be undone.`)) {
      deleteZoneMutation.mutate(id);
    }
  };

  const resetForm = () => {
    setEditingZone(null);
    setFormData({
      zone_code: '',
      zone_name: '',
      zone_description: '',
      location_type: 'warehouse',
      is_main_hub: false,
      address: '',
      capacity_value: '',
      capacity_unit: 'sq_ft',
      status: 'active',
      phase: 'PHASE I'
    });
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'active': return 'bg-green-100 text-green-700';
      case 'inactive': return 'bg-gray-100 text-gray-700';
      case 'maintenance': return 'bg-yellow-100 text-yellow-700';
      case 'retired': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
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
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link to={createPageUrl("SuperAdmin")}>
          <Button variant="outline" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <MapPin className="w-7 h-7 text-indigo-600" />
            Zone Management
          </h1>
          <p className="text-sm text-gray-600">Configure warehouse zones for bin organization</p>
        </div>
        <Badge className="bg-blue-600 text-white">PHASE II+</Badge>
        <Button
          onClick={() => {
            resetForm();
            setIsDialogOpen(true);
          }}
          className="bg-indigo-600 hover:bg-indigo-700 gap-2"
        >
          <Plus className="w-4 h-4" />
          Create Zone
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

      {/* Default Zone Setup */}
      {zones.length === 0 && (
        <Card className="mb-6 border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="text-green-900">Quick Setup - Create Default Zone</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-700 mb-4">
              For PHASE I and PHASE II, create the default ZONE-001 for your warehouse:
            </p>
            <Button
              onClick={handleCreateDefault}
              disabled={createZoneMutation.isPending}
              className="bg-green-600 hover:bg-green-700 gap-2"
            >
              <MapPin className="w-4 h-4" />
              Create ZONE-001 (Default)
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Phase Information */}
      <Alert className="mb-6 bg-blue-50 border-blue-200">
        <AlertDescription className="text-blue-800">
          <strong>Zone Limits:</strong>
          <ul className="mt-2 space-y-1 text-sm">
            <li>• <strong>PHASE I & II:</strong> Default ZONE-001 only</li>
            <li>• <strong>PHASE III+:</strong> Up to ZONE-001 through ZONE-999</li>
            <li>• Zone codes must be unique within your warehouse</li>
            <li>• Zone descriptions support up to 256 characters (a-z, A-Z, spaces, punctuation)</li>
          </ul>
        </AlertDescription>
      </Alert>

      {/* Zones List */}
      <Card>
        <CardHeader>
          <CardTitle>Warehouse Zones ({zones.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {zones.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <MapPin className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>No zones created yet</p>
              <p className="text-sm mt-2">Create ZONE-001 to get started</p>
            </div>
          ) : (
            <div className="space-y-3">
              {zones.map((zone) => {
                const zoneBinsList = getBinsInZone(zone.zone_code);
                const binCount = zoneBinsList.length;
                
                return (
                  <div 
                    key={zone.id} 
                    className="p-4 border-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-all"
                    onClick={() => handleViewZone(zone)}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <p className="font-bold text-lg">{zone.zone_code}</p>
                          {zone.is_main_hub && (
                            <Badge className="bg-purple-100 text-purple-700">
                              <Building2 className="w-3 h-3 mr-1" />
                              Main Hub
                            </Badge>
                          )}
                          <Badge className={getStatusColor(zone.status)}>
                            {zone.status}
                          </Badge>
                          <Badge variant="outline">{zone.phase}</Badge>
                          <Badge className="bg-blue-100 text-blue-700">
                            <Package className="w-3 h-3 mr-1" />
                            {binCount} {binCount === 1 ? 'Bin' : 'Bins'}
                          </Badge>
                        </div>
                        <p className="font-semibold text-gray-900 mb-1">{zone.zone_name}</p>
                        {zone.zone_description && (
                          <p className="text-sm text-gray-600 mb-2">{zone.zone_description}</p>
                        )}
                        <div className="grid md:grid-cols-3 gap-2 text-xs text-gray-600">
                          <div>
                            <span className="font-semibold">Type:</span> {zone.location_type}
                          </div>
                          <div>
                            <span className="font-semibold">Bins:</span> {binCount}
                          </div>
                          {zone.capacity && (
                            <div>
                              <span className="font-semibold">Capacity:</span> {zone.capacity}
                            </div>
                          )}
                        </div>
                        {zone.address && (
                          <p className="text-xs text-gray-500 mt-2">{zone.address}</p>
                        )}
                        
                        {/* Display bin codes on the tile */}
                        {binCount > 0 && (
                          <div className="mt-3 pt-3 border-t">
                            <p className="text-xs font-semibold text-gray-700 mb-2">Bins in this zone:</p>
                            <div className="flex flex-wrap gap-1">
                              {zoneBinsList.slice(0, 10).map((bin) => (
                                <Badge key={bin.id} variant="outline" className="text-xs">
                                  {bin.bin_code}
                                </Badge>
                              ))}
                              {binCount > 10 && (
                                <Badge variant="outline" className="text-xs text-gray-500">
                                  +{binCount - 10} more
                                </Badge>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                        <Button
                          onClick={() => handleEdit(zone)}
                          variant="outline"
                          size="sm"
                          className="gap-2"
                        >
                          <Edit className="w-4 h-4" />
                          Edit
                        </Button>
                        <Button
                          onClick={() => handleDelete(zone.id, zone.zone_name)}
                          variant="outline"
                          size="sm"
                          className="border-red-300 text-red-600 hover:bg-red-50 gap-2"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Zone Details Dialog */}
      <Dialog open={isZoneDetailsOpen} onOpenChange={setIsZoneDetailsOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-indigo-600" />
              Zone Details: {selectedZone?.zone_code}
            </DialogTitle>
            <p className="text-sm text-gray-600 mt-1">{selectedZone?.zone_name}</p>
          </DialogHeader>

          <div className="space-y-4">
            {/* Zone Summary */}
            <div className="grid md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="text-xs text-gray-600 mb-1">Status</p>
                <Badge className={getStatusColor(selectedZone?.status)}>
                  {selectedZone?.status}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-gray-600 mb-1">Location Type</p>
                <p className="font-semibold capitalize">{selectedZone?.location_type}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600 mb-1">Phase</p>
                <Badge variant="outline">{selectedZone?.phase}</Badge>
              </div>
              <div>
                <p className="text-xs text-gray-600 mb-1">Total Bins</p>
                <p className="font-bold text-lg text-blue-600">{zoneBins.length}</p>
              </div>
            </div>

            {selectedZone?.zone_description && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-gray-700">{selectedZone.zone_description}</p>
              </div>
            )}

            {/* Bins in this Zone */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Package className="w-5 h-5 text-blue-600" />
                Bins in {selectedZone?.zone_code} ({zoneBins.length})
              </h3>

              {zoneBins.length === 0 ? (
                <div className="text-center py-12 text-gray-500 border rounded-lg">
                  <Package className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p className="font-semibold">No bins in this zone yet</p>
                  <p className="text-sm mt-2">Bins will appear here when assigned to this zone</p>
                  <Link to={createPageUrl("BinManagement")}>
                    <Button className="mt-4 bg-green-600 hover:bg-green-700">
                      Go to Bin Management
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Bin Code</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Description</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Material Type</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Status</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700">Capacity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {zoneBins.map((bin) => {
                        const weightUnit = bin.weight_unit || 'kg';
                        const maxWeight = weightUnit === 'kg' ? bin.max_weight_kg : bin.max_weight_lbs;
                        const currentWeight = weightUnit === 'kg' ? bin.current_weight_kg : bin.current_weight_lbs;
                        const percentage = maxWeight > 0 ? ((currentWeight || 0) / maxWeight * 100).toFixed(1) : 0;

                        return (
                          <tr key={bin.id} className="border-b hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div 
                                  className="w-4 h-4 rounded border"
                                  style={{ backgroundColor: bin.bin_color || '#10b981' }}
                                />
                                <span className="font-semibold text-sm">{bin.bin_code}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <p className="text-sm text-gray-700">{bin.bin_description || '-'}</p>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-sm text-gray-700">{bin.material_type || 'Empty'}</span>
                            </td>
                            <td className="px-4 py-3">
                              <Badge className={
                                bin.status === 'empty' ? 'bg-gray-100 text-gray-700' :
                                bin.status === 'available' ? 'bg-green-100 text-green-700' :
                                bin.status === 'full' ? 'bg-red-100 text-red-700' :
                                bin.status === 'reserved' ? 'bg-blue-100 text-blue-700' :
                                'bg-yellow-100 text-yellow-700'
                              }>
                                {bin.status}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-right">
                              {bin.track_weight !== false && maxWeight ? (
                                <div className="text-sm">
                                  <p className="font-semibold">
                                    {(currentWeight || 0).toFixed(2)} / {maxWeight.toFixed(2)} {weightUnit}
                                  </p>
                                  <p className="text-xs text-gray-500">{percentage}% full</p>
                                </div>
                              ) : (
                                <span className="text-xs text-gray-500">N/A</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-4 border-t">
              <Button
                onClick={() => {
                  setIsZoneDetailsOpen(false);
                  setSelectedZone(null);
                }}
                variant="outline"
                className="flex-1"
              >
                Close
              </Button>
              <Link to={createPageUrl("BinManagement")} className="flex-1">
                <Button className="w-full bg-green-600 hover:bg-green-700 gap-2">
                  <Package className="w-4 h-4" />
                  Manage Bins
                </Button>
              </Link>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-indigo-600" />
              {editingZone ? 'Edit Zone' : 'Create New Zone'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Zone Code * (ZONE-001 to ZONE-999)</Label>
                <Input
                  value={formData.zone_code}
                  onChange={(e) => {
                    let value = e.target.value.toUpperCase();
                    
                    // Remove any non-allowed characters
                    value = value.replace(/[^ZONE\-0-9]/g, '');
                    
                    // Ensure it starts with ZONE-
                    if (!value.startsWith('ZONE-')) {
                      if (value.startsWith('ZONE')) {
                        value = 'ZONE-';
                      } else {
                        value = 'ZONE-' + value.replace('ZONE-', '');
                      }
                    }
                    
                    // Extract the numeric part after ZONE-
                    const parts = value.split('-');
                    if (parts.length > 1) {
                      // Keep only digits and limit to 3 characters
                      const numericPart = parts[1].replace(/\D/g, '').slice(0, 3);
                      value = 'ZONE-' + numericPart;
                    }
                    
                    setFormData({ ...formData, zone_code: value });
                  }}
                  placeholder="ZONE-001"
                  disabled={!!editingZone}
                  maxLength={8}
                />
                <p className="text-xs text-gray-500">Format: ZONE-XXX (3 digits only, 001-999)</p>
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                    <SelectItem value="retired">Retired</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Zone Name * (up to 256 characters)</Label>
              <Input
                value={formData.zone_name}
                onChange={(e) => setFormData({ ...formData, zone_name: e.target.value })}
                placeholder="e.g., Main Warehouse"
                maxLength={256}
              />
            </div>

            <div className="space-y-2">
              <Label>Description (up to 256 characters)</Label>
              <Textarea
                value={formData.zone_description}
                onChange={(e) => setFormData({ ...formData, zone_description: e.target.value })}
                placeholder="Describe this zone's purpose and location..."
                rows={3}
                maxLength={256}
              />
              <p className="text-xs text-gray-500">{formData.zone_description.length}/256 characters</p>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Location Type</Label>
                <Select
                  value={formData.location_type}
                  onValueChange={(value) => setFormData({ ...formData, location_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="warehouse">Warehouse</SelectItem>
                    <SelectItem value="plant">Plant</SelectItem>
                    <SelectItem value="hub">Hub</SelectItem>
                    <SelectItem value="spoke">Spoke</SelectItem>
                    <SelectItem value="yard">Yard</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Phase</Label>
                <Select
                  value={formData.phase}
                  onValueChange={(value) => setFormData({ ...formData, phase: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PHASE I">PHASE I</SelectItem>
                    <SelectItem value="PHASE II">PHASE II</SelectItem>
                    <SelectItem value="PHASE III">PHASE III</SelectItem>
                    <SelectItem value="PHASE IV">PHASE IV</SelectItem>
                    <SelectItem value="PHASE V">PHASE V</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Address</Label>
              <Input
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Physical address of this zone"
              />
            </div>

            <div className="space-y-2">
              <Label>
                Capacity {binTrackingEnabled && <span className="text-red-600">*</span>}
              </Label>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  type="number"
                  min="1"
                  value={formData.capacity_value}
                  onChange={(e) => setFormData({ ...formData, capacity_value: e.target.value })}
                  placeholder="e.g., 5000"
                  required={binTrackingEnabled}
                />
                <Select
                  value={formData.capacity_unit}
                  onValueChange={(value) => setFormData({ ...formData, capacity_unit: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sq_ft">Square Feet (sq ft)</SelectItem>
                    <SelectItem value="sq_m">Square Metres (sq m)</SelectItem>
                    <SelectItem value="bins"># of Bins</SelectItem>
                    <SelectItem value="pallets"># of Pallets</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-gray-500">
                {binTrackingEnabled 
                  ? "Required when bin tracking is enabled" 
                  : "Optional - specify zone capacity"}
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="is_main_hub"
                checked={formData.is_main_hub}
                onChange={(e) => setFormData({ ...formData, is_main_hub: e.target.checked })}
                className="w-4 h-4"
              />
              <Label htmlFor="is_main_hub" className="cursor-pointer">
                Set as Main Hub (primary processing location)
              </Label>
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
                disabled={createZoneMutation.isPending || updateZoneMutation.isPending}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 gap-2"
              >
                <Save className="w-4 h-4" />
                {editingZone ? 'Update Zone' : 'Create Zone'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}