// ===== 风险趋势预警 API =====
// 提供预警列表与趋势数据的查询，以及预警状态的确认 / 解决
// 数据存储：Supabase risk_alerts 表，失败时降级为 Mock 数据

import { NextRequest, NextResponse } from 'next/server';
import {
  RiskAlert,
  AlertStatus,
  RiskTrendData,
} from '@/lib/types';
import {
  getMockAlerts,
  getMockTrendData,
  sortAlerts,
} from '@/lib/risk-alerts';

// 将数据库行映射为 RiskAlert 类型
function mapRow(row: any): RiskAlert {
  return {
    id: row.id,
    severity: row.severity,
    status: row.status,
    title: row.title,
    description: row.description || '',
    contract_id: row.contract_id || undefined,
    contract_title: row.contract_title || undefined,
    metric: row.metric,
    threshold: Number(row.threshold) || 0,
    current_value: Number(row.current_value) || 0,
    trend: row.trend || 'stable',
    created_at: row.created_at,
    resolved_at: row.resolved_at || undefined,
  };
}

// 计算统计信息
function computeStats(alerts: RiskAlert[]) {
  return {
    total: alerts.length,
    critical: alerts.filter((a) => a.severity === 'critical').length,
    warning: alerts.filter((a) => a.severity === 'warning').length,
    info: alerts.filter((a) => a.severity === 'info').length,
    active: alerts.filter((a) => a.status === 'active').length,
    acknowledged: alerts.filter((a) => a.status === 'acknowledged').length,
    resolved: alerts.filter((a) => a.status === 'resolved').length,
  };
}

// GET: 返回预警列表与趋势数据
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as AlertStatus | null;
    const severity = searchParams.get('severity');

    // 趋势数据为只读 Mock 数据（无对应数据库表）
    const trend: RiskTrendData[] = getMockTrendData();

    // 尝试使用 Supabase
    try {
      const { getSupabaseServer } = await import('@/lib/supabase');
      const supabase = getSupabaseServer();
      if (supabase) {
        let query = supabase.from('risk_alerts').select('*');

        if (status) {
          query = query.eq('status', status);
        }
        if (severity) {
          query = query.eq('severity', severity);
        }

        const { data, error } = await query;

        if (error) throw error;

        const allAlerts: RiskAlert[] = (data || []).map(mapRow);
        const list = sortAlerts(allAlerts);
        const stats = computeStats(allAlerts);

        return NextResponse.json({
          alerts: list,
          trend,
          stats,
          mock: false,
        });
      }
    } catch (dbErr) {
      console.error('Alerts DB query failed, falling back to mock:', dbErr);
    }

    // 降级：使用内存 Mock 数据
    let list = getMockAlerts();
    if (status) {
      list = list.filter((a) => a.status === status);
    }
    if (severity) {
      list = list.filter((a) => a.severity === severity);
    }
    list = sortAlerts(list);
    const stats = computeStats(getMockAlerts());

    return NextResponse.json({
      alerts: list,
      trend,
      stats,
      mock: true,
    });
  } catch (err) {
    console.error('Alerts GET error:', err);
    return NextResponse.json(
      { error: `服务器错误: ${err instanceof Error ? err.message : '未知错误'}` },
      { status: 500 }
    );
  }
}

// POST: 确认 / 解决预警
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, alert_id } = body;

    if (!alert_id) {
      return NextResponse.json({ error: '缺少 alert_id 参数' }, { status: 400 });
    }

    // regenerate：重新查询数据库返回当前预警列表
    if (action === 'regenerate') {
      try {
        const { getSupabaseServer } = await import('@/lib/supabase');
        const supabase = getSupabaseServer();
        if (supabase) {
          const { data, error } = await supabase
            .from('risk_alerts')
            .select('*');
          if (error) throw error;
          const allAlerts: RiskAlert[] = (data || []).map(mapRow);
          return NextResponse.json({
            alerts: sortAlerts(allAlerts),
            mock: false,
          });
        }
      } catch (dbErr) {
        console.error('Alerts DB regenerate failed, falling back to mock:', dbErr);
      }

      return NextResponse.json({
        alerts: sortAlerts(getMockAlerts()),
        mock: true,
      });
    }

    if (action !== 'acknowledge' && action !== 'resolve') {
      return NextResponse.json(
        { error: 'action 必须为 acknowledge 或 resolve' },
        { status: 400 }
      );
    }

    const nextStatus: AlertStatus =
      action === 'acknowledge' ? 'acknowledged' : 'resolved';
    const now = new Date().toISOString();
    const updateData: Record<string, any> = { status: nextStatus };
    if (action === 'resolve') {
      updateData.resolved_at = now;
    }

    // 尝试使用 Supabase
    try {
      const { getSupabaseServer } = await import('@/lib/supabase');
      const supabase = getSupabaseServer();
      if (supabase) {
        const { data: updated, error: updateError } = await supabase
          .from('risk_alerts')
          .update(updateData)
          .eq('id', alert_id)
          .select('*')
          .single();

        if (updateError) {
          if (updateError.code === 'PGRST116') {
            return NextResponse.json({ error: '预警不存在' }, { status: 404 });
          }
          throw updateError;
        }

        // 查询全量列表用于返回
        const { data: allData, error: allError } = await supabase
          .from('risk_alerts')
          .select('*');
        if (allError) throw allError;

        const allAlerts: RiskAlert[] = (allData || []).map(mapRow);

        return NextResponse.json({
          alert: mapRow(updated),
          alerts: sortAlerts(allAlerts),
          mock: false,
        });
      }
    } catch (dbErr) {
      console.error('Alerts DB update failed, falling back to mock:', dbErr);
    }

    // 降级：使用内存 Mock 数据
    const mockAlerts = getMockAlerts();
    const idx = mockAlerts.findIndex((a) => a.id === alert_id);
    if (idx < 0) {
      return NextResponse.json({ error: '预警不存在' }, { status: 404 });
    }

    const updatedAlert: RiskAlert = {
      ...mockAlerts[idx],
      status: nextStatus,
      resolved_at: action === 'resolve' ? now : mockAlerts[idx].resolved_at,
    };

    return NextResponse.json({
      alert: updatedAlert,
      alerts: sortAlerts(mockAlerts),
      mock: true,
    });
  } catch (err) {
    console.error('Alerts POST error:', err);
    return NextResponse.json(
      { error: `服务器错误: ${err instanceof Error ? err.message : '未知错误'}` },
      { status: 500 }
    );
  }
}
