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
  FileText, 
  ArrowLeft, 
  Search, 
  Plus,
  DollarSign,
  Package,
  Clock,
  TrendingUp,
  TrendingDown,
  MoreVertical
} from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths, differenceInDays } from "date-fns";
import { Alert, AlertDescription } from "@/components/ui/alert";
import TenantHeader from "@/components/TenantHeader";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export default function PurchaseOrders() {
  const navigate = useNavigate();
  const { tenantConfig, user } = useTenant();
  const [searchQuery, setSearchQuery] = useState('');
  
  // Filter states
  const [filterVendor, setFilterVendor] = useState('all');
  const [filterDateRange, setFilterDateRange] = useState('all');
  const [filterProduct, setFilterProduct] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');



  const { data: purchaseOrders = [], isLoading } = useQuery({
    queryKey: ['purchaseOrders', user?.tenant_id],
    queryFn: async () => {
      if (!user?.tenant_id) return [];
      return await recims.entities.PurchaseOrder.filter({ tenant_id: user.tenant_id }, '-created_date');
    },
    enabled: !!user?.tenant_id,
    initialData: [],
  });

  const { data: purchaseOrderItems = [] } = useQuery({
    queryKey: ['allPurchaseOrderItems', user?.tenant_id],
    queryFn: async () => {
      if (!user?.tenant_id) return [];
      return await recims.entities.PurchaseOrderItem.filter({ tenant_id: user.tenant_id });
    },
    enabled: !!user?.tenant_id,
    initialData: [],
  });

  const { data: vendors = [] } = useQuery({
    queryKey: ['vendors', user?.tenant_id],
    queryFn: async () => {
      if (!user?.tenant_id) return [];
      return await recims.entities.Vendor.filter({ tenant_id: user.tenant_id });
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

  const { data: settings = [] } = useQuery({
    queryKey: ['appSettings'],
    queryFn: () => recims.entities.AppSettings.list(),
    initialData: [],
  });

  const poModuleEnabled = settings.find(s => s.setting_key === 'enable_po_module')?.setting_value === 'true';

  // Calculate metrics
  const metrics = React.useMemo(() => {
    const now = new Date();
    const thisMonthStart = startOfMonth(now);
    const thisMonthEnd = endOfMonth(now);
    const lastMonthStart = startOfMonth(subMonths(now, 1));
    const lastMonthEnd = endOfMonth(subMonths(now, 1));

    // This month's POs
    const thisMonthPOs = purchaseOrders.filter(po => {
      const createdDate = new Date(po.created_date);
      return createdDate >= thisMonthStart && createdDate <= thisMonthEnd && po.status !== 'cancelled';
    });

    // Last month's POs
    const lastMonthPOs = purchaseOrders.filter(po => {
      const createdDate = new Date(po.created_date);
      return createdDate >= lastMonthStart && createdDate <= lastMonthEnd && po.status !== 'cancelled';
    });

    // Total PO value this month
    const totalPOValueThisMonth = thisMonthPOs.reduce((sum, po) => sum + (po.total_amount || 0), 0);

    // Open POs (sent, acknowledged, in_transit, partially_received)
    const openPOs = purchaseOrders.filter(po => 
      ['sent', 'acknowledged', 'in_transit', 'partially_received'].includes(po.status)
    ).length;

    // Pending approval (draft status)
    const pendingApproval = purchaseOrders.filter(po => po.status === 'draft').length;

    // Calculate average lead time for completed POs this month
    const completedThisMonth = thisMonthPOs.filter(po => 
      (po.status === 'received' || po.status === 'completed') && 
      po.order_date && 
      po.actual_delivery_date
    );

    const avgLeadTimeThisMonth = completedThisMonth.length > 0
      ? completedThisMonth.reduce((sum, po) => {
          const leadTime = differenceInDays(
            new Date(po.actual_delivery_date),
            new Date(po.order_date)
          );
          return sum + leadTime;
        }, 0) / completedThisMonth.length
      : 0;

    // Calculate average lead time for last month
    const completedLastMonth = lastMonthPOs.filter(po => 
      (po.status === 'received' || po.status === 'completed') && 
      po.order_date && 
      po.actual_delivery_date
    );

    const avgLeadTimeLastMonth = completedLastMonth.length > 0
      ? completedLastMonth.reduce((sum, po) => {
          const leadTime = differenceInDays(
            new Date(po.actual_delivery_date),
            new Date(po.order_date)
          );
          return sum + leadTime;
        }, 0) / completedLastMonth.length
      : 0;

    // Calculate change in lead time
    const leadTimeChange = avgLeadTimeLastMonth !== 0 
      ? avgLeadTimeThisMonth - avgLeadTimeLastMonth
      : 0;

    return {
      totalPOValueThisMonth,
      openPOs,
      pendingApproval,
      avgLeadTimeThisMonth,
      leadTimeChange
    };
  }, [purchaseOrders]);

  const filteredPOs = purchaseOrders.filter(po => {
    // Search query
    const matchesSearch = 
      po.po_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      po.vendor_name?.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (!matchesSearch) return false;

    // Vendor filter
    if (filterVendor !== 'all' && po.vendor_name !== filterVendor) {
      return false;
    }

    // Status filter
    if (filterStatus !== 'all' && po.status !== filterStatus) {
      return false;
    }

    // Product filter - check if any line items match
    if (filterProduct !== 'all') {
      const poItems = purchaseOrderItems.filter(item => item.po_id === po.id);
      const hasProduct = poItems.some(item => {
        // Match by category or product type
        return item.category === filterProduct || item.product_type === filterProduct;
      });
      if (!hasProduct) return false;
    }

    // Date range filter
    if (filterDateRange !== 'all') {
      const orderDate = new Date(po.order_date);
      orderDate.setHours(0,0,0,0); // Normalize to start of day for comparison

      const now = new Date();
      now.setHours(0,0,0,0); // Normalize to start of day

      switch(filterDateRange) {
        case 'today':
          if (orderDate.toDateString() !== now.toDateString()) return false;
          break;
        case 'week':
          const weekAgo = new Date(now);
          weekAgo.setDate(now.getDate() - 7);
          if (orderDate < weekAgo) return false;
          break;
        case 'month':
          const monthAgo = new Date(now);
          monthAgo.setDate(now.getDate() - 30);
          if (orderDate < monthAgo) return false;
          break;
        case 'custom':
          if (customStartDate && customEndDate) {
            const start = new Date(customStartDate);
            start.setHours(0,0,0,0);
            const end = new Date(customEndDate);
            end.setHours(23,59,59,999); // Set to end of day for inclusive comparison
            if (orderDate < start || orderDate > end) return false;
          }
          break;
      }
    }
    
    return true;
  });

  const getStatusColor = (status) => {
    switch(status) {
      case 'draft': return 'bg-gray-100 text-gray-700';
      case 'sent': return 'bg-blue-100 text-blue-700';
      case 'acknowledged': return 'bg-purple-100 text-purple-700';
      case 'in_transit': return 'bg-yellow-100 text-yellow-700';
      case 'partially_received': return 'bg-orange-100 text-orange-700';
      case 'received': return 'bg-green-100 text-green-700';
      case 'completed': return 'bg-green-100 text-green-700';
      case 'cancelled': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getItemCount = (poId) => {
    return purchaseOrderItems.filter(item => item.po_id === poId).length;
  };

  if (!poModuleEnabled) {
    return (
      <div className="p-4 md:p-8 max-w-4xl mx-auto">
        <TenantHeader />
        <Alert>
          <AlertDescription>
            Purchase Order module is not enabled. Please enable it in Super Admin settings.
          </AlertDescription>
        </Alert>
        <Link to={createPageUrl("Dashboard")} className="mt-4 inline-block">
          <Button variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </Link>
      </div>
    );
  }

  if (!poModuleEnabled) {
    return (
      <div className="p-4 md:p-8 max-w-4xl mx-auto">
        <TenantHeader />
        <Alert>
          <AlertDescription>
            Purchase Order module is not enabled. Please enable it in Super Admin settings.
          </AlertDescription>
        </Alert>
        <Link to={createPageUrl("Dashboard")} className="mt-4 inline-block">
          <Button variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </Link>
      </div>
    );
  }

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
            <h1 className="text-3xl font-bold text-gray-900">Purchase Orders</h1>
            <p className="text-gray-600 text-sm">Manage purchase orders and vendor relationships</p>
          </div>
          <Link to={createPageUrl("CreatePurchaseOrder")}>
            <Button className="bg-green-600 hover:bg-green-700 gap-2">
              <Plus className="w-4 h-4" />
              <span className="hidden md:inline">New Purchase Order</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {/* Total PO Value This Month */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 rounded-lg bg-green-100">
                <DollarSign className="w-5 h-5 text-green-600" />
              </div>
            </div>
            <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-1 break-words leading-tight">
              ${metrics.totalPOValueThisMonth.toLocaleString()}
            </p>
            <p className="text-sm text-gray-600">Total PO Value</p>
            <p className="text-xs text-gray-500 mt-1">This month</p>
          </CardContent>
        </Card>

        {/* Open POs */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 rounded-lg bg-blue-100">
                <Package className="w-5 h-5 text-blue-600" />
              </div>
            </div>
            <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-1 leading-tight">
              {metrics.openPOs}
            </p>
            <p className="text-sm text-gray-600">Open POs</p>
            <p className="text-xs text-gray-500 mt-1">Awaiting delivery</p>
          </CardContent>
        </Card>

        {/* Pending Approval */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 rounded-lg bg-orange-100">
                <Clock className="w-5 h-5 text-orange-600" />
              </div>
            </div>
            <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-1 leading-tight">
              {metrics.pendingApproval}
            </p>
            <p className="text-sm text-gray-600">Pending Approval</p>
            <p className="text-xs text-gray-500 mt-1">Requires review</p>
          </CardContent>
        </Card>

        {/* Avg Lead Time */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 rounded-lg bg-purple-100">
                <Clock className="w-5 h-5 text-purple-600" />
              </div>
              {metrics.leadTimeChange !== 0 && (
                <div className={`flex items-center gap-1 text-xs ${
                  metrics.leadTimeChange > 0 ? 'text-red-600' : 'text-green-600'
                }`}>
                  {metrics.leadTimeChange > 0 ? (
                    <TrendingUp className="w-3 h-3" />
                  ) : (
                    <TrendingDown className="w-3 h-3" />
                  )}
                  {Math.abs(metrics.leadTimeChange).toFixed(0)}d
                </div>
              )}
            </div>
            <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-1 leading-tight">
              {metrics.avgLeadTimeThisMonth.toFixed(0)} days
            </p>
            <p className="text-sm text-gray-600">Avg Lead Time</p>
            <p className="text-xs text-gray-500 mt-1">
              {metrics.leadTimeChange > 0 ? '+' : ''}{metrics.leadTimeChange.toFixed(0)} days from last month
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
              placeholder="Search by PO number or vendor..."
              className="pl-10"
            />
          </div>

          {/* Filter Row */}
          <div className="grid md:grid-cols-5 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-gray-600">Vendor/Supplier</Label>
              <Select value={filterVendor} onValueChange={setFilterVendor}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="All Vendors" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Vendors</SelectItem>
                  {[...new Set(vendors.map(v => v.display_name))].map((name) => (
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
                  {[...new Set(skus.map(s => s.category))].map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
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
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="acknowledged">Acknowledged</SelectItem>
                  <SelectItem value="in_transit">In Transit</SelectItem>
                  <SelectItem value="partially_received">Partially Received</SelectItem>
                  <SelectItem value="received">Received</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-gray-600">&nbsp;</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setFilterVendor('all');
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
            <div className="grid md:grid-cols-2 gap-3 pt-2 border-t mt-4">
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
          {(filterVendor !== 'all' || filterDateRange !== 'all' || filterProduct !== 'all' || filterStatus !== 'all' || searchQuery !== '') && (
            <div className="flex items-center gap-2 text-sm text-gray-600 pt-2 border-t mt-4">
              <Badge variant="outline" className="bg-blue-50">
                Showing {filteredPOs.length} of {purchaseOrders.length} purchase orders
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Purchase Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle>Purchase Orders</CardTitle>
          <p className="text-sm text-gray-600">View and manage all purchase orders</p>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
            </div>
          ) : filteredPOs.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p className="text-gray-600">No purchase orders found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b">
                  <tr className="text-left">
                    <th className="pb-3 px-4 font-semibold text-gray-700">PO Number</th>
                    <th className="pb-3 px-4 font-semibold text-gray-700">Vendor</th>
                    <th className="pb-3 px-4 font-semibold text-gray-700">Date</th>
                    <th className="pb-3 px-4 font-semibold text-gray-700">Expected Delivery</th>
                    <th className="pb-3 px-4 font-semibold text-gray-700 text-center">Items</th>
                    <th className="pb-3 px-4 font-semibold text-gray-700">Status</th>
                    <th className="pb-3 px-4 font-semibold text-gray-700 text-right min-w-[100px]">Total</th>
                    <th className="pb-3 px-4 font-semibold text-gray-700 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPOs.map((po) => (
                    <tr key={po.id} className="border-b hover:bg-gray-50 transition-colors">
                      <td className="py-4 px-4">
                        <button
                          onClick={() => navigate(createPageUrl(`ViewPurchaseOrder?id=${po.id}`))}
                          className="text-blue-600 hover:text-blue-800 font-semibold hover:underline"
                        >
                          {po.po_number}
                        </button>
                      </td>
                      <td className="py-4 px-4">
                        <span className="text-gray-900">{po.vendor_name}</span>
                      </td>
                      <td className="py-4 px-4 text-gray-600">
                        {po.order_date ? format(new Date(po.order_date), 'MMM dd, yyyy') : '-'}
                      </td>
                      <td className="py-4 px-4 text-gray-600">
                        {po.expected_delivery_date ? format(new Date(po.expected_delivery_date), 'MMM dd, yyyy') : '-'}
                      </td>
                      <td className="py-4 px-4 text-center">
                        <Badge variant="outline" className="font-mono">
                          {getItemCount(po.id)}
                        </Badge>
                      </td>
                      <td className="py-4 px-4">
                        <Badge className={getStatusColor(po.status)}>
                          {po.status.replace(/_/g, ' ')}
                        </Badge>
                      </td>
                      <td className="py-4 px-4 text-right font-semibold text-gray-900 break-words min-w-[100px]">
                        ${(po.total_amount || 0).toLocaleString()}
                      </td>
                      <td className="py-4 px-4 text-center">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => navigate(createPageUrl(`ViewPurchaseOrder?id=${po.id}`))}>
                              View Details
                            </DropdownMenuItem>
                            {po.status === 'draft' && (
                              <DropdownMenuItem onClick={() => navigate(createPageUrl(`EditPurchaseOrder?id=${po.id}`))}>
                                Edit PO
                              </DropdownMenuItem>
                            )}
                            {po.status === 'draft' && !po.barcode_generated && (
                              <DropdownMenuItem onClick={() => navigate(createPageUrl(`GeneratePOBarcodes?id=${po.id}`))}>
                                Generate Barcodes
                              </DropdownMenuItem>
                            )}
                            {(po.status === 'sent' || po.status === 'in_transit') && (
                              <DropdownMenuItem onClick={() => navigate(createPageUrl(`ReceivePurchaseOrder?id=${po.id}`))}>
                                Receive Items
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