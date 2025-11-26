import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ArrowLeft } from "lucide-react";

export default function PageHeader({ 
  title, 
  description, 
  icon: Icon, 
  backTo = "Dashboard",
  actions 
}) {
  return (
    <div className="sticky top-12 z-40 bg-gradient-to-br from-gray-100 via-gray-50 to-gray-100 py-4 -mt-4 mb-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Link to={createPageUrl(backTo)}>
            <Button variant="outline" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              {Icon && <Icon className="w-7 h-7 text-green-600" />}
              {title}
            </h1>
            {description && <p className="text-sm text-gray-600">{description}</p>}
          </div>
        </div>
        {actions && <div className="flex gap-2 flex-wrap justify-end">{actions}</div>}
      </div>
    </div>
  );
}