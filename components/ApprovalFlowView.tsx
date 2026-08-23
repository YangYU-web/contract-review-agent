'use client';

import { useState } from 'react';
import { Check, X, Clock, ArrowRight, GitBranch, Zap } from 'lucide-react';
import { ApprovalFlow, ApprovalNode, APPROVER_ROLE_LABELS, ROUTE_REASON_LABELS } from '@/lib/types';

interface ApprovalFlowViewProps {
  flow: ApprovalFlow;
  onApprove?: (nodeIndex: number, decision: 'approved' | 'rejected', comment: string) => void;
}

export default function ApprovalFlowView({ flow, onApprove }: ApprovalFlowViewProps) {
  const [comment, setComment] = useState('');
  const [actionNode, setActionNode] = useState<number | null>(null);
  const reasonConfig = ROUTE_REASON_LABELS[flow.route_reason];

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      {/* 头部 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <GitBranch className="w-5 h-5 text-brand-600" />
          <h3 className="font-semibold text-slate-800">审批流程</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-1 rounded" style={{ color: reasonConfig.color, backgroundColor: reasonConfig.color + '15' }}>
            {reasonConfig.label}
          </span>
          <span className={`text-xs px-2 py-1 rounded ${
            flow.status === 'approved' ? 'bg-green-50 text-green-600' :
            flow.status === 'rejected' ? 'bg-red-50 text-red-600' :
            flow.status === 'in_progress' ? 'bg-blue-50 text-blue-600' :
            'bg-slate-50 text-slate-500'
          }`}>
            {flow.status === 'approved' ? '已通过' :
             flow.status === 'rejected' ? '已拒绝' :
             flow.status === 'in_progress' ? '审批中' : '待审批'}
          </span>
        </div>
      </div>

      {/* 自动通过提示 */}
      {flow.auto_approved && (
        <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg mb-3">
          <Zap className="w-4 h-4 text-amber-500" />
          <span className="text-sm text-slate-500">
            风险评分低于阈值，系统自动通过审批
          </span>
        </div>
      )}

      {/* 审批链节点 */}
      <div className="space-y-2">
        {flow.nodes.map((node, idx) => {
          const isActive = idx === flow.current_node && flow.status !== 'approved' && flow.status !== 'rejected';
          const isPast = idx < flow.current_node;
          const isFuture = idx > flow.current_node;

          return (
            <div key={node.id}>
              <div className={`flex items-center gap-3 p-3 rounded-lg ${
                isActive ? 'bg-brand-50 border border-brand-200' :
                node.status === 'approved' ? 'bg-green-50/50' :
                node.status === 'rejected' ? 'bg-red-50/50' :
                'bg-slate-50'
              }`}>
                {/* 节点序号/状态 */}
                <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                  node.status === 'approved' ? 'bg-green-500 text-white' :
                  node.status === 'rejected' ? 'bg-red-500 text-white' :
                  isActive ? 'gradient-bg text-white' : 'bg-slate-200 text-slate-400'
                }`}>
                  {node.status === 'approved' ? <Check className="w-5 h-5" /> :
                   node.status === 'rejected' ? <X className="w-5 h-5" /> :
                   <span className="text-sm font-bold">{node.order}</span>}
                </div>

                {/* 节点信息 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-slate-800">{node.role_label}</span>
                    {isActive && (
                      <span className="flex items-center gap-1 text-xs text-brand-600">
                        <Clock className="w-3 h-3" /> 待审批
                      </span>
                    )}
                  </div>
                  {node.approver_name && (
                    <p className="text-xs text-slate-400">{node.approver_name}</p>
                  )}
                  {node.comment && (
                    <p className="text-xs text-slate-500 mt-1">{node.comment}</p>
                  )}
                </div>

                {/* 操作按钮（仅当前活跃节点且提供了回调） */}
                {isActive && onApprove && (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => { setActionNode(idx); setComment(''); }}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 transition-colors"
                    >
                      通过
                    </button>
                    <button
                      onClick={() => setActionNode(idx)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 transition-colors"
                    >
                      拒绝
                    </button>
                  </div>
                )}

                {/* 状态标签 */}
                {node.status === 'approved' && !isActive && (
                  <span className="text-xs text-green-600 flex items-center gap-1">
                    <Check className="w-3 h-3" /> 已通过
                  </span>
                )}
                {node.status === 'rejected' && (
                  <span className="text-xs text-red-600 flex items-center gap-1">
                    <X className="w-3 h-3" /> 已拒绝
                  </span>
                )}
              </div>

              {/* 审批操作展开区 */}
              {actionNode === idx && (
                <div className="mt-2 p-3 bg-white rounded-lg border border-slate-200 space-y-3">
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="输入审批意见（可选）"
                    className="w-full text-sm p-2 border border-slate-200 rounded-lg resize-none focus:outline-none focus:border-brand-300"
                    rows={2}
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        if (onApprove) onApprove(idx, 'approved', comment);
                        setActionNode(null);
                      }}
                      className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-green-500 hover:bg-green-600 transition-colors"
                    >
                      确认通过
                    </button>
                    <button
                      onClick={() => {
                        if (onApprove) onApprove(idx, 'rejected', comment);
                        setActionNode(null);
                      }}
                      className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-500 hover:bg-red-600 transition-colors"
                    >
                      确认拒绝
                    </button>
                    <button
                      onClick={() => setActionNode(null)}
                      className="px-4 py-2 rounded-lg text-sm font-medium text-slate-500 bg-slate-50 hover:bg-slate-100 transition-colors"
                    >
                      取消
                    </button>
                  </div>
                </div>
              )}

              {/* 连接线 */}
              {idx < flow.nodes.length - 1 && (
                <div className="ml-[18px] h-4 w-0.5 bg-slate-200" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
