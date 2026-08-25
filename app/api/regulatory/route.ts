// ===== 法规变更监控 API =====
// 提供法规变更列表、统计与合规差距查询，以及影响评估、状态更新与新增变更
// 优先使用 Supabase 数据库（regulatory_changes 表），数据库未配置或操作失败时优雅降级到内存 Mock 数据。
// 注：合规差距（gaps）无专门数据库表，始终由 Mock 数据生成。

export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import {
  RegulatoryChange,
  RegulatoryComplianceGap,
  RegulatoryStatus,
  RegulatoryImpactLevel,
} from '@/lib/types';
import { isSupabaseConfigured } from '@/lib/supabase';
import {
  getMockRegulatoryChanges,
  getMockComplianceGaps,
  getRegulatoryStats,
  assessImpact,
} from '@/lib/regulatory-monitor';

// 模块级内存存储（仅作降级兜底）：初始化为 Mock 数据
let changesStore: RegulatoryChange[] = getMockRegulatoryChanges();
let gapsStore: RegulatoryComplianceGap[] = getMockComplianceGaps();

// 获取 Supabase 服务端客户端（如未配置返回 null）
async function getDb() {
  if (!isSupabaseConfigured()) return null;
  const { getSupabaseServer } = await import('@/lib/supabase');
  return getSupabaseServer();
}

// 从数据库读取法规变更列表（可选状态/影响等级过滤）
async function fetchChangesFromDb(
  supabase: any,
  status?: string | null,
  impact?: string | null
): Promise<RegulatoryChange[]> {
  let query = supabase
    .from('regulatory_changes')
    .select('*')
    .order('created_at', { ascending: false });
  if (status) query = query.eq('status', status);
  if (impact) query = query.eq('impact_level', impact);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as RegulatoryChange[];
}

// GET: 返回法规变更列表、统计与合规差距，支持 ?status= 与 ?impact= 过滤
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as RegulatoryStatus | null;
    const impact = searchParams.get('impact') as RegulatoryImpactLevel | null;

    // 优先尝试数据库
    const supabase = await getDb();
    if (supabase) {
      try {
        const filtered = await fetchChangesFromDb(supabase, status, impact);
        const fullList = (status || impact) ? filtered : await fetchChangesFromDb(supabase);
        const stats = getRegulatoryStats(fullList);
        return NextResponse.json({
          changes: filtered,
          stats,
          gaps: gapsStore,
          mock: false,
        });
      } catch (dbErr) {
        console.error('Regulatory GET DB error, falling back to mock:', dbErr);
      }
    }

    // 降级：内存 Mock 数据
    let list = changesStore;
    if (status) {
      list = list.filter((c) => c.status === status);
    }
    if (impact) {
      list = list.filter((c) => c.impact_level === impact);
    }
    const stats = getRegulatoryStats(changesStore);
    return NextResponse.json({
      changes: list,
      stats,
      gaps: gapsStore,
      mock: true,
    });
  } catch (err) {
    console.error('Regulatory GET error:', err);
    return NextResponse.json(
      { error: `服务器错误: ${err instanceof Error ? err.message : '未知错误'}` },
      { status: 500 }
    );
  }
}

