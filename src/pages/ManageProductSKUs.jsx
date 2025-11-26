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
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  Plus,
  Package,
  Pencil,
  Trash2,
  Save,
  X,
  Search,
  Camera,
  Upload
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const PURITY_OPTIONS = ["100%", "90%", "80%", "70%", "60%", "50%", "40%", "MIXED", "UNKNOWN"];

const MINTECH_CATEGORIES = [
  {
    category: "PLASTICS",
    subCategories: [
      { name: "Polyesters", types: ["PET/PETE", "PETG"] },
      { name: "Polyolefins", types: ["HDPE", "LDPE/LLDPE", "PP"] },
      { name: "Vinyls", types: ["PVC Rigid", "PVC Flexible"] },
      { name: "Styrenics", types: ["PS GPPS", "PS HIPS", "EPS/XPS Foam"] },
      { name: "Engineering Plastics", types: ["PC", "ABS", "PA6/PA66", "POM", "TPE/TPU"] },
      { name: "Bio-based", types: ["PLA"] }
    ]
  },
  {
    category: "PLASTIC-RESINS",
    subCategories: [
      { name: "Virgin Resins", types: ["PET Virgin", "HDPE Virgin", "PP Virgin"] },
      { name: "Recycled Resins", types: ["rPET", "rHDPE", "rPP"] }
    ]
  }
];

const CTMETALS_CATEGORIES = [
  {
    category: "FERROUS",
    subCategories: [
      { name: "Steel", types: ["Mild Steel", "Alloy Steel", "Galvanized Steel", "Tool Steel"] },
      { name: "Stainless Steel", types: ["304 Series", "316 Series", "409 Series", "430 Series"] }
    ]
  },
  {
    category: "NON-FERROUS",
    subCategories: [
      { name: "Aluminum", types: ["UBC", "Cast Aluminum", "Extrusion 6063", "Aluminum Sheet", "Aluminum Foil"] },
      { name: "Copper", types: ["Bare Bright", "#1 Copper", "#2 Copper", "Insulated Wire"] },
      { name: "Brass", types: ["Yellow Brass", "Red Brass", "Cartridge Brass"] },
      { name: "Bronze", types: ["Phosphor Bronze", "Aluminum Bronze"] },
      { name: "Other Metals", types: ["Lead", "Zinc", "Nickel Alloys", "Titanium"] }
    ]
  },
  {
    category: "SPECIALTY",
    subCategories: [
      { name: "Metallized Materials", types: ["Metallized Film", "Metallized Paper"] },
      { name: "Paper Products", types: ["Coated Paper Rolls", "Uncoated Paper Rolls"] },
      { name: "Other", types: ["Adhesive Materials", "Non-Woven Fabric"] }
    ]
  }
];

