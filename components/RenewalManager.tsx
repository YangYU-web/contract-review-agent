'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw,
  CalendarClock,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Settings,
  Plus,
  XCircle,
  ChevronDown,
  ListChecks,
} from 'lucide-react';
import {
  RenewalPolicy,
  RenewalStrategy,
  RenewalStatus,
  RenewalChecklistItem,
  RENEWAL_STRATEGY_LABELS,
  RENEWAL_STATUS_CONFIG,
} from '@/lib/types';

// ===== 策略配色（标签样式） =====
const STRATEGY_BADGE: Record<
  RenewalStrategy,
  { cls: string; dot: string }
> = {
  auto_renew: {
    cls: 'bg-brand-50 text-brand-700 border-brand-200',
    dot: 'bg-brand-500',
  },
  notify_only: {
    cls: 'bg-blue-50 text-blue-700 border-blue-200',
    dot: 'bg-blue-500',
  },
  manual_review: {
    cls: 'bg-amber-50 text-amber-700 border-amber-200',
    dot: 'bg-amber-500',
  },
  no_renewal: {
    cls: 'bg-slate-100 text-slate-600 border-slate-200',
    dot: 'bg-slate-400',
  },
};

// ===== 合同下拉选项（演示用 Mock） =====
const CONTRACT_OPTIONS = [
  { id: 'mock-001', title: 'XX产品采购合同', type: '采购合同' },
  { id: 'mock-002', title: 'IT技术服务协议', type: '服务合同' },
  { id: 'mock-003', title: '办公室租赁合同', type: '租赁合同' },
  { id: 'mock-007', title: '高级管理人员劳动合同', type: '劳动合同' },
];

// 策略选项
const STRATEGY_OPTIONS: RenewalStrategy[] = [
  'auto_renew',
  'notify_only',
  'manual_review',
  'no_renewal',
];

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

