'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  History,
  Shield,
  User,
  FileText,
  CheckCircle,
  XCircle,
  Filter,
  Download,
  Clock,
  Activity,
} from 'lucide-react';
import {
  AuditLogEntry,
  AuditAction,
  AuditComplianceReport,
  AUDIT_ACTION_LABELS,
} from '@/lib/types';

// 操作类型对应的图标与配色
type IconType = typeof FileText;
const ACTION_STYLE: Record<
  AuditAction,
  { icon: IconType; cls: string; dot: string }
> = {
  contract_uploaded: { icon: FileText, cls: 'bg-blue-50 text-blue-600', dot: 'bg-blue-500' },
  review_started: { icon: Activity, cls: 'bg-indigo-50 text-indigo-600', dot: 'bg-indigo-500' },
  review_completed: { icon: CheckCircle, cls: 'bg-green-50 text-green-600', dot: 'bg-green-500' },
  risk_accepted: { icon: CheckCircle, cls: 'bg-green-50 text-green-600', dot: 'bg-green-500' },
  risk_rejected: { icon: XCircle, cls: 'bg-red-50 text-red-600', dot: 'bg-red-500' },
  approval_submitted: { icon: Clock, cls: 'bg-amber-50 text-amber-600', dot: 'bg-amber-500' },
  approval_approved: { icon: CheckCircle, cls: 'bg-green-50 text-green-600', dot: 'bg-green-500' },
  approval_rejected: { icon: XCircle, cls: 'bg-red-50 text-red-600', dot: 'bg-red-500' },
  comment_added: { icon: User, cls: 'bg-brand-50 text-brand-600', dot: 'bg-brand-500' },
  report_exported: { icon: Download, cls: 'bg-blue-50 text-blue-600', dot: 'bg-blue-500' },
  version_created: { icon: FileText, cls: 'bg-blue-50 text-blue-600', dot: 'bg-blue-500' },
  rule_created: { icon: Shield, cls: 'bg-brand-50 text-brand-600', dot: 'bg-brand-500' },
  rule_updated: { icon: Shield, cls: 'bg-brand-50 text-brand-600', dot: 'bg-brand-500' },
  rule_deleted: { icon: XCircle, cls: 'bg-red-50 text-red-600', dot: 'bg-red-500' },
  settings_changed: { icon: Shield, cls: 'bg-slate-100 text-slate-600', dot: 'bg-slate-500' },
  user_login: { icon: User, cls: 'bg-slate-100 text-slate-600', dot: 'bg-slate-500' },
  user_logout: { icon: User, cls: 'bg-slate-100 text-slate-600', dot: 'bg-slate-500' },
};

// 异常类操作（用于统计异常项数）
const ANOMALY_ACTIONS: AuditAction[] = [
  'approval_rejected',
  'risk_rejected',
  'rule_deleted',
];

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
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// 合规分数对应的颜色与提示
function scoreStyle(score: number): { color: string; bg: string; label: string } {
  if (score >= 80) return { color: 'text-green-600', bg: 'bg-green-500', label: '良好' };
  if (score >= 60) return { color: 'text-amber-600', bg: 'bg-amber-500', label: '一般' };
  return { color: 'text-red-600', bg: 'bg-red-500', label: '需改进' };
}

