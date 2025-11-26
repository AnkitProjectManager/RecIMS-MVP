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
import { 
  ArrowLeft, 
  Plus, 
  Edit, 
  Search,
  Package,
  Save,
  X
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export default function ManageMaterialCategories() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showDialog, setShowDialog] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [formData, setFormData] = useState({
    category_name: '',
    sub_category: '',
    hts_code: '',
    hts_description: '',
    origin_country: 'US',
    color_primary: '#10b981',
    color_secondary: '#34d399',
    material_type: 'metal',
    description: ''
  });

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['materialCategories'],
    queryFn: () => recims.entities.MaterialCategory.list('-created_date', 500),
    initialData: [],
  });

  const createCategoryMutation = useMutation({
    mutationFn: (data) => recims.entities.MaterialCategory.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materialCategories'] });
      setSuccess("Material category created successfully");
      setShowDialog(false);
      resetForm();
      setTimeout(() => setSuccess(null), 3000);
    },
    onError: (err) => {
      setError(err.message || "Failed to create category");
      setTimeout(() => setError(null), 3000);
    }
  });

  const updateCategoryMutation = useMutation({
    mutationFn: ({ id, data }) => recims.entities.MaterialCategory.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materialCategories'] });
      setSuccess("Material category updated successfully");
      setShowDialog(false);
      setEditingCategory(null);
      resetForm();
      setTimeout(() => setSuccess(null), 3000);
    },
    onError: (err) => {
      setError(err.message || "Failed to update category");
      setTimeout(() => setError(null), 3000);
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setError(null);

    if (!formData.category_name) {
      setError("Category name is required");
      return;
    }

    if (editingCategory) {
      updateCategoryMutation.mutate({ id: editingCategory.id, data: formData });
    } else {
      createCategoryMutation.mutate(formData);
    }
  };

  const handleEdit = (category) => {
    setEditingCategory(category);
    setFormData({
      category_name: category.category_name || '',
      sub_category: category.sub_category || '',
      hts_code: category.hts_code || '',
      hts_description: category.hts_description || '',
      origin_country: category.origin_country || 'US',
      color_primary: category.color_primary || '#10b981',
      color_secondary: category.color_secondary || '#34d399',
      material_type: category.material_type || 'metal',
      description: category.description || ''
    });
    setShowDialog(true);
  };

  const resetForm = () => {
    setFormData({
      category_name: '',
      sub_category: '',
      hts_code: '',
      hts_description: '',
      origin_country: 'US',
      color_primary: '#10b981',
      color_secondary: '#34d399',
      material_type: 'metal',
      description: ''
    });
    setEditingCategory(null);
  };

  const handleOpenDialog = () => {
    resetForm();
    setShowDialog(true);
  };

  const handleCloseDialog = () => {
    setShowDialog(false);
    setEditingCategory(null);
    resetForm();
  };

  const filteredCategories = categories.filter(cat => {
    const search = searchQuery.toLowerCase();
    return (
      cat.category_name?.toLowerCase().includes(search) ||
      cat.sub_category?.toLowerCase().includes(search) ||
      cat.hts_code?.toLowerCase().includes(search) ||
      cat.material_type?.toLowerCase().includes(search)
    );
  });

  const getMaterialTypeBadge = (type) => {
    const colors = {
      plastic: 'bg-blue-100 text-blue-700',
      metal: 'bg-gray-100 text-gray-700',
      mixed: 'bg-purple-100 text-purple-700',
      other: 'bg-orange-100 text-orange-700'
    };
    return colors[type] || colors.other;
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="sticky top-12 z-40 bg-white py-4 -mt-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to={createPageUrl("SuperAdmin")}>
              <Button variant="outline" size="icon">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Package className="w-7 h-7 text-green-600" />
                Material Categories & HTS Codes
              </h1>
              <p className="text-sm text-gray-600">Define materials, sub-categories, and export/import codes</p>
            </div>
          </div>
          <Button onClick={handleOpenDialog} className="bg-green-600 hover:bg-green-700 gap-2">
            <Plus className="w-4 h-4" />
            New Category
          </Button>
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

      {/* Search */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by category, sub-category, HTS code, or material type..."
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Categories List */}
      <Card>
        <CardHeader>
          <CardTitle>Material Categories ({filteredCategories.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
            </div>
          ) : filteredCategories.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Package className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-semibold mb-2">No categories found</p>
              <p className="text-sm">Create your first material category to get started</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b bg-gray-50">
                  <tr>
                    <th className="pb-3 px-4 text-left font-semibold text-gray-700">Category</th>
                    <th className="pb-3 px-4 text-left font-semibold text-gray-700">Sub-Category</th>
                    <th className="pb-3 px-4 text-left font-semibold text-gray-700">HTS Code</th>
                    <th className="pb-3 px-4 text-left font-semibold text-gray-700">Material Type</th>
                    <th className="pb-3 px-4 text-left font-semibold text-gray-700">Origin</th>
                    <th className="pb-3 px-4 text-left font-semibold text-gray-700">Colors</th>
                    <th className="pb-3 px-4 text-center font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCategories.map((category) => (
                    <tr key={category.id} className="border-b hover:bg-gray-50 transition-colors">
                      <td className="py-4 px-4">
                        <span className="font-semibold text-gray-900">{category.category_name}</span>
                      </td>
                      <td className="py-4 px-4 text-gray-600">
                        {category.sub_category || '-'}
                      </td>
                      <td className="py-4 px-4">
                        <span className="font-mono text-sm">{category.hts_code || '-'}</span>
                      </td>
                      <td className="py-4 px-4">
                        <Badge className={getMaterialTypeBadge(category.material_type)}>
                          {category.material_type || 'other'}
                        </Badge>
                      </td>
                      <td className="py-4 px-4">
                        <Badge variant="outline">{category.origin_country || '-'}</Badge>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex gap-2">
                          {category.color_primary && (
                            <div 
                              className="w-6 h-6 rounded border-2 border-gray-300" 
                              style={{ backgroundColor: category.color_primary }}
                              title="Primary Color"
                            />
                          )}
                          {category.color_secondary && (
                            <div 
                              className="w-6 h-6 rounded border-2 border-gray-300" 
                              style={{ backgroundColor: category.color_secondary }}
                              title="Secondary Color"
                            />
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center justify-center gap-2">
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => handleEdit(category)}
                            title="Edit Category"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
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

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={handleCloseDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? 'Edit Material Category' : 'Create Material Category'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category_name">Category Name *</Label>
                <Input
                  id="category_name"
                  value={formData.category_name}
                  onChange={(e) => setFormData({...formData, category_name: e.target.value})}
                  placeholder="e.g., Steel Plate, Aluminum Sheet"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sub_category">Sub-Category</Label>
                <Input
                  id="sub_category"
                  value={formData.sub_category}
                  onChange={(e) => setFormData({...formData, sub_category: e.target.value})}
                  placeholder="e.g., Hot Rolled, Cold Rolled"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="hts_code">HTS Code</Label>
                <Input
                  id="hts_code"
                  value={formData.hts_code}
                  onChange={(e) => setFormData({...formData, hts_code: e.target.value})}
                  placeholder="e.g., 7208.10"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="origin_country">Origin Country</Label>
                <Select
                  value={formData.origin_country}
                  onValueChange={(value) => setFormData({...formData, origin_country: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="US">United States</SelectItem>
                    <SelectItem value="CA">Canada</SelectItem>
                    <SelectItem value="CN">China</SelectItem>
                    <SelectItem value="IN">India</SelectItem>
                    <SelectItem value="PK">Pakistan</SelectItem>
                    <SelectItem value="GB">United Kingdom</SelectItem>
                    <SelectItem value="EU">European Union</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="material_type">Material Type</Label>
                <Select
                  value={formData.material_type}
                  onValueChange={(value) => setFormData({...formData, material_type: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="plastic">Plastic</SelectItem>
                    <SelectItem value="metal">Metal</SelectItem>
                    <SelectItem value="mixed">Mixed</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="color_primary">Primary Color</Label>
                <div className="flex gap-2">
                  <Input
                    id="color_primary"
                    type="color"
                    value={formData.color_primary}
                    onChange={(e) => setFormData({...formData, color_primary: e.target.value})}
                    className="w-16 h-10"
                  />
                  <Input
                    value={formData.color_primary}
                    onChange={(e) => setFormData({...formData, color_primary: e.target.value})}
                    placeholder="#10b981"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="color_secondary">Secondary Color</Label>
                <div className="flex gap-2">
                  <Input
                    id="color_secondary"
                    type="color"
                    value={formData.color_secondary}
                    onChange={(e) => setFormData({...formData, color_secondary: e.target.value})}
                    className="w-16 h-10"
                  />
                  <Input
                    value={formData.color_secondary}
                    onChange={(e) => setFormData({...formData, color_secondary: e.target.value})}
                    placeholder="#34d399"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="hts_description">HTS Description</Label>
              <Textarea
                id="hts_description"
                value={formData.hts_description}
                onChange={(e) => setFormData({...formData, hts_description: e.target.value})}
                placeholder="Harmonized Tariff Schedule description"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Notes / Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                placeholder="Additional notes about this material category"
                rows={3}
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="button" variant="outline" onClick={handleCloseDialog} className="flex-1">
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={createCategoryMutation.isPending || updateCategoryMutation.isPending}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                <Save className="w-4 h-4 mr-2" />
                {editingCategory ? 'Update Category' : 'Create Category'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}