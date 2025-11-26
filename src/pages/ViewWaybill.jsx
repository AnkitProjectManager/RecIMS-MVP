import React, { useRef } from "react";
import { recims } from "@/api/recimsClient";
import { useQuery } from "@tanstack/react-query";
import { useTenant } from "@/components/TenantContext";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  ArrowLeft,
  Printer,
  Download,
  Truck,
  Package,
  AlertCircle
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { format } from "date-fns";

export default function ViewWaybill() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const waybillId = searchParams.get('id');
  const printRef = useRef();
  const { tenantConfig, user } = useTenant();

  const { data: waybill, isLoading } = useQuery({
    queryKey: ['waybill', waybillId],
    queryFn: async () => {
      if (!waybillId) return null;
      const waybills = await recims.entities.Waybill.filter({ id: waybillId });
      return waybills[0] || null;
    },
    enabled: !!waybillId,
  });

  const { data: waybillItems = [] } = useQuery({
    queryKey: ['waybillItems', waybillId],
    queryFn: async () => {
      if (!waybillId) return [];
      return await recims.entities.WaybillItem.filter({ waybill_id: waybillId }, 'line_number');
    },
    enabled: !!waybillId,
    initialData: [],
  });

  const { data: settings = [] } = useQuery({
    queryKey: ['appSettings'],
    queryFn: () => recims.entities.AppSettings.list(),
    initialData: [],
  });

  const getSettingValue = (key) => {
    const setting = settings.find(s => s.setting_key === key);
    return setting?.setting_value || '';
  };

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading waybill...</p>
        </div>
      </div>
    );
  }

  if (!waybill) {
    return (
      <div className="p-4 md:p-8 max-w-4xl mx-auto">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Waybill not found</AlertDescription>
        </Alert>
        <Button onClick={() => navigate(createPageUrl("SalesOrderManagement"))} className="mt-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Sales Orders
        </Button>
      </div>
    );
  }

  const companyInfo = {
    name: tenantConfig?.company_name || tenantConfig?.display_name || 'Company Name',
    address: tenantConfig?.address_line1 || '',
    cityState: tenantConfig ? `${tenantConfig.city}, ${tenantConfig.state_province} ${tenantConfig.postal_code}, ${tenantConfig.country}` : '',
    phone: tenantConfig?.phone || '',
    email: tenantConfig?.email || '',
    website: tenantConfig?.website || '',
    logo: tenantConfig?.logo_url || ''
  };

  const isMetric = tenantConfig?.measurement_system === 'metric';

  return (
    <div>
      {/* Screen-only controls */}
      <div className="no-print p-4 md:p-8 max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate(createPageUrl(`ViewSalesOrder?id=${waybill.so_id}`))}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Truck className="w-7 h-7 text-blue-600" />
              Waybill / Bill of Lading
            </h1>
            <p className="text-sm text-gray-600">{waybill.waybill_number}</p>
          </div>
          <Badge className={waybill.status === 'delivered' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}>
            {waybill.status.toUpperCase()}
          </Badge>
          <Button onClick={handlePrint} className="bg-blue-600 hover:bg-blue-700 gap-2">
            <Printer className="w-4 h-4" />
            Print
          </Button>
        </div>

        <Alert className="mb-6 bg-blue-50 border-blue-200">
          <Package className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-900">
            <strong>Waybill & Bill of Lading (BOL):</strong> This document serves as both a shipping manifest and proof of shipment.
            It includes product details, HTS codes for customs, weight/volume totals, and authorization signature.
          </AlertDescription>
        </Alert>
      </div>

      {/* Printable Waybill */}
      <div ref={printRef} id="printable-area" className="bg-white p-8 max-w-[8.5in] mx-auto">
        {/* Header */}
        <div className="border-b-4 border-gray-900 pb-4 mb-6">
          <div className="flex items-start justify-between">
            <div>
              {companyInfo.logo && (
                <img src={companyInfo.logo} alt="Company Logo" className="h-16 mb-3" />
              )}
              <h1 className="text-3xl font-bold text-gray-900 mb-1">WAYBILL</h1>
              <p className="text-sm font-semibold text-blue-600">Bill of Lading</p>
              <p className="text-lg font-bold text-gray-900 mt-2">{waybill.waybill_number}</p>
            </div>
            <div className="text-right">
              <p className="font-bold text-gray-900 text-lg">{companyInfo.name}</p>
              <p className="text-sm text-gray-600 mt-1">{companyInfo.address}</p>
              <p className="text-sm text-gray-600">{companyInfo.cityState}</p>
              <p className="text-sm text-gray-600 mt-2">📞 {companyInfo.phone}</p>
              {companyInfo.email && <p className="text-sm text-gray-600">✉️ {companyInfo.email}</p>}
              {companyInfo.website && <p className="text-sm text-gray-600">🌐 {companyInfo.website}</p>}
            </div>
          </div>
        </div>

        {/* Shipment Information Grid */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          <div className="border border-gray-300 p-4 rounded">
            <h3 className="font-bold text-gray-900 mb-3 text-sm uppercase bg-gray-100 p-2 -m-4 mb-3 border-b border-gray-300">
              Consignee / Ship To
            </h3>
            <p className="font-semibold text-gray-900">{waybill.customer_name}</p>
            <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{waybill.customer_address}</p>
            <p className="text-sm font-semibold text-gray-900 mt-2">Country: {waybill.customer_country}</p>
          </div>

          <div className="border border-gray-300 p-4 rounded">
            <h3 className="font-bold text-gray-900 mb-3 text-sm uppercase bg-gray-100 p-2 -m-4 mb-3 border-b border-gray-300">
              Shipping Details
            </h3>
            <div className="text-sm space-y-1.5">
              <div className="flex justify-between">
                <span className="text-gray-600">Sales Order:</span>
                <span className="font-semibold">{waybill.so_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Dispatch Date:</span>
                <span className="font-semibold">{format(new Date(waybill.dispatch_date), 'MMM dd, yyyy')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Carrier:</span>
                <span className="font-semibold">{waybill.carrier_name}</span>
              </div>
              {waybill.vehicle_number && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Vehicle #:</span>
                  <span className="font-semibold">{waybill.vehicle_number}</span>
                </div>
              )}
              {waybill.driver_name && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Driver:</span>
                  <span className="font-semibold">{waybill.driver_name}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-600">Incoterms:</span>
                <span className="font-semibold">{waybill.incoterms}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Origin:</span>
                <span className="font-semibold">{waybill.origin_country}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Line Items Table */}
        <div className="mb-6">
          <h3 className="font-bold text-gray-900 mb-3 text-sm uppercase bg-gray-100 p-2 border-t border-b border-gray-300">
            Shipment Contents / Bill of Lading
          </h3>
          <table className="w-full text-xs border-collapse border border-gray-300">
            <thead className="bg-gray-50">
              <tr>
                <th className="border border-gray-300 p-2 text-left font-bold">Line</th>
                <th className="border border-gray-300 p-2 text-left font-bold">SKU #</th>
                <th className="border border-gray-300 p-2 text-left font-bold">Description</th>
                <th className="border border-gray-300 p-2 text-left font-bold">HTS Code</th>
                <th className="border border-gray-300 p-2 text-right font-bold">Quantity</th>
                <th className="border border-gray-300 p-2 text-center font-bold">UOM</th>
                <th className="border border-gray-300 p-2 text-right font-bold">
                  Weight ({isMetric ? 'kg' : 'lbs'})
                </th>
                <th className="border border-gray-300 p-2 text-right font-bold">
                  Volume ({isMetric ? 'm³' : 'ft³'})
                </th>
              </tr>
            </thead>
            <tbody>
              {waybillItems.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="border border-gray-300 p-2 text-center">{item.line_number}</td>
                  <td className="border border-gray-300 p-2 font-mono text-xs">{item.sku_number || 'N/A'}</td>
                  <td className="border border-gray-300 p-2">{item.item_description}</td>
                  <td className="border border-gray-300 p-2 font-mono text-xs">{item.hts_code || 'TBD'}</td>
                  <td className="border border-gray-300 p-2 text-right font-semibold">{item.quantity?.toFixed(2)}</td>
                  <td className="border border-gray-300 p-2 text-center font-semibold">{item.unit_of_measure}</td>
                  <td className="border border-gray-300 p-2 text-right">
                    {isMetric 
                      ? (item.weight_kg?.toFixed(2) || '0.00')
                      : (item.weight_lbs?.toFixed(2) || '0.00')
                    }
                  </td>
                  <td className="border border-gray-300 p-2 text-right">
                    {isMetric
                      ? (item.volume_cubic_meters?.toFixed(2) || '0.00')
                      : (item.volume_cubic_feet?.toFixed(2) || '0.00')
                    }
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-100 font-bold">
              <tr>
                <td colSpan="6" className="border border-gray-300 p-2 text-right">TOTALS:</td>
                <td className="border border-gray-300 p-2 text-right">
                  {isMetric
                    ? `${waybill.total_net_weight_kg?.toFixed(2) || '0.00'} kg`
                    : `${waybill.total_net_weight_lbs?.toFixed(2) || '0.00'} lbs`
                  }
                </td>
                <td className="border border-gray-300 p-2 text-right">
                  {isMetric
                    ? `${waybill.total_volume_cubic_meters?.toFixed(2) || '0.00'} m³`
                    : `${waybill.total_volume_cubic_feet?.toFixed(2) || '0.00'} ft³`
                  }
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Summary Box */}
        <div className="grid grid-cols-4 gap-4 mb-6 p-4 bg-gray-50 border-2 border-gray-300 rounded">
          <div>
            <p className="text-xs text-gray-600 font-semibold">Total Packages</p>
            <p className="text-2xl font-bold text-gray-900">{waybill.total_packages || 0}</p>
          </div>
          <div>
            <p className="text-xs text-gray-600 font-semibold">Gross Weight</p>
            <p className="text-lg font-bold text-gray-900">
              {isMetric
                ? `${waybill.total_gross_weight_kg?.toFixed(2) || '0.00'} kg`
                : `${waybill.total_gross_weight_lbs?.toFixed(2) || '0.00'} lbs`
              }
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-600 font-semibold">Net Weight</p>
            <p className="text-lg font-bold text-gray-900">
              {isMetric
                ? `${waybill.total_net_weight_kg?.toFixed(2) || '0.00'} kg`
                : `${waybill.total_net_weight_lbs?.toFixed(2) || '0.00'} lbs`
              }
            </p>
            <p className="text-xs text-gray-500">
              {isMetric
                ? `(${waybill.total_net_weight_lbs?.toFixed(2) || '0.00'} lbs)`
                : `(${waybill.total_net_weight_kg?.toFixed(2) || '0.00'} kg)`
              }
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-600 font-semibold">Total Volume</p>
            <p className="text-lg font-bold text-gray-900">
              {isMetric
                ? `${waybill.total_volume_cubic_meters?.toFixed(2) || '0.00'} m³`
                : `${waybill.total_volume_cubic_feet?.toFixed(2) || '0.00'} ft³`
              }
            </p>
            <p className="text-xs text-gray-500">
              {isMetric
                ? `(${waybill.total_volume_cubic_feet?.toFixed(2) || '0.00'} ft³)`
                : `(${waybill.total_volume_cubic_yards?.toFixed(2) || '0.00'} yd³)`
              }
            </p>
          </div>
        </div>

        {/* Special Instructions */}
        {waybill.special_instructions && (
          <div className="mb-6 p-4 bg-yellow-50 border-2 border-yellow-400 rounded">
            <p className="text-sm font-bold text-gray-900 mb-1 uppercase">⚠️ Special Instructions:</p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{waybill.special_instructions}</p>
          </div>
        )}

        {/* Regulatory & Export Information */}
        <div className="mb-6 p-4 border-2 border-blue-300 bg-blue-50 rounded">
          <h3 className="font-bold text-blue-900 mb-3 text-sm uppercase">Export & Customs Information</h3>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <p className="text-gray-600">Country of Origin:</p>
              <p className="font-semibold text-gray-900">{waybill.origin_country}</p>
            </div>
            <div>
              <p className="text-gray-600">Destination Country:</p>
              <p className="font-semibold text-gray-900">{waybill.customer_country}</p>
            </div>
            <div>
              <p className="text-gray-600">Incoterms:</p>
              <p className="font-semibold text-gray-900">{waybill.incoterms}</p>
            </div>
            <div>
              <p className="text-gray-600">Total Items:</p>
              <p className="font-semibold text-gray-900">{waybillItems.length} line items</p>
            </div>
          </div>
        </div>

        {/* Proforma Invoice Section */}
        <div className="mb-6">
          <h3 className="font-bold text-gray-900 mb-3 text-sm uppercase bg-gray-100 p-2 border-t border-b border-gray-300">
            Proforma Invoice (For Customs Declaration)
          </h3>
          <table className="w-full text-xs border-collapse border border-gray-300">
            <thead className="bg-gray-50">
              <tr>
                <th className="border border-gray-300 p-2 text-left font-bold">Item</th>
                <th className="border border-gray-300 p-2 text-left font-bold">Description</th>
                <th className="border border-gray-300 p-2 text-right font-bold">Qty</th>
                <th className="border border-gray-300 p-2 text-right font-bold">Unit Price</th>
                <th className="border border-gray-300 p-2 text-right font-bold">Amount</th>
              </tr>
            </thead>
            <tbody>
              {waybillItems.map((item) => (
                <tr key={item.id}>
                  <td className="border border-gray-300 p-2 font-mono text-xs">{item.sku_number}</td>
                  <td className="border border-gray-300 p-2">{item.item_description}</td>
                  <td className="border border-gray-300 p-2 text-right">{item.quantity} {item.unit_of_measure}</td>
                  <td className="border border-gray-300 p-2 text-right">
                    ${item.unit_price?.toFixed(2) || '0.00'}
                  </td>
                  <td className="border border-gray-300 p-2 text-right font-semibold">
                    ${item.line_total?.toFixed(2) || '0.00'}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-100 font-bold">
              <tr>
                <td colSpan="4" className="border border-gray-300 p-2 text-right">TOTAL VALUE:</td>
                <td className="border border-gray-300 p-2 text-right">
                  ${waybillItems.reduce((sum, item) => sum + (item.line_total || 0), 0).toFixed(2)}
                </td>
              </tr>
            </tfoot>
          </table>
          <p className="text-xs text-gray-500 mt-2 italic">
            * Values shown for customs declaration purposes only. Not an invoice. Refer to actual invoice for billing.
          </p>
        </div>

        {/* Carrier Receipt Section */}
        <div className="mb-6 border-2 border-gray-400 p-4 rounded">
          <h3 className="font-bold text-gray-900 mb-3 text-sm uppercase">Carrier Receipt & Acknowledgment</h3>
          <p className="text-xs text-gray-700 mb-4">
            Received the above goods in apparent good order and condition (unless otherwise noted). 
            Carrier agrees to transport to the consignee at the address shown above.
          </p>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-xs text-gray-600 mb-1">Driver Signature:</p>
              <div className="border-b-2 border-gray-400 h-16 mb-2"></div>
              <p className="text-xs text-gray-600">Driver Name: _______________________</p>
            </div>
            <div>
              <p className="text-xs text-gray-600 mb-1">Date & Time:</p>
              <div className="border-b-2 border-gray-400 h-16 mb-2"></div>
              <p className="text-xs text-gray-600">Date: _______________________</p>
            </div>
          </div>
        </div>

        {/* Authorization & Signature */}
        <div className="border-t-2 border-gray-900 pt-6 mb-6">
          <h3 className="font-bold text-gray-900 mb-4 text-sm uppercase">Shipper Authorization</h3>
          <p className="text-xs text-gray-700 mb-6 leading-relaxed">
            I hereby certify that the above-mentioned goods are correctly described, packaged, marked, and labeled, 
            and are in proper condition for transportation according to applicable regulations. All materials listed 
            are in compliance with international shipping standards and environmental regulations.
          </p>
          
          <div className="grid grid-cols-2 gap-8 mt-8">
            <div>
              <p className="text-sm font-bold text-gray-900">{waybill.authorized_by}</p>
              <p className="text-sm text-gray-600">{waybill.authorized_title}</p>
              <p className="text-sm text-gray-600 mt-2">
                Date: {waybill.signature_date ? format(new Date(waybill.signature_date), 'MMM dd, yyyy') : '_________________'}
              </p>
            </div>
            
            {waybill.signature_url ? (
              <div className="border-b-2 border-gray-900 pb-2 flex items-end">
                <img 
                  src={waybill.signature_url} 
                  alt="Authorized Signature" 
                  className="h-16 max-w-[200px] object-contain"
                />
              </div>
            ) : (
              <div className="border-b-2 border-gray-900 h-20"></div>
            )}
          </div>
        </div>

        {/* Delivery Confirmation Section */}
        <div className="border-2 border-gray-400 p-4 rounded bg-gray-50">
          <h3 className="font-bold text-gray-900 mb-3 text-sm uppercase">Delivery Confirmation (To be completed upon delivery)</h3>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-xs text-gray-600 mb-1">Received By (Print Name):</p>
              <div className="border-b-2 border-gray-400 h-8 mb-3"></div>
              <p className="text-xs text-gray-600 mb-1">Receiver Signature:</p>
              <div className="border-b-2 border-gray-400 h-16"></div>
            </div>
            <div>
              <p className="text-xs text-gray-600 mb-1">Delivery Date & Time:</p>
              <div className="border-b-2 border-gray-400 h-8 mb-3"></div>
              <p className="text-xs text-gray-600 mb-1">Condition Upon Receipt:</p>
              <div className="border-b-2 border-gray-400 h-16"></div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-4 border-t text-center text-xs text-gray-500">
          <p className="font-semibold">Generated by RecIMS Warehouse Management System</p>
          <p className="mt-1">Waybill #: {waybill.waybill_number} | SO #: {waybill.so_number} | Dispatch: {format(new Date(waybill.dispatch_date), 'MMM dd, yyyy')}</p>
          <p className="mt-1">For inquiries: {companyInfo.email || companyInfo.phone}</p>
          <p className="mt-2 text-gray-400">This document serves as both a Waybill and Bill of Lading for shipment tracking and customs clearance</p>
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body { margin: 0; padding: 0; }
          .no-print { display: none !important; }
          @page { 
            size: letter; 
            margin: 0.5in;
          }
        }
      `}</style>
    </div>
  );
}