'use client';

import { Building2, Users, Shield } from 'lucide-react';
import PartnerProfileView from '@/components/PartnerProfileView';

// ===== 供应商/客户档案管理页面 =====

export default function PartnersPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* 页头 */}
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="w-6 h-6 text-brand-600" />
            供应商/客户档案
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            统一管理供应商与客户档案，跟踪信用评级变化，降低合作风险
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-slate-200">
          <Shield className="w-4 h-4 text-brand-600" />
          <span className="text-xs text-slate-500">演示模式</span>
          <span className="text-xs text-slate-300">·</span>
          <span className="text-xs text-slate-400">档案管理</span>
        </div>
      </div>

      {/* 合作方档案管理组件 */}
      <PartnerProfileView />

      {/* 底部说明区域：档案管理指引 */}
      <div className="mt-8 bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h2 className="font-semibold text-slate-800 flex items-center gap-2 mb-4">
          <Users className="w-4 h-4 text-brand-600" />
          档案管理指引
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-4">
            <div className="text-sm font-semibold text-brand-700 mb-1.5 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5" />
              1. 建立档案
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              为每个供应商和客户建立完整档案，包括工商信息、联系方式、信用评级与合作记录。
            </p>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-4">
            <div className="text-sm font-semibold text-brand-700 mb-1.5 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" />
              2. 风险监控
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              系统根据合同风险评分、信用历史事件与黑名单状态动态计算合作方风险评分，实时预警。
            </p>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-4">
            <div className="text-sm font-semibold text-brand-700 mb-1.5 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              3. 信用管理
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              记录每次信用评级变更，形成完整信用历史时间线，为续签决策与新合作审批提供依据。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
