'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  PenTool,
  FileSignature,
  Check,
  X,
  Clock,
  Shield,
  Award,
  Plus,
  History,
  ChevronDown,
} from 'lucide-react';
import {
  SignatureRequest,
  Signer,
  SignatureStatus,
  SignerStatus,
  SIGNATURE_STATUS_CONFIG,
  SIGNER_STATUS_CONFIG,
} from '@/lib/types';
import { getMockContracts } from '@/lib/mock-data';

// ===== 签署顺序标签配置 =====
const ORDER_CONFIG: Record<
  SignatureRequest['signing_order'],
  { label: string; desc: string }
> = {
  sequential: { label: '顺序签署', desc: '按顺序依次签署，前一位完成后下一位方可签署' },
  parallel: { label: '并行签署', desc: '所有签署人可同时签署' },
  any: { label: '任意签署', desc: '任意一位签署人签署即可完成' },
};

// ===== 签署人头像配色 =====
const AVATAR_COLORS = [
  'bg-brand-100 text-brand-700',
  'bg-blue-100 text-blue-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-indigo-100 text-indigo-700',
];

// 获取签署人头像配色（按姓名哈希）
function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// 姓名首字
function getInitial(name: string): string {
  return name.charAt(0) || '?';
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

// 格式化日期
function formatDate(dateStr?: string): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

// 生成模拟签名图片（data URL 占位）
function mockSignatureImage(name: string): string {
  return `data:image/svg+xml;base64,${btoa(
    `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="50" viewBox="0 0 160 50"><text x="5" y="35" font-family="cursive" font-size="28" fill="#1e293b">${name} 签</text></svg>`
  )}`;
}

// ===== 创建表单状态 =====
interface SignerForm {
  name: string;
  email: string;
  role: string;
}

interface CreateFormState {
  contractId: string;
  contractTitle: string;
  signers: SignerForm[];
  order: SignatureRequest['signing_order'];
  expiresInDays: number;
}

const EMPTY_FORM: CreateFormState = {
  contractId: '',
  contractTitle: '',
  signers: [{ name: '', email: '', role: '' }],
  order: 'sequential',
  expiresInDays: 7,
};

interface Stats {
  total: number;
  pending: number;
  signed: number;
  rejected: number;
  avgSignTime: number;
}

export default function SignatureManager() {
  const [requests, setRequests] = useState<SignatureRequest[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 创建表单
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CreateFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // 展开状态
  const [expandedAudit, setExpandedAudit] = useState<Set<string>>(new Set());
  const [expandedCert, setExpandedCert] = useState<Set<string>>(new Set());

  // 操作加载状态（key: `${requestId}:${signerId}` 或 `void:${requestId}`）
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // 合同选项（来自 Mock 数据）
  const contractOptions = getMockContracts();

  // ===== 加载签章列表 =====
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/signatures', { cache: 'no-store' });
      if (!res.ok) throw new Error('加载签章请求失败');
      const data = await res.json();
      setRequests(data.requests || []);
      setStats(data.stats || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载签章请求失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // ===== 展开 / 收起审计追踪 =====
  const toggleAudit = (id: string) => {
    setExpandedAudit((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ===== 展开 / 收起证书信息 =====
  const toggleCert = (id: string) => {
    setExpandedCert((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ===== 表单操作 =====
  const openCreateForm = () => {
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setForm(EMPTY_FORM);
  };

  // 选择合同时同步填充标题
  const handleContractSelect = (contractId: string) => {
    const c = contractOptions.find((opt) => opt.id === contractId);
    setForm((prev) => ({
      ...prev,
      contractId,
      contractTitle: c?.contract_title || '',
    }));
  };

  // 添加签署人
  const addSigner = () => {
    setForm((prev) => ({
      ...prev,
      signers: [...prev.signers, { name: '', email: '', role: '' }],
    }));
  };

  // 删除签署人
  const removeSigner = (idx: number) => {
    setForm((prev) => ({
      ...prev,
      signers: prev.signers.filter((_, i) => i !== idx),
    }));
  };

  // 更新签署人字段
  const updateSigner = (idx: number, field: keyof SignerForm, value: string) => {
    setForm((prev) => ({
      ...prev,
      signers: prev.signers.map((s, i) => (i === idx ? { ...s, [field]: value } : s)),
    }));
  };

  // ===== 提交创建表单 =====
  const handleSubmit = async () => {
    if (!form.contractId || !form.contractTitle) {
      setError('请选择关联合同');
      return;
    }
    const validSigners = form.signers.filter(
      (s) => s.name.trim() && s.email.trim()
    );
    if (validSigners.length === 0) {
      setError('至少添加一位签署人（姓名和邮箱必填）');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/signatures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          contract_id: form.contractId,
          contract_title: form.contractTitle,
          signers: validSigners,
          order: form.order,
          expires_in_days: form.expiresInDays,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || '创建失败');
      }
      const data = await res.json();
      setRequests(data.requests || []);
      setStats(data.stats || null);
      closeForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建失败');
    } finally {
      setSaving(false);
    }
  };

  // ===== 签署文档（模拟签名）=====
  const handleSign = async (request: SignatureRequest, signer: Signer) => {
    setActionLoading(`${request.id}:${signer.id}`);
    setError(null);
    try {
      const res = await fetch('/api/signatures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sign',
          request_id: request.id,
          signer_id: signer.id,
          signature_image: mockSignatureImage(signer.name),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || '签署失败');
      }
      const data = await res.json();
      setRequests(data.requests || []);
      setStats(data.stats || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '签署失败');
    } finally {
      setActionLoading(null);
    }
  };

  // ===== 拒签 =====
  const handleReject = async (request: SignatureRequest, signer: Signer) => {
    const reason = window.prompt('请输入拒签原因：');
    if (reason === null) return;
    setActionLoading(`${request.id}:${signer.id}`);
    setError(null);
    try {
      const res = await fetch('/api/signatures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reject',
          request_id: request.id,
          signer_id: signer.id,
          reason: reason || '未提供原因',
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || '拒签失败');
      }
      const data = await res.json();
      setRequests(data.requests || []);
      setStats(data.stats || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '拒签失败');
    } finally {
      setActionLoading(null);
    }
  };

  // ===== 作废 =====
  const handleVoid = async (request: SignatureRequest) => {
    if (!window.confirm(`确定要作废签章请求「${request.contract_title}」吗？此操作不可撤销。`)) return;
    setActionLoading(`void:${request.id}`);
    setError(null);
    try {
      const res = await fetch('/api/signatures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'void',
          request_id: request.id,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || '作废失败');
      }
      const data = await res.json();
      setRequests(data.requests || []);
      setStats(data.stats || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '作废失败');
    } finally {
      setActionLoading(null);
    }
  };

  // ===== 顶部统计卡片 =====
  const statCards = [
    {
      label: '总签章数',
      value: stats?.total ?? 0,
      icon: FileSignature,
      color: 'text-brand-600',
      bg: 'bg-brand-50',
    },
    {
      label: '待签署',
      value: stats?.pending ?? 0,
      icon: Clock,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
    {
      label: '已签署',
      value: stats?.signed ?? 0,
      icon: Check,
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
    {
      label: '已拒签',
      value: stats?.rejected ?? 0,
      icon: X,
      color: 'text-red-600',
      bg: 'bg-red-50',
    },
    {
      label: '平均签署时长',
      value: stats?.avgSignTime ? `${stats.avgSignTime}h` : '0h',
      icon: History,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
  ];

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm flex items-center gap-2">
          <X className="w-4 h-4 shrink-0" />
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-red-400 hover:text-red-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 顶部统计卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="bg-white rounded-xl border border-slate-200 p-4"
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
                  <div className="text-xs text-slate-400">{card.label}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 操作栏 */}
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-slate-800 flex items-center gap-2">
          <PenTool className="w-4 h-4 text-brand-600" />
          签章请求列表
        </h2>
        <button
          onClick={openCreateForm}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          新建签章请求
        </button>
      </div>

      {/* 签章请求列表 */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-sm text-slate-400">
          加载签章请求中...
        </div>
      ) : requests.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <FileSignature className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-400">暂无签章请求，点击「新建签章请求」开始</p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((request) => (
            <SignatureCard
              key={request.id}
              request={request}
              expandedAudit={expandedAudit.has(request.id)}
              expandedCert={expandedCert.has(request.id)}
              actionLoading={actionLoading}
              onToggleAudit={() => toggleAudit(request.id)}
              onToggleCert={() => toggleCert(request.id)}
              onSign={(signer) => handleSign(request, signer)}
              onReject={(signer) => handleReject(request, signer)}
              onVoid={() => handleVoid(request)}
            />
          ))}
        </div>
      )}

      {/* ===== 创建签章请求表单 ===== */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                <Plus className="w-4 h-4 text-brand-600" />
                新建签章请求
              </h3>
              <button
                onClick={closeForm}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-5">
              {/* 合同选择 */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  关联合同 <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.contractId}
                  onChange={(e) => handleContractSelect(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                >
                  <option value="">请选择合同</option>
                  {contractOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.contract_title}（{c.contract_type}）
                    </option>
                  ))}
                </select>
                {form.contractTitle && (
                  <p className="text-xs text-slate-400 mt-1">
                    合同标题：{form.contractTitle}
                  </p>
                )}
              </div>

              {/* 签署顺序 */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  签署顺序
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['sequential', 'parallel', 'any'] as const).map((o) => (
                    <button
                      key={o}
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, order: o }))}
                      className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                        form.order === o
                          ? 'border-brand-500 bg-brand-50 text-brand-700'
                          : 'border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      {ORDER_CONFIG[o].label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-slate-400 mt-1.5">
                  {ORDER_CONFIG[form.order].desc}
                </p>
              </div>

              {/* 有效期 */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  有效期（天）
                </label>
                <input
                  type="number"
                  min={1}
                  max={90}
                  value={form.expiresInDays}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      expiresInDays: Math.max(1, Math.min(90, Number(e.target.value) || 7)),
                    }))
                  }
                  className="w-32 px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                />
              </div>

              {/* 签署人列表 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-slate-700">
                    签署人 <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={addSigner}
                    className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    添加签署人
                  </button>
                </div>
                <div className="space-y-2">
                  {form.signers.map((signer, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-100"
                    >
                      <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-xs font-medium shrink-0">
                        {idx + 1}
                      </div>
                      <input
                        type="text"
                        placeholder="姓名"
                        value={signer.name}
                        onChange={(e) => updateSigner(idx, 'name', e.target.value)}
                        className="flex-1 min-w-0 px-2 py-1.5 rounded border border-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"
                      />
                      <input
                        type="email"
                        placeholder="邮箱"
                        value={signer.email}
                        onChange={(e) => updateSigner(idx, 'email', e.target.value)}
                        className="flex-1 min-w-0 px-2 py-1.5 rounded border border-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"
                      />
                      <input
                        type="text"
                        placeholder="角色"
                        value={signer.role}
                        onChange={(e) => updateSigner(idx, 'role', e.target.value)}
                        className="w-28 px-2 py-1.5 rounded border border-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"
                      />
                      {form.signers.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeSigner(idx)}
                          className="text-slate-400 hover:text-red-500 shrink-0"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 表单操作 */}
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100 sticky bottom-0 bg-white rounded-b-2xl">
              <button
                onClick={closeForm}
                className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Check className="w-4 h-4" />
                {saving ? '创建中...' : '创建请求'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ===== 单个签章请求卡片 =====
function SignatureCard({
  request,
  expandedAudit,
  expandedCert,
  actionLoading,
  onToggleAudit,
  onToggleCert,
  onSign,
  onReject,
  onVoid,
}: {
  request: SignatureRequest;
  expandedAudit: boolean;
  expandedCert: boolean;
  actionLoading: string | null;
  onToggleAudit: () => void;
  onToggleCert: () => void;
  onSign: (signer: Signer) => void;
  onReject: (signer: Signer) => void;
  onVoid: () => void;
}) {
  const statusCfg = SIGNATURE_STATUS_CONFIG[request.status];
  const orderCfg = ORDER_CONFIG[request.signing_order];

  // 签署进度
  const signedCount = request.signers.filter((s) => s.status === 'signed').length;
  const totalCount = request.signers.length;
  const progressPct = totalCount > 0 ? Math.round((signedCount / totalCount) * 100) : 0;

  const isTerminal =
    request.status === 'signed' ||
    request.status === 'rejected' ||
    request.status === 'voided' ||
    request.status === 'expired';

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      {/* 卡片头部 */}
      <div className="px-5 py-4 border-b border-slate-100">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center shrink-0">
              <FileSignature className="w-5 h-5 text-brand-600" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-slate-800 truncate">
                {request.contract_title}
              </h3>
              <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5 flex-wrap">
                <span>请求编号：{request.id}</span>
                <span>·</span>
                <span>{orderCfg.label}</span>
                <span>·</span>
                <span>创建于 {formatDate(request.created_at)}</span>
              </div>
            </div>
          </div>
          <span
            className="inline-flex items-center text-xs px-2 py-1 rounded font-medium shrink-0"
            style={{ color: statusCfg.color, backgroundColor: statusCfg.bg }}
          >
            {statusCfg.label}
          </span>
        </div>
      </div>

      {/* 进度条 */}
      <div className="px-5 py-3 bg-slate-50/50 border-b border-slate-100">
        <div className="flex items-center justify-between mb-1.5 text-xs">
          <span className="text-slate-500">
            签署进度：{signedCount} / {totalCount} 人
          </span>
          <span className="font-medium text-slate-700">{progressPct}%</span>
        </div>
        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              request.status === 'rejected'
                ? 'bg-red-400'
                : request.status === 'voided'
                ? 'bg-slate-400'
                : 'bg-brand-500'
            }`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* 签署顺序可视化 */}
      <div className="px-5 py-3 border-b border-slate-100">
        <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-2">
          <PenTool className="w-3.5 h-3.5" />
          <span>签署顺序（{orderCfg.label}）</span>
        </div>
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {request.signers.map((signer, idx) => {
            const sCfg = SIGNER_STATUS_CONFIG[signer.status];
            return (
              <div key={signer.id} className="flex items-center gap-1 shrink-0">
                <div
                  className="flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs"
                  style={{ borderColor: `${sCfg.color}40`, backgroundColor: sCfg.bg }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: sCfg.color }}
                  />
                  <span style={{ color: sCfg.color }}>{signer.name}</span>
                </div>
                {idx < request.signers.length - 1 && (
                  <span className="text-slate-300 text-xs">
                    {request.signing_order === 'sequential' ? '→' : '∥'}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 签署人列表 */}
      <div className="px-5 py-4 space-y-3">
        {request.signers.map((signer) => {
          const sCfg = SIGNER_STATUS_CONFIG[signer.status];
          const isLoading =
            actionLoading === `${request.id}:${signer.id}`;
          // 判断当前签署人是否可操作
          const canSign =
            !isTerminal &&
            signer.status === 'waiting' &&
            (request.signing_order !== 'sequential' ||
              request.signers.findIndex((s) => s.status === 'waiting') ===
                request.signers.indexOf(signer));
          const canReject = canSign;
          return (
            <div
              key={signer.id}
              className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:border-slate-200 transition-colors"
            >
              {/* 头像 */}
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium shrink-0 ${getAvatarColor(
                  signer.name
                )}`}
              >
                {getInitial(signer.name)}
              </div>

              {/* 信息 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-slate-800 text-sm">
                    {signer.name}
                  </span>
                  <span className="text-xs text-slate-400">{signer.role}</span>
                  <span
                    className="inline-flex items-center text-xs px-1.5 py-0.5 rounded font-medium"
                    style={{ color: sCfg.color, backgroundColor: sCfg.bg }}
                  >
                    {sCfg.label}
                  </span>
                </div>
                <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-2 flex-wrap">
                  <span>{signer.email}</span>
                  {signer.signed_at && (
                    <>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDateTime(signer.signed_at)}
                      </span>
                    </>
                  )}
                  {signer.ip_address && (
                    <>
                      <span>·</span>
                      <span>IP：{signer.ip_address}</span>
                    </>
                  )}
                </div>
              </div>

              {/* 操作按钮 */}
              <div className="flex items-center gap-1.5 shrink-0">
                {canSign && (
                  <button
                    onClick={() => onSign(signer)}
                    disabled={isLoading}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <PenTool className="w-3.5 h-3.5" />
                    {isLoading ? '签署中...' : '签署'}
                  </button>
                )}
                {canReject && (
                  <button
                    onClick={() => onReject(signer)}
                    disabled={isLoading}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <X className="w-3.5 h-3.5" />
                    拒签
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 文档哈希与证书 */}
      <div className="px-5 py-3 border-t border-slate-100 space-y-2">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Shield className="w-3.5 h-3.5 text-slate-400" />
          <span>文档哈希：</span>
          <code className="font-mono text-slate-600 bg-slate-50 px-1.5 py-0.5 rounded">
            {request.document_hash.substring(0, 32)}...
          </code>
        </div>

        {/* 证书信息展开 */}
        <button
          onClick={onToggleCert}
          className="flex items-center gap-1.5 text-xs text-brand-600 hover:text-brand-700 font-medium"
        >
          <Award className="w-3.5 h-3.5" />
          <span>{expandedCert ? '收起证书信息' : '查看证书信息'}</span>
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform ${
              expandedCert ? 'rotate-180' : ''
            }`}
          />
        </button>
        {expandedCert && request.certificate_info && (
          <div className="mt-2 p-3 rounded-lg bg-slate-50 border border-slate-100 text-xs space-y-1.5">
            <div className="flex">
              <span className="text-slate-400 w-20 shrink-0">颁发机构</span>
              <span className="text-slate-700">{request.certificate_info.issuer}</span>
            </div>
            <div className="flex">
              <span className="text-slate-400 w-20 shrink-0">主题</span>
              <span className="text-slate-700 font-mono break-all">{request.certificate_info.subject}</span>
            </div>
            <div className="flex">
              <span className="text-slate-400 w-20 shrink-0">序列号</span>
              <span className="text-slate-700 font-mono">{request.certificate_info.serial_number}</span>
            </div>
            <div className="flex">
              <span className="text-slate-400 w-20 shrink-0">有效期</span>
              <span className="text-slate-700">
                {formatDate(request.certificate_info.valid_from)} ~{' '}
                {formatDate(request.certificate_info.valid_to)}
              </span>
            </div>
            <div className="flex">
              <span className="text-slate-400 w-20 shrink-0">签名算法</span>
              <span className="text-slate-700">{request.certificate_info.algorithm}</span>
            </div>
          </div>
        )}
      </div>

      {/* 审计追踪 */}
      <div className="px-5 py-3 border-t border-slate-100">
        <button
          onClick={onToggleAudit}
          className="flex items-center gap-1.5 text-xs text-brand-600 hover:text-brand-700 font-medium"
        >
          <History className="w-3.5 h-3.5" />
          <span>{expandedAudit ? '收起审计追踪' : `查看审计追踪（${request.audit_trail.length} 条）`}</span>
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform ${
              expandedAudit ? 'rotate-180' : ''
            }`}
          />
        </button>
        {expandedAudit && (
          <div className="mt-3 space-y-2">
            {request.audit_trail.map((entry, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2 text-xs"
              >
                <div className="flex flex-col items-center pt-0.5">
                  <div className="w-2 h-2 rounded-full bg-brand-400" />
                  {idx < request.audit_trail.length - 1 && (
                    <div className="w-px h-full min-h-[16px] bg-slate-200 mt-0.5" />
                  )}
                </div>
                <div className="flex-1 pb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-slate-700">{entry.action}</span>
                    <span className="text-slate-400">
                      {formatDateTime(entry.timestamp)}
                    </span>
                    {entry.ip_address && (
                      <span className="text-slate-400">IP：{entry.ip_address}</span>
                    )}
                  </div>
                  <p className="text-slate-500 mt-0.5">{entry.details}</p>
                  <p className="text-slate-400 mt-0.5">操作人：{entry.actor}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 底部操作栏 */}
      {!isTerminal && (
        <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between gap-2">
          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            <span>到期时间：{formatDate(request.expires_at)}</span>
          </div>
          <button
            onClick={onVoid}
            disabled={actionLoading === `void:${request.id}`}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <X className="w-3.5 h-3.5" />
            {actionLoading === `void:${request.id}` ? '作废中...' : '作废请求'}
          </button>
        </div>
      )}
      {isTerminal && request.completed_at && (
        <div className="px-5 py-3 border-t border-slate-100">
          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5" />
            <span>
              {request.status === 'signed'
                ? '签署完成'
                : request.status === 'rejected'
                ? '已拒签'
                : request.status === 'voided'
                ? '已作废'
                : '已过期'}
              · {formatDateTime(request.completed_at)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
