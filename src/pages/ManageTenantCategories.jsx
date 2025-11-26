import React, { useState } from "react";
import TenantHeader from "@/components/TenantHeader";
import { recims } from "@/api/recimsClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTenant } from "@/components/TenantContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Edit, Save, X, ArrowUp, ArrowDown } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const TENANT_TEMPLATES = {
  'min-tech': [
    {
      category_name: 'Mixed Plastics',
      product_category: 'Plastics',
      category_type: 'predefined',
      sub_categories: ['PET', 'HDPE', 'LDPE', 'PP', 'PS'],
      load_type_mapping: 'PLASTIC',
      description: 'Various plastic types'
    },
    {
      category_name: 'Ferrous Metals',
      product_category: 'Ferrous Metals',
      category_type: 'predefined',
      sub_categories: ['Steel', 'Iron', 'Cast Iron'],
      load_type_mapping: 'METAL',
      description: 'Iron-based metals'
    },
    {
      category_name: 'Non-Ferrous Metals',
      product_category: 'Non-Ferrous Metals',
      category_type: 'predefined',
      sub_categories: ['Aluminum', 'Copper', 'Brass', 'Stainless Steel'],
      load_type_mapping: 'METAL',
      description: 'Non-iron metals'
    }
  ],
  'connecticut-metals': [
    {
      category_name: 'Aluminum foil and laminate scrap',
      product_category: 'Non-Ferrous Metals',
      category_type: 'predefined',
      sub_categories: ['Foil', 'Laminate', 'Packaging'],
      load_type_mapping: 'MIXED',
      description: 'Aluminum foil and laminate materials'
    },
    {
      category_name: 'Copper scrap',
      product_category: 'Non-Ferrous Metals',
      category_type: 'predefined',
      sub_categories: ['Bare Bright', '#1 Copper', '#2 Copper', 'Insulated Wire'],
      load_type_mapping: 'MIXED',
      description: 'Various copper grades'
    },
    {
      category_name: 'Stainless steel scrap',
      product_category: 'Non-Ferrous Metals',
      category_type: 'predefined',
      sub_categories: ['304', '316', '430', 'Mixed SS'],
      load_type_mapping: 'MIXED',
      description: 'Stainless steel materials'
    },
    {
      category_name: 'Aluminum scrap',
      product_category: 'Non-Ferrous Metals',
      category_type: 'predefined',
      sub_categories: ['Extrusion', 'Sheet', 'Cast', 'UBC'],
      load_type_mapping: 'MIXED',
      description: 'Various aluminum forms'
    },
    {
      category_name: 'Brass and bronze scrap',
      product_category: 'Non-Ferrous Metals',
      category_type: 'predefined',
      sub_categories: ['Yellow Brass', 'Red Brass', 'Bronze', 'Plumbing Brass'],
      load_type_mapping: 'MIXED',
      description: 'Brass and bronze materials'
    }
  ]
};

