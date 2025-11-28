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
import { Badge } from "@/components/ui/badge";
import { 
  Building2,
  Save,
  ArrowLeft,
  Globe,
  DollarSign,
  Palette,
  Upload,
  AlertCircle,
  Settings
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { LOGO_ALLOWED_TYPES, LOGO_MAX_BYTES, uploadTenantLogo } from "@/lib/uploads";

export default function CreateTenant() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoInputRef = React.useRef(null);
  const { toast } = useToast();
  const logoAccept = React.useMemo(() => LOGO_ALLOWED_TYPES.join(','), []);

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    base_subdomain: '',
    status: 'ACTIVE',
    display_name: '',
    business_type: 'general_manufacturing',
    primary_contact_name: '',
    primary_contact_email: '',
    primary_contact_phone: '',
    default_currency: 'USD',
    country_code: 'US',
    region: 'USA',
    phone_number_format: '+1 (XXX) XXX-XXXX',
    unit_system: 'METRIC',
    timezone: 'America/New_York',
    date_format: 'YYYY-MM-DD',
    number_format: { decimal: '.', thousand: ',' },
    branding_primary_color: '#007A6E',
    branding_secondary_color: '#005247',
    branding_logo_url: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state_province: '',
    postal_code: '',
    address_country_code: 'US',
    website: '',
    description: '',
    default_load_types: ['plastic', 'metal', 'mixed'],
    features: {
      po_module_enabled: false,
      bin_capacity_enabled: false,
      photo_upload_enabled: false,
      ai_classification_enabled: false,
      qc_module_enabled: true,
      multi_zone_enabled: false
    },
    api_keys: {
      quickbooks_client_id: '',
      quickbooks_client_secret: '',
      taxjar_api_key: '',
      hellosign_client_id: '',
      hellosign_api_key: '',
      stripe_api_key: '',
      stripe_webhook_secret: ''
    }
  });

  const { data: allTenants = [] } = useQuery({
    queryKey: ['tenants'],
    queryFn: async () => {
      return await recims.entities.Tenant.list();
    },
    initialData: [],
  });

  const createTenantMutation = useMutation({
    mutationFn: async (data) => {
      return await recims.entities.Tenant.create(data);
    },
    onSuccess: (newTenant) => {
  queryClient.invalidateQueries({ queryKey: ['tenants'] });
      navigate(createPageUrl(`ViewTenant?id=${newTenant.id}`));
    },
    onError: (err) => {
      setError(err.message || "Failed to create tenant");
    }
  });

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Auto-populate display_name from name if empty
    if (field === 'name' && !formData.display_name) {
      setFormData(prev => ({ ...prev, display_name: value }));
    }
    
    // Auto-populate code and subdomain from name if empty
    if (field === 'name' && (!formData.code || !formData.base_subdomain)) {
      const slug = value.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!formData.code) {
        setFormData(prev => ({ ...prev, code: slug }));
      }
      if (!formData.base_subdomain) {
        setFormData(prev => ({ ...prev, base_subdomain: slug }));
      }
    }

    // Update phone format based on country
    if (field === 'country_code') {
      const formats = {
        'US': '+1 (XXX) XXX-XXXX',
        'CA': '+1 (XXX) XXX-XXXX',
        'GB': '+44 XXXX XXX XXX',
        'EU': '+XX XXX XXX XXXX'
      };
      setFormData(prev => ({ 
        ...prev, 
        phone_number_format: formats[value] || formats['US']
      }));
    }

    // Update currency based on country
    if (field === 'country_code') {
      const currencies = {
        'US': 'USD',
        'CA': 'CAD',
        'GB': 'GBP',
        'EU': 'EUR'
      };
      setFormData(prev => ({ 
        ...prev, 
        default_currency: currencies[value] || 'USD'
      }));
    }

    // Update timezone based on country
    if (field === 'country_code') {
      const timezones = {
        'US': 'America/New_York',
        'CA': 'America/Toronto',
        'GB': 'Europe/London',
        'EU': 'Europe/Paris'
      };
      setFormData(prev => ({ 
        ...prev, 
        timezone: timezones[value] || 'America/New_York'
      }));
    }
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
      const { fileUrl } = await uploadTenantLogo(file, {
        fileName: `tenant-${formData.code || formData.name || 'logo'}`,
      });
      setFormData(prev => ({ ...prev, branding_logo_url: fileUrl }));
      toast({
        title: 'Logo uploaded',
        description: 'Save the tenant to keep this logo.',
      });
    } catch (err) {
      const message = err?.message || 'Failed to upload logo';
      setError(message);
      toast({
        title: 'Upload failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!formData.name || !formData.code || !formData.base_subdomain) {
      setError("Name, Code, and Base Subdomain are required");
      return;
    }

    if (!/^[a-z0-9]+$/.test(formData.code)) {
      setError("Code must contain only lowercase letters and numbers");
      return;
    }

    if (!/^[a-z0-9-]+$/.test(formData.base_subdomain)) {
      setError("Base Subdomain must contain only lowercase letters, numbers, and hyphens");
      return;
    }

    // Check for duplicate tenant name (case-insensitive)
    const upperCaseName = formData.name?.toUpperCase?.() || '';
    const duplicateName = allTenants.find(t => {
      const tenantName = t?.name?.toUpperCase?.();
      if (!tenantName || !upperCaseName) return false;
      return tenantName === upperCaseName;
    });
    
    if (duplicateName) {
      setError(`A tenant with the name "${duplicateName.name}" already exists. Please choose a different name.`);
      return;
    }

    // Convert name to UPPER CASE before saving
    const dataToSave = {
      ...formData,
      name: upperCaseName || formData.name || '',
      display_name: formData.display_name || formData.name || ''
    };

    createTenantMutation.mutate(dataToSave);
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Button
          variant="outline"
          size="icon"
          onClick={() => navigate(createPageUrl("TenantConsole"))}
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Building2 className="w-7 h-7 text-green-600" />
            Create New Tenant
          </h1>
          <p className="text-sm text-gray-600">Configure a new tenant organization</p>
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
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Company Name *</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => handleChange('name', e.target.value)}
                      placeholder="Acme Logistics Inc."
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Display Name *</Label>
                    <Input
                      value={formData.display_name}
                      onChange={(e) => handleChange('display_name', e.target.value)}
                      placeholder="Acme Logistics"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Tenant Code *</Label>
                    <Input
                      value={formData.code}
                      onChange={(e) => handleChange('code', e.target.value.toLowerCase())}
                      placeholder="acme"
                      required
                    />
                    <p className="text-xs text-gray-500">Lowercase letters and numbers only</p>
                  </div>

                  <div className="space-y-2">
                    <Label>Base Subdomain *</Label>
                    <Input
                      value={formData.base_subdomain}
                      onChange={(e) => handleChange('base_subdomain', e.target.value.toLowerCase())}
                      placeholder="acme"
                      required
                    />
                    <p className="text-xs text-gray-500">Will map to: {formData.base_subdomain || 'subdomain'}.yourapp.com</p>
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
                    placeholder="Brief description of tenant operations..."
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
                        placeholder="John Doe"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Contact Email</Label>
                      <Input
                        type="email"
                        value={formData.primary_contact_email}
                        onChange={(e) => handleChange('primary_contact_email', e.target.value)}
                        placeholder="john@company.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Contact Phone</Label>
                      <Input
                        value={formData.primary_contact_phone}
                        onChange={(e) => handleChange('primary_contact_phone', e.target.value)}
                        placeholder="+1 (555) 123-4567"
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
                        placeholder="123 Main Street"
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>Address Line 2</Label>
                      <Input
                        value={formData.address_line2}
                        onChange={(e) => handleChange('address_line2', e.target.value)}
                        placeholder="Suite 100"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>City</Label>
                      <Input
                        value={formData.city}
                        onChange={(e) => handleChange('city', e.target.value)}
                        placeholder="New York"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>State/Province</Label>
                      <Input
                        value={formData.state_province}
                        onChange={(e) => handleChange('state_province', e.target.value)}
                        placeholder="NY"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Postal Code</Label>
                      <Input
                        value={formData.postal_code}
                        onChange={(e) => handleChange('postal_code', e.target.value)}
                        placeholder="10001"
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
                        placeholder="https://company.com"
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
                <CardTitle className="flex items-center gap-2">
                  <Globe className="w-5 h-5" />
                  Locale & Formatting
                </CardTitle>
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
                        <SelectItem value="METRIC">Metric (kg, km, °C)</SelectItem>
                        <SelectItem value="IMPERIAL">Imperial (lbs, miles, °F)</SelectItem>
                        <SelectItem value="CUSTOM">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Timezone *</Label>
                    <Input
                      value={formData.timezone}
                      onChange={(e) => handleChange('timezone', e.target.value)}
                      placeholder="America/Toronto"
                    />
                    <p className="text-xs text-gray-500">IANA timezone format</p>
                  </div>

                  <div className="space-y-2">
                    <Label>Date Format *</Label>
                    <Select value={formData.date_format} onValueChange={(value) => handleChange('date_format', value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="YYYY-MM-DD">YYYY-MM-DD (ISO)</SelectItem>
                        <SelectItem value="MM/DD/YYYY">MM/DD/YYYY (US)</SelectItem>
                        <SelectItem value="DD/MM/YYYY">DD/MM/YYYY (EU)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Phone Number Format</Label>
                    <Input
                      value={formData.phone_number_format}
                      onChange={(e) => handleChange('phone_number_format', e.target.value)}
                      placeholder="+1 (XXX) XXX-XXXX"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="branding">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="w-5 h-5" />
                  Branding & Appearance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Company Logo</Label>
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
                  <p className="text-xs text-gray-500">
                    Supported: PNG, JPG, SVG, WebP · Max {(LOGO_MAX_BYTES / (1024 * 1024)).toFixed(0)}MB
                  </p>
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
                        placeholder="#007A6E"
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
                        placeholder="#005247"
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
                    <strong>Security Notice:</strong> API keys are sensitive. Store them securely and never share them publicly.
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
                {Object.entries(formData.features).map(([key, value]) => (
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
            onClick={() => navigate(createPageUrl("TenantConsole"))}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={createTenantMutation.isPending}
            className="flex-1 bg-green-600 hover:bg-green-700 gap-2"
          >
            <Save className="w-4 h-4" />
            {createTenantMutation.isPending ? 'Creating...' : 'Create Tenant'}
          </Button>
        </div>
      </form>
    </div>
  );
}