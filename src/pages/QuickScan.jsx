import React, { useState } from "react";
import { recims } from "@/api/recimsClient";
import { useQuery } from "@tanstack/react-query";
import { useTenant } from "@/components/TenantContext";
import { useNavigate, Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  ArrowLeft,
  Package,
  BoxIcon,
  FileText,
  AlertCircle,
  CheckCircle2,
  Info,
  Search
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import TenantHeader from "@/components/TenantHeader";

export default function QuickScan() {
  const navigate = useNavigate();
  const { user } = useTenant();
  const [scannedCode, setScannedCode] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState(null);

  const handleScan = async (code) => {
    if (!code || code.trim() === '') return;
    
    setScannedCode(code);
    setSearching(true);
    setError(null);
    setSearchResult(null);

    try {
      // Search across multiple entities with tenant filtering
      const [bins, inventory, pos, sos] = await Promise.all([
        recims.entities.Bin.filter({ tenant_id: user?.tenant_id, qr_code: code }).catch(() => []),
        recims.entities.Inventory.filter({ tenant_id: user?.tenant_id, lot_number: code }).catch(() => []),
        recims.entities.PurchaseOrder.filter({ tenant_id: user?.tenant_id, barcode_prefix: code }).catch(() => []),
        recims.entities.SalesOrder.filter({ tenant_id: user?.tenant_id, so_number: code }).catch(() => [])
      ]);

      // Check bins
      if (bins.length > 0) {
        setSearchResult({
          type: 'bin',
          data: bins[0],
          actions: [
            { label: 'View Bin Details', path: createPageUrl("BinManagement") },
            { label: 'Print Label', path: createPageUrl(`PrintBinLabel?id=${bins[0].id}`) }
          ]
        });
        return;
      }

      // Check inventory
      if (inventory.length > 0) {
        setSearchResult({
          type: 'inventory',
          data: inventory[0],
          actions: [
            { label: 'View Inventory', path: createPageUrl("InventoryManagement") },
            { label: 'Create Sales Order', path: createPageUrl("CreateSalesOrder") }
          ]
        });
        return;
      }

      // Check purchase orders
      if (pos.length > 0) {
        setSearchResult({
          type: 'purchase_order',
          data: pos[0],
          actions: [
            { label: 'View PO', path: createPageUrl(`ViewPurchaseOrder?id=${pos[0].id}`) },
            { label: 'Receive Items', path: createPageUrl(`ReceivePurchaseOrder?po_id=${pos[0].id}`) }
          ]
        });
        return;
      }

      // Check sales orders
      if (sos.length > 0) {
        setSearchResult({
          type: 'sales_order',
          data: sos[0],
          actions: [
            { label: 'View SO', path: createPageUrl(`ViewSalesOrder?id=${sos[0].id}`) },
            { label: 'Start Picking', path: createPageUrl(`MobilePicking?so_id=${sos[0].id}`) }
          ]
        });
        return;
      }

      // Nothing found
      setError(`No match found for code: ${code}`);
    } catch (err) {
      setError("Error searching. Please try again.");
      console.error(err);
    } finally {
      setSearching(false);
    }
  };

  const getResultIcon = () => {
    switch(searchResult?.type) {
      case 'bin': return BoxIcon;
      case 'inventory': return Package;
      case 'purchase_order': return FileText;
      case 'sales_order': return FileText;
      default: return Info;
    }
  };

  const getResultColor = () => {
    switch(searchResult?.type) {
      case 'bin': return 'bg-green-100 text-green-700';
      case 'inventory': return 'bg-blue-100 text-blue-700';
      case 'purchase_order': return 'bg-purple-100 text-purple-700';
      case 'sales_order': return 'bg-orange-100 text-orange-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getResultTitle = () => {
    const data = searchResult?.data;
    switch(searchResult?.type) {
      case 'bin': return `Bin ${data.bin_code}`;
      case 'inventory': return data.item_name || data.inventory_id;
      case 'purchase_order': return `PO ${data.po_number}`;
      case 'sales_order': return `SO ${data.so_number}`;
      default: return 'Unknown';
    }
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
            <h1 className="text-xl font-bold text-gray-900">Quick Scan</h1>
            <p className="text-sm text-gray-600">Scan to lookup items, bins, or orders</p>
          </div>
        </div>

        {/* Manual Search Input */}
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              value={scannedCode}
              onChange={(e) => setScannedCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleScan(scannedCode);
                }
              }}
              placeholder="Enter barcode/QR code..."
              className="pl-10"
              autoFocus={true}
            />
          </div>
          <Button
            onClick={() => handleScan(scannedCode)}
            disabled={!scannedCode || searching}
            className="w-full mt-2 bg-green-600 hover:bg-green-700"
          >
            Search
          </Button>
        </div>

        {/* Searching Indicator */}
        {searching && (
          <Card className="mb-4 border-blue-200 bg-blue-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <div>
                  <p className="font-semibold text-blue-900">Searching...</p>
                  <p className="text-sm text-blue-700">Looking up: {scannedCode}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error */}
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Search Result */}
        {searchResult && (
          <Card className="mb-4">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  Match Found
                </CardTitle>
                <Badge className={getResultColor()}>
                  {searchResult.type.replace('_', ' ').toUpperCase()}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Result Details */}
              <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="bg-white p-2 rounded">
                  {React.createElement(getResultIcon(), { className: "w-6 h-6 text-gray-700" })}
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-lg">{getResultTitle()}</h3>
                  
                  {searchResult.type === 'bin' && (
                    <div className="text-sm text-gray-600 mt-1 space-y-1">
                      <p>Zone: {searchResult.data.zone}</p>
                      <p>Status: {searchResult.data.status}</p>
                      <p>Capacity: {searchResult.data.current_weight_kg} / {searchResult.data.max_weight_kg} kg</p>
                    </div>
                  )}

                  {searchResult.type === 'inventory' && (
                    <div className="text-sm text-gray-600 mt-1 space-y-1">
                      <p>Category: {searchResult.data.category}</p>
                      <p>Quantity: {searchResult.data.quantity_kg} kg</p>
                      <p>Location: {searchResult.data.bin_location || 'Not assigned'}</p>
                    </div>
                  )}

                  {searchResult.type === 'purchase_order' && (
                    <div className="text-sm text-gray-600 mt-1 space-y-1">
                      <p>Vendor: {searchResult.data.vendor_name}</p>
                      <p>Status: {searchResult.data.status}</p>
                      <p>Expected: {searchResult.data.expected_delivery_date}</p>
                    </div>
                  )}

                  {searchResult.type === 'sales_order' && (
                    <div className="text-sm text-gray-600 mt-1 space-y-1">
                      <p>Customer: {searchResult.data.customer_name}</p>
                      <p>Status: {searchResult.data.status}</p>
                      <p>Ship Date: {searchResult.data.ship_date}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="space-y-2">
                {searchResult.actions.map((action, idx) => (
                  <Link key={idx} to={action.path} className="block">
                    <Button className="w-full" variant={idx === 0 ? "default" : "outline"}>
                      {action.label}
                    </Button>
                  </Link>
                ))}
              </div>

              {/* Scan Another */}
              <Button
                onClick={() => {
                  setSearchResult(null);
                  setScannedCode('');
                  setError(null);
                }}
                variant="outline"
                className="w-full"
              >
                Search Another
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Quick Access */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Quick Access</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link to={createPageUrl("MobileBinLookup")}>
              <Button variant="outline" className="w-full justify-start gap-2">
                <BoxIcon className="w-4 h-4" />
                Bin Lookup
              </Button>
            </Link>
            <Link to={createPageUrl("InventoryManagement")}>
              <Button variant="outline" className="w-full justify-start gap-2">
                <Package className="w-4 h-4" />
                Inventory Search
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}