export default function AuditTrailView() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [report, setReport] = useState<AuditComplianceReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 筛选状态
  const [actionFilter, setActionFilter] = useState<AuditAction | 'all'>('all');
  const [actorFilter, setActorFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  // 详情展开
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [logsRes, reportRes] = await Promise.all([
        fetch('/api/audit', { cache: 'no-store' }),
        fetch('/api/audit?report=true', { cache: 'no-store' }),
      ]);
      if (!logsRes.ok) throw new Error('加载审计日志失败');
      if (!reportRes.ok) throw new Error('加载合规报告失败');
      const logsData = await logsRes.json();
      const reportData = await reportRes.json();
      setLogs(logsData.logs || []);
      setReport(reportData.report || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载审计数据失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // 用户选项（按 actor_id 去重）
  const userOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const l of logs) {
      map.set(l.actor_id, `${l.actor_name}（${l.actor_role}）`);
    }
    return Array.from(map.entries()).map(([id, label]) => ({ id, label }));
  }, [logs]);

  // 客户端筛选后的列表
  const filtered = useMemo(() => {
    return logs.filter((l) => {
      if (actionFilter !== 'all' && l.action !== actionFilter) return false;
      if (actorFilter !== 'all' && l.actor_id !== actorFilter) return false;
      const ts = new Date(l.timestamp).getTime();
      if (startDate) {
        const s = new Date(startDate).getTime();
        if (!Number.isNaN(s) && ts < s) return false;
      }
      if (endDate) {
        const e = new Date(endDate);
        e.setHours(23, 59, 59, 999);
        const ev = e.getTime();
        if (!Number.isNaN(ev) && ts > ev) return false;
      }
      return true;
    });
  }, [logs, actionFilter, actorFilter, startDate, endDate]);

  // 重置筛选
  const resetFilters = () => {
    setActionFilter('all');
    setActorFilter('all');
    setStartDate('');
    setEndDate('');
  };

  // 异常项数（基于全量日志）
  const anomalyCount = useMemo(
    () => logs.filter((l) => ANOMALY_ACTIONS.includes(l.action)).length,
    [logs]
  );

  // 下载审计日志（导出 JSON）
  const handleDownload = () => {
    const text = filtered
      .map((l) => {
        const time = new Date(l.timestamp).toLocaleString('zh-CN');
        const label = AUDIT_ACTION_LABELS[l.action] || l.action;
        const contract = l.contract_title ? ` | 合同：${l.contract_title}` : '';
        const details = Object.keys(l.details).length
          ? ` | 详情：${JSON.stringify(l.details)}`
          : '';
        return `[${time}] ${l.actor_name}（${l.actor_role}）执行了「${label}」操作${contract}${details}`;
      })
      .join('\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 统计卡片
  const score = report?.compliance_score ?? 0;
  const scoreCfg = scoreStyle(score);
  const statCards = [
    {
      label: '总操作数',
      value: report?.total_actions ?? 0,
      icon: Activity,
      color: 'text-brand-600',
      bg: 'bg-brand-50',
    },
    {
      label: '独立用户',
      value: report?.unique_users ?? 0,
      icon: User,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: '合规分数',
      value: score,
      icon: Shield,
      color: scoreCfg.color,
      bg: 'bg-slate-50',
      suffix: scoreCfg.label,
    },
    {
      label: '异常项数',
      value: anomalyCount,
      icon: XCircle,
      color: anomalyCount > 0 ? 'text-red-600' : 'text-slate-400',
      bg: anomalyCount > 0 ? 'bg-red-50' : 'bg-slate-50',
    },
  ];

  return (
    <div className="space-y-5">
      {error && (
        <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm flex items-center gap-2">
          <XCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-red-400 hover:text-red-600"
          >
            ×
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
                <div className="min-w-0">
                  <div className="text-2xl font-bold text-slate-800 flex items-baseline gap-1">
                    {card.value}
                    {card.suffix && (
                      <span className="text-xs font-normal text-slate-400">
                        {card.suffix}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400">{card.label}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 筛选栏 */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-brand-600" />
          <h3 className="font-semibold text-slate-800">筛选审计日志</h3>
          <button
            onClick={handleDownload}
            className="ml-auto inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            导出当前结果
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-slate-500 mb-1">操作类型</label>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value as AuditAction | 'all')}
              className="w-full text-sm p-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            >
              <option value="all">全部操作</option>
              {(Object.keys(AUDIT_ACTION_LABELS) as AuditAction[]).map((a) => (
                <option key={a} value={a}>
                  {AUDIT_ACTION_LABELS[a]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">用户</label>
            <select
              value={actorFilter}
              onChange={(e) => setActorFilter(e.target.value)}
              className="w-full text-sm p-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            >
              <option value="all">全部用户</option>
              {userOptions.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">开始日期</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full text-sm p-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">结束日期</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full text-sm p-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            />
          </div>
        </div>
        {(actionFilter !== 'all' || actorFilter !== 'all' || startDate || endDate) && (
          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs text-slate-400">
              共匹配 {filtered.length} 条记录
            </span>
            <button
              onClick={resetFilters}
              className="text-xs text-brand-600 hover:text-brand-700"
            >
              重置筛选
            </button>
          </div>
        )}
      </div>

      {/* 审计日志时间线 */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <History className="w-4 h-4 text-brand-600" />
          <h3 className="font-semibold text-slate-800">审计日志时间线</h3>
          <span className="text-xs text-slate-400 ml-auto">
            {filtered.length} 条
          </span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm text-slate-400">
            加载审计日志中...
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center">
            <History className="w-10 h-10 text-slate-200 mx-auto mb-2" />
            <p className="text-sm text-slate-400">暂无符合条件的审计日志</p>
          </div>
        ) : (
          <div className="relative pl-6">
            {/* 时间线竖线 */}
            <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-slate-200" />
            <div className="space-y-4">
              {filtered.map((entry) => (
                <AuditTimelineItem
                  key={entry.id}
                  entry={entry}
                  expanded={expandedId === entry.id}
                  onToggle={() =>
                    setExpandedId(expandedId === entry.id ? null : entry.id)
                  }
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ===== 单条审计日志（时间线项）=====
function AuditTimelineItem({
  entry,
  expanded,
  onToggle,
}: {
  entry: AuditLogEntry;
  expanded: boolean;
  onToggle: () => void;
}) {
  const style = ACTION_STYLE[entry.action];
  const Icon = style.icon;
  const label = AUDIT_ACTION_LABELS[entry.action] || entry.action;

  return (
    <div className="relative">
      {/* 时间线节点 */}
      <div
        className={`absolute -left-[18px] top-3 w-4 h-4 rounded-full ring-4 ring-white ${style.dot}`}
      />
      <div className="rounded-lg border border-slate-100 hover:border-slate-200 hover:bg-slate-50/50 transition-colors p-3">
        {/* 顶部行：图标 + 操作类型 + 时间 */}
        <div className="flex items-center gap-2 flex-wrap">
          <div
            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${style.cls}`}
          >
            <Icon className="w-3.5 h-3.5" />
          </div>
          <span className={`text-xs font-medium px-2 py-0.5 rounded ${style.cls}`}>
            {label}
          </span>
          <span className="text-xs text-slate-400 ml-auto flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatRelativeTime(entry.timestamp)}
          </span>
        </div>

        {/* 操作者 + 角色 */}
        <div className="mt-2 flex items-center gap-2 text-sm flex-wrap">
          <span className="flex items-center gap-1 text-slate-700 font-medium">
            <User className="w-3.5 h-3.5 text-slate-400" />
            {entry.actor_name}
          </span>
          <span className="text-xs text-slate-400">（{entry.actor_role}）</span>
          {entry.ip_address && (
            <span className="text-xs text-slate-400">· IP {entry.ip_address}</span>
          )}
        </div>

        {/* 合同名称 */}
        {entry.contract_title && (
          <div className="mt-1.5 flex items-center gap-1 text-xs text-slate-500">
            <FileText className="w-3.5 h-3.5 text-slate-400" />
            {entry.contract_title}
            {entry.contract_id && (
              <span className="text-slate-300">（{entry.contract_id}）</span>
            )}
          </div>
        )}

        {/* 详情（可展开）*/}
        {Object.keys(entry.details).length > 0 && (
          <div className="mt-2">
            <button
              onClick={onToggle}
              className="text-xs text-brand-600 hover:text-brand-700 flex items-center gap-1"
            >
              {expanded ? '收起详情' : '展开详情'}
            </button>
            {expanded && (
              <pre className="mt-2 p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-xs text-slate-600 overflow-x-auto whitespace-pre-wrap break-all">
                {JSON.stringify(entry.details, null, 2)}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
