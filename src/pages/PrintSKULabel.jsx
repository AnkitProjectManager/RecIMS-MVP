
import React, { useRef } from "react";
import { recims } from "@/api/recimsClient";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Package, ArrowLeft, Printer, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { format } from "date-fns";

export default function PrintSKULabel() {
  const navigate = useNavigate();
  const printRef = useRef(null);
  
  const urlParams = new URLSearchParams(window.location.search);
  const skuNumber = urlParams.get('sku');
  const labelFormat = urlParams.get('format') || '4x6'; // '4x6' or 'letter'

  const { data: sku, isLoading, error } = useQuery({
    queryKey: ['sku', skuNumber],
    queryFn: async () => {
      if (!skuNumber) {
        throw new Error("No SKU number provided in URL");
      }
      
      // Fetch all active SKUs and do case-insensitive search
      const allSkus = await recims.entities.ProductSKU.filter({ status: 'active' });
      
      // Case-insensitive lookup
      const foundSku = allSkus.find(s => 
        s.sku_number && s.sku_number.toLowerCase() === skuNumber.toLowerCase()
      );
      
      if (!foundSku) {
        throw new Error(`Product SKU "${skuNumber}" not found in the system`);
      }
      
      return foundSku;
    },
    enabled: !!skuNumber,
    retry: false,
  });

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading SKU...</p>
        </div>
      </div>
    );
  }

  if (!skuNumber) {
    return (
      <div className="p-4 md:p-8 max-w-4xl mx-auto">
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Missing SKU Number:</strong> No SKU number was provided in the URL. 
            Please select a product with a valid SKU.
          </AlertDescription>
        </Alert>
        <Button onClick={() => navigate(createPageUrl("Dashboard"))}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>
      </div>
    );
  }

  if (error || !sku) {
    return (
      <div className="p-4 md:p-8 max-w-4xl mx-auto">
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Product SKU Not Found:</strong> {error?.message || `SKU "${skuNumber}" does not exist in the system.`}
          </AlertDescription>
        </Alert>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-yellow-800 mb-2">
            <strong>Possible reasons:</strong>
          </p>
          <ul className="text-sm text-yellow-700 list-disc list-inside space-y-1">
            <li>The SKU has not been created in the system yet</li>
            <li>The product classification does not match any existing SKU</li>
            <li>The SKU was deleted or deactivated</li>
            <li>The SKU is in a different case (uppercase/lowercase) - we search case-insensitively now</li>
          </ul>
        </div>
        <div className="space-y-3">
          <Button 
            onClick={() => navigate(createPageUrl("ManageProductSKUs"))}
            className="w-full bg-blue-600 hover:bg-blue-700"
          >
            <Package className="w-4 h-4 mr-2" />
            Go to Product SKU Management
          </Button>
          <Button 
            onClick={() => navigate(createPageUrl("Dashboard"))}
            variant="outline"
            className="w-full"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Screen UI - Hidden on Print */}
      <div className="screen-only p-4 md:p-8 max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate(createPageUrl("Dashboard"))}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Package className="w-7 h-7 text-green-600" />
              Print SKU Label
            </h1>
            <p className="text-sm text-gray-600">
              SKU: {sku.sku_number} • Format: {labelFormat === '4x6' ? '4"x6" Thermal' : '8.5"x11" Letter'}
            </p>
          </div>
          <Badge className="bg-green-600 text-white">PHASE I</Badge>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Label Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-gray-100 p-4 rounded-lg space-y-2">
              <p className="text-sm text-gray-600">
                <strong>Category:</strong> {sku.category}
              </p>
              <p className="text-sm text-gray-600">
                <strong>Type:</strong> {sku.product_type}
              </p>
              <p className="text-sm text-gray-600">
                <strong>Purity:</strong> {sku.purity}
              </p>
              {sku.format && (
                <p className="text-sm text-gray-600">
                  <strong>Format:</strong> {sku.format}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button
            onClick={() => navigate(createPageUrl("Dashboard"))}
            variant="outline"
            className="flex-1"
          >
            Back to Dashboard
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

      {/* Print Content */}
      <div ref={printRef} className="print-only">
        <div style={{
          width: labelFormat === '4x6' ? '4in' : '8.5in',
          height: labelFormat === '4x6' ? '6in' : '11in',
          padding: labelFormat === '4x6' ? '0.25in' : '0.5in',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxSizing: 'border-box',
          fontFamily: 'Arial, sans-serif'
        }}>
          <div style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            {/* Header */}
            <div style={{
              textAlign: 'center',
              width: '100%',
              borderBottom: '3px solid black',
              paddingBottom: '0.1in',
              marginBottom: '0.1in'
            }}>
              <div style={{ 
                fontSize: labelFormat === '4x6' ? '24pt' : '32pt', 
                fontWeight: 'bold', 
                lineHeight: '1.1', 
                marginBottom: '0.05in' 
              }}>
                PRODUCT SKU
              </div>
              <div style={{ 
                fontSize: labelFormat === '4x6' ? '13pt' : '18pt', 
                fontWeight: '600',
                fontFamily: 'Courier New, monospace'
              }}>
                {sku.sku_number}
              </div>
            </div>

            {/* QR Code */}
            <div style={{ textAlign: 'center', margin: labelFormat === '4x6' ? '0.1in 0' : '0.2in 0' }}>
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(sku.sku_number)}&margin=0`}
                alt={sku.sku_number}
                style={{ 
                  width: labelFormat === '4x6' ? '2.3in' : '3.5in', 
                  height: labelFormat === '4x6' ? '2.3in' : '3.5in', 
                  display: 'block', 
                  margin: '0 auto',
                  imageRendering: 'pixelated'
                }}
              />
              <div style={{ 
                fontSize: labelFormat === '4x6' ? '10pt' : '14pt', 
                fontWeight: 'bold', 
                fontFamily: 'Courier New, monospace', 
                marginTop: '0.08in', 
                letterSpacing: '0.05em' 
              }}>
                {sku.sku_number}
              </div>
            </div>

            {/* Product Details */}
            <div style={{ 
              width: '100%', 
              flex: 1, 
              display: 'flex', 
              flexDirection: 'column', 
              gap: labelFormat === '4x6' ? '0.04in' : '0.08in' 
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: labelFormat === '4x6' ? '10pt' : '14pt', lineHeight: '1.2' }}>
                <span style={{ fontWeight: '600', minWidth: labelFormat === '4x6' ? '1.2in' : '1.5in' }}>Category:</span>
                <span style={{ fontWeight: '700', textAlign: 'right', flex: 1 }}>{sku.category}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: labelFormat === '4x6' ? '10pt' : '14pt', lineHeight: '1.2' }}>
                <span style={{ fontWeight: '600', minWidth: labelFormat === '4x6' ? '1.2in' : '1.5in' }}>Sub-Category:</span>
                <span style={{ fontWeight: '700', textAlign: 'right', flex: 1 }}>{sku.sub_category}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: labelFormat === '4x6' ? '10pt' : '14pt', lineHeight: '1.2' }}>
                <span style={{ fontWeight: '600', minWidth: labelFormat === '4x6' ? '1.2in' : '1.5in' }}>Product Type:</span>
                <span style={{ fontWeight: '700', textAlign: 'right', flex: 1 }}>{sku.product_type}</span>
              </div>
              {sku.format && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: labelFormat === '4x6' ? '10pt' : '14pt', lineHeight: '1.2' }}>
                  <span style={{ fontWeight: '600', minWidth: labelFormat === '4x6' ? '1.2in' : '1.5in' }}>Format:</span>
                  <span style={{ fontWeight: '700', textAlign: 'right', flex: 1 }}>{sku.format}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: labelFormat === '4x6' ? '10pt' : '14pt', lineHeight: '1.2' }}>
                <span style={{ fontWeight: '600', minWidth: labelFormat === '4x6' ? '1.2in' : '1.5in' }}>Purity:</span>
                <span style={{ fontWeight: '700', textAlign: 'right', flex: 1, fontSize: labelFormat === '4x6' ? '13pt' : '18pt', color: '#388E3C' }}>{sku.purity}</span>
              </div>
            </div>

            {/* Footer */}
            <div style={{ 
              width: '100%', 
              textAlign: 'center', 
              borderTop: '2px solid black', 
              paddingTop: '0.08in', 
              marginTop: '0.08in' 
            }}>
              <div style={{ fontSize: labelFormat === '4x6' ? '9pt' : '12pt', fontWeight: '600', marginBottom: '0.04in' }}>
                Printed: {format(new Date(), 'MMM dd, yyyy HH:mm')}
              </div>
              {sku.description && (
                <div style={{ fontSize: labelFormat === '4x6' ? '8pt' : '11pt', fontStyle: 'italic' }}>
                  {sku.description}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          @page {
            size: ${labelFormat === '4x6' ? '4in 6in' : '8.5in 11in'};
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
