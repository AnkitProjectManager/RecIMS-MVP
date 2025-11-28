import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { recims } from "@/api/recimsClient";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ArrowLeft,
  Loader2,
  Users,
  Building2,
  Mail,
  Phone,
  Globe,
  DollarSign,
  FileText,
  CalendarClock,
  Pencil,
} from "lucide-react";

const addressLines = (customer, prefix) => {
  if (!customer) return [];
  const line1 = customer[`${prefix}_line1`];
  const line2 = customer[`${prefix}_line2`];
  const line3 = customer[`${prefix}_line3`];
  const city = customer[`${prefix}_city`];
  const region = customer[`${prefix}_region`];
  const postal = customer[`${prefix}_postal_code`];
  const country = customer[`${prefix}_country_code`];

  const lines = [line1, line2, line3].filter(Boolean);
  const cityLine = [city, region].filter(Boolean).join(", ");
  const postalLine = [postal, country].filter(Boolean).join(" ");

  if (cityLine) {
    lines.push(cityLine);
  }
  if (postalLine) {
    lines.push(postalLine.trim());
  }
  return lines;
};

export default function ViewCustomer() {
  const navigate = useNavigate();
  const customerId = new URLSearchParams(window.location.search).get("id");

  const {
    data: customer,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["customer", customerId],
    enabled: !!customerId,
    queryFn: async () => {
      if (!customerId) return null;
      const response = await recims.entities.Customer.filter({ id: customerId });
      return response[0] ?? null;
    },
  });

  if (!customerId) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <Alert variant="destructive">
          <AlertDescription>Customer ID is missing from the URL.</AlertDescription>
        </Alert>
        <Button className="mt-4" onClick={() => navigate(createPageUrl("CustomerManagement"))}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Customers
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
      </div>
    );
  }

  if (isError || !customer) {
    return (
      <div className="p-8 max-w-4xl mx-auto space-y-4">
        <Alert variant="destructive">
          <AlertDescription>
            {error?.message || "Customer not found. Please return to the list and try again."}
          </AlertDescription>
        </Alert>
        <Button onClick={() => navigate(createPageUrl("CustomerManagement"))}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Customers
        </Button>
      </div>
    );
  }

  const billingAddress = addressLines(customer, "bill");
  const shippingAddress = addressLines(customer, "ship");

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <Button variant="outline" size="icon" onClick={() => navigate(createPageUrl("CustomerManagement"))}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <p className="text-sm text-gray-500">Customer #{customer.id}</p>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Users className="w-6 h-6 text-blue-600" />
              {customer.display_name}
            </h1>
            {customer.company_name && (
              <p className="text-gray-600 flex items-center gap-2 text-sm mt-1">
                <Building2 className="w-4 h-4" />
                {customer.company_name}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge className="bg-slate-100 text-slate-700">Status: {customer.status || "active"}</Badge>
          <Badge variant="outline" className="font-semibold">
            {customer.country || "US"} / {customer.currency || "USD"}
          </Badge>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        {customer.is_tax_exempt && (
          <Badge variant="outline" className="bg-yellow-50 text-yellow-700">Tax Exempt</Badge>
        )}
        {customer.qbo_id && (
          <Badge variant="outline" className="bg-purple-50 text-purple-700">QBO ID: {customer.qbo_id}</Badge>
        )}
        {customer.external_id && (
          <Badge variant="outline" className="bg-blue-50 text-blue-700">External ID: {customer.external_id}</Badge>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          onClick={() => navigate(createPageUrl(`EditCustomer?id=${customer.id}`))}
          className="gap-2"
        >
          <Pencil className="w-4 h-4" />
          Edit Customer
        </Button>
        <Button
          variant="outline"
          onClick={() => navigate(createPageUrl("NewCustomer"))}
          className="gap-2"
        >
          <Users className="w-4 h-4" />
          New Customer
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-gray-700">
            {customer.primary_email && (
              <p className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-blue-500" />
                {customer.primary_email}
              </p>
            )}
            {customer.primary_phone && (
              <p className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-green-500" />
                {customer.primary_phone}
              </p>
            )}
            {customer.mobile_phone && (
              <p className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-emerald-500" />
                {customer.mobile_phone}
              </p>
            )}
            {customer.website && (
              <p className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-indigo-500" />
                <a href={customer.website} target="_blank" rel="noreferrer" className="underline">
                  {customer.website}
                </a>
              </p>
            )}
            {customer.primary_tax_identifier && (
              <p className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-500" />
                Tax ID: {customer.primary_tax_identifier}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Financial Summary</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Open Balance</p>
              <p className="text-lg font-semibold text-orange-600 flex items-center gap-1">
                <DollarSign className="w-4 h-4" />
                {(customer.open_balance ?? 0).toLocaleString(undefined, {
                  style: "currency",
                  currency: customer.currency || "USD",
                })}
              </p>
            </div>
            <div>
              <p className="text-gray-500">Total Purchases</p>
              <p className="text-lg font-semibold text-emerald-600">
                {(customer.total_purchases ?? 0).toLocaleString(undefined, {
                  style: "currency",
                  currency: customer.currency || "USD",
                })}
              </p>
            </div>
            <div>
              <p className="text-gray-500">Credit Limit</p>
              <p className="text-base font-semibold">
                {(customer.credit_limit ?? 0).toLocaleString(undefined, {
                  style: "currency",
                  currency: customer.currency || "USD",
                })}
              </p>
            </div>
            <div>
              <p className="text-gray-500">Payment Terms</p>
              <p className="text-base font-semibold text-gray-900">
                {customer.sales_term_ref || customer.payment_method_ref || customer.terms || "Net 30"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Billing Address</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-gray-700 space-y-1">
            {billingAddress.length === 0 ? (
              <p className="text-gray-500">No billing address on file.</p>
            ) : (
              billingAddress.map((line) => <p key={line}>{line}</p>)
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Shipping Address</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-gray-700 space-y-1">
            {shippingAddress.length === 0 ? (
              <p className="text-gray-500">No shipping address on file.</p>
            ) : (
              shippingAddress.map((line) => <p key={line}>{line}</p>)
            )}
          </CardContent>
        </Card>
      </div>

      {customer.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{customer.notes}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Metadata</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-700">
          <p className="flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-slate-500" />
            Created: {customer.created_date ? new Date(customer.created_date).toLocaleString() : "n/a"}
          </p>
          <p className="flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-slate-500" />
            Updated: {customer.updated_date ? new Date(customer.updated_date).toLocaleString() : "n/a"}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
