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
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Package, 
  ArrowLeft, 
  Search,
  Split,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Trash2
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import TenantHeader from "@/components/TenantHeader";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function InventorySorting() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { tenantConfig, user } = useTenant();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [isSortingModalOpen, setIsSortingModalOpen] = useState(false);
  const [sortedItems, setSortedItems] = useState([{
    category: '',
    sub_category: '',
    product_type: '',
    format: '',
    purity: 'UNKNOWN',
    quality_grade: 'B',
    quantity_kg: '',
    quantity_lbs: '',
    bin_location: '',
    zone: ''
  }]);



  const { data: unsortedInventory = [], isLoading } = useQuery({
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

  const { data: skus = [] } = useQuery({
    queryKey: ['productSKUs', user?.tenant_id],
    queryFn: async () => {
      if (!user?.tenant_id) return [];
      return await recims.entities.ProductSKU.filter({ 
        tenant_id: user.tenant_id,
        status: 'active' 
      });
    },
    enabled: !!user?.tenant_id,
    initialData: [],
  });

  const sortInventoryMutation = useMutation({
    mutationFn: async ({ originalItem, sortedItems, notes }) => {
      // Mark original as sorting_in_progress
      await recims.entities.Inventory.update(originalItem.id, {
        sorting_status: 'sorting_in_progress'
      });

      const createdItems = [];
      
      // Create new inventory items for each sorted classification
      for (const sorted of sortedItems) {
        const quantityKg = parseFloat(sorted.quantity_kg) || 0;
        const quantityLbs = parseFloat(sorted.quantity_lbs) || 0;

        const newItem = await recims.entities.Inventory.create({
          inventory_id: `INV-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          tenant_id: user?.tenant_id,
          vendor_name: originalItem.vendor_name,
          item_name: `${sorted.category} - ${sorted.product_type || sorted.sub_category || 'Material'}`,
          item_description: `${sorted.category}${sorted.sub_category ? ' > ' + sorted.sub_category : ''}${sorted.product_type ? ' > ' + sorted.product_type : ''} | Format: ${sorted.format || 'N/A'} | Purity: ${sorted.purity}`,
          category: sorted.category,
          sub_category: sorted.sub_category,
          product_type: sorted.product_type,
          format: sorted.format,
          purity: sorted.purity,
          quality_grade: sorted.quality_grade,
          unit_of_measure: originalItem.unit_of_measure,
          quantity_on_hand: quantityKg || quantityLbs,
          quantity_kg: quantityKg,
          quantity_lbs: quantityLbs,
          reserved_quantity: 0,
          available_quantity: quantityKg || quantityLbs,
          bin_location: sorted.bin_location,
          zone: sorted.zone,
          sorting_status: 'classified',
          original_inventory_id: originalItem.id,
          status: 'available',
          cost_per_kg: originalItem.cost_per_kg,
          price_per_kg: originalItem.price_per_kg,
          received_date: originalItem.received_date,
          processed_date: new Date().toISOString().split('T')[0],
          lot_number: originalItem.lot_number,
          purchase_order_number: originalItem.purchase_order_number,
          sorting_notes: notes,
          sorted_by: user?.email,
          sorted_date: new Date().toISOString()
        });
        
        createdItems.push(newItem);
      }

      // Mark original as sorted and link to new items
      await recims.entities.Inventory.update(originalItem.id, {
        sorting_status: 'sorted',
        status: 'processing',
        sorted_into_ids: createdItems.map(item => item.id),
        sorted_by: user?.email,
        sorted_date: new Date().toISOString(),
        sorting_notes: notes
      });

      return createdItems;
    },
    onSuccess: (createdItems) => {
      queryClient.invalidateQueries({ queryKey: ['unsortedInventory'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      setIsSortingModalOpen(false);
      setSelectedItem(null);
      setSortedItems([{
        category: '',
        sub_category: '',
        product_type: '',
        format: '',
        purity: 'UNKNOWN',
        quality_grade: 'B',
        quantity_kg: '',
        quantity_lbs: '',
        bin_location: '',
        zone: ''
      }]);
      
      // Redirect to print labels for sorted items
      const ids = createdItems.map(item => item.id).join(',');
      setTimeout(() => {
        navigate(createPageUrl(`PrintInventoryLabels?ids=${ids}`));
      }, 1000);
    },
  });

  const handleStartSorting = (item) => {
    setSelectedItem(item);
    setIsSortingModalOpen(true);
    setSortedItems([{
      category: item.category !== 'UNKNOWN' ? item.category : '',
      sub_category: '',
      product_type: '',
      format: item.format !== 'Unknown' ? item.format : '',
      purity: 'UNKNOWN',
      quality_grade: item.quality_grade || 'B',
      quantity_kg: item.quantity_kg?.toString() || '',
      quantity_lbs: item.quantity_lbs?.toString() || '',
      bin_location: item.bin_location,
      zone: item.zone
    }]);
  };

  const handleAddSortedItem = () => {
    setSortedItems([...sortedItems, {
      category: selectedItem?.category !== 'UNKNOWN' ? selectedItem.category : '',
      sub_category: '',
      product_type: '',
      format: '',
      purity: 'UNKNOWN',
      quality_grade: 'B',
      quantity_kg: '',
      quantity_lbs: '',
      bin_location: selectedItem?.bin_location || '',
      zone: selectedItem?.zone || ''
    }]);
  };

  const handleRemoveSortedItem = (index) => {
    setSortedItems(sortedItems.filter((_, i) => i !== index));
  };

  const handleSortedItemChange = (index, field, value) => {
    const updated = [...sortedItems];
    updated[index] = { ...updated[index], [field]: value };
    
    // Reset dependent fields
    if (field === 'category') {
      updated[index].sub_category = '';
      updated[index].product_type = '';
    } else if (field === 'sub_category') {
      updated[index].product_type = '';
    }
    
    // Auto-convert weight
    if (field === 'quantity_kg' && value) {
      updated[index].quantity_lbs = (parseFloat(value) * 2.20462).toFixed(2);
    } else if (field === 'quantity_lbs' && value) {
      updated[index].quantity_kg = (parseFloat(value) * 0.453592).toFixed(2);
    }
    
    setSortedItems(updated);
  };

  const handleSubmitSorting = (e) => {
    e.preventDefault();
    
    const totalSortedKg = sortedItems.reduce((sum, item) => sum + (parseFloat(item.quantity_kg) || 0), 0);
    const totalSortedLbs = sortedItems.reduce((sum, item) => sum + (parseFloat(item.quantity_lbs) || 0), 0);
    
    const notes = `Original weight: ${selectedItem.quantity_kg?.toFixed(2)} kg / ${selectedItem.quantity_lbs?.toFixed(2)} lbs. Sorted weight: ${totalSortedKg.toFixed(2)} kg / ${totalSortedLbs.toFixed(2)} lbs. Variance: ${(totalSortedKg - selectedItem.quantity_kg).toFixed(2)} kg.`;
    
    sortInventoryMutation.mutate({
      originalItem: selectedItem,
      sortedItems,
      notes
    });
  };

  const filteredInventory = unsortedInventory.filter(item => {
    const matchesSearch = 
      item.inventory_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.vendor_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.bin_location?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  // Get unique values for dropdowns
  const uniqueCategories = [...new Set(skus.map(s => s.category))];
  const getSubCategories = (category) => {
    return [...new Set(skus.filter(s => s.category === category).map(s => s.sub_category))];
  };
  const getProductTypes = (category, subCategory) => {
    return [...new Set(skus.filter(s => s.category === category && s.sub_category === subCategory).map(s => s.product_type))];
  };
  const getFormats = (category) => {
    return [...new Set(skus.filter(s => s.category === category).map(s => s.format))];
  };

  const totalUnsortedWeight = unsortedInventory.reduce((sum, i) => sum + (i.quantity_kg || 0), 0);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <TenantHeader />
      
      <div className="flex items-center gap-3 mb-6">
        <Link to={createPageUrl("InventoryManagement")}>
          <Button variant="outline" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Split className="w-7 h-7 text-orange-600" />
            Inventory Sorting
          </h1>
          <p className="text-sm text-gray-600">Classify and sort unidentified materials into proper SKUs</p>
        </div>
        <Badge className="bg-orange-100 text-orange-700">
          {unsortedInventory.length} items need sorting
        </Badge>
      </div>

      {/* Info Alert */}
      <Alert className="mb-6 bg-blue-50 border-blue-200">
        <AlertTriangle className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-800">
          <strong>Sorting Workflow:</strong> Materials with UNKNOWN fields are held here for proper classification. 
          You can split one item into multiple SKUs or adjust weights to correct receiving errors.
        </AlertDescription>
      </Alert>

      {/* Stats */}
      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-orange-100">
                <Package className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{unsortedInventory.length}</p>
                <p className="text-xs text-gray-500">Items to Sort</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-blue-100">
                <Package className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{totalUnsortedWeight.toFixed(0)} kg</p>
                <p className="text-xs text-gray-500">Total Weight</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-green-100">
                <CheckCircle2 className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">Ready</p>
                <p className="text-xs text-gray-500">Start Sorting</p>
              </div>
            </div>
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
              placeholder="Search unsorted inventory..."
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Unsorted Inventory List */}
      <Card>
        <CardHeader>
          <CardTitle>Unsorted Materials</CardTitle>
          <p className="text-sm text-gray-600">Materials awaiting classification and sorting</p>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto"></div>
            </div>
          ) : filteredInventory.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <CheckCircle2 className="w-16 h-16 mx-auto mb-4 text-green-400" />
              <p className="font-semibold">All caught up!</p>
              <p className="text-sm">No materials need sorting at this time</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredInventory.map((item) => (
                <div key={item.id} className="p-4 border-2 border-orange-200 rounded-lg bg-orange-50">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <p className="font-bold text-lg">{item.inventory_id}</p>
                        <Badge variant="outline" className="bg-orange-100 text-orange-700">
                          Needs Sorting
                        </Badge>
                      </div>
                      <div className="grid md:grid-cols-3 gap-3 text-sm">
                        <div>
                          <span className="text-gray-600">Vendor:</span>
                          <p className="font-semibold">{item.vendor_name || 'Unknown'}</p>
                        </div>
                        <div>
                          <span className="text-gray-600">Category:</span>
                          <p className="font-semibold">{item.category}</p>
                        </div>
                        <div>
                          <span className="text-gray-600">Original Weight:</span>
                          <p className="font-semibold">{item.quantity_kg?.toFixed(2)} kg / {item.quantity_lbs?.toFixed(2)} lbs</p>
                        </div>
                        {item.sub_category && (
                          <div>
                            <span className="text-gray-600">Sub-Category:</span>
                            <p className="font-semibold">{item.sub_category}</p>
                          </div>
                        )}
                        {item.format && (
                          <div>
                            <span className="text-gray-600">Format:</span>
                            <p className="font-semibold">{item.format}</p>
                          </div>
                        )}
                        <div>
                          <span className="text-gray-600">Location:</span>
                          <p className="font-semibold">{item.bin_location || 'Unassigned'}</p>
                        </div>
                      </div>
                      {item.notes && (
                        <p className="text-xs text-gray-600 mt-2 italic">{item.notes}</p>
                      )}
                    </div>
                    <Button
                      onClick={() => handleStartSorting(item)}
                      className="bg-orange-600 hover:bg-orange-700 gap-2"
                    >
                      <Split className="w-4 h-4" />
                      Sort & Classify
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sorting Modal */}
      <Dialog open={isSortingModalOpen} onOpenChange={setIsSortingModalOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Split className="w-5 h-5 text-orange-600" />
              Sort & Classify: {selectedItem?.inventory_id}
            </DialogTitle>
            <p className="text-sm text-gray-600">
              Original: {selectedItem?.quantity_kg?.toFixed(2)} kg / {selectedItem?.quantity_lbs?.toFixed(2)} lbs
            </p>
          </DialogHeader>

          <form onSubmit={handleSubmitSorting} className="space-y-6">
            {sortedItems.map((sorted, index) => (
              <Card key={index} className="border-2 border-blue-200">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Item #{index + 1}</CardTitle>
                    {sortedItems.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveSortedItem(index)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Category *</Label>
                      <Select
                        value={sorted.category}
                        onValueChange={(value) => handleSortedItemChange(index, 'category', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          {uniqueCategories.map((cat) => (
                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Sub-Category</Label>
                      <Select
                        value={sorted.sub_category}
                        onValueChange={(value) => handleSortedItemChange(index, 'sub_category', value)}
                        disabled={!sorted.category}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select sub-category" />
                        </SelectTrigger>
                        <SelectContent>
                          {getSubCategories(sorted.category).map((sub) => (
                            <SelectItem key={sub} value={sub}>{sub}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Product Type</Label>
                      <Select
                        value={sorted.product_type}
                        onValueChange={(value) => handleSortedItemChange(index, 'product_type', value)}
                        disabled={!sorted.sub_category}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select product type" />
                        </SelectTrigger>
                        <SelectContent>
                          {getProductTypes(sorted.category, sorted.sub_category).map((type) => (
                            <SelectItem key={type} value={type}>{type}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Format</Label>
                      <Select
                        value={sorted.format}
                        onValueChange={(value) => handleSortedItemChange(index, 'format', value)}
                        disabled={!sorted.category}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select format" />
                        </SelectTrigger>
                        <SelectContent>
                          {getFormats(sorted.category).map((fmt) => (
                            <SelectItem key={fmt} value={fmt}>{fmt}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Purity *</Label>
                      <Select
                        value={sorted.purity}
                        onValueChange={(value) => handleSortedItemChange(index, 'purity', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="100%">100%</SelectItem>
                          <SelectItem value="90%">90%</SelectItem>
                          <SelectItem value="80%">80%</SelectItem>
                          <SelectItem value="70%">70%</SelectItem>
                          <SelectItem value="60%">60%</SelectItem>
                          <SelectItem value="50%">50%</SelectItem>
                          <SelectItem value="40%">40%</SelectItem>
                          <SelectItem value="MIXED">MIXED</SelectItem>
                          <SelectItem value="UNKNOWN">UNKNOWN</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Quality Grade *</Label>
                      <Select
                        value={sorted.quality_grade}
                        onValueChange={(value) => handleSortedItemChange(index, 'quality_grade', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="A">A - Premium</SelectItem>
                          <SelectItem value="B">B - Standard</SelectItem>
                          <SelectItem value="C">C - Low Grade</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Weight (kg) *</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={sorted.quantity_kg}
                        onChange={(e) => handleSortedItemChange(index, 'quantity_kg', e.target.value)}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Weight (lbs) *</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={sorted.quantity_lbs}
                        onChange={(e) => handleSortedItemChange(index, 'quantity_lbs', e.target.value)}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Bin Location</Label>
                      <Input
                        value={sorted.bin_location}
                        onChange={(e) => handleSortedItemChange(index, 'bin_location', e.target.value)}
                        placeholder="e.g., A-101"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Zone</Label>
                      <Input
                        value={sorted.zone}
                        onChange={(e) => handleSortedItemChange(index, 'zone', e.target.value)}
                        placeholder="e.g., ZONE001"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            <Button
              type="button"
              variant="outline"
              onClick={handleAddSortedItem}
              className="w-full gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Another Classification
            </Button>

            {/* Total Weight Summary */}
            <Card className="bg-gray-50">
              <CardContent className="p-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Original Weight</p>
                    <p className="text-lg font-bold">
                      {selectedItem?.quantity_kg?.toFixed(2)} kg / {selectedItem?.quantity_lbs?.toFixed(2)} lbs
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Sorted Total Weight</p>
                    <p className="text-lg font-bold">
                      {sortedItems.reduce((sum, s) => sum + (parseFloat(s.quantity_kg) || 0), 0).toFixed(2)} kg / 
                      {sortedItems.reduce((sum, s) => sum + (parseFloat(s.quantity_lbs) || 0), 0).toFixed(2)} lbs
                    </p>
                    {Math.abs(sortedItems.reduce((sum, s) => sum + (parseFloat(s.quantity_kg) || 0), 0) - selectedItem?.quantity_kg) > 0.1 && (
                      <p className="text-xs text-orange-600 mt-1">
                        Variance: {(sortedItems.reduce((sum, s) => sum + (parseFloat(s.quantity_kg) || 0), 0) - selectedItem?.quantity_kg).toFixed(2)} kg
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsSortingModalOpen(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={sortInventoryMutation.isPending}
                className="flex-1 bg-green-600 hover:bg-green-700 gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                {sortInventoryMutation.isPending ? 'Sorting...' : 'Complete Sorting'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}