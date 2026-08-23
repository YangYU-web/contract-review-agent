// ===== 邮件通知模块 =====
// 提供通知的 Mock 数据、邮件内容生成、模拟发送与统计
// 供通知 API 与通知列表组件共用

import {
  EmailNotification,
  NotificationEventType,
  NOTIFICATION_EVENT_LABELS,
} from './types';

// 生成距离今天指定天数的 ISO 时间字符串
function daysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

// 生成距离今天指定小时的 ISO 时间字符串
function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

// ===== Mock 通知数据 =====
// 返回 5-6 条模拟通知，覆盖不同事件类型与发送状态
export function getMockNotifications(): EmailNotification[] {
  return [
    {
      id: 'ntf-001',
      event_type: 'high_risk_detected',
      recipient: 'zhang.lawyer@example.com',
      recipient_name: '张法务',
      subject: '高风险预警 - XX产品采购合同',
      body:
        '合同「XX产品采购合同」在审查中识别出 2 处高风险条款（预付款比例过高、违约金缺失）。请尽快登录系统查看并处理。',
      contract_id: 'mock-001',
      contract_title: 'XX产品采购合同',
      sent: true,
      sent_at: hoursAgo(3),
      created_at: hoursAgo(3),
    },
    {
      id: 'ntf-002',
      event_type: 'approval_required',
      recipient: 'li.manager@example.com',
      recipient_name: '李经理',
      subject: '审批待办 - XX产品采购合同',
      body:
        '合同「XX产品采购合同」已完成审查并触发审批流，风险评分 65 分，需由您进行审批。请登录系统处理。',
      contract_id: 'mock-001',
      contract_title: 'XX产品采购合同',
      sent: true,
      sent_at: hoursAgo(5),
      created_at: hoursAgo(5),
    },
    {
      id: 'ntf-003',
      event_type: 'review_completed',
      recipient: 'wang.business@example.com',
      recipient_name: '王业务',
      subject: '合同审查完成 - IT技术服务协议',
      body:
        '合同「IT技术服务协议」已完成 AI 审查，共识别 4 处风险项，综合风险评分 42 分。请查看审查报告。',
      contract_id: 'mock-002',
      contract_title: 'IT技术服务协议',
      sent: true,
      sent_at: daysAgo(1),
      created_at: daysAgo(1),
    },
    {
      id: 'ntf-004',
      event_type: 'contract_expiring',
      recipient: 'admin@example.com',
      recipient_name: '合同管理员',
      subject: '合同即将到期 - 中关村办公室租赁合同',
      body:
        '合同「中关村办公室租赁合同」将于 25 天后到期，请及时确认是否续签或启动终止流程。',
      contract_id: 'mock-003',
      contract_title: '中关村办公室租赁合同',
      sent: false,
      created_at: hoursAgo(1),
    },
    {
      id: 'ntf-005',
      event_type: 'approval_completed',
      recipient: 'zhang.lawyer@example.com',
      recipient_name: '张法务',
      subject: '审批完成 - IT技术服务协议',
      body:
        '合同「IT技术服务协议」的审批流程已完成，审批结果为通过。可下载最终版本。',
      contract_id: 'mock-002',
      contract_title: 'IT技术服务协议',
      sent: true,
      sent_at: daysAgo(2),
      created_at: daysAgo(2),
    },
    {
      id: 'ntf-006',
      event_type: 'comment_received',
      recipient: 'zhang.lawyer@example.com',
      recipient_name: '张法务',
      subject: '收到评论 - XX产品采购合同',
      body:
        '李经理在合同「XX产品采购合同」的讨论中 @提及了你：「@张法务 请确认预付款比例调整方案」。',
      contract_id: 'mock-001',
      contract_title: 'XX产品采购合同',
      sent: false,
      created_at: hoursAgo(2),
    },
  ];
}

