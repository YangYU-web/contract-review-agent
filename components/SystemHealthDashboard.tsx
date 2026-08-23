'use client';

// ===== 系统健康监控仪表盘 =====
// 客户端组件：从 /api/health 拉取数据并展示总体状态、服务列表、
// 系统指标图表、告警与可用性统计，支持自动刷新

import { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  Server,
  Database,
  Cpu,
  HardDrive,
  Wifi,
  Mail,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  Clock,
  Zap,
  RefreshCw,
  Minus,
  XCircle,
} from 'lucide-react';
import {
  HealthCheckResult,
  SystemMetrics,
  ServiceStatus,
  MetricTrend,
  SERVICE_STATUS_CONFIG,
} from '@/lib/types';

// ===== 类型定义（API 响应） =====
interface HealthStats {
  total_services: number;
  healthy: number;
  degraded: number;
  down: number;
  maintenance: number;
  avg_response_time: number;
  avg_uptime: number;
}

interface HealthAlert {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  timestamp: string;
}

interface UptimeStat {
  period: string;
  uptime: number;
  downtime: number;
  incidents: number;
}

interface HealthResponse {
  overall_status: ServiceStatus;
  overall_label: string;
  last_check: string;
  uptime_30d: string;
  services: HealthCheckResult[];
  stats: HealthStats;
  alerts: HealthAlert[];
  uptime_stats: UptimeStat[];
  recent_metrics: SystemMetrics[];
  mock?: boolean;
}

// ===== 服务分类图标映射 =====
const CATEGORY_ICONS: Record<HealthCheckResult['category'], React.ElementType> = {
  api: Server,
  database: Database,
  ai_service: Cpu,
  storage: HardDrive,
  cache: Zap,
  email: Mail,
};

// 服务分类中文标签
const CATEGORY_LABELS: Record<HealthCheckResult['category'], string> = {
  api: 'API 服务',
  database: '数据库',
  ai_service: 'AI 服务',
  storage: '存储',
  cache: '缓存',
  email: '邮件',
};

// ===== 状态图标映射 =====
const STATUS_ICONS: Record<ServiceStatus, React.ElementType> = {
  healthy: CheckCircle,
  degraded: AlertCircle,
  down: AlertTriangle,
  maintenance: Clock,
};

// ===== 告警配置 =====
const ALERT_CONFIG: Record<
  HealthAlert['severity'],
  { label: string; icon: React.ElementType; color: string; bg: string; border: string }
> = {
  critical: {
    label: '严重',
    icon: AlertTriangle,
    color: '#dc2626',
    bg: '#fef2f2',
    border: '#fecaca',
  },
  warning: {
    label: '警告',
    icon: AlertCircle,
    color: '#d97706',
    bg: '#fffbeb',
    border: '#fde68a',
  },
  info: {
    label: '提示',
    icon: Activity,
    color: '#2563eb',
    bg: '#eff6ff',
    border: '#bfdbfe',
  },
};

// 告警严重程度排序权重（critical → warning → info）
const SEVERITY_ORDER: Record<HealthAlert['severity'], number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

// ===== 相对时间格式化 =====
function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const diff = Date.now() - date.getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < 0) return date.toLocaleString('zh-CN');
  if (diff < minute) return '刚刚';
  if (diff < hour) return `${Math.floor(diff / minute)} 分钟前`;
  if (diff < day) return `${Math.floor(diff / hour)} 小时前`;
  if (diff < day * 7) return `${Math.floor(diff / day)} 天前`;
  return date.toLocaleString('zh-CN');
}

// 格式化时间戳为 HH:mm
function formatHour(dateStr: string): string {
  const d = new Date(dateStr);
  return `${String(d.getHours()).padStart(2, '0')}:${String(
    d.getMinutes()
  ).padStart(2, '0')}`;
}

