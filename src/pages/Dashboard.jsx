import React from "react";
import PropTypes from "prop-types";
import { recims } from "@/api/recimsClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  TruckIcon,
  Package,
  Warehouse,
  Clock,
  TrendingUp,
  PlayCircle,
  StopCircle,
  AlertCircle,
  BarChart3,
  RefreshCw,
  Printer,
  DollarSign,
  MessageCircle
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format, subDays, differenceInMinutes } from "date-fns";
import { useTenant } from "@/components/TenantContext";
import { getThemePalette, withAlpha } from "@/lib/theme";
import { formatUSD } from "@/lib/utils";
import { getPagePhaseRequirement } from "@/lib/phaseAccess";

const parseDateSafe = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export default function Dashboard() {
  const [user, setUser] = React.useState(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState(null);
  const [debugInfo, setDebugInfo] = React.useState([]);

  const addDebugInfo = (message) => {
    setDebugInfo(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  React.useEffect(() => {
    const loadUser = async () => {
      addDebugInfo('Starting to load user...');
      setIsLoading(true);
      setLoadError(null);
      
      try {
        addDebugInfo('Calling recims.auth.me()...');
        const currentUser = await recims.auth.me();
        addDebugInfo(`User loaded: ${currentUser.email}`);
        
        // Ensure user has required fields with defaults
        if (!currentUser.tenant) {
          addDebugInfo('Setting default tenant: min_tech');
          currentUser.tenant = 'min_tech';
        }
        if (!currentUser.detailed_role) {
          addDebugInfo('Setting default role: warehouse_staff');
          currentUser.detailed_role = 'warehouse_staff';
        }
        if (!currentUser.permissions) {
          addDebugInfo('Setting default permissions: []');
          currentUser.permissions = [];
        }
        
        addDebugInfo('User setup complete!');
        setUser(currentUser);
        setIsLoading(false);
      } catch (error) {
        const errorMsg = error.message || error.toString();
        addDebugInfo(`ERROR: ${errorMsg}`);
        console.error("Dashboard: User authentication error:", error);
        setLoadError(errorMsg);
        setIsLoading(false);
      }
    };
    loadUser();
  }, []);

  // Show loading state FIRST
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center max-w-2xl p-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-900 font-semibold mb-4">Loading dashboard...</p>
          
          {/* Debug info */}
          <div className="mt-6 bg-white border rounded-lg p-4 text-left">
            <p className="text-xs font-semibold text-gray-700 mb-2">Loading Status:</p>
            <div className="space-y-1 max-h-60 overflow-auto">
              {debugInfo.map((info, idx) => (
                <p key={idx} className="text-xs text-gray-600 font-mono">{info}</p>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show error state SECOND
  if (loadError) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
        <div className="text-center max-w-2xl">
          <AlertCircle className="w-16 h-16 text-red-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Failed to Load Dashboard</h2>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <p className="text-red-800 font-mono text-sm">{loadError}</p>
          </div>
          
          {/* Debug info */}
          <div className="bg-white border rounded-lg p-4 text-left mb-4">
            <p className="text-xs font-semibold text-gray-700 mb-2">Debug Log:</p>
            <div className="space-y-1 max-h-60 overflow-auto">
              {debugInfo.map((info, idx) => (
                <p key={idx} className="text-xs text-gray-600 font-mono">{info}</p>
              ))}
            </div>
          </div>
          
          <div className="space-y-2">
            <Button onClick={() => window.location.reload()} className="w-full">
              <RefreshCw className="w-4 h-4 mr-2" />
              Reload Page
            </Button>
            <p className="text-xs text-gray-500">
              If this persists, you may need to log out and log back in.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Show "no user" state THIRD
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
        <div className="text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-orange-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">User Not Found</h2>
          <p className="text-gray-600 mb-4">Unable to load user information</p>
          <Button onClick={() => window.location.reload()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Reload Page
          </Button>
        </div>
      </div>
    );
  }

  console.log('Dashboard: Rendering main dashboard for user:', user.email);
  return <DashboardContent user={user} />;
}

// Separate component for the main dashboard content
function DashboardContent({ user }) {
  const queryClient = useQueryClient();
  const { tenantConfig, theme, modulePhaseLimit } = useTenant();
  const hideInventoryValueTile = Boolean(user?.ui_overrides?.hideInventoryValueTile);
  const [shiftTick, setShiftTick] = React.useState(Date.now());
  const palette = React.useMemo(() => getThemePalette(theme), [theme]);
  const dashboardBackgroundStyle = React.useMemo(
    () => ({
      backgroundImage: `linear-gradient(180deg, ${withAlpha(palette.primaryColor, 0.08)} 0%, #f8fafc 55%, ${withAlpha(palette.secondaryColor, 0.08)} 100%)`,
    }),
    [palette]
  );
  const accentTextStyle = React.useMemo(
    () => ({ color: palette.primaryColor }),
    [palette.primaryColor]
  );
  const heroTextColor = palette.heroTextColor || '#0F172A';
  const heroMutedTextStyle = React.useMemo(
    () => ({ color: withAlpha(heroTextColor, 0.78) }),
    [heroTextColor]
  );
  const themedSurfaces = React.useMemo(
    () => ({
      base: 'tenant-surface',
      hero: 'tenant-surface-strong',
      rounded: 'rounded-2xl',
      roundedLg: 'rounded-3xl',
      icon: 'tenant-icon',
      chip: 'tenant-chip',
    }),
    []
  );
  
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

  const { data: todayShipments = [] } = useQuery({
    queryKey: ['todayShipments'],
    queryFn: async () => {
      const shipments = await recims.entities.InboundShipment.list('-created_date', 50);
      const today = new Date().toDateString();
      return shipments.filter((s) => {
        const shipmentDate = parseDateSafe(s.created_date);
        return shipmentDate ? shipmentDate.toDateString() === today : false;
      });
    },
    initialData: [],
  });

  const { data: last7DaysShipments = [] } = useQuery({
    queryKey: ['last7DaysShipments'],
    queryFn: async () => {
      const shipments = await recims.entities.InboundShipment.list('-created_date', 200);
      const sevenDaysAgo = subDays(new Date(), 7);
      return shipments.filter((s) => {
        const shipmentDate = parseDateSafe(s.created_date);
        return shipmentDate ? shipmentDate >= sevenDaysAgo : false;
      });
    },
    initialData: [],
  });

  const { data: pendingShipments = [] } = useQuery({
    queryKey: ['pendingShipments'],
    queryFn: async () => {
      // Fetch both pending_inspection and arrived shipments
      const pending = await recims.entities.InboundShipment.filter({
        status: 'pending_inspection'
      }, '-created_date', 10);
      
      const arrived = await recims.entities.InboundShipment.filter({
        status: 'arrived'
      }, '-created_date', 10);
      
      // Combine and sort
      return [...pending, ...arrived].sort((a, b) => {
        const dateB = parseDateSafe(b.created_date)?.getTime() ?? 0;
        const dateA = parseDateSafe(a.created_date)?.getTime() ?? 0;
        return dateB - dateA;
      });
    },
    initialData: [],
  });

  const { data: completedShifts = [] } = useQuery({
    queryKey: ['completedShiftsSummary', user?.email],
    enabled: !!user?.email,
    queryFn: async () => {
      const shifts = await recims.entities.ShiftLog.list('-shift_end', 200);
      return shifts.filter((shift) =>
        shift.operator_email === user.email &&
        shift.shift_start &&
        shift.shift_end
      );
    },
    initialData: [],
  });

  const { data: bins = [] } = useQuery({
    queryKey: ['bins'],
    queryFn: () => recims.entities.Bin.list(),
    initialData: [],
  });

  const { data: inventory = [] } = useQuery({
    queryKey: ['inventory', user?.tenant_id],
    queryFn: async () => {
      if (!user?.tenant_id) return [];
      return await recims.entities.Inventory.filter({
        tenant_id: user.tenant_id
      }, '-created_date', 100);
    },
    enabled: !!user?.tenant_id,
    initialData: [],
  });

  const { data: qcInspections = [] } = useQuery({
    queryKey: ['qcInspections'],
    queryFn: () => recims.entities.QCInspection.list('-created_date', 50),
    initialData: [],
  });

  const { data: settings = [] } = useQuery({
    queryKey: ['appSettings'],
    queryFn: () => recims.entities.AppSettings.list(),
    initialData: [],
  });

  const { data: salesOrders = [] } = useQuery({
    queryKey: ['salesOrders', user?.tenant_id],
    queryFn: async () => {
      if (!user?.tenant_id) return [];
      const startOfYear = new Date(new Date().getFullYear(), 0, 1);
      const allOrders = await recims.entities.SalesOrder.filter({
        tenant_id: user.tenant_id
      }, '-order_date', 500);
      return allOrders.filter(order => new Date(order.order_date) >= startOfYear);
    },
    enabled: !!user?.tenant_id,
    initialData: [],
  });

  const binCapacityEnabled = settings.find(s => s.setting_key === 'enable_bin_capacity_management')?.setting_value === 'true';

  const availableInventory = inventory.filter(i => i.status === 'available');
  const totalInventoryValue = availableInventory.reduce((sum, i) => sum + (i.total_value || 0), 0);
  const totalSalesYTD = salesOrders.reduce((sum, order) => sum + (order.total_amount || 0), 0);

  const startShiftMutation = useMutation({
    mutationFn: async () => {
      return await recims.entities.ShiftLog.create({
        operator_email: user.email,
        operator_name: user.full_name,
        tenant_id: user.tenant_id,
        shift_start: new Date().toISOString(),
        status: 'active'
      });
    },
    onSuccess: (createdShift) => {
      if (createdShift) {
        queryClient.setQueryData(['activeShift', user?.email], createdShift);
      }
      queryClient.invalidateQueries({ queryKey: ['activeShift', user?.email] });
      queryClient.invalidateQueries({ queryKey: ['completedShiftsSummary', user?.email] });
    },
    onError: (error) => {
      console.error('Failed to start shift:', error);
    },
  });

  const endShiftMutation = useMutation({
    mutationFn: async () => {
      return await recims.entities.ShiftLog.update(activeShift.id, {
        shift_end: new Date().toISOString(),
        status: 'completed',
        updated_date: new Date().toISOString()
      });
    },
    onSuccess: () => {
      queryClient.setQueryData(['activeShift', user?.email], null);
      queryClient.invalidateQueries({ queryKey: ['activeShift', user?.email] });
      queryClient.invalidateQueries({ queryKey: ['completedShiftsSummary', user?.email] });
    },
    onError: (error) => {
      console.error('Failed to end shift:', error);
    },
  });

  const canStartShift = Boolean(user?.email && user?.tenant_id);
  const canEndShift = Boolean(activeShift?.id);

  // Calculate metrics - FIX: Calculate available bins based on BOTH weight AND volume capacity
  const fullBins = bins.filter(b => b.status === 'full').length;
  
  // Available bins = bins with space remaining in BOTH weight AND volume (if tracked)
  const availableBins = binCapacityEnabled 
    ? bins.filter(b => {
        // Check if bin is in available or empty status
        if (b.status !== 'available' && b.status !== 'empty') return false;
        
        let weightOk = true;
        let volumeOk = true;
        
        // Check weight capacity if tracked
        if (b.track_weight !== false) { // track_weight default to true if not specified
          const currentWeight = b.current_weight_kg || 0;
          const maxWeight = b.max_weight_kg || 0;
          weightOk = maxWeight > 0 && currentWeight < maxWeight;
        }
        
        // Check volume capacity if tracked
        if (b.track_volume) {
          const volumeUnit = b.volume_unit || 'cubic_feet';
          let currentVolume = 0;
          let maxVolume = 0;
          
          if (volumeUnit === 'cubic_feet') {
            currentVolume = b.current_volume_cubic_feet || 0;
            maxVolume = b.max_volume_cubic_feet || 0;
          } else if (volumeUnit === 'cubic_yards') {
            currentVolume = b.current_volume_cubic_yards || 0;
            maxVolume = b.max_volume_cubic_yards || 0;
          } else if (volumeUnit === 'cubic_meters') { // Added 'cubic_meters' case
            currentVolume = b.current_volume_cubic_meters || 0;
            maxVolume = b.max_volume_cubic_meters || 0;
          }
          
          volumeOk = maxVolume > 0 && currentVolume < maxVolume;
        }
        
        // Bin is available only if BOTH weight AND volume (if tracked) have space
        return weightOk && volumeOk;
      }).length
    : bins.filter(b => b.status === 'available' || b.status === 'empty').length;
  
  // Calculate metrics
  // const fullBins = bins.filter(b => b.status === 'full').length;
  
  // // Available bins = bins with space remaining (current_weight < capacity)
  // const availableBins = binCapacityEnabled 
  //   ? bins.filter(b => {
  //       const currentWeight = b.current_weight_kg || 0;
  //       const capacity = b.capacity_kg || 0;
  //       return capacity > 0 && currentWeight < capacity && 
  //              (b.status === 'available' || b.status === 'empty');
  //     }).length
  //   : bins.filter(b => b.status === 'available' || b.status === 'empty').length;
  
  React.useEffect(() => {
    if (!activeShift?.shift_start) {
      return undefined;
    }

    // Force re-render ticks while a shift is active so duration updates in real-time
    setShiftTick(Date.now());
    const interval = setInterval(() => {
      setShiftTick(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, [activeShift?.id, activeShift?.shift_start]);

  const getShiftDuration = React.useCallback(() => {
    if (!activeShift?.shift_start) return '00:00';

    const startDate = parseDateSafe(activeShift.shift_start);
    if (!startDate) return '00:00';
    const start = startDate.getTime();
    const now = shiftTick;
    const diffMs = Math.max(0, now - start);
    const totalSeconds = Math.floor(diffMs / 1000);
    const hours = Math.floor(totalSeconds / 3600)
      .toString()
      .padStart(2, '0');
    const minutes = Math.floor((totalSeconds % 3600) / 60)
      .toString()
      .padStart(2, '0');
    const seconds = (totalSeconds % 60).toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  }, [activeShift, shiftTick]);

  const activeShiftStartDate = React.useMemo(() => {
    return parseDateSafe(activeShift?.shift_start);
  }, [activeShift?.shift_start]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'arrived':
        return 'bg-orange-100 text-orange-700 border-orange-300';
      case 'processing':
        return 'bg-blue-100 text-blue-700 border-blue-300';
      case 'completed':
        return 'bg-green-100 text-green-700 border-green-300';
      case 'pending':
      case 'pending_inspection': // Added pending_inspection status
        return 'bg-gray-100 text-gray-700 border-gray-300';
      case 'cancelled':
        return 'bg-red-100 text-red-700 border-red-300';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  const canAccessPage = React.useCallback((pageName) => {
    const required = getPagePhaseRequirement(pageName);
    if (!Number.isFinite(modulePhaseLimit)) {
      return true;
    }
    return required <= modulePhaseLimit;
  }, [modulePhaseLimit]);

  const getInventoryActionUrl = () => {
    if (tenantConfig?.features?.po_module_enabled) {
      return createPageUrl("PurchaseOrders");
    }
    return createPageUrl("AddToInventory");
  };

  const getInventoryActionLabel = () => {
    if (tenantConfig?.features?.po_module_enabled) {
      return 'Purchase Orders';
    }
    return 'Add Inventory';
  };

  const lastCompletedShift = completedShifts[0] ?? null;

  const totalCompletedMinutes = React.useMemo(() => {
    return completedShifts.reduce((total, shift) => {
      const start = parseDateSafe(shift.shift_start);
      const end = parseDateSafe(shift.shift_end);
      if (!start || !end) {
        return total;
      }
      const minutes = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
      return total + minutes;
    }, 0);
  }, [completedShifts]);

  const formatMinutes = React.useCallback((minutes) => {
    if (!Number.isFinite(minutes) || minutes <= 0) {
      return '0h 0m';
    }
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hrs}h ${mins}m`;
  }, []);

  const lastShiftDuration = React.useMemo(() => {
    if (!lastCompletedShift) return null;
    const start = parseDateSafe(lastCompletedShift.shift_start);
    const end = parseDateSafe(lastCompletedShift.shift_end);
    if (!start || !end) {
      return null;
    }
    const minutes = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
    return formatMinutes(minutes);
  }, [lastCompletedShift, formatMinutes]);

  const lastShiftEndedAt = React.useMemo(() => {
    if (!lastCompletedShift?.shift_end) return null;
    const end = parseDateSafe(lastCompletedShift.shift_end);
    if (!end) return null;
    return format(end, 'MMM d, h:mm a');
  }, [lastCompletedShift]);

  const totalShiftDurationDisplay = React.useMemo(() => {
    return formatMinutes(totalCompletedMinutes);
  }, [formatMinutes, totalCompletedMinutes]);

  console.log('Dashboard: Rendering content');

  return (
    <div className="min-h-screen p-4 md:p-8" style={dashboardBackgroundStyle}>
      <div className="max-w-7xl mx-auto">

      {/* Shift Control */}
      <Card className={`mb-6 ${themedSurfaces.hero} ${themedSurfaces.roundedLg}`}>
        <CardContent className="p-4 md:p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-black">
                {activeShift ? 'Shift Active' : 'No Active Shift'}
              </h2>
              {activeShift && (
                <div className="flex items-center gap-4 mt-2 text-sm" style={heroMutedTextStyle}>
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    <span>Duration: {getShiftDuration()}</span>
                  </div>
                  <div>Started: {activeShiftStartDate ? format(activeShiftStartDate, 'h:mm a') : 'Unknown'}</div>
                </div>
              )}
              {user?.email && (
                <div className="mt-3 text-xs space-y-1">
                  {lastShiftDuration && (
                    <div className="text-black">
                      <span className="font-medium text-black">Last Shift:</span> {lastShiftDuration}
                      {lastShiftEndedAt && (
                        <span className="text-black"> · Ended {lastShiftEndedAt}</span>
                      )}
                    </div>
                  )}
                  <div className="text-black">
                    <span className="font-medium text-black">Total Logged:</span> {totalShiftDurationDisplay}
                  </div>
                </div>
              )}
            </div>
            {activeShift ? (
              <Button
                onClick={() => {
                  if (!canEndShift) return;
                  endShiftMutation.mutate();
                }}
                disabled={endShiftMutation.isPending || !canEndShift}
                className="gap-2 rounded-2xl bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg hover:opacity-95 border-0"
              >
                <StopCircle className="w-4 h-4" />
                End Shift
              </Button>
            ) : (
              <Button
                onClick={() => {
                  if (!canStartShift) return;
                  startShiftMutation.mutate();
                }}
                disabled={startShiftMutation.isPending || !canStartShift}
                className="gap-2 rounded-2xl tenant-action"
              >
                <PlayCircle className="w-4 h-4" />
                Start Shift
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <Link to={createPageUrl("InboundShipments")}>
          <Card className={`${themedSurfaces.base} transition-all cursor-pointer ${themedSurfaces.rounded}`}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-xl ${themedSurfaces.icon}`}>
                  <TruckIcon className="w-6 h-6" style={accentTextStyle} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{todayShipments.length}</p>
                  <p className="text-xs text-slate-600">{`Today's Loads`}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link to={createPageUrl("InboundShipments?status=arrived")}>
          <Card className={`${themedSurfaces.base} transition-all cursor-pointer ${themedSurfaces.rounded}`}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-xl ${themedSurfaces.icon}`}>
                  <AlertCircle className="w-6 h-6 text-orange-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{pendingShipments.length}</p>
                  <p className="text-xs text-slate-600">Pending</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link to={createPageUrl("BinManagement")}>
          <Card className={`${themedSurfaces.base} transition-all cursor-pointer ${themedSurfaces.rounded}`}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-xl ${themedSurfaces.icon}`}>
                  <Warehouse className="w-6 h-6" style={{ color: palette.secondaryColor }} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{availableBins}</p>
                  <p className="text-xs text-slate-600">
                    {binCapacityEnabled ? 'Available Bins' : 'Available Bins'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link to={createPageUrl("BinManagement?status=full")}>
          <Card className={`${themedSurfaces.base} transition-all cursor-pointer ${themedSurfaces.rounded}`}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-xl ${themedSurfaces.icon}`}>
                  <Package className="w-6 h-6 text-red-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{fullBins}</p>
                  <p className="text-xs text-slate-600">Full Bins</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        {!hideInventoryValueTile && (
          <Link to={createPageUrl("InventoryManagement")}>
            <Card className={`${themedSurfaces.base} transition-all cursor-pointer ${themedSurfaces.rounded}`}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-xl ${themedSurfaces.icon}`}>
                    <DollarSign className="w-6 h-6" style={accentTextStyle} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-900">{formatUSD(totalInventoryValue, {
                      notation: 'compact',
                      maximumFractionDigits: 1,
                    })}</p>
                    <p className="text-xs text-slate-600">Inventory Value</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        )}

        <Link to={createPageUrl("SalesOrderManagement")}>
          <Card className={`${themedSurfaces.base} transition-all cursor-pointer ${themedSurfaces.rounded}`}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-xl ${themedSurfaces.icon}`}>
                  <TrendingUp className="w-6 h-6" style={accentTextStyle} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{formatUSD(totalSalesYTD, {
                    notation: 'compact',
                    maximumFractionDigits: 1,
                  })}</p>
                  <p className="text-xs text-slate-600">Sales YTD</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Quick Actions */}
      <Card className={`mb-6 ${themedSurfaces.base} ${themedSurfaces.roundedLg}`}>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Link to={createPageUrl("NewShipment")}>
              <Button className="w-full h-20 flex flex-col gap-2 tenant-action rounded-2xl">
                <TruckIcon className="w-6 h-6" />
                <span className="text-sm font-semibold">New Inbound</span>
              </Button>
            </Link>
            <Link to={createPageUrl("MaterialClassification")}>
              <Button className="w-full h-20 flex flex-col gap-2 tenant-action rounded-2xl">
                <Package className="w-6 h-6" />
                <span className="text-sm font-semibold">Classify</span>
              </Button>
            </Link>
            <Link to={getInventoryActionUrl()}>
              <Button className="w-full h-20 flex flex-col gap-2 tenant-action rounded-2xl">
                <Package className="w-6 h-6" />
                <span className="text-sm font-semibold">{getInventoryActionLabel()}</span>
              </Button>
            </Link>
            {canAccessPage('Reports') && (
              <Link to={createPageUrl("Reports")}>
                <Button className="w-full h-20 flex flex-col gap-2 tenant-action rounded-2xl">
                  <BarChart3 className="w-6 h-6" />
                  <span className="text-sm font-semibold">Reports</span>
                </Button>
              </Link>
            )}
            <a href={recims.agents.getWhatsAppConnectURL('reports_assistant')} target="_blank" rel="noopener noreferrer">
              <Button className="w-full h-20 flex flex-col gap-2 tenant-action rounded-2xl">
                <MessageCircle className="w-6 h-6" />
                <span className="text-sm font-semibold">AI Assistant</span>
              </Button>
            </a>
          </div>
        </CardContent>
      </Card>

      {/* Pending Shipments */}
      <Card className={`${themedSurfaces.base} ${themedSurfaces.roundedLg}`}>
        <CardHeader>
          <CardTitle>Recent Inbound Shipments</CardTitle>
        </CardHeader>
        <CardContent>
          {pendingShipments.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <TruckIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No recent shipments</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingShipments.slice(0, 5).map((shipment) => (
                <div key={shipment.id} className={`flex items-center justify-between p-3 ${themedSurfaces.base} ${themedSurfaces.rounded} hover:shadow-lg transition-all`}>
                  <div className="flex-1">
                    <p className="font-semibold">{shipment.load_id}</p>
                    <p className="text-sm text-gray-600">
                      {shipment.supplier_name} • {shipment.load_type}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={getStatusColor(shipment.status)}>
                      {shipment.status}
                    </Badge>
                    <Link to={createPageUrl(`PrintInboundLabel?id=${shipment.id}`)}>
                      <Button className="h-8 w-8 tenant-chip rounded-full border border-white/30 hover:opacity-80" size="icon" variant="ghost">
                        <Printer className="w-4 h-4 text-white" />
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      </div>
    </div>
  );
}

DashboardContent.propTypes = {
  user: PropTypes.shape({
    email: PropTypes.string.isRequired,
    full_name: PropTypes.string,
    tenant_id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    ui_overrides: PropTypes.shape({
      hideInventoryValueTile: PropTypes.bool,
    }),
  }).isRequired,
};