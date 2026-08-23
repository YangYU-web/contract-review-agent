'use client';

// ===== 法规变更监控视图 =====
// 自包含组件：顶部统计 + 过滤栏 + 法规变更卡片 + 时间线视图
// 通过 /api/regulatory 获取数据，支持类型/影响/辖区/状态过滤与影响评估

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Gavel,
  Scale,
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  Shield,
  Filter,
  Calendar,
  ChevronDown,
  ExternalLink,
  Scroll,
  Info,
  XCircle,
  Building2,
} from 'lucide-react';
import {
  RegulatoryChange,
  RegulatoryComplianceGap,
  RegulatoryChangeType,
  RegulatoryImpactLevel,
  RegulatoryStatus,
  REGULATORY_CHANGE_TYPE_LABELS,
  REGULATORY_IMPACT_CONFIG,
  REGULATORY_STATUS_CONFIG,
} from '@/lib/types';

// ===== 类型定义 =====

interface RegStats {
  total: number;
  critical: number;
  actionRequired: number;
  compliant: number;
  upcomingDeadlines: number;
  affectedContracts: number;
}

interface Filters {
  type: string;
  impact: string;
  jurisdiction: string;
  status: string;
}

// 受影响合同所需行动标签
const ACTION_REQUIRED_LABELS: Record<
  AffectedContractAction,
  { label: string; cls: string }
> = {
  amend: { label: '需修改', cls: 'bg-red-50 text-red-600' },
  renegotiate: { label: '需重谈', cls: 'bg-amber-50 text-amber-600' },
  terminate: { label: '需终止', cls: 'bg-rose-50 text-rose-600' },
  monitor: { label: '需监控', cls: 'bg-blue-50 text-blue-600' },
  no_action: { label: '无需行动', cls: 'bg-slate-100 text-slate-500' },
};

// 紧迫度标签
const URGENCY_LABELS: Record<
  AffectedContractUrgency,
  { label: string; cls: string }
> = {
  immediate: { label: '立即', cls: 'bg-red-50 text-red-600' },
  short_term: { label: '短期', cls: 'bg-amber-50 text-amber-600' },
  long_term: { label: '长期', cls: 'bg-slate-100 text-slate-500' },
};

type AffectedContractAction =
  | 'amend'
  | 'renegotiate'
  | 'terminate'
  | 'monitor'
  | 'no_action';
type AffectedContractUrgency = 'immediate' | 'short_term' | 'long_term';

// 日期格式化（YYYY-MM-DD → 本地化展示）
function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// 计算距今天数
function daysUntil(dateStr: string): number {
  const d = new Date(dateStr);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
}