// POST: 支持 assess / update_status / add_change 三种操作
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    // 1) 影响评估：基于合同类型评估法规对合同的影响等级
    if (action === 'assess') {
      const { change_id, contract_type } = body;
      if (!change_id || !contract_type) {
        return NextResponse.json(
          { error: '缺少 change_id 或 contract_type 参数' },
          { status: 400 }
        );
      }

      // 尝试数据库
      const supabase = await getDb();
      if (supabase) {
        try {
          const { data: change, error } = await supabase
            .from('regulatory_changes')
            .select('*')
            .eq('id', change_id)
            .single();
          if (error) throw error;
          if (!change) {
            return NextResponse.json({ error: '法规变更不存在' }, { status: 404 });
          }
          const impact_level = assessImpact(change as RegulatoryChange, contract_type);
          return NextResponse.json({
            change_id,
            contract_type,
            impact_level,
            mock: false,
          });
        } catch (dbErr) {
          console.error('Regulatory assess DB error, falling back to mock:', dbErr);
        }
      }

      // 降级：内存
      const change = changesStore.find((c) => c.id === change_id);
      if (!change) {
        return NextResponse.json({ error: '法规变更不存在' }, { status: 404 });
      }
      const impact_level = assessImpact(change, contract_type);
      return NextResponse.json({
        change_id,
        contract_type,
        impact_level,
        mock: true,
      });
    }

    // 2) 更新状态：变更法规跟踪状态
    if (action === 'update_status') {
      const { change_id, status } = body;
      if (!change_id || !status) {
        return NextResponse.json(
          { error: '缺少 change_id 或 status 参数' },
          { status: 400 }
        );
      }

      // 尝试数据库
      const supabase = await getDb();
      if (supabase) {
        try {
          const { data: existing, error: fetchErr } = await supabase
            .from('regulatory_changes')
            .select('*')
            .eq('id', change_id)
            .single();
          if (fetchErr) throw fetchErr;
          if (!existing) {
            return NextResponse.json({ error: '法规变更不存在' }, { status: 404 });
          }
          const { error: updErr } = await supabase
            .from('regulatory_changes')
            .update({ status: status as RegulatoryStatus })
            .eq('id', change_id);
          if (updErr) throw updErr;
          const updated = { ...(existing as RegulatoryChange), status: status as RegulatoryStatus };
          const allChanges = await fetchChangesFromDb(supabase);
          return NextResponse.json({
            change: updated,
            changes: allChanges,
            stats: getRegulatoryStats(allChanges),
            mock: false,
          });
        } catch (dbErr) {
          console.error('Regulatory update_status DB error, falling back to mock:', dbErr);
        }
      }

      // 降级：内存
      const idx = changesStore.findIndex((c) => c.id === change_id);
      if (idx < 0) {
        return NextResponse.json({ error: '法规变更不存在' }, { status: 404 });
      }
      changesStore[idx] = {
        ...changesStore[idx],
        status: status as RegulatoryStatus,
      };
      return NextResponse.json({
        change: changesStore[idx],
        changes: changesStore,
        stats: getRegulatoryStats(changesStore),
        mock: true,
      });
    }

    // 3) 新增法规变更
    if (action === 'add_change') {
      const change = body.change as RegulatoryChange;
      if (!change || !change.id || !change.title) {
        return NextResponse.json(
          { error: '缺少法规变更必要字段' },
          { status: 400 }
        );
      }

      // 尝试写入数据库（id 由数据库自动生成 UUID）
      const supabase = await getDb();
      if (supabase) {
        try {
          const insertPayload: any = {
            title: change.title,
            type: change.type,
            jurisdiction: change.jurisdiction,
            effective_date: change.effective_date,
            published_date: change.published_date,
            summary: change.summary,
            full_text_url: change.full_text_url,
            affected_areas: change.affected_areas || [],
            impact_level: change.impact_level,
            affected_contracts: change.affected_contracts || [],
            recommended_actions: change.recommended_actions || [],
            status: change.status,
            deadline: change.deadline,
          };
          const { error } = await supabase
            .from('regulatory_changes')
            .insert(insertPayload);
          if (error) throw error;
          const allChanges = await fetchChangesFromDb(supabase);
          return NextResponse.json({
            changes: allChanges,
            stats: getRegulatoryStats(allChanges),
            mock: false,
          });
        } catch (dbErr) {
          console.error('Regulatory add_change DB error, falling back to mock:', dbErr);
        }
      }

      // 降级：内存（去重后追加）
      const exists = changesStore.some((c) => c.id === change.id);
      if (!exists) {
        changesStore = [change, ...changesStore];
      }
      return NextResponse.json({
        changes: changesStore,
        stats: getRegulatoryStats(changesStore),
        mock: true,
      });
    }

    return NextResponse.json(
      { error: 'action 必须为 assess / update_status / add_change' },
      { status: 400 }
    );
  } catch (err) {
    console.error('Regulatory POST error:', err);
    return NextResponse.json(
      { error: `服务器错误: ${err instanceof Error ? err.message : '未知错误'}` },
      { status: 500 }
    );
  }
}
