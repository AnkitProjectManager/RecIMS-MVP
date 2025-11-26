import React, { useState } from "react";
import { recims } from "@/api/recimsClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Users,
  ArrowLeft,
  Plus,
  Mail,
  Shield,
  AlertCircle,
  UserPlus
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format } from "date-fns";

export default function TenantUsers() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('user');

  const urlParams = new URLSearchParams(window.location.search);
  const tenantIdParam = urlParams.get('tenant_id');

  const resolvedTenantId = React.useMemo(() => {
    if (!tenantIdParam) return null;
    const numeric = Number(tenantIdParam);
    return Number.isInteger(numeric) ? numeric : tenantIdParam;
  }, [tenantIdParam]);

  const { data: tenant, isLoading: isTenantLoading } = useQuery({
    queryKey: ['tenant', resolvedTenantId],
    queryFn: async () => {
      if (!resolvedTenantId) return null;
      try {
        return await recims.entities.Tenant.get(resolvedTenantId);
      } catch (error) {
        if (typeof resolvedTenantId === 'string') {
          const fallback = await recims.entities.Tenant.filter({ tenant_id: resolvedTenantId });
          return fallback[0] ?? null;
        }
        throw error;
      }
    },
    enabled: !!resolvedTenantId,
  });

  const tenantPrimaryId = tenant?.id ?? (Number.isInteger(Number(tenantIdParam)) ? Number(tenantIdParam) : null);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['tenantUsers', tenantPrimaryId],
    queryFn: async () => {
      if (!tenantPrimaryId) return [];
      return await recims.entities.User.filter({ tenant_id: tenantPrimaryId });
    },
    enabled: !!tenantPrimaryId,
    initialData: [],
  });

  const handleInviteUser = () => {
    setSuccess(`Invite sent to ${inviteEmail}. They will receive an email to set up their account.`);
    setShowInviteDialog(false);
    setInviteEmail('');
    setInviteRole('user');
    setTimeout(() => setSuccess(null), 5000);
  };

  const getRoleBadge = (role) => {
    switch(role) {
      case 'admin':
        return <Badge className="bg-red-100 text-red-700"><Shield className="w-3 h-3 mr-1" />Admin</Badge>;
      case 'user':
        return <Badge className="bg-blue-100 text-blue-700">User</Badge>;
      default:
        return <Badge variant="outline">{role}</Badge>;
    }
  };

  if (isTenantLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading users...</p>
        </div>
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Tenant not found</AlertDescription>
        </Alert>
        <Button onClick={() => navigate(createPageUrl("TenantConsole"))} className="mt-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Tenant Console
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link to={createPageUrl(`ViewTenant?id=${tenantPrimaryId ?? tenantIdParam}`)}>
            <Button variant="outline" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Users className="w-7 h-7 text-blue-600" />
              Users: {tenant.display_name}
            </h1>
            <p className="text-sm text-gray-600">Manage tenant user accounts</p>
          </div>
        </div>
        <Button 
          onClick={() => setShowInviteDialog(true)}
          className="bg-green-600 hover:bg-green-700 gap-2"
        >
          <UserPlus className="w-4 h-4" />
          Invite User
        </Button>
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

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-gray-600 mb-1">Total Users</p>
            <p className="text-3xl font-bold text-gray-900">{users.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-gray-600 mb-1">Admin Users</p>
            <p className="text-3xl font-bold text-red-600">
              {users.filter(u => u.role === 'admin').length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-gray-600 mb-1">Regular Users</p>
            <p className="text-3xl font-bold text-blue-600">
              {users.filter(u => u.role === 'user').length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>User Accounts ({users.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-semibold mb-2">No users yet</p>
              <p className="text-sm mb-4">Invite users to get started</p>
              <Button onClick={() => setShowInviteDialog(true)} className="gap-2">
                <UserPlus className="w-4 h-4" />
                Invite First User
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b bg-gray-50">
                  <tr>
                    <th className="pb-3 px-4 text-left font-semibold text-gray-700">Name</th>
                    <th className="pb-3 px-4 text-left font-semibold text-gray-700">Email</th>
                    <th className="pb-3 px-4 text-left font-semibold text-gray-700">Role</th>
                    <th className="pb-3 px-4 text-left font-semibold text-gray-700">Detailed Role</th>
                    <th className="pb-3 px-4 text-left font-semibold text-gray-700">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b hover:bg-gray-50">
                      <td className="py-4 px-4">
                        <p className="font-semibold">{user.full_name || 'N/A'}</p>
                      </td>
                      <td className="py-4 px-4">
                        <p className="text-blue-600">{user.email}</p>
                      </td>
                      <td className="py-4 px-4">
                        {getRoleBadge(user.role)}
                      </td>
                      <td className="py-4 px-4">
                        <Badge variant="outline" className="text-xs">
                          {user.detailed_role || 'N/A'}
                        </Badge>
                      </td>
                      <td className="py-4 px-4 text-gray-600 text-sm">
                        {user.created_date ? format(new Date(user.created_date), 'MMM dd, yyyy') : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invite User Dialog */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite New User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Alert className="bg-blue-50 border-blue-200">
              <Mail className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800 text-sm">
                The user will receive an email invitation to set up their account for <strong>{tenant.display_name}</strong>.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label>Email Address *</Label>
              <Input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="user@company.com"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Role *</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Regular User</SelectItem>
                  <SelectItem value="admin">Tenant Admin</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                Tenant Admins can manage users and settings for this tenant only.
              </p>
            </div>

            <Alert className="bg-yellow-50 border-yellow-200">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-yellow-800 text-sm">
                <strong>Note:</strong> In the standalone RecIMS build, users must be invited manually through the RecIMS user management UI. 
                This dialog is a placeholder for the final Node.js implementation where automated email invites will be sent.
              </AlertDescription>
            </Alert>

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowInviteDialog(false);
                  setInviteEmail('');
                  setInviteRole('user');
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleInviteUser}
                disabled={!inviteEmail}
                className="flex-1 bg-green-600 hover:bg-green-700 gap-2"
              >
                <Mail className="w-4 h-4" />
                Send Invite
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}