export default function RegulatoryMonitor() {
  const [changes, setChanges] = useState<RegulatoryChange[]>([]);
  const [gaps, setGaps] = useState<RegulatoryComplianceGap[]>([]);
  const [stats, setStats] = useState<RegStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // 过滤状态
  const [filters, setFilters] = useState<Filters>({
    type: '',
    impact: '',
    jurisdiction: '',
    status: '',
  });

  // ===== 加载法规变更数据 =====
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filters.status) params.set('status', filters.status);
      if (filters.impact) params.set('impact', filters.impact);
      const res = await fetch(`/api/regulatory?${params.toString()}`, {
        cache: 'no-store',
      });
      if (!res.ok) throw new Error('加载法规变更失败');
      const data = await res.json();
      // 客户端二次过滤（类型 / 辖区）
      let list: RegulatoryChange[] = data.changes || [];
      if (filters.type) {
        list = list.filter((c) => c.type === filters.type);
      }
      if (filters.jurisdiction) {
        list = list.filter((c) => c.jurisdiction === filters.jurisdiction);
      }
      setChanges(list);
      setGaps(data.gaps || []);
      setStats(data.stats || null);
      // 默认展开第一条
      if (list.length > 0 && !expandedId) {
        setExpandedId(list[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载法规变更失败');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.status, filters.impact]);

  useEffect(() => {
    load();
  }, [load]);

  // ===== 统计卡片配置 =====
  const statCards = useMemo(
    () => [
      {
        label: '法规变更总数',
        value: stats?.total ?? 0,
        icon: Scroll,
        color: 'text-brand-600',
        bg: 'bg-brand-50',
      },
      {
        label: '严重影响',
        value: stats?.critical ?? 0,
        icon: AlertTriangle,
        color: 'text-red-600',
        bg: 'bg-red-50',
      },
      {
        label: '需采取行动',
        value: stats?.actionRequired ?? 0,
        icon: Gavel,
        color: 'text-amber-600',
        bg: 'bg-amber-50',
      },
      {
        label: '已合规',
        value: stats?.compliant ?? 0,
        icon: CheckCircle2,
        color: 'text-green-600',
        bg: 'bg-green-50',
      },
      {
        label: '即将到期',
        value: stats?.upcomingDeadlines ?? 0,
        icon: Clock,
        color: 'text-orange-600',
        bg: 'bg-orange-50',
      },
      {
        label: '受影响合同',
        value: stats?.affectedContracts ?? 0,
        icon: FileText,
        color: 'text-blue-600',
        bg: 'bg-blue-50',
      },
    ],
    [stats]
  );

  // ===== 过滤选项 =====
  const jurisdictionOptions = useMemo(() => {
    const set = new Set(changes.map((c) => c.jurisdiction));
    return Array.from(set);
  }, [changes]);

  // ===== 时间线事件（即将到来的生效日与截止日）=====
  const timelineEvents = useMemo(() => {
    const events: {
      date: string;
      title: string;
      type: 'effective' | 'deadline';
      jurisdiction: string;
      impactLevel: RegulatoryImpactLevel;
      id: string;
    }[] = [];
    const now = Date.now();
    for (const c of changes) {
      if (new Date(c.effective_date).getTime() >= now) {
        events.push({
          date: c.effective_date,
          title: c.title,
          type: 'effective',
          jurisdiction: c.jurisdiction,
          impactLevel: c.impact_level,
          id: c.id + '-eff',
        });
      }
      if (c.deadline && new Date(c.deadline).getTime() >= now) {
        events.push({
          date: c.deadline,
          title: c.title,
          type: 'deadline',
          jurisdiction: c.jurisdiction,
          impactLevel: c.impact_level,
          id: c.id + '-dl',
        });
      }
    }
    return events.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }, [changes]);

  return (
    <div className="space-y-6">
      {/* ===== 顶部统计卡片 ===== */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div
                  className={
                    'w-10 h-10 rounded-lg ' +
                    card.bg +
                    ' flex items-center justify-center shrink-0'
                  }
                >
                  <Icon className={'w-5 h-5 ' + card.color} />
                </div>
                <div className="min-w-0">
                  <div className="text-lg font-bold text-slate-800 truncate">
                    {card.value}
                  </div>
                  <div className="text-xs text-slate-400">{card.label}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ===== 错误提示 ===== */}
      {error && (
        <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm flex items-center gap-2">
          <XCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-red-400 hover:text-red-600 text-xs"
          >
            关闭
          </button>
        </div>
      )}

      {/* ===== 过滤栏 ===== */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-brand-600" />
          <h2 className="font-semibold text-slate-800 text-sm">筛选条件</h2>
          <span className="text-xs text-slate-400 ml-auto">
            当前展示 {changes.length} 条法规变更
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <FilterSelect
            label="法规类型"
            value={filters.type}
            onChange={(v) => setFilters({ ...filters, type: v })}
            options={Object.entries(REGULATORY_CHANGE_TYPE_LABELS)}
          />
          <FilterSelect
            label="影响等级"
            value={filters.impact}
            onChange={(v) => setFilters({ ...filters, impact: v })}
            options={(
              Object.entries(REGULATORY_IMPACT_CONFIG) as [string, { label: string }][]
            ).map(([k, v]) => [k, v.label])}
          />
          <div>
            <label className="block text-xs text-slate-500 mb-1">司法辖区</label>
            <select
              value={filters.jurisdiction}
              onChange={(e) =>
                setFilters({ ...filters, jurisdiction: e.target.value })
              }
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-100"
            >
              <option value="">全部辖区</option>
              {jurisdictionOptions.map((j) => (
                <option key={j} value={j}>
                  {j}
                </option>
              ))}
            </select>
          </div>
          <FilterSelect
            label="跟踪状态"
            value={filters.status}
            onChange={(v) => setFilters({ ...filters, status: v })}
            options={(
              Object.entries(REGULATORY_STATUS_CONFIG) as [string, { label: string }][]
            ).map(([k, v]) => [k, v.label])}
          />
        </div>
        {/* 是否有激活过滤，提供重置 */}
        {(filters.type ||
          filters.impact ||
          filters.jurisdiction ||
          filters.status) && (
          <div className="mt-3 flex justify-end">
            <button
              onClick={() =>
                setFilters({
                  type: '',
                  impact: '',
                  jurisdiction: '',
                  status: '',
                })
              }
              className="text-xs text-slate-400 hover:text-brand-600 transition-colors"
            >
              重置筛选
            </button>
          </div>
        )}
      </div>

      {/* ===== 时间线视图 ===== */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-4 h-4 text-brand-600" />
          <h2 className="font-semibold text-slate-800 text-sm">
            即将到来的生效日与截止日
          </h2>
          <span className="text-xs text-slate-400 ml-auto">
            共 {timelineEvents.length} 项 · 按日期升序
          </span>
        </div>
        {timelineEvents.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-400">
            暂无即将到来的关键日期
          </div>
        ) : (
          <div className="relative pl-6">
            {/* 竖直轴线 */}
            <div className="absolute left-2 top-1 bottom-1 w-px bg-slate-200" />
            <div className="space-y-3">
              {timelineEvents.map((ev) => {
                const impactCfg = REGULATORY_IMPACT_CONFIG[ev.impactLevel];
                const days = daysUntil(ev.date);
                const isDeadline = ev.type === 'deadline';
                return (
                  <div key={ev.id} className="relative">
                    {/* 节点 */}
                    <div
                      className="absolute -left-6 top-1 w-3 h-3 rounded-full border-2 border-white shadow"
                      style={{ backgroundColor: isDeadline ? '#dc2626' : '#7c3aed' }}
                    />
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded font-medium"
                            style={{
                              color: isDeadline ? '#dc2626' : '#7c3aed',
                              backgroundColor: isDeadline
                                ? '#fef2f2'
                                : '#f5f3ff',
                            }}
                          >
                            {isDeadline ? (
                              <AlertTriangle className="w-3 h-3" />
                            ) : (
                              <Calendar className="w-3 h-3" />
                            )}
                            {isDeadline ? '截止日' : '生效日'}
                          </span>
                          <span
                            className="inline-flex items-center text-xs px-1.5 py-0.5 rounded"
                            style={{
                              color: impactCfg.color,
                              backgroundColor: impactCfg.bg,
                            }}
                          >
                            {impactCfg.label}
                          </span>
                          <span className="text-xs text-slate-400 flex items-center gap-1">
                            <Building2 className="w-3 h-3" />
                            {ev.jurisdiction}
                          </span>
                        </div>
                        <p className="text-sm text-slate-700 mt-1 line-clamp-1">
                          {ev.title}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm font-medium text-slate-700">
                          {formatDate(ev.date)}
                        </div>
                        <div
                          className={
                            'text-xs ' +
                            (days <= 30 ? 'text-red-500' : 'text-slate-400')
                          }
                        >
                          {days > 0 ? `还有 ${days} 天` : '今日'}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ===== 法规变更卡片列表 ===== */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Scroll className="w-4 h-4 text-brand-600" />
          <h2 className="font-semibold text-slate-800 text-sm">法规变更列表</h2>
          <span className="text-xs text-slate-400">
            点击卡片展开详情与合规差距
          </span>
        </div>

        {loading ? (
          <div className="py-16 text-center text-sm text-slate-400 bg-white rounded-2xl border border-slate-200">
            加载中...
          </div>
        ) : changes.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-400 bg-white rounded-2xl border border-slate-200">
            暂无符合条件的法规变更，请调整筛选条件
          </div>
        ) : (
          <div className="space-y-4">
            {changes.map((change) => (
              <RegulatoryCard
                key={change.id}
                change={change}
                gaps={gaps.filter((g) =>
                  change.affected_contracts.some(
                    (ac) => ac.contract_id === g.contract_id
                  )
                )}
                expanded={change.id === expandedId}
                onToggle={() =>
                  setExpandedId(
                    change.id === expandedId ? null : change.id
                  )
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ===== 过滤下拉选择 =====
function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <div>
      <label className="block text-xs text-slate-500 mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-100"
      >
        <option value="">全部</option>
        {options.map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </select>
    </div>
  );
}

// ===== 单个法规变更卡片 =====
function RegulatoryCard({
  change,
  gaps,
  expanded,
  onToggle,
}: {
  change: RegulatoryChange;
  gaps: RegulatoryComplianceGap[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const impactCfg = REGULATORY_IMPACT_CONFIG[change.impact_level];
  const statusCfg = REGULATORY_STATUS_CONFIG[change.status];
  const typeLabel = REGULATORY_CHANGE_TYPE_LABELS[change.type];

  // 影响评估工具状态
  const [assessType, setAssessType] = useState('采购合同');
  const [assessResult, setAssessResult] = useState<RegulatoryImpactLevel | null>(
    null
  );
  const [assessing, setAssessing] = useState(false);

  const handleAssess = async () => {
    setAssessing(true);
    try {
      const res = await fetch('/api/regulatory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'assess',
          change_id: change.id,
          contract_type: assessType,
        }),
      });
      if (!res.ok) throw new Error('评估失败');
      const data = await res.json();
      setAssessResult(data.impact_level as RegulatoryImpactLevel);
    } catch {
      setAssessResult(null);
    } finally {
      setAssessing(false);
    }
  };

  const effectiveDays = daysUntil(change.effective_date);
  const deadlineDays = change.deadline ? daysUntil(change.deadline) : null;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* ===== 卡片头部 ===== */}
      <button
        onClick={onToggle}
        className="w-full text-left p-5 hover:bg-slate-50/50 transition-colors"
      >
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0 flex-1">
            {/* 标签行 */}
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded font-medium bg-brand-50 text-brand-700">
                <Gavel className="w-3 h-3" />
                {typeLabel}
              </span>
              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                <Building2 className="w-3 h-3" />
                {change.jurisdiction}
              </span>
              <span
                className="inline-flex items-center text-xs px-2 py-0.5 rounded font-medium"
                style={{ color: impactCfg.color, backgroundColor: impactCfg.bg }}
              >
                {impactCfg.label}
              </span>
              <span
                className="inline-flex items-center text-xs px-2 py-0.5 rounded font-medium"
                style={{ color: statusCfg.color, backgroundColor: statusCfg.bg }}
              >
                {statusCfg.label}
              </span>
            </div>
            {/* 标题 */}
            <h3 className="text-lg font-semibold text-slate-800 leading-snug">
              {change.title}
            </h3>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {change.deadline && (
              <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-red-50 text-red-600">
                <Clock className="w-3 h-3" />
                截止 {deadlineDays} 天
              </span>
            )}
            <ChevronDown
              className={
                'w-5 h-5 text-slate-400 transition-transform ' +
                (expanded ? 'rotate-180' : '')
              }
            />
          </div>
        </div>

        {/* 日期行 */}
        <div className="mt-3 flex items-center gap-4 text-xs text-slate-500 flex-wrap">
          <span className="flex items-center gap-1">
            <FileText className="w-3.5 h-3.5" />
            发布：{formatDate(change.published_date)}
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" />
            生效：{formatDate(change.effective_date)}
            <span
              className={
                effectiveDays <= 30 ? 'text-red-500 font-medium' : 'text-slate-400'
              }
            >
              （{effectiveDays > 0 ? `还有 ${effectiveDays} 天` : '已生效'}）
            </span>
          </span>
          {change.deadline && (
            <span className="flex items-center gap-1 text-red-500">
              <AlertTriangle className="w-3.5 h-3.5" />
              整改截止：{formatDate(change.deadline)}
            </span>
          )}
        </div>

        {/* 摘要 */}
        <p className="mt-3 text-sm text-slate-600 leading-relaxed line-clamp-2">
          {change.summary}
        </p>

        {/* 影响领域标签 */}
        <div className="mt-3 flex items-center gap-1.5 flex-wrap">
          <Shield className="w-3.5 h-3.5 text-slate-400" />
          {change.affected_areas.map((area) => (
            <span
              key={area}
              className="inline-flex items-center text-xs px-2 py-0.5 rounded bg-slate-50 text-slate-600 border border-slate-100"
            >
              {area}
            </span>
          ))}
        </div>
      </button>

      {/* ===== 展开详情 ===== */}
      {expanded && (
        <div className="border-t border-slate-100 p-5 space-y-5">
          {/* 全文链接 */}
          {change.full_text_url && (
            <a
              href={change.full_text_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-brand-600 hover:text-brand-700"
            >
              <ExternalLink className="w-4 h-4" />
              查看法规全文
            </a>
          )}

          {/* 受影响合同 */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-4 h-4 text-brand-600" />
              <h4 className="font-semibold text-slate-800 text-sm">
                受影响合同
              </h4>
              <span className="text-xs text-slate-400 ml-auto">
                共 {change.affected_contracts.length} 份
              </span>
            </div>
            <div className="space-y-2">
              {change.affected_contracts.map((ac) => {
                const actionCfg =
                  ACTION_REQUIRED_LABELS[
                    ac.action_required as AffectedContractAction
                  ] || ACTION_REQUIRED_LABELS.monitor;
                const urgencyCfg =
                  URGENCY_LABELS[ac.urgency as AffectedContractUrgency] ||
                  URGENCY_LABELS.long_term;
                return (
                  <div
                    key={ac.contract_id}
                    className="rounded-xl border border-slate-100 p-3"
                  >
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-slate-700 text-sm">
                            {ac.contract_title}
                          </span>
                          <span className="text-xs text-slate-400">
                            {ac.contract_id}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                          {ac.impact_description}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span
                          className={
                            'inline-flex items-center text-xs px-2 py-0.5 rounded ' +
                            actionCfg.cls
                          }
                        >
                          {actionCfg.label}
                        </span>
                        <span
                          className={
                            'inline-flex items-center text-xs px-2 py-0.5 rounded ' +
                            urgencyCfg.cls
                          }
                        >
                          {urgencyCfg.label}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 建议行动清单 */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="w-4 h-4 text-brand-600" />
              <h4 className="font-semibold text-slate-800 text-sm">建议行动</h4>
            </div>
            <ul className="space-y-2">
              {change.recommended_actions.map((action, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-2 text-sm text-slate-600"
                >
                  <span className="w-5 h-5 rounded-full bg-brand-50 text-brand-600 text-xs flex items-center justify-center shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <span className="leading-relaxed">{action}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* 影响评估工具 */}
          <div className="bg-gradient-to-br from-brand-50 to-white rounded-xl border border-brand-100 p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-brand-100 flex items-center justify-center">
                <Scale className="w-4 h-4 text-brand-600" />
              </div>
              <h4 className="font-semibold text-slate-800 text-sm">
                合同影响评估
              </h4>
              <span className="text-xs text-slate-400 ml-auto">
                选择合同类型模拟影响等级
              </span>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <select
                value={assessType}
                onChange={(e) => setAssessType(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-100"
              >
                <option>采购合同</option>
                <option>服务合同</option>
                <option>租赁合同</option>
                <option>技术开发合同</option>
                <option>咨询服务合同</option>
                <option>人力资源服务合同</option>
              </select>
              <button
                onClick={handleAssess}
                disabled={assessing}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Scale className="w-4 h-4" />
                {assessing ? '评估中...' : '评估影响'}
              </button>
              {assessResult && (
                <span
                  className="inline-flex items-center text-sm px-3 py-1.5 rounded-lg font-medium"
                  style={{
                    color: REGULATORY_IMPACT_CONFIG[assessResult].color,
                    backgroundColor: REGULATORY_IMPACT_CONFIG[assessResult].bg,
                  }}
                >
                  {REGULATORY_IMPACT_CONFIG[assessResult].label}
                </span>
              )}
            </div>
          </div>

          {/* 合规差距 */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <h4 className="font-semibold text-slate-800 text-sm">合规差距</h4>
              <span className="text-xs text-slate-400 ml-auto">
                关联受影响合同的合规差距
              </span>
            </div>
            {gaps.length === 0 ? (
              <div className="py-6 text-center text-sm text-slate-400 rounded-xl border border-slate-100">
                <CheckCircle2 className="w-8 h-8 text-green-300 mx-auto mb-2" />
                暂未识别到关联合规差距
              </div>
            ) : (
              <div className="space-y-2">
                {gaps.map((gap, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl border border-amber-100 bg-amber-50/40 p-3"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <FileText className="w-3.5 h-3.5 text-slate-400" />
                      <span className="font-medium text-slate-700 text-sm">
                        {gap.contract_title}
                      </span>
                      <span className="text-xs text-slate-400">
                        {gap.contract_id}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      {gap.gap_description}
                    </p>
                    <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                      <div className="rounded-lg bg-red-50/60 border border-red-100 p-2">
                        <div className="text-red-500 font-medium mb-0.5">
                          现有条款
                        </div>
                        <p className="text-slate-600 leading-relaxed">
                          {gap.current_clause}
                        </p>
                      </div>
                      <div className="rounded-lg bg-green-50/60 border border-green-100 p-2">
                        <div className="text-green-600 font-medium mb-0.5">
                          法规要求
                        </div>
                        <p className="text-slate-600 leading-relaxed">
                          {gap.required_clause}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-1 text-xs text-slate-400">
                      <Info className="w-3 h-3" />
                      法规依据：{gap.regulation_reference}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
