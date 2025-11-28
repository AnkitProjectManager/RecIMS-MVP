import React, { useState } from "react";
import { recims } from "@/api/recimsClient";
import { useQuery } from "@tanstack/react-query";
import { useTenant } from "@/components/TenantContext";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { formatUSD } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  FileText,
  ArrowLeft,
  Search,
  Plus,
  DollarSign,
  Package,
  Clock,
  TrendingUp,
  TrendingDown,
  MoreVertical,
} from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import TenantHeader from "@/components/TenantHeader";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function SalesOrderManagement() {
  const navigate = useNavigate();
  const { user } = useTenant();
  const [searchQuery, setSearchQuery] = useState('');

  // Filter states
  const [filterCustomer, setFilterCustomer] = useState('all');
  const [filterDateRange, setFilterDateRange] = useState('all');
  const [filterProduct, setFilterProduct] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');



  const { data: salesOrders = [], isLoading } = useQuery({
    queryKey: ['salesOrders', user?.tenant_id],
    queryFn: async () => {
      if (!user?.tenant_id) return [];
      return await recims.entities.SalesOrder.filter({ tenant_id: user.tenant_id }, '-created_date');
    },
    enabled: !!user?.tenant_id,
    initialData: [],
  });

  const { data: lineItems = [] } = useQuery({
    queryKey: ['allSalesOrderLines', user?.tenant_id],
    queryFn: async () => {
      if (!user?.tenant_id) return [];
      return await recims.entities.SalesOrderLine.filter({ tenant_id: user.tenant_id });
    },
    enabled: !!user?.tenant_id,
    initialData: [],
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers', user?.tenant_id],
    queryFn: async () => {
      if (!user?.tenant_id) return [];
      return await recims.entities.Customer.filter({ tenant_id: user.tenant_id });
    },
    enabled: !!user?.tenant_id,
    initialData: [],
  });

  const { data: skus = [] } = useQuery({
    queryKey: ['productSKUs', user?.tenant_id],
    queryFn: async () => {
      if (!user?.tenant_id) return [];
      return await recims.entities.ProductSKU.filter({ tenant_id: user.tenant_id, status: 'active' });
    },
    enabled: !!user?.tenant_id,
    initialData: [],
  });

  // Calculate metrics
  const metrics = React.useMemo(() => {
    const now = new Date();
    const thisMonthStart = startOfMonth(now);
    const thisMonthEnd = endOfMonth(now);
    const lastMonthStart = startOfMonth(subMonths(now, 1));
    const lastMonthEnd = endOfMonth(subMonths(now, 1));

    // This month's orders
    const thisMonthOrders = salesOrders.filter(so => {
      const createdDate = new Date(so.created_date);
      return createdDate >= thisMonthStart && createdDate <= thisMonthEnd && so.status !== 'CANCELLED';
    });

    // Last month's orders
    const lastMonthOrders = salesOrders.filter(so => {
      const createdDate = new Date(so.created_date);
      return createdDate >= lastMonthStart && createdDate <= lastMonthEnd && so.status !== 'CANCELLED';
    });

    // Calculate total sales this month
    const totalSalesThisMonth = thisMonthOrders.reduce((sum, so) => {
      const soLines = lineItems.filter(line => line.so_id === so.id);
      const soTotal = soLines.reduce((lineSum, line) => lineSum + ((line.quantity_ordered || 0) * 0), 0); // Note: We don't have unit price in SO lines
      return sum + soTotal;
    }, 0);

    // Open orders (APPROVED, RELEASED, PARTIALLY_INVOICED)
    const openOrders = salesOrders.filter(so =>
      ['APPROVED', 'RELEASED', 'PARTIALLY_INVOICED'].includes(so.status)
    ).length;

    // Pending invoices (RELEASED orders that haven't been invoiced)
    const pendingInvoices = salesOrders.filter(so => so.status === 'RELEASED').length;

    // Average order value this month
    const avgOrderValueThisMonth = thisMonthOrders.length > 0
      ? totalSalesThisMonth / thisMonthOrders.length
      : 0;

    // Average order value last month
    const totalSalesLastMonth = lastMonthOrders.reduce((sum, so) => {
      const soLines = lineItems.filter(line => line.so_id === so.id);
      const soTotal = soLines.reduce((lineSum, line) => lineSum + ((line.quantity_ordered || 0) * 0), 0);
      return sum + soTotal;
    }, 0);

    const avgOrderValueLastMonth = lastMonthOrders.length > 0
      ? totalSalesLastMonth / lastMonthOrders.length
      : 0;

    // Percentage change
    const percentChange = avgOrderValueLastMonth !== 0
      ? ((avgOrderValueThisMonth - avgOrderValueLastMonth) / avgOrderValueLastMonth) * 100
      : 0;

    return {
      totalSalesThisMonth,
      openOrders,
      pendingInvoices,
      avgOrderValueThisMonth,
      percentChange
    };
  }, [salesOrders, lineItems]);

  const filteredOrders = salesOrders.filter(so => {
    // Search query
    const matchesSearch =
      so.so_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      so.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      so.po_number?.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    // Customer filter
    if (filterCustomer !== 'all' && so.customer_name !== filterCustomer) {
      return false;
    }

    // Status filter
    if (filterStatus !== 'all' && so.status !== filterStatus) {
      return false;
    }

    // Product filter - check if any line items match
    if (filterProduct !== 'all') {
      const soLines = lineItems.filter(line => line.so_id === so.id);
      const hasProduct = soLines.some(line => line.sku_snapshot === filterProduct);
      if (!hasProduct) return false;
    }

    // Date range filter
    if (filterDateRange !== 'all') {
      const orderDate = new Date(so.created_date);
      const now = new Date();

      switch(filterDateRange) {
        case 'today':
          const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
          if (orderDate < todayStart || orderDate > todayEnd) return false;
          break;
        case 'week':
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          if (orderDate < weekAgo) return false;
          break;
        case 'month':
          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          if (orderDate < monthAgo) return false;
          break;
        case 'custom':
          if (customStartDate && customEndDate) {
            const start = new Date(customStartDate);
            const end = new Date(customEndDate);
            end.setHours(23, 59, 59, 999); // Include the full end day
            if (orderDate < start || orderDate > end) return false;
          } else if (customStartDate && !customEndDate) {
              const start = new Date(customStartDate);
              if (orderDate < start) return false;
          } else if (!customStartDate && customEndDate) {
              const end = new Date(customEndDate);
              end.setHours(23, 59, 59, 999);
              if (orderDate > end) return false;
          }
          break;
      }
    }

    return true;
  });

  const getStatusColor = (status) => {
    switch(status) {
      case 'DRAFT': return 'bg-gray-100 text-gray-700';
      case 'PENDING_APPROVAL': return 'bg-yellow-100 text-yellow-700';
      case 'NEEDS_UPDATE': return 'bg-orange-100 text-orange-700';
      case 'APPROVED': return 'bg-blue-100 text-blue-700';
      case 'RELEASED': return 'bg-purple-100 text-purple-700';
      case 'PARTIALLY_INVOICED': return 'bg-indigo-100 text-indigo-700';
      case 'CLOSED': return 'bg-green-100 text-green-700';
      case 'CANCELLED': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getItemCount = (soId) => {
    return lineItems.filter(line => line.so_id === soId).length;
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <TenantHeader />

      <div className="sticky top-12 z-40 bg-white py-4 -mt-4 mb-6">
        <div className="flex items-center gap-3">
          <Link to={createPageUrl("Dashboard")}>
            <Button variant="outline" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900">Sales Orders</h1>
            <p className="text-gray-600 text-sm">Manage Sales orders and generate invoices</p>
          </div>
          <Link to={createPageUrl("CreateSalesOrder")}>
            <Button className="bg-green-600 hover:bg-green-700 gap-2">
              <Plus className="w-4 h-4" />
              <span className="hidden md:inline">New Sales Order</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {/* Total Sales This Month */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 rounded-lg bg-green-100">
                <DollarSign className="w-5 h-5 text-green-600" />
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900 mb-1">
              {formatUSD(metrics.totalSalesThisMonth, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </p>
            <p className="text-sm text-gray-600">Total Sales</p>
            <p className="text-xs text-gray-500 mt-1">This month</p>
          </CardContent>
        </Card>

        {/* Open Orders */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 rounded-lg bg-blue-100">
                <Package className="w-5 h-5 text-blue-600" />
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900 mb-1">
              {metrics.openOrders}
            </p>
            <p className="text-sm text-gray-600">Open Orders</p>
            <p className="text-xs text-gray-500 mt-1">Awaiting shipment</p>
          </CardContent>
        </Card>

        {/* Pending Invoices */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 rounded-lg bg-orange-100">
                <Clock className="w-5 h-5 text-orange-600" />
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900 mb-1">
              {metrics.pendingInvoices}
            </p>
            <p className="text-sm text-gray-600">Pending Invoices</p>
            <p className="text-xs text-gray-500 mt-1">To be generated</p>
          </CardContent>
        </Card>

        {/* Avg Order Value */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 rounded-lg bg-purple-100">
                <TrendingUp className="w-5 h-5 text-purple-600" />
              </div>
              {metrics.percentChange !== 0 && (
                <div className={`flex items-center gap-1 text-xs ${
                  metrics.percentChange > 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {metrics.percentChange > 0 ? (
                    <TrendingUp className="w-3 h-3" />
                  ) : (
                    <TrendingDown className="w-3 h-3" />
                  )}
                  {Math.abs(metrics.percentChange).toFixed(1)}%
                </div>
              )}
            </div>
            <p className="text-3xl font-bold text-gray-900 mb-1">
              {formatUSD(metrics.avgOrderValueThisMonth, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-sm text-gray-600">Avg Order Value</p>
            <p className="text-xs text-gray-500 mt-1">
              {metrics.percentChange > 0 ? '+' : ''}{metrics.percentChange.toFixed(1)}% from last month
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filters */}
      <Card className="mb-6">
        <CardContent className="p-4 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by order number, customer, or PO number..."
              className="pl-10"
            />
          </div>

          {/* Filter Row */}
          <div className="grid md:grid-cols-5 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-gray-600">Customer</Label>
              <Select value={filterCustomer} onValueChange={setFilterCustomer}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="All Customers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Customers</SelectItem>
                  {[...new Set(customers.map(c => c.display_name))].map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-gray-600">Date Range</Label>
              <Select value={filterDateRange} onValueChange={setFilterDateRange}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="All Time" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">Last 7 Days</SelectItem>
                  <SelectItem value="month">Last 30 Days</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-gray-600">Product</Label>
              <Select value={filterProduct} onValueChange={setFilterProduct}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="All Products" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Products</SelectItem>
                  {skus.slice(0, 50).map((sku) => (
                    <SelectItem key={sku.id} value={sku.sku_number}>
                      {sku.sku_number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-gray-600">Status</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="DRAFT">Draft</SelectItem>
                  <SelectItem value="PENDING_APPROVAL">Pending Approval</SelectItem>
                  <SelectItem value="NEEDS_UPDATE">Needs Update</SelectItem>
                  <SelectItem value="APPROVED">Approved</SelectItem>
                  <SelectItem value="RELEASED">Released</SelectItem>
                  <SelectItem value="PARTIALLY_INVOICED">Partially Invoiced</SelectItem>
                  <SelectItem value="CLOSED">Closed</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-gray-600">&nbsp;</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setFilterCustomer('all');
                  setFilterDateRange('all');
                  setFilterProduct('all');
                  setFilterStatus('all');
                  setCustomStartDate('');
                  setCustomEndDate('');
                  setSearchQuery('');
                }}
                className="w-full h-9"
              >
                Clear Filters
              </Button>
            </div>
          </div>

          {/* Custom Date Range */}
          {filterDateRange === 'custom' && (
            <div className="grid md:grid-cols-2 gap-3 pt-2 border-t">
              <div className="space-y-1">
                <Label className="text-xs text-gray-600">Start Date</Label>
                <Input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-gray-600">End Date</Label>
                <Input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="h-9"
                />
              </div>
            </div>
          )}

          {/* Active Filters Badge */}
          {(filterCustomer !== 'all' || filterDateRange !== 'all' || filterProduct !== 'all' || filterStatus !== 'all' || searchQuery !== '') && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Badge variant="outline" className="bg-blue-50">
                {filteredOrders.length} of {salesOrders.length} orders
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sales Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle>Sales Orders</CardTitle>
          <p className="text-sm text-gray-600">View and manage all sales orders</p>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p className="text-gray-600">No sales orders found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b">
                  <tr className="text-left">
                    <th className="pb-3 px-4 font-semibold text-gray-700">Order Number</th>
                    <th className="pb-3 px-4 font-semibold text-gray-700">Customer</th>
                    <th className="pb-3 px-4 font-semibold text-gray-700">Date</th>
                    <th className="pb-3 px-4 font-semibold text-gray-700 text-center">Items</th>
                    <th className="pb-3 px-4 font-semibold text-gray-700">Status</th>
                    <th className="pb-3 px-4 font-semibold text-gray-700 text-right">Total</th>
                    <th className="pb-3 px-4 font-semibold text-gray-700 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((so) => (
                    <tr key={so.id} className="border-b hover:bg-gray-50 transition-colors">
                      <td className="py-4 px-4">
                        <button
                          onClick={() => navigate(createPageUrl(`ViewSalesOrder?id=${so.id}`))}
                          className="text-blue-600 hover:text-blue-800 font-semibold hover:underline"
                        >
                          {so.so_number}
                        </button>
                      </td>
                      <td className="py-4 px-4">
                        <button
                          onClick={() => navigate(createPageUrl(`CustomerManagement`))}
                          className="text-gray-900 hover:text-blue-600 hover:underline"
                        >
                          {so.customer_name}
                        </button>
                      </td>
                      <td className="py-4 px-4 text-gray-600">
                        {so.created_date ? format(new Date(so.created_date), 'MMM dd, yyyy') : '-'}
                      </td>
                      <td className="py-4 px-4 text-center">
                        <Badge variant="outline" className="font-mono">
                          {getItemCount(so.id)}
                        </Badge>
                      </td>
                      <td className="py-4 px-4">
                        <Badge className={getStatusColor(so.status)}>
                          {so.status.replace(/_/g, ' ')}
                        </Badge>
                      </td>
                      <td className="py-4 px-4 text-right font-semibold text-gray-900">
                        {so.currency || 'USD'} -
                      </td>
                      <td className="py-4 px-4 text-center">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => navigate(createPageUrl(`ViewSalesOrder?id=${so.id}`))}>
                              View Details
                            </DropdownMenuItem>
                            {so.status === 'DRAFT' && (
                              <DropdownMenuItem onClick={() => navigate(createPageUrl(`PrintPackingSlip?id=${so.id}`))}>
                                Print Packing Slip
                              </DropdownMenuItem>
                            )}
                            {so.status === 'RELEASED' && (
                              <DropdownMenuItem onClick={() => navigate(createPageUrl(`CreateInvoice?so_id=${so.id}`))}>
                                Create Invoice
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}