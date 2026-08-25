// ===== 合同生命周期管理 API =====
export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseConfigured } from '@/lib/supabase';

// GET: 查询合同生命周期
export async function GET(request: NextRequest) {
  const contractId = request.nextUrl.searchParams.get('contract_id');
  const status = request.nextUrl.searchParams.get('status');

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: '数据库未配置' }, { status: 500 });
  }

  try {
    const { getSupabaseServer } = await import('@/lib/supabase');
    const supabase = getSupabaseServer();
    if (!supabase) {
      return NextResponse.json({ error: '数据库连接失败' }, { status: 500 });
    }

    let query = supabase.from('contract_lifecycles').select('*').order('created_at', { ascending: false });

    if (contractId) query = query.eq('contract_id', contractId);
    if (status) query = query.eq('status', status);

    const { data, error } = await query;

    if (error) throw error;

    const lifecycles = (data || []).map(mapRow);

    return NextResponse.json({ lifecycles, total: lifecycles.length });
  } catch (err) {
    console.error('Lifecycle API error:', err);
    return NextResponse.json({
      lifecycles: [],
      total: 0,
      error: err instanceof Error ? err.message : '查询失败',
    });
  }
}

// POST: 创建/更新生命周期
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { contract_id, contract_title, contract_type, party_a, party_b, start_date, end_date, status, auto_renew, renewal_notice_days, value, currency, action } = body;

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: '数据库未配置' }, { status: 500 });
    }

    const { getSupabaseServer } = await import('@/lib/supabase');
    const supabase = getSupabaseServer();
    if (!supabase) {
      return NextResponse.json({ error: '数据库连接失败' }, { status: 500 });
    }

    if (action === 'update_status') {
      const { data, error } = await supabase
        .from('contract_lifecycles')
        .update({ status: body.new_status, updated_at: new Date().toISOString() })
        .eq('id', body.lifecycle_id)
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json({ lifecycle: mapRow(data), message: '状态已更新' });
    }

    // 创建
    const { data, error } = await supabase
      .from('contract_lifecycles')
      .insert({
        contract_id,
        contract_title,
        contract_type,
        party_a,
        party_b,
        start_date,
        end_date,
        status: status || 'draft',
        auto_renew: auto_renew || false,
        renewal_notice_days: renewal_notice_days || 30,
        value,
        currency: currency || 'CNY',
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ lifecycle: mapRow(data), message: '生命周期已创建' });
  } catch (err) {
    console.error('Lifecycle POST error:', err);
    return NextResponse.json({
      error: err instanceof Error ? err.message : '操作失败',
    }, { status: 500 });
  }
}

function mapRow(row: any) {
  return {
    id: row.id,
    contract_id: row.contract_id,
    contract_title: row.contract_title,
    contract_type: row.contract_type,
    party_a: row.party_a,
    party_b: row.party_b,
    start_date: row.start_date,
    end_date: row.end_date,
    status: row.status,
    auto_renew: row.auto_renew,
    renewal_notice_days: row.renewal_notice_days,
    value: row.value !== null ? Number(row.value) : null,
    currency: row.currency,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
