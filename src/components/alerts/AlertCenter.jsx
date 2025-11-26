import React, { useState } from "react";
import { recims } from "@/api/recimsClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Bell, 
  AlertTriangle, 
  AlertCircle, 
  Info,
  X,
  Check,
  Package,
  DollarSign,
  Calendar,
  RefreshCw
} from "lucide-react";
import { format } from "date-fns";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export default function AlertCenter({ user }) {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('unread');

  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ['inventoryAlerts', user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      return await recims.entities.InventoryAlert.filter(
        { user_email: user.email },
        '-created_date',
        100
      );
    },
    enabled: !!user?.email,
    initialData: [],
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (alertId) => {
      return await recims.entities.InventoryAlert.update(alertId, {
        is_read: true
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventoryAlerts'] });
    },
  });

  const dismissAlertMutation = useMutation({
    mutationFn: async (alertId) => {
      return await recims.entities.InventoryAlert.update(alertId, {
        is_dismissed: true,
        is_read: true
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventoryAlerts'] });
    },
  });

  const filteredAlerts = alerts.filter(alert => {
    if (alert.is_dismissed) return false;
    if (filter === 'unread') return !alert.is_read;
    if (filter === 'all') return true;
    return alert.alert_type === filter;
  });

  const unreadCount = alerts.filter(a => !a.is_read && !a.is_dismissed).length;

  const getSeverityColor = (severity) => {
    switch(severity) {
      case 'critical': return 'bg-red-100 text-red-700 border-red-300';
      case 'warning': return 'bg-orange-100 text-orange-700 border-orange-300';
      case 'info': return 'bg-blue-100 text-blue-700 border-blue-300';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getAlertIcon = (alertType) => {
    switch(alertType) {
      case 'low_stock':
      case 'out_of_stock':
        return <Package className="w-5 h-5" />;
      case 'high_value':
        return <DollarSign className="w-5 h-5" />;
      case 'expiration':
        return <Calendar className="w-5 h-5" />;
      case 'reprocessing':
        return <RefreshCw className="w-5 h-5" />;
      case 'quarantine':
        return <AlertTriangle className="w-5 h-5" />;
      default:
        return <Info className="w-5 h-5" />;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Inventory Alerts
            {unreadCount > 0 && (
              <Badge className="bg-red-600 text-white">
                {unreadCount}
              </Badge>
            )}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={filter} onValueChange={setFilter} className="mb-4">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="unread">
              Unread {unreadCount > 0 && `(${unreadCount})`}
            </TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="low_stock">Low Stock</TabsTrigger>
            <TabsTrigger value="expiration">Expiring</TabsTrigger>
          </TabsList>
        </Tabs>

        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
          </div>
        ) : filteredAlerts.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Bell className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No alerts to display</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {filteredAlerts.map((alert) => (
              <div
                key={alert.id}
                className={`p-4 border rounded-lg transition-all ${
                  alert.is_read ? 'bg-gray-50' : 'bg-white border-2'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${getSeverityColor(alert.severity)}`}>
                    {getAlertIcon(alert.alert_type)}
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-1">
                      <div>
                        <h4 className="font-semibold text-gray-900">{alert.title}</h4>
                        {!alert.is_read && (
                          <Badge className="bg-blue-600 text-white text-xs mt-1">NEW</Badge>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {!alert.is_read && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => markAsReadMutation.mutate(alert.id)}
                            className="h-6 w-6"
                          >
                            <Check className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => dismissAlertMutation.mutate(alert.id)}
                          className="h-6 w-6"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    <p className="text-sm text-gray-600 mb-2">{alert.message}</p>

                    <div className="flex flex-wrap gap-2 text-xs">
                      <Badge variant="outline" className={getSeverityColor(alert.severity)}>
                        {alert.severity}
                      </Badge>
                      {alert.category && (
                        <Badge variant="outline">{alert.category}</Badge>
                      )}
                      {alert.item_name && (
                        <Badge variant="outline">{alert.item_name}</Badge>
                      )}
                      {alert.current_quantity !== undefined && (
                        <Badge variant="outline">
                          Qty: {alert.current_quantity} kg
                        </Badge>
                      )}
                      {alert.days_until_expiration !== undefined && (
                        <Badge variant="outline">
                          {alert.days_until_expiration} days left
                        </Badge>
                      )}
                    </div>

                    <p className="text-xs text-gray-500 mt-2">
                      {format(new Date(alert.created_date), 'MMM dd, yyyy h:mm a')}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}