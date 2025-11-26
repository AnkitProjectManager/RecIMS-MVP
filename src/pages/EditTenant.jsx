import React, { useState } from "react";
import { recims } from "@/api/recimsClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { 
  Building2,
  Save,
  ArrowLeft,
  Upload,
  AlertCircle,
  Settings
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export default function EditTenant() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoInputRef = React.useRef(null);

  const urlParams = new URLSearchParams(window.location.search);
  const tenantId = urlParams.get('id');

  const resolvedTenantId = React.useMemo(() => {
    if (!tenantId) return null;
    const numeric = Number(tenantId);
    return Number.isInteger(numeric) ? numeric : tenantId;
  }, [tenantId]);

  const { data: tenant, isLoading } = useQuery({
    queryKey: ['tenant', resolvedTenantId],
    queryFn: async () => {
      if (!resolvedTenantId) return null;
      try {
        return await recims.entities.Tenant.get(resolvedTenantId);
      } catch (error) {
        if (typeof resolvedTenantId === 'string') {
          const fallback = await recims.entities.Tenant.filter({ tenant_id: resolvedTenantId });
          return fallback[0] ?? null;
        }
        throw error;
      }
    },
    enabled: !!resolvedTenantId,
  });

  const { data: allTenants = [] } = useQuery({
    queryKey: ['tenants'],
    queryFn: async () => {
      return await recims.entities.Tenant.list();
    },
    initialData: [],
  });

  const [formData, setFormData] = useState({});

  React.useEffect(() => {
    if (tenant) {
      setFormData({
        name: tenant.name || '',
        code: tenant.code || '',
        base_subdomain: tenant.base_subdomain || '',
        status: tenant.status || 'ACTIVE',
        display_name: tenant.display_name || '',
        business_type: tenant.business_type || 'general_manufacturing',
        primary_contact_name: tenant.primary_contact_name || '',
        primary_contact_email: tenant.primary_contact_email || '',
        primary_contact_phone: tenant.primary_contact_phone || '',
        default_currency: tenant.default_currency || 'USD',
        country_code: tenant.country_code || 'US',
        region: tenant.region || 'USA',
        phone_number_format: tenant.phone_number_format || '+1 (XXX) XXX-XXXX',
        unit_system: tenant.unit_system || 'METRIC',
        timezone: tenant.timezone || 'America/New_York',
        date_format: tenant.date_format || 'YYYY-MM-DD',
        number_format: tenant.number_format || { decimal: '.', thousand: ',' },
        branding_primary_color: tenant.branding_primary_color || '#007A6E',
        branding_secondary_color: tenant.branding_secondary_color || '#005247',
        branding_logo_url: tenant.branding_logo_url || '',
        address_line1: tenant.address_line1 || '',
        address_line2: tenant.address_line2 || '',
        city: tenant.city || '',
        state_province: tenant.state_province || '',
        postal_code: tenant.postal_code || '',
        address_country_code: tenant.address_country_code || 'US',
        website: tenant.website || '',
        description: tenant.description || '',
        default_load_types: tenant.default_load_types || ['plastic', 'metal', 'mixed'],
        features: tenant.features || {
          po_module_enabled: false,
          bin_capacity_enabled: false,
          photo_upload_enabled: false,
          ai_classification_enabled: false,
          qc_module_enabled: true,
          multi_zone_enabled: false
        },
        api_keys: tenant.api_keys || {
          quickbooks_client_id: '',
          quickbooks_client_secret: '',
          taxjar_api_key: '',
          hellosign_client_id: '',
          hellosign_api_key: '',
          stripe_api_key: '',
          stripe_webhook_secret: ''
        }
      });
    }
  }, [tenant]);

  const updateTenantMutation = useMutation({
    mutationFn: async (data) => {
      return await recims.entities.Tenant.update(resolvedTenantId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant', resolvedTenantId] });
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      queryClient.invalidateQueries({ queryKey: ['tenantConfig', resolvedTenantId] });
      navigate(createPageUrl(`ViewTenant?id=${resolvedTenantId}`));
    },
    onError: (err) => {
      setError(err.message || "Failed to update tenant");
    }
  });

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFeatureToggle = (featureKey, value) => {
    setFormData(prev => ({
      ...prev,
      features: {
        ...prev.features,
        [featureKey]: value
      }
    }));
  };

  const handleLogoUpload = async (file) => {
    setUploadingLogo(true);
    setError(null);
    try {
      const { file_url } = await recims.integrations.Core.UploadFile({ file });
      setFormData(prev => ({ ...prev, branding_logo_url: file_url }));
    } catch (err) {
      setError("Failed to upload logo");
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError(null);

    // Check for duplicate tenant name (case-insensitive), excluding current tenant
    const upperCaseName = formData.name.toUpperCase();
    const numericTenantId = Number(tenantId);
    const duplicateName = allTenants.find(t => {
      const sameId = Number.isInteger(numericTenantId) ? t.id === numericTenantId : t.tenant_id === tenantId;
      return !sameId && t.name.toUpperCase() === upperCaseName;
    });
    
    if (duplicateName) {
      setError(`A tenant with the name "${duplicateName.name}" already exists. Please choose a different name.`);
      return;
    }

    // Convert name to UPPER CASE before saving
    const dataToSave = {
      ...formData,
      name: upperCaseName
    };

  updateTenantMutation.mutate(dataToSave);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Tenant not found</AlertDescription>
        </Alert>
        <Button onClick={() => navigate(createPageUrl("TenantConsole"))} className="mt-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Tenant Console
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Button
          variant="outline"
          size="icon"
          onClick={() => navigate(createPageUrl(`ViewTenant?id=${resolvedTenantId}`))}
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Building2 className="w-7 h-7 text-blue-600" />
            Edit Tenant: {tenant.name}
          </h1>
          <p className="text-sm text-gray-600">Update tenant configuration</p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit}>
        <Tabs defaultValue="general" className="mb-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="locale">Locale & Formats</TabsTrigger>
            <TabsTrigger value="branding">Branding</TabsTrigger>
            <TabsTrigger value="api_keys">API Keys</TabsTrigger>
            <TabsTrigger value="features">Features</TabsTrigger>
          </TabsList>

          <TabsContent value="general">
            <Card>
              <CardHeader>
                <CardTitle>General Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert className="bg-yellow-50 border-yellow-200">
                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                  <AlertDescription className="text-yellow-800 text-sm">
                    <strong>Note:</strong> Code and Base Subdomain are read-only after creation to prevent routing issues.
                  </AlertDescription>
                </Alert>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Company Name *</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => handleChange('name', e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Display Name *</Label>
                    <Input
                      value={formData.display_name}
                      onChange={(e) => handleChange('display_name', e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Tenant Code (Read-Only)</Label>
                    <Input
                      value={formData.code}
                      disabled
                      className="bg-gray-100"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Base Subdomain (Read-Only)</Label>
                    <Input
                      value={formData.base_subdomain}
                      disabled
                      className="bg-gray-100"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Status *</Label>
                    <Select value={formData.status} onValueChange={(value) => handleChange('status', value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ACTIVE">Active</SelectItem>
                        <SelectItem value="SUSPENDED">Suspended</SelectItem>
                        <SelectItem value="DELETED">Deleted</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Business Type</Label>
                    <Select value={formData.business_type} onValueChange={(value) => handleChange('business_type', value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="plastics_recycling">Plastics Recycling</SelectItem>
                        <SelectItem value="metal_recycling">Metal Recycling</SelectItem>
                        <SelectItem value="mixed_materials">Mixed Materials</SelectItem>
                        <SelectItem value="general_manufacturing">General Manufacturing</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => handleChange('description', e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-3">Primary Contact</h3>
                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Contact Name</Label>
                      <Input
                        value={formData.primary_contact_name}
                        onChange={(e) => handleChange('primary_contact_name', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Contact Email</Label>
                      <Input
                        type="email"
                        value={formData.primary_contact_email}
                        onChange={(e) => handleChange('primary_contact_email', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Contact Phone</Label>
                      <Input
                        value={formData.primary_contact_phone}
                        onChange={(e) => handleChange('primary_contact_phone', e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-3">Address</h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2 md:col-span-2">
                      <Label>Address Line 1</Label>
                      <Input
                        value={formData.address_line1}
                        onChange={(e) => handleChange('address_line1', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>Address Line 2</Label>
                      <Input
                        value={formData.address_line2}
                        onChange={(e) => handleChange('address_line2', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>City</Label>
                      <Input
                        value={formData.city}
                        onChange={(e) => handleChange('city', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>State/Province</Label>
                      <Input
                        value={formData.state_province}
                        onChange={(e) => handleChange('state_province', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Postal Code</Label>
                      <Input
                        value={formData.postal_code}
                        onChange={(e) => handleChange('postal_code', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Country Code</Label>
                      <Select value={formData.address_country_code} onValueChange={(value) => handleChange('address_country_code', value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="US">🇺🇸 United States</SelectItem>
                          <SelectItem value="CA">🇨🇦 Canada</SelectItem>
                          <SelectItem value="GB">🇬🇧 United Kingdom</SelectItem>
                          <SelectItem value="DE">🇩🇪 Germany</SelectItem>
                          <SelectItem value="FR">🇫🇷 France</SelectItem>
                          <SelectItem value="MX">🇲🇽 Mexico</SelectItem>
                          <SelectItem value="JP">🇯🇵 Japan</SelectItem>
                          <SelectItem value="CN">🇨🇳 China</SelectItem>
                          <SelectItem value="IN">🇮🇳 India</SelectItem>
                          <SelectItem value="BR">🇧🇷 Brazil</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Website</Label>
                      <Input
                        value={formData.website}
                        onChange={(e) => handleChange('website', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="locale">
            <Card>
              <CardHeader>
                <CardTitle>Locale & Formatting</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Country Code *</Label>
                    <Select value={formData.country_code} onValueChange={(value) => handleChange('country_code', value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="US">🇺🇸 United States</SelectItem>
                        <SelectItem value="CA">🇨🇦 Canada</SelectItem>
                        <SelectItem value="GB">🇬🇧 United Kingdom</SelectItem>
                        <SelectItem value="EU">🇪🇺 European Union</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Region *</Label>
                    <Select value={formData.region} onValueChange={(value) => handleChange('region', value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USA">USA</SelectItem>
                        <SelectItem value="Canada">Canada</SelectItem>
                        <SelectItem value="Europe">Europe</SelectItem>
                        <SelectItem value="Global">Global</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Default Currency *</Label>
                    <Select value={formData.default_currency} onValueChange={(value) => handleChange('default_currency', value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USD">USD - US Dollar</SelectItem>
                        <SelectItem value="CAD">CAD - Canadian Dollar</SelectItem>
                        <SelectItem value="EUR">EUR - Euro</SelectItem>
                        <SelectItem value="GBP">GBP - British Pound</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Unit System *</Label>
                    <Select value={formData.unit_system} onValueChange={(value) => handleChange('unit_system', value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="METRIC">Metric</SelectItem>
                        <SelectItem value="IMPERIAL">Imperial</SelectItem>
                        <SelectItem value="CUSTOM">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Timezone *</Label>
                    <Input
                      value={formData.timezone}
                      onChange={(e) => handleChange('timezone', e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Date Format *</Label>
                    <Select value={formData.date_format} onValueChange={(value) => handleChange('date_format', value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                        <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                        <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Phone Format</Label>
                    <Input
                      value={formData.phone_number_format}
                      onChange={(e) => handleChange('phone_number_format', e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="branding">
            <Card>
              <CardHeader>
                <CardTitle>Branding & Appearance</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Company Logo</Label>
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => e.target.files?.[0] && handleLogoUpload(e.target.files[0])}
                    className="hidden"
                  />
                  <div className="flex items-center gap-4">
                    {formData.branding_logo_url && (
                      <img
                        src={formData.branding_logo_url}
                        alt="Logo"
                        className="w-24 h-24 object-contain border rounded-lg"
                      />
                    )}
                    <Button
                      type="button"
                      onClick={() => logoInputRef.current?.click()}
                      disabled={uploadingLogo}
                      variant="outline"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      {uploadingLogo ? 'Uploading...' : 'Upload Logo'}
                    </Button>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Primary Brand Color</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={formData.branding_primary_color}
                        onChange={(e) => handleChange('branding_primary_color', e.target.value)}
                        className="w-20 h-10"
                      />
                      <Input
                        value={formData.branding_primary_color}
                        onChange={(e) => handleChange('branding_primary_color', e.target.value)}
                        className="flex-1"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Secondary Brand Color</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={formData.branding_secondary_color}
                        onChange={(e) => handleChange('branding_secondary_color', e.target.value)}
                        className="w-20 h-10"
                      />
                      <Input
                        value={formData.branding_secondary_color}
                        onChange={(e) => handleChange('branding_secondary_color', e.target.value)}
                        className="flex-1"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="api_keys">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  API Keys & Secrets
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert className="bg-yellow-50 border-yellow-200">
                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                  <AlertDescription className="text-yellow-800 text-sm">
                    <strong>Security Notice:</strong> API keys are masked for security. Re-enter to update.
                  </AlertDescription>
                </Alert>

                <div className="space-y-4">
                  <div className="border-b pb-4">
                    <h3 className="font-semibold text-gray-900 mb-3">QuickBooks Online</h3>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Client ID</Label>
                        <Input
                          type="password"
                          value={formData.api_keys?.quickbooks_client_id || ''}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            api_keys: { ...prev.api_keys, quickbooks_client_id: e.target.value }
                          }))}
                          placeholder="QBO Client ID"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Client Secret</Label>
                        <Input
                          type="password"
                          value={formData.api_keys?.quickbooks_client_secret || ''}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            api_keys: { ...prev.api_keys, quickbooks_client_secret: e.target.value }
                          }))}
                          placeholder="QBO Client Secret"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="border-b pb-4">
                    <h3 className="font-semibold text-gray-900 mb-3">TaxJar</h3>
                    <div className="space-y-2">
                      <Label>API Key</Label>
                      <Input
                        type="password"
                        value={formData.api_keys?.taxjar_api_key || ''}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          api_keys: { ...prev.api_keys, taxjar_api_key: e.target.value }
                        }))}
                        placeholder="TaxJar API Key"
                      />
                    </div>
                  </div>

                  <div className="border-b pb-4">
                    <h3 className="font-semibold text-gray-900 mb-3">HelloSign / Dropbox Sign</h3>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Client ID</Label>
                        <Input
                          type="password"
                          value={formData.api_keys?.hellosign_client_id || ''}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            api_keys: { ...prev.api_keys, hellosign_client_id: e.target.value }
                          }))}
                          placeholder="HelloSign Client ID"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>API Key</Label>
                        <Input
                          type="password"
                          value={formData.api_keys?.hellosign_api_key || ''}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            api_keys: { ...prev.api_keys, hellosign_api_key: e.target.value }
                          }))}
                          placeholder="HelloSign API Key"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold text-gray-900 mb-3">Stripe</h3>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>API Key</Label>
                        <Input
                          type="password"
                          value={formData.api_keys?.stripe_api_key || ''}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            api_keys: { ...prev.api_keys, stripe_api_key: e.target.value }
                          }))}
                          placeholder="Stripe API Key"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Webhook Secret</Label>
                        <Input
                          type="password"
                          value={formData.api_keys?.stripe_webhook_secret || ''}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            api_keys: { ...prev.api_keys, stripe_webhook_secret: e.target.value }
                          }))}
                          placeholder="Stripe Webhook Secret"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="features">
            <Card>
              <CardHeader>
                <CardTitle>Feature Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {Object.entries(formData.features || {}).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-semibold">{key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={value}
                        onChange={(e) => handleFeatureToggle(key, e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                    </label>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(createPageUrl(`ViewTenant?id=${resolvedTenantId}`))}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={updateTenantMutation.isPending}
            className="flex-1 bg-blue-600 hover:bg-blue-700 gap-2"
          >
            <Save className="w-4 h-4" />
            {updateTenantMutation.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </div>
  );
}