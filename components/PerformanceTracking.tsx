'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  Target,
  Flag,
  CheckCircle2,
  AlertTriangle,
  Clock,
  TrendingUp,
  TrendingDown,
  Calendar,
  ListChecks,
  Bell,
  ChevronDown,
  XCircle,
} from 'lucide-react';
import {
  PerformanceTracker,
  PerformanceKPI,
  Milestone,
  Obligation,
  PerformanceAlert,
  PerformanceStatus,
  MilestoneType,
  PERFORMANCE_STATUS_CONFIG,
  MILESTONE_TYPE_LABELS,
} from '@/lib/types';

// ===== 里程碑类型图标 =====
const MILESTONE_TYPE_ICONS: Record<MilestoneType, typeof Flag> = {
  payment: Target,
  delivery: Flag,
  review: ListChecks,
  approval: CheckCircle2,
  report: Activity,
  renewal: Clock,
};

// ===== 预警严重度样式 =====
const ALERT_SEVERITY_CONFIG: Record<
  'critical' | 'warning' | 'info',
  { label: string; cls: string; bg: string; icon: typeof AlertTriangle }
> = {
  critical: {
    label: '严重',
    cls: 'text-red-700 border-red-200',
    bg: 'bg-red-50',
    icon: AlertTriangle,
  },
  warning: {
    label: '警告',
    cls: 'text-amber-700 border-amber-200',
    bg: 'bg-amber-50',
    icon: AlertTriangle,
  },
  info: {
    label: '提示',
    cls: 'text-blue-700 border-blue-200',
    bg: 'bg-blue-50',
    icon: Bell,
  },
};

// ===== 预警类型标签 =====
const ALERT_TYPE_LABELS: Record<string, string> = {
  milestone_delay: '里程碑延误',
  kpi_breach: 'KPI 偏差',
  obligation_overdue: '义务逾期',
  deadline_approaching: '截止日期临近',
};

// 义务周期标签
const RECURRENCE_LABELS: Record<string, string> = {
  one_time: '一次性',
  monthly: '每月',
  quarterly: '每季度',
  annually: '每年',
};

