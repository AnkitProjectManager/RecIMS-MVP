import React, { useState } from "react";
import { recims } from "@/api/recimsClient";
import { useQuery } from "@tanstack/react-query";
import { useTenant } from "@/components/TenantContext";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3,
  ArrowLeft,
  Download,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Package,
  AlertTriangle
} from "lucide-react";
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function AdvancedAnalytics() {
  const { tenantConfig, user } = useTenant();
  const [dateStart, setDateStart] = useState(startOfMonth(new Date()));
  const dateEnd = endOfMonth(new Date());
  
  const useMetric = tenantConfig?.measurement_system === 'metric';

  const { data: shipments = [] } = useQuery({
    queryKey: ['shipments', user?.tenant_id],
    queryFn: async () => {
      if (!user?.tenant_id) return [];
      return await recims.entities.InboundShipment.filter({ tenant_id: user.tenant_id }, '-created_date', 500);
    },
    enabled: !!user?.tenant_id,
    initialData: [],
  });

  const { data: inventory = [] } = useQuery({
    queryKey: ['inventory', user?.tenant_id],
    queryFn: async () => {
      if (!user?.tenant_id) return [];
      return await recims.entities.Inventory.filter({ tenant_id: user.tenant_id }, '-created_date', 200);
    },
    enabled: !!user?.tenant_id,
    initialData: [],
  });

  const filteredShipments = shipments.filter(s => {
    const shipmentDate = new Date(s.created_date);
    return shipmentDate >= dateStart && shipmentDate <= dateEnd;
  });

  const downloadCSV = (data, filename) => {
    const csv = data.map(row => Object.values(row).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const downloadPDF = () => {
    window.print();
  };

  const downloadJSON = (data, filename) => {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const handleExport = (type) => {
    const exportData = filteredShipments.map(s => ({
      load_id: s.load_id,
      supplier: s.supplier_name,
      date: format(new Date(s.created_date), 'yyyy-MM-dd'),
      type: s.load_type,
      weight_kg: s.net_weight || 0,
      status: s.status
    }));

    switch(type) {
      case 'csv':
        downloadCSV(exportData, `analytics-${format(new Date(), 'yyyy-MM-dd')}.csv`);
        break;
      case 'pdf':
        downloadPDF();
        break;
      case 'json':
        downloadJSON(exportData, `analytics-${format(new Date(), 'yyyy-MM-dd')}.json`);
        break;
    }
  };

  const getRiskColor = (value) => {
    if (value >= 80) return 'text-green-600';
    if (value >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const weightUnit = useMetric ? 'kg' : 'lbs';

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link to={createPageUrl("Reports")}>
            <Button variant="outline" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Advanced Analytics Dashboard</h1>
            <p className="text-sm text-gray-600">
              {format(dateStart, 'MMM dd, yyyy')} - {format(dateEnd, 'MMM dd, yyyy')}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="text-xs">
            {useMetric ? 'METRIC' : 'IMPERIAL'}
          </Badge>
          <Badge className="bg-purple-600 text-white">
            {filteredShipments.length} Records
          </Badge>
        </div>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Export Options</CardTitle>
            <div className="flex gap-2">
              <Button onClick={() => handleExport('csv')} variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                CSV
              </Button>
              <Button onClick={() => handleExport('pdf')} variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                PDF
              </Button>
              <Button onClick={() => handleExport('json')} variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                JSON
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <Package className="w-8 h-8 text-blue-600" />
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <p className="text-sm text-gray-600 mb-1">Total Shipments</p>
            <p className="text-3xl font-bold">{filteredShipments.length}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <BarChart3 className="w-8 h-8 text-green-600" />
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <p className="text-sm text-gray-600 mb-1">Total Weight</p>
            <p className="text-3xl font-bold">
              {filteredShipments.reduce((sum, s) => sum + (s.net_weight || 0), 0).toFixed(0)} {weightUnit}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <DollarSign className="w-8 h-8 text-purple-600" />
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <p className="text-sm text-gray-600 mb-1">Inventory Value</p>
            <p className="text-3xl font-bold">
              ${inventory.reduce((sum, i) => sum + (i.total_value || 0), 0).toFixed(0)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <AlertTriangle className="w-8 h-8 text-orange-600" />
              <TrendingDown className="w-5 h-5 text-red-600" />
            </div>
            <p className="text-sm text-gray-600 mb-1">Alerts</p>
            <p className="text-3xl font-bold">
              {inventory.filter(i => i.status === 'low_stock').length}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Analytics Dashboard</CardTitle>
          <p className="text-sm text-gray-600">Detailed insights and trends</p>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600">Comprehensive analytics coming soon...</p>
        </CardContent>
      </Card>
    </div>
  );
}