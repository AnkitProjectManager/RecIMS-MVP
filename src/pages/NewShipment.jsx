import React, { useState } from "react";
import { recims } from "@/api/recimsClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTenant } from "@/components/TenantContext";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { TruckIcon, Save, ArrowLeft, Camera, Upload, X, AlertTriangle, Package, Boxes } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

export default function NewShipment() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { tenantConfig, user } = useTenant();
  const [error, setError] = useState(null);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [photoUrls, setPhotoUrls] = useState([]);
  const fileInputRef = React.useRef(null);
  const [useMetric, setUseMetric] = useState(true);
  
  const [formData, setFormData] = useState({
    supplier_name: '',
    truck_number: '',
    driver_name: '',
    load_type: 'mixed', // Changed from 'plastic' to 'mixed' to match Connecticut Metals categories
    product_category: '',
    product_sub_category: '',
    product_type: '',
    product_format: '',
    product_purity: 'UNKNOWN',
    sku_number: '', // This field might not be directly used for input but for logic
    container_type: '',
    gross_weight: '',
    tare_weight: '',
    volume_cubic_feet: '',
    volume_cubic_yards: '',
    volume_cubic_meters: '',
    volume_unit: 'cubic_feet',
    notes: ''
  });

  React.useEffect(() => {
    if (tenantConfig) {
      const isMetric = tenantConfig.measurement_system === 'metric';
      setUseMetric(isMetric);
      
      // Pre-select load type based on tenant's default
      if (tenantConfig.default_load_types && tenantConfig.default_load_types.length > 0) {
        setFormData(prev => ({ ...prev, load_type: tenantConfig.default_load_types[0] }));
      }
    }
  }, [tenantConfig]);

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers', user?.tenant_id],
    queryFn: async () => {
      if (!user?.tenant_id) return [];
      const allSuppliers = await recims.entities.Supplier.filter({
        tenant_id: user.tenant_id,
        status: 'active'
      });
      return allSuppliers;
    },
    enabled: !!user?.tenant_id,
    initialData: [],
  });

  const { data: vendors = [] } = useQuery({
    queryKey: ['vendors', user?.tenant_id],
    queryFn: async () => {
      if (!user?.tenant_id) return [];
      const allVendors = await recims.entities.Vendor.filter({
        tenant_id: user.tenant_id,
        status: 'active'
      });
      return allVendors;
    },
    enabled: !!user?.tenant_id,
    initialData: [],
  });

  // Combine suppliers and vendors for dropdown, removing duplicates
  const allSupplierOptions = React.useMemo(() => {
    const supplierNames = suppliers.map(s => s.company_name);
    const vendorNames = vendors.map(v => v.display_name);
    const combined = [...new Set([...supplierNames, ...vendorNames])].sort();
    return combined;
  }, [suppliers, vendors]);

  const { data: containers = [] } = useQuery({
    queryKey: ['containers', user?.tenant_id],
    queryFn: async () => {
      if (!user?.tenant_id) return [];
      return await recims.entities.Container.filter({
        status: 'active',
        tenant_id: user.tenant_id
      });
    },
    enabled: !!user?.tenant_id,
    initialData: [],
  });

  const { data: skus = [] } = useQuery({
    queryKey: ['productSKUs'],
    queryFn: () => recims.entities.ProductSKU.filter({ status: 'active' }),
    initialData: [],
  });

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

  const loadTypeOptions = React.useMemo(() => {
    const tenantDefaults = Array.isArray(tenantConfig?.default_load_types)
      ? tenantConfig.default_load_types
      : [];
    const categoryTypes = tenantCategories
      .map((tc) => tc.load_type_mapping)
      .filter((value) => typeof value === 'string' && value.trim().length > 0)
      .map((value) => value.toLowerCase());
    const baseTypes = ['metal', 'plastic', 'mixed'];
    const normalized = [...tenantDefaults, ...categoryTypes, ...baseTypes]
      .map((type) => (typeof type === 'string' ? type.toLowerCase() : ''))
      .filter(Boolean);
    return Array.from(new Set(normalized));
  }, [tenantConfig?.default_load_types, tenantCategories]);

  React.useEffect(() => {
    if (loadTypeOptions.length === 0) {
      return;
    }
    const current = (formData.load_type || '').toLowerCase();
    if (!loadTypeOptions.includes(current)) {
      setFormData((prev) => ({ ...prev, load_type: loadTypeOptions[0] }));
    }
  }, [loadTypeOptions, formData.load_type]);

  const formatLoadTypeLabel = (type) => {
    if (!type) return '';
    return type
      .split('_')
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(' ');
  };

  const photoUploadEnabled = tenantConfig?.features?.photo_upload_enabled || false;

  // Get categories from TenantCategory entity
  const availableCategories = React.useMemo(() => {
    if (tenantCategories.length === 0) return [];
    const loadType = (formData.load_type || '').toLowerCase();
    const filtered = tenantCategories.filter((tc) => {
      const mapping = (tc.load_type_mapping || '').toLowerCase();
      if (!loadType || loadType === 'mixed') {
        return true;
      }
      return mapping === loadType;
    });
    const unique = new Set();
    filtered.forEach((tc) => {
      if (tc.category_name) {
        unique.add(tc.category_name);
      }
    });
    return Array.from(unique);
  }, [tenantCategories, formData.load_type]);

  // Get sub-categories from TenantCategory
  const availableSubCategories = React.useMemo(() => {
    if (!formData.product_category) return [];
    const normalizedCategory = formData.product_category.toLowerCase();
    const matches = tenantCategories.filter(
      (tc) => (tc.category_name || '').toLowerCase() === normalizedCategory
    );
    const unique = new Set();
    matches.forEach((tc) => {
      (tc.sub_categories || []).forEach((sub) => unique.add(sub));
    });
    return Array.from(unique);
  }, [tenantCategories, formData.product_category]);

  // Get product types based on sub-category
  const availableProductTypes = React.useMemo(() => {
    if (!formData.product_sub_category) return [];
    const filtered = skus.filter(sku => 
      sku.category === formData.product_category && 
      sku.sub_category === formData.product_sub_category
    );
    return [...new Set(filtered.map(sku => sku.product_type))];
  }, [skus, formData.product_category, formData.product_sub_category]);

  // Get matching SKU if all fields are selected - FIX: Make purity optional
  const matchingSKU = React.useMemo(() => {
    if (!formData.product_category || !formData.product_sub_category || !formData.product_type) {
      return null;
    }
    
    // Try to find exact match with purity first
    let match = skus.find(sku => 
      sku.category === formData.product_category &&
      sku.sub_category === formData.product_sub_category &&
      sku.product_type === formData.product_type &&
      sku.purity === formData.product_purity
    );
    
    // If no exact match, find SKU without purity requirement
    if (!match) {
      match = skus.find(sku => 
        sku.category === formData.product_category &&
        sku.sub_category === formData.product_sub_category &&
        sku.product_type === formData.product_type &&
        sku.purity === 'UNKNOWN'
      );
    }
    
    return match;
  }, [skus, formData.product_category, formData.product_sub_category, formData.product_type, formData.product_purity]);

  // Format options - all formats available
  const formatOptions = ['Sheets', 'Rolls', 'Chipped', 'Shredded', 'Pipes', 'Wires', 'Casings', 'Mixed', 'Corrugated', 'Other', 'Unknown'];

  const handlePhotoUpload = async (files) => {
    setUploadingPhotos(true);
    setError(null);
    
    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        const { file_url } = await recims.integrations.Core.UploadFile({ file });
        return file_url;
      });
      
      const urls = await Promise.all(uploadPromises);
      setPhotoUrls(prev => [...prev, ...urls]);
    } catch (err) {
      setError("Failed to upload photos. Please try again.");
    } finally {
      setUploadingPhotos(false);
    }
  };

  const removePhoto = (indexToRemove) => {
    setPhotoUrls(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  const convertToKg = (lbs) => lbs * 0.453592;
  const convertToLbs = (kg) => kg * 2.20462;

  // Volume conversion functions
  const convertVolume = (value, fromUnit, toUnit) => {
    if (!value || value === '' || value === '0') return '';
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return '';

    // Convert to cubic feet first
    let cubicFeet = 0;
    if (fromUnit === 'cubic_feet') {
      cubicFeet = numValue;
    } else if (fromUnit === 'cubic_yards') {
      cubicFeet = numValue * 27;
    } else if (fromUnit === 'cubic_meters') {
      cubicFeet = numValue * 35.3147;
    }

    // Convert from cubic feet to target unit
    if (toUnit === 'cubic_feet') {
      return cubicFeet.toFixed(2);
    } else if (toUnit === 'cubic_yards') {
      return (cubicFeet / 27).toFixed(2);
    } else if (toUnit === 'cubic_meters') {
      return (cubicFeet / 35.3147).toFixed(2);
    }
    return '';
  };

  // Helper function to generate SKU number
  const generateSKUNumber = (category, subCategory, productType, purity) => {
    // Get prefixes
    const categoryPrefix = category.substring(0, 3).toUpperCase(); // PLA, FER, NON, etc.
    const subCategoryPrefix = subCategory.substring(0, 3).toUpperCase(); // POL, STE, ALU, etc.
    const productTypePrefix = productType.substring(0, 2).toUpperCase(); // PP, PE, ST, etc.
    
    // Get purity number (remove % sign)
    let purityNum = 'XX';
    if (purity && purity !== 'UNKNOWN' && purity !== 'MIXED') {
      purityNum = purity.replace('%', '').padStart(2, '0');
    } else if (purity === 'MIXED') {
      purityNum = 'MX';
    } else {
      purityNum = 'UK'; // UNKNOWN
    }
    
    // Generate unique identifier (timestamp last 4 digits)
    const uniqueId = String(Date.now()).slice(-4);
    
    return `${categoryPrefix}-${subCategoryPrefix}-${productTypePrefix}-${purityNum}-${uniqueId}`.toUpperCase();
  };

  // Auto-create SKU mutation
  const createSKUMutation = useMutation({
    mutationFn: async (skuData) => {
      const newSKU = await recims.entities.ProductSKU.create({
        sku_number: skuData.sku_number,
        tenant_id: skuData.tenant_id,
        category: skuData.category,
        sub_category: skuData.sub_category,
        product_type: skuData.product_type,
        format: skuData.format || '',
        purity: skuData.purity,
        description: `${skuData.category} > ${skuData.sub_category} > ${skuData.product_type} | ${skuData.purity} Purity`,
        measurement_type: 'both',
        primary_unit: 'kg',
        product_grouping: 'standard',
        status: 'active'
      });
      return newSKU;
    },
    onSuccess: (newSKU) => {
      queryClient.invalidateQueries({ queryKey: ['productSKUs'] });
      console.log('Auto-created SKU:', newSKU.sku_number);
    }
  });

  const createShipmentMutation = useMutation({
    mutationFn: async (data) => {
      let grossWeight = data.gross_weight ? parseFloat(data.gross_weight) : 0;
      let tareWeight = data.tare_weight ? parseFloat(data.tare_weight) : 0;
      
      // Convert to kg if using imperial
      let grossWeightKg = grossWeight;
      let tareWeightKg = tareWeight;
      let grossWeightLbs = 0;
      let tareWeightLbs = 0;
      
      if (!useMetric) {
        grossWeightKg = convertToKg(grossWeight);
        tareWeightKg = convertToKg(tareWeight);
        grossWeightLbs = grossWeight;
        tareWeightLbs = tareWeight;
      } else {
        grossWeightLbs = convertToLbs(grossWeight);
        tareWeightLbs = convertToLbs(tareWeight);
      }
      
      if (tareWeightKg > grossWeightKg && grossWeightKg > 0) {
        throw new Error("Tare weight cannot exceed gross weight");
      }

      const netWeightKg = grossWeightKg && tareWeightKg ? grossWeightKg - tareWeightKg : 0;
      const netWeightLbs = grossWeightLbs && tareWeightLbs ? grossWeightLbs - tareWeightLbs : 0;

      // Determine SKU number - auto-create if needed
      let skuNumber = '';
      
      if (data.product_category && data.product_sub_category && data.product_type) {
        // Check if we have a matching SKU
        if (matchingSKU) {
          skuNumber = matchingSKU.sku_number;
        } else {
          // Auto-create SKU
          const generatedSKU = generateSKUNumber(
            data.product_category,
            data.product_sub_category,
            data.product_type,
            data.product_purity
          );
          
          // Create the SKU in the database
          const newSKU = await createSKUMutation.mutateAsync({
            sku_number: generatedSKU,
            tenant_id: user?.tenant_id,
            category: data.product_category,
            sub_category: data.product_sub_category,
            product_type: data.product_type,
            format: data.product_format,
            purity: data.product_purity
          });
          
          skuNumber = newSKU.sku_number;
        }
      }

      return await recims.entities.InboundShipment.create({
        ...data,
        load_id: `LOAD-${Date.now()}`,
        tenant_id: user?.tenant_id,
        arrival_time: new Date().toISOString(),
        gross_weight: grossWeightKg > 0 ? grossWeightKg : null,
        tare_weight: tareWeightKg > 0 ? tareWeightKg : null,
        net_weight: netWeightKg > 0 ? netWeightKg : null,
        gross_weight_lbs: grossWeightLbs > 0 ? grossWeightLbs : null,
        tare_weight_lbs: tareWeightLbs > 0 ? tareWeightLbs : null,
        net_weight_lbs: netWeightLbs > 0 ? netWeightLbs : null,
        volume_cubic_feet: data.volume_cubic_feet ? parseFloat(data.volume_cubic_feet) : null,
        volume_cubic_yards: data.volume_cubic_yards ? parseFloat(data.volume_cubic_yards) : null,
        volume_cubic_meters: data.volume_cubic_meters ? parseFloat(data.volume_cubic_meters) : null,
        volume_unit: data.volume_unit,
        calculated_density: netWeightKg > 0 && parseFloat(data.volume_cubic_meters) > 0 
          ? netWeightKg / parseFloat(data.volume_cubic_meters) 
          : null,
        sku_number: skuNumber,
        status: 'pending_inspection', // Changed from 'arrived' to 'pending_inspection'
        operator_name: user?.full_name,
        photo_urls: photoUrls
      });
    },
    onSuccess: (shipment) => {
      queryClient.invalidateQueries({ queryKey: ['todayShipments'] });
      queryClient.invalidateQueries({ queryKey: ['pendingShipments'] });
      
      // Check if we have a SKU and offer to print SKU label
      if (shipment.sku_number) {
        const printSKU = window.confirm('Shipment saved! Would you like to print a SKU label for this product?');
        if (printSKU) {
          navigate(createPageUrl(`PrintSKULabel?sku=${shipment.sku_number}&format=4x6`));
        } else {
          // Offer to print inbound label instead
          const printInbound = window.confirm('Print inbound shipment label instead?');
          if (printInbound) {
            navigate(createPageUrl(`PrintInboundLabel?id=${shipment.id}`));
          } else {
            navigate(createPageUrl("Dashboard"));
          }
        }
      } else {
        // No SKU, just offer inbound label
        const printInbound = window.confirm('Shipment saved! Print inbound shipment label?');
        if (printInbound) {
          navigate(createPageUrl(`PrintInboundLabel?id=${shipment.id}`));
        } else {
          navigate(createPageUrl("Dashboard"));
        }
      }
    },
    onError: (err) => {
      setError(err.message || "Failed to create shipment. Please try again.");
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setError(null);

    if (!formData.supplier_name) {
      setError("Supplier name is required");
      return;
    }
    
    if (!formData.truck_number) {
      setError("Truck number is required");
      return;
    }


    createShipmentMutation.mutate(formData);
  };

  const handleChange = (field, value) => {
    setFormData(prev => {
      let updated = { ...prev, [field]: value };
      
      // Reset dependent product classification fields when parent changes
      if (field === 'load_type') {
        updated.product_category = '';
        updated.product_sub_category = '';
        updated.product_type = '';
        updated.product_format = '';
      } else if (field === 'product_category') {
        updated.product_sub_category = '';
        updated.product_type = '';
      } else if (field === 'product_sub_category') {
        updated.product_type = '';
      } 
      // NEW: Pre-fill tare weight when container type is selected
      else if (field === 'container_type') {
        const selectedContainer = containers.find(c => c.container_code === value);
        if (selectedContainer) {
          let tareWeightValue = '';
          if (useMetric) {
            // Prioritize tare_weight_kg if available, otherwise convert from lbs
            if (selectedContainer.tare_weight_kg) {
              tareWeightValue = selectedContainer.tare_weight_kg.toString();
            } else if (selectedContainer.tare_weight_lbs) {
              tareWeightValue = convertToKg(selectedContainer.tare_weight_lbs).toFixed(2);
            }
          } else { // Imperial
            // Prioritize tare_weight_lbs if available, otherwise convert from kg
            if (selectedContainer.tare_weight_lbs) {
              tareWeightValue = selectedContainer.tare_weight_lbs.toString();
            } else if (selectedContainer.tare_weight_kg) {
              tareWeightValue = convertToLbs(selectedContainer.tare_weight_kg).toFixed(2);
            }
          }
          updated.tare_weight = tareWeightValue;
        } else {
          // If no container selected or found, clear tare weight
          updated.tare_weight = '';
        }
      }
      // Volume conversion logic
      else if (field === 'volume_cubic_feet') {
        if (value && value !== '0') {
          updated.volume_cubic_yards = convertVolume(value, 'cubic_feet', 'cubic_yards');
          updated.volume_cubic_meters = convertVolume(value, 'cubic_feet', 'cubic_meters');
        } else {
          updated.volume_cubic_yards = '';
          updated.volume_cubic_meters = '';
        }
      } else if (field === 'volume_cubic_yards') {
        if (value && value !== '0') {
          updated.volume_cubic_feet = convertVolume(value, 'cubic_yards', 'cubic_feet');
          updated.volume_cubic_meters = convertVolume(value, 'cubic_yards', 'cubic_meters');
        } else {
          updated.volume_cubic_feet = '';
          updated.volume_cubic_meters = '';
        }
      } else if (field === 'volume_cubic_meters') {
        if (value && value !== '0') {
          updated.volume_cubic_feet = convertVolume(value, 'cubic_meters', 'cubic_feet');
          updated.volume_cubic_yards = convertVolume(value, 'cubic_meters', 'cubic_yards');
        } else {
          updated.volume_cubic_feet = '';
          updated.volume_cubic_yards = '';
        }
      } else if (field === 'volume_unit') {
        // When volume_unit changes, keep current values
      }
      
      return updated;
    });
  };

  const grossWeight = parseFloat(formData.gross_weight) || 0;
  const tareWeight = parseFloat(formData.tare_weight) || 0;
  const netWeight = grossWeight && tareWeight ? (grossWeight - tareWeight).toFixed(2) : '0.00';
  const hasWeightError = grossWeight > 0 && tareWeight > 0 && tareWeight > grossWeight;
  
  const weightUnit = useMetric ? 'kg' : 'lbs';

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Button
          variant="outline"
          size="icon"
          onClick={() => navigate(createPageUrl("Dashboard"))}
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">New Inbound Shipment</h1>
          <p className="text-sm text-gray-600">Record new truck arrival</p>
        </div>
        <Badge variant="outline" className="text-xs">
          {useMetric ? 'METRIC' : 'IMPERIAL'}
        </Badge>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit}>
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TruckIcon className="w-5 h-5" />
              Shipment Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="supplier">Supplier *</Label>
                {allSupplierOptions.length > 0 ? (
                  <Select
                    value={formData.supplier_name}
                    onValueChange={(value) => handleChange('supplier_name', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select supplier" />
                    </SelectTrigger>
                    <SelectContent>
                      {allSupplierOptions.map((name) => (
                        <SelectItem key={name} value={name}>
                          {name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id="supplier"
                    value={formData.supplier_name}
                    onChange={(e) => handleChange('supplier_name', e.target.value)}
                    placeholder="Enter supplier name"
                    required
                  />
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="truck">Truck Number *</Label>
                <Input
                  id="truck"
                  value={formData.truck_number}
                  onChange={(e) => handleChange('truck_number', e.target.value)}
                  placeholder="e.g., TRK-123"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="driver">Driver Name</Label>
                <Input
                  id="driver"
                  value={formData.driver_name}
                  onChange={(e) => handleChange('driver_name', e.target.value)}
                  placeholder="Driver name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="loadType">Load Type *</Label>
                <Select
                  value={formData.load_type}
                  onValueChange={(value) => handleChange('load_type', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {loadTypeOptions.map((type) => (
                      <SelectItem key={type} value={type}>
                        {formatLoadTypeLabel(type)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="container">Container Type</Label>
                <Select
                  value={formData.container_type}
                  onValueChange={(value) => handleChange('container_type', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select container type" />
                  </SelectTrigger>
                  <SelectContent>
                    {containers.map((container) => (
                      <SelectItem key={container.id} value={container.container_code}>
                        {container.container_code} - {container.container_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6 border-purple-200 bg-purple-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5 text-purple-600" />
              Product Classification
            </CardTitle>
            <p className="text-sm text-gray-600 mt-1">Specify product category, type, format, and purity</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select
                  value={formData.product_category}
                  onValueChange={(value) => handleChange('product_category', value)}
                  disabled={availableCategories.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={availableCategories.length === 0 ? `No categories for ${formData.load_type} type` : "Select category"} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableCategories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {availableCategories.length === 0 && (
                  <p className="text-xs text-orange-600">
                    {`No categories defined for load type "${formData.load_type}". Try changing load type or contact admin.`}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="subCategory">Sub-Category</Label>
                <Select
                  value={formData.product_sub_category}
                  onValueChange={(value) => handleChange('product_sub_category', value)}
                  disabled={!formData.product_category || availableSubCategories.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select sub-category" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSubCategories.map((sub) => (
                      <SelectItem key={sub} value={sub}>
                        {sub}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="productType">Product Type</Label>
                {availableProductTypes.length > 0 ? (
                  <Select
                    value={formData.product_type}
                    onValueChange={(value) => handleChange('product_type', value)}
                    disabled={!formData.product_sub_category}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select product type" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableProductTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id="productType"
                    value={formData.product_type}
                    onChange={(e) => handleChange('product_type', e.target.value)}
                    placeholder="Enter product type (e.g., PP, PE, Aluminum)"
                    disabled={!formData.product_sub_category}
                  />
                )}
                {!formData.product_sub_category && (
                  <p className="text-xs text-gray-500">Select sub-category first</p>
                )}
                {formData.product_sub_category && availableProductTypes.length === 0 && (
                  <p className="text-xs text-blue-600">No existing SKUs found - enter product type manually</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="purity">Purity</Label>
                <Select
                  value={formData.product_purity}
                  onValueChange={(value) => handleChange('product_purity', value)}
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

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="format">Format</Label>
                <Select
                  value={formData.product_format}
                  onValueChange={(value) => handleChange('product_format', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select format" />
                  </SelectTrigger>
                  <SelectContent>
                    {formatOptions.map((format) => (
                      <SelectItem key={format} value={format}>
                        {format}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {matchingSKU && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm font-semibold text-green-900">Matching SKU Found:</p>
                <p className="text-xs text-gray-700 mt-1">{matchingSKU.sku_number}</p>
                {matchingSKU.description && (
                  <p className="text-xs text-gray-600 mt-1">{matchingSKU.description}</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Weight Information</CardTitle>
            <p className="text-sm text-gray-600">
              Gross Weight = Truck + Load | Tare Weight = Empty Truck | Unit: {weightUnit}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {hasWeightError && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Tare weight ({tareWeight} {weightUnit}) cannot exceed gross weight ({grossWeight} {weightUnit})
                </AlertDescription>
              </Alert>
            )}
            
            <div className="grid md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="gross">Gross Weight ({weightUnit})</Label>
                <Input
                  id="gross"
                  type="number"
                  step="0.01"
                  value={formData.gross_weight}
                  onChange={(e) => handleChange('gross_weight', e.target.value)}
                  placeholder="0.00"
                  className={hasWeightError ? 'border-red-500' : ''}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tare">Tare Weight ({weightUnit})</Label>
                <Input
                  id="tare"
                  type="number"
                  step="0.01"
                  value={formData.tare_weight}
                  onChange={(e) => handleChange('tare_weight', e.target.value)}
                  placeholder="0.00"
                  className={hasWeightError ? 'border-red-500' : ''}
                />
              </div>

              <div className="space-y-2">
                <Label>Net Weight ({weightUnit})</Label>
                <div className={`h-10 rounded-md px-3 flex items-center font-semibold ${
                  hasWeightError ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-900'
                }`}>
                  {netWeight}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6 border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Boxes className="w-5 h-5 text-blue-600" />
              Volume Information
              <Badge className="bg-blue-600 text-white text-xs">PHASE III</Badge>
            </CardTitle>
            <p className="text-sm text-blue-900">
              Enter volume in any unit - other units auto-calculate
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Primary Volume Unit (for display)</Label>
              <Select
                value={formData.volume_unit}
                onValueChange={(value) => handleChange('volume_unit', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cubic_feet">Cubic Feet (ft³)</SelectItem>
                    <SelectItem value="cubic_yards">Cubic Yards (yd³)</SelectItem>
                    <SelectItem value="cubic_meters">Cubic Meters (m³)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

            <div className="grid md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="volumeFeet">Volume (ft³)</Label>
                <Input
                  id="volumeFeet"
                  type="number"
                  step="0.01"
                  value={formData.volume_cubic_feet}
                  onChange={(e) => handleChange('volume_cubic_feet', e.target.value)}
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="volumeYards">Volume (yd³)</Label>
                <Input
                  id="volumeYards"
                  type="number"
                  step="0.01"
                  value={formData.volume_cubic_yards}
                  onChange={(e) => handleChange('volume_cubic_yards', e.target.value)}
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="volumeMeters">Volume (m³)</Label>
                <Input
                  id="volumeMeters"
                  type="number"
                  step="0.01"
                  value={formData.volume_cubic_meters}
                  onChange={(e) => handleChange('volume_cubic_meters', e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>
            
            <p className="text-xs text-blue-700">
              💡 Auto-conversion: Enter any field and the others calculate automatically
            </p>
          </CardContent>
        </Card>

        {photoUploadEnabled && (
          <Card className="mb-6 border-blue-200 bg-blue-50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Camera className="w-5 h-5 text-blue-600" />
                  Shipment Photos
                  <Badge className="bg-blue-600 text-white text-xs">PHASE II</Badge>
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                capture="environment"
                onChange={(e) => handlePhotoUpload(e.target.files)}
                className="hidden"
              />
              
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingPhotos}
                  className="flex-1 gap-2"
                >
                  <Camera className="w-4 h-4" />
                  {uploadingPhotos ? 'Uploading...' : 'Take Photo'}
                </Button>
                
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingPhotos}
                  className="flex-1 gap-2"
                >
                  <Upload className="w-4 h-4" />
                  Upload from Gallery
                </Button>
              </div>

              {photoUrls.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-4">
                  {photoUrls.map((url, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={url}
                        alt={`Photo ${index + 1}`}
                        className="w-full h-32 object-cover rounded-lg border-2 border-gray-200"
                      />
                      <button
                        type="button"
                        onClick={() => removePhoto(index)}
                        className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <p className="text-xs text-gray-600">
                {photoUrls.length} photo(s) attached
              </p>
            </CardContent>
          </Card>
        )}

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Additional Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              placeholder="Enter any additional notes or observations..."
              rows={4}
            />
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(createPageUrl("Dashboard"))}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={createShipmentMutation.isPending || hasWeightError}
            className="flex-1 bg-green-600 hover:bg-green-700 gap-2"
          >
            <Save className="w-4 h-4" />
            {createShipmentMutation.isPending ? 'Saving...' : 'Save Shipment'}
          </Button>
        </div>
      </form>
    </div>
  );
}