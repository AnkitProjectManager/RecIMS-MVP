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
import { ArrowLeft, ArrowRight, Save, Package, AlertCircle, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function StockTransfer() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { tenantConfig, user } = useTenant();
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  const [formData, setFormData] = useState({
    inventory_id: '',
    from_bin: '',
    from_zone: '',
    to_bin: '',
    to_zone: '',
    quantity_to_transfer: '',
    transfer_reason: 'relocation',
    notes: ''
  });



  const { data: settings = [] } = useQuery({
    queryKey: ['appSettings'],
    queryFn: () => recims.entities.AppSettings.list(),
    initialData: [],
  });

  const stockTransferEnabled = settings.find(s => s.setting_key === 'enable_stock_transfer')?.setting_value === 'true';

  const { data: inventory = [] } = useQuery({
    queryKey: ['inventory', user?.tenant_id],
    queryFn: async () => {
      if (!user?.tenant_id) return [];
      return await recims.entities.Inventory.filter({
        tenant_id: user.tenant_id,
        status: 'available'
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

  const { data: zones = [] } = useQuery({
    queryKey: ['zones', user?.tenant_id],
    queryFn: async () => {
      if (!user?.tenant_id) return [];
      return await recims.entities.Zone.filter({ 
        tenant_id: user.tenant_id,
        status: 'active'
      });
    },
    enabled: !!user?.tenant_id,
    initialData: [],
  });

  const selectedInventory = inventory.find(i => i.id === formData.inventory_id);

  const transferStockMutation = useMutation({
    mutationFn: async (data) => {
      const transferQty = parseFloat(data.quantity_to_transfer);
      const item = inventory.find(i => i.id === data.inventory_id);
      
      if (transferQty > item.available_quantity) {
        throw new Error(`Cannot transfer ${transferQty} ${item.unit_of_measure}. Only ${item.available_quantity} ${item.unit_of_measure} available.`);
      }

      // Update source bin (remove weight/volume)
      if (data.from_bin) {
        const fromBin = bins.find(b => b.bin_code === data.from_bin);
        if (fromBin) {
          const weightKg = item.unit_of_measure === 'kg' ? transferQty : transferQty * 0.453592;
          const weightLbs = item.unit_of_measure === 'lbs' ? transferQty : transferQty * 2.20462;
          
          const updateData = {
            current_weight_kg: Math.max(0, (fromBin.current_weight_kg || 0) - weightKg),
            current_weight_lbs: Math.max(0, (fromBin.current_weight_lbs || 0) - weightLbs),
            last_updated: new Date().toISOString()
          };

          // Update volume if tracked
          if (fromBin.track_volume && item.quantity_volume) {
            const volumeRatio = transferQty / item.quantity_on_hand;
            const volumeFeet = (item.quantity_volume || 0) * volumeRatio;
            
            updateData.current_volume_cubic_feet = Math.max(0, (fromBin.current_volume_cubic_feet || 0) - volumeFeet);
            updateData.current_volume_cubic_yards = Math.max(0, (fromBin.current_volume_cubic_yards || 0) - (volumeFeet / 27));
            updateData.current_volume_cubic_meters = Math.max(0, (fromBin.current_volume_cubic_meters || 0) - (volumeFeet / 35.3147));
          }

          // Update status if empty
          if (updateData.current_weight_kg === 0) {
            updateData.status = 'empty';
            updateData.material_type = 'Empty';
          }

          await recims.entities.Bin.update(fromBin.id, updateData);
        }
      }

      // Update destination bin (add weight/volume)
      if (data.to_bin) {
        const toBin = bins.find(b => b.bin_code === data.to_bin);
        if (toBin) {
          const weightKg = item.unit_of_measure === 'kg' ? transferQty : transferQty * 0.453592;
          const weightLbs = item.unit_of_measure === 'lbs' ? transferQty : transferQty * 2.20462;
          
          const updateData = {
            current_weight_kg: (toBin.current_weight_kg || 0) + weightKg,
            current_weight_lbs: (toBin.current_weight_lbs || 0) + weightLbs,
            material_type: item.product_type || item.category,
            last_updated: new Date().toISOString()
          };

          // Update volume if tracked
          if (toBin.track_volume && item.quantity_volume) {
            const volumeRatio = transferQty / item.quantity_on_hand;
            const volumeFeet = (item.quantity_volume || 0) * volumeRatio;
            
            updateData.current_volume_cubic_feet = (toBin.current_volume_cubic_feet || 0) + volumeFeet;
            updateData.current_volume_cubic_yards = (toBin.current_volume_cubic_yards || 0) + (volumeFeet / 27);
            updateData.current_volume_cubic_meters = (toBin.current_volume_cubic_meters || 0) + (volumeFeet / 35.3147);
          }

          // Update status
          if (toBin.status === 'empty') {
            updateData.status = 'available';
          }

          await recims.entities.Bin.update(toBin.id, updateData);
        }
      }

      // Create audit trail entry
      await recims.entities.AuditTrail.create({
        audit_id: `AUD-${Date.now()}`,
        tenant_id: user.tenant_id,
        entity_type: 'inventory',
        entity_id: item.id,
        action: 'allocation',
        field_changed: 'bin_location',
        old_value: `${data.from_zone}/${data.from_bin}`,
        new_value: `${data.to_zone}/${data.to_bin}`,
        changed_by: user.email,
        changed_by_name: user.full_name,
        change_reason: data.transfer_reason,
        change_notes: `Transferred ${transferQty} ${item.unit_of_measure} - ${data.notes}`,
        timestamp: new Date().toISOString()
      });

      // Update inventory record
      return await recims.entities.Inventory.update(item.id, {
        bin_location: data.to_bin,
        zone: data.to_zone,
        last_updated: new Date().toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['bins'] });
      setSuccess("Stock transferred successfully!");
      setTimeout(() => {
        navigate(createPageUrl("InventoryManagement"));
      }, 1500);
    },
    onError: (err) => {
      setError(err.message || "Failed to transfer stock");
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

    if (!formData.to_bin || !formData.to_zone) {
      setError("Destination bin and zone are required");
      return;
    }

    if (!formData.quantity_to_transfer || parseFloat(formData.quantity_to_transfer) <= 0) {
      setError("Valid transfer quantity is required");
      return;
    }

    transferStockMutation.mutate(formData);
  };

  const handleInventorySelect = (inventoryId) => {
    const item = inventory.find(i => i.id === inventoryId);
    if (item) {
      setFormData(prev => ({
        ...prev,
        inventory_id: inventoryId,
        from_bin: item.bin_location || '',
        from_zone: item.zone || '',
        to_bin: '',
        to_zone: ''
      }));
    }
  };

  // Check if feature is enabled
  if (!stockTransferEnabled) {
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
          <h1 className="text-2xl font-bold text-gray-900">Stock Transfer</h1>
        </div>

        <Alert className="mb-6 bg-yellow-50 border-yellow-200">
          <AlertCircle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-800">
            <strong>Feature Not Enabled</strong>
            <p className="mt-2">Stock Transfer is a PHASE IV feature that is currently disabled.</p>
            <p className="mt-2">To enable this feature, please go to <strong>Super Admin → Features</strong> and toggle <strong>Stock Transfer</strong> ON.</p>
          </AlertDescription>
        </Alert>

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => navigate(createPageUrl("InventoryManagement"))}
            className="flex-1"
          >
            Back to Inventory
          </Button>
          <Button
            onClick={() => navigate(createPageUrl("SuperAdmin"))} // Assuming "SuperAdmin" is the route for Super Admin page
            className="flex-1 bg-purple-600 hover:bg-purple-700"
          >
            Go to Super Admin
          </Button>
        </div>
      </div>
    );
  }

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
          <h1 className="text-2xl font-bold text-gray-900">Stock Transfer</h1>
          <p className="text-sm text-gray-600">Move inventory between bins and zones</p>
        </div>
        <Badge className="bg-purple-600 text-white">PHASE IV</Badge>
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
                onValueChange={handleInventorySelect}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select inventory item" />
                </SelectTrigger>
                <SelectContent>
                  {inventory.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.item_name} - {item.available_quantity} {item.unit_of_measure} @ {item.zone}/{item.bin_location}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedInventory && (
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <p className="font-semibold text-blue-900 mb-2">{selectedInventory.item_name}</p>
                <div className="grid md:grid-cols-3 gap-2 text-sm text-gray-700">
                  <div>
                    <span className="font-semibold">Available:</span> {selectedInventory.available_quantity} {selectedInventory.unit_of_measure}
                  </div>
                  <div>
                    <span className="font-semibold">Location:</span> {selectedInventory.zone}/{selectedInventory.bin_location}
                  </div>
                  <div>
                    <span className="font-semibold">Quality:</span> Grade {selectedInventory.quality_grade}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Transfer Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Source Location */}
              <div className="p-4 bg-gray-50 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  From (Current Location)
                </h3>
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs text-gray-600">Zone</Label>
                    <Input
                      value={formData.from_zone}
                      readOnly
                      className="bg-white mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-600">Bin</Label>
                    <Input
                      value={formData.from_bin}
                      readOnly
                      className="bg-white mt-1"
                    />
                  </div>
                </div>
              </div>

              {/* Destination Location */}
              <div className="p-4 bg-green-50 rounded-lg">
                <h3 className="font-semibold text-green-900 mb-3 flex items-center gap-2">
                  <ArrowRight className="w-4 h-4" />
                  To (New Location) *
                </h3>
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs text-gray-600">Zone *</Label>
                    <Select
                      value={formData.to_zone}
                      onValueChange={(value) => {
                        setFormData(prev => ({ ...prev, to_zone: value, to_bin: '' }));
                      }}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select zone" />
                      </SelectTrigger>
                      <SelectContent>
                        {zones.map((zone) => (
                          <SelectItem key={zone.id} value={zone.zone_code}>
                            {zone.zone_code} - {zone.zone_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-600">Bin *</Label>
                    <Select
                      value={formData.to_bin}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, to_bin: value }))}
                      disabled={!formData.to_zone}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder={formData.to_zone ? "Select bin" : "Select zone first"} />
                      </SelectTrigger>
                      <SelectContent>
                        {bins
                          .filter(b => b.zone === formData.to_zone && (b.status === 'available' || b.status === 'empty'))
                          .map((bin) => (
                            <SelectItem key={bin.id} value={bin.bin_code}>
                              {bin.bin_code} {bin.bin_description && `- ${bin.bin_description}`}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="quantity">
                  Quantity to Transfer * 
                  {selectedInventory && ` (Max: ${selectedInventory.available_quantity} ${selectedInventory.unit_of_measure})`}
                </Label>
                <Input
                  id="quantity"
                  type="number"
                  step="0.01"
                  value={formData.quantity_to_transfer}
                  onChange={(e) => setFormData(prev => ({ ...prev, quantity_to_transfer: e.target.value }))}
                  placeholder="0.00"
                  max={selectedInventory?.available_quantity}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="reason">Transfer Reason</Label>
                <Select
                  value={formData.transfer_reason}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, transfer_reason: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="relocation">Relocation</SelectItem>
                    <SelectItem value="consolidation">Consolidation</SelectItem>
                    <SelectItem value="optimization">Space Optimization</SelectItem>
                    <SelectItem value="maintenance">Bin Maintenance</SelectItem>
                    <SelectItem value="reorganization">Reorganization</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Additional notes about this transfer..."
                rows={3}
              />
            </div>
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
            disabled={transferStockMutation.isPending}
            className="flex-1 bg-green-600 hover:bg-green-700 gap-2"
          >
            <Save className="w-4 h-4" />
            {transferStockMutation.isPending ? 'Transferring...' : 'Transfer Stock'}
          </Button>
        </div>
      </form>
    </div>
  );
}