export default function ManageProductSKUs() {
  const queryClient = useQueryClient();
  const { tenantConfig, user } = useTenant();
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSKU, setEditingSKU] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const imageInputRef = React.useRef(null);

  const [formData, setFormData] = useState({
    category: '',
    sub_category: '',
    product_type: '',
    description: '',
    format: '',
    purity: '100%',
    product_grouping: 'standard', // New
    measurement_type: 'both', // New
    primary_unit: 'kg', // New
    weight_per_unit_kg: '', // New
    weight_per_unit_lbs: '', // New
    volume_per_unit_cubic_feet: '', // New
    volume_per_unit_cubic_yards: '', // New
    volume_per_unit_cubic_meters: '', // New
    density_kg_per_cubic_meter: '', // New
    density_lbs_per_cubic_foot: '', // New
    recommended_bin_type: '', // New
    price_per_kg: '',
    image_url: '',
    notes: ''
  });



  const { data: skus = [], isLoading } = useQuery({
    queryKey: ['productSKUs', user?.tenant_id],
    queryFn: async () => {
      if (!user?.tenant_id) return [];
      return await recims.entities.ProductSKU.filter({
        tenant_id: user.tenant_id
      });
    },
    enabled: !!user?.tenant_id,
    initialData: [],
  });

  const generateSKUNumber = (data, customTimestamp = null) => {
    const catCode = data.category?.substring(0, 3).toUpperCase() || 'XXX';
    const subCode = data.sub_category?.substring(0, 3).toUpperCase() || 'XXX';
    const typeCode = data.product_type?.substring(0, 3).toUpperCase() || 'XXX';
    const purityCode = data.purity?.replace('%', '') || 'XXX'; // Modified to strip '%'
    const timestampPart = customTimestamp !== null ? customTimestamp : Date.now();
    return `${catCode}-${subCode}-${typeCode}-${purityCode}-${timestampPart}`.toUpperCase();
  };

  const createSKUMutation = useMutation({
    mutationFn: async (skuData) => {
      const timestamp = Date.now();
      const catCode = skuData.category.substring(0, 3).toUpperCase();
      const subCode = skuData.sub_category.substring(0, 3).toUpperCase();
      const typeCode = skuData.product_type.substring(0, 3).toUpperCase();
      const purityCode = skuData.purity.replace('%', '');
      const skuNumber = `${catCode}-${subCode}-${typeCode}-${purityCode}-${timestamp}`;

      return await recims.entities.ProductSKU.create({
        ...skuData,
        sku_number: skuNumber,
        tenant_id: user.tenant_id,
        status: 'active'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productSKUs'] });
      setSuccess("Product SKU created successfully");
      setTimeout(() => setSuccess(null), 3000);
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (err) => {
      setError(err.message || "Failed to create SKU");
      setTimeout(() => setError(null), 3000);
    }
  });

  const updateSKUMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      return await recims.entities.ProductSKU.update(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productSKUs'] });
      setSuccess("Product SKU updated successfully");
      setTimeout(() => setSuccess(null), 3000);
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (err) => {
      setError(err.message || "Failed to update SKU");
      setTimeout(() => setError(null), 3000);
    }
  });

  const deleteSKUMutation = useMutation({
    mutationFn: async (id) => {
      return await recims.entities.ProductSKU.update(id, { status: 'inactive' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productSKUs'] });
      setSuccess("SKU deactivated successfully");
      setTimeout(() => setSuccess(null), 3000);
    },
  });

  const handleEdit = (sku) => {
    setEditingSKU(sku);
    setFormData({
      category: sku.category,
      sub_category: sku.sub_category,
      product_type: sku.product_type,
      description: sku.description || '',
      format: sku.format || '',
      purity: sku.purity,
      price_per_kg: sku.price_per_kg || '',
      image_url: sku.image_url || '',
      notes: sku.notes || '',
      product_grouping: sku.product_grouping || 'standard',
      measurement_type: sku.measurement_type || 'both',
      primary_unit: sku.primary_unit || 'kg',
      weight_per_unit_kg: sku.weight_per_unit_kg || '',
      weight_per_unit_lbs: sku.weight_per_unit_lbs || '',
      volume_per_unit_cubic_feet: sku.volume_per_unit_cubic_feet || '',
      volume_per_unit_cubic_yards: sku.volume_per_unit_cubic_yards || '',
      volume_per_unit_cubic_meters: sku.volume_per_unit_cubic_meters || '',
      density_kg_per_cubic_meter: sku.density_kg_per_cubic_meter || '',
      density_lbs_per_cubic_foot: sku.density_lbs_per_cubic_foot || '',
      recommended_bin_type: sku.recommended_bin_type || '',
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      category: '',
      sub_category: '',
      product_type: '',
      description: '',
      format: '',
      purity: '100%',
      product_grouping: 'standard',
      measurement_type: 'both',
      primary_unit: 'kg',
      weight_per_unit_kg: '',
      weight_per_unit_lbs: '',
      volume_per_unit_cubic_feet: '',
      volume_per_unit_cubic_yards: '',
      volume_per_unit_cubic_meters: '',
      density_kg_per_cubic_meter: '',
      density_lbs_per_cubic_foot: '',
      recommended_bin_type: '',
      price_per_kg: '',
      image_url: '',
      notes: ''
    });
    setEditingSKU(null);
  };

  const handleImageUpload = async (file) => {
    setUploadingImage(true);
    setError(null);

    try {
      const { file_url } = await recims.integrations.Core.UploadFile({ file });
      setFormData(prev => ({ ...prev, image_url: file_url }));
      setSuccess("Image uploaded successfully");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message || "Failed to upload image. Please try again.");
      setTimeout(() => setError(null), 3000);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSave = (e) => {
    e.preventDefault();
    setError(null);

    if (!formData.category || !formData.sub_category || !formData.product_type) {
      setError("Category, sub-category, and product type are required");
      setTimeout(() => setError(null), 3000);
      return;
    }

    if (!formData.purity) {
      setError("Purity is required");
      setTimeout(() => setError(null), 3000);
      return;
    }

    const skuData = {
      category: formData.category,
      sub_category: formData.sub_category,
      product_type: formData.product_type,
      description: formData.description || `${formData.category} > ${formData.sub_category} > ${formData.product_type}`,
      format: formData.format,
      purity: formData.purity,
      product_grouping: formData.product_grouping,
      measurement_type: formData.measurement_type,
      primary_unit: formData.primary_unit,
      weight_per_unit_kg: formData.weight_per_unit_kg ? parseFloat(formData.weight_per_unit_kg) : null,
      weight_per_unit_lbs: formData.weight_per_unit_lbs ? parseFloat(formData.weight_per_unit_lbs) : null,
      volume_per_unit_cubic_feet: formData.volume_per_unit_cubic_feet ? parseFloat(formData.volume_per_unit_cubic_feet) : null,
      volume_per_unit_cubic_yards: formData.volume_per_unit_cubic_yards ? parseFloat(formData.volume_per_unit_cubic_yards) : null,
      volume_per_unit_cubic_meters: formData.volume_per_unit_cubic_meters ? parseFloat(formData.volume_per_unit_cubic_meters) : null,
      density_kg_per_cubic_meter: formData.density_kg_per_cubic_meter ? parseFloat(formData.density_kg_per_cubic_meter) : null,
      density_lbs_per_cubic_foot: formData.density_lbs_per_cubic_foot ? parseFloat(formData.density_lbs_per_cubic_foot) : null,
      recommended_bin_type: formData.recommended_bin_type,
      price_per_kg: formData.price_per_kg ? parseFloat(formData.price_per_kg) : null,
      image_url: formData.image_url || null,
      thumbnail_url: null, // Assuming thumbnail_url is derived or not directly editable yet
      notes: formData.notes
    };

    if (editingSKU) {
      updateSKUMutation.mutate({ id: editingSKU.id, data: skuData });
    } else {
      createSKUMutation.mutate(skuData);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));

    if (field === 'category') {
      setFormData(prev => ({ ...prev, sub_category: '', product_type: '' }));
    } else if (field === 'sub_category') {
      setFormData(prev => ({ ...prev, product_type: '' }));
    }
  };

  const { data: tenantCategories = [] } = useQuery({
    queryKey: ['tenantCategories', user?.tenant_id],
    queryFn: async () => {
      if (!user?.tenant_id) return [];
      return await recims.entities.TenantCategory.filter({
        tenant_id: user.tenant_id,
        is_active: true
      }, 'sort_order');
    },
    enabled: !!user?.tenant_id,
    initialData: [],
  });

  const availableCategories = tenantCategories.length > 0 
    ? tenantCategories.map(tc => ({
        category: tc.category_name,
        subCategories: tc.sub_categories?.map(sub => ({ name: sub, types: [] })) || []
      }))
    : (user?.tenant_id?.includes('min') ? MINTECH_CATEGORIES : CTMETALS_CATEGORIES);
  const selectedCategoryData = availableCategories.find(cat => cat.category === formData.category);
  const selectedSubCategoryData = selectedCategoryData?.subCategories.find(sub => sub.name === formData.sub_category);

  const filteredSKUs = skus.filter(sku => {
    if (sku.status !== 'active') return false;
    if (!searchQuery) return true;
    const search = searchQuery.toLowerCase();
    return (
      sku.sku_number?.toLowerCase().includes(search) ||
      sku.description?.toLowerCase().includes(search) ||
      sku.category?.toLowerCase().includes(search) ||
      sku.sub_category?.toLowerCase().includes(search) ||
      sku.product_type?.toLowerCase().includes(search)
    );
  });

  const getPurityColor = (purity) => {
    if (purity === 'UNKNOWN' || purity === 'MIXED') return 'bg-gray-100 text-gray-700';
    const num = parseInt(purity);
    if (num >= 90) return 'bg-green-100 text-green-700';
    if (num >= 70) return 'bg-yellow-100 text-yellow-700';
    if (num >= 50) return 'bg-orange-100 text-orange-700';
    return 'bg-red-100 text-red-700';
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link to={createPageUrl("SuperAdmin")}>
          <Button variant="outline" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Product SKU Management</h1>
          <p className="text-sm text-gray-600">Define and manage product SKUs</p>
        </div>
        <Button
          onClick={() => {
            resetForm();
            setIsDialogOpen(true);
          }}
          className="bg-green-600 hover:bg-green-700 gap-2"
        >
          <Plus className="w-4 h-4" />
          Create SKU
        </Button>
      </div>

      <div className="mb-6 p-4 rounded-lg border-2" style={{
        borderColor: tenantConfig?.primary_color || '#2563eb',
        backgroundColor: `${tenantConfig?.primary_color || '#2563eb'}15`
      }}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold" style={{
              color: tenantConfig?.primary_color || '#1e40af'
            }}>
              {tenantConfig?.display_name || 'Product'} SKUs
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Manage product catalog for {tenantConfig?.display_name}
            </p>
          </div>
          <Badge className="text-lg px-4 py-2" style={{
            backgroundColor: tenantConfig?.primary_color || '#2563eb',
            color: 'white'
          }}>
            {skus.length} SKUs
          </Badge>
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

      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by SKU, category, type, or description..."
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Product SKUs ({filteredSKUs.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
            </div>
          ) : filteredSKUs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No SKUs found</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredSKUs.map((sku) => (
                <Card key={sku.id} className="hover:shadow-lg transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <p className="font-bold text-lg">{sku.sku_number}</p>
                          <Badge variant="outline" className={getPurityColor(sku.purity)}>
                            {sku.purity}
                          </Badge>
                        </div>

                        <div className="space-y-2 text-xs text-gray-600 mb-3">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {sku.product_grouping?.replace('_', ' ').toUpperCase() || 'STANDARD'}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {sku.measurement_type?.toUpperCase() || 'BOTH'}
                            </Badge>
                          </div>
                          <div><strong>Category:</strong> {sku.category}</div>
                          <div><strong>Sub-Category:</strong> {sku.sub_category}</div>
                          <div><strong>Type:</strong> {sku.product_type}</div>
                          {sku.format && <div><strong>Format:</strong> {sku.format}</div>}
                          <div><strong>Purity:</strong> {sku.purity}</div>
                          {sku.weight_per_unit_kg > 0 && (
                            <div className="text-blue-700"><strong>Weight/Unit:</strong> {sku.weight_per_unit_kg} kg</div>
                          )}
                          {sku.volume_per_unit_cubic_feet > 0 && (
                            <div className="text-green-700"><strong>Volume/Unit:</strong> {sku.volume_per_unit_cubic_feet} ft³</div>
                          )}
                          {sku.density_kg_per_cubic_meter > 0 && (
                            <div className="text-purple-700"><strong>Density:</strong> {sku.density_kg_per_cubic_meter} kg/m³</div>
                          )}
                          {sku.price_per_kg && (
                            <div className="text-green-700"><strong>Price:</strong> ${sku.price_per_kg}/kg</div>
                          )}
                        </div>

                        {sku.description && (
                          <p className="text-sm text-gray-600 mb-2">{sku.description}</p>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleEdit(sku)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => deleteSKUMutation.mutate(sku.id)}
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        setIsDialogOpen(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingSKU ? 'Edit Product SKU' : 'Create New Product SKU'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Category *</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => handleChange('category', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableCategories.map((cat) => (
                      <SelectItem key={cat.category} value={cat.category}>
                        {cat.category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sub_category">Sub-Category *</Label>
                <Select
                  value={formData.sub_category}
                  onValueChange={(value) => handleChange('sub_category', value)}
                  disabled={!formData.category}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select sub-category" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedCategoryData?.subCategories.map((sub) => (
                      <SelectItem key={sub.name} value={sub.name}>
                        {sub.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="product_type">Product Type *</Label>
                <Select
                  value={formData.product_type}
                  onValueChange={(value) => handleChange('product_type', value)}
                  disabled={!formData.sub_category}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select product type" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedSubCategoryData?.types.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="purity">Purity *</Label>
                <Select
                  value={formData.purity}
                  onValueChange={(value) => handleChange('purity', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PURITY_OPTIONS.map((purity) => (
                      <SelectItem key={purity} value={purity}>
                        {purity}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="format">Format</Label>
                <Input
                  id="format"
                  value={formData.format}
                  onChange={(e) => handleChange('format', e.target.value)}
                  placeholder="e.g., Bales, Rolls, Sheets, Shredded"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="price">Price per kg</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  value={formData.price_per_kg}
                  onChange={(e) => handleChange('price_per_kg', e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>

            {/* NEW: Product Grouping & Measurement Type */}
            <div className="grid md:grid-cols-2 gap-4 p-4 bg-purple-50 rounded-lg">
              <div className="space-y-2">
                <Label>Product Grouping *</Label>
                <Select
                  value={formData.product_grouping}
                  onValueChange={(value) => setFormData({ ...formData, product_grouping: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard (Balanced)</SelectItem>
                    <SelectItem value="light_bulky">Light but Bulky (High Vol, Low Weight)</SelectItem>
                    <SelectItem value="heavy_compact">Heavy but Compact (High Weight, Low Vol)</SelectItem>
                    <SelectItem value="fragile">Fragile (Special Handling)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Measurement Type *</Label>
                <Select
                  value={formData.measurement_type}
                  onValueChange={(value) => setFormData({ ...formData, measurement_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weight">Weight Only</SelectItem>
                    <SelectItem value="volume">Volume Only</SelectItem>
                    <SelectItem value="both">Both Weight & Volume</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Weight per Unit */}
            <div className="p-4 bg-blue-50 rounded-lg">
              <Label className="font-semibold mb-3 block">Weight per Unit (for calculations)</Label>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Weight per Unit (kg)</Label>
                  <Input
                    type="number"
                    step="0.001"
                    value={formData.weight_per_unit_kg}
                    onChange={(e) => setFormData({ ...formData, weight_per_unit_kg: e.target.value })}
                    placeholder="e.g., 25.5"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Weight per Unit (lbs)</Label>
                  <Input
                    type="number"
                    step="0.001"
                    value={formData.weight_per_unit_lbs}
                    onChange={(e) => setFormData({ ...formData, weight_per_unit_lbs: e.target.value })}
                    placeholder="e.g., 56.2"
                  />
                </div>
              </div>
            </div>

            {/* Volume per Unit */}
            <div className="p-4 bg-green-50 rounded-lg">
              <Label className="font-semibold mb-3 block">Volume per Unit (for bin placement & shipping)</Label>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Volume per Unit (ft³)</Label>
                  <Input
                    type="number"
                    step="0.001"
                    value={formData.volume_per_unit_cubic_feet}
                    onChange={(e) => setFormData({ ...formData, volume_per_unit_cubic_feet: e.target.value })}
                    placeholder="e.g., 10.5"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Volume per Unit (yd³)</Label>
                  <Input
                    type="number"
                    step="0.001"
                    value={formData.volume_per_unit_cubic_yards}
                    onChange={(e) => setFormData({ ...formData, volume_per_unit_cubic_yards: e.target.value })}
                    placeholder="e.g., 0.39"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Volume per Unit (m³)</Label>
                  <Input
                    type="number"
                    step="0.001"
                    value={formData.volume_per_unit_cubic_meters}
                    onChange={(e) => setFormData({ ...formData, volume_per_unit_cubic_meters: e.target.value })}
                    placeholder="e.g., 0.297"
                  />
                </div>
              </div>
            </div>

            {/* Density */}
            <div className="p-4 bg-yellow-50 rounded-lg">
              <Label className="font-semibold mb-3 block">Material Density (helps convert weight ↔ volume)</Label>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Density (kg/m³)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.density_kg_per_cubic_meter}
                    onChange={(e) => setFormData({ ...formData, density_kg_per_cubic_meter: e.target.value })}
                    placeholder="e.g., 950"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Density (lbs/ft³)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.density_lbs_per_cubic_foot}
                    onChange={(e) => setFormData({ ...formData, density_lbs_per_cubic_foot: e.target.value })}
                    placeholder="e.g., 59.3"
                  />
                </div>
              </div>
              <p className="text-xs text-yellow-700 mt-2">
                💡 Example: HDPE pellets ≈ 950 kg/m³ | Shredded aluminum ≈ 400 kg/m³
              </p>
            </div>

            <div className="space-y-2">
              <Label>Recommended Bin Type</Label>
              <Input
                value={formData.recommended_bin_type}
                onChange={(e) => setFormData({ ...formData, recommended_bin_type: e.target.value })}
                placeholder="e.g., Large capacity bin with volume tracking"
              />
            </div>

            <Card className="border-purple-200 bg-purple-50">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Camera className="w-4 h-4 text-purple-600" />
                  Product Image
                  <Badge className="bg-purple-600 text-white text-xs">PHASE V</Badge>
                </CardTitle>
                <p className="text-xs text-gray-600 mt-1">
                  Upload image to help operators identify this product during receiving and picking
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0])}
                  className="hidden"
                />

                {formData.image_url && (
                  <div className="relative">
                    <img
                      src={formData.image_url}
                      alt="Product"
                      className="w-full h-48 object-contain border-2 border-gray-200 rounded-lg bg-white"
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="destructive"
                      className="absolute top-2 right-2"
                      onClick={() => setFormData({...formData, image_url: ''})}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                )}

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => imageInputRef.current?.click()}
                  disabled={uploadingImage}
                  className="w-full gap-2"
                >
                  <Upload className="w-4 h-4" />
                  {uploadingImage ? 'Uploading...' : formData.image_url ? 'Change Image' : 'Upload Image'}
                </Button>

                <p className="text-xs text-gray-500">
                  Images stored in AWS S3. Recommended: 800x600px, under 2MB
                </p>
              </CardContent>
            </Card>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                placeholder="Full SKU description..."
                rows={2}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => handleChange('notes', e.target.value)}
                placeholder="Additional notes..."
                rows={2}
              />
            </div>

            {formData.category && formData.sub_category && formData.product_type && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm font-semibold text-blue-900 mb-1">Generated SKU Preview:</p>
                <p className="text-lg font-mono font-bold text-blue-700">
                  {generateSKUNumber(formData, 'XXXX')}
                </p>
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsDialogOpen(false);
                  resetForm();
                }}
                className="flex-1"
              >
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createSKUMutation.isPending || updateSKUMutation.isPending}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                <Save className="w-4 h-4 mr-2" />
                {createSKUMutation.isPending || updateSKUMutation.isPending ? 'Saving...' : editingSKU ? 'Update SKU' : 'Create SKU'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}