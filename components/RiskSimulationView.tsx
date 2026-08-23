'use client';

// ===== 合同风险模拟视图 =====
// 自包含组件：顶部统计 + 模拟卡片 + 新建模拟表单
// 通过 /api/risk-simulation 获取与提交数据，展示完整风险模拟能力

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  FlaskConical,
  TrendingDown,
  AlertTriangle,
  BarChart3,
  Dice5,
  Target,
  Info,
  Calculator,
  Shield,
  ChevronDown,
  Plus,
  Activity,
  XCircle,
} from 'lucide-react';
import {
  RiskSimulation,
  SimulationScenario,
  RiskCategory,
  SIMULATION_SCENARIO_LABELS,
  RISK_CATEGORY_LABELS,
} from '@/lib/types';

// ===== 类型定义 =====

interface SimStats {
  total: number;
  avgExpectedLoss: number;
  maxLoss: number;
  avgProbabilityOfLoss: number;
  totalVaR95: number;
}

// 场景图标与配色
const SCENARIO_CONFIG: Record<
  SimulationScenario,
  { icon: React.ElementType; cls: string }
> = {
  best_case: { icon: Target, cls: 'bg-green-50 text-green-600' },
  base_case: { icon: Activity, cls: 'bg-blue-50 text-blue-600' },
  worst_case: { icon: TrendingDown, cls: 'bg-red-50 text-red-600' },
  stress_test: { icon: AlertTriangle, cls: 'bg-amber-50 text-amber-600' },
  monte_carlo: { icon: Dice5, cls: 'bg-brand-50 text-brand-700' },
};

// 风险类别配色
const RISK_CATEGORY_CLS: Record<RiskCategory, string> = {
  financial: 'bg-blue-50 text-blue-600',
  operational: 'bg-amber-50 text-amber-600',
  legal: 'bg-rose-50 text-rose-600',
  market: 'bg-green-50 text-green-600',
  counterparty: 'bg-purple-50 text-purple-600',
  force_majeure: 'bg-slate-100 text-slate-600',
};

// 合同选项（用于新建模拟表单）
const CONTRACT_OPTIONS = [
  { id: 'CON-2026-0401', title: 'XX产品采购合同' },
  { id: 'CON-2026-0312', title: '云服务外包协议' },
  { id: 'CON-2026-0228', title: '办公场地租赁合同' },
  { id: 'CON-2026-0510', title: '技术开发合作协议' },
  { id: 'CON-2026-0601', title: '人力资源服务合同' },
  { id: 'CON-2026-0801', title: '标准化服务订购协议' },
];

// 金额格式化（自动万 / 亿单位）
function formatMoney(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 100000000) return '¥' + (v / 100000000).toFixed(2) + '亿';
  if (abs >= 10000) return '¥' + (v / 10000).toFixed(1) + '万';
  return '¥' + Math.round(v).toLocaleString('zh-CN');
}

// 百分比格式化（0-1 → x%）
function formatPercent(v: number): string {
  return (v * 100).toFixed(1) + '%';
}

