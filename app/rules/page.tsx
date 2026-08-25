'use client';

export const runtime = 'edge';

import { Shield, Settings, Info } from 'lucide-react';
import RuleManager from '@/components/RuleManager';

// 规则引擎工作原理说明
const PRINCIPLES = [
  {
    step: '1. 定义规则',
    desc: '法务团队根据业务风险偏好，预先配置规则名称、检查字段、操作符（包含/正则/大于/小于等）、阈值与严重程度。',
  },
  {
    step: '2. 条款解析',
    desc: '合同上传后，系统自动按"第X条"将合同文本切分为结构化条款，提取每条条款的编号与正文。',
  },
  {
    step: '3. 规则匹配',
    desc: '规则引擎逐条遍历活跃规则，依据操作符对条款文本进行匹配：包含检查、正则匹配、数值比较等。',
  },
  {
    step: '4. 风险输出',
    desc: '命中的规则将生成风险结果，包含命中值、严重程度与修改建议，并计入规则匹配次数用于统计。',
  },
];

export default function RulesPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* 页头 */}
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="w-6 h-6 text-brand-600" />
            自定义风险规则
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            配置企业专属风险检测规则，在合同审查时自动匹配并输出风险建议
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-slate-200">
          <Settings className="w-4 h-4 text-brand-600" />
          <span className="text-xs text-slate-500">演示模式</span>
          <span className="text-xs text-slate-300">·</span>
          <span className="text-xs text-slate-400">规则引擎</span>
        </div>
      </div>

      {/* 规则管理组件 */}
      <RuleManager />

      {/* 底部说明区域：规则引擎工作原理 */}
      <div className="mt-8 bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h2 className="font-semibold text-slate-800 flex items-center gap-2 mb-4">
          <Info className="w-4 h-4 text-brand-600" />
          规则引擎工作原理
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {PRINCIPLES.map((p) => (
            <div
              key={p.step}
              className="rounded-lg border border-slate-100 bg-slate-50/60 p-4"
            >
              <div className="text-sm font-semibold text-brand-700 mb-1.5">
                {p.step}
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                {p.desc}
              </p>
            </div>
          ))}
        </div>

        {/* 操作符说明 */}
        <div className="mt-5 pt-5 border-t border-slate-100">
          <h3 className="text-sm font-semibold text-slate-700 mb-2">
            支持的操作符
          </h3>
          <div className="flex flex-wrap gap-2">
            {[
              { op: 'contains', desc: '检查条款文本是否包含关键词' },
              { op: 'not_contains', desc: '检查条款文本是否缺少关键词' },
              { op: 'equals', desc: '条款文本精确匹配' },
              { op: 'regex', desc: '正则表达式匹配' },
              { op: 'greater_than', desc: '提取数值/百分比大于阈值' },
              { op: 'less_than', desc: '提取数值/百分比小于阈值' },
            ].map((item) => (
              <div
                key={item.op}
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5"
              >
                <code className="text-xs font-mono text-brand-700 bg-brand-50 px-1.5 py-0.5 rounded">
                  {item.op}
                </code>
                <span className="text-xs text-slate-500">{item.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
