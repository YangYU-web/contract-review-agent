// ===== 审查报告预览页面 =====
// 服务端组件，获取合同数据并渲染HTML审查报告

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, Home, FileText } from 'lucide-react';
import ReportDownload from '@/components/ReportDownload';
import { generateReportHTML } from '@/lib/report-generator';
import { getMockContracts, getMockRisks, MOCK_REVIEW_RESULT } from '@/lib/mock-data';
import { getMockApprovalFlow } from '@/lib/approval-flow';
import { isSupabaseConfigured } from '@/lib/supabase';
import { Contract, ContractRisk, ReviewReport } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function ReportPage({
  params,
}: {
  params: { id: string };
}) {
  let contract: Contract | null = null;
  let risks: ContractRisk[] = [];
  let summary = '';
  let approvalStatus: string | undefined;

  // ===== 获取合同和风险数据 =====
  if (isSupabaseConfigured()) {
    try {
      const { getSupabaseServer } = await import('@/lib/supabase');
      const supabase = getSupabaseServer();
      if (supabase) {
        const { data: contractData } = await supabase
          .from('contracts')
          .select('*')
          .eq('id', params.id)
          .single();
        contract = contractData as Contract;

        const { data: riskData } = await supabase
          .from('contract_risks')
          .select('*')
          .eq('contract_id', params.id)
          .order('risk_level', { ascending: true });
        risks = (riskData as ContractRisk[]) || [];

        // 查询审批流状态
        const { data: flowData } = await supabase
          .from('approval_flows')
          .select('status')
          .eq('contract_id', params.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        if (flowData) {
          approvalStatus = (flowData as { status: string }).status;
        }
      }
    } catch {
      // 查询失败，使用mock数据
    }
  }

  // 数据库未配置或查询失败时，使用mock数据
  if (!contract) {
    const mockContracts = getMockContracts();
    contract = mockContracts.find(c => c.id === params.id) || mockContracts[0] || null;
    if (contract) {
      risks = getMockRisks(contract.id);
      summary = MOCK_REVIEW_RESULT.summary;
      const mockFlow = getMockApprovalFlow(contract.id, contract.risk_score || 0, contract.high_risk_count || 0);
      approvalStatus = mockFlow.status;
    }
  }

  if (!contract) notFound();

  // ===== 构建审查报告对象 =====
  const highCount = risks.filter(r => r.risk_level === 'high').length;
  const mediumCount = risks.filter(r => r.risk_level === 'medium').length;
  const lowCount = risks.filter(r => r.risk_level === 'low').length;

  const report: ReviewReport = {
    report_id: `RPT-${contract!.id}-${Date.now()}`,
    contract_id: contract!.id,
    contract_title: contract!.contract_title || contract!.filename,
    contract_type: contract!.contract_type || '未分类',
    filename: contract!.filename,
    review_date: contract!.updated_at || contract!.created_at,
    risk_score: contract!.risk_score || 0,
    risk_count: risks.length,
    high_risk_count: highCount,
    medium_risk_count: mediumCount,
    low_risk_count: lowCount,
    summary: summary || MOCK_REVIEW_RESULT.summary,
    risks,
    approval_status: approvalStatus,
    generated_at: new Date().toISOString(),
  };

  // 生成HTML报告内容
  const reportHTML = generateReportHTML(report);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* 面包屑导航 */}
      <nav className="flex items-center gap-1.5 text-sm text-slate-500 mb-6">
        <Link href="/" className="flex items-center gap-1 hover:text-brand-600">
          <Home className="w-3.5 h-3.5" />
          首页
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
        <Link href="/dashboard" className="hover:text-brand-600">
          审查记录
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
        <Link href={`/dashboard/${contract!.id}`} className="hover:text-brand-600 truncate max-w-[200px]">
          {contract!.contract_title || contract!.filename}
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
        <span className="text-slate-700 font-medium">审查报告</span>
      </nav>

      {/* 操作栏 */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-6 flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5 text-brand-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800">审查报告预览</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              {contract!.contract_title || contract!.filename}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <ReportDownload
            contractId={contract!.id}
            contractTitle={contract!.contract_title}
          />
        </div>
      </div>

      {/* 报告内容 */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div
          className="report-content"
          dangerouslySetInnerHTML={{ __html: reportHTML }}
        />
      </div>
    </div>
  );
}
