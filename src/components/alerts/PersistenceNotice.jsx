import React from "react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { ShieldAlert } from "lucide-react";

const MODE = (process.env.NEXT_PUBLIC_PERSISTENCE_MODE || "degraded").toLowerCase();
const MESSAGE =
  process.env.NEXT_PUBLIC_PERSISTENCE_MESSAGE ||
  "Changes are stored temporarily. Please export configs frequently and coordinate with the platform team before making production edits.";

export default function PersistenceNotice({ className }) {
  if (MODE === "normal" || MODE === "off") {
    return null;
  }

  return (
    <Alert variant="destructive" className={className}>
      <ShieldAlert className="h-4 w-4" />
      <div className="space-y-1">
        <AlertTitle>Persistence is {MODE}</AlertTitle>
        <AlertDescription>{MESSAGE}</AlertDescription>
      </div>
    </Alert>
  );
}
