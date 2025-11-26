import React, { useState } from "react";
import { recims } from "@/api/recimsClient";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, MapPin, Scale, Boxes, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function BinLocationSuggestion({ 
  materialType, 
  category, 
  weightKg, 
  volumeCubicFeet,
  volumeCubicYards,
  volumeCubicMeters,
  productGrouping = 'standard',
  bins, 
  onSuggestionSelected 
}) {
  const [suggestions, setSuggestions] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const { data: materials = [] } = useQuery({
    queryKey: ['materials'],
    queryFn: () => recims.entities.Material.list(),
    initialData: [],
  });

  const generateSuggestions = async () => {
    setLoading(true);
    setError(null);
    setSuggestions(null);

    try {
      // Calculate current bin utilization
      const binUtilization = bins.map(bin => {
        const weightUtil = bin.track_weight !== false && bin.max_weight_kg 
          ? ((bin.current_weight_kg || 0) / bin.max_weight_kg * 100).toFixed(1) 
          : 0;
        
        let volumeUtil = 0;
        if (bin.track_volume) {
          const volumeUnit = bin.volume_unit || 'cubic_feet';
          if (volumeUnit === 'cubic_feet') {
            volumeUtil = bin.max_volume_cubic_feet 
              ? ((bin.current_volume_cubic_feet || 0) / bin.max_volume_cubic_feet * 100).toFixed(1)
              : 0;
          } else if (volumeUnit === 'cubic_yards') {
            volumeUtil = bin.max_volume_cubic_yards
              ? ((bin.current_volume_cubic_yards || 0) / bin.max_volume_cubic_yards * 100).toFixed(1)
              : 0;
          } else {
            volumeUtil = bin.max_volume_cubic_meters
              ? ((bin.current_volume_cubic_meters || 0) / bin.max_volume_cubic_meters * 100).toFixed(1)
              : 0;
          }
        }
        
        return {
          bin_code: bin.bin_code,
          zone: bin.zone,
          material_type: bin.material_type,
          status: bin.status,
          track_weight: bin.track_weight !== false,
          track_volume: bin.track_volume || false,
          weight_utilization: weightUtil,
          volume_utilization: volumeUtil,
          max_weight_kg: bin.max_weight_kg || 0,
          current_weight_kg: bin.current_weight_kg || 0,
          max_volume_cubic_feet: bin.max_volume_cubic_feet || 0,
          current_volume_cubic_feet: bin.current_volume_cubic_feet || 0,
          weight_unit: bin.weight_unit || 'kg',
          volume_unit: bin.volume_unit || 'cubic_feet'
        };
      });

      // Material access frequency
      const materialFrequency = materials.reduce((acc, mat) => {
        acc[mat.material_category] = (acc[mat.material_category] || 0) + 1;
        return acc;
      }, {});

      // Determine best volume unit to use based on what's provided
      let volumeForCalculation = 0;
      let volumeUnitUsed = '';
      if (volumeCubicFeet) {
        volumeForCalculation = volumeCubicFeet;
        volumeUnitUsed = 'cubic_feet';
      } else if (volumeCubicYards) {
        volumeForCalculation = volumeCubicYards;
        volumeUnitUsed = 'cubic_yards';
      } else if (volumeCubicMeters) {
        volumeForCalculation = volumeCubicMeters;
        volumeUnitUsed = 'cubic_meters';
      }

      const prompt = `You are a warehouse optimization AI. Given the following context, recommend the TOP 3 optimal bin locations for a new material.

**PRODUCT DETAILS:**
- Material Type: ${materialType}
- Category: ${category}
- Weight: ${weightKg} kg
- Volume: ${volumeForCalculation > 0 ? `${volumeForCalculation} ${volumeUnitUsed}` : 'Not specified'}
- Product Grouping: ${productGrouping} (light_bulky=high volume/low weight, heavy_compact=low volume/high weight, fragile=special handling, standard=balanced)

**AVAILABLE BINS:**
${JSON.stringify(binUtilization, null, 2)}

**MATERIAL ACCESS FREQUENCY:**
${JSON.stringify(materialFrequency, null, 2)}

**OPTIMIZATION CRITERIA:**
1. **Weight Capacity:** Ensure bin has enough weight capacity remaining
2. **Volume Capacity:** Ensure bin has enough volume capacity remaining (if tracked)
3. **Product Grouping Match:** Match product grouping to bin configuration
   - light_bulky products → bins with good volume capacity
   - heavy_compact products → bins with good weight capacity
   - fragile products → bins with lower utilization for safety
   - standard products → balanced bins
4. **Material Type Match:** Prefer bins storing same material type (avoid contamination)
5. **Zone Optimization:** Consider zone for efficient material flow
6. **Utilization Balance:** Prefer bins with moderate utilization (30-70%) over empty or near-full bins
7. **Access Frequency:** High-frequency materials should be in easily accessible zones

**IMPORTANT RULES:**
- Product weight MUST NOT exceed available weight capacity
- Product volume MUST NOT exceed available volume capacity (if tracked)
- Both weight AND volume must fit if bin tracks both
- Consider product grouping for optimal assignment

Provide exactly 3 recommendations in this JSON format:
{
  "recommendations": [
    {
      "bin_code": "BIN-001",
      "zone": "ZONE-A",
      "confidence": 95,
      "reasoning": "Detailed explanation of why this is optimal",
      "advantages": ["advantage 1", "advantage 2"],
      "considerations": ["consideration 1"],
      "estimated_utilization_after": {"weight": 65, "volume": 45}
    }
  ]
}`;

      const response = await recims.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            recommendations: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  bin_code: { type: "string" },
                  zone: { type: "string" },
                  confidence: { type: "number" },
                  reasoning: { type: "string" },
                  advantages: { type: "array", items: { type: "string" } },
                  considerations: { type: "array", items: { type: "string" } },
                  estimated_utilization_after: {
                    type: "object",
                    properties: {
                      weight: { type: "number" },
                      volume: { type: "number" }
                    }
                  }
                }
              }
            }
          }
        }
      });

      setSuggestions(response.recommendations);
    } catch (err) {
      setError(err.message || "Failed to generate bin suggestions");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-indigo-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-purple-900">
          <Sparkles className="w-5 h-5" />
          AI Bin Location Suggestions
          <Badge className="bg-purple-600 text-white ml-2">PHASE III</Badge>
        </CardTitle>
        <p className="text-sm text-purple-700 mt-1">
          Get intelligent bin recommendations based on weight, volume, product grouping, and warehouse optimization
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {!suggestions && !loading && (
          <div className="text-center py-6">
            <Button
              onClick={generateSuggestions}
              disabled={loading}
              className="bg-purple-600 hover:bg-purple-700 gap-2"
            >
              <Sparkles className="w-4 h-4" />
              Generate Smart Suggestions
            </Button>
            <p className="text-xs text-purple-600 mt-2">
              AI will analyze bins based on weight, volume, product type, and utilization
            </p>
          </div>
        )}

        {loading && (
          <div className="text-center py-8">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-purple-600 mb-3" />
            <p className="text-sm text-purple-700">Analyzing warehouse layout and capacity...</p>
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {suggestions && suggestions.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-purple-900">
                Top {suggestions.length} Recommendations:
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={generateSuggestions}
                disabled={loading}
                className="gap-2"
              >
                <Sparkles className="w-3 h-3" />
                Regenerate
              </Button>
            </div>

            {suggestions.map((suggestion, index) => (
              <Card key={index} className="bg-white border-purple-200">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="bg-purple-100 text-purple-900 font-bold rounded-full w-8 h-8 flex items-center justify-center">
                        #{index + 1}
                      </div>
                      <div>
                        <p className="font-bold text-lg text-purple-900">{suggestion.bin_code}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            <MapPin className="w-3 h-3 mr-1" />
                            {suggestion.zone}
                          </Badge>
                          <Badge className="bg-green-100 text-green-700 text-xs">
                            {suggestion.confidence}% Match
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <Button
                      onClick={() => onSuggestionSelected(suggestion.bin_code, suggestion.zone)}
                      size="sm"
                      className="bg-purple-600 hover:bg-purple-700 gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Select
                    </Button>
                  </div>

                  <div className="space-y-3">
                    <div className="p-3 bg-purple-50 rounded-lg">
                      <p className="text-sm text-purple-900 font-semibold mb-1">Why This Bin?</p>
                      <p className="text-xs text-purple-700">{suggestion.reasoning}</p>
                    </div>

                    {suggestion.estimated_utilization_after && (
                      <div className="grid grid-cols-2 gap-2">
                        {suggestion.estimated_utilization_after.weight > 0 && (
                          <div className="p-2 bg-blue-50 rounded flex items-center gap-2">
                            <Scale className="w-4 h-4 text-blue-600" />
                            <div>
                              <p className="text-xs text-blue-900 font-semibold">Weight</p>
                              <p className="text-xs text-blue-700">
                                {suggestion.estimated_utilization_after.weight}% after
                              </p>
                            </div>
                          </div>
                        )}
                        {suggestion.estimated_utilization_after.volume > 0 && (
                          <div className="p-2 bg-green-50 rounded flex items-center gap-2">
                            <Boxes className="w-4 h-4 text-green-600" />
                            <div>
                              <p className="text-xs text-green-900 font-semibold">Volume</p>
                              <p className="text-xs text-green-700">
                                {suggestion.estimated_utilization_after.volume}% after
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {suggestion.advantages && suggestion.advantages.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-gray-700 mb-1">✅ Advantages:</p>
                        <ul className="space-y-1">
                          {suggestion.advantages.map((adv, i) => (
                            <li key={i} className="text-xs text-gray-600 flex items-start gap-1">
                              <span className="text-green-600 mt-0.5">•</span>
                              <span>{adv}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {suggestion.considerations && suggestion.considerations.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-gray-700 mb-1">⚠️ Considerations:</p>
                        <ul className="space-y-1">
                          {suggestion.considerations.map((con, i) => (
                            <li key={i} className="text-xs text-gray-600 flex items-start gap-1">
                              <span className="text-orange-600 mt-0.5">•</span>
                              <span>{con}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {suggestions && suggestions.length === 0 && (
          <Alert className="bg-yellow-50 border-yellow-200">
            <AlertDescription className="text-yellow-800">
              No optimal bin locations found. Consider adjusting capacity or creating new bins.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}