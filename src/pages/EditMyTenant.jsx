import React, { useState } from "react";
import { recims } from "@/api/recimsClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Building2, ArrowLeft, Save, Upload, AlertCircle, Palette } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { LOGO_ALLOWED_TYPES, LOGO_MAX_BYTES, uploadTenantLogo } from "@/lib/uploads";

export default function EditMyTenant() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoInputRef = React.useRef(null);
  const { toast } = useToast();
  const logoAccept = React.useMemo(() => LOGO_ALLOWED_TYPES.join(','), []);

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => recims.auth.me(),
  });

  const resolvedTenantKey = React.useMemo(() => {
    if (!user?.tenant_id) return null;
    const numeric = Number(user.tenant_id);
    return Number.isInteger(numeric) ? numeric : user.tenant_id;
  }, [user?.tenant_id]);

  const { data: tenant, isLoading } = useQuery({
    queryKey: ['myTenant', resolvedTenantKey],
    queryFn: async () => {
      if (!resolvedTenantKey) return null;
      try {
        return await recims.entities.Tenant.get(resolvedTenantKey);
      } catch (error) {
        if (typeof resolvedTenantKey === 'string') {
          const fallback = await recims.entities.Tenant.filter({ tenant_id: resolvedTenantKey });
          return fallback[0] ?? null;
        }
        throw error;
      }
    },
    enabled: !!resolvedTenantKey,
  });

  const [formData, setFormData] = useState({});

  React.useEffect(() => {
    if (tenant) {
      setFormData(tenant);
    }
  }, [tenant]);

  const updateTenantMutation = useMutation({
    mutationFn: async (data) => {
      return await recims.entities.Tenant.update(tenant.id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myTenant', resolvedTenantKey] });
      queryClient.invalidateQueries({ queryKey: ['tenant', tenant.id] });
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      queryClient.invalidateQueries({ queryKey: ['tenantConfig', resolvedTenantKey] });
      setSuccess("Tenant updated successfully!");
      setTimeout(() => setSuccess(null), 3000);
    },
    onError: (err) => {
      setError(err.message || "Failed to update tenant");
      setTimeout(() => setError(null), 5000);
    }
  });

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFeatureToggle = (feature) => {
    setFormData(prev => ({
      ...prev,
      features: {
        ...prev.features,
        [feature]: !prev.features?.[feature]
      }
    }));
  };

  const handleLogoUpload = async (file) => {
    setUploadingLogo(true);
    setError(null);
    try {
      const { fileUrl } = await uploadTenantLogo(file, {
        fileName: `tenant-${tenant?.tenant_id || tenant?.id || 'logo'}`,
      });
      setFormData(prev => ({ ...prev, branding_logo_url: fileUrl }));
      const message = "Logo uploaded! Click 'Save Changes' to apply.";
      setSuccess(message);
      toast({ title: 'Logo uploaded', description: message });
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      const message = err?.message || 'Failed to upload logo';
      setError(message);
      toast({ title: 'Upload failed', description: message, variant: 'destructive' });
      setTimeout(() => setError(null), 3000);
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSubmit = () => {
    updateTenantMutation.mutate(formData);
  };

  if (isLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading tenant settings...</p>
        </div>
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No tenant found. Please contact your administrator.
          </AlertDescription>
        </Alert>
        <Button onClick={() => navigate(createPageUrl("Dashboard"))} className="mt-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="outline" size="icon" onClick={() => navigate(createPageUrl("Dashboard"))}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Building2 className="w-7 h-7 text-green-600" />
            Edit Tenant Settings
          </h1>
          <p className="text-sm text-gray-600">{`Update your organization's information and preferences`}</p>
        </div>
        <Button 
          onClick={handleSubmit}
          disabled={updateTenantMutation.isPending}
          className="bg-green-600 hover:bg-green-700"
        >
          <Save className="w-4 h-4 mr-2" />
          {updateTenantMutation.isPending ? 'Saving...' : 'Save Changes'}
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

      <Tabs defaultValue="general">
        <TabsList className="mb-6">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="contact">Contact Info</TabsTrigger>
          <TabsTrigger value="branding">Branding</TabsTrigger>
          <TabsTrigger value="locale">Locale & Format</TabsTrigger>
          <TabsTrigger value="features">Features</TabsTrigger>
        </TabsList>

        {/* General Tab */}
        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>General Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Company Name</Label>
                <Input
                  value={formData.name || ''}
                  onChange={(e) => handleChange('name', e.target.value)}
                  placeholder="e.g., Acme Recycling Inc."
                />
              </div>
              <div>
                <Label>Display Name</Label>
                <Input
                  value={formData.display_name || ''}
                  onChange={(e) => handleChange('display_name', e.target.value)}
                  placeholder="e.g., Acme Recycling"
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={formData.description || ''}
                  onChange={(e) => handleChange('description', e.target.value)}
                  placeholder="Brief description of your organization"
                  rows={3}
                />
              </div>
              <div>
                <Label>Business Type</Label>
                <Select
                  value={formData.business_type || ''}
                  onValueChange={(value) => handleChange('business_type', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select business type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="plastics_recycling">Plastics Recycling</SelectItem>
                    <SelectItem value="metal_recycling">Metal Recycling</SelectItem>
                    <SelectItem value="mixed_materials">Mixed Materials</SelectItem>
                    <SelectItem value="general_manufacturing">General Manufacturing</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Website</Label>
                <Input
                  value={formData.website || ''}
                  onChange={(e) => handleChange('website', e.target.value)}
                  placeholder="https://www.example.com"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Contact Info Tab */}
        <TabsContent value="contact">
          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Primary Contact Name</Label>
                  <Input
                    value={formData.primary_contact_name || ''}
                    onChange={(e) => handleChange('primary_contact_name', e.target.value)}
                  />
                </div>
                <div>
                  <Label>Primary Contact Email</Label>
                  <Input
                    type="email"
                    value={formData.primary_contact_email || ''}
                    onChange={(e) => handleChange('primary_contact_email', e.target.value)}
                  />
                </div>
                <div>
                  <Label>Primary Contact Phone</Label>
                  <Input
                    value={formData.primary_contact_phone || ''}
                    onChange={(e) => handleChange('primary_contact_phone', e.target.value)}
                  />
                </div>
              </div>
              
              <div className="border-t pt-4 mt-4">
                <h3 className="font-semibold mb-3">Address</h3>
                <div className="space-y-3">
                  <div>
                    <Label>Address Line 1</Label>
                    <Input
                      value={formData.address_line1 || ''}
                      onChange={(e) => handleChange('address_line1', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Address Line 2</Label>
                    <Input
                      value={formData.address_line2 || ''}
                      onChange={(e) => handleChange('address_line2', e.target.value)}
                    />
                  </div>
                  <div className="grid md:grid-cols-3 gap-3">
                    <div>
                      <Label>City</Label>
                      <Input
                        value={formData.city || ''}
                        onChange={(e) => handleChange('city', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>State/Province</Label>
                      <Input
                        value={formData.state_province || ''}
                        onChange={(e) => handleChange('state_province', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Postal Code</Label>
                      <Input
                        value={formData.postal_code || ''}
                        onChange={(e) => handleChange('postal_code', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Branding Tab */}
        <TabsContent value="branding">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="w-5 h-5" />
                Branding
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label className="mb-2 block">Company Logo</Label>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept={logoAccept}
                  onChange={(e) => e.target.files?.[0] && handleLogoUpload(e.target.files[0])}
                  className="hidden"
                />
                <div className="flex items-center gap-4">
                  {formData.branding_logo_url && (
                    <img
                      src={formData.branding_logo_url}
                      alt="Company Logo"
                      className="w-24 h-24 object-contain border rounded-lg"
                    />
                  )}
                  <Button
                    onClick={() => logoInputRef.current?.click()}
                    disabled={uploadingLogo}
                    variant="outline"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    {uploadingLogo ? 'Uploading...' : 'Upload Logo'}
                  </Button>
                </div>
                <p className="text-xs text-gray-500">
                  Supported: PNG, JPG, SVG, WebP · Max {(LOGO_MAX_BYTES / (1024 * 1024)).toFixed(0)}MB
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Primary Brand Color</Label>
                  <div className="flex gap-2 mt-2">
                    <input
                      type="color"
                      value={formData.branding_primary_color || '#007A6E'}
                      onChange={(e) => handleChange('branding_primary_color', e.target.value)}
                      className="w-16 h-10 cursor-pointer border rounded"
                    />
                    <Input
                      value={formData.branding_primary_color || ''}
                      onChange={(e) => handleChange('branding_primary_color', e.target.value)}
                      placeholder="#007A6E"
                      className="flex-1"
                    />
                  </div>
                </div>
                <div>
                  <Label>Secondary Brand Color</Label>
                  <div className="flex gap-2 mt-2">
                    <input
                      type="color"
                      value={formData.branding_secondary_color || '#2A66FF'}
                      onChange={(e) => handleChange('branding_secondary_color', e.target.value)}
                      className="w-16 h-10 cursor-pointer border rounded"
                    />
                    <Input
                      value={formData.branding_secondary_color || ''}
                      onChange={(e) => handleChange('branding_secondary_color', e.target.value)}
                      placeholder="#2A66FF"
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Locale Tab */}
        <TabsContent value="locale">
          <Card>
            <CardHeader>
              <CardTitle>Locale & Format Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Country</Label>
                  <Select
                    value={formData.country_code || ''}
                    onValueChange={(value) => handleChange('country_code', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select country" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="US">United States</SelectItem>
                      <SelectItem value="CA">Canada</SelectItem>
                      <SelectItem value="GB">United Kingdom</SelectItem>
                      <SelectItem value="EU">Europe</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Region</Label>
                  <Select
                    value={formData.region || ''}
                    onValueChange={(value) => handleChange('region', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select region" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USA">USA</SelectItem>
                      <SelectItem value="Canada">Canada</SelectItem>
                      <SelectItem value="Europe">Europe</SelectItem>
                      <SelectItem value="Global">Global</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Default Currency</Label>
                  <Select
                    value={formData.default_currency || ''}
                    onValueChange={(value) => handleChange('default_currency', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD - US Dollar</SelectItem>
                      <SelectItem value="CAD">CAD - Canadian Dollar</SelectItem>
                      <SelectItem value="EUR">EUR - Euro</SelectItem>
                      <SelectItem value="GBP">GBP - British Pound</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Timezone</Label>
                  <Select
                    value={formData.timezone || ''}
                    onValueChange={(value) => handleChange('timezone', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select timezone" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="America/New_York">Eastern Time</SelectItem>
                      <SelectItem value="America/Chicago">Central Time</SelectItem>
                      <SelectItem value="America/Denver">Mountain Time</SelectItem>
                      <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
                      <SelectItem value="America/Toronto">Toronto</SelectItem>
                      <SelectItem value="Europe/London">London</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Unit System</Label>
                  <Select
                    value={formData.unit_system || ''}
                    onValueChange={(value) => handleChange('unit_system', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select unit system" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="METRIC">Metric (kg, m, L)</SelectItem>
                      <SelectItem value="IMPERIAL">Imperial (lbs, ft, gal)</SelectItem>
                      <SelectItem value="CUSTOM">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Date Format</Label>
                  <Select
                    value={formData.date_format || ''}
                    onValueChange={(value) => handleChange('date_format', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select date format" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                      <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                      <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Features Tab */}
        <TabsContent value="features">
          <Card>
            <CardHeader>
              <CardTitle>Feature Configuration</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { key: 'po_module_enabled', label: 'Purchase Orders Module' },
                  { key: 'bin_capacity_enabled', label: 'Bin Capacity Management' },
                  { key: 'photo_upload_enabled', label: 'Photo Uploads' },
                  { key: 'ai_classification_enabled', label: 'AI Classification' },
                  { key: 'qc_module_enabled', label: 'Quality Control Module' },
                  { key: 'multi_zone_enabled', label: 'Multi-Zone Support' }
                ].map((feature) => (
                  <div key={feature.key} className="flex items-center justify-between p-3 border rounded-lg">
                    <Label className="cursor-pointer">{feature.label}</Label>
                    <input
                      type="checkbox"
                      checked={formData.features?.[feature.key] || false}
                      onChange={() => handleFeatureToggle(feature.key)}
                      className="w-4 h-4 cursor-pointer"
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}