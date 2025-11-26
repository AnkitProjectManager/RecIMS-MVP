import React, { useState } from "react";
import { recims } from "@/api/recimsClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTenant } from "@/components/TenantContext";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  ArrowLeft,
  Save,
  Truck,
  Package,
  AlertCircle,
  CheckCircle2
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";

export default function CreateWaybill() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const soId = searchParams.get('so_id');
  const { tenantConfig, user } = useTenant();
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const [formData, setFormData] = useState({
    dispatch_date: format(new Date(), 'yyyy-MM-dd'),
    carrier_id: '',
    vehicle_number: '',
    driver_name: '',
    incoterms: 'FOB',
    origin_country: 'US',
    special_instructions: '',
    tracking_number: '',
    bol_number: ''
  });

  React.useEffect(() => {
    if (tenantConfig) {
      setFormData(prev => ({
        ...prev,
        origin_country: tenantConfig.country || 'US'
      }));
    }
  }, [tenantConfig]);

  const { data: salesOrder } = useQuery({
    queryKey: ['salesOrder', soId],
    queryFn: async () => {
      if (!soId) return null;
      const orders = await recims.entities.SalesOrder.filter({ id: soId });
      return orders[0] || null;
    },
    enabled: !!soId,
  });

  const { data: salesOrderItems = [] } = useQuery({
    queryKey: ['salesOrderItems', soId],
    queryFn: async () => {
      if (!soId) return [];
      return await recims.entities.SalesOrderLine.filter({ so_id: soId }, 'line_number');
    },
    enabled: !!soId,
    initialData: [],
  });

  const { data: customer } = useQuery({
    queryKey: ['customer', salesOrder?.customer_id],
    queryFn: async () => {
      if (!salesOrder?.customer_id) return null;
      const customers = await recims.entities.Customer.filter({ id: salesOrder.customer_id });
      return customers[0] || null;
    },
    enabled: !!salesOrder?.customer_id,
  });

  const { data: carriers = [] } = useQuery({
    queryKey: ['carriers'],
    queryFn: () => recims.entities.Carrier.filter({ status: 'active' }),
    initialData: [],
  });

  const { data: tenantContacts = [] } = useQuery({
    queryKey: ['tenantContacts', user?.tenant_id],
    queryFn: async () => {
      if (!user?.tenant_id) return [];
      return await recims.entities.TenantContact.filter({ 
        tenant_id: user.tenant_id,
        is_active: true
      });
    },
    enabled: !!user?.tenant_id,
    initialData: [],
  });

  const createWaybillMutation = useMutation({
    mutationFn: async (data) => {
      // Calculate totals
      let totalWeightKg = 0;
      let totalWeightLbs = 0;
      let totalVolumeFeet = 0;
      let totalVolumeYards = 0;
      let totalVolumeMeters = 0;

      salesOrderItems.forEach(item => {
        // Calculate weights from quantity and UOM
        const qty = item.quantity_ordered || 0;
        if (item.uom === 'kg') {
          totalWeightKg += qty;
          totalWeightLbs += qty * 2.20462;
        } else if (item.uom === 'lbs') {
          totalWeightLbs += qty;
          totalWeightKg += qty / 2.20462;
        } else if (item.uom === 'tonnes') {
          totalWeightKg += qty * 1000;
          totalWeightLbs += qty * 2204.62;
        } else if (item.uom === 'tons') {
          totalWeightLbs += qty * 2000;
          totalWeightKg += qty * 907.185;
        }
        
        totalVolumeFeet += item.cubic_feet || 0;
      });

      // Convert volumes
      totalVolumeYards = totalVolumeFeet / 27;
      totalVolumeMeters = totalVolumeFeet * 0.0283168;

      // Get primary contact for signature
      const primaryContact = tenantContacts.find(c => c.contact_type === 'primary') || tenantContacts[0];

      // Create shipping address
      const shippingAddress = customer ? 
        `${customer.ship_line1 || ''}${customer.ship_line2 ? '\n' + customer.ship_line2 : ''}${customer.ship_line3 ? '\n' + customer.ship_line3 : ''}\n${customer.ship_city || ''}, ${customer.ship_region || ''} ${customer.ship_postal_code || ''}\n${customer.ship_country_code || ''}` 
        : '';

      const waybillNumber = `WB-${tenantConfig?.tenant_code || 'T'}-${Date.now()}`;
      const selectedCarrier = carriers.find(c => c.id === data.carrier_id);

      // Create waybill
      const waybill = await recims.entities.Waybill.create({
        waybill_number: waybillNumber,
        tenant_id: user.tenant_id,
        so_id: salesOrder.id,
        so_number: salesOrder.so_number,
        customer_id: salesOrder.customer_id,
        customer_name: salesOrder.customer_name,
        customer_address: shippingAddress,
        customer_country: customer?.ship_country_code || customer?.country || 'US',
        dispatch_date: data.dispatch_date,
        carrier_id: data.carrier_id,
        carrier_name: selectedCarrier?.company_name || '',
        vehicle_number: data.vehicle_number || null,
        driver_name: data.driver_name || null,
        incoterms: data.incoterms,
        total_gross_weight_kg: totalWeightKg,
        total_gross_weight_lbs: totalWeightLbs,
        total_net_weight_kg: totalWeightKg,
        total_net_weight_lbs: totalWeightLbs,
        total_volume_cubic_feet: totalVolumeFeet,
        total_volume_cubic_yards: totalVolumeYards,
        total_volume_cubic_meters: totalVolumeMeters,
        total_packages: salesOrderItems.length,
        origin_country: data.origin_country,
        special_instructions: data.special_instructions || null,
        tracking_number: data.tracking_number || null,
        bol_number: data.bol_number || waybillNumber,
        authorized_by: primaryContact?.contact_name || user.full_name,
        authorized_title: primaryContact?.job_title || 'Authorized Officer',
        signature_url: primaryContact?.signature_url || null,
        signature_date: new Date().toISOString(),
        status: 'draft',
        created_by: user.email
      });

      // Create waybill items
      const waybillItemPromises = salesOrderItems.map((item, index) => {
        const qty = item.quantity_ordered || 0;
        let weightKg = 0;
        let weightLbs = 0;
        
        if (item.uom === 'kg') {
          weightKg = qty;
          weightLbs = qty * 2.20462;
        } else if (item.uom === 'lbs') {
          weightLbs = qty;
          weightKg = qty / 2.20462;
        } else if (item.uom === 'tonnes') {
          weightKg = qty * 1000;
          weightLbs = qty * 2204.62;
        } else if (item.uom === 'tons') {
          weightLbs = qty * 2000;
          weightKg = qty * 907.185;
        }

        const volumeFeet = item.cubic_feet || 0;
        const volumeMeters = volumeFeet * 0.0283168;
        const volumeYards = volumeFeet / 27;
        
        return recims.entities.WaybillItem.create({
          waybill_id: waybill.id,
          waybill_number: waybillNumber,
          tenant_id: user.tenant_id,
          line_number: item.line_number || ((index + 1) * 10),
          so_line_id: item.id,
          sku_number: item.sku_snapshot || '',
          item_description: item.description_snapshot || '',
          hts_code: item.hts_code || '',
          category: item.category || '',
          quantity: qty,
          unit_of_measure: item.uom,
          weight_kg: weightKg,
          weight_lbs: weightLbs,
          volume_cubic_feet: volumeFeet,
          volume_cubic_yards: volumeYards,
          volume_cubic_meters: volumeMeters,
          unit_price: item.unit_price || 0,
          line_total: item.line_subtotal || 0,
          origin_country: data.origin_country
        });
      });

      await Promise.all(waybillItemPromises);

      // Update sales order with waybill info
      await recims.entities.SalesOrder.update(salesOrder.id, {
        waybill_created_at: new Date().toISOString(),
        waybill_number: waybillNumber
      });

      return waybill;
    },
    onSuccess: (waybill) => {
      queryClient.invalidateQueries({ queryKey: ['salesOrders'] });
      queryClient.invalidateQueries({ queryKey: ['waybills'] });
      setSuccess("Waybill created successfully!");
      setTimeout(() => {
        navigate(createPageUrl(`ViewWaybill?id=${waybill.id}`));
      }, 1500);
    },
    onError: (err) => {
      setError(err.message || "Failed to create waybill");
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setError(null);

    if (!formData.dispatch_date) {
      setError("Dispatch date is required");
      return;
    }

    if (!formData.carrier_id) {
      setError("Carrier is required");
      return;
    }

    createWaybillMutation.mutate(formData);
  };

  if (!soId || !salesOrder) {
    return (
      <div className="p-4 md:p-8 max-w-4xl mx-auto">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Invalid sales order reference. Please select a sales order first.
          </AlertDescription>
        </Alert>
        <Button onClick={() => navigate(createPageUrl("SalesOrderManagement"))} className="mt-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Sales Orders
        </Button>
      </div>
    );
  }

  if (salesOrder.status !== 'RELEASED') {
    return (
      <div className="p-4 md:p-8 max-w-4xl mx-auto">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Waybill can only be created for RELEASED sales orders. Current status: {salesOrder.status}
          </AlertDescription>
        </Alert>
        <Button onClick={() => navigate(createPageUrl(`ViewSalesOrder?id=${soId}`))} className="mt-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Sales Order
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Button
          variant="outline"
          size="icon"
          onClick={() => navigate(createPageUrl(`ViewSalesOrder?id=${soId}`))}
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Truck className="w-7 h-7 text-blue-600" />
            Create Waybill / Bill of Lading
          </h1>
          <p className="text-sm text-gray-600">Generate shipping manifest and customs documentation</p>
        </div>
        <Badge className="bg-blue-600 text-white">PHASE VI</Badge>
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

      {/* Sales Order Summary */}
      <Card className="mb-6 border-2 border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle>Sales Order Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-600">Order Number:</p>
              <p className="font-semibold text-blue-900">{salesOrder.so_number}</p>
            </div>
            <div>
              <p className="text-gray-600">Customer:</p>
              <p className="font-semibold text-blue-900">{salesOrder.customer_name}</p>
            </div>
            <div>
              <p className="text-gray-600">Order Date:</p>
              <p className="font-semibold text-blue-900">
                {salesOrder.order_date ? format(new Date(salesOrder.order_date), 'MMM dd, yyyy') : format(new Date(salesOrder.created_date), 'MMM dd, yyyy')}
              </p>
            </div>
            <div>
              <p className="text-gray-600">Total Items:</p>
              <p className="font-semibold text-blue-900">{salesOrderItems.length} line items</p>
            </div>
            <div>
              <p className="text-gray-600">Ship Method:</p>
              <p className="font-semibold text-blue-900">{salesOrder.ship_method}</p>
            </div>
            <div>
              <p className="text-gray-600">Destination:</p>
              <p className="font-semibold text-blue-900">
                {customer?.ship_city}, {customer?.ship_region} {customer?.ship_country_code}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <form onSubmit={handleSubmit}>
        {/* Shipping Details */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="w-5 h-5" />
              Shipping Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dispatch_date">Dispatch Date *</Label>
                <Input
                  id="dispatch_date"
                  type="date"
                  value={formData.dispatch_date}
                  onChange={(e) => setFormData({ ...formData, dispatch_date: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="carrier">Carrier *</Label>
                <Select
                  value={formData.carrier_id}
                  onValueChange={(value) => setFormData({ ...formData, carrier_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select carrier" />
                  </SelectTrigger>
                  <SelectContent>
                    {carriers.map((carrier) => (
                      <SelectItem key={carrier.id} value={carrier.id}>
                        {carrier.company_name} ({carrier.carrier_code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="vehicle">Vehicle/Container Number</Label>
                <Input
                  id="vehicle"
                  value={formData.vehicle_number}
                  onChange={(e) => setFormData({ ...formData, vehicle_number: e.target.value })}
                  placeholder="e.g., TRK-12345"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="driver">Driver Name</Label>
                <Input
                  id="driver"
                  value={formData.driver_name}
                  onChange={(e) => setFormData({ ...formData, driver_name: e.target.value })}
                  placeholder="Driver name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tracking">Tracking Number (Optional)</Label>
                <Input
                  id="tracking"
                  value={formData.tracking_number}
                  onChange={(e) => setFormData({ ...formData, tracking_number: e.target.value })}
                  placeholder="Carrier tracking number"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bol">BOL Number (Optional)</Label>
                <Input
                  id="bol"
                  value={formData.bol_number}
                  onChange={(e) => setFormData({ ...formData, bol_number: e.target.value })}
                  placeholder="Leave blank to auto-generate"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="incoterms">Incoterms *</Label>
                <Select
                  value={formData.incoterms}
                  onValueChange={(value) => setFormData({ ...formData, incoterms: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EXW">EXW - Ex Works</SelectItem>
                    <SelectItem value="FCA">FCA - Free Carrier</SelectItem>
                    <SelectItem value="CPT">CPT - Carriage Paid To</SelectItem>
                    <SelectItem value="CIP">CIP - Carriage & Insurance Paid</SelectItem>
                    <SelectItem value="DAP">DAP - Delivered at Place</SelectItem>
                    <SelectItem value="DPU">DPU - Delivered at Place Unloaded</SelectItem>
                    <SelectItem value="DDP">DDP - Delivered Duty Paid</SelectItem>
                    <SelectItem value="FAS">FAS - Free Alongside Ship</SelectItem>
                    <SelectItem value="FOB">FOB - Free on Board</SelectItem>
                    <SelectItem value="CFR">CFR - Cost and Freight</SelectItem>
                    <SelectItem value="CIF">CIF - Cost, Insurance & Freight</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="origin">Origin Country *</Label>
                <Select
                  value={formData.origin_country}
                  onValueChange={(value) => setFormData({ ...formData, origin_country: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="US">United States</SelectItem>
                    <SelectItem value="CA">Canada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="instructions">Special Handling Instructions</Label>
              <Textarea
                id="instructions"
                value={formData.special_instructions}
                onChange={(e) => setFormData({ ...formData, special_instructions: e.target.value })}
                placeholder="Special handling instructions, hazmat information, temperature requirements, etc..."
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Line Items Preview */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              Shipment Items ({salesOrderItems.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-gray-50">
                  <tr>
                    <th className="text-left py-2 px-3">Line</th>
                    <th className="text-left py-2 px-3">SKU</th>
                    <th className="text-left py-2 px-3">Description</th>
                    <th className="text-left py-2 px-3">HTS</th>
                    <th className="text-right py-2 px-3">Quantity</th>
                    <th className="text-right py-2 px-3">Weight</th>
                    <th className="text-right py-2 px-3">Volume</th>
                  </tr>
                </thead>
                <tbody>
                  {salesOrderItems.map((item) => {
                    const qty = item.quantity_ordered || 0;
                    let weightDisplay = '-';
                    if (item.uom === 'kg') weightDisplay = `${qty.toFixed(2)} kg`;
                    else if (item.uom === 'lbs') weightDisplay = `${qty.toFixed(2)} lbs`;
                    else if (item.uom === 'tonnes') weightDisplay = `${qty.toFixed(3)} tonnes`;
                    else if (item.uom === 'tons') weightDisplay = `${qty.toFixed(3)} tons`;
                    
                    return (
                      <tr key={item.id} className="border-b hover:bg-gray-50">
                        <td className="py-2 px-3">{item.line_number}</td>
                        <td className="py-2 px-3 font-mono text-xs">{item.sku_snapshot || 'N/A'}</td>
                        <td className="py-2 px-3">{item.description_snapshot}</td>
                        <td className="py-2 px-3 font-mono text-xs">{item.hts_code || 'TBD'}</td>
                        <td className="py-2 px-3 text-right font-semibold">
                          {qty} {item.uom}
                        </td>
                        <td className="py-2 px-3 text-right">{weightDisplay}</td>
                        <td className="py-2 px-3 text-right">
                          {item.cubic_feet ? `${item.cubic_feet.toFixed(2)} ft³` : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(createPageUrl(`ViewSalesOrder?id=${soId}`))}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={createWaybillMutation.isPending}
            className="flex-1 bg-blue-600 hover:bg-blue-700 gap-2"
          >
            <Save className="w-4 h-4" />
            {createWaybillMutation.isPending ? 'Creating...' : 'Create Waybill'}
          </Button>
        </div>
      </form>
    </div>
  );
}