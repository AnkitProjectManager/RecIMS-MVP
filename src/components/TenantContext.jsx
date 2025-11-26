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

  const tenantConfig = useMemo(() => {
    const baseTenant = tenant ?? DEFAULT_TENANT_CONFIG;
    return {
      ...DEFAULT_TENANT_CONFIG,
      ...baseTenant,
      features: mergedFeatures,
    };
  }, [tenant, mergedFeatures]);

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
      featureFlags,
    };
  }, [tenantConfig, tenantKey, queryClient, user, loading, error, featureFlags]);

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