export default function ManageTenantCategories() {
  const queryClient = useQueryClient();
  const { user } = useTenant();
  
  const [selectedTenantId, setSelectedTenantId] = useState(user?.tenant_id || '');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const [formData, setFormData] = useState({
    category_name: '',
    product_category: '',
    category_type: 'predefined',
    sub_categories: [],
    load_type_mapping: '',
    description: '',
    sort_order: 0
  });

  const [customLoadType, setCustomLoadType] = useState('');
  const [newLoadType, setNewLoadType] = useState('');
  const [editingLoadTypes, setEditingLoadTypes] = useState(false);
  const [tempLoadTypes, setTempLoadTypes] = useState([]);

  const [subCategoryInput, setSubCategoryInput] = useState('');

  const normalizeCategoryPayload = React.useCallback((input) => {
    const categoryName = (input.category_name || '').trim();
    const productCategory = (input.product_category || '').trim();
    const description = (input.description || '').trim();
    const loadType = (input.load_type_mapping || '').trim().toUpperCase();
    const sortOrderRaw = Number(input.sort_order);
    const sortOrder = Number.isFinite(sortOrderRaw) ? sortOrderRaw : 0;

    const subCategories = Array.isArray(input.sub_categories)
      ? input.sub_categories
          .map((entry) => (entry || '').trim())
          .filter(Boolean)
      : [];

    const uniqueSubCategories = Array.from(new Set(subCategories));

    return {
      category_name: categoryName,
      product_category: productCategory,
      category_type: input.category_type === 'custom' ? 'custom' : 'predefined',
      sub_categories: uniqueSubCategories,
      load_type_mapping: loadType,
      description,
      sort_order: sortOrder,
    };
  }, []);

  const { data: categories = [] } = useQuery({
    queryKey: ['tenantCategories', selectedTenantId],
    queryFn: async () => {
      if (!selectedTenantId) return [];
      return await recims.entities.TenantCategory.filter(
        {
          tenant_id: selectedTenantId,
          is_active: true
        },
        'sort_order'
      );
    },
    enabled: !!selectedTenantId,
    initialData: [],
  });

  const createCategoryMutation = useMutation({
    mutationFn: async (data) => {
      if (!selectedTenantId) {
        throw new Error('Select a tenant before creating categories');
      }
      return await recims.entities.TenantCategory.create({
        ...data,
        tenant_id: selectedTenantId,
        is_active: true
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenantCategories', selectedTenantId] });
      setShowAddDialog(false);
      resetForm();
      setSuccess('Category created successfully');
      setTimeout(() => setSuccess(null), 3000);
    },
    onError: (err) => {
      setError(err.message || 'Failed to create category');
      setTimeout(() => setError(null), 5000);
    }
  });

  const updateCategoryMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      return await recims.entities.TenantCategory.update(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenantCategories', selectedTenantId] });
      setEditingCategory(null);
      resetForm();
      setSuccess('Category updated successfully');
      setTimeout(() => setSuccess(null), 3000);
    },
    onError: (err) => {
      setError(err.message || 'Failed to update category');
      setTimeout(() => setError(null), 5000);
    }
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (id) => {
      return await recims.entities.TenantCategory.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenantCategories', selectedTenantId] });
      setSuccess('Category deleted successfully');
      setTimeout(() => setSuccess(null), 3000);
    },
    onError: (err) => {
      setError(err.message || 'Failed to delete category');
      setTimeout(() => setError(null), 5000);
    }
  });

  const { data: tenants = [] } = useQuery({
    queryKey: ['tenants'],
    queryFn: async () => {
      return await recims.entities.Tenant.list();
    },
    initialData: [],
  });

  React.useEffect(() => {
    if (!selectedTenantId) {
      if (user?.tenant_id) {
        setSelectedTenantId(user.tenant_id);
      } else if (tenants.length > 0) {
        setSelectedTenantId(tenants[0].tenant_id);
      }
    }
  }, [selectedTenantId, user?.tenant_id, tenants]);

  React.useEffect(() => {
    setEditingLoadTypes(false);
    setTempLoadTypes([]);
    setNewLoadType('');
  }, [selectedTenantId]);

  const tenantOptions = React.useMemo(() => {
    return [...tenants].sort((a, b) => {
      const nameA = (a.display_name || a.name || '').toString().toLowerCase();
      const nameB = (b.display_name || b.name || '').toString().toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [tenants]);

  const activeTenant = React.useMemo(() => {
    return tenantOptions.find((tenant) => tenant.tenant_id === selectedTenantId) || null;
  }, [tenantOptions, selectedTenantId]);

  const templateKey = React.useMemo(() => {
    if (!activeTenant) return '';
    const rawCode = (activeTenant.code || activeTenant.tenant_code || '').toString().toLowerCase();
    return rawCode.replace(/_/g, '-');
  }, [activeTenant]);

  const availableTemplates = React.useMemo(() => {
    return TENANT_TEMPLATES[templateKey] || [];
  }, [templateKey]);

  const availableLoadTypes = React.useMemo(() => {
    if (!activeTenant?.default_load_types || activeTenant.default_load_types.length === 0) {
      return ['METAL', 'PLASTIC', 'MIXED', 'OTHER'];
    }
    return activeTenant.default_load_types.map((type) => type.toString().toUpperCase());
  }, [activeTenant]);

  const activeTenantName = activeTenant?.display_name || activeTenant?.name || 'Tenant';

  const updateTenantMutation = useMutation({
    mutationFn: async ({ tenantId, data }) => {
      return await recims.entities.Tenant.update(tenantId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      setEditingLoadTypes(false);
      setSuccess('Load types updated successfully');
      setTimeout(() => setSuccess(null), 3000);
    },
    onError: (err) => {
      setError(err.message || 'Failed to update load types');
      setTimeout(() => setError(null), 5000);
    }
  });

  const resetForm = () => {
    setFormData({
      category_name: '',
      product_category: '',
      category_type: 'predefined',
      sub_categories: [],
      load_type_mapping: '',
      description: '',
      sort_order: 0
    });
    setSubCategoryInput('');
    setCustomLoadType('');
  };

  const handleAddSubCategory = () => {
    if (!subCategoryInput.trim()) return;
    
    if (formData.sub_categories.includes(subCategoryInput.trim())) {
      setError('Sub-category already exists');
      setTimeout(() => setError(null), 3000);
      return;
    }

    setFormData(prev => ({
      ...prev,
      sub_categories: [...prev.sub_categories, subCategoryInput.trim()]
    }));
    setSubCategoryInput('');
  };

  const handleRemoveSubCategory = (index) => {
    setFormData(prev => ({
      ...prev,
      sub_categories: prev.sub_categories.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!formData.category_name.trim()) {
      setError('Category name is required');
      setTimeout(() => setError(null), 3000);
      return;
    }

    if (!selectedTenantId) {
      setError('Select a tenant before saving categories');
      setTimeout(() => setError(null), 3000);
      return;
    }

    if (!(formData.load_type_mapping || '').trim()) {
      setError('Load type mapping is required');
      setTimeout(() => setError(null), 3000);
      return;
    }

    const normalizedPayload = normalizeCategoryPayload(formData);

    if (editingCategory) {
      updateCategoryMutation.mutate({
        id: editingCategory.id,
        data: normalizedPayload
      });
    } else {
      createCategoryMutation.mutate(normalizedPayload);
    }
  };

  const handleEdit = (category) => {
    setEditingCategory(category);
    setFormData({
      category_name: category.category_name,
      product_category: category.product_category || '',
      category_type: category.category_type,
      sub_categories: category.sub_categories || [],
      load_type_mapping: category.load_type_mapping,
      description: category.description || '',
      sort_order: category.sort_order || 0
    });
    setShowAddDialog(true);
  };

  const handleDelete = (category) => {
    if (window.confirm(`Delete category "${category.category_name}"? This cannot be undone.`)) {
      deleteCategoryMutation.mutate(category.id);
    }
  };

  const handleReorder = async (category, direction) => {
    const currentIndex = categories.findIndex(c => c.id === category.id);
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

    if (newIndex < 0 || newIndex >= categories.length) return;

    const otherCategory = categories[newIndex];

    await updateCategoryMutation.mutateAsync({
      id: category.id,
      data: { sort_order: otherCategory.sort_order }
    });

    await updateCategoryMutation.mutateAsync({
      id: otherCategory.id,
      data: { sort_order: category.sort_order }
    });
  };

  const handleAddLoadType = () => {
    if (!newLoadType.trim()) return;

    const normalized = newLoadType.trim().toUpperCase();
    const currentNormalized = tempLoadTypes.map(t => t.toUpperCase());

    if (currentNormalized.includes(normalized)) {
      setError('This load type already exists');
      setTimeout(() => setError(null), 3000);
      return;
    }

    setTempLoadTypes(prev => [...prev, normalized]);
    setNewLoadType('');
  };

  const handleRemoveLoadType = (index) => {
    setTempLoadTypes(prev => prev.filter((_, i) => i !== index));
  };

  const handleSaveLoadTypes = () => {
    if (tempLoadTypes.length === 0) {
      setError('At least one load type is required');
      setTimeout(() => setError(null), 3000);
      return;
    }

    if (!activeTenant) {
      setError('Select a tenant before updating load types');
      setTimeout(() => setError(null), 3000);
      return;
    }

    updateTenantMutation.mutate({
      tenantId: activeTenant.id,
      data: { default_load_types: tempLoadTypes }
    });
  };

  const handleStartEditLoadTypes = () => {
    setTempLoadTypes([...availableLoadTypes]);
    setEditingLoadTypes(true);
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <TenantHeader />
      <div className="sticky top-12 z-40 bg-white py-4 -mt-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Manage Tenant Categories</h1>
            <p className="text-sm text-gray-600">Configure material categories per tenant</p>
          </div>
          <Button
            onClick={() => {
              resetForm();
              setEditingCategory(null);
              setShowAddDialog(true);
            }}
            className="bg-green-600 hover:bg-green-700 gap-2"
            disabled={!selectedTenantId}
          >
            <Plus className="w-4 h-4" />
            Add Category
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

      {/* Tenant Selector */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <Label>Select Tenant</Label>
          <Select
            value={selectedTenantId}
            onValueChange={setSelectedTenantId}
            disabled={tenantOptions.length === 0}
          >
            <SelectTrigger className="mt-2">
              <SelectValue placeholder="Choose a tenant" />
            </SelectTrigger>
            <SelectContent>
              {tenantOptions.length === 0 ? (
                <div className="px-3 py-2 text-sm text-muted-foreground">
                  No tenants available
                </div>
              ) : (
                tenantOptions.map((tenant) => (
                  <SelectItem key={tenant.tenant_id} value={tenant.tenant_id}>
                    {tenant.display_name || tenant.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Load Types Manager */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Load Types</CardTitle>
            {!editingLoadTypes && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleStartEditLoadTypes}
              >
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!editingLoadTypes ? (
            <div className="flex flex-wrap gap-2">
              {availableLoadTypes.map((type, idx) => (
                <Badge key={idx} className="bg-blue-100 text-blue-800 text-sm px-3 py-1">
                  {type.toUpperCase()}
                </Badge>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex gap-2">
                <Input
                  value={newLoadType}
                  onChange={(e) => setNewLoadType(e.target.value)}
                  placeholder="Enter load type (e.g., METAL, PLASTIC)"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddLoadType();
                    }
                  }}
                />
                <Button
                  type="button"
                  onClick={handleAddLoadType}
                  variant="outline"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>

              {tempLoadTypes.length > 0 && (
                <div className="space-y-2">
                  {tempLoadTypes.map((type, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded border">
                      <span className="font-semibold text-sm">{type}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveLoadType(index)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditingLoadTypes(false);
                    setTempLoadTypes([]);
                    setNewLoadType('');
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleSaveLoadTypes}
                  disabled={updateTenantMutation.isPending}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save Load Types
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Categories List */}
      <Card>
        <CardHeader>
          <CardTitle>
            {activeTenantName} Categories ({categories.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {categories.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p>No categories defined for this tenant</p>
              <p className="text-sm mt-2">{'Click "Add Category" to create one'}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {categories.map((category, index) => (
                <div key={category.id} className="p-4 border rounded-lg">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-lg">{category.category_name}</h3>
                        {category.category_type === 'custom' && (
                          <Badge variant="outline">Custom</Badge>
                        )}
                        <Badge className="bg-blue-100 text-blue-700">
                          {category.load_type_mapping}
                        </Badge>
                      </div>
                      {category.product_category && (
                        <p className="text-xs text-purple-600 font-medium mb-1">
                          Product: {category.product_category}
                        </p>
                      )}
                      {category.description && (
                        <p className="text-sm text-gray-600">{category.description}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleReorder(category, 'up')}
                        disabled={index === 0}
                      >
                        <ArrowUp className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleReorder(category, 'down')}
                        disabled={index === categories.length - 1}
                      >
                        <ArrowDown className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(category)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(category)}
                        className="text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {category.sub_categories && category.sub_categories.length > 0 && (
                    <div className="mt-3 pl-4 border-l-2 border-gray-200">
                      <p className="text-xs font-semibold text-gray-600 mb-2">Sub-Categories:</p>
                      <div className="flex flex-wrap gap-2">
                        {category.sub_categories.map((sub, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {sub}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingCategory ? 'Edit Category' : 'Add Category'}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!editingCategory && availableTemplates.length > 0 && (
              <div className="space-y-2 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <Label>Quick Start Templates</Label>
                <div className="grid grid-cols-2 gap-2">
                  {availableTemplates.map((template, idx) => (
                    <Button
                      key={idx}
                      type="button"
                      variant="outline"
                      className="justify-start text-left h-auto py-2"
                      onClick={() => {
                        setFormData({
                          category_name: template.category_name,
                          product_category: template.product_category,
                          category_type: template.category_type,
                          sub_categories: template.sub_categories,
                          load_type_mapping: template.load_type_mapping,
                          description: template.description,
                          sort_order: 0
                        });
                      }}
                    >
                      <div>
                        <div className="font-semibold text-xs">{template.category_name}</div>
                        <div className="text-xs text-gray-500">{template.product_category}</div>
                      </div>
                    </Button>
                  ))}
                </div>
                <p className="text-xs text-blue-600 mt-2">
                  Click a template to auto-fill the form, then customize as needed
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label>Category Name *</Label>
              <Input
                value={formData.category_name}
                onChange={(e) => setFormData(prev => ({ ...prev, category_name: e.target.value }))}
                placeholder="e.g., Aluminum foil and laminate scrap"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Product Category</Label>
              <Input
                value={formData.product_category}
                onChange={(e) => setFormData(prev => ({ ...prev, product_category: e.target.value }))}
                placeholder="e.g., Ferrous Metals, Non-Ferrous Metals, Plastics"
              />
              <p className="text-xs text-gray-500">High-level product grouping</p>
            </div>

            <div className="space-y-2">
              <Label>Category Type</Label>
              <Select
                value={formData.category_type}
                onValueChange={(value) => setFormData(prev => ({ ...prev, category_type: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="predefined">Predefined</SelectItem>
                  <SelectItem value="custom">Custom (Other)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Load Type Mapping *</Label>
              <Select
                value={formData.load_type_mapping}
                onValueChange={(value) => setFormData(prev => ({ ...prev, load_type_mapping: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select load type" />
                </SelectTrigger>
                <SelectContent>
                  {availableLoadTypes.map(type => (
                    <SelectItem key={type} value={type}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                {`Maps to inbound shipment type (from Tenant's default load types)`}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Custom Load Type (Optional)</Label>
              <div className="flex gap-2">
                <Input
                  value={customLoadType}
                  onChange={(e) => setCustomLoadType(e.target.value)}
                  placeholder="e.g., electronics, textiles"
                />
                <Button
                  type="button"
                  onClick={() => {
                    if (customLoadType.trim()) {
                      setFormData(prev => ({ ...prev, load_type_mapping: customLoadType.trim().toUpperCase() }));
                      setCustomLoadType('');
                    }
                  }}
                  variant="outline"
                >
                  Use
                </Button>
              </div>
              <p className="text-xs text-gray-500">
                Define a custom load type if not listed above
              </p>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Category description"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Sub-Categories</Label>
              <div className="flex gap-2">
                <Input
                  value={subCategoryInput}
                  onChange={(e) => setSubCategoryInput(e.target.value)}
                  placeholder="e.g., Aluminum Foil"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddSubCategory();
                    }
                  }}
                />
                <Button
                  type="button"
                  onClick={handleAddSubCategory}
                  variant="outline"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              
              {formData.sub_categories.length > 0 && (
                <div className="mt-3 space-y-2">
                  {formData.sub_categories.map((sub, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <span className="text-sm">{sub}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveSubCategory(index)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Sort Order</Label>
              <Input
                type="number"
                value={formData.sort_order}
                onChange={(e) => setFormData(prev => ({ ...prev, sort_order: parseInt(e.target.value) || 0 }))}
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowAddDialog(false);
                  setEditingCategory(null);
                  resetForm();
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createCategoryMutation.isPending || updateCategoryMutation.isPending}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                <Save className="w-4 h-4 mr-2" />
                {editingCategory ? 'Update' : 'Create'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}