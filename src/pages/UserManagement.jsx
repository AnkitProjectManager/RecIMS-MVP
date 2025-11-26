import React, { useState } from "react";
import { recims } from "@/api/recimsClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTenant } from "@/components/TenantContext";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, 
  Users, 
  Search,
  Pencil,
  Shield,
  Mail,
  Phone,
  Calendar,
  CheckCircle,
  XCircle,
  UserPlus,
  AlertCircle
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePermissions, getRoleDisplayName, getRoleColor } from "@/components/auth/usePermissions";
import PermissionGuard from "@/components/auth/PermissionGuard";
import TenantHeader from "@/components/TenantHeader";
import { format } from "date-fns";

export default function UserManagement() {
  const queryClient = useQueryClient();
  const { user: currentUser } = useTenant();
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('warehouse_staff');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const permissions = usePermissions(currentUser);

  const { data: allUsers = [], isLoading } = useQuery({
    queryKey: ['allUsers', currentUser?.tenant_id],
    queryFn: async () => {
      if (!currentUser?.tenant_id) return [];
      return await recims.entities.User.filter({ tenant_id: currentUser.tenant_id });
    },
    enabled: !!currentUser?.tenant_id,
    initialData: [],
  });

  const updateUserMutation = useMutation({
    mutationFn: async (userData) => {
      // Update user entity
      return await recims.entities.User.update(userData.id, {
        detailed_role: userData.detailed_role,
        department: userData.department,
        phone: userData.phone,
        active: userData.active
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allUsers'] });
      setSuccess("User updated successfully");
      setShowEditDialog(false);
      setEditingUser(null);
      setTimeout(() => setSuccess(null), 3000);
    },
    onError: (err) => {
      setError(err.message || "Failed to update user");
      setTimeout(() => setError(null), 5000);
    }
  });

  const handleEditUser = (user) => {
    setEditingUser(user);
    setShowEditDialog(true);
  };

  const handleUpdateUser = (e) => {
    e.preventDefault();
    if (editingUser) {
      updateUserMutation.mutate(editingUser);
    }
  };

  const handleInviteUser = () => {
    setShowInviteDialog(true);
  };

  const handleSendInvite = () => {
    // Users are invited through the RecIMS dashboard
    // This is just a UI helper that explains the process
    setSuccess("To invite users, please use the 'Invite User' function in the RecIMS dashboard under Users section.");
    setShowInviteDialog(false);
    setInviteEmail('');
    setInviteRole('warehouse_staff');
    setTimeout(() => setSuccess(null), 8000);
  };

  const filteredUsers = allUsers.filter(user => {
    const matchesSearch = 
      user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesRole = roleFilter === 'all' || user.detailed_role === roleFilter;
    
    return matchesSearch && matchesRole;
  });

  const stats = {
    total: allUsers.length,
    superadmins: allUsers.filter(u => u.detailed_role === 'superadmin').length,
    admins: allUsers.filter(u => u.detailed_role === 'admin').length,
    managers: allUsers.filter(u => u.detailed_role === 'manager').length,
    warehouse: allUsers.filter(u => u.detailed_role === 'warehouse_staff').length,
    sales: allUsers.filter(u => u.detailed_role === 'sales_representative').length,
    qc: allUsers.filter(u => u.detailed_role === 'quality_control').length,
    active: allUsers.filter(u => u.active !== false).length
  };

  if (!permissions.canManageUsers) {
    return (
      <div className="p-4 md:p-8 max-w-7xl mx-auto">
        <TenantHeader />
        <PermissionGuard user={currentUser} permission="canManageUsers" showAlert={true} />
        <Link to={createPageUrl("Dashboard")} className="mt-4 inline-block">
          <Button variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <TenantHeader />
      
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link to={createPageUrl("Dashboard")}>
            <Button variant="outline" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">User & Role Management</h1>
            <p className="text-sm text-gray-600">Manage user accounts and permissions</p>
          </div>
        </div>
        <Button onClick={handleInviteUser} className="bg-green-600 hover:bg-green-700 gap-2">
          <UserPlus className="w-4 h-4" />
          Invite User
        </Button>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="mb-6 bg-green-50 border-green-200">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">{success}</AlertDescription>
        </Alert>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-7 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-600">Total</p>
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-600">Super Admins</p>
            <p className="text-2xl font-bold text-red-600">{stats.superadmins}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-600">Admins</p>
            <p className="text-2xl font-bold text-purple-600">{stats.admins}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-600">Managers</p>
            <p className="text-2xl font-bold text-blue-600">{stats.managers}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-600">Warehouse</p>
            <p className="text-2xl font-bold text-green-600">{stats.warehouse}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-600">Sales</p>
            <p className="text-2xl font-bold text-orange-600">{stats.sales}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-600">Active</p>
            <p className="text-2xl font-bold text-green-600">{stats.active}</p>
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
                placeholder="Search by name or email..."
                className="pl-10"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="superadmin">Super Admin</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="warehouse_staff">Warehouse Staff</SelectItem>
                <SelectItem value="sales_representative">Sales Rep</SelectItem>
                <SelectItem value="quality_control">Quality Control</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Role Permissions Reference */}
      <Card className="mb-6 border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="text-blue-900">Role Permissions Reference</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-6 gap-4 text-sm">
            <div>
              <Badge className="bg-red-100 text-red-700 mb-2">Super Admin</Badge>
              <ul className="text-gray-700 space-y-1">
                <li>• Configure tenants</li>
                <li>• Enable/disable phases</li>
                <li>• Full system access</li>
                <li>• All permissions</li>
              </ul>
            </div>
            <div>
              <Badge className="bg-purple-100 text-purple-700 mb-2">Administrator</Badge>
              <ul className="text-gray-700 space-y-1">
                <li>• Full system access</li>
                <li>• User management</li>
                <li>• Financial data</li>
                <li>• System settings</li>
              </ul>
            </div>
            <div>
              <Badge className="bg-blue-100 text-blue-700 mb-2">Manager</Badge>
              <ul className="text-gray-700 space-y-1">
                <li>• Approve orders</li>
                <li>• Delete shipments</li>
                <li>• View financials</li>
                <li>• Export data</li>
              </ul>
            </div>
            <div>
              <Badge className="bg-green-100 text-green-700 mb-2">Warehouse Staff</Badge>
              <ul className="text-gray-700 space-y-1">
                <li>• Receive shipments</li>
                <li>• Classify materials</li>
                <li>• Manage bins</li>
                <li>• Update inventory</li>
              </ul>
            </div>
            <div>
              <Badge className="bg-orange-100 text-orange-700 mb-2">Sales Rep</Badge>
              <ul className="text-gray-700 space-y-1">
                <li>• Create sales orders</li>
                <li>• Manage customers</li>
                <li>• View reports</li>
                <li>• Dashboard access</li>
              </ul>
            </div>
            <div>
              <Badge className="bg-yellow-100 text-yellow-700 mb-2">Quality Control</Badge>
              <ul className="text-gray-700 space-y-1">
                <li>• Inspect materials</li>
                <li>• Classify quality</li>
                <li>• Manage QC criteria</li>
                <li>• View reports</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Users List */}
      <Card>
        <CardHeader>
          <CardTitle>Users ({filteredUsers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="mb-4">No users found</p>
              <Button onClick={handleInviteUser} className="bg-green-600 hover:bg-green-700">
                <UserPlus className="w-4 h-4 mr-2" />
                Invite First User
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredUsers.map((user) => (
                <div key={user.id} className="p-4 border rounded-lg hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-bold text-lg">{user.full_name}</h3>
                        <Badge className={getRoleColor(user.detailed_role || 'warehouse_staff')}>
                          {getRoleDisplayName(user.detailed_role || 'warehouse_staff')}
                        </Badge>
                        {user.active === false && (
                          <Badge className="bg-red-100 text-red-700">Inactive</Badge>
                        )}
                      </div>
                      
                      <div className="grid md:grid-cols-3 gap-2 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <Mail className="w-4 h-4" />
                          {user.email}
                        </div>
                        {user.phone && (
                          <div className="flex items-center gap-1">
                            <Phone className="w-4 h-4" />
                            {user.phone}
                          </div>
                        )}
                        {user.department && (
                          <div className="flex items-center gap-1">
                            <Shield className="w-4 h-4" />
                            {user.department}
                          </div>
                        )}
                        {user.last_login && (
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            Last login: {format(new Date(user.last_login), 'MMM dd, yyyy')}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleEditUser(user)}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invite User Dialog */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Invite New User</DialogTitle>
          </DialogHeader>
          
          <Alert className="bg-blue-50 border-blue-200">
            <AlertCircle className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800 text-sm">
              <strong>How to Invite Users:</strong>
              <ol className="mt-2 ml-4 list-decimal space-y-1">
                <li>Go to the RecIMS Dashboard</li>
                <li>Navigate to <strong>Users</strong> section</li>
                <li>Click <strong>Invite User</strong></li>
                <li>Enter their email and assign initial role</li>
                <li>They will receive an invitation email</li>
                <li>Once they accept, you can assign detailed roles here</li>
              </ol>
            </AlertDescription>
          </Alert>

          <div className="flex gap-3 mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowInviteDialog(false)}
              className="flex-1"
            >
              Close
            </Button>
            <Button
              onClick={handleSendInvite}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
            >
              Got it
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
          </DialogHeader>
          
          {editingUser && (
            <form onSubmit={handleUpdateUser} className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input
                    value={editingUser.full_name || ''}
                    disabled
                    className="bg-gray-50"
                  />
                  <p className="text-xs text-gray-500">Cannot be changed</p>
                </div>

                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    value={editingUser.email || ''}
                    disabled
                    className="bg-gray-50"
                  />
                  <p className="text-xs text-gray-500">Cannot be changed</p>
                </div>

                <div className="space-y-2">
                  <Label>Role *</Label>
                  <Select
                    value={editingUser.detailed_role || 'warehouse_staff'}
                    onValueChange={(value) => setEditingUser({...editingUser, detailed_role: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="superadmin">Super Administrator</SelectItem>
                      <SelectItem value="admin">Administrator</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="warehouse_staff">Warehouse Staff</SelectItem>
                      <SelectItem value="sales_representative">Sales Representative</SelectItem>
                      <SelectItem value="quality_control">Quality Control</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Department</Label>
                  <Select
                    value={editingUser.department || ''}
                    onValueChange={(value) => setEditingUser({...editingUser, department: value})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="operations">Operations</SelectItem>
                      <SelectItem value="sales">Sales</SelectItem>
                      <SelectItem value="quality">Quality</SelectItem>
                      <SelectItem value="administration">Administration</SelectItem>
                      <SelectItem value="logistics">Logistics</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input
                    value={editingUser.phone || ''}
                    onChange={(e) => setEditingUser({...editingUser, phone: e.target.value})}
                    placeholder="Phone number"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={editingUser.active === false ? 'inactive' : 'active'}
                    onValueChange={(value) => setEditingUser({...editingUser, active: value === 'active'})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowEditDialog(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={updateUserMutation.isPending}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  {updateUserMutation.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}