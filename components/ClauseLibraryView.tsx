'use client';

// ===== 智能条款库展示组件 =====
// 展示条款统计、搜索筛选、条款卡片、条款推荐与变量渲染能力
// 客户端组件：从 API 加载数据，支持本地搜索筛选与推荐生成

import { useState, useEffect, useCallback } from 'react';
import {
  Library,
  FileText,
  Search,
  Filter,
  Star,
  Copy,
  Plus,
  ChevronDown,
  Lightbulb,
  AlertTriangle,
  CheckCircle2,
  Tags,
  Scroll,
  BookOpen,
  Sparkles,
  Loader2,
  XCircle,
} from 'lucide-react';
import {
  ClauseLibraryItem,
  ClauseCategory,
  ClauseRiskLevel,
  ClauseSource,
  ClauseRecommendation,
  CLAUSE_CATEGORY_LABELS,
  CLAUSE_RISK_CONFIG,
  CLAUSE_SOURCE_LABELS,
} from '@/lib/types';

// ===== 分类配色（标签样式） =====
const CATEGORY_BADGE: Record<ClauseCategory, { cls: string; dot: string }> = {
  payment: { cls: 'bg-brand-50 text-brand-700 border-brand-200', dot: 'bg-brand-500' },
  delivery: { cls: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500' },
  warranty: { cls: 'bg-green-50 text-green-700 border-green-200', dot: 'bg-green-500' },
  liability: { cls: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-red-500' },
  termination: { cls: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  confidentiality: { cls: 'bg-purple-50 text-purple-700 border-purple-200', dot: 'bg-purple-500' },
  ip: { cls: 'bg-indigo-50 text-indigo-700 border-indigo-200', dot: 'bg-indigo-500' },
  dispute_resolution: { cls: 'bg-cyan-50 text-cyan-700 border-cyan-200', dot: 'bg-cyan-500' },
  force_majeure: { cls: 'bg-orange-50 text-orange-700 border-orange-200', dot: 'bg-orange-500' },
  general: { cls: 'bg-slate-100 text-slate-700 border-slate-200', dot: 'bg-slate-400' },
};

// ===== 风险等级配色 =====
const RISK_BADGE: Record<ClauseRiskLevel, { cls: string; dot: string }> = {
  low: { cls: 'bg-green-50 text-green-600 border-green-200', dot: 'bg-green-500' },
  medium: { cls: 'bg-amber-50 text-amber-600 border-amber-200', dot: 'bg-amber-500' },
  high: { cls: 'bg-red-50 text-red-600 border-red-200', dot: 'bg-red-500' },
  critical: { cls: 'bg-red-100 text-red-800 border-red-300', dot: 'bg-red-700' },
};

// ===== 来源配色 =====
const SOURCE_BADGE: Record<ClauseSource, { cls: string }> = {
  standard: { cls: 'bg-brand-50 text-brand-700 border-brand-200' },
  best_practice: { cls: 'bg-blue-50 text-blue-600 border-blue-200' },
  regulatory: { cls: 'bg-red-50 text-red-600 border-red-200' },
  negotiated: { cls: 'bg-amber-50 text-amber-600 border-amber-200' },
  custom: { cls: 'bg-slate-100 text-slate-600 border-slate-200' },
};

// 变量类型中文标签
const VAR_TYPE_LABELS: Record<string, string> = {
  text: '文本',
  number: '数字',
  date: '日期',
  currency: '金额',
  percentage: '百分比',
  choice: '选择',
};

// 全部分类列表（用于筛选侧边栏）
const ALL_CATEGORIES = Object.keys(CLAUSE_CATEGORY_LABELS) as ClauseCategory[];
const ALL_RISK_LEVELS = Object.keys(CLAUSE_RISK_CONFIG) as ClauseRiskLevel[];
const ALL_SOURCES = Object.keys(CLAUSE_SOURCE_LABELS) as ClauseSource[];

// 渲染条款文本，高亮 {{variable}} 占位符
function renderHighlightedText(text: string) {
  const parts = text.split(/(\{\{[^}]+\}\})/g);
  return parts.map((part, i) => {
    if (part.startsWith('{{') && part.endsWith('}}')) {
      const name = part.slice(2, -2).trim();
      return (
        <span
          key={i}
          className="inline-flex items-center px-1.5 py-0.5 mx-0.5 my-0.5 rounded bg-brand-100 text-brand-700 text-xs font-medium border border-brand-200"
        >
          {name}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

interface Props {
  initialClauses?: ClauseLibraryItem[];
}

export default function ClauseLibraryView({ initialClauses }: Props) {
  const [clauses, setClauses] = useState<ClauseLibraryItem[]>(
    initialClauses || []
  );
  const [stats, setStats] = useState<{
    total: number;
    byCategory: Record<ClauseCategory, number>;
    byRiskLevel: Record<ClauseRiskLevel, number>;
    totalUsage: number;
    totalFavorites: number;
    avgRiskLevel: string;
  } | null>(null);
  const [loading, setLoading] = useState(!initialClauses);
  const [error, setError] = useState<string | null>(null);

  // 搜索与筛选状态
  const [query, setQuery] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<Set<ClauseCategory>>(new Set());
  const [selectedRiskLevel, setSelectedRiskLevel] = useState<ClauseRiskLevel | null>(null);
  const [selectedSource, setSelectedSource] = useState<ClauseSource | null>(null);
  const [showFilters, setShowFilters] = useState(true);

  // 展开状态
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // 渲染表单状态
  const [renderClauseId, setRenderClauseId] = useState<string | null>(null);
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [renderedText, setRenderedText] = useState<
    { clauseId: string; text: string } | null
  >(null);
  const [renderLoading, setRenderLoading] = useState(false);

  // 推荐面板状态
  const [recContractType, setRecContractType] = useState('采购合同');
  const [recContext, setRecContext] = useState('');
  const [recommendation, setRecommendation] = useState<ClauseRecommendation | null>(null);
  const [recLoading, setRecLoading] = useState(false);

  // 收藏状态
  const [favoritedSet, setFavoritedSet] = useState<Set<string>>(new Set());

  // 从 API 加载条款与统计
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/clause-library');
      if (!res.ok) throw new Error('加载条款失败');
      const data = await res.json();
      setClauses(data.clauses || []);
      setStats(data.stats || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!initialClauses) {
      loadData();
    } else if (!stats) {
      // 有初始数据时同步统计
      fetch('/api/clause-library')
        .then((r) => r.json())
        .then((d) => setStats(d.stats || null))
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 本地搜索 + 筛选
  const filteredClauses = clauses.filter((c) => {
    // 分类筛选（多选，空集合表示全部）
    if (selectedCategories.size > 0 && !selectedCategories.has(c.category)) {
      return false;
    }
    if (selectedRiskLevel && c.risk_level !== selectedRiskLevel) return false;
    if (selectedSource && c.source !== selectedSource) return false;

    // 全文搜索
    const q = query.trim().toLowerCase();
    if (q) {
      const haystack = [
        c.title,
        c.text,
        c.risk_notes,
        c.negotiation_tips,
        c.tags.join(' '),
        c.applicable_contracts.join(' '),
      ]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  // 切换分类勾选
  function toggleCategory(cat: ClauseCategory) {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) {
        next.delete(cat);
      } else {
        next.add(cat);
      }
      return next;
    });
  }

  // 清空筛选
  function clearFilters() {
    setSelectedCategories(new Set());
    setSelectedRiskLevel(null);
    setSelectedSource(null);
    setQuery('');
  }

  // 复制条款文本
  async function handleCopy(clause: ClauseLibraryItem) {
    try {
      await navigator.clipboard.writeText(clause.text);
    } catch {
      // 忽略剪贴板错误
    }
  }

  // 切换收藏
  async function handleFavorite(clause: ClauseLibraryItem) {
    const isFav = favoritedSet.has(clause.id);
    // 乐观更新
    setFavoritedSet((prev) => {
      const next = new Set(prev);
      if (isFav) {
        next.delete(clause.id);
      } else {
        next.add(clause.id);
      }
      return next;
    });
    setClauses((prev) =>
      prev.map((c) =>
        c.id === clause.id
          ? {
              ...c,
              favor_count: Math.max(
                0,
                c.favor_count + (isFav ? -1 : 1)
              ),
            }
          : c
      )
    );

    try {
      await fetch('/api/clause-library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'favorite', clause_id: clause.id }),
      });
    } catch {
      // 演示模式忽略网络错误
    }
  }

  // 打开渲染表单
  function openRenderForm(clause: ClauseLibraryItem) {
    setRenderedText(null);
    if (renderClauseId === clause.id) {
      setRenderClauseId(null);
      return;
    }
    // 用默认值初始化变量
    const defaults: Record<string, string> = {};
    clause.variables.forEach((v) => {
      defaults[v.name] = v.default_value ?? '';
    });
    setVariableValues(defaults);
    setRenderClauseId(clause.id);
  }

  // 提交渲染
  async function handleRender(clause: ClauseLibraryItem) {
    setRenderLoading(true);
    setRenderedText(null);
    try {
      const res = await fetch('/api/clause-library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'render',
          clause_id: clause.id,
          variables: variableValues,
        }),
      });
      if (!res.ok) throw new Error('渲染失败');
      const data = await res.json();
      setRenderedText({ clauseId: clause.id, text: data.rendered_text });
    } catch {
      // 本地兜底渲染
      const text = clause.text.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
        const k = String(key).trim();
        return variableValues[k] ?? clause.variables.find((v) => v.name === k)?.default_value ?? '';
      });
      setRenderedText({ clauseId: clause.id, text });
    } finally {
      setRenderLoading(false);
    }
  }

  // 生成条款推荐
  async function handleRecommend() {
    setRecLoading(true);
    setRecommendation(null);
    try {
      const res = await fetch('/api/clause-library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'recommend',
          contract_type: recContractType,
          context: recContext,
        }),
      });
      if (!res.ok) throw new Error('生成推荐失败');
      const data = await res.json();
      setRecommendation(data.recommendation);
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成推荐失败');
    } finally {
      setRecLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
      </div>
    );
  }

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

      {/* ===== 顶部统计卡片 ===== */}
      {stats && <StatsCard stats={stats} />}

      {/* ===== 搜索栏 ===== */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索条款标题、内容、标签或适用合同类型..."
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-700 bg-slate-50/60 focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400"
            />
          </div>
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
              showFilters
                ? 'text-brand-700 bg-brand-50 border-brand-200'
                : 'text-slate-600 bg-white border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Filter className="w-4 h-4" />
            筛选
          </button>
          {(selectedCategories.size > 0 ||
            selectedRiskLevel ||
            selectedSource ||
            query) && (
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-500 bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-colors"
            >
              <XCircle className="w-4 h-4" />
              清空
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-6">
        {/* ===== 筛选侧边栏 ===== */}
        {showFilters && (
          <aside className="w-64 shrink-0 hidden lg:block">
            <FilterSidebar
              selectedCategories={selectedCategories}
              selectedRiskLevel={selectedRiskLevel}
              selectedSource={selectedSource}
              onToggleCategory={toggleCategory}
              onSelectRiskLevel={setSelectedRiskLevel}
              onSelectSource={setSelectedSource}
              stats={stats}
            />
          </aside>
        )}

        {/* ===== 条款列表 ===== */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* 移动端筛选（折叠面板内联） */}
          {showFilters && (
            <div className="lg:hidden">
              <FilterSidebar
                selectedCategories={selectedCategories}
                selectedRiskLevel={selectedRiskLevel}
                selectedSource={selectedSource}
                onToggleCategory={toggleCategory}
                onSelectRiskLevel={(v) =>
                  setSelectedRiskLevel(v === selectedRiskLevel ? null : v)
                }
                onSelectSource={(v) =>
                  setSelectedSource(v === selectedSource ? null : v)
                }
                stats={stats}
              />
            </div>
          )}

          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">
              共找到 <span className="font-semibold text-slate-700">{filteredClauses.length}</span> 条条款
            </p>
          </div>

          {filteredClauses.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
              <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-400">
                未找到匹配的条款，请调整搜索关键词或筛选条件
              </p>
            </div>
          ) : (
            filteredClauses.map((clause) => (
              <ClauseCard
                key={clause.id}
                clause={clause}
                expanded={expandedId === clause.id}
                onToggleExpand={() =>
                  setExpandedId(expandedId === clause.id ? null : clause.id)
                }
                favorited={favoritedSet.has(clause.id)}
                onFavorite={() => handleFavorite(clause)}
                onCopy={() => handleCopy(clause)}
                renderOpen={renderClauseId === clause.id}
                onToggleRender={() => openRenderForm(clause)}
                variableValues={variableValues}
                onVariableChange={(name, val) =>
                  setVariableValues((prev) => ({ ...prev, [name]: val }))
                }
                onRender={() => handleRender(clause)}
                renderedText={
                  renderedText?.clauseId === clause.id
                    ? renderedText.text
                    : null
                }
                renderLoading={renderLoading}
              />
            ))
          )}
        </div>
      </div>

      {/* ===== 条款推荐面板 ===== */}
      <RecommendationPanel
        contractType={recContractType}
        context={recContext}
        onContractTypeChange={setRecContractType}
        onContextChange={setRecContext}
        onRecommend={handleRecommend}
        loading={recLoading}
        recommendation={recommendation}
        clauses={clauses}
      />
    </div>
  );
}

