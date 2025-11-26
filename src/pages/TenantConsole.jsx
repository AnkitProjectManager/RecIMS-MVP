import React, { useState } from "react";
import { recims } from "@/api/recimsClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Building2,
  Search,
  Plus,
  Eye,
  Edit,
  Users,
  Globe,
  DollarSign,
  Shield,
  ArrowLeft,
  CheckCircle,
  XCircle,
  AlertCircle,
  Trash2
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { format } from "date-fns";

export default function TenantConsole() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [user, setUser] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  React.useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await recims.auth.me();
        setUser(currentUser);
      } catch (error) {
        console.error("Failed to load user:", error);
      }
    };
    loadUser();
  }, []);

  const { data: tenants = [], isLoading } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => recims.entities.Tenant.list('-created_date', 1000),
    initialData: [],
  });

  const deleteTenantMutation = useMutation({
    mutationFn: async (tenantId) => {
      return await recims.entities.Tenant.delete(tenantId);
    },
    onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ['tenants'] });
  queryClient.removeQueries({ queryKey: ['tenant'], exact: false });
      setSuccess("Tenant deleted successfully");
      setTimeout(() => setSuccess(null), 3000);
    },
    onError: (err) => {
      setError(err.message || "Failed to delete tenant");
      setTimeout(() => setError(null), 3000);
    }
  });

  const handleDeleteTenant = (tenant) => {
    const name = tenant.name || tenant.display_name || tenant.company_name;
    const confirmMessage = `⚠️ WARNING: Are you sure you want to DELETE "${name}"?\n\nThis will permanently delete:\n• All tenant data\n• All users\n• All shipments\n• All inventory\n• All settings\n\nThis action CANNOT be undone!\n\nType "DELETE" to confirm:`;
    
    const confirmation = window.prompt(confirmMessage);
    
    if (confirmation === "DELETE") {
      deleteTenantMutation.mutate(tenant.id);
    } else if (confirmation !== null) {
      setError('Deletion cancelled. You must type "DELETE" to confirm.');
      setTimeout(() => setError(null), 3000);
    }
  };

  // Filter tenants - support both old and new schema
  const filteredTenants = tenants.filter(tenant => {
    const name = tenant.name || tenant.display_name || tenant.company_name;
    const code = tenant.code || tenant.tenant_code;
    const subdomain = tenant.base_subdomain || tenant.tenant_code?.toLowerCase();
    const status = tenant.status || (tenant.is_active ? 'ACTIVE' : 'SUSPENDED');
    
    const matchesSearch = 
      name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      subdomain?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (tenant) => {
    const status = tenant.status || (tenant.is_active ? 'ACTIVE' : 'SUSPENDED');
    switch(status) {
      case 'ACTIVE':
        return <Badge className="bg-green-100 text-green-700"><CheckCircle className="w-3 h-3 mr-1" />Active</Badge>;
      case 'SUSPENDED':
        return <Badge className="bg-red-100 text-red-700"><XCircle className="w-3 h-3 mr-1" />Suspended</Badge>;
      case 'DELETED':
        return <Badge className="bg-gray-100 text-gray-700">Deleted</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const normalizedRole = (user?.role || user?.detailed_role || '').toLowerCase();
  const hasAccess = ['admin', 'super_admin', 'superadmin'].includes(normalizedRole);

  if (user && !hasAccess) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Access denied. Only Administrator or Super Administrator users can access the Tenant Console.
          </AlertDescription>
        </Alert>
        <Button onClick={() => navigate(createPageUrl("Dashboard"))} className="mt-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>
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
      <div className="sticky top-12 z-40 bg-white py-4 -mt-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to={createPageUrl("Dashboard")}>
              <Button variant="outline" size="icon">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Shield className="w-7 h-7 text-red-600" />
                Tenant Console
              </h1>
              <p className="text-sm text-gray-600">Manage all tenants and their configurations</p>
            </div>
          </div>
          <Link to={createPageUrl("CreateTenant")}>
            <Button className="bg-green-600 hover:bg-green-700 gap-2">
              <Plus className="w-4 h-4" />
              Create Tenant
            </Button>
          </Link>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="mb-6 bg-green-50 border-green-200">
          <AlertDescription className="text-green-800">{success}</AlertDescription>
        </Alert>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Tenants</p>
                <p className="text-3xl font-bold text-gray-900">{tenants.length}</p>
              </div>
              <Building2 className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Active</p>
                <p className="text-3xl font-bold text-green-600">
                  {tenants.filter(t => (t.status === 'ACTIVE' || t.is_active === true)).length}
                </p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Suspended</p>
                <p className="text-3xl font-bold text-red-600">
                  {tenants.filter(t => (t.status === 'SUSPENDED' || t.is_active === false)).length}
                </p>
              </div>
              <XCircle className="w-8 h-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Regions</p>
                <p className="text-3xl font-bold text-purple-600">
                  {[...new Set(tenants.map(t => t.region))].length}
                </p>
              </div>
              <Globe className="w-8 h-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="grid md:grid-cols-3 gap-4">
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, code, or subdomain..."
                className="pl-10"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border rounded-lg px-3 py-2"
            >
              <option value="all">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="DELETED">Deleted</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Tenants Table */}
      <Card>
        <CardHeader>
          <CardTitle>Tenants ({filteredTenants.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
            </div>
          ) : filteredTenants.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Building2 className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-semibold mb-2">No tenants found</p>
              <p className="text-sm">
                {searchQuery || statusFilter !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Create your first tenant to get started'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b bg-gray-50">
                  <tr>
                    <th className="pb-3 px-4 text-left font-semibold text-gray-700">Name</th>
                    <th className="pb-3 px-4 text-left font-semibold text-gray-700">Code</th>
                    <th className="pb-3 px-4 text-left font-semibold text-gray-700">Subdomain</th>
                    <th className="pb-3 px-4 text-left font-semibold text-gray-700">Status</th>
                    <th className="pb-3 px-4 text-left font-semibold text-gray-700">Region</th>
                    <th className="pb-3 px-4 text-left font-semibold text-gray-700">Currency</th>
                    <th className="pb-3 px-4 text-left font-semibold text-gray-700">Units</th>
                    <th className="pb-3 px-4 text-left font-semibold text-gray-700">Created</th>
                    <th className="pb-3 px-4 text-center font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTenants.map((tenant) => {
                    const name = tenant.name || tenant.display_name || tenant.company_name;
                    const code = tenant.code || tenant.tenant_code;
                    const subdomain = tenant.base_subdomain || tenant.tenant_code?.toLowerCase();
                    const logoUrl = tenant.branding_logo_url || tenant.logo_url;
                    const currency = tenant.default_currency || 'USD';
                    const unitSystem = tenant.unit_system || tenant.measurement_system || 'METRIC';
                    
                    return (
                    <tr key={tenant.id} className="border-b hover:bg-gray-50 transition-colors">
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          {logoUrl && (
                            <img src={logoUrl} alt="" className="w-6 h-6 object-contain" />
                          )}
                          <span className="font-semibold text-gray-900">{name}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <span className="font-mono text-sm">{code}</span>
                      </td>
                      <td className="py-4 px-4">
                        <span className="text-blue-600 font-mono text-sm">
                          {subdomain}.yourapp.com
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        {getStatusBadge(tenant)}
                      </td>
                      <td className="py-4 px-4">
                        <Badge variant="outline">{tenant.region || tenant.country || tenant.country_code}</Badge>
                      </td>
                      <td className="py-4 px-4">
                        <span className="flex items-center gap-1">
                          <DollarSign className="w-3 h-3" />
                          {currency}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <Badge variant="outline" className="text-xs">
                          {unitSystem}
                        </Badge>
                      </td>
                      <td className="py-4 px-4 text-gray-600 text-sm">
                        {tenant.created_date ? format(new Date(tenant.created_date), 'MMM dd, yyyy') : '-'}
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center justify-center gap-2">
                          <Link to={createPageUrl(`ViewTenant?id=${tenant.id}`)}>
                            <Button variant="ghost" size="icon" title="View Details">
                              <Eye className="w-4 h-4" />
                            </Button>
                          </Link>
                          <Link to={createPageUrl(`EditTenant?id=${tenant.id}`)}>
                            <Button variant="ghost" size="icon" title="Edit">
                              <Edit className="w-4 h-4" />
                            </Button>
                          </Link>
                          <Link to={createPageUrl(`TenantUsers?tenant_id=${tenant.id}`)}>
                            <Button variant="ghost" size="icon" title="Manage Users">
                              <Users className="w-4 h-4" />
                            </Button>
                          </Link>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            title="Delete Tenant"
                            onClick={() => handleDeleteTenant(tenant)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}