export const runtime = 'edge';

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, FileText, AlertTriangle, CheckCircle2, Info, GitBranch, FileDiff, Download } from 'lucide-react';
import RiskCard from '@/components/RiskCard';
import ClauseComparisonView from '@/components/ClauseComparisonView';
import ApprovalFlowView from '@/components/ApprovalFlowView';
import ReviewDetailClient from '@/components/ReviewDetailClient';
import { getMockContracts, getMockRisks } from '@/lib/mock-data';
import { getMockComparison } from '@/lib/clause-comparison';
import { getMockApprovalFlow } from '@/lib/approval-flow';
import { isSupabaseConfigured } from '@/lib/supabase';
import { Contract, ContractRisk, ClauseComparisonResult, ApprovalFlow } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function ReviewDetailPage({
  params,
}: {
  params: { id: string };
}) {
  let contract: Contract | null = null;
  let risks: ContractRisk[] = [];
  let comparison: ClauseComparisonResult | null = null;
  let approvalFlow: ApprovalFlow | null = null;

  if (isSupabaseConfigured()) {
    try {
      const { getSupabaseServer } = await import('@/lib/supabase');
      const supabase = getSupabaseServer();
      if (supabase) {
        const { data: contractData } = await supabase
          .from('contracts').select('*').eq('id', params.id).single();
        contract = contractData as Contract;
        const { data: riskData } = await supabase
          .from('contract_risks').select('*').eq('contract_id', params.id).order('risk_level', { ascending: true });
        risks = (riskData as ContractRisk[]) || [];
      }
    } catch { /* fall back to mock */ }
  }

  if (!contract) {
    const mockContracts = getMockContracts();
    contract = mockContracts.find(c => c.id === params.id) || mockContracts[0] || null;
    if (contract) {
      risks = getMockRisks(contract.id);
    }
  }

  if (!contract) notFound();

  // 生成条款比对和审批流
  comparison = getMockComparison(contract.id, contract.contract_type || '采购合同');
  approvalFlow = getMockApprovalFlow(contract.id, contract.risk_score || 0, contract.high_risk_count || 0);

  const highRisks = risks.filter(r => r.risk_level === 'high');
  const mediumRisks = risks.filter(r => r.risk_level === 'medium');
  const lowRisks = risks.filter(r => r.risk_level === 'low');
  const acceptedCount = risks.filter(r => r.user_decision === 'accepted').length;
  const rejectedCount = risks.filter(r => r.user_decision === 'rejected').length;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-brand-600 mb-6">
        <ArrowLeft className="w-4 h-4" /> 返回列表
      </Link>

      {/* 合同信息卡片 */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-xl bg-brand-50 flex items-center justify-center shrink-0">
            <FileText className="w-7 h-7 text-brand-600" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-slate-800">{contract!.contract_title || contract!.filename}</h1>
            <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-slate-500">
              <span>{contract!.contract_type || '未分类'}</span>
              <span>{contract!.filename}</span>
              <span>{new Date(contract!.created_at).toLocaleString('zh-CN')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 风险评分概览 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <ScoreCard value={contract!.risk_score || 0} label="综合风险评分" color={(contract!.risk_score || 0) >= 60 ? 'text-red-500' : (contract!.risk_score || 0) >= 40 ? 'text-amber-500' : 'text-green-500'} />
        <StatCard icon={AlertTriangle} value={highRisks.length} label="高风险" color="text-red-500" bg="bg-red-50" />
        <StatCard icon={Info} value={mediumRisks.length} label="中风险" color="text-amber-500" bg="bg-amber-50" />
        <StatCard icon={CheckCircle2} value={lowRisks.length} label="低风险" color="text-green-500" bg="bg-green-50" />
      </div>

      {/* 决策统计 + Redline导出 */}
      {risks.length > 0 && (
        <div className="bg-slate-50 rounded-xl p-4 mb-6 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-6 text-sm">
            <span className="text-slate-600">已采纳 <strong className="text-green-600">{acceptedCount}</strong> 项</span>
            <span className="text-slate-600">已驳回 <strong className="text-red-600">{rejectedCount}</strong> 项</span>
            <span className="text-slate-600">待处理 <strong className="text-slate-400">{risks.length - acceptedCount - rejectedCount}</strong> 项</span>
          </div>
          <ReviewDetailClient contract={contract!} risks={risks} comparison={comparison} />
        </div>
      )}

      {/* Tab切换区域 */}
      <ReviewDetailTabs
        risks={risks}
        comparison={comparison}
        approvalFlow={approvalFlow}
        highRisks={highRisks}
        mediumRisks={mediumRisks}
        lowRisks={lowRisks}
      />
    </div>
  );
}

function ScoreCard({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
      <div className={`text-3xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-slate-400 mt-1">{label}</div>
    </div>
  );
}

function StatCard({ icon: Icon, value, label, color, bg }: { icon: React.ElementType; value: number; label: string; color: string; bg: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center`}>
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
      <div>
        <div className="text-xl font-bold text-slate-800">{value}</div>
        <div className="text-xs text-slate-400">{label}</div>
      </div>
    </div>
  );
}

// Tab切换容器组件（传给客户端组件渲染）
function ReviewDetailTabs({ risks, comparison, approvalFlow, highRisks, mediumRisks, lowRisks }: {
  risks: ContractRisk[];
  comparison: ClauseComparisonResult;
  approvalFlow: ApprovalFlow;
  highRisks: ContractRisk[];
  mediumRisks: ContractRisk[];
  lowRisks: ContractRisk[];
}) {
  return (
    <RiskSection
      highRisks={highRisks}
      mediumRisks={mediumRisks}
      lowRisks={lowRisks}
      comparison={comparison}
      approvalFlow={approvalFlow}
    />
  );
}

function RiskSection({ highRisks, mediumRisks, lowRisks, comparison, approvalFlow }: {
  highRisks: ContractRisk[];
  mediumRisks: ContractRisk[];
  lowRisks: ContractRisk[];
  comparison: ClauseComparisonResult;
  approvalFlow: ApprovalFlow;
}) {
  return (
    <div className="space-y-6">
      {/* 风险列表 */}
      <div>
        <h2 className="text-lg font-semibold text-slate-700 mb-3">风险详情（{highRisks.length + mediumRisks.length + lowRisks.length} 项）</h2>
        {highRisks.length > 0 && (
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-slate-500 mb-2 uppercase tracking-wide">高风险条款（{highRisks.length}）</h3>
            <div className="space-y-3">{highRisks.map(risk => <RiskCard key={risk.id} risk={risk} />)}</div>
          </div>
        )}
        {mediumRisks.length > 0 && (
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-slate-500 mb-2 uppercase tracking-wide">中风险条款（{mediumRisks.length}）</h3>
            <div className="space-y-3">{mediumRisks.map(risk => <RiskCard key={risk.id} risk={risk} />)}</div>
          </div>
        )}
        {lowRisks.length > 0 && (
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-slate-500 mb-2 uppercase tracking-wide">低风险条款（{lowRisks.length}）</h3>
            <div className="space-y-3">{lowRisks.map(risk => <RiskCard key={risk.id} risk={risk} />)}</div>
          </div>
        )}
      </div>

      {/* 条款比对 */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <FileDiff className="w-5 h-5 text-brand-600" />
          <h2 className="text-lg font-semibold text-slate-700">条款比对与异常检测</h2>
        </div>
        <ClauseComparisonView result={comparison} />
      </div>

      {/* 审批流 */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <GitBranch className="w-5 h-5 text-brand-600" />
          <h2 className="text-lg font-semibold text-slate-700">审批流程</h2>
        </div>
        <ApprovalFlowView flow={approvalFlow} />
      </div>

      {/* 底部操作 */}
      <div className="flex items-center justify-between pt-6 border-t border-slate-200">
        <Link href="/upload" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg gradient-bg text-white text-sm font-medium">
          <FileText className="w-4 h-4" /> 审查新合同
        </Link>
        <Link href="/analytics" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 text-sm font-medium hover:border-brand-300 hover:text-brand-600">
          <FileText className="w-4 h-4" /> 数据分析
        </Link>
      </div>
    </div>
  );
}
