import React, { useState } from "react";
import { recims } from "@/api/recimsClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTenant } from "@/components/TenantContext";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Shield,
  ArrowLeft,
  Settings,
  Camera,
  Scale,
  Bell,
  AlertCircle,
  Building2,
  Globe,
  Palette,
  Truck,
  MapPin,
  Upload,
  Save,
  Plus,
  Wifi,
  WifiOff,
  Package,
  ClipboardCheck,
  RefreshCw,
  FileText,
  Mail,
  Users,
  Edit,
  ArrowRightLeft,
  BarChart3,
  CheckCircle
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

const FEATURE_SETTINGS = [
  {
    key: 'enable_photo_upload_inbound',
    label: 'Photo Upload - Inbound Shipments',
    description: 'Allow operators to upload photos when creating inbound shipments',
    phase: 'PHASE II',
    icon: Camera,
    category: 'features'
  },
  {
    key: 'enable_photo_upload_classification',
    label: 'Photo Upload - Material Classification',
    description: 'Allow operators to upload inspection photos during material classification',
    phase: 'PHASE II',
    icon: Camera,
    category: 'features'
  },
  {
    key: 'enable_qc_module',
    label: 'Quality Control Module',
    description: 'Enable comprehensive QC inspection, criteria management, and disposition tracking',
    phase: 'PHASE IV',
    icon: ClipboardCheck,
    category: 'features'
  },
  {
    key: 'enable_inventory_module',
    label: 'Inventory Management Module',
    description: 'Track processed materials, manage stock levels, and link to sales orders',
    phase: 'PHASE IV',
    icon: Package,
    category: 'features'
  },
  {
    key: 'enable_stock_transfer',
    label: 'Stock Transfer',
    description: 'Enable stock transfer functionality to move inventory between bins and zones with audit trail',
    phase: 'PHASE IV',
    icon: ArrowRightLeft,
    category: 'features'
  },
  {
    key: 'enable_kpi_dashboard',
    label: 'KPI Dashboard & Advanced Analytics',
    description: 'Enable advanced KPI tracking, performance metrics, trends, and analytics dashboards',
    phase: 'PHASE V',
    icon: BarChart3,
    category: 'features'
  },
  {
    key: 'enable_po_module',
    label: 'Purchase Order Module',
    description: 'Enable purchase order creation, barcode generation, and receiving workflow',
    phase: 'PHASE III',
    icon: FileText,
    category: 'features'
  },
  {
    key: 'enable_scale_integration',
    label: 'Bluetooth Scale Integration',
    description: 'Enable automatic weight capture from connected scales',
    phase: 'PHASE IV',
    icon: Scale,
    category: 'features'
  },
  {
    key: 'enable_offline_mode',
    label: 'Offline Mode',
    description: 'Allow app to function without internet connection',
    phase: 'PHASE III',
    icon: WifiOff,
    category: 'features'
  },
  {
    key: 'enable_picking_list',
    label: 'Picking List',
    description: 'Enable warehouse picking list functionality',
    phase: 'PHASE III',
    icon: Truck,
    category: 'features'
  },
  {
    key: 'enable_email_automation',
    label: 'Email Automation - PO & Invoices',
    description: 'Enable automated email sending for purchase orders and invoices with configurable templates',
    phase: 'PHASE IV',
    icon: Mail,
    category: 'features'
  },
  {
    key: 'enable_product_images',
    label: 'Product SKU Images',
    description: 'Upload and display product images for operators during receiving and picking (stored in AWS S3)',
    phase: 'PHASE V',
    icon: Camera,
    category: 'features'
  },
  {
    key: 'enable_ai_insights',
    label: 'AI Insights Module',
    description: 'Enable AI-powered insights for demand forecasting, anomaly detection, quality predictions, and operational recommendations',
    phase: 'PHASE VI',
    icon: BarChart3,
    category: 'features'
  },
  {
    key: 'enable_bin_capacity_management',
    label: 'Bin Capacity Management',
    description: 'Enable bin capacity tracking, warnings when capacity exceeded, and recommendations to split products across bins',
    phase: 'PHASE III',
    icon: Package,
    category: 'features'
  },
];

