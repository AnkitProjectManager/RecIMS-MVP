import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useMemo } from "react";
import { useTenant } from "@/components/TenantContext";
import { getThemePalette, withAlpha } from "@/lib/theme";
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
  Activity,
} from "lucide-react";

const FALLBACK_COLORS = ['#388E3C', '#26A69A', '#00695C', '#1C262E', '#CDDC39', '#8b5cf6', '#ec4899'];

export default function MetricsWidget({
  title,
  type,
  data,
  metric,
  trend,
  icon,
}) {
  const { theme } = useTenant();
  const palette = useMemo(() => getThemePalette(theme), [theme]);
  const chartColors = useMemo(
    () => [
      palette.primaryColor,
      palette.secondaryColor,
      '#1C262E',
      '#8b5cf6',
      '#ec4899',
      ...FALLBACK_COLORS,
    ],
    [palette.primaryColor, palette.secondaryColor]
  );

  const badgeStyles = useMemo(
    () => ({
      up: {
        color: palette.primaryColor,
        borderColor: withAlpha(palette.primaryColor, 0.35),
        backgroundColor: withAlpha(palette.primaryColor, 0.12),
      },
      down: {
        color: '#dc2626',
        borderColor: 'rgba(220, 38, 38, 0.3)',
        backgroundColor: 'rgba(220, 38, 38, 0.08)',
      },
      flat: {
        color: '#475569',
        borderColor: 'rgba(71, 85, 105, 0.25)',
        backgroundColor: 'rgba(71, 85, 105, 0.08)',
      },
    }),
    [palette.primaryColor]
  );

  const cardStyle = useMemo(
    () => ({
      borderColor: withAlpha(palette.primaryColor, 0.22),
      boxShadow: `0 25px 55px -35px ${palette.glow}`,
    }),
    [palette.glow, palette.primaryColor]
  );

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
                stroke={palette.primaryColor}
                strokeWidth={2}
                dot={{ fill: palette.primaryColor, r: 4 }}
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
                stroke={palette.secondaryColor}
                fill={palette.secondaryColor}
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
              <Bar dataKey="value" fill={palette.primaryColor} />
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
                  <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
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
                <div
                  className="flex items-center justify-center gap-1 mt-3"
                  style={{ color: trend.direction === 'down' ? '#dc2626' : palette.primaryColor }}
                >
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

  const getTrendStyle = () => {
    if (!trend) return badgeStyles.flat;
    if (trend.direction === 'up') return badgeStyles.up;
    if (trend.direction === 'down') return badgeStyles.down;
    return badgeStyles.flat;
  };

  return (
    <Card className="hover:shadow-lg transition-shadow tenant-surface" style={cardStyle}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            {icon || <Activity className="w-5 h-5" style={{ color: palette.primaryColor }} />}
            {title}
          </CardTitle>
          {trend && type !== 'metric' && (
            <Badge variant="outline" style={getTrendStyle()}>
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