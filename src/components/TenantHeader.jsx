import { useTenant } from "@/components/TenantContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import GlobalSearch from "@/components/ui/global-search";
import { Building2, LogOut } from "lucide-react";

export default function TenantHeader({ onLogout, showSearch = true }) {
  const { tenantConfig, theme, loading } = useTenant();

  if (loading) return null;

  const tenantName = tenantConfig?.display_name || tenantConfig?.name || 'Tenant';
  const regionLabel = tenantConfig?.region || 'Global';
  const gradientStyle = theme?.gradient
    ? { background: theme.gradient }
    : { backgroundColor: tenantConfig?.branding_primary_color || '#007A6E' };

  return (
    <div
      className="sticky top-0 z-50 text-white px-4 py-4 mb-4 rounded-2xl shadow-xl border border-white/15 backdrop-blur"
      style={gradientStyle}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-6">
        <div className="flex items-center gap-3 min-w-[200px]">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20">
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="text-sm text-white/80">Operating as</p>
            <p className="text-xl font-semibold leading-tight">{tenantName}</p>
          </div>
        </div>

        {showSearch && (
          <div className="order-3 w-full lg:order-none lg:flex-1">
            <GlobalSearch className="max-w-3xl mx-auto" variant="frosted" />
          </div>
        )}

        <div className="flex items-center gap-3 justify-end flex-1 min-w-[200px]">
          <Badge variant="outline" className="bg-white/15 text-white border-white/30 text-xs uppercase tracking-wide">
            {regionLabel}
          </Badge>
          {onLogout && (
            <Button
              size="sm"
              variant="outline"
              onClick={onLogout}
              className="bg-white/10 hover:bg-white/20 border-white/50 text-white"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}