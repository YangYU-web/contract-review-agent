// ===== 用户反馈 API =====
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { riskId, contractId, rating, comment } = body;

    if (!riskId || !rating) {
      return NextResponse.json(
        { error: '参数错误: 需要 riskId 和 rating' },
        { status: 400 }
      );
    }

    const validRatings = ['helpful', 'partially_helpful', 'not_helpful'];
    if (!validRatings.includes(rating)) {
      return NextResponse.json(
        { error: 'rating 必须是 helpful, partially_helpful, not_helpful 之一' },
        { status: 400 }
      );
    }

    // 保存到数据库（如果配置了Supabase）
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const { getSupabaseServer } = await import('@/lib/supabase');
        const supabase = getSupabaseServer();
        if (supabase) {
          await supabase.from('risk_feedbacks').upsert({
            risk_id: riskId,
            contract_id: contractId,
            rating,
            comment,
            created_at: new Date().toISOString(),
          });
        }
      } catch (dbErr) {
        console.error('DB save failed:', dbErr);
      }
    }

    return NextResponse.json({
      success: true,
      feedback: {
        risk_id: riskId,
        contract_id: contractId,
        rating,
        comment,
        created_at: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('Feedback API error:', err);
    return NextResponse.json(
      { error: `服务器错误: ${err instanceof Error ? err.message : '未知错误'}` },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const riskId = searchParams.get('riskId');

    if (riskId && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const { getSupabaseServer } = await import('@/lib/supabase');
      const supabase = getSupabaseServer();
      if (supabase) {
        const { data } = await supabase
          .from('risk_feedbacks')
          .select('*')
          .eq('risk_id', riskId)
          .single();
        return NextResponse.json(data || { feedback: null });
      }
    }

    return NextResponse.json({ feedback: null, mock: true });
  } catch (err) {
    console.error('Feedback GET error:', err);
    return NextResponse.json({ feedback: null }, { status: 500 });
  }
}
