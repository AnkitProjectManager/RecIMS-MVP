import React from "react";
import PropTypes from "prop-types";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { recims } from "@/api/recimsClient";
import TenantHeader from "@/components/TenantHeader";
import { TenantProvider, useTenant } from "@/components/TenantContext";
import { getPagePhaseRequirement } from "@/lib/phaseAccess";
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

const PHASE_LABELS = ['I', 'II', 'III', 'IV', 'V', 'VI'];

const formatPhaseLabel = (phase) => {
  if (!Number.isFinite(phase)) {
    return null;
  }
  const clamped = Math.min(Math.max(Math.floor(phase), 1), PHASE_LABELS.length);
  return `PHASE ${PHASE_LABELS[clamped - 1]}`;
};

export default function Layout({ children, currentPageName }) {
  return (
    <TenantProvider>
      <LayoutShell currentPageName={currentPageName}>{children}</LayoutShell>
    </TenantProvider>
  );
}

Layout.propTypes = {
  children: PropTypes.node,
  currentPageName: PropTypes.string,
};

function LayoutShell({ children, currentPageName }) {
  const [sidebarOpen, setSidebarOpen] = usePersistentState('recims:sidebar-open', true);
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, tenantConfig, loading, phaseAccess, modulePhaseLimit } = useTenant();

  const normalizedCustomPhaseLimit = Number.isFinite(Number(user?.ui_overrides?.maxAllowedPhase))
    ? Math.min(Math.max(Math.floor(Number(user.ui_overrides.maxAllowedPhase)), 1), PHASE_LABELS.length)
    : null;
  const phaseLimit = Number.isFinite(normalizedCustomPhaseLimit)
    ? normalizedCustomPhaseLimit
    : modulePhaseLimit ?? Infinity;
  const hidePhaseBranding = Boolean(user?.ui_overrides?.hidePhaseBranding);
  const hideAccessBanner = Boolean(user?.ui_overrides?.hideAccessBanner);
  const basePhaseLabel = formatPhaseLabel(phaseLimit);
  const accessLevelLabel = user?.ui_overrides?.accessLevelLabel || (hidePhaseBranding ? 'Approved scope' : basePhaseLabel);
  const phaseLimitLabel = accessLevelLabel || basePhaseLabel || 'Approved scope';
  const accessCardTitle = hidePhaseBranding
    ? user?.ui_overrides?.accessCardTitle || 'Access level'
    : 'Phase access';
  const accessCardDescription = hidePhaseBranding
    ? user?.ui_overrides?.accessCardDescription || `Limited to ${phaseLimitLabel}.`
    : `Limited to ${phaseLimitLabel}.`;
  const showAccessBanner = phaseAccess?.isRestricted && !hideAccessBanner;

  const isPhaseAllowed = React.useCallback(
    (phaseLevel) => {
      if (!Number.isFinite(phaseLimit) || phaseLimit <= 0) {
        return true;
      }
      if (!Number.isFinite(phaseLevel)) {
        return true;
      }
      return phaseLevel <= phaseLimit;
    },
    [phaseLimit]
  );

  const requiredPhase = getPagePhaseRequirement(currentPageName);
  const canAccessPage = isPhaseAllowed(requiredPhase);

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
    { name: 'Home', icon: LayoutDashboard, path: 'Home', color: 'text-green-600', phase: 1 },
    { name: 'Dashboard', icon: LayoutDashboard, path: 'Dashboard', color: 'text-green-600', phase: 1 },
    { name: 'Inbound Shipments', icon: TruckIcon, path: 'InboundShipments', color: 'text-blue-600', phase: 1 },
    { name: 'Material Classification', icon: Package, path: 'MaterialClassification', color: 'text-purple-600', phase: 2 },
    { name: 'Quality Control', icon: ClipboardCheck, path: 'QualityControl', color: 'text-orange-600', requiredFeatures: ['enable_qc_module', 'qc_module_enabled'], phase: 4 },
    { name: 'Inventory', icon: Warehouse, path: 'InventoryManagement', color: 'text-teal-600', requiredFeatures: ['enable_inventory_module', 'inventory_module_enabled'], phase: 4 },
    { name: 'Bins', icon: Box, path: 'BinManagement', color: 'text-emerald-600', phase: 2 },
    { name: 'Zones', icon: Grid3x3, path: 'ZoneManagement', color: 'text-lime-600', phase: 2 },
    { name: 'Sales Orders', icon: ShoppingCart, path: 'SalesOrderManagement', color: 'text-indigo-600', phase: 3 },
    { name: 'Sales Activity AI', icon: BarChart3, path: 'AIInsightsModule', color: 'text-purple-600', requiredFeatures: ['enable_ai_insights', 'ai_insights_enabled'], phase: 6 },
    { name: 'Purchase Orders', icon: FileText, path: 'PurchaseOrders', color: 'text-cyan-600', requiredFeatures: ['enable_po_module', 'po_module_enabled'], phase: 3 },
    { name: 'Customers', icon: Users, path: 'CustomerManagement', color: 'text-pink-600', phase: 1 },
    { name: 'Vendors', icon: Building2, path: 'VendorManagement', color: 'text-amber-600', phase: 1 },
    { name: 'Reports', icon: BarChart3, path: 'Reports', color: 'text-red-600', requiredFeatures: ['enable_kpi_dashboard', 'kpi_dashboard_enabled'], phase: 5 },
    { name: 'Settings', icon: Settings, path: 'Settings', color: 'text-gray-600', phase: 3 }
  ]), []);

  const menuItems = React.useMemo(
    () => rawMenuItems.filter((item) => isFeatureEnabled(item.requiredFeatures) && isPhaseAllowed(item.phase ?? 1)),
    [rawMenuItems, isFeatureEnabled, isPhaseAllowed]
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
            {showAccessBanner && (
              <div className={`rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 ${!sidebarOpen ? 'text-center' : ''}`}>
                <p className="font-semibold text-sm">{accessCardTitle}</p>
                <p>{accessCardDescription}</p>
              </div>
            )}
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
          {canAccessPage ? (
            children
          ) : (
            <PhaseRestrictionNotice
              requiredPhase={requiredPhase}
              scopeLabel={phaseLimitLabel}
              hidePhaseBranding={hidePhaseBranding}
            />
          )}
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

LayoutShell.propTypes = {
  children: PropTypes.node,
  currentPageName: PropTypes.string,
};

function PhaseRestrictionNotice({ requiredPhase, scopeLabel, hidePhaseBranding }) {
  const requiredLabel = hidePhaseBranding
    ? `Level ${requiredPhase}`
    : formatPhaseLabel(requiredPhase) || `PHASE ${requiredPhase}`;
  const helpText = hidePhaseBranding
    ? 'Contact your RecIMS administrator if you need access to additional capabilities.'
    : 'Contact your RecIMS administrator if you need access to higher-phase capabilities.';
  return (
    <div className="p-6">
      <div className="rounded-xl border-2 border-amber-200 bg-amber-50 p-6 text-amber-900">
        <h2 className="text-xl font-semibold mb-2">Module locked</h2>
        <p className="mb-2">
          This workspace is limited to {scopeLabel || 'your approved scope'}. {requiredLabel} modules are not available for your account.
        </p>
        <p className="text-sm text-amber-800">{helpText}</p>
      </div>
    </div>
  );
}

PhaseRestrictionNotice.propTypes = {
  requiredPhase: PropTypes.number.isRequired,
  phaseLimitLabel: PropTypes.string.isRequired,
  hidePhaseBranding: PropTypes.bool,
};
