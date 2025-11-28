import React, {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowUpRight,
  Brain,
  Building2,
  ClipboardCheck,
  FileText,
  LayoutDashboard,
  QrCode,
  Search,
  ShoppingCart,
  Smartphone,
  TruckIcon,
  Users,
  Warehouse,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createPageUrl } from "@/utils";
import { useTenant } from "@/components/TenantContext";

const GLOBAL_SEARCH_INDEX = [
  {
    id: "ops-dashboard",
    title: "Operations Dashboard",
    description: "Live KPIs across inbound, QC, and storage utilization.",
    category: "Dashboards",
    path: "Dashboard",
    icon: LayoutDashboard,
    meta: "Realtime",
    tags: ["KPI", "Executive"],
    keywords: ["dashboard", "operations", "overview", "metrics", "kpi"],
    featured: true,
  },
  {
    id: "inventory-management",
    title: "Inventory Management",
    description: "SKU visibility, allocations, and bin capacity alerts.",
    category: "Inventory",
    path: "InventoryManagement",
    icon: Warehouse,
    meta: "385 SKUs",
    tags: ["Bins", "Capacity"],
    keywords: ["inventory", "stock", "bins", "sku"],
    featured: true,
  },
  {
    id: "inbound-shipments",
    title: "Inbound Shipments",
    description: "Dock schedules, receiving teams, and live truck ETAs.",
    category: "Logistics",
    path: "InboundShipments",
    icon: TruckIcon,
    meta: "6 inbound",
    tags: ["Dock", "Receiving"],
    keywords: ["inbound", "shipments", "truck", "receiving"],
    featured: true,
  },
  {
    id: "create-po",
    title: "Create Purchase Order",
    description: "Raise a PO in less than 60 seconds with guided steps.",
    category: "Purchasing",
    path: "CreatePurchaseOrder",
    icon: FileText,
    meta: "Template",
    tags: ["PO", "Supplier"],
    keywords: ["purchase", "po", "order", "supplier", "create"],
    featured: true,
  },
  {
    id: "purchase-orders",
    title: "Purchase Order Queue",
    description: "Track approvals, receipts, and vendor SLA health.",
    category: "Purchasing",
    path: "PurchaseOrders",
    icon: ShoppingCart,
    meta: "14 open",
    tags: ["Approvals"],
    keywords: ["purchase", "queue", "orders", "po"],
    featured: true,
  },
  {
    id: "sales-orders",
    title: "Sales Order Board",
    description: "Allocate stock, print paperwork, and release shipments.",
    category: "Sales",
    path: "SalesOrderManagement",
    icon: ShoppingCart,
    meta: "8 ready",
    tags: ["Allocation"],
    keywords: ["sales", "order", "so", "release"],
    featured: true,
  },
  {
    id: "quality-control",
    title: "Quality Control",
    description: "Sampling plans, photo evidence, and disposition actions.",
    category: "Operations",
    path: "QualityControl",
    icon: ClipboardCheck,
    meta: "3 holds",
    tags: ["QC", "Photos"],
    keywords: ["quality", "qc", "inspection", "control"],
    featured: true,
  },
  {
    id: "ai-insights",
    title: "AI Insights Workspace",
    description: "Forecast demand, anomaly detection, and auto-summaries.",
    category: "Insights",
    path: "AIInsights",
    icon: Brain,
    meta: "Beta",
    tags: ["AI", "Forecast"],
    keywords: ["ai", "insights", "forecast", "anomaly"],
    featured: true,
  },
  {
    id: "advanced-analytics",
    title: "Advanced Analytics",
    description: "Self-serve visualizations and curated executive decks.",
    category: "Analytics",
    path: "AdvancedAnalytics",
    icon: BarChart3,
    meta: "New",
    tags: ["BI", "Charts"],
    keywords: ["analytics", "reports", "visual", "charts"],
    featured: false,
  },
  {
    id: "customer-directory",
    title: "Customer Directory",
    description: "Account health, order history, and contact insights.",
    category: "CRM",
    path: "CustomerManagement",
    icon: Users,
    meta: "128 accounts",
    tags: ["CRM"],
    keywords: ["customer", "crm", "accounts", "contacts"],
    featured: false,
  },
  {
    id: "vendor-directory",
    title: "Vendor Directory",
    description: "Scorecards, compliance, and vendor collaboration.",
    category: "CRM",
    path: "VendorManagement",
    icon: Building2,
    meta: "72 vendors",
    tags: ["Supplier"],
    keywords: ["vendor", "supplier", "partners"],
    featured: false,
  },
  {
    id: "mobile-warehouse",
    title: "Mobile Warehouse",
    description: "Touch-friendly workflows for pick, put-away, and cycle counts.",
    category: "Mobile",
    path: "MobileWarehouse",
    icon: Smartphone,
    meta: "Devices",
    tags: ["Android", "iOS"],
    keywords: ["mobile", "warehouse", "handheld"],
    featured: false,
  },
  {
    id: "quick-scan",
    title: "Quick Scan",
    description: "QR / barcode powered lookups for bins, SKUs, and orders.",
    category: "Mobile",
    path: "QuickScan",
    icon: QrCode,
    meta: "Scanner",
    tags: ["Lookup"],
    keywords: ["scan", "barcode", "lookup", "qr"],
    featured: false,
  },
  {
    id: "compliance-certificates",
    title: "Compliance Certificates",
    description: "Generate and share QA documentation instantly.",
    category: "Compliance",
    path: "ComplianceCertificates",
    icon: ClipboardCheck,
    meta: "Templates",
    tags: ["QA"],
    keywords: ["compliance", "certificate", "qa"],
    featured: false,
  },
  {
    id: "inventory-by-location",
    title: "Inventory by Location",
    description: "Heatmaps for aisles, racks, and ambient vs. cold storage.",
    category: "Inventory",
    path: "InventoryByLocation",
    icon: Warehouse,
    meta: "Heatmap",
    tags: ["Visibility"],
    keywords: ["location", "map", "heatmap"],
    featured: false,
  },
];

