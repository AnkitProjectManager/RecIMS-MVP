import React, { useState } from "react";
import { recims } from "@/api/recimsClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTenant } from "@/components/TenantContext";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  ArrowLeft,
  Package,
  CheckCircle2,
  Circle,
  ShoppingCart,
  MapPin
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import TenantHeader from "@/components/TenantHeader";

export default function MobilePicking() {
  const queryClient = useQueryClient();
  const { user } = useTenant();
  const [selectedSO, setSelectedSO] = useState(null);
  const [pickedItems, setPickedItems] = useState(new Set());

  const urlParams = new URLSearchParams(window.location.search);
  const soIdFromUrl = urlParams.get('so_id');

  const { data: releasedOrders = [] } = useQuery({
    queryKey: ['releasedSalesOrders', user?.tenant_id],
    queryFn: async () => {
      if (!user?.tenant_id) return [];
      return await recims.entities.SalesOrder.filter({ 
        tenant_id: user.tenant_id,
        status: 'RELEASED' 
      }, '-created_date');
    },
    enabled: !!user?.tenant_id,
    initialData: [],
  });

  const { data: orderLines = [] } = useQuery({
    queryKey: ['soLines', selectedSO?.id || soIdFromUrl],
    queryFn: async () => {
      const soId = selectedSO?.id || soIdFromUrl;
      if (!soId) return [];
      return await recims.entities.SalesOrderLine.filter({ so_id: soId }, 'line_number');
    },
    enabled: !!(selectedSO || soIdFromUrl),
    initialData: [],
  });

  // Fetch SKU images for products - PHASE V
  const { data: skuImages = {} } = useQuery({
    queryKey: ['skuImages', selectedSO?.id],
    queryFn: async () => {
      if (!selectedSO || !orderLines.length) return {};
      
      const imageMap = {};
      // Use Promise.all to fetch all images concurrently for better performance
      const imagePromises = orderLines.map(async (line) => {
        const skus = await recims.entities.ProductSKU.filter({
          sku_number: line.sku_snapshot,
          status: 'active'
        });
        if (skus.length > 0 && skus[0].image_url) {
          imageMap[line.sku_snapshot] = skus[0].image_url;
        }
      });
      await Promise.all(imagePromises);
      return imageMap;
    },
    enabled: !!selectedSO && orderLines.length > 0,
    initialData: {},
  });

  React.useEffect(() => {
    if (soIdFromUrl && !selectedSO && releasedOrders.length > 0) {
      const order = releasedOrders.find(o => o.id === soIdFromUrl);
      if (order) setSelectedSO(order);
    }
  }, [soIdFromUrl, selectedSO, releasedOrders]);

  const togglePicked = (lineId) => {
    const newPicked = new Set(pickedItems);
    if (newPicked.has(lineId)) {
      newPicked.delete(lineId);
    } else {
      newPicked.add(lineId);
    }
    setPickedItems(newPicked);
  };

  const completePicking = useMutation({
    mutationFn: async () => {
      // In production, this would update inventory, create picking records, etc.
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['salesOrders'] });
      alert('Picking completed! Ready for packing.');
      setSelectedSO(null);
      setPickedItems(new Set());
    }
  });

  const allPicked = orderLines.length > 0 && pickedItems.size === orderLines.length;

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <TenantHeader />
      
      <div className="p-4">
        <div className="flex items-center gap-3 mb-4">
          <Link to={createPageUrl("MobileWarehouse")}>
            <Button variant="outline" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-900">Picking</h1>
            <p className="text-sm text-gray-600">Pick items for orders</p>
          </div>
        </div>

        {/* Select Order */}
        {!selectedSO && (
          <div className="space-y-3">
            <h2 className="font-semibold text-gray-900">Released Orders</h2>
            {releasedOrders.length === 0 ? (
              <Alert>
                <ShoppingCart className="h-4 w-4" />
                <AlertDescription>
                  No released orders available for picking
                </AlertDescription>
              </Alert>
            ) : (
              releasedOrders.map((order) => (
                <Card
                  key={order.id}
                  onClick={() => setSelectedSO(order)}
                  className="cursor-pointer hover:shadow-lg transition-shadow"
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-bold">{order.so_number}</p>
                        <p className="text-sm text-gray-600">{order.customer_name}</p>
                        <p className="text-xs text-gray-500">
                          Ship: {order.ship_date || 'Not set'}
                        </p>
                      </div>
                      <Badge className="bg-blue-100 text-blue-700">
                        {order.status}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}

        {/* Picking List */}
        {selectedSO && (
          <div className="space-y-4">
            {/* Order Header */}
            <Card className="border-2 border-blue-500">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-lg">{selectedSO.so_number}</h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedSO(null)}
                  >
                    Change
                  </Button>
                </div>
                <p className="text-sm text-gray-600">{selectedSO.customer_name}</p>
                <div className="mt-3 flex items-center gap-2">
                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-600 h-2 rounded-full transition-all"
                      style={{ width: `${(pickedItems.size / orderLines.length) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-semibold">
                    {pickedItems.size}/{orderLines.length}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Pick Lines */}
            <div className="space-y-2">
              {orderLines.map((line) => {
                const isPicked = pickedItems.has(line.id);
                const productImage = skuImages[line.sku_snapshot];
                
                return (
                  <Card
                    key={line.id}
                    className={`${isPicked ? 'bg-green-50 border-green-500' : ''}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <button
                          onClick={() => togglePicked(line.id)}
                          className="mt-1"
                        >
                          {isPicked ? (
                            <CheckCircle2 className="w-6 h-6 text-green-600" />
                          ) : (
                            <Circle className="w-6 h-6 text-gray-400" />
                          )}
                        </button>

                        {/* Product Thumbnail - PHASE V */}
                        {productImage && (
                          <div className="flex-shrink-0">
                            <div className="relative">
                              <img
                                src={productImage}
                                alt={line.sku_snapshot}
                                className="w-20 h-20 object-cover rounded border-2 border-gray-200"
                              />
                              <Badge className="absolute -top-1 -right-1 bg-purple-600 text-white text-xs px-1 py-0">
                                V
                              </Badge>
                            </div>
                          </div>
                        )}

                        <div className="flex-1">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <p className="font-semibold">{line.sku_snapshot}</p>
                              <p className="text-sm text-gray-600">
                                {line.description_snapshot}
                              </p>
                            </div>
                            <Badge variant="outline">
                              Line {line.line_number}
                            </Badge>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <p className="text-gray-600">Quantity</p>
                              <p className="font-bold text-blue-700">
                                {line.quantity_allocated} {line.uom}
                              </p>
                            </div>
                            <div>
                              <p className="text-gray-600">Category</p>
                              <p className="font-semibold">{line.category}</p>
                            </div>
                          </div>

                          {/* Could add bin location here if available */}
                          <div className="mt-2 flex items-center gap-1 text-xs text-gray-500">
                            <MapPin className="w-3 h-3" />
                            <span>Check bin location in inventory</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Complete Button */}
            {allPicked && (
              <Card className="border-2 border-green-500 bg-green-50">
                <CardContent className="p-4">
                  <div className="text-center mb-4">
                    <CheckCircle2 className="w-12 h-12 mx-auto mb-2 text-green-600" />
                    <p className="font-bold text-green-900">All Items Picked!</p>
                  </div>
                  <Button
                    onClick={() => completePicking.mutate()}
                    disabled={completePicking.isPending}
                    className="w-full bg-green-600 hover:bg-green-700"
                  >
                    {completePicking.isPending ? 'Processing...' : 'Complete Picking'}
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}