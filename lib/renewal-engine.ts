// ===== 合同到期自动续签引擎 =====
// 提供续签策略管理、续签资格评估、续签触发与检查清单生成能力
// 供续签管理 API 与续签管理页面共用

import {
  RenewalPolicy,
  RenewalStrategy,
  RenewalStatus,
  RenewalChecklistItem,
  RENEWAL_STRATEGY_LABELS,
  RENEWAL_STATUS_CONFIG,
} from './types';

// 一天的毫秒数
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// 生成距离今天指定天数的日期字符串（YYYY-MM-DD）
function daysFromNow(days: number): string {
  const d = new Date(Date.now() + days * ONE_DAY_MS);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// 生成距离今天指定天数的 ISO 时间字符串
function daysAgoISO(days: number): string {
  return new Date(Date.now() - days * ONE_DAY_MS).toISOString();
}

// 给指定日期字符串加上 N 个月，返回 YYYY-MM-DD
function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + months);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// 计算距离到期日的剩余天数（已过期为负数）
export function daysUntilExpiry(endDate: string): number {
  const now = new Date();
  const end = new Date(endDate);
  const diffMs = end.getTime() - now.getTime();
  return Math.ceil(diffMs / ONE_DAY_MS);
}

// ===== 检查清单生成 =====

// 默认续签检查清单（5-6 项标准检查项）
const DEFAULT_CHECKLIST: RenewalChecklistItem[] = [
  { id: 'chk-1', label: '确认合同执行情况', completed: false, required: true },
  { id: 'chk-2', label: '评估续签风险', completed: false, required: true },
  { id: 'chk-3', label: '获取最新资信报告', completed: false, required: true },
  { id: 'chk-4', label: '确认价格调整', completed: false, required: true },
  { id: 'chk-5', label: '法务审核', completed: false, required: true },
  { id: 'chk-6', label: '管理层审批', completed: false, required: false },
];

// 根据续签策略生成检查清单
export function generateDefaultChecklist(
  strategy: RenewalStrategy
): RenewalChecklistItem[] {
  // 复制默认清单，避免修改原始引用
  const base = DEFAULT_CHECKLIST.map((item) => ({ ...item }));

  // 不续签策略：仅需终止通知与归档
  if (strategy === 'no_renewal') {
    return [
      { id: 'chk-1', label: '确认合同执行情况', completed: false, required: true },
      { id: 'chk-2', label: '发送合同终止通知', completed: false, required: true },
      { id: 'chk-3', label: '归档合同并更新台账', completed: false, required: true },
    ];
  }

  // 仅通知策略：不需要管理层审批与法务审核为非必填
  if (strategy === 'notify_only') {
    return base.map((item) =>
      item.id === 'chk-5' || item.id === 'chk-6'
        ? { ...item, required: false }
        : item
    );
  }

  // 自动续签策略：管理层审批为非必填
  if (strategy === 'auto_renew') {
    return base.map((item) =>
      item.id === 'chk-6' ? { ...item, required: false } : item
    );
  }

  // 人工审查策略：全部必填
  return base;
}

// ===== 续签资格评估 =====

// 评估续签资格：检查风险评分范围、价格涨幅上限与必填检查清单完成情况
export function evaluateRenewalEligibility(
  policy: RenewalPolicy,
  currentRiskScore: number,
  priceIncrease: number
): { eligible: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const cond = policy.auto_conditions;

  // 检查风险评分是否在可接受范围内
  if (currentRiskScore < cond.min_risk_score) {
    reasons.push(
      `风险评分 ${currentRiskScore} 低于最低阈值 ${cond.min_risk_score}，建议人工复核后再续签`
    );
  }
  if (currentRiskScore > cond.max_risk_score) {
    reasons.push(
      `风险评分 ${currentRiskScore} 超过最高阈值 ${cond.max_risk_score}，存在较高风险，不建议自动续签`
    );
  }

  // 检查价格涨幅是否超过上限
  const cap = Math.min(cond.max_price_increase, policy.price_adjustment_cap);
  if (priceIncrease > cap) {
    reasons.push(
      `价格涨幅 ${priceIncrease}% 超过上限 ${cap}%，需重新协商价格或人工审批`
    );
  }

  // 检查所有必填检查清单项是否已完成
  const incompleteRequired = policy.checklist.filter(
    (item) => item.required && !item.completed
  );
  if (incompleteRequired.length > 0) {
    reasons.push(
      `仍有 ${incompleteRequired.length} 项必填检查项未完成（${incompleteRequired
        .map((i) => i.label)
        .join('、')}），需完成后方可续签`
    );
  }

  return {
    eligible: reasons.length === 0,
    reasons,
  };
}

