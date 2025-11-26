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
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { 
  ArrowLeft, 
  Plus, 
  Box,
  Pencil,
  Trash2,
  Save,
  X
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const CONTAINER_TYPES = [
  { code: 'SKID48x48', name: '48" x 48" Wooden Skid', type: 'skid', material: 'Wood' },
  { code: 'GAYLORD48x40x48', name: '48" x 40" x 48" Double Wall Gaylord Box with Lid', type: 'gaylord', material: 'Cardboard', weight_capacity: 1100 },
  { code: 'GAYLORD48x48x36', name: '48" x 40" x 36" 1,100 lb Triple Wall Box with Lid', type: 'gaylord', material: 'Cardboard', weight_capacity: 1100 },
  { code: 'GAYLORD48x40x48BASE', name: '48" x 40" x 48" Double Wall Gaylord Bottom', type: 'gaylord', material: 'Cardboard' },
  { code: 'STEELDRUM10', name: '10 Gallon Steel Drum', type: 'drum', material: 'Steel', capacity_gallons: 10 },
  { code: 'STEELDRUM16', name: '16 Gallon Steel Drum', type: 'drum', material: 'Steel', capacity_gallons: 16 },
  { code: 'STEELDRUM30', name: '30 Gallon Steel Drum', type: 'drum', material: 'Steel', capacity_gallons: 30 },
  { code: 'STEELDRUM55', name: '55 Gallon Steel Drum', type: 'drum', material: 'Steel', capacity_gallons: 55 },
];

export default function ManageContainers() {
  const queryClient = useQueryClient();
  const { user } = useTenant();
  const { toast } = useToast();
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showDialog, setShowDialog] = useState(false);
  const [editingContainer, setEditingContainer] = useState(null);
  
  const [formData, setFormData] = useState({
    container_code: '',
    container_name: '',
    dimensions: '',
    capacity_gallons: '',
    weight_capacity_lbs: '',
    container_type: 'gaylord',
    material: '',
    tare_weight_lbs: '100', // Changed default to '100'
    description: ''
  });

  const { data: containers = [], isLoading } = useQuery({
    queryKey: ['containers'],
    queryFn: () => recims.entities.Container.list('-created_date'),
    initialData: [],
  });

  const createContainerMutation = useMutation({
    mutationFn: async (data) => {
      const tareWeightLbs = data.tare_weight_lbs ? parseFloat(data.tare_weight_lbs) : 100;
      const tareWeightKg = tareWeightLbs * 0.453592;
      
      const containerData = {
        ...data,
        status: 'active',
        capacity_gallons: data.capacity_gallons ? parseFloat(data.capacity_gallons) : null,
        weight_capacity_lbs: data.weight_capacity_lbs ? parseFloat(data.weight_capacity_lbs) : null,
        tare_weight_lbs: tareWeightLbs, // Use calculated tareWeightLbs
        tare_weight_kg: parseFloat(tareWeightKg.toFixed(2)) // Add tare_weight_kg
      };
      
      if (editingContainer) {
        return await recims.entities.Container.update(editingContainer.id, containerData);
      }
      return await recims.entities.Container.create(containerData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['containers'] });
      setSuccess(editingContainer ? "Container updated successfully" : "Container created successfully");
      setShowDialog(false);
      resetForm();
      setTimeout(() => setSuccess(null), 3000);
    },
    onError: (err) => {
      setError("Failed to save container. Please try again.");
      setTimeout(() => setError(null), 3000); // Clear error after 3 seconds
    }
  });

  const deleteContainerMutation = useMutation({
    mutationFn: async (id) => {
      await recims.entities.Container.delete(id);
      return id;
    },
    onSuccess: (deletedId) => {
      queryClient.invalidateQueries({ queryKey: ['containers'] });
      toast({
        title: 'Container deleted',
        description: `Container #${deletedId} has been removed.`,
      });
    },
    onError: (err) => {
      toast({
        title: 'Delete failed',
        description: err?.message || 'Could not delete the container.',
        variant: 'destructive',
      });
    },
  });

  const handleDeleteContainer = async (container) => {
    if (!container?.id) return;
    const confirmed = window.confirm(`Delete ${container.container_code || container.container_name}? This cannot be undone.`);
    if (!confirmed) return;
    try {
      await deleteContainerMutation.mutateAsync(container.id);
    } catch (error) {
      // toast already reports failure
    }
  };

  const handleLoadTemplate = (template) => {
    setFormData({
      container_code: template.code,
      container_name: template.name,
      dimensions: template.code.replace(/[A-Z]/g, '').replace(/x/g, ' x '),
      capacity_gallons: template.capacity_gallons || '',
      weight_capacity_lbs: template.weight_capacity || '',
      container_type: template.type,
      material: template.material,
      tare_weight_lbs: '100', // Changed default to '100'
      description: ''
    });
    setShowDialog(true);
  };

  const handleEdit = (container) => {
    setEditingContainer(container);
    setFormData({
      container_code: container.container_code,
      container_name: container.container_name,
      dimensions: container.dimensions || '',
      capacity_gallons: container.capacity_gallons || '',
      weight_capacity_lbs: container.weight_capacity_lbs || '',
      container_type: container.container_type,
      material: container.material || '',
      tare_weight_lbs: container.tare_weight_lbs?.toString() || '100', // Ensure string for input, default to '100'
      description: container.description || ''
    });
    setShowDialog(true);
  };

  const resetForm = () => {
    setFormData({
      container_code: '',
      container_name: '',
      dimensions: '',
      capacity_gallons: '',
      weight_capacity_lbs: '',
      container_type: 'gaylord',
      material: '',
      tare_weight_lbs: '100', // Changed default to '100'
      description: ''
    });
    setEditingContainer(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError(null);

    if (!formData.container_code || !formData.container_name) {
      setError("Container code and name are required");
      return;
    }
    
    // Validate tare_weight_lbs to be a number if provided
    if (formData.tare_weight_lbs !== '' && isNaN(parseFloat(formData.tare_weight_lbs))) {
      setError("Tare Weight must be a valid number.");
      return;
    }


    createContainerMutation.mutate(formData);
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const getTypeColor = (type) => {
    switch(type) {
      case 'skid': return 'bg-amber-100 text-amber-700 border-amber-300';
      case 'gaylord': return 'bg-blue-100 text-blue-700 border-blue-300';
      case 'drum': return 'bg-purple-100 text-purple-700 border-purple-300';
      default: return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link to={createPageUrl("SuperAdmin")}>
          <Button variant="outline" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Container Management</h1>
          <p className="text-sm text-gray-600">Manage container types and specifications</p>
        </div>
        <Button 
          onClick={() => {
            resetForm();
            setShowDialog(true);
          }}
          className="bg-green-600 hover:bg-green-700 gap-2"
        >
          <Plus className="w-4 h-4" />
          Custom Container
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

      {/* Info Alert about Default Tare Weight */}
      <Alert className="mb-6 bg-blue-50 border-blue-200">
        <AlertDescription className="text-blue-800">
          <strong>Default Tare Weight:</strong> All containers default to 100 lbs tare weight unless specified otherwise.
          Tare weight is automatically converted to kg (1 lb = 0.453592 kg).
        </AlertDescription>
      </Alert>

      {/* Standard Templates */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Standard Container Templates</CardTitle>
          <p className="text-sm text-gray-600 mt-1">Click to add a standard container type</p>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {CONTAINER_TYPES.map((template) => (
              <button
                key={template.code}
                onClick={() => handleLoadTemplate(template)}
                className="p-4 border rounded-lg hover:border-green-500 hover:bg-green-50 text-left transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <Badge variant="outline" className={getTypeColor(template.type)}>
                    {template.type}
                  </Badge>
                  <Box className="w-5 h-5 text-gray-400" />
                </div>
                <p className="font-semibold text-sm mb-1">{template.code}</p>
                <p className="text-xs text-gray-600">{template.name}</p>
                {template.capacity_gallons && (
                  <p className="text-xs text-gray-500 mt-1">Capacity: {template.capacity_gallons} gal</p>
                )}
                {template.weight_capacity && (
                  <p className="text-xs text-gray-500">Weight: {template.weight_capacity} lbs</p>
                )}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Existing Containers */}
      <Card>
        <CardHeader>
          <CardTitle>Configured Containers ({containers.filter(c => c.status === 'active').length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
            </div>
          ) : containers.filter(c => c.status === 'active').length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Box className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No containers configured yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {containers.filter(c => c.status === 'active').map((container) => (
                <div key={container.id} className="p-4 border rounded-lg hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <p className="font-semibold">{container.container_code}</p>
                        <Badge variant="outline" className={getTypeColor(container.container_type)}>
                          {container.container_type}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{container.container_name}</p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-gray-600">
                        {container.dimensions && (
                          <div>
                            <span className="text-gray-500">Dimensions:</span> {container.dimensions}
                          </div>
                        )}
                        {container.capacity_gallons && (
                          <div>
                            <span className="text-gray-500">Capacity:</span> {container.capacity_gallons} gal
                          </div>
                        )}
                        {container.weight_capacity_lbs && (
                          <div>
                            <span className="text-gray-500">Max Weight:</span> {container.weight_capacity_lbs} lbs
                          </div>
                        )}
                        <div>
                          <span className="text-gray-500">Tare:</span> {container.tare_weight_lbs || 100} lbs
                          {container.tare_weight_kg && (
                            <span className="text-gray-400"> ({container.tare_weight_kg} kg)</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleEdit(container)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleDeleteContainer(container)}
                        disabled={deleteContainerMutation.isPending && deleteContainerMutation.variables === container.id}
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={(open) => {
        setShowDialog(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingContainer ? 'Edit Container' : 'Add Container'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="code">Container Code *</Label>
                <Input
                  id="code"
                  value={formData.container_code}
                  onChange={(e) => handleChange('container_code', e.target.value)}
                  placeholder="e.g., GAYLORD48x40x48"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="type">Container Type *</Label>
                <select
                  id="type"
                  value={formData.container_type}
                  onChange={(e) => handleChange('container_type', e.target.value)}
                  className="w-full h-10 px-3 border rounded-md"
                  required
                >
                  <option value="skid">Skid</option>
                  <option value="gaylord">Gaylord Box</option>
                  <option value="drum">Drum</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="name">Container Name *</Label>
                <Input
                  id="name"
                  value={formData.container_name}
                  onChange={(e) => handleChange('container_name', e.target.value)}
                  placeholder="e.g., 48 x 40 x 48 Double Wall Gaylord Box with Lid"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="dimensions">Dimensions</Label>
                <Input
                  id="dimensions"
                  value={formData.dimensions}
                  onChange={(e) => handleChange('dimensions', e.target.value)}
                  placeholder="e.g., 48 x 40 x 48"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="material">Material</Label>
                <Input
                  id="material"
                  value={formData.material}
                  onChange={(e) => handleChange('material', e.target.value)}
                  placeholder="e.g., Cardboard, Steel, Wood"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="capacity">Capacity (gallons)</Label>
                <Input
                  id="capacity"
                  type="number"
                  step="0.1"
                  value={formData.capacity_gallons}
                  onChange={(e) => handleChange('capacity_gallons', e.target.value)}
                  placeholder="For drums"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="weight_capacity">Weight Capacity (lbs)</Label>
                <Input
                  id="weight_capacity"
                  type="number"
                  step="0.1"
                  value={formData.weight_capacity_lbs}
                  onChange={(e) => handleChange('weight_capacity_lbs', e.target.value)}
                  placeholder="Maximum load weight"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tare">Tare Weight (lbs) *</Label>
                <Input
                  id="tare"
                  type="number"
                  step="0.1"
                  value={formData.tare_weight_lbs}
                  onChange={(e) => handleChange('tare_weight_lbs', e.target.value)}
                  placeholder="Empty container weight (default: 100)"
                  required
                />
                <p className="text-xs text-gray-500">
                  Default: 100 lbs (≈ 45.36 kg) | Auto-converts to kg
                </p>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => handleChange('description', e.target.value)}
                  placeholder="Additional notes"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowDialog(false);
                  resetForm();
                }}
                className="flex-1"
              >
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createContainerMutation.isPending}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                <Save className="w-4 h-4 mr-2" />
                {createContainerMutation.isPending ? 'Saving...' : editingContainer ? 'Update' : 'Create'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}