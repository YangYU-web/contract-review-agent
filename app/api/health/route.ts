// ===== 系统健康监控 API =====
// 返回系统健康仪表盘数据，支持 ?detail=true 返回更详细指标
// 数据存储：服务健康指标（API 网关、CDN、AI 等）使用 lib/system-health 的模拟数据，
// 数据库部分使用真实的 Supabase 探测（对关键表做 count 查询验证连通性与各表状态）

import { NextRequest, NextResponse } from 'next/server';
import {
  getHealthDashboard,
  formatUptime,
  getOverallStatus,
} from '@/lib/system-health';
import {
  SERVICE_STATUS_CONFIG,
  ServiceStatus,
  MetricTrend,
  HealthCheckResult,
} from '@/lib/types';
import { isSupabaseConfigured } from '@/lib/supabase';

// 需要探测的关键表清单
const PROBE_TABLES: string[] = [
  'contracts',
  'contract_risks',
  'contract_lifecycles',
  'approval_flows',
  'team_members',
  'renewal_policies',
  'partner_profiles',
  'pricing_analyses',
  'drafting_projects',
];

// 对 Supabase 关键表做 count 探测，验证数据库连通性与各表记录数
async function probeDatabase(): Promise<{
  connected: boolean;
  responseTime: number;
  tableCounts: Record<string, number | null>;
  error?: string;
}> {
  const tableCounts: Record<string, number | null> = {};

  if (!isSupabaseConfigured()) {
    return { connected: false, responseTime: 0, tableCounts };
  }

  try {
    const { getSupabaseServer } = await import('@/lib/supabase');
    const supabase = getSupabaseServer();
    if (!supabase) {
      return {
        connected: false,
        responseTime: 0,
        tableCounts,
        error: 'Supabase 服务端客户端未配置（缺少 service role key）',
      };
    }

    const start = Date.now();
    const results = await Promise.all(
      PROBE_TABLES.map(async (table) => {
        try {
          const res = await supabase
            .from(table)
            .select('*', { count: 'exact', head: true });
          if (res.error) {
            return { table, count: null, error: res.error.message };
          }
          return { table, count: res.count ?? 0, error: undefined };
        } catch (e) {
          return {
            table,
            count: null,
            error: e instanceof Error ? e.message : String(e),
          };
        }
      })
    );
    const responseTime = Date.now() - start;

    let anyOk = false;
    let firstError: string | undefined;
    let totalRows = 0;
    for (const r of results) {
      tableCounts[r.table] = r.count;
      if (r.count !== null) {
        anyOk = true;
        totalRows += r.count;
      }
      if (r.error && !firstError) firstError = r.error;
    }

    // 将聚合的表记录总数挂到 tableCounts 中，便于响应展示
    tableCounts.__total_rows = anyOk ? totalRows : null;

    return {
      connected: anyOk,
      responseTime,
      tableCounts,
      error: anyOk ? undefined : firstError,
    };
  } catch (e) {
    return {
      connected: false,
      responseTime: 0,
      tableCounts,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

// GET: 返回系统健康仪表盘数据
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const detail = searchParams.get('detail') === 'true';

    const dashboard = getHealthDashboard();
    // 复制一份服务列表以便更新数据库服务条目
    const services: HealthCheckResult[] = dashboard.services.map((s) => ({
      ...s,
      metrics: s.metrics.map((m) => ({ ...m })),
    }));
    const metrics = dashboard.recent_metrics;

    // 真实数据库探测
    const probe = await probeDatabase();
    const dbServiceIdx = services.findIndex(
      (s) => s.id === 'svc-supabase-db'
    );
    if (dbServiceIdx >= 0) {
      const status: ServiceStatus = probe.connected ? 'healthy' : 'down';
      const tableCount = Object.keys(probe.tableCounts).filter(
        (k) => k !== '__total_rows' && probe.tableCounts[k] !== null
      ).length;
      const totalRows = probe.tableCounts.__total_rows ?? 0;
      services[dbServiceIdx] = {
        ...services[dbServiceIdx],
        status,
        response_time: probe.responseTime || services[dbServiceIdx].response_time,
        last_check: new Date().toISOString(),
        last_error: probe.connected
          ? undefined
          : probe.error || '数据库探测失败',
        metrics: [
          {
            label: '响应时间',
            value: `${probe.responseTime || 0}ms`,
            trend: 'stable' as MetricTrend,
          },
          {
            label: '可访问表数',
            value: `${tableCount}/${PROBE_TABLES.length}`,
            trend: 'stable' as MetricTrend,
          },
          {
            label: '总记录数',
            value: `${totalRows}`,
            trend: 'stable' as MetricTrend,
          },
        ],
      };
    }

    // 基于更新后的服务列表重新计算整体状态
    const overall_status = getOverallStatus(services);

    // 基础统计信息
    const stats = {
      total_services: services.length,
      healthy: services.filter((s) => s.status === 'healthy').length,
      degraded: services.filter((s) => s.status === 'degraded').length,
      down: services.filter((s) => s.status === 'down').length,
      maintenance: services.filter((s) => s.status === 'maintenance').length,
      avg_response_time: Math.round(
        services.reduce((sum, s) => sum + s.response_time, 0) / services.length
      ),
      avg_uptime: Number(
        (
          services.reduce((sum, s) => sum + s.uptime, 0) / services.length
        ).toFixed(2)
      ),
    };

    // 最近一次检查时间（取所有服务中最新的检查时间）
    const last_check = services.reduce((latest, s) => {
      const t = new Date(s.last_check).getTime();
      return t > new Date(latest).getTime() ? s.last_check : latest;
    }, services[0]?.last_check || new Date().toISOString());

    // 详细模式下附带近 24 小时指标的摘要统计
    const metricsSummary = detail
      ? {
          points: metrics.length,
          cpu: summarize(metrics.map((m) => m.cpu_usage)),
          memory: summarize(metrics.map((m) => m.memory_usage)),
          disk: summarize(metrics.map((m) => m.disk_usage)),
          requests_per_minute: summarizeInt(
            metrics.map((m) => m.requests_per_minute)
          ),
          error_rate: summarize(metrics.map((m) => m.error_rate)),
          active_users: {
            current: metrics[metrics.length - 1]?.active_users ?? 0,
            avg: Math.round(
              metrics.reduce((s, m) => s + m.active_users, 0) / metrics.length
            ),
          },
        }
      : null;

    return NextResponse.json({
      overall_status,
      overall_label: SERVICE_STATUS_CONFIG[overall_status].label,
      last_check,
      uptime_30d: formatUptime(
        dashboard.uptime_stats.find((u) => u.period === '近 30 天')?.uptime ??
          99.9
      ),
      services,
      stats,
      alerts: dashboard.alerts,
      uptime_stats: dashboard.uptime_stats,
      recent_metrics: metrics,
      metrics_summary: metricsSummary,
      database: {
        connected: probe.connected,
        response_time: probe.responseTime,
        table_counts: probe.tableCounts,
        error: probe.error,
        probed_tables: PROBE_TABLES,
      },
      detail,
      mock: !probe.connected,
    });
  } catch (err) {
    console.error('Health GET error:', err);
    return NextResponse.json(
      { error: `服务器错误: ${err instanceof Error ? err.message : '未知错误'}` },
      { status: 500 }
    );
  }
}

// 计算一组小数指标的平均/最大/最小（保留 1 位小数）
function summarize(values: number[]): {
  avg: number;
  max: number;
  min: number;
} {
  if (values.length === 0) return { avg: 0, max: 0, min: 0 };
  return {
    avg: Number(
      (values.reduce((s, v) => s + v, 0) / values.length).toFixed(1)
    ),
    max: Number(Math.max(...values).toFixed(1)),
    min: Number(Math.min(...values).toFixed(1)),
  };
}

// 计算一组整数指标的平均/最大/最小（整数取整）
function summarizeInt(values: number[]): {
  avg: number;
  max: number;
  min: number;
} {
  if (values.length === 0) return { avg: 0, max: 0, min: 0 };
  return {
    avg: Math.round(values.reduce((s, v) => s + v, 0) / values.length),
    max: Math.max(...values),
    min: Math.min(...values),
  };
}
