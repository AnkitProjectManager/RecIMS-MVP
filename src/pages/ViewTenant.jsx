import React, { useState } from "react";
import { recims } from "@/api/recimsClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Building2,
  ArrowLeft,
  Edit,
  Users,
  Globe,
  DollarSign,
  Palette,
  Settings,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { safeFormatDate } from "@/lib/utils";

export default function ViewTenant() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const urlParams = new URLSearchParams(window.location.search);
  const tenantIdParam = urlParams.get('id');

  const resolvedTenantId = React.useMemo(() => {
    if (!tenantIdParam) return null;
    const numeric = Number(tenantIdParam);
    return Number.isInteger(numeric) ? numeric : tenantIdParam;
  }, [tenantIdParam]);

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

  const { data: tenantUsers = [] } = useQuery({
    queryKey: ['tenantUsers', tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return [];
      return await recims.entities.User.filter({ tenant_id: tenant.id });
    },
    enabled: !!tenant?.id,
    initialData: [],
  });

  const suspendTenantMutation = useMutation({
    mutationFn: async (newStatus) => {
      return await recims.entities.Tenant.update(tenant.id, {
        status: newStatus
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant', resolvedTenantId] });
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      setSuccess("Tenant status updated successfully");
      setTimeout(() => setSuccess(null), 3000);
    },
    onError: (err) => {
      setError("Failed to update tenant status");
      setTimeout(() => setError(null), 3000);
    }
  });

  const handleSuspend = () => {
    const newStatus = tenant.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    const action = newStatus === 'SUSPENDED' ? 'suspend' : 'reactivate';
    
    if (window.confirm(`Are you sure you want to ${action} ${tenant.name}? This will ${newStatus === 'SUSPENDED' ? 'prevent users from logging in' : 'restore full access'}.`)) {
      suspendTenantMutation.mutate(newStatus);
    }
  };

  const getStatusBadge = (status) => {
    switch(status) {
      case 'ACTIVE':
        return <Badge className="bg-green-100 text-green-700 text-lg px-4 py-2"><CheckCircle className="w-4 h-4 mr-1" />Active</Badge>;
      case 'SUSPENDED':
        return <Badge className="bg-red-100 text-red-700 text-lg px-4 py-2"><XCircle className="w-4 h-4 mr-1" />Suspended</Badge>;
      case 'DELETED':
        return <Badge className="bg-gray-100 text-gray-700 text-lg px-4 py-2">Deleted</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading tenant...</p>
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
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link to={createPageUrl("TenantConsole")}>
          <Button variant="outline" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            {tenant.branding_logo_url && (
              <img src={tenant.branding_logo_url} alt="" className="w-8 h-8 object-contain" />
            )}
            {tenant.name}
          </h1>
          <p className="text-sm text-gray-600">Tenant Configuration Details</p>
        </div>
        <div className="flex gap-2">
          <Link to={createPageUrl(`EditTenant?id=${tenant.id}`)}>
            <Button variant="outline" className="gap-2">
              <Edit className="w-4 h-4" />
              Edit
            </Button>
          </Link>
          <Link to={createPageUrl(`TenantUsers?tenant_id=${tenant.id}`)}>
            <Button variant="outline" className="gap-2">
              <Users className="w-4 h-4" />
              Manage Users
            </Button>
          </Link>
          <Button
            onClick={handleSuspend}
            disabled={suspendTenantMutation.isPending}
            variant={tenant.status === 'ACTIVE' ? 'destructive' : 'default'}
            className="gap-2"
          >
            {tenant.status === 'ACTIVE' ? (
              <>
                <XCircle className="w-4 h-4" />
                Suspend
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                Reactivate
              </>
            )}
          </Button>
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

      {/* Status Banner */}
      <div className="mb-6 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border-2 border-blue-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 mb-1">Current Status</p>
            {getStatusBadge(tenant.status)}
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-600">Subdomain</p>
            <p className="font-mono text-lg font-bold text-blue-600">
              {tenant.base_subdomain}.yourapp.com
            </p>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* General Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              General Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm text-gray-600">Company Name</p>
              <p className="font-semibold">{tenant.name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Display Name</p>
              <p className="font-semibold">{tenant.display_name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Tenant Code</p>
              <p className="font-mono font-semibold">{tenant.code}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Base Subdomain</p>
              <p className="font-mono font-semibold text-blue-600">{tenant.base_subdomain}</p>
            </div>
            {tenant.business_type && (
              <div>
                <p className="text-sm text-gray-600">Business Type</p>
                <Badge variant="outline">{tenant.business_type.replace(/_/g, ' ')}</Badge>
              </div>
            )}
            {tenant.description && (
              <div>
                <p className="text-sm text-gray-600">Description</p>
                <p className="text-sm">{tenant.description}</p>
              </div>
            )}
            <div className="border-t pt-3">
              <p className="text-xs text-gray-500">Created: {safeFormatDate(tenant.created_date, 'MMM dd, yyyy HH:mm')}</p>
              <p className="text-xs text-gray-500">Updated: {safeFormatDate(tenant.updated_date, 'MMM dd, yyyy HH:mm')}</p>
            </div>
          </CardContent>
        </Card>

        {/* Locale & Formatting */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5" />
              Locale & Formatting
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm text-gray-600">Country / Region</p>
              <p className="font-semibold">{tenant.country_code} • {tenant.region}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Timezone</p>
              <p className="font-semibold">{tenant.timezone}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Date Format</p>
              <p className="font-semibold">{tenant.date_format}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Phone Format</p>
              <p className="font-mono text-sm">{tenant.phone_number_format || 'Not set'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Number Format</p>
              <p className="font-mono text-sm">
                Decimal: {tenant.number_format?.decimal || '.'} | 
                Thousand: {tenant.number_format?.thousand || ','}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Finance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Finance & Units
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm text-gray-600">Default Currency</p>
              <p className="font-semibold text-lg">{tenant.default_currency}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Unit System</p>
              <Badge variant="outline" className="text-sm">
                {tenant.unit_system}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Contact Info */}
        <Card>
          <CardHeader>
            <CardTitle>Primary Contact</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {tenant.primary_contact_name && (
              <div>
                <p className="text-sm text-gray-600">Name</p>
                <p className="font-semibold">{tenant.primary_contact_name}</p>
              </div>
            )}
            {tenant.primary_contact_email && (
              <div>
                <p className="text-sm text-gray-600">Email</p>
                <p className="text-blue-600">{tenant.primary_contact_email}</p>
              </div>
            )}
            {tenant.primary_contact_phone && (
              <div>
                <p className="text-sm text-gray-600">Phone</p>
                <p>{tenant.primary_contact_phone}</p>
              </div>
            )}
            {(!tenant.primary_contact_name && !tenant.primary_contact_email && !tenant.primary_contact_phone) && (
              <p className="text-sm text-gray-500">No contact information set</p>
            )}
          </CardContent>
        </Card>

        {/* Branding */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="w-5 h-5" />
              Branding
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4">
              {tenant.branding_logo_url && (
                <div>
                  <p className="text-sm text-gray-600 mb-2">Logo</p>
                  <img
                    src={tenant.branding_logo_url}
                    alt="Logo"
                    className="w-32 h-32 object-contain border rounded-lg"
                  />
                </div>
              )}
              <div>
                <p className="text-sm text-gray-600 mb-2">Primary Color</p>
                <div className="flex items-center gap-2">
                  <div
                    className="w-16 h-16 rounded-lg border"
                    style={{ backgroundColor: tenant.branding_primary_color || '#007A6E' }}
                  />
                  <p className="font-mono text-sm">{tenant.branding_primary_color}</p>
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-2">Secondary Color</p>
                <div className="flex items-center gap-2">
                  <div
                    className="w-16 h-16 rounded-lg border"
                    style={{ backgroundColor: tenant.branding_secondary_color || '#005247' }}
                  />
                  <p className="font-mono text-sm">{tenant.branding_secondary_color}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Users Summary */}
        <Card className="md:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Users Summary
              </CardTitle>
              <Link to={createPageUrl(`TenantUsers?tenant_id=${tenant.id}`)}>
                <Button variant="outline" size="sm" className="gap-2">
                  <Users className="w-4 h-4" />
                  Manage Users
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-gray-600">Admin Users</p>
                <p className="text-2xl font-bold text-blue-600">
                  {tenantUsers.filter(u => u.role === 'admin').length}
                </p>
              </div>
              <div className="p-4 bg-green-50 rounded-lg">
                <p className="text-sm text-gray-600">Regular Users</p>
                <p className="text-2xl font-bold text-green-600">
                  {tenantUsers.filter(u => u.role === 'user').length}
                </p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">Total Users</p>
                <p className="text-2xl font-bold text-gray-900">
                  {tenantUsers.length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* API Keys */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              API Configuration
            </CardTitle>
          </CardHeader>
          <CardContent>
            {tenant.api_keys ? (
              <div className="space-y-3">
                <Alert className="bg-blue-50 border-blue-200">
                  <AlertCircle className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-blue-800 text-sm">
                    API keys are configured. Values are hidden for security.
                  </AlertDescription>
                </Alert>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs font-semibold text-gray-600">QuickBooks Online</p>
                    <p className="text-sm mt-1">
                      {tenant.api_keys.quickbooks_client_id ? '✓ Configured' : '✗ Not Set'}
                    </p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs font-semibold text-gray-600">TaxJar</p>
                    <p className="text-sm mt-1">
                      {tenant.api_keys.taxjar_api_key ? '✓ Configured' : '✗ Not Set'}
                    </p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs font-semibold text-gray-600">HelloSign</p>
                    <p className="text-sm mt-1">
                      {tenant.api_keys.hellosign_client_id ? '✓ Configured' : '✗ Not Set'}
                    </p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs font-semibold text-gray-600">Stripe</p>
                    <p className="text-sm mt-1">
                      {tenant.api_keys.stripe_api_key ? '✓ Configured' : '✗ Not Set'}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500">No API keys configured</p>
            )}
          </CardContent>
        </Card>

        {/* Features */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Enabled Features
            </CardTitle>
          </CardHeader>
          <CardContent>
            {tenant.features ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {Object.entries(tenant.features).map(([key, value]) => (
                  <div key={key} className={`p-3 rounded-lg ${value ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'}`}>
                    <p className="text-xs font-semibold text-gray-700">
                      {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()).replace(' Enabled', '')}
                    </p>
                    <Badge className={`mt-1 text-xs ${value ? 'bg-green-600 text-white' : 'bg-gray-400 text-white'}`}>
                      {value ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No features configured</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}