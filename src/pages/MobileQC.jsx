import React, { useState } from "react";
import { recims } from "@/api/recimsClient";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTenant } from "@/components/TenantContext";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  ArrowLeft,
  ClipboardCheck,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Camera
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import BarcodeScanner from "@/components/mobile/BarcodeScanner";
import TenantHeader from "@/components/TenantHeader";

export default function MobileQC() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { tenantConfig, user } = useTenant();
  const [step, setStep] = useState('scan'); // 'scan', 'inspect', 'complete'
  const [shipmentId, setShipmentId] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const [formData, setFormData] = useState({
    visual_inspection_pass: true,
    measured_purity_percent: '',
    measured_contamination_percent: '',
    color_observed: '',
    contaminants_found: '',
    visual_inspection_notes: '',
    overall_result: 'pass',
    disposition: 'approved'
  });



  const handleScan = async (code) => {
    // Search for shipment
    try {
      const shipments = await recims.entities.InboundShipment.filter({ load_id: code });
      if (shipments.length > 0) {
        setShipmentId(shipments[0].id);
        setStep('inspect');
      } else {
        setError(`Shipment not found: ${code}`);
      }
    } catch (err) {
      setError("Error loading shipment");
    }
  };

  const createInspectionMutation = useMutation({
    mutationFn: async (data) => {
      return await recims.entities.QCInspection.create({
        inspection_id: `QC-${Date.now()}`,
        tenant_id: user?.tenant_id,
        shipment_id: shipmentId,
        inspector_name: user?.full_name,
        inspector_email: user?.email,
        inspection_date: new Date().toISOString(),
        ...data,
        contaminants_found: data.contaminants_found ? [data.contaminants_found] : []
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['qcInspections'] });
      setSuccess("QC inspection completed successfully!");
      setStep('complete');
    },
    onError: (err) => {
      setError("Failed to save inspection");
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    createInspectionMutation.mutate(formData);
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Auto-determine overall result
    if (field === 'visual_inspection_pass' || field === 'measured_contamination_percent') {
      const visualPass = field === 'visual_inspection_pass' ? value : formData.visual_inspection_pass;
      const contamination = field === 'measured_contamination_percent' ? parseFloat(value) : parseFloat(formData.measured_contamination_percent);
      
      if (!visualPass || contamination > 10) {
        setFormData(prev => ({ ...prev, overall_result: 'fail', disposition: 'rejected' }));
      } else if (contamination > 5) {
        setFormData(prev => ({ ...prev, overall_result: 'conditional_pass', disposition: 'downgraded' }));
      } else {
        setFormData(prev => ({ ...prev, overall_result: 'pass', disposition: 'approved' }));
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <TenantHeader />
      
      <div className="p-4">
        <div className="flex items-center gap-3 mb-4">
          <Link to={createPageUrl("MobileWarehouse")}>
            <Button variant="outline" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-900">QC Inspection</h1>
            <p className="text-sm text-gray-600">Mobile quality control</p>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-between mb-6">
          <div className={`flex-1 text-center ${step === 'scan' ? 'text-blue-600' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full mx-auto mb-1 flex items-center justify-center ${
              step === 'scan' ? 'bg-blue-600 text-white' : 'bg-gray-200'
            }`}>1</div>
            <p className="text-xs font-semibold">Scan</p>
          </div>
          <div className="flex-1 border-t-2 border-gray-300 mx-2 mt-[-20px]"></div>
          <div className={`flex-1 text-center ${step === 'inspect' ? 'text-blue-600' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full mx-auto mb-1 flex items-center justify-center ${
              step === 'inspect' ? 'bg-blue-600 text-white' : 'bg-gray-200'
            }`}>2</div>
            <p className="text-xs font-semibold">Inspect</p>
          </div>
          <div className="flex-1 border-t-2 border-gray-300 mx-2 mt-[-20px]"></div>
          <div className={`flex-1 text-center ${step === 'complete' ? 'text-green-600' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full mx-auto mb-1 flex items-center justify-center ${
              step === 'complete' ? 'bg-green-600 text-white' : 'bg-gray-200'
            }`}>3</div>
            <p className="text-xs font-semibold">Complete</p>
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Step 1: Scan */}
        {step === 'scan' && (
          <BarcodeScanner
            onScan={handleScan}
            placeholder="Scan load ID..."
          />
        )}

        {/* Step 2: Inspect */}
        {step === 'inspect' && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Visual Inspection</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Visual Pass?</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      onClick={() => handleChange('visual_inspection_pass', true)}
                      variant={formData.visual_inspection_pass ? 'default' : 'outline'}
                      className="gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Pass
                    </Button>
                    <Button
                      type="button"
                      onClick={() => handleChange('visual_inspection_pass', false)}
                      variant={!formData.visual_inspection_pass ? 'default' : 'outline'}
                      className="gap-2"
                    >
                      <XCircle className="w-4 h-4" />
                      Fail
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Color Observed</Label>
                  <Input
                    value={formData.color_observed}
                    onChange={(e) => handleChange('color_observed', e.target.value)}
                    placeholder="e.g., Clear, Blue, Mixed"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Visual Notes</Label>
                  <Textarea
                    value={formData.visual_inspection_notes}
                    onChange={(e) => handleChange('visual_inspection_notes', e.target.value)}
                    placeholder="Describe visual condition..."
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Measurements</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Purity %</Label>
                    <Input
                      type="number"
                      value={formData.measured_purity_percent}
                      onChange={(e) => handleChange('measured_purity_percent', e.target.value)}
                      placeholder="0-100"
                      min="0"
                      max="100"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Contamination %</Label>
                    <Input
                      type="number"
                      value={formData.measured_contamination_percent}
                      onChange={(e) => handleChange('measured_contamination_percent', e.target.value)}
                      placeholder="0-100"
                      min="0"
                      max="100"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Contaminants</Label>
                  <Input
                    value={formData.contaminants_found}
                    onChange={(e) => handleChange('contaminants_found', e.target.value)}
                    placeholder="e.g., PVC, rubber, moisture"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Result Summary */}
            <Card className={
              formData.overall_result === 'pass' ? 'border-green-500 bg-green-50' :
              formData.overall_result === 'fail' ? 'border-red-500 bg-red-50' :
              'border-yellow-500 bg-yellow-50'
            }>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  {formData.overall_result === 'pass' ? (
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                  ) : formData.overall_result === 'fail' ? (
                    <XCircle className="w-5 h-5 text-red-600" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-yellow-600" />
                  )}
                  <p className="font-semibold">
                    Result: {formData.overall_result.replace('_', ' ').toUpperCase()}
                  </p>
                </div>
                <p className="text-sm">
                  Disposition: {formData.disposition}
                </p>
              </CardContent>
            </Card>

            <div className="grid grid-cols-2 gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep('scan')}
              >
                Back
              </Button>
              <Button
                type="submit"
                disabled={createInspectionMutation.isPending}
                className="bg-green-600 hover:bg-green-700"
              >
                {createInspectionMutation.isPending ? 'Saving...' : 'Complete'}
              </Button>
            </div>
          </form>
        )}

        {/* Step 3: Complete */}
        {step === 'complete' && (
          <Card className="border-green-500 bg-green-50">
            <CardContent className="p-6 text-center">
              <CheckCircle2 className="w-16 h-16 mx-auto mb-4 text-green-600" />
              <h3 className="text-xl font-bold text-green-900 mb-2">
                Inspection Complete!
              </h3>
              <p className="text-green-700 mb-6">
                {success}
              </p>

              <div className="grid grid-cols-2 gap-3">
                <Button
                  onClick={() => {
                    setStep('scan');
                    setShipmentId('');
                    setFormData({
                      visual_inspection_pass: true,
                      measured_purity_percent: '',
                      measured_contamination_percent: '',
                      color_observed: '',
                      contaminants_found: '',
                      visual_inspection_notes: '',
                      overall_result: 'pass',
                      disposition: 'approved'
                    });
                    setSuccess(null);
                  }}
                  variant="outline"
                >
                  New Inspection
                </Button>
                <Link to={createPageUrl("QualityControl")}>
                  <Button className="w-full">
                    View All
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}