// ===== 触发续签 =====

// 内部辅助：对策略应用续签触发转换
function applyTrigger(policy: RenewalPolicy): RenewalPolicy {
  const now = new Date().toISOString();
  return {
    ...policy,
    status: 'in_progress',
    triggered_at: now,
    // 重新生成检查清单（保留已有完成项状态）
    checklist: generateDefaultChecklist(policy.strategy).map((item) => {
      const existing = policy.checklist.find((c) => c.id === item.id);
      return existing
        ? { ...item, completed: existing.completed, completed_at: existing.completed_at }
        : item;
    }),
  };
}

// 触发续签流程：根据 policyId 查找 Mock 数据中的策略并触发
export function triggerRenewal(policyId: string): RenewalPolicy {
  const policy = getMockRenewalPolicies().find((p) => p.id === policyId);
  if (!policy) {
    throw new Error(`续签策略 ${policyId} 不存在`);
  }
  // 仅已安排状态可触发
  if (policy.status !== 'scheduled') {
    throw new Error(`当前状态为 ${policy.status}，仅已安排状态可触发续签`);
  }
  return applyTrigger(policy);
}

// ===== 完成检查清单项 =====

// 标记指定检查清单项为已完成
export function completeChecklistItem(
  policy: RenewalPolicy,
  itemId: string
): RenewalPolicy {
  const now = new Date().toISOString();
  const checklist = policy.checklist.map((item) =>
    item.id === itemId
      ? { ...item, completed: true, completed_at: now }
      : item
  );
  return { ...policy, checklist };
}

// ===== 统计与查询 =====

// 统计续签策略概况
export function getRenewalStats(policies: RenewalPolicy[]): {
  total: number;
  autoRenew: number;
  pending: number;
  overdue: number;
  completed: number;
  upcoming30Days: number;
} {
  let autoRenew = 0;
  let pending = 0;
  let overdue = 0;
  let completed = 0;
  let upcoming30Days = 0;

  for (const p of policies) {
    // 自动续签策略计数
    if (p.strategy === 'auto_renew') {
      autoRenew += 1;
    }
    // 状态计数
    if (p.status === 'scheduled' || p.status === 'in_progress') {
      pending += 1;
    }
    if (p.status === 'overdue') {
      overdue += 1;
    }
    if (p.status === 'completed') {
      completed += 1;
    }
    // 30 天内即将到期（已安排或进行中且 0-30 天内到期）
    if (p.status === 'scheduled' || p.status === 'in_progress') {
      const days = daysUntilExpiry(p.current_end_date);
      if (days >= 0 && days <= 30) {
        upcoming30Days += 1;
      }
    }
  }

  return {
    total: policies.length,
    autoRenew,
    pending,
    overdue,
    completed,
    upcoming30Days,
  };
}

// 返回未来 N 天内到期的续签策略（已安排或进行中）
export function getUpcomingRenewals(
  policies: RenewalPolicy[],
  daysAhead: number
): RenewalPolicy[] {
  return policies
    .filter((p) => {
      if (p.status !== 'scheduled' && p.status !== 'in_progress') return false;
      const days = daysUntilExpiry(p.current_end_date);
      return days >= 0 && days <= daysAhead;
    })
    .sort(
      (a, b) =>
        new Date(a.current_end_date).getTime() -
        new Date(b.current_end_date).getTime()
    );
}

// 根据 contractId 查找续签策略
export function getRenewalPolicy(contractId: string): RenewalPolicy | undefined {
  return getMockRenewalPolicies().find((p) => p.contract_id === contractId);
}

