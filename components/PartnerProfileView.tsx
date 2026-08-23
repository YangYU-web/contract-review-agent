'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Building2,
  Users,
  Star,
  TrendingUp,
  TrendingDown,
  Mail,
  Phone,
  Search,
  Filter,
  Shield,
  Plus,
  ChevronDown,
  MapPin,
} from 'lucide-react';
import {
  PartnerProfile,
  PartnerCreditHistory,
  PartnerType,
  PartnerStatus,
  CreditRating,
  PARTNER_TYPE_LABELS,
  PARTNER_STATUS_CONFIG,
  CREDIT_RATING_CONFIG,
} from '@/lib/types';

// 带 API 动态计算的风险评分的合作方类型
type PartnerWithScore = PartnerProfile & { risk_score: number };

// ===== 类型标签样式 =====
const TYPE_BADGE: Record<PartnerType, { cls: string }> = {
  supplier: { cls: 'bg-brand-50 text-brand-700 border-brand-200' },
  customer: { cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  both: { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
};

// ===== 信用历史影响样式 =====
const IMPACT_CONFIG: Record<
  PartnerCreditHistory['impact'],
  { label: string; cls: string; icon: typeof TrendingUp; dot: string }
> = {
  positive: {
    label: '正面',
    cls: 'text-green-600 bg-green-50',
    icon: TrendingUp,
    dot: 'bg-green-500',
  },
  negative: {
    label: '负面',
    cls: 'text-red-600 bg-red-50',
    icon: TrendingDown,
    dot: 'bg-red-500',
  },
  neutral: {
    label: '中性',
    cls: 'text-slate-500 bg-slate-100',
    icon: Star,
    dot: 'bg-slate-300',
  },
};

// ===== 下拉选项 =====
const TYPE_OPTIONS: PartnerType[] = ['supplier', 'customer', 'both'];
const STATUS_OPTIONS: PartnerStatus[] = ['active', 'inactive', 'blacklisted'];
const RATING_OPTIONS: CreditRating[] = [
  'aaa',
  'aa',
  'a',
  'bbb',
  'bb',
  'b',
  'c',
];
const CURRENCY_OPTIONS = ['CNY', 'USD', 'EUR', 'GBP', 'JPY'];

// ===== 工具函数 =====

// 货币格式化
function formatCurrency(value?: number, currency?: string): string {
  if (value === undefined || value === null || Number.isNaN(value))
    return '-';
  const symbols: Record<string, string> = {
    CNY: '¥',
    USD: '$',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
  };
  const symbol =
    symbols[currency || 'CNY'] || (currency ? currency + ' ' : '¥');
  return `${symbol}${value.toLocaleString('zh-CN')}`;
}

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

// 风险评分颜色
function riskScoreColor(score: number): string {
  if (score >= 70) return 'text-red-600';
  if (score >= 40) return 'text-amber-600';
  return 'text-green-600';
}

// 风险评分背景色
function riskScoreBg(score: number): string {
  if (score >= 70) return 'bg-red-50';
  if (score >= 40) return 'bg-amber-50';
  return 'bg-green-50';
}

// ===== 表单状态 =====
interface PartnerFormState {
  name: string;
  type: PartnerType;
  industry: string;
  registered_capital: number;
  currency: string;
  legal_representative: string;
  contact_person: string;
  contact_email: string;
  contact_phone: string;
  address: string;
  tax_id: string;
  credit_rating: CreditRating;
  established_date: string;
  notes: string;
}

const EMPTY_FORM: PartnerFormState = {
  name: '',
  type: 'supplier',
  industry: '',
  registered_capital: 0,
  currency: 'CNY',
  legal_representative: '',
  contact_person: '',
  contact_email: '',
  contact_phone: '',
  address: '',
  tax_id: '',
  credit_rating: 'bbb',
  established_date: '',
  notes: '',
};

// ===== 统计类型 =====
interface Stats {
  total: number;
  activeCount: number;
  avgCreditRating: string;
  totalContractValue: number;
  avgRiskScore: number;
  blacklistedCount: number;
}

// ===== 主组件 =====
export default function PartnerProfileView() {
  const [partners, setPartners] = useState<PartnerWithScore[]>([]);
  const [creditHistories, setCreditHistories] = useState<
    PartnerCreditHistory[]
  >([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // 搜索与过滤
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<PartnerType | ''>('');
  const [filterStatus, setFilterStatus] = useState<PartnerStatus | ''>('');
  const [filterRating, setFilterRating] = useState<CreditRating | ''>('');

  // 展开的合作方 ID
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // 创建表单
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<PartnerFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // 加载合作方列表
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/partners', { cache: 'no-store' });
      if (!res.ok) throw new Error('加载合作方档案失败');
      const data = await res.json();
      setPartners(data.partners || []);
      setCreditHistories(data.creditHistories || []);
      setStats(data.stats || null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : '加载合作方档案失败'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // 前端过滤（搜索 + 筛选）
  const filteredPartners = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return partners.filter((p) => {
      // 关键词搜索
      if (q) {
        const haystack = [
          p.name,
          p.contact_person,
          p.contact_email,
          p.industry,
          p.legal_representative,
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      // 类型过滤
      if (filterType && p.type !== filterType) return false;
      // 状态过滤
      if (filterStatus && p.status !== filterStatus) return false;
      // 最低信用评级过滤
      if (filterRating) {
        const rank: Record<CreditRating, number> = {
          aaa: 7,
          aa: 6,
          a: 5,
          bbb: 4,
          bb: 3,
          b: 2,
          c: 1,
        };
        if (rank[p.credit_rating] < rank[filterRating]) return false;
      }
      return true;
    });
  }, [partners, searchQuery, filterType, filterStatus, filterRating]);

  // 切换创建表单展开/折叠
  const toggleForm = () => {
    setShowForm((prev) => !prev);
    if (showForm) {
      setForm(EMPTY_FORM);
    }
  };

  // 提交创建
  const handleCreate = async () => {
    if (!form.name.trim()) {
      setError('请填写合作方名称');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/partners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          name: form.name,
          type: form.type,
          industry: form.industry,
          registered_capital: form.registered_capital,
          currency: form.currency,
          legal_representative: form.legal_representative,
          contact_person: form.contact_person,
          contact_email: form.contact_email,
          contact_phone: form.contact_phone,
          address: form.address,
          tax_id: form.tax_id,
          credit_rating: form.credit_rating,
          established_date: form.established_date,
          notes: form.notes,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || '创建失败');
      }
      const data = await res.json();
      setPartners(data.partners || []);
      setStats(data.stats || null);
      setCreditHistories(data.creditHistories || []);
      setShowForm(false);
      setForm(EMPTY_FORM);
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建失败');
    } finally {
      setSaving(false);
    }
  };

  // 更新合作方状态
  const handleUpdateStatus = async (
    partner: PartnerWithScore,
    newStatus: PartnerStatus
  ) => {
    if (newStatus === 'blacklisted') {
      const reason = prompt(
        `请输入将「${partner.name}」列入黑名单的原因：`
      );
      if (reason === null) return;
      setActionLoading(`status-${partner.id}`);
      setError(null);
      try {
        const res = await fetch('/api/partners', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update_status',
            id: partner.id,
            status: newStatus,
            reason: reason || undefined,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || '状态更新失败');
        }
        const data = await res.json();
        setPartners(data.partners || []);
        setStats(data.stats || null);
        setCreditHistories(data.creditHistories || []);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : '状态更新失败'
        );
      } finally {
        setActionLoading(null);
      }
    } else {
      if (
        !confirm(`确认将「${partner.name}」状态变更为「${newStatus === 'active' ? '合作中' : '已停用'}」？`)
      )
        return;
      setActionLoading(`status-${partner.id}`);
      setError(null);
      try {
        const res = await fetch('/api/partners', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update_status',
            id: partner.id,
            status: newStatus,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || '状态更新失败');
        }
        const data = await res.json();
        setPartners(data.partners || []);
        setStats(data.stats || null);
        setCreditHistories(data.creditHistories || []);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : '状态更新失败'
        );
      } finally {
        setActionLoading(null);
      }
    }
  };

  // 更新合作方信用评级
  const handleUpdateRating = async (
    partner: PartnerWithScore,
    newRating: CreditRating
  ) => {
    const reason = prompt(
      `请输入将「${partner.name}」信用评级更新为 ${CREDIT_RATING_CONFIG[newRating].label} 的原因：`
    );
    if (reason === null) return;
    setActionLoading(`rating-${partner.id}`);
    setError(null);
    try {
      const res = await fetch('/api/partners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_rating',
          id: partner.id,
          credit_rating: newRating,
          reason: reason || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || '评级更新失败');
      }
      const data = await res.json();
      setPartners(data.partners || []);
      setStats(data.stats || null);
      setCreditHistories(data.creditHistories || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '评级更新失败');
    } finally {
      setActionLoading(null);
    }
  };

  // 切换展开
  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  // 清除所有过滤器
  const clearFilters = () => {
    setSearchQuery('');
    setFilterType('');
    setFilterStatus('');
    setFilterRating('');
  };

  const hasFilters =
    searchQuery || filterType || filterStatus || filterRating;

  // ===== 顶部统计卡片 =====
  const statCards = [
    {
      label: '总合作方',
      value: stats?.total ?? 0,
      icon: Users,
      color: 'text-brand-600',
      bg: 'bg-brand-50',
    },
    {
      label: '合作中',
      value: stats?.activeCount ?? 0,
      icon: Shield,
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
    {
      label: '黑名单',
      value: stats?.blacklistedCount ?? 0,
      icon: Shield,
      color: 'text-red-600',
      bg: 'bg-red-50',
    },
    {
      label: '平均风险评分',
      value: stats?.avgRiskScore ?? 0,
      icon: TrendingUp,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
    {
      label: '总合同金额',
      value: formatCurrency(stats?.totalContractValue, 'CNY'),
      icon: Building2,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
  ];

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm flex items-center gap-2">
          <Shield className="w-4 h-4 shrink-0" />
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-red-400 hover:text-red-600"
          >
            <ChevronDown className="w-4 h-4 rotate-90" />
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
                  className={`w-10 h-10 rounded-lg ${card.bg} flex items-center justify-center shrink-0`}
                >
                  <Icon className={`w-5 h-5 ${card.color}`} />
                </div>
                <div className="min-w-0">
                  <div className="text-xl font-bold text-slate-800 truncate">
                    {card.value}
                  </div>
                  <div className="text-xs text-slate-400">
                    {card.label}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ===== 搜索与过滤栏 ===== */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          {/* 搜索框 */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索公司名称、联系人、行业..."
              className="w-full pl-10 pr-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
          </div>

          {/* 过滤器 */}
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="w-4 h-4 text-slate-400 shrink-0" />
            {/* 类型过滤 */}
            <select
              value={filterType}
              onChange={(e) =>
                setFilterType(e.target.value as PartnerType | '')
              }
              className="px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent bg-white"
            >
              <option value="">全部类型</option>
              {TYPE_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {PARTNER_TYPE_LABELS[t]}
                </option>
              ))}
            </select>

            {/* 状态过滤 */}
            <select
              value={filterStatus}
              onChange={(e) =>
                setFilterStatus(e.target.value as PartnerStatus | '')
              }
              className="px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent bg-white"
            >
              <option value="">全部状态</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {PARTNER_STATUS_CONFIG[s].label}
                </option>
              ))}
            </select>

            {/* 信用评级过滤 */}
            <select
              value={filterRating}
              onChange={(e) =>
                setFilterRating(e.target.value as CreditRating | '')
              }
              className="px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent bg-white"
            >
              <option value="">全部评级</option>
              {RATING_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  ≥ {CREDIT_RATING_CONFIG[r].label}
                </option>
              ))}
            </select>

            {/* 清除过滤 */}
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="px-3 py-2 rounded-lg text-xs text-slate-500 hover:text-brand-600 hover:bg-brand-50 transition-colors"
              >
                清除
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ===== 折叠式创建合作方表单 ===== */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <button
          onClick={toggleForm}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50/60 transition-colors"
        >
          <span className="font-semibold text-slate-800 flex items-center gap-2">
            <Plus className="w-4 h-4 text-brand-600" />
            新建合作方档案
          </span>
          <ChevronDown
            className={`w-5 h-5 text-slate-400 transition-transform ${
              showForm ? 'rotate-180' : ''
            }`}
          />
        </button>
        {showForm && (
          <CreatePartnerForm
            form={form}
            setForm={setForm}
            saving={saving}
            onSubmit={handleCreate}
            onCancel={() => {
              setShowForm(false);
              setForm(EMPTY_FORM);
            }}
          />
        )}
      </div>

      {/* ===== 合作方列表 ===== */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-brand-600" />
            合作方档案列表
          </h3>
          <span className="text-xs text-slate-400">
            共 {filteredPartners.length} 个合作方
          </span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm text-slate-400">
            加载合作方档案中...
          </div>
        ) : filteredPartners.length === 0 ? (
          <div className="py-12 text-center">
            <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-400">
              {hasFilters ? '无匹配的合作方档案' : '暂无合作方档案，请新建'}
            </p>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {filteredPartners.map((partner) => (
              <PartnerCard
                key={partner.id}
                partner={partner}
                creditHistories={creditHistories.filter(
                  (h) => h.partner_id === partner.id
                )}
                isExpanded={expandedId === partner.id}
                actionLoading={actionLoading}
                onToggleExpand={() => toggleExpand(partner.id)}
                onUpdateStatus={(status) =>
                  handleUpdateStatus(partner, status)
                }
                onUpdateRating={(rating) =>
                  handleUpdateRating(partner, rating)
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ===== 合作方卡片 =====
function PartnerCard({
  partner,
  creditHistories,
  isExpanded,
  actionLoading,
  onToggleExpand,
  onUpdateStatus,
  onUpdateRating,
}: {
  partner: PartnerWithScore;
  creditHistories: PartnerCreditHistory[];
  isExpanded: boolean;
  actionLoading: string | null;
  onToggleExpand: () => void;
  onUpdateStatus: (status: PartnerStatus) => void;
  onUpdateRating: (rating: CreditRating) => void;
}) {
  const typeBadge = TYPE_BADGE[partner.type];
  const statusCfg = PARTNER_STATUS_CONFIG[partner.status];
  const ratingCfg = CREDIT_RATING_CONFIG[partner.credit_rating];

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden hover:shadow-md transition-shadow">
      {/* ===== 卡片头部 ===== */}
      <div
        className="px-5 py-4 cursor-pointer"
        onClick={onToggleExpand}
      >
        <div className="flex items-start justify-between gap-3 flex-wrap">
          {/* 左侧：名称 + 标签 */}
          <div className="flex items-center gap-2 flex-wrap">
            <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="font-semibold text-slate-800">
              {partner.name}
            </span>
            {/* 类型标签 */}
            <span
              className={`inline-flex items-center text-xs px-2 py-0.5 rounded border ${typeBadge.cls}`}
            >
              {PARTNER_TYPE_LABELS[partner.type]}
            </span>
            {/* 状态标签 */}
            <span
              className="inline-flex items-center text-xs px-2 py-0.5 rounded"
              style={{
                color: statusCfg.color,
                backgroundColor: statusCfg.bg,
              }}
            >
              {statusCfg.label}
            </span>
            {/* 信用评级标签 */}
            <span
              className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded"
              style={{
                color: ratingCfg.color,
                backgroundColor: `${ratingCfg.color}1a`,
              }}
            >
              <Star className="w-3 h-3" />
              {ratingCfg.label}
            </span>
          </div>

          {/* 右侧：风险评分 + 展开 */}
          <div className="flex items-center gap-3">
            <div
              className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded ${riskScoreBg(
                partner.risk_score
              )} ${riskScoreColor(partner.risk_score)}`}
            >
              {partner.risk_score >= 70 ? (
                <TrendingDown className="w-3 h-3" />
              ) : (
                <TrendingUp className="w-3 h-3" />
              )}
              风险 {partner.risk_score}
            </div>
            <ChevronDown
              className={`w-5 h-5 text-slate-400 transition-transform ${
                isExpanded ? 'rotate-180' : ''
              }`}
            />
          </div>
        </div>
      </div>

      {/* ===== 卡片信息区 ===== */}
      <div className="px-5 pb-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* 行业 */}
        <div className="flex items-center gap-2">
          <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <div>
            <div className="text-xs text-slate-400">行业</div>
            <div className="text-sm text-slate-700">
              {partner.industry || '-'}
            </div>
          </div>
        </div>
        {/* 注册资本 */}
        <div className="flex items-center gap-2">
          <Shield className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <div>
            <div className="text-xs text-slate-400">注册资本</div>
            <div className="text-sm text-slate-700">
              {formatCurrency(
                partner.registered_capital,
                partner.currency
              )}
            </div>
          </div>
        </div>
        {/* 法定代表人 */}
        <div className="flex items-center gap-2">
          <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <div>
            <div className="text-xs text-slate-400">法定代表人</div>
            <div className="text-sm text-slate-700">
              {partner.legal_representative || '-'}
            </div>
          </div>
        </div>
        {/* 合同数 */}
        <div className="flex items-center gap-2">
          <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <div>
            <div className="text-xs text-slate-400">合同数</div>
            <div className="text-sm text-slate-700 font-medium">
              {partner.contract_count} 份
            </div>
          </div>
        </div>
      </div>

      {/* ===== 合同金额 + 联系方式摘要 ===== */}
      <div className="px-5 pb-4 flex items-center justify-between gap-3 flex-wrap border-t border-slate-50 pt-3">
        {/* 合同总金额 */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">合同总金额</span>
          <span className="text-sm font-semibold text-slate-700">
            {formatCurrency(
              partner.total_contract_value,
              partner.currency
            )}
          </span>
          <span className="text-xs text-slate-300">·</span>
          <span className="text-xs text-slate-400">平均风险</span>
          <span
            className={`text-sm font-semibold ${riskScoreColor(
              partner.avg_risk_score
            )}`}
          >
            {partner.avg_risk_score}
          </span>
        </div>

        {/* 联系人 + 邮箱 + 电话 */}
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            {partner.contact_person || '-'}
          </span>
          <span className="flex items-center gap-1">
            <Mail className="w-3 h-3" />
            {partner.contact_email || '-'}
          </span>
          <span className="flex items-center gap-1">
            <Phone className="w-3 h-3" />
            {partner.contact_phone || '-'}
          </span>
        </div>
      </div>

      {/* ===== 展开详情：信用历史时间线 + 操作 ===== */}
      {isExpanded && (
        <PartnerDetail
          partner={partner}
          creditHistories={creditHistories}
          actionLoading={actionLoading}
          onUpdateStatus={onUpdateStatus}
          onUpdateRating={onUpdateRating}
        />
      )}
    </div>
  );
}

// ===== 合作方详情面板 =====
function PartnerDetail({
  partner,
  creditHistories,
  actionLoading,
  onUpdateStatus,
  onUpdateRating,
}: {
  partner: PartnerWithScore;
  creditHistories: PartnerCreditHistory[];
  actionLoading: string | null;
  onUpdateStatus: (status: PartnerStatus) => void;
  onUpdateRating: (rating: CreditRating) => void;
}) {
  return (
    <div className="border-t border-slate-100 bg-slate-50/40 px-5 py-4 space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ===== 基本信息 + 联系方式 ===== */}
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <h4 className="text-sm font-semibold text-slate-800 flex items-center gap-2 mb-3">
            <Building2 className="w-4 h-4 text-brand-600" />
            基本信息
          </h4>
          <div className="space-y-2 text-sm">
            <DetailRow
              label="成立日期"
              value={formatDate(partner.established_date)}
            />
            <DetailRow
              label="注册资本"
              value={formatCurrency(
                partner.registered_capital,
                partner.currency
              )}
            />
            <DetailRow
              label="法定代表人"
              value={partner.legal_representative || '-'}
            />
            <DetailRow
              label="税务登记号"
              value={partner.tax_id || '-'}
            />
            <DetailRow
              label="银行账号"
              value={partner.bank_account || '未绑定'}
            />
            <DetailRow
              label="创建时间"
              value={formatDate(partner.created_at)}
            />
            <DetailRow
              label="最后合作"
              value={formatDate(partner.last_contract_date)}
            />
          </div>

          {/* 联系方式 */}
          <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
            <div className="text-xs font-semibold text-slate-500 mb-2 flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />
              联系方式
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Users className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-400 text-xs">联系人</span>
              <span className="text-slate-700">
                {partner.contact_person || '-'}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Mail className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-400 text-xs">邮箱</span>
              <span className="text-slate-700 truncate">
                {partner.contact_email || '-'}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Phone className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-400 text-xs">电话</span>
              <span className="text-slate-700">
                {partner.contact_phone || '-'}
              </span>
            </div>
            <div className="flex items-start gap-2 text-sm">
              <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5" />
              <span className="text-slate-400 text-xs">地址</span>
              <span className="text-slate-700 leading-relaxed">
                {partner.address || '-'}
              </span>
            </div>
          </div>

          {/* 备注 */}
          {partner.notes && (
            <div className="mt-3 pt-3 border-t border-slate-100">
              <div className="text-xs text-slate-400 mb-1">备注</div>
              <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">
                {partner.notes}
              </p>
            </div>
          )}
        </div>

        {/* ===== 信用历史时间线 ===== */}
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <h4 className="text-sm font-semibold text-slate-800 flex items-center gap-2 mb-3">
            <Star className="w-4 h-4 text-brand-600" />
            信用历史时间线
          </h4>
          {creditHistories.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-400">
              暂无信用变化记录
            </div>
          ) : (
            <div className="space-y-3">
              {creditHistories.map((h) => {
                const impact = IMPACT_CONFIG[h.impact];
                const Icon = impact.icon;
                return (
                  <div
                    key={h.id}
                    className="relative pl-6 border-l-2 border-slate-100 last:border-l-transparent"
                  >
                    {/* 时间点圆点 */}
                    <div
                      className={`absolute -left-[7px] top-0.5 w-3 h-3 rounded-full border-2 border-white ${impact.dot}`}
                    />
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Icon className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-xs font-medium text-slate-700">
                        {h.event}
                      </span>
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded ${impact.cls}`}
                      >
                        {impact.label}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 mb-1">
                      {formatDate(h.date)} ·{' '}
                      {CREDIT_RATING_CONFIG[h.rating_before].label}
                      <span className="mx-1">→</span>
                      {CREDIT_RATING_CONFIG[h.rating_after].label}
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      {h.description}
                    </p>
                  </div>
                );
              })}
            </div>
          )}

          {/* 相关合同统计 */}
          <div className="mt-4 pt-3 border-t border-slate-100">
            <h5 className="text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5 text-slate-400" />
              相关合同统计
            </h5>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-slate-50 py-2">
                <div className="text-lg font-bold text-slate-700">
                  {partner.contract_count}
                </div>
                <div className="text-xs text-slate-400">合同总数</div>
              </div>
              <div className="rounded-lg bg-red-50 py-2">
                <div className="text-lg font-bold text-red-600">
                  {partner.high_risk_count}
                </div>
                <div className="text-xs text-slate-400">高风险</div>
              </div>
              <div className="rounded-lg bg-amber-50 py-2">
                <div
                  className={`text-lg font-bold ${riskScoreColor(
                    partner.avg_risk_score
                  )}`}
                >
                  {partner.avg_risk_score}
                </div>
                <div className="text-xs text-slate-400">平均风险</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ===== 操作区：状态变更 + 评级变更 ===== */}
      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <h4 className="text-sm font-semibold text-slate-800 flex items-center gap-2 mb-3">
          <Shield className="w-4 h-4 text-brand-600" />
          档案操作
        </h4>
        <div className="flex flex-wrap items-center gap-2">
          {/* 状态变更 */}
          <span className="text-xs text-slate-400 mr-1">变更状态：</span>
          {(
            ['active', 'inactive', 'blacklisted'] as PartnerStatus[]
          ).map((s) => {
            const isCurrent = partner.status === s;
            const cfg = PARTNER_STATUS_CONFIG[s];
            return (
              <button
                key={s}
                onClick={() => !isCurrent && onUpdateStatus(s)}
                disabled={isCurrent || actionLoading === `status-${partner.id}`}
                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors disabled:opacity-40 disabled:cursor-default ${
                  isCurrent
                    ? 'border-slate-300 bg-slate-50 text-slate-500'
                    : 'border-slate-200 hover:border-brand-300 hover:bg-brand-50 text-slate-600'
                }`}
                style={
                  isCurrent
                    ? {
                        color: cfg.color,
                        backgroundColor: cfg.bg,
                      }
                    : undefined
                }
              >
                <Shield className="w-3 h-3" />
                {cfg.label}
                {isCurrent && ' (当前)'}
              </button>
            );
          })}

          <span className="w-px h-5 bg-slate-200 mx-2" />

          {/* 评级变更 */}
          <span className="text-xs text-slate-400 mr-1">变更评级：</span>
          {RATING_OPTIONS.map((r) => {
            const isCurrent = partner.credit_rating === r;
            const cfg = CREDIT_RATING_CONFIG[r];
            return (
              <button
                key={r}
                onClick={() => !isCurrent && onUpdateRating(r)}
                disabled={isCurrent || actionLoading === `rating-${partner.id}`}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-colors disabled:opacity-40 disabled:cursor-default ${
                  isCurrent
                    ? 'border-slate-300 bg-slate-50'
                    : 'border-slate-200 hover:border-brand-300 hover:bg-brand-50'
                }`}
                style={{
                  color: cfg.color,
                  backgroundColor: isCurrent
                    ? `${cfg.color}1a`
                    : undefined,
                }}
              >
                <Star className="w-3 h-3" />
                {cfg.label}
              </button>
            );
          })}

          {/* Loading 指示器 */}
          {(actionLoading === `status-${partner.id}` ||
            actionLoading === `rating-${partner.id}`) && (
            <span className="text-xs text-brand-500 ml-2 inline-flex items-center gap-1">
              <TrendingUp className="w-3 h-3 animate-pulse" />
              处理中...
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ===== 详情行 =====
function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-slate-400">{label}</span>
      <span className="text-slate-700 text-right">{value}</span>
    </div>
  );
}