// 格式化响应时间（ms / s）
function formatResponseTime(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${ms}ms`;
}

// 判断指标"上升"是否为利好
// 响应时间 / 错误率 / 积压 / 内存使用 上升为负面；其余默认上升为正面
function isUpGood(label: string): boolean {
  const negative = ['响应时间', '错误率', '积压', '内存使用', '失败'];
  return !negative.some((k) => label.includes(k));
}

// 获取趋势箭头与颜色
function getTrendMeta(
  label: string,
  trend: MetricTrend
): { icon: React.ElementType; color: string; label: string } {
  if (trend === 'stable') {
    return { icon: Minus, color: 'text-slate-400', label: '平稳' };
  }
  const upGood = isUpGood(label);
  const isUp = trend === 'up';
  const good = upGood ? isUp : !isUp;
  return {
    icon: isUp ? TrendingUp : TrendingDown,
    color: good ? 'text-green-500' : 'text-red-500',
    label: isUp ? '上升' : '下降',
  };
}

// 自动刷新间隔（毫秒）
const REFRESH_INTERVAL = 30 * 1000;

export default function SystemHealthDashboard() {
  const [data, setData] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/health', { cache: 'no-store' });
      if (!res.ok) throw new Error('加载健康数据失败');
      const json = (await res.json()) as HealthResponse;
      setData(json);
      setLastUpdated(new Date().toISOString());
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载健康数据失败');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    // 自动刷新
    const timer = setInterval(() => load(true), REFRESH_INTERVAL);
    return () => clearInterval(timer);
  }, [load]);

  // ===== 加载中 =====
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 animate-pulse">
          <div className="h-8 bg-slate-100 rounded w-1/3 mb-4" />
          <div className="h-4 bg-slate-100 rounded w-1/4" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white rounded-xl border border-slate-200 p-4 animate-pulse"
            >
              <div className="h-6 bg-slate-100 rounded w-1/2 mb-2" />
              <div className="h-4 bg-slate-100 rounded w-2/3" />
            </div>
          ))}
        </div>
        <div className="py-12 text-center text-sm text-slate-400">
          正在加载系统健康数据...
        </div>
      </div>
    );
  }

  // ===== 错误态 =====
  if (error || !data) {
    return (
      <div className="space-y-6">
        {error && (
          <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm flex items-center gap-2">
            <XCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-red-400 hover:text-red-600"
            >
              <XCircle className="w-4 h-4" />
            </button>
          </div>
        )}
        <div className="py-12 text-center">
          <AlertTriangle className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-400 mb-4">无法加载系统健康数据</p>
          <button
            onClick={() => load()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            重试
          </button>
        </div>
      </div>
    );
  }

  const { services, stats, alerts, uptime_stats, recent_metrics } = data;
  const overallConfig = SERVICE_STATUS_CONFIG[data.overall_status];
  const OverallIcon = STATUS_ICONS[data.overall_status];
  const sortedAlerts = [...alerts].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
  );

  // 统计卡片数据
  const statCards = [
    {
      label: '活跃服务',
      value: stats.healthy,
      sub: `共 ${stats.total_services} 个服务`,
      icon: CheckCircle,
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
    {
      label: '降级服务',
      value: stats.degraded + stats.maintenance,
      sub: `维护中 ${stats.maintenance} 个`,
      icon: AlertCircle,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
    {
      label: '故障服务',
      value: stats.down,
      sub: stats.down > 0 ? '需立即处理' : '运行正常',
      icon: AlertTriangle,
      color: 'text-red-600',
      bg: 'bg-red-50',
    },
    {
      label: '平均响应时间',
      value: formatResponseTime(stats.avg_response_time),
      sub: `平均可用率 ${stats.avg_uptime.toFixed(2)}%`,
      icon: Zap,
      color: 'text-brand-600',
      bg: 'bg-brand-50',
    },
  ];

  // 取最新一个点的指标用于"当前值"展示
  const latestMetrics = recent_metrics[recent_metrics.length - 1];

  return (
    <div className="space-y-6">
      {/* ===== 顶部：总体状态大卡片 ===== */}
      <div
        className="rounded-2xl border p-6 flex flex-col sm:flex-row sm:items-center gap-6"
        style={{
          borderColor: `${overallConfig.color}33`,
          backgroundColor: overallConfig.bg,
        }}
      >
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${overallConfig.color}1a` }}
        >
          <OverallIcon
            className="w-9 h-9"
            style={{ color: overallConfig.color }}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-bold text-slate-800">系统总体状态</h2>
            <span
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-semibold"
              style={{
                color: overallConfig.color,
                backgroundColor: `${overallConfig.color}1a`,
              }}
            >
              <span
                className="w-2 h-2 rounded-full animate-pulse"
                style={{ backgroundColor: overallConfig.color }}
              />
              {overallConfig.label}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-x-6 gap-y-1 flex-wrap text-sm text-slate-600">
            <span className="flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-slate-400" />
              30 天可用率
              <span className="font-semibold text-slate-800">
                {data.uptime_30d}
              </span>
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 text-green-500" />
              健康 {stats.healthy}/{stats.total_services}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-slate-400" />
              上次检查 {formatRelativeTime(data.last_check)}
            </span>
          </div>
        </div>
        {/* 刷新按钮 */}
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-slate-200 text-sm font-medium text-slate-700 hover:border-brand-300 hover:text-brand-600 transition-colors disabled:opacity-50 shrink-0"
        >
          <RefreshCw
            className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`}
          />
          {refreshing ? '刷新中' : '刷新'}
        </button>
      </div>

      {/* ===== 统计卡片行 ===== */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="bg-white rounded-xl border border-slate-200 p-4"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-lg ${card.bg} flex items-center justify-center`}
                >
                  <Icon className={`w-5 h-5 ${card.color}`} />
                </div>
                <div>
                  <div className="text-2xl font-bold text-slate-800">
                    {card.value}
                  </div>
                  <div className="text-xs text-slate-400">{card.label}</div>
                </div>
              </div>
              <div className="mt-2 text-xs text-slate-400">{card.sub}</div>
            </div>
          );
        })}
      </div>

      {/* ===== 服务健康列表 ===== */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <Server className="w-4 h-4 text-brand-600" />
            服务健康检查
          </h3>
          <span className="text-xs text-slate-400">
            共 {services.length} 个服务 · 按状态排序
          </span>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[...services]
            .sort((a, b) => {
              const order: Record<ServiceStatus, number> = {
                down: 0,
                degraded: 1,
                maintenance: 2,
                healthy: 3,
              };
              return order[a.status] - order[b.status];
            })
            .map((svc) => (
              <ServiceCard key={svc.id} service={svc} />
            ))}
        </div>
      </div>

      {/* ===== 系统指标图表区 ===== */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <Activity className="w-4 h-4 text-brand-600" />
            系统资源指标
            <span className="text-xs font-normal text-slate-400">
              （近 24 小时，每小时一个采样点）
            </span>
          </h3>
          {latestMetrics && (
            <span className="text-xs text-slate-400">
              最新采样：{formatHour(latestMetrics.timestamp)}
            </span>
          )}
        </div>

        {/* 当前值速览 */}
        {latestMetrics && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            <CurrentMetric
              icon={Cpu}
              label="CPU 使用率"
              value={`${latestMetrics.cpu_usage.toFixed(1)}%`}
              percent={latestMetrics.cpu_usage}
              color="bg-blue-500"
            />
            <CurrentMetric
              icon={HardDrive}
              label="内存使用率"
              value={`${latestMetrics.memory_usage.toFixed(1)}%`}
              percent={latestMetrics.memory_usage}
              color="bg-purple-500"
            />
            <CurrentMetric
              icon={Wifi}
              label="错误率"
              value={`${latestMetrics.error_rate.toFixed(3)}%`}
              percent={Math.min(latestMetrics.error_rate * 20, 100)}
              color="bg-red-500"
            />
            <CurrentMetric
              icon={Zap}
              label="请求/分钟"
              value={`${latestMetrics.requests_per_minute}`}
              percent={Math.min(
                (latestMetrics.requests_per_minute /
                  Math.max(...recent_metrics.map((m) => m.requests_per_minute),
                    1)) *
                  100,
                100
              )}
              color="bg-brand-500"
            />
          </div>
        )}

        {/* CPU / 内存 24 小时柱状图 */}
        <MetricBarChart
          title="CPU / 内存使用率趋势"
          icon={Cpu}
          metrics={recent_metrics}
          series={[
            {
              key: 'cpu_usage',
              label: 'CPU',
              color: 'bg-blue-500',
              hoverColor: 'hover:bg-blue-600',
              format: (v) => `${v.toFixed(1)}%`,
              maxScale: 100,
            },
            {
              key: 'memory_usage',
              label: '内存',
              color: 'bg-purple-500',
              hoverColor: 'hover:bg-purple-600',
              format: (v) => `${v.toFixed(1)}%`,
              maxScale: 100,
            },
          ]}
        />

        {/* 请求量趋势 */}
        <div className="mt-6">
          <MetricBarChart
            title="请求量趋势（次/分钟）"
            icon={Zap}
            metrics={recent_metrics}
            series={[
              {
                key: 'requests_per_minute',
                label: '请求/分钟',
                color: 'bg-brand-500',
                hoverColor: 'hover:bg-brand-600',
                format: (v) => `${Math.round(v)}`,
              },
            ]}
          />
        </div>

        {/* 错误率趋势 */}
        <div className="mt-6">
          <MetricBarChart
            title="错误率趋势（%）"
            icon={AlertTriangle}
            metrics={recent_metrics}
            series={[
              {
                key: 'error_rate',
                label: '错误率',
                color: 'bg-red-400',
                hoverColor: 'hover:bg-red-500',
                format: (v) => `${v.toFixed(3)}%`,
              },
            ]}
          />
        </div>

        {/* 网络出入 + 活跃用户摘要 */}
        {latestMetrics && (
          <div className="mt-6 pt-4 border-t border-slate-100 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div className="flex items-center gap-2 text-slate-500">
              <Wifi className="w-3.5 h-3.5 text-brand-500" />
              入站带宽
              <span className="font-medium text-slate-700">
                {latestMetrics.network_in} KB/s
              </span>
            </div>
            <div className="flex items-center gap-2 text-slate-500">
              <Wifi className="w-3.5 h-3.5 text-green-500" />
              出站带宽
              <span className="font-medium text-slate-700">
                {latestMetrics.network_out} KB/s
              </span>
            </div>
            <div className="flex items-center gap-2 text-slate-500">
              <Activity className="w-3.5 h-3.5 text-amber-500" />
              活跃用户
              <span className="font-medium text-slate-700">
                {latestMetrics.active_users}
              </span>
            </div>
            <div className="flex items-center gap-2 text-slate-500">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              平均响应
              <span className="font-medium text-slate-700">
                {formatResponseTime(latestMetrics.avg_response_time)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ===== 告警列表 ===== */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            系统告警
          </h3>
          <span className="text-xs text-slate-400">
            按严重程度排序 · 共 {alerts.length} 条
          </span>
        </div>
        {sortedAlerts.length === 0 ? (
          <div className="py-8 text-center">
            <CheckCircle className="w-10 h-10 text-green-300 mx-auto mb-2" />
            <p className="text-sm text-slate-400">暂无告警，系统运行平稳</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedAlerts.map((alert) => (
              <AlertItem key={alert.id} alert={alert} />
            ))}
          </div>
        )}
      </div>

      {/* ===== 可用性统计表格 ===== */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-500" />
            可用性统计
          </h3>
          <span className="text-xs text-slate-400">
            停机时长单位：分钟
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="text-left font-medium py-2.5 px-3">统计周期</th>
                <th className="text-right font-medium py-2.5 px-3">可用率</th>
                <th className="text-right font-medium py-2.5 px-3">
                  停机时长
                </th>
                <th className="text-right font-medium py-2.5 px-3">
                  故障次数
                </th>
                <th className="text-left font-medium py-2.5 px-3">状态</th>
              </tr>
            </thead>
            <tbody>
              {uptime_stats.map((stat) => {
                const isGood = stat.uptime >= 99.9;
                const isMid = stat.uptime >= 99 && stat.uptime < 99.9;
                return (
                  <tr
                    key={stat.period}
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
                  >
                    <td className="py-3 px-3 font-medium text-slate-700">
                      {stat.period}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-semibold text-slate-800">
                      {stat.uptime.toFixed(2)}%
                    </td>
                    <td className="py-3 px-3 text-right text-slate-600">
                      {stat.downtime}
                    </td>
                    <td className="py-3 px-3 text-right text-slate-600">
                      {stat.incidents}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                          isGood
                            ? 'bg-green-50 text-green-600'
                            : isMid
                            ? 'bg-amber-50 text-amber-600'
                            : 'bg-red-50 text-red-600'
                        }`}
                      >
                        <CheckCircle className="w-3 h-3" />
                        {isGood ? '优秀' : isMid ? '良好' : '需关注'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 底部：刷新信息 */}
      <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
        <RefreshCw className="w-3.5 h-3.5" />
        自动刷新间隔 30 秒 · 最后更新 {formatRelativeTime(lastUpdated)}
      </div>
    </div>
  );
}

// ===== 单个服务健康卡片 =====
function ServiceCard({ service }: { service: HealthCheckResult }) {
  const config = SERVICE_STATUS_CONFIG[service.status];
  const StatusIcon = STATUS_ICONS[service.status];
  const CategoryIcon = CATEGORY_ICONS[service.category];
  const categoryLabel = CATEGORY_LABELS[service.category];

  return (
    <div
      className="rounded-xl border p-4 transition-colors"
      style={{
        borderColor: `${config.color}33`,
        backgroundColor: config.bg,
      }}
    >
      {/* 头部：图标 + 名称 + 状态标签 */}
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-white"
            style={{ border: `1px solid ${config.color}33` }}
          >
            <CategoryIcon
              className="w-5 h-5"
              style={{ color: config.color }}
            />
          </div>
          <div className="min-w-0">
            <div className="font-medium text-slate-800 truncate">
              {service.name}
            </div>
            <div className="text-xs text-slate-400">{categoryLabel}</div>
          </div>
        </div>
        <span
          className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium shrink-0"
          style={{
            color: config.color,
            backgroundColor: `${config.color}1a`,
          }}
        >
          <StatusIcon className="w-3 h-3" />
          {config.label}
        </span>
      </div>

      {/* 响应时间 / 可用率 / 上次检查 */}
      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div>
          <div className="text-slate-400">响应时间</div>
          <div className="font-semibold text-slate-700">
            {formatResponseTime(service.response_time)}
          </div>
        </div>
        <div>
          <div className="text-slate-400">可用率</div>
          <div className="font-semibold text-slate-700">
            {service.uptime.toFixed(2)}%
          </div>
        </div>
        <div>
          <div className="text-slate-400">上次检查</div>
          <div className="font-semibold text-slate-700">
            {formatRelativeTime(service.last_check)}
          </div>
        </div>
      </div>

      {/* metrics 列表（含趋势箭头） */}
      {service.metrics.length > 0 && (
        <div className="mt-3 pt-3 border-t border-white/60 space-y-1.5">
          {service.metrics.map((metric, idx) => {
            const trend = getTrendMeta(metric.label, metric.trend);
            const TrendIcon = trend.icon;
            return (
              <div
                key={idx}
                className="flex items-center justify-between text-xs"
              >
                <span className="text-slate-500">{metric.label}</span>
                <span className="flex items-center gap-1.5">
                  <span className="font-medium text-slate-700">
                    {metric.value}
                  </span>
                  <span className={`flex items-center gap-0.5 ${trend.color}`}>
                    <TrendIcon className="w-3 h-3" />
                  </span>
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* 最后错误信息 */}
      {service.last_error && (
        <div
          className="mt-3 flex items-start gap-1.5 text-xs p-2 rounded-lg"
          style={{ backgroundColor: `${config.color}0d` }}
        >
          <AlertCircle
            className="w-3.5 h-3.5 shrink-0 mt-0.5"
            style={{ color: config.color }}
          />
          <span className="text-slate-600 leading-relaxed">
            {service.last_error}
          </span>
        </div>
      )}
    </div>
  );
}

// ===== 当前指标速览卡片（含进度条） =====
function CurrentMetric({
  icon: Icon,
  label,
  value,
  percent,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  percent: number;
  color: string;
}) {
  const safePercent = Math.min(Math.max(percent, 0), 100);
  return (
    <div className="rounded-lg bg-slate-50 border border-slate-100 p-3">
      <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1.5">
        <Icon className="w-3.5 h-3.5" />
        {label}
      </div>
      <div className="text-lg font-bold text-slate-800 mb-1.5">{value}</div>
      <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${safePercent}%` }}
        />
      </div>
    </div>
  );
}

// ===== 通用指标柱状图 =====
interface ChartSeries {
  key: keyof SystemMetrics;
  label: string;
  color: string;
  hoverColor: string;
  format: (v: number) => string;
  maxScale?: number; // 固定上限（如 CPU=100），不传则用数据最大值
}

function MetricBarChart({
  title,
  icon: Icon,
  metrics,
  series,
}: {
  title: string;
  icon: React.ElementType;
  metrics: SystemMetrics[];
  series: ChartSeries[];
}) {
  // 计算每个 series 的最大值（用于柱高计算）
  const maxValues = series.map((s) => {
    if (s.maxScale) return s.maxScale;
    const values = metrics.map(
      (m) => m[s.key] as unknown as number
    );
    return Math.max(...values, 1);
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h4 className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
          <Icon className="w-4 h-4 text-slate-400" />
          {title}
        </h4>
        <div className="flex items-center gap-3 text-xs text-slate-400">
          {series.map((s) => (
            <span key={s.label} className="flex items-center gap-1">
              <span className={`w-2.5 h-2.5 rounded-sm ${s.color}`} />
              {s.label}
            </span>
          ))}
        </div>
      </div>

      {metrics.length === 0 ? (
        <div className="py-8 text-center text-sm text-slate-400">
          暂无指标数据
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="flex items-end gap-1 h-40 min-w-[480px]">
            {metrics.map((m, idx) => (
              <div
                key={idx}
                className="flex-1 flex flex-col items-center gap-1"
              >
                <div className="w-full flex-1 flex items-end gap-0.5">
                  {series.map((s, sIdx) => {
                    const value = m[s.key] as unknown as number;
                    const height = (value / maxValues[sIdx]) * 100;
                    return (
                      <div
                        key={sIdx}
                        className={`flex-1 flex items-end rounded-t ${s.color} ${s.hoverColor} transition-colors`}
                        title={`${s.label}：${s.format(value)}`}
                      >
                        <div
                          className="w-full"
                          style={{
                            height: `${Math.max(height, 2)}%`,
                            minHeight: '2px',
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
                {/* 每隔 3 小时显示一次刻度，避免拥挤 */}
                {idx % 3 === 0 && (
                  <div className="text-[10px] text-slate-400">
                    {formatHour(m.timestamp)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ===== 单条告警 =====
function AlertItem({ alert }: { alert: HealthAlert }) {
  const config = ALERT_CONFIG[alert.severity];
  const Icon = config.icon;

  return (
    <div
      className="flex items-start gap-3 p-3 rounded-lg border"
      style={{
        backgroundColor: config.bg,
        borderColor: config.border,
      }}
    >
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
        style={{ backgroundColor: `${config.color}1a` }}
      >
        <Icon className="w-4 h-4" style={{ color: config.color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="inline-flex items-center text-xs px-1.5 py-0.5 rounded font-medium"
            style={{
              color: config.color,
              backgroundColor: `${config.color}1a`,
            }}
          >
            {config.label}
          </span>
          <span className="text-xs text-slate-400">
            {formatRelativeTime(alert.timestamp)}
          </span>
        </div>
        <p className="text-sm text-slate-700 mt-1 leading-relaxed">
          {alert.message}
        </p>
      </div>
    </div>
  );
}