export default function RiskSimulationView() {
  const [simulations, setSimulations] = useState<RiskSimulation[]>([]);
  const [stats, setStats] = useState<SimStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // 表单状态
  const [form, setForm] = useState({
    contractIdx: '0',
    scenario: 'monte_carlo' as SimulationScenario,
    iterations: '1000',
  });
  const [submitting, setSubmitting] = useState(false);

  // ===== 加载模拟数据 =====
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/risk-simulation', { cache: 'no-store' });
      if (!res.ok) throw new Error('加载风险模拟失败');
      const data = await res.json();
      setSimulations(data.simulations || []);
      setStats(data.stats || null);
      // 默认展开第一条
      if (data.simulations && data.simulations.length > 0 && !expandedId) {
        setExpandedId(data.simulations[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载风险模拟失败');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // ===== 提交新模拟 =====
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const contract =
      CONTRACT_OPTIONS[Number(form.contractIdx)] || CONTRACT_OPTIONS[0];
    const iterations = Math.max(1000, Number(form.iterations) || 1000);
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/risk-simulation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contract_id: contract.id,
          contract_title: contract.title,
          scenario: form.scenario,
          iterations,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || '模拟失败');
      }
      const data = await res.json();
      setSimulations(data.simulations || []);
      setStats(data.stats || null);
      setExpandedId(data.simulation.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : '模拟失败');
    } finally {
      setSubmitting(false);
    }
  };

  // ===== 统计卡片配置 =====
  const statCards = useMemo(
    () => [
      {
        label: '模拟总数',
        value: stats?.total ?? 0,
        icon: BarChart3,
        color: 'text-brand-600',
        bg: 'bg-brand-50',
      },
      {
        label: '平均期望损失',
        value: formatMoney(stats?.avgExpectedLoss ?? 0),
        icon: TrendingDown,
        color: 'text-amber-600',
        bg: 'bg-amber-50',
      },
      {
        label: '最大损失',
        value: formatMoney(stats?.maxLoss ?? 0),
        icon: AlertTriangle,
        color: 'text-red-600',
        bg: 'bg-red-50',
      },
      {
        label: '平均损失概率',
        value: (stats?.avgProbabilityOfLoss ?? 0) + '%',
        icon: Target,
        color: 'text-blue-600',
        bg: 'bg-blue-50',
      },
      {
        label: 'VaR95 合计',
        value: formatMoney(stats?.totalVaR95 ?? 0),
        icon: Calculator,
        color: 'text-purple-600',
        bg: 'bg-purple-50',
      },
    ],
    [stats]
  );

  return (
    <div className="space-y-6">
      {/* ===== 顶部统计卡片 ===== */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
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
          <Info className="w-4 h-4 shrink-0" />
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-red-400 hover:text-red-600 text-xs"
          >
            关闭
          </button>
        </div>
      )}

      {/* ===== 模拟列表 ===== */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <FlaskConical className="w-4 h-4 text-brand-600" />
          <h2 className="font-semibold text-slate-800 text-sm">风险模拟列表</h2>
          <span className="text-xs text-slate-400">
            共 {simulations.length} 条 · 点击卡片展开详情
          </span>
        </div>

        {loading ? (
          <div className="py-16 text-center text-sm text-slate-400 bg-white rounded-2xl border border-slate-200">
            加载中...
          </div>
        ) : simulations.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-400 bg-white rounded-2xl border border-slate-200">
            暂无模拟记录，请在下方运行新模拟
          </div>
        ) : (
          <div className="space-y-4">
            {simulations.map((sim) => (
              <SimulationCard
                key={sim.id}
                simulation={sim}
                expanded={sim.id === expandedId}
                onToggle={() =>
                  setExpandedId(sim.id === expandedId ? null : sim.id)
                }
              />
            ))}
          </div>
        )}
      </div>

      {/* ===== 新建模拟表单 ===== */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Calculator className="w-4 h-4 text-brand-600" />
          <h2 className="font-semibold text-slate-800 text-sm">运行新模拟</h2>
          <span className="text-xs text-slate-400 ml-auto">
            选择合同与场景后将立即生成模拟结果
          </span>
        </div>
        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 md:grid-cols-4 gap-4"
        >
          <div className="md:col-span-2">
            <label className="block text-xs text-slate-500 mb-1">
              选择合同 *
            </label>
            <select
              value={form.contractIdx}
              onChange={(e) =>
                setForm({ ...form, contractIdx: e.target.value })
              }
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-100"
            >
              {CONTRACT_OPTIONS.map((c, idx) => (
                <option key={c.id} value={idx}>
                  {c.title}（{c.id}）
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">
              模拟场景 *
            </label>
            <select
              value={form.scenario}
              onChange={(e) =>
                setForm({
                  ...form,
                  scenario: e.target.value as SimulationScenario,
                })
              }
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-100"
            >
              {(Object.keys(SIMULATION_SCENARIO_LABELS) as SimulationScenario[]).map(
                (s) => (
                  <option key={s} value={s}>
                    {SIMULATION_SCENARIO_LABELS[s]}
                  </option>
                )
              )}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">
              迭代次数 *
            </label>
            <input
              type="number"
              min={1000}
              step={1000}
              value={form.iterations}
              onChange={(e) =>
                setForm({ ...form, iterations: e.target.value })
              }
              placeholder="如 1000"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-100"
            />
          </div>
          <div className="md:col-span-4 flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="w-4 h-4" />
              {submitting ? '模拟中...' : '运行风险模拟'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ===== 单个模拟卡片 =====
function SimulationCard({
  simulation,
  expanded,
  onToggle,
}: {
  simulation: RiskSimulation;
  expanded: boolean;
  onToggle: () => void;
}) {
  const s = simulation.summary;
  const varAnalysis = simulation.var_analysis;
  const scenarioCfg = SCENARIO_CONFIG[simulation.scenario];
  const ScenarioIcon = scenarioCfg.icon;

  // 摘要指标网格
  const metrics = [
    {
      label: '期望损失',
      value: formatMoney(s.expected_loss),
      icon: TrendingDown,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
    {
      label: '最大损失',
      value: formatMoney(s.max_loss),
      icon: AlertTriangle,
      color: 'text-red-600',
      bg: 'bg-red-50',
    },
    {
      label: '最小损失',
      value: formatMoney(s.min_loss),
      icon: Target,
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
    {
      label: '标准差',
      value: formatMoney(s.std_deviation),
      icon: Activity,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: '损失概率',
      value: formatPercent(s.probability_of_loss),
      icon: Target,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
    },
    {
      label: '期望净损失',
      value: formatMoney(s.expected_value),
      icon: Calculator,
      color: 'text-brand-600',
      bg: 'bg-brand-50',
    },
  ];

  // 分布直方图最大概率（用于柱高比例）
  const maxProb =
    Math.max(...simulation.distribution.map((d) => d.probability), 0.0001);

  // VaR 表格行
  const varRows = [
    { label: 'VaR 95%', value: varAnalysis.var_95, desc: '95% 置信下不超出的损失' },
    { label: 'VaR 99%', value: varAnalysis.var_99, desc: '99% 置信下不超出的损失' },
    { label: 'CVaR 95%', value: varAnalysis.cvar_95, desc: '95% 尾部条件期望损失' },
    { label: 'CVaR 99%', value: varAnalysis.cvar_99, desc: '99% 尾部条件期望损失' },
    { label: '最大回撤', value: varAnalysis.max_drawdown, desc: '模拟区间内最大单次损失' },
  ];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* ===== 卡片头部 ===== */}
      <button
        onClick={onToggle}
        className="w-full text-left p-5 hover:bg-slate-50/50 transition-colors"
      >
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
              <FlaskConical className="w-3.5 h-3.5" />
              <span>{simulation.contract_id}</span>
              <span>·</span>
              <span>{simulation.iterations.toLocaleString('zh-CN')} 次迭代</span>
            </div>
            <h3 className="text-lg font-semibold text-slate-800 truncate">
              {simulation.contract_title}
            </h3>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span
              className={
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ' +
                scenarioCfg.cls
              }
            >
              <ScenarioIcon className="w-4 h-4" />
              {SIMULATION_SCENARIO_LABELS[simulation.scenario]}
            </span>
            <ChevronDown
              className={
                'w-5 h-5 text-slate-400 transition-transform ' +
                (expanded ? 'rotate-180' : '')
              }
            />
          </div>
        </div>

        {/* 头部关键指标速览 */}
        <div className="mt-3 flex items-center gap-4 text-sm text-slate-500 flex-wrap">
          <span>
            期望损失
            <span className="ml-1 font-semibold text-amber-600">
              {formatMoney(s.expected_loss)}
            </span>
          </span>
          <span className="text-slate-300">|</span>
          <span>
            最大损失
            <span className="ml-1 font-semibold text-red-600">
              {formatMoney(s.max_loss)}
            </span>
          </span>
          <span className="text-slate-300">|</span>
          <span>
            损失概率
            <span className="ml-1 font-semibold text-purple-600">
              {formatPercent(s.probability_of_loss)}
            </span>
          </span>
          <span className="text-slate-300">|</span>
          <span>
            VaR95
            <span className="ml-1 font-semibold text-brand-600">
              {formatMoney(varAnalysis.var_95)}
            </span>
          </span>
        </div>
      </button>

      {/* ===== 展开详情 ===== */}
      {expanded && (
        <div className="border-t border-slate-100 p-5 space-y-5">
          {/* 摘要指标网格 */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="w-4 h-4 text-brand-600" />
              <h4 className="font-semibold text-slate-800 text-sm">模拟摘要</h4>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {metrics.map((m) => {
                const Icon = m.icon;
                return (
                  <div
                    key={m.label}
                    className="rounded-xl border border-slate-100 p-3"
                  >
                    <div
                      className={
                        'w-8 h-8 rounded-lg ' +
                        m.bg +
                        ' flex items-center justify-center mb-2'
                      }
                    >
                      <Icon className={'w-4 h-4 ' + m.color} />
                    </div>
                    <div className="text-base font-bold text-slate-800">
                      {m.value}
                    </div>
                    <div className="text-xs text-slate-400">{m.label}</div>
                  </div>
                );
              })}
            </div>
            {/* 置信区间 */}
            <div className="mt-3 flex items-center gap-2 text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
              <Info className="w-3.5 h-3.5 text-brand-500" />
              <span>
                {s.confidence_interval.level}% 置信区间：
                <span className="font-medium text-slate-700">
                  {formatMoney(s.confidence_interval.lower)} ~{' '}
                  {formatMoney(s.confidence_interval.upper)}
                </span>
                （期望损失的区间估计）
              </span>
            </div>
          </div>

          {/* 分布直方图 */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="w-4 h-4 text-brand-600" />
              <h4 className="font-semibold text-slate-800 text-sm">
                损失分布直方图
              </h4>
              <span className="text-xs text-slate-400 ml-auto">
                {simulation.distribution.length} 个区间 · 按概率展示
              </span>
            </div>
            <div className="flex items-end gap-1.5 sm:gap-2 h-40">
              {simulation.distribution.map((d, idx) => {
                const heightPct = (d.probability / maxProb) * 100;
                return (
                  <div
                    key={idx}
                    className="flex-1 flex flex-col items-center gap-1 group"
                    title={`${d.range} : ${formatPercent(d.probability)}（${d.count} 次）`}
                  >
                    <div className="text-[10px] text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity">
                      {formatPercent(d.probability)}
                    </div>
                    <div className="w-full flex-1 flex items-end">
                      <div
                        className="w-full rounded-t-md bg-brand-400 hover:bg-brand-600 transition-colors"
                        style={{
                          height: Math.max(heightPct, 2) + '%',
                          minHeight: '4px',
                        }}
                      />
                    </div>
                    <div className="text-[9px] text-slate-400 leading-tight text-center">
                      {d.range}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* VaR 分析表 */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Calculator className="w-4 h-4 text-brand-600" />
              <h4 className="font-semibold text-slate-800 text-sm">
                风险价值（VaR）分析
              </h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-400 border-b border-slate-100">
                    <th className="py-2 pr-4 font-medium">指标</th>
                    <th className="py-2 pr-4 font-medium">数值</th>
                    <th className="py-2 font-medium">说明</th>
                  </tr>
                </thead>
                <tbody>
                  {varRows.map((row) => (
                    <tr
                      key={row.label}
                      className="border-b border-slate-50 last:border-0"
                    >
                      <td className="py-2.5 pr-4 font-medium text-slate-700 whitespace-nowrap">
                        {row.label}
                      </td>
                      <td className="py-2.5 pr-4 font-semibold text-slate-800 whitespace-nowrap">
                        {formatMoney(row.value)}
                      </td>
                      <td className="py-2.5 text-xs text-slate-500">
                        {row.desc}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 风险因子表 */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-4 h-4 text-brand-600" />
              <h4 className="font-semibold text-slate-800 text-sm">风险因子</h4>
              <span className="text-xs text-slate-400 ml-auto">
                共 {simulation.risk_factors.length} 项
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-400 border-b border-slate-100">
                    <th className="py-2 pr-3 font-medium">类别</th>
                    <th className="py-2 pr-3 font-medium">风险因子</th>
                    <th className="py-2 pr-3 font-medium">概率</th>
                    <th className="py-2 pr-3 font-medium">影响</th>
                    <th className="py-2 pr-3 font-medium">权重</th>
                    <th className="py-2 font-medium">说明 / 缓释措施</th>
                  </tr>
                </thead>
                <tbody>
                  {simulation.risk_factors.map((rf) => (
                    <tr
                      key={rf.id}
                      className="border-b border-slate-50 last:border-0 align-top"
                    >
                      <td className="py-2.5 pr-3 whitespace-nowrap">
                        <span
                          className={
                            'inline-flex items-center text-xs px-2 py-0.5 rounded ' +
                            (RISK_CATEGORY_CLS[rf.category] ||
                              'bg-slate-100 text-slate-600')
                          }
                        >
                          {RISK_CATEGORY_LABELS[rf.category]}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 font-medium text-slate-700 whitespace-nowrap">
                        {rf.name}
                      </td>
                      <td className="py-2.5 pr-3 text-slate-600 whitespace-nowrap">
                        {formatPercent(rf.probability)}
                      </td>
                      <td className="py-2.5 pr-3 text-slate-600 whitespace-nowrap">
                        {formatPercent(rf.impact)}
                      </td>
                      <td className="py-2.5 pr-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-600 text-xs">
                            {formatPercent(rf.weight)}
                          </span>
                          <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full bg-brand-500"
                              style={{ width: rf.weight * 100 + '%' }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 text-xs text-slate-500">
                        <p className="leading-relaxed">{rf.description}</p>
                        <p className="mt-1 text-slate-400">
                          缓释：{rf.mitigation}
                        </p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 子情景结果 */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Dice5 className="w-4 h-4 text-brand-600" />
              <h4 className="font-semibold text-slate-800 text-sm">子情景结果</h4>
            </div>
            <div className="space-y-2">
              {simulation.scenario_results.map((sr, idx) => (
                <div
                  key={idx}
                  className="flex items-start justify-between gap-3 rounded-xl border border-slate-100 p-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-slate-700 text-sm">
                        {sr.scenario}
                      </span>
                      <span className="text-xs text-slate-400">
                        概率 {formatPercent(sr.probability)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      {sr.description}
                    </p>
                  </div>
                  <span className="font-semibold text-red-600 text-sm shrink-0">
                    {formatMoney(sr.loss)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* 建议 */}
          <div className="bg-gradient-to-br from-brand-50 to-white rounded-xl border border-brand-100 p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-brand-100 flex items-center justify-center">
                <Info className="w-4 h-4 text-brand-600" />
              </div>
              <h4 className="font-semibold text-slate-800 text-sm">
                风险缓释建议
              </h4>
            </div>
            <ul className="space-y-2">
              {simulation.recommendations.map((rec, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-2 text-sm text-slate-600"
                >
                  <span className="w-5 h-5 rounded-full bg-brand-100 text-brand-600 text-xs flex items-center justify-center shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <span className="leading-relaxed">{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
