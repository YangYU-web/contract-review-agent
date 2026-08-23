'use client';

import { useState } from 'react';
import { AlertTriangle, CheckCircle2, FileDiff, ArrowRight, ArrowLeft } from 'lucide-react';
import { ClauseComparisonResult, ClauseDiff, RISK_TYPE_LABELS } from '@/lib/types';

interface ClauseComparisonViewProps {
  result: ClauseComparisonResult;
}

const DIFF_CONFIG = {
  removed: { label: '缺失', color: '#dc2626', bg: '#fef2f2', icon: AlertTriangle },
  modified: { label: '已修改', color: '#d97706', bg: '#fffbeb', icon: FileDiff },
  added: { label: '额外', color: '#2563eb', bg: '#eff6ff', icon: ArrowRight },
  unchanged: { label: '一致', color: '#16a34a', bg: '#f0fdf4', icon: CheckCircle2 },
};

export default function ClauseComparisonView({ result }: ClauseComparisonViewProps) {
  const [selectedDiff, setSelectedDiff] = useState<ClauseDiff | null>(null);

  return (
    <div className="space-y-4">
      {/* 概览 */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <FileDiff className="w-5 h-5 text-brand-600" />
          <h3 className="font-semibold text-slate-800">条款比对分析</h3>
        </div>
        <p className="text-sm text-slate-500 mb-3">{result.summary}</p>
        <div className="grid grid-cols-4 gap-3">
          <Stat label="一致" value={result.matched_clauses} color="text-green-500" />
          <Stat label="有偏差" value={result.modified_clauses} color="text-amber-500" />
          <Stat label="缺失" value={result.missing_clauses} color="text-red-500" />
          <Stat label="额外" value={result.extra_clauses} color="text-blue-500" />
        </div>
      </div>

      {/* 条款比对列表 */}
      <div className="space-y-2">
        {result.diffs.map((diff, idx) => {
          const config = DIFF_CONFIG[diff.diff_type];
          const Icon = config.icon;
          const isSelected = selectedDiff === diff;
          return (
            <div
              key={idx}
              className={`bg-white rounded-xl border overflow-hidden cursor-pointer transition-all ${
                isSelected ? 'border-brand-300 shadow-md' : 'border-slate-200 hover:border-slate-300'
              }`}
              onClick={() => setSelectedDiff(isSelected ? null : diff)}
            >
              <div className="p-4 flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0`} style={{ backgroundColor: config.bg }}>
                  <Icon className="w-4 h-4" style={{ color: config.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-slate-800">{diff.clause_id}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded" style={{ color: config.color, backgroundColor: config.bg }}>
                      {config.label}
                    </span>
                    {diff.diff_type === 'modified' && (
                      <span className="text-xs text-slate-400">相似度 {diff.similarity}%</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-1">
                    {diff.diff_type === 'removed' ? diff.standard_text : diff.original_text}
                  </p>
                </div>
                <ArrowRight className={`w-4 h-4 text-slate-300 transition-transform ${isSelected ? 'rotate-90' : ''}`} />
              </div>

              {/* 展开详情 */}
              {isSelected && (
                <div className="border-t border-slate-100 p-4 space-y-3 bg-slate-50/50">
                  {/* 原条款 */}
                  {diff.original_text !== '（合同中未包含此条款）' && (
                    <div>
                      <div className="text-xs font-medium text-slate-500 mb-1">合同条款</div>
                      <div className="text-sm text-slate-600 bg-white rounded-lg p-3 border border-slate-100">
                        {diff.original_text}
                      </div>
                    </div>
                  )}
                  {/* 标准条款 */}
                  {diff.standard_text !== '（标准模板中无此条款）' && diff.standard_text !== '（无标准模板）' && (
                    <div>
                      <div className="text-xs font-medium text-brand-600 mb-1">标准条款</div>
                      <div className="text-sm text-slate-600 bg-brand-50/50 rounded-lg p-3 border border-brand-100">
                        {diff.standard_text}
                      </div>
                    </div>
                  )}
                  {/* 关键差异 */}
                  <div>
                    <div className="text-xs font-medium text-slate-500 mb-1">关键差异</div>
                    <ul className="space-y-1">
                      {diff.key_differences.map((d, i) => (
                        <li key={i} className="text-sm text-slate-600 flex items-start gap-1.5">
                          <span className="text-brand-400 mt-0.5">•</span>
                          {d}
                        </li>
                      ))}
                    </ul>
                  </div>
                  {/* 风险评估和建议 */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="bg-white rounded-lg p-3 border border-slate-100">
                      <div className="text-xs font-medium text-slate-500 mb-1">风险评估</div>
                      <p className="text-sm text-slate-600">{diff.risk_assessment}</p>
                    </div>
                    <div className="bg-white rounded-lg p-3 border border-slate-100">
                      <div className="text-xs font-medium text-brand-600 mb-1">修改建议</div>
                      <p className="text-sm text-slate-600">{diff.suggestion}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="text-center p-2 rounded-lg bg-slate-50">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-slate-400">{label}</div>
    </div>
  );
}
