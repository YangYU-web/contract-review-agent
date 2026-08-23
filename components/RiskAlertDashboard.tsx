'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  Info,
  TrendingUp,
  TrendingDown,
  Minus,
  Check,
  XCircle,
  Activity,
  Bell,
} from 'lucide-react';
import {
  RiskAlert,
  AlertSeverity,
  AlertStatus,
  RiskTrendData,
  ALERT_SEVERITY_CONFIG,
} from '@/lib/types';

// 严重程度图标映射
const SEVERITY_ICONS: Record<AlertSeverity, React.ElementType> = {
  critical: AlertOctagon,
  warning: AlertTriangle,
  info: Info,
};

// 趋势图标映射
const TREND_ICONS = {
  up: { icon: TrendingUp, color: 'text-red-500', label: '上升' },
  down: { icon: TrendingDown, color: 'text-green-500', label: '下降' },
  stable: { icon: Minus, color: 'text-slate-400', label: '平稳' },
};

// 状态标签配置
const STATUS_CONFIG: Record<
  AlertStatus,
  { label: string; cls: string }
> = {
  active: { label: '活跃', cls: 'bg-red-50 text-red-600' },
  acknowledged: { label: '已确认', cls: 'bg-amber-50 text-amber-600' },
  resolved: { label: '已解决', cls: 'bg-green-50 text-green-600' },
};

// 相对时间格式化
function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = Date.now();
  const diff = now - date.getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) return '刚刚';
  if (diff < hour) return `${Math.floor(diff / minute)} 分钟前`;
  if (diff < day) return `${Math.floor(diff / hour)} 小时前`;
  if (diff < day * 7) return `${Math.floor(diff / day)} 天前`;
  return date.toLocaleDateString('zh-CN');
}

interface Stats {
  total: number;
  critical: number;
  warning: number;
  info: number;
  active: number;
  acknowledged: number;
  resolved: number;
}

