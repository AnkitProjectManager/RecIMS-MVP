import React, { useState } from "react";
import { recims } from "@/api/recimsClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTenant } from "@/components/TenantContext";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Package, 
  ArrowLeft, 
  Search, 
  Plus,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  DollarSign,
  Layers,
  Split,
  ArrowRightLeft,
  Edit3,
  MapPin,
  List,
  Trash2
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { format, subDays } from "date-fns";
import TenantHeader from "@/components/TenantHeader";
import EditQuantityModal from "@/components/inventory/EditQuantityModal";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export default function InventoryManagement() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { tenantConfig, user } = useTenant();
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const neumorph = {
    base: 'bg-gradient-to-br from-gray-50 to-gray-100 shadow-[8px_8px_16px_#d1d5db,-8px_-8px_16px_#ffffff]',
    card: 'bg-gradient-to-br from-gray-50 to-gray-100 shadow-[8px_8px_16px_#d1d5db,-8px_-8px_16px_#ffffff] border-0',
    rounded: 'rounded-2xl'
  };
  const [subCategoryFilter, setSubCategoryFilter] = useState('all');
  const [formatFilter, setFormatFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');
  const [useMetric, setUseMetric] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('classified');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteError, setDeleteError] = useState(null);

  React.useEffect(() => {
    if (tenantConfig) {
      setUseMetric(tenantConfig.unit_system === 'METRIC');
    }
  }, [tenantConfig]);

  const { data: inventory = [] } = useQuery({
    queryKey: ['inventory', user?.tenant_id],
    queryFn: async () => {
      if (!user?.tenant_id) return [];
      return await recims.entities.Inventory.filter({
        tenant_id: user.tenant_id
      }, '-created_date', 500);
    },
    enabled: !!user?.tenant_id,
    initialData: [],
  });

  const { data: unsortedInventory = [] } = useQuery({
    queryKey: ['unsortedInventory', user?.tenant_id],
    queryFn: async () => {
      if (!user?.tenant_id) return [];
      return await recims.entities.Inventory.filter({
        tenant_id: user.tenant_id,
        sorting_status: 'needs_sorting'
      }, '-created_date', 500);
    },
    enabled: !!user?.tenant_id,
    initialData: [],
  });

  const { data: materialCategories = [] } = useQuery({
    queryKey: ['materialCategories', user?.tenant_id],
    queryFn: async () => {
      if (!user?.tenant_id) return [];
      return await recims.entities.MaterialCategory.filter({
        tenant_id: user.tenant_id,
        is_active: true
      }, '-created_date', 200);
    },
    enabled: !!user?.tenant_id,
    initialData: [],
  });

  const { data: settings = [] } = useQuery({
    queryKey: ['appSettings'],
    queryFn: () => recims.entities.AppSettings.list(),
    initialData: [],
  });

  const inventoryEnabled = settings.find(s => s.setting_key === 'enable_inventory_module')?.setting_value === 'true';
  const stockTransferEnabled = settings.find(s => s.setting_key === 'enable_stock_transfer')?.setting_value === 'true';

  // Calculate stats for classified inventory only
  const activeInventory = inventory.filter(i => 
    (i.status === 'available' || i.status === 'reserved') &&
    i.sorting_status === 'classified'
  );
  
  const stats = {
    totalItems: activeInventory.length,
    totalWeight: activeInventory.reduce((sum, i) => sum + (i.quantity_kg || 0), 0),
    totalWeightLbs: activeInventory.reduce((sum, i) => sum + (i.quantity_lbs || 0), 0),
    totalValue: activeInventory.reduce((sum, i) => sum + ((i.price_per_kg || 0) * (i.quantity_kg || 0)), 0),
    lowStockItems: activeInventory.filter(i => 
      i.reorder_point && i.quantity_on_hand <= i.reorder_point
    ).length,
    unsortedItems: unsortedInventory.length
  };

  // Calculate turnover rate (simplified: sold items / total items in last 30 days)
  const thirtyDaysAgo = subDays(new Date(), 30);
  const recentSoldItems = inventory.filter(i => 
    i.status === 'sold' && i.last_updated && new Date(i.last_updated) >= thirtyDaysAgo
  ).length;
  const avgInventory = (stats.totalItems + recentSoldItems) / 2 || 1;
  const turnoverRate = recentSoldItems / avgInventory;

  // Filter inventory
  const filteredInventory = activeInventory.filter(item => {
    const matchesSearch = 
      item.sku_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.item_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.bin_location?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
    const matchesSubCategory = subCategoryFilter === 'all' || item.sub_category === subCategoryFilter;
    const matchesFormat = formatFilter === 'all' || item.format === formatFilter;
    const matchesLocation = locationFilter === 'all' || item.bin_location?.startsWith(locationFilter);
    
    return matchesSearch && matchesCategory && matchesSubCategory && matchesFormat && matchesLocation;
  });

  // Get unique values for filters
  const inventoryCategories = [...new Set(activeInventory.map(i => i.category).filter(Boolean))];
  const configuredCategories = materialCategories
    .map(cat => cat.category_name)
    .filter(Boolean);
  const uniqueCategories = Array.from(new Set([
    ...configuredCategories,
    ...inventoryCategories
  ])).sort((a, b) => a.localeCompare(b));
  const uniqueSubCategories = [...new Set(activeInventory.map(i => i.sub_category).filter(Boolean))];
  const uniqueFormats = [...new Set(activeInventory.map(i => i.format).filter(Boolean))];
  const uniqueLocations = [...new Set(activeInventory.map(i => i.bin_location).filter(Boolean))];

  const formatValue = (value) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
    return `$${value.toFixed(0)}`;
  };

  const handleItemClick = (item, e) => {
    // Prevent opening edit modal if delete button was clicked
    if (e.target.closest('[data-delete-button]')) {
      return;
    }
    setSelectedItem(item);
    setIsEditModalOpen(true);
  };

  const handleDeleteClick = (item, e) => {
    e.stopPropagation();
    setItemToDelete(item);
    setDeleteConfirmText('');
    setDeleteError(null);
    setDeleteDialogOpen(true);
  };

  const deleteMutation = useMutation({
    mutationFn: async (itemId) => {
      await recims.entities.Inventory.delete(itemId);
      
      // Log to audit trail
      await recims.entities.AuditTrail.create({
        tenant: user.tenant || 'min_tech',
        entity_type: 'inventory',
        entity_id: itemId,
        action: 'delete',
        changed_by: user.email,
        changed_by_name: user.full_name,
        change_reason: 'Material no longer available',
        change_notes: JSON.stringify({
          sku_number: itemToDelete.sku_number,
          category: itemToDelete.category,
          quantity_kg: itemToDelete.quantity_kg,
          bin_location: itemToDelete.bin_location
        }),
        timestamp: new Date().toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      setDeleteDialogOpen(false);
      setItemToDelete(null);
      setDeleteConfirmText('');
    },
    onError: (error) => {
      setDeleteError(error.message || 'Failed to delete inventory item');
    }
  });

  const handleConfirmDelete = () => {
    if (deleteConfirmText !== 'DELETE') {
      setDeleteError('Please type DELETE to confirm');
      return;
    }
    deleteMutation.mutate(itemToDelete.id);
  };

  if (!inventoryEnabled) {
    return (
      <div className="p-4 md:p-8 max-w-4xl mx-auto">
        <TenantHeader />
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Inventory Management module is not enabled. Please enable it in Super Admin settings.
          </AlertDescription>
        </Alert>
        <Button onClick={() => navigate(createPageUrl("Dashboard"))} className="mt-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>
      </div>
    );
  }

  const weightUnit = useMetric ? 'kg' : 'lbs';

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 via-gray-50 to-gray-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
      <TenantHeader />
      
      {/* Header */}
      <div className="sticky top-12 z-40 bg-gradient-to-br from-gray-100 via-gray-50 to-gray-100 py-4 -mt-4 mb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Link to={createPageUrl("Dashboard")}>
              <Button variant="outline" size="icon">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Inventory Management</h1>
              <p className="text-sm text-gray-600">Track and manage your material efficiently.</p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap justify-end">
            {stockTransferEnabled && (
              <Link to={createPageUrl("StockTransfer")}>
                <Button variant="outline" className="gap-2">
                  <ArrowRightLeft className="w-4 h-4" />
                  Transfer Stock
                </Button>
              </Link>
            )}
            <Link to={createPageUrl("InventoryAdjustment")}>
              <Button variant="outline" className="gap-2">
                <Edit3 className="w-4 h-4" />
                Adjust Inventory
              </Button>
            </Link>
            <Link to={createPageUrl("InventoryByLocation")}>
              <Button variant="outline" className="gap-2">
                <MapPin className="w-4 h-4" />
                By Location
              </Button>
            </Link>
            <Link to={createPageUrl("InventoryBySKU")}>
              <Button variant="outline" className="gap-2">
                <List className="w-4 h-4" />
                By SKU
              </Button>
            </Link>
            <Link to={createPageUrl("InventorySorting")}>
              <Button variant="outline" className="gap-2">
                <Split className="w-4 h-4" />
                Sorting Queue
                {stats.unsortedItems > 0 && (
                  <Badge className="bg-orange-600 text-white ml-1">
                    {stats.unsortedItems}
                  </Badge>
                )}
              </Button>
            </Link>
            <Link to={createPageUrl("AddToInventory")}>
              <Button className="bg-green-600 hover:bg-green-700 gap-2">
                <Plus className="w-4 h-4" />
                Add New Material
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Unsorted Items Alert */}
      {stats.unsortedItems > 0 && (
        <Alert className="mb-6 bg-orange-50 border-orange-200">
          <AlertTriangle className="h-4 w-4 text-orange-600" />
          <AlertDescription className="text-orange-800 flex items-center justify-between">
            <span>
              <strong>{stats.unsortedItems} item(s)</strong> need sorting and classification
            </span>
            <Link to={createPageUrl("InventorySorting")}>
              <Button size="sm" className="bg-orange-600 hover:bg-orange-700">
                Go to Sorting Queue
              </Button>
            </Link>
          </AlertDescription>
        </Alert>
      )}

      {/* Quick Stats */}
      <div className="flex items-center gap-4 mb-6 text-sm text-gray-600">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500"></div>
          <span>{stats.totalItems} active items</span>
        </div>
        <div className="flex items-center gap-2">
          <DollarSign className="w-4 h-4" />
          <span>{formatValue(stats.totalValue)} value</span>
        </div>
        {stats.unsortedItems > 0 && (
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-orange-500"></div>
            <span>{stats.unsortedItems} need sorting</span>
          </div>
        )}
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {/* Total Materials */}
        <Card className={`${neumorph.card} ${neumorph.rounded}`}>
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-2">
              <div className="p-2 rounded-lg bg-blue-100">
                <Layers className="w-5 h-5 text-blue-600" />
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-1">Total Materials</p>
            <p className="text-3xl font-bold text-gray-900 mb-1">
              {useMetric 
                ? `${stats.totalWeight.toFixed(0)} kg`
                : `${stats.totalWeightLbs.toFixed(0)} lbs`
              }
            </p>
            <p className="text-sm text-gray-600">{stats.totalItems} units</p>
            <div className="flex items-center gap-1 mt-2 text-green-600">
              <TrendingUp className="w-3 h-3" />
              <span className="text-xs font-semibold">+12.5%</span>
            </div>
          </CardContent>
        </Card>

        {/* Total Value */}
        <Card className={`${neumorph.card} ${neumorph.rounded}`}>
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-2">
              <div className="p-2 rounded-lg bg-green-100">
                <DollarSign className="w-5 h-5 text-green-600" />
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-1">Total Value</p>
            <p className="text-3xl font-bold text-gray-900 mb-1">
              {formatValue(stats.totalValue)}
            </p>
            <p className="text-sm text-gray-600">Inventory worth</p>
            <div className="flex items-center gap-1 mt-2 text-green-600">
              <TrendingUp className="w-3 h-3" />
              <span className="text-xs font-semibold">+8.2%</span>
            </div>
          </CardContent>
        </Card>

        {/* Low Stock Items */}
        <Card className={`${neumorph.card} ${neumorph.rounded}`}>
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-2">
              <div className="p-2 rounded-lg bg-orange-100">
                <AlertTriangle className="w-5 h-5 text-orange-600" />
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-1">Low Stock Items</p>
            <p className="text-3xl font-bold text-gray-900 mb-1">
              {stats.lowStockItems}
            </p>
            <p className="text-sm text-gray-600">Need reorder</p>
            <div className="flex items-center gap-1 mt-2 text-gray-600">
              <TrendingDown className="w-3 h-3" />
              <span className="text-xs font-semibold">-2 from last week</span>
            </div>
          </CardContent>
        </Card>

        {/* Turnover Rate */}
        <Card className={`${neumorph.card} ${neumorph.rounded}`}>
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-2">
              <div className="p-2 rounded-lg bg-purple-100">
                <Package className="w-5 h-5 text-purple-600" />
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-1">Turnover Rate</p>
            <p className="text-3xl font-bold text-gray-900 mb-1">
              {turnoverRate.toFixed(1)}x
            </p>
            <p className="text-sm text-gray-600">Last 30 days</p>
            <div className="flex items-center gap-1 mt-2 text-green-600">
              <TrendingUp className="w-3 h-3" />
              <span className="text-xs font-semibold">+0.3x</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filters */}
      <Card className={`mb-6 ${neumorph.card} ${neumorph.rounded}`}>
        <CardContent className="p-4">
          <div className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search for specific materials..."
                className="pl-10"
              />
            </div>

            {/* Filters Row */}
            <div className="grid md:grid-cols-5 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-gray-600">Category</Label>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {uniqueCategories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-gray-600">Sub-Category</Label>
                <Select value={subCategoryFilter} onValueChange={setSubCategoryFilter}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sub-Categories</SelectItem>
                    {uniqueSubCategories.map((sub) => (
                      <SelectItem key={sub} value={sub}>
                        {sub}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-gray-600">Format</Label>
                <Select value={formatFilter} onValueChange={setFormatFilter}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Formats</SelectItem>
                    {uniqueFormats.map((format) => (
                      <SelectItem key={format} value={format}>
                        {format}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-gray-600">Location</Label>
                <Select value={locationFilter} onValueChange={setLocationFilter}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Locations</SelectItem>
                    {uniqueLocations.map((loc) => (
                      <SelectItem key={loc} value={loc}>
                        {loc}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-gray-600">&nbsp;</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setCategoryFilter('all');
                    setSubCategoryFilter('all');
                    setFormatFilter('all');
                    setLocationFilter('all');
                    setSearchQuery('');
                  }}
                  className="w-full h-9"
                >
                  Clear Filters
                </Button>
              </div>
            </div>

            {/* Active Filters Badge */}
            {(categoryFilter !== 'all' || subCategoryFilter !== 'all' || formatFilter !== 'all' || locationFilter !== 'all') && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Badge variant="outline" className="bg-blue-50">
                  Showing {filteredInventory.length} of {stats.totalItems} materials
                </Badge>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Material Inventory Table */}
      <Card className={`${neumorph.card} ${neumorph.roundedLg}`}>
        <CardHeader>
          <CardTitle>Material Inventory</CardTitle>
          <p className="text-sm text-gray-600">Manage and track all materials in your inventory. Click on a row to adjust quantity.</p>
        </CardHeader>
        <CardContent>
          {filteredInventory.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Package className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>No materials found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b bg-gray-50">
                  <tr>
                    <th className="pb-3 px-4 text-left font-semibold text-gray-700">SKU #</th>
                    <th className="pb-3 px-4 text-left font-semibold text-gray-700">Category</th>
                    <th className="pb-3 px-4 text-left font-semibold text-gray-700">Sub-Category</th>
                    <th className="pb-3 px-4 text-left font-semibold text-gray-700">Format</th>
                    <th className="pb-3 px-4 text-right font-semibold text-gray-700">Quantity / Units</th>
                    <th className="pb-3 px-4 text-left font-semibold text-gray-700">Location</th>
                    <th className="pb-3 px-4 text-center font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInventory.map((item) => (
                    <tr 
                      key={item.id} 
                      className="border-b hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={(e) => handleItemClick(item, e)}
                    >
                      <td className="py-4 px-4">
                        <div>
                          <p className="font-semibold text-sm">{item.sku_number || 'N/A'}</p>
                          {item.purity && (
                            <Badge variant="outline" className="mt-1 text-xs">
                              {item.purity}
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <span className="font-medium text-gray-900">{item.category}</span>
                      </td>
                      <td className="py-4 px-4">
                        <span className="text-gray-600">{item.sub_category || '-'}</span>
                      </td>
                      <td className="py-4 px-4">
                        <span className="text-gray-600">{item.format || '-'}</span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div>
                          <p className="font-bold text-green-700">
                            {useMetric 
                              ? `${(item.quantity_kg || 0).toFixed(2)} kg`
                              : `${(item.quantity_lbs || 0).toFixed(2)} lbs`
                            }
                          </p>
                          <p className="text-xs text-gray-500">
                            {useMetric
                              ? `${(item.quantity_lbs || 0).toFixed(2)} lbs`
                              : `${(item.quantity_kg || 0).toFixed(2)} kg`
                            }
                          </p>
                          {item.reserved_quantity > 0 && (
                            <Badge variant="outline" className="mt-1 bg-blue-50 text-blue-700 text-xs">
                              Reserved: {item.reserved_quantity}
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">{item.bin_location || 'Unassigned'}</span>
                          {item.zone && (
                            <Badge variant="outline" className="text-xs">
                              {item.zone}
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <Button
                          data-delete-button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => handleDeleteClick(item, e)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Quantity Modal */}
      <EditQuantityModal
        item={selectedItem}
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedItem(null);
        }}
        user={user}
        useMetric={useMetric}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600">Delete Inventory Item</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                This action cannot be undone. This will permanently delete the inventory item from the database.
              </AlertDescription>
            </Alert>

            {itemToDelete && (
              <div className="p-4 bg-gray-50 rounded-lg space-y-2">
                <p className="text-sm font-semibold">Item Details:</p>
                <p className="text-sm"><strong>SKU:</strong> {itemToDelete.sku_number || 'N/A'}</p>
                <p className="text-sm"><strong>Category:</strong> {itemToDelete.category}</p>
                <p className="text-sm"><strong>Quantity:</strong> {itemToDelete.quantity_kg?.toFixed(2)} kg</p>
                <p className="text-sm"><strong>Location:</strong> {itemToDelete.bin_location || 'Unassigned'}</p>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-sm font-semibold">
                Type <span className="text-red-600 font-mono">DELETE</span> to confirm:
              </Label>
              <Input
                value={deleteConfirmText}
                onChange={(e) => {
                  setDeleteConfirmText(e.target.value);
                  setDeleteError(null);
                }}
                placeholder="Type DELETE"
                className="font-mono"
              />
            </div>

            {deleteError && (
              <Alert variant="destructive">
                <AlertDescription>{deleteError}</AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setItemToDelete(null);
                setDeleteConfirmText('');
                setDeleteError(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={deleteMutation.isPending || deleteConfirmText !== 'DELETE'}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete Item'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}