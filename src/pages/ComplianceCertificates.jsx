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
  Shield,
  ArrowLeft,
  Plus,
  FileText,
  TrendingUp,
  CheckCircle2,
  Search,
  Eye,
  Mail,
  Pencil,
  Printer,
  BarChart3 // Added BarChart3 import
} from "lucide-react";
import { format, startOfYear } from "date-fns";
import TenantHeader from "@/components/TenantHeader";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function ComplianceCertificates() {
  const navigate = useNavigate();
  const { user } = useTenant();
  const [searchQuery, setSearchQuery] = useState('');

  const { data: certificates = [], isLoading } = useQuery({
    queryKey: ['complianceCertificates', user?.tenant_id],
    queryFn: async () => {
      if (!user?.tenant_id) return [];
      return await recims.entities.ComplianceCertificate.filter(
        { tenant_id: user.tenant_id },
        '-certificate_date',
        500
      );
    },
    enabled: !!user?.tenant_id,
    initialData: [],
  });

  // Calculate metrics
  const thisYearStart = startOfYear(new Date());
  const thisYearCertificates = certificates.filter(cert => {
    const certDate = new Date(cert.certificate_date);
    return certDate >= thisYearStart && cert.status !== 'void';
  });

  const totalMaterialsProcessed = certificates
    .filter(cert => cert.status !== 'void')
    .reduce((sum, cert) => sum + (cert.weight_lbs || 0), 0);

  const avgDiversionRate = certificates.length > 0
    ? certificates
        .filter(cert => cert.diversion_rate && cert.status !== 'void')
        .reduce((sum, cert) => sum + cert.diversion_rate, 0) / 
        certificates.filter(cert => cert.diversion_rate && cert.status !== 'void').length
    : 0;

  const complianceScore = certificates.length > 0
    ? (certificates.filter(cert => cert.status === 'issued' || cert.status === 'sent').length / 
       certificates.filter(cert => cert.status !== 'void').length) * 100
    : 0;

  const filteredCertificates = certificates.filter(cert => {
    const matchesSearch = 
      cert.certificate_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cert.vendor_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cert.material_type?.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesSearch;
  });

  const getStatusColor = (status) => {
    switch(status) {
      case 'draft': return 'bg-gray-100 text-gray-700';
      case 'issued': return 'bg-green-100 text-green-700';
      case 'sent': return 'bg-blue-100 text-blue-700';
      case 'void': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
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
      
      <div className="flex items-center gap-3 mb-2">
        <Link to={createPageUrl("Dashboard")}>
          <Button variant="outline" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="w-7 h-7 text-blue-600" />
            Compliance & Certificates
          </h1>
          <p className="text-sm text-gray-600">Manage destruction certificates and compliance documents</p>
        </div>
        <Badge className="bg-purple-600 text-white">PHASE III</Badge>
        <Link to={createPageUrl("ComplianceAnalytics")}>
          <Button variant="outline" className="gap-2">
            <BarChart3 className="w-4 h-4" />
            <span className="hidden md:inline">Analytics</span>
          </Button>
        </Link>
        <Link to={createPageUrl("CreateCertificate")}>
          <Button className="bg-blue-600 hover:bg-blue-700 gap-2">
            <Plus className="w-4 h-4" />
            New Certificate
          </Button>
        </Link>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 mt-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-2">
              <div className="p-2 rounded-lg bg-blue-100">
                <FileText className="w-5 h-5 text-blue-600" />
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-1">Total Certificates</p>
            <p className="text-3xl font-bold text-gray-900 mb-1">
              {thisYearCertificates.length}
            </p>
            <p className="text-xs text-gray-500">This year</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-2">
              <div className="p-2 rounded-lg bg-green-100">
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-1">Materials Processed</p>
            <p className="text-3xl font-bold text-gray-900 mb-1">
              {totalMaterialsProcessed.toLocaleString()}
            </p>
            <p className="text-xs text-gray-500">Total weight (lbs)</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-2">
              <div className="p-2 rounded-lg bg-purple-100">
                <TrendingUp className="w-5 h-5 text-purple-600" />
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-1">Avg Diversion Rate</p>
            <p className="text-3xl font-bold text-gray-900 mb-1">
              {avgDiversionRate.toFixed(1)}%
            </p>
            <p className="text-xs text-gray-500">Across all customers</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-2">
              <div className="p-2 rounded-lg bg-green-100">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-1">Compliance Score</p>
            <p className="text-3xl font-bold text-gray-900 mb-1">
              {complianceScore.toFixed(1)}%
            </p>
            <p className="text-xs text-gray-500">Documentation complete</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search certificates..."
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Certificates Table */}
      <Card>
        <CardHeader>
          <CardTitle>Destruction Certificates</CardTitle>
          <p className="text-sm text-gray-600">View and manage all destruction certificates</p>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            </div>
          ) : filteredCertificates.length === 0 ? (
            <div className="text-center py-12">
              <Shield className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p className="text-gray-600 mb-4">No certificates found</p>
              <Link to={createPageUrl("CreateCertificate")}>
                <Button className="bg-blue-600 hover:bg-blue-700 gap-2">
                  <Plus className="w-4 h-4" />
                  Create First Certificate
                </Button>
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b bg-gray-50">
                  <tr>
                    <th className="pb-3 px-4 text-left font-semibold text-gray-700">Certificate Number</th>
                    <th className="pb-3 px-4 text-left font-semibold text-gray-700">Customer</th>
                    <th className="pb-3 px-4 text-left font-semibold text-gray-700">Date</th>
                    <th className="pb-3 px-4 text-left font-semibold text-gray-700">Material Type</th>
                    <th className="pb-3 px-4 text-right font-semibold text-gray-700">Weight (lbs)</th>
                    <th className="pb-3 px-4 text-left font-semibold text-gray-700">Status</th>
                    <th className="pb-3 px-4 text-center font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCertificates.map((cert) => (
                    <tr key={cert.id} className="border-b hover:bg-gray-50 transition-colors">
                      <td className="py-4 px-4">
                        <button
                          onClick={() => navigate(createPageUrl(`ViewCertificate?id=${cert.id}`))}
                          className="text-blue-600 hover:text-blue-800 font-semibold hover:underline"
                        >
                          {cert.certificate_number}
                        </button>
                      </td>
                      <td className="py-4 px-4">
                        <span className="font-medium text-gray-900">{cert.vendor_name}</span>
                      </td>
                      <td className="py-4 px-4 text-gray-600">
                        {cert.certificate_date ? format(new Date(cert.certificate_date), 'MMM dd, yyyy') : '-'}
                      </td>
                      <td className="py-4 px-4 text-gray-600">
                        {cert.material_type}
                      </td>
                      <td className="py-4 px-4 text-right font-semibold text-gray-900">
                        {cert.weight_lbs?.toLocaleString() || 0}
                      </td>
                      <td className="py-4 px-4">
                        <Badge className={getStatusColor(cert.status)}>
                          {cert.status.replace('_', ' ').toUpperCase()}
                        </Badge>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <Eye className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => navigate(createPageUrl(`ViewCertificate?id=${cert.id}`))}>
                              <Eye className="w-4 h-4 mr-2" />
                              View Certificate
                            </DropdownMenuItem>
                            {cert.status === 'draft' && (
                              <DropdownMenuItem onClick={() => navigate(createPageUrl(`EditCertificate?id=${cert.id}`))}>
                                <Pencil className="w-4 h-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => navigate(createPageUrl(`ViewCertificate?id=${cert.id}&print=true`))}>
                              <Printer className="w-4 h-4 mr-2" />
                              Print PDF
                            </DropdownMenuItem>
                            {(cert.status === 'issued' || cert.status === 'draft') && (
                              <DropdownMenuItem onClick={() => navigate(createPageUrl(`SendCertificate?id=${cert.id}`))}>
                                <Mail className="w-4 h-4 mr-2" />
                                Send via Email
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