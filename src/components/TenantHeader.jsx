import { useTenant } from "@/components/TenantContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, LogOut } from "lucide-react";

export default function TenantHeader({ onLogout }) {
  const context = useTenant();
  
  // Don't render while loading, but always render if context exists
  if (!context || context.loading) return null;

  const tenantName = context.tenantConfig?.display_name || context.tenantConfig?.name || 'Tenant';
  const primaryColor = context.tenantConfig?.branding_primary_color || '#007A6E';

  return (
    <div 
      className="sticky top-0 z-50 text-white px-4 py-2 mb-4 rounded-lg flex items-center justify-between shadow-md"
      style={{ backgroundColor: primaryColor }}
    >
      <div className="flex items-center gap-2">
        <Building2 className="w-5 h-5" />
        <span className="font-semibold text-lg">{tenantName}</span>
      </div>
      <div className="flex items-center gap-3">
        <Badge variant="outline" className="bg-white/20 text-white border-white/40">
          {context.tenantConfig?.region || 'Global'}
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
  );
}