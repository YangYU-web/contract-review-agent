'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Building2,
  CreditCard,
  Plus,
  Edit3,
  Trash2,
  Shield,
  ShieldOff,
  TrendingUp,
  TrendingDown,
  Phone,
  Mail,
  MapPin,
  FileText,
  AlertTriangle,
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

// 类型标签样式
const TYPE_BADGE: Record<PartnerType, { cls: string }> = {
  supplier: { cls: 'bg-brand-50 text-brand-700 border-brand-200' },
  customer: { cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  both: { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
};

// 信用历史影响样式
const IMPACT_CONFIG: Record<
  PartnerCreditHistory['impact'],
  { label: string; cls: string; icon: typeof TrendingUp }
> = {
  positive: { label: '正面', cls: 'text-green-600 bg-green-50', icon: TrendingUp },
  negative: { label: '负面', cls: 'text-red-600 bg-red-50', icon: TrendingDown },
  neutral: { label: '中性', cls: 'text-slate-500 bg-slate-100', icon: FileText },
};

// 类型/评级下拉选项
const TYPE_OPTIONS: PartnerType[] = ['supplier', 'customer', 'both'];
const RATING_OPTIONS: CreditRating[] = ['aaa', 'aa', 'a', 'bbb', 'bb', 'b', 'c'];
const CURRENCY_OPTIONS = ['CNY', 'USD', 'EUR', 'GBP', 'JPY'];

// 货币格式化
function formatCurrency(value?: number, currency?: string): string {
  if (value === undefined || value === null || Number.isNaN(value)) return '-';
  const symbols: Record<string, string> = {
    CNY: '¥',
    USD: '$',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
  };
  const symbol = symbols[currency || 'CNY'] || (currency ? currency + ' ' : '¥');
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

// 表单状态
interface PartnerFormState {
  id?: string;
  name: string;
  type: PartnerType;
  status: PartnerStatus;
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
  status: 'active',
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

interface Stats {
  total: number;
  activeCount: number;
  avgRating: CreditRating;
  totalContractValue: number;
  byType: Record<PartnerType, number>;
}

export default function PartnerManager() {
  const [partners, setPartners] = useState<PartnerWithScore[]>([]);
  const [creditHistories, setCreditHistories] = useState<PartnerCreditHistory[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // 展开的合作方 ID
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // 创建/编辑表单
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
      setError(err instanceof Error ? err.message : '加载合作方档案失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // 打开新建表单
  const openCreateForm = () => {
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  // 打开编辑表单
  const openEditForm = (partner: PartnerWithScore) => {
    setForm({
      id: partner.id,
      name: partner.name,
      type: partner.type,
      status: partner.status,
      industry: partner.industry,
      registered_capital: partner.registered_capital,
      currency: partner.currency,
      legal_representative: partner.legal_representative,
      contact_person: partner.contact_person,
      contact_email: partner.contact_email,
      contact_phone: partner.contact_phone,
      address: partner.address,
      tax_id: partner.tax_id,
      credit_rating: partner.credit_rating,
      established_date: partner.established_date,
      notes: partner.notes,
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setForm(EMPTY_FORM);
  };

  // 提交创建/更新
  const handleSubmit = async () => {
    if (!form.name.trim()) {
      setError('请填写合作方名称');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const isEdit = !!form.id;
      const res = await fetch('/api/partners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          isEdit
            ? {
                action: 'update',
                id: form.id,
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
                notes: form.notes,
              }
            : {
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
              }
        ),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || '保存失败');
      }
      const data = await res.json();
      setPartners(data.partners || []);
      setStats(data.stats || null);
      closeForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  // 拉黑
  const handleBlacklist = async (partner: PartnerWithScore) => {
    const reason = prompt(`请输入将「${partner.name}」列入黑名单的原因：`);
    if (reason === null) return;
    setActionLoading(`blacklist-${partner.id}`);
    setError(null);
    try {
      const res = await fetch('/api/partners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'blacklist',
          id: partner.id,
          reason: reason || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || '拉黑失败');
      }
      const data = await res.json();
      setPartners(data.partners || []);
      setStats(data.stats || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '拉黑失败');
    } finally {
      setActionLoading(null);
    }
  };

  // 解除黑名单
  const handleRemoveBlacklist = async (partner: PartnerWithScore) => {
    if (!confirm(`确认解除「${partner.name}」的黑名单状态？`)) return;
    setActionLoading(`remove-${partner.id}`);
    setError(null);
    try {
      const res = await fetch('/api/partners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'remove_blacklist',
          id: partner.id,
          new_rating: 'bb',
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || '解除黑名单失败');
      }
      const data = await res.json();
      setPartners(data.partners || []);
      setStats(data.stats || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '解除黑名单失败');
    } finally {
      setActionLoading(null);
    }
  };

  // 删除
  const handleDelete = async (partner: PartnerWithScore) => {
    if (!confirm(`确定要删除合作方「${partner.name}」吗？此操作不可恢复。`)) return;
    setActionLoading(`delete-${partner.id}`);
    setError(null);
    try {
      const res = await fetch('/api/partners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', id: partner.id }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || '删除失败');
      }
      const data = await res.json();
      setPartners(data.partners || []);
      setStats(data.stats || null);
      if (expandedId === partner.id) setExpandedId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败');
    } finally {
      setActionLoading(null);
    }
  };

  // 切换展开
  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  // 顶部统计卡片
  const statCards = [
    {
      label: '总合作方',
      value: stats?.total ?? 0,
      icon: Users,
      color: 'text-brand-600',
      bg: 'bg-brand-50',
    },
    {
      label: '活跃合作方',
      value: stats?.activeCount ?? 0,
      icon: Shield,
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
    {
      label: '平均信用评级',
      value: stats?.avgRating ? CREDIT_RATING_CONFIG[stats.avgRating].label : '-',
      icon: CreditCard,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: '总合同金额',
      value: formatCurrency(stats?.totalContractValue, 'CNY'),
      icon: Building2,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
  ];

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-red-400 hover:text-red-600"
          >
            <AlertTriangle className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ===== 顶部统计 + 新建按钮 ===== */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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
                <div className="min-w-0">
                  <div className="text-xl font-bold text-slate-800 truncate">
                    {card.value}
                  </div>
                  <div className="text-xs text-slate-400">{card.label}</div>
                </div>
              </div>
            </div>
          );
        })}

        {/* 新建合作方按钮 */}
        <button
          onClick={openCreateForm}
          className="bg-brand-600 hover:bg-brand-700 rounded-xl border border-brand-600 p-4 text-left transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
              <Plus className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-base font-semibold text-white">
                新建合作方
              </div>
              <div className="text-xs text-brand-100">添加供应商/客户档案</div>
            </div>
          </div>
        </button>
      </div>

      {/* ===== 档案列表表格 ===== */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-brand-600" />
            合作方档案
          </h3>
          <span className="text-xs text-slate-400">
            共 {partners.length} 个合作方
          </span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm text-slate-400">
            加载合作方档案中...
          </div>
        ) : partners.length === 0 ? (
          <div className="py-12 text-center">
            <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-400">暂无合作方档案，请新建</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs">
                  <th className="text-left px-4 py-3 font-medium">名称</th>
                  <th className="text-left px-4 py-3 font-medium">类型</th>
                  <th className="text-left px-4 py-3 font-medium">状态</th>
                  <th className="text-left px-4 py-3 font-medium">信用评级</th>
                  <th className="text-left px-4 py-3 font-medium">行业</th>
                  <th className="text-center px-4 py-3 font-medium">合同数</th>
                  <th className="text-right px-4 py-3 font-medium">总金额</th>
                  <th className="text-center px-4 py-3 font-medium">风险评分</th>
                  <th className="text-left px-4 py-3 font-medium">最后合作</th>
                  <th className="text-right px-4 py-3 font-medium">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {partners.map((partner) => {
                  const typeBadge = TYPE_BADGE[partner.type];
                  const statusCfg = PARTNER_STATUS_CONFIG[partner.status];
                  const ratingCfg = CREDIT_RATING_CONFIG[partner.credit_rating];
                  const isExpanded = expandedId === partner.id;
                  const histories = creditHistories.filter(
                    (h) => h.partner_id === partner.id
                  );
                  return (
                    <>
                      <tr
                        key={partner.id}
                        className="hover:bg-slate-50/70 transition-colors cursor-pointer"
                        onClick={() => toggleExpand(partner.id)}
                      >
                        {/* 名称 */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-slate-300 shrink-0" />
                            <span className="font-medium text-slate-800">
                              {partner.name}
                            </span>
                          </div>
                          <div className="text-xs text-slate-400 mt-0.5 ml-6">
                            {partner.legal_representative || '法定代表人未填'}
                          </div>
                        </td>
                        {/* 类型 */}
                        <td className="px-4 py-3">
                          <span
                            className={`text-xs px-2 py-0.5 rounded border ${typeBadge.cls}`}
                          >
                            {PARTNER_TYPE_LABELS[partner.type]}
                          </span>
                        </td>
                        {/* 状态 */}
                        <td className="px-4 py-3">
                          <span
                            className="inline-flex items-center text-xs px-2 py-0.5 rounded"
                            style={{
                              color: statusCfg.color,
                              backgroundColor: statusCfg.bg,
                            }}
                          >
                            {statusCfg.label}
                          </span>
                        </td>
                        {/* 信用评级 */}
                        <td className="px-4 py-3">
                          <span
                            className="text-xs font-bold px-2 py-0.5 rounded"
                            style={{
                              color: ratingCfg.color,
                              backgroundColor: `${ratingCfg.color}1a`,
                            }}
                          >
                            {ratingCfg.label}
                          </span>
                        </td>
                        {/* 行业 */}
                        <td className="px-4 py-3 text-slate-600">
                          {partner.industry}
                        </td>
                        {/* 合同数 */}
                        <td className="px-4 py-3 text-center">
                          <span className="font-semibold text-slate-700">
                            {partner.contract_count}
                          </span>
                        </td>
                        {/* 总金额 */}
                        <td className="px-4 py-3 text-right text-slate-700">
                          {formatCurrency(
                            partner.total_contract_value,
                            partner.currency
                          )}
                        </td>
                        {/* 风险评分 */}
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`font-semibold ${riskScoreColor(
                              partner.risk_score
                            )}`}
                          >
                            {partner.risk_score}
                          </span>
                        </td>
                        {/* 最后合作 */}
                        <td className="px-4 py-3 text-slate-500">
                          {formatDate(partner.last_contract_date)}
                        </td>
                        {/* 操作 */}
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => openEditForm(partner)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                              title="编辑"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            {partner.status === 'blacklisted' ? (
                              <button
                                onClick={() => handleRemoveBlacklist(partner)}
                                disabled={
                                  actionLoading === `remove-${partner.id}`
                                }
                                className="p-1.5 rounded-lg text-slate-500 hover:text-green-600 hover:bg-green-50 transition-colors disabled:opacity-50"
                                title="解除黑名单"
                              >
                                <ShieldOff className="w-4 h-4" />
                              </button>
                            ) : (
                              <button
                                onClick={() => handleBlacklist(partner)}
                                disabled={
                                  actionLoading === `blacklist-${partner.id}`
                                }
                                className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                                title="拉黑"
                              >
                                <Shield className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => handleDelete(partner)}
                              disabled={actionLoading === `delete-${partner.id}`}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                              title="删除"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {/* 展开详情行 */}
                      {isExpanded && (
                        <tr key={`${partner.id}-detail`}>
                          <td colSpan={10} className="px-4 py-4 bg-slate-50/60">
                            <PartnerDetail
                              partner={partner}
                              histories={histories}
                            />
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ===== 创建/编辑表单（模态框） ===== */}
      {showForm && (
        <PartnerFormModal
          form={form}
          setForm={setForm}
          editing={!!form.id}
          saving={saving}
          onSubmit={handleSubmit}
          onClose={closeForm}
        />
      )}
    </div>
  );
}

// ===== 合作方详情面板 =====
function PartnerDetail({
  partner,
  histories,
}: {
  partner: PartnerWithScore;
  histories: PartnerCreditHistory[];
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      {/* 基本信息 */}
      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <h4 className="text-sm font-semibold text-slate-800 flex items-center gap-2 mb-3">
          <Building2 className="w-4 h-4 text-brand-600" />
          基本信息
        </h4>
        <div className="space-y-2 text-sm">
          <DetailRow label="成立日期" value={formatDate(partner.established_date)} />
          <DetailRow
            label="注册资本"
            value={formatCurrency(partner.registered_capital, partner.currency)}
          />
          <DetailRow label="法定代表人" value={partner.legal_representative || '-'} />
          <DetailRow label="税务登记号" value={partner.tax_id || '-'} />
          <DetailRow
            label="银行账号"
            value={partner.bank_account || '未绑定'}
          />
          <DetailRow
            label="创建时间"
            value={formatDate(partner.created_at)}
          />
          {partner.notes && (
            <div className="pt-2 mt-2 border-t border-slate-100">
              <div className="text-xs text-slate-400 mb-1">备注</div>
              <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">
                {partner.notes}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 联系方式 */}
      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <h4 className="text-sm font-semibold text-slate-800 flex items-center gap-2 mb-3">
          <Phone className="w-4 h-4 text-brand-600" />
          联系方式
        </h4>
        <div className="space-y-3 text-sm">
          <div className="flex items-start gap-2">
            <Users className="w-4 h-4 text-slate-400 mt-0.5" />
            <div>
              <div className="text-xs text-slate-400">联系人</div>
              <div className="text-slate-700">
                {partner.contact_person || '-'}
              </div>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Mail className="w-4 h-4 text-slate-400 mt-0.5" />
            <div className="min-w-0">
              <div className="text-xs text-slate-400">邮箱</div>
              <div className="text-slate-700 truncate">
                {partner.contact_email || '-'}
              </div>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Phone className="w-4 h-4 text-slate-400 mt-0.5" />
            <div>
              <div className="text-xs text-slate-400">电话</div>
              <div className="text-slate-700">
                {partner.contact_phone || '-'}
              </div>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 text-slate-400 mt-0.5" />
            <div className="min-w-0">
              <div className="text-xs text-slate-400">地址</div>
              <div className="text-slate-700 leading-relaxed">
                {partner.address || '-'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 信用历史时间线 */}
      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <h4 className="text-sm font-semibold text-slate-800 flex items-center gap-2 mb-3">
          <CreditCard className="w-4 h-4 text-brand-600" />
          信用历史时间线
        </h4>
        {histories.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-400">
            暂无信用变化记录
          </div>
        ) : (
          <div className="space-y-3">
            {histories.map((h) => {
              const impact = IMPACT_CONFIG[h.impact];
              const Icon = impact.icon;
              return (
                <div
                  key={h.id}
                  className="relative pl-6 border-l-2 border-slate-100 last:border-l-transparent"
                >
                  {/* 时间点 */}
                  <div
                    className={`absolute -left-[7px] top-0.5 w-3 h-3 rounded-full border-2 border-white ${
                      h.impact === 'positive'
                        ? 'bg-green-500'
                        : h.impact === 'negative'
                        ? 'bg-red-500'
                        : 'bg-slate-300'
                    }`}
                  />
                  <div className="flex items-center gap-2 mb-1">
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
                    {formatDate(h.date)} · {CREDIT_RATING_CONFIG[h.rating_before].label}
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
            <FileText className="w-3.5 h-3.5 text-slate-400" />
            相关合同
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
              <div className={`text-lg font-bold ${riskScoreColor(partner.avg_risk_score)}`}>
                {partner.avg_risk_score}
              </div>
              <div className="text-xs text-slate-400">平均风险</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// 详情行
function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-slate-400">{label}</span>
      <span className="text-slate-700 text-right">{value}</span>
    </div>
  );
}

// ===== 创建/编辑合作方表单（模态框） =====
function PartnerFormModal({
  form,
  setForm,
  editing,
  saving,
  onSubmit,
  onClose,
}: {
  form: PartnerFormState;
  setForm: (f: PartnerFormState) => void;
  editing: boolean;
  saving: boolean;
  onSubmit: () => void;
  onClose: () => void;
}) {
  const update = (patch: Partial<PartnerFormState>) =>
    setForm({ ...form, ...patch });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl z-10">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            {editing ? (
              <Edit3 className="w-4 h-4 text-brand-600" />
            ) : (
              <Plus className="w-4 h-4 text-brand-600" />
            )}
            {editing ? '编辑合作方' : '新建合作方'}
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
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
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
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
                        : 'border-slate-200 text-slate-600 hover:border-slate-300'
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
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
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
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              >
                {RATING_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {CREDIT_RATING_CONFIG[r].label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 注册资本 + 货币 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    registered_capital: Math.max(0, Number(e.target.value) || 0),
                  })
                }
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                币种
              </label>
              <select
                value={form.currency}
                onChange={(e) => update({ currency: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              >
                {CURRENCY_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 法定代表人 + 成立日期 */}
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
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              />
            </div>
            {!editing && (
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
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                />
              </div>
            )}
          </div>

          {/* 联系人 + 邮箱 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                联系人
              </label>
              <input
                type="text"
                value={form.contact_person}
                onChange={(e) => update({ contact_person: e.target.value })}
                placeholder="如：李伟"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                邮箱
              </label>
              <input
                type="email"
                value={form.contact_email}
                onChange={(e) => update({ contact_email: e.target.value })}
                placeholder="如：liwei@example.com"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* 电话 + 税务号 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                联系电话
              </label>
              <input
                type="text"
                value={form.contact_phone}
                onChange={(e) => update({ contact_phone: e.target.value })}
                placeholder="如：021-55667788"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                税务登记号
              </label>
              <input
                type="text"
                value={form.tax_id}
                onChange={(e) => update({ tax_id: e.target.value })}
                placeholder="统一社会信用代码"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* 地址 */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              注册地址
            </label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => update({ address: e.target.value })}
              placeholder="详细地址"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
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
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent resize-none"
            />
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100 sticky bottom-0 bg-white rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors"
          >
            取消
          </button>
          <button
            onClick={onSubmit}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Plus className="w-4 h-4" />
            {saving
              ? '保存中...'
              : editing
              ? '保存修改'
              : '创建合作方'}
          </button>
        </div>
      </div>
    </div>
  );
}
