'use client';

// ===== AI 智能定价分析视图 =====
// 自包含组件：顶部统计 + 分析列表卡片 + 新建分析表单
// 通过 /api/pricing 获取与提交数据，展示完整定价分析能力

import { useState, useEffect, useCallback } from 'react';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Target,
  Info,
  Calculator,
  Sparkles,
  ArrowUp,
  ArrowDown,
  Minus,
} from 'lucide-react';
import {
  PricingAnalysis,
  PRICE_COMPARISON_CONFIG,
} from '@/lib/types';

// ===== 类型定义 =====

interface PricingStats {
  total: number;
  belowMarket: number;
  atMarket: number;
  aboveMarket: number;
  avgDeviation: number;
  potentialSavings: number;
}

// 定价因素影响方向配置
const FACTOR_IMPACT_CONFIG: Record<
  'positive' | 'negative' | 'neutral',
  { label: string; color: string; bg: string; icon: React.ElementType }
> = {
  positive: { label: '正面', color: '#16a34a', bg: '#f0fdf4', icon: ArrowUp },
  negative: { label: '负面', color: '#dc2626', bg: '#fef2f2', icon: ArrowDown },
  neutral: { label: '中性', color: '#6b7280', bg: '#f9fafb', icon: Minus },
};

// 千分位格式化金额
function formatMoney(value: number): string {
  return value.toLocaleString('zh-CN', { maximumFractionDigits: 2 });
}