export default function RiskAlertDashboard() {
  const [alerts, setAlerts] = useState<RiskAlert[]>([]);
  const [trend, setTrend] = useState<RiskTrendData[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/alerts', { cache: 'no-store' });
      if (!res.ok) throw new Error('加载预警失败');
      const data = await res.json();
      setAlerts(data.alerts || []);
      setTrend(data.trend || []);
      setStats(data.stats || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载预警失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // 确认 / 解决预警
  const handleAction = async (
    alert: RiskAlert,
    action: 'acknowledge' | 'resolve'
  ) => {
    setActionLoadingId(alert.id);
    try {
      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, alert_id: alert.id }),
      });
      if (!res.ok) throw new Error('操作失败');
      const data = await res.json();
      setAlerts(data.alerts || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败');
    } finally {
      setActionLoadingId(null);
    }
  };

  // 统计卡片数据
  const statCards = [
    {
      label: '严重预警',
      value: stats?.critical ?? 0,
      icon: AlertOctagon,
      color: 'text-red-600',
      bg: 'bg-red-50',
    },
    {
      label: '警告预警',
      value: stats?.warning ?? 0,
      icon: AlertTriangle,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
    {
      label: '已处理',
      value: (stats?.acknowledged ?? 0) + (stats?.resolved ?? 0),
      icon: Check,
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
    {
      label: '活跃预警总数',
      value: stats?.active ?? 0,
      icon: Activity,
      color: 'text-brand-600',
      bg: 'bg-brand-50',
    },
  ];

  // 趋势图最大值（用于柱状图高度计算）
  const maxScore = Math.max(...trend.map((t) => t.avg_risk_score), 1);
  const maxHigh = Math.max(...trend.map((t) => t.high_risk_count), 1);
  const maxContracts = Math.max(...trend.map((t) => t.total_contracts), 1);

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

      {/* 顶部统计卡片 */}
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
            </div>
          );
        })}
      </div>

      {/* 预警列表 */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-800 flex items-center gap-2">
            <Bell className="w-4 h-4 text-brand-600" />
            预警列表
          </h2>
          <span className="text-xs text-slate-400">
            按严重程度排序 · 共 {alerts.length} 条
          </span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm text-slate-400">
            加载预警中...
          </div>
        ) : alerts.length === 0 ? (
          <div className="py-12 text-center">
            <Check className="w-10 h-10 text-green-300 mx-auto mb-2" />
            <p className="text-sm text-slate-400">暂无预警，一切正常</p>
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.map((alert) => (
              <AlertCard
                key={alert.id}
                alert={alert}
                actionLoading={actionLoadingId === alert.id}
                onAcknowledge={() => handleAction(alert, 'acknowledge')}
                onResolve={() => handleAction(alert, 'resolve')}
              />
            ))}
          </div>
        )}
      </div>

      {/* 6 个月趋势图 */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-800 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-brand-600" />
            近 6 个月风险趋势
          </h2>
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-brand-500" />
              平均风险评分
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-red-400" />
              高风险合同数
            </span>
          </div>
        </div>

        {trend.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-400">
            暂无趋势数据
          </div>
        ) : (
          <div className="flex items-end gap-2 sm:gap-4 h-52">
            {trend.map((item, idx) => {
              const scoreHeight = (item.avg_risk_score / maxScore) * 100;
              const highHeight = (item.high_risk_count / maxHigh) * 100;
              return (
                <div
                  key={idx}
                  className="flex-1 flex flex-col items-center gap-1.5"
                >
                  <div className="text-xs font-medium text-slate-600">
                    {item.avg_risk_score}
                  </div>
                  <div className="w-full flex-1 flex items-end gap-1">
                    {/* 平均风险评分柱 */}
                    <div className="flex-1 flex items-end">
                      <div
                        className="w-full rounded-t-md bg-brand-500 hover:bg-brand-600 transition-colors"
                        style={{
                          height: `${Math.max(scoreHeight, 4)}%`,
                          minHeight: '4px',
                        }}
                        title={`平均风险评分：${item.avg_risk_score}`}
                      />
                    </div>
                    {/* 高风险合同数柱 */}
                    <div className="flex-1 flex items-end">
                      <div
                        className="w-full rounded-t-md bg-red-400 hover:bg-red-500 transition-colors"
                        style={{
                          height: `${Math.max(highHeight, 4)}%`,
                          minHeight: '4px',
                        }}
                        title={`高风险合同数：${item.high_risk_count}`}
                      />
                    </div>
                  </div>
                  <div className="text-xs text-slate-400">{item.period}</div>
                  <div className="text-[10px] text-slate-300">
                    {item.total_contracts} 份
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 趋势摘要 */}
        {trend.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
            <div className="flex items-center gap-2 text-slate-500">
              <Activity className="w-3.5 h-3.5 text-brand-500" />
              总审查合同：
              <span className="font-medium text-slate-700">
                {trend.reduce((s, t) => s + t.total_contracts, 0)} 份
              </span>
            </div>
            <div className="flex items-center gap-2 text-slate-500">
              <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
              高风险合同：
              <span className="font-medium text-slate-700">
                {trend.reduce((s, t) => s + t.high_risk_count, 0)} 份
              </span>
            </div>
            <div className="flex items-center gap-2 text-slate-500">
              <TrendingUp className="w-3.5 h-3.5 text-amber-500" />
              最高频风险：
              <span className="font-medium text-slate-700">
                {trend[trend.length - 1]?.top_risk_type || '-'}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ===== 单条预警卡片 =====
function AlertCard({
  alert,
  actionLoading,
  onAcknowledge,
  onResolve,
}: {
  alert: RiskAlert;
  actionLoading: boolean;
  onAcknowledge: () => void;
  onResolve: () => void;
}) {
  const config = ALERT_SEVERITY_CONFIG[alert.severity];
  const Icon = SEVERITY_ICONS[alert.severity];
  const trendCfg = TREND_ICONS[alert.trend];
  const TrendIcon = trendCfg.icon;
  const statusCfg = STATUS_CONFIG[alert.status];

  // 当前值是否超过阈值
  const isOverThreshold = alert.current_value > alert.threshold;
  // 进度条比例（上限阈值 *1.5，避免溢出）
  const ratio = Math.min(
    Math.round((alert.current_value / (alert.threshold * 1.5 || 1)) * 100),
    100
  );

  return (
    <div
      className={`rounded-xl border p-4 transition-opacity ${
        alert.status === 'resolved' ? 'opacity-70' : ''
      }`}
      style={{ borderColor: `${config.color}33`, backgroundColor: config.bg }}
    >
      <div className="flex items-start gap-3">
        {/* 严重程度图标 */}
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${config.color}1a` }}
        >
          <Icon className="w-5 h-5" style={{ color: config.color }} />
        </div>

        <div className="flex-1 min-w-0">
          {/* 标题行 */}
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-slate-800">{alert.title}</span>
              <span
                className="inline-flex items-center text-xs px-1.5 py-0.5 rounded font-medium"
                style={{ color: config.color, backgroundColor: `${config.color}1a` }}
              >
                {config.label}
              </span>
              <span
                className={`inline-flex items-center text-xs px-1.5 py-0.5 rounded ${statusCfg.cls}`}
              >
                {statusCfg.label}
              </span>
            </div>
            <span className="text-xs text-slate-400">
              {formatRelativeTime(alert.created_at)}
            </span>
          </div>

          {/* 描述 */}
          <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">
            {alert.description}
          </p>

          {/* 关联合同 */}
          {alert.contract_title && (
            <div className="mt-1.5 text-xs text-slate-400">
              关联合同：{alert.contract_title}
            </div>
          )}

          {/* 指标值 vs 阈值 */}
          <div className="mt-3">
            <div className="flex items-center justify-between mb-1 text-xs">
              <span className="text-slate-500">{alert.metric}</span>
              <span className="flex items-center gap-2">
                <span className="text-slate-400">
                  阈值 {alert.threshold}
                </span>
                <span
                  className={`font-semibold ${
                    isOverThreshold ? 'text-red-600' : 'text-green-600'
                  }`}
                >
                  当前 {alert.current_value}
                </span>
              </span>
            </div>
            <div className="h-1.5 bg-white/70 rounded-full overflow-hidden relative">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${ratio}%`,
                  backgroundColor: config.color,
                }}
              />
              {/* 阈值刻度线 */}
              <div
                className="absolute top-0 h-full w-px bg-slate-400/60"
                style={{ left: `${Math.min((alert.threshold / (alert.threshold * 1.5 || 1)) * 100, 100)}%` }}
              />
            </div>
          </div>

          {/* 趋势 + 操作 */}
          <div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs">
              <TrendIcon className={`w-3.5 h-3.5 ${trendCfg.color}`} />
              <span className={`${trendCfg.color} font-medium`}>
                {trendCfg.label}
              </span>
              {alert.trend === 'up' && alert.current_value > alert.threshold && (
                <span className="text-red-500 ml-1">
                  高于阈值 {alert.current_value - alert.threshold}
                </span>
              )}
              {alert.trend === 'down' && (
                <span className="text-green-500 ml-1">较上期下降</span>
              )}
            </div>

            {alert.status === 'active' && (
              <div className="flex items-center gap-2">
                <button
                  onClick={onAcknowledge}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Check className="w-3.5 h-3.5" />
                  {actionLoading ? '处理中...' : '确认'}
                </button>
                <button
                  onClick={onResolve}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Check className="w-3.5 h-3.5" />
                  {actionLoading ? '处理中...' : '解决'}
                </button>
              </div>
            )}
            {alert.status === 'acknowledged' && (
              <button
                onClick={onResolve}
                disabled={actionLoading}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Check className="w-3.5 h-3.5" />
                {actionLoading ? '处理中...' : '标记解决'}
              </button>
            )}
            {alert.status === 'resolved' && alert.resolved_at && (
              <span className="text-xs text-slate-400">
                解决于 {formatRelativeTime(alert.resolved_at)}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
