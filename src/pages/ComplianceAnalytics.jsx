import React, { useState, useMemo } from "react";
import { recims } from "@/api/recimsClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTenant } from "@/components/TenantContext";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Shield,
  ArrowLeft,
  TrendingUp,
  FileText,
  Download,
  Calendar,
  Filter,
  PieChart as PieChartIcon,
  BarChart3,
  Loader2,
  CheckCircle2
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import { format, subDays, subMonths, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, isWithinInterval } from "date-fns";
import TenantHeader from "@/components/TenantHeader";

const COLORS = ['#388E3C', '#26A69A', '#00695C', '#1C262E', '#CDDC39', '#8b5cf6', '#ec4899', '#f59e0b'];

export default function ComplianceAnalytics() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useTenant();
  const [dateRange, setDateRange] = useState('last_90_days');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [selectedVendor, setSelectedVendor] = useState('all');
  const [reportPeriod, setReportPeriod] = useState('monthly');
  const [generatingReport, setGeneratingReport] = useState(false);

  const { data: certificates = [], isLoading } = useQuery({
    queryKey: ['complianceCertificates', user?.tenant_id],
    queryFn: async () => {
      if (!user?.tenant_id) return [];
      return await recims.entities.ComplianceCertificate.filter(
        { tenant_id: user.tenant_id, status: { $ne: 'void' } },
        '-certificate_date',
        1000
      );
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

  // Get date range
  const getDateRange = () => {
    const end = new Date();
    let start = new Date();

    switch(dateRange) {
      case 'last_30_days':
        start = subDays(end, 30);
        break;
      case 'last_90_days':
        start = subDays(end, 90);
        break;
      case 'last_6_months':
        start = subMonths(end, 6);
        break;
      case 'last_year':
        start = subMonths(end, 12);
        break;
      case 'this_month':
        start = startOfMonth(end);
        break;
      case 'last_month':
        start = startOfMonth(subMonths(end, 1));
        end.setTime(endOfMonth(subMonths(new Date(), 1)).getTime());
        break;
      case 'this_quarter':
        start = startOfQuarter(end);
        break;
      case 'custom':
        if (customStartDate && customEndDate) {
          start = new Date(customStartDate);
          end.setTime(new Date(customEndDate).getTime());
        }
        break;
      default:
        start = subDays(end, 90);
    }

    return { start, end };
  };

  const { start: dateStart, end: dateEnd } = getDateRange();

  // Filter certificates
  const filteredCertificates = useMemo(() => {
    return certificates.filter(cert => {
      const certDate = new Date(cert.certificate_date);
      const dateMatch = isWithinInterval(certDate, { start: dateStart, end: dateEnd });
      const vendorMatch = selectedVendor === 'all' || cert.vendor_id === selectedVendor || cert.vendor_name === selectedVendor;
      return dateMatch && vendorMatch;
    });
  }, [certificates, dateStart, dateEnd, selectedVendor]);

  // Calculate metrics
  const metrics = useMemo(() => {
    const totalCertificates = filteredCertificates.length;
    const totalWeight = filteredCertificates.reduce((sum, cert) => sum + (cert.weight_lbs || 0), 0);
    const avgDiversionRate = filteredCertificates.length > 0
      ? filteredCertificates
          .filter(cert => cert.diversion_rate)
          .reduce((sum, cert) => sum + cert.diversion_rate, 0) / 
          filteredCertificates.filter(cert => cert.diversion_rate).length
      : 0;
    
    const complianceScore = filteredCertificates.length > 0
      ? (filteredCertificates.filter(cert => cert.status === 'issued' || cert.status === 'sent').length / totalCertificates) * 100
      : 0;

    const uniqueVendors = new Set(filteredCertificates.map(cert => cert.vendor_name)).size;

    return {
      totalCertificates,
      totalWeight,
      avgDiversionRate,
      complianceScore,
      uniqueVendors
    };
  }, [filteredCertificates]);

  // Diversion rate trend over time
  const diversionRateTrend = useMemo(() => {
    const grouped = {};
    filteredCertificates.forEach(cert => {
      const monthKey = format(new Date(cert.certificate_date), 'MMM yyyy');
      if (!grouped[monthKey]) {
        grouped[monthKey] = { rates: [], count: 0 };
      }
      if (cert.diversion_rate) {
        grouped[monthKey].rates.push(cert.diversion_rate);
        grouped[monthKey].count++;
      }
    });

    return Object.entries(grouped)
      .map(([month, data]) => ({
        month,
        avgRate: data.rates.length > 0 ? data.rates.reduce((a, b) => a + b, 0) / data.rates.length : 0,
        certificates: data.count
      }))
      .sort((a, b) => new Date(a.month) - new Date(b.month));
  }, [filteredCertificates]);

  // Destruction methods breakdown
  const destructionMethodsData = useMemo(() => {
    const methods = {};
    filteredCertificates.forEach(cert => {
      const method = cert.destruction_method || 'other';
      methods[method] = (methods[method] || 0) + 1;
    });

    return Object.entries(methods).map(([name, value]) => ({
      name: name.replace('_', ' ').charAt(0).toUpperCase() + name.slice(1).replace('_', ' '),
      value
    }));
  }, [filteredCertificates]);

  // Weight processed over time
  const weightTrend = useMemo(() => {
    const grouped = {};
    filteredCertificates.forEach(cert => {
      const monthKey = format(new Date(cert.certificate_date), 'MMM yyyy');
      if (!grouped[monthKey]) {
        grouped[monthKey] = 0;
      }
      grouped[monthKey] += (cert.weight_lbs || 0);
    });

    return Object.entries(grouped)
      .map(([month, weight]) => ({
        month,
        weight: parseFloat(weight.toFixed(0))
      }))
      .sort((a, b) => new Date(a.month) - new Date(b.month));
  }, [filteredCertificates]);

  // Top vendors by certificates
  const topVendorsData = useMemo(() => {
    const vendors = {};
    filteredCertificates.forEach(cert => {
      const vendor = cert.vendor_name;
      if (!vendors[vendor]) {
        vendors[vendor] = { count: 0, weight: 0 };
      }
      vendors[vendor].count++;
      vendors[vendor].weight += (cert.weight_lbs || 0);
    });

    return Object.entries(vendors)
      .map(([name, data]) => ({
        name: name.length > 20 ? name.substring(0, 20) + '...' : name,
        certificates: data.count,
        weight: parseFloat(data.weight.toFixed(0))
      }))
      .sort((a, b) => b.certificates - a.certificates)
      .slice(0, 10);
  }, [filteredCertificates]);

  // Compliance score trend
  const complianceScoreTrend = useMemo(() => {
    const grouped = {};
    filteredCertificates.forEach(cert => {
      const monthKey = format(new Date(cert.certificate_date), 'MMM yyyy');
      if (!grouped[monthKey]) {
        grouped[monthKey] = { total: 0, compliant: 0 };
      }
      grouped[monthKey].total++;
      if (cert.status === 'issued' || cert.status === 'sent') {
        grouped[monthKey].compliant++;
      }
    });

    return Object.entries(grouped)
      .map(([month, data]) => ({
        month,
        score: (data.compliant / data.total * 100).toFixed(1)
      }))
      .sort((a, b) => new Date(a.month) - new Date(b.month));
  }, [filteredCertificates]);

  // Generate compliance report
  const generateComplianceReport = async () => {
    setGeneratingReport(true);

    try {
      const reportData = {
        report_period: reportPeriod,
        date_range: {
          start: format(dateStart, 'yyyy-MM-dd'),
          end: format(dateEnd, 'yyyy-MM-dd')
        },
        vendor_filter: selectedVendor,
        metrics: {
          total_certificates: metrics.totalCertificates,
          total_weight_lbs: metrics.totalWeight,
          avg_diversion_rate: metrics.avgDiversionRate.toFixed(2),
          compliance_score: metrics.complianceScore.toFixed(2),
          unique_vendors: metrics.uniqueVendors
        },
        trends: {
          diversion_rate_trend: diversionRateTrend,
          weight_trend: weightTrend,
          compliance_score_trend: complianceScoreTrend
        },
        destruction_methods: destructionMethodsData,
        top_vendors: topVendorsData,
        certificates: filteredCertificates.map(cert => ({
          certificate_number: cert.certificate_number,
          vendor_name: cert.vendor_name,
          certificate_date: cert.certificate_date,
          material_type: cert.material_type,
          weight_lbs: cert.weight_lbs,
          diversion_rate: cert.diversion_rate,
          status: cert.status
        }))
      };

      // Generate report number
      const reportNumber = `COMP-${format(new Date(), 'yyyyMMdd-HHmmss')}`;
      
      // Save to ReportHistory
      await recims.entities.ReportHistory.create({
        report_id: reportNumber,
        tenant_id: user.tenant_id,
        report_name: `Compliance Summary - ${format(dateStart, 'MMM dd')} to ${format(dateEnd, 'MMM dd, yyyy')}`,
        report_type: 'compliance',
        generated_by: user.email,
        generated_by_name: user.full_name,
        generated_date: new Date().toISOString(),
        status: 'completed',
        date_range_start: format(dateStart, 'yyyy-MM-dd'),
        date_range_end: format(dateEnd, 'yyyy-MM-dd'),
        filters_applied: {
          vendor: selectedVendor,
          period: reportPeriod
        },
        summary_data: reportData.metrics,
        file_format: 'json'
      });

      queryClient.invalidateQueries({ queryKey: ['reportHistory'] });

      // Download JSON
      const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `compliance-report-${reportNumber}.json`;
      a.click();

    } catch (error) {
      console.error('Error generating report:', error);
    } finally {
      setGeneratingReport(false);
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <TenantHeader />
      
      <div className="flex items-center gap-3 mb-6">
        <Link to={createPageUrl("ComplianceCertificates")}>
          <Button variant="outline" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 className="w-7 h-7 text-purple-600" />
            Compliance Analytics
          </h1>
          <p className="text-sm text-gray-600">Analyze compliance trends and generate reports</p>
        </div>
        <Button
          onClick={generateComplianceReport}
          disabled={generatingReport}
          className="bg-purple-600 hover:bg-purple-700 gap-2"
        >
          {generatingReport ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              Generate Report
            </>
          )}
        </Button>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filters & Settings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">Date Range</label>
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="last_30_days">Last 30 Days</SelectItem>
                  <SelectItem value="last_90_days">Last 90 Days</SelectItem>
                  <SelectItem value="last_6_months">Last 6 Months</SelectItem>
                  <SelectItem value="last_year">Last Year</SelectItem>
                  <SelectItem value="this_month">This Month</SelectItem>
                  <SelectItem value="last_month">Last Month</SelectItem>
                  <SelectItem value="this_quarter">This Quarter</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {dateRange === 'custom' && (
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

            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">Vendor</label>
              <Select value={selectedVendor} onValueChange={setSelectedVendor}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Vendors</SelectItem>
                  {vendors.map((vendor) => (
                    <SelectItem key={vendor.id} value={vendor.id}>
                      {vendor.display_name || vendor.company_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">Report Period</label>
              <Select value={reportPeriod} onValueChange={setReportPeriod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="annual">Annual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2 text-sm text-gray-600">
            <Calendar className="w-4 h-4" />
            <span>
              Showing data from {format(dateStart, 'MMM dd, yyyy')} to {format(dateEnd, 'MMM dd, yyyy')}
            </span>
            <Badge variant="outline" className="ml-2">
              {filteredCertificates.length} certificates
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{metrics.totalCertificates}</p>
            <p className="text-xs text-gray-600">Total Certificates</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{(metrics.totalWeight / 1000).toFixed(1)}K</p>
            <p className="text-xs text-gray-600">lbs Processed</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-5 h-5 text-purple-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{metrics.avgDiversionRate.toFixed(1)}%</p>
            <p className="text-xs text-gray-600">Avg Diversion Rate</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{metrics.complianceScore.toFixed(1)}%</p>
            <p className="text-xs text-gray-600">Compliance Score</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <PieChartIcon className="w-5 h-5 text-orange-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{metrics.uniqueVendors}</p>
            <p className="text-xs text-gray-600">Unique Vendors</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        {/* Diversion Rate Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Diversion Rate Trend</CardTitle>
            <p className="text-sm text-gray-600">Average waste diversion rate over time</p>
          </CardHeader>
          <CardContent>
            {diversionRateTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={diversionRateTrend}>
                  <defs>
                    <linearGradient id="diversionGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#388E3C" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#388E3C" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="month" style={{ fontSize: '11px' }} />
                  <YAxis domain={[0, 100]} style={{ fontSize: '11px' }} />
                  <Tooltip />
                  <Area 
                    type="monotone" 
                    dataKey="avgRate" 
                    stroke="#388E3C" 
                    fill="url(#diversionGradient)"
                    name="Avg Diversion Rate (%)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-gray-500">
                No data available for selected period
              </div>
            )}
          </CardContent>
        </Card>

        {/* Compliance Score Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Compliance Score Trend</CardTitle>
            <p className="text-sm text-gray-600">Certificate issuance compliance over time</p>
          </CardHeader>
          <CardContent>
            {complianceScoreTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={complianceScoreTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="month" style={{ fontSize: '11px' }} />
                  <YAxis domain={[0, 100]} style={{ fontSize: '11px' }} />
                  <Tooltip />
                  <Line 
                    type="monotone" 
                    dataKey="score" 
                    stroke="#8b5cf6" 
                    strokeWidth={3}
                    dot={{ fill: '#8b5cf6', r: 4 }}
                    name="Compliance Score (%)"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-gray-500">
                No data available for selected period
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        {/* Destruction Methods */}
        <Card>
          <CardHeader>
            <CardTitle>Destruction Methods</CardTitle>
            <p className="text-sm text-gray-600">Breakdown by processing method</p>
          </CardHeader>
          <CardContent>
            {destructionMethodsData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={destructionMethodsData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {destructionMethodsData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-gray-500">
                No data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Weight Processed Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Material Weight Processed</CardTitle>
            <p className="text-sm text-gray-600">Total weight processed over time (lbs)</p>
          </CardHeader>
          <CardContent>
            {weightTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={weightTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="month" style={{ fontSize: '11px' }} />
                  <YAxis style={{ fontSize: '11px' }} />
                  <Tooltip />
                  <Bar dataKey="weight" fill="#26A69A" name="Weight (lbs)" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-gray-500">
                No data available for selected period
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Vendors */}
      <Card>
        <CardHeader>
          <CardTitle>Top Vendors by Certificate Count</CardTitle>
          <p className="text-sm text-gray-600">Leading vendors by number of certificates issued</p>
        </CardHeader>
        <CardContent>
          {topVendorsData.length > 0 ? (
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={topVendorsData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" style={{ fontSize: '11px' }} />
                <YAxis dataKey="name" type="category" width={150} style={{ fontSize: '11px' }} />
                <Tooltip />
                <Bar dataKey="certificates" fill="#00695C" name="Certificates" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[400px] flex items-center justify-center text-gray-500">
              No vendor data available
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}