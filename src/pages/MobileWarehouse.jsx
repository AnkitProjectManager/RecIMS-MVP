import React, { useState } from "react";
import { recims } from "@/api/recimsClient";
import { useQuery } from "@tanstack/react-query";
import { useTenant } from "@/components/TenantContext";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Smartphone,
  Package,
  Scan,
  CheckCircle,
  Truck,
  Settings,
  ShoppingCart,
  Warehouse,
  TrendingUp,
  Zap,
  Clock,
  Wifi,
  WifiOff,
  Clipboard,
} from "lucide-react";
import { usePermissions } from "@/components/auth/usePermissions";
import OfflineSync from "@/components/pwa/OfflineSync";
import InstallPrompt from "@/components/pwa/InstallPrompt";
import PushNotifications from "@/components/pwa/PushNotifications";
import { motion } from "framer-motion";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function MobileWarehouse() {
  const { tenantConfig, user } = useTenant();
  const [isInstalled, setIsInstalled] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  React.useEffect(() => {
    const isPWA = window.matchMedia('(display-mode: standalone)').matches 
      || window.navigator.standalone 
      || document.referrer.includes('android-app://');
    setIsInstalled(isPWA);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const permissions = usePermissions(user);

  const { data: todayShipments = [] } = useQuery({
    queryKey: ['todayShipments'],
    queryFn: async () => {
      const shipments = await recims.entities.InboundShipment.list('-created_date', 50);
      const today = new Date().toDateString();
      return shipments.filter(s => new Date(s.created_date).toDateString() === today);
    },
    initialData: [],
  });

  const { data: pendingShipments = [] } = useQuery({
    queryKey: ['pendingShipments'],
    queryFn: async () => {
      return await recims.entities.InboundShipment.filter({ status: 'arrived' }, '-created_date', 10);
    },
    initialData: [],
  });

  const { data: bins = [] } = useQuery({
    queryKey: ['bins'],
    queryFn: () => recims.entities.Bin.list(),
    initialData: [],
  });

  const availableBins = bins.filter(b => b.status === 'available' || b.status === 'empty').length;

  const features = [
    {
      id: 'quick-scan',
      icon: Scan,
      title: 'Quick Scan',
      description: 'Scan barcodes for instant lookup',
      color: 'bg-blue-100',
      iconColor: 'text-blue-600',
      path: createPageUrl("QuickScan"),
      badge: 'PHASE IV',
      offline: true
    },
    {
      id: 'bin-lookup',
      icon: Package,
      title: 'Bin Lookup',
      description: 'Find materials by bin location',
      color: 'bg-green-100',
      iconColor: 'text-green-600',
      path: createPageUrl("MobileBinLookup"),
      offline: true
    },
    {
      id: 'qc-mobile',
      icon: Clipboard,
      title: 'Mobile QC',
      description: 'Quality control inspections',
      color: 'bg-purple-100',
      iconColor: 'text-purple-600',
      path: createPageUrl("MobileQC"),
      badge: 'PHASE IV'
    },
    {
      id: 'picking',
      icon: ShoppingCart,
      title: 'Picking',
      description: 'Pick items for sales orders',
      color: 'bg-orange-100',
      iconColor: 'text-orange-600',
      path: createPageUrl("MobilePicking"),
      badge: 'PHASE II',
      offline: true
    },
    {
      id: 'put-away',
      icon: Warehouse,
      title: 'Put Away',
      description: 'Store received materials',
      color: 'bg-indigo-100',
      iconColor: 'text-indigo-600',
      path: createPageUrl("MobilePutAway"),
      badge: 'PHASE II',
      offline: true
    },
  ];

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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 pb-24">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Smartphone className="w-8 h-8 text-green-600" />
            <h1 className="text-3xl font-bold text-gray-900">Mobile Warehouse</h1>
          </div>
          <p className="text-gray-600">Native-like mobile experience</p>
          
          <div className="flex items-center justify-center gap-2 mt-3">
            {isOnline ? (
              <>
                <Wifi className="w-4 h-4 text-green-600" />
                <span className="text-sm text-green-600 font-medium">Online</span>
              </>
            ) : (
              <>
                <WifiOff className="w-4 h-4 text-orange-600" />
                <span className="text-sm text-orange-600 font-medium">Offline Mode</span>
              </>
            )}
          </div>
        </div>

        {!isInstalled && <InstallPrompt />}
        {isInstalled && <OfflineSync user={user} />}
        {isInstalled && <PushNotifications user={user} />}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-600" />
              {`Today's Activity`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{todayShipments.length}</p>
                <p className="text-xs text-gray-600">Shipments</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">{pendingShipments.length}</p>
                <p className="text-xs text-gray-600">Pending</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-purple-600">{availableBins}</p>
                <p className="text-xs text-gray-600">Bins</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-500" />
            Quick Actions
          </h2>
          
          <div className="grid grid-cols-2 gap-4">
            {features.map((feature) => (
              <Link key={feature.id} to={feature.path}>
                <motion.div whileTap={{ scale: 0.95 }} className="relative">
                  <Card className="hover:shadow-lg transition-shadow h-full">
                    <CardContent className="p-4 flex flex-col items-center text-center space-y-3">
                      <div className={`${feature.color} p-4 rounded-2xl`}>
                        <feature.icon className={`w-8 h-8 ${feature.iconColor}`} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{feature.title}</h3>
                        <p className="text-xs text-gray-600 mt-1">{feature.description}</p>
                      </div>
                      {feature.badge && (
                        <Badge className="bg-purple-100 text-purple-700 text-xs">
                          {feature.badge}
                        </Badge>
                      )}
                      {!isOnline && feature.offline && (
                        <Badge className="bg-green-100 text-green-700 text-xs flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          Offline
                        </Badge>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              </Link>
            ))}
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-gray-600" />
              Recent Shipments
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pendingShipments.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No pending shipments</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingShipments.slice(0, 5).map((shipment) => (
                  <div key={shipment.id} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-semibold text-sm">{shipment.load_id}</p>
                        <p className="text-xs text-gray-600">{shipment.supplier_name}</p>
                      </div>
                      <Badge className="bg-orange-100 text-orange-700">
                        {shipment.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {!isOnline && (
          <Alert className="bg-orange-50 border-orange-200">
            <WifiOff className="h-4 w-4 text-orange-600" />
            <AlertDescription className="text-orange-800">
              {`You're working offline. Changes will sync when connection is restored. Features marked with ✓ work offline.`}
            </AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
}