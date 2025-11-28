import React from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { recims } from "@/api/recimsClient";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ArrowLeft,
  Loader2,
  Users,
  Building2,
  Mail,
  Phone,
  MapPin,
  Globe,
  DollarSign,
  FileText,
  ShieldCheck,
  Pencil,
  CalendarClock,
} from "lucide-react";

const addressLines = (vendor, prefix = "") => {
  if (!vendor) return [];
  const normalized = prefix ? `${prefix}_` : "";
  const line1 = vendor[`${normalized}line1`];
  const line2 = vendor[`${normalized}line2`];
  const line3 = vendor[`${normalized}line3`];
  const city = vendor[`${normalized}city`];
  const region = vendor[`${normalized}region`];
  const postal = vendor[`${normalized}postal_code`];
  const country = vendor[`${normalized}country_code`] || vendor.country;

  const lines = [line1, line2, line3].filter(Boolean);
  const cityLine = [city, region].filter(Boolean).join(", ");
  const postalLine = [postal, country].filter(Boolean).join(" ");
  if (cityLine) lines.push(cityLine);
  if (postalLine.trim()) lines.push(postalLine.trim());
  return lines;
};

export default function ViewVendor() {
  const navigate = useNavigate();
  const vendorId = new URLSearchParams(window.location.search).get("id");

  const { data: vendor, isLoading, isError, error } = useQuery({
    queryKey: ["vendor", vendorId],
    enabled: !!vendorId,
    queryFn: async () => {
      if (!vendorId) return null;
      const results = await recims.entities.Vendor.filter({ id: vendorId });
      return results[0] ?? null;
    },
  });

  if (!vendorId) {
    return (
      <div className="p-8 max-w-4xl mx-auto space-y-4">
        <Alert variant="destructive">
          <AlertDescription>Vendor ID is missing from the URL.</AlertDescription>
        </Alert>
        <Button onClick={() => navigate(createPageUrl("VendorManagement"))}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Vendors
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-10 h-10 animate-spin text-orange-600" />
      </div>
    );
  }

  if (isError || !vendor) {
    return (
      <div className="p-8 max-w-4xl mx-auto space-y-4">
        <Alert variant="destructive">
          <AlertDescription>
            {error?.message || "Vendor not found. Please return to the list and try again."}
          </AlertDescription>
        </Alert>
        <Button onClick={() => navigate(createPageUrl("VendorManagement"))}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Vendors
        </Button>
      </div>
    );
  }

  const billingAddress = addressLines(vendor, "bill");
  const shippingAddress = addressLines(vendor, "ship");

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <Button variant="outline" size="icon" onClick={() => navigate(createPageUrl("VendorManagement"))}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <p className="text-sm text-gray-500">Vendor #{vendor.id}</p>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Users className="w-6 h-6 text-orange-600" />
              {vendor.display_name}
            </h1>
            {vendor.company_name && (
              <p className="text-gray-600 flex items-center gap-2 text-sm mt-1">
                <Building2 className="w-4 h-4" />
                {vendor.company_name}
              </p>
            )}
            {vendor.contact_person && (
              <p className="text-sm text-gray-500">Primary Contact: {vendor.contact_person}</p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge className="bg-slate-100 text-slate-700">Status: {vendor.status || "active"}</Badge>
          <Badge variant="outline" className="font-semibold">
            {vendor.country || "US"} / {vendor.currency || "USD"}
          </Badge>
          {vendor.category && <Badge variant="outline">Category: {vendor.category}</Badge>}
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        {vendor.vendor_1099 && (
          <Badge variant="outline" className="bg-yellow-50 text-yellow-700 flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" /> 1099 Vendor
          </Badge>
        )}
        {vendor.w9_on_file && (
          <Badge variant="outline" className="bg-blue-50 text-blue-700">W-9 on file</Badge>
        )}
        {vendor.qbo_id && (
          <Badge variant="outline" className="bg-purple-50 text-purple-700">QBO ID: {vendor.qbo_id}</Badge>
        )}
        {vendor.acct_num && (
          <Badge variant="outline" className="bg-gray-50 text-gray-700">Acct #: {vendor.acct_num}</Badge>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          onClick={() => navigate(createPageUrl(`EditVendor?id=${vendor.id}`))}
          className="gap-2"
        >
          <Pencil className="w-4 h-4" />
          Edit Vendor
        </Button>
        <Button
          variant="outline"
          onClick={() => navigate(createPageUrl("NewVendor"))}
          className="gap-2"
        >
          <Users className="w-4 h-4" />
          New Vendor
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-gray-700">
            {vendor.primary_email && (
              <p className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-blue-500" />
                {vendor.primary_email}
              </p>
            )}
            {vendor.primary_phone && (
              <p className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-green-500" />
                {vendor.primary_phone}
              </p>
            )}
            {vendor.mobile_phone && (
              <p className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-emerald-500" />
                {vendor.mobile_phone}
              </p>
            )}
            {vendor.website && (
              <p className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-indigo-500" />
                <a href={vendor.website} target="_blank" rel="noreferrer" className="underline">
                  {vendor.website}
                </a>
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
              <p className="text-gray-500">Open A/P</p>
              <p className="text-lg font-semibold text-orange-600 flex items-center gap-1">
                <DollarSign className="w-4 h-4" />
                {(vendor.open_balance ?? 0).toLocaleString(undefined, {
                  style: "currency",
                  currency: vendor.currency || "USD",
                })}
              </p>
            </div>
            <div>
              <p className="text-gray-500">Total Paid</p>
              <p className="text-lg font-semibold text-emerald-600">
                {(vendor.total_paid ?? 0).toLocaleString(undefined, {
                  style: "currency",
                  currency: vendor.currency || "USD",
                })}
              </p>
            </div>
            <div>
              <p className="text-gray-500">Payment Terms</p>
              <p className="text-base font-semibold text-gray-900">
                {vendor.payment_terms || vendor.sales_term_ref || "Net 30"}
              </p>
            </div>
            <div>
              <p className="text-gray-500">Preferred Method</p>
              <p className="text-base font-semibold text-gray-900">
                {vendor.payment_method_ref || vendor.preferred_payment_method || "ACH"}
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
              billingAddress.map((line) => <p key={`bill-${line}`}>{line}</p>)
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
              shippingAddress.map((line) => <p key={`ship-${line}`}>{line}</p>)
            )}
          </CardContent>
        </Card>
      </div>

      {vendor.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{vendor.notes}</p>
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
            Created: {vendor.created_date ? new Date(vendor.created_date).toLocaleString() : "n/a"}
          </p>
          <p className="flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-slate-500" />
            Updated: {vendor.updated_date ? new Date(vendor.updated_date).toLocaleString() : "n/a"}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