// ===== 生成邮件内容 =====
// 根据事件类型生成邮件主题与正文
export function generateNotificationContent(
  event: NotificationEventType,
  contractTitle: string,
  details?: any
): { subject: string; body: string } {
  const eventLabel = NOTIFICATION_EVENT_LABELS[event] || '通知';
  const riskScore: number | undefined = details?.risk_score;
  const riskCount: number | undefined = details?.risk_count;
  const highRiskCount: number | undefined = details?.high_risk_count;
  const daysUntilExpiry: number | undefined = details?.days_until_expiry;
  const approverName: string | undefined = details?.approver_name;
  const commentFrom: string | undefined = details?.comment_from;
  const commentText: string | undefined = details?.comment_text;

  switch (event) {
    case 'review_completed': {
      const parts: string[] = [
        `合同「${contractTitle}」已完成 AI 审查。`,
      ];
      if (riskCount !== undefined) {
        parts.push(`共识别 ${riskCount} 处风险项`);
      }
      if (riskScore !== undefined) {
        parts.push(`综合风险评分 ${riskScore} 分`);
      }
      parts.push('请登录系统查看审查报告。');
      return {
        subject: `合同审查完成 - ${contractTitle}`,
        body: parts.join('，'),
      };
    }
    case 'high_risk_detected': {
      const parts: string[] = [
        `合同「${contractTitle}」在审查中识别出${highRiskCount ?? '多处'}高风险条款`,
      ];
      if (riskScore !== undefined) {
        parts.push(`综合风险评分 ${riskScore} 分`);
      }
      parts.push('请尽快登录系统查看并处理。');
      return {
        subject: `高风险预警 - ${contractTitle}`,
        body: parts.join('，'),
      };
    }
    case 'approval_required': {
      const parts: string[] = [
        `合同「${contractTitle}」已完成审查并触发审批流`,
      ];
      if (riskScore !== undefined) {
        parts.push(`风险评分 ${riskScore} 分`);
      }
      parts.push('需由您进行审批，请登录系统处理。');
      return {
        subject: `审批待办 - ${contractTitle}`,
        body: parts.join('，'),
      };
    }
    case 'approval_completed': {
      const decision: string = details?.decision === 'rejected' ? '驳回' : '通过';
      const parts: string[] = [
        `合同「${contractTitle}」的审批流程已完成，审批结果为${decision}。`,
      ];
      if (approverName) {
        parts.push(`审批人：${approverName}。`);
      }
      parts.push('可登录系统查看详情。');
      return {
        subject: `审批完成 - ${contractTitle}`,
        body: parts.join(''),
      };
    }
    case 'contract_expiring': {
      const days =
        daysUntilExpiry !== undefined ? `${daysUntilExpiry} 天后` : '即将';
      return {
        subject: `合同即将到期 - ${contractTitle}`,
        body: `合同「${contractTitle}」${days}到期，请及时确认是否续签或启动终止流程。`,
      };
    }
    case 'comment_received': {
      const from = commentFrom || '团队成员';
      const text = commentText
        ? `：「${commentText}」`
        : '';
      return {
        subject: `收到评论 - ${contractTitle}`,
        body: `${from}在合同「${contractTitle}」的讨论中提及了你${text}，请及时查看并回复。`,
      };
    }
    default: {
      return {
        subject: `${eventLabel} - ${contractTitle}`,
        body: `合同「${contractTitle}」触发了${eventLabel}事件，请登录系统查看。`,
      };
    }
  }
}

// ===== 模拟发送邮件 =====
// 真实场景中应集成 SMTP / 邮件服务商 SDK
export function sendNotification(
  notification: EmailNotification
): boolean {
  // 模拟网络偶发失败（10% 概率失败），便于演示待发送状态
  const ok = Math.random() > 0.1;
  if (!ok) {
    return false;
  }
  // 实际项目中这里应调用邮件发送服务，此处仅返回成功
  return ok;
}

// ===== 通知统计 =====
export function getNotificationStats(notifications: EmailNotification[]): {
  total: number;
  sent: number;
  pending: number;
  byEvent: Record<NotificationEventType, number>;
} {
  const eventTypes: NotificationEventType[] = [
    'review_completed',
    'high_risk_detected',
    'approval_required',
    'approval_completed',
    'contract_expiring',
    'comment_received',
  ];

  const byEvent = eventTypes.reduce(
    (acc, t) => {
      acc[t] = 0;
      return acc;
    },
    {} as Record<NotificationEventType, number>
  );

  for (const n of notifications) {
    byEvent[n.event_type] = (byEvent[n.event_type] || 0) + 1;
  }

  const total = notifications.length;
  const sent = notifications.filter((n) => n.sent).length;
  const pending = total - sent;

  return { total, sent, pending, byEvent };
}

// 重新导出标签，方便页面统一引用
export { NOTIFICATION_EVENT_LABELS };
