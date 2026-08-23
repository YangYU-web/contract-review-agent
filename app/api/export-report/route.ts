// ===== 审查报告导出 API =====
// 接收合同ID和导出格式，生成并返回完整审查报告

import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseConfigured } from '@/lib/supabase';
import { getMockContracts, getMockRisks, MOCK_REVIEW_RESULT } from '@/lib/mock-data';
import { generateReportHTML, generateReportText } from '@/lib/report-generator';
import { getMockApprovalFlow } from '@/lib/approval-flow';
import { Contract, ContractRisk, ReviewReport } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { contract_id, format } = body as { contract_id: string; format: 'html' | 'txt' };

    if (!contract_id) {
      return NextResponse.json({ error: '缺少参数 contract_id' }, { status: 400 });
    }

    if (format !== 'html' && format !== 'txt') {
      return NextResponse.json({ error: '不支持的格式，请使用 html 或 txt' }, { status: 400 });
    }

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
          // 查询合同
          const { data: contractData } = await supabase
            .from('contracts')
            .select('*')
            .eq('id', contract_id)
            .single();
          contract = contractData as Contract;

          // 查询风险
          const { data: riskData } = await supabase
            .from('contract_risks')
            .select('*')
            .eq('contract_id', contract_id)
            .order('risk_level', { ascending: true });
          risks = (riskData as ContractRisk[]) || [];

          // 查询审批流状态
          const { data: flowData } = await supabase
            .from('approval_flows')
            .select('status')
            .eq('contract_id', contract_id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
          if (flowData) {
            approvalStatus = (flowData as { status: string }).status;
          }
        }
      } catch (dbErr) {
        console.error('Database query failed, falling back to mock:', dbErr);
      }
    }

    // 如果数据库未配置或查询失败，使用mock数据（mock-001）
    if (!contract) {
      const mockContracts = getMockContracts();
      contract = mockContracts.find(c => c.id === contract_id) || mockContracts[0] || null;
      if (contract) {
        risks = getMockRisks(contract.id);
        summary = MOCK_REVIEW_RESULT.summary;
        // 生成mock审批流状态
        const mockFlow = getMockApprovalFlow(contract.id, contract.risk_score || 0, contract.high_risk_count || 0);
        approvalStatus = mockFlow.status;
      }
    }

    if (!contract) {
      return NextResponse.json({ error: '未找到合同记录' }, { status: 404 });
    }

    // ===== 构建审查报告对象 =====
    const highCount = risks.filter(r => r.risk_level === 'high').length;
    const mediumCount = risks.filter(r => r.risk_level === 'medium').length;
    const lowCount = risks.filter(r => r.risk_level === 'low').length;

    const report: ReviewReport = {
      report_id: `RPT-${contract.id}-${Date.now()}`,
      contract_id: contract.id,
      contract_title: contract.contract_title || contract.filename,
      contract_type: contract.contract_type || '未分类',
      filename: contract.filename,
      review_date: contract.updated_at || contract.created_at,
      risk_score: contract.risk_score || 0,
      risk_count: risks.length,
      high_risk_count: highCount,
      medium_risk_count: mediumCount,
      low_risk_count: lowCount,
      summary: summary || MOCK_REVIEW_RESULT.summary,
      risks,
      approval_status: approvalStatus,
      generated_at: new Date().toISOString(),
    };

    // ===== 生成报告内容 =====
    const safeFilename = (contract.contract_title || contract.filename || '审查报告')
      .replace(/[^\w\u4e00-\u9fa5.-]/g, '_');

    if (format === 'html') {
      const html = generateReportHTML(report);
      return new NextResponse(html, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(safeFilename)}.html"`,
        },
      });
    } else {
      const text = generateReportText(report);
      return new NextResponse(text, {
        status: 200,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(safeFilename)}.txt"`,
        },
      });
    }
  } catch (err) {
    console.error('Export report API error:', err);
    return NextResponse.json({
      error: `服务器错误: ${err instanceof Error ? err.message : '未知错误'}`
    }, { status: 500 });
  }
}
