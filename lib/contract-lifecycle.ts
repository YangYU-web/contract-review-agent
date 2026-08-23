// ===== 合同到期管理 / 生命周期模块 =====
// 合同生命周期状态计算、到期提醒与货币格式化

import { ContractLifecycle, ContractLifecycleStatus, LIFECYCLE_STATUS_CONFIG } from './types';

// 一天的毫秒数
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// 计算距离到期日的剩余天数（向上取整，已过期为负数）
function calculateDaysUntilExpiry(endDate: string): number {
  const now = new Date();
  const end = new Date(endDate);
  const diffMs = end.getTime() - now.getTime();
  return Math.ceil(diffMs / ONE_DAY_MS);
}

// 根据结束日期与是否自动续签计算生命周期状态
export function calculateLifecycleStatus(
  endDate: string,
  autoRenew: boolean
): ContractLifecycleStatus {
  const days = calculateDaysUntilExpiry(endDate);

  // 已过期且未自动续签 → expired
  if (days < 0 && !autoRenew) {
    return 'expired';
  }
  // 30天内到期 → expiring_soon
  if (days >= 0 && days <= 30) {
    return 'expiring_soon';
  }
  // 否则 → active
  return 'active';
}

// 获取即将到期的合同列表（默认30天内）
export function getExpiringSoon(
  lifecycles: ContractLifecycle[],
  days: number = 30
): ContractLifecycle[] {
  return lifecycles
    .filter((l) => {
      if (l.status === 'terminated') return false;
      return l.days_until_expiry >= 0 && l.days_until_expiry <= days;
    })
    .sort((a, b) => a.days_until_expiry - b.days_until_expiry);
}

// 货币格式化
export function formatCurrency(value?: number, currency?: string): string {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return '-';
  }
  const symbols: Record<string, string> = {
    CNY: '¥',
    USD: '$',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
  };
  const symbol = symbols[currency || 'CNY'] || (currency ? currency + ' ' : '¥');
  return `${symbol}${value.toLocaleString('zh-CN')}`;
}

// 生成距离今天指定天数的日期字符串（YYYY-MM-DD）
function daysFromNow(days: number): string {
  const d = new Date(Date.now() + days * ONE_DAY_MS);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// 原始 Mock 数据（不含 status / days_until_expiry，由后续计算填充）
interface RawLifecycle {
  id: string;
  contract_id: string;
  contract_title: string;
  contract_type: string;
  party_a: string;
  party_b: string;
  start_date: string;
  end_date: string;
  auto_renew: boolean;
  renewal_notice_days: number;
  value?: number;
  currency?: string;
  // 强制指定状态（用于 terminated 等无法通过日期推导的状态）
  force_status?: ContractLifecycleStatus;
}

const RAW_LIFECYCLES: RawLifecycle[] = [
  {
    id: 'lc-001',
    contract_id: 'mock-001',
    contract_title: 'XX产品年度采购合同',
    contract_type: '采购合同',
    party_a: '北京智链科技有限公司',
    party_b: '上海科创制造有限公司',
    start_date: daysFromNow(-180),
    end_date: daysFromNow(200),
    auto_renew: false,
    renewal_notice_days: 60,
    value: 580000,
    currency: 'CNY',
  },
  {
    id: 'lc-002',
    contract_id: 'mock-002',
    contract_title: 'IT基础设施运维服务合同',
    contract_type: '服务合同',
    party_a: '北京智链科技有限公司',
    party_b: '深圳云图技术服务有限公司',
    start_date: daysFromNow(-355),
    end_date: daysFromNow(10),
    auto_renew: false,
    renewal_notice_days: 30,
    value: 360000,
    currency: 'CNY',
  },
  {
    id: 'lc-003',
    contract_id: 'mock-003',
    contract_title: '中关村办公室租赁合同',
    contract_type: '租赁合同',
    party_a: '北京智链科技有限公司',
    party_b: '北京海泰置业管理有限公司',
    start_date: daysFromNow(-340),
    end_date: daysFromNow(25),
    auto_renew: true,
    renewal_notice_days: 45,
    value: 960000,
    currency: 'CNY',
  },
  {
    id: 'lc-004',
    contract_id: 'mock-004',
    contract_title: '电子产品销售合同',
    contract_type: '销售合同',
    party_a: '北京智链科技有限公司',
    party_b: '广州迅捷贸易有限公司',
    start_date: daysFromNow(-395),
    end_date: daysFromNow(-30),
    auto_renew: false,
    renewal_notice_days: 30,
    value: 1200000,
    currency: 'CNY',
  },
  {
    id: 'lc-005',
    contract_id: 'mock-005',
    contract_title: '云平台软件采购合同',
    contract_type: '采购合同',
    party_a: '北京智链科技有限公司',
    party_b: '杭州数云科技有限公司',
    start_date: daysFromNow(-370),
    end_date: daysFromNow(-5),
    auto_renew: true,
    renewal_notice_days: 60,
    value: 240000,
    currency: 'CNY',
  },
  {
    id: 'lc-006',
    contract_id: 'mock-006',
    contract_title: '员工竞业限制与保密协议',
    contract_type: '保密协议',
    party_a: '北京智链科技有限公司',
    party_b: '李某（员工）',
    start_date: daysFromNow(-400),
    end_date: daysFromNow(365),
    force_status: 'terminated',
    auto_renew: false,
    renewal_notice_days: 30,
  },
  {
    id: 'lc-007',
    contract_id: 'mock-007',
    contract_title: '高级管理人员劳动合同',
    contract_type: '劳动合同',
    party_a: '北京智链科技有限公司',
    party_b: '王某（高管）',
    start_date: daysFromNow(-100),
    end_date: daysFromNow(500),
    auto_renew: false,
    renewal_notice_days: 30,
    value: 720000,
    currency: 'CNY',
  },
  {
    id: 'lc-008',
    contract_id: 'mock-008',
    contract_title: '法律顾问委托合同',
    contract_type: '委托合同',
    party_a: '北京智链科技有限公司',
    party_b: '北京正义律师事务所',
    start_date: daysFromNow(-360),
    end_date: daysFromNow(3),
    auto_renew: false,
    renewal_notice_days: 15,
    value: 80000,
    currency: 'CNY',
  },
];

// 返回 Mock 合同生命周期数据（每次调用都重新计算状态与剩余天数）
export function getMockLifecycles(): ContractLifecycle[] {
  return RAW_LIFECYCLES.map((raw) => {
    const status: ContractLifecycleStatus = raw.force_status
      ?? calculateLifecycleStatus(raw.end_date, raw.auto_renew);
    const days_until_expiry = calculateDaysUntilExpiry(raw.end_date);
    return {
      id: raw.id,
      contract_id: raw.contract_id,
      contract_title: raw.contract_title,
      contract_type: raw.contract_type,
      party_a: raw.party_a,
      party_b: raw.party_b,
      start_date: raw.start_date,
      end_date: raw.end_date,
      status,
      auto_renew: raw.auto_renew,
      renewal_notice_days: raw.renewal_notice_days,
      value: raw.value,
      currency: raw.currency,
      days_until_expiry,
    };
  });
}

// 重新导出状态配置，方便页面统一引用
export { LIFECYCLE_STATUS_CONFIG };