// 格式化日期
function formatDate(dateStr?: string): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// 计算距离截止日期的剩余天数
function daysUntil(dateStr: string): number {
  const now = new Date();
  const end = new Date(dateStr);
  return Math.ceil((end.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
}

// 进度条颜色
function progressColor(progress: number): string {
  if (progress >= 100) return 'bg-green-500';
  if (progress >= 75) return 'bg-brand-500';
  if (progress >= 50) return 'bg-blue-500';
  if (progress >= 25) return 'bg-amber-500';
  return 'bg-red-500';
}

// KPI 达成状态颜色
function kpiStatusColor(status: PerformanceStatus): string {
  const cfg = PERFORMANCE_STATUS_CONFIG[status];
  return cfg?.color || '#6b7280';
}

interface Stats {
  total: number;
  onTrack: number;
  atRisk: number;
  delayed: number;
  completed: number;
  avgProgress: number;
  totalAlerts: number;
}

export default function PerformanceTracking() {
  const [trackers, setTrackers] = useState<PerformanceTracker[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // 加载履约追踪列表
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/performance', { cache: 'no-store' });
      if (!res.ok) throw new Error('加载履约追踪记录失败');
      const data = await res.json();
      setTrackers(data.trackers || []);
      setStats(data.stats || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载履约追踪记录失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // 完成里程碑
  const handleCompleteMilestone = async (
    tracker: PerformanceTracker,
    milestone: Milestone
  ) => {
    setActionLoading(`ms-${tracker.id}-${milestone.id}`);
    setError(null);
    try {
      const res = await fetch('/api/performance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_milestone',
          tracker_id: tracker.id,
          milestone_id: milestone.id,
          updates: { completed: true, status: 'completed' },
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || '更新里程碑失败');
      }
      const data = await res.json();
      setTrackers(data.trackers || []);
      setStats(data.stats || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新里程碑失败');
    } finally {
      setActionLoading(null);
    }
  };

  // 顶部统计卡片
  const statCards = [
    {
      label: '监控合同总数',
      value: stats?.total ?? 0,
      icon: Activity,
      color: 'text-brand-600',
      bg: 'bg-brand-50',
    },
    {
      label: '正常履约',
      value: stats?.onTrack ?? 0,
      icon: CheckCircle2,
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
    {
      label: '有风险',
      value: stats?.atRisk ?? 0,
      icon: AlertTriangle,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
    {
      label: '已延误',
      value: stats?.delayed ?? 0,
      icon: Clock,
      color: 'text-red-600',
      bg: 'bg-red-50',
    },
    {
      label: '平均进度',
      value: `${stats?.avgProgress ?? 0}%`,
      icon: Target,
      color: 'text-brand-600',
      bg: 'bg-brand-50',
    },
    {
      label: '活跃预警',
      value: stats?.totalAlerts ?? 0,
      icon: Bell,
      color: 'text-red-600',
      bg: 'bg-red-50',
    },
  ];

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

      {/* ===== 顶部统计 ===== */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="bg-white rounded-xl border border-slate-200 shadow-sm p-4"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-lg ${card.bg} flex items-center justify-center shrink-0`}
                >
                  <Icon className={`w-5 h-5 ${card.color}`} />
                </div>
                <div className="min-w-0">
                  <div className="text-xl font-bold text-slate-800 truncate">
                    {card.value}
                  </div>
                  <div className="text-xs text-slate-400 truncate">{card.label}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ===== 履约追踪列表 ===== */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <Activity className="w-4 h-4 text-brand-600" />
            合同履约追踪列表
          </h3>
          <span className="text-xs text-slate-400">
            共 {trackers.length} 份合同
          </span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm text-slate-400">
            加载履约追踪记录中...
          </div>
        ) : trackers.length === 0 ? (
          <div className="py-12 text-center">
            <Activity className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-400">暂无履约追踪记录</p>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {trackers.map((tracker) => (
              <TrackerCard
                key={tracker.id}
                tracker={tracker}
                actionLoading={actionLoading}
                onCompleteMilestone={(milestone) =>
                  handleCompleteMilestone(tracker, milestone)
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ===== 履约追踪卡片 =====
function TrackerCard({
  tracker,
  actionLoading,
  onCompleteMilestone,
}: {
  tracker: PerformanceTracker;
  actionLoading: string | null;
  onCompleteMilestone: (milestone: Milestone) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const statusCfg = PERFORMANCE_STATUS_CONFIG[tracker.status];

  // 即将到期里程碑（未来 15 天内）
  const upcomingMilestones = tracker.milestones.filter((m) => {
    if (m.completed) return false;
    const days = daysUntil(m.planned_date);
    return days >= 0 && days <= 15;
  });

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden hover:shadow-md transition-shadow">
      {/* 卡片头部：合同信息 + 进度 */}
      <div className="px-5 py-4 border-b border-slate-100">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <Activity className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="font-semibold text-slate-800">
              {tracker.contract_title}
            </span>
            <span
              className="inline-flex items-center text-xs px-2 py-0.5 rounded"
              style={{ color: statusCfg.color, backgroundColor: statusCfg.bg }}
            >
              {statusCfg.label}
            </span>
          </div>
          <button
            onClick={() => setExpanded((prev) => !prev)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors"
          >
            {expanded ? '收起' : '展开详情'}
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform ${
                expanded ? 'rotate-180' : ''
              }`}
            />
          </button>
        </div>

        {/* 对手方 + 日期 */}
        <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
          <span>对手方：{tracker.counterparty}</span>
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {formatDate(tracker.start_date)} ~ {formatDate(tracker.end_date)}
          </span>
        </div>

        {/* 整体进度条 */}
        <div className="mt-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-400">整体进度</span>
            <span className="text-xs font-medium text-slate-600">
              {tracker.overall_progress}%
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
            <div
              className={`h-full rounded-full ${progressColor(
                tracker.overall_progress
              )} transition-all`}
              style={{ width: `${tracker.overall_progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* 里程碑时间线（横向） */}
      <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/40">
        <div className="text-xs font-medium text-slate-500 mb-3 flex items-center gap-1.5">
          <Flag className="w-3.5 h-3.5 text-brand-600" />
          里程碑时间线
        </div>
        <div className="relative">
          {/* 时间线轴线 */}
          <div className="absolute top-3 left-0 right-0 h-0.5 bg-slate-200" />
          <div className="flex justify-between relative">
            {tracker.milestones.map((m) => {
              const Icon = MILESTONE_TYPE_ICONS[m.type] || Flag;
              const mStatus = PERFORMANCE_STATUS_CONFIG[m.status];
              const isCompleted = m.completed;
              const isDelayed = m.status === 'delayed';
              return (
                <div
                  key={m.id}
                  className="flex flex-col items-center group relative"
                  style={{ flex: '1 1 0', minWidth: 0 }}
                >
                  {/* 圆点 */}
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center border-2 transition-all ${
                      isCompleted
                        ? 'bg-green-500 border-green-500'
                        : isDelayed
                        ? 'bg-red-500 border-red-500'
                        : 'bg-white border-slate-300'
                    }`}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                    ) : (
                      <Icon className="w-3 h-3 text-slate-400" />
                    )}
                  </div>
                  {/* 标签 */}
                  <div className="text-[10px] text-slate-500 text-center mt-1.5 leading-tight w-full px-0.5 truncate">
                    {m.name}
                  </div>
                  {/* 日期 */}
                  <div
                    className={`text-[10px] mt-0.5 ${
                      isDelayed ? 'text-red-500' : 'text-slate-400'
                    }`}
                  >
                    {formatDate(m.planned_date)}
                  </div>
                  {/* 悬浮提示 */}
                  <div className="absolute bottom-full mb-2 hidden group-hover:block z-10">
                    <div className="bg-slate-800 text-white text-[10px] rounded px-2 py-1 whitespace-nowrap">
                      {MILESTONE_TYPE_LABELS[m.type]} · {mStatus.label}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 预警区 */}
      {tracker.alerts.length > 0 && (
        <div className="px-5 py-3 border-b border-slate-100">
          <div className="text-xs font-medium text-slate-500 mb-2 flex items-center gap-1.5">
            <Bell className="w-3.5 h-3.5 text-red-500" />
            预警信息（{tracker.alerts.length}）
          </div>
          <div className="space-y-1.5">
            {tracker.alerts.map((alert) => {
              const sevCfg = ALERT_SEVERITY_CONFIG[alert.severity];
              const SevIcon = sevCfg.icon;
              return (
                <div
                  key={alert.id}
                  className={`flex items-start gap-2 rounded-lg border ${sevCfg.cls} ${sevCfg.bg} px-3 py-2`}
                >
                  <SevIcon className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[10px] font-medium px-1 py-0.5 rounded bg-white/60">
                        {ALERT_TYPE_LABELS[alert.type] || alert.type}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {sevCfg.label}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600">{alert.message}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 即将到期里程碑 */}
      {upcomingMilestones.length > 0 && (
        <div className="px-5 py-3 border-b border-slate-100">
          <div className="text-xs font-medium text-amber-600 mb-2 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            即将到期里程碑（{upcomingMilestones.length}）
          </div>
          <div className="flex flex-wrap gap-2">
            {upcomingMilestones.map((m) => {
              const days = daysUntil(m.planned_date);
              return (
                <div
                  key={m.id}
                  className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-700"
                >
                  <Flag className="w-3 h-3" />
                  <span className="font-medium">{m.name}</span>
                  <span className="text-amber-500">
                    {days === 0 ? '今日到期' : `${days} 天后`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 展开区：完整详情 */}
      {expanded && (
        <div className="px-5 py-4 space-y-4">
          {/* KPI 表格 */}
          <div>
            <div className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-1.5">
              <Target className="w-4 h-4 text-brand-600" />
              关键绩效指标（KPI）
            </div>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-500">
                    <th className="px-3 py-2 text-left font-medium">指标名称</th>
                    <th className="px-3 py-2 text-right font-medium">目标值</th>
                    <th className="px-3 py-2 text-right font-medium">实际值</th>
                    <th className="px-3 py-2 text-center font-medium">单位</th>
                    <th className="px-3 py-2 text-center font-medium">状态</th>
                    <th className="px-3 py-2 text-center font-medium">趋势</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tracker.kpis.map((kpi) => (
                    <KpiRow key={kpi.id} kpi={kpi} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 里程碑详情列表 */}
          <div>
            <div className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-1.5">
              <Flag className="w-4 h-4 text-brand-600" />
              里程碑详情（{tracker.milestones.length}）
            </div>
            <div className="space-y-2">
              {tracker.milestones.map((m) => {
                const Icon = MILESTONE_TYPE_ICONS[m.type] || Flag;
                const mStatus = PERFORMANCE_STATUS_CONFIG[m.status];
                return (
                  <div
                    key={m.id}
                    className="rounded-lg border border-slate-200 p-3 flex items-start gap-3"
                  >
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        m.completed
                          ? 'bg-green-50'
                          : m.status === 'delayed'
                          ? 'bg-red-50'
                          : 'bg-slate-50'
                      }`}
                    >
                      <Icon
                        className={`w-4 h-4 ${
                          m.completed
                            ? 'text-green-600'
                            : m.status === 'delayed'
                            ? 'text-red-500'
                            : 'text-slate-400'
                        }`}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-slate-700">
                          {m.name}
                        </span>
                        <span
                          className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded"
                          style={{
                            color: mStatus.color,
                            backgroundColor: mStatus.bg,
                          }}
                        >
                          {mStatus.label}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                          {MILESTONE_TYPE_LABELS[m.type]}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          责任方：{m.responsible_party === 'us' ? '我方' : '对方'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          计划：{formatDate(m.planned_date)}
                        </span>
                        {m.actual_date && (
                          <span className="flex items-center gap-1 text-green-600">
                            <CheckCircle2 className="w-3 h-3" />
                            实际：{formatDate(m.actual_date)}
                          </span>
                        )}
                      </div>
                      {m.deliverables.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {m.deliverables.map((d, i) => (
                            <span
                              key={i}
                              className="text-[10px] px-1.5 py-0.5 rounded bg-slate-50 text-slate-500 border border-slate-100"
                            >
                              {d}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    {/* 完成按钮 */}
                    {!m.completed && (
                      <button
                        onClick={() => onCompleteMilestone(m)}
                        disabled={
                          actionLoading === `ms-${tracker.id}-${m.id}`
                        }
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {actionLoading === `ms-${tracker.id}-${m.id}`
                          ? '更新中...'
                          : '标记完成'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 义务列表 */}
          <div>
            <div className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-1.5">
              <ListChecks className="w-4 h-4 text-brand-600" />
              合同义务跟踪（{tracker.obligations.length}）
            </div>
            <div className="space-y-2">
              {tracker.obligations.map((ob) => {
                const obStatus = PERFORMANCE_STATUS_CONFIG[ob.status];
                const days = daysUntil(ob.due_date);
                return (
                  <div
                    key={ob.id}
                    className="rounded-lg border border-slate-200 p-3 flex items-start gap-3"
                  >
                    <div
                      className={`w-2 h-2 rounded-full mt-1.5 shrink-0`}
                      style={{ backgroundColor: obStatus.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm text-slate-700">
                          {ob.description}
                        </span>
                        <span
                          className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded"
                          style={{
                            color: obStatus.color,
                            backgroundColor: obStatus.bg,
                          }}
                        >
                          {obStatus.label}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                          {ob.party === 'us' ? '我方义务' : '对方义务'}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">
                          {RECURRENCE_LABELS[ob.recurrence] || ob.recurrence}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          截止：{formatDate(ob.due_date)}
                          {ob.status !== 'completed' && (
                            <span
                              className={
                                days < 0
                                  ? 'text-red-500 ml-1'
                                  : days <= 7
                                  ? 'text-amber-500 ml-1'
                                  : 'text-slate-400 ml-1'
                              }
                            >
                              {days < 0
                                ? `（已逾期 ${Math.abs(days)} 天）`
                                : `（剩余 ${days} 天）`}
                            </span>
                          )}
                        </span>
                      </div>
                      {ob.evidence && (
                        <p className="text-xs text-slate-400 mt-1">
                          履约证据：{ob.evidence}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ===== KPI 行组件 =====
function KpiRow({ kpi }: { kpi: PerformanceKPI }) {
  const statusCfg = PERFORMANCE_STATUS_CONFIG[kpi.status];
  const TrendIcon =
    kpi.trend === 'up'
      ? TrendingUp
      : kpi.trend === 'down'
      ? TrendingDown
      : Activity;
  const trendColor =
    kpi.trend === 'up'
      ? 'text-green-600'
      : kpi.trend === 'down'
      ? 'text-red-500'
      : 'text-slate-400';

  // 判断是否达标
  const isOnTrack = kpi.status === 'on_track' || kpi.status === 'completed';
  const actualColor = isOnTrack ? 'text-green-600' : kpiStatusColor(kpi.status);

  return (
    <tr className="hover:bg-slate-50/50">
      <td className="px-3 py-2 text-slate-700 font-medium">{kpi.name}</td>
      <td className="px-3 py-2 text-right text-slate-500">{kpi.target}</td>
      <td className={`px-3 py-2 text-right font-medium ${actualColor}`}>
        {kpi.actual}
      </td>
      <td className="px-3 py-2 text-center text-slate-400">{kpi.unit}</td>
      <td className="px-3 py-2 text-center">
        <span
          className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded"
          style={{ color: statusCfg.color, backgroundColor: statusCfg.bg }}
        >
          {statusCfg.label}
        </span>
      </td>
      <td className="px-3 py-2 text-center">
        <span className={`inline-flex items-center gap-0.5 ${trendColor}`}>
          <TrendIcon className="w-3.5 h-3.5" />
          {kpi.trend === 'up' ? '上升' : kpi.trend === 'down' ? '下降' : '持平'}
        </span>
      </td>
    </tr>
  );
}
