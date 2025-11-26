import React, { useState, useMemo } from "react";
import { recims } from "@/api/recimsClient";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
function validateVendor(v) {
  const errors = {};

  // Required fields
  if (!v.display_name?.trim()) {
    errors.display_name = "Display name is required";
  }

  // Country–currency coupling
  if (v.country === "US" && v.currency !== "USD") {
    errors.currency = "Currency must be USD for US vendors.";
  }
  if (v.country === "CA" && v.currency !== "CAD") {
    errors.currency = "Currency must be CAD for Canadian vendors.";
  }

  // Billing country must match vendor country
  if (v.bill_country_code && v.bill_country_code !== v.country) {
    errors.bill_country_code = "Billing country must equal vendor country.";
  }

  // Remittance country must match or be empty
  if (v.remit_country_code && v.remit_country_code !== v.country) {
    errors.remit_country_code = "Remittance country must equal vendor country or be empty.";
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

  // ----- Remittance validations (only if country provided) -----
  if (v.remit_country_code === "US") {
    if (v.remit_region && !US_STATE_RE.test(v.remit_region)) {
      errors.remit_region = "Use a valid 2-letter US state code.";
    }
    if (v.remit_postal_code && !US_ZIP_RE.test(v.remit_postal_code)) {
      errors.remit_postal_code = "ZIP must be ##### or #####-####.";
    }
  }

  if (v.remit_country_code === "CA") {
    if (v.remit_region && !CA_PROVINCES.has(v.remit_region.toUpperCase())) {
      errors.remit_region = "Use a valid Canadian province/territory code.";
    }
    if (v.remit_postal_code && !CA_POSTAL_RE.test(v.remit_postal_code)) {
      errors.remit_postal_code = "Postal code must be like M5V 3L9 (space optional).";
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
export default function NewVendor() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useTenant();
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const [values, setValues] = useState({
    display_name: "",
    company_name: "",
    given_name: "",
    family_name: "",
    print_on_check_name: "",
    acct_num: "",
    primary_email: "",
    primary_phone: "",
    mobile_phone: "",
    fax: "",
    web_site: "",
    country: "CA",
    currency: "CAD",
    active: true,
    terms_ref: "",
    payment_method_ref: "",
    vendor_1099: false,
    w9_on_file: false,
    t4a_eligible: false,
    tax_identifier: "",
    gst_hst_number: "",
    bill_line1: "",
    bill_line2: "",
    bill_line3: "",
    bill_city: "",
    bill_region: "",
    bill_postal_code: "",
    bill_country_code: "CA",
    remit_line1: "",
    remit_line2: "",
    remit_line3: "",
    remit_city: "",
    remit_region: "",
    remit_postal_code: "",
    remit_country_code: "",
    notes: ""
  });



  const validationResult = useMemo(() => validateVendor(values), [values]);
  const { errors, valid } = validationResult;

  const createVendorMutation = useMutation({
    mutationFn: async (data) => {
      return await recims.entities.Vendor.create({
        ...data,
        tenant_id: user?.tenant_id,
        external_id: `VEND-${Date.now()}`,
        status: 'active'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      setSuccess("Vendor created successfully!");
      setTimeout(() => {
        navigate(createPageUrl("VendorManagement"));
      }, 2000);
    },
    onError: (err) => {
      setError(err.message || "Failed to create vendor. Please try again.");
    }
  });

  function set(k, v) {
    setValues((s) => ({ ...s, [k]: v }));
  }

  function handleCountryChange(country) {
    set("country", country);
    set("currency", country === "US" ? "USD" : "CAD");
    set("bill_country_code", country);
    // Clear remit country if mismatched
    if (values.remit_country_code && values.remit_country_code !== country) {
      set("remit_country_code", "");
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (!valid) {
      setError("Please fix validation errors before submitting.");
      return;
    }

    createVendorMutation.mutate(values);
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Button
          variant="outline"
          size="icon"
          onClick={() => navigate(createPageUrl("VendorManagement"))}
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-7 h-7 text-orange-600" />
            New Vendor
          </h1>
          <p className="text-sm text-gray-600">Add new supplier/vendor (US/CA validation)</p>
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
                  placeholder="Vendor display name"
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

              <div className="space-y-2">
                <Label htmlFor="print_on_check_name">Print on Check As</Label>
                <Input
                  id="print_on_check_name"
                  value={values.print_on_check_name}
                  onChange={(e) => set("print_on_check_name", e.target.value)}
                  placeholder="Name for checks"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="acct_num">Account Number</Label>
                <Input
                  id="acct_num"
                  value={values.acct_num}
                  onChange={(e) => set("acct_num", e.target.value)}
                  placeholder="Vendor account #"
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
                <Label htmlFor="web_site">Website</Label>
                <Input
                  id="web_site"
                  value={values.web_site}
                  onChange={(e) => set("web_site", e.target.value)}
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
              <Label htmlFor="bill_country_code">Billing Country</Label>
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
                placeholder="Suite, unit, etc."
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

        {/* Remittance Address */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Remittance Address (Optional)</CardTitle>
            <p className="text-sm text-gray-600">Where to send payments if different from billing</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="remit_country_code">Remittance Country</Label>
              <Select
                value={values.remit_country_code}
                onValueChange={(v) => set("remit_country_code", v)}
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
              <FieldError msg={errors.remit_country_code} />
            </div>

            {values.remit_country_code && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="remit_line1">Address Line 1</Label>
                  <Input
                    id="remit_line1"
                    value={values.remit_line1}
                    onChange={(e) => set("remit_line1", e.target.value)}
                    placeholder="Street address"
                  />
                </div>

                <div className="grid md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="remit_city">City</Label>
                    <Input
                      id="remit_city"
                      value={values.remit_city}
                      onChange={(e) => set("remit_city", e.target.value)}
                      placeholder="City"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="remit_region">State/Province</Label>
                    <Input
                      id="remit_region"
                      value={values.remit_region}
                      onChange={(e) => set("remit_region", e.target.value.toUpperCase())}
                      placeholder={values.remit_country_code === "US" ? "CA" : "ON"}
                      maxLength={3}
                    />
                    <FieldError msg={errors.remit_region} />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="remit_postal_code">ZIP/Postal</Label>
                    <Input
                      id="remit_postal_code"
                      value={values.remit_postal_code}
                      onChange={(e) => set("remit_postal_code", e.target.value.toUpperCase())}
                      placeholder={values.remit_country_code === "US" ? "12345" : "M5V 3L9"}
                    />
                    <FieldError msg={errors.remit_postal_code} />
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Payment & Tax Settings */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Payment & Tax Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="terms_ref">Payment Terms</Label>
                <Input
                  id="terms_ref"
                  value={values.terms_ref}
                  onChange={(e) => set("terms_ref", e.target.value)}
                  placeholder="e.g., Net 30, Net 15"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="payment_method_ref">Payment Method</Label>
                <Input
                  id="payment_method_ref"
                  value={values.payment_method_ref}
                  onChange={(e) => set("payment_method_ref", e.target.value)}
                  placeholder="e.g., ACH, Check, Wire"
                />
              </div>
            </div>

            {values.country === 'US' && (
              <>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <Label htmlFor="vendor_1099">1099 Vendor</Label>
                    <p className="text-xs text-gray-500">Subject to 1099 reporting</p>
                  </div>
                  <Switch
                    id="vendor_1099"
                    checked={values.vendor_1099}
                    onCheckedChange={(checked) => set("vendor_1099", checked)}
                  />
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <Label htmlFor="w9_on_file">W-9 on File</Label>
                    <p className="text-xs text-gray-500">W-9 form received</p>
                  </div>
                  <Switch
                    id="w9_on_file"
                    checked={values.w9_on_file}
                    onCheckedChange={(checked) => set("w9_on_file", checked)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tax_identifier">Tax ID (TIN)</Label>
                  <Input
                    id="tax_identifier"
                    value={values.tax_identifier}
                    onChange={(e) => set("tax_identifier", e.target.value)}
                    placeholder="US Tax Identification Number"
                  />
                </div>
              </>
            )}

            {values.country === 'CA' && (
              <>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <Label htmlFor="t4a_eligible">T4A Eligible</Label>
                    <p className="text-xs text-gray-500">Subject to T4A reporting</p>
                  </div>
                  <Switch
                    id="t4a_eligible"
                    checked={values.t4a_eligible}
                    onCheckedChange={(checked) => set("t4a_eligible", checked)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tax_identifier">Business Number (BN)</Label>
                  <Input
                    id="tax_identifier"
                    value={values.tax_identifier}
                    onChange={(e) => set("tax_identifier", e.target.value)}
                    placeholder="Canadian Business Number"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="gst_hst_number">GST/HST Number</Label>
                  <Input
                    id="gst_hst_number"
                    value={values.gst_hst_number}
                    onChange={(e) => set("gst_hst_number", e.target.value)}
                    placeholder="GST/HST Registration Number"
                  />
                </div>
              </>
            )}
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
              placeholder="Additional vendor notes..."
              rows={4}
            />
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(createPageUrl("VendorManagement"))}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={createVendorMutation.isPending || !valid}
            className="flex-1 bg-orange-600 hover:bg-orange-700 gap-2"
          >
            <Save className="w-4 h-4" />
            {createVendorMutation.isPending ? 'Saving...' : 'Create Vendor'}
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