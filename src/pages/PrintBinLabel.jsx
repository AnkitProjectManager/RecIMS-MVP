import React, { useRef } from "react";
import { recims } from "@/api/recimsClient";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Warehouse, ArrowLeft, Printer } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function PrintBinLabel() {
  const navigate = useNavigate();
  const printRef = useRef(null);
  
  const urlParams = new URLSearchParams(window.location.search);
  const binId = urlParams.get('id');

  const { data: bin, isLoading } = useQuery({
    queryKey: ['bin', binId],
    queryFn: async () => {
      const bins = await recims.entities.Bin.filter({ id: binId });
      return bins[0];
    },
    enabled: !!binId,
  });

  const { data: materials = [] } = useQuery({
    queryKey: ['binMaterials', bin?.bin_code],
    queryFn: async () => {
      if (!bin?.bin_code) return [];
      return await recims.entities.Material.filter({ bin_assigned: bin.bin_code }, '-inspection_date');
    },
    enabled: !!bin?.bin_code,
    initialData: [],
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

  if (!bin) {
    return (
      <div className="p-4 md:p-8 max-w-4xl mx-auto">
        <Alert variant="destructive">
          <AlertDescription>Bin not found</AlertDescription>
        </Alert>
      </div>
    );
  }

  const totalWeight = materials.reduce((sum, m) => sum + (m.weight_kg || 0), 0);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      {/* Screen UI - Hidden on Print */}
      <div className="print:hidden mb-6">
        <div className="flex items-center gap-3 mb-6">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate(createPageUrl("BinManagement"))}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Warehouse className="w-7 h-7 text-green-600" />
              Print Bin Label
            </h1>
            <p className="text-sm text-gray-600">{`Bin: ${bin.bin_code} • 4"x6" Thermal Label`}</p>
          </div>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Label Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-gray-100 p-4 rounded-lg">
              <p className="text-sm text-gray-600 mb-2">
                <strong>Contents:</strong> {materials.length} item(s) • {totalWeight.toFixed(0)} kg
              </p>
              <p className="text-sm text-gray-600">
                <strong>Status:</strong> {bin.status} • <strong>Zone:</strong> {bin.zone}
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button
            onClick={() => navigate(createPageUrl("BinManagement"))}
            variant="outline"
            className="flex-1"
          >
            Back to Bins
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
      <div ref={printRef} className="print:block hidden">
        <div className="label-page">
          <div className="label-content">
            {/* Header */}
            <div className="label-header">
              <div className="label-title">{bin.bin_code}</div>
              <div className="zone-info">Zone {bin.zone}</div>
            </div>

            {/* QR Code */}
            <div className="qr-code-container">
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(bin.qr_code || bin.bin_code)}&margin=0`}
                alt={bin.bin_code}
                className="qr-code"
              />
              <div className="barcode-text">{bin.qr_code || bin.bin_code}</div>
            </div>

            {/* Bin Details */}
            <div className="label-details">
              <div className="detail-row">
                <span className="detail-label">Status:</span>
                <span className="detail-value">{bin.status.toUpperCase()}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Material:</span>
                <span className="detail-value">{bin.material_type}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Capacity:</span>
                <span className="detail-value">{bin.capacity_kg.toFixed(0)} kg</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Current:</span>
                <span className="detail-value weight">{bin.current_weight_kg?.toFixed(0) || 0} kg</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Items:</span>
                <span className="detail-value">{materials.length}</span>
              </div>
            </div>

            {/* Contents List */}
            {materials.length > 0 && (
              <div className="contents-section">
                <div className="contents-title">Contents:</div>
                <div className="contents-list">
                  {materials.slice(0, 3).map((material, index) => (
                    <div key={index} className="content-item">
                      • {material.material_category} - {material.weight_kg?.toFixed(0) || 0} kg
                    </div>
                  ))}
                  {materials.length > 3 && (
                    <div className="content-item">
                      + {materials.length - 3} more items
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Print Styles for 4x6 Thermal Labels */}
      <style jsx global>{`
        @media print {
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }

          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
            margin: 0;
            padding: 0;
          }

          @page {
            size: 4in 6in;
            margin: 0;
          }

          body > *:not(.print\\:block) {
            display: none !important;
          }

          .label-page {
            width: 4in;
            height: 6in;
            page-break-after: always;
            page-break-inside: avoid;
            display: flex;
            align-items: center;
            justify-content: center;
            background: white;
            padding: 0.25in;
            position: relative;
          }

          .label-content {
            width: 100%;
            height: 100%;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: space-between;
          }

          .label-header {
            text-align: center;
            width: 100%;
            border-bottom: 3px solid black;
            padding-bottom: 0.1in;
            margin-bottom: 0.15in;
          }

          .label-title {
            font-size: 32pt;
            font-weight: bold;
            line-height: 1.1;
            margin-bottom: 0.05in;
          }

          .zone-info {
            font-size: 16pt;
            font-weight: 600;
          }

          .qr-code-container {
            text-align: center;
            margin: 0.1in 0;
          }

          .qr-code {
            width: 2.2in;
            height: 2.2in;
            display: block;
            margin: 0 auto;
            image-rendering: pixelated;
          }

          .barcode-text {
            font-size: 10pt;
            font-weight: bold;
            font-family: 'Courier New', monospace;
            margin-top: 0.08in;
            letter-spacing: 0.05em;
          }

          .label-details {
            width: 100%;
            display: flex;
            flex-direction: column;
            gap: 0.04in;
            margin: 0.1in 0;
          }

          .detail-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 10pt;
            line-height: 1.2;
            border-bottom: 1px solid #ddd;
            padding-bottom: 0.02in;
          }

          .detail-label {
            font-weight: 600;
            min-width: 1in;
          }

          .detail-value {
            font-weight: 700;
            text-align: right;
            flex: 1;
          }

          .detail-value.weight {
            font-size: 12pt;
          }

          .contents-section {
            width: 100%;
            border-top: 2px solid black;
            padding-top: 0.08in;
            margin-top: 0.08in;
          }

          .contents-title {
            font-size: 10pt;
            font-weight: 600;
            margin-bottom: 0.05in;
          }

          .contents-list {
            font-size: 8pt;
            line-height: 1.3;
          }

          .content-item {
            margin-bottom: 0.02in;
          }
        }
      `}</style>
    </div>
  );
}