// ===== 数据分析仪表盘 API =====
export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseConfigured } from '@/lib/supabase';

// GET: 获取分析数据
export async function GET(request: NextRequest) {
  const range = request.nextUrl.searchParams.get('range') || '30d';

  if (!isSupabaseConfigured()) {
    return NextResponse.json(getMockAnalytics());
  }

  try {
    const { getSupabaseServer } = await import('@/lib/supabase');
    const supabase = getSupabaseServer();
    if (!supabase) {
      return NextResponse.json(getMockAnalytics());
    }

    // 并行查询多个表获取统计数据
    const [
      contractsResult,
      risksResult,
      highRisksResult,
      commentsResult,
      approvalsResult,
      auditResult,
      rulesResult,
    ] = await Promise.all([
      supabase.from('contracts').select('id, risk_score, status, contract_type, created_at'),
      supabase.from('contract_risks').select('id, risk_level, risk_type, user_decision, citation_verified'),
      supabase.from('contract_risks').select('id').eq('risk_level', 'high'),
      supabase.from('contract_comments').select('id, resolved, created_at'),
      supabase.from('approval_flows').select('id, status, current_step, total_steps'),
      supabase.from('audit_logs').select('id, action, actor, created_at'),
      supabase.from('custom_risk_rules').select('id, status, match_count'),
    ]);

    const contracts = contractsResult.data || [];
    const risks = risksResult.data || [];
    const highRisks = highRisksResult.data || [];
    const comments = commentsResult.data || [];
    const approvals = approvalsResult.data || [];
    const auditLogs = auditResult.data || [];
    const rules = rulesResult.data || [];

    // 按合同类型分布
    const typeMap: Record<string, number> = {};
    contracts.forEach((c: any) => {
      const type = c.contract_type || '未分类';
      typeMap[type] = (typeMap[type] || 0) + 1;
    });

    // 按风险类型分布
    const riskTypeMap: Record<string, number> = {};
    risks.forEach((r: any) => {
      riskTypeMap[r.risk_type] = (riskTypeMap[r.risk_type] || 0) + 1;
    });

    // 风险等级分布
    const levelMap = { high: 0, medium: 0, low: 0 };
    risks.forEach((r: any) => {
      if (levelMap[r.risk_level as keyof typeof levelMap] !== undefined) {
        levelMap[r.risk_level as keyof typeof levelMap]++;
      }
    });

    // 决策统计
    const decisionMap = { accepted: 0, rejected: 0, pending: 0 };
    risks.forEach((r: any) => {
      const d = r.user_decision || 'pending';
      if (decisionMap[d as keyof typeof decisionMap] !== undefined) {
        decisionMap[d as keyof typeof decisionMap]++;
      }
    });

    // 平均风险评分
    const validScores = contracts.filter((c: any) => c.risk_score !== null).map((c: any) => c.risk_score);
    const avgRiskScore = validScores.length > 0
      ? Math.round(validScores.reduce((a: number, b: number) => a + b, 0) / validScores.length)
      : 0;

    // 审批统计
    const pendingApprovals = approvals.filter((a: any) => a.status === 'pending').length;
    const completedApprovals = approvals.filter((a: any) => a.status === 'approved').length;

    // 活跃规则数
    const activeRules = rules.filter((r: any) => r.status === 'active').length;
    const totalMatchCount = rules.reduce((sum: number, r: any) => sum + (r.match_count || 0), 0);

    // 近30天审查趋势
    const now = new Date();
    const days: { date: string; count: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const count = contracts.filter((c: any) => {
        if (!c.created_at) return false;
        return c.created_at.startsWith(dateStr);
      }).length;
      days.push({ date: dateStr, count });
    }

    // 引用验证率
    const verifiedRisks = risks.filter((r: any) => r.citation_verified).length;
    const verificationRate = risks.length > 0
      ? Math.round((verifiedRisks / risks.length) * 100)
      : 0;

    return NextResponse.json({
      overview: {
        total_contracts: contracts.length,
        total_risks: risks.length,
        high_risk_count: highRisks.length,
        avg_risk_score: avgRiskScore,
        pending_approvals: pendingApprovals,
        completed_approvals: completedApprovals,
        total_comments: comments.length,
        unresolved_comments: comments.filter((c: any) => !c.resolved).length,
        audit_logs: auditLogs.length,
        active_rules: activeRules,
        total_rule_matches: totalMatchCount,
        verification_rate: verificationRate,
      },
      distributions: {
        contract_types: Object.entries(typeMap).map(([name, value]) => ({ name, value })),
        risk_types: Object.entries(riskTypeMap).map(([name, value]) => ({ name, value })),
        risk_levels: [
          { level: 'high', count: levelMap.high, color: '#ef4444' },
          { level: 'medium', count: levelMap.medium, color: '#f59e0b' },
          { level: 'low', count: levelMap.low, color: '#10b981' },
        ],
        decisions: [
          { decision: 'accepted', count: decisionMap.accepted },
          { decision: 'rejected', count: decisionMap.rejected },
          { decision: 'pending', count: decisionMap.pending },
        ],
      },
      trends: {
        daily_reviews: days,
      },
      status: {
        contracts: {
          pending: contracts.filter((c: any) => c.status === 'pending').length,
          reviewing: contracts.filter((c: any) => c.status === 'reviewing').length,
          completed: contracts.filter((c: any) => c.status === 'completed').length,
          failed: contracts.filter((c: any) => c.status === 'failed').length,
        },
      },
      mock: false,
    });
  } catch (err) {
    console.error('Analytics API error:', err);
    return NextResponse.json(getMockAnalytics());
  }
}

function getMockAnalytics() {
  return {
    overview: {
      total_contracts: 0,
      total_risks: 0,
      high_risk_count: 0,
      avg_risk_score: 0,
      pending_approvals: 0,
      completed_approvals: 0,
      total_comments: 0,
      unresolved_comments: 0,
      audit_logs: 0,
      active_rules: 0,
      total_rule_matches: 0,
      verification_rate: 0,
    },
    distributions: {
      contract_types: [],
      risk_types: [],
      risk_levels: [
        { level: 'high', count: 0, color: '#ef4444' },
        { level: 'medium', count: 0, color: '#f59e0b' },
        { level: 'low', count: 0, color: '#10b981' },
      ],
      decisions: [
        { decision: 'accepted', count: 0 },
        { decision: 'rejected', count: 0 },
        { decision: 'pending', count: 0 },
      ],
    },
    trends: { daily_reviews: [] },
    status: {
      contracts: { pending: 0, reviewing: 0, completed: 0, failed: 0 },
    },
    mock: true,
  };
}
