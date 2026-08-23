// ===== 合同履约监控 API =====
// 提供履约追踪列表与统计查询，以及更新里程碑、KPI、义务、添加预警能力
// 优先使用 Supabase 数据库（performance_trackers 表），数据库未配置或操作失败时优雅降级到内存 Mock 数据。

import { NextRequest, NextResponse } from 'next/server';
import {
  PerformanceTracker,
  PerformanceStatus,
} from '@/lib/types';
import { isSupabaseConfigured } from '@/lib/supabase';
import {
  getMockPerformanceTrackers,
  getPerformanceStats,
  updateMilestone,
} from '@/lib/performance-tracking';

// 模块级内存存储（仅作降级兜底）：初始化为 Mock 数据
let trackersStore: PerformanceTracker[] = getMockPerformanceTrackers();

// 有效的履约状态集合
const VALID_STATUSES: PerformanceStatus[] = [
  'on_track',
  'at_risk',
  'delayed',
  'completed',
  'not_started',
];

// 更新 KPI（内部辅助）
function updateKpiInTracker(
  tracker: PerformanceTracker,
  kpiId: string,
  updates: Partial<{ actual: number; status: PerformanceStatus; trend: 'up' | 'down' | 'flat' }>
): PerformanceTracker {
  const kpis = tracker.kpis.map((k) =>
    k.id === kpiId
      ? {
          ...k,
          ...updates,
          last_updated: new Date().toISOString(),
        }
      : k
  );
  return { ...tracker, kpis };
}

// 更新义务（内部辅助）
function updateObligationInTracker(
  tracker: PerformanceTracker,
  obligationId: string,
  updates: Partial<{ status: PerformanceStatus; evidence: string }>
): PerformanceTracker {
  const obligations = tracker.obligations.map((o) =>
    o.id === obligationId ? { ...o, ...updates } : o
  );
  return { ...tracker, obligations };
}

// 获取 Supabase 服务端客户端（如未配置返回 null）
async function getDb() {
  if (!isSupabaseConfigured()) return null;
  const { getSupabaseServer } = await import('@/lib/supabase');
  return getSupabaseServer();
}

// 从数据库读取全部追踪记录（可选状态过滤）
async function fetchTrackersFromDb(
  supabase: any,
  status?: string | null
): Promise<PerformanceTracker[]> {
  let query = supabase
    .from('performance_trackers')
    .select('*')
    .order('created_at', { ascending: false });
  if (status) query = query.eq('status', status);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as PerformanceTracker[];
}

// GET: 返回履约追踪列表与统计
// 支持 ?status= 过滤状态
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as PerformanceStatus | null;

    // 优先尝试数据库
    const supabase = await getDb();
    if (supabase) {
      try {
        const filtered = await fetchTrackersFromDb(supabase, status);
        const fullList = status ? filtered : await fetchTrackersFromDb(supabase);
        return NextResponse.json({
          trackers: filtered,
          stats: getPerformanceStats(fullList),
          mock: false,
        });
      } catch (dbErr) {
        console.error('Performance GET DB error, falling back to mock:', dbErr);
      }
    }

    // 降级：内存 Mock 数据
    let list = trackersStore;
    if (status) {
      list = list.filter((t) => t.status === status);
    }
    return NextResponse.json({
      trackers: list,
      stats: getPerformanceStats(trackersStore),
      mock: true,
    });
  } catch (err) {
    console.error('Performance GET error:', err);
    return NextResponse.json(
      { error: `服务器错误: ${err instanceof Error ? err.message : '未知错误'}` },
      { status: 500 }
    );
  }
}

