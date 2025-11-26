import React, { useState } from "react";
import { recims } from "@/api/recimsClient";
import { useQuery } from "@tanstack/react-query";
import { useTenant } from "@/components/TenantContext";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Users, 
  ArrowLeft, 
  Search, 
  Plus,
  MapPin,
  Phone,
  Mail,
  Building2,
  DollarSign
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function CustomerManagement() {
  const navigate = useNavigate();
  const { user } = useTenant();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [countryFilter, setCountryFilter] = useState('all');

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ['customers', user?.tenant_id],
    queryFn: async () => {
      if (!user?.tenant_id) return [];
      return await recims.entities.Customer.filter({
        tenant_id: user.tenant_id
      }, '-created_date');
    },
    enabled: !!user?.tenant_id,
    initialData: [],
  });

  const filteredCustomers = customers.filter(customer => {
    const matchesSearch = 
      customer.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer.company_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer.primary_email?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || customer.status === statusFilter;
    const matchesCountry = countryFilter === 'all' || customer.country === countryFilter;
    
    return matchesSearch && matchesStatus && matchesCountry;
  });

  const stats = {
    total: customers.length,
    active: customers.filter(c => c.status === 'active').length,
    us: customers.filter(c => c.country === 'US').length,
    ca: customers.filter(c => c.country === 'CA').length,
    totalBalance: customers.reduce((sum, c) => sum + (c.open_balance || 0), 0)
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
              <Users className="w-7 h-7 text-blue-600" />
              Customer Management
            </h1>
            <p className="text-sm text-gray-600">
              Manage customer accounts (QBO-ready)
            </p>
          </div>
          <Link to={createPageUrl("NewCustomer")}>
            <Button className="bg-blue-600 hover:bg-blue-700 gap-2">
              <Plus className="w-4 h-4" />
              <span className="hidden md:inline">New Customer</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-600">Total Customers</p>
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
            <p className="text-sm text-gray-600">US Customers</p>
            <p className="text-2xl font-bold text-blue-600">{stats.us}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-600">CA Customers</p>
            <p className="text-2xl font-bold text-red-600">{stats.ca}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-600">Total A/R</p>
            <p className="text-xl font-bold text-orange-600">${stats.totalBalance.toFixed(2)}</p>
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
                placeholder="Search customers..."
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

      {/* Customers List */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      ) : filteredCustomers.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Users className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-600">No customers found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredCustomers.map((customer) => (
            <Card 
              key={customer.id} 
              className="hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => navigate(createPageUrl(`EditCustomer?id=${customer.id}`))}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <h3 className="font-bold text-lg">{customer.display_name}</h3>
                      <Badge className={getStatusColor(customer.status)}>
                        {customer.status}
                      </Badge>
                      {customer.is_tax_exempt && (
                        <Badge variant="outline" className="bg-yellow-100 text-yellow-700">
                          Tax Exempt
                        </Badge>
                      )}
                    </div>

                    {customer.company_name && (
                      <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                        <Building2 className="w-4 h-4" />
                        {customer.company_name}
                      </div>
                    )}

                    <div className="grid md:grid-cols-2 gap-2 text-sm">
                      {customer.primary_email && (
                        <div className="flex items-center gap-2 text-gray-600">
                          <Mail className="w-4 h-4" />
                          {customer.primary_email}
                        </div>
                      )}
                      {customer.primary_phone && (
                        <div className="flex items-center gap-2 text-gray-600">
                          <Phone className="w-4 h-4" />
                          {customer.primary_phone}
                        </div>
                      )}
                      {customer.bill_city && customer.bill_region && (
                        <div className="flex items-center gap-2 text-gray-600">
                          <MapPin className="w-4 h-4" />
                          {customer.bill_city}, {customer.bill_region} {customer.bill_country_code}
                        </div>
                      )}
                      {customer.open_balance > 0 && (
                        <div className="flex items-center gap-2 text-orange-600 font-semibold">
                          <DollarSign className="w-4 h-4" />
                          Balance: ${customer.open_balance.toFixed(2)}
                        </div>
                      )}
                    </div>

                    {customer.qbo_id && (
                      <div className="mt-2">
                        <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700">
                          QBO ID: {customer.qbo_id}
                        </Badge>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <Badge variant="outline" className={`font-semibold ${
                      customer.country === 'US' ? 'bg-blue-50 text-blue-700' : 'bg-red-50 text-red-700'
                    }`}>
                      {customer.country} / {customer.currency}
                    </Badge>
                    {customer.total_purchases > 0 && (
                      <p className="text-xs text-gray-500">
                        Total: ${customer.total_purchases.toFixed(2)}
                      </p>
                    )}
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