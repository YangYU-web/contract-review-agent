'use client';

import { useState, useRef } from 'react';
import { Download, FileText, AlertTriangle, CheckCircle2, Info, GitBranch, FileDiff, ListChecks } from 'lucide-react';
import { Contract, ContractRisk, ClauseComparisonResult, ApprovalFlow } from '@/lib/types';
import RiskCard from '@/components/RiskCard';
import ClauseComparisonView from '@/components/ClauseComparisonView';
import ApprovalFlowView from '@/components/ApprovalFlowView';
import { generateRedlineHTML } from '@/lib/redline-export';

interface ReviewDetailClientProps {
  contract: Contract;
  risks: ContractRisk[];
  comparison: ClauseComparisonResult;
}

type TabType = 'risks' | 'comparison' | 'approval';

export default function ReviewDetailClient({ contract, risks, comparison }: ReviewDetailClientProps) {
  const [activeTab, setActiveTab] = useState<TabType>('risks');
  const [localRisks, setLocalRisks] = useState(risks);
  const [approvalFlow, setApprovalFlow] = useState<ApprovalFlow | null>(null);

  // Redline导出
  const handleExportRedline = () => {
    const html = generateRedlineHTML(
      contract.contract_title || contract.filename,
      contract.contract_type || '采购合同',
      localRisks,
      comparison,
      localRisks.filter(r => r.user_decision === 'accepted').map(r => r.id)
    );

    const blob = new Blob([html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${contract.contract_title || contract.filename}_审查修订报告.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 风险决策处理
  const handleDecision = async (riskId: string, decision: 'accepted' | 'rejected') => {
    setLocalRisks(prev => prev.map(r => r.id === riskId ? { ...r, user_decision: decision } : r));

    try {
      await fetch('/api/decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ riskId, decision, contractId: contract.id }),
      });
    } catch (err) {
      // 演示模式下静默失败
    }
  };

  const highRisks = localRisks.filter(r => r.risk_level === 'high');
  const mediumRisks = localRisks.filter(r => r.risk_level === 'medium');
  const lowRisks = localRisks.filter(r => r.risk_level === 'low');

  const tabs = [
    { id: 'risks' as TabType, label: '风险详情', icon: AlertTriangle, count: localRisks.length },
    { id: 'comparison' as TabType, label: '条款比对', icon: FileDiff, count: comparison.diffs.length },
    { id: 'approval' as TabType, label: '审批流程', icon: GitBranch, count: 0 },
  ];

  return (
    <div className="space-y-4">
      {/* Redline导出按钮 */}
      <button
        onClick={handleExportRedline}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors shadow-md shadow-brand-500/20"
      >
        <Download className="w-4 h-4" />
        导出审查修订报告
      </button>
    </div>
  );
}
