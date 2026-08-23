// ===== 审计追踪与合规报告模块 =====
// 提供审计日志的 Mock 数据、日志记录、合规报告生成、筛选与格式化
// 供审计 API 与审计日志组件共用

import {
  AuditLogEntry,
  AuditAction,
  AuditComplianceReport,
  AUDIT_ACTION_LABELS,
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

// 操作类型分类：用于合规分数与异常判定
// 异常类操作（驳回、删除等）会拉低合规分数
const ANOMALY_ACTIONS: AuditAction[] = [
  'approval_rejected',
  'risk_rejected',
  'rule_deleted',
];

// 所有可能的审计操作类型（用于覆盖率统计）
const ALL_AUDIT_ACTIONS: AuditAction[] = Object.keys(
  AUDIT_ACTION_LABELS
) as AuditAction[];

// 生成简单递增 id
function genId(prefix: string, n: number): string {
  return `${prefix}-${String(n).padStart(3, '0')}`;
}

// ===== Mock 审计日志数据 =====
// 返回 15 条模拟审计日志，覆盖多种操作类型与不同用户，时间分布在最近 7 天内
export function getMockAuditLogs(): AuditLogEntry[] {
  return [
    {
      id: genId('log', 1),
      action: 'contract_uploaded',
      actor_id: 'u-1003',
      actor_name: '王业务',
      actor_role: '业务部门',
      contract_id: 'mock-001',
      contract_title: 'XX产品采购合同',
      details: {
        filename: 'XX产品采购合同.pdf',
        file_size: 856320,
        contract_type: '采购合同',
      },
      ip_address: '192.168.1.24',
      user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      timestamp: daysAgo(6),
    },
    {
      id: genId('log', 2),
      action: 'review_started',
      actor_id: 'u-1001',
      actor_name: '张法务',
      actor_role: '法务专员',
      contract_id: 'mock-001',
      contract_title: 'XX产品采购合同',
      details: {
        review_id: 'rv-001',
        steps: ['解析合同', '条款抽取', '风险识别'],
      },
      ip_address: '192.168.1.10',
      timestamp: daysAgo(6),
    },
    {
      id: genId('log', 3),
      action: 'review_completed',
      actor_id: 'u-1001',
      actor_name: '张法务',
      actor_role: '法务专员',
      contract_id: 'mock-001',
      contract_title: 'XX产品采购合同',
      details: {
        review_id: 'rv-001',
        risk_score: 65,
        risk_count: 6,
        high_risk_count: 2,
        duration_seconds: 1840,
      },
      ip_address: '192.168.1.10',
      timestamp: daysAgo(5),
    },
    {
      id: genId('log', 4),
      action: 'risk_accepted',
      actor_id: 'u-1001',
      actor_name: '张法务',
      actor_role: '法务专员',
      contract_id: 'mock-001',
      contract_title: 'XX产品采购合同',
      details: {
        risk_id: 'rsk-001',
        risk_type: 'payment_risk',
        clause: '预付款比例为 50%',
        suggestion: '建议将预付款比例调整为 30% 以内',
      },
      ip_address: '192.168.1.10',
      timestamp: daysAgo(4),
    },
    {
      id: genId('log', 5),
      action: 'risk_rejected',
      actor_id: 'u-1001',
      actor_name: '张法务',
      actor_role: '法务专员',
      contract_id: 'mock-001',
      contract_title: 'XX产品采购合同',
      details: {
        risk_id: 'rsk-002',
        risk_type: 'breach_liability',
        clause: '违约金条款缺失',
        reason: '业务侧确认可接受，暂不补充',
      },
      ip_address: '192.168.1.10',
      timestamp: daysAgo(4),
    },
    {
      id: genId('log', 6),
      action: 'comment_added',
      actor_id: 'u-1002',
      actor_name: '李经理',
      actor_role: '法务经理',
      contract_id: 'mock-001',
      contract_title: 'XX产品采购合同',
      details: {
        comment_id: 'cmt-001',
        content: '预付款比例需与供应商重新协商，请业务跟进',
        mentions: ['u-1003'],
      },
      ip_address: '192.168.1.18',
      timestamp: daysAgo(4),
    },
    {
      id: genId('log', 7),
      action: 'approval_submitted',
      actor_id: 'u-1001',
      actor_name: '张法务',
      actor_role: '法务专员',
      contract_id: 'mock-001',
      contract_title: 'XX产品采购合同',
      details: {
        flow_id: 'apv-001',
        route_reason: 'high_risk',
        risk_score: 65,
        next_approver: 'u-1002',
      },
      ip_address: '192.168.1.10',
      timestamp: daysAgo(3),
    },
    {
      id: genId('log', 8),
      action: 'approval_approved',
      actor_id: 'u-1002',
      actor_name: '李经理',
      actor_role: '法务经理',
      contract_id: 'mock-001',
      contract_title: 'XX产品采购合同',
      details: {
        flow_id: 'apv-001',
        node_order: 1,
        comment: '已与业务确认预付款比例，同意通过',
      },
      ip_address: '192.168.1.18',
      timestamp: daysAgo(2),
    },
    {
      id: genId('log', 9),
      action: 'report_exported',
      actor_id: 'u-1003',
      actor_name: '王业务',
      actor_role: '业务部门',
      contract_id: 'mock-001',
      contract_title: 'XX产品采购合同',
      details: {
        report_id: 'rpt-001',
        format: 'pdf',
        risk_score: 65,
      },
      ip_address: '192.168.1.24',
      timestamp: daysAgo(2),
    },
    {
      id: genId('log', 10),
      action: 'approval_rejected',
      actor_id: 'u-1002',
      actor_name: '李经理',
      actor_role: '法务经理',
      contract_id: 'mock-004',
      contract_title: '市场推广合作协议',
      details: {
        flow_id: 'apv-004',
        node_order: 1,
        reason: '付款节点不明确且缺少终止条款，需补充后重新提交',
      },
      ip_address: '192.168.1.18',
      timestamp: daysAgo(2),
    },
    {
      id: genId('log', 11),
      action: 'review_completed',
      actor_id: 'u-1001',
      actor_name: '张法务',
      actor_role: '法务专员',
      contract_id: 'mock-002',
      contract_title: 'IT技术服务协议',
      details: {
        review_id: 'rv-002',
        risk_score: 42,
        risk_count: 4,
        high_risk_count: 0,
        duration_seconds: 960,
      },
      ip_address: '192.168.1.10',
      timestamp: daysAgo(2),
    },
    {
      id: genId('log', 12),
      action: 'approval_rejected',
      actor_id: 'u-1002',
      actor_name: '李经理',
      actor_role: '法务经理',
      contract_id: 'mock-002',
      contract_title: 'IT技术服务协议',
      details: {
        flow_id: 'apv-002',
        node_order: 1,
        reason: '违约金条款缺失，需补充后再提交',
      },
      ip_address: '192.168.1.18',
      timestamp: daysAgo(1),
    },
    {
      id: genId('log', 13),
      action: 'rule_created',
      actor_id: 'u-1002',
      actor_name: '李经理',
      actor_role: '法务经理',
      details: {
        rule_id: 'rule-001',
        rule_name: '预付款比例上限校验',
        field: 'payment_clause',
        operator: 'greater_than',
        value: '30',
        severity: 'high',
      },
      ip_address: '192.168.1.18',
      timestamp: daysAgo(3),
    },
    {
      id: genId('log', 14),
      action: 'user_login',
      actor_id: 'u-1003',
      actor_name: '王业务',
      actor_role: '业务部门',
      details: {
        login_method: 'password',
      },
      ip_address: '192.168.1.24',
      user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      timestamp: hoursAgo(12),
    },
    {
      id: genId('log', 15),
      action: 'settings_changed',
      actor_id: 'u-1000',
      actor_name: '系统管理员',
      actor_role: '系统管理员',
      details: {
        module: 'risk_threshold',
        key: 'high_risk_score_threshold',
        old_value: 60,
        new_value: 55,
      },
      ip_address: '192.168.1.2',
      timestamp: daysAgo(1),
    },
  ];
}

// ===== 记录审计日志（仅返回结构，不实际写入）=====
// 创建一条审计日志条目；真实场景应由 API / 中间件写入持久化存储
export function logAction(
  action: AuditAction,
  actorId: string,
  actorName: string,
  actorRole: string,
  details: Record<string, any>,
  contractId?: string,
  contractTitle?: string
): AuditLogEntry {
  return {
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    action,
    actor_id: actorId,
    actor_name: actorName,
    actor_role: actorRole,
    contract_id: contractId,
    contract_title: contractTitle,
    details,
    timestamp: new Date().toISOString(),
  };
}

// ===== 生成合规报告 =====
// 统计总操作数、独立用户数、按类型分布，并基于操作覆盖率与异常率计算合规分数
export function generateComplianceReport(logs: AuditLogEntry[]): AuditComplianceReport {
  const total_actions = logs.length;

  // 独立用户数
  const userIds = new Set(logs.map((l) => l.actor_id));
  const unique_users = userIds.size;

  // 按操作类型分布
  const actions_by_type: Record<string, number> = {};
  for (const log of logs) {
    actions_by_type[log.action] = (actions_by_type[log.action] || 0) + 1;
  }

  // 时间范围
  const timestamps = logs.map((l) => new Date(l.timestamp).getTime());
  const start = timestamps.length
    ? new Date(Math.min(...timestamps)).toISOString()
    : new Date().toISOString();
  const end = timestamps.length
    ? new Date(Math.max(...timestamps)).toISOString()
    : new Date().toISOString();

  // 最近 5 条活动（按时间倒序）
  const recent_activities = [...logs]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 5);

  // ===== 合规分数（0-100）=====
  // 权重：操作覆盖率 60% + 无异常率 40%，再扣除问题惩罚分
  const distinctTypes = new Set(logs.map((l) => l.action)).size;
  const coverageRatio = total_actions > 0 ? distinctTypes / ALL_AUDIT_ACTIONS.length : 0;

  const anomalyCount = logs.filter((l) => ANOMALY_ACTIONS.includes(l.action)).length;
  const anomalyRate = total_actions > 0 ? anomalyCount / total_actions : 0;

  // 问题识别（在计算分数前先收集，便于惩罚）
  const issues: string[] = [];
  const has = (a: AuditAction) => (actions_by_type[a] || 0) > 0;

  // 1) 提交审批但无审批结论 → 审批流程未闭环
  if (has('approval_submitted') && !has('approval_approved') && !has('approval_rejected')) {
    issues.push('存在审批提交记录但缺少审批结论，审批流程未闭环');
  }

  // 2) 采纳风险建议但未走审批 → 高风险可能未经审批
  if (has('risk_accepted') && !has('approval_submitted')) {
    issues.push('存在风险建议被采纳但未触发审批流程，建议高风险变更需经审批');
  }

  // 3) 审批驳回次数较多
  const rejectedCount = actions_by_type['approval_rejected'] || 0;
  if (rejectedCount >= 2) {
    issues.push(`审批驳回 ${rejectedCount} 次，建议核查相关合同质量与条款规范`);
  }

  // 4) 近期缺少审查完成记录
  if (!has('review_completed')) {
    issues.push('近期缺少审查完成记录，审查流程可能停滞');
  }

  // 5) 有合同上传但无审查完成
  if (has('contract_uploaded') && !has('review_completed')) {
    issues.push('存在已上传合同但未完成审查，可能存在积压');
  }

  // 6) 缺少登录审计记录
  if (!has('user_login')) {
    issues.push('未记录用户登录审计日志，建议开启登录行为审计');
  }

  // 7) 异常操作占比偏高
  if (anomalyRate > 0.2) {
    issues.push(
      `异常操作占比 ${Math.round(anomalyRate * 100)}%，高于 20% 关注阈值`
    );
  }

  // 计算分数
  let score = coverageRatio * 60 + (1 - anomalyRate) * 40;
  // 问题惩罚：每个问题扣 4 分，最多扣 24 分
  score -= Math.min(24, issues.length * 4);
  // 限定 0-100
  const compliance_score = Math.max(0, Math.min(100, Math.round(score)));

  return {
    total_actions,
    unique_users,
    actions_by_type,
    recent_activities,
    compliance_score,
    issues,
    period: { start, end },
  };
}

