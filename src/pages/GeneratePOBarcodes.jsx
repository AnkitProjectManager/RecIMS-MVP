import React, { useState, useRef } from "react";
import { recims } from "@/api/recimsClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, ArrowLeft, Printer, Check } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export default function GeneratePOBarcodes() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState(null);
  const [printFormat, setPrintFormat] = useState('4x6');
  const [isGenerating, setIsGenerating] = useState(false);
  
  const urlParams = new URLSearchParams(window.location.search);
  const poId = urlParams.get('id');

  const { data: po, isLoading } = useQuery({
    queryKey: ['purchaseOrder', poId],
    queryFn: async () => {
      const pos = await recims.entities.PurchaseOrder.filter({ id: poId });
      return pos[0];
    },
    enabled: !!poId,
  });

  const { data: lineItems = [] } = useQuery({
    queryKey: ['poLineItems', poId],
    queryFn: async () => {
      return await recims.entities.PurchaseOrderItem.filter({ po_id: poId }, 'line_number');
    },
    enabled: !!poId,
    initialData: [],
  });

  const generateAndSaveBarcodesMutation = useMutation({
    mutationFn: async () => {
      // Generate and save barcodes for each line item
      for (const item of lineItems) {
        if (!item.barcode) {
          const barcode = item.skid_number;
          await recims.entities.PurchaseOrderItem.update(item.id, {
            barcode: barcode
          });
        }
      }

      // Mark PO as having barcodes generated
      await recims.entities.PurchaseOrder.update(poId, {
        barcode_generated: true,
        barcode_prefix: po.po_number,
        status: po?.status === 'draft' ? 'sent' : po?.status
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchaseOrder', poId] });
      queryClient.invalidateQueries({ queryKey: ['poLineItems', poId] });
      queryClient.invalidateQueries({ queryKey: ['purchaseOrders'] });
      setIsGenerating(false);
    },
    onError: (err) => {
      setError(err.message || "Failed to generate barcodes");
      setIsGenerating(false);
    }
  });

  const handlePrint = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      // First generate and save barcodes if not already done
      if (!po?.barcode_generated) {
        await generateAndSaveBarcodesMutation.mutateAsync();
      }

      // Wait a moment for state to update and images to load
      setTimeout(() => {
        window.print();
        setIsGenerating(false);
      }, 800);
    } catch (err) {
      setError(err.message || "Failed to prepare labels for printing");
      setIsGenerating(false);
    }
  };

  const groupedBySkid = lineItems.reduce((acc, item) => {
    const skidNum = item.skid_number;
    if (!acc[skidNum]) {
      acc[skidNum] = [];
    }
    acc[skidNum].push(item);
    return acc;
  }, {});

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!po) {
    return (
      <div className="p-4 md:p-8 max-w-4xl mx-auto">
        <Alert variant="destructive">
          <AlertDescription>Purchase order not found</AlertDescription>
        </Alert>
      </div>
    );
  }

  const skidEntries = Object.entries(groupedBySkid);

  return (
    <div>
      {/* Screen UI - Will be hidden when printing */}
      <div className="screen-view p-4 md:p-8 max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate(createPageUrl(`ViewPurchaseOrder?id=${poId}`))}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <FileText className="w-7 h-7 text-purple-600" />
              Generate QR Code Labels
            </h1>
            <p className="text-sm text-gray-600">PO: {po.po_number} • {skidEntries.length} skids</p>
          </div>
          {po.barcode_generated && (
            <Badge className="bg-green-100 text-green-700">
              <Check className="w-3 h-3 mr-1" />
              Generated
            </Badge>
          )}
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Print Format</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Select Label Format</Label>
              <Select value={printFormat} onValueChange={setPrintFormat}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="4x6">{'ZEBRA 4"×6" Thermal Labels'}</SelectItem>
                  <SelectItem value="letter">{'8.5"×11" Letter Size Paper'}</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-gray-600">
                {printFormat === '4x6' 
                  ? 'One label per skid on 4"×6" thermal paper (ZEBRA printer)'
                  : 'Four labels per page on standard 8.5"×11" letter size paper'}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Instructions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-start gap-2">
              <div className="bg-purple-100 rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-purple-700 font-bold text-xs">1</span>
              </div>
              <p className="text-gray-700">
                <strong>Print Labels:</strong> {'Click "Print Labels" button below.'}
                {printFormat === '4x6' ? ' Use ZEBRA thermal printer with 4"×6" label stock.' : ' Use any standard printer with 8.5"×11" paper.'}
              </p>
            </div>
            <div className="flex items-start gap-2">
              <div className="bg-purple-100 rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-purple-700 font-bold text-xs">2</span>
              </div>
              <p className="text-gray-700">
                <strong>Send to Vendor:</strong> Provide printed QR code labels to vendor/supplier before shipment
              </p>
            </div>
            <div className="flex items-start gap-2">
              <div className="bg-purple-100 rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-purple-700 font-bold text-xs">3</span>
              </div>
              <p className="text-gray-700">
                <strong>Affix Labels:</strong> Vendor affixes one QR code label to each skid/pallet
              </p>
            </div>
            <div className="flex items-start gap-2">
              <div className="bg-purple-100 rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-purple-700 font-bold text-xs">4</span>
              </div>
              <p className="text-gray-700">
                <strong>Receiving:</strong> Upon arrival, operators scan the QR code with a mobile device to verify and receive each skid
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button
            onClick={() => navigate(createPageUrl(`ViewPurchaseOrder?id=${poId}`))}
            variant="outline"
            className="flex-1"
            disabled={isGenerating}
          >
            Back to PO
          </Button>
          <Button
            onClick={handlePrint}
            className="flex-1 bg-purple-600 hover:bg-purple-700 gap-2"
            disabled={isGenerating}
          >
            <Printer className="w-4 h-4" />
            {isGenerating ? 'Preparing...' : `Print Labels (${printFormat === '4x6' ? 'ZEBRA 4×6' : 'Letter 8.5×11'})`}
          </Button>
        </div>
      </div>

      {/* Print Content - Will only show when printing */}
      <div className="print-view" style={{ display: 'none' }}>
        {printFormat === '4x6' ? (
          // 4x6 Labels
          skidEntries.map(([skidNum, skidItems], idx) => {
            const barcodeValue = skidItems[0].barcode || skidNum;
            return (
              <div key={idx} style={{
                width: '4in',
                height: '6in',
                pageBreakAfter: idx < skidEntries.length - 1 ? 'always' : 'auto',
                pageBreakInside: 'avoid',
                padding: '0.2in',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxSizing: 'border-box'
              }}>
                {/* Header */}
                <div style={{ textAlign: 'center', width: '100%', borderBottom: '3px solid black', paddingBottom: '0.08in', marginBottom: '0.12in' }}>
                  <div style={{ fontSize: '24pt', fontWeight: 'bold', lineHeight: '1.2', marginBottom: '0.04in' }}>{skidNum}</div>
                  <div style={{ fontSize: '12pt', fontWeight: '600' }}>PO: {po.po_number}</div>
                </div>

                {/* QR Code */}
                <div style={{ textAlign: 'center', margin: '0.12in 0' }}>
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(barcodeValue)}`}
                    alt={barcodeValue}
                    style={{ width: '2.4in', height: '2.4in', display: 'block', margin: '0 auto' }}
                  />
                  <div style={{ fontSize: '10pt', fontWeight: 'bold', fontFamily: 'Courier New, monospace', marginTop: '0.08in', letterSpacing: '0.04em' }}>
                    {barcodeValue}
                  </div>
                </div>

                {/* Details */}
                <div style={{ width: '100%', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.04in' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10pt', lineHeight: '1.3' }}>
                    <span style={{ fontWeight: '600', minWidth: '0.9in' }}>Products:</span>
                    <span style={{ fontWeight: '700', textAlign: 'right', flex: 1 }}>{skidItems.length}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10pt', lineHeight: '1.3' }}>
                    <span style={{ fontWeight: '600', minWidth: '0.9in' }}>Category:</span>
                    <span style={{ fontWeight: '700', textAlign: 'right', flex: 1 }}>{skidItems[0].category}</span>
                  </div>
                  {skidItems[0].sub_category && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10pt', lineHeight: '1.3' }}>
                      <span style={{ fontWeight: '600', minWidth: '0.9in' }}>Sub:</span>
                      <span style={{ fontWeight: '700', textAlign: 'right', flex: 1 }}>{skidItems[0].sub_category}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10pt', lineHeight: '1.3' }}>
                    <span style={{ fontWeight: '600', minWidth: '0.9in' }}>Purity:</span>
                    <span style={{ fontWeight: '700', textAlign: 'right', flex: 1 }}>{skidItems[0].purity}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10pt', lineHeight: '1.3' }}>
                    <span style={{ fontWeight: '600', minWidth: '0.9in' }}>Weight:</span>
                    <span style={{ fontWeight: '700', textAlign: 'right', flex: 1, fontSize: '13pt' }}>
                      {skidItems.reduce((sum, item) => sum + (item.expected_weight_lbs || 0), 0).toFixed(0)} lbs
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10pt', lineHeight: '1.3' }}>
                    <span style={{ fontWeight: '600', minWidth: '0.9in' }}>Container:</span>
                    <span style={{ fontWeight: '700', textAlign: 'right', flex: 1 }}>{skidItems[0].container_type}</span>
                  </div>
                </div>

                {/* Footer */}
                <div style={{ width: '100%', textAlign: 'center', borderTop: '2px solid black', paddingTop: '0.08in', marginTop: '0.08in' }}>
                  <div style={{ fontSize: '11pt', fontWeight: '600', marginBottom: '0.03in' }}>{po.vendor_name}</div>
                  {po.expected_delivery_date && (
                    <div style={{ fontSize: '9pt' }}>ETA: {new Date(po.expected_delivery_date).toLocaleDateString()}</div>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          // Letter Size - 4 per page
          (() => {
            const pages = [];
            for (let i = 0; i < skidEntries.length; i += 4) {
              const pageLabels = skidEntries.slice(i, i + 4);
              pages.push(
                <div key={i} style={{
                  width: '7.5in',
                  height: '10in',
                  pageBreakAfter: i + 4 < skidEntries.length ? 'always' : 'auto',
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gridTemplateRows: '1fr 1fr',
                  gap: '0.25in',
                  boxSizing: 'border-box'
                }}>
                  {pageLabels.map(([sNum, sItems], labelIdx) => {
                    const barcodeValue = sItems[0].barcode || sNum;
                    return (
                      <div key={labelIdx} style={{
                        border: '2px solid #000',
                        padding: '0.15in',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        boxSizing: 'border-box'
                      }}>
                        <div style={{ textAlign: 'center', width: '100%', borderBottom: '2px solid black', paddingBottom: '0.08in', marginBottom: '0.08in' }}>
                          <div style={{ fontSize: '18pt', fontWeight: 'bold', lineHeight: '1.1' }}>{sNum}</div>
                          <div style={{ fontSize: '10pt', fontWeight: '600', marginTop: '0.03in' }}>PO: {po.po_number}</div>
                        </div>
                        <div style={{ textAlign: 'center', margin: '0.08in 0' }}>
                          <img 
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(barcodeValue)}`}
                            alt={barcodeValue}
                            style={{ width: '1.8in', height: '1.8in', display: 'block', margin: '0 auto' }}
                          />
                          <div style={{ fontSize: '8pt', fontWeight: 'bold', fontFamily: 'Courier New, monospace', marginTop: '0.05in', letterSpacing: '0.03em' }}>
                            {barcodeValue}
                          </div>
                        </div>
                        <div style={{ width: '100%', fontSize: '9pt', lineHeight: '1.3' }}>
                          <div style={{ marginBottom: '0.03in' }}><strong>Products:</strong> {sItems.length}</div>
                          <div style={{ marginBottom: '0.03in' }}><strong>Category:</strong> {sItems[0].category}</div>
                          <div style={{ marginBottom: '0.03in' }}><strong>Purity:</strong> {sItems[0].purity}</div>
                          <div style={{ marginBottom: '0.03in' }}><strong>Weight:</strong> {sItems.reduce((sum, item) => sum + (item.expected_weight_lbs || 0), 0).toFixed(0)} lbs</div>
                        </div>
                        <div style={{ width: '100%', textAlign: 'center', borderTop: '1px solid black', paddingTop: '0.05in', fontSize: '8pt' }}>
                          <div>{po.vendor_name}</div>
                          {po.expected_delivery_date && <div>ETA: {new Date(po.expected_delivery_date).toLocaleDateString()}</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            }
            return pages;
          })()
        )}
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          @page {
            ${printFormat === '4x6' ? 'size: 4in 6in;' : 'size: letter;'}
            margin: ${printFormat === '4x6' ? '0' : '0.5in'};
          }
          
          body {
            margin: 0;
            padding: 0;
          }
          
          .screen-view {
            display: none !important;
          }
          
          .print-view {
            display: block !important;
          }
          
          * {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
        }
        
        @media screen {
          .print-view {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}