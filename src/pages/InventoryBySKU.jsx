import React, { useState } from "react";
import { recims } from "@/api/recimsClient";
import { useQuery } from "@tanstack/react-query";
import { useTenant } from "@/components/TenantContext";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Package, Search, Layers, MapPin } from "lucide-react";

export default function InventoryBySKU() {
  const { tenantConfig, user } = useTenant();
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');



  const { data: inventory = [] } = useQuery({
    queryKey: ['inventory', user?.tenant_id],
    queryFn: async () => {
      if (!user?.tenant_id) return [];
      return await recims.entities.Inventory.filter({
        tenant_id: user.tenant_id
      }, '-created_date', 200);
    },
    enabled: !!user?.tenant_id,
    initialData: [],
  });

  // Filter inventory
  const filteredInventory = inventory.filter(item => {
    const matchesSearch = !searchQuery || 
      item.item_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.sub_category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.product_type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.sku_number?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    
    return matchesSearch && matchesCategory && matchesStatus;
  });

  // Group by category, then sub-category, then product type
  const groupedInventory = filteredInventory.reduce((acc, item) => {
    const category = item.category || 'Uncategorized';
    const subCategory = item.sub_category || 'No Sub-Category';
    const productType = item.product_type || 'No Product Type';
    
    if (!acc[category]) {
      acc[category] = {};
    }
    if (!acc[category][subCategory]) {
      acc[category][subCategory] = {};
    }
    if (!acc[category][subCategory][productType]) {
      acc[category][subCategory][productType] = [];
    }
    
    acc[category][subCategory][productType].push(item);
    return acc;
  }, {});

  // Calculate totals
  const totalItems = filteredInventory.length;
  const totalQuantityKg = filteredInventory.reduce((sum, item) => {
    const qtyKg = item.unit_of_measure === 'kg' 
      ? item.quantity_on_hand 
      : item.quantity_on_hand * 0.453592;
    return sum + qtyKg;
  }, 0);
  const totalValue = filteredInventory.reduce((sum, item) => sum + (item.total_value || 0), 0);
  const uniqueProducts = new Set(filteredInventory.map(i => i.product_type)).size;

  // Get unique categories
  const categories = [...new Set(inventory.map(i => i.category))].filter(Boolean);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link to={createPageUrl("InventoryManagement")}>
          <Button variant="outline" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Inventory by Product SKU</h1>
          <p className="text-sm text-gray-600">View inventory organized by product categories and types</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Package className="w-8 h-8 text-blue-600" />
              <div>
                <p className="text-2xl font-bold">{totalItems}</p>
                <p className="text-xs text-gray-600">Total SKUs</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Layers className="w-8 h-8 text-green-600" />
              <div>
                <p className="text-2xl font-bold">{uniqueProducts}</p>
                <p className="text-xs text-gray-600">Product Types</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Package className="w-8 h-8 text-orange-600" />
              <div>
                <p className="text-xl font-bold">{totalQuantityKg.toFixed(0)} kg</p>
                <p className="text-xs text-gray-600">Total Weight</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Package className="w-8 h-8 text-purple-600" />
              <div>
                <p className="text-xl font-bold">${totalValue.toFixed(2)}</p>
                <p className="text-xs text-gray-600">Total Value</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="grid md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, category, SKU..."
                className="pl-10"
              />
            </div>

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="available">Available</SelectItem>
                <SelectItem value="low_stock">Low Stock</SelectItem>
                <SelectItem value="out_of_stock">Out of Stock</SelectItem>
                <SelectItem value="reserved">Reserved</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Grouped Inventory Display */}
      <div className="space-y-6">
        {Object.entries(groupedInventory).length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center text-gray-500">
              <Package className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>No inventory found matching your filters</p>
            </CardContent>
          </Card>
        ) : (
          Object.entries(groupedInventory).map(([category, subCategories]) => (
            <Card key={category} className="border-2 border-purple-200">
              <CardHeader className="bg-purple-50">
                <CardTitle className="flex items-center gap-2">
                  <Layers className="w-5 h-5 text-purple-600" />
                  {category}
                  <Badge variant="outline" className="ml-auto">
                    {Object.values(subCategories).flatMap(v => Object.values(v)).flat().length} items
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="space-y-4">
                  {Object.entries(subCategories).map(([subCategory, productTypes]) => (
                    <div key={subCategory} className="border rounded-lg p-4 bg-gray-50">
                      <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <Package className="w-4 h-4" />
                        {subCategory}
                        <Badge variant="outline" className="ml-2">
                          {Object.values(productTypes).flat().length} items
                        </Badge>
                      </h3>

                      <div className="space-y-3">
                        {Object.entries(productTypes).map(([productType, items]) => {
                          const totalQty = items.reduce((sum, item) => {
                            const qtyKg = item.unit_of_measure === 'kg' 
                              ? item.quantity_on_hand 
                              : item.quantity_on_hand * 0.453592;
                            return sum + qtyKg;
                          }, 0);

                          return (
                            <div key={productType} className="border rounded-lg p-3 bg-white">
                              <div className="flex items-center justify-between mb-2">
                                <h4 className="font-semibold text-gray-800">{productType}</h4>
                                <div className="text-sm text-gray-600">
                                  Total: {totalQty.toFixed(2)} kg
                                </div>
                              </div>

                              <div className="space-y-2">
                                {items.map((item) => (
                                  <div
                                    key={item.id}
                                    className="flex items-center justify-between p-2 bg-blue-50 rounded hover:bg-blue-100 transition-colors"
                                  >
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2">
                                        <p className="text-sm font-semibold text-gray-900">{item.item_name}</p>
                                        {item.sku_number && (
                                          <Badge variant="outline" className="text-xs">
                                            SKU: {item.sku_number}
                                          </Badge>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-3 mt-1">
                                        <p className="text-xs text-gray-600">
                                          Purity: {item.purity || 'N/A'}
                                        </p>
                                        <p className="text-xs text-gray-600 flex items-center gap-1">
                                          <MapPin className="w-3 h-3" />
                                          {item.zone}/{item.bin_location}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="text-right mr-3">
                                      <p className="font-bold text-gray-900">
                                        {item.quantity_on_hand} {item.unit_of_measure}
                                      </p>
                                      <p className="text-xs text-gray-600">
                                        Avail: {item.available_quantity}
                                      </p>
                                    </div>
                                    <Badge className={
                                      item.status === 'available' ? 'bg-green-100 text-green-700' :
                                      item.status === 'low_stock' ? 'bg-yellow-100 text-yellow-700' :
                                      item.status === 'out_of_stock' ? 'bg-red-100 text-red-700' :
                                      'bg-gray-100 text-gray-700'
                                    }>
                                      {item.status}
                                    </Badge>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}