export default function SuperAdmin() {
  const queryClient = useQueryClient();
  const { user, loading } = useTenant();
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [activeTab, setActiveTab] = useState('tenant');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingTenantLogo, setUploadingTenantLogo] = useState(false);
  const logoInputRef = React.useRef(null);
  const minTechLogoRef = React.useRef(null);
  const ctMetalsLogoRef = React.useRef(null);

  const { data: tenants = [] } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => recims.entities.Tenant.list(),
    initialData: [],
    enabled: Boolean(user),
  });

  // Color editing mode
  const [editingColors, setEditingColors] = useState(false);

  // Min-Tech 6-Color Palette with Names
  const [colorPrimary1, setColorPrimary1] = useState('#007A6E');
  const [colorPrimary2, setColorPrimary2] = useState('#005247');
  const [colorSecondary1, setColorSecondary1] = useState('#2A66FF');
  const [colorSecondary2, setColorSecondary2] = useState('#1E3C96');
  const [colorTertiary1, setColorTertiary1] = useState('#B0C92C');
  const [colorTertiary2, setColorTertiary2] = useState('#7C5C3A');

  // Color Names
  const [namePrimary1, setNamePrimary1] = useState('Sea Green');
  const [namePrimary2, setNamePrimary2] = useState('Deep Kelp');
  const [nameSecondary1, setNameSecondary1] = useState('Clean Blue');
  const [nameSecondary2, setNameSecondary2] = useState('Navy Utility');
  const [nameTertiary1, setNameTertiary1] = useState('Chartreuse');
  const [nameTertiary2, setNameTertiary2] = useState('Earth Brown');

  // Color format states
  const [primary1Format, setPrimary1Format] = useState('hex');
  const [primary2Format, setPrimary2Format] = useState('hex');
  const [secondary1Format, setSecondary1Format] = useState('hex');
  const [secondary2Format, setSecondary2Format] = useState('hex');
  const [tertiory1Format, setTertiary1Format] = useState('hex');
  const [tertiory2Format, setTertiary2Format] = useState('hex');

  // Initial RGB values from HEX for consistency
  const [primary1Rgb, setPrimary1Rgb] = useState({ r: 0, g: 122, b: 110 });
  const [primary2Rgb, setPrimary2Rgb] = useState({ r: 0, g: 82, b: 71 });
  const [secondary1Rgb, setSecondary1Rgb] = useState({ r: 42, g: 102, b: 255 });
  const [secondary2Rgb, setSecondary2Rgb] = useState({ r: 30, g: 60, b: 150 });
  const [tertiary1Rgb, setTertiary1Rgb] = useState({ r: 176, g: 201, b: 44 });
  const [tertiary2Rgb, setTertiary2Rgb] = useState({ r: 124, g: 92, b: 58 });

  const [primary1Pantone, setPrimary1Pantone] = useState('');
  const [primary2Pantone, setPrimary2Pantone] = useState('');
  const [secondary1Pantone, setSecondary1Pantone] = useState('');
  const [secondary2Pantone, setSecondary2Pantone] = useState('');
  const [tertiary1Pantone, setTertiary1Pantone] = useState('');
  const [tertiary2Pantone, setTertiary2Pantone] = useState('');

  const adminCards = [
    {
      title: "Cross-Tenant Dashboard",
      description: "View combined metrics across multiple tenants (Super Admin / Cross-Tenant Admin only)",
      icon: BarChart3,
      path: "CrossTenantDashboard",
      color: "bg-purple-100",
      iconColor: "text-purple-600",
      badge: "RESTRICTED",
      badgeColor: "bg-purple-600"
    },
    {
      title: "Manage Carriers",
      description: "Configure shipping carriers and their contact information",
      icon: Truck,
      path: "ManageCarriers",
      color: "bg-blue-100",
      iconColor: "text-blue-600"
    },
    {
      title: "Manage Containers",
      description: "Define container types (skids, gaylords, drums, etc.)",
      icon: Package,
      path: "ManageContainers",
      color: "bg-green-100",
      iconColor: "text-green-600"
    },
    {
      title: "Manage Product SKUs",
      description: "Configure product SKUs and material types",
      icon: FileText,
      path: "ManageProductSKUs",
      color: "bg-purple-100",
      iconColor: "text-purple-600"
    },
    {
      title: "Zone Management",
      description: "Configure warehouse zones (ZONE-001 to ZONE-999)",
      icon: MapPin,
      path: "ZoneManagement",
      color: "bg-indigo-100",
      iconColor: "text-indigo-600",
      badge: "PHASE II+",
      badgeColor: "bg-blue-600"
    },
    {
      title: "Bin Management",
      description: "Configure storage bins with colors and descriptions",
      icon: Package,
      path: "BinManagement",
      color: "bg-teal-100",
      iconColor: "text-teal-600",
      badge: "PHASE I+",
      badgeColor: "bg-green-600"
    },
    {
      title: "Tenant Contacts",
      description: "Manage tenant contact persons and signatures",
      icon: Users,
      path: "ManageTenantContacts",
      color: "bg-orange-100",
      iconColor: "text-orange-600",
      badge: "PHASE III",
      badgeColor: "bg-purple-600"
    },
    {
      title: "Email Templates",
      description: "Configure email templates for automated communications",
      icon: Mail,
      path: "EmailTemplates",
      color: "bg-pink-100",
      iconColor: "text-pink-600",
      badge: "PHASE IV",
      badgeColor: "bg-purple-600"
    }
  ];

  const normalizedRole = typeof user?.role === 'string' ? user.role.toLowerCase() : '';
  const normalizedDetailedRole = typeof user?.detailed_role === 'string' ? user.detailed_role.toLowerCase() : '';
  const hasAdminAccess = [normalizedRole, normalizedDetailedRole].some((roleValue) =>
    ['admin', 'super_admin', 'superadmin'].includes(roleValue)
  );

  React.useEffect(() => {
    if (!user) return;

    if (!hasAdminAccess) {
      setError("Access denied. Admin or Super Admin privileges required.");
    } else {
      setError(null);
    }
  }, [user, hasAdminAccess]);

  const { data: settings = [], isLoading } = useQuery({
    queryKey: ['appSettings'],
    queryFn: async () => {
      const allSettings = await recims.entities.AppSettings.list();
      return allSettings;
    },
    initialData: [],
  });

  // Update color state when settings load - UPDATED to include names
  React.useEffect(() => {
    if (settings.length > 0) {
      const primary1Setting = settings.find(s => s.setting_key === 'color_primary');
      const primary2Setting = settings.find(s => s.setting_key === 'color_deep_kelp');
      const secondary1Setting = settings.find(s => s.setting_key === 'color_secondary');
      const secondary2Setting = settings.find(s => s.setting_key === 'color_complimentary_2');
      const tertiary1Setting = settings.find(s => s.setting_key === 'color_complimentary_1');
      const tertiary2Setting = settings.find(s => s.setting_key === 'color_earth_brown');

      if (primary1Setting?.setting_value) {
        setColorPrimary1(primary1Setting.setting_value);
        setPrimary1Rgb(hexToRgb(primary1Setting.setting_value));
        // Extract name from description
        if (primary1Setting.description) {
          const match = primary1Setting.description.match(/Primary #1 - (.+)$/);
          if (match) setNamePrimary1(match[1]);
        }
      }
      if (primary2Setting?.setting_value) {
        setColorPrimary2(primary2Setting.setting_value);
        setPrimary2Rgb(hexToRgb(primary2Setting.setting_value));
        if (primary2Setting.description) {
          const match = primary2Setting.description.match(/Primary #2 - (.+)$/);
          if (match) setNamePrimary2(match[1]);
        }
      }
      if (secondary1Setting?.setting_value) {
        setColorSecondary1(secondary1Setting.setting_value);
        setSecondary1Rgb(hexToRgb(secondary1Setting.setting_value));
        if (secondary1Setting.description) {
          const match = secondary1Setting.description.match(/Secondary #1 - (.+)$/);
          if (match) setNameSecondary1(match[1]);
        }
      }
      if (secondary2Setting?.setting_value) {
        setColorSecondary2(secondary2Setting.setting_value);
        setSecondary2Rgb(hexToRgb(secondary2Setting.setting_value));
        if (secondary2Setting.description) {
          const match = secondary2Setting.description.match(/Secondary #2 - (.+)$/);
          if (match) setNameSecondary2(match[1]);
        }
      }
      if (tertiary1Setting?.setting_value) {
        setColorTertiary1(tertiary1Setting.setting_value);
        setTertiary1Rgb(hexToRgb(tertiary1Setting.setting_value));
        if (tertiary1Setting.description) {
          const match = tertiary1Setting.description.match(/Tertiary #1 - (.+)$/);
          if (match) setNameTertiary1(match[1]);
        }
      }
      if (tertiary2Setting?.setting_value) {
        setColorTertiary2(tertiary2Setting.setting_value);
        setTertiary2Rgb(hexToRgb(tertiary2Setting.setting_value));
        if (tertiary2Setting.description) {
          const match = tertiary2Setting.description.match(/Tertiary #2 - (.+)$/);
          if (match) setNameTertiary2(match[1]);
        }
      }
    }
  }, [settings, setColorPrimary1, setPrimary1Rgb, setNamePrimary1,
      setColorPrimary2, setPrimary2Rgb, setNamePrimary2,
      setColorSecondary1, setSecondary1Rgb, setNameSecondary1,
      setColorSecondary2, setSecondary2Rgb, setNameSecondary2,
      setColorTertiary1, setTertiary1Rgb, setNameTertiary1,
      setColorTertiary2, setTertiary2Rgb, setNameTertiary2
  ]);

  const { data: carriers = [] } = useQuery({
    queryKey: ['carriers'],
    queryFn: () => recims.entities.Carrier.list(),
    initialData: [],
  });

  const { data: materialCategories = [] } = useQuery({
    queryKey: ['materialCategories'],
    queryFn: () => recims.entities.MaterialCategory.list(),
    initialData: [],
  });

  const { data: zones = [] } = useQuery({
    queryKey: ['zones'],
    queryFn: () => recims.entities.Zone.list(),
    initialData: [],
  });

  // Color conversion utilities
  const hexToRgb = (hex) => {
    if (!hex || typeof hex !== 'string' || !hex.match(/^#?([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)) return { r: 0, g: 0, b: 0 };
    const hexValue = hex.startsWith('#') ? hex.slice(1) : hex;
    const shorthandRegex = /^([a-f\d])([a-f\d])([a-f\d])$/i;
    const fullHex = hexValue.replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);
    const result = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fullHex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
  };

  const rgbToHex = (r, g, b) => {
    return "#" + ((1 << 24) + ((r < 0 ? 0 : r > 255 ? 255 : r) << 16) + ((g < 0 ? 0 : g > 255 ? 255 : g) << 8) + (b < 0 ? 0 : b > 255 ? 255 : b)).toString(16).slice(1).padStart(6, '0');
  };

  const updateSettingMutation = useMutation({
    mutationFn: async ({ key, value, category = 'features', description = '', phase = '' }) => {
      const existingSetting = settings.find(s => s.setting_key === key);

      if (existingSetting) {
        return await recims.entities.AppSettings.update(existingSetting.id, {
          setting_value: value
        });
      } else {
        return await recims.entities.AppSettings.create({
          setting_key: key,
          setting_value: value,
          setting_category: category,
          description,
          phase
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appSettings'] });
      setSuccess("Settings updated successfully");
      setTimeout(() => setSuccess(null), 3000);
    },
  });

  const switchTenantMutation = useMutation({
    mutationFn: async ({ tenantId }) => {
      return await recims.auth.updateMe({ tenant_id: tenantId });
    },
    onSuccess: async (_data, variables) => {
      const tenantName = variables?.tenantName;
      setSuccess(
        tenantName
          ? `Tenant switched to ${tenantName}. Reloading...`
          : 'Tenant switched successfully. Reloading...'
      );
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    },
    onError: (err) => {
      const message = err?.message || 'Failed to switch tenant';
      setError(message);
      setTimeout(() => setError(null), 3000);
    }
  });

  // UPDATED: Save colors mutation to include names in description
  const saveColorsMutation = useMutation({
    mutationFn: async ({ colors, names }) => {
      const promises = [];

      // Primary #1
      const primary1Setting = settings.find(s => s.setting_key === 'color_primary');
      if (primary1Setting) {
        promises.push(recims.entities.AppSettings.update(primary1Setting.id, {
          setting_value: colors.primary1,
          description: `Primary #1 - ${names.primary1}`
        }));
      } else {
        promises.push(recims.entities.AppSettings.create({
          setting_key: 'color_primary',
          setting_value: colors.primary1,
          setting_category: 'appearance',
          description: `Primary #1 - ${names.primary1}`
        }));
      }

      // Primary #2
      const primary2Setting = settings.find(s => s.setting_key === 'color_deep_kelp');
      if (primary2Setting) {
        promises.push(recims.entities.AppSettings.update(primary2Setting.id, {
          setting_value: colors.primary2,
          description: `Primary #2 - ${names.primary2}`
        }));
      } else {
        promises.push(recims.entities.AppSettings.create({
          setting_key: 'color_deep_kelp',
          setting_value: colors.primary2,
          setting_category: 'appearance',
          description: `Primary #2 - ${names.primary2}`
        }));
      }

      // Secondary #1
      const secondary1Setting = settings.find(s => s.setting_key === 'color_secondary');
      if (secondary1Setting) {
        promises.push(recims.entities.AppSettings.update(secondary1Setting.id, {
          setting_value: colors.secondary1,
          description: `Secondary #1 - ${names.secondary1}`
        }));
      } else {
        promises.push(recims.entities.AppSettings.create({
          setting_key: 'color_secondary',
          setting_value: colors.secondary1,
          setting_category: 'appearance',
          description: `Secondary #1 - ${names.secondary1}`
        }));
      }

      // Secondary #2
      const secondary2Setting = settings.find(s => s.setting_key === 'color_complimentary_2');
      if (secondary2Setting) {
        promises.push(recims.entities.AppSettings.update(secondary2Setting.id, {
          setting_value: colors.secondary2,
          description: `Secondary #2 - ${names.secondary2}`
        }));
      } else {
        promises.push(recims.entities.AppSettings.create({
          setting_key: 'color_complimentary_2',
          setting_value: colors.secondary2,
          setting_category: 'appearance',
          description: `Secondary #2 - ${names.secondary2}`
        }));
      }

      // Tertiary #1
      const tertiary1Setting = settings.find(s => s.setting_key === 'color_complimentary_1');
      if (tertiary1Setting) {
        promises.push(recims.entities.AppSettings.update(tertiary1Setting.id, {
          setting_value: colors.tertiary1,
          description: `Tertiary #1 - ${names.tertiary1}`
        }));
      } else {
        promises.push(recims.entities.AppSettings.create({
          setting_key: 'color_complimentary_1',
          setting_value: colors.tertiary1,
          setting_category: 'appearance',
          description: `Tertiary #1 - ${names.tertiary1}`
        }));
      }

      // Tertiary #2
      const tertiary2Setting = settings.find(s => s.setting_key === 'color_earth_brown');
      if (tertiary2Setting) {
        promises.push(recims.entities.AppSettings.update(tertiary2Setting.id, {
          setting_value: colors.tertiary2,
          description: `Tertiary #2 - ${names.tertiary2}`
        }));
      } else {
        promises.push(recims.entities.AppSettings.create({
          setting_key: 'color_earth_brown',
          setting_value: colors.tertiary2,
          setting_category: 'appearance',
          description: `Tertiary #2 - ${names.tertiary2}`
        }));
      }

      return await Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appSettings'] });
      setSuccess("Min-Tech color palette saved successfully");
      setEditingColors(false);
      setTimeout(() => setSuccess(null), 3000);
    },
    onError: (err) => {
      setError("Failed to save color settings");
      setTimeout(() => setError(null), 3000);
    }
  });

  const handleLogoUpload = async (file) => {
    setUploadingLogo(true);
    setError(null);
    try {
      const { file_url } = await recims.integrations.Core.UploadFile({ file });
      await updateSettingMutation.mutateAsync({
        key: 'company_logo_url',
        value: file_url,
        category: 'appearance',
        description: 'Company logo URL'
      });
    } catch (err) {
      setError("Failed to upload logo");
      setTimeout(() => setError(null), 3000);
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleTenantLogoUpload = async (file, tenant) => {
    setUploadingTenantLogo(true);
    setError(null);
    try {
      const { file_url } = await recims.integrations.Core.UploadFile({ file });
      const settingKey = `${tenant}_logo_url`;
      await updateSettingMutation.mutateAsync({
        key: settingKey,
        value: file_url,
        category: 'company',
        description: `${tenant === 'min_tech' ? 'Min-Tech' : 'Connecticut Metals'} company logo`
      });
      setSuccess("Tenant logo uploaded successfully");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError("Failed to upload tenant logo");
      setTimeout(() => setError(null), 3000);
    } finally {
      setUploadingTenantLogo(false);
    }
  };


  const getSettingValue = (key) => {
    const setting = settings.find(s => s.setting_key === key);
    return setting?.setting_value || '';
  };

  const handleToggle = (key, currentValue) => {
    const feature = FEATURE_SETTINGS.find(f => f.key === key);
    updateSettingMutation.mutate({
      key,
      value: currentValue ? 'false' : 'true',
      category: feature?.category || 'features',
      description: feature?.description || '',
      phase: feature?.phase || ''
    });
  };

  const handleSaveSetting = (key, value, category = 'system', description = '') => {
    updateSettingMutation.mutate({ key, value, category, description });
  };

  // UPDATED: Save colors with names
  const handleSaveColors = () => {
    saveColorsMutation.mutate({
      colors: {
        primary1: colorPrimary1,
        primary2: colorPrimary2,
        secondary1: colorSecondary1,
        secondary2: colorSecondary2,
        tertiary1: colorTertiary1,
        tertiary2: colorTertiary2
      },
      names: {
        primary1: namePrimary1,
        primary2: namePrimary2,
        secondary1: nameSecondary1,
        secondary2: nameSecondary2,
        tertiary1: nameTertiary1,
        tertiary2: nameTertiary2
      }
    });
  };

  // Generic color change handler for hex and rgb
  const handleColorChange = (hexSetter, rgbSetter, value, format) => {
    if (format === 'hex') {
      hexSetter(value);
      rgbSetter(hexToRgb(value));
    } else if (format === 'rgb') {
      rgbSetter(value);
      hexSetter(rgbToHex(value.r, value.g, value.b));
    }
  };

  const handleTenantSwitch = async (selectedTenantValue) => {
    const normalizedValue = `${selectedTenantValue}`;
    const targetTenant = tenants.find((tenant) => {
      const candidateId = tenant.tenant_id ?? tenant.id;
      return candidateId !== undefined && `${candidateId}` === normalizedValue;
    });

    const tenantIdentifier = targetTenant?.tenant_id ?? targetTenant?.id;

    if (targetTenant && (tenantIdentifier === undefined || tenantIdentifier === null)) {
      setError('Selected tenant is missing an identifier');
      setTimeout(() => setError(null), 3000);
      return;
    }

    const tenantId = tenantIdentifier ?? normalizedValue;
    const tenantName = targetTenant?.display_name || targetTenant?.name || normalizedValue;

    if (window.confirm(`Switch to ${tenantName}? This will reload the application.`)) {
      switchTenantMutation.mutate({ tenantId, tenantName });
    }
  };

  // UPDATED: ColorPicker Component with editable name
  const ColorPicker = ({ label, colorName, setColorName, color, rgb, pantone, format, setFormat, onColorChange, setPantone, disabled }) => (
    <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
      <div className="flex items-center justify-between">
        <Label className="text-base font-semibold">{label}</Label>
        <Select value={format} onValueChange={setFormat} disabled={disabled}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="hex">HEX</SelectItem>
            <SelectItem value="rgb">RGB</SelectItem>
            <SelectItem value="pantone">Pantone</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* NEW: Editable Color Name */}
      <div className="space-y-2">
        <Label className="text-sm text-gray-600">Color Name</Label>
        <Input
          value={colorName}
          onChange={(e) => setColorName(e.target.value)}
          disabled={disabled}
          placeholder="e.g., Sea Green"
          className="font-semibold"
        />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Color Wheel Picker */}
        <div className="space-y-2">
          <Label className="text-sm text-gray-600">Color Wheel Picker</Label>
          <div className="flex gap-3 items-center">
            <input
              type="color"
              value={color}
              onChange={(e) => onColorChange(e.target.value, 'hex')}
              disabled={disabled}
              className="w-20 h-20 cursor-pointer border-2 border-gray-300 rounded disabled:opacity-50"
              style={{ padding: '2px' }}
            />
            <div className="flex-1 h-20 p-4 rounded-lg border-2 border-gray-300 flex items-center justify-center" style={{ backgroundColor: color }}>
              <p className="text-sm text-white font-semibold drop-shadow-md">Color Preview</p>
            </div>
          </div>
        </div>

        {/* Format-specific input */}
        <div className="space-y-2">
          {format === 'hex' && (
            <div>
              <Label className="text-sm text-gray-600">HEX Code</Label>
              <Input
                value={color}
                onChange={(e) => onColorChange(e.target.value, 'hex')}
                disabled={disabled}
                placeholder="#007A6E"
                className="mt-2 font-mono"
              />
            </div>
          )}

          {format === 'rgb' && (
            <div className="space-y-3">
              <Label className="text-sm text-gray-600">RGB Values</Label>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold w-8">R:</span>
                  <Input
                    type="number"
                    min="0"
                    max="255"
                    value={rgb.r}
                    onChange={(e) => onColorChange({...rgb, r: parseInt(e.target.value) || 0}, 'rgb')}
                    disabled={disabled}
                    className="flex-1"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold w-8">G:</span>
                  <Input
                    type="number"
                    min="0"
                    max="255"
                    value={rgb.g}
                    onChange={(e) => onColorChange({...rgb, g: parseInt(e.target.value) || 0}, 'rgb')}
                    disabled={disabled}
                    className="flex-1"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold w-8">B:</span>
                  <Input
                    type="number"
                    min="0"
                    max="255"
                    value={rgb.b}
                    onChange={(e) => onColorChange({...rgb, b: parseInt(e.target.value) || 0}, 'rgb')}
                    disabled={disabled}
                    className="flex-1"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                RGB({rgb.r}, {rgb.g}, {rgb.b})
              </p>
            </div>
          )}

          {format === 'pantone' && (
            <div>
              <Label className="text-sm text-gray-600">Pantone Code</Label>
              <Input
                value={pantone}
                onChange={(e) => setPantone(e.target.value)}
                disabled={disabled}
                placeholder="e.g., PANTONE 349 C"
                className="mt-2"
              />
              <p className="text-xs text-gray-500 mt-2">
                Note: Enter Pantone code for reference. Color preview shows current HEX value.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="p-3 bg-white rounded-lg border">
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div>
            <p className="text-gray-600">HEX</p>
            <p className="font-mono font-semibold">{color}</p>
          </div>
          <div>
            <p className="text-gray-600">RGB</p>
            <p className="font-mono font-semibold">
              {rgb.r}, {rgb.g}, {rgb.b}
            </p>
          </div>
          {pantone && (
            <div>
              <p className="text-gray-600">Pantone</p>
              <p className="font-semibold">{pantone}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (user && !hasAdminAccess) {
    return (
      <div className="p-4 md:p-8 max-w-4xl mx-auto">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Access denied. You need Super Administrator or Administrator privileges to access this page.
          </AlertDescription>
        </Alert>
        <Link to={createPageUrl("Dashboard")} className="mt-4 inline-block">
          <Button variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </Link>
      </div>
    );
  }

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  const currentTenantId = user?.tenant_id;
  const currentTenant = tenants.find((tenant) => {
    const candidateId = tenant.tenant_id ?? tenant.id;
    if (candidateId === undefined || currentTenantId === undefined || currentTenantId === null) {
      return false;
    }
    return `${candidateId}` === `${currentTenantId}`;
  });

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="sticky top-12 z-40 bg-white py-4 -mt-4 mb-6">
        <div className="flex items-center gap-3">
          <Link to={createPageUrl("Dashboard")}>
            <Button variant="outline" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Shield className="w-7 h-7 text-red-600" />
              Super Admin Settings
            </h1>
            <p className="text-sm text-gray-600">Configure system features and settings</p>
          </div>
          <Badge className="bg-red-100 text-red-700 border-red-300">
            Admin Only
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

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="mb-6 overflow-x-auto">
          <TabsList className="inline-flex w-auto min-w-full gap-2 p-1">
            <TabsTrigger value="tenant" className="px-4 py-2">Tenant</TabsTrigger>
            <TabsTrigger value="features" className="px-4 py-2">Features</TabsTrigger>
            <TabsTrigger value="integrations" className="px-4 py-2">AI & Integrations</TabsTrigger>
            <TabsTrigger value="appearance" className="px-4 py-2">Appearance</TabsTrigger>
            <TabsTrigger value="company" className="px-4 py-2">Company</TabsTrigger>
            <TabsTrigger value="localization" className="px-4 py-2">Localization</TabsTrigger>
            <TabsTrigger value="categories" className="px-4 py-2">Categories</TabsTrigger>
            <TabsTrigger value="carriers" className="px-4 py-2">Carriers</TabsTrigger>
            <TabsTrigger value="skus" className="px-4 py-2">Product SKUs</TabsTrigger>
            <TabsTrigger value="customers" className="px-4 py-2">Customers</TabsTrigger>
            <TabsTrigger value="vendors" className="px-4 py-2">Vendors</TabsTrigger>
          </TabsList>
        </div>

        {/* Tenant Selector Tab */}
        <TabsContent value="tenant">
          <Card className="border-2 border-purple-200">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Building2 className="w-6 h-6 text-purple-600" />
                <div>
                  <CardTitle>Current Tenant Context</CardTitle>
                  <p className="text-sm text-gray-600 mt-1">
                    View current tenant and switch context
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Current Tenant Display */}
                <div className="p-6 bg-gradient-to-br from-purple-50 to-indigo-50 rounded-lg border-2 border-purple-200">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Currently Active Tenant:</p>
                      <h3 className="text-2xl font-bold text-purple-900">
                        {currentTenant?.display_name || 'No Tenant Selected'}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">
                        {currentTenant?.description || ''}
                      </p>
                    </div>
                    <Badge className="bg-purple-600 text-white text-lg px-4 py-2">
                      {currentTenant?.region || 'N/A'}
                    </Badge>
                  </div>
                </div>

                {/* Tenant Switcher */}
                <div className="p-6 bg-white rounded-lg border-2">
                  <h3 className="font-semibold text-gray-900 mb-4">Switch Tenant Context</h3>
                  <div className="space-y-3">
                    <Label>Select Tenant</Label>
                    <Select
                      value={currentTenantId != null ? String(currentTenantId) : undefined}
                      onValueChange={handleTenantSwitch}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a tenant" />
                      </SelectTrigger>
                      <SelectContent>
                        {tenants.map((tenant, index) => {
                          const tenantValue = tenant.tenant_id ?? tenant.id;
                          const selectValue = tenantValue != null ? String(tenantValue) : `tenant-${index}`;
                          const tenantLabel = tenant.display_name || tenant.name || selectValue;
                          const regionLabel = tenant.region ? ` - ${tenant.region}` : '';

                          return (
                            <SelectItem
                              key={tenant.id ?? tenant.tenant_id ?? `tenant-${index}`}
                              value={selectValue}
                            >
                              {tenantLabel}{regionLabel}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-500">
                      Switching tenant will reload the application with the new context
                    </p>
                  </div>
                </div>

                {/* Link to Full Tenant Console */}
                <Alert className="bg-blue-50 border-blue-200">
                  <AlertCircle className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-blue-900">
                    <strong>Manage All Tenants:</strong> Use the new Tenant Console for full tenant management, creation, and configuration.
                  </AlertDescription>
                </Alert>

                <Link to={createPageUrl("TenantConsole")}>
                  <Button className="w-full bg-purple-600 hover:bg-purple-700 gap-2">
                    <Building2 className="w-5 h-5" />
                    Open Tenant Console
                  </Button>
                </Link>

                {/* Important Note */}
                <Alert className="bg-yellow-50 border-yellow-200">
                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                  <AlertDescription className="text-yellow-800">
                    <strong>Important:</strong> Tenant Console provides full multi-tenant management including:
                    <div className="mt-2 space-y-1 text-xs">
                      <p>• <strong>Tenant CRUD:</strong> Create, view, edit, suspend, and reactivate tenants</p>
                      <p>• <strong>Subdomain Routing:</strong> Configure base_subdomain for production deployment</p>
                      <p>• <strong>Locale Configuration:</strong> Currency, timezone, date/number formats, phone patterns</p>
                      <p>• <strong>Branding:</strong> Logo upload and color scheme management per tenant</p>
                      <p>• <strong>User Management:</strong> Assign tenant admins and manage user access</p>
                      <p>• <strong>Data Isolation:</strong> Each tenant has completely separate data</p>
                    </div>
                  </AlertDescription>
                </Alert>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* AI & Integrations Tab */}
        <TabsContent value="integrations">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-blue-600" />
                AI & External Integrations
              </CardTitle>
              <p className="text-sm text-gray-600 mt-1">
                Configure API keys for AI services and external integrations
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* OpenAI Configuration */}
              <div className="p-6 border-2 rounded-lg">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 rounded-lg bg-green-100">
                    <Settings className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">OpenAI API Configuration</h3>
                    <p className="text-sm text-gray-600">Configure OpenAI GPT-4o for AI-powered features</p>
                  </div>
                </div>

                <Alert className="mb-4 bg-blue-50 border-blue-200">
                  <AlertCircle className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-blue-900">
                    <strong>Note:</strong> This API key will be stored securely and used for AI agent responses, reports generation, and analytics.
                    Get your API key from <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="underline font-semibold">OpenAI Platform</a>.
                  </AlertDescription>
                </Alert>

                <div className="space-y-4">
                  <div>
                    <Label htmlFor="openai-key" className="text-sm font-semibold">OpenAI API Key</Label>
                    <div className="flex gap-2 mt-2">
                      <Input
                        id="openai-key"
                        type="password"
                        placeholder="sk-proj-..."
                        defaultValue={getSettingValue('openai_api_key')}
                        className="flex-1 font-mono text-sm"
                      />
                      <Button
                        onClick={(e) => {
                          const input = e.target.closest('div').querySelector('input');
                          handleSaveSetting('openai_api_key', input.value, 'integrations', 'OpenAI API Key for GPT-4o');
                        }}
                        disabled={updateSettingMutation.isPending}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <Save className="w-4 h-4 mr-2" />
                        Save Key
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Current status: {getSettingValue('openai_api_key') ? '✓ Configured' : '✗ Not configured'}
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="openai-model" className="text-sm font-semibold">OpenAI Model</Label>
                    <Select
                      value={getSettingValue('openai_model') || 'gpt-4o'}
                      onValueChange={(value) => handleSaveSetting('openai_model', value, 'integrations', 'OpenAI model selection')}
                    >
                      <SelectTrigger id="openai-model" className="mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gpt-4o">GPT-4o (Recommended)</SelectItem>
                        <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                        <SelectItem value="gpt-4">GPT-4</SelectItem>
                        <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo (Faster, Cheaper)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-500 mt-1">
                      Select the OpenAI model to use for AI-powered features
                    </p>
                  </div>
                </div>
              </div>

              {/* Future Integrations Placeholder */}
              <div className="p-6 border-2 border-dashed rounded-lg bg-gray-50">
                <p className="text-sm text-gray-600 text-center">
                  Additional integrations (AWS, Azure, etc.) can be configured here in the future
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Features Tab */}
        <TabsContent value="features">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-purple-600" />
                Feature Toggles by Phase
              </CardTitle>
              <p className="text-sm text-gray-600 mt-1">
                Select entire phases or individual features
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {Object.entries(
                FEATURE_SETTINGS.reduce((acc, feature) => {
                  const phase = feature.phase;
                  if (!acc[phase]) acc[phase] = [];
                  acc[phase].push(feature);
                  return acc;
                }, {})
              )
                .sort(([phaseA], [phaseB]) => {
                  const getPhaseNum = (p) => {
                    const match = p.match(/PHASE\s+([IVX]+)/);
                    if (!match) return 999;
                    const roman = match[1];
                    const values = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8 };
                    return values[roman] || 999;
                  };
                  return getPhaseNum(phaseA) - getPhaseNum(phaseB);
                })
                .map(([phase, features]) => {
                  const allEnabled = features.every(f => getSettingValue(f.key) === 'true');
                  const someEnabled = features.some(f => getSettingValue(f.key) === 'true');
                  
                  const handlePhaseToggle = async () => {
                    const targetState = !allEnabled;
                    for (const feature of features) {
                      await updateSettingMutation.mutateAsync({
                        key: feature.key,
                        value: targetState ? 'true' : 'false',
                        category: feature.category || 'features',
                        description: feature.description || '',
                        phase: feature.phase || ''
                      });
                    }
                  };

                  return (
                    <div key={phase} className="border-2 rounded-lg overflow-hidden">
                      {/* Phase Header */}
                      <div className="bg-gradient-to-r from-purple-50 to-indigo-50 p-4 border-b-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Badge className="bg-purple-600 text-white text-sm px-3 py-1">
                              {phase}
                            </Badge>
                            <span className="text-sm text-gray-600">
                              {features.length} feature{features.length !== 1 ? 's' : ''}
                            </span>
                            {someEnabled && !allEnabled && (
                              <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-300">
                                Partially Enabled
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Label className="text-sm font-semibold">
                              {allEnabled ? 'Disable All' : 'Enable All'}
                            </Label>
                            <Switch
                              checked={allEnabled}
                              onCheckedChange={handlePhaseToggle}
                              disabled={updateSettingMutation.isPending}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Features List */}
                      <div className="divide-y">
                        {features.map((feature) => {
                          const Icon = feature.icon;
                          const isEnabled = getSettingValue(feature.key) === 'true';

                          return (
                            <div
                              key={feature.key}
                              className="flex items-start justify-between p-4 hover:bg-gray-50 transition-colors"
                            >
                              <div className="flex items-start gap-4 flex-1">
                                <div className={`p-3 rounded-lg ${
                                  isEnabled ? 'bg-green-100' : 'bg-gray-100'
                                }`}>
                                  <Icon className={`w-6 h-6 ${
                                    isEnabled ? 'text-green-600' : 'text-gray-400'
                                  }`} />
                                </div>
                                <div className="flex-1">
                                  <Label htmlFor={feature.key} className="text-base font-semibold cursor-pointer">
                                    {feature.label}
                                  </Label>
                                  <p className="text-sm text-gray-600 mt-1">{feature.description}</p>
                                </div>
                              </div>
                              <Switch
                                id={feature.key}
                                checked={isEnabled}
                                onCheckedChange={() => handleToggle(feature.key, isEnabled)}
                                disabled={updateSettingMutation.isPending}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Appearance Tab - UPDATED with editable names */}
        <TabsContent value="appearance">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="w-5 h-5" />
                  Company Logo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => e.target.files?.[0] && handleLogoUpload(e.target.files[0])}
                  className="hidden"
                />
                <div className="flex items-center gap-4">
                  {getSettingValue('company_logo_url') && (
                    <img
                      src={getSettingValue('company_logo_url')}
                      alt="Company Logo"
                      className="w-24 h-24 object-contain border rounded-lg"
                    />
                  )}
                  <Button
                    onClick={() => logoInputRef.current?.click()}
                    disabled={uploadingLogo}
                    variant="outline"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    {uploadingLogo ? 'Uploading...' : 'Upload Logo'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Palette className="w-5 h-5" />
                      Min-Tech Brand Color Palette
                    </CardTitle>
                    <p className="text-sm text-gray-600 mt-1">
                      6-color system with editable names: Primary, Secondary, and Tertiary colors
                    </p>
                  </div>
                  {!editingColors ? (
                    <Button onClick={() => setEditingColors(true)} variant="outline" className="gap-2">
                      <Edit className="w-4 h-4" />
                      Edit Colors
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button
                        onClick={() => {
                          setEditingColors(false);
                          // Reset to saved values
                          const getSavedColorOrDefault = (key, defaultValue, defaultName, hexSetter, rgbSetter, nameSetter) => {
                            const setting = settings.find(s => s.setting_key === key);
                            if (setting) {
                              hexSetter(setting.setting_value);
                              rgbSetter(hexToRgb(setting.setting_value));
                              if (setting.description) {
                                const match = setting.description.match(/- (.+)$/);
                                if (match) nameSetter(match[1]);
                                else nameSetter(defaultName);
                              } else {
                                nameSetter(defaultName);
                              }
                            } else {
                              hexSetter(defaultValue);
                              rgbSetter(hexToRgb(defaultValue));
                              nameSetter(defaultName);
                            }
                          };

                          getSavedColorOrDefault('color_primary', '#007A6E', 'Sea Green', setColorPrimary1, setPrimary1Rgb, setNamePrimary1);
                          getSavedColorOrDefault('color_deep_kelp', '#005247', 'Deep Kelp', setColorPrimary2, setPrimary2Rgb, setNamePrimary2);
                          getSavedColorOrDefault('color_secondary', '#2A66FF', 'Clean Blue', setColorSecondary1, setSecondary1Rgb, setNameSecondary1);
                          getSavedColorOrDefault('color_complimentary_2', '#1E3C96', 'Navy Utility', setColorSecondary2, setSecondary2Rgb, setNameSecondary2);
                          getSavedColorOrDefault('color_complimentary_1', '#B0C92C', 'Chartreuse', setColorTertiary1, setTertiary1Rgb, setNameTertiary1);
                          getSavedColorOrDefault('color_earth_brown', '#7C5C3A', 'Earth Brown', setColorTertiary2, setTertiary2Rgb, setNameTertiary2);

                          setPrimary1Pantone('');
                          setPrimary2Pantone('');
                          setSecondary1Pantone('');
                          setSecondary2Pantone('');
                          setTertiary1Pantone('');
                          setTertiary2Pantone('');
                        }}
                        variant="outline"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleSaveColors}
                        disabled={saveColorsMutation.isPending}
                        className="bg-green-600 hover:bg-green-700 gap-2"
                      >
                        <Save className="w-4 h-4" />
                        {saveColorsMutation.isPending ? 'Saving...' : 'Save Palette'}
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Primary Colors */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Primary Colors</h3>

                  <ColorPicker
                    label="Primary #1"
                    colorName={namePrimary1}
                    setColorName={setNamePrimary1}
                    color={colorPrimary1}
                    rgb={primary1Rgb}
                    pantone={primary1Pantone}
                    format={primary1Format}
                    setFormat={setPrimary1Format}
                    onColorChange={(val, fmt) => handleColorChange(setColorPrimary1, setPrimary1Rgb, val, fmt)}
                    setPantone={setPrimary1Pantone}
                    disabled={!editingColors}
                  />

                  <ColorPicker
                    label="Primary #2"
                    colorName={namePrimary2}
                    setColorName={setNamePrimary2}
                    color={colorPrimary2}
                    rgb={primary2Rgb}
                    pantone={primary2Pantone}
                    format={primary2Format}
                    setFormat={setPrimary2Format}
                    onColorChange={(val, fmt) => handleColorChange(setColorPrimary2, setPrimary2Rgb, val, fmt)}
                    setPantone={setPrimary2Pantone}
                    disabled={!editingColors}
                  />
                </div>

                {/* Secondary Colors */}
                <div className="space-y-4 pt-6 border-t">
                  <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Secondary Colors</h3>

                  <ColorPicker
                    label="Secondary #1"
                    colorName={nameSecondary1}
                    setColorName={setNameSecondary1}
                    color={colorSecondary1}
                    rgb={secondary1Rgb}
                    pantone={secondary1Pantone}
                    format={secondary1Format}
                    setFormat={setSecondary1Format}
                    onColorChange={(val, fmt) => handleColorChange(setColorSecondary1, setSecondary1Rgb, val, fmt)}
                    setPantone={setSecondary1Pantone}
                    disabled={!editingColors}
                  />

                  <ColorPicker
                    label="Secondary #2"
                    colorName={nameSecondary2}
                    setColorName={setNameSecondary2}
                    color={colorSecondary2}
                    rgb={secondary2Rgb}
                    pantone={secondary2Pantone}
                    format={secondary2Format}
                    setFormat={setSecondary2Format}
                    onColorChange={(val, fmt) => handleColorChange(setColorSecondary2, setSecondary2Rgb, val, fmt)}
                    setPantone={setSecondary2Pantone}
                    disabled={!editingColors}
                  />
                </div>

                {/* Tertiary Colors */}
                <div className="space-y-4 pt-6 border-t">
                  <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Tertiary Colors</h3>

                  <ColorPicker
                    label="Tertiary #1"
                    colorName={nameTertiary1}
                    setColorName={setNameTertiary1}
                    color={colorTertiary1}
                    rgb={tertiary1Rgb}
                    pantone={tertiary1Pantone}
                    format={tertiory1Format}
                    setFormat={setTertiary1Format}
                    onColorChange={(val, fmt) => handleColorChange(setColorTertiary1, setTertiary1Rgb, val, fmt)}
                    setPantone={setTertiary1Pantone}
                    disabled={!editingColors}
                  />

                  <ColorPicker
                    label="Tertiary #2"
                    colorName={nameTertiary2}
                    setColorName={setNameTertiary2}
                    color={colorTertiary2}
                    rgb={tertiary2Rgb}
                    pantone={tertiary2Pantone}
                    format={tertiory2Format}
                    setFormat={setTertiary2Format}
                    onColorChange={(val, fmt) => handleColorChange(setColorTertiary2, setTertiary2Rgb, val, fmt)}
                    setPantone={setTertiary2Pantone}
                    disabled={!editingColors}
                  />
                </div>

                <div className="border-t pt-6"></div>

                {/* Full Palette Preview - UPDATED with dynamic names */}
                <div className="p-6 bg-white rounded-lg border-2">
                  <p className="text-lg font-semibold text-gray-900 mb-4">Complete Brand Palette Preview</p>

                  {/* Primary Colors Row */}
                  <div className="mb-6">
                    <p className="text-sm font-semibold text-gray-600 mb-3">PRIMARY COLORS</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-6 rounded-lg shadow-lg" style={{ backgroundColor: colorPrimary1 }}>
                        <p className="text-white font-bold text-sm drop-shadow-md mb-2">{namePrimary1}</p>
                        <div className="space-y-1">
                          <p className="text-white text-xs opacity-90 drop-shadow">{colorPrimary1}</p>
                          <p className="text-white text-xs opacity-90 drop-shadow">
                            RGB: {primary1Rgb.r}, {primary1Rgb.g}, {primary1Rgb.b}
                          </p>
                        </div>
                      </div>
                      <div className="p-6 rounded-lg shadow-lg" style={{ backgroundColor: colorPrimary2 }}>
                        <p className="text-white font-bold text-sm drop-shadow-md mb-2">{namePrimary2}</p>
                        <div className="space-y-1">
                          <p className="text-white text-xs opacity-90 drop-shadow">{colorPrimary2}</p>
                          <p className="text-white text-xs opacity-90 drop-shadow">
                            RGB: {primary2Rgb.r}, {primary2Rgb.g}, {primary2Rgb.b}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Secondary Colors Row */}
                  <div className="mb-6">
                    <p className="text-sm font-semibold text-gray-600 mb-3">SECONDARY COLORS</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-6 rounded-lg shadow-lg" style={{ backgroundColor: colorSecondary1 }}>
                        <p className="text-white font-bold text-sm drop-shadow-md mb-2">{nameSecondary1}</p>
                        <div className="space-y-1">
                          <p className="text-white text-xs opacity-90 drop-shadow">{colorSecondary1}</p>
                          <p className="text-white text-xs opacity-90 drop-shadow">
                            RGB: {secondary1Rgb.r}, {secondary1Rgb.g}, {secondary1Rgb.b}
                          </p>
                        </div>
                      </div>
                      <div className="p-6 rounded-lg shadow-lg" style={{ backgroundColor: colorSecondary2 }}>
                        <p className="text-white font-bold text-sm drop-shadow-md mb-2">{nameSecondary2}</p>
                        <div className="space-y-1">
                          <p className="text-white text-xs opacity-90 drop-shadow">{colorSecondary2}</p>
                          <p className="text-white text-xs opacity-90 drop-shadow">
                            RGB: {secondary2Rgb.r}, {secondary2Rgb.g}, {secondary2Rgb.b}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Tertiary Colors Row */}
                  <div>
                    <p className="text-sm font-semibold text-gray-600 mb-3">TERTIARY COLORS</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-6 rounded-lg shadow-lg" style={{ backgroundColor: colorTertiary1 }}>
                        <p className="text-gray-900 font-bold text-sm drop-shadow-md mb-2">{nameTertiary1}</p>
                        <div className="space-y-1">
                          <p className="text-gray-900 text-xs opacity-90 drop-shadow">{colorTertiary1}</p>
                          <p className="text-gray-900 text-xs opacity-90 drop-shadow">
                            RGB: {tertiary1Rgb.r}, {tertiary1Rgb.g}, {tertiary1Rgb.b}
                          </p>
                        </div>
                      </div>
                      <div className="p-6 rounded-lg shadow-lg" style={{ backgroundColor: colorTertiary2 }}>
                        <p className="text-white font-bold text-sm drop-shadow-md mb-2">{nameTertiary2}</p>
                        <div className="space-y-1">
                          <p className="text-white text-xs opacity-90 drop-shadow">{colorTertiary2}</p>
                          <p className="text-white text-xs opacity-90 drop-shadow">
                            RGB: {tertiary2Rgb.r}, {tertiary2Rgb.g}, {tertiary2Rgb.b}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Company Tab */}
        <TabsContent value="company">
          <div className="space-y-6">
            {/* Admin Utilities Grid - NEW SECTION */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5 text-purple-600" />
                  Administration Utilities
                </CardTitle>
                <p className="text-sm text-gray-600 mt-1">
                  Configure zones, bins, carriers, SKUs, and other system settings
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {adminCards.map((card) => {
                    const Icon = card.icon;
                    return (
                      <Link key={card.path} to={createPageUrl(card.path)}>
                        <Card className={`${card.color} border-2 hover:shadow-lg transition-all cursor-pointer h-full`}>
                          <CardContent className="p-6">
                            <div className="flex items-start justify-between mb-3">
                              <div className={`p-3 rounded-lg bg-white/80`}>
                                <Icon className={`w-6 h-6 ${card.iconColor}`} />
                              </div>
                              {card.badge && (
                                <Badge className={`${card.badgeColor} text-white text-xs`}>
                                  {card.badge}
                                </Badge>
                              )}
                            </div>
                            <h3 className="font-bold text-gray-900 mb-1">{card.title}</h3>
                            <p className="text-sm text-gray-600">{card.description}</p>
                          </CardContent>
                        </Card>
                      </Link>
                    );
                  })}
                </div>
              </CardContent>
            </Card>



            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  Hub & Spoke Model
                </CardTitle>
                <p className="text-sm text-gray-600 mt-1">
                  Configure main hub for processing and spoke locations for storage and pre-sorting
                </p>
              </CardHeader>
              <CardContent>
                <Link to={createPageUrl("ZoneManagement")}>
                  <Button variant="outline" className="w-full">
                    <MapPin className="w-4 h-4 mr-2" />
                    Manage Zones & Locations
                  </Button>
                </Link>
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-700">
                    Current Zones: <strong>{zones.length}</strong>
                  </p>
                  <p className="text-sm text-gray-700">
                    Main Hub: <strong>{zones.find(z => z.is_main_hub)?.zone_name || 'Not configured'}</strong>
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Localization Tab */}
        <TabsContent value="localization">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5" />
                Localization Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Country Code</Label>
                  <Select
                    value={getSettingValue('country_code') || 'US'}
                    onValueChange={(value) => handleSaveSetting('country_code', value, 'localization', 'Country code')}
                  >
                    <SelectTrigger className="w-full mt-2">
                      <SelectValue placeholder="Select a country" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="US">US - United States of America</SelectItem>
                      <SelectItem value="CA">CA - Canada</SelectItem>
                      <SelectItem value="AU">AU - Australia</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Phone Format</Label>
                  <Input
                    value={getSettingValue('phone_format') || '+1-xxx-xxx-xxxx'}
                    readOnly
                    className="mt-2 bg-gray-50"
                  />
                  <p className="text-xs text-gray-500 mt-1">Auto-set based on country</p>
                </div>
                <div>
                  <Label>Time Format</Label>
                  <Select
                    value={getSettingValue('time_format') || '12h'}
                    onValueChange={(value) => handleSaveSetting('time_format', value, 'localization', 'Time format')}
                  >
                    <SelectTrigger className="w-full mt-2">
                      <SelectValue placeholder="Select time format" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="12h">12-Hour (AM/PM)</SelectItem>
                      <SelectItem value="24h">24-Hour</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Date Format</Label>
                  <Select
                    value={getSettingValue('date_format') || 'MM/DD/YYYY'}
                    onValueChange={(value) => handleSaveSetting('date_format', value, 'localization', 'Date format')}
                  >
                    <SelectTrigger className="w-full mt-2">
                      <SelectValue placeholder="Select date format" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MM/DD/YYYY">MM/DD/YYYY (US)</SelectItem>
                      <SelectItem value="DD/MM/YYYY">DD/MM/YYYY (International)</SelectItem>
                      <SelectItem value="YYYY-MM-DD">YYYY-MM-DD (ISO)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Weight Unit</Label>
                  <Select
                    value={getSettingValue('weight_unit') || 'kg'}
                    onValueChange={(value) => handleSaveSetting('weight_unit', value, 'localization', 'Weight unit')}
                  >
                    <SelectTrigger className="w-full mt-2">
                      <SelectValue placeholder="Select weight unit" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="kg">Kilograms (kg)</SelectItem>
                      <SelectItem value="lbs">Pounds (lbs)</SelectItem>
                      <SelectItem value="tonnes">Tonnes</SelectItem>
                      <SelectItem value="tons">Tons</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Distance Unit</Label>
                  <Select
                    value={getSettingValue('distance_unit') || 'km'}
                    onValueChange={(value) => handleSaveSetting('distance_unit', value, 'localization', 'Distance unit')}
                  >
                    <SelectTrigger className="w-full mt-2">
                      <SelectValue placeholder="Select distance unit" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="km">Kilometers (km)</SelectItem>
                      <SelectItem value="miles">Miles</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Categories Tab */}
        <TabsContent value="categories">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="w-5 h-5" />
                    Material Categories & HTS Codes
                  </CardTitle>
                  <p className="text-sm text-gray-600 mt-1">
                    Define primary materials, sub-categories, and export/import codes
                  </p>
                </div>
                <Link to={createPageUrl("ManageMaterialCategories")}>
                  <Button className="bg-green-600 hover:bg-green-700">
                    <Plus className="w-4 h-4 mr-2" />
                    Manage Categories
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {materialCategories.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>No material categories defined yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {materialCategories.map((cat) => (
                    <div key={cat.id} className="p-4 border rounded-lg flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div
                          className="w-10 h-10 rounded"
                          style={{ backgroundColor: cat.color_primary || '#10b981' }}
                        />
                        <div>
                          <p className="font-semibold">{cat.category_name}</p>
                          {cat.sub_category && (
                            <p className="text-sm text-gray-600">Sub: {cat.sub_category}</p>
                          )}
                          {cat.hts_code && (
                            <p className="text-xs text-gray-500">HTS: {cat.hts_code}</p>
                          )}
                        </div>
                      </div>
                      <Badge>{cat.material_type}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Carriers Tab */}
        <TabsContent value="carriers">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Truck className="w-5 h-5" />
                    Carrier Management
                  </CardTitle>
                  <p className="text-sm text-gray-600 mt-1">
                    Configure carriers for waybills and shipping
                  </p>
                </div>
                <Link to={createPageUrl("ManageCarriers")}>
                  <Button className="bg-green-600 hover:bg-green-700">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Carrier
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {carriers.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Truck className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No carriers configured yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {carriers.map((carrier) => (
                    <div key={carrier.id} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold">{carrier.company_name}</p>
                          <p className="text-sm text-gray-600">Code: {carrier.carrier_code}</p>
                        </div>
                        <Badge className={carrier.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}>
                          {carrier.status}
                        </Badge>
                      </div>
                      <div className="mt-2 text-sm text-gray-600">
                        <p>📞 {carrier.phone_number}</p>
                        <p>✉️ {carrier.email}</p>
                        <p>👤 {carrier.contact_person}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Product SKUs Tab */}
        <TabsContent value="skus">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="w-5 h-5" />
                    Product SKU Management
                  </CardTitle>
                  <p className="text-sm text-gray-600 mt-1">
                    Define product SKUs with category, purity, and format specifications
                  </p>
                </div>
                <Link to={createPageUrl("ManageProductSKUs")}>
                  <Button className="bg-green-600 hover:bg-green-700">
                    <Plus className="w-4 h-4 mr-2" />
                    Manage SKUs
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                <h3 className="font-semibold text-blue-900 mb-3">SKU Structure</h3>
                <div className="space-y-2 text-sm text-gray-700">
                  <p><strong>CATEGORY</strong> → Primary classification (PLASTICS, FERROUS, NON-FERROUS, etc.)</p>
                  <p><strong>SUB-CATEGORY</strong> → Material grouping (Polyesters, Aluminum, Steel, etc.)</p>
                  <p><strong>PRODUCT TYPE</strong> → Specific material (PET/PETE, UBC, 304 Series, etc.)</p>
                  <p><strong>FORMAT</strong> → Physical form (Bales, Rolls, Sheets, Shredded, etc.)</p>
                  <p><strong>PURITY</strong> → Material purity (100%, 90%, 80%...40%, MIXED, UNKNOWN)</p>
                </div>
                <div className="mt-4 p-3 bg-white rounded border border-blue-200">
                  <p className="text-xs text-gray-500 mb-1">Example SKU:</p>
                  <p className="font-mono font-bold text-blue-700">PLA-POL-PET-90-1234</p>
                  <p className="text-xs text-gray-600 mt-1">PLASTICS → Polyesters → PET/PETE → 90% Purity</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Customers Tab */}
        <TabsContent value="customers">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="w-5 h-5" />
                    Customer Management
                  </CardTitle>
                  <p className="text-sm text-gray-600 mt-1">
                    Manage customer database with US/CA validation (QBO-ready)
                  </p>
                </div>
                <Link to={createPageUrl("CustomerManagement")}>
                  <Button className="bg-blue-600 hover:bg-blue-700">
                    <Plus className="w-4 h-4 mr-2" />
                    Manage Customers
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                <h3 className="font-semibold text-blue-900 mb-3">QBO-Ready Customer Database</h3>
                <div className="space-y-2 text-sm text-gray-700">
                  <p><strong>✓ US/CA Validation</strong> → Automatic state/province and ZIP/postal code validation</p>
                  <p><strong>✓ Currency Coupling</strong> → USD for US customers, CAD for Canadian customers</p>
                  <p><strong>✓ Address Validation</strong> → Enforces country-specific address formats</p>
                  <p><strong>✓ Tax Management</strong> → Tax exemption tracking, certificates, and tax codes</p>
                  <p><strong>✓ QBO Integration</strong> → Fully compatible with QuickBooks Online customer structure</p>
                  <p><strong>✓ Multi-Tenant</strong> → Separate customer bases for Min-Tech and Connecticut Metals</p>
                </div>
                <div className="mt-4 p-3 bg-white rounded border border-blue-200">
                  <p className="text-xs text-gray-500 mb-1">Supported Fields:</p>
                  <p className="text-xs text-gray-600">
                    Contact info, billing/shipping addresses, tax settings, payment terms,
                    QBO sync fields, custom tags, purchase history
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Vendors Tab */}
        <TabsContent value="vendors">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="w-5 h-5" />
                    Vendor Management
                  </CardTitle>
                  <p className="text-sm text-gray-600 mt-1">
                    Manage supplier/vendor database with US/CA validation (QBO-ready)
                  </p>
                </div>
                <Link to={createPageUrl("VendorManagement")}>
                  <Button className="bg-orange-600 hover:bg-orange-700">
                    <Plus className="w-4 h-4 mr-2" />
                    Manage Vendors
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="p-6 bg-gradient-to-br from-orange-50 to-amber-50 rounded-lg border border-orange-200">
                <h3 className="font-semibold text-orange-900 mb-3">QBO-Ready Vendor Database</h3>
                <div className="space-y-2 text-sm text-gray-700">
                  <p><strong>✓ US/CA Validation</strong> → Automatic state/province and ZIP/postal code validation</p>
                  <p><strong>✓ Currency Coupling</strong> → USD for US vendors, CAD for Canadian vendors</p>
                  <p><strong>✓ Dual Addresses</strong> → Separate billing and remittance addresses</p>
                  <p><strong>✓ Tax Compliance</strong> → 1099 tracking (US), T4A eligibility (CA), W-9/GST management</p>
                  <p><strong>✓ Payment Methods</strong> → ACH, Check, Wire transfer support with tokenization</p>
                  <p><strong>✓ QBO Integration</strong> → Fully compatible with QuickBooks Online vendor structure</p>
                  <p><strong>✓ Multi-Tenant</strong> → Separate vendor bases for Min-Tech and Connecticut Metals</p>
                </div>
                <div className="mt-4 p-3 bg-white rounded border border-orange-200">
                  <p className="text-xs text-gray-500 mb-1">Supported Fields:</p>
                  <p className="text-xs text-gray-600">
                    Contact info, billing/remittance addresses, payment terms, tax compliance (1099/W-9/T4A),
                    QBO sync fields, A/P tracking, purchase history, payment instructions
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}