// ===== Webhook 集成模块 =====
// 提供 Webhook 配置、投递日志的 Mock 数据，以及触发、创建、签名生成、统计
// 演示模式：配置与投递日志存储在模块级内存变量中，供 Webhook API 共用

import {
  WebhookConfig,
  WebhookDeliveryLog,
  WebhookEvent,
  WEBHOOK_EVENT_LABELS,
} from './types';

// 生成距离今天指定天数的 ISO 时间字符串
function daysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

// 生成距离今天指定小时的 ISO 时间字符串
function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

// 生成距离今天指定分钟的 ISO 时间字符串
function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60 * 1000).toISOString();
}

// ===== 简单 HMAC 签名模拟 =====
// 不依赖 Node crypto，使用确定性哈希后做 base64 编码，形如 "sha256=<base64>"
function simpleHash(str: string): string {
  // 基于 cyrb53 风格的非加密哈希，输出确定长度
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  // 拼接为 16 字符十六进制，便于稳定 base64
  return (
    (h2 >>> 0).toString(16).padStart(8, '0') +
    (h1 >>> 0).toString(16).padStart(8, '0')
  );
}

// base64 编码（兼容 Node 与浏览器）
function toBase64(input: string): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(input, 'utf-8').toString('base64');
  }
  // 浏览器降级
  if (typeof btoa === 'function') {
    return btoa(unescape(encodeURIComponent(input)));
  }
  return input;
}

// 生成 Webhook 签名（简单 HMAC 模拟）
export function generateWebhookSignature(secret: string, payload: string): string {
  const hash = simpleHash(`${secret}:${payload}`);
  // 再哈希一次以延长输出，使其更像真实签名
  const longHash = simpleHash(hash + payload + secret) + hash;
  return `sha256=${toBase64(longHash)}`;
}

// ===== Mock Webhook 配置 =====
// 返回 4 个模拟 webhook：ERP 集成、OA 通知、Slack 通知、飞书机器人
export function getMockWebhooks(): WebhookConfig[] {
  return [
    {
      id: 'wh-001',
      name: 'ERP系统集成',
      url: 'https://erp.company.com/api/webhooks/contract-review',
      events: ['review.completed', 'approval.completed'],
      secret: 'whsec_erp_8f3a9b2e1c7d',
      status: 'active',
      last_triggered: hoursAgo(2),
      last_response_status: 200,
      success_count: 28,
      failure_count: 2,
      created_at: daysAgo(20),
      updated_at: hoursAgo(2),
    },
    {
      id: 'wh-002',
      name: 'OA系统通知',
      url: 'https://oa.company.com/webhooks/contract',
      events: ['approval.created', 'approval.completed', 'contract.expiring'],
      secret: 'whsec_oa_4c1e7a9d2b80',
      status: 'active',
      last_triggered: hoursAgo(5),
      last_response_status: 200,
      success_count: 41,
      failure_count: 0,
      created_at: daysAgo(30),
      updated_at: hoursAgo(5),
    },
    {
      id: 'wh-003',
      name: 'Slack通知',
      url: 'https://hooks.slack.com/services/T0B0X/webhook',
      events: ['risk.high_detected', 'comment.added'],
      secret: 'whsec_slack_9a2f3e1c8d4b',
      status: 'failing',
      last_triggered: minutesAgo(35),
      last_response_status: 500,
      success_count: 18,
      failure_count: 6,
      created_at: daysAgo(15),
      updated_at: minutesAgo(35),
    },
    {
      id: 'wh-004',
      name: '飞书机器人',
      url: 'https://open.feishu.cn/open-apis/bot/v2/hook/contract-review',
      events: ['review.completed', 'risk.high_detected'],
      secret: 'whsec_feishu_6b8c1d3e9f2a',
      status: 'active',
      last_triggered: hoursAgo(8),
      last_response_status: 200,
      success_count: 33,
      failure_count: 1,
      created_at: daysAgo(10),
      updated_at: hoursAgo(8),
    },
  ];
}

