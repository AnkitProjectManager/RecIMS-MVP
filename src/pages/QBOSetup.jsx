import React, { useState } from "react";
import { recims } from "@/api/recimsClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTenant } from "@/components/TenantContext";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Building2,
  ArrowLeft,
  Link2,
  Unlink,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Settings,
  Calendar,
  User
} from "lucide-react";
import { format } from "date-fns";

export default function QBOSetup() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { tenantConfig, user } = useTenant();
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const { data: connections = [], isLoading } = useQuery({
    queryKey: ['qboConnections', user?.tenant_id],
    queryFn: async () => {
      if (!user?.tenant_id) return [];
      return await recims.entities.QBOConnection.filter({ tenant_id: user.tenant_id }, '-created_date');
    },
    enabled: !!user?.tenant_id,
    initialData: [],
  });

  const { data: tenants = [] } = useQuery({
    queryKey: ['tenants'],
    queryFn: async () => {
      if (user?.role !== 'admin') return [];
      return await recims.entities.Tenant.list();
    },
    enabled: user?.role === 'admin',
    initialData: [],
  });

  const { data: settings = [] } = useQuery({
    queryKey: ['appSettings'],
    queryFn: () => recims.entities.AppSettings.list(),
    initialData: [],
  });

  const disconnectMutation = useMutation({
    mutationFn: async (connectionId) => {
      return await recims.entities.QBOConnection.update(connectionId, {
        status: 'disconnected',
        access_token: '',
        refresh_token: ''
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['qboConnections'] });
      setSuccess("QuickBooks connection disconnected");
      setTimeout(() => setSuccess(null), 3000);
    },
  });

  const handleConnect = async (tenantId) => {
    try {
      // Call backend function to initiate OAuth flow
      const { data } = await recims.functions.invoke('qboInitiateOAuth', { tenant_id: tenantId });
      
      if (data.authUrl) {
        // Redirect to QBO OAuth
        window.location.href = data.authUrl;
      } else {
        setError("Failed to initiate QuickBooks connection");
      }
    } catch (err) {
      setError(err.message || "Failed to connect to QuickBooks");
    }
  };

  const handleDisconnect = (connection) => {
    if (window.confirm(`Disconnect ${connection.company_name} from QuickBooks? This will stop all syncing.`)) {
      disconnectMutation.mutate(connection.id);
    }
  };

  const handleRefreshToken = async (connection) => {
    try {
      const { data } = await recims.functions.invoke('qboRefreshToken', {
        connectionId: connection.id
      });
      
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ['qboConnections'] });
        setSuccess("Token refreshed successfully");
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error || "Failed to refresh token");
      }
    } catch (err) {
      setError(err.message || "Failed to refresh token");
    }
  };

  const currentTenantConnection = connections.find(c => c.status === 'active');

  const getStatusBadge = (status) => {
    switch(status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-700"><CheckCircle2 className="w-3 h-3 mr-1" />Connected</Badge>;
      case 'expired':
        return <Badge className="bg-yellow-100 text-yellow-700"><AlertCircle className="w-3 h-3 mr-1" />Token Expired</Badge>;
      case 'disconnected':
        return <Badge className="bg-gray-100 text-gray-700"><Unlink className="w-3 h-3 mr-1" />Disconnected</Badge>;
      case 'error':
        return <Badge className="bg-red-100 text-red-700"><AlertCircle className="w-3 h-3 mr-1" />Error</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const isTokenExpiringSoon = (expiresAt) => {
    if (!expiresAt) return false;
    const expiryDate = new Date(expiresAt);
    const now = new Date();
    const hoursUntilExpiry = (expiryDate - now) / (1000 * 60 * 60);
    return hoursUntilExpiry < 24 && hoursUntilExpiry > 0;
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

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link to={createPageUrl("SuperAdmin")}>
          <Button variant="outline" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Settings className="w-7 h-7 text-blue-600" />
            QuickBooks Online Integration
          </h1>
          <p className="text-sm text-gray-600">Connect your QuickBooks company</p>
        </div>
        <Badge className="bg-purple-100 text-purple-700">QBO</Badge>
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

      {/* Current Tenant Connection */}
      <Card className="mb-6 border-2" style={{ borderColor: tenantConfig?.primary_color || '#3b82f6' }}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-6 h-6" style={{ color: tenantConfig?.primary_color || '#3b82f6' }} />
                {tenantConfig?.display_name || 'Your Company'}
              </CardTitle>
              <p className="text-sm text-gray-600 mt-1">
                {tenantConfig?.city}, {tenantConfig?.state_province} • {tenantConfig?.default_currency}
              </p>
            </div>
            {currentTenantConnection ? (
              getStatusBadge(currentTenantConnection.status)
            ) : (
              <Badge className="bg-gray-100 text-gray-700">Not Connected</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {currentTenantConnection ? (
            <div className="space-y-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="grid md:grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-gray-600">QBO Company:</p>
                    <p className="font-semibold text-gray-900">{currentTenantConnection.company_name || 'Connected'}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Realm ID:</p>
                    <p className="font-mono text-xs text-gray-700">{currentTenantConnection.realm_id}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Connected By:</p>
                    <p className="text-gray-900">{currentTenantConnection.connected_by_name || currentTenantConnection.connected_by}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Connected At:</p>
                    <p className="text-gray-900">
                      {format(new Date(currentTenantConnection.connected_at), 'MMM dd, yyyy')}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">Token Expires:</p>
                    <p className={`font-semibold ${
                      isTokenExpiringSoon(currentTenantConnection.token_expires_at) ? 'text-orange-600' : 'text-gray-900'
                    }`}>
                      {format(new Date(currentTenantConnection.token_expires_at), 'MMM dd, yyyy HH:mm')}
                    </p>
                  </div>
                  {currentTenantConnection.last_sync_at && (
                    <div>
                      <p className="text-gray-600">Last Sync:</p>
                      <p className="text-gray-900">
                        {format(new Date(currentTenantConnection.last_sync_at), 'MMM dd, yyyy HH:mm')}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {isTokenExpiringSoon(currentTenantConnection.token_expires_at) && (
                <Alert className="bg-yellow-50 border-yellow-200">
                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                  <AlertDescription className="text-yellow-900 text-sm">
                    {`Access token expires soon. Click "Refresh Token" to renew.`}
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex gap-3">
                <Button
                  onClick={() => handleRefreshToken(currentTenantConnection)}
                  variant="outline"
                  className="flex-1 gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Refresh Token
                </Button>
                <Button
                  onClick={() => handleDisconnect(currentTenantConnection)}
                  variant="outline"
                  className="flex-1 gap-2 text-red-600 hover:text-red-700"
                >
                  <Unlink className="w-4 h-4" />
                  Disconnect
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="bg-blue-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <Link2 className="w-8 h-8 text-blue-600" />
              </div>
              <p className="text-gray-600 mb-4">{tenantConfig?.display_name} is not connected to QuickBooks Online</p>
              <Button
                onClick={() => handleConnect(user?.tenant_id)}
                className="bg-blue-600 hover:bg-blue-700 gap-2"
              >
                <Link2 className="w-4 h-4" />
                Connect to QuickBooks
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Setup Instructions */}
      <Card className="mt-6 bg-gray-50">
        <CardHeader>
          <CardTitle className="text-lg">Setup Instructions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="space-y-2">
            <p className="font-semibold text-gray-900">1. Prerequisites:</p>
            <ul className="list-disc ml-5 space-y-1 text-gray-700">
              <li>QuickBooks Online account for your company</li>
              <li>Admin access to your QBO account</li>
              <li>QBO Developer App credentials (CLIENT_ID and CLIENT_SECRET)</li>
            </ul>
          </div>

          <div className="space-y-2">
            <p className="font-semibold text-gray-900">2. Connection Process:</p>
            <ul className="list-disc ml-5 space-y-1 text-gray-700">
              <li>{'Click "Connect" button above'}</li>
              <li>Log in to your QuickBooks Online account</li>
              <li>Authorize RecIMS to access your QuickBooks data</li>
              <li>{`You'll be redirected back to this page upon success`}</li>
            </ul>
          </div>

          <div className="space-y-2">
            <p className="font-semibold text-gray-900">3. Token Management:</p>
            <ul className="list-disc ml-5 space-y-1 text-gray-700">
              <li>Access tokens expire after 1 hour (auto-refreshed)</li>
              <li>Refresh tokens valid for 100 days</li>
              <li>System will attempt auto-refresh before operations</li>
              <li>Manual refresh available if needed</li>
            </ul>
          </div>

          <Alert className="bg-yellow-50 border-yellow-200">
            <AlertCircle className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-yellow-900 text-xs">
              <strong>Security Note:</strong> OAuth tokens are encrypted at rest. Only admin users can manage QBO connections.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}