import React, { useState } from "react";
import { recims } from "@/api/recimsClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Sparkles, 
  TrendingUp, 
  TrendingDown,
  AlertTriangle,
  DollarSign,
  Zap,
  Loader2,
  CheckCircle,
  ArrowRight
} from "lucide-react";

export default function InsightsEngine({ 
  inventory = [], 
  shipments = [], 
  materials = [],
  qcInspections = [],
  onInsightGenerated 
}) {
  const [analyzing, setAnalyzing] = useState(false);
  const [insights, setInsights] = useState(null);
  const [error, setError] = useState(null);

  const generateInsights = async () => {
    setAnalyzing(true);
    setError(null);
    setInsights(null);

    try {
      // Prepare comprehensive data summary
      const dataSummary = {
        inventory: {
          total_items: inventory.length,
          total_value: inventory.reduce((sum, i) => sum + (i.total_value || 0), 0),
          total_weight_kg: inventory.reduce((sum, i) => sum + (i.quantity_kg || 0), 0),
          available_items: inventory.filter(i => i.status === 'available').length,
          quarantined_items: inventory.filter(i => i.status === 'quarantined').length,
          low_stock_items: inventory.filter(i => i.status === 'low_stock').length,
          categories: [...new Set(inventory.map(i => i.category))],
          avg_quality_grade: calculateAvgGrade(inventory)
        },
        shipments: {
          total: shipments.length,
          last_30_days: shipments.filter(s => {
            const date = new Date(s.created_date);
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            return date >= thirtyDaysAgo;
          }).length,
          completed: shipments.filter(s => s.status === 'completed').length,
          rejected: shipments.filter(s => s.status === 'rejected').length,
          avg_net_weight: shipments.reduce((sum, s) => sum + (s.net_weight || 0), 0) / (shipments.length || 1),
          top_suppliers: getTopSuppliers(shipments, 5)
        },
        quality: {
          total_inspections: qcInspections.length,
          pass_rate: qcInspections.length > 0 
            ? (qcInspections.filter(q => q.overall_result === 'pass').length / qcInspections.length * 100)
            : 0,
          fail_rate: qcInspections.length > 0 
            ? (qcInspections.filter(q => q.overall_result === 'fail').length / qcInspections.length * 100)
            : 0,
          common_contaminants: getMostCommonContaminants(qcInspections)
        },
        trends: {
          inventory_turnover: calculateTurnoverRate(inventory),
          slow_moving_items: inventory.filter(i => {
            const age = getDaysInInventory(i);
            return age > 90;
          }).length
        }
      };

      const prompt = `You are an AI business intelligence analyst for a recycling operations management system.

Analyze the following operational data and provide actionable insights:

INVENTORY DATA:
- Total Items: ${dataSummary.inventory.total_items}
- Total Value: $${dataSummary.inventory.total_value.toLocaleString()}
- Total Weight: ${dataSummary.inventory.total_weight_kg.toFixed(0)} kg
- Available: ${dataSummary.inventory.available_items}
- Quarantined: ${dataSummary.inventory.quarantined_items}
- Low Stock: ${dataSummary.inventory.low_stock_items}
- Categories: ${dataSummary.inventory.categories.join(', ')}
- Avg Quality Grade: ${dataSummary.inventory.avg_quality_grade}

SHIPMENT DATA (Last 30 days):
- Total Shipments: ${dataSummary.shipments.last_30_days}
- Completed: ${dataSummary.shipments.completed}
- Rejected: ${dataSummary.shipments.rejected}
- Avg Net Weight: ${dataSummary.shipments.avg_net_weight.toFixed(0)} kg
- Top Suppliers: ${dataSummary.shipments.top_suppliers.join(', ')}

QUALITY DATA:
- Pass Rate: ${dataSummary.quality.pass_rate.toFixed(1)}%
- Fail Rate: ${dataSummary.quality.fail_rate.toFixed(1)}%
- Common Issues: ${dataSummary.quality.common_contaminants.join(', ')}

TRENDS:
- Slow Moving Items (>90 days): ${dataSummary.trends.slow_moving_items}

Provide strategic insights and recommendations across these areas:
1. Cost Savings Opportunities
2. Efficiency Improvements
3. Quality Enhancement
4. Inventory Optimization
5. Risk Mitigation
6. Revenue Opportunities

Focus on actionable, specific recommendations with estimated impact.`;

      const response = await recims.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            executive_summary: {
              type: "string",
              description: "2-3 sentence executive summary"
            },
            key_findings: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  category: {
                    type: "string",
                    enum: ["cost_savings", "efficiency", "quality", "inventory", "risk", "revenue"]
                  },
                  finding: { type: "string" },
                  impact_level: {
                    type: "string",
                    enum: ["high", "medium", "low"]
                  },
                  estimated_savings: { type: "string" },
                  priority: { type: "number" }
                }
              }
            },
            recommendations: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  description: { type: "string" },
                  category: { type: "string" },
                  impact: { type: "string" },
                  effort: {
                    type: "string",
                    enum: ["low", "medium", "high"]
                  },
                  estimated_roi: { type: "string" },
                  implementation_steps: {
                    type: "array",
                    items: { type: "string" }
                  }
                }
              }
            },
            trends_detected: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  trend: { type: "string" },
                  direction: {
                    type: "string",
                    enum: ["positive", "negative", "neutral"]
                  },
                  description: { type: "string" }
                }
              }
            },
            anomalies: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  anomaly: { type: "string" },
                  severity: {
                    type: "string",
                    enum: ["critical", "high", "medium", "low"]
                  },
                  action_required: { type: "string" }
                }
              }
            },
            overall_health_score: {
              type: "number",
              minimum: 0,
              maximum: 100,
              description: "Overall operational health score"
            }
          },
          required: ["executive_summary", "key_findings", "recommendations", "overall_health_score"]
        }
      });

      setInsights(response);
      
      if (onInsightGenerated) {
        onInsightGenerated(response);
      }

    } catch (err) {
      console.error("AI Insights Error:", err);
      setError("Failed to generate insights. Please try again.");
    } finally {
      setAnalyzing(false);
    }
  };

  const calculateAvgGrade = (items) => {
    const grades = { 'A': 3, 'B': 2, 'C': 1 };
    const validItems = items.filter(i => i.quality_grade);
    if (validItems.length === 0) return 'N/A';
    
    const avgScore = validItems.reduce((sum, i) => sum + (grades[i.quality_grade] || 0), 0) / validItems.length;
    if (avgScore >= 2.5) return 'A';
    if (avgScore >= 1.5) return 'B';
    return 'C';
  };

  const getTopSuppliers = (ships, limit) => {
    const supplierCounts = {};
    ships.forEach(s => {
      supplierCounts[s.supplier_name] = (supplierCounts[s.supplier_name] || 0) + 1;
    });
    return Object.entries(supplierCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([name]) => name);
  };

  const getMostCommonContaminants = (inspections) => {
    const contaminants = {};
    inspections.forEach(insp => {
      (insp.contaminants_found || []).forEach(c => {
        contaminants[c] = (contaminants[c] || 0) + 1;
      });
    });
    return Object.entries(contaminants)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name]) => name);
  };

  const calculateTurnoverRate = (items) => {
    const soldItems = items.filter(i => i.status === 'sold');
    return soldItems.length / (items.length || 1) * 100;
  };

  const getDaysInInventory = (item) => {
    if (!item.received_date) return 0;
    const received = new Date(item.received_date);
    const now = new Date();
    return Math.floor((now - received) / (1000 * 60 * 60 * 24));
  };

  const getImpactColor = (level) => {
    switch(level) {
      case 'high': return 'bg-red-100 text-red-700 border-red-300';
      case 'medium': return 'bg-orange-100 text-orange-700 border-orange-300';
      case 'low': return 'bg-blue-100 text-blue-700 border-blue-300';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getTrendIcon = (direction) => {
    switch(direction) {
      case 'positive': return <TrendingUp className="w-5 h-5 text-green-600" />;
      case 'negative': return <TrendingDown className="w-5 h-5 text-red-600" />;
      default: return <ArrowRight className="w-5 h-5 text-gray-600" />;
    }
  };

  const getCategoryIcon = (category) => {
    switch(category) {
      case 'cost_savings': return <DollarSign className="w-5 h-5 text-green-600" />;
      case 'efficiency': return <Zap className="w-5 h-5 text-blue-600" />;
      case 'quality': return <CheckCircle className="w-5 h-5 text-purple-600" />;
      case 'risk': return <AlertTriangle className="w-5 h-5 text-orange-600" />;
      default: return <Sparkles className="w-5 h-5 text-gray-600" />;
    }
  };

  return (
    <Card className="border-2 border-purple-500">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-purple-600" />
            AI Business Intelligence
            <Badge className="bg-purple-600 text-white">AI</Badge>
          </CardTitle>
          {!insights && (
            <Button
              onClick={generateInsights}
              disabled={analyzing}
              className="bg-purple-600 hover:bg-purple-700 gap-2"
            >
              {analyzing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generate Insights
                </>
              )}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!insights && !analyzing && (
          <div className="text-center py-12">
            <Sparkles className="w-16 h-16 mx-auto mb-4 text-purple-400" />
            <h3 className="text-lg font-semibold mb-2">AI-Powered Analytics</h3>
            <p className="text-sm text-gray-600 mb-4">
              Analyze {inventory.length} inventory items, {shipments.length} shipments, and {qcInspections.length} quality inspections
            </p>
            <p className="text-xs text-gray-500">
              Get actionable insights on cost savings, efficiency, quality, and revenue opportunities
            </p>
          </div>
        )}

        {insights && (
          <div className="space-y-6">
            {/* Health Score */}
            <div className="p-6 rounded-lg bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-200">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold">Operational Health Score</h3>
                <div className="text-right">
                  <div className={`text-4xl font-bold ${
                    insights.overall_health_score >= 80 ? 'text-green-600' :
                    insights.overall_health_score >= 60 ? 'text-yellow-600' :
                    'text-red-600'
                  }`}>
                    {insights.overall_health_score}
                  </div>
                  <p className="text-xs text-gray-600">out of 100</p>
                </div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className={`h-3 rounded-full transition-all ${
                    insights.overall_health_score >= 80 ? 'bg-green-600' :
                    insights.overall_health_score >= 60 ? 'bg-yellow-600' :
                    'bg-red-600'
                  }`}
                  style={{ width: `${insights.overall_health_score}%` }}
                />
              </div>
            </div>

            {/* Executive Summary */}
            <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
              <h3 className="font-semibold mb-2 text-blue-900">Executive Summary</h3>
              <p className="text-sm text-gray-700">{insights.executive_summary}</p>
            </div>

            {/* Key Findings */}
            {insights.key_findings && insights.key_findings.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3">Key Findings</h3>
                <div className="space-y-3">
                  {insights.key_findings
                    .sort((a, b) => b.priority - a.priority)
                    .map((finding, index) => (
                    <div key={index} className="p-4 border rounded-lg bg-white">
                      <div className="flex items-start gap-3">
                        {getCategoryIcon(finding.category)}
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-2">
                            <Badge variant="outline" className={getImpactColor(finding.impact_level)}>
                              {finding.impact_level} impact
                            </Badge>
                            {finding.estimated_savings && (
                              <Badge className="bg-green-600 text-white">
                                {finding.estimated_savings}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm font-medium mb-1">{finding.finding}</p>
                          <p className="text-xs text-gray-600 capitalize">
                            Category: {finding.category.replace('_', ' ')}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recommendations */}
            {insights.recommendations && insights.recommendations.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3">Strategic Recommendations</h3>
                <div className="space-y-4">
                  {insights.recommendations.map((rec, index) => (
                    <div key={index} className="p-4 border-2 rounded-lg bg-gradient-to-r from-purple-50 to-white">
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-semibold text-purple-900">{rec.title}</h4>
                        <div className="flex gap-2">
                          <Badge variant="outline" className="bg-blue-50 text-blue-700">
                            {rec.effort} effort
                          </Badge>
                          {rec.estimated_roi && (
                            <Badge className="bg-green-600 text-white">
                              ROI: {rec.estimated_roi}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-gray-700 mb-3">{rec.description}</p>
                      <p className="text-sm font-medium text-purple-700 mb-2">Impact: {rec.impact}</p>
                      {rec.implementation_steps && rec.implementation_steps.length > 0 && (
                        <div className="mt-3 p-3 bg-white rounded border">
                          <p className="text-xs font-semibold mb-2">Implementation Steps:</p>
                          <ol className="text-xs space-y-1 list-decimal list-inside text-gray-600">
                            {rec.implementation_steps.map((step, i) => (
                              <li key={i}>{step}</li>
                            ))}
                          </ol>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Trends */}
            {insights.trends_detected && insights.trends_detected.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3">Trends Detected</h3>
                <div className="grid md:grid-cols-2 gap-3">
                  {insights.trends_detected.map((trend, index) => (
                    <div key={index} className="p-3 border rounded-lg bg-white flex items-start gap-3">
                      {getTrendIcon(trend.direction)}
                      <div className="flex-1">
                        <p className="font-medium text-sm">{trend.trend}</p>
                        <p className="text-xs text-gray-600 mt-1">{trend.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Anomalies */}
            {insights.anomalies && insights.anomalies.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-orange-600" />
                  Anomalies Requiring Attention
                </h3>
                <div className="space-y-3">
                  {insights.anomalies.map((anomaly, index) => (
                    <Alert key={index} className={
                      anomaly.severity === 'critical' ? 'border-red-500 bg-red-50' :
                      anomaly.severity === 'high' ? 'border-orange-500 bg-orange-50' :
                      'border-yellow-500 bg-yellow-50'
                    }>
                      <AlertDescription>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-semibold mb-1">{anomaly.anomaly}</p>
                            <p className="text-sm">{anomaly.action_required}</p>
                          </div>
                          <Badge className={getImpactColor(anomaly.severity)}>
                            {anomaly.severity}
                          </Badge>
                        </div>
                      </AlertDescription>
                    </Alert>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <Button
                onClick={() => setInsights(null)}
                variant="outline"
                className="flex-1"
              >
                Clear
              </Button>
              <Button
                onClick={generateInsights}
                className="flex-1 bg-purple-600 hover:bg-purple-700 gap-2"
              >
                <Sparkles className="w-4 h-4" />
                Refresh Insights
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}