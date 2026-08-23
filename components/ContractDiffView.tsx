'use client';

import { useState } from 'react';
import {
  GitCompare,
  ArrowRight,
  Check,
  AlertTriangle,
  Plus,
  Minus,
} from 'lucide-react';
import { ContractComparisonResult, ContractComparisonItem } from '@/lib/types';

// ===== 合同对比结果展示组件 =====
// 顶部摘要栏 + 条款对比表格，差异类型颜色区分，可展开查看关键差异与风险影响

interface ContractDiffViewProps {
  result: ContractComparisonResult;
}

// 差异类型配置：颜色与图标
const DIFF_CONFIG: Record<
  ContractComparisonItem['diff_type'],
  { label: string; color: string; bg: string; border: string; icon: typeof Check }
> = {
  same: { label: '一致', color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', icon: Check },
  modified: { label: '有差异', color: '#d97706', bg: '#fffbeb', border: '#fde68a', icon: AlertTriangle },
  only_a: { label: '仅A有', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', icon: Plus },
  only_b: { label: '仅B有', color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe', icon: Minus },
};

// 单条对比卡片
function ComparisonRow({ item, index }: { item: ContractComparisonItem; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const config = DIFF_CONFIG[item.diff_type];
  const Icon = config.icon;
  const hasDetail = item.diff_type === 'modified' || item.diff_type === 'only_a' || item.diff_type === 'only_b';

  return (
    <div
      className="bg-white rounded-xl border overflow-hidden transition-all"
      style={{ borderColor: expanded ? config.color : '#e2e8f0' }}
    >
      {/* 表头行 */}
      <button
        type="button"
        onClick={() => hasDetail && setExpanded(!expanded)}
        className={`w-full text-left ${hasDetail ? 'cursor-pointer hover:bg-slate-50' : 'cursor-default'}`}
      >
        <div className="flex items-start gap-3 p-4">
          {/* 序号 + 条款标签 */}
          <div className="flex items-center gap-2 shrink-0 w-32">
            <span className="text-xs text-slate-400 font-mono">#{index + 1}</span>
            <span className="text-sm font-semibold text-slate-700 truncate">
              {item.clause_label}
            </span>
          </div>

          {/* 合同A文本 */}
          <div className="flex-1 min-w-0">
            <div className="text-xs text-slate-400 mb-1">合同A</div>
            <p className={`text-sm leading-relaxed ${item.contract_a_text.includes('无此条款') ? 'text-slate-400 italic' : 'text-slate-700'}`}>
              {item.contract_a_text}
            </p>
          </div>

          {/* 箭头 */}
          <div className="flex flex-col items-center justify-center shrink-0 pt-4">
            <ArrowRight className="w-4 h-4 text-slate-300" />
          </div>

          {/* 合同B文本 */}
          <div className="flex-1 min-w-0">
            <div className="text-xs text-slate-400 mb-1">合同B</div>
            <p className={`text-sm leading-relaxed ${item.contract_b_text.includes('无此条款') ? 'text-slate-400 italic' : 'text-slate-700'}`}>
              {item.contract_b_text}
            </p>
          </div>

          {/* 差异标签 */}
          <div className="flex flex-col items-end gap-1 shrink-0 w-20">
            <span
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium"
              style={{ color: config.color, backgroundColor: config.bg }}
            >
              <Icon className="w-3 h-3" />
              {config.label}
            </span>
            {item.diff_type === 'modified' && (
              <span className="text-xs text-slate-400">{item.similarity}%</span>
            )}
          </div>
        </div>
      </button>

      {/* 展开详情：关键差异 + 风险影响 */}
      {expanded && hasDetail && (
        <div className="border-t p-4 space-y-3" style={{ borderColor: config.border, backgroundColor: config.bg + '40' }}>
          {/* 关键差异 */}
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 mb-2">
              <AlertTriangle className="w-3.5 h-3.5" style={{ color: config.color }} />
              关键差异点
            </div>
            <ul className="space-y-1.5">
              {item.key_differences.map((diff, i) => (
                <li key={i} className="text-sm text-slate-600 flex items-start gap-2">
                  <span className="mt-1.5 w-1 h-1 rounded-full shrink-0" style={{ backgroundColor: config.color }} />
                  {diff}
                </li>
              ))}
            </ul>
          </div>

          {/* 风险影响 */}
          <div className="bg-white/70 rounded-lg p-3 border" style={{ borderColor: config.border }}>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 mb-1">
              <AlertTriangle className="w-3.5 h-3.5" style={{ color: config.color }} />
              风险影响分析
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">{item.risk_implication}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ContractDiffView({ result }: ContractDiffViewProps) {
  // 统计各类差异数量
  const stats = {
    same: result.items.filter(i => i.diff_type === 'same').length,
    modified: result.items.filter(i => i.diff_type === 'modified').length,
    only_a: result.items.filter(i => i.diff_type === 'only_a').length,
    only_b: result.items.filter(i => i.diff_type === 'only_b').length,
  };

  // 相似度颜色
  const simColor =
    result.overall_similarity >= 80 ? '#16a34a' :
    result.overall_similarity >= 50 ? '#d97706' : '#dc2626';

  return (
    <div className="space-y-4">
      {/* 顶部摘要栏 */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex flex-col sm:flex-row">
          {/* 整体相似度大数字 */}
          <div className="flex items-center gap-4 p-5 sm:border-r border-slate-100 sm:w-56">
            <div
              className="text-5xl font-bold"
              style={{ color: simColor }}
            >
              {result.overall_similarity}
              <span className="text-2xl">%</span>
            </div>
            <div>
              <div className="flex items-center gap-1 text-sm font-medium text-slate-600">
                <GitCompare className="w-4 h-4" />
                整体相似度
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                共 {result.items.length} 项条款
              </p>
            </div>
          </div>

          {/* 合同A/B标题 */}
          <div className="flex-1 flex items-center gap-3 p-5">
            <div className="flex-1 min-w-0">
              <div className="text-xs text-slate-400 mb-0.5">合同A</div>
              <div className="text-sm font-medium text-slate-700 truncate">{result.contract_a.title}</div>
              <div className="text-xs text-slate-400">{result.contract_a.type}</div>
            </div>
            <ArrowRight className="w-5 h-5 text-slate-300 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-xs text-slate-400 mb-0.5">合同B</div>
              <div className="text-sm font-medium text-slate-700 truncate">{result.contract_b.title}</div>
              <div className="text-xs text-slate-400">{result.contract_b.type}</div>
            </div>
          </div>
        </div>

        {/* 差异类型统计条 */}
        <div className="grid grid-cols-4 border-t border-slate-100">
          {([
            { key: 'same' as const, ...DIFF_CONFIG.same, count: stats.same },
            { key: 'modified' as const, ...DIFF_CONFIG.modified, count: stats.modified },
            { key: 'only_a' as const, ...DIFF_CONFIG.only_a, count: stats.only_a },
            { key: 'only_b' as const, ...DIFF_CONFIG.only_b, count: stats.only_b },
          ]).map(s => {
            const SIcon = s.icon;
            return (
              <div key={s.key} className="p-3 text-center border-r border-slate-100 last:border-r-0">
                <div className="flex items-center justify-center gap-1 mb-0.5">
                  <SIcon className="w-3.5 h-3.5" style={{ color: s.color }} />
                  <span className="text-2xl font-bold" style={{ color: s.color }}>{s.count}</span>
                </div>
                <div className="text-xs text-slate-400">{s.label}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 对比摘要 */}
      <div className="bg-brand-50/50 border border-brand-100 rounded-xl p-4">
        <p className="text-sm text-slate-600 leading-relaxed">{result.summary}</p>
      </div>

      {/* 条款对比列表 */}
      <div className="space-y-2.5">
        {result.items.map((item, idx) => (
          <ComparisonRow key={idx} item={item} index={idx} />
        ))}
      </div>

      {/* 各自独有风险提示 */}
      {(result.unique_risks_a.length > 0 || result.unique_risks_b.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {result.unique_risks_a.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-blue-700 mb-2">
                <Plus className="w-4 h-4" />
                合同A独有条款
              </div>
              <ul className="space-y-1.5">
                {result.unique_risks_a.map((r, i) => (
                  <li key={i} className="text-xs text-slate-600 flex items-start gap-1.5">
                    <span className="text-blue-400 mt-0.5">•</span>
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {result.unique_risks_b.length > 0 && (
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-purple-700 mb-2">
                <Minus className="w-4 h-4" />
                合同B独有条款
              </div>
              <ul className="space-y-1.5">
                {result.unique_risks_b.map((r, i) => (
                  <li key={i} className="text-xs text-slate-600 flex items-start gap-1.5">
                    <span className="text-purple-400 mt-0.5">•</span>
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
