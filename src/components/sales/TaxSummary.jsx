import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, FileText, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

/**
 * Tax Summary Component
 * Displays detailed tax breakdown for Canada (GST/HST/PST/QST) and USA (TaxJar)
 */
export default function TaxSummary({ breakdown, country, province, state }) {
  if (!breakdown || !breakdown.totals) {
    return null;
  }

  const isCanada = country === 'CA';
  const t = breakdown.totals;

  return (
    <Card className="border-blue-200 bg-blue-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <DollarSign className="w-5 h-5 text-blue-600" />
          Tax Summary
          <Badge className="bg-blue-600 text-white text-xs">
            {isCanada ? 'CANADA' : 'USA'}
          </Badge>
        </CardTitle>
        <p className="text-sm text-gray-600 mt-1">
          {isCanada 
            ? `Place of supply: ${province || 'Not specified'}`
            : `Ship-to: ${state || 'Not specified'}`
          }
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Line Items Breakdown */}
        {breakdown.perLine && breakdown.perLine.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2 font-semibold">SKU</th>
                  <th className="py-2 font-semibold text-right">Basis</th>
                  <th className="py-2 font-semibold text-right">Tax</th>
                  <th className="py-2 font-semibold text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {breakdown.perLine.map((line, idx) => (
                  <tr key={idx} className="border-b last:border-none">
                    <td className="py-2 font-mono text-xs">{line.sku}</td>
                    <td className="py-2 text-right">${line.basis.toFixed(2)}</td>
                    <td className="py-2 text-right">
                      {line.taxes.length === 0 ? (
                        <span className="text-gray-400">—</span>
                      ) : (
                        <div className="space-y-1">
                          {line.taxes.map((tax, tidx) => (
                            <div key={tidx} className="text-xs text-gray-600">
                              {tax.name} {Math.round(tax.rate * 100)}%: ${tax.amount.toFixed(2)}
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="py-2 text-right font-semibold">
                      ${line.lineTotalWithTax.toFixed(2)}
                    </td>
                  </tr>
                ))}
                {breakdown.shipping && (
                  <tr className="border-t bg-gray-50">
                    <td className="py-2 font-semibold">Shipping</td>
                    <td className="py-2 text-right">${breakdown.shipping.basis.toFixed(2)}</td>
                    <td className="py-2 text-right">
                      {breakdown.shipping.taxes.length === 0 ? (
                        <span className="text-gray-400">—</span>
                      ) : (
                        <div className="space-y-1">
                          {breakdown.shipping.taxes.map((tax, tidx) => (
                            <div key={tidx} className="text-xs text-gray-600">
                              {tax.name} {Math.round(tax.rate * 100)}%: ${tax.amount.toFixed(2)}
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="py-2 text-right font-semibold">
                      ${breakdown.shipping.totalWithTax.toFixed(2)}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tax Totals by Type */}
        {isCanada && (
          <div className="grid grid-cols-2 gap-3 p-4 bg-white rounded-lg border">
            <div className="text-sm">
              <span className="text-gray-600">GST (5%):</span>
              <span className="font-semibold ml-2">${t.taxByType.GST.toFixed(2)}</span>
            </div>
            <div className="text-sm">
              <span className="text-gray-600">HST:</span>
              <span className="font-semibold ml-2">${t.taxByType.HST.toFixed(2)}</span>
            </div>
            <div className="text-sm">
              <span className="text-gray-600">PST:</span>
              <span className="font-semibold ml-2">${t.taxByType.PST.toFixed(2)}</span>
            </div>
            <div className="text-sm">
              <span className="text-gray-600">QST (9.975%):</span>
              <span className="font-semibold ml-2">${t.taxByType.QST.toFixed(2)}</span>
            </div>
          </div>
        )}

        {/* Order Totals */}
        <div className="space-y-2 p-4 bg-white rounded-lg border-2 border-blue-300">
          <div className="flex justify-between text-base">
            <span className="text-gray-700">Subtotal:</span>
            <span className="font-semibold">${t.subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-base text-blue-700">
            <span className="font-semibold">Total Tax:</span>
            <span className="font-bold">${t.totalTax.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-lg pt-2 border-t-2">
            <span className="font-bold text-gray-900">Grand Total:</span>
            <span className="font-bold text-green-600 text-xl">${t.grandTotal.toFixed(2)}</span>
          </div>
        </div>

        {/* Tax Notes */}
        {isCanada && (
          <Alert className="bg-blue-50 border-blue-200">
            <FileText className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-900 text-xs">
              <strong>Tax Calculation:</strong> Based on place of supply (ship-to province). 
              {province === 'ON' && ' HST 13% applies to most tangible goods in Ontario.'}
              {province === 'QC' && ' GST 5% + QST 9.975% applies in Quebec.'}
              {(province === 'BC' || province === 'SK' || province === 'MB') && ` GST 5% + PST applies in ${province}.`}
              {(province === 'AB' || province === 'NT' || province === 'NU' || province === 'YT') && ' GST 5% only (no PST).'}
            </AlertDescription>
          </Alert>
        )}

        {!isCanada && breakdown.hasNexus !== undefined && (
          <Alert className={breakdown.hasNexus ? "bg-green-50 border-green-200" : "bg-yellow-50 border-yellow-200"}>
            <AlertCircle className={`h-4 w-4 ${breakdown.hasNexus ? 'text-green-600' : 'text-yellow-600'}`} />
            <AlertDescription className={`text-xs ${breakdown.hasNexus ? 'text-green-900' : 'text-yellow-900'}`}>
              {breakdown.hasNexus ? (
                <>
                  <strong>Nexus Established:</strong> Tax obligation confirmed for {state}. 
                  Rate: {(breakdown.combinedRate * 100).toFixed(3)}%
                </>
              ) : (
                <>
                  <strong>No Nexus:</strong> No tax collection required for this jurisdiction.
                </>
              )}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}