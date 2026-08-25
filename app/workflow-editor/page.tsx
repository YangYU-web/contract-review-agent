'use client';

// ===== 工作流引擎页面 =====
// 页面标题 + WorkflowEditor 组件 + 底部节点类型说明

export const runtime = 'edge';

import { Workflow, Settings, Info } from 'lucide-react';
import WorkflowEditor from '@/components/WorkflowEditor';

// 节点类型说明
const NODE_TYPE_EXPLANATIONS = [
  { type: '开始节点', color: 'bg-green-50 text-green-600 border-green-100', desc: '流程入口，每个工作流仅有一个开始节点，标记审批流程的起点。' },
  { type: '审批节点', color: 'bg-blue-50 text-blue-600 border-blue-100', desc: '指定审批角色与 SLA 时长，需在规定时间内完成审批操作。' },
  { type: '审查节点', color: 'bg-brand-50 text-brand-600 border-brand-100', desc: '分配审查角色进行合同内容审查，可配置 SLA 超时提醒。' },
  { type: '条件判断', color: 'bg-amber-50 text-amber-600 border-amber-100', desc: '根据合同字段（如金额）进行条件分支，走向 true 或 false 路径。' },
  { type: '通知节点', color: 'bg-cyan-50 text-cyan-600 border-cyan-100', desc: '在流程中发送通知消息，支持自定义通知模板。' },
  { type: '并行处理', color: 'bg-indigo-50 text-indigo-600 border-indigo-100', desc: '多个分支同时执行，需所有分支完成后才继续后续流程。' },
  { type: '结束节点', color: 'bg-slate-50 text-slate-600 border-slate-100', desc: '流程出口，每个工作流仅有一个结束节点，标记审批流程的终点。' },
];

export default function WorkflowEditorPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* 页头 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Workflow className="w-6 h-6 text-brand-600" />
          工作流引擎
        </h1>
        <p className="text-slate-500 text-sm mt-1 flex items-center gap-1.5">
          <Settings className="w-3.5 h-3.5 text-brand-400" />
          可视化设计合同审批流程，支持节点拖拽、连线、条件分支与流程实例监控
        </p>
      </div>

      {/* 工作流编辑器组件 */}
      <WorkflowEditor />

      {/* 底部：节点类型说明 */}
      <div className="mt-6 bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Info className="w-4 h-4 text-brand-600" />
          <h2 className="font-semibold text-slate-800 text-sm">节点类型说明</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {NODE_TYPE_EXPLANATIONS.map((item) => (
            <div
              key={item.type}
              className="rounded-xl border border-slate-100 p-3 hover:border-slate-200 transition-colors"
            >
              <span
                className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full border mb-2 ${item.color}`}
              >
                {item.type}
              </span>
              <p className="text-xs text-slate-500 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
