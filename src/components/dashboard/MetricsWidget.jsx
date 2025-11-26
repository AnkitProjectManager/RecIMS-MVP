import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
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
import { 
  TrendingUp, 
  TrendingDown, 
  Activity
} from "lucide-react";

const COLORS = ['#388E3C', '#26A69A', '#00695C', '#1C262E', '#CDDC39', '#8b5cf6', '#ec4899'];

export default function MetricsWidget({ 
  title, 
  type, 
  data, 
  metric,
  trend,
  icon
}) {
  
  const renderChart = () => {
    if (!data || data.length === 0) {
      return (
        <div className="h-48 flex items-center justify-center text-gray-500">
          <p className="text-sm">No data available</p>
        </div>
      );
    }

    switch(type) {
      case 'line':
        return (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="label" style={{ fontSize: '11px' }} />
              <YAxis style={{ fontSize: '11px' }} />
              <Tooltip />
              <Line 
                type="monotone" 
                dataKey="value" 
                stroke="#388E3C" 
                strokeWidth={2}
                dot={{ fill: '#388E3C', r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        );

      case 'area':
        return (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="label" style={{ fontSize: '11px' }} />
              <YAxis style={{ fontSize: '11px' }} />
              <Tooltip />
              <Area 
                type="monotone" 
                dataKey="value" 
                stroke="#26A69A" 
                fill="#26A69A"
                fillOpacity={0.3}
              />
            </AreaChart>
          </ResponsiveContainer>
        );

      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="label" style={{ fontSize: '11px' }} />
              <YAxis style={{ fontSize: '11px' }} />
              <Tooltip />
              <Bar dataKey="value" fill="#00695C" />
            </BarChart>
          </ResponsiveContainer>
        );

      case 'pie':
        return (
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={70}
                fill="#8884d8"
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        );

      case 'metric':
        return (
          <div className="flex items-center justify-center h-48">
            <div className="text-center">
              <p className="text-5xl font-bold text-gray-900 mb-2">{metric?.value || '0'}</p>
              <p className="text-sm text-gray-600">{metric?.label || 'Total'}</p>
              {trend && (
                <div className={`flex items-center justify-center gap-1 mt-3 ${
                  trend.direction === 'up' ? 'text-green-600' : 
                  trend.direction === 'down' ? 'text-red-600' : 'text-gray-600'
                }`}>
                  {trend.direction === 'up' ? <TrendingUp className="w-4 h-4" /> : 
                   trend.direction === 'down' ? <TrendingDown className="w-4 h-4" /> : null}
                  <span className="text-sm font-semibold">{trend.value}</span>
                </div>
              )}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const getTrendColor = () => {
    if (!trend) return '';
    if (trend.direction === 'up') return 'text-green-600 bg-green-50';
    if (trend.direction === 'down') return 'text-red-600 bg-red-50';
    return 'text-gray-600 bg-gray-50';
  };

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            {icon || <Activity className="w-5 h-5 text-green-600" />}
            {title}
          </CardTitle>
          {trend && type !== 'metric' && (
            <Badge variant="outline" className={getTrendColor()}>
              <div className="flex items-center gap-1">
                {trend.direction === 'up' ? <TrendingUp className="w-3 h-3" /> : 
                 trend.direction === 'down' ? <TrendingDown className="w-3 h-3" /> : null}
                <span className="text-xs">{trend.value}</span>
              </div>
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {renderChart()}
      </CardContent>
    </Card>
  );
}