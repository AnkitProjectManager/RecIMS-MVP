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
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, 
  Save, 
  Bell,
  Package,
  DollarSign,
  Calendar,
  AlertTriangle,
  RefreshCw,
  Settings as SettingsIcon
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export default function AlertSettings() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useTenant();
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const { data: settings, isLoading } = useQuery({
    queryKey: ['alertSettings', user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      const existing = await recims.entities.AlertSettings.filter(
        { user_email: user.email },
        '-created_date',
        1
      );
      return existing[0] || null;
    },
    enabled: !!user?.email,
  });

  const [formData, setFormData] = useState({
    low_stock_enabled: true,
    low_stock_threshold_kg: 100,
    low_stock_threshold_percent: 20,
    high_value_enabled: true,
    high_value_threshold: 50000,
    expiration_enabled: true,
    expiration_warning_days: 30,
    reprocessing_enabled: true,
    quarantine_enabled: true,
    in_app_notifications: true,
    push_notifications: false,
    email_notifications: false,
    alert_frequency: 'realtime'
  });

  React.useEffect(() => {
    if (settings) {
      setFormData({
        low_stock_enabled: settings.low_stock_enabled ?? true,
        low_stock_threshold_kg: settings.low_stock_threshold_kg ?? 100,
        low_stock_threshold_percent: settings.low_stock_threshold_percent ?? 20,
        high_value_enabled: settings.high_value_enabled ?? true,
        high_value_threshold: settings.high_value_threshold ?? 50000,
        expiration_enabled: settings.expiration_enabled ?? true,
        expiration_warning_days: settings.expiration_warning_days ?? 30,
        reprocessing_enabled: settings.reprocessing_enabled ?? true,
        quarantine_enabled: settings.quarantine_enabled ?? true,
        in_app_notifications: settings.in_app_notifications ?? true,
        push_notifications: settings.push_notifications ?? false,
        email_notifications: settings.email_notifications ?? false,
        alert_frequency: settings.alert_frequency ?? 'realtime'
      });
    }
  }, [settings]);

  const saveSettingsMutation = useMutation({
    mutationFn: async (data) => {
      if (settings) {
        return await recims.entities.AlertSettings.update(settings.id, data);
      }
      return await recims.entities.AlertSettings.create({
        ...data,
        user_email: user.email,
        tenant_id: user.tenant_id
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alertSettings'] });
      setSuccess("Alert settings saved successfully");
      setTimeout(() => setSuccess(null), 3000);
    },
    onError: (err) => {
      setError("Failed to save settings. Please try again.");
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setError(null);
    saveSettingsMutation.mutate(formData);
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
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
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link to={createPageUrl("Settings")}>
          <Button variant="outline" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Bell className="w-7 h-7 text-green-600" />
            Alert Settings
          </h1>
          <p className="text-sm text-gray-600">Configure inventory alerts and notifications</p>
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

      <form onSubmit={handleSubmit}>
        <Tabs defaultValue="alerts" className="mb-6">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="alerts">Alert Types</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
          </TabsList>

          {/* Alert Types Tab */}
          <TabsContent value="alerts" className="space-y-6 mt-6">
            {/* Low Stock Alerts */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Package className="w-5 h-5 text-orange-600" />
                  Low Stock Alerts
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="low_stock_enabled" className="text-base">Enable Low Stock Alerts</Label>
                    <p className="text-sm text-gray-600">Get notified when inventory falls below threshold</p>
                  </div>
                  <Switch
                    id="low_stock_enabled"
                    checked={formData.low_stock_enabled}
                    onCheckedChange={(checked) => handleChange('low_stock_enabled', checked)}
                  />
                </div>

                {formData.low_stock_enabled && (
                  <div className="space-y-4 pl-4 border-l-2 border-orange-200">
                    <div className="space-y-2">
                      <Label htmlFor="low_stock_threshold_kg">Default Threshold (kg)</Label>
                      <Input
                        id="low_stock_threshold_kg"
                        type="number"
                        value={formData.low_stock_threshold_kg}
                        onChange={(e) => handleChange('low_stock_threshold_kg', parseFloat(e.target.value))}
                        min="0"
                      />
                      <p className="text-xs text-gray-500">Alert when quantity falls below this amount</p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="low_stock_threshold_percent">Threshold Percentage (%)</Label>
                      <Input
                        id="low_stock_threshold_percent"
                        type="number"
                        value={formData.low_stock_threshold_percent}
                        onChange={(e) => handleChange('low_stock_threshold_percent', parseFloat(e.target.value))}
                        min="0"
                        max="100"
                      />
                      <p className="text-xs text-gray-500">Alert when stock falls below this % of reorder point</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* High Value Alerts */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <DollarSign className="w-5 h-5 text-green-600" />
                  High Inventory Value Alerts
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="high_value_enabled" className="text-base">Enable High Value Alerts</Label>
                    <p className="text-sm text-gray-600">Get notified when total inventory value exceeds threshold</p>
                  </div>
                  <Switch
                    id="high_value_enabled"
                    checked={formData.high_value_enabled}
                    onCheckedChange={(checked) => handleChange('high_value_enabled', checked)}
                  />
                </div>

                {formData.high_value_enabled && (
                  <div className="space-y-2 pl-4 border-l-2 border-green-200">
                    <Label htmlFor="high_value_threshold">Value Threshold ($)</Label>
                    <Input
                      id="high_value_threshold"
                      type="number"
                      value={formData.high_value_threshold}
                      onChange={(e) => handleChange('high_value_threshold', parseFloat(e.target.value))}
                      min="0"
                    />
                    <p className="text-xs text-gray-500">Alert when total inventory value exceeds this amount</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Expiration Alerts */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Calendar className="w-5 h-5 text-blue-600" />
                  Expiration Alerts
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="expiration_enabled" className="text-base">Enable Expiration Alerts</Label>
                    <p className="text-sm text-gray-600">Get notified about items nearing expiration</p>
                  </div>
                  <Switch
                    id="expiration_enabled"
                    checked={formData.expiration_enabled}
                    onCheckedChange={(checked) => handleChange('expiration_enabled', checked)}
                  />
                </div>

                {formData.expiration_enabled && (
                  <div className="space-y-2 pl-4 border-l-2 border-blue-200">
                    <Label htmlFor="expiration_warning_days">Warning Period (days)</Label>
                    <Input
                      id="expiration_warning_days"
                      type="number"
                      value={formData.expiration_warning_days}
                      onChange={(e) => handleChange('expiration_warning_days', parseInt(e.target.value))}
                      min="1"
                    />
                    <p className="text-xs text-gray-500">Alert this many days before expiration</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Status Alerts */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <AlertTriangle className="w-5 h-5 text-yellow-600" />
                  Status Alerts
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="reprocessing_enabled" className="text-base">Reprocessing Required</Label>
                    <p className="text-sm text-gray-600">Alert when items are flagged for reprocessing</p>
                  </div>
                  <Switch
                    id="reprocessing_enabled"
                    checked={formData.reprocessing_enabled}
                    onCheckedChange={(checked) => handleChange('reprocessing_enabled', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="quarantine_enabled" className="text-base">Quarantine Status</Label>
                    <p className="text-sm text-gray-600">Alert when items are quarantined</p>
                  </div>
                  <Switch
                    id="quarantine_enabled"
                    checked={formData.quarantine_enabled}
                    onCheckedChange={(checked) => handleChange('quarantine_enabled', checked)}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <SettingsIcon className="w-5 h-5" />
                  Notification Preferences
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
                  <div>
                    <Label htmlFor="in_app_notifications" className="text-base">In-App Notifications</Label>
                    <p className="text-sm text-gray-600">Show alerts within the application</p>
                  </div>
                  <Switch
                    id="in_app_notifications"
                    checked={formData.in_app_notifications}
                    onCheckedChange={(checked) => handleChange('in_app_notifications', checked)}
                  />
                </div>

                <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                  <div>
                    <Label htmlFor="push_notifications" className="text-base">Push Notifications</Label>
                    <p className="text-sm text-gray-600">Send browser/mobile push notifications</p>
                  </div>
                  <Switch
                    id="push_notifications"
                    checked={formData.push_notifications}
                    onCheckedChange={(checked) => handleChange('push_notifications', checked)}
                  />
                </div>

                <div className="flex items-center justify-between p-4 bg-purple-50 rounded-lg">
                  <div>
                    <Label htmlFor="email_notifications" className="text-base">Email Notifications</Label>
                    <p className="text-sm text-gray-600">Send alerts via email to {user?.email}</p>
                  </div>
                  <Switch
                    id="email_notifications"
                    checked={formData.email_notifications}
                    onCheckedChange={(checked) => handleChange('email_notifications', checked)}
                  />
                </div>

                <div className="space-y-2 pt-4">
                  <Label htmlFor="alert_frequency">Alert Frequency</Label>
                  <Select
                    value={formData.alert_frequency}
                    onValueChange={(value) => handleChange('alert_frequency', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="realtime">Real-time (as they occur)</SelectItem>
                      <SelectItem value="daily">Daily Digest</SelectItem>
                      <SelectItem value="weekly">Weekly Summary</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Alert Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Current Configuration</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  <div className={`p-3 rounded-lg ${formData.low_stock_enabled ? 'bg-green-50' : 'bg-gray-50'}`}>
                    <p className="text-sm font-semibold">Low Stock</p>
                    <p className="text-xs text-gray-600">
                      {formData.low_stock_enabled ? `< ${formData.low_stock_threshold_kg} kg` : 'Disabled'}
                    </p>
                  </div>
                  <div className={`p-3 rounded-lg ${formData.high_value_enabled ? 'bg-green-50' : 'bg-gray-50'}`}>
                    <p className="text-sm font-semibold">High Value</p>
                    <p className="text-xs text-gray-600">
                      {formData.high_value_enabled ? `> $${formData.high_value_threshold.toLocaleString()}` : 'Disabled'}
                    </p>
                  </div>
                  <div className={`p-3 rounded-lg ${formData.expiration_enabled ? 'bg-green-50' : 'bg-gray-50'}`}>
                    <p className="text-sm font-semibold">Expiration</p>
                    <p className="text-xs text-gray-600">
                      {formData.expiration_enabled ? `${formData.expiration_warning_days} days` : 'Disabled'}
                    </p>
                  </div>
                  <div className={`p-3 rounded-lg ${formData.reprocessing_enabled ? 'bg-green-50' : 'bg-gray-50'}`}>
                    <p className="text-sm font-semibold">Reprocessing</p>
                    <p className="text-xs text-gray-600">
                      {formData.reprocessing_enabled ? 'Enabled' : 'Disabled'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(createPageUrl("Settings"))}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={saveSettingsMutation.isPending}
            className="flex-1 bg-green-600 hover:bg-green-700 gap-2"
          >
            <Save className="w-4 h-4" />
            {saveSettingsMutation.isPending ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </form>
    </div>
  );
}