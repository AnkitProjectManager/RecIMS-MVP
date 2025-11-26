import React, { useState } from "react";
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
  DollarSign,
  AlertCircle
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { format } from "date-fns";

export default function CreateProformaInvoice() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const waybillId = searchParams.get('waybill_id');
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
      return await recims.entities.WaybillItem.filter({ waybill_id: waybillId });
    },
    enabled: !!waybillId,
    initialData: [],
  });

  const { data: customer } = useQuery({
    queryKey: ['customer', waybill?.customer_id],
    queryFn: async () => {
      if (!waybill?.customer_id) return null;
      const customers = await recims.entities.Customer.filter({ id: waybill.customer_id });
      return customers[0] || null;
    },
    enabled: !!waybill?.customer_id,
  });

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
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
      </div>
    );
  }

  const tenantName = tenantConfig?.company_name || tenantConfig?.display_name || 'Company Name';
  
  const tenantAddress = tenantConfig
    ? `${tenantConfig.address_line1}${tenantConfig.address_line2 ? ', ' + tenantConfig.address_line2 : ''}, ${tenantConfig.city}, ${tenantConfig.state_province} ${tenantConfig.postal_code}, ${tenantConfig.country}`
    : '';
  
  const tenantPhone = tenantConfig?.phone || '';
  const tenantEmail = tenantConfig?.email || '';

  const subtotal = waybillItems.reduce((sum, item) => sum + (item.line_total || 0), 0);
  const currency = tenantConfig?.default_currency || 'USD';

  return (
    <div>
      {/* Screen-only controls */}
      <div className="print:hidden p-4 md:p-8 max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate(createPageUrl(`ViewWaybill?id=${waybillId}`))}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">Proforma Invoice</h1>
            <p className="text-sm text-gray-600">For Waybill: {waybill.waybill_number}</p>
          </div>
          <Button onClick={handlePrint} className="bg-blue-600 hover:bg-blue-700 gap-2">
            <Printer className="w-4 h-4" />
            Print Invoice
          </Button>
        </div>
      </div>

      {/* Printable Proforma Invoice */}
      <div className="bg-white p-8 max-w-[8.5in] mx-auto print:p-0">
        {/* Header */}
        <div className="border-b-4 border-blue-600 pb-4 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-4xl font-bold text-blue-600 mb-2">PROFORMA INVOICE</h1>
              <p className="text-sm text-gray-600">RecIMS Reference: {waybill.waybill_number}</p>
              <p className="text-sm text-gray-600">Date: {format(new Date(), 'MMMM dd, yyyy')}</p>
            </div>
            <div className="text-right">
              <p className="font-bold text-gray-900 text-lg">{tenantName}</p>
              <p className="text-sm text-gray-600">{tenantAddress}</p>
              <p className="text-sm text-gray-600">Phone: {tenantPhone}</p>
              <p className="text-sm text-gray-600">Email: {tenantEmail}</p>
            </div>
          </div>
        </div>

        {/* Seller & Customer Info */}
        <div className="grid grid-cols-2 gap-8 mb-6">
          <div className="p-4 bg-gray-50 rounded">
            <h3 className="font-bold text-gray-900 mb-2">SELLER</h3>
            <p className="font-semibold text-gray-900">{tenantName}</p>
            <p className="text-sm text-gray-600 mt-1">{tenantAddress}</p>
            <p className="text-sm text-gray-600 mt-2"><strong>Authorized Officer:</strong></p>
            <p className="text-sm text-gray-700">{waybill.authorized_by}, {waybill.authorized_title}</p>
          </div>

          <div className="p-4 bg-blue-50 rounded">
            <h3 className="font-bold text-gray-900 mb-2">CUSTOMER / CONSIGNEE</h3>
            <p className="font-semibold text-gray-900">{waybill.customer_name}</p>
            <p className="text-sm text-gray-600 mt-1">{waybill.customer_address}</p>
            {customer?.primary_phone && (
              <p className="text-sm text-gray-600 mt-1">Phone: {customer.primary_phone}</p>
            )}
          </div>
        </div>

        {/* Shipment Details */}
        <div className="mb-6 p-4 border rounded">
          <h3 className="font-bold text-gray-900 mb-3">SHIPMENT DETAILS</h3>
          <div className="grid grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-gray-600">Waybill Number:</p>
              <p className="font-semibold">{waybill.waybill_number}</p>
            </div>
            <div>
              <p className="text-gray-600">Dispatch Date:</p>
              <p className="font-semibold">{format(new Date(waybill.dispatch_date), 'MMM dd, yyyy')}</p>
            </div>
            <div>
              <p className="text-gray-600">Delivery Mode:</p>
              <p className="font-semibold">{waybill.carrier_name || 'TBD'}</p>
            </div>
            <div>
              <p className="text-gray-600">Incoterms:</p>
              <p className="font-semibold">{waybill.incoterms}</p>
            </div>
            <div>
              <p className="text-gray-600">Country of Origin:</p>
              <p className="font-semibold">{waybill.origin_country}</p>
            </div>
            <div>
              <p className="text-gray-600">Destination Country:</p>
              <p className="font-semibold">{waybill.customer_country}</p>
            </div>
          </div>
        </div>

        {/* Invoice Line Items */}
        <div className="mb-6">
          <h3 className="font-bold text-gray-900 mb-3">INVOICE LINE ITEMS</h3>
          <table className="w-full text-xs border-collapse">
            <thead className="bg-blue-100">
              <tr>
                <th className="border border-gray-300 p-2 text-left">SKU#</th>
                <th className="border border-gray-300 p-2 text-left">Description</th>
                <th className="border border-gray-300 p-2 text-left">HTS Code</th>
                <th className="border border-gray-300 p-2 text-right">Qty/Wt/Vol</th>
                <th className="border border-gray-300 p-2 text-center">UOM</th>
                <th className="border border-gray-300 p-2 text-right">Unit Price</th>
                <th className="border border-gray-300 p-2 text-right">Line Total</th>
              </tr>
            </thead>
            <tbody>
              {waybillItems.map((item) => (
                <tr key={item.id}>
                  <td className="border border-gray-300 p-2 font-mono">{item.sku_number || 'N/A'}</td>
                  <td className="border border-gray-300 p-2">{item.item_description}</td>
                  <td className="border border-gray-300 p-2 font-mono">{item.hts_code || 'TBD'}</td>
                  <td className="border border-gray-300 p-2 text-right font-semibold">{item.quantity}</td>
                  <td className="border border-gray-300 p-2 text-center">{item.unit_of_measure}</td>
                  <td className="border border-gray-300 p-2 text-right">
                    ${(item.unit_price || 0).toFixed(2)}
                  </td>
                  <td className="border border-gray-300 p-2 text-right font-semibold">
                    ${(item.line_total || 0).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="flex justify-end mb-6">
          <div className="w-64 space-y-2 text-sm">
            <div className="flex justify-between pb-2">
              <span className="text-gray-600">Subtotal:</span>
              <span className="font-semibold">${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between pb-2 border-b">
              <span className="text-gray-600">Freight/Insurance:</span>
              <span className="font-semibold">$___</span>
            </div>
            <div className="flex justify-between pt-2 text-lg">
              <span className="font-bold">Total Invoice Value:</span>
              <span className="font-bold text-blue-600">{currency} ${subtotal.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Declarations */}
        <div className="border-t-2 border-gray-300 pt-6 mb-6">
          <h3 className="font-bold text-gray-900 mb-4">DECLARATIONS</h3>
          <p className="text-sm text-gray-700 mb-4">
            I, the undersigned, hereby certify that the above-mentioned goods are true and correct as per our records in RecIMS,
            and are being shipped in accordance with applicable export regulations and documentation requirements.
          </p>
          
          <div className="mt-8">
            <p className="text-sm font-semibold mb-1">Authorized Signature:</p>
            {waybill.signature_url ? (
              <div className="border-b-2 border-gray-900 pb-2 inline-block">
                <img 
                  src={waybill.signature_url} 
                  alt="Signature" 
                  className="h-16 max-w-[200px] object-contain"
                />
              </div>
            ) : (
              <div className="border-b-2 border-gray-900 pb-2 w-64 h-16"></div>
            )}
            <div className="mt-3 text-sm">
              <p><strong>Name:</strong> {waybill.authorized_by}</p>
              <p><strong>Designation:</strong> {waybill.authorized_title}</p>
              <p><strong>Date:</strong> {waybill.signature_date ? format(new Date(waybill.signature_date), 'MMMM dd, yyyy') : format(new Date(), 'MMMM dd, yyyy')}</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t pt-4 text-center text-xs text-gray-500">
          <p className="font-semibold mb-1">Footer (System Notes)</p>
          <p>Generated automatically by RecIMS Outbound Module.</p>
          <p className="mt-1">
            Reference: Outbound Order #{waybill.so_number} — Waybill #{waybill.waybill_number}
          </p>
          <p className="mt-1">For verification or audit, refer to RecIMS Transaction Log.</p>
        </div>
      </div>

      {/* Screen Controls */}
      <div className="print:hidden p-4 max-w-[8.5in] mx-auto">
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => navigate(createPageUrl(`ViewWaybill?id=${waybillId}`))}
            className="flex-1"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Waybill
          </Button>
          <Button
            onClick={handlePrint}
            className="flex-1 bg-blue-600 hover:bg-blue-700 gap-2"
          >
            <Printer className="w-4 h-4" />
            Print Proforma Invoice
          </Button>
        </div>
      </div>

      <style>{`
        @media print {
          .print\\:hidden {
            display: none !important;
          }
          @page {
            size: letter;
            margin: 0.5in;
          }
        }
      `}</style>
    </div>
  );
}