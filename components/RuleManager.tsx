'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  Plus,
  Edit3,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Filter,
  AlertTriangle,
  Check,
  X,
} from 'lucide-react';
import {
  CustomRiskRule,
  RuleOperator,
  RuleSeverity,
  RuleStatus,
  RULE_OPERATOR_LABELS,
} from '@/lib/types';

// 严重程度标签配置
const SEVERITY_CONFIG: Record<
  RuleSeverity,
  { label: string; cls: string; dot: string }
> = {
  high: {
    label: '高',
    cls: 'bg-red-50 text-red-600 border-red-200',
    dot: 'bg-red-500',
  },
  medium: {
    label: '中',
    cls: 'bg-amber-50 text-amber-600 border-amber-200',
    dot: 'bg-amber-500',
  },
  low: {
    label: '低',
    cls: 'bg-green-50 text-green-600 border-green-200',
    dot: 'bg-green-500',
  },
};

// 操作符下拉选项
const OPERATOR_OPTIONS: RuleOperator[] = [
  'contains',
  'not_contains',
  'equals',
  'regex',
  'greater_than',
  'less_than',
];

// 严重程度下拉选项
const SEVERITY_OPTIONS: RuleSeverity[] = ['high', 'medium', 'low'];

// 规则类型选项
const RULE_TYPE_OPTIONS = [
  { value: 'payment_risk', label: '付款风险' },
  { value: 'delivery_risk', label: '交付风险' },
  { value: 'breach_liability', label: '违约责任' },
  { value: 'intellectual_property', label: '知识产权' },
  { value: 'confidentiality', label: '保密义务' },
  { value: 'dispute_resolution', label: '争议解决' },
  { value: 'termination', label: '合同终止' },
  { value: 'other', label: '其他' },
];

// 表单初始值
const EMPTY_FORM: RuleFormState = {
  name: '',
  description: '',
  rule_type: 'payment_risk',
  field: '',
  operator: 'contains',
  value: '',
  severity: 'medium',
  suggestion: '',
};

interface RuleFormState {
  name: string;
  description: string;
  rule_type: string;
  field: string;
  operator: RuleOperator;
  value: string;
  severity: RuleSeverity;
  suggestion: string;
}

interface Stats {
  total: number;
  active: number;
  inactive: number;
  total_matches: number;
}