const DEFAULT_RESULTS = GLOBAL_SEARCH_INDEX.filter((item) => item.featured);

const VARIANT_CONTAINER = {
  solid:
    "bg-white/95 border border-slate-200 shadow-[0_15px_45px_rgba(15,23,42,0.08)]",
  frosted:
    "bg-white/15 border border-white/30 text-white shadow-[0_20px_45px_rgba(15,23,42,0.5)] backdrop-blur-2xl",
};

const INPUT_TEXT = {
  solid: "text-slate-900 placeholder:text-slate-500",
  frosted: "text-white placeholder:text-white/70",
};

const ICON_COLOR = {
  solid: "text-slate-500",
  frosted: "text-white/70",
};

const KEYCAP_COLOR = {
  solid: "border-slate-200 bg-white text-slate-600",
  frosted: "border-white/40 bg-white/10 text-white/80",
};

export default function GlobalSearch({ className, variant = "solid" }) {
  const inputId = useId();
  const { theme } = useTenant();
  const accentColor = theme?.primaryColor ?? "#007A6E";
  const glowColor = theme?.glow ?? "rgba(0,122,110,0.25)";
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);

  const wrapperRef = useRef(null);
  const inputRef = useRef(null);

  const activeResults = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return DEFAULT_RESULTS.length ? DEFAULT_RESULTS : GLOBAL_SEARCH_INDEX.slice(0, 8);
    }

    return GLOBAL_SEARCH_INDEX
      .map((item) => {
        const haystack = [
          item.title,
          item.description,
          item.category,
          ...(item.keywords || []),
        ]
          .join(" ")
          .toLowerCase();

        const startsWith = item.title.toLowerCase().startsWith(normalized) ? 6 : 0;
        const keywordHit = item.keywords?.some((kw) => kw.toLowerCase().includes(normalized)) ? 3 : 0;
        const contains = haystack.includes(normalized) ? 2 : 0;
        const score = startsWith + keywordHit + contains;

        return { item, score };
      })
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map(({ item }) => item);
  }, [query]);

  const groupedResults = useMemo(() => {
    return activeResults.reduce((acc, item) => {
      const bucket = acc[item.category] || [];
      bucket.push(item);
      acc[item.category] = bucket;
      return acc;
    }, {});
  }, [activeResults]);

  const flatResults = useMemo(() => activeResults, [activeResults]);
  const hasResults = flatResults.length > 0;

  useEffect(() => {
    setHighlightIndex(0);
  }, [query, hasResults]);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;

    const handleClickAway = (event) => {
      if (!wrapperRef.current) return;
      if (wrapperRef.current.contains(event.target)) return;
      setIsOpen(false);
      setIsFocused(false);
    };

    document.addEventListener("mousedown", handleClickAway);
    return () => document.removeEventListener("mousedown", handleClickAway);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const handler = (event) => {
      if (event.metaKey && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
        return;
      }

      if (event.key === "/" && !event.metaKey && !event.ctrlKey) {
        const activeTag = document.activeElement?.tagName;
        if (activeTag && ["INPUT", "TEXTAREA"].includes(activeTag)) {
          return;
        }
        event.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const handleSelect = (item) => {
    navigate(createPageUrl(item.path));
    setQuery("");
    setIsOpen(false);
    inputRef.current?.blur();
  };

  const handleKeyDown = (event) => {
    if (!hasResults) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIsOpen(true);
      setHighlightIndex((prev) => Math.min(prev + 1, flatResults.length - 1));
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightIndex((prev) => Math.max(prev - 1, 0));
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const current = flatResults[highlightIndex] || flatResults[0];
      if (current) {
        handleSelect(current);
      }
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setIsOpen(false);
      setIsFocused(false);
      event.currentTarget.blur();
    }
  };

  const showResults = isOpen && hasResults;

  const containerStyle =
    isFocused || isOpen
      ? {
          boxShadow:
            variant === "frosted"
              ? `0 0 0 1px rgba(255,255,255,0.35), 0 25px 65px -35px ${glowColor}`
              : `0 0 0 1px ${accentColor}33, 0 25px 65px -35px ${glowColor}`,
        }
      : undefined;

  let runningIndex = -1;

  return (
    <div ref={wrapperRef} className={cn("relative w-full", className)} role="search">
      <label htmlFor={inputId} className="sr-only">
        Search RecIMS
      </label>
      <div
        className={cn(
          "flex items-center gap-3 rounded-2xl px-4 py-2.5 transition-all",
          VARIANT_CONTAINER[variant] || VARIANT_CONTAINER.solid
        )}
        style={containerStyle}
      >
        <Search className={cn("h-4 w-4", ICON_COLOR[variant] || ICON_COLOR.solid)} />
        <input
          id={inputId}
          ref={inputRef}
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setIsOpen(true);
          }}
          onFocus={() => {
            setIsFocused(true);
            setIsOpen(true);
          }}
          onBlur={() => {
            setIsFocused(false);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search pages, actions, or data"
          className={cn(
            "w-full bg-transparent text-sm font-medium caret-current focus:outline-none",
            INPUT_TEXT[variant] || INPUT_TEXT.solid
          )}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showResults}
          aria-controls={`${inputId}-results`}
          aria-haspopup="listbox"
        />
        <div
          className={cn(
            "hidden items-center gap-1 text-[11px] font-semibold tracking-wide uppercase md:flex",
            ICON_COLOR[variant] || ICON_COLOR.solid
          )}
        >
          <span
            className={cn(
              "rounded-lg border px-1.5 py-0.5 text-[11px]",
              KEYCAP_COLOR[variant] || KEYCAP_COLOR.solid
            )}
          >
            ⌘K
          </span>
          <span className="text-xs">or</span>
          <span
            className={cn(
              "rounded-lg border px-1.5 py-0.5 text-[11px]",
              KEYCAP_COLOR[variant] || KEYCAP_COLOR.solid
            )}
          >
            /
          </span>
        </div>
      </div>

      {showResults && (
        <div
          id={`${inputId}-results`}
          className="absolute left-0 right-0 mt-3 drop-shadow-2xl"
          style={{
            zIndex: 60,
          }}
        >
          <div
            className="rounded-2xl border border-white/70 bg-white/95 shadow-[0_30px_80px_rgba(15,23,42,0.25)] backdrop-blur-xl"
            style={{ boxShadow: `0 30px 80px -40px ${glowColor}` }}
          >
            <div className="flex items-center gap-2 px-5 pt-4 pb-2 text-[11px] font-semibold uppercase tracking-[0.4em] text-slate-500">
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-slate-400"
              >
                <path d="M12 2v4" />
                <path d="M12 18v4" />
                <path d="M4.93 4.93l2.83 2.83" />
                <path d="M16.24 16.24l2.83 2.83" />
                <path d="M2 12h4" />
                <path d="M18 12h4" />
                <path d="M4.93 19.07l2.83-2.83" />
                <path d="M16.24 7.76l2.83-2.83" />
              </svg>
              {query.trim() ? "Matches" : "Suggested"}
            </div>

            <div className="max-h-[420px] overflow-y-auto px-2 pb-3">
              {Object.entries(groupedResults).map(([category, items]) => (
                <div key={category} className="mb-4 last:mb-0">
                  <div className="px-4 pb-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-400">
                    {category}
                  </div>
                  <div className="space-y-2">
                    {items.map((item) => {
                      runningIndex += 1;
                      const Icon = item.icon ?? Search;
                      const isActive = runningIndex === highlightIndex;

                      return (
                        <button
                          key={item.id}
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => handleSelect(item)}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition-all",
                            isActive
                              ? "border-slate-900/10 bg-slate-900/5"
                              : "border-transparent hover:border-slate-200 hover:bg-slate-50"
                          )}
                          style={{ borderColor: isActive ? `${accentColor}33` : undefined }}
                        >
                          <div
                            className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100"
                            style={{ background: `${accentColor}15` }}
                          >
                            <Icon className="h-5 w-5" style={{ color: accentColor }} />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <p className="font-semibold text-slate-900">{item.title}</p>
                              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                {item.meta}
                              </span>
                            </div>
                            <p className="text-sm text-slate-500">{item.description}</p>
                            {item.tags?.length ? (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {item.tags.map((tag) => (
                                  <span
                                    key={`${item.id}-${tag}`}
                                    className="rounded-full border border-slate-200/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500"
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            ) : null}
                          </div>
                          <ArrowUpRight className="h-4 w-4 text-slate-400" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {isOpen && !hasResults && (
        <div className="absolute left-0 right-0 mt-3" style={{ zIndex: 60 }}>
          <div className="rounded-2xl border border-white/70 bg-white/95 px-5 py-6 text-sm text-slate-500 shadow-xl">
            No matches for “{query}”. Try searching for a module, workflow, or report.
          </div>
        </div>
      )}
    </div>
  );
}