// ===== Mock 投递日志 =====
// 返回 6 条模拟投递日志，覆盖成功与失败
export function getMockDeliveryLogs(): WebhookDeliveryLog[] {
  return [
    {
      id: 'dl-001',
      webhook_id: 'wh-001',
      webhook_name: 'ERP系统集成',
      event: 'review.completed',
      payload: {
        contract_id: 'mock-001',
        contract_title: 'XX产品采购合同',
        risk_score: 65,
        review_id: 'rv-001',
      },
      response_status: 200,
      response_body: '{"ok":true,"received":true}',
      duration_ms: 142,
      success: true,
      timestamp: hoursAgo(2),
    },
    {
      id: 'dl-002',
      webhook_id: 'wh-002',
      webhook_name: 'OA系统通知',
      event: 'approval.created',
      payload: {
        contract_id: 'mock-001',
        contract_title: 'XX产品采购合同',
        flow_id: 'apv-001',
        approver: '李经理',
      },
      response_status: 200,
      response_body: '{"ok":true}',
      duration_ms: 98,
      success: true,
      timestamp: hoursAgo(5),
    },
    {
      id: 'dl-003',
      webhook_id: 'wh-003',
      webhook_name: 'Slack通知',
      event: 'risk.high_detected',
      payload: {
        contract_id: 'mock-001',
        contract_title: 'XX产品采购合同',
        risk_type: 'payment_risk',
        risk_level: 'high',
      },
      response_status: 500,
      response_body: '{"error":"internal_server_error"}',
      duration_ms: 750,
      success: false,
      timestamp: minutesAgo(35),
    },
    {
      id: 'dl-004',
      webhook_id: 'wh-004',
      webhook_name: '飞书机器人',
      event: 'review.completed',
      payload: {
        contract_id: 'mock-002',
        contract_title: 'IT技术服务协议',
        risk_score: 42,
        review_id: 'rv-002',
      },
      response_status: 200,
      response_body: '{"code":0,"msg":"success"}',
      duration_ms: 210,
      success: true,
      timestamp: hoursAgo(8),
    },
    {
      id: 'dl-005',
      webhook_id: 'wh-001',
      webhook_name: 'ERP系统集成',
      event: 'approval.completed',
      payload: {
        contract_id: 'mock-001',
        contract_title: 'XX产品采购合同',
        flow_id: 'apv-001',
        decision: 'approved',
      },
      response_status: 200,
      response_body: '{"ok":true}',
      duration_ms: 167,
      success: true,
      timestamp: daysAgo(1),
    },
    {
      id: 'dl-006',
      webhook_id: 'wh-003',
      webhook_name: 'Slack通知',
      event: 'comment.added',
      payload: {
        contract_id: 'mock-001',
        comment_id: 'cmt-001',
        author: '李经理',
      },
      response_status: 408,
      response_body: 'Request Timeout',
      duration_ms: 5000,
      success: false,
      timestamp: daysAgo(2),
    },
  ];
}

// ===== 内存存储（演示模式）=====
// triggerWebhooks 需读取"所有 webhook"，故在此维护模块级状态作为单一数据源
let webhooksStore: WebhookConfig[] = getMockWebhooks();
let deliveryLogsStore: WebhookDeliveryLog[] = getMockDeliveryLogs();

// 读取全部 webhook 配置
export function getStoredWebhooks(): WebhookConfig[] {
  return webhooksStore.map((w) => ({ ...w }));
}

// 读取投递日志（可限制条数，按时间倒序）
export function getStoredDeliveryLogs(limit?: number): WebhookDeliveryLog[] {
  const sorted = [...deliveryLogsStore].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
  return sorted.slice(0, limit);
}

// 新增 webhook 到存储
export function addStoredWebhook(wh: WebhookConfig): void {
  webhooksStore.unshift(wh);
}

