import React from "react";
import { recims } from "@/api/recimsClient";
import { useQuery } from "@tanstack/react-query";
import { useTenant } from "@/components/TenantContext";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { User, LogOut, Settings as SettingsIcon, ArrowLeft, Building2, Mail, Shield, Bell, MapPin } from "lucide-react";
import PushNotifications from "@/components/pwa/PushNotifications";

export default function Settings() {
  const { tenantConfig, user } = useTenant();
  const [isInstalled, setIsInstalled] = React.useState(false);

  React.useEffect(() => {
    // Check if app is installed
    const isPWA = window.matchMedia('(display-mode: standalone)').matches 
      || window.navigator.standalone 
      || document.referrer.includes('android-app://');
    setIsInstalled(isPWA);
  }, []);

  const { data: activeShift } = useQuery({
    queryKey: ['activeShift', user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      const shifts = await recims.entities.ShiftLog.filter({ 
        operator_email: user.email, 
        status: 'active' 
      }, '-created_date', 1);
      return shifts[0] || null;
    },
    enabled: !!user?.email,
    initialData: null,
  });

  const { data: completedShifts = [] } = useQuery({
    queryKey: ['completedShifts', user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      return await recims.entities.ShiftLog.filter({ 
        operator_email: user.email, 
        status: 'completed' 
      }, '-created_date', 10);
    },
    enabled: !!user?.email,
    initialData: [],
  });

  const handleLogout = async () => {
    await recims.auth.logout();
  };

  // Define permissions based on user role or other user attributes
  // For demonstration, assuming 'admin' or 'super_admin' role grants 'canManageSettings'
  const permissions = {
    canManageSettings: user?.role === 'admin' || user?.role === 'super_admin',
    canAccessSuperAdmin: user?.role === 'super_admin',
    // Add other permissions here as needed, e.g., from user.permissions array
  };

  const settingsCards = [
    {
      icon: null,
      title: "New Inbound Shipment",
      description: "Start a new inbound shipment process",
      path: createPageUrl("NewShipment"),
      color: "bg-gray-50",
    },
    {
      icon: null,
      title: "Classify Materials",
      description: "Classify and categorize incoming materials",
      path: createPageUrl("MaterialClassification"),
      color: "bg-gray-50",
    },
    {
      icon: null,
      title: "Manage Bins",
      description: "Organize and track material bins",
      path: createPageUrl("BinManagement"),
      color: "bg-gray-50",
    },
    {
      icon: null,
      title: "View Reports",
      description: "Access various operational reports",
      path: createPageUrl("Reports"),
      color: "bg-gray-50",
    },
    {
      icon: Bell,
      title: "Alert Settings",
      description: "Configure your notification preferences",
      path: createPageUrl("AlertSettings"),
      color: "bg-gray-50",
      iconColor: "text-gray-600",
    },
    {
      icon: Mail,
      title: "Email Templates",
      description: "Configure email templates for POs and invoices",
      path: createPageUrl("EmailTemplates"),
      badge: "PHASE IV",
      badgeColor: "bg-purple-600",
      color: "bg-blue-100",
      iconColor: "text-blue-600",
      permission: 'canManageSettings'
    },
    {
      icon: MapPin,
      title: "Zone Management",
      description: "Configure warehouse zones for bin organization",
      path: createPageUrl("ZoneManagement"),
      badge: "PHASE II+",
      badgeColor: "bg-blue-600",
      color: "bg-purple-100",
      iconColor: "text-purple-600",
      permission: 'canAccessSuperAdmin'
    },
  ].filter(card => !card.permission || permissions[card.permission]);

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
      <div className="sticky top-12 z-40 bg-white py-4 -mt-4 mb-6">
        <div className="flex items-center gap-3">
          <Link to={createPageUrl("Dashboard")}>
            <Button variant="outline" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
            <p className="text-sm text-gray-600">Manage your profile and preferences</p>
          </div>
        </div>
      </div>

      {/* User Profile */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Profile Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="bg-green-100 p-3 rounded-full">
                <User className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">{user.full_name}</p>
                <p className="text-sm text-gray-600 flex items-center gap-1">
                  <Mail className="w-3 h-3" />
                  {user.email}
                </p>
              </div>
            </div>
            <Badge className="bg-green-100 text-green-700 border-green-300">
              <Shield className="w-3 h-3 mr-1" />
              {user.role}
            </Badge>
          </div>

          {tenantConfig && (
            <div className="flex items-center gap-2 p-4 bg-blue-50 rounded-lg">
              <Building2 className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-sm text-gray-600">Organization</p>
                <p className="font-semibold text-gray-900">
                  {tenantConfig.display_name}
                </p>
              </div>
            </div>
          )}

          {isInstalled && (
            <div className="flex items-center gap-2 p-4 bg-purple-50 rounded-lg">
              <SettingsIcon className="w-5 h-5 text-purple-600" />
              <div>
                <p className="text-sm text-gray-600">Installation Status</p>
                <p className="font-semibold text-purple-900">PWA Installed</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Push Notifications */}
      {isInstalled && (
        <div className="mb-6">
          <PushNotifications user={user} />
        </div>
      )}

      {/* Shift Information */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Shift Information</CardTitle>
        </CardHeader>
        <CardContent>
          {activeShift ? (
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-center justify-between mb-2">
                <p className="font-semibold text-green-900">Active Shift</p>
                <Badge className="bg-green-600 text-white">In Progress</Badge>
              </div>
              <p className="text-sm text-gray-600">
                Started: {new Date(activeShift.shift_start).toLocaleString()}
              </p>
              <div className="grid grid-cols-3 gap-4 mt-4">
                <div>
                  <p className="text-xs text-gray-600">Shipments</p>
                  <p className="text-lg font-bold">{activeShift.shipments_processed || 0}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">Materials</p>
                  <p className="text-lg font-bold">{activeShift.materials_classified || 0}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">Bins</p>
                  <p className="text-lg font-bold">{activeShift.bins_assigned || 0}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-gray-50 rounded-lg text-center text-gray-600">
              <p>No active shift</p>
            </div>
          )}

          {completedShifts.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-semibold text-gray-700 mb-2">Recent Shifts</p>
              <div className="space-y-2">
                {completedShifts.slice(0, 5).map((shift) => (
                  <div key={shift.id} className="p-3 bg-gray-50 rounded-lg text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">
                        {new Date(shift.shift_start).toLocaleDateString()}
                      </span>
                      <span className="font-semibold">
                        {shift.shipments_processed || 0} shipments
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Links / Settings Cards */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Quick Links</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {settingsCards.map((card) => (
              <Link to={card.path} key={card.title} className="block">
                <Button 
                  variant="outline" 
                  className={`w-full justify-start h-auto p-3 text-left ${card.color || ''}`}
                >
                  <div className="flex items-center gap-3 w-full">
                    {card.icon && <card.icon className={`w-5 h-5 ${card.iconColor || 'text-gray-600'}`} />}
                    <div className="flex-grow">
                      <p className="font-semibold text-gray-900">{card.title}</p>
                      {card.description && <p className="text-sm text-gray-600">{card.description}</p>}
                    </div>
                    {card.badge && (
                      <Badge className={`${card.badgeColor} text-white`}>
                        {card.badge}
                      </Badge>
                    )}
                  </div>
                </Button>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Logout */}
      <Button
        onClick={handleLogout}
        variant="outline"
        className="w-full border-red-300 text-red-600 hover:bg-red-50 gap-2"
      >
        <LogOut className="w-4 h-4" />
        Logout
      </Button>
    </div>
  );
}