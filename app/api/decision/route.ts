// ===== 风险决策更新 API =====
// 用户采纳或驳回AI修改建议

export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseConfigured } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { riskId, decision, contractId } = body;

    if (!riskId || !decision || !['accepted', 'rejected'].includes(decision)) {
      return NextResponse.json(
        { error: '参数错误: 需要 riskId 和 decision (accepted/rejected)' },
        { status: 400 }
      );
    }

    if (isSupabaseConfigured()) {
      const { getSupabaseServer } = await import('@/lib/supabase');
      const supabase = getSupabaseServer();
      if (supabase) {
        // 更新风险决策
        const { error: updateError } = await supabase
          .from('contract_risks')
          .update({ user_decision: decision })
          .eq('id', riskId);

        if (updateError) throw updateError;

        // 记录审计日志
        await supabase
          .from('audit_logs')
          .insert({
            contract_id: contractId || null,
            action: `risk_${decision}`,
            actor: 'user',
            details: { risk_id: riskId, decision },
          });
      }
    }

    return NextResponse.json({
      success: true,
      riskId,
      decision,
      mock: !isSupabaseConfigured(),
    });
  } catch (err) {
    console.error('Decision API error:', err);
    return NextResponse.json(
      { error: `服务器错误: ${err instanceof Error ? err.message : '未知错误'}` },
      { status: 500 }
    );
  }
}
