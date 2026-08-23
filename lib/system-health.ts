// ===== 系统健康监控模块 =====
// 提供服务健康检查、系统指标、告警与可用性统计的 Mock 数据
// 供监控 API 与监控仪表盘共用

import {
  HealthCheckResult,
  SystemHealthDashboard,
  SystemMetrics,
  ServiceStatus,
  MetricTrend,
  SERVICE_STATUS_CONFIG,
} from './types';

// 状态优先级：down > degraded > maintenance > healthy
// getOverallStatus 依据此顺序汇总整体状态
const STATUS_PRIORITY: Record<ServiceStatus, number> = {
  down: 3,
  degraded: 2,
  maintenance: 1,
  healthy: 0,
};

// 生成距离当前若干分钟前的 ISO 时间字符串
function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60 * 1000).toISOString();
}

// 生成距离当前若干小时前的 ISO 时间字符串
function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

// 生成最近 24 小时（每小时一个点）的 ISO 时间戳，从早到晚排序
function recentHourlyTimestamps(count: number): string[] {
  const stamps: string[] = [];
  const now = new Date();
  // 整点对齐：取当前小时的起点
  const base = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    now.getHours(),
    0,
    0,
    0
  );
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(base.getTime() - i * 60 * 60 * 1000);
    stamps.push(d.toISOString());
  }
  return stamps;
}

// 简单的确定性"伪随机"：基于索引生成 [0,1) 之间的小数
// 避免每次渲染数据抖动过大，且不依赖 Math.random
function pseudoRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

// ===== Mock 服务健康检查数据 =====
// 返回 8 个服务的健康检查，覆盖 healthy / degraded / down / maintenance 四种状态
export function getMockHealthChecks(): HealthCheckResult[] {
  return [
    {
      id: 'svc-api-gateway',
      name: 'API 网关服务',
      category: 'api',
      status: 'healthy',
      response_time: 42,
      uptime: 99.98,
      last_check: minutesAgo(1),
      metrics: [
        { label: '响应时间', value: '42ms', trend: 'down' as MetricTrend },
        { label: '吞吐量', value: '1280 req/s', trend: 'up' as MetricTrend },
        { label: '错误率', value: '0.02%', trend: 'down' as MetricTrend },
      ],
    },
    {
      id: 'svc-auth-api',
      name: '认证 API 服务',
      category: 'api',
      status: 'healthy',
      response_time: 28,
      uptime: 99.95,
      last_check: minutesAgo(1),
      metrics: [
        { label: '响应时间', value: '28ms', trend: 'down' as MetricTrend },
        { label: '活跃会话', value: '1240', trend: 'up' as MetricTrend },
        { label: '失败登录', value: '12 次/小时', trend: 'stable' as MetricTrend },
      ],
    },
    {
      id: 'svc-supabase-db',
      name: 'Supabase 数据库',
      category: 'database',
      status: 'healthy',
      response_time: 18,
      uptime: 99.99,
      last_check: minutesAgo(1),
      metrics: [
        { label: '响应时间', value: '18ms', trend: 'stable' as MetricTrend },
        { label: '活跃连接', value: '156', trend: 'up' as MetricTrend },
        { label: '查询吞吐', value: '820 qps', trend: 'up' as MetricTrend },
      ],
    },
    {
      id: 'svc-claude-ai',
      name: 'Claude AI 服务',
      category: 'ai_service',
      status: 'degraded',
      response_time: 3200,
      uptime: 99.42,
      last_error:
        '响应时间超出 3s 告警阈值，疑似上游模型负载波动，已触发自动降级',
      last_check: minutesAgo(2),
      metrics: [
        { label: '响应时间', value: '3.2s', trend: 'up' as MetricTrend },
        { label: '成功率', value: '96.5%', trend: 'down' as MetricTrend },
        { label: 'Token 用量', value: '1.2M /小时', trend: 'up' as MetricTrend },
      ],
    },
    {
      id: 'svc-file-storage',
      name: '文件存储服务',
      category: 'storage',
      status: 'healthy',
      response_time: 85,
      uptime: 99.9,
      last_check: minutesAgo(1),
      metrics: [
        { label: '响应时间', value: '85ms', trend: 'stable' as MetricTrend },
        { label: '存储容量', value: '2.8 TB', trend: 'up' as MetricTrend },
        { label: '上传成功率', value: '99.9%', trend: 'stable' as MetricTrend },
      ],
    },
    {
      id: 'svc-cdn',
      name: 'CDN 加速服务',
      category: 'storage',
      status: 'maintenance',
      response_time: 32,
      uptime: 99.88,
      last_error: undefined,
      last_check: minutesAgo(5),
      metrics: [
        { label: '响应时间', value: '32ms', trend: 'stable' as MetricTrend },
        { label: '缓存命中率', value: '91.5%', trend: 'stable' as MetricTrend },
        { label: '出口带宽', value: '450 Mbps', trend: 'up' as MetricTrend },
      ],
    },
    {
      id: 'svc-redis-cache',
      name: 'Redis 缓存服务',
      category: 'cache',
      status: 'degraded',
      response_time: 3,
      uptime: 99.7,
      last_error: '缓存命中率较昨日下降 3.2%，部分热点 key 过期策略需调整',
      last_check: minutesAgo(1),
      metrics: [
        { label: '响应时间', value: '3ms', trend: 'up' as MetricTrend },
        { label: '命中率', value: '94.2%', trend: 'down' as MetricTrend },
        { label: '内存使用', value: '78%', trend: 'up' as MetricTrend },
      ],
    },
    {
      id: 'svc-smtp-mail',
      name: 'SMTP 邮件服务',
      category: 'email',
      status: 'down',
      response_time: 30000,
      uptime: 97.35,
      last_error:
        'SMTP 服务器连接超时，无法投递通知邮件，已自动降级至站内信通道',
      last_check: minutesAgo(3),
      metrics: [
        { label: '响应时间', value: '超时', trend: 'up' as MetricTrend },
        { label: '发送成功率', value: '0%', trend: 'down' as MetricTrend },
        { label: '队列积压', value: '156 封', trend: 'up' as MetricTrend },
      ],
    },
  ];
}

