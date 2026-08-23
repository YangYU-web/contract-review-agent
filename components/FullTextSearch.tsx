'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search,
  Filter,
  X,
  ChevronLeft,
  ChevronRight,
  Tag,
  AlertTriangle,
  Calendar,
  FileText,
  Lightbulb,
} from 'lucide-react';
import {
  SearchFilter,
  SearchResultItem,
  SearchResponse,
} from '@/lib/types';
import { getFacets } from '@/lib/search-engine';

// ===== 常量配置 =====

// 风险等级选项（用于多选）
const RISK_LEVEL_OPTIONS = [
  { value: 'high', label: '高风险', color: '#dc2626', bg: 'bg-red-50' },
  { value: 'medium', label: '中风险', color: '#d97706', bg: 'bg-amber-50' },
  { value: 'low', label: '低风险', color: '#16a34a', bg: 'bg-green-50' },
];

// 分页大小
const PAGE_SIZE = 5;

// 格式化日期
function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

// 将摘要中匹配词高亮渲染（基于 highlighted_terms 的 positions）
function renderHighlightedSnippet(snippet: string, terms: { term: string; positions: number[] }[]): React.ReactNode {
  if (!terms.length) return snippet;
  // 合并所有高亮位置区间
  const ranges: { start: number; end: number }[] = [];
  for (const t of terms) {
    for (const pos of t.positions) {
      ranges.push({ start: pos, end: pos + t.term.length });
    }
  }
  // 按起始位置排序并合并重叠区间
  ranges.sort((a, b) => a.start - b.start);
  const merged: { start: number; end: number }[] = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r.start <= last.end) {
      last.end = Math.max(last.end, r.end);
    } else {
      merged.push({ ...r });
    }
  }

  const parts: React.ReactNode[] = [];
  let cursor = 0;
  merged.forEach((r, idx) => {
    if (r.start > cursor) {
      parts.push(snippet.substring(cursor, r.start));
    }
    parts.push(
      <mark key={idx} className="bg-amber-200 text-amber-900 rounded px-0.5">
        {snippet.substring(r.start, r.end)}
      </mark>
    );
    cursor = r.end;
  });
  if (cursor < snippet.length) parts.push(snippet.substring(cursor));
  return parts;
}

// 风险评分配色
function riskScoreColor(score: number): string {
  if (score >= 60) return 'text-red-600 bg-red-50';
  if (score >= 30) return 'text-amber-600 bg-amber-50';
  return 'text-green-600 bg-green-50';
}

