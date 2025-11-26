import React, { useState } from "react";
import { recims } from "@/api/recimsClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTenant } from "@/components/TenantContext";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  TruckIcon,
  Search,
  Package,
  Calendar,
  Clock,
  ChevronLeft,
  ChevronRight,
  Printer,
  Trash2,
  AlertCircle,
  Edit,
  RefreshCw // NEW: Added RefreshCw icon
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { format, subDays } from "date-fns";

export default function InboundShipments() {
  const queryClient = useQueryClient();
  const { tenantConfig, user } = useTenant();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const neumorph = {
    base: 'bg-gradient-to-br from-gray-50 to-gray-100 shadow-[8px_8px_16px_#d1d5db,-8px_-8px_16px_#ffffff]',
    card: 'bg-gradient-to-br from-gray-50 to-gray-100 shadow-[8px_8px_16px_#d1d5db,-8px_-8px_16px_#ffffff] border-0',
    rounded: 'rounded-2xl',
    cardHover: 'hover:shadow-[inset_4px_4px_8px_#d1d5db,inset_-4px_-4px_8px_#ffffff] transition-all'
  };
  const [loadTypeFilter, setLoadTypeFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const itemsPerPage = 10;

  React.useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const statusParam = urlParams.get('status');
    if (statusParam) {
      setStatusFilter(statusParam);
    }
  }, []);

  const { data: shipments = [], isLoading } = useQuery({
    queryKey: ['inboundShipments', user?.tenant_id],
    queryFn: async () => {
      if (!user?.tenant_id) return [];
      
      // Fetch all shipments for the tenant
      const allShipments = await recims.entities.InboundShipment.filter({
        tenant_id: user.tenant_id
      }, '-created_date', 200);
      
      return allShipments;
    },
    enabled: !!user?.tenant_id,
    initialData: [],
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => recims.entities.Supplier.list(),
    initialData: [],
  });

  // Delete mutation with permission check
  const deleteShipmentMutation = useMutation({
    mutationFn: async (shipment) => {
      // Check if user has manager role
      if (user?.detailed_role !== 'manager' && user?.role !== 'admin') {
        throw new Error("Only managers can delete shipments");
      }

      // First delete associated Materials
      const materials = await recims.entities.Material.filter({ shipment_id: shipment.id });
      for (const material of materials) {
        await recims.entities.Material.delete(material.id);
      }

      // Then delete the InboundShipment
      await recims.entities.InboundShipment.delete(shipment.id);

      return shipment;
    },
    onSuccess: (deletedShipment) => {
      queryClient.invalidateQueries({ queryKey: ['inboundShipments'] });
      setSuccess(`Load ${deletedShipment.load_id} deleted successfully`);
      setTimeout(() => setSuccess(null), 3000);
    },
    onError: (err) => {
      setError(err.message || "Failed to delete shipment. Please check permissions.");
      setTimeout(() => setError(null), 5000);
    }
  });

  // Delete handler with confirmation
  const handleDelete = (shipment) => {
    if (user?.detailed_role !== 'manager' && user?.role !== 'admin') {
      setError("Only managers can delete shipments");
      setTimeout(() => setError(null), 5000);
      return;
    }

    const confirmMessage = `Are you sure you want to delete load ${shipment.load_id}?\n\n` +
      `Supplier: ${getSupplierName(shipment.supplier_id)}\n` +
      `Type: ${shipment.load_type}\n` +
      `Truck: ${shipment.truck_number || 'N/A'}\n\n` +
      `This will also delete all associated materials and cannot be undone.`;

    if (window.confirm(confirmMessage)) {
      deleteShipmentMutation.mutate(shipment);
    }
  };

  // NEW: Mutation to change shipment status
  const updateStatusMutation = useMutation({
    mutationFn: async ({ shipmentId, newStatus }) => {
      return await recims.entities.InboundShipment.update(shipmentId, {
        status: newStatus
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inboundShipments'] }); // Invalidate general shipments query
      setSuccess("Shipment status updated successfully");
      setTimeout(() => setSuccess(null), 3000);
    },
    onError: (err) => {
      setError(err.message || "Failed to update shipment status");
      setTimeout(() => setError(null), 3000);
    }
  });

  // NEW: Handle status change to pending_inspection
  const handleReopenForInspection = (shipment) => {
    if (window.confirm(`Reopen ${shipment.load_id} for inspection? This will change status from "${shipment.status}" to "pending_inspection".`)) {
      updateStatusMutation.mutate({
        shipmentId: shipment.id,
        newStatus: 'pending_inspection'
      });
    }
  };

  // Filter shipments (already filtered by tenant in the query)
  const filteredShipments = shipments.filter(shipment => {
    // Search filter
    const matchesSearch = !searchQuery ||
      shipment.load_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      shipment.supplier_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      shipment.truck_number?.toLowerCase().includes(searchQuery.toLowerCase());

    // Status filter
    const matchesStatus = statusFilter === 'all' || shipment.status === statusFilter;

    // Load type filter
    const matchesLoadType = loadTypeFilter === 'all' || shipment.load_type === loadTypeFilter;

    // Date range filter
    let matchesDate = true;
    if (dateFilter !== 'all') {
      const shipmentDate = new Date(shipment.created_date);
      const now = new Date();

      if (dateFilter === 'today') {
        matchesDate = shipmentDate.toDateString() === now.toDateString();
      } else if (dateFilter === 'week') {
        const sevenDaysAgo = subDays(now, 7);
        matchesDate = shipmentDate >= sevenDaysAgo;
      } else if (dateFilter === 'month') {
        const thirtyDaysAgo = subDays(now, 30);
        matchesDate = shipmentDate >= thirtyDaysAgo;
      }
    }

    return matchesSearch && matchesStatus && matchesLoadType && matchesDate;
  });

  // Calculate metrics
  const totalShipments = filteredShipments.length;
  const arrivedShipments = filteredShipments.filter(s => s.status === 'arrived').length;
  const completedShipments = filteredShipments.filter(s => s.status === 'completed').length;
  const totalWeight = filteredShipments.reduce((sum, s) => sum + (s.net_weight || 0), 0);

  // Pagination logic
  const totalPages = Math.ceil(filteredShipments.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentShipments = filteredShipments.slice(startIndex, endIndex);

  const getStatusColor = (status) => {
    switch(status) {
      case 'pending_inspection':
        return 'bg-purple-100 text-purple-700 border-purple-300';
      case 'arrived':
        return 'bg-orange-100 text-orange-700 border-orange-300';
      case 'weighing':
        return 'bg-blue-100 text-blue-700 border-blue-300';
      case 'inspecting':
        return 'bg-indigo-100 text-indigo-700 border-indigo-300';
      case 'classifying':
        return 'bg-cyan-100 text-cyan-700 border-cyan-300';
      case 'completed':
        return 'bg-green-100 text-green-700 border-green-300';
      case 'rejected':
        return 'bg-red-100 text-red-700 border-red-300';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  const getSupplierName = (supplierId) => {
    const supplier = suppliers.find(s => s.id === supplierId);
    return supplier?.company_name || 'Unknown Supplier';
  };

  const canDelete = user?.detailed_role === 'manager' || user?.role === 'admin';

  // The initial isLoading check previously moved outside CardContent, now it's in a more logical place.
  // The structure below handles initial loading, then empty filtered results, then the list.

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 via-gray-50 to-gray-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
      <div className="sticky top-12 z-40 bg-gradient-to-br from-gray-100 via-gray-50 to-gray-100 py-4 -mt-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <TruckIcon className="w-7 h-7 text-green-600" />
              Inbound Shipments
            </h1>
            <p className="text-sm text-gray-600">Track and manage incoming materials</p>
          </div>
          <Link to={createPageUrl("NewShipment")}>
            <Button className="bg-green-600 hover:bg-green-700 gap-2">
              <TruckIcon className="w-4 h-4" />
              New Shipment
            </Button>
          </Link>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="mb-6 bg-green-50 border-green-200">
          <AlertDescription className="text-green-800">{success}</AlertDescription>
        </Alert>
      )}

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className={`${neumorph.card} ${neumorph.rounded}`}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Shipments</p>
                <p className="text-3xl font-bold text-gray-900">{totalShipments}</p>
              </div>
              <Package className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card className={`${neumorph.card} ${neumorph.rounded}`}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Arrived</p>
                <p className="text-3xl font-bold text-orange-600">{arrivedShipments}</p>
              </div>
              <TruckIcon className="w-8 h-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>

        <Card className={`${neumorph.card} ${neumorph.rounded}`}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Completed</p>
                <p className="text-3xl font-bold text-green-600">{completedShipments}</p>
              </div>
              <Package className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card className={`${neumorph.card} ${neumorph.rounded}`}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Weight</p>
                <p className="text-2xl font-bold text-gray-900">{totalWeight.toFixed(0)} kg</p>
              </div>
              <Clock className="w-8 h-8 text-gray-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className={`mb-6 ${neumorph.card} ${neumorph.rounded}`}>
        <CardContent className="p-4">
          <div className="grid md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by Load ID, Supplier, or Truck..."
                className="pl-10"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending_inspection">Pending Inspection</SelectItem>
                <SelectItem value="arrived">Arrived</SelectItem>
                <SelectItem value="weighing">Weighing</SelectItem>
                <SelectItem value="inspecting">Inspecting</SelectItem>
                <SelectItem value="classifying">Classifying</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>

            <Select value={loadTypeFilter} onValueChange={setLoadTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="plastic">Plastic</SelectItem>
                <SelectItem value="metal">Metal</SelectItem>
                <SelectItem value="mixed">Mixed</SelectItem>
              </SelectContent>
            </Select>

            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by date" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">Last 7 Days</SelectItem>
                <SelectItem value="month">Last 30 Days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Shipments List */}
      <Card className={`${neumorph.card} ${neumorph.roundedLg}`}>
        <CardHeader>
          <CardTitle>Shipments ({filteredShipments.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading shipments...</p>
            </div>
          ) : currentShipments.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <TruckIcon className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-semibold mb-2">No shipments found</p>
              <p className="text-sm">
                {searchQuery || statusFilter !== 'all' || loadTypeFilter !== 'all' || dateFilter !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Create your first shipment to get started'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {currentShipments.map((shipment) => (
                <div
                  key={shipment.id}
                  className={`p-4 ${neumorph.base} ${neumorph.rounded} ${neumorph.cardHover}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <p className="font-bold text-lg">{shipment.load_id}</p>
                        <Badge className={getStatusColor(shipment.status)}>
                          {shipment.status.replace('_', ' ')}
                        </Badge>
                        {shipment.sku_number && (
                          <Badge variant="outline" className="text-xs">
                            SKU: {shipment.sku_number}
                          </Badge>
                        )}
                      </div>

                      <div className="grid md:grid-cols-2 gap-2 text-sm text-gray-600">
                        <div>
                          <p><strong>Supplier:</strong> {getSupplierName(shipment.supplier_id)}</p>
                          {shipment.truck_number && <p><strong>Truck:</strong> {shipment.truck_number}</p>}
                          {shipment.driver_name && <p><strong>Driver:</strong> {shipment.driver_name}</p>}
                        </div>
                        <div>
                          <p><strong>Type:</strong> {shipment.load_type}</p>
                          {shipment.product_category && (
                            <p><strong>Category:</strong> {shipment.product_category}</p>
                          )}
                          {shipment.net_weight > 0 && (
                            <p>
                              <strong>Net Weight:</strong> {shipment.net_weight.toFixed(2)} kg
                              {shipment.net_weight_lbs && ` (${shipment.net_weight_lbs.toFixed(2)} lbs)`}
                            </p>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        Arrived: {format(new Date(shipment.arrival_time || shipment.created_date), 'MMM dd, yyyy HH:mm')}
                      </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2 ml-4">
                      <Link to={createPageUrl(`EditShipment?id=${shipment.id}`)}>
                        <Button variant="outline" size="sm">
                          <Edit className="w-4 h-4" />
                        </Button>
                      </Link>
                      <Link to={createPageUrl(`PrintInboundLabel?id=${shipment.id}`)}>
                        <Button variant="outline" size="sm">
                          <Printer className="w-4 h-4" />
                        </Button>
                      </Link>
                      {/* NEW: Reopen button for rejected shipments */}
                      {shipment.status === 'rejected' && (
                        <Button
                          onClick={() => handleReopenForInspection(shipment)}
                          disabled={updateStatusMutation.isPending}
                          size="sm"
                          className="bg-blue-600 hover:bg-blue-700"
                          title="Reopen for Inspection"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          onClick={() => handleDelete(shipment)}
                          disabled={deleteShipmentMutation.isPending}
                          variant="outline"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t">
              <p className="text-sm text-gray-600">
                Showing {startIndex + 1} to {Math.min(endIndex, filteredShipments.length)} of {filteredShipments.length} shipments
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      </div>
    </div>
  );
}