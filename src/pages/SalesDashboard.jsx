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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileText,
  ArrowLeft,
  Search,
  Plus,
  DollarSign,
  Package,
  Clock,
  TrendingUp,
  Eye,
  Edit,
  Printer,
  Copy,
  ChevronUp,
  ChevronDown,
  Filter,
  AlertCircle,
  Truck,
  ArrowRightLeft,
  CheckCircle2
} from "lucide-react";
import { format } from "date-fns";
import TenantHeader from "@/components/TenantHeader";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export default function SalesDashboard() {
  const navigate = useNavigate();
  const { user } = useTenant();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortField, setSortField] = useState('created_date');
  const [sortDirection, setSortDirection] = useState('desc');

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

  // Calculate metrics
  const metrics = React.useMemo(() => {
    const quotations = salesOrders.filter(so => so.status === 'QUOTATION').length;
    const approved = salesOrders.filter(so => so.status === 'APPROVED_QUOTATION' || so.status === 'SALES_ORDER_APPROVED').length;
    const readyForPicking = salesOrders.filter(so => so.status === 'SALES_ORDER_READY_FOR_PICKING').length;
    const pendingPayment = salesOrders.filter(so => so.status === 'SALES_ORDER_PENDING_PAYMENT').length;
    const completed = salesOrders.filter(so => so.status === 'SALES_ORDER_COMPLETED').length;
    
    const totalRevenue = salesOrders
      .filter(so => so.status === 'SALES_ORDER_COMPLETED')
      .reduce((sum, so) => sum + (so.total_amount || 0), 0);

    const totalOutstanding = salesOrders
      .filter(so => so.status !== 'SALES_ORDER_COMPLETED' && so.status !== 'QUOTATION')
      .reduce((sum, so) => sum + ((so.total_amount || 0) - (so.paid_amount || 0)), 0);

    return {
      quotations,
      approved,
      readyForPicking,
      pendingPayment,
      completed,
      totalRevenue,
      totalOutstanding
    };
  }, [salesOrders]);

  // Filter and sort
  const filteredAndSortedOrders = React.useMemo(() => {
    let filtered = salesOrders.filter(so => {
      const matchesSearch =
        so.so_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        so.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        so.po_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        so.invoice_number?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = statusFilter === 'all' || so.status === statusFilter;

      return matchesSearch && matchesStatus;
    });

    // Sort
    filtered.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      if (sortField === 'created_date') {
        aVal = new Date(aVal).getTime();
        bVal = new Date(bVal).getTime();
      }

      if (sortField === 'total_amount' || sortField === 'paid_amount') {
        aVal = aVal || 0;
        bVal = bVal || 0;
      }

      if (sortDirection === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

    return filtered;
  }, [salesOrders, searchQuery, statusFilter, sortField, sortDirection]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'QUOTATION': return 'bg-gray-100 text-gray-700';
      case 'APPROVED_QUOTATION': return 'bg-blue-100 text-blue-700';
      case 'SALES_ORDER_APPROVED': return 'bg-green-100 text-green-700';
      case 'SALES_ORDER_READY_FOR_PICKING': return 'bg-yellow-100 text-yellow-700';
      case 'SALES_ORDER_PICKED_AND_COMPLETED': return 'bg-purple-100 text-purple-700';
      case 'SALES_ORDER_TO_BE_EDITED': return 'bg-orange-100 text-orange-700';
      case 'SALES_ORDER_READY_FOR_INVOICING': return 'bg-indigo-100 text-indigo-700';
      case 'SALES_ORDER_PENDING_PAYMENT': return 'bg-amber-100 text-amber-700';
      case 'SALES_ORDER_COMPLETED': return 'bg-emerald-100 text-emerald-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusLabel = (status) => {
    return status.replace(/_/g, ' ').replace(/SALES ORDER/g, 'SO');
  };

  // Get customer contact person
  const getCustomerContact = (customerId) => {
    const customer = customers.find(c => c.id === customerId);
    if (!customer) return '';
    return customer.contact_person || customer.given_name || '';
  };

  // Check stock allocation status
  const getStockAllocationStatus = (so) => {
    const soLines = lineItems.filter(line => line.so_id === so.id);
    if (soLines.length === 0) return 'none';
    
    const totalOrdered = soLines.reduce((sum, line) => sum + (line.quantity_ordered || 0), 0);
    const totalAllocated = soLines.reduce((sum, line) => sum + (line.quantity_allocated || 0), 0);
    
    if (totalAllocated === 0) return 'none';
    if (totalAllocated >= totalOrdered) return 'full';
    return 'partial';
  };

  // Check shipping status
  const getShippingStatus = (so) => {
    if (so.status === 'SALES_ORDER_PICKED_AND_COMPLETED' || so.status === 'SALES_ORDER_COMPLETED') {
      return 'shipped';
    }
    if (so.status === 'SALES_ORDER_READY_FOR_PICKING' || so.printed_packing_slip_at) {
      return 'ready';
    }
    return 'not_ready';
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? 
      <ChevronUp className="w-4 h-4 inline ml-1" /> : 
      <ChevronDown className="w-4 h-4 inline ml-1" />;
  };

  // Status Icons Component
  const StatusIcons = ({ so }) => {
    const stockStatus = getStockAllocationStatus(so);
    const shippingStatus = getShippingStatus(so);

    return (
      <div className="flex items-center gap-2">
        <TooltipProvider>
          {/* Stock Allocation Status */}
          {stockStatus === 'none' && (
            <Tooltip>
              <TooltipTrigger>
                <AlertCircle className="w-5 h-5 text-red-600" />
              </TooltipTrigger>
              <TooltipContent>
                <p>NO STOCK ALLOCATED YET</p>
              </TooltipContent>
            </Tooltip>
          )}
          
          <Tooltip>
            <TooltipTrigger>
              <Package className={`w-5 h-5 ${
                stockStatus === 'full' ? 'text-green-600' : 
                stockStatus === 'partial' ? 'text-yellow-600' : 
                'text-gray-400'
              }`} />
            </TooltipTrigger>
            <TooltipContent>
              <p>STOCK ALLOCATION: {
                stockStatus === 'full' ? 'ASSIGNED' : 
                stockStatus === 'partial' ? 'PARTIALLY ASSIGNED' : 
                'NOT ASSIGNED'
              }</p>
            </TooltipContent>
          </Tooltip>

          {/* Shipping Status */}
          <Tooltip>
            <TooltipTrigger>
              <Truck className={`w-5 h-5 ${
                shippingStatus === 'shipped' ? 'text-green-600' : 'text-gray-400'
              }`} />
            </TooltipTrigger>
            <TooltipContent>
              <p>SHIPMENT: {
                shippingStatus === 'shipped' ? 'SHIPPED (Click order for tracking)' : 
                shippingStatus === 'ready' ? 'READY FOR SHIPMENT' : 
                'NOT DISPATCHED'
              }</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    );
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

      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <Link to={createPageUrl("Dashboard")}>
          <Button variant="outline" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-gray-900">Sales Dashboard</h1>
        </div>
        <Link to={createPageUrl("CreateSalesOrder")}>
          <Button className="bg-green-600 hover:bg-green-700 gap-2">
            <Plus className="w-4 h-4" />
            <span className="hidden md:inline">New Sales Order</span>
          </Button>
        </Link>
      </div>

      <p className="text-gray-600 mb-6 ml-12">Track sales orders from quotation to completion</p>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
        <Card className="hover:shadow-lg transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-gray-600" />
              <p className="text-xs text-gray-600">Quotations</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">{metrics.quotations}</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-4 h-4 text-blue-600" />
              <p className="text-xs text-gray-600">Approved</p>
            </div>
            <p className="text-2xl font-bold text-blue-700">{metrics.approved}</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Package className="w-4 h-4 text-yellow-600" />
              <p className="text-xs text-gray-600">Ready to Pick</p>
            </div>
            <p className="text-2xl font-bold text-yellow-700">{metrics.readyForPicking}</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-amber-600" />
              <p className="text-xs text-gray-600">Pending Payment</p>
            </div>
            <p className="text-2xl font-bold text-amber-700">{metrics.pendingPayment}</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              <p className="text-xs text-gray-600">Completed</p>
            </div>
            <p className="text-2xl font-bold text-green-700">{metrics.completed}</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-4 h-4 text-emerald-600" />
              <p className="text-xs text-gray-600">Total Revenue</p>
            </div>
            <p className="text-xl font-bold text-emerald-700">${(metrics.totalRevenue / 1000).toFixed(1)}K</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-orange-600" />
              <p className="text-xs text-gray-600">Outstanding</p>
            </div>
            <p className="text-xl font-bold text-orange-700">${(metrics.totalOutstanding / 1000).toFixed(1)}K</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="grid md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by Order ID, Invoice, Ref, or Customer..."
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-gray-600 flex items-center gap-1">
                <Filter className="w-3 h-3" />
                Status Filter
              </Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="QUOTATION">Quotation</SelectItem>
                  <SelectItem value="APPROVED_QUOTATION">Approved Quotation</SelectItem>
                  <SelectItem value="SALES_ORDER_APPROVED">SO Approved</SelectItem>
                  <SelectItem value="SALES_ORDER_READY_FOR_PICKING">Ready for Picking</SelectItem>
                  <SelectItem value="SALES_ORDER_PICKED_AND_COMPLETED">Picked & Completed</SelectItem>
                  <SelectItem value="SALES_ORDER_TO_BE_EDITED">To Be Edited</SelectItem>
                  <SelectItem value="SALES_ORDER_READY_FOR_INVOICING">Ready for Invoicing</SelectItem>
                  <SelectItem value="SALES_ORDER_PENDING_PAYMENT">Pending Payment</SelectItem>
                  <SelectItem value="SALES_ORDER_COMPLETED">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {(searchQuery || statusFilter !== 'all') && (
            <div className="mt-3 flex items-center justify-between">
              <Badge variant="outline" className="bg-blue-50">
                Showing {filteredAndSortedOrders.length} of {salesOrders.length} orders
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('all');
                }}
              >
                Clear Filters
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sales Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle>Sales Orders Overview</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading sales orders...</p>
            </div>
          ) : filteredAndSortedOrders.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p className="text-gray-600">No sales orders found</p>
              {(searchQuery || statusFilter !== 'all') && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('all');
                  }}
                  className="mt-4"
                >
                  Clear Filters
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b bg-gray-50">
                  <tr className="text-left">
                    <th 
                      className="pb-3 px-4 font-semibold text-gray-700 cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('so_number')}
                    >
                      Order ID <SortIcon field="so_number" />
                    </th>
                    <th className="pb-3 px-4 font-semibold text-gray-700">Invoice</th>
                    <th className="pb-3 px-4 font-semibold text-gray-700">Ref</th>
                    <th className="pb-3 px-4 font-semibold text-gray-700 text-center">Status</th>
                    <th 
                      className="pb-3 px-4 font-semibold text-gray-700 cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('customer_name')}
                    >
                      Customer <SortIcon field="customer_name" />
                    </th>
                    <th 
                      className="pb-3 px-4 font-semibold text-gray-700 text-right cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('total_amount')}
                    >
                      Total <SortIcon field="total_amount" />
                    </th>
                    <th 
                      className="pb-3 px-4 font-semibold text-gray-700 text-right cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('paid_amount')}
                    >
                      Paid <SortIcon field="paid_amount" />
                    </th>
                    <th 
                      className="pb-3 px-4 font-semibold text-gray-700 cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('created_date')}
                    >
                      Date Created <SortIcon field="created_date" />
                    </th>
                    <th className="pb-3 px-4 font-semibold text-gray-700 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAndSortedOrders.map((so) => (
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
                        {so.invoice_number ? (
                          <button
                            onClick={() => navigate(createPageUrl(`ViewInvoice?id=${so.invoice_id}`))}
                            className="text-purple-600 hover:text-purple-800 hover:underline font-mono text-sm"
                          >
                            {so.invoice_number}
                          </button>
                        ) : (
                          <span className="text-gray-400 text-sm">-</span>
                        )}
                      </td>
                      <td className="py-4 px-4">
                        <span className="font-mono text-sm text-gray-700">
                          {so.po_number || so.comments_internal || '-'}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <StatusIcons so={so} />
                      </td>
                      <td className="py-4 px-4">
                        <div>
                          <span className="text-gray-900 font-medium">{so.customer_name}</span>
                          {getCustomerContact(so.customer_id) && (
                            <span className="text-gray-600 text-sm"> | {getCustomerContact(so.customer_id)}</span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <span className="font-semibold text-gray-900">
                          {so.total_amount ? `${so.currency || 'USD'} $${so.total_amount.toLocaleString()}` : '-'}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <span className={`font-semibold ${
                          (so.paid_amount || 0) >= (so.total_amount || 0) 
                            ? 'text-green-600' 
                            : (so.paid_amount || 0) > 0 
                              ? 'text-amber-600' 
                              : 'text-gray-400'
                        }`}>
                          {so.paid_amount ? `$${so.paid_amount.toLocaleString()}` : '$0'}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-gray-600 text-sm">
                        {so.created_date ? format(new Date(so.created_date), 'MMM dd, yyyy') : '-'}
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center justify-center gap-1">
                          {/* EDIT - Only for non-invoiced orders */}
                          {!so.invoice_id && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => navigate(createPageUrl(`ViewSalesOrder?id=${so.id}`))}
                                    className="h-8 w-8"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent><p>Edit Order</p></TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}

                          {/* PRINT */}
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => navigate(createPageUrl(`PrintPackingSlip?id=${so.id}`))}
                                  className="h-8 w-8"
                                >
                                  <Printer className="w-4 h-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent><p>Print SO/Packing Slip/Invoice</p></TooltipContent>
                            </Tooltip>
                          </TooltipProvider>

                          {/* COPY */}
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => navigate(createPageUrl(`CreateSalesOrder?clone=${so.id}`))}
                                  className="h-8 w-8"
                                >
                                  <Copy className="w-4 h-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent><p>Clone Order</p></TooltipContent>
                            </Tooltip>
                          </TooltipProvider>

                          {/* FULFILL - Only for orders ready for invoicing/picking */}
                          {(so.status === 'SALES_ORDER_READY_FOR_PICKING' || 
                            so.status === 'SALES_ORDER_READY_FOR_INVOICING') && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => navigate(createPageUrl(`ViewSalesOrder?id=${so.id}&action=fulfill`))}
                                    className="h-8 w-8 text-green-600 hover:text-green-700"
                                  >
                                    <ArrowRightLeft className="w-4 h-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent><p>Fulfill Order</p></TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
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