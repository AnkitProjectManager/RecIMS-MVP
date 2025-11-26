import React, { useState } from "react";
import { recims } from "@/api/recimsClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTenant } from "@/components/TenantContext";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { 
  Users, 
  ArrowLeft, 
  Search, 
  Plus,
  MapPin,
  Phone,
  Mail,
  Building2,
  DollarSign,
  FileText,
  Trash2
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function VendorManagement() {
  const navigate = useNavigate();
  const { user } = useTenant();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [countryFilter, setCountryFilter] = useState('all');

  const { data: vendors = [], isLoading } = useQuery({
    queryKey: ['vendors', user?.tenant_id],
    queryFn: async () => {
      if (!user?.tenant_id) return [];
      return await recims.entities.Vendor.filter({
        tenant_id: user.tenant_id
      }, '-created_date');
    },
    enabled: !!user?.tenant_id,
    initialData: [],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      await recims.entities.Vendor.delete(id);
      return id;
    },
    onSuccess: (deletedId) => {
      queryClient.invalidateQueries({ queryKey: ['vendors', user?.tenant_id] });
      toast({
        title: 'Vendor deleted',
        description: `Vendor #${deletedId} has been removed.`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Delete failed',
        description: error?.message || 'Could not delete the vendor.',
        variant: 'destructive',
      });
    },
  });

  const handleDelete = async (vendor) => {
    if (!vendor?.id) return;
    const confirmed = window.confirm(`Delete ${vendor.display_name || 'this vendor'}? This cannot be undone.`);
    if (!confirmed) return;
    try {
      await deleteMutation.mutateAsync(vendor.id);
    } catch (error) {
      // toast handler covers error state
    }
  };

  const filteredVendors = vendors.filter(vendor => {
    const matchesSearch = 
      vendor.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vendor.company_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vendor.primary_email?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || vendor.status === statusFilter;
    const matchesCountry = countryFilter === 'all' || vendor.country === countryFilter;
    
    return matchesSearch && matchesStatus && matchesCountry;
  });

  const stats = {
    total: vendors.length,
    active: vendors.filter(v => v.status === 'active').length,
    us: vendors.filter(v => v.country === 'US').length,
    ca: vendors.filter(v => v.country === 'CA').length,
    totalSpend: vendors.reduce((sum, v) => sum + (v.total_paid || 0), 0),
    openBalance: vendors.reduce((sum, v) => sum + (v.open_balance || 0), 0)
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'active': return 'bg-green-100 text-green-700';
      case 'inactive': return 'bg-gray-100 text-gray-700';
      case 'suspended': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="sticky top-12 z-40 bg-white py-4 -mt-4 mb-6">
        <div className="flex items-center gap-3">
          <Link to={createPageUrl("Dashboard")}>
            <Button variant="outline" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Users className="w-7 h-7 text-orange-600" />
              Vendor Management
            </h1>
            <p className="text-sm text-gray-600">Manage supplier/vendor accounts (QBO-ready)</p>
          </div>
          <Link to={createPageUrl("NewVendor")}>
            <Button className="bg-orange-600 hover:bg-orange-700 gap-2">
              <Plus className="w-4 h-4" />
              <span className="hidden md:inline">New Vendor</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-600">Total Vendors</p>
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-600">Active</p>
            <p className="text-2xl font-bold text-green-600">{stats.active}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-600">US Vendors</p>
            <p className="text-2xl font-bold text-blue-600">{stats.us}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-600">CA Vendors</p>
            <p className="text-2xl font-bold text-red-600">{stats.ca}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-600">Total Spend</p>
            <p className="text-lg font-bold text-purple-600">${stats.totalSpend.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-600">Open A/P</p>
            <p className="text-lg font-bold text-orange-600">${stats.openBalance.toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search vendors..."
                className="pl-10"
              />
            </div>
            <Tabs value={statusFilter} onValueChange={setStatusFilter}>
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="active">Active</TabsTrigger>
                <TabsTrigger value="inactive">Inactive</TabsTrigger>
                <TabsTrigger value="suspended">Suspended</TabsTrigger>
              </TabsList>
            </Tabs>
            <Tabs value={countryFilter} onValueChange={setCountryFilter}>
              <TabsList>
                <TabsTrigger value="all">All Countries</TabsTrigger>
                <TabsTrigger value="US">US</TabsTrigger>
                <TabsTrigger value="CA">CA</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardContent>
      </Card>

      {/* Vendors List */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto"></div>
        </div>
      ) : filteredVendors.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Users className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-600">No vendors found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredVendors.map((vendor) => (
            <Card 
              key={vendor.id} 
              className="hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => navigate(createPageUrl(`EditVendor?id=${vendor.id}`))}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-bold text-lg">{vendor.display_name}</h3>
                      <Badge className={getStatusColor(vendor.status)}>
                        {vendor.status}
                      </Badge>
                      {vendor.vendor_1099 && (
                        <Badge variant="outline" className="bg-yellow-100 text-yellow-700">
                          1099
                        </Badge>
                      )}
                      {vendor.w9_on_file && (
                        <Badge variant="outline" className="bg-blue-100 text-blue-700">
                          W-9
                        </Badge>
                      )}
                    </div>

                    {vendor.company_name && (
                      <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                        <Building2 className="w-4 h-4" />
                        {vendor.company_name}
                      </div>
                    )}

                    <div className="grid md:grid-cols-2 gap-2 text-sm">
                      {vendor.primary_email && (
                        <div className="flex items-center gap-2 text-gray-600">
                          <Mail className="w-4 h-4" />
                          {vendor.primary_email}
                        </div>
                      )}
                      {vendor.primary_phone && (
                        <div className="flex items-center gap-2 text-gray-600">
                          <Phone className="w-4 h-4" />
                          {vendor.primary_phone}
                        </div>
                      )}
                      {vendor.bill_city && vendor.bill_region && (
                        <div className="flex items-center gap-2 text-gray-600">
                          <MapPin className="w-4 h-4" />
                          {vendor.bill_city}, {vendor.bill_region} {vendor.bill_country_code}
                        </div>
                      )}
                      {vendor.open_balance > 0 && (
                        <div className="flex items-center gap-2 text-orange-600 font-semibold">
                          <DollarSign className="w-4 h-4" />
                          A/P Balance: ${vendor.open_balance.toFixed(2)}
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2 mt-2">
                      {vendor.qbo_id && (
                        <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700">
                          QBO ID: {vendor.qbo_id}
                        </Badge>
                      )}
                      {vendor.acct_num && (
                        <Badge variant="outline" className="text-xs bg-gray-50 text-gray-700">
                          <FileText className="w-3 h-3 mr-1" />
                          Acct: {vendor.acct_num}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <Badge variant="outline" className={`font-semibold ${
                      vendor.country === 'US' ? 'bg-blue-50 text-blue-700' : 'bg-red-50 text-red-700'
                    }`}>
                      {vendor.country} / {vendor.currency}
                    </Badge>
                    {vendor.total_paid > 0 && (
                      <p className="text-xs text-gray-500">
                        Total Paid: ${vendor.total_paid.toFixed(2)}
                      </p>
                    )}
                    <Button
                      variant="destructive"
                      size="sm"
                      className="gap-2"
                      disabled={deleteMutation.isPending && deleteMutation.variables === vendor.id}
                      onClick={(event) => {
                        event.stopPropagation();
                        handleDelete(vendor);
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}