export default function RuleManager() {
  const [rules, setRules] = useState<CustomRiskRule[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 创建/编辑表单状态
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<RuleFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // 加载规则列表
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/rules', { cache: 'no-store' });
      if (!res.ok) throw new Error('加载规则失败');
      const data = await res.json();
      setRules(data.rules || []);
      setStats(data.stats || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载规则失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // 打开新建表单
  const openCreateForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  // 打开编辑表单
  const openEditForm = (rule: CustomRiskRule) => {
    setEditingId(rule.id);
    setForm({
      name: rule.name,
      description: rule.description,
      rule_type: rule.rule_type,
      field: rule.field,
      operator: rule.operator,
      value: rule.value,
      severity: rule.severity,
      suggestion: rule.suggestion,
    });
    setShowForm(true);
  };

  // 关闭表单
  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  // 提交表单（创建或更新）
  const handleSubmit = async () => {
    if (!form.name.trim()) {
      setError('请填写规则名称');
      return;
    }
    if (!form.value.trim()) {
      setError('请填写规则值');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const isEdit = !!editingId;
      const res = await fetch('/api/rules', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          isEdit ? { id: editingId, ...form } : form
        ),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || '保存失败');
      }
      const data = await res.json();
      setRules(data.rules || []);
      setStats(data.stats || null);
      closeForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  // 启用/停用规则
  const toggleStatus = async (rule: CustomRiskRule) => {
    const nextStatus: RuleStatus =
      rule.status === 'active' ? 'inactive' : 'active';
    try {
      const res = await fetch('/api/rules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: rule.id, status: nextStatus }),
      });
      if (!res.ok) throw new Error('操作失败');
      const data = await res.json();
      setRules(data.rules || []);
      setStats(data.stats || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败');
    }
  };

  // 删除规则
  const handleDelete = async (rule: CustomRiskRule) => {
    if (!confirm(`确定要删除规则「${rule.name}」吗？`)) return;
    try {
      const res = await fetch('/api/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', id: rule.id }),
      });
      if (!res.ok) throw new Error('删除失败');
      const data = await res.json();
      setRules(data.rules || []);
      setStats(data.stats || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败');
    }
  };

  // 顶部统计卡片
  const statCards = [
    {
      label: '总规则数',
      value: stats?.total ?? 0,
      icon: Shield,
      color: 'text-brand-600',
      bg: 'bg-brand-50',
    },
    {
      label: '活跃规则',
      value: stats?.active ?? 0,
      icon: Check,
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
    {
      label: '总匹配次数',
      value: stats?.total_matches ?? 0,
      icon: AlertTriangle,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
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

      {/* 顶部统计 + 新建按钮 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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

        {/* 新建规则按钮卡片 */}
        <button
          onClick={openCreateForm}
          className="bg-brand-600 hover:bg-brand-700 rounded-xl border border-brand-600 p-4 text-left transition-colors group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
              <Plus className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-base font-semibold text-white">
                新建规则
              </div>
              <div className="text-xs text-brand-100">添加自定义风险规则</div>
            </div>
          </div>
        </button>
      </div>

      {/* 创建/编辑表单（展开面板） */}
      {showForm && (
        <RuleFormPanel
          form={form}
          setForm={setForm}
          editingId={editingId}
          saving={saving}
          onSubmit={handleSubmit}
          onClose={closeForm}
        />
      )}

      {/* 规则列表表格 */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <Filter className="w-4 h-4 text-brand-600" />
            规则列表
          </h3>
          <span className="text-xs text-slate-400">
            共 {rules.length} 条规则
          </span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm text-slate-400">
            加载规则中...
          </div>
        ) : rules.length === 0 ? (
          <div className="py-12 text-center">
            <Shield className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-400">暂无规则，请新建规则</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs">
                  <th className="text-left px-4 py-3 font-medium">规则名称</th>
                  <th className="text-left px-4 py-3 font-medium">匹配条件</th>
                  <th className="text-left px-4 py-3 font-medium">严重程度</th>
                  <th className="text-left px-4 py-3 font-medium">状态</th>
                  <th className="text-center px-4 py-3 font-medium">匹配次数</th>
                  <th className="text-right px-4 py-3 font-medium">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rules.map((rule) => {
                  const sevCfg = SEVERITY_CONFIG[rule.severity];
                  const isActive = rule.status === 'active';
                  return (
                    <tr
                      key={rule.id}
                      className="hover:bg-slate-50/70 transition-colors"
                    >
                      {/* 名称 + 描述 */}
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800">
                          {rule.name}
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5 line-clamp-2 max-w-xs">
                          {rule.description}
                        </div>
                      </td>

                      {/* 操作符 + 值 */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                            {RULE_OPERATOR_LABELS[rule.operator]}
                          </span>
                          <span className="font-mono text-xs text-brand-700 bg-brand-50 px-1.5 py-0.5 rounded">
                            {rule.value}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          {rule.field || rule.rule_type}
                        </div>
                      </td>

                      {/* 严重程度 */}
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded border ${sevCfg.cls}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${sevCfg.dot}`} />
                          {sevCfg.label}
                        </span>
                      </td>

                      {/* 状态开关 */}
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleStatus(rule)}
                          className="flex items-center gap-1 text-xs"
                          title={isActive ? '点击停用' : '点击启用'}
                        >
                          {isActive ? (
                            <ToggleRight className="w-6 h-6 text-green-500" />
                          ) : (
                            <ToggleLeft className="w-6 h-6 text-slate-300" />
                          )}
                          <span
                            className={
                              isActive ? 'text-green-600' : 'text-slate-400'
                            }
                          >
                            {isActive ? '启用' : '停用'}
                          </span>
                        </button>
                      </td>

                      {/* 匹配次数 */}
                      <td className="px-4 py-3 text-center">
                        <span className="font-semibold text-slate-700">
                          {rule.match_count}
                        </span>
                      </td>

                      {/* 操作按钮 */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEditForm(rule)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                            title="编辑"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(rule)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="删除"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ===== 创建/编辑规则表单面板 =====
function RuleFormPanel({
  form,
  setForm,
  editingId,
  saving,
  onSubmit,
  onClose,
}: {
  form: RuleFormState;
  setForm: (f: RuleFormState) => void;
  editingId: string | null;
  saving: boolean;
  onSubmit: () => void;
  onClose: () => void;
}) {
  const update = (patch: Partial<RuleFormState>) =>
    setForm({ ...form, ...patch });

  return (
    <div className="bg-white rounded-xl border border-brand-200 shadow-md p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-800 flex items-center gap-2">
          {editingId ? (
            <Edit3 className="w-4 h-4 text-brand-600" />
          ) : (
            <Plus className="w-4 h-4 text-brand-600" />
          )}
          {editingId ? '编辑规则' : '新建规则'}
        </h3>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 规则名称 */}
        <div>
          <label className="block text-xs text-slate-500 mb-1.5">
            规则名称 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => update({ name: e.target.value })}
            placeholder="如：预付款比例超过40%"
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-300"
          />
        </div>

        {/* 规则类型 */}
        <div>
          <label className="block text-xs text-slate-500 mb-1.5">
            规则类型
          </label>
          <select
            value={form.rule_type}
            onChange={(e) => update({ rule_type: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-300"
          >
            {RULE_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* 字段 */}
        <div>
          <label className="block text-xs text-slate-500 mb-1.5">
            检查字段
          </label>
          <input
            type="text"
            value={form.field}
            onChange={(e) => update({ field: e.target.value })}
            placeholder="如：付款条款"
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-300"
          />
        </div>

        {/* 严重程度 */}
        <div>
          <label className="block text-xs text-slate-500 mb-1.5">
            严重程度
          </label>
          <select
            value={form.severity}
            onChange={(e) =>
              update({ severity: e.target.value as RuleSeverity })
            }
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-300"
          >
            {SEVERITY_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {SEVERITY_CONFIG[s].label}
              </option>
            ))}
          </select>
        </div>

        {/* 操作符 */}
        <div>
          <label className="block text-xs text-slate-500 mb-1.5">
            操作符
          </label>
          <select
            value={form.operator}
            onChange={(e) =>
              update({ operator: e.target.value as RuleOperator })
            }
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-300"
          >
            {OPERATOR_OPTIONS.map((op) => (
              <option key={op} value={op}>
                {RULE_OPERATOR_LABELS[op]}
              </option>
            ))}
          </select>
        </div>

        {/* 规则值 */}
        <div>
          <label className="block text-xs text-slate-500 mb-1.5">
            规则值 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.value}
            onChange={(e) => update({ value: e.target.value })}
            placeholder={
              form.operator === 'greater_than' || form.operator === 'less_than'
                ? '如：40'
                : form.operator === 'regex'
                ? '如：\\d+%'
                : '如：违约金'
            }
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-300"
          />
        </div>

        {/* 规则描述 */}
        <div className="md:col-span-2">
          <label className="block text-xs text-slate-500 mb-1.5">
            规则描述
          </label>
          <textarea
            value={form.description}
            onChange={(e) => update({ description: e.target.value })}
            placeholder="描述规则的作用与适用场景"
            rows={2}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-300 resize-none"
          />
        </div>

        {/* 修改建议 */}
        <div className="md:col-span-2">
          <label className="block text-xs text-slate-500 mb-1.5">
            修改建议
          </label>
          <textarea
            value={form.suggestion}
            onChange={(e) => update({ suggestion: e.target.value })}
            placeholder="命中规则时给出的修改建议"
            rows={2}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-300 resize-none"
          />
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="flex items-center justify-end gap-2 mt-5 pt-4 border-t border-slate-100">
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
          <Check className="w-4 h-4" />
          {saving ? '保存中...' : editingId ? '保存修改' : '创建规则'}
        </button>
      </div>
    </div>
  );
}
