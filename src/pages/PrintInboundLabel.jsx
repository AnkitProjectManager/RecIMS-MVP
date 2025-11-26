import React, { useRef } from "react";
import { recims } from "@/api/recimsClient";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TruckIcon, ArrowLeft, Printer } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { format } from "date-fns";

export default function PrintInboundLabel() {
  const navigate = useNavigate();
  const printRef = useRef(null);
  
  const urlParams = new URLSearchParams(window.location.search);
  const shipmentId = urlParams.get('id');

  const { data: shipment, isLoading } = useQuery({
    queryKey: ['shipment', shipmentId],
    queryFn: async () => {
      const shipments = await recims.entities.InboundShipment.filter({ id: shipmentId });
      return shipments[0];
    },
    enabled: !!shipmentId,
  });

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!shipment) {
    return (
      <div className="p-4 md:p-8 max-w-4xl mx-auto">
        <Alert variant="destructive">
          <AlertDescription>Shipment not found</AlertDescription>
        </Alert>
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
              <TruckIcon className="w-7 h-7 text-green-600" />
              Print Inbound Shipment Label
            </h1>
            <p className="text-sm text-gray-600">{`Load: ${shipment.load_id} • 4"x6" Thermal Label`}</p>
          </div>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Label Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-gray-100 p-4 rounded-lg space-y-2">
              <p className="text-sm text-gray-600">
                <strong>Supplier:</strong> {shipment.supplier_name}
              </p>
              <p className="text-sm text-gray-600">
                <strong>Category:</strong> {shipment.product_category || shipment.load_type}
              </p>
              <p className="text-sm text-gray-600">
                <strong>Weight:</strong> {shipment.net_weight_lbs?.toFixed(0) || shipment.net_weight?.toFixed(0) || 'N/A'} {shipment.net_weight_lbs ? 'lbs' : 'kg'}
              </p>
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
            <div style={{ fontSize: '26pt', fontWeight: 'bold', lineHeight: '1.1', marginBottom: '0.05in' }}>INBOUND</div>
            <div style={{ fontSize: '14pt', fontWeight: '600' }}>{shipment.load_id}</div>
          </div>

          {/* QR Code */}
          <div style={{ textAlign: 'center', margin: '0.1in 0' }}>
            <img 
              src={`https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(shipment.load_id)}&margin=0`}
              alt={shipment.load_id}
              style={{ width: '2.3in', height: '2.3in', display: 'block', margin: '0 auto' }}
            />
            <div style={{ fontSize: '10pt', fontWeight: 'bold', fontFamily: 'Courier New, monospace', marginTop: '0.08in', letterSpacing: '0.05em' }}>
              {shipment.load_id}
            </div>
          </div>

          {/* Shipment Details */}
          <div style={{ width: '100%', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.04in' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10pt', lineHeight: '1.2' }}>
              <span style={{ fontWeight: '600', minWidth: '1in' }}>Supplier:</span>
              <span style={{ fontWeight: '700', textAlign: 'right', flex: 1 }}>{shipment.supplier_name}</span>
            </div>
            {shipment.product_category && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10pt', lineHeight: '1.2' }}>
                <span style={{ fontWeight: '600', minWidth: '1in' }}>Category:</span>
                <span style={{ fontWeight: '700', textAlign: 'right', flex: 1 }}>{shipment.product_category}</span>
              </div>
            )}
            {shipment.product_type && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10pt', lineHeight: '1.2' }}>
                <span style={{ fontWeight: '600', minWidth: '1in' }}>Type:</span>
                <span style={{ fontWeight: '700', textAlign: 'right', flex: 1 }}>{shipment.product_type}</span>
              </div>
            )}
            {shipment.product_purity && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10pt', lineHeight: '1.2' }}>
                <span style={{ fontWeight: '600', minWidth: '1in' }}>Purity:</span>
                <span style={{ fontWeight: '700', textAlign: 'right', flex: 1 }}>{shipment.product_purity}</span>
              </div>
            )}
            {(shipment.net_weight || shipment.net_weight_lbs) && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10pt', lineHeight: '1.2' }}>
                <span style={{ fontWeight: '600', minWidth: '1in' }}>Net Weight:</span>
                <span style={{ fontWeight: '700', textAlign: 'right', flex: 1, fontSize: '13pt' }}>
                  {shipment.net_weight_lbs 
                    ? `${shipment.net_weight_lbs.toFixed(0)} lbs`
                    : `${shipment.net_weight.toFixed(0)} kg`
                  }
                </span>
              </div>
            )}
            {shipment.truck_number && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10pt', lineHeight: '1.2' }}>
                <span style={{ fontWeight: '600', minWidth: '1in' }}>Truck:</span>
                <span style={{ fontWeight: '700', textAlign: 'right', flex: 1 }}>{shipment.truck_number}</span>
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{ width: '100%', textAlign: 'center', borderTop: '2px solid black', paddingTop: '0.08in', marginTop: '0.08in' }}>
            <div style={{ fontSize: '10pt', fontWeight: '600', marginBottom: '0.04in' }}>
              Arrived: {format(new Date(shipment.arrival_time), 'MMM dd, yyyy HH:mm')}
            </div>
            {shipment.operator_name && (
              <div style={{ fontSize: '9pt' }}>
                Operator: {shipment.operator_name}
              </div>
            )}
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