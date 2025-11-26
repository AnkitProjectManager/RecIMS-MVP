import React, { useState } from "react";
import { recims } from "@/api/recimsClient";
import { useQuery } from "@tanstack/react-query";
import { useTenant } from "@/components/TenantContext";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, MapPin, Package, Search, Warehouse } from "lucide-react";

export default function InventoryByLocation() {
  const { tenantConfig, user } = useTenant();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedZone, setSelectedZone] = useState('all');
  const [selectedBin, setSelectedBin] = useState('all');
  const [viewMode, setViewMode] = useState('overview'); // 'overview', 'zone_bins', 'all_bins'
  const [focusedZone, setFocusedZone] = useState(null);
  
  // Determine weight unit based on tenant configuration
  const useMetric = tenantConfig?.weight_unit === 'kg' || tenantConfig?.weight_unit === 'metric';
  const weightUnit = useMetric ? 'kg' : 'lbs';



  const { data: inventory = [] } = useQuery({
    queryKey: ['inventory', user?.tenant_id],
    queryFn: async () => {
      if (!user?.tenant_id) return [];
      return await recims.entities.Inventory.filter({
        tenant_id: user.tenant_id
      }, '-created_date', 200);
    },
    enabled: !!user?.tenant_id,
    initialData: [],
  });

  const { data: zones = [] } = useQuery({
    queryKey: ['zones', user?.tenant_id],
    queryFn: async () => {
      if (!user?.tenant_id) return [];
      return await recims.entities.Zone.filter({ 
        tenant_id: user.tenant_id,
        status: 'active'
      });
    },
    enabled: !!user?.tenant_id,
    initialData: [],
  });

  const { data: bins = [] } = useQuery({
    queryKey: ['bins', user?.tenant_id],
    queryFn: async () => {
      if (!user?.tenant_id) return [];
      return await recims.entities.Bin.filter({ tenant_id: user.tenant_id });
    },
    enabled: !!user?.tenant_id,
    initialData: [],
  });

  // Filter inventory
  const filteredInventory = inventory.filter(item => {
    const matchesSearch = !searchQuery || 
      item.item_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.bin_location?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesZone = selectedZone === 'all' || item.zone === selectedZone;
    const matchesBin = selectedBin === 'all' || item.bin_location === selectedBin;
    
    return matchesSearch && matchesZone && matchesBin;
  });

  // Group by zone and bin
  const groupedByZone = filteredInventory.reduce((acc, item) => {
    const zone = item.zone || 'Unassigned';
    if (!acc[zone]) {
      acc[zone] = {};
    }
    
    const bin = item.bin_location || 'Unassigned';
    if (!acc[zone][bin]) {
      acc[zone][bin] = [];
    }
    
    acc[zone][bin].push(item);
    return acc;
  }, {});

  // Calculate totals
  const totalItems = filteredInventory.length;
  const totalValue = filteredInventory.reduce((sum, item) => sum + (item.total_value || 0), 0);
  const uniqueZones = new Set(filteredInventory.map(i => i.zone)).size;
  const uniqueBins = new Set(filteredInventory.map(i => i.bin_location)).size;

  // Available bins for filtering
  const availableBins = selectedZone === 'all' 
    ? bins 
    : bins.filter(b => b.zone === selectedZone);

  const handleZoneClick = (zoneCode) => {
    setFocusedZone(zoneCode);
    setViewMode('zone_bins');
    setSelectedZone(zoneCode);
  };

  const handleBinsUsedClick = () => {
    setViewMode('all_bins');
  };

  const handleBackToOverview = () => {
    setViewMode('overview');
    setFocusedZone(null);
    setSelectedZone('all');
    setSelectedBin('all');
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link to={createPageUrl("InventoryManagement")}>
          <Button variant="outline" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Inventory by Location</h1>
          <p className="text-sm text-gray-600">View inventory organized by zones and bins</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Package className="w-8 h-8 text-blue-600" />
              <div>
                <p className="text-2xl font-bold">{totalItems}</p>
                <p className="text-xs text-gray-600">Total Items</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card 
          className="cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => setViewMode('overview')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <MapPin className="w-8 h-8 text-green-600" />
              <div>
                <p className="text-2xl font-bold">{uniqueZones}</p>
                <p className="text-xs text-gray-600">Zones Used</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover:shadow-lg transition-shadow"
          onClick={handleBinsUsedClick}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Warehouse className="w-8 h-8 text-orange-600" />
              <div>
                <p className="text-2xl font-bold">{uniqueBins}</p>
                <p className="text-xs text-gray-600">Bins Used</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Package className="w-8 h-8 text-purple-600" />
              <div>
                <p className="text-xl font-bold">${totalValue.toFixed(2)}</p>
                <p className="text-xs text-gray-600">Total Value</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="grid md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search items..."
                className="pl-10"
              />
            </div>

            <Select value={selectedZone} onValueChange={(value) => {
              setSelectedZone(value);
              setSelectedBin('all');
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by zone" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Zones</SelectItem>
                {zones.map((zone) => (
                  <SelectItem key={zone.id} value={zone.zone_code}>
                    {zone.zone_code} - {zone.zone_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedBin} onValueChange={setSelectedBin} disabled={selectedZone === 'all'}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by bin" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Bins</SelectItem>
                {availableBins.map((bin) => (
                  <SelectItem key={bin.id} value={bin.bin_code}>
                    {bin.bin_code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Grouped Inventory Display */}
      {viewMode === 'overview' && (
        <div className="space-y-6">
          {Object.entries(groupedByZone).length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center text-gray-500">
                <Package className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>No inventory found matching your filters</p>
              </CardContent>
            </Card>
          ) : (
            Object.entries(groupedByZone).map(([zone, binGroups]) => (
              <Card 
                key={zone} 
                className="border-2 border-blue-200 cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => handleZoneClick(zone)}
              >
                <CardHeader className="bg-blue-50">
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-blue-600" />
                    Zone: {zone}
                    <Badge variant="outline" className="ml-auto">
                      {Object.values(binGroups).flat().length} items
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <p className="text-sm text-gray-600">
                    {Object.keys(binGroups).length} bins • Click to view bins
                  </p>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Zone Bins View */}
      {viewMode === 'zone_bins' && (
        <div>
          <Card className="mb-4 border-2 border-blue-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handleBackToOverview}>
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    Back
                  </Button>
                  <h2 className="text-xl font-semibold">Zone: {focusedZone}</h2>
                </div>
                <Badge>{groupedByZone[focusedZone] ? Object.values(groupedByZone[focusedZone]).flat().length : 0} items</Badge>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            {groupedByZone[focusedZone] && Object.entries(groupedByZone[focusedZone]).map(([bin, items]) => {
              const binData = bins.find(b => b.bin_code === bin);
              const totalWeightKg = items.reduce((sum, item) => sum + (item.quantity_kg || 0), 0);
              const totalWeightLbs = items.reduce((sum, item) => sum + (item.quantity_lbs || 0), 0);
              const displayWeight = useMetric ? totalWeightKg : totalWeightLbs;

              return (
                <Card key={bin} className="border rounded-lg">
                  <CardHeader className="bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-6 h-6 rounded"
                          style={{ backgroundColor: binData?.bin_color || '#10b981' }}
                        />
                        <h3 className="font-semibold text-gray-900">Bin: {bin}</h3>
                        <Badge variant="outline">{items.length} items</Badge>
                      </div>
                      <div className="text-sm text-gray-600">
                        Total: {displayWeight.toFixed(2)} {weightUnit}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4">
                    <div className="space-y-2">
                      {items.map((item) => {
                        const displayQuantity = useMetric ? (item.quantity_kg || 0) : (item.quantity_lbs || 0);
                        const displayAvailable = useMetric 
                          ? ((item.quantity_kg || 0) - (item.reserved_quantity || 0))
                          : ((item.quantity_lbs || 0) - (item.reserved_quantity || 0));
                        
                        return (
                          <div
                            key={item.id}
                            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                          >
                            <div className="flex-1">
                              <p className="font-semibold text-gray-900">{item.item_name}</p>
                              <p className="text-sm text-gray-600">
                                {item.category} 
                                {item.sub_category && ` > ${item.sub_category}`}
                                {item.product_type && ` > ${item.product_type}`}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-gray-900">
                                {displayQuantity.toFixed(2)} {weightUnit}
                              </p>
                              <p className="text-sm text-gray-600">
                                Available: {displayAvailable.toFixed(2)} {weightUnit}
                              </p>
                            </div>
                            <div className="ml-4">
                              <Badge className={
                                item.status === 'available' ? 'bg-green-100 text-green-700' :
                                item.status === 'low_stock' ? 'bg-yellow-100 text-yellow-700' :
                                item.status === 'out_of_stock' ? 'bg-red-100 text-red-700' :
                                'bg-gray-100 text-gray-700'
                              }>
                                {item.status}
                              </Badge>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* All Bins View */}
      {viewMode === 'all_bins' && (
        <div>
          <Card className="mb-4 border-2 border-orange-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handleBackToOverview}>
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    Back
                  </Button>
                  <h2 className="text-xl font-semibold">All Bins in Use</h2>
                </div>
                <Badge>{uniqueBins} bins</Badge>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            {Object.entries(groupedByZone).map(([zone, binGroups]) => (
              Object.entries(binGroups).map(([bin, items]) => {
                const binData = bins.find(b => b.bin_code === bin);
                const totalWeightKg = items.reduce((sum, item) => sum + (item.quantity_kg || 0), 0);
                const totalWeightLbs = items.reduce((sum, item) => sum + (item.quantity_lbs || 0), 0);
                const displayWeight = useMetric ? totalWeightKg : totalWeightLbs;

                return (
                  <Card key={`${zone}-${bin}`} className="border rounded-lg">
                    <CardHeader className="bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-6 h-6 rounded"
                            style={{ backgroundColor: binData?.bin_color || '#10b981' }}
                          />
                          <div>
                            <h3 className="font-semibold text-gray-900">Bin: {bin}</h3>
                            <p className="text-xs text-gray-600">Zone: {zone}</p>
                          </div>
                          <Badge variant="outline">{items.length} items</Badge>
                        </div>
                        <div className="text-sm text-gray-600">
                          Total: {displayWeight.toFixed(2)} {weightUnit}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4">
                      <div className="space-y-2">
                        {items.map((item) => {
                          const displayQuantity = useMetric ? (item.quantity_kg || 0) : (item.quantity_lbs || 0);
                          const displayAvailable = useMetric 
                            ? ((item.quantity_kg || 0) - (item.reserved_quantity || 0))
                            : ((item.quantity_lbs || 0) - (item.reserved_quantity || 0));
                          
                          return (
                            <div
                              key={item.id}
                              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                            >
                              <div className="flex-1">
                                <p className="font-semibold text-gray-900">{item.item_name}</p>
                                <p className="text-sm text-gray-600">
                                  {item.category} 
                                  {item.sub_category && ` > ${item.sub_category}`}
                                  {item.product_type && ` > ${item.product_type}`}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-gray-900">
                                  {displayQuantity.toFixed(2)} {weightUnit}
                                </p>
                                <p className="text-sm text-gray-600">
                                  Available: {displayAvailable.toFixed(2)} {weightUnit}
                                </p>
                              </div>
                              <div className="ml-4">
                                <Badge className={
                                  item.status === 'available' ? 'bg-green-100 text-green-700' :
                                  item.status === 'low_stock' ? 'bg-yellow-100 text-yellow-700' :
                                  item.status === 'out_of_stock' ? 'bg-red-100 text-red-700' :
                                  'bg-gray-100 text-gray-700'
                                }>
                                  {item.status}
                                </Badge>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            ))}
          </div>
        </div>
      )}
    </div>
  );
}