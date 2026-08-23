// ===== 审计追踪 API =====
// 提供审计日志列表查询（含筛选）与合规报告，并支持记录新审计日志
// 数据存储：Supabase audit_logs 表，失败时降级为 Mock 数据
// 说明：audit_logs 表字段较精简，actor_name 存入 actor 字段，
//       actor_id / actor_role / contract_title / risk_id / ip_address / user_agent
//       存入 details JSONB 中

import { NextRequest, NextResponse } from 'next/server';
import { AuditAction, AuditLogEntry } from '@/lib/types';
import {
  getMockAuditLogs,
  logAction,
  generateComplianceReport,
  filterLogs,
  AUDIT_ACTION_LABELS,
} from '@/lib/audit-trail';

// 将数据库行映射为 AuditLogEntry 类型
function mapRow(row: any): AuditLogEntry {
  const details = row.details || {};
  return {
    id: row.id,
    action: row.action,
    actor_id: details.actor_id || '',
    actor_name: row.actor || details.actor_name || '',
    actor_role: details.actor_role || '',
    contract_id: row.contract_id || details.contract_id || undefined,
    contract_title: details.contract_title || undefined,
    risk_id: details.risk_id || undefined,
    details: details.details || details || {},
    ip_address: details.ip_address || undefined,
    user_agent: details.user_agent || undefined,
    timestamp: row.created_at,
  };
}

// 将 AuditLogEntry 映射为数据库插入数据
function mapEntryToInsert(entry: AuditLogEntry): Record<string, any> {
  const insertData: Record<string, any> = {
    action: entry.action,
    actor: entry.actor_name || 'system',
    details: {
      ...entry.details,
      actor_id: entry.actor_id,
      actor_role: entry.actor_role,
      contract_title: entry.contract_title,
      risk_id: entry.risk_id,
      ip_address: entry.ip_address,
      user_agent: entry.user_agent,
    },
  };
  if (entry.contract_id) {
    insertData.contract_id = entry.contract_id;
  }
  return insertData;
}

// 有效的操作类型集合
const VALID_ACTIONS: AuditAction[] = Object.keys(
  AUDIT_ACTION_LABELS
) as AuditAction[];

// GET: 返回审计日志列表（支持筛选）或合规报告
// 查询参数：action / actor_id / start_date / end_date / report
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const report = searchParams.get('report');
    const action = searchParams.get('action') as AuditAction | null;
    const actorId = searchParams.get('actor_id');
    const startDate = searchParams.get('start_date') || undefined;
    const endDate = searchParams.get('end_date') || undefined;

    // 参数校验
    if (action && !VALID_ACTIONS.includes(action)) {
      return NextResponse.json(
        { error: `action 无效，需为 ${VALID_ACTIONS.join(' / ')}` },
        { status: 400 }
      );
    }

    // 尝试使用 Supabase
    try {
      const { getSupabaseServer } = await import('@/lib/supabase');
      const supabase = getSupabaseServer();
      if (supabase) {
        let query = supabase.from('audit_logs').select('*');

        if (action) {
          query = query.eq('action', action);
        }

        const { data, error } = await query.order('created_at', { ascending: false });

        if (error) throw error;

        let logs: AuditLogEntry[] = (data || []).map(mapRow);

        // ?report=true 返回合规报告（基于全量日志）
        if (report === 'true') {
          // 需要全量日志来生成报告，忽略 action 筛选
          const { data: allData, error: allError } = await supabase
            .from('audit_logs')
            .select('*')
            .order('created_at', { ascending: false });
          if (allError) throw allError;

          const allLogs: AuditLogEntry[] = (allData || []).map(mapRow);
          const complianceReport = generateComplianceReport(allLogs);
          return NextResponse.json({
            report: complianceReport,
            mock: false,
          });
        }

        // 在 JS 中进一步筛选（actor_id, 日期范围存储在 details JSONB 中）
        logs = filterLogs(logs, {
          action: action || undefined,
          actorId: actorId || undefined,
          startDate,
          endDate,
        });

        // 按时间倒序
        const sorted = [...logs].sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );

        return NextResponse.json({
          logs: sorted,
          total: sorted.length,
          mock: false,
        });
      }
    } catch (dbErr) {
      console.error('Audit DB query failed, falling back to mock:', dbErr);
    }

    // 降级：使用内存 Mock 数据
    const mockLogs = getMockAuditLogs();

    if (report === 'true') {
      const complianceReport = generateComplianceReport(mockLogs);
      return NextResponse.json({
        report: complianceReport,
        mock: true,
      });
    }

    const filtered = filterLogs(mockLogs, {
      action: action || undefined,
      actorId: actorId || undefined,
      startDate,
      endDate,
    });

    const sorted = [...filtered].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return NextResponse.json({
      logs: sorted,
      total: sorted.length,
      mock: true,
    });
  } catch (err) {
    console.error('Audit GET error:', err);
    return NextResponse.json(
      { error: `服务器错误: ${err instanceof Error ? err.message : '未知错误'}` },
      { status: 500 }
    );
  }
}

// POST: 记录新审计日志
// 请求体：{ action, actor_id, actor_name, actor_role, details, contract_id?, contract_title? }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      action,
      actor_id,
      actor_name,
      actor_role,
      details,
      contract_id,
      contract_title,
    } = body;

    // 参数校验
    if (!action || !VALID_ACTIONS.includes(action)) {
      return NextResponse.json(
        { error: `action 无效，需为 ${VALID_ACTIONS.join(' / ')}` },
        { status: 400 }
      );
    }
    if (!actor_id || !actor_name || !actor_role) {
      return NextResponse.json(
        { error: '缺少 actor_id / actor_name / actor_role 参数' },
        { status: 400 }
      );
    }

    // 使用 logAction 构造完整条目（保持与原有逻辑一致）
    const entry = logAction(
      action,
      actor_id,
      actor_name,
      actor_role,
      details || {},
      contract_id || undefined,
      contract_title || undefined
    );

    // 尝试使用 Supabase
    try {
      const { getSupabaseServer } = await import('@/lib/supabase');
      const supabase = getSupabaseServer();
      if (supabase) {
        const insertData = mapEntryToInsert(entry);

        const { data, error } = await supabase
          .from('audit_logs')
          .insert(insertData)
          .select('*')
          .single();

        if (error) throw error;

        // 返回映射后的条目（使用 DB 生成的 id 与时间）
        const dbEntry = mapRow(data);

        return NextResponse.json({
          log: dbEntry,
          mock: false,
        });
      }
    } catch (dbErr) {
      console.error('Audit DB insert failed, falling back to mock:', dbErr);
    }

    // 降级：返回内存构造的条目
    return NextResponse.json({
      log: entry,
      mock: true,
    });
  } catch (err) {
    console.error('Audit POST error:', err);
    return NextResponse.json(
      { error: `服务器错误: ${err instanceof Error ? err.message : '未知错误'}` },
      { status: 500 }
    );
  }
}
