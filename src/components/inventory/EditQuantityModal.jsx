import React, { useState } from "react";
import { recims } from "@/api/recimsClient";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Save, AlertTriangle, TrendingUp, TrendingDown } from "lucide-react";

export default function EditQuantityModal({ item, isOpen, onClose, user, useMetric }) {
  const queryClient = useQueryClient();
  const [newQuantityKg, setNewQuantityKg] = useState(item?.quantity_kg || 0);
  const [newQuantityLbs, setNewQuantityLbs] = useState(item?.quantity_lbs || 0);
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState(null);

  React.useEffect(() => {
    if (item) {
      setNewQuantityKg(item.quantity_kg || 0);
      setNewQuantityLbs(item.quantity_lbs || 0);
    }
  }, [item]);

  const updateQuantityMutation = useMutation({
    mutationFn: async () => {
      const oldQuantityKg = item.quantity_kg || 0;
      const oldQuantityLbs = item.quantity_lbs || 0;
      
      // Update inventory
      await recims.entities.Inventory.update(item.id, {
        quantity_kg: parseFloat(newQuantityKg),
        quantity_lbs: parseFloat(newQuantityLbs),
        quantity_on_hand: parseFloat(useMetric ? newQuantityKg : newQuantityLbs),
        available_quantity: parseFloat(useMetric ? newQuantityKg : newQuantityLbs) - (item.reserved_quantity || 0),
        last_updated: new Date().toISOString()
      });

      // Create audit trail entry
      await recims.entities.AuditTrail.create({
        audit_id: `AUDIT-${Date.now()}`,
        tenant: user.tenant,
        entity_type: 'inventory',
        entity_id: item.id,
        action: 'quantity_adjustment',
        field_changed: useMetric ? 'quantity_kg' : 'quantity_lbs',
        old_value: useMetric ? oldQuantityKg.toString() : oldQuantityLbs.toString(),
        new_value: useMetric ? newQuantityKg.toString() : newQuantityLbs.toString(),
        changed_by: user.email,
        changed_by_name: user.full_name,
        change_reason: reason,
        change_notes: notes,
        timestamp: new Date().toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      setReason('');
      setNotes('');
      onClose();
    },
    onError: (err) => {
      setError(err.message || "Failed to update quantity");
    }
  });

  const handleQuantityChange = (field, value) => {
    if (field === 'kg') {
      setNewQuantityKg(value);
      setNewQuantityLbs((parseFloat(value) * 2.20462).toFixed(2));
    } else {
      setNewQuantityLbs(value);
      setNewQuantityKg((parseFloat(value) * 0.453592).toFixed(2));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError(null);

    if (!reason.trim()) {
      setError("Please provide a reason for this adjustment");
      return;
    }

    if (parseFloat(newQuantityKg) < 0 || parseFloat(newQuantityLbs) < 0) {
      setError("Quantity cannot be negative");
      return;
    }

    updateQuantityMutation.mutate();
  };

  if (!item) return null;

  const quantityDiff = useMetric 
    ? parseFloat(newQuantityKg) - (item.quantity_kg || 0)
    : parseFloat(newQuantityLbs) - (item.quantity_lbs || 0);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Adjust Inventory Quantity</DialogTitle>
          <DialogDescription>
            Update the on-hand quantity for {item.inventory_id || item.item_name}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            {/* Current Quantity Display */}
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="grid md:grid-cols-3 gap-4 mb-3">
                <div>
                  <p className="text-xs text-gray-600">SKU</p>
                  <p className="font-semibold">{item.sku_number || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">Category</p>
                  <p className="font-semibold">{item.category}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">Location</p>
                  <p className="font-semibold">{item.bin_location || 'N/A'}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 pt-3 border-t">
                <div>
                  <p className="text-xs text-gray-600">Current Quantity</p>
                  <p className="text-xl font-bold text-gray-900">
                    {useMetric 
                      ? `${(item.quantity_kg || 0).toFixed(2)} kg`
                      : `${(item.quantity_lbs || 0).toFixed(2)} lbs`
                    }
                  </p>
                </div>
                {item.reserved_quantity > 0 && (
                  <div>
                    <p className="text-xs text-gray-600">Reserved</p>
                    <p className="text-sm font-semibold text-blue-700">
                      {useMetric 
                        ? `${(item.reserved_quantity || 0).toFixed(2)} kg`
                        : `${((item.reserved_quantity || 0) * 2.20462).toFixed(2)} lbs`
                      }
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* New Quantity Input */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="quantity_kg">New Quantity (kg) *</Label>
                <Input
                  id="quantity_kg"
                  type="number"
                  step="0.01"
                  value={newQuantityKg}
                  onChange={(e) => handleQuantityChange('kg', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quantity_lbs">New Quantity (lbs) *</Label>
                <Input
                  id="quantity_lbs"
                  type="number"
                  step="0.01"
                  value={newQuantityLbs}
                  onChange={(e) => handleQuantityChange('lbs', e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Quantity Change Indicator */}
            {quantityDiff !== 0 && (
              <div className={`p-3 rounded-lg flex items-center gap-2 ${
                quantityDiff > 0 ? 'bg-green-50' : 'bg-red-50'
              }`}>
                {quantityDiff > 0 ? (
                  <TrendingUp className="w-5 h-5 text-green-600" />
                ) : (
                  <TrendingDown className="w-5 h-5 text-red-600" />
                )}
                <div>
                  <p className={`font-semibold ${
                    quantityDiff > 0 ? 'text-green-700' : 'text-red-700'
                  }`}>
                    {quantityDiff > 0 ? '+' : ''}{quantityDiff.toFixed(2)} {useMetric ? 'kg' : 'lbs'}
                  </p>
                  <p className="text-xs text-gray-600">
                    {quantityDiff > 0 ? 'Increase' : 'Decrease'}
                  </p>
                </div>
              </div>
            )}

            {/* Reason for Adjustment */}
            <div className="space-y-2">
              <Label htmlFor="reason">Reason for Adjustment *</Label>
              <Input
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g., Physical count adjustment, Received return, Damage, etc."
                required
              />
            </div>

            {/* Additional Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Additional Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional additional details..."
                rows={3}
              />
            </div>

            {/* Warning for Reserved Items */}
            {item.reserved_quantity > 0 && parseFloat(newQuantityKg) < item.reserved_quantity && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Warning: New quantity is less than reserved quantity ({item.reserved_quantity.toFixed(2)} kg). 
                  This may affect pending orders.
                </AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={updateQuantityMutation.isPending}
              className="bg-green-600 hover:bg-green-700 gap-2"
            >
              <Save className="w-4 h-4" />
              {updateQuantityMutation.isPending ? 'Saving...' : 'Save Adjustment'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}