// POST: 执行 action（update_milestone / update_kpi / update_obligation / add_alert）
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = body.action as
      | 'update_milestone'
      | 'update_kpi'
      | 'update_obligation'
      | 'add_alert'
      | undefined;

    // ===== 更新里程碑 =====
    if (action === 'update_milestone') {
      const { tracker_id, milestone_id, updates } = body;
      if (!tracker_id) {
        return NextResponse.json(
          { error: '缺少 tracker_id 参数' },
          { status: 400 }
        );
      }
      if (!milestone_id) {
        return NextResponse.json(
          { error: '缺少 milestone_id 参数' },
          { status: 400 }
        );
      }

      // 尝试数据库
      const supabase = await getDb();
      if (supabase) {
        try {
          const { data: row, error } = await supabase
            .from('performance_trackers')
            .select('*')
            .eq('id', tracker_id)
            .single();
          if (error) throw error;
          if (!row) {
            return NextResponse.json({ error: '履约追踪记录不存在' }, { status: 404 });
          }
          const updated = updateMilestone(row as PerformanceTracker, milestone_id, updates || {});
          const { error: updErr } = await supabase
            .from('performance_trackers')
            .update({ milestones: updated.milestones, overall_progress: updated.overall_progress, status: updated.status })
            .eq('id', tracker_id);
          if (updErr) throw updErr;
          const allTrackers = await fetchTrackersFromDb(supabase);
          return NextResponse.json({
            tracker: updated,
            trackers: allTrackers,
            stats: getPerformanceStats(allTrackers),
            mock: false,
          });
        } catch (dbErr) {
          console.error('Performance update_milestone DB error, falling back to mock:', dbErr);
        }
      }

      // 降级：内存
      const idx = trackersStore.findIndex((t) => t.id === tracker_id);
      if (idx < 0) {
        return NextResponse.json({ error: '履约追踪记录不存在' }, { status: 404 });
      }
      trackersStore[idx] = updateMilestone(trackersStore[idx], milestone_id, updates || {});
      return NextResponse.json({
        tracker: trackersStore[idx],
        trackers: trackersStore,
        stats: getPerformanceStats(trackersStore),
        mock: true,
      });
    }

    // ===== 更新 KPI =====
    if (action === 'update_kpi') {
      const { tracker_id, kpi_id, actual, status, trend } = body;
      if (!tracker_id) {
        return NextResponse.json(
          { error: '缺少 tracker_id 参数' },
          { status: 400 }
        );
      }
      if (!kpi_id) {
        return NextResponse.json(
          { error: '缺少 kpi_id 参数' },
          { status: 400 }
        );
      }

      // 尝试数据库
      const supabase = await getDb();
      if (supabase) {
        try {
          const { data: row, error } = await supabase
            .from('performance_trackers')
            .select('*')
            .eq('id', tracker_id)
            .single();
          if (error) throw error;
          if (!row) {
            return NextResponse.json({ error: '履约追踪记录不存在' }, { status: 404 });
          }
          const updated = updateKpiInTracker(row as PerformanceTracker, kpi_id, {
            actual: actual !== undefined ? Number(actual) : undefined,
            status,
            trend,
          });
          const { error: updErr } = await supabase
            .from('performance_trackers')
            .update({ kpis: updated.kpis, status: updated.status })
            .eq('id', tracker_id);
          if (updErr) throw updErr;
          const allTrackers = await fetchTrackersFromDb(supabase);
          return NextResponse.json({
            tracker: updated,
            trackers: allTrackers,
            stats: getPerformanceStats(allTrackers),
            mock: false,
          });
        } catch (dbErr) {
          console.error('Performance update_kpi DB error, falling back to mock:', dbErr);
        }
      }

      // 降级：内存
      const idx = trackersStore.findIndex((t) => t.id === tracker_id);
      if (idx < 0) {
        return NextResponse.json({ error: '履约追踪记录不存在' }, { status: 404 });
      }
      trackersStore[idx] = updateKpiInTracker(trackersStore[idx], kpi_id, {
        actual: actual !== undefined ? Number(actual) : undefined,
        status,
        trend,
      });
      return NextResponse.json({
        tracker: trackersStore[idx],
        trackers: trackersStore,
        stats: getPerformanceStats(trackersStore),
        mock: true,
      });
    }

    // ===== 更新义务 =====
    if (action === 'update_obligation') {
      const { tracker_id, obligation_id, status, evidence } = body;
      if (!tracker_id) {
        return NextResponse.json(
          { error: '缺少 tracker_id 参数' },
          { status: 400 }
        );
      }
      if (!obligation_id) {
        return NextResponse.json(
          { error: '缺少 obligation_id 参数' },
          { status: 400 }
        );
      }

      // 尝试数据库
      const supabase = await getDb();
      if (supabase) {
        try {
          const { data: row, error } = await supabase
            .from('performance_trackers')
            .select('*')
            .eq('id', tracker_id)
            .single();
          if (error) throw error;
          if (!row) {
            return NextResponse.json({ error: '履约追踪记录不存在' }, { status: 404 });
          }
          const updated = updateObligationInTracker(row as PerformanceTracker, obligation_id, {
            status,
            evidence,
          });
          const { error: updErr } = await supabase
            .from('performance_trackers')
            .update({ obligations: updated.obligations, status: updated.status })
            .eq('id', tracker_id);
          if (updErr) throw updErr;
          const allTrackers = await fetchTrackersFromDb(supabase);
          return NextResponse.json({
            tracker: updated,
            trackers: allTrackers,
            stats: getPerformanceStats(allTrackers),
            mock: false,
          });
        } catch (dbErr) {
          console.error('Performance update_obligation DB error, falling back to mock:', dbErr);
        }
      }

      // 降级：内存
      const idx = trackersStore.findIndex((t) => t.id === tracker_id);
      if (idx < 0) {
        return NextResponse.json({ error: '履约追踪记录不存在' }, { status: 404 });
      }
      trackersStore[idx] = updateObligationInTracker(trackersStore[idx], obligation_id, {
        status,
        evidence,
      });
      return NextResponse.json({
        tracker: trackersStore[idx],
        trackers: trackersStore,
        stats: getPerformanceStats(trackersStore),
        mock: true,
      });
    }

    // ===== 添加预警 =====
    if (action === 'add_alert') {
      const { tracker_id, type, severity, message } = body;
      if (!tracker_id) {
        return NextResponse.json(
          { error: '缺少 tracker_id 参数' },
          { status: 400 }
        );
      }
      const alert = {
        id: `al-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: type || 'deadline_approaching',
        severity: severity || 'info',
        message: message || '',
        timestamp: new Date().toISOString(),
      };

      // 尝试数据库
      const supabase = await getDb();
      if (supabase) {
        try {
          const { data: row, error } = await supabase
            .from('performance_trackers')
            .select('*')
            .eq('id', tracker_id)
            .single();
          if (error) throw error;
          if (!row) {
            return NextResponse.json({ error: '履约追踪记录不存在' }, { status: 404 });
          }
          const tracker = row as PerformanceTracker;
          const updated = {
            ...tracker,
            alerts: [...tracker.alerts, alert],
          };
          const { error: updErr } = await supabase
            .from('performance_trackers')
            .update({ alerts: updated.alerts })
            .eq('id', tracker_id);
          if (updErr) throw updErr;
          const allTrackers = await fetchTrackersFromDb(supabase);
          return NextResponse.json({
            tracker: updated,
            trackers: allTrackers,
            stats: getPerformanceStats(allTrackers),
            mock: false,
          });
        } catch (dbErr) {
          console.error('Performance add_alert DB error, falling back to mock:', dbErr);
        }
      }

      // 降级：内存
      const idx = trackersStore.findIndex((t) => t.id === tracker_id);
      if (idx < 0) {
        return NextResponse.json({ error: '履约追踪记录不存在' }, { status: 404 });
      }
      trackersStore[idx] = {
        ...trackersStore[idx],
        alerts: [...trackersStore[idx].alerts, alert],
      };
      return NextResponse.json({
        tracker: trackersStore[idx],
        trackers: trackersStore,
        stats: getPerformanceStats(trackersStore),
        mock: true,
      });
    }

    return NextResponse.json(
      {
        error:
          'action 无效，需为 update_milestone / update_kpi / update_obligation / add_alert',
      },
      { status: 400 }
    );
  } catch (err) {
    console.error('Performance POST error:', err);
    return NextResponse.json(
      { error: `服务器错误: ${err instanceof Error ? err.message : '未知错误'}` },
      { status: 500 }
    );
  }
}
