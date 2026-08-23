'use client';

import { Activity, Target, Flag } from 'lucide-react';
import PerformanceTracking from '@/components/PerformanceTracking';

// 履约监控能力说明
const CAPABILITY_EXPLANATIONS = [
  {
    name: 'KPI 指标监控',
    icon: Target,
    color: 'text-brand-700 bg-brand-50',
    desc: '为每份合同设定关键绩效指标（KPI），实时跟踪实际值与目标值的偏差，自动识别达标、有风险与延误状态，确保合同履约质量可控。',
  },
  {
    name: '里程碑追踪',
    icon: Flag,
    color: 'text-blue-700 bg-blue-50',
    desc: '将合同履约拆解为多个里程碑节点，可视化展示时间线进度。支持标记完成、记录实际交付日期与交付物，自动计算整体履约进度。',
  },
  {
    name: '义务与预警',
    icon: Activity,
    color: 'text-green-700 bg-green-50',
    desc: '跟踪双方合同义务的履行情况，支持周期性义务的持续监控。系统自动生成里程碑延误、KPI 偏差、义务逾期与截止日期临近等预警。',
  },
];

export default function PerformancePage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* 页头 */}
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="w-6 h-6 text-brand-600" />
            合同履约监控
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            全生命周期跟踪合同执行进度，监控 KPI 指标与里程碑节点，及时发现履约风险
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-slate-200">
          <Target className="w-4 h-4 text-brand-600" />
          <span className="text-xs text-slate-500">演示模式</span>
          <span className="text-xs text-slate-300">·</span>
          <span className="text-xs text-slate-400">履约引擎</span>
        </div>
      </div>

      {/* 履约监控组件 */}
      <PerformanceTracking />

      {/* 底部说明区域：履约监控能力说明 */}
      <div className="mt-8 bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h2 className="font-semibold text-slate-800 flex items-center gap-2 mb-4">
          <Activity className="w-4 h-4 text-brand-600" />
          履约监控能力说明
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {CAPABILITY_EXPLANATIONS.map((s) => {
            const Icon = s.icon;
            return (
              <div
                key={s.name}
                className="rounded-lg border border-slate-100 bg-slate-50/60 p-4"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center">
                    <Icon className="w-4 h-4 text-brand-600" />
                  </div>
                  <span
                    className={`inline-block text-xs font-medium px-2 py-0.5 rounded ${s.color}`}
                  >
                    {s.name}
                  </span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {s.desc}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
