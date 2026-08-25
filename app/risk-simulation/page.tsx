'use client';

// ===== 合同风险模拟页面 =====
// 页面标题 + RiskSimulationView 组件

export const runtime = 'edge';

import { FlaskConical, TrendingDown, Activity } from 'lucide-react';
import RiskSimulationView from '@/components/RiskSimulationView';

export default function RiskSimulationPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* 页头 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FlaskConical className="w-6 h-6 text-brand-600" />
          合同风险模拟
        </h1>
        <p className="text-slate-500 text-sm mt-1 flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-brand-400" />
          基于蒙特卡洛与压力测试对合同损失进行概率模拟，量化风险敞口并给出缓释建议
          <TrendingDown className="w-3.5 h-3.5 text-brand-400 ml-1" />
        </p>
      </div>

      {/* 风险模拟视图组件 */}
      <RiskSimulationView />
    </div>
  );
}
