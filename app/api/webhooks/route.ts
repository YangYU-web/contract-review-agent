// ===== Webhook 集成 API =====
// 提供 webhook 列表与投递日志查询，以及 webhook 的增删改与测试
// 数据存储：Supabase webhook_configs 表（配置），投递日志降级为 Mock 数据

export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { WebhookConfig, WebhookDeliveryLog, WebhookEvent } from '@/lib/types';
import {
  createWebhook,
  triggerWebhooks,
  getWebhookStats,
  getStoredDeliveryLogs,
  generateWebhookSignature,
  WEBHOOK_EVENT_LABELS,
} from '@/lib/webhooks';

// 将数据库行映射为 WebhookConfig 类型
function mapRow(row: any): WebhookConfig {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    events: row.events || [],
    secret: row.secret || '',
    status: row.status || 'active',
    last_triggered: row.last_triggered || undefined,
    last_response_status: row.last_response_status ?? undefined,
    success_count: row.success_count ?? 0,
    failure_count: row.failure_count ?? 0,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// 有效的 Webhook 事件集合
const VALID_EVENTS: WebhookEvent[] = Object.keys(
  WEBHOOK_EVENT_LABELS
) as WebhookEvent[];

// 模拟单个 webhook 投递（内联 triggerWebhooks 的核心逻辑）
function simulateDelivery(
  wh: WebhookConfig,
  event: WebhookEvent,
  payload: Record<string, any>
): WebhookDeliveryLog {
  const payloadStr = JSON.stringify(payload);
  const now = new Date().toISOString();

  // 随机响应状态：70% 成功 200，15% 500，15% 408
  const rand = Math.random();
  let responseStatus: number;
  let success: boolean;
  let responseBody: string;
  let durationMs: number;
  if (rand < 0.7) {
    responseStatus = 200;
    success = true;
    responseBody = '{"ok":true,"received":true}';
    durationMs = Math.floor(Math.random() * 300) + 60;
  } else if (rand < 0.85) {
    responseStatus = 500;
    success = false;
    responseBody = '{"error":"internal_server_error"}';
    durationMs = Math.floor(Math.random() * 600) + 400;
  } else {
    responseStatus = 408;
    success = false;
    responseBody = 'Request Timeout';
    durationMs = 5000;
  }

  const signature = generateWebhookSignature(wh.secret, payloadStr);

  return {
    id: `dl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    webhook_id: wh.id,
    webhook_name: wh.name,
    event,
    payload: { ...payload, _signature: signature },
    response_status: responseStatus,
    response_body: responseBody,
    duration_ms: durationMs,
    success,
    timestamp: now,
  };
}

// 更新 DB 中的 webhook 统计信息
async function updateWebhookStats(
  supabase: any,
  whId: string,
  success: boolean,
  responseStatus: number
): Promise<void> {
  // 读取当前统计
  const { data: current } = await supabase
    .from('webhook_configs')
    .select('success_count, failure_count, status')
    .eq('id', whId)
    .single();

  const successCount = (current?.success_count ?? 0) + (success ? 1 : 0);
  const failureCount = (current?.failure_count ?? 0) + (success ? 0 : 1);
  const now = new Date().toISOString();

  // 连续失败超过 3 次标记为 failing；成功则恢复 active
  let status = current?.status || 'active';
  if (failureCount - successCount > 3 || failureCount >= 5) {
    status = 'failing';
  } else if (success && status === 'failing') {
    status = 'active';
  }

  await supabase
    .from('webhook_configs')
    .update({
      success_count: successCount,
      failure_count: failureCount,
      last_triggered: now,
      last_response_status: responseStatus,
      status,
      updated_at: now,
    })
    .eq('id', whId);
}

// GET: 返回 webhook 列表与投递日志
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const logsLimit = searchParams.get('logs_limit');
    const limit = logsLimit ? Math.max(0, parseInt(logsLimit, 10) || 10) : 10;

    // 尝试使用 Supabase 读取 webhook 配置
    let webhooks: WebhookConfig[] | null = null;
    try {
      const { getSupabaseServer } = await import('@/lib/supabase');
      const supabase = getSupabaseServer();
      if (supabase) {
        const { data, error } = await supabase
          .from('webhook_configs')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;

        webhooks = (data || []).map(mapRow);
      }
    } catch (dbErr) {
      console.error('Webhooks DB query failed, falling back to mock:', dbErr);
    }

    // 投递日志无对应数据库表，使用 Mock 数据
    const deliveryLogs = getStoredDeliveryLogs(limit);

    if (webhooks) {
      const stats = getWebhookStats(webhooks);
      return NextResponse.json({
        webhooks,
        deliveryLogs,
        stats,
        events: WEBHOOK_EVENT_LABELS,
        mock: false,
      });
    }

    // 降级：使用内存 Mock 数据
    const { getStoredWebhooks } = await import('@/lib/webhooks');
    const mockWebhooks = getStoredWebhooks();
    const stats = getWebhookStats(mockWebhooks);

    return NextResponse.json({
      webhooks: mockWebhooks,
      deliveryLogs,
      stats,
      events: WEBHOOK_EVENT_LABELS,
      mock: true,
    });
  } catch (err) {
    console.error('Webhooks GET error:', err);
    return NextResponse.json(
      { error: `服务器错误: ${err instanceof Error ? err.message : '未知错误'}` },
      { status: 500 }
    );
  }
}

// POST: 管理 webhook（create / update / delete / test）
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (!action || !['create', 'update', 'delete', 'test'].includes(action)) {
      return NextResponse.json(
        { error: 'action 无效，需为 create / update / delete / test' },
        { status: 400 }
      );
    }

    // ===== 创建 webhook =====
    if (action === 'create') {
      const { name, url, events, secret } = body;
      if (!name || !url || !Array.isArray(events) || events.length === 0) {
        return NextResponse.json(
          { error: '缺少必要参数：name / url / events（至少订阅一个事件）' },
          { status: 400 }
        );
      }
      const invalidEvents = events.filter(
        (e: string) => !VALID_EVENTS.includes(e as WebhookEvent)
      );
      if (invalidEvents.length > 0) {
        return NextResponse.json(
          { error: `events 包含无效值: ${invalidEvents.join(', ')}` },
          { status: 400 }
        );
      }

      // 尝试使用 Supabase
      try {
        const { getSupabaseServer } = await import('@/lib/supabase');
        const supabase = getSupabaseServer();
        if (supabase) {
          const { data, error } = await supabase
            .from('webhook_configs')
            .insert({
              name,
              url,
              events,
              secret: secret || '',
              status: 'active',
              success_count: 0,
              failure_count: 0,
            })
            .select('*')
            .single();

          if (error) throw error;

          return NextResponse.json({
            webhook: mapRow(data),
            mock: false,
          });
        }
      } catch (dbErr) {
        console.error('Webhooks DB create failed, falling back to mock:', dbErr);
      }

      // 降级：使用内存 Mock 数据
      const wh = createWebhook(
        name,
        url,
        events as WebhookEvent[],
        secret || ''
      );
      return NextResponse.json({
        webhook: wh,
        mock: true,
      });
    }

    // ===== 更新 webhook =====
    if (action === 'update') {
      const { id, name, url, events, secret, status } = body;
      if (!id) {
        return NextResponse.json(
          { error: '缺少 id 参数' },
          { status: 400 }
        );
      }
      const updates: Partial<WebhookConfig> = {};
      if (name) updates.name = name;
      if (url) updates.url = url;
      if (Array.isArray(events)) {
        const invalidEvents = events.filter(
          (e: string) => !VALID_EVENTS.includes(e as WebhookEvent)
        );
        if (invalidEvents.length > 0) {
          return NextResponse.json(
            { error: `events 包含无效值: ${invalidEvents.join(', ')}` },
            { status: 400 }
          );
        }
        updates.events = events as WebhookEvent[];
      }
      if (secret) updates.secret = secret;
      if (status && ['active', 'inactive', 'failing'].includes(status)) {
        updates.status = status as any;
      }

      // 尝试使用 Supabase
      try {
        const { getSupabaseServer } = await import('@/lib/supabase');
        const supabase = getSupabaseServer();
        if (supabase) {
          const { data, error } = await supabase
            .from('webhook_configs')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select('*')
            .single();

          if (error) {
            if (error.code === 'PGRST116') {
              return NextResponse.json(
                { error: `未找到 id 为 ${id} 的 webhook` },
                { status: 404 }
              );
            }
            throw error;
          }

          return NextResponse.json({
            webhook: mapRow(data),
            mock: false,
          });
        }
      } catch (dbErr) {
        console.error('Webhooks DB update failed, falling back to mock:', dbErr);
      }

      // 降级：使用内存 Mock 数据
      const { updateStoredWebhook } = await import('@/lib/webhooks');
      const updated = updateStoredWebhook(id, updates);
      if (!updated) {
        return NextResponse.json(
          { error: `未找到 id 为 ${id} 的 webhook` },
          { status: 404 }
        );
      }
      return NextResponse.json({
        webhook: updated,
        mock: true,
      });
    }

    // ===== 删除 webhook =====
    if (action === 'delete') {
      const { id } = body;
      if (!id) {
        return NextResponse.json(
          { error: '缺少 id 参数' },
          { status: 400 }
        );
      }

      // 尝试使用 Supabase
      try {
        const { getSupabaseServer } = await import('@/lib/supabase');
        const supabase = getSupabaseServer();
        if (supabase) {
          const { error, count } = await supabase
            .from('webhook_configs')
            .delete({ count: 'exact' })
            .eq('id', id);

          if (error) throw error;

          if (count === 0) {
            return NextResponse.json(
              { error: `未找到 id 为 ${id} 的 webhook` },
              { status: 404 }
            );
          }

          return NextResponse.json({
            deleted: true,
            id,
            mock: false,
          });
        }
      } catch (dbErr) {
        console.error('Webhooks DB delete failed, falling back to mock:', dbErr);
      }

      // 降级：使用内存 Mock 数据
      const { deleteStoredWebhook } = await import('@/lib/webhooks');
      const ok = deleteStoredWebhook(id);
      if (!ok) {
        return NextResponse.json(
          { error: `未找到 id 为 ${id} 的 webhook` },
          { status: 404 }
        );
      }
      return NextResponse.json({
        deleted: true,
        id,
        mock: true,
      });
    }

    // ===== 测试 webhook =====
    if (action === 'test') {
      const { event, webhook_id, payload } = body;
      const testEvent: WebhookEvent = event || 'review.completed';
      if (!VALID_EVENTS.includes(testEvent)) {
        return NextResponse.json(
          { error: `event 无效，需为 ${VALID_EVENTS.join(' / ')}` },
          { status: 400 }
        );
      }
      const testPayload = payload || {
        test: true,
        message: 'webhook 测试事件',
        triggered_by: 'webhook-manager',
        timestamp: new Date().toISOString(),
      };

      // 尝试使用 Supabase
      try {
        const { getSupabaseServer } = await import('@/lib/supabase');
        const supabase = getSupabaseServer();
        if (supabase) {
          // 读取需要触发的 webhook
          let targetWebhooks: WebhookConfig[] = [];
          if (webhook_id) {
            const { data, error } = await supabase
              .from('webhook_configs')
              .select('*')
              .eq('id', webhook_id)
              .single();
            if (error || !data) {
              return NextResponse.json(
                {
                  error: `该 webhook 未订阅事件 ${testEvent}，或不存在`,
                  event: testEvent,
                  mock: false,
                },
                { status: 400 }
              );
            }
            const wh = mapRow(data);
            if (!wh.events.includes(testEvent)) {
              return NextResponse.json(
                {
                  error: `该 webhook 未订阅事件 ${testEvent}，或不存在`,
                  event: testEvent,
                  mock: false,
                },
                { status: 400 }
              );
            }
            targetWebhooks = [wh];
          } else {
            // 触发所有订阅该事件的 webhook
            const { data, error } = await supabase
              .from('webhook_configs')
              .select('*');
            if (error) throw error;
            targetWebhooks = (data || [])
              .map(mapRow)
              .filter((wh: WebhookConfig) => wh.events.includes(testEvent));
          }

          // 模拟投递并更新统计
          const logs: WebhookDeliveryLog[] = [];
          for (const wh of targetWebhooks) {
            const log = simulateDelivery(wh, testEvent, testPayload);
            logs.push(log);
            await updateWebhookStats(
              supabase,
              wh.id,
              log.success,
              log.response_status
            );
          }

          return NextResponse.json({
            event: testEvent,
            deliveries: logs,
            mock: false,
          });
        }
      } catch (dbErr) {
        console.error('Webhooks DB test failed, falling back to mock:', dbErr);
      }

      // 降级：使用内存 Mock 数据（triggerWebhooks 操作内存存储）
      let logs;
      if (webhook_id) {
        const all = triggerWebhooks(testEvent, testPayload);
        logs = all.filter((l) => l.webhook_id === webhook_id);
        if (logs.length === 0) {
          return NextResponse.json(
            {
              error: `该 webhook 未订阅事件 ${testEvent}，或不存在`,
              event: testEvent,
              mock: true,
            },
            { status: 400 }
          );
        }
      } else {
        logs = triggerWebhooks(testEvent, testPayload);
      }

      return NextResponse.json({
        event: testEvent,
        deliveries: logs,
        mock: true,
      });
    }

    return NextResponse.json({ error: '未知操作' }, { status: 400 });
  } catch (err) {
    console.error('Webhooks POST error:', err);
    return NextResponse.json(
      { error: `服务器错误: ${err instanceof Error ? err.message : '未知错误'}` },
      { status: 500 }
    );
  }
}
