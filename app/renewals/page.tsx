'use client';

import { RefreshCw, CalendarClock, Info, Settings } from 'lucide-react';
import RenewalManager from '@/components/RenewalManager';

// 续签策略说明
const STRATEGY_EXPLANATIONS = [
  {
    name: '自动续签（auto_renew）',
    color: 'text-brand-700 bg-brand-50',
    desc: '满足预设条件（风险评分在阈值区间、价格涨幅不超过上限）时，系统自动完成续签通知、签署与归档，无需人工介入。',
  },
  {
    name: '仅通知（notify_only）',
    color: 'text-blue-700 bg-blue-50',
    desc: '在合同到期前向业务方发送到期通知与续签提醒，由业务方决定是否续签，系统仅记录意向，不主动执行续签。',
  },
  {
    name: '人工审查（manual_review）',
    color: 'text-amber-700 bg-amber-50',
    desc: '触发续签流程后通知法务部门介入，开展风险评估与合规检查，经人工审批后方可完成续签签署。',
  },
  {
    name: '不续签（no_renewal）',
    color: 'text-slate-600 bg-slate-100',
    desc: '合同到期后不再续签，系统发送终止通知并归档合同，更新台账状态为已终止。',
  },
];

export default function RenewalsPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* 页头 */}
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <RefreshCw className="w-6 h-6 text-brand-600" />
            合同到期自动续签
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            智能管理合同续签流程，按策略自动触发续签，降低人工成本与逾期风险
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-slate-200">
          <CalendarClock className="w-4 h-4 text-brand-600" />
          <span className="text-xs text-slate-500">演示模式</span>
          <span className="text-xs text-slate-300">·</span>
          <span className="text-xs text-slate-400">续签引擎</span>
        </div>
      </div>

      {/* 续签管理组件 */}
      <RenewalManager />

      {/* 底部说明区域：续签策略说明 */}
      <div className="mt-8 bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h2 className="font-semibold text-slate-800 flex items-center gap-2 mb-4">
          <Info className="w-4 h-4 text-brand-600" />
          续签策略说明
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {STRATEGY_EXPLANATIONS.map((s) => (
            <div
              key={s.name}
              className="rounded-lg border border-slate-100 bg-slate-50/60 p-4"
            >
              <span
                className={`inline-block text-xs font-medium px-2 py-0.5 rounded mb-2 ${s.color}`}
              >
                {s.name}
              </span>
              <p className="text-xs text-slate-500 leading-relaxed">
                {s.desc}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* 底部说明区域：续签配置指引 */}
      <div className="mt-4 bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h2 className="font-semibold text-slate-800 flex items-center gap-2 mb-4">
          <Settings className="w-4 h-4 text-brand-600" />
          续签配置指引
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-4">
            <div className="text-sm font-semibold text-brand-700 mb-1.5 flex items-center gap-1.5">
              <Settings className="w-3.5 h-3.5" />
              1. 配置策略
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              为每份长期合同配置续签策略，包括续签期限、通知天数、价格调整上限与风险评分阈值。
            </p>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-4">
            <div className="text-sm font-semibold text-brand-700 mb-1.5 flex items-center gap-1.5">
              <CalendarClock className="w-3.5 h-3.5" />
              2. 到期触发
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              系统在合同到期前按通知天数自动提醒，到达触发时机后启动续签流程，生成检查清单。
            </p>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-4">
            <div className="text-sm font-semibold text-brand-700 mb-1.5 flex items-center gap-1.5">
              <RefreshCw className="w-3.5 h-3.5" />
              3. 完成续签
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              完成检查清单后标记续签为已完成，系统更新合同到期日期并归档续签记录。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
