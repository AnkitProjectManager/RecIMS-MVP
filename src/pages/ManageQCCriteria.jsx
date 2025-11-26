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
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { 
  ArrowLeft, 
  Plus, 
  ClipboardCheck,
  Pencil,
  Trash2,
  Save,
  X,
  AlertCircle,
  Lock
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Material type options by category
const MATERIAL_TYPE_OPTIONS = {
  PLASTICS: [
    { value: "All Resins", label: "All Resins" },
    { value: "Hygroscopic Plastics (Nylon, PET, PC)", label: "Hygroscopic Plastics (Nylon, PET, PC)" },
    { value: "Molded/Extruded Parts", label: "Molded/Extruded Parts" },
    { value: "All Parts", label: "All Parts" },
    { value: "Injection Molded Parts", label: "Injection Molded Parts" },
    { value: "Colored Parts", label: "Colored Parts" },
    { value: "All Structural Parts", label: "All Structural Parts" },
    { value: "Load-Bearing Parts", label: "Load-Bearing Parts" },
    { value: "Precision Parts", label: "Precision Parts" },
    { value: "Chemical Contact Parts", label: "Chemical Contact Parts" },
    { value: "Outdoor Applications", label: "Outdoor Applications" },
    { value: "Polyolefins (PE, PP)", label: "Polyolefins (PE, PP)" },
    { value: "Flame-Rated Parts", label: "Flame-Rated Parts" },
    { value: "Optical/Clear Parts", label: "Optical/Clear Parts" },
    { value: "Films & Packaging", label: "Films & Packaging" },
    { value: "Electrical/Electronic Parts", label: "Electrical/Electronic Parts" },
    { value: "Medical-Grade Plastics", label: "Medical-Grade Plastics" }
  ],
  "PLASTIC-RESINS": [
    { value: "All Resins", label: "All Resins" },
    { value: "Thermoplastics", label: "Thermoplastics" },
    { value: "Thermosets", label: "Thermosets" },
    { value: "Elastomers", label: "Elastomers" },
    { value: "Engineering Plastics", label: "Engineering Plastics" }
  ],
  FERROUS: [
    { value: "All Steel Grades", label: "All Steel Grades" },
    { value: "All Alloys", label: "All Alloys" },
    { value: "All Steel", label: "All Steel" },
    { value: "All Metals", label: "All Metals" },
    { value: "All Products", label: "All Products" },
    { value: "Plates, Bars, Profiles", label: "Plates, Bars, Profiles" },
    { value: "All Structural Steel", label: "All Structural Steel" },
    { value: "Structural/Pressure Vessel Steel", label: "Structural/Pressure Vessel Steel" },
    { value: "Tubes, Sheet, Plate", label: "Tubes, Sheet, Plate" },
    { value: "Heat-Treated Alloys", label: "Heat-Treated Alloys" },
    { value: "Carburized/Nitrided Parts", label: "Carburized/Nitrided Parts" },
    { value: "Machined/Ground Parts", label: "Machined/Ground Parts" },
    { value: "Plated/Coated Parts", label: "Plated/Coated Parts" },
    { value: "Plates, Forgings, Heavy Sections", label: "Plates, Forgings, Heavy Sections" },
    { value: "Welds, Castings, Critical Joints", label: "Welds, Castings, Critical Joints" },
    { value: "Ferromagnetic Materials", label: "Ferromagnetic Materials" },
    { value: "Steel Parts", label: "Steel Parts" },
    { value: "Plated/High-Strength Steel", label: "Plated/High-Strength Steel" },
    { value: "Pressure Vessels, Piping", label: "Pressure Vessels, Piping" },
    { value: "Welded Fabrications", label: "Welded Fabrications" },
    { value: "Machined/Formed Parts", label: "Machined/Formed Parts" },
    { value: "Plates, Profiles, Coils", label: "Plates, Profiles, Coils" },
    { value: "All Production Lots", label: "All Production Lots" }
  ],
  "NON-FERROUS": [
    { value: "Aluminum, Copper, Brass", label: "Aluminum, Copper, Brass" },
    { value: "Austenitic Stainless Steel", label: "Austenitic Stainless Steel" },
    { value: "Non-Magnetic Alloys (SS, Al, Ti)", label: "Non-Magnetic Alloys (SS, Al, Ti)" },
    { value: "Tubing, Bars, Wire", label: "Tubing, Bars, Wire" },
    { value: "Stainless Steel", label: "Stainless Steel" },
    { value: "Aluminum Alloys", label: "Aluminum Alloys" },
    { value: "Copper, Aluminum (Electrical)", label: "Copper, Aluminum (Electrical)" },
    { value: "Copper, Aluminum (Thermal)", label: "Copper, Aluminum (Thermal)" }
  ],
  SPECIALTY: [
    { value: "Duplex SS, Titanium", label: "Duplex SS, Titanium" },
    { value: "Critical/High-Cycle Parts", label: "Critical/High-Cycle Parts" },
    { value: "Precision Parts", label: "Precision Parts" },
    { value: "Fatigue-Critical Parts", label: "Fatigue-Critical Parts" },
    { value: "High-Temperature Alloys", label: "High-Temperature Alloys" },
    { value: "Stainless Steel (for NDE)", label: "Stainless Steel (for NDE)" },
    { value: "Fasteners (Bolts, Screws)", label: "Fasteners (Bolts, Screws)" },
    { value: "High-Purity Applications", label: "High-Purity Applications" },
    { value: "All Production Parts", label: "All Production Parts" }
  ]
};

export default function ManageQCCriteria() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { tenantConfig, user } = useTenant();
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showDialog, setShowDialog] = useState(false);
  const [editingCriteria, setEditingCriteria] = useState(null);
  
  const [formData, setFormData] = useState({
    criteria_name: '',
    material_category: '',
    material_type: '',
    min_purity_percent: '',
    max_contamination_percent: '',
    max_moisture_percent: '',
    visual_inspection_required: true,
    lab_testing_required: false,
    failure_action: 'quarantine',
    notes: ''
  });



  const { data: criteria = [], isLoading } = useQuery({
    queryKey: ['qcCriteria'],
    queryFn: () => recims.entities.QCCriteria.list('-created_date'),
    initialData: [],
  });

  const { data: settings = [] } = useQuery({
    queryKey: ['appSettings'],
    queryFn: () => recims.entities.AppSettings.list(),
    initialData: [],
  });

  // Check if QC Criteria Management is enabled (PHASE V+)
  const qcCriteriaEnabled = settings.find(s => s.setting_key === 'enable_qc_criteria_management')?.setting_value === 'true';

  const createCriteriaMutation = useMutation({
    mutationFn: async (data) => {
      if (editingCriteria) {
        return await recims.entities.QCCriteria.update(editingCriteria.id, data);
      }
      return await recims.entities.QCCriteria.create({
        ...data,
        tenant_id: user?.tenant_id,
        status: 'active',
        min_purity_percent: data.min_purity_percent ? parseFloat(data.min_purity_percent) : null,
        max_contamination_percent: data.max_contamination_percent ? parseFloat(data.max_contamination_percent) : null,
        max_moisture_percent: data.max_moisture_percent ? parseFloat(data.max_moisture_percent) : null
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['qcCriteria'] });
      setSuccess(editingCriteria ? "Criteria updated successfully" : "Criteria created successfully");
      setShowDialog(false);
      resetForm();
      setTimeout(() => setSuccess(null), 3000);
    },
    onError: (err) => {
      setError("Failed to save criteria. Please try again.");
      setTimeout(() => setError(null), 5000);
    }
  });

  const deleteCriteriaMutation = useMutation({
    mutationFn: async (id) => {
      return await recims.entities.QCCriteria.update(id, { status: 'inactive' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['qcCriteria'] });
      setSuccess("Criteria deactivated successfully");
      setTimeout(() => setSuccess(null), 3000);
    },
  });

  const handleEdit = (criterion) => {
    setEditingCriteria(criterion);
    setFormData({
      criteria_name: criterion.criteria_name,
      material_category: criterion.material_category,
      material_type: criterion.material_type || '',
      min_purity_percent: criterion.min_purity_percent || '',
      max_contamination_percent: criterion.max_contamination_percent || '',
      max_moisture_percent: criterion.max_moisture_percent || '',
      visual_inspection_required: criterion.visual_inspection_required,
      lab_testing_required: criterion.lab_testing_required,
      failure_action: criterion.failure_action,
      notes: criterion.notes || ''
    });
    setShowDialog(true);
  };

  const resetForm = () => {
    setFormData({
      criteria_name: '',
      material_category: '',
      material_type: '',
      min_purity_percent: '',
      max_contamination_percent: '',
      max_moisture_percent: '',
      visual_inspection_required: true,
      lab_testing_required: false,
      failure_action: 'quarantine',
      notes: ''
    });
    setEditingCriteria(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError(null);

    if (!formData.criteria_name || !formData.material_category) {
      setError("Criteria name and material category are required");
      return;
    }

    createCriteriaMutation.mutate(formData);
  };

  const handleChange = (field, value) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      
      // Reset material_type when category changes
      if (field === 'material_category') {
        updated.material_type = '';
      }
      
      return updated;
    });
  };

  // Get available material types based on selected category
  const availableMaterialTypes = formData.material_category 
    ? (MATERIAL_TYPE_OPTIONS[formData.material_category] || [])
    : [];

  // MODULE DISABLED - Show locked state
  if (!qcCriteriaEnabled) {
    return (
      <div className="p-4 md:p-8 max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate(createPageUrl("QualityControl"))}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">QC Criteria Management</h1>
            <p className="text-sm text-gray-600">Define quality control standards</p>
          </div>
          <Badge className="bg-purple-600 text-white">PHASE V</Badge>
        </div>

        <Card className="border-2 border-purple-200 bg-purple-50">
          <CardContent className="p-8 text-center">
            <div className="bg-white rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4 border-4 border-purple-200">
              <Lock className="w-10 h-10 text-purple-600" />
            </div>
            <h2 className="text-2xl font-bold text-purple-900 mb-2">
              QC Criteria Management
            </h2>
            <p className="text-purple-700 mb-6 max-w-md mx-auto">
              This advanced feature allows you to define custom quality control criteria with material-specific testing requirements, acceptance thresholds, and automated pass/fail logic.
            </p>
            
            <div className="bg-white rounded-lg p-6 mb-6 text-left max-w-2xl mx-auto border-2 border-purple-200">
              <p className="font-semibold text-purple-900 mb-3">✨ Feature Highlights:</p>
              <ul className="space-y-2 text-sm text-gray-700">
                <li className="flex items-start gap-2">
                  <span className="text-purple-600 font-bold">•</span>
                  <span><strong>Material-Specific Standards:</strong> Define criteria for plastics, metals, and specialty materials</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-600 font-bold">•</span>
                  <span><strong>ASTM/ISO Compliance:</strong> Reference industry-standard testing methods</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-600 font-bold">•</span>
                  <span><strong>Automated QC Validation:</strong> Automatic pass/fail determination based on criteria</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-600 font-bold">•</span>
                  <span><strong>Flexible Testing Requirements:</strong> Visual inspection, lab testing, or both</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-600 font-bold">•</span>
                  <span><strong>Custom Thresholds:</strong> Set purity, contamination, and moisture limits</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-600 font-bold">•</span>
                  <span><strong>Disposition Actions:</strong> Auto-reject, downgrade, reprocess, or quarantine</span>
                </li>
              </ul>
            </div>

            <Alert className="bg-blue-50 border-blue-200 mb-6 max-w-2xl mx-auto">
              <AlertCircle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-900">
                <strong>Available in PHASE V and up.</strong> Contact your administrator to enable this feature, or enable it in Super Admin → Features → Quality Control Criteria Management.
              </AlertDescription>
            </Alert>

            <div className="flex gap-3 justify-center">
              <Button
                onClick={() => navigate(createPageUrl("QualityControl"))}
                variant="outline"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Quality Control
              </Button>
              <Button
                onClick={() => navigate(createPageUrl("SuperAdmin"))}
                className="bg-purple-600 hover:bg-purple-700"
              >
                Go to Super Admin
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Show read-only existing criteria if any */}
        {criteria.filter(c => c.status === 'active').length > 0 && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-gray-400" />
                Existing QC Criteria (Read-Only)
              </CardTitle>
              <p className="text-sm text-gray-600 mt-1">
                These criteria were pre-configured. Enable the module to create or edit criteria.
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {criteria.filter(c => c.status === 'active').slice(0, 5).map((criterion) => (
                  <div key={criterion.id} className="p-4 border rounded-lg bg-gray-50 opacity-75">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <p className="font-bold text-lg">{criterion.criteria_name}</p>
                          <Badge variant="outline">{criterion.material_category}</Badge>
                          {criterion.material_type && (
                            <Badge className="bg-blue-100 text-blue-700 text-xs">
                              {criterion.material_type}
                            </Badge>
                          )}
                        </div>
                        
                        <div className="grid md:grid-cols-3 gap-3 text-sm mb-2">
                          {criterion.min_purity_percent && (
                            <div>
                              <span className="text-gray-500">Min Purity:</span> <span className="font-semibold">{criterion.min_purity_percent}%</span>
                            </div>
                          )}
                          {criterion.max_contamination_percent && (
                            <div>
                              <span className="text-gray-500">Max Contamination:</span> <span className="font-semibold">{criterion.max_contamination_percent}%</span>
                            </div>
                          )}
                          {criterion.max_moisture_percent && (
                            <div>
                              <span className="text-gray-500">Max Moisture:</span> <span className="font-semibold">{criterion.max_moisture_percent}%</span>
                            </div>
                          )}
                        </div>

                        <div className="flex gap-4 text-xs text-gray-600 mt-2">
                          <div className="flex items-center gap-1">
                            {criterion.visual_inspection_required ? '✓' : '✗'} Visual Inspection
                          </div>
                          <div className="flex items-center gap-1">
                            {criterion.lab_testing_required ? '✓' : '✗'} Lab Testing
                          </div>
                          <div>
                            Failure Action: <strong>{criterion.failure_action}</strong>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {criteria.filter(c => c.status === 'active').length > 5 && (
                  <p className="text-sm text-gray-500 text-center pt-2">
                    + {criteria.filter(c => c.status === 'active').length - 5} more criteria available after enabling module
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // MODULE ENABLED - Show full functionality
  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link to={createPageUrl("QualityControl")}>
          <Button variant="outline" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">QC Criteria Management</h1>
          <p className="text-sm text-gray-600">Define quality control standards for plastics and metals</p>
        </div>
        <Badge className="bg-purple-600 text-white">PHASE V</Badge>
        <Button 
          onClick={() => {
            resetForm();
            setShowDialog(true);
          }}
          className="bg-blue-600 hover:bg-blue-700 gap-2"
        >
          <Plus className="w-4 h-4" />
          Create Criteria
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

      <Card>
        <CardHeader>
          <CardTitle>QC Criteria ({criteria.filter(c => c.status === 'active').length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            </div>
          ) : criteria.filter(c => c.status === 'active').length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <ClipboardCheck className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No QC criteria defined</p>
            </div>
          ) : (
            <div className="space-y-3">
              {criteria.filter(c => c.status === 'active').map((criterion) => (
                <div key={criterion.id} className="p-4 border rounded-lg hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <p className="font-bold text-lg">{criterion.criteria_name}</p>
                        <Badge variant="outline">{criterion.material_category}</Badge>
                        {criterion.material_type && (
                          <Badge className="bg-blue-100 text-blue-700 text-xs">
                            {criterion.material_type}
                          </Badge>
                        )}
                      </div>
                      
                      <div className="grid md:grid-cols-3 gap-3 text-sm mb-2">
                        {criterion.min_purity_percent && (
                          <div>
                            <span className="text-gray-500">Min Purity:</span> <span className="font-semibold">{criterion.min_purity_percent}%</span>
                          </div>
                        )}
                        {criterion.max_contamination_percent && (
                          <div>
                            <span className="text-gray-500">Max Contamination:</span> <span className="font-semibold">{criterion.max_contamination_percent}%</span>
                          </div>
                        )}
                        {criterion.max_moisture_percent && (
                          <div>
                            <span className="text-gray-500">Max Moisture:</span> <span className="font-semibold">{criterion.max_moisture_percent}%</span>
                          </div>
                        )}
                      </div>

                      <div className="flex gap-4 text-xs text-gray-600 mt-2">
                        <div className="flex items-center gap-1">
                          {criterion.visual_inspection_required ? '✓' : '✗'} Visual Inspection
                        </div>
                        <div className="flex items-center gap-1">
                          {criterion.lab_testing_required ? '✓' : '✗'} Lab Testing
                        </div>
                        <div>
                          Failure Action: <strong>{criterion.failure_action}</strong>
                        </div>
                      </div>

                      {criterion.notes && (
                        <div className="mt-2 p-2 bg-blue-50 rounded text-xs text-blue-900">
                          <strong>Notes:</strong> {criterion.notes.substring(0, 150)}
                          {criterion.notes.length > 150 && '...'}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleEdit(criterion)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => deleteCriteriaMutation.mutate(criterion.id)}
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

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={(open) => {
        setShowDialog(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingCriteria ? 'Edit QC Criteria' : 'Create QC Criteria'}
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <Alert className="bg-blue-50 border-blue-200">
              <AlertDescription className="text-blue-800 text-sm">
                <strong>Guidelines:</strong> Select material category first, then choose the appropriate material type. 
                Define acceptance criteria (purity, contamination, moisture) and specify testing requirements.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="criteria_name">Criteria Name *</Label>
              <Input
                id="criteria_name"
                value={formData.criteria_name}
                onChange={(e) => handleChange('criteria_name', e.target.value)}
                placeholder="e.g., Raw Material - Melt Flow Index (MFI), Mechanical - Tensile Strength"
                required
              />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="material_category">Material Category *</Label>
                <Select
                  value={formData.material_category}
                  onValueChange={(value) => handleChange('material_category', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PLASTICS">PLASTICS</SelectItem>
                    <SelectItem value="PLASTIC-RESINS">PLASTIC-RESINS</SelectItem>
                    <SelectItem value="FERROUS">FERROUS</SelectItem>
                    <SelectItem value="NON-FERROUS">NON-FERROUS</SelectItem>
                    <SelectItem value="SPECIALTY">SPECIALTY</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="material_type">Material Type</Label>
                <Select
                  value={formData.material_type}
                  onValueChange={(value) => handleChange('material_type', value)}
                  disabled={!formData.material_category}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={
                      formData.material_category 
                        ? "Select material type" 
                        : "Select category first"
                    } />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {availableMaterialTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formData.material_category && (
                  <p className="text-xs text-gray-500">
                    {availableMaterialTypes.length} material types available for {formData.material_category}
                  </p>
                )}
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="min_purity">Min Purity (%)</Label>
                <Input
                  id="min_purity"
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={formData.min_purity_percent}
                  onChange={(e) => handleChange('min_purity_percent', e.target.value)}
                  placeholder="0.0"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="max_contamination">Max Contamination (%)</Label>
                <Input
                  id="max_contamination"
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={formData.max_contamination_percent}
                  onChange={(e) => handleChange('max_contamination_percent', e.target.value)}
                  placeholder="0.0"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="max_moisture">Max Moisture (%)</Label>
                <Input
                  id="max_moisture"
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={formData.max_moisture_percent}
                  onChange={(e) => handleChange('max_moisture_percent', e.target.value)}
                  placeholder="0.0"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <Label htmlFor="visual" className="font-semibold">Visual Inspection Required</Label>
                  <p className="text-xs text-gray-600 mt-1">Visual checks for defects, dimensions, color, surface finish</p>
                </div>
                <Switch
                  id="visual"
                  checked={formData.visual_inspection_required}
                  onCheckedChange={(checked) => handleChange('visual_inspection_required', checked)}
                />
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <Label htmlFor="lab" className="font-semibold">Lab Testing Required</Label>
                  <p className="text-xs text-gray-600 mt-1">Laboratory analysis (ASTM tests, spectroscopy, mechanical properties)</p>
                </div>
                <Switch
                  id="lab"
                  checked={formData.lab_testing_required}
                  onCheckedChange={(checked) => handleChange('lab_testing_required', checked)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="failure_action">Failure Action</Label>
              <Select
                value={formData.failure_action}
                onValueChange={(value) => handleChange('failure_action', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="reject">Reject (scrap material)</SelectItem>
                  <SelectItem value="downgrade">Downgrade (lower grade/price)</SelectItem>
                  <SelectItem value="reprocess">Reprocess (rework/clean)</SelectItem>
                  <SelectItem value="quarantine">Quarantine (hold for review)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Testing Notes & Standards</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => handleChange('notes', e.target.value)}
                placeholder="e.g., ASTM D1238 - Melt flow characteristics. Acceptable range: PP 10-35 g/10min, PE 0.5-50 g/10min"
                rows={4}
              />
              <p className="text-xs text-gray-500">
                Include relevant ASTM/ISO standards, test conditions, acceptable ranges, and critical specifications
              </p>
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
                disabled={createCriteriaMutation.isPending}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                <Save className="w-4 h-4 mr-2" />
                {createCriteriaMutation.isPending ? 'Saving...' : editingCriteria ? 'Update' : 'Create'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}