// ===== 折叠式创建合作方表单 =====
function CreatePartnerForm({
  form,
  setForm,
  saving,
  onSubmit,
  onCancel,
}: {
  form: PartnerFormState;
  setForm: (f: PartnerFormState) => void;
  saving: boolean;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  const update = (patch: Partial<PartnerFormState>) =>
    setForm({ ...form, ...patch });

  return (
    <div className="px-5 py-5 border-t border-slate-100 space-y-4 bg-slate-50/30">
      {/* 名称 + 类型 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            合作方名称 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => update({ name: e.target.value })}
            placeholder="如：上海科创制造有限公司"
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent bg-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            合作方类型
          </label>
          <div className="grid grid-cols-3 gap-2">
            {TYPE_OPTIONS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => update({ type: t })}
                className={`px-2 py-2 rounded-lg text-xs font-medium border transition-colors ${
                  form.type === t
                    ? 'border-brand-500 bg-brand-50 text-brand-700'
                    : 'border-slate-200 text-slate-600 hover:border-slate-300 bg-white'
                }`}
              >
                {PARTNER_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 行业 + 信用评级 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            所属行业
          </label>
          <input
            type="text"
            value={form.industry}
            onChange={(e) => update({ industry: e.target.value })}
            placeholder="如：高端制造"
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent bg-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            信用评级
          </label>
          <select
            value={form.credit_rating}
            onChange={(e) =>
              update({ credit_rating: e.target.value as CreditRating })
            }
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent bg-white"
          >
            {RATING_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {CREDIT_RATING_CONFIG[r].label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 注册资本 + 货币 + 成立日期 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            注册资本
          </label>
          <input
            type="number"
            min={0}
            value={form.registered_capital}
            onChange={(e) =>
              update({
                registered_capital: Math.max(
                  0,
                  Number(e.target.value) || 0
                ),
              })
            }
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent bg-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            币种
          </label>
          <select
            value={form.currency}
            onChange={(e) => update({ currency: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent bg-white"
          >
            {CURRENCY_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            成立日期
          </label>
          <input
            type="date"
            value={form.established_date}
            onChange={(e) =>
              update({ established_date: e.target.value })
            }
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent bg-white"
          />
        </div>
      </div>

      {/* 法定代表人 + 联系人 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            法定代表人
          </label>
          <input
            type="text"
            value={form.legal_representative}
            onChange={(e) =>
              update({ legal_representative: e.target.value })
            }
            placeholder="如：王建国"
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent bg-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            联系人
          </label>
          <input
            type="text"
            value={form.contact_person}
            onChange={(e) => update({ contact_person: e.target.value })}
            placeholder="如：李伟"
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent bg-white"
          />
        </div>
      </div>

      {/* 邮箱 + 电话 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            邮箱
          </label>
          <input
            type="email"
            value={form.contact_email}
            onChange={(e) => update({ contact_email: e.target.value })}
            placeholder="如：liwei@example.com"
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent bg-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            联系电话
          </label>
          <input
            type="text"
            value={form.contact_phone}
            onChange={(e) => update({ contact_phone: e.target.value })}
            placeholder="如：021-55667788"
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent bg-white"
          />
        </div>
      </div>

      {/* 税务号 + 地址 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            税务登记号
          </label>
          <input
            type="text"
            value={form.tax_id}
            onChange={(e) => update({ tax_id: e.target.value })}
            placeholder="统一社会信用代码"
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent bg-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            注册地址
          </label>
          <input
            type="text"
            value={form.address}
            onChange={(e) => update({ address: e.target.value })}
            placeholder="详细地址"
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent bg-white"
          />
        </div>
      </div>

      {/* 备注 */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          备注
        </label>
        <textarea
          value={form.notes}
          onChange={(e) => update({ notes: e.target.value })}
          placeholder="合作情况、特殊约定等"
          rows={2}
          className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent resize-none bg-white"
        />
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
          disabled={saving || !form.name.trim()}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Plus className="w-4 h-4" />
          {saving ? '创建中...' : '创建合作方'}
        </button>
      </div>
    </div>
  );
}
