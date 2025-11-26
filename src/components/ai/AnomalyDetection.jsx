import React, { useState, useEffect, useCallback } from "react";
import { recims } from "@/api/recimsClient";
import { useQuery } from "@tanstack/react-query";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  AlertTriangle, 
  TrendingUp, 
  Scale,
  Sparkles,
  ChevronDown,
  ChevronUp
} from "lucide-react";

export default function AnomalyDetection({ 
  expectedWeightKg,
  actualWeightKg,
  expectedPurity,
  actualPurity,
  category,
  vendorName,
  onAnomalyDetected
}) {
  const [anomalies, setAnomalies] = useState([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const { data: historicalData = [] } = useQuery({
    queryKey: ['historicalReceiving', vendorName, category],
    queryFn: async () => {
      // Get recent receiving history for this vendor/category
      const items = await recims.entities.PurchaseOrderItem.filter(
        { status: 'received' },
        '-received_date',
        50
      );
      return items;
    },
    initialData: [],
  });

  const analyzeWithAI = useCallback(async (currentAnomalies, history) => {
    try {
      const weights = history.map(h => h.actual_weight_kg || h.expected_weight_kg).filter(Boolean);
      const avgWeight = weights.reduce((a, b) => a + b, 0) / weights.length;
      const weightVariances = history
        .filter(h => h.expected_weight_kg && h.actual_weight_kg)
        .map(h => ((h.actual_weight_kg - h.expected_weight_kg) / h.expected_weight_kg) * 100);

      const avgVariance = weightVariances.length > 0
        ? weightVariances.reduce((a, b) => a + b, 0) / weightVariances.length
        : 0;

      const prompt = `You are an AI anomaly detection system for a recycling facility receiving operations.

Current Receipt:
- Vendor: ${vendorName}
- Category: ${category}
- Expected Weight: ${expectedWeightKg} kg
- Actual Weight: ${actualWeightKg} kg
- Weight Variance: ${((actualWeightKg - expectedWeightKg) / expectedWeightKg * 100).toFixed(1)}%

Historical Data (last 50 receipts):
- Average Weight: ${avgWeight.toFixed(2)} kg
- Average Variance: ${avgVariance.toFixed(2)}%
- Total Historical Receipts: ${history.length}

Current Anomalies Detected:
${JSON.stringify(currentAnomalies.map(a => ({ type: a.type, severity: a.severity, variance: a.variance })), null, 2)}

Analyze:
1. Is this variance pattern unusual compared to historical data?
2. Are there concerning trends (e.g., consistent over/under delivery)?
3. Should we flag vendor for review?
4. What actions should be taken?

Provide insights and recommendations.`;

      const response = await recims.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            pattern_detected: {
              type: "boolean",
              description: "Is there an unusual pattern?"
            },
            pattern_description: {
              type: "string",
              description: "Description of the pattern"
            },
            risk_level: {
              type: "string",
              enum: ["low", "medium", "high", "critical"]
            },
            trend_analysis: {
              type: "string",
              description: "Trend analysis insights"
            },
            vendor_flag_recommended: {
              type: "boolean",
              description: "Should vendor be flagged for review?"
            },
            recommended_actions: {
              type: "array",
              items: { type: "string" }
            }
          },
          required: ["pattern_detected", "risk_level", "recommended_actions"]
        }
      });

      if (response.pattern_detected) {
        return {
          type: 'ai_pattern',
          severity: response.risk_level === 'critical' ? 'critical' : response.risk_level,
          title: 'AI-Detected Pattern Anomaly',
          message: response.pattern_description || 'Unusual pattern detected in receiving history',
          aiInsights: response,
          recommendation: response.recommended_actions?.join(' ') || 'Review vendor performance and document findings.'
        };
      }

    } catch (err) {
      console.error("AI anomaly analysis error:", err);
    }

    return null;
  }, [actualWeightKg, category, expectedWeightKg, vendorName]);

  const detectAnomalies = useCallback(async () => {
    setAnalyzing(true);
    const detectedAnomalies = [];

    try {
      const weightVariance = ((actualWeightKg - expectedWeightKg) / expectedWeightKg) * 100;

      if (Math.abs(weightVariance) > 15) {
        detectedAnomalies.push({
          type: 'weight_variance',
          severity: Math.abs(weightVariance) > 25 ? 'critical' : 'high',
          title: 'Significant Weight Discrepancy',
          message: `Actual weight (${actualWeightKg.toFixed(2)} kg) differs from expected (${expectedWeightKg.toFixed(2)} kg) by ${weightVariance.toFixed(1)}%`,
          variance: weightVariance,
          recommendation: Math.abs(weightVariance) > 25
            ? 'Critical variance detected. Verify scale calibration and reweigh. Document discrepancy with photos.'
            : 'Significant variance detected. Document and verify with vendor.'
        });
      }

      if (actualPurity && expectedPurity) {
        const purityVariance = parseFloat(actualPurity) - parseFloat(expectedPurity.replace('%', ''));

        if (Math.abs(purityVariance) > 10) {
          detectedAnomalies.push({
            type: 'purity_variance',
            severity: Math.abs(purityVariance) > 20 ? 'high' : 'medium',
            title: 'Purity Level Discrepancy',
            message: `Actual purity (${actualPurity}%) differs from expected (${expectedPurity}) by ${purityVariance.toFixed(1)}%`,
            variance: purityVariance,
            recommendation: 'Consider lab testing for verification. May require regrading or price adjustment.'
          });
        }
      }

      if (historicalData.length > 5 && detectedAnomalies.length > 0) {
        const aiAnalysis = await analyzeWithAI(detectedAnomalies, historicalData);
        if (aiAnalysis) {
          detectedAnomalies.push(aiAnalysis);
        }
      }

      setAnomalies(detectedAnomalies);

      if (detectedAnomalies.length > 0 && onAnomalyDetected) {
        onAnomalyDetected(detectedAnomalies);
      }

    } catch (err) {
      console.error("Anomaly detection error:", err);
    } finally {
      setAnalyzing(false);
    }
  }, [actualPurity, actualWeightKg, analyzeWithAI, expectedPurity, expectedWeightKg, historicalData, onAnomalyDetected]);

  useEffect(() => {
    if (actualWeightKg && expectedWeightKg) {
      detectAnomalies();
    } else {
      setAnomalies([]);
    }
  }, [actualWeightKg, expectedWeightKg, detectAnomalies]);

  const getSeverityColor = (severity) => {
    switch(severity) {
      case 'critical': return 'bg-red-900 text-red-100 border-red-700';
      case 'high': return 'bg-orange-900 text-orange-100 border-orange-700';
      case 'medium': return 'bg-yellow-900 text-yellow-100 border-yellow-700';
      default: return 'bg-blue-900 text-blue-100 border-blue-700';
    }
  };

  const getSeverityIcon = (severity) => {
    switch(severity) {
      case 'critical': return '🔴';
      case 'high': return '🟠';
      case 'medium': return '🟡';
      default: return '🔵';
    }
  };

  if (anomalies.length === 0) return null;

  return (
    <div className="space-y-3">
      <Alert className="bg-orange-900 bg-opacity-20 border-orange-700">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 mt-0.5" style={{ color: '#F0A202' }} />
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <AlertDescription className="font-semibold" style={{ color: '#E6EAF2' }}>
                  Anomalies Detected ({anomalies.length})
                </AlertDescription>
                <Badge className="bg-purple-600 text-white text-xs">
                  <Sparkles className="w-3 h-3 mr-1" />
                  AI
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpanded(!expanded)}
                className="h-6"
              >
                {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </Button>
            </div>

            {/* Summary view */}
            <div className="flex flex-wrap gap-2 mb-2">
              {anomalies.map((anomaly, index) => (
                <Badge key={index} className={getSeverityColor(anomaly.severity)}>
                  {getSeverityIcon(anomaly.severity)} {anomaly.type.replace('_', ' ')}
                </Badge>
              ))}
            </div>

            {/* Expanded details */}
            {expanded && (
              <div className="space-y-3 mt-3">
                {anomalies.map((anomaly, index) => (
                  <div
                    key={index}
                    className="p-3 rounded-lg"
                    style={{ backgroundColor: '#0F1115', border: '1px solid #2A3546' }}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {anomaly.type === 'weight_variance' && <Scale className="w-4 h-4" style={{ color: '#F0A202' }} />}
                        {anomaly.type === 'purity_variance' && <TrendingUp className="w-4 h-4" style={{ color: '#F0A202' }} />}
                        {anomaly.type === 'ai_pattern' && <Sparkles className="w-4 h-4" style={{ color: '#1F6FEB' }} />}
                        <p className="font-semibold text-sm" style={{ color: '#E6EAF2' }}>
                          {anomaly.title}
                        </p>
                      </div>
                      <Badge className={getSeverityColor(anomaly.severity)}>
                        {anomaly.severity}
                      </Badge>
                    </div>

                    <p className="text-sm mb-2" style={{ color: '#B9C2D0' }}>
                      {anomaly.message}
                    </p>

                    {anomaly.recommendation && (
                      <div className="p-2 rounded" style={{ backgroundColor: '#1A2230' }}>
                        <p className="text-xs font-semibold mb-1" style={{ color: '#F0A202' }}>
                          Recommended Action:
                        </p>
                        <p className="text-xs" style={{ color: '#E6EAF2' }}>
                          {anomaly.recommendation}
                        </p>
                      </div>
                    )}

                    {anomaly.aiInsights && (
                      <div className="mt-2 p-2 rounded" style={{ backgroundColor: '#1A2230', border: '1px solid #1F6FEB' }}>
                        <p className="text-xs font-semibold mb-1 flex items-center gap-1" style={{ color: '#1F6FEB' }}>
                          <Sparkles className="w-3 h-3" />
                          AI Pattern Analysis:
                        </p>
                        {anomaly.aiInsights.trend_analysis && (
                          <p className="text-xs mb-2" style={{ color: '#B9C2D0' }}>
                            {anomaly.aiInsights.trend_analysis}
                          </p>
                        )}
                        {anomaly.aiInsights.vendor_flag_recommended && (
                          <Badge className="bg-red-600 text-white text-xs">
                            ⚠ Vendor Review Recommended
                          </Badge>
                        )}
                        {anomaly.aiInsights.recommended_actions && (
                          <ul className="text-xs mt-2 space-y-1" style={{ color: '#E6EAF2' }}>
                            {anomaly.aiInsights.recommended_actions.map((action, i) => (
                              <li key={i}>• {action}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Alert>
    </div>
  );
}