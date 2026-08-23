'use client';

import { useState, useMemo } from 'react';
import { Search, BookOpen, Database, TrendingUp, ChevronRight } from 'lucide-react';
import { searchClauses, getKnowledgeBaseStats, getSearchSuggestions, SearchResult } from '@/lib/knowledge-base';
import { Contract, ContractRisk, RISK_TYPE_LABELS, RISK_LEVEL_CONFIG } from '@/lib/types';
import Link from 'next/link';

interface KnowledgeBaseViewProps {
  contracts: Contract[];
  risks: ContractRisk[];
}

export default function KnowledgeBaseView({ contracts, risks }: KnowledgeBaseViewProps) {
  const [query, setQuery] = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  const stats = useMemo(() => getKnowledgeBaseStats(contracts, risks), [contracts, risks]);
  const results = useMemo(() => hasSearched ? searchClauses(query, contracts, risks) : [], [query, hasSearched, contracts, risks]);
  const suggestions = useMemo(() => getSearchSuggestions(), []);

  const handleSearch = (q?: string) => {
    const searchQuery = q || query;
    setQuery(searchQuery);
    setHasSearched(true);
  };

  return (
    <div className="space-y-6">
      {/* 知识库统计 */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard icon={BookOpen} value={stats.total_contracts} label="入库合同" color="text-brand-600" bg="bg-brand-50" />
        <StatCard icon={Database} value={stats.total_risks} label="风险条款" color="text-amber-600" bg="bg-amber-50" />
        <StatCard icon={TrendingUp} value={stats.contract_types.length} label="合同类型" color="text-green-600" bg="bg-green-50" />
      </div>

      {/* 搜索框 */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="搜索合同条款、风险类型、修改建议..."
            className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
          />
        </div>

        {/* 搜索建议 */}
        {!hasSearched && (
          <div className="mt-4">
            <p className="text-xs text-slate-400 mb-2">热门搜索</p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map(s => (
                <button
                  key={s}
                  onClick={() => handleSearch(s)}
                  className="px-3 py-1.5 rounded-lg bg-slate-50 text-sm text-slate-600 hover:bg-brand-50 hover:text-brand-600 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 搜索结果 */}
      {hasSearched && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-700">
              搜索结果（{results.length} 条）
            </h3>
            <button
              onClick={() => { setQuery(''); setHasSearched(false); }}
              className="text-sm text-slate-400 hover:text-brand-600"
            >
              清除搜索
            </button>
          </div>

          {results.length > 0 ? (
            results.map((result, idx) => (
              <SearchResultCard key={idx} result={result} />
            ))
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
              <Search className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-400">未找到匹配的条款</p>
              <p className="text-sm text-slate-300 mt-1">尝试使用不同的关键词</p>
            </div>
          )}
        </div>
      )}

      {/* 分类浏览 */}
      {!hasSearched && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 按合同类型 */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="font-semibold text-slate-700 mb-3">按合同类型浏览</h3>
            <div className="space-y-2">
              {stats.contract_types.map(item => (
                <button
                  key={item.type}
                  onClick={() => handleSearch(item.type)}
                  className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <span className="text-sm text-slate-600">{item.type}</span>
                  <span className="text-xs text-slate-400">{item.count} 份</span>
                </button>
              ))}
            </div>
          </div>

          {/* 按风险类型 */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="font-semibold text-slate-700 mb-3">按风险类型浏览</h3>
            <div className="space-y-2">
              {stats.risk_types.map(item => (
                <button
                  key={item.type}
                  onClick={() => handleSearch(RISK_TYPE_LABELS[item.type as keyof typeof RISK_TYPE_LABELS] || item.type)}
                  className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <span className="text-sm text-slate-600">
                    {RISK_TYPE_LABELS[item.type as keyof typeof RISK_TYPE_LABELS] || item.type}
                  </span>
                  <span className="text-xs text-slate-400">{item.count} 项</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SearchResultCard({ result }: { result: SearchResult }) {
  const levelConfig = RISK_LEVEL_CONFIG[result.risk_level as keyof typeof RISK_LEVEL_CONFIG];
  const typeLabel = RISK_TYPE_LABELS[result.risk_type as keyof typeof RISK_TYPE_LABELS] || result.risk_type;

  return (
    <Link
      href={`/dashboard/${result.contract_id}`}
      className="block bg-white rounded-xl border border-slate-200 p-4 card-hover"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs px-2 py-0.5 rounded" style={{ color: levelConfig?.color, backgroundColor: levelConfig?.bg }}>
            {levelConfig?.label}
          </span>
          <span className="text-xs text-slate-500 px-2 py-0.5 rounded bg-slate-100">{typeLabel}</span>
          <span className="text-xs text-slate-400">{result.contract_title}</span>
        </div>
        <span className="text-xs text-brand-600 font-medium shrink-0">
          匹配度 {result.similarity}%
        </span>
      </div>
      <p className="text-sm text-slate-600 mb-1 line-clamp-2">{result.clause_text}</p>
      <p className="text-xs text-slate-400 line-clamp-1">{result.risk_explanation}</p>
      <div className="flex items-center gap-1 text-xs text-brand-600 mt-2">
        查看详情 <ChevronRight className="w-3 h-3" />
      </div>
    </Link>
  );
}

function StatCard({ icon: Icon, value, label, color, bg }: { icon: React.ElementType; value: number; label: string; color: string; bg: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center`}>
          <Icon className={`w-5 h-5 ${color}`} />
        </div>
        <div>
          <div className="text-2xl font-bold text-slate-800">{value}</div>
          <div className="text-xs text-slate-400">{label}</div>
        </div>
      </div>
    </div>
  );
}
