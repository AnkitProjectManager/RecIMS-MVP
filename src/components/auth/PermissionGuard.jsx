import { usePermissions } from "./usePermissions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Lock } from "lucide-react";

export default function PermissionGuard({ user, permission, children, fallback = null, showAlert = false }) {
  const permissions = usePermissions(user);

  const hasAccess = permission ? permissions[permission] : true;

  if (!hasAccess) {
    if (showAlert) {
      return (
        <Alert variant="destructive" className="my-4">
          <Lock className="h-4 w-4" />
          <AlertDescription>
            {"You don't have permission to access this feature. Contact your administrator if you need access."}
          </AlertDescription>
        </Alert>
      );
    }
    return fallback;
  }

  return <>{children}</>;
}