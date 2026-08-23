'use client';

import { useState } from 'react';
import { Check, X, FileWarning, Lightbulb, Quote } from 'lucide-react';
import { ContractRisk, RISK_TYPE_LABELS, RISK_LEVEL_CONFIG } from '@/lib/types';
import FeedbackWidget from '@/components/FeedbackWidget';

interface RiskCardProps {
  risk: ContractRisk;
  onDecision?: (riskId: string, decision: 'accepted' | 'rejected') => void;
}

export default function RiskCard({ risk, onDecision }: RiskCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [decision, setDecision] = useState(risk.user_decision || 'pending');

  const levelConfig = RISK_LEVEL_CONFIG[risk.risk_level];
  const typeLabel = RISK_TYPE_LABELS[risk.risk_type];

  const handleDecision = (newDecision: 'accepted' | 'rejected') => {
    setDecision(newDecision);
    if (onDecision) {
      onDecision(risk.id, newDecision);
    }
  };

  return (
    <div
      className={`bg-white rounded-xl border border-slate-200 overflow-hidden ${
        risk.risk_level === 'high' ? 'risk-high' : risk.risk_level === 'medium' ? 'risk-medium' : 'risk-low'
      }`}
    >
      {/* 头部 */}
      <div className="p-4 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span
                className="px-2 py-0.5 rounded text-xs font-bold"
                style={{ color: levelConfig.color, backgroundColor: levelConfig.bg }}
              >
                {levelConfig.label}
              </span>
              <span className="text-xs text-slate-500 px-2 py-0.5 rounded bg-slate-100">
                {typeLabel}
              </span>
              <span className="text-xs text-slate-400">{risk.clause_id}</span>
              {!risk.citation_verified && (
                <span className="text-xs text-red-500 flex items-center gap-0.5">
                  <FileWarning className="w-3 h-3" /> 引用待验证
                </span>
              )}
            </div>
            <p className="text-sm text-slate-700 line-clamp-2">{risk.risk_explanation}</p>
          </div>

          {/* 决策按钮 */}
          <div className="flex items-center gap-1.5 shrink-0">
            {decision === 'accepted' ? (
              <span className="flex items-center gap-1 text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded">
                <Check className="w-3 h-3" /> 已采纳
              </span>
            ) : decision === 'rejected' ? (
              <span className="flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 px-2 py-1 rounded">
                <X className="w-3 h-3" /> 已驳回
              </span>
            ) : (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDecision('accepted'); }}
                  className="p-1.5 rounded-lg text-green-600 hover:bg-green-50"
                  title="采纳建议"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDecision('rejected'); }}
                  className="p-1.5 rounded-lg text-red-600 hover:bg-red-50"
                  title="驳回建议"
                >
                  <X className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 展开详情 */}
      {expanded && (
        <div className="border-t border-slate-100 px-4 py-3 space-y-3 bg-slate-50/50">
          {/* 原条款引用 */}
          <div>
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 mb-1">
              <Quote className="w-3.5 h-3.5" /> 原条款
            </div>
            <p className="text-sm text-slate-600 bg-white rounded-lg p-3 border border-slate-100">
              {risk.clause_text}
            </p>
          </div>

          {/* 修改建议 */}
          {risk.suggested_redline && (
            <div>
              <div className="flex items-center gap-1.5 text-xs font-medium text-brand-600 mb-1">
                <Lightbulb className="w-3.5 h-3.5" /> AI修改建议
              </div>
              <p className="text-sm text-slate-700 bg-brand-50/50 rounded-lg p-3 border border-brand-100">
                {risk.suggested_redline}
              </p>
            </div>
          )}

          {/* 是否标准条款 */}
          <div className="text-xs text-slate-400">
            {risk.is_standard_clause
              ? '此条款符合市场惯例，风险较低'
              : '此条款偏离市场惯例，需重点关注'}
          </div>

          {/* 用户反馈 */}
          <FeedbackWidget riskId={risk.id} contractId={risk.contract_id} />
        </div>
      )}
    </div>
  );
}
