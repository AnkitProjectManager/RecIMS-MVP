import React, { useMemo, useState } from "react";
import { recims } from "@/api/recimsClient";
import { useQuery } from "@tanstack/react-query";
import { useTenant } from "@/components/TenantContext";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Sparkles, Download } from "lucide-react";
import { format } from "date-fns";
import InsightsEngine from "@/components/ai/InsightsEngine";
import MetricsWidget from "@/components/dashboard/MetricsWidget";
import { getThemePalette, withAlpha } from "@/lib/theme";

export default function AIInsights() {
  const { tenantConfig, user, theme } = useTenant();
  const [generatedInsights, setGeneratedInsights] = useState(null);
  const palette = useMemo(() => getThemePalette(theme), [theme]);
  const pageBackgroundStyle = useMemo(
    () => ({
      background: `linear-gradient(200deg, ${withAlpha(palette.primaryColor, 0.06)}, #ffffff 45%, ${withAlpha(palette.secondaryColor, 0.06)})`,
    }),
    [palette]
  );

  const { data: inventory = [] } = useQuery({
    queryKey: ['inventory', user?.tenant_id],
    queryFn: async () => {
      if (!user?.tenant_id) return [];
      return await recims.entities.Inventory.filter({ tenant_id: user.tenant_id }, '-created_date', 500);
    },
    enabled: !!user?.tenant_id,
    initialData: [],
  });

  const { data: shipments = [] } = useQuery({
    queryKey: ['shipments', user?.tenant_id],
    queryFn: async () => {
      if (!user?.tenant_id) return [];
      return await recims.entities.InboundShipment.filter({ tenant_id: user.tenant_id }, '-created_date', 200);
    },
    enabled: !!user?.tenant_id,
    initialData: [],
  });

  const { data: materials = [] } = useQuery({
    queryKey: ['materials', user?.tenant_id],
    queryFn: async () => {
      if (!user?.tenant_id) return [];
      return await recims.entities.Material.filter({ tenant_id: user.tenant_id }, '-created_date', 200);
    },
    enabled: !!user?.tenant_id,
    initialData: [],
  });

  const { data: qcInspections = [] } = useQuery({
    queryKey: ['qcInspections', user?.tenant_id],
    queryFn: async () => {
      if (!user?.tenant_id) return [];
      return await recims.entities.QCInspection.filter({ tenant_id: user.tenant_id }, '-created_date', 200);
    },
    enabled: !!user?.tenant_id,
    initialData: [],
  });

  // Prepare data for visualization widgets
  const inventoryValueData = [];
  const last7Days = [...Array(7)].map((_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    return date;
  });

  last7Days.forEach(date => {
    const dayInventory = inventory.filter(item => {
      const itemDate = new Date(item.received_date || item.created_date);
      return itemDate.toDateString() === date.toDateString();
    });
    const totalValue = dayInventory.reduce((sum, i) => sum + (i.total_value || 0), 0);
    inventoryValueData.push({
      label: format(date, 'MMM dd'),
      value: totalValue
    });
  });

  const categoryDistribution = inventory.reduce((acc, item) => {
    if (item.status !== 'sold') {
      const category = item.category || 'Unknown';
      const existing = acc.find(a => a.name === category);
      if (existing) {
        existing.value += 1;
      } else {
        acc.push({ name: category, value: 1 });
      }
    }
    return acc;
  }, []);

  const turnoverData = [];
  last7Days.forEach(date => {
    const daySold = inventory.filter(item => {
      const soldDate = new Date(item.updated_date);
      return item.status === 'sold' && soldDate.toDateString() === date.toDateString();
    }).length;
    turnoverData.push({
      label: format(date, 'MMM dd'),
      value: daySold
    });
  });

  const qualityTrendData = [];
  const last30Days = [...Array(30)].map((_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (29 - i));
    return date;
  });

  last30Days.forEach(date => {
    const dayInspections = qcInspections.filter(qc => {
      const qcDate = new Date(qc.inspection_date);
      return qcDate.toDateString() === date.toDateString();
    });
    const passRate = dayInspections.length > 0
      ? (dayInspections.filter(qc => qc.overall_result === 'pass').length / dayInspections.length * 100)
      : 0;
    qualityTrendData.push({
      label: format(date, 'MMM dd'),
      value: parseFloat(passRate.toFixed(1))
    });
  });

  const downloadInsights = () => {
    const reportData = {
      generated: new Date().toISOString(),
      organization: tenantConfig?.display_name || tenantConfig?.company_name || 'Company',
      insights: generatedInsights,
      summary_stats: {
        total_inventory_items: inventory.length,
        total_inventory_value: inventory.reduce((sum, i) => sum + (i.total_value || 0), 0),
        total_shipments: shipments.length,
        qc_pass_rate: qcInspections.length > 0 
          ? (qcInspections.filter(q => q.overall_result === 'pass').length / qcInspections.length * 100).toFixed(1)
          : 0
      }
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-insights-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.json`;
    a.click();
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto" style={pageBackgroundStyle}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link to={createPageUrl("Dashboard")}>
            <Button variant="outline" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Sparkles className="w-7 h-7" style={{ color: palette.primaryColor }} />
              AI Business Intelligence
            </h1>
            <p className="text-sm text-gray-600">Data-driven insights and recommendations</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Badge className="text-white" style={{ backgroundColor: palette.primaryColor }}>
            AI-POWERED
          </Badge>
          {generatedInsights && (
            <Button onClick={downloadInsights} variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          )}
        </div>
      </div>

      {/* Key Metrics Dashboard */}
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <MetricsWidget
          title="Inventory Value Trend (7 Days)"
          type="area"
          data={inventoryValueData}
          trend={{ direction: 'up', value: '+12%' }}
        />
        <MetricsWidget
          title="Inventory by Category"
          type="pie"
          data={categoryDistribution}
        />
        <MetricsWidget
          title="Inventory Turnover (7 Days)"
          type="bar"
          data={turnoverData}
          trend={{ direction: 'up', value: '+8%' }}
        />
        <MetricsWidget
          title="QC Pass Rate Trend (30 Days)"
          type="line"
          data={qualityTrendData}
          trend={{ 
            direction: qualityTrendData[qualityTrendData.length - 1]?.value > 85 ? 'up' : 'down',
            value: `${qualityTrendData[qualityTrendData.length - 1]?.value || 0}%`
          }}
        />
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="tenant-surface">
          <CardContent className="p-4">
            <p className="text-xs text-gray-600 mb-1">Total Inventory Value</p>
            <p className="text-2xl font-bold" style={{ color: palette.primaryColor }}>
              ${(inventory.reduce((sum, i) => sum + (i.total_value || 0), 0) / 1000).toFixed(1)}K
            </p>
          </CardContent>
        </Card>
        <Card className="tenant-surface">
          <CardContent className="p-4">
            <p className="text-xs text-gray-600 mb-1">Available Items</p>
            <p className="text-2xl font-bold" style={{ color: palette.secondaryColor }}>
              {inventory.filter(i => i.status === 'available').length}
            </p>
          </CardContent>
        </Card>
        <Card className="tenant-surface">
          <CardContent className="p-4">
            <p className="text-xs text-gray-600 mb-1">Avg Quality Grade</p>
            <p className="text-2xl font-bold" style={{ color: palette.primaryColor }}>
              {(() => {
                const grades = { 'A': 3, 'B': 2, 'C': 1 };
                const validItems = inventory.filter(i => i.quality_grade);
                if (validItems.length === 0) return 'N/A';
                const avgScore = validItems.reduce((sum, i) => sum + (grades[i.quality_grade] || 0), 0) / validItems.length;
                if (avgScore >= 2.5) return 'A';
                if (avgScore >= 1.5) return 'B';
                return 'C';
              })()}
            </p>
          </CardContent>
        </Card>
        <Card className="tenant-surface">
          <CardContent className="p-4">
            <p className="text-xs text-gray-600 mb-1">QC Pass Rate</p>
            <p className="text-2xl font-bold" style={{ color: palette.primaryColor }}>
              {qcInspections.length > 0 
                ? ((qcInspections.filter(q => q.overall_result === 'pass').length / qcInspections.length) * 100).toFixed(1)
                : 0}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* AI Insights Engine */}
      <InsightsEngine
        inventory={inventory}
        shipments={shipments}
        materials={materials}
        qcInspections={qcInspections}
        onInsightGenerated={setGeneratedInsights}
      />
    </div>
  );
}