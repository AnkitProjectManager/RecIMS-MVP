import React, { useState, useEffect } from "react";
import { recims } from "@/api/recimsClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Database, RefreshCw, Download, HardDrive, CheckCircle2, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function OfflineSync({ user }) {
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [cacheSize, setCacheSize] = useState(0);
  const [cachedData, setCachedData] = useState({
    inventory: 0,
    zones: 0,
    bins: 0,
    shipments: 0
  });
  const [error, setError] = useState(null);

  useEffect(() => {
    checkCacheStatus();
    loadLastSyncTime();
  }, []);

  const loadLastSyncTime = () => {
    const lastSyncTime = localStorage.getItem('last_offline_sync');
    if (lastSyncTime) {
      setLastSync(new Date(lastSyncTime));
    }
  };

  const checkCacheStatus = async () => {
    try {
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        let totalSize = 0;
        
        for (const cacheName of cacheNames) {
          const cache = await caches.open(cacheName);
          const keys = await cache.keys();
          totalSize += keys.length;
        }
        
        setCacheSize(totalSize);
      }

      // Check cached data counts
      const counts = {
        inventory: parseInt(localStorage.getItem('cached_inventory_count') || '0'),
        zones: parseInt(localStorage.getItem('cached_zones_count') || '0'),
        bins: parseInt(localStorage.getItem('cached_bins_count') || '0'),
        shipments: parseInt(localStorage.getItem('cached_shipments_count') || '0')
      };
      
      setCachedData(counts);
    } catch (err) {
      console.error('Error checking cache:', err);
    }
  };

  const syncOfflineData = async () => {
    setSyncing(true);
    setError(null);

    try {
      // Fetch and cache critical data
      const [inventory, zones, bins, shipments] = await Promise.all([
        recims.entities.Inventory.filter({ 
          tenant: user.tenant,
          status: { $in: ['available', 'reserved'] }
        }),
        recims.entities.Zone.filter({ tenant: user.tenant }),
        recims.entities.Bin.filter({ tenant: user.tenant }),
        recims.entities.InboundShipment.list('-created_date', 50)
      ]);

      // Store in localStorage for offline access
      localStorage.setItem('offline_inventory', JSON.stringify(inventory));
      localStorage.setItem('offline_zones', JSON.stringify(zones));
      localStorage.setItem('offline_bins', JSON.stringify(bins));
      localStorage.setItem('offline_shipments', JSON.stringify(shipments));
      
      // Store counts
      localStorage.setItem('cached_inventory_count', inventory.length.toString());
      localStorage.setItem('cached_zones_count', zones.length.toString());
      localStorage.setItem('cached_bins_count', bins.length.toString());
      localStorage.setItem('cached_shipments_count', shipments.length.toString());
      
      // Store sync time
      const now = new Date().toISOString();
      localStorage.setItem('last_offline_sync', now);
      setLastSync(new Date(now));

      // Cache API responses using Service Worker
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'CACHE_URLS',
          urls: [
            '/api/inventory',
            '/api/zones',
            '/api/bins',
            '/api/shipments'
          ]
        });
      }

      // Update display
      setCachedData({
        inventory: inventory.length,
        zones: zones.length,
        bins: bins.length,
        shipments: shipments.length
      });

      await checkCacheStatus();
    } catch (err) {
      console.error('Sync error:', err);
      setError('Failed to sync offline data. Please try again.');
    } finally {
      setSyncing(false);
    }
  };

  const clearCache = async () => {
    if (!confirm('Clear all offline data? You will need to sync again.')) {
      return;
    }

    try {
      // Clear localStorage
      localStorage.removeItem('offline_inventory');
      localStorage.removeItem('offline_zones');
      localStorage.removeItem('offline_bins');
      localStorage.removeItem('offline_shipments');
      localStorage.removeItem('last_offline_sync');
      localStorage.removeItem('cached_inventory_count');
      localStorage.removeItem('cached_zones_count');
      localStorage.removeItem('cached_bins_count');
      localStorage.removeItem('cached_shipments_count');

      // Clear Service Worker cache
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'CLEAR_CACHE'
        });
      }

      setLastSync(null);
      setCachedData({ inventory: 0, zones: 0, bins: 0, shipments: 0 });
      await checkCacheStatus();
    } catch (err) {
      console.error('Clear cache error:', err);
    }
  };

  const getDataStatus = () => {
    const total = Object.values(cachedData).reduce((sum, count) => sum + count, 0);
    if (total === 0) return 'none';
    if (!lastSync) return 'partial';
    
    const hoursSinceSync = (new Date().getTime() - lastSync.getTime()) / (1000 * 60 * 60);
    if (hoursSinceSync > 24) return 'stale';
    return 'fresh';
  };

  const dataStatus = getDataStatus();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5 text-purple-600" />
            Offline Data Sync
            {dataStatus === 'fresh' && (
              <Badge className="bg-green-100 text-green-700">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Synced
              </Badge>
            )}
            {dataStatus === 'stale' && (
              <Badge className="bg-orange-100 text-orange-700">
                <AlertTriangle className="w-3 h-3 mr-1" />
                Needs Sync
              </Badge>
            )}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-blue-50 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <HardDrive className="w-4 h-4 text-blue-600" />
              <p className="text-xs text-gray-600">Inventory</p>
            </div>
            <p className="text-xl font-bold text-blue-700">{cachedData.inventory}</p>
          </div>
          
          <div className="p-3 bg-green-50 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <HardDrive className="w-4 h-4 text-green-600" />
              <p className="text-xs text-gray-600">Zones</p>
            </div>
            <p className="text-xl font-bold text-green-700">{cachedData.zones}</p>
          </div>
          
          <div className="p-3 bg-purple-50 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <HardDrive className="w-4 h-4 text-purple-600" />
              <p className="text-xs text-gray-600">Bins</p>
            </div>
            <p className="text-xl font-bold text-purple-700">{cachedData.bins}</p>
          </div>
          
          <div className="p-3 bg-orange-50 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <HardDrive className="w-4 h-4 text-orange-600" />
              <p className="text-xs text-gray-600">Shipments</p>
            </div>
            <p className="text-xl font-bold text-orange-700">{cachedData.shipments}</p>
          </div>
        </div>

        {lastSync && (
          <div className="text-sm text-gray-600">
            Last synced: {lastSync.toLocaleString()}
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {dataStatus === 'stale' && (
          <Alert className="bg-orange-50 border-orange-200">
            <AlertDescription className="text-orange-800">
              Your offline data is more than 24 hours old. Consider syncing for the latest updates.
            </AlertDescription>
          </Alert>
        )}

        <div className="flex gap-3">
          <Button
            onClick={syncOfflineData}
            disabled={syncing}
            className="flex-1 bg-purple-600 hover:bg-purple-700 gap-2"
          >
            {syncing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Sync Now
              </>
            )}
          </Button>
          
          {cachedData.inventory > 0 && (
            <Button
              onClick={clearCache}
              variant="outline"
              className="gap-2"
            >
              Clear
            </Button>
          )}
        </div>

        <div className="text-xs text-gray-500 pt-2 border-t">
          <p>💾 Total cached items: {cacheSize}</p>
          <p className="mt-1">📱 Works offline after syncing</p>
          <p className="mt-1">🔄 Auto-sync when connection restored</p>
        </div>
      </CardContent>
    </Card>
  );
}