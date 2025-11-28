export const PAGE_PHASE_REQUIREMENTS = {
  QualityControl: 4,
  ManageQCCriteria: 5,
  InventoryManagement: 3,
  AddToInventory: 3,
  InventoryAdjustment: 3,
  InventorySorting: 3,
  InventoryByLocation: 3,
  InventoryBySKU: 3,
  StockTransfer: 3,
  Reports: 5,
  AdvancedAnalytics: 5,
  SalesDashboard: 4,
  ComplianceAnalytics: 4,
  AIInsights: 6,
  AIInsightsModule: 6,
  EmailTemplates: 4,
  ManageProductSKUs: 5,
  ManageMaterialCategories: 4,
  MobileQC: 4,
  QBOSetup: 5,
  SuperAdmin: 4,
  TenantConsole: 4,
  ManageTenantCategories: 4,
  CreateTenant: 4,
  ViewTenant: 4,
  EditTenant: 4,
  TenantUsers: 4,
  CrossTenantDashboard: 4,
};

export function getPagePhaseRequirement(pageName, fallback = 1) {
  if (!pageName) {
    return fallback;
  }
  return PAGE_PHASE_REQUIREMENTS[pageName] ?? fallback;
}

export function canAccessPage(pageName, maxPhase = Infinity) {
  const required = getPagePhaseRequirement(pageName);
  if (!Number.isFinite(maxPhase)) {
    return true;
  }
  return required <= maxPhase;
}
