import React, { useState, useMemo } from "react";
import { recims } from "@/api/recimsClient";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useTenant } from "@/components/TenantContext";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Users, ArrowLeft, Save, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

/** ---------- Validation Constants ---------- */
const US_STATE_RE =
  /^(A[LKZR]|C[AOT]|D[CE]|F[LM]|G[AU]|H[I]|I[ADLN]|K[SY]|L[A]|M[ADEHINOPST]|N[CDEHJMVY]|O[HKR]|P[A]|R[I]|S[CD]|T[NX]|UT|V[AIT]|W[AIVY])$/;

const CA_PROVINCES = new Set([
  "AB","BC","MB","NB","NL","NS","NT","NU","ON","PE","QC","SK","YT"
]);

const US_ZIP_RE = /^[0-9]{5}(-[0-9]{4})?$/;
const CA_POSTAL_RE = /^[ABCEGHJ-NPRSTVXY][0-9][ABCEGHJ-NPRSTV-Z][ ]?[0-9][ABCEGHJ-NPRSTV-Z][0-9]$/i;

/** ---------- Validator ---------- */
function validateCustomer(v) {
  const errors = {};

  // Required fields
  if (!v.display_name?.trim()) {
    errors.display_name = "Display name is required";
  }

  // Country–currency coupling
  if (v.country === "US" && v.currency !== "USD") {
    errors.currency = "Currency must be USD for US customers.";
  }
  if (v.country === "CA" && v.currency !== "CAD") {
    errors.currency = "Currency must be CAD for Canadian customers.";
  }

  // Billing country must match customer country
  if (v.bill_country_code !== v.country) {
    errors.bill_country_code = "Billing country must equal customer country.";
  }

  // Shipping country must match or be null
  if (v.ship_country_code && v.ship_country_code !== v.country) {
    errors.ship_country_code = "Shipping country must equal customer country or be empty.";
  }

  // ----- Billing validations -----
  if (v.bill_country_code === "US") {
    if (v.bill_region && !US_STATE_RE.test(v.bill_region)) {
      errors.bill_region = "Use a valid 2-letter US state code.";
    }
    if (v.bill_postal_code && !US_ZIP_RE.test(v.bill_postal_code)) {
      errors.bill_postal_code = "ZIP must be ##### or #####-####.";
    }
  }

  if (v.bill_country_code === "CA") {
    if (v.bill_region && !CA_PROVINCES.has(v.bill_region.toUpperCase())) {
      errors.bill_region = "Use a valid Canadian province/territory code.";
    }
    if (v.bill_postal_code && !CA_POSTAL_RE.test(v.bill_postal_code)) {
      errors.bill_postal_code = "Postal code must be like M5V 3L9 (space optional).";
    }
  }

  // ----- Shipping validations (only if country provided) -----
  if (v.ship_country_code === "US") {
    if (v.ship_region && !US_STATE_RE.test(v.ship_region)) {
      errors.ship_region = "Use a valid 2-letter US state code.";
    }
    if (v.ship_postal_code && !US_ZIP_RE.test(v.ship_postal_code)) {
      errors.ship_postal_code = "ZIP must be ##### or #####-####.";
    }
  }

  if (v.ship_country_code === "CA") {
    if (v.ship_region && !CA_PROVINCES.has(v.ship_region.toUpperCase())) {
      errors.ship_region = "Use a valid Canadian province/territory code.";
    }
    if (v.ship_postal_code && !CA_POSTAL_RE.test(v.ship_postal_code)) {
      errors.ship_postal_code = "Postal code must be like M5V 3L9 (space optional).";
    }
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

/** ---------- Field Error Component ---------- */
function FieldError({ msg }) {
  if (!msg) return null;
  return <div className="text-red-600 text-xs mt-1">{msg}</div>;
}

/** ---------- Main Component ---------- */
export default function NewCustomer() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useTenant();
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const [values, setValues] = useState({
    display_name: "",
    given_name: "",
    family_name: "",
    company_name: "",
    notes: "",
    primary_email: "",
    primary_phone: "",
    mobile_phone: "",
    fax: "",
    country: "CA",
    currency: "CAD",
    active: true,
    taxable: true,
    is_tax_exempt: false,
    tax_exemption_reason_code: "",
    exemption_certificate_number: "",
    default_tax_code_ref: "",
    primary_tax_identifier: "",
    sales_term_ref: "",
    payment_method_ref: "",
    website: "",
    bill_line1: "",
    bill_line2: "",
    bill_line3: "",
    bill_city: "",
    bill_region: "",
    bill_postal_code: "",
    bill_country_code: "CA",
    ship_line1: "",
    ship_line2: "",
    ship_line3: "",
    ship_city: "",
    ship_region: "",
    ship_postal_code: "",
    ship_country_code: "",
  });



  const validationResult = useMemo(() => validateCustomer(values), [values]);
  const { errors, valid } = validationResult;

  const createCustomerMutation = useMutation({
    mutationFn: async (data) => {
      return await recims.entities.Customer.create({
        ...data,
        tenant_id: user?.tenant_id,
        external_id: `CUST-${Date.now()}`,
        status: 'active'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setSuccess("Customer created successfully!");
      setTimeout(() => {
        navigate(createPageUrl("CustomerManagement"));
      }, 2000);
    },
    onError: (err) => {
      setError(err.message || "Failed to create customer. Please try again.");
    }
  });

  function set(k, v) {
    setValues((s) => ({ ...s, [k]: v }));
  }

  function handleCountryChange(country) {
    set("country", country);
    set("currency", country === "US" ? "USD" : "CAD");
    set("bill_country_code", country);
    // Clear shipping country if mismatched
    if (values.ship_country_code && values.ship_country_code !== country) {
      set("ship_country_code", "");
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (!valid) {
      setError("Please fix validation errors before submitting.");
      return;
    }

    createCustomerMutation.mutate(values);
  }

  // Dynamic label for tax identifier based on country
  const taxIdLabel = values.country === "CA" 
    ? "GST Registration Number" 
    : "Tax ID (FEIN/BN)";
  
  const taxIdPlaceholder = values.country === "CA"
    ? "123456789 RT0001"
    : "12-3456789";

  // Payment terms options - conditional based on country
  const paymentTermsOptions = [
    { value: "Net 10", label: "Net 10 days" },
    { value: "Net 30", label: "Net 30 days" },
    { value: "Net 45", label: "Net 45 days" },
    { value: "COD", label: "COD (Cash on Delivery)" },
    { value: values.country === "US" ? "ACH" : "EFT", label: values.country === "US" ? "ACH (Automated Clearing House)" : "EFT (Electronic Funds Transfer)" },
    { value: "QBO Payment Link", label: "Payment Link through QBO" }
  ];

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Button
          variant="outline"
          size="icon"
          onClick={() => navigate(createPageUrl("CustomerManagement"))}
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-7 h-7 text-blue-600" />
            New Customer
          </h1>
          <p className="text-sm text-gray-600">Add new customer (US/CA validation)</p>
        </div>
        <Badge variant="outline" className="bg-purple-50 text-purple-700">
          QBO-Ready
        </Badge>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="mb-6 bg-green-50 border-green-200">
          <AlertDescription className="text-green-800">{success}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit}>
        {/* Basic Information */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="display_name">Display Name *</Label>
                <Input
                  id="display_name"
                  value={values.display_name}
                  onChange={(e) => set("display_name", e.target.value)}
                  placeholder="Customer display name"
                  required
                />
                <FieldError msg={errors.display_name} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="company_name">Company Name</Label>
                <Input
                  id="company_name"
                  value={values.company_name}
                  onChange={(e) => set("company_name", e.target.value)}
                  placeholder="Company name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="given_name">First Name</Label>
                <Input
                  id="given_name"
                  value={values.given_name}
                  onChange={(e) => set("given_name", e.target.value)}
                  placeholder="First name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="family_name">Last Name</Label>
                <Input
                  id="family_name"
                  value={values.family_name}
                  onChange={(e) => set("family_name", e.target.value)}
                  placeholder="Last name"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contact Information */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="primary_email">Email</Label>
                <Input
                  id="primary_email"
                  type="email"
                  value={values.primary_email}
                  onChange={(e) => set("primary_email", e.target.value)}
                  placeholder="email@example.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="primary_phone">Phone</Label>
                <Input
                  id="primary_phone"
                  value={values.primary_phone}
                  onChange={(e) => set("primary_phone", e.target.value)}
                  placeholder="+1-555-555-5555"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="mobile_phone">Mobile</Label>
                <Input
                  id="mobile_phone"
                  value={values.mobile_phone}
                  onChange={(e) => set("mobile_phone", e.target.value)}
                  placeholder="+1-555-555-5555"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  value={values.website}
                  onChange={(e) => set("website", e.target.value)}
                  placeholder="https://example.com"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Country & Currency */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Location & Currency</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="country">Country *</Label>
                <Select value={values.country} onValueChange={handleCountryChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="US">United States</SelectItem>
                    <SelectItem value="CA">Canada</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="currency">Currency *</Label>
                <Select value={values.currency} onValueChange={(v) => set("currency", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="CAD">CAD</SelectItem>
                  </SelectContent>
                </Select>
                <FieldError msg={errors.currency} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Billing Address */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Billing Address</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bill_country_code">Billing Country *</Label>
              <Select
                value={values.bill_country_code}
                onValueChange={(v) => set("bill_country_code", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="US">United States</SelectItem>
                  <SelectItem value="CA">Canada</SelectItem>
                </SelectContent>
              </Select>
              <FieldError msg={errors.bill_country_code} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bill_line1">Address Line 1</Label>
              <Input
                id="bill_line1"
                value={values.bill_line1}
                onChange={(e) => set("bill_line1", e.target.value)}
                placeholder="Street address"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bill_line2">Address Line 2</Label>
              <Input
                id="bill_line2"
                value={values.bill_line2}
                onChange={(e) => set("bill_line2", e.target.value)}
                placeholder="Apt, suite, etc."
              />
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="bill_city">City</Label>
                <Input
                  id="bill_city"
                  value={values.bill_city}
                  onChange={(e) => set("bill_city", e.target.value)}
                  placeholder="City"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bill_region">State/Province</Label>
                <Input
                  id="bill_region"
                  value={values.bill_region}
                  onChange={(e) => set("bill_region", e.target.value.toUpperCase())}
                  placeholder={values.bill_country_code === "US" ? "CA" : "ON"}
                  maxLength={3}
                />
                <FieldError msg={errors.bill_region} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bill_postal_code">ZIP/Postal Code</Label>
                <Input
                  id="bill_postal_code"
                  value={values.bill_postal_code}
                  onChange={(e) => set("bill_postal_code", e.target.value.toUpperCase())}
                  placeholder={values.bill_country_code === "US" ? "12345" : "M5V 3L9"}
                />
                <FieldError msg={errors.bill_postal_code} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Shipping Address */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Shipping Address (Optional)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ship_country_code">Shipping Country</Label>
              <Select
                value={values.ship_country_code}
                onValueChange={(v) => set("ship_country_code", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>None</SelectItem>
                  <SelectItem value="US">United States</SelectItem>
                  <SelectItem value="CA">Canada</SelectItem>
                </SelectContent>
              </Select>
              <FieldError msg={errors.ship_country_code} />
            </div>

            {values.ship_country_code && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="ship_line1">Address Line 1</Label>
                  <Input
                    id="ship_line1"
                    value={values.ship_line1}
                    onChange={(e) => set("ship_line1", e.target.value)}
                    placeholder="Street address"
                  />
                </div>

                <div className="grid md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="ship_city">City</Label>
                    <Input
                      id="ship_city"
                      value={values.ship_city}
                      onChange={(e) => set("ship_city", e.target.value)}
                      placeholder="City"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="ship_region">State/Province</Label>
                    <Input
                      id="ship_region"
                      value={values.ship_region}
                      onChange={(e) => set("ship_region", e.target.value.toUpperCase())}
                      placeholder={values.ship_country_code === "US" ? "CA" : "ON"}
                      maxLength={3}
                    />
                    <FieldError msg={errors.ship_region} />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="ship_postal_code">ZIP/Postal</Label>
                    <Input
                      id="ship_postal_code"
                      value={values.ship_postal_code}
                      onChange={(e) => set("ship_postal_code", e.target.value.toUpperCase())}
                      placeholder={values.ship_country_code === "US" ? "12345" : "M5V 3L9"}
                    />
                    <FieldError msg={errors.ship_postal_code} />
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Tax & Payment Settings */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Tax & Payment Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <Label htmlFor="taxable">Taxable</Label>
              <Switch
                id="taxable"
                checked={values.taxable}
                onCheckedChange={(checked) => set("taxable", checked)}
              />
            </div>

            <div className="flex items-center justify-between p-3 border rounded-lg">
              <Label htmlFor="is_tax_exempt">Tax Exempt</Label>
              <Switch
                id="is_tax_exempt"
                checked={values.is_tax_exempt}
                onCheckedChange={(checked) => set("is_tax_exempt", checked)}
              />
            </div>

            {values.is_tax_exempt && (
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="tax_exemption_reason_code">Exemption Reason</Label>
                  <Input
                    id="tax_exemption_reason_code"
                    value={values.tax_exemption_reason_code}
                    onChange={(e) => set("tax_exemption_reason_code", e.target.value)}
                    placeholder="e.g., Resale"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="exemption_certificate_number">Certificate Number</Label>
                  <Input
                    id="exemption_certificate_number"
                    value={values.exemption_certificate_number}
                    onChange={(e) => set("exemption_certificate_number", e.target.value)}
                    placeholder="Certificate #"
                  />
                </div>
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="primary_tax_identifier">
                  {taxIdLabel}
                  {values.country === "CA" && (
                    <Badge className="ml-2 bg-red-100 text-red-700 text-xs">CA Only</Badge>
                  )}
                  {values.country === "US" && (
                    <Badge className="ml-2 bg-blue-100 text-blue-700 text-xs">US Only</Badge>
                  )}
                </Label>
                <Input
                  id="primary_tax_identifier"
                  value={values.primary_tax_identifier}
                  onChange={(e) => set("primary_tax_identifier", e.target.value)}
                  placeholder={taxIdPlaceholder}
                />
                <p className="text-xs text-gray-500">
                  {values.country === "CA" 
                    ? "9-digit number + 2-letter code (RT0001)" 
                    : "Federal Employer Identification Number"}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sales_term_ref">Payment Terms</Label>
                <Select
                  value={values.sales_term_ref}
                  onValueChange={(v) => set("sales_term_ref", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select payment terms" />
                  </SelectTrigger>
                  <SelectContent>
                    {paymentTermsOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500">
                  {values.country === "CA" ? "EFT for Canadian customers" : "ACH for US customers"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notes */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={values.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Additional customer notes..."
              rows={4}
            />
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(createPageUrl("CustomerManagement"))}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={createCustomerMutation.isPending || !valid}
            className="flex-1 bg-blue-600 hover:bg-blue-700 gap-2"
          >
            <Save className="w-4 h-4" />
            {createCustomerMutation.isPending ? 'Saving...' : 'Create Customer'}
          </Button>
        </div>

        {!valid && Object.keys(errors).length > 0 && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800 font-semibold mb-2">Please fix the following errors:</p>
            <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
              {Object.entries(errors).map(([key, msg]) => (
                <li key={key}>{msg}</li>
              ))}
            </ul>
          </div>
        )}
      </form>
    </div>
  );
}