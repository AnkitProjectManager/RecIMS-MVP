import React, { useState } from "react";
import { recims } from "@/api/recimsClient";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useTenant } from "@/components/TenantContext";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  ArrowLeft,
  ArrowUpDown,
  CheckCircle2,
  Scan,
  Package
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import BarcodeScanner from "@/components/mobile/BarcodeScanner";
import TenantHeader from "@/components/TenantHeader";

export default function MobilePutAway() {
  const queryClient = useQueryClient();
  const { tenantConfig, user } = useTenant();
  const [step, setStep] = useState('scan_item'); // 'scan_item', 'scan_bin', 'confirm'
  const [scannedItem, setScannedItem] = useState(null);
  const [scannedBin, setScannedBin] = useState(null);
  const [quantity, setQuantity] = useState('');

  const { data: poItems = [] } = useQuery({
    queryKey: ['receivedPOItems'],
    queryFn: async () => {
      return await recims.entities.PurchaseOrderItem.filter({ status: 'received' });
    },
    initialData: [],
  });

  const { data: bins = [] } = useQuery({
    queryKey: ['availableBins'],
    queryFn: async () => {
      return await recims.entities.Bin.filter({ 
        status: { $in: ['available', 'empty'] }
      });
    },
    initialData: [],
  });

  const handleScanItem = async (code) => {
    // Search for received PO item or inventory lot
    const foundPOItem = poItems.find(item => 
      item.barcode === code || item.skid_number === code
    );

    if (foundPOItem) {
      setScannedItem(foundPOItem);
      setQuantity(foundPOItem.actual_weight_kg?.toString() || '');
      setStep('scan_bin');
    } else {
      alert(`Item not found: ${code}`);
    }
  };

  const handleScanBin = async (code) => {
    const foundBin = bins.find(b => b.qr_code === code || b.bin_code === code);
    
    if (foundBin) {
      setScannedBin(foundBin);
      setStep('confirm');
    } else {
      alert(`Bin not found: ${code}`);
    }
  };

  const putAwayMutation = useMutation({
    mutationFn: async () => {
      // Update bin
      await recims.entities.Bin.update(scannedBin.id, {
        material_type: scannedItem.category,
        current_weight_kg: (scannedBin.current_weight_kg || 0) + parseFloat(quantity),
        status: 'available'
      });

      // Update PO item with bin location
      await recims.entities.PurchaseOrderItem.update(scannedItem.id, {
        bin_location: scannedBin.bin_code,
        zone: scannedBin.zone
      });

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bins'] });
      queryClient.invalidateQueries({ queryKey: ['receivedPOItems'] });
      alert('Put-away completed successfully!');
      // Reset
      setScannedItem(null);
      setScannedBin(null);
      setQuantity('');
      setStep('scan_item');
    },
    onError: () => {
      alert('Failed to complete put-away');
    }
  });

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
            <h1 className="text-xl font-bold text-gray-900">Put-Away</h1>
            <p className="text-sm text-gray-600">Store received items</p>
          </div>
        </div>

        {/* Progress */}
        <div className="flex items-center justify-between mb-6">
          <div className={`flex-1 text-center ${step === 'scan_item' ? 'text-blue-600' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full mx-auto mb-1 flex items-center justify-center ${
              step === 'scan_item' ? 'bg-blue-600 text-white' : scannedItem ? 'bg-green-600 text-white' : 'bg-gray-200'
            }`}>1</div>
            <p className="text-xs font-semibold">Scan Item</p>
          </div>
          <div className="flex-1 border-t-2 border-gray-300 mx-2 mt-[-20px]"></div>
          <div className={`flex-1 text-center ${step === 'scan_bin' ? 'text-blue-600' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full mx-auto mb-1 flex items-center justify-center ${
              step === 'scan_bin' ? 'bg-blue-600 text-white' : scannedBin ? 'bg-green-600 text-white' : 'bg-gray-200'
            }`}>2</div>
            <p className="text-xs font-semibold">Scan Bin</p>
          </div>
          <div className="flex-1 border-t-2 border-gray-300 mx-2 mt-[-20px]"></div>
          <div className={`flex-1 text-center ${step === 'confirm' ? 'text-blue-600' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full mx-auto mb-1 flex items-center justify-center ${
              step === 'confirm' ? 'bg-blue-600 text-white' : 'bg-gray-200'
            }`}>3</div>
            <p className="text-xs font-semibold">Confirm</p>
          </div>
        </div>

        {/* Step 1: Scan Item */}
        {step === 'scan_item' && (
          <div>
            <BarcodeScanner
              onScan={handleScanItem}
              placeholder="Scan item barcode or lot number..."
            />
            {poItems.length > 0 && (
              <Card className="mt-4">
                <CardContent className="p-4">
                  <p className="text-sm font-semibold text-gray-700 mb-2">
                    Recent Received Items ({poItems.length})
                  </p>
                  <div className="space-y-2">
                    {poItems.slice(0, 3).map((item) => (
                      <div
                        key={item.id}
                        onClick={() => {
                          setScannedItem(item);
                          setQuantity(item.actual_weight_kg?.toString() || '');
                          setStep('scan_bin');
                        }}
                        className="p-2 border rounded hover:bg-gray-50 cursor-pointer"
                      >
                        <p className="text-sm font-semibold">{item.skid_number}</p>
                        <p className="text-xs text-gray-600">{item.category}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Step 2: Scan Bin */}
        {step === 'scan_bin' && (
          <div className="space-y-4">
            <Card className="border-green-500 bg-green-50">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  <p className="font-semibold text-green-900">Item Scanned</p>
                </div>
                <p className="text-sm">{scannedItem.skid_number}</p>
                <p className="text-xs text-gray-600">{scannedItem.category} - {quantity} kg</p>
              </CardContent>
            </Card>

            <BarcodeScanner
              onScan={handleScanBin}
              placeholder="Scan bin QR code..."
            />

            <div className="space-y-2">
              <Label>Quantity (kg)</Label>
              <Input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="Enter quantity..."
              />
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={() => setStep('scan_item')}
            >
              Back
            </Button>
          </div>
        )}

        {/* Step 3: Confirm */}
        {step === 'confirm' && (
          <div className="space-y-4">
            <Card className="border-blue-500">
              <CardContent className="p-4 space-y-3">
                <div>
                  <p className="text-xs text-gray-600">Item</p>
                  <p className="font-bold">{scannedItem.skid_number}</p>
                  <p className="text-sm text-gray-600">{scannedItem.category}</p>
                </div>

                <div className="border-t pt-3">
                  <p className="text-xs text-gray-600">Destination Bin</p>
                  <p className="font-bold text-lg">{scannedBin.bin_code}</p>
                  <p className="text-sm text-gray-600">Zone {scannedBin.zone}</p>
                </div>

                <div className="border-t pt-3">
                  <p className="text-xs text-gray-600">Quantity</p>
                  <p className="font-bold text-blue-700">{quantity} kg</p>
                </div>
              </CardContent>
            </Card>

            <Alert>
              <Package className="h-4 w-4" />
              <AlertDescription>
                Review the details above and confirm put-away
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                onClick={() => setStep('scan_bin')}
              >
                Back
              </Button>
              <Button
                onClick={() => putAwayMutation.mutate()}
                disabled={putAwayMutation.isPending}
                className="bg-green-600 hover:bg-green-700"
              >
                {putAwayMutation.isPending ? 'Processing...' : 'Confirm'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}