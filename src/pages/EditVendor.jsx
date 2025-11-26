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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowLeft, Save, AlertCircle } from "lucide-react";

export default function EditVendor() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const vendorId = new URLSearchParams(window.location.search).get("id");
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const [formData, setFormData] = useState({
    display_name: '',
    company_name: '',
    given_name: '',
    family_name: '',
    primary_email: '',
    primary_phone: '',
    country: 'US',
    currency: 'USD',
    active: true,
    bill_line1: '',
    bill_city: '',
    bill_region: '',
    bill_postal_code: '',
    bill_country_code: 'US',
    status: 'active'
  });

  const { data: vendor, isLoading } = useQuery({
    queryKey: ['vendor', vendorId],
    queryFn: async () => {
      const vendors = await recims.entities.Vendor.filter({ id: vendorId });
      return vendors[0];
    },
    enabled: !!vendorId,
  });

  useEffect(() => {
    if (vendor) {
      setFormData({
        display_name: vendor.display_name || '',
        company_name: vendor.company_name || '',
        given_name: vendor.given_name || '',
        family_name: vendor.family_name || '',
        primary_email: vendor.primary_email || '',
        primary_phone: vendor.primary_phone || '',
        country: vendor.country || 'US',
        currency: vendor.currency || 'USD',
        active: vendor.active !== false,
        bill_line1: vendor.bill_line1 || '',
        bill_city: vendor.bill_city || '',
        bill_region: vendor.bill_region || '',
        bill_postal_code: vendor.bill_postal_code || '',
        bill_country_code: vendor.bill_country_code || 'US',
        status: vendor.status || 'active'
      });
    }
  }, [vendor]);

  const updateMutation = useMutation({
    mutationFn: async (data) => {
      return await recims.entities.Vendor.update(vendorId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor'] });
      setSuccess("Vendor updated successfully");
      setTimeout(() => navigate(createPageUrl("VendorManagement")), 1500);
    },
    onError: (err) => {
      setError(err.message || "Failed to update vendor");
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

  if (!vendor) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Vendor not found</AlertDescription>
        </Alert>
        <Button onClick={() => navigate(createPageUrl("VendorManagement"))} className="mt-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Vendors
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
          onClick={() => navigate(createPageUrl("VendorManagement"))}
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Edit Vendor</h1>
          <p className="text-sm text-gray-600">{vendor.display_name}</p>
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
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="address">Address</TabsTrigger>
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
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={formData.primary_email}
                      onChange={(e) => handleChange('primary_email', e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input
                      value={formData.primary_phone}
                      onChange={(e) => handleChange('primary_phone', e.target.value)}
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
                </div>

                <div className="flex items-center gap-2 pt-4 border-t">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.active}
                      onChange={(e) => handleChange('active', e.target.checked)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">Active</span>
                  </label>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="address">
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
        </Tabs>

        <div className="flex gap-3 mt-6">
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