export default function FullTextSearch() {
  const [query, setQuery] = useState('');
  const [inputValue, setInputValue] = useState('');

  // 筛选状态
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedLevels, setSelectedLevels] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [scoreMin, setScoreMin] = useState(0);
  const [scoreMax, setScoreMax] = useState(100);
  const [partyName, setPartyName] = useState('');
  const [status, setStatus] = useState('');

  // 结果状态
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  // 筛选面板展开（移动端）
  const [showFilters, setShowFilters] = useState(false);

  // ===== 执行搜索 =====
  const doSearch = useCallback(
    async (q: string) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (q) params.set('q', q);
        if (dateFrom) params.set('date_from', dateFrom);
        if (dateTo) params.set('date_to', dateTo);
        params.set('risk_score_min', String(scoreMin));
        params.set('risk_score_max', String(scoreMax));
        if (partyName) params.set('party_name', partyName);
        if (status) params.set('status', status);
        // 请求全量结果（page_size 较大），多选筛选在前端完成
        params.set('page', '1');
        params.set('page_size', '200');

        const res = await fetch(`/api/search?${params.toString()}`, {
          cache: 'no-store',
        });
        if (!res.ok) throw new Error('搜索失败');
        const data: SearchResponse = await res.json();
        setResponse(data);
        setPage(1);
      } catch (err) {
        setError(err instanceof Error ? err.message : '搜索失败');
        setResponse(null);
      } finally {
        setLoading(false);
      }
    },
    [dateFrom, dateTo, scoreMin, scoreMax, partyName, status]
  );

  // 初始加载（空查询返回全部）
  useEffect(() => {
    doSearch('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ===== 客户端多选筛选 =====
  // 对 API 返回的全量结果按合同类型 / 风险等级多选进行二次筛选
  const filteredResults = useMemo(() => {
    if (!response) return [];
    let list = response.results;

    // 合同类型多选
    if (selectedTypes.length > 0) {
      list = list.filter((r) => selectedTypes.includes(r.contract_type));
    }
    // 风险等级多选（基于风险评分映射）
    if (selectedLevels.length > 0) {
      list = list.filter((r) => {
        const level =
          r.risk_score >= 60 ? 'high' : r.risk_score >= 30 ? 'medium' : 'low';
        return selectedLevels.includes(level);
      });
    }
    return list;
  }, [response, selectedTypes, selectedLevels]);

  // 重算分面（基于客户端筛选后的结果集）
  const displayFacets = useMemo(() => {
    if (!response) {
      return { contract_types: [], risk_levels: [], date_ranges: [] };
    }
    // 若启用了多选筛选，则基于筛选后结果重算；否则使用 API 返回的分面
    if (selectedTypes.length > 0 || selectedLevels.length > 0) {
      return getFacets(filteredResults);
    }
    return response.facets;
  }, [response, filteredResults, selectedTypes, selectedLevels]);

  // 分页（客户端）
  const total = filteredResults.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedResults = filteredResults.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  // ===== 搜索提交 =====
  const handleSearch = () => {
    setQuery(inputValue);
    doSearch(inputValue);
  };

  // 回车搜索
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // ===== 切换多选筛选 =====
  const toggleType = (type: string) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
    setPage(1);
  };

  const toggleLevel = (level: string) => {
    setSelectedLevels((prev) =>
      prev.includes(level) ? prev.filter((l) => l !== level) : [...prev, level]
    );
    setPage(1);
  };

  // 点击分面快速筛选
  const handleFacetTypeClick = (label: string) => toggleType(label);
  const handleFacetLevelClick = (label: string) => {
    const map: Record<string, string> = { 高风险: 'high', 中风险: 'medium', 低风险: 'low' };
    const level = map[label];
    if (level) toggleLevel(level);
  };

  // ===== 重置筛选 =====
  const resetFilters = () => {
    setSelectedTypes([]);
    setSelectedLevels([]);
    setDateFrom('');
    setDateTo('');
    setScoreMin(0);
    setScoreMax(100);
    setPartyName('');
    setStatus('');
    setPage(1);
  };

  // 重置后重新搜索
  const handleResetAll = () => {
    resetFilters();
    setQuery('');
    setInputValue('');
    // 由于 doSearch 依赖这些状态，需在下一轮生效
    setTimeout(() => {
      const params = new URLSearchParams();
      params.set('page', '1');
      params.set('page_size', '200');
      fetch(`/api/search?${params.toString()}`, { cache: 'no-store' })
        .then((r) => r.json())
        .then((data: SearchResponse) => {
          setResponse(data);
          setPage(1);
          setLoading(false);
        })
        .catch(() => setError('搜索失败'));
      setLoading(true);
      setError(null);
    }, 0);
  };

  // 状态选项
  const statusOptions = [
    { value: 'pending', label: '待审查' },
    { value: 'reviewing', label: '审查中' },
    { value: 'completed', label: '已完成' },
    { value: 'failed', label: '失败' },
  ];

  // 是否有激活的筛选
  const hasActiveFilters =
    selectedTypes.length > 0 ||
    selectedLevels.length > 0 ||
    dateFrom !== '' ||
    dateTo !== '' ||
    scoreMin !== 0 ||
    scoreMax !== 100 ||
    partyName !== '' ||
    status !== '';

  return (
    <div className="space-y-5">
      {/* ===== 搜索栏 ===== */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="搜索合同标题、条款、风险关键词，例如：付款、违约金、保密..."
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-5 py-3 rounded-xl text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            <Search className="w-4 h-4" />
            {loading ? '搜索中...' : '搜索'}
          </button>
          <button
            onClick={() => setShowFilters((v) => !v)}
            className="lg:hidden inline-flex items-center gap-1.5 px-3 py-3 rounded-xl text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors shrink-0"
          >
            <Filter className="w-4 h-4" />
          </button>
        </div>

        {/* 顶部统计 */}
        {response && (
          <div className="mt-3 flex items-center gap-3 text-xs text-slate-400 flex-wrap">
            <span className="flex items-center gap-1">
              <FileText className="w-3.5 h-3.5" />
              共 <span className="font-medium text-slate-700">{total}</span> 条结果
            </span>
            <span>·</span>
            <span>搜索耗时 {response.search_time_ms} ms</span>
            {query && (
              <>
                <span>·</span>
                <span>
                  关键词：<span className="text-brand-600 font-medium">「{query}」</span>
                </span>
              </>
            )}
            {hasActiveFilters && (
              <button
                onClick={handleResetAll}
                className="ml-auto inline-flex items-center gap-1 text-slate-500 hover:text-red-500"
              >
                <X className="w-3.5 h-3.5" />
                清除筛选
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex gap-5">
        {/* ===== 左侧筛选面板 ===== */}
        <div
          className={`${
            showFilters ? 'block' : 'hidden'
          } lg:block w-full lg:w-64 shrink-0 space-y-4`}
        >
          <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-4 sticky top-20">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-1.5">
                <Filter className="w-4 h-4 text-brand-600" />
                筛选条件
              </h3>
              {hasActiveFilters && (
                <button
                  onClick={resetFilters}
                  className="text-xs text-slate-400 hover:text-red-500"
                >
                  重置
                </button>
              )}
            </div>

            {/* 合同类型多选 */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 mb-2">
                <Tag className="w-3.5 h-3.5" />
                合同类型
              </label>
              <div className="space-y-1.5">
                {displayFacets.contract_types.map((f) => {
                  const checked = selectedTypes.includes(f.label);
                  return (
                    <label
                      key={f.label}
                      className="flex items-center gap-2 cursor-pointer group"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleType(f.label)}
                        className="w-3.5 h-3.5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                      />
                      <span className="text-xs text-slate-600 group-hover:text-slate-800 flex-1 truncate">
                        {f.label}
                      </span>
                      <span className="text-xs text-slate-400">{f.count}</span>
                    </label>
                  );
                })}
                {displayFacets.contract_types.length === 0 && (
                  <p className="text-xs text-slate-300">暂无数据</p>
                )}
              </div>
            </div>

            {/* 风险等级多选 */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 mb-2">
                <AlertTriangle className="w-3.5 h-3.5" />
                风险等级
              </label>
              <div className="space-y-1.5">
                {displayFacets.risk_levels.map((f) => {
                  const level = RISK_LEVEL_OPTIONS.find(
                    (o) => o.label === f.label
                  );
                  const value = level?.value || '';
                  const checked = selectedLevels.includes(value);
                  return (
                    <label
                      key={f.label}
                      className="flex items-center gap-2 cursor-pointer group"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleLevel(value)}
                        className="w-3.5 h-3.5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                      />
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: level?.color }}
                      />
                      <span className="text-xs text-slate-600 group-hover:text-slate-800 flex-1">
                        {f.label}
                      </span>
                      <span className="text-xs text-slate-400">{f.count}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* 日期范围 */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 mb-2">
                <Calendar className="w-3.5 h-3.5" />
                日期范围
              </label>
              <div className="space-y-1.5">
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => {
                    setDateFrom(e.target.value);
                    setPage(1);
                  }}
                  className="w-full px-2 py-1.5 rounded border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => {
                    setDateTo(e.target.value);
                    setPage(1);
                  }}
                  className="w-full px-2 py-1.5 rounded border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
            </div>

            {/* 风险评分范围 */}
            <div>
              <label className="text-xs font-medium text-slate-600 mb-2 block">
                风险评分范围
              </label>
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={scoreMin}
                  onChange={(e) => {
                    setScoreMin(Math.min(Number(e.target.value) || 0, scoreMax));
                    setPage(1);
                  }}
                  className="w-full px-2 py-1.5 rounded border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
                <span className="text-slate-400 text-xs">~</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={scoreMax}
                  onChange={(e) => {
                    setScoreMax(Math.max(Number(e.target.value) || 100, scoreMin));
                    setPage(1);
                  }}
                  className="w-full px-2 py-1.5 rounded border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={scoreMin}
                  onChange={(e) => {
                    setScoreMin(Math.min(Number(e.target.value), scoreMax));
                    setPage(1);
                  }}
                  className="flex-1 accent-brand-600"
                />
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={scoreMax}
                  onChange={(e) => {
                    setScoreMax(Math.max(Number(e.target.value), scoreMin));
                    setPage(1);
                  }}
                  className="flex-1 accent-brand-600"
                />
              </div>
              <div className="flex justify-between text-xs text-slate-400 mt-1">
                <span>{scoreMin}</span>
                <span>{scoreMax}</span>
              </div>
            </div>

            {/* 当事人搜索 */}
            <div>
              <label className="text-xs font-medium text-slate-600 mb-2 block">
                当事人
              </label>
              <input
                type="text"
                value={partyName}
                onChange={(e) => {
                  setPartyName(e.target.value);
                  setPage(1);
                }}
                placeholder="输入当事人名称"
                className="w-full px-2 py-1.5 rounded border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>

            {/* 状态 */}
            <div>
              <label className="text-xs font-medium text-slate-600 mb-2 block">
                审查状态
              </label>
              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
                className="w-full px-2 py-1.5 rounded border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white"
              >
                <option value="">全部状态</option>
                {statusOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* ===== 右侧搜索结果 ===== */}
        <div className="flex-1 min-w-0 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm flex items-center gap-2">
              <X className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* 分面快速筛选条 */}
          {response && total > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Tag className="w-3.5 h-3.5 text-brand-600" />
                <span className="text-xs font-medium text-slate-600">分面筛选</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {displayFacets.contract_types.map((f) => {
                  const active = selectedTypes.includes(f.label);
                  return (
                    <button
                      key={f.label}
                      onClick={() => handleFacetTypeClick(f.label)}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs border transition-colors ${
                        active
                          ? 'border-brand-500 bg-brand-50 text-brand-700'
                          : 'border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      {f.label}
                      <span className="text-slate-400">{f.count}</span>
                    </button>
                  );
                })}
                <span className="w-px h-4 bg-slate-200 mx-1" />
                {displayFacets.risk_levels.map((f) => {
                  const level = RISK_LEVEL_OPTIONS.find((o) => o.label === f.label);
                  const active = level ? selectedLevels.includes(level.value) : false;
                  return (
                    <button
                      key={f.label}
                      onClick={() => handleFacetLevelClick(f.label)}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs border transition-colors ${
                        active
                          ? 'border-brand-500 bg-brand-50 text-brand-700'
                          : 'border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: level?.color }}
                      />
                      {f.label}
                      <span className="text-slate-400">{f.count}</span>
                    </button>
                  );
                })}
                {displayFacets.date_ranges.map((f) => (
                  <span
                    key={f.label}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs border border-slate-100 text-slate-400"
                  >
                    {f.label}
                    <span>{f.count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 加载中 */}
          {loading && (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-sm text-slate-400">
              <Search className="w-8 h-8 text-slate-300 mx-auto mb-2 animate-pulse" />
              搜索中...
            </div>
          )}

          {/* 无结果 + 搜索建议 */}
          {!loading && response && total === 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
              <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500 mb-1">
                {query ? `未找到与「${query}」相关的合同` : '暂无符合条件的合同'}
              </p>
              <p className="text-xs text-slate-400 mb-4">
                试试调整关键词或筛选条件
              </p>
              {response.suggestions && response.suggestions.length > 0 && (
                <div className="max-w-md mx-auto">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-2 justify-center">
                    <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                    <span>搜索建议</span>
                  </div>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {response.suggestions.map((s) => (
                      <button
                        key={s}
                        onClick={() => {
                          setInputValue(s);
                          setQuery(s);
                          doSearch(s);
                        }}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium text-brand-700 bg-brand-50 hover:bg-brand-100 border border-brand-100 transition-colors"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 搜索结果列表 */}
          {!loading && total > 0 && (
            <>
              <div className="space-y-3">
                {pagedResults.map((result) => (
                  <ResultCard key={result.contract_id} result={result} />
                ))}
              </div>

              {/* 分页控件 */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={safePage <= 1}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    上一页
                  </button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                          p === safePage
                            ? 'bg-brand-600 text-white'
                            : 'text-slate-600 bg-white border border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={safePage >= totalPages}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    下一页
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <span className="text-xs text-slate-400 ml-2">
                    {safePage} / {totalPages} 页
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ===== 单条搜索结果卡片 =====
function ResultCard({ result }: { result: SearchResultItem }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 hover:border-brand-200 hover:shadow-sm transition-all">
      {/* 标题行 */}
      <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="w-4 h-4 text-brand-600 shrink-0" />
          <h3 className="font-semibold text-slate-800 text-sm truncate">
            {result.contract_title}
          </h3>
          <span className="inline-flex items-center text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 shrink-0">
            {result.contract_type}
          </span>
        </div>
        {result.relevance > 0 && (
          <div className="flex items-center gap-1.5 text-xs shrink-0">
            <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-brand-500 rounded-full"
                style={{ width: `${result.relevance}%` }}
              />
            </div>
            <span className="text-slate-500">
              相关度 <span className="font-medium text-slate-700">{result.relevance}%</span>
            </span>
          </div>
        )}
      </div>

      {/* 高亮摘要 */}
      <p className="text-sm text-slate-600 leading-relaxed line-clamp-3">
        {renderHighlightedSnippet(result.snippet, result.highlighted_terms)}
      </p>

      {/* 元信息 */}
      <div className="mt-3 flex items-center gap-3 text-xs text-slate-400 flex-wrap">
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-medium">
          <span className={`px-1.5 py-0.5 rounded ${riskScoreColor(result.risk_score)}`}>
            风险评分 {result.risk_score}
          </span>
        </span>
        <span className="flex items-center gap-1">
          <AlertTriangle className="w-3.5 h-3.5" />
          {result.risk_count} 项风险
        </span>
        <span className="flex items-center gap-1">
          <Calendar className="w-3.5 h-3.5" />
          {formatDate(result.date)}
        </span>
        {result.matched_fields.length > 0 && (
          <span className="flex items-center gap-1">
            <Tag className="w-3.5 h-3.5" />
            匹配字段：
            {result.matched_fields
              .map((f) => {
                const map: Record<string, string> = {
                  contract_title: '标题',
                  contract_type: '类型',
                  filename: '文件名',
                  fullText: '正文',
                };
                return map[f] || f;
              })
              .join('、')}
          </span>
        )}
      </div>
    </div>
  );
}
