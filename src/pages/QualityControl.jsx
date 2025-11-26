import React, { useState } from "react";
import { recims } from "@/api/recimsClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTenant } from "@/components/TenantContext";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  ClipboardCheck, 
  ArrowLeft, 
  Search, 
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Camera,
  Upload,
  X,
  Save,
  AlertCircle,
  RefreshCw,
  Lock 
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { format } from "date-fns";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import DefectDetection from "@/components/ai/DefectDetection";

export default function QualityControl() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { tenantConfig, user } = useTenant();
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const neumorph = {
    card: 'bg-gradient-to-br from-gray-50 to-gray-100 shadow-[8px_8px_16px_#d1d5db,-8px_-8px_16px_#ffffff] border-0',
    rounded: 'rounded-2xl'
  };
  const [activeTab, setActiveTab] = useState('pending');
  const [selectedShipment, setSelectedShipment] = useState(null);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [photoUrls, setPhotoUrls] = useState([]);
  const fileInputRef = React.useRef(null);
  
  const [aiDefects, setAiDefects] = useState(null);
  
  const [inspectionData, setInspectionData] = useState({
    measured_purity_percent: '',
    measured_contamination_percent: '',
    measured_moisture_percent: '',
    visual_inspection_pass: true,
    visual_inspection_notes: '',
    lab_test_pass: null,
    lab_test_notes: '',
    contaminants_found: [],
    color_observed: '',
    weight_sampled_kg: '',
    overall_result: 'pending',
    disposition: 'pending_review',
    disposition_notes: '',
    downgrade_to_grade: 'N/A'
  });



  const { data: pendingShipments = [] } = useQuery({
    queryKey: ['qcPendingShipments', user?.tenant_id],
    queryFn: async () => {
      if (!user?.tenant_id) return [];
      
      const pending = await recims.entities.InboundShipment.filter({ 
        tenant_id: user.tenant_id,
        status: 'pending_inspection' 
      }, '-created_date', 20);
      
      const arrived = await recims.entities.InboundShipment.filter({ 
        tenant_id: user.tenant_id,
        status: 'arrived' 
      }, '-created_date', 20);
      
      const combined = [...pending, ...arrived].sort((a, b) => 
        new Date(b.created_date) - new Date(a.created_date)
      );
      
      return combined;
    },
    enabled: !!user?.tenant_id,
    initialData: [],
  });

  const { data: rejectedShipments = [] } = useQuery({
    queryKey: ['rejectedShipments', user?.tenant_id],
    queryFn: async () => {
      if (!user?.tenant_id) return [];
      return await recims.entities.InboundShipment.filter({ 
        tenant_id: user.tenant_id,
        status: 'rejected' 
      }, '-updated_date', 50);
    },
    enabled: !!user?.tenant_id,
    initialData: [],
  });

  const { data: inspections = [] } = useQuery({
    queryKey: ['qcInspections', user?.tenant_id],
    queryFn: async () => {
      if (!user?.tenant_id) return [];
      return await recims.entities.QCInspection.filter({
        tenant_id: user.tenant_id
      }, '-created_date', 100);
    },
    enabled: !!user?.tenant_id,
    initialData: [],
  });

  const { data: criteria = [] } = useQuery({
    queryKey: ['qcCriteria', user?.tenant_id],
    queryFn: async () => {
      if (!user?.tenant_id) return [];
      return await recims.entities.QCCriteria.filter({ 
        tenant_id: user.tenant_id,
        status: 'active' 
      });
    },
    enabled: !!user?.tenant_id,
    initialData: [],
  });

  const { data: settings = [] } = useQuery({
    queryKey: ['appSettings'],
    queryFn: () => recims.entities.AppSettings.list(),
    initialData: [],
  });

  const qcEnabled = tenantConfig?.features?.qc_module_enabled || false;
  const photoUploadEnabled = tenantConfig?.features?.photo_upload_enabled || false;
  const qcCriteriaEnabled = settings.find(s => s.setting_key === 'enable_qc_criteria_management')?.setting_value === 'true';

  const handlePhotoUpload = async (files) => {
    setUploadingPhotos(true);
    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        const { file_url } = await recims.integrations.Core.UploadFile({ file });
        return file_url;
      });
      const urls = await Promise.all(uploadPromises);
      setPhotoUrls(prev => [...prev, ...urls]);
    } catch (err) {
      setError("Failed to upload photos");
    } finally {
      setUploadingPhotos(false);
    }
  };

  const handleAIDefectsDetected = (results) => {
    setAiDefects(results);
    
    setInspectionData(prev => {
      const updatedData = {
        ...prev,
        measured_contamination_percent: results.contamination_percentage !== undefined ? results.contamination_percentage?.toFixed(1) : prev.measured_contamination_percent,
        measured_purity_percent: results.purity_estimate !== undefined ? results.purity_estimate?.toFixed(1) : prev.measured_purity_percent,
        disposition: results.recommended_disposition || prev.disposition,
        disposition_notes: results.disposition_reason || prev.disposition_notes,
        visual_inspection_notes: results.condition_notes || prev.visual_inspection_notes
      };

      if (results.defects && results.defects.length > 0) {
        const defectTypes = results.defects.map(d => d.type);
        updatedData.contaminants_found = [...new Set([...(prev.contaminants_found || []), ...defectTypes])];
      }
      return updatedData;
    });

    setSuccess("AI analysis complete! Review and adjust findings as needed.");
    setTimeout(() => setSuccess(null), 5000);
  };

  const reopenShipmentMutation = useMutation({
    mutationFn: async (shipmentId) => {
      return await recims.entities.InboundShipment.update(shipmentId, {
        status: 'pending_inspection'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rejectedShipments'] });
      queryClient.invalidateQueries({ queryKey: ['qcPendingShipments'] });
      setSuccess("Shipment reopened for inspection");
      setTimeout(() => setSuccess(null), 3000);
    },
    onError: (err) => {
      setError("Failed to reopen shipment");
      setTimeout(() => setError(null), 3000);
    }
  });

  const createInspectionMutation = useMutation({
    mutationFn: async (data) => {
      let overallResult = 'pass';
      const failCriteria = [];
      const passCriteria = [];

      const matchingCriteria = criteria.find(c => 
        c.material_category === selectedShipment.product_category
      );

      if (matchingCriteria) {
        if (data.measured_purity_percent && matchingCriteria.min_purity_percent) {
          if (parseFloat(data.measured_purity_percent) >= matchingCriteria.min_purity_percent) {
            passCriteria.push('Purity requirements met');
          } else {
            failCriteria.push(`Purity below minimum (${matchingCriteria.min_purity_percent}%)`);
            overallResult = 'fail';
          }
        }

        if (data.measured_contamination_percent && matchingCriteria.max_contamination_percent) {
          if (parseFloat(data.measured_contamination_percent) <= matchingCriteria.max_contamination_percent) {
            passCriteria.push('Contamination within limits');
          } else {
            failCriteria.push(`Contamination exceeds limit (${matchingCriteria.max_contamination_percent}%)`);
            overallResult = 'fail';
          }
        }

        if (!data.visual_inspection_pass) {
          failCriteria.push('Visual inspection failed');
          overallResult = 'fail';
        } else {
          passCriteria.push('Visual inspection passed');
        }

        if (matchingCriteria.lab_testing_required && data.lab_test_pass === false) {
          failCriteria.push('Lab test failed');
          overallResult = 'fail';
        }
      }

      return await recims.entities.QCInspection.create({
        inspection_id: `QC-${Date.now()}`,
        tenant_id: user?.tenant_id,
        shipment_id: selectedShipment.id,
        load_id: selectedShipment.load_id,
        criteria_id: matchingCriteria?.id,
        inspector_name: user?.full_name,
        inspector_email: user?.email,
        inspection_date: new Date().toISOString(),
        material_category: selectedShipment.product_category,
        material_type: selectedShipment.product_type,
        sku_number: selectedShipment.sku_number,
        measured_purity_percent: data.measured_purity_percent ? parseFloat(data.measured_purity_percent) : null,
        measured_contamination_percent: data.measured_contamination_percent ? parseFloat(data.measured_contamination_percent) : null,
        measured_moisture_percent: data.measured_moisture_percent ? parseFloat(data.measured_moisture_percent) : null,
        visual_inspection_pass: data.visual_inspection_pass,
        visual_inspection_notes: data.visual_inspection_notes,
        lab_test_pass: data.lab_test_pass,
        lab_test_notes: data.lab_test_notes,
        contaminants_found: data.contaminants_found,
        color_observed: data.color_observed,
        weight_sampled_kg: data.weight_sampled_kg ? parseFloat(data.weight_sampled_kg) : null,
        overall_result: overallResult,
        pass_criteria_met: passCriteria,
        fail_criteria: failCriteria,
        disposition: data.disposition,
        disposition_notes: data.disposition_notes,
        downgrade_to_grade: data.downgrade_to_grade,
        photo_urls: photoUrls
      });
    },
    onSuccess: async () => {
      await recims.entities.InboundShipment.update(selectedShipment.id, {
        status: 'inspecting'
      });
      
      queryClient.invalidateQueries({ queryKey: ['qcInspections'] });
      queryClient.invalidateQueries({ queryKey: ['qcPendingShipments'] });
      setSuccess("QC inspection recorded successfully");
      setSelectedShipment(null);
      resetForm();
      setTimeout(() => setSuccess(null), 3000);
    },
    onError: (err) => {
      setError("Failed to record inspection. Please try again.");
    }
  });

  const updateDispositionMutation = useMutation({
    mutationFn: async ({ inspectionId, disposition, notes, approvedBy }) => {
      return await recims.entities.QCInspection.update(inspectionId, {
        disposition,
        disposition_notes: notes,
        approved_by: approvedBy,
        approved_date: new Date().toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['qcInspections'] });
      setSuccess("Disposition updated successfully");
      setTimeout(() => setSuccess(null), 3000);
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setError(null);

    if (!selectedShipment) {
      setError("Please select a shipment first");
      return;
    }

    createInspectionMutation.mutate(inspectionData);
  };

  const resetForm = () => {
    setInspectionData({
      measured_purity_percent: '',
      measured_contamination_percent: '',
      measured_moisture_percent: '',
      visual_inspection_pass: true,
      visual_inspection_notes: '',
      lab_test_pass: null,
      lab_test_notes: '',
      contaminants_found: [],
      color_observed: '',
      weight_sampled_kg: '',
      overall_result: 'pending',
      disposition: 'pending_review',
      disposition_notes: '',
      downgrade_to_grade: 'N/A'
    });
    setPhotoUrls([]);
    setAiDefects(null);
  };

  const handleChange = (field, value) => {
    setInspectionData(prev => ({ ...prev, [field]: value }));
  };

  const handleReopenShipment = (shipmentId, loadId) => {
    if (window.confirm(`Reopen shipment ${loadId} for inspection? This will change its status back to "Pending Inspection".`)) {
      reopenShipmentMutation.mutate(shipmentId);
    }
  };

  const getResultBadge = (result) => {
    switch(result) {
      case 'pass':
        return <Badge className="bg-green-100 text-green-700"><CheckCircle2 className="w-3 h-3 mr-1" />Pass</Badge>;
      case 'fail':
        return <Badge className="bg-red-100 text-red-700"><XCircle className="w-3 h-3 mr-1" />Fail</Badge>;
      case 'conditional_pass':
        return <Badge className="bg-yellow-100 text-yellow-700"><AlertTriangle className="w-3 h-3 mr-1" />Conditional</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-700"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
    }
  };

  const getDispositionBadge = (disposition) => {
    const colors = {
      approved: 'bg-green-100 text-green-700',
      rejected: 'bg-red-100 text-red-700',
      downgraded: 'bg-yellow-100 text-yellow-700',
      reprocessing: 'bg-blue-100 text-blue-700',
      quarantined: 'bg-orange-100 text-orange-700',
      pending_review: 'bg-gray-100 text-gray-700'
    };
    return <Badge className={colors[disposition]}>{disposition.replace('_', ' ')}</Badge>;
  };

  if (!qcEnabled) {
    return (
      <div className="p-4 md:p-8 max-w-4xl mx-auto">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Quality Control module is not enabled. Please enable it in Super Admin settings.
          </AlertDescription>
        </Alert>
        <Button onClick={() => navigate(createPageUrl("Dashboard"))} className="mt-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>
      </div>
    );
  }

  const failedInspections = inspections.filter(i => i.overall_result === 'fail' && i.disposition === 'pending_review');
  const pendingInspections = inspections.filter(i => i.overall_result === 'pending');
  const completedInspections = inspections.filter(i => i.disposition !== 'pending_review');

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 via-gray-50 to-gray-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
      <div className="sticky top-12 z-40 bg-gradient-to-br from-gray-100 via-gray-50 to-gray-100 py-4 -mt-4 mb-6">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate(createPageUrl("Dashboard"))}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <ClipboardCheck className="w-7 h-7 text-blue-600" />
              Quality Control
            </h1>
            <p className="text-sm text-gray-600">Inspect shipments and manage dispositions</p>
          </div>
          <Badge className="bg-purple-100 text-purple-700">PHASE IV</Badge>
        </div>
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

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="pending">
            Pending Inspection ({pendingShipments.length})
          </TabsTrigger>
          <TabsTrigger value="failed">
            Failed QC ({failedInspections.length})
          </TabsTrigger>
          <TabsTrigger value="rejected">
            Rejected ({rejectedShipments.length})
          </TabsTrigger>
          <TabsTrigger value="history">
            History ({completedInspections.length})
          </TabsTrigger>
          <TabsTrigger value="criteria" disabled={!qcCriteriaEnabled}>
            QC Criteria ({criteria.length})
            {!qcCriteriaEnabled && <Lock className="w-3 h-3 ml-1 text-gray-400" />}
          </TabsTrigger>
        </TabsList>

        {/* Pending Inspection Tab */}
        <TabsContent value="pending">
          {!selectedShipment ? (
            <Card className={`${neumorph.card} ${neumorph.rounded}`}>
              <CardHeader>
                <CardTitle>Select Shipment for QC Inspection</CardTitle>
              </CardHeader>
              <CardContent>
                {pendingShipments.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <ClipboardCheck className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No pending shipments for inspection</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pendingShipments.map((shipment) => (
                      <div
                        key={shipment.id}
                        onClick={() => setSelectedShipment(shipment)}
                        className="p-4 border rounded-lg hover:border-blue-500 hover:bg-blue-50 cursor-pointer transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold">{shipment.load_id}</p>
                            <p className="text-sm text-gray-600">
                              {shipment.supplier_name} • {shipment.product_category}
                            </p>
                            {shipment.product_type && (
                              <p className="text-xs text-gray-500">{shipment.product_type} • {shipment.product_purity}</p>
                            )}
                          </div>
                          <Badge variant="outline">{shipment.load_type}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <form onSubmit={handleSubmit}>
              <Card className="mb-6 bg-blue-50 border-blue-200">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{selectedShipment.load_id}</p>
                      <p className="text-sm text-gray-600">
                        {selectedShipment.supplier_name} • {selectedShipment.product_category}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedShipment(null)}
                    >
                      Change
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {photoUploadEnabled && photoUrls.length > 0 && (
                <div className="mb-6">
                  <DefectDetection
                    photoUrls={photoUrls}
                    materialCategory={selectedShipment.product_category || selectedShipment.load_type}
                    onDefectsDetected={handleAIDefectsDetected}
                  />
                </div>
              )}

              {aiDefects && (
                <Card className="mb-6 border-2 border-purple-500 bg-purple-900 bg-opacity-10">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className="bg-purple-600 text-white">AI Analysis Applied</Badge>
                      <p className="text-sm" style={{ color: '#E6EAF2' }}>
                        Review AI findings below and adjust as needed before submitting
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card className={`mb-6 ${neumorph.card} ${neumorph.rounded}`}>
                <CardHeader>
                  <CardTitle>Measurements</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Purity (%)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        value={inspectionData.measured_purity_percent}
                        onChange={(e) => handleChange('measured_purity_percent', e.target.value)}
                        placeholder="0.0"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Contamination (%)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        value={inspectionData.measured_contamination_percent}
                        onChange={(e) => handleChange('measured_contamination_percent', e.target.value)}
                        placeholder="0.0"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Moisture (%)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        value={inspectionData.measured_moisture_percent}
                        onChange={(e) => handleChange('measured_moisture_percent', e.target.value)}
                        placeholder="0.0"
                      />
                    </div>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Color Observed</Label>
                      <Input
                        value={inspectionData.color_observed}
                        onChange={(e) => handleChange('color_observed', e.target.value)}
                        placeholder="e.g., Clear, White, Mixed"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Sample Weight (kg)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={inspectionData.weight_sampled_kg}
                        onChange={(e) => handleChange('weight_sampled_kg', e.target.value)}
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className={`mb-6 ${neumorph.card} ${neumorph.rounded}`}>
                <CardHeader>
                  <CardTitle>Visual Inspection</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Label>Visual Inspection Result:</Label>
                    <Select
                      value={inspectionData.visual_inspection_pass.toString()}
                      onValueChange={(value) => handleChange('visual_inspection_pass', value === 'true')}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">Pass</SelectItem>
                        <SelectItem value="false">Fail</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Textarea
                    value={inspectionData.visual_inspection_notes}
                    onChange={(e) => handleChange('visual_inspection_notes', e.target.value)}
                    placeholder="Visual inspection observations..."
                    rows={3}
                  />

                  <div>
                    <Label className="mb-2 block">Inspection Photos</Label>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(e) => handlePhotoUpload(e.target.files)}
                      className="hidden"
                    />
                    <div className="flex gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingPhotos}
                      >
                        <Camera className="w-4 h-4 mr-2" />
                        {uploadingPhotos ? 'Uploading...' : 'Add Photos'}
                      </Button>
                    </div>
                    {photoUrls.length > 0 && (
                      <div className="grid grid-cols-3 gap-3 mt-4">
                        {photoUrls.map((url, index) => (
                          <div key={index} className="relative group">
                            <img
                              src={url}
                              alt={`QC Photo ${index + 1}`}
                              className="w-full h-24 object-cover rounded-lg border"
                            />
                            <button
                              type="button"
                              onClick={() => setPhotoUrls(prev => prev.filter((_, i) => i !== index))}
                              className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className={`mb-6 ${neumorph.card} ${neumorph.rounded}`}>
                <CardHeader>
                  <CardTitle>Disposition</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Disposition Decision</Label>
                      <Select
                        value={inspectionData.disposition}
                        onValueChange={(value) => handleChange('disposition', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="approved">Approved</SelectItem>
                          <SelectItem value="rejected">Rejected</SelectItem>
                          <SelectItem value="downgraded">Downgraded</SelectItem>
                          <SelectItem value="reprocessing">Reprocessing</SelectItem>
                          <SelectItem value="quarantined">Quarantined</SelectItem>
                          <SelectItem value="pending_review">Pending Review</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {inspectionData.disposition === 'downgraded' && (
                      <div className="space-y-2">
                        <Label>Downgrade to Grade</Label>
                        <Select
                          value={inspectionData.downgrade_to_grade}
                          onValueChange={(value) => handleChange('downgrade_to_grade', value)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="A">Grade A</SelectItem>
                            <SelectItem value="B">Grade B</SelectItem>
                            <SelectItem value="C">Grade C</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                  <Textarea
                    value={inspectionData.disposition_notes}
                    onChange={(e) => handleChange('disposition_notes', e.target.value)}
                    placeholder="Disposition notes and justification..."
                    rows={3}
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
                  disabled={createInspectionMutation.isPending}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {createInspectionMutation.isPending ? 'Saving...' : 'Save Inspection'}
                </Button>
              </div>
            </form>
          )}
        </TabsContent>

        {/* Failed QC Tab */}
        <TabsContent value="failed">
          <Card className={`${neumorph.card} ${neumorph.rounded}`}>
            <CardHeader>
              <CardTitle>Failed QC - Pending Disposition</CardTitle>
            </CardHeader>
            <CardContent>
              {failedInspections.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-green-500" />
                  <p>No failed inspections pending review</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {failedInspections.map((inspection) => (
                    <div key={inspection.id} className="p-4 border border-red-200 rounded-lg bg-red-50">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-semibold">{inspection.load_id}</p>
                          <p className="text-sm text-gray-600">
                            {inspection.material_category} • Inspected by {inspection.inspector_name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {format(new Date(inspection.inspection_date), 'MMM dd, yyyy HH:mm')}
                          </p>
                        </div>
                        {getResultBadge(inspection.overall_result)}
                      </div>
                      {inspection.fail_criteria && inspection.fail_criteria.length > 0 && (
                        <div className="mt-3 p-3 bg-white rounded border border-red-200">
                          <p className="text-sm font-semibold text-red-700 mb-1">Failed Criteria:</p>
                          <ul className="text-sm text-gray-700 list-disc list-inside">
                            {inspection.fail_criteria.map((criteria, idx) => (
                              <li key={idx}>{criteria}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* NEW: Rejected Shipments Tab */}
        <TabsContent value="rejected">
          <Card className={`${neumorph.card} ${neumorph.rounded}`}>
            <CardHeader>
              <CardTitle>Rejected Shipments</CardTitle>
              <p className="text-sm text-gray-600 mt-1">
                Shipments that were rejected during QC - can be reopened for re-inspection
              </p>
            </CardHeader>
            <CardContent>
              {rejectedShipments.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-green-500" />
                  <p>No rejected shipments</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {rejectedShipments.map((shipment) => (
                    <div key={shipment.id} className="p-4 border-2 border-red-200 rounded-lg bg-red-50">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <p className="font-semibold">{shipment.load_id}</p>
                            <Badge className="bg-red-100 text-red-700">REJECTED</Badge>
                          </div>
                          <p className="text-sm text-gray-600">
                            {shipment.supplier_name} • {shipment.product_category || shipment.load_type}
                          </p>
                          {shipment.product_type && (
                            <p className="text-xs text-gray-500 mt-1">
                              {shipment.product_type} • {shipment.product_purity}
                            </p>
                          )}
                          {shipment.notes && (
                            <div className="mt-2 p-2 bg-white rounded border">
                              <p className="text-xs text-gray-700">
                                <strong>Notes:</strong> {shipment.notes}
                              </p>
                            </div>
                          )}
                          <p className="text-xs text-gray-500 mt-2">
                            Updated: {format(new Date(shipment.updated_date), 'MMM dd, yyyy HH:mm')}
                          </p>
                        </div>
                        <Button
                          onClick={() => handleReopenShipment(shipment.id, shipment.load_id)}
                          disabled={reopenShipmentMutation.isPending}
                          size="sm"
                          className="bg-blue-600 hover:bg-blue-700 gap-2"
                        >
                          <RefreshCw className="w-4 h-4" />
                          Reopen for Inspection
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history">
          <Card className={`${neumorph.card} ${neumorph.rounded}`}>
            <CardHeader>
              <CardTitle>Inspection History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {completedInspections.slice(0, 20).map((inspection) => (
                  <div key={inspection.id} className="p-4 border rounded-lg">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-semibold">{inspection.inspection_id}</p>
                        <p className="text-sm text-gray-600">
                          {inspection.load_id} • {inspection.material_category}
                        </p>
                        <p className="text-xs text-gray-500">
                          {format(new Date(inspection.inspection_date), 'MMM dd, yyyy HH:mm')}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {getResultBadge(inspection.overall_result)}
                        {getDispositionBadge(inspection.disposition)}
                      </div>
                    </div>
                    {inspection.disposition_notes && (
                      <p className="text-sm text-gray-600 mt-2">
                        <strong>Notes:</strong> {inspection.disposition_notes}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Criteria Tab - Updated with Phase Lock */}
        <TabsContent value="criteria">
          {!qcCriteriaEnabled ? (
            <Card className="border-2 border-purple-200 bg-purple-50">
              <CardContent className="p-8 text-center">
                <div className="bg-white rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4 border-4 border-purple-200">
                  <Lock className="w-8 h-8 text-purple-600" />
                </div>
                <h3 className="text-xl font-bold text-purple-900 mb-2">
                  QC Criteria Management
                </h3>
                <Badge className="bg-purple-600 text-white mb-4">PHASE V</Badge>
                <p className="text-purple-700 mb-6 max-w-md mx-auto">
                  Advanced criteria management with material-specific testing requirements, ASTM/ISO compliance, and automated validation.
                </p>
                <Alert className="bg-blue-50 border-blue-200 mb-6 max-w-md mx-auto text-left">
                  <AlertCircle className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-blue-900 text-sm">
                    Enable in Super Admin → Features → Quality Control Criteria Management
                  </AlertDescription>
                </Alert>
                <Button
                  onClick={() => navigate(createPageUrl("SuperAdmin"))}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  Go to Super Admin
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className={`${neumorph.card} ${neumorph.rounded}`}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>QC Criteria</CardTitle>
                    <p className="text-sm text-gray-600 mt-1">Define quality control standards and testing requirements</p>
                  </div>
                  <Button 
                    onClick={() => navigate(createPageUrl("ManageQCCriteria"))}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    Manage Criteria
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {criteria.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <ClipboardCheck className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No QC criteria defined</p>
                    <Button 
                      onClick={() => navigate(createPageUrl("ManageQCCriteria"))}
                      className="mt-4"
                      variant="outline"
                    >
                      Create First Criteria
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {criteria.map((criterion) => (
                      <div key={criterion.id} className="p-4 border rounded-lg">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="font-semibold">{criterion.criteria_name}</p>
                            <p className="text-sm text-gray-600">
                              {criterion.material_category} {criterion.material_type && `• ${criterion.material_type}`}
                            </p>
                          </div>
                          <Badge>{criterion.status}</Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm mt-2">
                          {criterion.min_purity_percent && (
                            <div>
                              <span className="text-gray-600">Min Purity:</span> <strong>{criterion.min_purity_percent}%</strong>
                            </div>
                          )}
                          {criterion.max_contamination_percent && (
                            <div>
                              <span className="text-gray-600">Max Contamination:</span> <strong>{criterion.max_contamination_percent}%</strong>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
      </div>
    </div>
  );
}