import React from "react";
import { recims } from "@/api/recimsClient";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Printer, Package } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function PrintInventoryLabels() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const inventoryIds = urlParams.get('ids')?.split(',') || [];
  
  const [printFormat, setPrintFormat] = React.useState('4x6');

  const { data: inventoryItems = [], isLoading } = useQuery({
    queryKey: ['inventoryToPrint', inventoryIds],
    queryFn: async () => {
      if (!inventoryIds.length) return [];
      const items = [];
      for (const id of inventoryIds) {
        const result = await recims.entities.Inventory.filter({ id });
        if (result[0]) items.push(result[0]);
      }
      return items;
    },
    enabled: inventoryIds.length > 0,
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
          <p className="mt-4 text-gray-600">Loading inventory items...</p>
        </div>
      </div>
    );
  }

  if (!inventoryItems.length) {
    return (
      <div className="p-4 md:p-8 max-w-4xl mx-auto">
        <Alert variant="destructive">
          <AlertDescription>No inventory items found</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div>
      {/* Screen UI - Will NOT show when printing */}
      <div className="screen-only p-4 md:p-8 max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate(createPageUrl("InventoryManagement"))}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">Print Inventory Labels</h1>
            <p className="text-sm text-gray-600">{inventoryItems.length} item(s) ready to print</p>
          </div>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Label Format</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select value={printFormat} onValueChange={setPrintFormat}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="4x6">{'4" × 6" Thermal Label (Single)'}</SelectItem>
                <SelectItem value="letter">Letter Size (4 per page)</SelectItem>
              </SelectContent>
            </Select>

            <Button onClick={handlePrint} className="w-full bg-green-600 hover:bg-green-700 gap-2">
              <Printer className="w-4 h-4" />
              Print {inventoryItems.length} Label{inventoryItems.length > 1 ? 's' : ''}
            </Button>
          </CardContent>
        </Card>

        {/* Preview */}
        <Card>
          <CardHeader>
            <CardTitle>Label Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {inventoryItems.map((item, idx) => (
                <div key={item.id} className="p-4 border rounded-lg bg-gray-50">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-gray-600">Inventory ID:</span>
                      <p className="font-semibold">{item.inventory_id}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Category:</span>
                      <p className="font-semibold">{item.category}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Product:</span>
                      <p className="font-semibold">{item.product_type || item.sub_category}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Weight:</span>
                      <p className="font-semibold">{item.quantity_lbs?.toFixed(0)} lbs</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Purity:</span>
                      <p className="font-semibold">{item.purity}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Location:</span>
                      <p className="font-semibold">{item.bin_location || 'Unassigned'}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Print Content - Will only show when printing */}
      <div className="print-view" style={{ display: 'none' }}>
        {printFormat === '4x6' ? (
          // 4x6 Labels
          inventoryItems.map((item, idx) => (
            <div key={idx} style={{
              width: '4in',
              height: '6in',
              pageBreakAfter: idx < inventoryItems.length - 1 ? 'always' : 'auto',
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
                <div style={{ fontSize: '22pt', fontWeight: 'bold', lineHeight: '1.2', marginBottom: '0.04in' }}>
                  {item.inventory_id}
                </div>
                <div style={{ fontSize: '11pt', fontWeight: '600' }}>INVENTORY</div>
              </div>

              {/* QR Code */}
              <div style={{ textAlign: 'center', margin: '0.12in 0' }}>
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(item.inventory_id)}`}
                  alt={item.inventory_id}
                  style={{ width: '2.4in', height: '2.4in', display: 'block', margin: '0 auto' }}
                />
              </div>

              {/* Details */}
              <div style={{ width: '100%', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.04in' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10pt', lineHeight: '1.3' }}>
                  <span style={{ fontWeight: '600', minWidth: '0.9in' }}>Category:</span>
                  <span style={{ fontWeight: '700', textAlign: 'right', flex: 1 }}>{item.category}</span>
                </div>
                {item.sub_category && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10pt', lineHeight: '1.3' }}>
                    <span style={{ fontWeight: '600', minWidth: '0.9in' }}>Sub:</span>
                    <span style={{ fontWeight: '700', textAlign: 'right', flex: 1 }}>{item.sub_category}</span>
                  </div>
                )}
                {item.product_type && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10pt', lineHeight: '1.3' }}>
                    <span style={{ fontWeight: '600', minWidth: '0.9in' }}>Product:</span>
                    <span style={{ fontWeight: '700', textAlign: 'right', flex: 1 }}>{item.product_type}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10pt', lineHeight: '1.3' }}>
                  <span style={{ fontWeight: '600', minWidth: '0.9in' }}>Purity:</span>
                  <span style={{ fontWeight: '700', textAlign: 'right', flex: 1 }}>{item.purity}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10pt', lineHeight: '1.3' }}>
                  <span style={{ fontWeight: '600', minWidth: '0.9in' }}>Grade:</span>
                  <span style={{ fontWeight: '700', textAlign: 'right', flex: 1 }}>{item.quality_grade}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10pt', lineHeight: '1.3' }}>
                  <span style={{ fontWeight: '600', minWidth: '0.9in' }}>Weight:</span>
                  <span style={{ fontWeight: '700', textAlign: 'right', flex: 1, fontSize: '13pt' }}>
                    {item.quantity_lbs?.toFixed(0) || item.quantity_kg?.toFixed(0)} {item.quantity_lbs ? 'lbs' : 'kg'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10pt', lineHeight: '1.3' }}>
                  <span style={{ fontWeight: '600', minWidth: '0.9in' }}>Location:</span>
                  <span style={{ fontWeight: '700', textAlign: 'right', flex: 1 }}>{item.bin_location || 'Unassigned'}</span>
                </div>
                {item.zone && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10pt', lineHeight: '1.3' }}>
                    <span style={{ fontWeight: '600', minWidth: '0.9in' }}>Zone:</span>
                    <span style={{ fontWeight: '700', textAlign: 'right', flex: 1 }}>{item.zone}</span>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div style={{ width: '100%', textAlign: 'center', borderTop: '2px solid black', paddingTop: '0.08in', marginTop: '0.08in' }}>
                <div style={{ fontSize: '11pt', fontWeight: '600', marginBottom: '0.03in' }}>{item.vendor_name || 'Supplier'}</div>
                {item.lot_number && (
                  <div style={{ fontSize: '9pt' }}>Lot: {item.lot_number}</div>
                )}
                <div style={{ fontSize: '8pt', color: '#666', marginTop: '0.03in' }}>
                  Received: {new Date(item.received_date).toLocaleDateString()}
                </div>
              </div>
            </div>
          ))
        ) : (
          // Letter Size - 4 per page
          <div style={{ width: '8.5in', minHeight: '11in' }}>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: '4.25in 4.25in',
              gridTemplateRows: 'repeat(2, 5.5in)',
              gap: '0',
              width: '100%'
            }}>
              {inventoryItems.map((item, idx) => (
                <div key={idx} style={{
                  width: '4.25in',
                  height: '5.5in',
                  padding: '0.25in',
                  boxSizing: 'border-box',
                  border: '1px dashed #999',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div style={{ textAlign: 'center', width: '100%', borderBottom: '2px solid black', paddingBottom: '0.1in', marginBottom: '0.15in' }}>
                    <div style={{ fontSize: '18pt', fontWeight: 'bold' }}>{item.inventory_id}</div>
                    <div style={{ fontSize: '9pt', fontWeight: '600' }}>INVENTORY</div>
                  </div>

                  <div style={{ textAlign: 'center' }}>
                    <img 
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(item.inventory_id)}`}
                      alt={item.inventory_id}
                      style={{ width: '2in', height: '2in' }}
                    />
                  </div>

                  <div style={{ width: '100%', fontSize: '9pt', lineHeight: '1.4' }}>
                    <div><strong>Category:</strong> {item.category}</div>
                    {item.product_type && <div><strong>Product:</strong> {item.product_type}</div>}
                    <div><strong>Purity:</strong> {item.purity} | <strong>Grade:</strong> {item.quality_grade}</div>
                    <div><strong>Weight:</strong> {item.quantity_lbs?.toFixed(0) || item.quantity_kg?.toFixed(0)} {item.quantity_lbs ? 'lbs' : 'kg'}</div>
                    <div><strong>Location:</strong> {item.bin_location || 'Unassigned'}</div>
                  </div>

                  <div style={{ width: '100%', textAlign: 'center', borderTop: '1px solid black', paddingTop: '0.1in', fontSize: '8pt' }}>
                    <div>{item.vendor_name || 'Supplier'}</div>
                    <div>{new Date(item.received_date).toLocaleDateString()}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Print Styles */}
      <style>{`
        @media screen {
          .print-view {
            display: none !important;
          }
        }

        @media print {
          .screen-only {
            display: none !important;
          }

          .print-view {
            display: block !important;
          }

          @page {
            ${printFormat === '4x6' 
              ? 'size: 4in 6in; margin: 0;' 
              : 'size: letter; margin: 0.25in;'
            }
          }

          body {
            margin: 0;
            padding: 0;
          }

          * {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
        }
      `}</style>
    </div>
  );
}