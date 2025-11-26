import React, { useState } from "react";
import { recims } from "@/api/recimsClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Camera, 
  Sparkles, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  Loader2,
  Image as ImageIcon
} from "lucide-react";

export default function DefectDetection({ photoUrls, materialCategory, onDefectsDetected }) {
  const [analyzing, setAnalyzing] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  const analyzePhotos = async () => {
    if (!photoUrls || photoUrls.length === 0) {
      setError("No photos to analyze");
      return;
    }

    setAnalyzing(true);
    setError(null);
    setResults(null);

    try {
      const prompt = `You are an AI quality control inspector for recycling materials. 
      
Analyze the uploaded image(s) of ${materialCategory || 'recycling material'} and identify:
1. Visual defects and contamination
2. Material condition assessment
3. Purity estimation
4. Recommended actions

Look for:
- Contamination (oil, dirt, foreign materials, moisture)
- Physical damage (tears, holes, crushing, corrosion)
- Color inconsistencies
- Mixed materials
- Labels, adhesives, coatings
- Structural integrity issues

Provide a detailed assessment with:
- Overall quality grade (A, B, or C)
- List of specific defects found
- Estimated contamination percentage
- Recommended disposition (approve/reject/downgrade/reprocess)
- Confidence level in your assessment`;

      const response = await recims.integrations.Core.InvokeLLM({
        prompt,
        file_urls: photoUrls,
        response_json_schema: {
          type: "object",
          properties: {
            overall_grade: {
              type: "string",
              enum: ["A", "B", "C"],
              description: "Overall quality grade"
            },
            defects: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  type: { type: "string" },
                  severity: { type: "string", enum: ["low", "medium", "high", "critical"] },
                  description: { type: "string" },
                  location: { type: "string" }
                }
              }
            },
            contamination_percentage: {
              type: "number",
              minimum: 0,
              maximum: 100,
              description: "Estimated contamination %"
            },
            purity_estimate: {
              type: "number",
              minimum: 0,
              maximum: 100,
              description: "Estimated material purity %"
            },
            condition_notes: {
              type: "string",
              description: "Overall condition description"
            },
            recommended_disposition: {
              type: "string",
              enum: ["approved", "rejected", "downgraded", "reprocessing", "quarantined"],
              description: "Recommended action"
            },
            disposition_reason: {
              type: "string",
              description: "Reason for the recommendation"
            },
            confidence_level: {
              type: "string",
              enum: ["high", "medium", "low"],
              description: "AI confidence in assessment"
            },
            requires_manual_inspection: {
              type: "boolean",
              description: "Whether manual verification is recommended"
            }
          },
          required: ["overall_grade", "defects", "contamination_percentage", "recommended_disposition", "confidence_level"]
        }
      });

      setResults(response);
      
      // Callback to parent component
      if (onDefectsDetected) {
        onDefectsDetected(response);
      }

    } catch (err) {
      console.error("AI Analysis Error:", err);
      setError("Failed to analyze photos. Please try again or perform manual inspection.");
    } finally {
      setAnalyzing(false);
    }
  };

  const getSeverityColor = (severity) => {
    switch(severity) {
      case 'critical': return 'bg-red-100 text-red-700 border-red-300';
      case 'high': return 'bg-orange-100 text-orange-700 border-orange-300';
      case 'medium': return 'bg-yellow-100 text-yellow-700 border-yellow-300';
      case 'low': return 'bg-blue-100 text-blue-700 border-blue-300';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getDispositionIcon = (disposition) => {
    switch(disposition) {
      case 'approved': return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'rejected': return <XCircle className="w-5 h-5 text-red-600" />;
      case 'downgraded': return <AlertTriangle className="w-5 h-5 text-orange-600" />;
      default: return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
    }
  };

  return (
    <Card className="border-2" style={{ borderColor: '#1F6FEB', backgroundColor: '#1A2230' }}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2" style={{ color: '#E6EAF2' }}>
            <Sparkles className="w-5 h-5" style={{ color: '#1F6FEB' }} />
            AI-Powered Defect Detection
            <Badge className="bg-purple-600 text-white text-xs">AI</Badge>
          </CardTitle>
          {!results && (
            <Button
              onClick={analyzePhotos}
              disabled={analyzing || !photoUrls || photoUrls.length === 0}
              className="gap-2"
            >
              {analyzing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Camera className="w-4 h-4" />
                  Analyze Photos
                </>
              )}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!results && !analyzing && (
          <div className="text-center py-8" style={{ color: '#7F8AA3' }}>
            <ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">
              {photoUrls?.length > 0 
                ? `${photoUrls.length} photo(s) ready for AI analysis`
                : 'Upload photos to enable AI-powered defect detection'
              }
            </p>
          </div>
        )}

        {results && (
          <div className="space-y-4">
            {/* Overall Assessment */}
            <div className="p-4 rounded-lg" style={{ backgroundColor: '#131722', border: '1px solid #2A3546' }}>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm" style={{ color: '#B9C2D0' }}>AI Assessment</p>
                  <div className="flex items-center gap-2 mt-1">
                    {getDispositionIcon(results.recommended_disposition)}
                    <span className="font-bold text-lg" style={{ color: '#E6EAF2' }}>
                      {results.recommended_disposition.toUpperCase()}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm" style={{ color: '#B9C2D0' }}>Quality Grade</p>
                  <div className={`text-2xl font-bold px-3 py-1 rounded-lg ${
                    results.overall_grade === 'A' ? 'bg-green-900 text-green-100' :
                    results.overall_grade === 'B' ? 'bg-yellow-900 text-yellow-100' :
                    'bg-red-900 text-red-100'
                  }`}>
                    {results.overall_grade}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p style={{ color: '#7F8AA3' }}>Contamination</p>
                  <p className="font-semibold" style={{ color: '#E6EAF2' }}>
                    {results.contamination_percentage?.toFixed(1)}%
                  </p>
                </div>
                <div>
                  <p style={{ color: '#7F8AA3' }}>Purity</p>
                  <p className="font-semibold" style={{ color: '#E6EAF2' }}>
                    {results.purity_estimate?.toFixed(1)}%
                  </p>
                </div>
                <div>
                  <p style={{ color: '#7F8AA3' }}>Confidence</p>
                  <Badge className={
                    results.confidence_level === 'high' ? 'bg-green-100 text-green-700' :
                    results.confidence_level === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-orange-100 text-orange-700'
                  }>
                    {results.confidence_level}
                  </Badge>
                </div>
                <div>
                  <p style={{ color: '#7F8AA3' }}>Manual Check</p>
                  <Badge className={results.requires_manual_inspection ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}>
                    {results.requires_manual_inspection ? 'Required' : 'Optional'}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Condition Notes */}
            {results.condition_notes && (
              <div className="p-3 rounded-lg" style={{ backgroundColor: '#0F1115', border: '1px solid #2A3546' }}>
                <p className="text-sm font-semibold mb-1" style={{ color: '#B9C2D0' }}>Condition Assessment:</p>
                <p className="text-sm" style={{ color: '#E6EAF2' }}>{results.condition_notes}</p>
              </div>
            )}

            {/* Disposition Reason */}
            {results.disposition_reason && (
              <div className="p-3 rounded-lg" style={{ backgroundColor: '#0F1115', border: '1px solid #2A3546' }}>
                <p className="text-sm font-semibold mb-1" style={{ color: '#B9C2D0' }}>Recommendation Reason:</p>
                <p className="text-sm" style={{ color: '#E6EAF2' }}>{results.disposition_reason}</p>
              </div>
            )}

            {/* Defects List */}
            {results.defects && results.defects.length > 0 && (
              <div>
                <p className="text-sm font-semibold mb-2" style={{ color: '#B9C2D0' }}>
                  Detected Defects ({results.defects.length})
                </p>
                <div className="space-y-2">
                  {results.defects.map((defect, index) => (
                    <div
                      key={index}
                      className="p-3 rounded-lg"
                      style={{ backgroundColor: '#131722', border: '1px solid #2A3546' }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-semibold text-sm" style={{ color: '#E6EAF2' }}>
                              {defect.type}
                            </p>
                            <Badge variant="outline" className={getSeverityColor(defect.severity)}>
                              {defect.severity}
                            </Badge>
                          </div>
                          <p className="text-xs" style={{ color: '#7F8AA3' }}>{defect.description}</p>
                          {defect.location && (
                            <p className="text-xs mt-1" style={{ color: '#B9C2D0' }}>
                              Location: {defect.location}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {results.requires_manual_inspection && (
              <Alert className="bg-orange-900 bg-opacity-20 border-orange-700">
                <AlertTriangle className="h-4 w-4" style={{ color: '#F0A202' }} />
                <AlertDescription style={{ color: '#E6EAF2' }}>
                  Manual inspection recommended: AI confidence is {results.confidence_level}. 
                  Verify findings with physical inspection before final disposition.
                </AlertDescription>
              </Alert>
            )}

            <Button
              onClick={() => setResults(null)}
              variant="outline"
              className="w-full"
            >
              Run New Analysis
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}