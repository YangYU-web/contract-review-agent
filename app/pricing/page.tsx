'use client';

// ===== AI 智能定价分析页面 =====
// 页面标题 + PricingAnalysisView 组件

import { DollarSign, TrendingUp, Sparkles } from 'lucide-react';
import PricingAnalysisView from '@/components/PricingAnalysisView';

export default function PricingPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* 页头 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <DollarSign className="w-6 h-6 text-brand-600" />
          AI智能定价分析
        </h1>
        <p className="text-slate-500 text-sm mt-1 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-brand-400" />
          基于市场基准价格对合同单价进行智能偏离度分析，识别定价影响因素并给出优化建议
          <TrendingUp className="w-3.5 h-3.5 text-brand-400 ml-1" />
        </p>
      </div>

      {/* 定价分析视图组件 */}
      <PricingAnalysisView />
    </div>
  );
}