// ===== Mock 系统指标数据 =====
// 返回最近 24 小时（每小时一个点）的系统指标
// CPU / 内存 / 磁盘使用率、网络出入、活跃用户、请求量、平均响应时间、错误率
export function getMockMetrics(): SystemMetrics[] {
  const stamps = recentHourlyTimestamps(24);
  return stamps.map((timestamp, idx) => {
    // 用确定性伪随机生成相对平稳的曲线，并叠加小时段波动
    // 白天（8-22 点）负载较高，凌晨负载较低
    const hour = new Date(timestamp).getHours();
    const isPeak = hour >= 9 && hour <= 21 ? 1 : 0;
    const noise = pseudoRandom(idx + 1);

    const cpuUsage = Math.round((28 + isPeak * 32 + noise * 14) * 10) / 10;
    const memoryUsage = Math.round((45 + isPeak * 24 + noise * 8) * 10) / 10;
    const diskUsage = Math.round((62 + (idx / 24) * 4 + noise * 1.5) * 10) / 10;
    const networkIn = Math.round(120 + isPeak * 380 + noise * 90);
    const networkOut = Math.round(95 + isPeak * 320 + noise * 80);
    const activeUsers = Math.round(80 + isPeak * 420 + noise * 60);
    const requestsPerMinute = Math.round(
      420 + isPeak * 1380 + noise * 180
    );
    const avgResponseTime = Math.round(
      (95 + isPeak * 120 + noise * 60) * 10
    ) / 10;
    const errorRate =
      Math.round((0.12 + isPeak * 0.18 + noise * 0.15) * 1000) / 1000;

    return {
      timestamp,
      cpu_usage: cpuUsage,
      memory_usage: memoryUsage,
      disk_usage: diskUsage,
      network_in: networkIn,
      network_out: networkOut,
      active_users: activeUsers,
      requests_per_minute: requestsPerMinute,
      avg_response_time: avgResponseTime,
      error_rate: errorRate,
    };
  });
}

// ===== Mock 系统告警 =====
// 返回 4 条系统告警，覆盖 critical / warning / info
export function getMockAlerts(): {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  timestamp: string;
}[] {
  return [
    {
      id: 'alert-sys-001',
      severity: 'critical',
      message:
        'SMTP 邮件服务连接超时已超过 5 分钟，通知邮件无法投递，已自动降级至站内信通道',
      timestamp: minutesAgo(18),
    },
    {
      id: 'alert-sys-002',
      severity: 'warning',
      message:
        'Claude AI 服务平均响应时间达 3.2s，超过 3s 告警阈值，疑似上游模型负载波动',
      timestamp: minutesAgo(32),
    },
    {
      id: 'alert-sys-003',
      severity: 'warning',
      message:
        'Redis 缓存命中率较昨日下降 3.2%，部分热点 key 过期策略需调整',
      timestamp: hoursAgo(1),
    },
    {
      id: 'alert-sys-004',
      severity: 'info',
      message: '系统已于凌晨 03:00 完成自动备份，共归档 128 份合同与 1.2GB 日志',
      timestamp: hoursAgo(6),
    },
  ];
}

// ===== Mock 可用性统计 =====
// 返回 7 天 / 30 天 / 90 天的可用性统计
export function getMockUptimeStats(): {
  period: string;
  uptime: number;
  downtime: number;
  incidents: number;
}[] {
  return [
    {
      period: '近 7 天',
      uptime: 99.82,
      downtime: 18,
      incidents: 1,
    },
    {
      period: '近 30 天',
      uptime: 99.91,
      downtime: 39,
      incidents: 2,
    },
    {
      period: '近 90 天',
      uptime: 99.95,
      downtime: 65,
      incidents: 3,
    },
  ];
}

// ===== 整体状态汇总 =====
// 任何 down → down，任何 degraded → degraded，否则 healthy
// maintenance 不拉低整体状态（视为计划内停机）
export function getOverallStatus(services: HealthCheckResult[]): ServiceStatus {
  if (services.length === 0) return 'healthy';
  let worst: ServiceStatus = 'healthy';
  for (const svc of services) {
    const status = svc.status;
    if (status === 'down') return 'down';
    if (STATUS_PRIORITY[status] > STATUS_PRIORITY[worst]) {
      worst = status;
    }
  }
  return worst;
}

// ===== 可用率格式化 =====
// 99.95 → "99.95%"，保留两位小数
export function formatUptime(percentage: number): string {
  return `${percentage.toFixed(2)}%`;
}

// ===== 汇总仪表盘数据 =====
// 整合服务健康检查、系统指标、告警与可用性统计
export function getHealthDashboard(): SystemHealthDashboard {
  const services = getMockHealthChecks();
  const recent_metrics = getMockMetrics();
  const alerts = getMockAlerts();
  const uptime_stats = getMockUptimeStats();
  const overall_status = getOverallStatus(services);

  return {
    overall_status,
    services,
    recent_metrics,
    alerts,
    uptime_stats,
  };
}

// 重新导出配置，方便页面统一引用
export { SERVICE_STATUS_CONFIG };
