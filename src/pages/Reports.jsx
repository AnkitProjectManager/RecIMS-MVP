import React, { useState } from "react";
import { recims } from "@/api/recimsClient";
import { useQuery } from "@tanstack/react-query";
import { useTenant } from "@/components/TenantContext";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  BarChart3, 
  ArrowLeft, 
  FileText, 
  Package, 
  DollarSign, 
  Users, 
  Shield, 
  TrendingUp,
  Download,
  Eye,
  Calendar,
  Lock,
  Globe,
  Tags,
  MessageCircle
} from "lucide-react";
import { format, startOfYear, startOfMonth, subMonths, endOfMonth } from "date-fns";
import TenantHeader from "@/components/TenantHeader";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function Reports() {
  const navigate = useNavigate();
  const { user } = useTenant();
  const [dateFilter, setDateFilter] = useState('ytd');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);

  const { data: reportHistory = [], isLoading } = useQuery({
    queryKey: ['reportHistory', user?.tenant_id],
    queryFn: async () => {
      if (!user?.tenant_id) return [];
      return await recims.entities.ReportHistory.filter(
        { tenant_id: user.tenant_id },
        '-generated_date',
        50
      );
    },
    enabled: !!user?.tenant_id,
    initialData: [],
  });

  const { data: settings = [] } = useQuery({
    queryKey: ['appSettings'],
    queryFn: () => recims.entities.AppSettings.list(),
    initialData: [],
  });

  const { data: salesOrders = [] } = useQuery({
    queryKey: ['salesOrders', user?.tenant_id],
    queryFn: async () => {
      if (!user?.tenant_id) return [];
      return await recims.entities.SalesOrder.filter({
        tenant_id: user.tenant_id
      }, '-order_date', 500);
    },
    enabled: !!user?.tenant_id,
    initialData: [],
  });

  const { data: salesOrderLines = [] } = useQuery({
    queryKey: ['salesOrderLines', user?.tenant_id],
    queryFn: async () => {
      if (!user?.tenant_id) return [];
      return await recims.entities.SalesOrderLine.list('-created_date', 1000);
    },
    enabled: !!user?.tenant_id,
    initialData: [],
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers', user?.tenant_id],
    queryFn: async () => {
      if (!user?.tenant_id) return [];
      return await recims.entities.Customer.filter({
        tenant_id: user.tenant_id
      });
    },
    enabled: !!user?.tenant_id,
    initialData: [],
  });

  const kpiEnabled = settings.find(s => s.setting_key === 'enable_kpi_dashboard')?.setting_value === 'true';

  // Calculate date range based on filter
  const getDateRange = () => {
    const now = new Date();
    let startDate, endDate = now;

    switch(dateFilter) {
      case 'this_month':
        startDate = startOfMonth(now);
        endDate = endOfMonth(now);
        break;
      case 'ytd':
        startDate = startOfYear(now);
        break;
      case 'mtd':
        startDate = startOfMonth(now);
        break;
      case 'last_6_months':
        startDate = subMonths(now, 6);
        break;
      case 'custom':
        startDate = customStartDate ? new Date(customStartDate) : startOfYear(now);
        endDate = customEndDate ? new Date(customEndDate) : now;
        break;
      default:
        startDate = startOfYear(now);
    }

    return { startDate, endDate };
  };

  const { startDate, endDate } = getDateRange();

  // Filter sales orders by date range
  const filteredSalesOrders = salesOrders.filter(so => {
    const orderDate = new Date(so.order_date);
    return orderDate >= startDate && orderDate <= endDate;
  });

  // Calculate sales by category
  const salesByCategory = salesOrderLines
    .filter(line => {
      const order = salesOrders.find(so => so.id === line.sales_order_id);
      if (!order) return false;
      const orderDate = new Date(order.order_date);
      return orderDate >= startDate && orderDate <= endDate;
    })
    .reduce((acc, line) => {
      const category = line.category || 'Uncategorized';
      if (!acc[category]) {
        acc[category] = 0;
      }
      acc[category] += line.total_amount || 0;
      return acc;
    }, {});

  const categoryData = Object.entries(salesByCategory).map(([category, total]) => ({
    name: category,
    value: total
  })).sort((a, b) => b.value - a.value);

  // Calculate sales by sub-category for selected category
  const salesBySubCategory = selectedCategory 
    ? salesOrderLines
        .filter(line => {
          const order = salesOrders.find(so => so.id === line.sales_order_id);
          if (!order) return false;
          const orderDate = new Date(order.order_date);
          return orderDate >= startDate && orderDate <= endDate && line.category === selectedCategory;
        })
        .reduce((acc, line) => {
          const subCategory = line.sub_category || 'Uncategorized';
          if (!acc[subCategory]) {
            acc[subCategory] = 0;
          }
          acc[subCategory] += line.total_amount || 0;
          return acc;
        }, {})
    : {};

  const subCategoryData = Object.entries(salesBySubCategory).map(([subCategory, total]) => ({
    name: subCategory,
    value: total
  })).sort((a, b) => b.value - a.value);

  // Calculate sales by country
  const salesByCountry = filteredSalesOrders.reduce((acc, order) => {
    const customer = customers.find(c => c.id === order.customer_id);
    const country = customer?.country || 'Unknown';
    if (!acc[country]) {
      acc[country] = 0;
    }
    acc[country] += order.total_amount || 0;
    return acc;
  }, {});

  const countryData = Object.entries(salesByCountry).map(([country, total]) => ({
    name: country,
    value: total
  })).sort((a, b) => b.value - a.value);

  // Calculate sales by customer (top 10)
  const salesByCustomer = filteredSalesOrders.reduce((acc, order) => {
    const customerName = order.customer_name || 'Unknown';
    if (!acc[customerName]) {
      acc[customerName] = 0;
    }
    acc[customerName] += order.total_amount || 0;
    return acc;
  }, {});

  const customerData = Object.entries(salesByCustomer).map(([customer, total]) => ({
    name: customer,
    value: total
  })).sort((a, b) => b.value - a.value).slice(0, 10);

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#84cc16'];

  const reportTypes = [
    {
      type: 'sales',
      title: 'Sales Report',
      description: 'Comprehensive sales analysis and trends',
      icon: TrendingUp,
      color: 'bg-green-100 text-green-600',
      route: 'AdvancedAnalytics',
      phase: null
    },
    {
      type: 'inventory',
      title: 'Inventory Report',
      description: 'Current stock levels and movements',
      icon: Package,
      color: 'bg-blue-100 text-blue-600',
      route: 'InventoryManagement',
      phase: null
    },
    {
      type: 'financial',
      title: 'Financial Report',
      description: 'Revenue, expenses, and profitability',
      icon: DollarSign,
      color: 'bg-purple-100 text-purple-600',
      route: 'AdvancedAnalytics',
      phase: null
    },
    {
      type: 'customer',
      title: 'Customer Report',
      description: 'Customer activity and engagement',
      icon: Users,
      color: 'bg-orange-100 text-orange-600',
      route: 'CustomerManagement',
      phase: null
    },
    {
      type: 'compliance',
      title: 'Compliance Report',
      description: 'Certificates and waste diversion metrics',
      icon: Shield,
      color: 'bg-indigo-100 text-indigo-600',
      route: 'ComplianceCertificates',
      phase: null
    },
    {
      type: 'performance',
      title: 'Performance Report',
      description: 'KPIs and operational metrics',
      icon: BarChart3,
      color: 'bg-pink-100 text-pink-600',
      route: 'AdvancedAnalytics',
      phase: 'PHASE V',
      requiresKpi: true
    }
  ];

  const getStatusColor = (status) => {
    switch(status) {
      case 'completed': return 'bg-green-100 text-green-700';
      case 'processing': return 'bg-blue-100 text-blue-700';
      case 'pending': return 'bg-yellow-100 text-yellow-700';
      case 'failed': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const handleViewReport = (report) => {
    switch(report.report_type) {
      case 'sales':
      case 'financial':
      case 'performance':
        navigate(createPageUrl('AdvancedAnalytics'));
        break;
      case 'inventory':
        navigate(createPageUrl('InventoryManagement'));
        break;
      case 'customer':
        navigate(createPageUrl('CustomerManagement'));
        break;
      case 'compliance':
        navigate(createPageUrl('ComplianceCertificates'));
        break;
      default:
        navigate(createPageUrl('AdvancedAnalytics'));
    }
  };

  const handleDownloadReport = (report) => {
    if (report.file_url) {
      window.open(report.file_url, '_blank');
    } else {
      console.log('Generating report:', report.report_type);
    }
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
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <FileText className="w-7 h-7 text-blue-600" />
              Reports & Analytics
            </h1>
            <p className="text-sm text-gray-600">Generate and manage business reports</p>
          </div>
          <a href={recims.agents.getWhatsAppConnectURL('reports_assistant')} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" className="gap-2">
              <MessageCircle className="w-4 h-4 text-green-600" />
              AI Reports via WhatsApp
            </Button>
          </a>
        </div>
      </div>

      {/* Date Filter */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="grid md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">Date Range</label>
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="this_month">This Month</SelectItem>
                  <SelectItem value="mtd">Month to Date (MTD)</SelectItem>
                  <SelectItem value="last_6_months">Last 6 Months</SelectItem>
                  <SelectItem value="ytd">Year to Date (YTD)</SelectItem>
                  <SelectItem value="custom">Custom Date Range</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {dateFilter === 'custom' && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700">Start Date</label>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700">End Date</label>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md"
                  />
                </div>
              </>
            )}

            <div className="flex items-end">
              <Badge variant="outline" className="text-sm">
                {format(startDate, 'MMM dd, yyyy')} - {format(endDate, 'MMM dd, yyyy')}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sales Overview Charts */}
      <div className="grid md:grid-cols-3 gap-6 mb-8">
        {/* Sales by Category */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Tags className="w-5 h-5 text-green-600" />
              Sales by Category
              {selectedCategory && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedCategory(null)}
                  className="ml-auto text-xs"
                >
                  ← Back
                </Button>
              )}
            </CardTitle>
            {selectedCategory && (
              <p className="text-xs text-gray-600 mt-1">Viewing sub-categories for: {selectedCategory}</p>
            )}
          </CardHeader>
          <CardContent>
            {!selectedCategory && categoryData.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No sales data</p>
              </div>
            ) : selectedCategory && subCategoryData.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No sub-category data</p>
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={selectedCategory ? subCategoryData : categoryData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      onClick={(data) => {
                        if (!selectedCategory) {
                          setSelectedCategory(data.name);
                        }
                      }}
                      style={{ cursor: selectedCategory ? 'default' : 'pointer' }}
                    >
                      {(selectedCategory ? subCategoryData : categoryData).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `$${value.toFixed(2)}`} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-4 space-y-2">
                  {(selectedCategory ? subCategoryData : categoryData).map((cat, idx) => (
                    <div 
                      key={idx} 
                      className={`flex items-center justify-between text-sm p-2 rounded ${!selectedCategory ? 'hover:bg-gray-100 cursor-pointer' : ''}`}
                      onClick={() => !selectedCategory && setSelectedCategory(cat.name)}
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                        <span className="text-gray-700">{cat.name}</span>
                      </div>
                      <span className="font-semibold">${cat.value.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Sales by Country */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Globe className="w-5 h-5 text-blue-600" />
              Sales by Country
            </CardTitle>
          </CardHeader>
          <CardContent>
            {countryData.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Globe className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No sales data</p>
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={countryData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {countryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `$${value.toFixed(2)}`} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-4 space-y-2">
                  {countryData.map((country, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                        <span className="text-gray-700">{country.name}</span>
                      </div>
                      <span className="font-semibold">${country.value.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Sales by Customer */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="w-5 h-5 text-purple-600" />
              Top 10 Customers
            </CardTitle>
          </CardHeader>
          <CardContent>
            {customerData.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No sales data</p>
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={customerData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tick={{ fontSize: 10 }} />
                    <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(value) => `$${value.toFixed(2)}`} />
                    <Bar dataKey="value" fill="#8b5cf6" />
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-4 space-y-2">
                  {customerData.map((customer, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-purple-600 text-white text-xs">{idx + 1}</Badge>
                        <span className="text-sm text-gray-900 font-medium">{customer.name}</span>
                      </div>
                      <span className="font-semibold text-gray-900">${customer.value.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Report Type Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {reportTypes.map((reportType) => {
          const Icon = reportType.icon;
          const isLocked = reportType.requiresKpi && !kpiEnabled;
          
          return (
            <Card 
              key={reportType.type} 
              className={`transition-shadow ${isLocked ? 'opacity-60' : 'hover:shadow-lg cursor-pointer'}`}
            >
              <CardContent className="p-6">
                <div className="flex items-start gap-4 mb-4">
                  <div className={`p-3 rounded-lg ${reportType.color} relative`}>
                    <Icon className="w-6 h-6" />
                    {isLocked && (
                      <Lock className="w-3 h-3 absolute -top-1 -right-1 text-gray-600" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-lg">{reportType.title}</h3>
                      {reportType.phase && (
                        <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700">
                          {reportType.phase}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">{reportType.description}</p>
                  </div>
                </div>
                {isLocked ? (
                  <div>
                    <Alert className="bg-yellow-50 border-yellow-200 mb-3">
                      <AlertDescription className="text-yellow-800 text-xs">
                        <strong>PHASE V Feature:</strong> Enable KPI Dashboard in Super Admin to unlock.
                      </AlertDescription>
                    </Alert>
                    <Button 
                      className="w-full bg-gray-400 cursor-not-allowed"
                      disabled
                    >
                      <Lock className="w-4 h-4 mr-2" />
                      Locked
                    </Button>
                  </div>
                ) : (
                  <Button 
                    className="w-full bg-blue-600 hover:bg-blue-700"
                    onClick={() => navigate(createPageUrl(reportType.route))}
                  >
                    Generate Report
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Recent Reports */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Recent Reports
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            </div>
          ) : reportHistory.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="mb-4">No reports generated yet</p>
              <p className="text-sm">Generate your first report using the cards above</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b bg-gray-50">
                  <tr>
                    <th className="pb-3 px-4 text-left font-semibold text-gray-700">Report ID</th>
                    <th className="pb-3 px-4 text-left font-semibold text-gray-700">Name</th>
                    <th className="pb-3 px-4 text-left font-semibold text-gray-700">Type</th>
                    <th className="pb-3 px-4 text-left font-semibold text-gray-700">Generated By</th>
                    <th className="pb-3 px-4 text-left font-semibold text-gray-700">Date</th>
                    <th className="pb-3 px-4 text-left font-semibold text-gray-700">Status</th>
                    <th className="pb-3 px-4 text-center font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {reportHistory.map((report) => (
                    <tr key={report.id} className="border-b hover:bg-gray-50 transition-colors">
                      <td className="py-4 px-4">
                        <span className="font-mono text-sm font-semibold text-blue-600">
                          {report.report_id}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <span className="font-medium text-gray-900">{report.report_name}</span>
                      </td>
                      <td className="py-4 px-4">
                        <Badge variant="outline" className="capitalize">
                          {report.report_type}
                        </Badge>
                      </td>
                      <td className="py-4 px-4 text-gray-600">
                        {report.generated_by_name || report.generated_by}
                      </td>
                      <td className="py-4 px-4 text-gray-600">
                        {format(new Date(report.generated_date), 'MMM dd, yyyy')}
                      </td>
                      <td className="py-4 px-4">
                        <Badge className={getStatusColor(report.status)}>
                          {report.status.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleViewReport(report)}
                            title="View Report"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          {report.status === 'completed' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDownloadReport(report)}
                              title="Download Report"
                            >
                              <Download className="w-4 h-4" />
                            </Button>
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