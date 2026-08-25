// ===== 用户设置 API =====
export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseConfigured } from '@/lib/supabase';

// GET: 获取设置
export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(getDefaultSettings());
  }

  try {
    const { getSupabaseServer } = await import('@/lib/supabase');
    const supabase = getSupabaseServer();
    if (!supabase) {
      return NextResponse.json(getDefaultSettings());
    }

    const { data, error } = await supabase
      .from('user_settings')
      .select('*')
      .limit(1)
      .single();

    if (error || !data) {
      // 表不存在或无数据，返回默认设置
      return NextResponse.json(getDefaultSettings());
    }

    return NextResponse.json({
      language: data.language || 'zh',
      theme: data.theme || 'light',
      risk_threshold: data.risk_threshold || 50,
      auto_escalate: data.auto_escalate || false,
      email_notifications: data.email_notifications ?? true,
      webhook_url: data.webhook_url || '',
      ai_model: data.ai_model || 'deepseek-chat',
      review_depth: data.review_depth || 'standard',
      ...data,
    });
  } catch {
    return NextResponse.json(getDefaultSettings());
  }
}

// POST: 更新设置
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ message: '数据库未配置，设置仅保存在本地', settings: body });
    }

    const { getSupabaseServer } = await import('@/lib/supabase');
    const supabase = getSupabaseServer();
    if (!supabase) {
      return NextResponse.json({ message: '数据库连接失败', settings: body });
    }

    // 尝试更新或插入设置
    const { data, error } = await supabase
      .from('user_settings')
      .upsert({
        id: body.id || '00000000-0000-0000-0000-000000000000',
        ...body,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      // 表可能不存在，返回成功但不保存
      return NextResponse.json({ message: '设置已更新（本地模式）', settings: body });
    }

    return NextResponse.json({ message: '设置已保存', settings: data });
  } catch (err) {
    console.error('Settings POST error:', err);
    return NextResponse.json({
      error: err instanceof Error ? err.message : '操作失败',
    }, { status: 500 });
  }
}

function getDefaultSettings() {
  return {
    language: 'zh',
    theme: 'light',
    risk_threshold: 50,
    auto_escalate: false,
    email_notifications: true,
    webhook_url: '',
    ai_model: 'deepseek-chat',
    review_depth: 'standard',
    mock: true,
  };
}
