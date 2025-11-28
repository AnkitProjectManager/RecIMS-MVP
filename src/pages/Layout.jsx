import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { recims } from "@/api/recimsClient";
import TenantHeader from "@/components/TenantHeader";
import { TenantProvider, useTenant } from "@/components/TenantContext";
import { useQueryClient } from "@tanstack/react-query";
import { usePersistentState } from "@/hooks/usePersistentState";
import {
  LayoutDashboard,
  TruckIcon,
  Package,
  FileText,
  ClipboardCheck,
  Warehouse,
  BarChart3,
  Settings,
  ShoppingCart,
  Users,
  Building2,
  Menu,
  X,
  ChevronRight,
  Box,
  Grid3x3
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Layout({ children, currentPageName }) {
  return (
    <TenantProvider>
      <LayoutShell currentPageName={currentPageName}>{children}</LayoutShell>
    </TenantProvider>
  );
}

function LayoutShell({ children, currentPageName }) {
  const [sidebarOpen, setSidebarOpen] = usePersistentState('recims:sidebar-open', true);
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, tenantConfig, loading } = useTenant();

  const normalizedFeatures = React.useMemo(
    () => tenantConfig?.features ?? {},
    [tenantConfig?.features]
  );

  const handleLogout = React.useCallback(async () => {
    try {
      await recims.auth.logout();
    } catch (error) {
      console.error("Logout failed", error);
    } finally {
      queryClient.clear();
      navigate('/Login', { replace: true });
    }
  }, [navigate, queryClient]);

  const isFeatureEnabled = React.useCallback(
    (requirements) => {
      if (!requirements) return true;
      if (loading) return true;
      const keys = Array.isArray(requirements) ? requirements : [requirements];
      return keys.some((key) => normalizedFeatures[key]);
    },
    [normalizedFeatures, loading]
  );

  const rawMenuItems = React.useMemo(() => ([
    { name: 'Home', icon: LayoutDashboard, path: 'Home', color: 'text-green-600' },
    { name: 'Dashboard', icon: LayoutDashboard, path: 'Dashboard', color: 'text-green-600' },
    { name: 'Inbound Shipments', icon: TruckIcon, path: 'InboundShipments', color: 'text-blue-600' },
    { name: 'Material Classification', icon: Package, path: 'MaterialClassification', color: 'text-purple-600' },
    { name: 'Quality Control', icon: ClipboardCheck, path: 'QualityControl', color: 'text-orange-600', requiredFeatures: ['enable_qc_module', 'qc_module_enabled'] },
    { name: 'Inventory', icon: Warehouse, path: 'InventoryManagement', color: 'text-teal-600', requiredFeatures: ['enable_inventory_module', 'inventory_module_enabled'] },
    { name: 'Bins', icon: Box, path: 'BinManagement', color: 'text-emerald-600' },
    { name: 'Zones', icon: Grid3x3, path: 'ZoneManagement', color: 'text-lime-600' },
    { name: 'Sales Orders', icon: ShoppingCart, path: 'SalesOrderManagement', color: 'text-indigo-600' },
    { name: 'Sales Activity AI', icon: BarChart3, path: 'AIInsightsModule', color: 'text-purple-600', requiredFeatures: ['enable_ai_insights', 'ai_insights_enabled'] },
    { name: 'Purchase Orders', icon: FileText, path: 'PurchaseOrders', color: 'text-cyan-600', requiredFeatures: ['enable_po_module', 'po_module_enabled'] },
    { name: 'Customers', icon: Users, path: 'CustomerManagement', color: 'text-pink-600' },
    { name: 'Vendors', icon: Building2, path: 'VendorManagement', color: 'text-amber-600' },
    { name: 'Reports', icon: BarChart3, path: 'Reports', color: 'text-red-600', requiredFeatures: ['enable_kpi_dashboard', 'kpi_dashboard_enabled'] },
    { name: 'Settings', icon: Settings, path: 'Settings', color: 'text-gray-600' }
  ]), []);

  const menuItems = React.useMemo(
    () => rawMenuItems.filter((item) => isFeatureEnabled(item.requiredFeatures)),
    [rawMenuItems, isFeatureEnabled]
  );

  const normalizedRole = typeof user?.role === 'string' ? user.role.toLowerCase() : '';
  const normalizedDetailedRole = typeof user?.detailed_role === 'string' ? user.detailed_role.toLowerCase() : '';
  const hasAdminAccess = [normalizedRole, normalizedDetailedRole].some((roleValue) =>
    ['admin', 'super_admin', 'superadmin'].includes(roleValue)
  );

  const isActivePage = (pageName) => currentPageName === pageName;

  return (
    <div className="min-h-screen bg-gray-50">
      <TenantHeader onLogout={handleLogout} />
      <div className="flex">
        {/* Mobile Menu Button */}
        <Button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="fixed top-20 left-4 z-50 md:hidden bg-white border shadow-lg"
          size="icon"
          variant="outline"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </Button>

        {/* Sidebar */}
        <aside
          className={`
            fixed top-16 left-0 h-[calc(100vh-4rem)] bg-white border-r shadow-sm transition-all duration-300 z-40
            ${sidebarOpen ? 'w-64' : 'w-20'}
            ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          `}
        >
          {/* Toggle Button - Desktop */}
          <Button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="hidden md:flex absolute -right-3 top-6 bg-white border shadow-md rounded-full p-0"
            size="icon"
            variant="outline"
          >
            <ChevronRight className={`w-4 h-4 transition-transform ${sidebarOpen ? 'rotate-180' : ''}`} />
          </Button>

          {/* Navigation Menu */}
          <nav className="p-4 space-y-2 overflow-y-auto h-full">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = isActivePage(item.path);

              return (
                <Link key={item.path} to={createPageUrl(item.path)}>
                  <div
                    className={`
                      flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all cursor-pointer
                      ${isActive
                        ? 'bg-green-600 text-white shadow-md'
                        : 'hover:bg-gray-100 text-gray-700'
                      }
                      ${!sidebarOpen && 'justify-center'}
                    `}
                    title={!sidebarOpen ? item.name : ''}
                  >
                    <Icon className={`w-5 h-5 ${isActive ? 'text-white' : item.color}`} />
                    {sidebarOpen && (
                      <span className="font-medium text-sm">{item.name}</span>
                    )}
                  </div>
                </Link>
              );
            })}

            {/* Super Admin Links - Only for admins */}
            {hasAdminAccess && (
              <>
                <div className="border-t my-3"></div>
                <Link to={createPageUrl('SuperAdmin')}>
                  <div
                    className={`
                      flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all cursor-pointer
                      ${isActivePage('SuperAdmin')
                        ? 'bg-red-600 text-white shadow-md'
                        : 'hover:bg-red-50 text-red-600 border border-red-200'
                      }
                      ${!sidebarOpen && 'justify-center'}
                    `}
                    title={!sidebarOpen ? 'Super Admin' : ''}
                  >
                    <Settings className="w-5 h-5" />
                    {sidebarOpen && (
                      <span className="font-medium text-sm">Super Admin</span>
                    )}
                  </div>
                </Link>
                <Link to={createPageUrl('TenantConsole')}>
                  <div
                    className={`
                      flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all cursor-pointer
                      ${isActivePage('TenantConsole')
                        ? 'bg-red-600 text-white shadow-md'
                        : 'hover:bg-red-50 text-red-600 border border-red-200'
                      }
                      ${!sidebarOpen && 'justify-center'}
                    `}
                    title={!sidebarOpen ? 'Tenant Console' : ''}
                  >
                    <Building2 className="w-5 h-5" />
                    {sidebarOpen && (
                      <span className="font-medium text-sm">Tenant Console</span>
                    )}
                  </div>
                </Link>
                <Link to={createPageUrl('ManageTenantCategories')}>
                  <div
                    className={`
                      flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all cursor-pointer
                      ${isActivePage('ManageTenantCategories')
                        ? 'bg-red-600 text-white shadow-md'
                        : 'hover:bg-red-50 text-red-600 border border-red-200'
                      }
                      ${!sidebarOpen && 'justify-center'}
                    `}
                    title={!sidebarOpen ? 'Tenant Categories' : ''}
                  >
                    <Settings className="w-5 h-5" />
                    {sidebarOpen && (
                      <span className="font-medium text-sm">Tenant Categories</span>
                    )}
                  </div>
                </Link>
              </>
            )}
          </nav>
        </aside>

        {/* Main Content */}
        <main
          className={`
            flex-1 transition-all duration-300
            ${sidebarOpen ? 'md:ml-64' : 'md:ml-20'}
            pt-4
          `}
        >
          {children}
        </main>
      </div>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
    </div>
  );
}
