import React, { useState, useMemo } from "react";
import { recims } from "@/api/recimsClient";
import { useQuery } from "@tanstack/react-query";
import { useTenant } from "@/components/TenantContext";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  Building2,
  TrendingUp,
  DollarSign,
  Package,
  ShoppingCart,
  Calendar,
  Filter,
  Database,
  Lock,
  Server
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { subDays, format, startOfMonth, endOfMonth, subMonths } from "date-fns";

export default function CrossTenantDashboard() {
  const { user } = useTenant();
  const [selectedTenantIds, setSelectedTenantIds] = useState([]);
  const [dateRange, setDateRange] = useState('3months');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  const { data: tenants = [] } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => recims.entities.Tenant.list(),
    initialData: [],
  });

  const { data: allSalesOrders = [] } = useQuery({
    queryKey: ['allSalesOrders'],
    queryFn: async () => {
      // Fetch all sales orders across all tenants (admin access)
      return await recims.asServiceRole.entities.SalesOrder.list('-order_date', 2000);
    },
    initialData: [],
  });

  const { data: allInventory = [] } = useQuery({
    queryKey: ['allInventory'],
    queryFn: async () => {
      return await recims.asServiceRole.entities.Inventory.list('-created_date', 2000);
    },
    initialData: [],
  });

  const { data: allPurchaseOrders = [] } = useQuery({
    queryKey: ['allPurchaseOrders'],
    queryFn: async () => {
      return await recims.asServiceRole.entities.PurchaseOrder.list('-order_date', 2000);
    },
    initialData: [],
  });

  // Initialize selected tenants to all on mount
  React.useEffect(() => {
    if (tenants.length > 0 && selectedTenantIds.length === 0) {
      setSelectedTenantIds(tenants.map(t => t.tenant_id));
    }
  }, [tenants, selectedTenantIds.length]);

  const toggleTenant = (tenantId) => {
    setSelectedTenantIds(current =>
      current.includes(tenantId)
        ? current.filter(id => id !== tenantId)
        : [...current, tenantId]
    );
  };

  const getDateRangeFilter = () => {
    const now = new Date();
    switch (dateRange) {
      case 'mtd':
        return { start: startOfMonth(now), end: now };
      case '1month':
        return { start: subMonths(now, 1), end: now };
      case '3months':
        return { start: subMonths(now, 3), end: now };
      case '6months':
        return { start: subMonths(now, 6), end: now };
      case '9months':
        return { start: subMonths(now, 9), end: now };
      case '1year':
        return { start: subMonths(now, 12), end: now };
      case 'custom':
        return {
          start: customStartDate ? new Date(customStartDate) : subMonths(now, 3),
          end: customEndDate ? new Date(customEndDate) : now
        };
      default:
        return { start: subMonths(now, 3), end: now };
    }
  };

  const { start: startDate, end: endDate } = getDateRangeFilter();

  // Filter data by selected tenants and date range
  const filteredSalesOrders = useMemo(() => {
    return allSalesOrders.filter(order => {
      if (!selectedTenantIds.includes(order.tenant_id)) return false;
      const orderDate = new Date(order.order_date);
      return orderDate >= startDate && orderDate <= endDate;
    });
  }, [allSalesOrders, selectedTenantIds, startDate, endDate]);

  const filteredInventory = useMemo(() => {
    return allInventory.filter(item => selectedTenantIds.includes(item.tenant_id));
  }, [allInventory, selectedTenantIds]);

  const filteredPurchaseOrders = useMemo(() => {
    return allPurchaseOrders.filter(po => {
      if (!selectedTenantIds.includes(po.tenant_id)) return false;
      const poDate = new Date(po.order_date);
      return poDate >= startDate && poDate <= endDate;
    });
  }, [allPurchaseOrders, selectedTenantIds, startDate, endDate]);

  // Calculate metrics
  const totalSales = filteredSalesOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
  const totalOrders = filteredSalesOrders.length;
  const totalInventoryValue = filteredInventory.reduce((sum, i) => sum + (i.total_value || 0), 0);
  const totalPurchaseOrderValue = filteredPurchaseOrders.reduce((sum, po) => sum + (po.total_amount || 0), 0);

  // Sales by tenant
  const salesByTenant = useMemo(() => {
    const tenantSales = {};
    filteredSalesOrders.forEach(order => {
      const tenant = tenants.find(t => t.tenant_id === order.tenant_id);
      const tenantName = tenant?.display_name || order.tenant_id;
      if (!tenantSales[tenantName]) {
        tenantSales[tenantName] = 0;
      }
      tenantSales[tenantName] += order.total_amount || 0;
    });
    return Object.entries(tenantSales).map(([name, value]) => ({ name, value }));
  }, [filteredSalesOrders, tenants]);

  // Sales trend over time
  const salesTrend = useMemo(() => {
    const monthlyData = {};
    filteredSalesOrders.forEach(order => {
      const month = format(new Date(order.order_date), 'MMM yyyy');
      if (!monthlyData[month]) {
        monthlyData[month] = { month, total: 0, orders: 0 };
      }
      monthlyData[month].total += order.total_amount || 0;
      monthlyData[month].orders += 1;
    });
    return Object.values(monthlyData).sort((a, b) => 
      new Date(a.month) - new Date(b.month)
    );
  }, [filteredSalesOrders]);

  // Check if user is admin or cross-tenant admin
  const hasAccess = user?.role === 'admin' || user?.detailed_role === 'superadmin' || user?.detailed_role === 'cross_tenant_admin';
  
  if (!hasAccess) {
    return (
      <div className="p-4 md:p-8 max-w-4xl mx-auto">
        <Alert variant="destructive">
          <AlertDescription>
            Access denied. Super Admin or Cross-Tenant Admin privileges required to view cross-tenant dashboard.
          </AlertDescription>
        </Alert>
        <Link to={createPageUrl("Dashboard")}>
          <Button className="mt-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 via-gray-50 to-gray-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link to={createPageUrl("SuperAdmin")}>
            <Button variant="outline" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Building2 className="w-7 h-7 text-purple-600" />
              Cross-Tenant Dashboard
            </h1>
            <p className="text-sm text-gray-600">View combined metrics across multiple tenants</p>
          </div>
          <Badge className="bg-purple-600 text-white">
            {user?.detailed_role === 'cross_tenant_admin' ? 'CROSS-TENANT ADMIN' : 'SUPER ADMIN'}
          </Badge>
        </div>

        {/* Database & AWS Configuration */}
        <Card className="mb-6 border-2 border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-900">
              <Database className="w-5 h-5" />
              Cross-Tenant Database & AWS Configuration
            </CardTitle>
            <p className="text-sm text-orange-700">
              Configure MySQL database access and AWS credentials for cross-tenant data access
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* MySQL Configuration */}
            <div className="p-4 bg-white rounded-lg border-2 border-orange-200">
              <div className="flex items-center gap-2 mb-3">
                <Server className="w-5 h-5 text-orange-600" />
                <h3 className="font-semibold text-gray-900">MySQL Database Access</h3>
              </div>
              <div className="space-y-3 text-sm">
                <div className="grid md:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-gray-600">Database Host</Label>
                    <Input 
                      placeholder="mysql-instance.region.rds.amazonaws.com" 
                      className="mt-1 bg-gray-50"
                      defaultValue=""
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-600">Database Port</Label>
                    <Input 
                      placeholder="3306" 
                      className="mt-1 bg-gray-50"
                      defaultValue="3306"
                    />
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-gray-600">Database Name</Label>
                    <Input 
                      placeholder="multi_tenant_db" 
                      className="mt-1 bg-gray-50"
                      defaultValue=""
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-600">Admin Username</Label>
                    <Input 
                      placeholder="admin_user" 
                      className="mt-1 bg-gray-50"
                      defaultValue=""
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-gray-600 flex items-center gap-1">
                    <Lock className="w-3 h-3" />
                    Admin Password (Encrypted in AWS Secrets Manager)
                  </Label>
                  <Input 
                    type="password"
                    placeholder="••••••••••••" 
                    className="mt-1 bg-gray-50"
                  />
                </div>
                <div className="p-3 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">
                  <strong>Note:</strong> Database credentials are stored securely in AWS Secrets Manager. 
                  Cross-tenant queries use tenant_id isolation with read-only access to maintain data security.
                </div>
              </div>
            </div>

            {/* AWS Credentials Configuration */}
            <div className="p-4 bg-white rounded-lg border-2 border-orange-200">
              <div className="flex items-center gap-2 mb-3">
                <Lock className="w-5 h-5 text-orange-600" />
                <h3 className="font-semibold text-gray-900">AWS Access Configuration</h3>
              </div>
              <div className="space-y-3 text-sm">
                <div className="grid md:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-gray-600">AWS Region</Label>
                    <Input 
                      placeholder="us-east-1" 
                      className="mt-1 bg-gray-50"
                      defaultValue="us-east-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-600">IAM Role ARN</Label>
                    <Input 
                      placeholder="arn:aws:iam::account:role/CrossTenantReadOnly" 
                      className="mt-1 bg-gray-50"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-gray-600">Secrets Manager ARN</Label>
                  <Input 
                    placeholder="arn:aws:secretsmanager:region:account:secret:db-credentials" 
                    className="mt-1 bg-gray-50"
                  />
                </div>
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
                  <strong>Security Best Practice:</strong> Use AWS IAM roles with minimal permissions. 
                  Grant only SELECT access on specific tables with tenant_id filtering enforced at the database level.
                </div>
              </div>
            </div>

            {/* Connection Test */}
            <div className="flex items-center justify-between p-4 bg-white rounded-lg border">
              <div>
                <p className="font-semibold text-sm text-gray-900">Connection Status</p>
                <p className="text-xs text-gray-600">Test database connectivity and AWS access</p>
              </div>
              <Button className="bg-orange-600 hover:bg-orange-700">
                Test Connection
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Tenant Selection */}
            <div>
              <Label className="mb-2 block">Select Tenants</Label>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedTenantIds(tenants.map(t => t.tenant_id))}
                >
                  Select All
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedTenantIds([])}
                >
                  Clear All
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                {tenants.map(tenant => {
                  const isSelected = selectedTenantIds.includes(tenant.tenant_id);
                  return (
                    <Button
                      key={tenant.id}
                      onClick={() => toggleTenant(tenant.tenant_id)}
                      variant={isSelected ? 'default' : 'outline'}
                      size="sm"
                      className={isSelected ? 'bg-purple-600' : ''}
                    >
                      {tenant.display_name || tenant.name}
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* Date Range Selection */}
            <div>
              <Label className="mb-2 block">Date Range</Label>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: 'mtd', label: 'MTD' },
                  { value: '1month', label: '1 Month' },
                  { value: '3months', label: '3 Months' },
                  { value: '6months', label: '6 Months' },
                  { value: '9months', label: '9 Months' },
                  { value: '1year', label: '1 Year' },
                  { value: 'custom', label: 'Custom' }
                ].map(option => (
                  <Button
                    key={option.value}
                    onClick={() => setDateRange(option.value)}
                    variant={dateRange === option.value ? 'default' : 'outline'}
                    size="sm"
                    className={dateRange === option.value ? 'bg-blue-600' : ''}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>

              {dateRange === 'custom' && (
                <div className="grid md:grid-cols-2 gap-3 mt-3">
                  <div>
                    <Label className="text-xs">Start Date</Label>
                    <Input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">End Date</Label>
                    <Input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Summary Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-green-50">
                  <DollarSign className="w-5 h-5 text-green-600" />
                </div>
                <p className="text-sm font-semibold text-gray-600">Total Sales</p>
              </div>
              <p className="text-3xl font-bold text-gray-900">
                ${totalSales.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
              <p className="text-xs text-gray-500 mt-1">{totalOrders} orders</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-blue-50">
                  <Package className="w-5 h-5 text-blue-600" />
                </div>
                <p className="text-sm font-semibold text-gray-600">Inventory Value</p>
              </div>
              <p className="text-3xl font-bold text-gray-900">
                ${totalInventoryValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
              <p className="text-xs text-gray-500 mt-1">{filteredInventory.length} items</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-orange-50">
                  <ShoppingCart className="w-5 h-5 text-orange-600" />
                </div>
                <p className="text-sm font-semibold text-gray-600">Purchase Orders</p>
              </div>
              <p className="text-3xl font-bold text-gray-900">
                ${totalPurchaseOrderValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
              <p className="text-xs text-gray-500 mt-1">{filteredPurchaseOrders.length} POs</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-purple-50">
                  <Building2 className="w-5 h-5 text-purple-600" />
                </div>
                <p className="text-sm font-semibold text-gray-600">Active Tenants</p>
              </div>
              <p className="text-3xl font-bold text-gray-900">{selectedTenantIds.length}</p>
              <p className="text-xs text-gray-500 mt-1">of {tenants.length} total</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid gap-6 mb-6">
          {/* Sales Trend */}
          <Card>
            <CardHeader>
              <CardTitle>Sales Trend Over Time</CardTitle>
              <p className="text-sm text-gray-600 mt-1">Combined sales across selected tenants</p>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={salesTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="total" stroke="#10b981" strokeWidth={2} name="Total Sales ($)" />
                  <Line yAxisId="right" type="monotone" dataKey="orders" stroke="#8b5cf6" strokeWidth={2} name="Orders" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Sales by Tenant */}
          <Card>
            <CardHeader>
              <CardTitle>Sales by Tenant</CardTitle>
              <p className="text-sm text-gray-600 mt-1">Compare performance across tenants</p>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={salesByTenant}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#8b5cf6" name="Total Sales ($)" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Data Tables */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Recent Sales Orders */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Sales Orders</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {filteredSalesOrders.slice(0, 20).map(order => {
                  const tenant = tenants.find(t => t.tenant_id === order.tenant_id);
                  return (
                    <div key={order.id} className="p-3 bg-gray-50 rounded-lg border">
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-semibold text-sm">{order.order_number}</p>
                        <Badge variant="outline">{tenant?.display_name}</Badge>
                      </div>
                      <div className="flex items-center justify-between text-xs text-gray-600">
                        <span>{format(new Date(order.order_date), 'MMM dd, yyyy')}</span>
                        <span className="font-bold text-green-600">${(order.total_amount || 0).toLocaleString()}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Top Inventory Items */}
          <Card>
            <CardHeader>
              <CardTitle>Top Inventory Items</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {filteredInventory
                  .sort((a, b) => (b.total_value || 0) - (a.total_value || 0))
                  .slice(0, 20)
                  .map(item => {
                    const tenant = tenants.find(t => t.tenant_id === item.tenant_id);
                    return (
                      <div key={item.id} className="p-3 bg-gray-50 rounded-lg border">
                        <div className="flex items-center justify-between mb-1">
                          <p className="font-semibold text-sm">{item.sku_number || item.item_name}</p>
                          <Badge variant="outline">{tenant?.display_name}</Badge>
                        </div>
                        <div className="flex items-center justify-between text-xs text-gray-600">
                          <span>{item.quantity_kg?.toFixed(2)} kg</span>
                          <span className="font-bold text-blue-600">${(item.total_value || 0).toLocaleString()}</span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}