// ===== 统计卡片 =====
function StatsCard({
  stats,
}: {
  stats: {
    total: number;
    byCategory: Record<ClauseCategory, number>;
    byRiskLevel: Record<ClauseRiskLevel, number>;
    totalUsage: number;
    totalFavorites: number;
    avgRiskLevel: string;
  };
}) {
  return (
    <div className="bg-gradient-to-br from-brand-600 to-brand-800 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <Library className="w-5 h-5 text-white" />
        <h3 className="font-semibold text-white">条款库概览</h3>
        <span className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/15 text-white text-xs">
          {stats.total} 条条款
        </span>
      </div>

      {/* 核心指标 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <StatMetric icon={FileText} label="条款总数" value={stats.total} />
        <StatMetric icon={Scroll} label="使用次数" value={stats.totalUsage} />
        <StatMetric icon={Star} label="收藏总数" value={stats.totalFavorites} />
        <StatMetric icon={AlertTriangle} label="平均风险" value={stats.avgRiskLevel} isText />
      </div>

      {/* 分类分布 + 风险分布 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-brand-100 mb-2 flex items-center gap-1">
            <Tags className="w-3.5 h-3.5" />
            分类分布
          </p>
          <div className="flex flex-wrap gap-1.5">
            {ALL_CATEGORIES.map((cat) => (
              <span
                key={cat}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/10 text-white text-xs"
              >
                {CLAUSE_CATEGORY_LABELS[cat]}
                <span className="font-semibold text-brand-50">
                  {stats.byCategory[cat] || 0}
                </span>
              </span>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs text-brand-100 mb-2 flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" />
            风险等级分布
          </p>
          <div className="flex flex-wrap gap-1.5">
            {ALL_RISK_LEVELS.map((rl) => (
              <span
                key={rl}
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/10 text-white text-xs"
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: CLAUSE_RISK_CONFIG[rl].color }}
                />
                {CLAUSE_RISK_CONFIG[rl].label}
                <span className="font-semibold text-brand-50">
                  {stats.byRiskLevel[rl] || 0}
                </span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ===== 单个统计指标 =====
function StatMetric({
  icon: Icon,
  label,
  value,
  isText,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  isText?: boolean;
}) {
  return (
    <div className="rounded-xl bg-white/10 p-3">
      <div className="flex items-center gap-1.5 text-brand-100 mb-1">
        <Icon className="w-3.5 h-3.5" />
        <span className="text-xs">{label}</span>
      </div>
      <div className="text-lg font-bold text-white">
        {isText ? value : (value as number).toLocaleString()}
      </div>
    </div>
  );
}

// ===== 筛选侧边栏 =====
function FilterSidebar({
  selectedCategories,
  selectedRiskLevel,
  selectedSource,
  onToggleCategory,
  onSelectRiskLevel,
  onSelectSource,
  stats,
}: {
  selectedCategories: Set<ClauseCategory>;
  selectedRiskLevel: ClauseRiskLevel | null;
  selectedSource: ClauseSource | null;
  onToggleCategory: (cat: ClauseCategory) => void;
  onSelectRiskLevel: (level: ClauseRiskLevel) => void;
  onSelectSource: (source: ClauseSource) => void;
  stats: {
    byCategory: Record<ClauseCategory, number>;
    byRiskLevel: Record<ClauseRiskLevel, number>;
  } | null;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-5">
      {/* 分类筛选 */}
      <div>
        <div className="flex items-center gap-1.5 mb-3">
          <Tags className="w-4 h-4 text-brand-600" />
          <h4 className="text-sm font-semibold text-slate-700">条款分类</h4>
        </div>
        <div className="space-y-1.5">
          {ALL_CATEGORIES.map((cat) => {
            const checked = selectedCategories.has(cat);
            const count = stats?.byCategory[cat] || 0;
            const cfg = CATEGORY_BADGE[cat];
            return (
              <label
                key={cat}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggleCategory(cat)}
                  className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-300"
                />
                <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                <span className="text-sm text-slate-600 flex-1">
                  {CLAUSE_CATEGORY_LABELS[cat]}
                </span>
                <span className="text-xs text-slate-400">{count}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* 风险等级筛选 */}
      <div>
        <div className="flex items-center gap-1.5 mb-3">
          <AlertTriangle className="w-4 h-4 text-brand-600" />
          <h4 className="text-sm font-semibold text-slate-700">风险等级</h4>
        </div>
        <div className="space-y-1.5">
          {ALL_RISK_LEVELS.map((rl) => {
            const cfg = RISK_BADGE[rl];
            const count = stats?.byRiskLevel[rl] || 0;
            return (
              <button
                key={rl}
                onClick={() => onSelectRiskLevel(rl)}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm transition-colors border ${
                  selectedRiskLevel === rl
                    ? cfg.cls + ' font-medium'
                    : 'border-transparent text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                <span className="flex-1 text-left">
                  {CLAUSE_RISK_CONFIG[rl].label}
                </span>
                <span className="text-xs text-slate-400">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 来源筛选 */}
      <div>
        <div className="flex items-center gap-1.5 mb-3">
          <BookOpen className="w-4 h-4 text-brand-600" />
          <h4 className="text-sm font-semibold text-slate-700">条款来源</h4>
        </div>
        <div className="space-y-1.5">
          {ALL_SOURCES.map((src) => (
            <button
              key={src}
              onClick={() => onSelectSource(src)}
              className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm transition-colors border ${
                selectedSource === src
                  ? SOURCE_BADGE[src].cls + ' font-medium'
                  : 'border-transparent text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span className="flex-1 text-left">
                {CLAUSE_SOURCE_LABELS[src]}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ===== 条款卡片 =====
function ClauseCard({
  clause,
  expanded,
  onToggleExpand,
  favorited,
  onFavorite,
  onCopy,
  renderOpen,
  onToggleRender,
  variableValues,
  onVariableChange,
  onRender,
  renderedText,
  renderLoading,
}: {
  clause: ClauseLibraryItem;
  expanded: boolean;
  onToggleExpand: () => void;
  favorited: boolean;
  onFavorite: () => void;
  onCopy: () => void;
  renderOpen: boolean;
  onToggleRender: () => void;
  variableValues: Record<string, string>;
  onVariableChange: (name: string, val: string) => void;
  onRender: () => void;
  renderedText: string | null;
  renderLoading: boolean;
}) {
  const catCfg = CATEGORY_BADGE[clause.category];
  const riskCfg = RISK_BADGE[clause.risk_level];
  const srcCfg = SOURCE_BADGE[clause.source];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* 卡片头部 */}
      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-slate-800 text-base">
              {clause.title}
            </h3>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={onFavorite}
              title={favorited ? '取消收藏' : '收藏'}
              className={`p-1.5 rounded-lg transition-colors ${
                favorited
                  ? 'text-amber-500 bg-amber-50'
                  : 'text-slate-400 hover:text-amber-500 hover:bg-amber-50'
              }`}
            >
              <Star className={`w-4 h-4 ${favorited ? 'fill-amber-400' : ''}`} />
            </button>
            <button
              onClick={onCopy}
              title="复制条款"
              className="p-1.5 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
            >
              <Copy className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 徽章行 */}
        <div className="flex items-center gap-1.5 flex-wrap mb-3">
          <span
            className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${catCfg.cls}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${catCfg.dot}`} />
            {CLAUSE_CATEGORY_LABELS[clause.category]}
          </span>
          <span
            className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${riskCfg.cls}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${riskCfg.dot}`} />
            {CLAUSE_RISK_CONFIG[clause.risk_level].label}
          </span>
          <span
            className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full border ${srcCfg.cls}`}
          >
            {CLAUSE_SOURCE_LABELS[clause.source]}
          </span>
        </div>

        {/* 条款文本 */}
        <div className="rounded-xl bg-slate-50/60 border border-slate-100 p-3 mb-3">
          <p className="text-sm text-slate-700 leading-relaxed">
            {renderHighlightedText(clause.text)}
          </p>
        </div>

        {/* 标签 + 统计 */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            {clause.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-500"
              >
                #{tag}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span className="inline-flex items-center gap-1">
              <Scroll className="w-3.5 h-3.5" />
              使用 {clause.usage_count}
            </span>
            <span className="inline-flex items-center gap-1">
              <Star className="w-3.5 h-3.5" />
              收藏 {clause.favor_count}
            </span>
          </div>
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="px-5 pb-3 flex items-center gap-2 flex-wrap">
        <button
          onClick={onToggleExpand}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors"
        >
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform ${
              expanded ? 'rotate-180' : ''
            }`}
          />
          {expanded ? '收起详情' : '查看详情'}
        </button>
        <button
          onClick={onToggleRender}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
            renderOpen
              ? 'text-brand-700 bg-brand-50 border-brand-200'
              : 'text-brand-700 bg-white border-brand-200 hover:bg-brand-50'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          填充变量渲染
        </button>
      </div>

      {/* 展开详情区 */}
      {expanded && (
        <div className="px-5 pb-5 border-t border-slate-100 pt-4 space-y-4">
          {/* 变量列表 */}
          {clause.variables.length > 0 && (
            <DetailSection icon={Plus} title="变量定义" count={clause.variables.length}>
              <div className="space-y-2">
                {clause.variables.map((v) => (
                  <div
                    key={v.name}
                    className="rounded-lg border border-slate-100 p-2.5"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <code className="text-xs font-mono text-brand-700 bg-brand-50 px-1.5 py-0.5 rounded">
                        {`{{${v.name}}}`}
                      </code>
                      <span className="text-xs text-slate-500">
                        {VAR_TYPE_LABELS[v.type] || v.type}
                      </span>
                      {v.required && (
                        <span className="text-xs text-red-500">必填</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mb-1">{v.description}</p>
                    <div className="text-xs text-slate-400">
                      默认值：<span className="text-slate-600">{v.default_value}</span>
                      {v.options && v.options.length > 0 && (
                        <span className="ml-2">
                          选项：{v.options.join(' / ')}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </DetailSection>
          )}

          {/* 替代版本 */}
          {clause.alternative_versions.length > 0 && (
            <DetailSection
              icon={FileText}
              title="替代版本"
              count={clause.alternative_versions.length}
            >
              <div className="space-y-2.5">
                {clause.alternative_versions.map((alt) => {
                  const altRisk = RISK_BADGE[alt.risk_level];
                  return (
                    <div
                      key={alt.id}
                      className="rounded-lg border border-slate-100 p-3"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-medium text-slate-700">
                          {alt.label}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full border ${altRisk.cls}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${altRisk.dot}`} />
                          {CLAUSE_RISK_CONFIG[alt.risk_level].label}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed mb-2">
                        {alt.text}
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <div className="flex items-start gap-1.5 text-xs">
                          <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0 mt-0.5" />
                          <span className="text-slate-500">
                            <span className="text-green-600 font-medium">优势：</span>
                            {alt.advantage}
                          </span>
                        </div>
                        <div className="flex items-start gap-1.5 text-xs">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                          <span className="text-slate-500">
                            <span className="text-amber-600 font-medium">劣势：</span>
                            {alt.disadvantage}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </DetailSection>
          )}

          {/* 风险提示 */}
          {clause.risk_notes && (
            <DetailSection icon={AlertTriangle} title="风险提示">
              <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs text-slate-600 leading-relaxed">
                  {clause.risk_notes}
                </p>
              </div>
            </DetailSection>
          )}

          {/* 谈判技巧 */}
          {clause.negotiation_tips && (
            <DetailSection icon={Lightbulb} title="谈判技巧">
              <div className="flex items-start gap-2 rounded-lg bg-brand-50 border border-brand-200 p-3">
                <Lightbulb className="w-4 h-4 text-brand-500 shrink-0 mt-0.5" />
                <p className="text-xs text-slate-600 leading-relaxed">
                  {clause.negotiation_tips}
                </p>
              </div>
            </DetailSection>
          )}

          {/* 适用范围 */}
          <DetailSection icon={BookOpen} title="适用范围">
            <div className="flex flex-col gap-2 text-xs text-slate-500">
              <div className="flex items-start gap-2">
                <span className="text-slate-400 shrink-0">适用合同：</span>
                <span>{clause.applicable_contracts.join('、')}</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-slate-400 shrink-0">适用地区：</span>
                <span>{clause.jurisdictions.join('、')}</span>
              </div>
            </div>
          </DetailSection>
        </div>
      )}

      {/* 渲染表单 */}
      {renderOpen && (
        <div className="px-5 pb-5 border-t border-slate-100 pt-4">
          <div className="flex items-center gap-1.5 mb-3">
            <Sparkles className="w-4 h-4 text-brand-600" />
            <h4 className="text-sm font-semibold text-slate-700">
              变量填充与渲染
            </h4>
          </div>
          {clause.variables.length === 0 ? (
            <p className="text-xs text-slate-400">该条款无可填充变量</p>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {clause.variables.map((v) => (
                  <div key={v.name}>
                    <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 mb-1">
                      <code className="font-mono text-brand-700">{`{{${v.name}}}`}</code>
                      {v.required && <span className="text-red-500">*</span>}
                      <span className="text-slate-400">{v.description}</span>
                    </label>
                    {v.type === 'choice' && v.options ? (
                      <select
                        value={variableValues[v.name] ?? ''}
                        onChange={(e) => onVariableChange(v.name, e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400"
                      >
                        {v.options.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={v.type === 'date' ? 'date' : 'text'}
                        value={variableValues[v.name] ?? ''}
                        onChange={(e) => onVariableChange(v.name, e.target.value)}
                        placeholder={v.default_value}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-700 bg-slate-50/60 focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400"
                      />
                    )}
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={onRender}
                  disabled={renderLoading}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 border border-brand-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {renderLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  {renderLoading ? '渲染中...' : '渲染条款'}
                </button>
              </div>

              {/* 渲染结果 */}
              {renderedText && (
                <div className="rounded-xl bg-green-50 border border-green-200 p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-medium text-green-700">
                      渲染结果
                    </span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(renderedText).catch(() => {});
                      }}
                      className="ml-auto p-1 rounded text-green-600 hover:bg-green-100 transition-colors"
                      title="复制结果"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed">
                    {renderedText}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ===== 详情区块容器 =====
function DetailSection({
  icon: Icon,
  title,
  count,
  children,
}: {
  icon: React.ElementType;
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <Icon className="w-4 h-4 text-brand-600" />
        <h4 className="text-sm font-semibold text-slate-700">{title}</h4>
        {count !== undefined && (
          <span className="text-xs text-slate-400 ml-auto">{count} 项</span>
        )}
      </div>
      {children}
    </div>
  );
}

// ===== 条款推荐面板 =====
function RecommendationPanel({
  contractType,
  context,
  onContractTypeChange,
  onContextChange,
  onRecommend,
  loading,
  recommendation,
  clauses,
}: {
  contractType: string;
  context: string;
  onContractTypeChange: (v: string) => void;
  onContextChange: (v: string) => void;
  onRecommend: () => void;
  loading: boolean;
  recommendation: ClauseRecommendation | null;
  clauses: ClauseLibraryItem[];
}) {
  const contractTypes = ['采购合同', '服务合同', '租赁合同', '技术开发合同', '工程合同', '通用合同'];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center">
          <Lightbulb className="w-4 h-4 text-brand-600" />
        </div>
        <div>
          <h3 className="font-semibold text-slate-800">智能条款推荐</h3>
          <p className="text-xs text-slate-400">
            根据合同类型与上下文，推荐最相关的条款并提示缺失条款
          </p>
        </div>
      </div>

      {/* 输入区 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <div>
          <label className="text-xs font-medium text-slate-600 mb-1 block">
            合同类型
          </label>
          <select
            value={contractType}
            onChange={(e) => onContractTypeChange(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400"
          >
            {contractTypes.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="text-xs font-medium text-slate-600 mb-1 block">
            上下文（关键词，如：数据、知识产权、分期付款）
          </label>
          <input
            type="text"
            value={context}
            onChange={(e) => onContextChange(e.target.value)}
            placeholder="输入合同背景或关注的重点关键词..."
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 bg-slate-50/60 focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400"
          />
        </div>
      </div>

      <button
        onClick={onRecommend}
        disabled={loading}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 border border-brand-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mb-5"
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Sparkles className="w-4 h-4" />
        )}
        {loading ? '生成中...' : '生成推荐'}
      </button>

      {/* 推荐结果 */}
      {recommendation && (
        <div className="space-y-5">
          {/* 推荐条款 */}
          <div>
            <div className="flex items-center gap-1.5 mb-3">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              <h4 className="text-sm font-semibold text-slate-700">
                推荐条款
              </h4>
              <span className="text-xs text-slate-400 ml-auto">
                {recommendation.recommended_clauses.length} 项
              </span>
            </div>
            <div className="space-y-2">
              {recommendation.recommended_clauses.map((rec, idx) => {
                const clause = clauses.find((c) => c.id === rec.clause_id);
                return (
                  <div
                    key={idx}
                    className="rounded-xl border border-slate-100 p-3 hover:border-brand-200 transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="w-6 h-6 rounded-full bg-brand-50 text-brand-700 text-xs font-semibold flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <span className="text-sm font-medium text-slate-700 flex-1 truncate">
                        {clause ? clause.title : rec.clause_id}
                      </span>
                      {clause && (
                        <span
                          className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full border ${
                            CATEGORY_BADGE[clause.category].cls
                          }`}
                        >
                          {CLAUSE_CATEGORY_LABELS[clause.category]}
                        </span>
                      )}
                      <div className="flex items-center gap-1">
                        <div className="w-16 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full rounded-full gradient-bg"
                            style={{ width: `${rec.relevance}%` }}
                          />
                        </div>
                        <span className="text-xs font-semibold text-brand-600">
                          {rec.relevance}%
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      {rec.reason}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 缺失条款 */}
          {recommendation.missing_clauses.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-3">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <h4 className="text-sm font-semibold text-slate-700">
                  建议补充条款
                </h4>
                <span className="text-xs text-slate-400 ml-auto">
                  {recommendation.missing_clauses.length} 项
                </span>
              </div>
              <div className="space-y-2">
                {recommendation.missing_clauses.map((miss, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2 rounded-xl border border-amber-100 bg-amber-50/50 p-3"
                  >
                    <span
                      className={`inline-flex items-center text-xs px-1.5 py-0.5 rounded shrink-0 ${
                        miss.importance === '重要'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {miss.importance}
                    </span>
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-slate-700">
                        {CLAUSE_CATEGORY_LABELS[miss.category]}
                      </span>
                      <p className="text-xs text-slate-500 leading-relaxed mt-0.5">
                        {miss.reason}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
