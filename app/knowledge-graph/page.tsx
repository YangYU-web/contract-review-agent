'use client';

// ===== 合同知识图谱页面 =====
// 展示合同、主体、条款、风险等实体之间的关系网络
// 提供交互式可视化、检索、关联展开与图谱洞察

export const runtime = 'edge';

import { Network, Share2, Sparkles } from 'lucide-react';
import KnowledgeGraphView from '@/components/KnowledgeGraphView';

export default function KnowledgeGraphPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* 页头 */}
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Network className="w-6 h-6 text-brand-600" />
            合同知识图谱
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            以图结构组织合同、主体、条款、风险、付款、日期、义务等实体，
            支持关联检索、邻域展开与图谱洞察
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-slate-200">
            <Sparkles className="w-4 h-4 text-brand-600" />
            <span className="text-xs text-slate-500">智能洞察</span>
            <span className="text-xs text-slate-300">·</span>
            <span className="text-xs text-slate-400">模式 / 异常 / 建议</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-slate-200">
            <Share2 className="w-4 h-4 text-brand-600" />
            <span className="text-xs text-slate-500">演示模式</span>
            <span className="text-xs text-slate-300">·</span>
            <span className="text-xs text-slate-400">可导出图谱</span>
          </div>
        </div>
      </div>

      {/* 图谱可视化 */}
      <KnowledgeGraphView />
    </div>
  );
}
