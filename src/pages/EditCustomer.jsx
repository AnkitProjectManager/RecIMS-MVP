import React, { useState, useEffect } from "react";
import { recims } from "@/api/recimsClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowLeft, Save, AlertCircle } from "lucide-react";

export default function EditCustomer() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const customerId = new URLSearchParams(window.location.search).get("id");
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const [formData, setFormData] = useState({
    display_name: '',
    given_name: '',
    family_name: '',
    company_name: '',
    notes: '',
    primary_email: '',
    primary_phone: '',
    mobile_phone: '',
    fax: '',
    country: 'US',
    currency: 'USD',
    active: true,
    taxable: true,
    is_tax_exempt: false,
    tax_exemption_reason_code: '',
    exemption_certificate_number: '',
    default_tax_code_ref: '',
    primary_tax_identifier: '',
    sales_term_ref: '',
    payment_method_ref: '',
    website: '',
    bill_line1: '',
    bill_line2: '',
    bill_city: '',
    bill_region: '',
    bill_postal_code: '',
    bill_country_code: 'US',
    ship_line1: '',
    ship_line2: '',
    ship_city: '',
    ship_region: '',
    ship_postal_code: '',
    ship_country_code: 'US',
    status: 'active'
  });

  const { data: customer, isLoading } = useQuery({
    queryKey: ['customer', customerId],
    queryFn: async () => {
      const customers = await recims.entities.Customer.filter({ id: customerId });
      return customers[0];
    },
    enabled: !!customerId,
  });

  useEffect(() => {
    if (customer) {
      setFormData({
        display_name: customer.display_name || '',
        given_name: customer.given_name || '',
        family_name: customer.family_name || '',
        company_name: customer.company_name || '',
        notes: customer.notes || '',
        primary_email: customer.primary_email || '',
        primary_phone: customer.primary_phone || '',
        mobile_phone: customer.mobile_phone || '',
        fax: customer.fax || '',
        country: customer.country || 'US',
        currency: customer.currency || 'USD',
        active: customer.active !== false,
        taxable: customer.taxable !== false,
        is_tax_exempt: customer.is_tax_exempt || false,
        tax_exemption_reason_code: customer.tax_exemption_reason_code || '',
        exemption_certificate_number: customer.exemption_certificate_number || '',
        default_tax_code_ref: customer.default_tax_code_ref || '',
        primary_tax_identifier: customer.primary_tax_identifier || '',
        sales_term_ref: customer.sales_term_ref || '',
        payment_method_ref: customer.payment_method_ref || '',
        website: customer.website || '',
        bill_line1: customer.bill_line1 || '',
        bill_line2: customer.bill_line2 || '',
        bill_city: customer.bill_city || '',
        bill_region: customer.bill_region || '',
        bill_postal_code: customer.bill_postal_code || '',
        bill_country_code: customer.bill_country_code || 'US',
        ship_line1: customer.ship_line1 || '',
        ship_line2: customer.ship_line2 || '',
        ship_city: customer.ship_city || '',
        ship_region: customer.ship_region || '',
        ship_postal_code: customer.ship_postal_code || '',
        ship_country_code: customer.ship_country_code || 'US',
        status: customer.status || 'active'
      });
    }
  }, [customer]);

  const updateMutation = useMutation({
    mutationFn: async (data) => {
      return await recims.entities.Customer.update(customerId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer'] });
      setSuccess("Customer updated successfully");
      setTimeout(() => navigate(createPageUrl("CustomerManagement")), 1500);
    },
    onError: (err) => {
      setError(err.message || "Failed to update customer");
    }
  });

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    if (field === 'country' || field === 'bill_country_code') {
      const currencyMap = { US: 'USD', CA: 'CAD', PK: 'PKR', IN: 'INR', CN: 'CNY', GB: 'GBP', EU: 'EUR' };
      setFormData(prev => ({ 
        ...prev, 
        currency: currencyMap[value] || 'USD',
        bill_country_code: field === 'country' ? value : prev.bill_country_code,
        country: field === 'country' ? value : prev.country
      }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError(null);
    
    if (!formData.display_name) {
      setError("Display name is required");
      return;
    }

    updateMutation.mutate(formData);
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

  if (!customer) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Customer not found</AlertDescription>
        </Alert>
        <Button onClick={() => navigate(createPageUrl("CustomerManagement"))} className="mt-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Customers
        </Button>
      </div>
    );
  }

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
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Edit Customer</h1>
          <p className="text-sm text-gray-600">{customer.display_name}</p>
        </div>
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
        <Tabs defaultValue="general">
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="contact">Contact</TabsTrigger>
            <TabsTrigger value="billing">Billing Address</TabsTrigger>
            <TabsTrigger value="shipping">Shipping Address</TabsTrigger>
          </TabsList>

          <TabsContent value="general">
            <Card>
              <CardHeader>
                <CardTitle>General Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Display Name *</Label>
                    <Input
                      value={formData.display_name}
                      onChange={(e) => handleChange('display_name', e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Company Name</Label>
                    <Input
                      value={formData.company_name}
                      onChange={(e) => handleChange('company_name', e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>First Name</Label>
                    <Input
                      value={formData.given_name}
                      onChange={(e) => handleChange('given_name', e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Last Name</Label>
                    <Input
                      value={formData.family_name}
                      onChange={(e) => handleChange('family_name', e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Country *</Label>
                    <Select value={formData.country} onValueChange={(value) => handleChange('country', value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="US">🇺🇸 United States</SelectItem>
                        <SelectItem value="CA">🇨🇦 Canada</SelectItem>
                        <SelectItem value="PK">🇵🇰 Pakistan</SelectItem>
                        <SelectItem value="IN">🇮🇳 India</SelectItem>
                        <SelectItem value="CN">🇨🇳 China</SelectItem>
                        <SelectItem value="GB">🇬🇧 United Kingdom</SelectItem>
                        <SelectItem value="EU">🇪🇺 European Union</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Currency *</Label>
                    <Select value={formData.currency} onValueChange={(value) => handleChange('currency', value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USD">USD</SelectItem>
                        <SelectItem value="CAD">CAD</SelectItem>
                        <SelectItem value="PKR">PKR</SelectItem>
                        <SelectItem value="INR">INR</SelectItem>
                        <SelectItem value="CNY">CNY</SelectItem>
                        <SelectItem value="GBP">GBP</SelectItem>
                        <SelectItem value="EUR">EUR</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={formData.status} onValueChange={(value) => handleChange('status', value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                        <SelectItem value="suspended">Suspended</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Website</Label>
                    <Input
                      value={formData.website}
                      onChange={(e) => handleChange('website', e.target.value)}
                      placeholder="https://..."
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Notes / Commodity Information</Label>
                  <Textarea
                    value={formData.notes}
                    onChange={(e) => handleChange('notes', e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="flex items-center gap-4 pt-4 border-t">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.active}
                      onChange={(e) => handleChange('active', e.target.checked)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">Active</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.taxable}
                      onChange={(e) => handleChange('taxable', e.target.checked)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">Taxable</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.is_tax_exempt}
                      onChange={(e) => handleChange('is_tax_exempt', e.target.checked)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">Tax Exempt</span>
                  </label>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="contact">
            <Card>
              <CardHeader>
                <CardTitle>Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={formData.primary_email}
                      onChange={(e) => handleChange('primary_email', e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Primary Phone</Label>
                    <Input
                      value={formData.primary_phone}
                      onChange={(e) => handleChange('primary_phone', e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Mobile Phone</Label>
                    <Input
                      value={formData.mobile_phone}
                      onChange={(e) => handleChange('mobile_phone', e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Fax</Label>
                    <Input
                      value={formData.fax}
                      onChange={(e) => handleChange('fax', e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="billing">
            <Card>
              <CardHeader>
                <CardTitle>Billing Address</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2 md:col-span-2">
                    <Label>Address Line 1</Label>
                    <Input
                      value={formData.bill_line1}
                      onChange={(e) => handleChange('bill_line1', e.target.value)}
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label>Address Line 2</Label>
                    <Input
                      value={formData.bill_line2}
                      onChange={(e) => handleChange('bill_line2', e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>City</Label>
                    <Input
                      value={formData.bill_city}
                      onChange={(e) => handleChange('bill_city', e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>State/Province</Label>
                    <Input
                      value={formData.bill_region}
                      onChange={(e) => handleChange('bill_region', e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Postal Code</Label>
                    <Input
                      value={formData.bill_postal_code}
                      onChange={(e) => handleChange('bill_postal_code', e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Country</Label>
                    <Select value={formData.bill_country_code} onValueChange={(value) => handleChange('bill_country_code', value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="US">United States</SelectItem>
                        <SelectItem value="CA">Canada</SelectItem>
                        <SelectItem value="PK">Pakistan</SelectItem>
                        <SelectItem value="IN">India</SelectItem>
                        <SelectItem value="CN">China</SelectItem>
                        <SelectItem value="GB">United Kingdom</SelectItem>
                        <SelectItem value="EU">European Union</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="shipping">
            <Card>
              <CardHeader>
                <CardTitle>Shipping Address</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2 md:col-span-2">
                    <Label>Address Line 1</Label>
                    <Input
                      value={formData.ship_line1}
                      onChange={(e) => handleChange('ship_line1', e.target.value)}
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label>Address Line 2</Label>
                    <Input
                      value={formData.ship_line2}
                      onChange={(e) => handleChange('ship_line2', e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>City</Label>
                    <Input
                      value={formData.ship_city}
                      onChange={(e) => handleChange('ship_city', e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>State/Province</Label>
                    <Input
                      value={formData.ship_region}
                      onChange={(e) => handleChange('ship_region', e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Postal Code</Label>
                    <Input
                      value={formData.ship_postal_code}
                      onChange={(e) => handleChange('ship_postal_code', e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Country</Label>
                    <Select value={formData.ship_country_code} onValueChange={(value) => handleChange('ship_country_code', value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="US">United States</SelectItem>
                        <SelectItem value="CA">Canada</SelectItem>
                        <SelectItem value="PK">Pakistan</SelectItem>
                        <SelectItem value="IN">India</SelectItem>
                        <SelectItem value="CN">China</SelectItem>
                        <SelectItem value="GB">United Kingdom</SelectItem>
                        <SelectItem value="EU">European Union</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex gap-3 mt-6">
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
            disabled={updateMutation.isPending}
            className="flex-1 bg-green-600 hover:bg-green-700"
          >
            <Save className="w-4 h-4 mr-2" />
            {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </div>
  );
}