// 更新 webhook 配置
export function updateStoredWebhook(
  id: string,
  updates: Partial<WebhookConfig>
): WebhookConfig | null {
  const idx = webhooksStore.findIndex((w) => w.id === id);
  if (idx === -1) return null;
  webhooksStore[idx] = { ...webhooksStore[idx], ...updates, updated_at: new Date().toISOString() };
  return { ...webhooksStore[idx] };
}

// 删除 webhook
export function deleteStoredWebhook(id: string): boolean {
  const before = webhooksStore.length;
  webhooksStore = webhooksStore.filter((w) => w.id !== id);
  return webhooksStore.length < before;
}

// 根据 id 获取 webhook
export function getStoredWebhook(id: string): WebhookConfig | null {
  const wh = webhooksStore.find((w) => w.id === id);
  return wh ? { ...wh } : null;
}

// ===== 创建 Webhook 配置 =====
export function createWebhook(
  name: string,
  url: string,
  events: WebhookEvent[],
  secret: string
): WebhookConfig {
  const now = new Date().toISOString();
  return {
    id: `wh-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name,
    url,
    events,
    secret,
    status: 'active',
    success_count: 0,
    failure_count: 0,
    created_at: now,
    updated_at: now,
  };
}

// ===== 触发 Webhook =====
// 模拟触发所有订阅了该事件的 webhook，随机生成响应状态（200/500/408）与耗时
export function triggerWebhooks(
  event: WebhookEvent,
  payload: Record<string, any>
): WebhookDeliveryLog[] {
  const payloadStr = JSON.stringify(payload);
  const now = new Date().toISOString();
  const newLogs: WebhookDeliveryLog[] = [];

  for (const wh of webhooksStore) {
    // 仅触发订阅了该事件的 webhook
    if (!wh.events.includes(event)) continue;

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
      durationMs = Math.floor(Math.random() * 300) + 60; // 60-360ms
    } else if (rand < 0.85) {
      responseStatus = 500;
      success = false;
      responseBody = '{"error":"internal_server_error"}';
      durationMs = Math.floor(Math.random() * 600) + 400; // 400-1000ms
    } else {
      responseStatus = 408;
      success = false;
      responseBody = 'Request Timeout';
      durationMs = 5000;
    }

    // 生成签名（包含在投递记录中，便于排查）
    const signature = generateWebhookSignature(wh.secret, payloadStr);

    const log: WebhookDeliveryLog = {
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
    newLogs.push(log);

    // 更新 webhook 统计与状态
    wh.last_triggered = now;
    wh.last_response_status = responseStatus;
    wh.updated_at = now;
    if (success) {
      wh.success_count += 1;
    } else {
      wh.failure_count += 1;
    }
    // 连续失败超过 3 次标记为 failing；成功则恢复 active
    if (wh.failure_count - wh.success_count > 3 || wh.failure_count >= 5) {
      wh.status = 'failing';
    } else if (success && wh.status === 'failing') {
      wh.status = 'active';
    }
  }

  // 投递日志写入存储（保持在前）
  deliveryLogsStore.unshift(...newLogs);
  // 限制投递日志上限，避免无限增长
  if (deliveryLogsStore.length > 100) {
    deliveryLogsStore = deliveryLogsStore.slice(0, 100);
  }

  return newLogs;
}

// ===== Webhook 统计 =====
export function getWebhookStats(webhooks: WebhookConfig[]): {
  total: number;
  active: number;
  failing: number;
  totalDeliveries: number;
  successRate: number;
} {
  const total = webhooks.length;
  const active = webhooks.filter((w) => w.status === 'active').length;
  const failing = webhooks.filter((w) => w.status === 'failing').length;
  const totalSuccess = webhooks.reduce((s, w) => s + w.success_count, 0);
  const totalFailure = webhooks.reduce((s, w) => s + w.failure_count, 0);
  const totalDeliveries = totalSuccess + totalFailure;
  const successRate =
    totalDeliveries > 0 ? Math.round((totalSuccess / totalDeliveries) * 100) : 100;

  return { total, active, failing, totalDeliveries, successRate };
}

// 重新导出标签，方便页面统一引用
export { WEBHOOK_EVENT_LABELS };