// 创建续签策略（供 API 调用）
export function createRenewalPolicy(
  contractId: string,
  contractTitle: string,
  contractType: string,
  strategy: RenewalStrategy,
  termMonths: number,
  noticeDays: number,
  priceCap: number,
  autoConditions?: RenewalPolicy['auto_conditions']
): RenewalPolicy {
  // 默认以当前日期后 noticeDays 天为当前到期日
  const currentEndDate = daysFromNow(noticeDays);
  // 拟议续签日期 = 当前到期日 + 续签期限
  const proposedEndDate = addMonths(currentEndDate, termMonths);

  return {
    id: `rnw-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    contract_id: contractId,
    contract_title: contractTitle,
    contract_type: contractType,
    strategy,
    renewal_term_months: termMonths,
    notice_days_before: noticeDays,
    price_adjustment_cap: priceCap,
    auto_conditions: autoConditions || {
      min_risk_score: 0,
      max_risk_score: 60,
      requires_approval: strategy !== 'auto_renew',
      max_price_increase: priceCap,
    },
    status: 'scheduled',
    current_end_date: currentEndDate,
    proposed_end_date: proposedEndDate,
    checklist: generateDefaultChecklist(strategy),
  };
}

// ===== Mock 数据 =====

// 内部辅助：构造一条续签策略（含 checklist 与已完成项）
function buildPolicy(
  id: string,
  contractId: string,
  contractTitle: string,
  contractType: string,
  strategy: RenewalStrategy,
  status: RenewalStatus,
  endDaysFromNow: number,
  termMonths: number,
  noticeDays: number,
  priceCap: number,
  autoConditions: RenewalPolicy['auto_conditions'],
  completedChecklistCount: number = 0,
  triggeredDaysAgo?: number
): RenewalPolicy {
  const currentEndDate = daysFromNow(endDaysFromNow);
  const proposedEndDate = addMonths(currentEndDate, termMonths);
  const checklist = generateDefaultChecklist(strategy);

  // 模拟已完成前 N 项检查项
  if (completedChecklistCount > 0) {
    for (let i = 0; i < completedChecklistCount && i < checklist.length; i++) {
      checklist[i] = {
        ...checklist[i],
        completed: true,
        completed_at: daysAgoISO(triggeredDaysAgo ?? 1),
      };
    }
  }

  return {
    id,
    contract_id: contractId,
    contract_title: contractTitle,
    contract_type: contractType,
    strategy,
    renewal_term_months: termMonths,
    notice_days_before: noticeDays,
    price_adjustment_cap: priceCap,
    auto_conditions: autoConditions,
    status,
    current_end_date: currentEndDate,
    proposed_end_date: proposedEndDate,
    triggered_at: triggeredDaysAgo ? daysAgoISO(triggeredDaysAgo) : undefined,
    completed_at: status === 'completed' ? daysAgoISO(2) : undefined,
    checklist,
  };
}

// 返回 6 条 Mock 续签策略，覆盖不同策略与状态
export function getMockRenewalPolicies(): RenewalPolicy[] {
  return [
    // 1. 自动续签 + 已安排（25 天后到期）
    buildPolicy(
      'rnw-001',
      'mock-001',
      'XX产品年度采购合同',
      '采购合同',
      'auto_renew',
      'scheduled',
      25,
      12,
      30,
      5,
      { min_risk_score: 0, max_risk_score: 50, requires_approval: false, max_price_increase: 5 }
    ),
    // 2. 自动续签 + 进行中（15 天后到期，已触发并完成 2 项检查）
    buildPolicy(
      'rnw-002',
      'mock-003',
      '中关村办公室租赁合同',
      '租赁合同',
      'auto_renew',
      'in_progress',
      15,
      24,
      45,
      3,
      { min_risk_score: 0, max_risk_score: 40, requires_approval: false, max_price_increase: 3 },
      2,
      3
    ),
    // 3. 仅通知 + 已安排（10 天后到期）
    buildPolicy(
      'rnw-003',
      'mock-002',
      'IT基础设施运维服务合同',
      '服务合同',
      'notify_only',
      'scheduled',
      10,
      12,
      30,
      8,
      { min_risk_score: 0, max_risk_score: 60, requires_approval: true, max_price_increase: 8 }
    ),
    // 4. 人工审查 + 进行中（5 天后到期，已触发并完成 3 项检查）
    buildPolicy(
      'rnw-004',
      'mock-008',
      '法律顾问委托合同',
      '委托合同',
      'manual_review',
      'in_progress',
      5,
      12,
      15,
      10,
      { min_risk_score: 0, max_risk_score: 55, requires_approval: true, max_price_increase: 10 },
      3,
      2
    ),
    // 5. 人工审查 + 已逾期（已过期 8 天）
    buildPolicy(
      'rnw-005',
      'mock-004',
      '电子产品销售合同',
      '销售合同',
      'manual_review',
      'overdue',
      -8,
      12,
      30,
      6,
      { min_risk_score: 0, max_risk_score: 50, requires_approval: true, max_price_increase: 6 }
    ),
    // 6. 不续签 + 已完成（已完成续签归档）
    buildPolicy(
      'rnw-006',
      'mock-005',
      '云平台软件采购合同',
      '采购合同',
      'no_renewal',
      'completed',
      -5,
      0,
      60,
      0,
      { min_risk_score: 0, max_risk_score: 30, requires_approval: true, max_price_increase: 0 },
      2,
      5
    ),
  ];
}

// 重新导出标签与配置，方便页面统一引用
export { RENEWAL_STRATEGY_LABELS, RENEWAL_STATUS_CONFIG };
