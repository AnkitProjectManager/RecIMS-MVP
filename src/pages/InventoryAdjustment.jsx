import React, { useState } from "react";
import { recims } from "@/api/recimsClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTenant } from "@/components/TenantContext";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Save, AlertTriangle, Package, CheckCircle2, AlertCircle, TrendingDown, TrendingUp } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function InventoryAdjustment() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { tenantConfig, user } = useTenant();
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // Determine weight unit based on tenant configuration
  const useMetric = tenantConfig?.weight_unit === 'kg' || tenantConfig?.weight_unit === 'metric';
  const weightUnit = useMetric ? 'kg' : 'lbs';
  
  const [formData, setFormData] = useState({
    inventory_id: '',
    adjustment_type: 'decrease',
    adjustment_quantity: '',
    adjustment_reason: 'damage',
    notes: '',
    cost_impact: ''
  });



  const { data: inventory = [] } = useQuery({
    queryKey: ['inventory', user?.tenant_id],
    queryFn: async () => {
      if (!user?.tenant_id) return [];
      return await recims.entities.Inventory.filter({
        tenant_id: user.tenant_id
      }, '-created_date', 100);
    },
    enabled: !!user?.tenant_id,
    initialData: [],
  });

  const { data: bins = [] } = useQuery({
    queryKey: ['bins', user?.tenant_id],
    queryFn: async () => {
      if (!user?.tenant_id) return [];
      return await recims.entities.Bin.filter({ tenant_id: user.tenant_id });
    },
    enabled: !!user?.tenant_id,
    initialData: [],
  });

  const selectedInventory = inventory.find(i => i.id === formData.inventory_id);

  const adjustInventoryMutation = useMutation({
    mutationFn: async (data) => {
      const adjustQty = parseFloat(data.adjustment_quantity);
      const item = inventory.find(i => i.id === data.inventory_id);
      
      let newQuantity = item.quantity_on_hand;
      
      if (data.adjustment_type === 'decrease') {
        if (adjustQty > item.quantity_on_hand) {
          throw new Error(`Cannot decrease by ${adjustQty} ${item.unit_of_measure}. Only ${item.quantity_on_hand} ${item.unit_of_measure} on hand.`);
        }
        newQuantity = item.quantity_on_hand - adjustQty;
      } else {
        newQuantity = item.quantity_on_hand + adjustQty;
      }

      const newAvailable = newQuantity - (item.reserved_quantity || 0);

      // Update bin capacity
      if (item.bin_location) {
        const bin = bins.find(b => b.bin_code === item.bin_location);
        if (bin) {
          const weightKg = item.unit_of_measure === 'kg' ? adjustQty : adjustQty * 0.453592;
          const weightLbs = item.unit_of_measure === 'lbs' ? adjustQty : adjustQty * 2.20462;
          
          const updateData = {
            current_weight_kg: data.adjustment_type === 'decrease' 
              ? Math.max(0, (bin.current_weight_kg || 0) - weightKg)
              : (bin.current_weight_kg || 0) + weightKg,
            current_weight_lbs: data.adjustment_type === 'decrease'
              ? Math.max(0, (bin.current_weight_lbs || 0) - weightLbs)
              : (bin.current_weight_lbs || 0) + weightLbs,
            last_updated: new Date().toISOString()
          };

          // Update volume if tracked
          if (bin.track_volume && item.quantity_volume) {
            const volumeRatio = adjustQty / item.quantity_on_hand;
            const volumeFeet = (item.quantity_volume || 0) * volumeRatio;
            
            if (data.adjustment_type === 'decrease') {
              updateData.current_volume_cubic_feet = Math.max(0, (bin.current_volume_cubic_feet || 0) - volumeFeet);
              updateData.current_volume_cubic_yards = Math.max(0, (bin.current_volume_cubic_yards || 0) - (volumeFeet / 27));
              updateData.current_volume_cubic_meters = Math.max(0, (bin.current_volume_cubic_meters || 0) - (volumeFeet / 35.3147));
            } else {
              updateData.current_volume_cubic_feet = (bin.current_volume_cubic_feet || 0) + volumeFeet;
              updateData.current_volume_cubic_yards = (bin.current_volume_cubic_yards || 0) + (volumeFeet / 27);
              updateData.current_volume_cubic_meters = (bin.current_volume_cubic_meters || 0) + (volumeFeet / 35.3147);
            }
          }

          // Update bin status
          if (updateData.current_weight_kg === 0) {
            updateData.status = 'empty';
            updateData.material_type = 'Empty';
          } else if (bin.status === 'empty') {
            updateData.status = 'available';
          }

          await recims.entities.Bin.update(bin.id, updateData);
        }
      }

      // Create audit trail entry
      await recims.entities.AuditTrail.create({
        audit_id: `AUD-${Date.now()}`,
        tenant_id: user.tenant_id,
        entity_type: 'inventory',
        entity_id: item.id,
        action: 'quantity_adjustment',
        field_changed: 'quantity_on_hand',
        old_value: item.quantity_on_hand.toString(),
        new_value: newQuantity.toString(),
        changed_by: user.email,
        changed_by_name: user.full_name,
        change_reason: data.adjustment_reason,
        change_notes: `${data.adjustment_type === 'decrease' ? 'Decreased' : 'Increased'} by ${adjustQty} ${item.unit_of_measure} - ${data.notes}`,
        timestamp: new Date().toISOString()
      });

      // Update inventory record
      const updateData = {
        quantity_on_hand: newQuantity,
        available_quantity: newAvailable,
        last_updated: new Date().toISOString()
      };

      // Update quantities based on unit type
      if (item.unit_of_measure === 'kg') {
        updateData.quantity_kg = newQuantity;
        updateData.quantity_lbs = newQuantity * 2.20462;
      } else if (item.unit_of_measure === 'lbs') {
        updateData.quantity_lbs = newQuantity;
        updateData.quantity_kg = newQuantity * 0.453592;
      }

      // Recalculate total cost and value
      if (item.cost_per_kg) {
        const qtyKg = updateData.quantity_kg || (item.unit_of_measure === 'kg' ? newQuantity : newQuantity * 0.453592);
        updateData.total_cost = qtyKg * item.cost_per_kg;
      }
      if (item.price_per_kg) {
        const qtyKg = updateData.quantity_kg || (item.unit_of_measure === 'kg' ? newQuantity : newQuantity * 0.453592);
        updateData.total_value = qtyKg * item.price_per_kg;
      }

      // Update status if out of stock
      if (newQuantity === 0) {
        updateData.status = 'out_of_stock';
      } else if (item.reorder_point && newQuantity <= item.reorder_point) {
        updateData.status = 'low_stock';
      } else if (item.status === 'out_of_stock' || item.status === 'low_stock') {
        updateData.status = 'available';
      }

      return await recims.entities.Inventory.update(item.id, updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['bins'] });
      setSuccess("Inventory adjusted successfully!");
      setTimeout(() => {
        navigate(createPageUrl("InventoryManagement"));
      }, 1500);
    },
    onError: (err) => {
      setError(err.message || "Failed to adjust inventory");
      setTimeout(() => setError(null), 5000);
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setError(null);

    if (!formData.inventory_id) {
      setError("Please select inventory item");
      return;
    }

    if (!formData.adjustment_quantity || parseFloat(formData.adjustment_quantity) <= 0) {
      setError("Valid adjustment quantity is required");
      return;
    }

    if (window.confirm(
      `Are you sure you want to ${formData.adjustment_type} inventory by ${formData.adjustment_quantity} ${selectedInventory?.unit_of_measure}?\n\nThis action will be recorded in the audit trail.`
    )) {
      adjustInventoryMutation.mutate(formData);
    }
  };

  // Calculate new quantity preview
  const calculateNewQuantity = () => {
    if (!selectedInventory || !formData.adjustment_quantity) return null;
    
    const adjustQty = parseFloat(formData.adjustment_quantity);
    const currentQty = useMetric ? (selectedInventory.quantity_kg || 0) : (selectedInventory.quantity_lbs || 0);
    
    if (formData.adjustment_type === 'decrease') {
      return Math.max(0, currentQty - adjustQty);
    } else {
      return currentQty + adjustQty;
    }
  };

  const newQuantity = calculateNewQuantity();

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Button
          variant="outline"
          size="icon"
          onClick={() => navigate(createPageUrl("InventoryManagement"))}
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Inventory Adjustment</h1>
          <p className="text-sm text-gray-600">Record inventory discrepancies, damages, or corrections</p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="mb-6 bg-green-50 border-green-200">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">{success}</AlertDescription>
        </Alert>
      )}

      <Alert className="mb-6 bg-yellow-50 border-yellow-200">
        <AlertTriangle className="h-4 w-4 text-yellow-600" />
        <AlertDescription className="text-yellow-800">
          <strong>Important:</strong> All adjustments are recorded in the audit trail for accountability and traceability.
        </AlertDescription>
      </Alert>

      <form onSubmit={handleSubmit}>
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              Select Inventory Item
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="inventory">Inventory Item *</Label>
              <Select
                value={formData.inventory_id}
                onValueChange={(value) => setFormData(prev => ({ ...prev, inventory_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select inventory item" />
                </SelectTrigger>
                <SelectContent>
                  {inventory.map((item) => {
                    const displayQty = useMetric ? (item.quantity_kg || 0) : (item.quantity_lbs || 0);
                    return (
                      <SelectItem key={item.id} value={item.id}>
                        {item.item_name} - {displayQty.toFixed(2)} {weightUnit} @ {item.zone}/{item.bin_location}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {selectedInventory && (
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <p className="font-semibold text-blue-900 mb-2">{selectedInventory.item_name}</p>
                <div className="grid md:grid-cols-4 gap-2 text-sm text-gray-700">
                  <div>
                    <span className="font-semibold">On Hand:</span> {(useMetric ? (selectedInventory.quantity_kg || 0) : (selectedInventory.quantity_lbs || 0)).toFixed(2)} {weightUnit}
                  </div>
                  <div>
                    <span className="font-semibold">Available:</span> {(useMetric 
                      ? ((selectedInventory.quantity_kg || 0) - (selectedInventory.reserved_quantity || 0))
                      : ((selectedInventory.quantity_lbs || 0) - (selectedInventory.reserved_quantity || 0))).toFixed(2)} {weightUnit}
                  </div>
                  <div>
                    <span className="font-semibold">Reserved:</span> {(selectedInventory.reserved_quantity || 0).toFixed(2)} {weightUnit}
                  </div>
                  <div>
                    <span className="font-semibold">Location:</span> {selectedInventory.zone}/{selectedInventory.bin_location}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Adjustment Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="type">Adjustment Type *</Label>
                <Select
                  value={formData.adjustment_type}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, adjustment_type: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="decrease">
                      <div className="flex items-center gap-2">
                        <TrendingDown className="w-4 h-4 text-red-600" />
                        Decrease (Remove/Damage)
                      </div>
                    </SelectItem>
                    <SelectItem value="increase">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-green-600" />
                        Increase (Found/Correction)
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="quantity">
                  Adjustment Quantity ({weightUnit}) * 
                  {selectedInventory && formData.adjustment_type === 'decrease' && 
                    ` (Max: ${(useMetric ? (selectedInventory.quantity_kg || 0) : (selectedInventory.quantity_lbs || 0)).toFixed(2)} ${weightUnit})`
                  }
                </Label>
                <Input
                  id="quantity"
                  type="number"
                  step="0.01"
                  value={formData.adjustment_quantity}
                  onChange={(e) => setFormData(prev => ({ ...prev, adjustment_quantity: e.target.value }))}
                  placeholder="0.00"
                  max={formData.adjustment_type === 'decrease' ? (useMetric ? selectedInventory?.quantity_kg : selectedInventory?.quantity_lbs) : undefined}
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="reason">Adjustment Reason *</Label>
                <Select
                  value={formData.adjustment_reason}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, adjustment_reason: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="damage">Damage/Defect</SelectItem>
                    <SelectItem value="theft">Theft/Loss</SelectItem>
                    <SelectItem value="shrinkage">Shrinkage</SelectItem>
                    <SelectItem value="spoilage">Spoilage/Expiry</SelectItem>
                    <SelectItem value="count_discrepancy">Physical Count Discrepancy</SelectItem>
                    <SelectItem value="found">Found/Discovered</SelectItem>
                    <SelectItem value="system_error">System Error Correction</SelectItem>
                    <SelectItem value="quality_issue">Quality Issue</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes * (Required for audit trail)</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Detailed explanation of the adjustment (required for compliance)..."
                rows={4}
                required
              />
            </div>

            {newQuantity !== null && selectedInventory && (
              <div className={`p-4 rounded-lg border-2 ${
                formData.adjustment_type === 'decrease' 
                  ? 'bg-red-50 border-red-200' 
                  : 'bg-green-50 border-green-200'
              }`}>
                <p className="font-semibold mb-2 flex items-center gap-2">
                  {formData.adjustment_type === 'decrease' ? (
                    <TrendingDown className="w-5 h-5 text-red-600" />
                  ) : (
                    <TrendingUp className="w-5 h-5 text-green-600" />
                  )}
                  Preview of Adjustment
                </p>
                <div className="grid md:grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-gray-600">Current Quantity:</p>
                    <p className="font-bold text-lg">{(useMetric ? (selectedInventory.quantity_kg || 0) : (selectedInventory.quantity_lbs || 0)).toFixed(2)} {weightUnit}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Adjustment:</p>
                    <p className={`font-bold text-lg ${
                      formData.adjustment_type === 'decrease' ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {formData.adjustment_type === 'decrease' ? '-' : '+'}{parseFloat(formData.adjustment_quantity || '0').toFixed(2)} {weightUnit}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">New Quantity:</p>
                    <p className="font-bold text-lg text-blue-600">{newQuantity.toFixed(2)} {weightUnit}</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(createPageUrl("InventoryManagement"))}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={adjustInventoryMutation.isPending || !formData.notes}
            className="flex-1 bg-orange-600 hover:bg-orange-700 gap-2"
          >
            <Save className="w-4 h-4" />
            {adjustInventoryMutation.isPending ? 'Adjusting...' : 'Submit Adjustment'}
          </Button>
        </div>
      </form>
    </div>
  );
}