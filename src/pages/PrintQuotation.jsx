import { recims } from "@/api/recimsClient";
import { useQuery } from "@tanstack/react-query";
import { useTenant } from "@/components/TenantContext";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer } from "lucide-react";
import { format } from "date-fns";

export default function PrintQuotation() {
  const { tenantConfig } = useTenant();
  const urlParams = new URLSearchParams(window.location.search);
  const soId = urlParams.get('id');

  const { data: so, isLoading } = useQuery({
    queryKey: ['salesOrder', soId],
    queryFn: async () => {
      const sos = await recims.entities.SalesOrder.filter({ id: soId });
      return sos[0];
    },
    enabled: !!soId,
  });

  const { data: lineItems = [] } = useQuery({
    queryKey: ['soLineItems', soId],
    queryFn: async () => {
      return await recims.entities.SalesOrderLine.filter({ so_id: soId }, 'line_number');
    },
    enabled: !!soId,
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading quotation...</p>
        </div>
      </div>
    );
  }

  if (!so) {
    return (
      <div className="p-8">
        <p className="text-red-600">Sales order not found</p>
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

  const subtotal = lineItems.reduce((sum, item) => sum + (item.line_subtotal || 0), 0);
  const taxTotal = so.tax_total || 0;
  const grandTotal = so.total_amount || (subtotal + taxTotal + (so.shipping_amount || 0));

  return (
    <div>
      {/* Screen-only navigation */}
      <div className="no-print p-4 flex items-center gap-3 border-b">
        <Link to={createPageUrl(`ViewSalesOrder?id=${soId}`)}>
          <Button variant="outline" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <h1 className="text-xl font-bold flex-1">Print Quotation</h1>
        <Button onClick={handlePrint} className="bg-green-600 hover:bg-green-700 gap-2">
          <Printer className="w-4 h-4" />
          Print
        </Button>
      </div>

      {/* Printable content */}
      <div className="p-8 max-w-[8.5in] mx-auto bg-white">
        {/* Header */}
        <div className="flex items-start justify-between mb-8 pb-6 border-b-2 border-gray-300">
          <div>
            {companyInfo.logo && (
              <img src={companyInfo.logo} alt="Company Logo" className="h-16 mb-3" />
            )}
            <h1 className="text-2xl font-bold text-gray-900">{companyInfo.name}</h1>
            <p className="text-sm text-gray-600 mt-1">{companyInfo.address}</p>
            <p className="text-sm text-gray-600">{companyInfo.cityState}</p>
            <p className="text-sm text-gray-600 mt-1">📞 {companyInfo.phone}</p>
            {companyInfo.email && <p className="text-sm text-gray-600">✉️ {companyInfo.email}</p>}
            {companyInfo.website && <p className="text-sm text-gray-600">🌐 {companyInfo.website}</p>}
          </div>
          <div className="text-right">
            <h2 className="text-3xl font-bold text-blue-600 mb-2">QUOTATION</h2>
            <div className="space-y-1 text-sm">
              <p><strong>Quote #:</strong> {so.so_number}</p>
              <p><strong>Date:</strong> {format(new Date(so.created_date), 'MMM dd, yyyy')}</p>
              <p><strong>Valid Until:</strong> {format(new Date(new Date(so.created_date).getTime() + 30*24*60*60*1000), 'MMM dd, yyyy')}</p>
            </div>
          </div>
        </div>

        {/* Customer Info */}
        <div className="grid grid-cols-2 gap-6 mb-8">
          <div>
            <h3 className="font-bold text-gray-900 mb-2 text-sm uppercase tracking-wide">Bill To:</h3>
            <p className="font-semibold">{so.customer_name}</p>
            {so.bill_contact_person && <p className="text-sm">{so.bill_contact_person}</p>}
            {so.bill_line1 && <p className="text-sm">{so.bill_line1}</p>}
            {so.bill_line2 && <p className="text-sm">{so.bill_line2}</p>}
            {so.bill_city && <p className="text-sm">{so.bill_city}, {so.bill_region} {so.bill_postal_code}</p>}
            {so.bill_country && <p className="text-sm">{so.bill_country}</p>}
            {so.bill_phone && <p className="text-sm mt-2">📞 {so.bill_phone}</p>}
            {so.bill_email && <p className="text-sm">✉️ {so.bill_email}</p>}
          </div>
          <div>
            <h3 className="font-bold text-gray-900 mb-2 text-sm uppercase tracking-wide">Ship To:</h3>
            {so.ship_contact_person && <p className="font-semibold">{so.ship_contact_person}</p>}
            {so.ship_line1 && <p className="text-sm">{so.ship_line1}</p>}
            {so.ship_line2 && <p className="text-sm">{so.ship_line2}</p>}
            {so.ship_city && <p className="text-sm">{so.ship_city}, {so.ship_region} {so.ship_postal_code}</p>}
            {so.ship_country && <p className="text-sm">{so.ship_country}</p>}
            {so.ship_phone && <p className="text-sm mt-2">📞 {so.ship_phone}</p>}
            {so.ship_email && <p className="text-sm">✉️ {so.ship_email}</p>}
          </div>
        </div>

        {/* Line Items */}
        <table className="w-full mb-6">
          <thead>
            <tr className="border-b-2 border-gray-300">
              <th className="text-left py-2 px-2 text-sm font-bold">Item</th>
              <th className="text-left py-2 px-2 text-sm font-bold">Description</th>
              <th className="text-right py-2 px-2 text-sm font-bold">Qty</th>
              <th className="text-right py-2 px-2 text-sm font-bold">Unit Price</th>
              <th className="text-right py-2 px-2 text-sm font-bold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {lineItems.map((item, idx) => (
              <tr key={item.id} className="border-b border-gray-200">
                <td className="py-3 px-2">
                  <p className="font-semibold text-sm">{item.sku_snapshot}</p>
                  {item.hts_code && <p className="text-xs text-gray-500">HTS: {item.hts_code}</p>}
                </td>
                <td className="py-3 px-2 text-sm">{item.description_snapshot}</td>
                <td className="py-3 px-2 text-right text-sm">
                  {item.quantity_ordered} <span className="text-gray-600">{item.uom}</span>
                </td>
                <td className="py-3 px-2 text-right text-sm">
                  ${item.unit_price?.toFixed(2)}
                  <span className="text-gray-600 text-xs">/{item.uom}</span>
                </td>
                <td className="py-3 px-2 text-right font-semibold text-sm">
                  ${item.line_subtotal?.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end mb-8">
          <div className="w-80 space-y-2 text-sm">
            <div className="flex justify-between pb-2">
              <span className="text-gray-600">Subtotal:</span>
              <span className="font-semibold">${subtotal.toFixed(2)}</span>
            </div>
            {so.shipping_amount > 0 && (
              <div className="flex justify-between pb-2">
                <span className="text-gray-600">Shipping:</span>
                <span className="font-semibold">${so.shipping_amount.toFixed(2)}</span>
              </div>
            )}
            {taxTotal > 0 && (
              <>
                <div className="flex justify-between pb-2 border-t pt-2">
                  <span className="text-gray-600">Tax:</span>
                  <span className="font-semibold">${taxTotal.toFixed(2)}</span>
                </div>
                {so.tax_gst > 0 && (
                  <div className="flex justify-between text-xs pl-4">
                    <span className="text-gray-500">GST (5%):</span>
                    <span>${so.tax_gst.toFixed(2)}</span>
                  </div>
                )}
                {so.tax_hst > 0 && (
                  <div className="flex justify-between text-xs pl-4">
                    <span className="text-gray-500">HST:</span>
                    <span>${so.tax_hst.toFixed(2)}</span>
                  </div>
                )}
                {so.tax_pst > 0 && (
                  <div className="flex justify-between text-xs pl-4">
                    <span className="text-gray-500">PST:</span>
                    <span>${so.tax_pst.toFixed(2)}</span>
                  </div>
                )}
                {so.tax_qst > 0 && (
                  <div className="flex justify-between text-xs pl-4">
                    <span className="text-gray-500">QST (9.975%):</span>
                    <span>${so.tax_qst.toFixed(2)}</span>
                  </div>
                )}
              </>
            )}
            <div className="flex justify-between pt-2 border-t-2 border-gray-300 text-base">
              <span className="font-bold">TOTAL ({so.currency}):</span>
              <span className="font-bold text-green-600 text-lg">${grandTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Terms & Notes */}
        <div className="space-y-4 text-sm border-t pt-6">
          <div>
            <p className="font-bold mb-1">Payment Terms:</p>
            <p className="text-gray-700">{so.terms}</p>
          </div>
          <div>
            <p className="font-bold mb-1">Quote Validity:</p>
            <p className="text-gray-700">This quotation is valid for 30 days from the date of issue.</p>
          </div>
          <div>
            <p className="font-bold mb-1">Notes:</p>
            <p className="text-gray-700">
              {so.comments_internal || 'Thank you for your business. Please contact us if you have any questions.'}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-6 border-t text-center text-xs text-gray-500">
          <p>This is a quotation only and does not constitute a binding agreement.</p>
          <p className="mt-1">To proceed with this order, please send your purchase order to {companyInfo.email || companyInfo.phone}.</p>
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body { margin: 0; padding: 0; }
          .no-print { display: none !important; }
          @page { margin: 0.5in; size: letter; }
        }
        @media screen {
          .print-only { display: none; }
        }
      `}</style>
    </div>
  );
}