// ===== 筛选审计日志 =====
// 支持 操作类型 / 用户 / 起止日期筛选
export function filterLogs(
  logs: AuditLogEntry[],
  filters: {
    action?: AuditAction;
    actorId?: string;
    startDate?: string;
    endDate?: string;
  }
): AuditLogEntry[] {
  return logs.filter((log) => {
    if (filters.action && log.action !== filters.action) return false;
    if (filters.actorId && log.actor_id !== filters.actorId) return false;
    const ts = new Date(log.timestamp).getTime();
    if (filters.startDate) {
      const s = new Date(filters.startDate).getTime();
      if (Number.isNaN(s)) return false;
      if (ts < s) return false;
    }
    if (filters.endDate) {
      // 结束日期按当天结束处理（含当天 23:59:59）
      const end = new Date(filters.endDate);
      end.setHours(23, 59, 59, 999);
      const e = end.getTime();
      if (Number.isNaN(e)) return false;
      if (ts > e) return false;
    }
    return true;
  });
}

// ===== 格式化审计条目为可读文本 =====
export function formatAuditEntry(entry: AuditLogEntry): string {
  const time = new Date(entry.timestamp).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  const label = AUDIT_ACTION_LABELS[entry.action] || entry.action;
  const contract = entry.contract_title
    ? ` | 合同：${entry.contract_title}`
    : '';
  const detailsStr = Object.keys(entry.details).length
    ? ` | 详情：${JSON.stringify(entry.details)}`
    : '';
  return `[${time}] ${entry.actor_name}（${entry.actor_role}）执行了「${label}」操作${contract}${detailsStr}`;
}

// 重新导出标签，方便页面统一引用
export { AUDIT_ACTION_LABELS };
