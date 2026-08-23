'use client';

// ===== 法规变更监控页面 =====
// 页面标题 + RegulatoryMonitor 组件 + 监控范围说明

import { Gavel, Scale, Info } from 'lucide-react';
import RegulatoryMonitor from '@/components/RegulatoryMonitor';

export default function RegulatoryPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* 页头 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Gavel className="w-6 h-6 text-brand-600" />
          法规变更监控
        </h1>
        <p className="text-slate-500 text-sm mt-1 flex items-center gap-1.5">
          <Scale className="w-3.5 h-3.5 text-brand-400" />
          实时跟踪法规变更对存量合同的影响，识别合规差距并给出整改建议与关键日期提醒
        </p>
      </div>

      {/* 法规变更监控视图组件 */}
      <RegulatoryMonitor />

      {/* 监控范围说明 */}
      <div className="mt-8 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Info className="w-4 h-4 text-brand-600" />
          <h2 className="font-semibold text-slate-800 text-sm">监控范围说明</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-slate-600">
          <div className="space-y-2">
            <p className="leading-relaxed">
              本模块持续监控中国大陆、欧盟、美国等主要司法管辖区的法规变更动态，覆盖新法规、修正案、废止、司法解释与指导方针五类变更类型。
            </p>
            <p className="leading-relaxed">
              系统自动识别法规对数据保护、劳动法、税法、知识产权、合同法等领域的影响，并匹配存量合同评估影响等级与所需行动。
            </p>
          </div>
          <div className="space-y-2">
            <p className="leading-relaxed">
              针对每项变更，提供受影响合同清单、整改紧迫度、建议行动清单与合规差距对比，帮助法务团队快速定位风险并制定整改计划。
            </p>
            <p className="leading-relaxed">
              通过生效日与截止日时间线，提前预警关键合规节点，确保在法规过渡期内完成合同条款修订与流程更新。
            </p>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-4 flex-wrap text-xs text-slate-400">
          <span className="flex items-center gap-1">
            <Gavel className="w-3.5 h-3.5 text-brand-500" />
            5 类法规变更类型
          </span>
          <span className="flex items-center gap-1">
            <Scale className="w-3.5 h-3.5 text-brand-500" />
            多司法管辖区覆盖
          </span>
          <span className="flex items-center gap-1">
            <Info className="w-3.5 h-3.5 text-brand-500" />
            演示模式：数据为模拟生成
          </span>
        </div>
      </div>
    </div>
  );
}
