'use client';

import { Handshake, Info, Scale } from 'lucide-react';
import NegotiationAssistant from '@/components/NegotiationAssistant';

// 谈判策略说明
const STRATEGY_EXPLANATIONS = [
  {
    name: 'BATNA（最佳替代方案）',
    icon: Scale,
    color: 'text-brand-700 bg-brand-50',
    desc: 'Best Alternative to a Negotiated Agreement。指在当前谈判破裂时，我方可采取的最佳替代方案。BATNA 越强，谈判底气越足。谈判前应明确自身与对方的 BATNA，以此作为让步底线与策略调整依据。',
  },
  {
    name: 'ZOPA（可能达成协议区间）',
    icon: Handshake,
    color: 'text-green-700 bg-green-50',
    desc: 'Zone of Possible Agreement。指买方愿付最高价与卖方愿接受最低价之间的重叠区间。ZOPA 越宽，达成协议的可能性越大。AI 通过分析双方立场自动估算 ZOPA 区间，辅助判断谈判空间。',
  },
  {
    name: '杠杆分析（Leverage Analysis）',
    icon: Info,
    color: 'text-blue-700 bg-blue-50',
    desc: '杠杆是谈判中迫使对方让步的能力来源，包括市场地位、替代方案、时间压力、信息优势等。AI 识别并对比双方杠杆，量化谈判平衡分，帮助判断谈判态势并制定策略。',
  },
];

export default function NegotiationPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* 页头 */}
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Handshake className="w-6 h-6 text-brand-600" />
            合同谈判助手
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            AI 驱动的谈判分析，评估双方立场、杠杆与达成可能性，辅助制定最优谈判策略
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-slate-200">
          <Scale className="w-4 h-4 text-brand-600" />
          <span className="text-xs text-slate-500">演示模式</span>
          <span className="text-xs text-slate-300">·</span>
          <span className="text-xs text-slate-400">谈判引擎</span>
        </div>
      </div>

      {/* 谈判助手组件 */}
      <NegotiationAssistant />

      {/* 底部说明区域：谈判策略说明 */}
      <div className="mt-8 bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h2 className="font-semibold text-slate-800 flex items-center gap-2 mb-4">
          <Info className="w-4 h-4 text-brand-600" />
          谈判策略说明
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {STRATEGY_EXPLANATIONS.map((s) => {
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
