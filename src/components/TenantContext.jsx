import React, { createContext, useContext, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { recims } from '@/api/recimsClient';

const TenantContext = createContext(null);

const DEFAULT_TENANT_CONFIG = {
  name: 'Default Tenant',
  display_name: 'Default Tenant',
  region: 'Global',
  branding_primary_color: '#007A6E',
  branding_secondary_color: '#005247',
};

const PHASE_LABELS = ['I', 'II', 'III', 'IV', 'V', 'VI'];

const FEATURE_PHASE_MAP = {
  enable_po_module: 3,
  enable_qc_module: 4,
  enable_inventory_module: 3,
  enable_bin_capacity_management: 3,
  enable_ai_insights: 6,
  enable_kpi_dashboard: 5,
  enable_photo_upload_inbound: 2,
  enable_photo_upload_classification: 2,
  enable_stock_transfer: 4,
  enable_email_automation: 4,
  enable_picking_list: 3,
  enable_scale_integration: 4,
  enable_offline_mode: 3,
  enable_product_images: 5,
};

const HEX_COLOR_REGEX = /^#?([0-9a-f]{6})$/i;
const HERO_TEXT_LIGHT = '#FFFFFF';
const HERO_TEXT_DARK = '#0F172A';

const normalizeHexColor = (value, fallback) => {
  if (typeof value !== 'string') {
    return fallback;
  }
  const match = HEX_COLOR_REGEX.exec(value.trim());
  if (!match) {
    return fallback;
  }
  return `#${match[1].toUpperCase()}`;
};

const hexToHslString = (hex) => {
  if (!HEX_COLOR_REGEX.test(hex)) return null;
  const normalized = hex.replace('#', '');
  const r = parseInt(normalized.slice(0, 2), 16) / 255;
  const g = parseInt(normalized.slice(2, 4), 16) / 255;
  const b = parseInt(normalized.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h;
  const l = (max + min) / 2;

  if (max === min) {
    h = 0;
  } else {
    const d = max - min;
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  const s = max === min ? 0 : (max - min) / (1 - Math.abs(2 * l - 1));
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
};

const hexToRgba = (hex, alpha = 1) => {
  if (!HEX_COLOR_REGEX.test(hex)) return `rgba(0,0,0,${alpha})`;
  const normalized = hex.replace('#', '');
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const hexToRgb = (hex) => {
  if (!HEX_COLOR_REGEX.test(hex)) return null;
  const normalized = hex.replace('#', '');
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
};

const srgbToLinear = (value) => {
  const ratio = value / 255;
  return ratio <= 0.03928 ? ratio / 12.92 : Math.pow((ratio + 0.055) / 1.055, 2.4);
};

const getRelativeLuminance = (hex) => {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const r = srgbToLinear(rgb.r);
  const g = srgbToLinear(rgb.g);
  const b = srgbToLinear(rgb.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const deriveHeroTextColor = (primaryColor, secondaryColor) => {
  const primaryLum = getRelativeLuminance(primaryColor);
  const secondaryLum = getRelativeLuminance(secondaryColor);
  const averageLum = (primaryLum + secondaryLum) / 2;
  return averageLum > 0.6 ? HERO_TEXT_DARK : HERO_TEXT_LIGHT;
};

const clampPhaseValue = (value) => {
  if (!Number.isFinite(value)) {
    return value;
  }
  return Math.min(Math.max(Math.floor(value), 1), PHASE_LABELS.length);
};

const formatPhaseLabel = (phaseNumber) => {
  if (!Number.isFinite(phaseNumber)) {
    return null;
  }
  const clamped = clampPhaseValue(phaseNumber) || 1;
  const roman = PHASE_LABELS[clamped - 1] || PHASE_LABELS[0];
  return `PHASE ${roman}`;
};

const limitFeaturesByPhase = (features, phaseAccess, exceptions = []) => {
  if (!features || typeof features !== 'object') {
    return features;
  }

  const maxPhase = phaseAccess?.maxPhase;
  if (!Number.isFinite(maxPhase)) {
    return features;
  }

  const exceptionSet = new Set(
    Array.isArray(exceptions)
      ? exceptions.map((key) => String(key))
      : []
  );

  const gated = { ...features };
  const disableKey = (key) => {
    if (!key) return;
    const normalizedKey = String(key);
    if (exceptionSet.has(normalizedKey)) {
      return;
    }
    if (normalizedKey in gated) {
      gated[normalizedKey] = false;
    }
  };

  Object.entries(FEATURE_PHASE_MAP).forEach(([key, phaseValue]) => {
    if (phaseValue > maxPhase && key in gated) {
      disableKey(key);
      const aliases = FEATURE_ALIAS_MAP[key];
      if (aliases) {
        const aliasList = Array.isArray(aliases) ? aliases : [aliases];
        aliasList.forEach((aliasKey) => disableKey(aliasKey));
      }
    }
  });
  return gated;
};

const applyFeatureOverrides = (features, overrides) => {
  if (!features || typeof features !== 'object' || !overrides || typeof overrides !== 'object') {
    return features;
  }
  const next = { ...features };
  Object.entries(overrides).forEach(([key, value]) => {
    next[key] = value;
  });
  return next;
};

const STORAGE_KEYS = {
  appSettings: 'recims:appSettings',
  tenantConfigs: 'recims:tenantConfigs',
};

const isBrowser = typeof window !== 'undefined';

const readJsonStorage = (key, fallback) => {
  if (!isBrowser) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (error) {
    console.warn('[TenantContext] Failed to read storage key', key, error);
    return fallback;
  }
};

const writeJsonStorage = (key, value) => {
  if (!isBrowser) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn('[TenantContext] Failed to persist storage key', key, error);
  }
};

const loadAppSettingsFromStorage = () => {
  const stored = readJsonStorage(STORAGE_KEYS.appSettings, null);
  return Array.isArray(stored) ? stored : undefined;
};

const persistAppSettingsToStorage = (settings) => {
  if (!Array.isArray(settings)) return;
  writeJsonStorage(STORAGE_KEYS.appSettings, settings);
};

const loadTenantFromStorage = (tenantKey) => {
  if (!tenantKey && tenantKey !== 0) return null;
  const stored = readJsonStorage(STORAGE_KEYS.tenantConfigs, {});
  const normalizedKey = String(tenantKey);
  return stored?.[normalizedKey] ?? null;
};

const persistTenantToStorage = (tenantKey, tenantValue) => {
  if (!tenantKey && tenantKey !== 0) return;
  const stored = readJsonStorage(STORAGE_KEYS.tenantConfigs, {});
  const normalizedKey = String(tenantKey);
  const next = { ...stored, [normalizedKey]: tenantValue };
  writeJsonStorage(STORAGE_KEYS.tenantConfigs, next);
};

const FEATURE_ALIAS_MAP = {
  enable_po_module: ['po_module_enabled'],
  enable_qc_module: ['qc_module_enabled'],
  enable_inventory_module: ['inventory_module_enabled'],
  enable_bin_capacity_management: ['bin_capacity_enabled', 'bin_capacity_management_enabled'],
  enable_stock_transfer: ['stock_transfer_enabled'],
  enable_ai_insights: ['ai_insights_enabled'],
  enable_kpi_dashboard: ['kpi_dashboard_enabled'],
  enable_photo_upload_inbound: ['photo_upload_enabled'],
  enable_photo_upload_classification: ['photo_upload_enabled'],
  enable_email_automation: ['email_automation_enabled'],
  enable_picking_list: ['picking_list_enabled'],
  enable_scale_integration: ['scale_integration_enabled'],
  enable_offline_mode: ['offline_mode_enabled'],
  enable_product_images: ['product_images_enabled'],
};

const resolveTenantKey = (tenantId) => {
  if (!tenantId && tenantId !== 0) return null;
  const numeric = Number(tenantId);
  return Number.isInteger(numeric) ? numeric : tenantId;
};

const parseTenantFeatures = (rawFeatures) => {
  if (!rawFeatures) return {};

  let features = rawFeatures;
  if (typeof rawFeatures === 'string') {
    try {
      features = JSON.parse(rawFeatures);
    } catch (error) {
      console.warn('[TenantContext] Failed to parse tenant features JSON:', error);
      features = {};
    }
  }

  if (typeof features !== 'object' || Array.isArray(features)) {
    return {};
  }

  const normalized = {};
  Object.entries(features).forEach(([key, value]) => {
    if (typeof value === 'string') {
      const lower = value.toLowerCase();
      if (lower === 'true') {
        normalized[key] = true;
        return;
      }
      if (lower === 'false') {
        normalized[key] = false;
        return;
      }
    }
    normalized[key] = value;
  });
  return normalized;
};

const deriveFeatureState = (tenantFeatures, appSettings) => {
  const baseFeatures = parseTenantFeatures(tenantFeatures);
  const featureToggles = {};

  appSettings
    .filter((setting) => setting?.setting_key?.startsWith('enable_'))
    .forEach((setting) => {
      featureToggles[setting.setting_key] = setting.setting_value === 'true';
    });

  const mergedFeatures = { ...baseFeatures };

  Object.entries(featureToggles).forEach(([key, value]) => {
    mergedFeatures[key] = value;
  });

  Object.entries(FEATURE_ALIAS_MAP).forEach(([toggleKey, aliases]) => {
    if (!(toggleKey in featureToggles)) return;
    const value = featureToggles[toggleKey];
    const aliasList = Array.isArray(aliases) ? aliases : [aliases];
    aliasList.forEach((alias) => {
      if (!alias) return;
      mergedFeatures[alias] = value;
    });
  });

  if ('enable_photo_upload_inbound' in featureToggles || 'enable_photo_upload_classification' in featureToggles) {
    const inbound = featureToggles.enable_photo_upload_inbound ?? false;
    const classification = featureToggles.enable_photo_upload_classification ?? false;
    mergedFeatures.photo_upload_enabled = inbound || classification;
  }

  const featureFlags = {};
  Object.entries(mergedFeatures).forEach(([key, value]) => {
    if (typeof value === 'boolean') {
      featureFlags[key] = value;
    }
  });

  return { mergedFeatures, featureFlags };
};

export function TenantProvider({ children }) {
  const queryClient = useQueryClient();

  const {
    data: user,
    isLoading: userLoading,
    error: userError,
  } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => recims.auth.me(),
    staleTime: 60_000,
  });

  const restrictionsMaxPhase = user?.restrictions?.maxPhase;
  const disablePhaseRestriction = Boolean(user?.ui_overrides?.disablePhaseRestriction);
  const manualPhaseLimit = Number.isFinite(Number(user?.ui_overrides?.maxAllowedPhase))
    ? clampPhaseValue(Number(user.ui_overrides.maxAllowedPhase))
    : null;
  const phaseExemptFeatures = React.useMemo(() => (
    Array.isArray(user?.ui_overrides?.phaseExemptFeatures)
      ? user.ui_overrides.phaseExemptFeatures.map((key) => String(key))
      : []
  ), [user?.ui_overrides?.phaseExemptFeatures]);

  const phaseAccess = React.useMemo(() => {
    if (disablePhaseRestriction) {
      return {
        maxPhase: Infinity,
        label: user?.ui_overrides?.accessLevelLabel || null,
        isRestricted: false,
      };
    }
    const directPhase = user?.phase_access?.maxPhase;
    const restrictedPhase = typeof restrictionsMaxPhase === 'number' ? restrictionsMaxPhase : null;
    const candidate = typeof directPhase === 'number' ? directPhase : restrictedPhase;
    if (!Number.isFinite(candidate)) {
      return {
        maxPhase: Infinity,
        label: null,
        isRestricted: false,
      };
    }
    const clamped = clampPhaseValue(candidate);
    return {
      maxPhase: clamped,
      label: user?.phase_access?.label || formatPhaseLabel(clamped),
      isRestricted: true,
    };
  }, [disablePhaseRestriction, user?.phase_access?.label, user?.phase_access?.maxPhase, user?.ui_overrides?.accessLevelLabel, restrictionsMaxPhase]);

  const tenantKey = useMemo(() => resolveTenantKey(user?.tenant_id), [user?.tenant_id]);

  const {
    data: tenant,
    isLoading: tenantLoading,
    error: tenantError,
  } = useQuery({
    queryKey: ['tenantConfig', tenantKey],
    enabled: !!tenantKey,
    staleTime: 60_000,
    initialData: () => loadTenantFromStorage(tenantKey),
    queryFn: async () => {
      if (!tenantKey) return null;
      try {
        return await recims.entities.Tenant.get(tenantKey);
      } catch (error) {
        if (typeof tenantKey === 'string') {
          const fallback = await recims.entities.Tenant.filter({ tenant_id: tenantKey });
          return fallback[0] ?? null;
        }
        throw error;
      }
    },
  });

  const {
    data: appSettingsData,
    isLoading: settingsLoading,
    error: settingsError,
  } = useQuery({
    queryKey: ['appSettings'],
    queryFn: () => recims.entities.AppSettings.list(),
    staleTime: 30_000,
    initialData: loadAppSettingsFromStorage,
  });

  const appSettings = React.useMemo(
    () => (Array.isArray(appSettingsData) ? appSettingsData : []),
    [appSettingsData]
  );

  React.useEffect(() => {
    if (tenantKey && tenant) {
      persistTenantToStorage(tenantKey, tenant);
    }
  }, [tenantKey, tenant]);

  React.useEffect(() => {
    if (Array.isArray(appSettingsData)) {
      persistAppSettingsToStorage(appSettingsData);
    }
  }, [appSettingsData]);

  const { mergedFeatures, featureFlags } = useMemo(
    () => deriveFeatureState(tenant?.features, appSettings),
    [tenant?.features, appSettings]
  );

  const mergedFeaturesWithOverrides = React.useMemo(
    () => applyFeatureOverrides(mergedFeatures, user?.feature_overrides),
    [mergedFeatures, user?.feature_overrides]
  );

  const featureFlagsWithOverrides = React.useMemo(
    () => applyFeatureOverrides(featureFlags, user?.feature_overrides),
    [featureFlags, user?.feature_overrides]
  );

  const gatingPhaseAccess = React.useMemo(() => {
    if (disablePhaseRestriction) {
      if (Number.isFinite(manualPhaseLimit)) {
        return { maxPhase: manualPhaseLimit };
      }
      return null;
    }
    return phaseAccess;
  }, [disablePhaseRestriction, manualPhaseLimit, phaseAccess]);

  const gatedMergedFeatures = React.useMemo(
    () => (gatingPhaseAccess ? limitFeaturesByPhase(mergedFeaturesWithOverrides, gatingPhaseAccess, phaseExemptFeatures) : mergedFeaturesWithOverrides),
    [mergedFeaturesWithOverrides, gatingPhaseAccess, phaseExemptFeatures]
  );

  const gatedFeatureFlags = React.useMemo(
    () => (gatingPhaseAccess ? limitFeaturesByPhase(featureFlagsWithOverrides, gatingPhaseAccess, phaseExemptFeatures) : featureFlagsWithOverrides),
    [featureFlagsWithOverrides, gatingPhaseAccess, phaseExemptFeatures]
  );

  const modulePhaseLimit = React.useMemo(() => {
    if (Number.isFinite(manualPhaseLimit)) {
      return manualPhaseLimit;
    }
    if (Number.isFinite(phaseAccess?.maxPhase)) {
      return phaseAccess.maxPhase;
    }
    return Infinity;
  }, [manualPhaseLimit, phaseAccess?.maxPhase]);

  const tenantConfig = useMemo(() => {
    const baseTenant = tenant ?? DEFAULT_TENANT_CONFIG;
    const primaryColor = normalizeHexColor(
      baseTenant.branding_primary_color,
      DEFAULT_TENANT_CONFIG.branding_primary_color
    );
    const secondaryColor = normalizeHexColor(
      baseTenant.branding_secondary_color,
      DEFAULT_TENANT_CONFIG.branding_secondary_color
    );

    return {
      ...DEFAULT_TENANT_CONFIG,
      ...baseTenant,
      branding_primary_color: primaryColor,
      branding_secondary_color: secondaryColor,
      features: gatedMergedFeatures,
    };
  }, [tenant, gatedMergedFeatures]);

  const theme = useMemo(() => {
    const primaryColor = tenantConfig.branding_primary_color || DEFAULT_TENANT_CONFIG.branding_primary_color;
    const secondaryColor = tenantConfig.branding_secondary_color || DEFAULT_TENANT_CONFIG.branding_secondary_color;
    return {
      primaryColor,
      secondaryColor,
      primaryHsl: hexToHslString(primaryColor),
      secondaryHsl: hexToHslString(secondaryColor),
      gradient: `linear-gradient(120deg, ${primaryColor}, ${secondaryColor})`,
      glow: hexToRgba(primaryColor, 0.35),
      heroTextColor: deriveHeroTextColor(primaryColor, secondaryColor),
    };
  }, [tenantConfig.branding_primary_color, tenantConfig.branding_secondary_color]);

  const loading = userLoading || (tenantKey ? tenantLoading : false) || settingsLoading;
  const error = userError?.message || tenantError?.message || settingsError?.message || null;

  const contextValue = useMemo(() => {
    const refreshTenant = () => {
      if (tenantKey) {
        queryClient.invalidateQueries({ queryKey: ['tenantConfig', tenantKey] });
      }
      queryClient.invalidateQueries({ queryKey: ['appSettings'] });
    };

    return {
      tenantConfig,
      user: user ?? null,
      loading,
      error,
      refreshTenant,
      featureFlags: gatedFeatureFlags,
      phaseAccess,
      modulePhaseLimit,
      theme,
    };
  }, [tenantConfig, tenantKey, queryClient, user, loading, error, gatedFeatureFlags, theme, phaseAccess, modulePhaseLimit]);

  React.useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.style.setProperty('--tenant-primary-color', theme.primaryColor);
    root.style.setProperty('--tenant-secondary-color', theme.secondaryColor);
    if (theme.primaryHsl) {
      root.style.setProperty('--tenant-primary-hsl', theme.primaryHsl);
    }
    if (theme.secondaryHsl) {
      root.style.setProperty('--tenant-secondary-hsl', theme.secondaryHsl);
    }
    root.style.setProperty('--tenant-primary-glow', theme.glow);
    if (theme.gradient) {
      root.style.setProperty('--tenant-gradient', theme.gradient);
    }
    if (theme.heroTextColor) {
      root.style.setProperty('--tenant-hero-text-color', theme.heroTextColor);
    }
  }, [theme]);

  return (
    <TenantContext.Provider value={contextValue}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error('useTenant must be used within TenantProvider');
  }
  return context;
}