// 格式化日期时间
function formatDateTime(dateStr?: string): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// 计算剩余天数
function daysUntil(endDate: string): number {
  const now = new Date();
  const end = new Date(endDate);
  return Math.ceil((end.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
}

// 同步 checklist 状态到本地
function syncChecklist(
  policies: RenewalPolicy[]
): Record<string, RenewalChecklistItem[]> {
  const state: Record<string, RenewalChecklistItem[]> = {};
  policies.forEach((p) => {
    state[p.id] = p.checklist;
  });
  return state;
}

// 表单状态
interface CreateFormState {
  contractId: string;
  contractTitle: string;
  contractType: string;
  strategy: RenewalStrategy;
  termMonths: number;
  noticeDays: number;
  priceCap: number;
  minRiskScore: number;
  maxRiskScore: number;
  requiresApproval: boolean;
  maxPriceIncrease: number;
}

const EMPTY_FORM: CreateFormState = {
  contractId: '',
  contractTitle: '',
  contractType: '',
  strategy: 'auto_renew',
  termMonths: 12,
  noticeDays: 30,
  priceCap: 5,
  minRiskScore: 0,
  maxRiskScore: 60,
  requiresApproval: false,
  maxPriceIncrease: 5,
};

interface Stats {
  total: number;
  autoRenew: number;
  pending: number;
  overdue: number;
  completed: number;
  upcoming30Days: number;
}

export default function RenewalManager() {
  const [policies, setPolicies] = useState<RenewalPolicy[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // 创建表单（折叠面板）
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CreateFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // 本地 checklist 状态（用于即时勾选）
  const [checklistState, setChecklistState] = useState<
    Record<string, RenewalChecklistItem[]>
  >({});

  // 加载续签策略列表
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/renewals', { cache: 'no-store' });
      if (!res.ok) throw new Error('加载续签策略失败');
      const data = await res.json();
      setPolicies(data.policies || []);
      setStats(data.stats || null);
      setChecklistState(syncChecklist(data.policies || []));
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载续签策略失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // 切换创建表单展开/折叠
  const toggleForm = () => {
    setShowForm((prev) => !prev);
    if (!showForm) {
      setForm(EMPTY_FORM);
    }
  };

  // 选择合同
  const handleContractSelect = (id: string) => {
    const c = CONTRACT_OPTIONS.find((o) => o.id === id);
    setForm((prev) => ({
      ...prev,
      contractId: id,
      contractTitle: c?.title || '',
      contractType: c?.type || '',
    }));
  };

  // 提交创建
  const handleCreate = async () => {
    if (!form.contractId) {
      setError('请选择关联合同');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/renewals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          contract_id: form.contractId,
          contract_title: form.contractTitle,
          contract_type: form.contractType,
          strategy: form.strategy,
          renewal_term_months: form.termMonths,
          notice_days_before: form.noticeDays,
          price_adjustment_cap: form.priceCap,
          auto_conditions: {
            min_risk_score: form.minRiskScore,
            max_risk_score: form.maxRiskScore,
            requires_approval: form.requiresApproval,
            max_price_increase: form.maxPriceIncrease,
          },
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || '创建失败');
      }
      const data = await res.json();
      setPolicies(data.policies || []);
      setStats(data.stats || null);
      setChecklistState(syncChecklist(data.policies || []));
      setShowForm(false);
      setForm(EMPTY_FORM);
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建失败');
    } finally {
      setSaving(false);
    }
  };

  // 触发续签
  const handleTrigger = async (policy: RenewalPolicy) => {
    setActionLoading(`trigger-${policy.id}`);
    setError(null);
    try {
      const res = await fetch('/api/renewals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'trigger', policy_id: policy.id }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || '触发失败');
      }
      const data = await res.json();
      setPolicies(data.policies || []);
      setStats(data.stats || null);
      setChecklistState(syncChecklist(data.policies || []));
    } catch (err) {
      setError(err instanceof Error ? err.message : '触发失败');
    } finally {
      setActionLoading(null);
    }
  };

  // 完成检查清单项（通过 API）
  const handleCompleteChecklistItem = async (
    policy: RenewalPolicy,
    itemId: string
  ) => {
    // 本地即时反馈：标记为已完成
    setChecklistState((prev) => ({
      ...prev,
      [policy.id]: (prev[policy.id] || policy.checklist).map((c) =>
        c.id === itemId
          ? {
              ...c,
              completed: true,
              completed_at: new Date().toISOString(),
            }
          : c
      ),
    }));

    setActionLoading(`chk-${policy.id}-${itemId}`);
    setError(null);
    try {
      const res = await fetch('/api/renewals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'complete_checklist',
          policy_id: policy.id,
          item_id: itemId,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || '完成检查项失败');
      }
      const data = await res.json();
      setPolicies(data.policies || []);
      setStats(data.stats || null);
      setChecklistState(syncChecklist(data.policies || []));
    } catch (err) {
      setError(err instanceof Error ? err.message : '完成检查项失败');
      // 失败时回滚本地状态
      setChecklistState((prev) => ({
        ...prev,
        [policy.id]: (prev[policy.id] || policy.checklist).map((c) =>
          c.id === itemId
            ? { ...c, completed: false, completed_at: undefined }
            : c
        ),
      }));
    } finally {
      setActionLoading(null);
    }
  };

  // 取消续签
  const handleCancel = async (policy: RenewalPolicy) => {
    const reason = prompt(`请输入取消「${policy.contract_title}」续签的原因：`);
    if (reason === null) return;
    setActionLoading(`cancel-${policy.id}`);
    setError(null);
    try {
      const res = await fetch('/api/renewals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'cancel',
          policy_id: policy.id,
          reason: reason || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || '取消失败');
      }
      const data = await res.json();
      setPolicies(data.policies || []);
      setStats(data.stats || null);
      setChecklistState(syncChecklist(data.policies || []));
    } catch (err) {
      setError(err instanceof Error ? err.message : '取消失败');
    } finally {
      setActionLoading(null);
    }
  };

  // 顶部统计卡片
  const statCards = [
    {
      label: '总续签策略',
      value: stats?.total ?? 0,
      icon: RefreshCw,
      color: 'text-brand-600',
      bg: 'bg-brand-50',
    },
    {
      label: '自动续签',
      value: stats?.autoRenew ?? 0,
      icon: CheckCircle2,
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
    {
      label: '待处理',
      value: stats?.pending ?? 0,
      icon: Clock,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: '已逾期',
      value: stats?.overdue ?? 0,
      icon: AlertTriangle,
      color: 'text-red-600',
      bg: 'bg-red-50',
    },
    {
      label: '30天内到期',
      value: stats?.upcoming30Days ?? 0,
      icon: CalendarClock,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
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
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="bg-white rounded-xl border border-slate-200 shadow-sm p-4"
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

      {/* ===== 折叠式创建续签策略表单 ===== */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <button
          onClick={toggleForm}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50/60 transition-colors"
        >
          <span className="font-semibold text-slate-800 flex items-center gap-2">
            <Plus className="w-4 h-4 text-brand-600" />
            新建续签策略
          </span>
          <ChevronDown
            className={`w-5 h-5 text-slate-400 transition-transform ${
              showForm ? 'rotate-180' : ''
            }`}
          />
        </button>
        {showForm && (
          <CreateRenewalForm
            form={form}
            setForm={setForm}
            saving={saving}
            onContractSelect={handleContractSelect}
            onSubmit={handleCreate}
            onCancel={() => {
              setShowForm(false);
              setForm(EMPTY_FORM);
            }}
          />
        )}
      </div>

      {/* ===== 策略列表 ===== */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <ListChecks className="w-4 h-4 text-brand-600" />
            续签策略列表
          </h3>
          <span className="text-xs text-slate-400">
            共 {policies.length} 条策略
          </span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm text-slate-400">
            加载续签策略中...
          </div>
        ) : policies.length === 0 ? (
          <div className="py-12 text-center">
            <RefreshCw className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-400">暂无续签策略，请新建</p>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {policies.map((policy) => (
              <PolicyCard
                key={policy.id}
                policy={policy}
                checklist={checklistState[policy.id] || policy.checklist}
                actionLoading={actionLoading}
                onCompleteChecklistItem={(itemId) =>
                  handleCompleteChecklistItem(policy, itemId)
                }
                onTrigger={() => handleTrigger(policy)}
                onCancel={() => handleCancel(policy)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ===== 续签策略卡片 =====
function PolicyCard({
  policy,
  checklist,
  actionLoading,
  onCompleteChecklistItem,
  onTrigger,
  onCancel,
}: {
  policy: RenewalPolicy;
  checklist: RenewalChecklistItem[];
  actionLoading: string | null;
  onCompleteChecklistItem: (itemId: string) => void;
  onTrigger: () => void;
  onCancel: () => void;
}) {
  const strategyBadge = STRATEGY_BADGE[policy.strategy];
  const statusCfg = RENEWAL_STATUS_CONFIG[policy.status];
  const days = daysUntil(policy.current_end_date);
  const completedCount = checklist.filter((c) => c.completed).length;
  const totalCount = checklist.length;
  const progress =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const canTrigger = policy.status === 'scheduled';
  const canCancel =
    policy.status === 'scheduled' ||
    policy.status === 'in_progress' ||
    policy.status === 'overdue';

  // 剩余天数文案与颜色
  let daysText = '';
  let daysColor = 'text-slate-500';
  if (policy.status === 'completed') {
    daysText = '已完成';
    daysColor = 'text-green-600';
  } else if (policy.status === 'cancelled') {
    daysText = '已取消';
    daysColor = 'text-slate-400';
  } else if (days < 0) {
    daysText = `已逾期 ${Math.abs(days)} 天`;
    daysColor = 'text-red-600 font-medium';
  } else if (days === 0) {
    daysText = '今日到期';
    daysColor = 'text-red-600 font-medium';
  } else if (days <= 30) {
    daysText = `剩余 ${days} 天`;
    daysColor = 'text-amber-600 font-medium';
  } else {
    daysText = `剩余 ${days} 天`;
    daysColor = 'text-slate-500';
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden hover:shadow-md transition-shadow">
      {/* 卡片头部 */}
      <div className="px-5 py-4 border-b border-slate-100">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <CalendarClock className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="font-semibold text-slate-800">
              {policy.contract_title}
            </span>
            <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600">
              {policy.contract_type}
            </span>
            {/* 策略标签 */}
            <span
              className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded border ${strategyBadge.cls}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${strategyBadge.dot}`} />
              {RENEWAL_STRATEGY_LABELS[policy.strategy]}
            </span>
            {/* 状态标签 */}
            <span
              className="inline-flex items-center text-xs px-2 py-0.5 rounded"
              style={{ color: statusCfg.color, backgroundColor: statusCfg.bg }}
            >
              {statusCfg.label}
            </span>
          </div>
          <div className={`text-xs ${daysColor}`}>{daysText}</div>
        </div>
      </div>

      {/* 日期与条件 */}
      <div className="px-5 py-4 grid grid-cols-1 md:grid-cols-2 gap-4 border-b border-slate-100 bg-slate-50/40">
        {/* 日期信息 */}
        <div className="flex items-start gap-3">
          <CalendarClock className="w-4 h-4 text-slate-400 mt-0.5" />
          <div className="space-y-1">
            <div className="text-xs text-slate-400">当前到期日期</div>
            <div className="text-sm text-slate-700 font-medium">
              {formatDate(policy.current_end_date)}
            </div>
            <div className="text-xs text-slate-400 mt-2 flex items-center gap-1">
              <RefreshCw className="w-3 h-3" />
              拟议续签日期
            </div>
            <div className="text-sm text-brand-700 font-medium">
              {formatDate(policy.proposed_end_date)}
              <span className="text-xs text-slate-400 font-normal ml-1">
                （续签 {policy.renewal_term_months} 个月）
              </span>
            </div>
          </div>
        </div>

        {/* 续签条件 */}
        <div className="flex items-start gap-3">
          <Settings className="w-4 h-4 text-slate-400 mt-0.5" />
          <div className="space-y-1 flex-1">
            <div className="text-xs text-slate-400">自动续签条件</div>
            <div className="flex flex-wrap gap-2 mt-1">
              <span className="text-xs px-2 py-1 rounded bg-white border border-slate-200 text-slate-600">
                风险评分 {policy.auto_conditions.min_risk_score}-
                {policy.auto_conditions.max_risk_score}
              </span>
              <span className="text-xs px-2 py-1 rounded bg-white border border-slate-200 text-slate-600">
                最大涨幅 {policy.auto_conditions.max_price_increase}%
              </span>
              <span className="text-xs px-2 py-1 rounded bg-white border border-slate-200 text-slate-600">
                通知天数 {policy.notice_days_before} 天
              </span>
              {policy.auto_conditions.requires_approval ? (
                <span className="text-xs px-2 py-1 rounded bg-amber-50 border border-amber-200 text-amber-700">
                  需人工审批
                </span>
              ) : (
                <span className="text-xs px-2 py-1 rounded bg-green-50 border border-green-200 text-green-700">
                  无需审批
                </span>
              )}
            </div>
            {policy.triggered_at && (
              <div className="text-xs text-slate-400 mt-2">
                触发时间：{formatDateTime(policy.triggered_at)}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Checklist 进度与列表 */}
      <div className="px-5 py-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-medium text-slate-700 flex items-center gap-2">
            <ListChecks className="w-4 h-4 text-brand-600" />
            续签检查清单
          </div>
          <span className="text-xs text-slate-400">
            {completedCount} / {totalCount} 已完成
          </span>
        </div>

        {/* 进度条 */}
        <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden mb-3">
          <div
            className="h-full rounded-full bg-brand-500 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Checklist 列表 */}
        <div className="space-y-1.5">
          {checklist.map((item) => (
            <label
              key={item.id}
              className={`flex items-center gap-2 px-2 py-1.5 rounded-lg ${
                item.completed
                  ? 'opacity-60 cursor-default'
                  : 'cursor-pointer hover:bg-slate-50 transition-colors'
              }`}
            >
              <input
                type="checkbox"
                checked={item.completed}
                onChange={() => {
                  if (!item.completed) {
                    onCompleteChecklistItem(item.id);
                  }
                }}
                disabled={item.completed}
                className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer disabled:cursor-default"
              />
              <span
                className={`text-sm flex-1 ${
                  item.completed
                    ? 'line-through text-slate-400'
                    : 'text-slate-700'
                }`}
              >
                {item.label}
              </span>
              {item.required && !item.completed && (
                <span className="text-xs text-red-400">必填</span>
              )}
              {item.required && item.completed && (
                <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
              )}
              {item.completed_at && (
                <span className="text-xs text-slate-300">
                  {formatDateTime(item.completed_at)}
                </span>
              )}
              {actionLoading === `chk-${item.id}` && (
                <RefreshCw className="w-3 h-3 text-brand-500 animate-spin" />
              )}
            </label>
          ))}
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/40 flex items-center justify-end gap-2">
        {canTrigger && (
          <button
            onClick={onTrigger}
            disabled={actionLoading === `trigger-${policy.id}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            {actionLoading === `trigger-${policy.id}` ? '触发中...' : '触发续签'}
          </button>
        )}
        {canCancel && (
          <button
            onClick={onCancel}
            disabled={actionLoading === `cancel-${policy.id}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <XCircle className="w-3.5 h-3.5" />
            {actionLoading === `cancel-${policy.id}` ? '取消中...' : '取消续签'}
          </button>
        )}
        {policy.status === 'completed' && (
          <span className="inline-flex items-center gap-1 text-xs text-green-600 px-3 py-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            已于 {formatDate(policy.completed_at)} 完成
          </span>
        )}
        {policy.status === 'cancelled' && (
          <span className="inline-flex items-center gap-1 text-xs text-slate-400 px-3 py-1.5">
            <XCircle className="w-3.5 h-3.5" />
            续签已取消
          </span>
        )}
      </div>
    </div>
  );
}

// ===== 折叠式创建续签策略表单 =====
function CreateRenewalForm({
  form,
  setForm,
  saving,
  onContractSelect,
  onSubmit,
  onCancel,
}: {
  form: CreateFormState;
  setForm: (f: CreateFormState) => void;
  saving: boolean;
  onContractSelect: (id: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  const update = (patch: Partial<CreateFormState>) =>
    setForm({ ...form, ...patch });

  return (
    <div className="px-5 py-5 border-t border-slate-100 space-y-4 bg-slate-50/30">
      {/* 合同选择 + 策略 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            关联合同 <span className="text-red-500">*</span>
          </label>
          <select
            value={form.contractId}
            onChange={(e) => onContractSelect(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent bg-white"
          >
            <option value="">请选择合同</option>
            {CONTRACT_OPTIONS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}（{c.type}）
              </option>
            ))}
          </select>
          {form.contractTitle && (
            <p className="text-xs text-slate-400 mt-1">
              合同类型：{form.contractType}
            </p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            续签策略
          </label>
          <select
            value={form.strategy}
            onChange={(e) => update({ strategy: e.target.value as RenewalStrategy })}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent bg-white"
          >
            {STRATEGY_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {RENEWAL_STRATEGY_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 续签期限 + 通知天数 + 价格上限 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            续签期限（月）
          </label>
          <input
            type="number"
            min={1}
            max={60}
            value={form.termMonths}
            onChange={(e) =>
              update({
                termMonths: Math.max(1, Math.min(60, Number(e.target.value) || 12)),
              })
            }
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent bg-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            通知天数（到期前）
          </label>
          <input
            type="number"
            min={1}
            max={180}
            value={form.noticeDays}
            onChange={(e) =>
              update({
                noticeDays: Math.max(1, Math.min(180, Number(e.target.value) || 30)),
              })
            }
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent bg-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            价格调整上限（%）
          </label>
          <input
            type="number"
            min={0}
            max={50}
            step={0.5}
            value={form.priceCap}
            onChange={(e) =>
              update({
                priceCap: Math.max(0, Math.min(50, Number(e.target.value) || 5)),
              })
            }
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent bg-white"
          />
        </div>
      </div>

      {/* 自动续签条件 */}
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="text-sm font-medium text-slate-700 flex items-center gap-2 mb-3">
          <Settings className="w-4 h-4 text-brand-600" />
          自动续签条件
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              最低风险评分
            </label>
            <input
              type="number"
              min={0}
              max={100}
              value={form.minRiskScore}
              onChange={(e) =>
                update({
                  minRiskScore: Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                })
              }
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent bg-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              最高风险评分
            </label>
            <input
              type="number"
              min={0}
              max={100}
              value={form.maxRiskScore}
              onChange={(e) =>
                update({
                  maxRiskScore: Math.max(0, Math.min(100, Number(e.target.value) || 60)),
                })
              }
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent bg-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              最大价格涨幅（%）
            </label>
            <input
              type="number"
              min={0}
              max={50}
              step={0.5}
              value={form.maxPriceIncrease}
              onChange={(e) =>
                update({
                  maxPriceIncrease: Math.max(0, Math.min(50, Number(e.target.value) || 5)),
                })
              }
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent bg-white"
            />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.requiresApproval}
                onChange={(e) => update({ requiresApproval: e.target.checked })}
                className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              />
              <span className="text-sm text-slate-700">需要人工审批</span>
            </label>
          </div>
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 bg-white hover:bg-slate-100 border border-slate-200 transition-colors"
        >
          取消
        </button>
        <button
          onClick={onSubmit}
          disabled={saving || !form.contractId}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Plus className="w-4 h-4" />
          {saving ? '创建中...' : '创建策略'}
        </button>
      </div>
    </div>
  );
}
