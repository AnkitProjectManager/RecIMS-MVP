import { recims } from "@/api/recimsClient";
import { useQuery } from "@tanstack/react-query";
import { useTenant } from "@/components/TenantContext";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { format } from "date-fns";

export default function PrintPackingSlip() {
  const navigate = useNavigate();
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

  const { data: addresses = [] } = useQuery({
    queryKey: ['soAddresses', so?.ship_to_address_id],
    queryFn: async () => {
      if (!so?.ship_to_address_id) return [];
      return await recims.entities.Address.filter({ id: so.ship_to_address_id });
    },
    enabled: !!so?.ship_to_address_id,
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

  if (!so) {
    return (
      <div className="p-4 md:p-8 max-w-4xl mx-auto">
        <Alert variant="destructive">
          <AlertDescription>Sales order not found</AlertDescription>
        </Alert>
      </div>
    );
  }

  const shipToAddress = addresses[0];

  return (
    <div>
      {/* Screen UI */}
      <div className="screen-only p-4 md:p-8 max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate(createPageUrl(`ViewSalesOrder?id=${soId}`))}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">Packing Slip</h1>
            <p className="text-sm text-gray-600">SO: {so.so_number}</p>
          </div>
          <Button
            onClick={handlePrint}
            className="bg-green-600 hover:bg-green-700 gap-2"
          >
            <Printer className="w-4 h-4" />
            Print
          </Button>
        </div>

        <Alert className="mb-6">
          <AlertDescription>
            Print this packing slip for physical verification. Operator will confirm quantities and update inventory.
          </AlertDescription>
        </Alert>
      </div>

      {/* Print Content */}
      <div className="print-only">
        <div className="packing-slip">
          {/* Header */}
          <div className="slip-header">
            <div className="company-info">
              <h1 className="company-name">
                {tenantConfig?.company_name || tenantConfig?.display_name || 'Company Name'}
              </h1>
              <p className="document-title">PACKING SLIP</p>
            </div>
            <div className="order-info">
              <table className="info-table">
                <tbody>
                  <tr>
                    <td className="label">SO Number:</td>
                    <td className="value">{so.so_number}</td>
                  </tr>
                  <tr>
                    <td className="label">Date:</td>
                    <td className="value">{format(new Date(), 'MMM dd, yyyy')}</td>
                  </tr>
                  {so.po_number && (
                    <tr>
                      <td className="label">Customer PO:</td>
                      <td className="value">{so.po_number}</td>
                    </tr>
                  )}
                  {so.ship_date && (
                    <tr>
                      <td className="label">Ship Date:</td>
                      <td className="value">{format(new Date(so.ship_date), 'MMM dd, yyyy')}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Customer & Shipping */}
          <div className="address-section">
            <div className="address-block">
              <h3>Customer</h3>
              <p className="customer-name">{so.customer_name}</p>
            </div>
            {shipToAddress && (
              <div className="address-block">
                <h3>Ship To</h3>
                <p>{shipToAddress.line1}</p>
                {shipToAddress.line2 && <p>{shipToAddress.line2}</p>}
                <p>{shipToAddress.city}, {shipToAddress.region} {shipToAddress.postal_code}</p>
                <p>{shipToAddress.country_code}</p>
              </div>
            )}
          </div>

          {/* Line Items Table */}
          <table className="items-table">
            <thead>
              <tr>
                <th>Line</th>
                <th>SKU</th>
                <th>Description</th>
                <th>Category</th>
                <th className="qty-col">Qty Ordered</th>
                <th className="qty-col">UoM</th>
                <th className="qty-col">Qty Shipped</th>
                <th className="notes-col">Notes</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((item) => (
                <tr key={item.id}>
                  <td className="center">{item.line_number}</td>
                  <td>{item.sku_snapshot}</td>
                  <td className="description">{item.description_snapshot}</td>
                  <td>{item.category}</td>
                  <td className="qty-col">{item.quantity_ordered}</td>
                  <td className="center">{item.uom}</td>
                  <td className="qty-col verify-cell"></td>
                  <td className="notes-col"></td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Verification Section */}
          <div className="verification-section">
            <div className="verification-box">
              <h3>Physical Verification</h3>
              <div className="checkbox-line">
                <span className="checkbox">☐</span>
                <span>All items physically verified</span>
              </div>
              <div className="checkbox-line">
                <span className="checkbox">☐</span>
                <span>Quantities match order</span>
              </div>
              <div className="checkbox-line">
                <span className="checkbox">☐</span>
                <span>Quality inspection passed</span>
              </div>
            </div>

            <div className="signature-box">
              <div className="signature-line">
                <p className="label">Verified By:</p>
                <p className="line">_________________________________</p>
                <p className="sublabel">Operator Name</p>
              </div>
              <div className="signature-line">
                <p className="label">Date/Time:</p>
                <p className="line">_________________________________</p>
              </div>
            </div>
          </div>

          {/* Notes */}
          {so.comments_internal && (
            <div className="notes-section">
              <h3>Special Instructions</h3>
              <p className="notes-content">{so.comments_internal}</p>
            </div>
          )}

          {/* Footer */}
          <div className="slip-footer">
            <p>Operator: Update inventory after verification and mark items as allocated in the system.</p>
            <p className="page-number">Page 1 of 1</p>
          </div>
        </div>
      </div>

      {/* Print Styles */}
      <style>{`
        @media screen {
          .print-only {
            display: none !important;
          }
        }

        @media print {
          .screen-only {
            display: none !important;
          }

          .print-only {
            display: block !important;
          }

          @page {
            size: letter;
            margin: 0.5in;
          }

          body {
            margin: 0;
            padding: 0;
          }

          * {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }

          .packing-slip {
            width: 7.5in;
            font-family: Arial, sans-serif;
            font-size: 10pt;
            color: #000;
          }

          .slip-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 0.5in;
            padding-bottom: 0.2in;
            border-bottom: 3px solid #000;
          }

          .company-name {
            font-size: 20pt;
            font-weight: bold;
            margin: 0 0 0.1in 0;
            color: #000;
          }

          .document-title {
            font-size: 14pt;
            font-weight: bold;
            margin: 0;
            color: #000;
          }

          .info-table {
            border-collapse: collapse;
          }

          .info-table td {
            padding: 0.05in 0.1in;
            line-height: 1.4;
          }

          .info-table .label {
            font-weight: bold;
            text-align: right;
            padding-right: 0.15in;
            color: #000;
          }

          .info-table .value {
            color: #000;
          }

          .address-section {
            display: flex;
            gap: 1in;
            margin-bottom: 0.4in;
          }

          .address-block {
            flex: 1;
          }

          .address-block h3 {
            font-size: 11pt;
            font-weight: bold;
            margin: 0 0 0.1in 0;
            color: #000;
          }

          .address-block p {
            margin: 0.02in 0;
            line-height: 1.4;
            color: #000;
          }

          .customer-name {
            font-weight: bold;
            font-size: 12pt;
          }

          .items-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 0.4in;
          }

          .items-table th,
          .items-table td {
            border: 1px solid #000;
            padding: 0.08in;
            text-align: left;
            color: #000;
          }

          .items-table th {
            background-color: #e5e5e5;
            font-weight: bold;
            font-size: 9pt;
          }

          .items-table td {
            font-size: 9pt;
            line-height: 1.3;
          }

          .items-table .center {
            text-align: center;
          }

          .items-table .qty-col {
            text-align: center;
            width: 0.8in;
          }

          .items-table .notes-col {
            width: 1.2in;
          }

          .items-table .description {
            font-size: 8pt;
          }

          .items-table .verify-cell {
            background-color: #f9f9f9;
          }

          .verification-section {
            display: flex;
            gap: 0.5in;
            margin-bottom: 0.4in;
            padding: 0.2in;
            border: 2px solid #000;
            background-color: #f5f5f5;
          }

          .verification-box {
            flex: 1;
          }

          .verification-box h3 {
            font-size: 11pt;
            font-weight: bold;
            margin: 0 0 0.1in 0;
            color: #000;
          }

          .checkbox-line {
            margin: 0.08in 0;
            display: flex;
            align-items: center;
            gap: 0.1in;
          }

          .checkbox {
            font-size: 14pt;
            font-weight: bold;
          }

          .signature-box {
            flex: 1;
          }

          .signature-line {
            margin-bottom: 0.2in;
          }

          .signature-line .label {
            font-weight: bold;
            margin: 0 0 0.05in 0;
            color: #000;
          }

          .signature-line .line {
            border-bottom: 1px solid #000;
            margin: 0;
            padding-top: 0.3in;
          }

          .signature-line .sublabel {
            font-size: 8pt;
            color: #666;
            margin: 0.02in 0 0 0;
          }

          .notes-section {
            margin-bottom: 0.3in;
            padding: 0.15in;
            border: 1px solid #ccc;
            background-color: #fffef0;
          }

          .notes-section h3 {
            font-size: 10pt;
            font-weight: bold;
            margin: 0 0 0.1in 0;
            color: #000;
          }

          .notes-content {
            font-size: 9pt;
            line-height: 1.4;
            white-space: pre-wrap;
            margin: 0;
            color: #000;
          }

          .slip-footer {
            font-size: 8pt;
            color: #666;
            text-align: center;
            padding-top: 0.2in;
            border-top: 1px solid #ccc;
          }

          .slip-footer p {
            margin: 0.05in 0;
          }

          .page-number {
            font-weight: bold;
          }
        }
      `}</style>
    </div>
  );
}