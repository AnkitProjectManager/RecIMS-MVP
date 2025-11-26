import React, { useRef } from "react";
import { recims } from "@/api/recimsClient";
import { useQuery } from "@tanstack/react-query";
import { useTenant } from "@/components/TenantContext";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Package, ArrowLeft, Printer, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function PrintBinQR() {
  const navigate = useNavigate();
  const printRef = useRef(null);
  const { user, tenantConfig } = useTenant();
  
  const urlParams = new URLSearchParams(window.location.search);
  const binCode = urlParams.get('bin');
  const zoneCode = urlParams.get('zone');
  const skuNumber = urlParams.get('sku');
  
  // Determine weight unit based on tenant configuration
  const useMetric = tenantConfig?.weight_unit === 'kg' || tenantConfig?.weight_unit === 'metric';
  const weightUnit = useMetric ? 'kg' : 'lbs';

  const { data: bin, isLoading: loadingBin, error: binError } = useQuery({
    queryKey: ['bin', binCode, user?.tenant_id],
    queryFn: async () => {
      if (!user?.tenant_id) return null;
      
      const allBins = await recims.entities.Bin.filter({ tenant_id: user.tenant_id });
      
      const matchedBin = allBins.find(b => 
        b.bin_code.toUpperCase() === binCode?.toUpperCase()
      );
      
      return matchedBin;
    },
    enabled: !!binCode && !!user?.tenant_id,
  });

  const { data: zone, isLoading: loadingZone, error: zoneError } = useQuery({
    queryKey: ['zone', zoneCode, user?.tenant_id],
    queryFn: async () => {
      if (!user?.tenant_id) return null;
      
      const allZones = await recims.entities.Zone.filter({ tenant_id: user.tenant_id });
      
      const matchedZone = allZones.find(z => 
        z.zone_code.toUpperCase() === zoneCode?.toUpperCase()
      );
      
      return matchedZone;
    },
    enabled: !!zoneCode && !!user?.tenant_id,
  });

  const { data: binInventory = [], isLoading: loadingInventory } = useQuery({
    queryKey: ['binInventory', bin?.bin_code, user?.tenant_id],
    queryFn: async () => {
      if (!bin?.bin_code || !user?.tenant_id) return [];
      const items = await recims.entities.Inventory.filter({
        bin_location: bin.bin_code,
        tenant_id: user.tenant_id,
        status: 'available'
      }, '-created_date');
      return items;
    },
    enabled: !!bin?.bin_code && !!user?.tenant_id,
  });

  const handlePrint = () => {
    window.print();
  };

  if (!user || loadingBin || loadingZone || loadingInventory) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading bin and zone data...</p>
        </div>
      </div>
    );
  }

  if (!bin || !zone) {
    return (
      <div className="p-4 md:p-8 max-w-4xl mx-auto">
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Bin or Zone not found</strong>
            <div className="mt-2 space-y-2 text-sm">
              <p>Looking for:</p>
              <ul className="list-disc ml-5">
                <li>Bin Code: <strong>{binCode || 'Not provided'}</strong> {!bin && '❌ Not Found'} {bin && '✅ Found'}</li>
                <li>Zone Code: <strong>{zoneCode || 'Not provided'}</strong> {!zone && '❌ Not Found'} {zone && '✅ Found'}</li>
                <li>Tenant: <strong>{user?.tenant_id || 'Not set'}</strong></li>
              </ul>
              {binError && <p className="text-red-700">Bin Error: {binError.message}</p>}
              {zoneError && <p className="text-red-700">Zone Error: {zoneError.message}</p>}
            </div>
          </AlertDescription>
        </Alert>
        <div className="flex gap-3">
          <Button
            onClick={() => navigate(createPageUrl("MaterialClassification"))}
            variant="outline"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Classification
          </Button>
          <Button
            onClick={() => navigate(createPageUrl("BinManagement"))}
            variant="outline"
          >
            Go to Bin Management
          </Button>
        </div>
      </div>
    );
  }

  const actualBinCode = bin.bin_code;
  const actualZoneCode = zone.zone_code;
  const qrData = `BIN:${actualBinCode}|ZONE:${actualZoneCode}`;

  // NEW: Determine primary SKU and additional SKUs
  const primarySKU = skuNumber 
    ? binInventory.find(item => item.sku_number === skuNumber) 
    : binInventory[0]; // If no SKU specified, use first item
  
  const additionalSKUs = binInventory.filter(item => 
    item.sku_number && item.sku_number !== primarySKU?.sku_number
  );

  return (
    <>
      {/* Screen UI - Hidden on Print */}
      <div className="screen-only p-4 md:p-8 max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate(createPageUrl("MaterialClassification"))}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Package className="w-7 h-7 text-green-600" />
              Print Bin QR Code Label
            </h1>
            <p className="text-sm text-gray-600">{`Bin: ${actualBinCode} • Zone: ${actualZoneCode} • 4"x6" Thermal Label`}</p>
          </div>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Label Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-gray-100 p-4 rounded-lg space-y-2">
              <p className="text-sm text-gray-600">
                <strong>Bin:</strong> {actualBinCode}
              </p>
              <p className="text-sm text-gray-600">
                <strong>Zone:</strong> {actualZoneCode} - {zone.zone_name}
              </p>
              {bin.bin_description && (
                <p className="text-sm text-gray-600">
                  <strong>Description:</strong> {bin.bin_description}
                </p>
              )}
              <p className="text-sm text-gray-600">
                <strong>Material Type:</strong> {bin.material_type || 'Empty'}
              </p>
              <p className="text-sm text-gray-600">
                <strong>Status:</strong> {bin.status}
              </p>
              {primarySKU?.sku_number && (
                <p className="text-sm text-gray-600">
                  <strong>Primary SKU:</strong> {primarySKU.sku_number}
                </p>
              )}
              {additionalSKUs.length > 0 && (
                <p className="text-sm text-gray-600">
                  <strong>Additional SKUs:</strong> {additionalSKUs.length} more item(s) in bin
                </p>
              )}
              <p className="text-sm text-gray-600 mt-4 p-2 bg-blue-50 border border-blue-200 rounded">
                <strong>QR Code Contains:</strong> BIN:{actualBinCode} | ZONE:{actualZoneCode}
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button
            onClick={() => navigate(createPageUrl("MaterialClassification"))}
            variant="outline"
            className="flex-1"
          >
            Back to Classification
          </Button>
          <Button
            onClick={handlePrint}
            className="flex-1 bg-green-600 hover:bg-green-700 gap-2"
          >
            <Printer className="w-4 h-4" />
            Print Label
          </Button>
        </div>
      </div>

      {/* Print Content - 4x6 Thermal Label */}
      <div ref={printRef} className="print-only">
        <div style={{
          width: '4in',
          height: '6in',
          padding: '0.25in',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxSizing: 'border-box',
          fontFamily: 'Arial, sans-serif'
        }}>
          {/* Header */}
          <div style={{
            textAlign: 'center',
            width: '100%',
            borderBottom: '3px solid black',
            paddingBottom: '0.1in',
            marginBottom: '0.1in'
          }}>
            <div style={{ fontSize: '28pt', fontWeight: 'bold', lineHeight: '1.1', marginBottom: '0.05in' }}>BIN LOCATION</div>
            <div style={{ fontSize: '16pt', fontWeight: '600', color: '#2563eb' }}>{actualBinCode}</div>
          </div>

          {/* QR Code */}
          <div style={{ textAlign: 'center', margin: '0.1in 0' }}>
            <img 
              src={`https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(qrData)}&margin=0`}
              alt={actualBinCode}
              style={{ width: '2.3in', height: '2.3in', display: 'block', margin: '0 auto' }}
            />
            
            {/* BIN#, ZONE#, and SKU# directly under QR code */}
            <div style={{ 
              marginTop: '0.1in',
              padding: '0.08in',
              backgroundColor: '#f3f4f6',
              border: '2px solid #374151',
              borderRadius: '0.08in',
              display: 'inline-block'
            }}>
              <div style={{ 
                fontSize: '14pt', 
                fontWeight: 'bold', 
                fontFamily: 'Courier New, monospace',
                color: '#1f2937',
                lineHeight: '1.3'
              }}>
                <div style={{ marginBottom: '0.02in' }}>
                  <span style={{ color: '#2563eb' }}>BIN#</span> {actualBinCode}
                </div>
                <div style={{ marginBottom: primarySKU?.sku_number ? '0.02in' : '0' }}>
                  <span style={{ color: '#059669' }}>ZONE#</span> {actualZoneCode}
                </div>
                {primarySKU?.sku_number && (
                  <div>
                    <span style={{ color: '#7c3aed' }}>SKU#</span> {primarySKU.sku_number}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Bin Details */}
          <div style={{ width: '100%', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.04in' }}>
            {zone.zone_name && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10pt', lineHeight: '1.2', paddingBottom: '0.05in', borderBottom: '2px solid #e5e7eb' }}>
                <span style={{ fontWeight: '600', minWidth: '1in' }}>Zone Name:</span>
                <span style={{ fontWeight: '700', textAlign: 'right', flex: 1 }}>{zone.zone_name}</span>
              </div>
            )}
            
            {bin.bin_description && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9pt', lineHeight: '1.2' }}>
                <span style={{ fontWeight: '600', minWidth: '1in' }}>Location:</span>
                <span style={{ textAlign: 'right', flex: 1 }}>{bin.bin_description.substring(0, 40)}</span>
              </div>
            )}
            
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10pt', lineHeight: '1.2' }}>
              <span style={{ fontWeight: '600', minWidth: '1in' }}>Material:</span>
              <span style={{ fontWeight: '700', textAlign: 'right', flex: 1 }}>{bin.material_type || 'Empty'}</span>
            </div>
            
            {primarySKU && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9pt', lineHeight: '1.2' }}>
                  <span style={{ fontWeight: '600', minWidth: '1in' }}>Product:</span>
                  <span style={{ textAlign: 'right', flex: 1 }}>{primarySKU.product_type || primarySKU.item_name}</span>
                </div>
                {primarySKU.purity && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9pt', lineHeight: '1.2' }}>
                    <span style={{ fontWeight: '600', minWidth: '1in' }}>Purity:</span>
                    <span style={{ textAlign: 'right', flex: 1 }}>{primarySKU.purity}</span>
                  </div>
                )}
              </>
            )}
            
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10pt', lineHeight: '1.2' }}>
              <span style={{ fontWeight: '600', minWidth: '1in' }}>Status:</span>
              <span style={{ 
                fontWeight: '700', 
                textAlign: 'right', 
                flex: 1,
                color: bin.status === 'available' ? '#059669' : bin.status === 'full' ? '#dc2626' : '#6b7280'
              }}>
                {bin.status.toUpperCase()}
              </span>
            </div>

            {bin.track_weight !== false && (useMetric ? bin.max_weight_kg : bin.max_weight_lbs) && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9pt', lineHeight: '1.2', marginTop: '0.05in' }}>
                <span style={{ fontWeight: '600' }}>Weight:</span>
                <span style={{ textAlign: 'right' }}>
                  {useMetric 
                    ? `${(bin.current_weight_kg || 0).toFixed(0)} / ${bin.max_weight_kg.toFixed(0)} kg`
                    : `${(bin.current_weight_lbs || 0).toFixed(0)} / ${bin.max_weight_lbs.toFixed(0)} lbs`
                  }
                </span>
              </div>
            )}

            {additionalSKUs.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8pt', lineHeight: '1.2', marginTop: '0.05in', color: '#6b7280' }}>
                <span style={{ fontWeight: '600' }}>Other SKUs:</span>
                <span style={{ textAlign: 'right' }}>+ {additionalSKUs.length} more</span>
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{ width: '100%', textAlign: 'center', borderTop: '2px solid black', paddingTop: '0.08in', marginTop: '0.08in' }}>
            <div style={{ fontSize: '10pt', fontWeight: '600', marginBottom: '0.04in' }}>
              WAREHOUSE LOCATION
            </div>
            <div style={{ fontSize: '8pt', color: '#6b7280' }}>
              Scan QR code • BIN:{actualBinCode} | ZONE:{actualZoneCode}
              {primarySKU?.sku_number && ` | SKU:${primarySKU.sku_number}`}
            </div>
          </div>
        </div>
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          @page {
            size: 4in 6in;
            margin: 0;
          }
          
          body {
            margin: 0;
            padding: 0;
          }
          
          .screen-only {
            display: none !important;
          }
          
          .print-only {
            display: block !important;
          }
          
          * {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
        }
        
        @media screen {
          .print-only {
            display: none !important;
          }
        }
      `}</style>
    </>
  );
}