import React, { useState } from "react";
import { recims } from "@/api/recimsClient";
import { useQuery } from "@tanstack/react-query";
import { useTenant } from "@/components/TenantContext";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft,
  BoxIcon,
  Search,
  MapPin,
  Package,
  Printer
} from "lucide-react";
import BarcodeScanner from "@/components/mobile/BarcodeScanner";
import TenantHeader from "@/components/TenantHeader";

export default function MobileBinLookup() {
  const { user } = useTenant();
  const [searchMode, setSearchMode] = useState('scan'); // 'scan' or 'manual'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBin, setSelectedBin] = useState(null);

  const { data: bins = [] } = useQuery({
    queryKey: ['bins', user?.tenant_id],
    queryFn: async () => {
      if (!user?.tenant_id) return [];
      return await recims.entities.Bin.filter({ tenant_id: user.tenant_id }, '-created_date');
    },
    enabled: !!user?.tenant_id,
    initialData: [],
  });

  const handleScan = async (code) => {
    const found = bins.find(b => b.qr_code === code || b.bin_code === code);
    if (found) {
      setSelectedBin(found);
    } else {
      alert(`Bin not found: ${code}`);
    }
  };

  const handleSearch = () => {
    const found = bins.find(b => 
      b.bin_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.zone?.toLowerCase().includes(searchQuery.toLowerCase())
    );
    if (found) {
      setSelectedBin(found);
    } else {
      alert(`No bin found matching: ${searchQuery}`);
    }
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'empty': return 'bg-gray-100 text-gray-700';
      case 'available': return 'bg-green-100 text-green-700';
      case 'full': return 'bg-red-100 text-red-700';
      case 'reserved': return 'bg-blue-100 text-blue-700';
      case 'maintenance': return 'bg-orange-100 text-orange-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getCapacityPercent = (bin) => {
    if (!bin.capacity_kg || !bin.current_weight_kg) return 0;
    return Math.min((bin.current_weight_kg / bin.capacity_kg) * 100, 100);
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <TenantHeader />
      
      <div className="p-4">
        <div className="flex items-center gap-3 mb-4">
          <Link to={createPageUrl("MobileWarehouse")}>
            <Button variant="outline" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-900">Bin Lookup</h1>
            <p className="text-sm text-gray-600">Find and manage storage bins</p>
          </div>
        </div>

        {/* Search Mode Toggle */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <Button
            onClick={() => setSearchMode('scan')}
            variant={searchMode === 'scan' ? 'default' : 'outline'}
            className="gap-2"
          >
            <BoxIcon className="w-4 h-4" />
            Scan
          </Button>
          <Button
            onClick={() => setSearchMode('manual')}
            variant={searchMode === 'manual' ? 'default' : 'outline'}
            className="gap-2"
          >
            <Search className="w-4 h-4" />
            Search
          </Button>
        </div>

        {/* Scanner or Manual Search */}
        {searchMode === 'scan' ? (
          <div className="mb-4">
            <BarcodeScanner
              onScan={handleScan}
              placeholder="Scan bin QR code..."
            />
          </div>
        ) : (
          <Card className="mb-4">
            <CardContent className="p-4">
              <div className="flex gap-2">
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Enter bin code or zone..."
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                />
                <Button onClick={handleSearch}>
                  <Search className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Selected Bin Details */}
        {selectedBin && (
          <Card className="mb-4 border-2 border-green-500">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <BoxIcon className="w-5 h-5 text-green-600" />
                  {selectedBin.bin_code}
                </CardTitle>
                <Badge className={getStatusColor(selectedBin.status)}>
                  {selectedBin.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Bin Info */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-3 bg-gray-50 rounded">
                  <p className="text-gray-600 text-xs mb-1">Zone</p>
                  <p className="font-bold text-lg">{selectedBin.zone}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded">
                  <p className="text-gray-600 text-xs mb-1">Material</p>
                  <p className="font-bold text-sm">{selectedBin.material_type || 'Empty'}</p>
                </div>
              </div>

              {/* Capacity */}
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600">Capacity</span>
                  <span className="font-semibold">
                    {selectedBin.current_weight_kg || 0} / {selectedBin.capacity_kg} kg
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all ${
                      getCapacityPercent(selectedBin) >= 90 ? 'bg-red-500' :
                      getCapacityPercent(selectedBin) >= 70 ? 'bg-orange-500' :
                      'bg-green-500'
                    }`}
                    style={{ width: `${getCapacityPercent(selectedBin)}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {getCapacityPercent(selectedBin).toFixed(1)}% full
                </p>
              </div>

              {/* QR Code */}
              {selectedBin.qr_code && (
                <div className="p-3 bg-blue-50 rounded text-sm">
                  <p className="text-gray-600 text-xs mb-1">QR Code</p>
                  <p className="font-mono font-semibold">{selectedBin.qr_code}</p>
                </div>
              )}

              {/* Quick Actions */}
              <div className="grid grid-cols-2 gap-2">
                <Link to={createPageUrl(`PrintBinLabel?id=${selectedBin.id}`)}>
                  <Button variant="outline" className="w-full gap-2">
                    <Printer className="w-4 h-4" />
                    Print Label
                  </Button>
                </Link>
                <Button
                  onClick={() => setSelectedBin(null)}
                  variant="outline"
                >
                  Clear
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick Bin List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Available Bins
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-96 overflow-y-auto">
            {bins.filter(b => b.status === 'available' || b.status === 'empty').slice(0, 10).map((bin) => (
              <div
                key={bin.id}
                onClick={() => setSelectedBin(bin)}
                className="p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BoxIcon className="w-4 h-4 text-gray-600" />
                    <div>
                      <p className="font-semibold text-sm">{bin.bin_code}</p>
                      <p className="text-xs text-gray-600">Zone {bin.zone}</p>
                    </div>
                  </div>
                  <Badge className={`${getStatusColor(bin.status)} text-xs`}>
                    {bin.status}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}