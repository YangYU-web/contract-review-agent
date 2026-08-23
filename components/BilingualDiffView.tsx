'use client';

import { useState } from 'react';
import {
  Languages,
  Check,
  AlertTriangle,
  AlertCircle,
  ChevronDown,
  AlignLeft,
} from 'lucide-react';
import { BilingualClause, BilingualDiscrepancy } from '@/lib/types';

// ===== 双语条款对比展示组件 =====
// 左右并排显示中英文条款，标注对齐置信度与语义相似度，
// 差异按类型着色，可展开查看详情，底部汇总整体匹配情况

interface BilingualDiffViewProps {
  clauses: BilingualClause[];
}

// 差异类型配置：标签、颜色、背景、图标
const DISCREPANCY_CONFIG: Record<
  BilingualDiscrepancy['type'],
  { label: string; color: string; bg: string; border: string; icon: typeof AlertTriangle }
> = {
  missing_clause: {
    label: '条款缺失',
    color: '#dc2626',
    bg: '#fef2f2',
    border: '#fecaca',
    icon: AlertCircle,
  },
  value_mismatch: {
    label: '数值不匹配',
    color: '#d97706',
    bg: '#fffbeb',
    border: '#fde68a',
    icon: AlertTriangle,
  },
  term_mismatch: {
    label: '术语不一致',
    color: '#2563eb',
    bg: '#eff6ff',
    border: '#bfdbfe',
    icon: AlignLeft,
  },
  structure_mismatch: {
    label: '结构差异',
    color: '#7c3aed',
    bg: '#f5f3ff',
    border: '#ddd6fe',
    icon: AlignLeft,
  },
};

// 严重程度配置
const SEVERITY_CONFIG: Record<
  BilingualDiscrepancy['severity'],
  { label: string; color: string }
> = {
  high: { label: '严重', color: '#dc2626' },
  medium: { label: '中等', color: '#d97706' },
  low: { label: '轻微', color: '#16a34a' },
};

// 进度条：根据数值返回颜色
function getProgressColor(value: number): string {
  if (value >= 80) return '#16a34a';
  if (value >= 50) return '#d97706';
  return '#dc2626';
}