export default function PricingAnalysisView() {
  const [analyses, setAnalyses] = useState<PricingAnalysis[]>([]);
  const [stats, setStats] = useState<PricingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // 表单状态
  const [form, setForm] = useState({
    contract_id: '',
    contract_title: '',
    contract_type: '采购合同',
    contract_value: '',
    unit_price: '',
    unit: '件',
  });
  const [submitting, setSubmitting] = useState(false);

  // ===== 加载定价分析数据 =====
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/pricing', { cache: 'no-store' });
      if (!res.ok) throw new Error('加载定价分析失败');
      const data = await res.json();
      setAnalyses(data.analyses || []);
      setStats(data.stats || null);
      // 默认展开第一条
      if (data.analyses && data.analyses.length > 0 && !expandedId) {
        setExpandedId(data.analyses[0].contract_id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载定价分析失败');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // ===== 提交分析表单 =====
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !form.contract_id ||
      !form.contract_title ||
      !form.contract_value ||
      !form.unit_price
    ) {
      setError('请填写完整的合同信息');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contract_id: form.contract_id,
          contract_title: form.contract_title,
          contract_type: form.contract_type,
          contract_value: Number(form.contract_value),
          currency: 'CNY',
          unit_price: Number(form.unit_price),
          unit: form.unit,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || '分析失败');
      }
      const data = await res.json();
      setAnalyses(data.analyses || []);
      setStats(data.stats || null);
      setExpandedId(data.analysis.contract_id);
      // 重置部分表单字段（保留合同类型与单位以便连续分析）
      setForm((prev) => ({
        ...prev,
        contract_id: '',
        contract_title: '',
        contract_value: '',
        unit_price: '',
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : '分析失败');
    } finally {
      setSubmitting(false);
    }
  };

  // ===== 统计卡片配置 =====
  const avgDev = stats?.avgDeviation ?? 0;
  const statCards = [
    {
      label: '分析总数',
      value: stats?.total ?? 0,
      icon: BarChart3,
      color: 'text-brand-600',
      bg: 'bg-brand-50',
    },
    {
      label: '低于市场',
      value: stats?.belowMarket ?? 0,
      icon: TrendingDown,
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
    {
      label: '符合市场',
      value: stats?.atMarket ?? 0,
      icon: Target,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: '高于市场',
      value: stats?.aboveMarket ?? 0,
      icon: TrendingUp,
      color: 'text-red-600',
      bg: 'bg-red-50',
    },
    {
      label: '平均偏离',
      value: (avgDev > 0 ? '+' : '') + avgDev + '%',
      icon: Calculator,
      color: avgDev > 0 ? 'text-red-600' : avgDev < 0 ? 'text-green-600' : 'text-slate-600',
      bg: 'bg-amber-50',
    },
    {
      label: '潜在节约',
      value: '¥' + formatMoney(stats?.potentialSavings ?? 0),
      icon: DollarSign,
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
  ];

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
                <div className={'w-10 h-10 rounded-lg ' + card.bg + ' flex items-center justify-center shrink-0'}>
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

      {/* ===== 分析列表 ===== */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="w-4 h-4 text-brand-600" />
          <h2 className="font-semibold text-slate-800">定价分析列表</h2>
          <span className="text-xs text-slate-400">
            共 {analyses.length} 条 · 点击卡片展开详情
          </span>
        </div>

        {loading ? (
          <div className="py-16 text-center text-sm text-slate-400 bg-white rounded-2xl border border-slate-200">
            加载中...
          </div>
        ) : analyses.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-400 bg-white rounded-2xl border border-slate-200">
            暂无分析记录，请在下方填写合同信息生成分析
          </div>
        ) : (
          <div className="space-y-4">
            {analyses.map((a) => (
              <PricingCard
                key={a.contract_id}
                analysis={a}
                expanded={a.contract_id === expandedId}
                onToggle={() =>
                  setExpandedId(
                    a.contract_id === expandedId ? null : a.contract_id
                  )
                }
              />
            ))}
          </div>
        )}
      </div>

      {/* ===== 新建分析表单 ===== */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Calculator className="w-4 h-4 text-brand-600" />
          <h2 className="font-semibold text-slate-800">新建定价分析</h2>
          <span className="text-xs text-slate-400 ml-auto">
            输入合同信息后将立即生成 AI 定价分析
          </span>
        </div>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-slate-500 mb-1">
              合同编号 *
            </label>
            <input
              type="text"
              value={form.contract_id}
              onChange={(e) =>
                setForm({ ...form, contract_id: e.target.value })
              }
              placeholder="如 CON-2026-0401"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-100"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs text-slate-500 mb-1">
              合同标题 *
            </label>
            <input
              type="text"
              value={form.contract_title}
              onChange={(e) =>
                setForm({ ...form, contract_title: e.target.value })
              }
              placeholder="如 办公设备批量采购合同"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-100"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">
              合同类型 *
            </label>
            <select
              value={form.contract_type}
              onChange={(e) =>
                setForm({ ...form, contract_type: e.target.value })
              }
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-100"
            >
              <option>采购合同</option>
              <option>服务合同</option>
              <option>租赁合同</option>
              <option>技术开发合同</option>
              <option>咨询服务合同</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">
              合同金额（元）*
            </label>
            <input
              type="number"
              value={form.contract_value}
              onChange={(e) =>
                setForm({ ...form, contract_value: e.target.value })
              }
              placeholder="如 1160000"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-100"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">
              单价（元）*
            </label>
            <input
              type="number"
              value={form.unit_price}
              onChange={(e) =>
                setForm({ ...form, unit_price: e.target.value })
              }
              placeholder="如 510"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-100"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">
              计价单位 *
            </label>
            <input
              type="text"
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
              placeholder="如 件 / 人天 / 平米/月"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-100"
            />
          </div>
          <div className="md:col-span-3 flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Sparkles className="w-4 h-4" />
              {submitting ? '分析中...' : '生成定价分析'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ===== 单个定价分析卡片 =====
function PricingCard({
  analysis,
  expanded,
  onToggle,
}: {
  analysis: PricingAnalysis;
  expanded: boolean;
  onToggle: () => void;
}) {
  const config = PRICE_COMPARISON_CONFIG[analysis.comparison];
  const benchmark = analysis.market_benchmark;
  const deviation = analysis.deviation_percentage;

  // 偏离方向与图标
  let DeviationIcon: React.ElementType = Minus;
  let deviationColor = 'text-slate-500';
  if (deviation > 0) {
    DeviationIcon = ArrowUp;
    deviationColor = 'text-red-600';
  } else if (deviation < 0) {
    DeviationIcon = ArrowDown;
    deviationColor = 'text-green-600';
  }

  // 单价在市场区间中的位置百分比
  const range = benchmark.max_price - benchmark.min_price || 1;
  const pricePosition = Math.max(
    0,
    Math.min(100, ((analysis.unit_price - benchmark.min_price) / range) * 100)
  );

  // 历史趋势数据
  const prices = analysis.historical_prices || [];
  const maxPrice = Math.max(...prices.map((p) => p.price), 1);
  const minPrice = Math.min(...prices.map((p) => p.price), 0);
  const histRange = maxPrice - minPrice || 1;

  // 置信度颜色
  const confidenceColor =
    analysis.confidence >= 80
      ? '#16a34a'
      : analysis.confidence >= 60
      ? '#d97706'
      : '#dc2626';

  // 市场均价位置
  const avgPosition = Math.max(
    0,
    Math.min(100, ((benchmark.avg_price - benchmark.min_price) / range) * 100)
  );

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* ===== 卡片头部：合同信息 + 比较标签 ===== */}
      <button
        onClick={onToggle}
        className="w-full text-left p-5 hover:bg-slate-50/50 transition-colors"
      >
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
              <DollarSign className="w-3.5 h-3.5" />
              <span>{analysis.contract_type}</span>
              <span>·</span>
              <span>{analysis.contract_id}</span>
            </div>
            <h3 className="text-lg font-semibold text-slate-800 truncate">
              {analysis.contract_title}
            </h3>
            <div className="mt-1 flex items-center gap-3 text-sm text-slate-500">
              <span>合同金额 ¥{formatMoney(analysis.contract_value)}</span>
              <span className="text-slate-300">|</span>
              <span>
                单价 ¥{formatMoney(analysis.unit_price)} / {analysis.unit}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <div className="flex items-center gap-1">
                <DeviationIcon className={'w-4 h-4 ' + deviationColor} />
                <span className={'text-xl font-bold ' + deviationColor}>
                  {deviation > 0 ? '+' : ''}
                  {deviation}%
                </span>
              </div>
              <div className="text-[11px] text-slate-400">偏离市场中位价</div>
            </div>
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium"
              style={{ color: config.color, backgroundColor: config.bg }}
            >
              {analysis.comparison === 'below_market' ? (
                <TrendingDown className="w-4 h-4" />
              ) : analysis.comparison === 'above_market' ? (
                <TrendingUp className="w-4 h-4" />
              ) : (
                <Target className="w-4 h-4" />
              )}
              {config.label}
            </span>
          </div>
        </div>

        {/* 单价在市场区间中的位置条 */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
            <span>最低 ¥{formatMoney(benchmark.min_price)}</span>
            <span>市场均价 ¥{formatMoney(benchmark.avg_price)}</span>
            <span>最高 ¥{formatMoney(benchmark.max_price)}</span>
          </div>
          <div className="relative h-2.5 rounded-full bg-gradient-to-r from-green-200 via-slate-200 to-red-200">
            {/* 市场均价标记 */}
            <div
              className="absolute top-1/2 -translate-y-1/2 w-px h-4 bg-blue-400"
              style={{ left: avgPosition + '%' }}
            />
            {/* 当前单价标记 */}
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white shadow"
              style={{
                left: pricePosition + '%',
                transform: 'translate(-50%, -50%)',
                backgroundColor: config.color,
              }}
            />
          </div>
          <div className="mt-1 text-[11px] text-slate-400 flex items-center gap-1">
            <Info className="w-3 h-3" />
            当前单价在市场区间中的位置（圆点），蓝线为市场均价
          </div>
        </div>
      </button>

      {/* ===== 展开详情 ===== */}
      {expanded && (
        <div className="border-t border-slate-100 p-5 space-y-5">
          {/* 市场基准 */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Target className="w-4 h-4 text-brand-600" />
              <h4 className="font-semibold text-slate-800 text-sm">市场基准价格</h4>
              <span className="text-xs text-slate-400 ml-auto">
                来源：{benchmark.source} · 样本 {benchmark.sample_count} 份
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <BenchmarkItem label="最低价" value={benchmark.min_price} unit={analysis.unit} tone="low" />
              <BenchmarkItem label="平均价" value={benchmark.avg_price} unit={analysis.unit} tone="mid" />
              <BenchmarkItem label="中位价" value={benchmark.median_price} unit={analysis.unit} tone="mid" />
              <BenchmarkItem label="最高价" value={benchmark.max_price} unit={analysis.unit} tone="high" />
            </div>
          </div>

          {/* 定价因素 */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-brand-600" />
              <h4 className="font-semibold text-slate-800 text-sm">定价影响因素</h4>
              <span className="text-xs text-slate-400 ml-auto">
                共 {analysis.factors.length} 项
              </span>
            </div>
            <div className="space-y-2">
              {analysis.factors.map((factor, idx) => {
                const cfg = FACTOR_IMPACT_CONFIG[factor.impact];
                const Icon = cfg.icon;
                return (
                  <div
                    key={idx}
                    className="flex items-start gap-3 rounded-xl border border-slate-100 p-3"
                  >
                    <span
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium shrink-0"
                      style={{ color: cfg.color, backgroundColor: cfg.bg }}
                    >
                      <Icon className="w-3 h-3" />
                      {cfg.label}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-slate-700 text-sm">
                          {factor.name}
                        </span>
                        <span className="text-xs text-slate-400">
                          权重 {(factor.weight * 100).toFixed(0)}%
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                        {factor.description}
                      </p>
                      <div className="mt-2 h-1 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: (factor.weight * 100) + '%',
                            backgroundColor: cfg.color,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 历史价格趋势 */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="w-4 h-4 text-brand-600" />
              <h4 className="font-semibold text-slate-800 text-sm">历史价格趋势</h4>
              <span className="text-xs text-slate-400 ml-auto">
                单位：元 / {analysis.unit}
              </span>
            </div>
            {prices.length === 0 ? (
              <div className="py-6 text-center text-sm text-slate-400">
                暂无历史价格数据
              </div>
            ) : (
              <div className="flex items-end gap-2 h-32">
                {prices.map((p, idx) => {
                  const heightPct = ((p.price - minPrice) / histRange) * 70 + 30;
                  const isCurrent = idx === prices.length - 1;
                  const barClass = isCurrent
                    ? 'w-full rounded-t-md transition-colors bg-brand-500 hover:bg-brand-600'
                    : 'w-full rounded-t-md transition-colors bg-brand-200 hover:bg-brand-300';
                  return (
                    <div
                      key={idx}
                      className="flex-1 flex flex-col items-center gap-1 group"
                      title={p.date + ' : ¥' + formatMoney(p.price) + ' (' + p.source + ')'}
                    >
                      <div className="text-[10px] text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity">
                        ¥{formatMoney(p.price)}
                      </div>
                      <div className="w-full flex-1 flex items-end">
                        <div
                          className={barClass}
                          style={{ height: heightPct + '%' }}
                        />
                      </div>
                      <div className="text-[9px] text-slate-400">
                        {p.date.slice(5)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* AI 分析与建议 */}
          <div className="bg-gradient-to-br from-brand-50 to-white rounded-xl border border-brand-100 p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-brand-100 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-brand-600" />
              </div>
              <h4 className="font-semibold text-slate-800 text-sm">AI 定价分析</h4>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              {analysis.analysis}
            </p>
            <div className="mt-3 rounded-lg bg-amber-50 border border-amber-100 p-3">
              <div className="flex items-center gap-2 mb-1">
                <Info className="w-3.5 h-3.5 text-amber-500" />
                <span className="font-medium text-amber-700 text-sm">定价建议</span>
              </div>
              <p className="text-sm text-amber-800 leading-relaxed whitespace-pre-line">
                {analysis.recommendation}
              </p>
            </div>
          </div>

          {/* 置信度 */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-brand-600" />
                <span className="font-semibold text-slate-800 text-sm">分析置信度</span>
              </div>
              <span className="text-lg font-bold" style={{ color: confidenceColor }}>
                {analysis.confidence}%
              </span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: analysis.confidence + '%',
                  backgroundColor: confidenceColor,
                }}
              />
            </div>
            <p className="mt-1.5 text-xs text-slate-400">
              置信度基于市场样本量（{benchmark.sample_count} 份）、偏离幅度与数据时效综合评估。
              {analysis.confidence >= 80
                ? '当前置信度较高，分析结论可直接作为决策参考。'
                : analysis.confidence >= 60
                ? '当前置信度中等，建议结合实际业务场景进一步核实。'
                : '当前置信度偏低，建议补充更多市场样本后再做决策。'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ===== 市场基准单项 =====
function BenchmarkItem({
  label,
  value,
  unit,
  tone,
}: {
  label: string;
  value: number;
  unit: string;
  tone: 'low' | 'mid' | 'high';
}) {
  const toneStyles = {
    low: { color: '#16a34a', bg: '#f0fdf4' },
    mid: { color: '#2563eb', bg: '#eff6ff' },
    high: { color: '#dc2626', bg: '#fef2f2' },
  }[tone];

  return (
    <div
      className="rounded-xl p-3 border"
      style={{ backgroundColor: toneStyles.bg, borderColor: toneStyles.color + '22' }}
    >
      <div className="text-xs" style={{ color: toneStyles.color }}>
        {label}
      </div>
      <div className="mt-1 text-lg font-bold text-slate-800">
        ¥{formatMoney(value)}
      </div>
      <div className="text-[11px] text-slate-400">/ {unit}</div>
    </div>
  );
}
