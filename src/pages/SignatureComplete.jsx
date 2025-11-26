import { useNavigate, useSearchParams } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, FileSignature, ArrowRight } from "lucide-react";

export default function SignatureComplete() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const soId = searchParams.get('so_id');

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
      <Card className="max-w-2xl border-2 border-green-500 shadow-xl">
        <CardHeader className="bg-green-50 border-b border-green-200">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-100 rounded-full">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <div>
              <CardTitle className="text-2xl text-green-900">Thank You for Signing!</CardTitle>
              <p className="text-sm text-gray-600 mt-1">Your signature has been received successfully</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-8 space-y-6">
          <div className="flex items-start gap-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <FileSignature className="w-6 h-6 text-blue-600 mt-1" />
            <div className="flex-1">
              <h3 className="font-semibold text-blue-900 mb-2">What Happens Next?</h3>
              <ol className="space-y-2 text-sm text-gray-700">
                <li>✓ Your signed Order Confirmation has been saved securely</li>
                <li>✓ Our sales manager will review and approve your order</li>
                <li>✓ You will receive an order confirmation email once approved</li>
                <li>✓ Production and fulfillment will begin shortly</li>
              </ol>
            </div>
          </div>

          <div className="p-4 bg-gray-50 rounded-lg border text-sm text-gray-700">
            <p className="font-semibold mb-2">Need to make changes?</p>
            <p>Contact our sales team immediately if you need to modify this order:</p>
            <p className="mt-2">📧 Email: sales@recims.com</p>
            <p>📞 Phone: Available in your order confirmation</p>
          </div>

          {soId && (
            <div className="pt-4 border-t">
              <Button
                onClick={() => navigate(createPageUrl(`ViewSalesOrder?id=${soId}`))}
                className="w-full bg-green-600 hover:bg-green-700 gap-2"
                size="lg"
              >
                View Order Status
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          )}

          <p className="text-xs text-center text-gray-500 pt-4">
            A copy of the signed document has been sent to your email address.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}