// 单条双语条款卡片
function BilingualClauseRow({ clause, index }: { clause: BilingualClause; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const hasDiscrepancy = clause.discrepancies.length > 0;
  const alignmentColor = getProgressColor(clause.alignment_confidence);
  const similarityColor = getProgressColor(clause.semantic_similarity);
  const AlignIcon = hasDiscrepancy ? AlertTriangle : Check;

  return (
    <div
      className="bg-white rounded-xl border overflow-hidden transition-all"
      style={{ borderColor: expanded && hasDiscrepancy ? '#d97706' : '#e2e8f0' }}
    >
      {/* 卡片头部 */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-100 bg-slate-50/60">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-mono">#{index + 1}</span>
          <span className="text-sm font-semibold text-slate-700">{clause.clause_id}</span>
          {hasDiscrepancy ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200">
              <AlertTriangle className="w-3 h-3" />
              {clause.discrepancies.length} 项差异
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium text-green-700 bg-green-50 border border-green-200">
              <Check className="w-3 h-3" />
              一致
            </span>
          )}
        </div>
        {hasDiscrepancy && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 transition-colors"
          >
            {expanded ? '收起详情' : '查看差异'}
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`}
            />
          </button>
        )}
      </div>

      {/* 左右并排条款 */}
      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-100">
        {/* 中文条款 */}
        <div className="p-4">
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 mb-2">
            <Languages className="w-3.5 h-3.5 text-brand-500" />
            中文条款
          </div>
          <p
            className={`text-sm leading-relaxed ${
              !clause.chinese_text ? 'text-slate-400 italic' : 'text-slate-700'
            }`}
          >
            {clause.chinese_text || '（中文版本缺失此条款）'}
          </p>
        </div>

        {/* 英文条款 */}
        <div className="p-4">
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 mb-2">
            <Languages className="w-3.5 h-3.5 text-blue-500" />
            English Clause
          </div>
          <p
            className={`text-sm leading-relaxed ${
              !clause.english_text ? 'text-slate-400 italic' : 'text-slate-700'
            }`}
          >
            {clause.english_text || '(English version missing this clause)'}
          </p>
        </div>
      </div>

      {/* 对齐置信度 + 语义相似度 */}
      <div className="grid grid-cols-2 gap-4 px-4 py-3 border-t border-slate-100 bg-slate-50/40">
        {/* 对齐置信度 */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="flex items-center gap-1 text-xs text-slate-500">
              <AlignIcon className="w-3 h-3" style={{ color: alignmentColor }} />
              对齐置信度
            </span>
            <span className="text-xs font-semibold" style={{ color: alignmentColor }}>
              {clause.alignment_confidence}%
            </span>
          </div>
          <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${clause.alignment_confidence}%`,
                backgroundColor: alignmentColor,
              }}
            />
          </div>
        </div>

        {/* 语义相似度 */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="flex items-center gap-1 text-xs text-slate-500">
              <AlignLeft className="w-3 h-3" style={{ color: similarityColor }} />
              语义相似度
            </span>
            <span className="text-xs font-semibold" style={{ color: similarityColor }}>
              {clause.semantic_similarity}%
            </span>
          </div>
          <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${clause.semantic_similarity}%`,
                backgroundColor: similarityColor,
              }}
            />
          </div>
        </div>
      </div>

      {/* 差异详情（可展开） */}
      {expanded && hasDiscrepancy && (
        <div className="border-t border-amber-200 p-4 space-y-2.5 bg-amber-50/30">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 mb-1">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            差异详情（{clause.discrepancies.length} 项）
          </div>
          {clause.discrepancies.map((d, i) => {
            const config = DISCREPANCY_CONFIG[d.type];
            const sevConfig = SEVERITY_CONFIG[d.severity];
            const DIcon = config.icon;
            return (
              <div
                key={i}
                className="rounded-lg border p-3"
                style={{ borderColor: config.border, backgroundColor: config.bg }}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium"
                    style={{ color: config.color, backgroundColor: '#ffffff' }}
                  >
                    <DIcon className="w-3 h-3" />
                    {config.label}
                  </span>
                  <span
                    className="inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded"
                    style={{ color: sevConfig.color, backgroundColor: '#ffffff' }}
                  >
                    {sevConfig.label}
                  </span>
                </div>
                <p className="text-sm text-slate-700 leading-relaxed">{d.description}</p>
                {(d.chinese_ref || d.english_ref) && (
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                    {d.chinese_ref && (
                      <div className="rounded bg-white/70 px-2 py-1 border border-slate-200">
                        <span className="text-slate-400">中文：</span>
                        <span className="text-slate-600">{d.chinese_ref}</span>
                      </div>
                    )}
                    {d.english_ref && (
                      <div className="rounded bg-white/70 px-2 py-1 border border-slate-200">
                        <span className="text-slate-400">英文：</span>
                        <span className="text-slate-600">{d.english_ref}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function BilingualDiffView({ clauses }: BilingualDiffViewProps) {
  if (!clauses || clauses.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-dashed border-slate-200 p-12 text-center">
        <Languages className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <p className="text-sm text-slate-400">暂无双语条款对比数据</p>
      </div>
    );
  }

  // 统计：总条款数、一致条款数、差异数
  const totalClauses = clauses.length;
  const matchedClauses = clauses.filter(c => c.discrepancies.length === 0).length;
  const totalDiscrepancies = clauses.reduce((sum, c) => sum + c.discrepancies.length, 0);
  const matchRate = Math.round((matchedClauses / totalClauses) * 100);
  const matchColor = getProgressColor(matchRate);

  // 按差异类型汇总
  const discrepancyStats = (Object.keys(DISCREPANCY_CONFIG) as BilingualDiscrepancy['type'][]).map(
    type => ({
      type,
      config: DISCREPANCY_CONFIG[type],
      count: clauses.reduce(
        (sum, c) => sum + c.discrepancies.filter(d => d.type === type).length,
        0
      ),
    })
  );

  return (
    <div className="space-y-4">
      {/* 顶部统计卡片 */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="grid grid-cols-3 divide-x divide-slate-100">
          {/* 总条款数 */}
          <div className="p-4 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Languages className="w-4 h-4 text-brand-500" />
            </div>
            <div className="text-2xl font-bold text-slate-800">{totalClauses}</div>
            <div className="text-xs text-slate-400 mt-0.5">总条款数</div>
          </div>

          {/* 匹配率 */}
          <div className="p-4 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Check className="w-4 h-4" style={{ color: matchColor }} />
            </div>
            <div className="text-2xl font-bold" style={{ color: matchColor }}>
              {matchRate}%
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              匹配率（{matchedClauses}/{totalClauses}）
            </div>
          </div>

          {/* 差异数 */}
          <div className="p-4 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-2xl font-bold text-amber-500">{totalDiscrepancies}</div>
            <div className="text-xs text-slate-400 mt-0.5">差异数</div>
          </div>
        </div>

        {/* 差异类型分布 */}
        {totalDiscrepancies > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 border-t border-slate-100">
            {discrepancyStats.map(s => {
              const SIcon = s.config.icon;
              return (
                <div key={s.type} className="p-3 text-center border-r border-slate-100 last:border-r-0">
                  <div className="flex items-center justify-center gap-1 mb-0.5">
                    <SIcon className="w-3.5 h-3.5" style={{ color: s.config.color }} />
                    <span className="text-lg font-bold" style={{ color: s.config.color }}>
                      {s.count}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400">{s.config.label}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 条款对比列表 */}
      <div className="space-y-2.5">
        {clauses.map((clause, idx) => (
          <BilingualClauseRow key={clause.clause_id || idx} clause={clause} index={idx} />
        ))}
      </div>
    </div>
  );
}
