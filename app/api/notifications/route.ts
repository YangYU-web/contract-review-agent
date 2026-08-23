// ===== 邮件通知 API =====
// 提供通知列表与统计查询，以及创建并发送通知
// 数据存储：Supabase email_notifications 表，失败时降级为 Mock 数据

import { NextRequest, NextResponse } from 'next/server';
import {
  EmailNotification,
  NotificationEventType,
} from '@/lib/types';
import {
  getMockNotifications,
  generateNotificationContent,
  sendNotification,
  getNotificationStats,
} from '@/lib/notifications';

// 将数据库行映射为 EmailNotification 类型
function mapRow(row: any): EmailNotification {
  return {
    id: row.id,
    event_type: row.event_type,
    recipient: row.recipient,
    recipient_name: row.recipient_name || '',
    subject: row.subject,
    body: row.body || '',
    contract_id: row.contract_id || undefined,
    contract_title: row.contract_title || undefined,
    sent: row.sent ?? false,
    sent_at: row.sent_at || undefined,
    created_at: row.created_at,
  };
}

// 有效的事件类型集合
const VALID_EVENTS: NotificationEventType[] = [
  'review_completed',
  'high_risk_detected',
  'approval_required',
  'approval_completed',
  'contract_expiring',
  'comment_received',
];

// GET: 返回通知列表与统计
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const eventType = searchParams.get('event_type') as NotificationEventType | null;
    const status = searchParams.get('status'); // 'sent' | 'pending'

    // 尝试使用 Supabase
    try {
      const { getSupabaseServer } = await import('@/lib/supabase');
      const supabase = getSupabaseServer();
      if (supabase) {
        let query = supabase
          .from('email_notifications')
          .select('*')
          .order('created_at', { ascending: false });

        if (eventType) {
          query = query.eq('event_type', eventType);
        }
        if (status === 'sent') {
          query = query.eq('sent', true);
        } else if (status === 'pending') {
          query = query.eq('sent', false);
        }

        const { data, error } = await query;

        if (error) throw error;

        const list: EmailNotification[] = (data || []).map(mapRow);
        const stats = getNotificationStats(list);

        return NextResponse.json({
          notifications: list,
          stats,
          mock: false,
        });
      }
    } catch (dbErr) {
      console.error('Notifications DB query failed, falling back to mock:', dbErr);
    }

    // 降级：使用内存 Mock 数据
    let list = getMockNotifications();
    if (eventType) {
      list = list.filter((n) => n.event_type === eventType);
    }
    if (status === 'sent') {
      list = list.filter((n) => n.sent);
    } else if (status === 'pending') {
      list = list.filter((n) => !n.sent);
    }
    list = [...list].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    const stats = getNotificationStats(getMockNotifications());

    return NextResponse.json({
      notifications: list,
      stats,
      mock: true,
    });
  } catch (err) {
    console.error('Notifications GET error:', err);
    return NextResponse.json(
      { error: `服务器错误: ${err instanceof Error ? err.message : '未知错误'}` },
      { status: 500 }
    );
  }
}

// POST: 创建并"发送"通知
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      event_type,
      recipient,
      contract_id,
      contract_title,
      details,
    } = body;

    // 参数校验
    if (!event_type || !VALID_EVENTS.includes(event_type)) {
      return NextResponse.json(
        { error: 'event_type 无效，需为 review_completed / high_risk_detected / approval_required / approval_completed / contract_expiring / comment_received' },
        { status: 400 }
      );
    }
    if (!recipient) {
      return NextResponse.json(
        { error: '缺少 recipient 参数' },
        { status: 400 }
      );
    }

    const title = contract_title || contract_id || '未命名合同';
    const { subject, body: mailBody } = generateNotificationContent(
      event_type,
      title,
      details
    );

    // 收件人名称：取邮箱 @ 前部分
    const recipientName =
      body.recipient_name || recipient.split('@')[0] || '收件人';

    const now = new Date().toISOString();

    // 模拟发送
    const ok = sendNotification({
      id: '',
      event_type,
      recipient,
      recipient_name: recipientName,
      subject,
      body: mailBody,
      sent: false,
      created_at: now,
    });

    // 尝试使用 Supabase
    try {
      const { getSupabaseServer } = await import('@/lib/supabase');
      const supabase = getSupabaseServer();
      if (supabase) {
        const insertData: Record<string, any> = {
          event_type,
          recipient,
          recipient_name: recipientName,
          subject,
          body: mailBody,
          sent: ok,
          sent_at: ok ? now : null,
        };
        if (contract_id) insertData.contract_id = contract_id;
        if (contract_title) insertData.contract_title = contract_title;

        const { data, error } = await supabase
          .from('email_notifications')
          .insert(insertData)
          .select('*')
          .single();

        if (error) throw error;

        const notification = mapRow(data);

        // 查询全量统计
        const { data: allData, error: allError } = await supabase
          .from('email_notifications')
          .select('*');
        if (allError) throw allError;

        const stats = getNotificationStats((allData || []).map(mapRow));

        return NextResponse.json({
          notification,
          stats,
          mock: false,
        });
      }
    } catch (dbErr) {
      console.error('Notifications DB insert failed, falling back to mock:', dbErr);
    }

    // 降级：使用内存 Mock 数据
    const notification: EmailNotification = {
      id: `ntf-${crypto.randomUUID().slice(0, 8)}`,
      event_type,
      recipient,
      recipient_name: recipientName,
      subject,
      body: mailBody,
      contract_id: contract_id || undefined,
      contract_title: contract_title || undefined,
      sent: ok,
      sent_at: ok ? now : undefined,
      created_at: now,
    };

    const mockList = getMockNotifications();
    mockList.unshift(notification);
    const stats = getNotificationStats(mockList);

    return NextResponse.json({
      notification,
      stats,
      mock: true,
    });
  } catch (err) {
    console.error('Notifications POST error:', err);
    return NextResponse.json(
      { error: `服务器错误: ${err instanceof Error ? err.message : '未知错误'}` },
      { status: 500 }
    );
  }
}
