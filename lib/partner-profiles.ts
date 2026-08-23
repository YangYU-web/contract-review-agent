// ===== 供应商/客户档案管理 =====
// 提供合作方档案管理、信用历史、风险评分计算与统计能力
// 供档案管理 API 与档案管理页面共用

import {
  PartnerProfile,
  PartnerCreditHistory,
  PartnerType,
  PartnerStatus,
  CreditRating,
  PARTNER_TYPE_LABELS,
  PARTNER_STATUS_CONFIG,
  CREDIT_RATING_CONFIG,
} from './types';

// 信用评级对应的基础分（越高代表信用越好，风险越低）
const CREDIT_BASE_SCORE: Record<CreditRating, number> = {
  aaa: 95,
  aa: 88,
  a: 80,
  bbb: 70,
  bb: 60,
  b: 50,
  c: 30,
};

// 信用评级排序权重（用于 minRating 过滤比较）
const CREDIT_RANK: Record<CreditRating, number> = {
  aaa: 7,
  aa: 6,
  a: 5,
  bbb: 4,
  bb: 3,
  b: 2,
  c: 1,
};

// 一天的毫秒数
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// 生成距离今天指定天数的 ISO 时间字符串
function daysAgoISO(days: number): string {
  return new Date(Date.now() - days * ONE_DAY_MS).toISOString();
}

// 生成距离今天指定天数的日期字符串（YYYY-MM-DD）
function daysAgo(days: number): string {
  const d = new Date(Date.now() - days * ONE_DAY_MS);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ===== 风险评分计算 =====

// 综合信用评级、历史合同风险与黑名单等因素计算合作方风险评分（0-100，越高代表风险越高）
export function calculateRiskScore(
  partner: PartnerProfile,
  creditHistory: PartnerCreditHistory[]
): number {
  // 1. 信用评级基础分：评级越好，基础风险分越低
  const baseScore = 100 - CREDIT_BASE_SCORE[partner.credit_rating];

  // 2. 历史合同风险分：平均风险评分的 50% 权重
  const historyRisk = (partner.avg_risk_score || 0) * 0.5;

  // 3. 高风险合同数惩罚：每个高风险合同加 3 分
  const highRiskPenalty = (partner.high_risk_count || 0) * 3;

  // 4. 信用历史负面事件惩罚：每个负面事件加 5 分
  const negativeEvents = creditHistory.filter(
    (h) => h.partner_id === partner.id && h.impact === 'negative'
  ).length;
  const negativePenalty = negativeEvents * 5;

  // 5. 黑名单惩罚：黑名单合作方直接拉高至 90 分以上
  const blacklistPenalty = partner.status === 'blacklisted' ? 40 : 0;

  // 6. 已停用合作方适度加分
  const inactivePenalty = partner.status === 'inactive' ? 10 : 0;

  const raw =
    baseScore +
    historyRisk +
    highRiskPenalty +
    negativePenalty +
    blacklistPenalty +
    inactivePenalty;

  // 限制在 0-100 区间
  return Math.max(0, Math.min(100, Math.round(raw)));
}

// ===== 统计 =====

// 将数值分数映射回最近的信用评级
function scoreToRating(score: number): CreditRating {
  if (score >= 92) return 'aaa';
  if (score >= 85) return 'aa';
  if (score >= 76) return 'a';
  if (score >= 66) return 'bbb';
  if (score >= 56) return 'bb';
  if (score >= 42) return 'b';
  return 'c';
}

// 计算合作方统计信息
export function getPartnerStats(partners: PartnerProfile[]): {
  total: number;
  activeCount: number;
  avgCreditRating: string;
  totalContractValue: number;
  avgRiskScore: number;
  blacklistedCount: number;
} {
  let activeCount = 0;
  let blacklistedCount = 0;
  let totalContractValue = 0;
  let ratingSum = 0;
  let riskScoreSum = 0;

  for (const p of partners) {
    if (p.status === 'active') activeCount += 1;
    if (p.status === 'blacklisted') blacklistedCount += 1;
    totalContractValue += p.total_contract_value || 0;
    ratingSum += CREDIT_BASE_SCORE[p.credit_rating];
    riskScoreSum += p.avg_risk_score || 0;
  }

  // 平均信用评级：将平均分映射回评级标签
  const avgScore = partners.length > 0 ? ratingSum / partners.length : 0;
  const avgRating = scoreToRating(avgScore);

  // 平均风险评分
  const avgRiskScore =
    partners.length > 0
      ? Math.round((riskScoreSum / partners.length) * 10) / 10
      : 0;

  return {
    total: partners.length,
    activeCount,
    avgCreditRating: CREDIT_RATING_CONFIG[avgRating].label,
    totalContractValue,
    avgRiskScore,
    blacklistedCount,
  };
}

// ===== 查询 =====

// 搜索合作方档案：支持关键词搜索与多条件过滤
export function searchPartners(
  partners: PartnerProfile[],
  query: string,
  filters: {
    type?: PartnerType;
    status?: PartnerStatus;
    minRating?: CreditRating;
  }
): PartnerProfile[] {
  const q = query.trim().toLowerCase();

  return partners.filter((p) => {
    // 关键词匹配：名称、联系人、邮箱、行业、法定代表人
    if (q) {
      const haystack = [
        p.name,
        p.contact_person,
        p.contact_email,
        p.industry,
        p.legal_representative,
      ]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }

    // 类型过滤
    if (filters.type && p.type !== filters.type) return false;

    // 状态过滤
    if (filters.status && p.status !== filters.status) return false;

    // 最低信用评级过滤：评级权重 >= minRating 权重
    if (filters.minRating) {
      if (CREDIT_RANK[p.credit_rating] < CREDIT_RANK[filters.minRating]) {
        return false;
      }
    }

    return true;
  });
}

// 根据 ID 查找合作方档案
export function getPartnerById(id: string): PartnerProfile | undefined {
  return getMockPartners().find((p) => p.id === id);
}

// 根据合作方 ID 获取信用历史记录
export function getMockCreditHistory(
  partnerId: string
): PartnerCreditHistory[] {
  return ALL_CREDIT_HISTORIES.filter((h) => h.partner_id === partnerId).sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}

// 返回全部合作方的信用历史记录（供 API 一次性返回）
export function getMockCreditHistories(): PartnerCreditHistory[] {
  return [...ALL_CREDIT_HISTORIES].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}

// ===== 创建合作方 =====

// 基于参数创建一条新的合作方档案
export function createPartner(
  name: string,
  type: PartnerType,
  industry: string,
  contactPerson: string,
  contactEmail: string,
  contactPhone: string,
  options?: {
    registeredCapital?: number;
    currency?: string;
    legalRepresentative?: string;
    address?: string;
    taxId?: string;
    creditRating?: CreditRating;
    establishedDate?: string;
    notes?: string;
  }
): PartnerProfile {
  const now = new Date().toISOString();
  return {
    id: `ptn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    type,
    status: 'active',
    credit_rating: options?.creditRating || 'bbb',
    industry,
    registered_capital: options?.registeredCapital || 0,
    currency: options?.currency || 'CNY',
    legal_representative: options?.legalRepresentative || '',
    contact_person: contactPerson,
    contact_email: contactEmail,
    contact_phone: contactPhone,
    address: options?.address || '',
    tax_id: options?.taxId || '',
    bank_account: undefined,
    contract_count: 0,
    total_contract_value: 0,
    avg_risk_score: 0,
    high_risk_count: 0,
    last_contract_date: '',
    established_date: options?.establishedDate || daysAgo(365),
    notes: options?.notes || '',
    created_at: now,
  };
}

// ===== Mock 数据 =====

// 内部辅助：构造一条合作方档案
function buildPartner(
  id: string,
  name: string,
  type: PartnerType,
  status: PartnerStatus,
  rating: CreditRating,
  industry: string,
  capital: number,
  currency: string,
  legalRep: string,
  contactPerson: string,
  contactEmail: string,
  contactPhone: string,
  address: string,
  taxId: string,
  bankAccount: string | undefined,
  contractCount: number,
  totalValue: number,
  avgRisk: number,
  highRiskCount: number,
  lastContractDays: number,
  establishedDays: number,
  notes: string,
  createdDays: number
): PartnerProfile {
  return {
    id,
    name,
    type,
    status,
    credit_rating: rating,
    industry,
    registered_capital: capital,
    currency,
    legal_representative: legalRep,
    contact_person: contactPerson,
    contact_email: contactEmail,
    contact_phone: contactPhone,
    address,
    tax_id: taxId,
    bank_account: bankAccount,
    contract_count: contractCount,
    total_contract_value: totalValue,
    avg_risk_score: avgRisk,
    high_risk_count: highRiskCount,
    last_contract_date: lastContractDays > 0 ? daysAgo(lastContractDays) : '',
    established_date: daysAgo(establishedDays),
    notes,
    created_at: daysAgoISO(createdDays),
  };
}

// 返回 7 条 Mock 合作方档案，覆盖不同类型、状态与信用评级
export function getMockPartners(): PartnerProfile[] {
  return [
    // 1. 供应商 - 活跃 - AAA（高端制造）
    buildPartner(
      'ptn-001',
      '上海科创制造有限公司',
      'supplier',
      'active',
      'aaa',
      '高端制造',
      50000000,
      'CNY',
      '王建国',
      '李伟',
      'liwei@kechuang-mfg.com',
      '021-55667788',
      '上海市浦东新区张江高科技园区科苑路 88 号',
      '91310115MA1K3X9X0X',
      '6228480402564890018',
      18,
      8650000,
      28,
      1,
      15,
      1095,
      '核心供应商，长期合作，交付稳定。',
      60
    ),
    // 2. 客户 - 活跃 - AA（贸易批发）
    buildPartner(
      'ptn-002',
      '广州迅捷贸易有限公司',
      'customer',
      'active',
      'aa',
      '贸易批发',
      20000000,
      'CNY',
      '陈志强',
      '黄丽娟',
      'huanglj@xunjie-trade.com',
      '020-87654321',
      '广州市天河区珠江新城华夏路 30 号',
      '91440101MA5U8K9X1X',
      '6227001234560098765',
      12,
      3240000,
      35,
      2,
      30,
      730,
      '主要客户，付款及时，信用良好。',
      55
    ),
    // 3. 供应商/客户 - 活跃 - A（IT 服务）
    buildPartner(
      'ptn-003',
      '深圳云图技术服务有限公司',
      'both',
      'active',
      'a',
      'IT 服务',
      15000000,
      'CNY',
      '林晓东',
      '赵敏',
      'zhaomin@yuntu-tech.com',
      '0755-22334455',
      '深圳市南山区科技园南区深南大道 9988 号',
      '91440300MA5F2X9X2X',
      '6225880212345678',
      9,
      1980000,
      42,
      1,
      45,
      540,
      '双向合作方，既采购也销售。',
      40
    ),
    // 4. 供应商 - 已停用 - BBB（软件研发）
    buildPartner(
      'ptn-004',
      '杭州数云科技有限公司',
      'supplier',
      'inactive',
      'bbb',
      '软件研发',
      8000000,
      'CNY',
      '周浩然',
      '孙莉',
      'sunli@shuyun-tech.com',
      '0571-88990011',
      '杭州市余杭区文一西路 969 号',
      '91330110MA2X9X3X4X',
      undefined,
      4,
      960000,
      55,
      2,
      180,
      900,
      '近期合作减少，已暂停新增业务。',
      35
    ),
    // 5. 客户 - 黑名单 - C（物业管理）
    buildPartner(
      'ptn-005',
      '北京海泰置业管理有限公司',
      'customer',
      'blacklisted',
      'c',
      '物业管理',
      12000000,
      'CNY',
      '吴德海',
      '钱多多',
      'qiandd@haitai-prop.com',
      '010-66778899',
      '北京市海淀区中关村大街 18 号',
      '91110108MA1X9X5X6X',
      undefined,
      3,
      480000,
      68,
      2,
      365,
      1200,
      '因多次违约与拖欠款项被列入黑名单。',
      30
    ),
    // 6. 供应商 - 活跃 - BB（物流运输）
    buildPartner(
      'ptn-006',
      '成都西部物流有限公司',
      'supplier',
      'active',
      'bb',
      '物流运输',
      6000000,
      'CNY',
      '郑国华',
      '马晓燕',
      'maxy@xb-logistics.com',
      '028-55443322',
      '成都市高新区天府大道中段 1388 号',
      '91510100MA6X9X7X8X',
      '6217001230045678901',
      6,
      720000,
      48,
      1,
      20,
      480,
      '物流供应商，偶有延误，整体尚可。',
      25
    ),
    // 7. 供应商/客户 - 活跃 - AAA（法律服务）
    buildPartner(
      'ptn-007',
      '北京正义律师事务所',
      'both',
      'active',
      'aaa',
      '法律服务',
      3000000,
      'CNY',
      '刘德华',
      '张静',
      'zhangj@zhengyi-law.com',
      '010-12345678',
      '北京市朝阳区建国门外大街 1 号国贸大厦',
      '91110105MA1X9X9X0X',
      undefined,
      8,
      480000,
      15,
      0,
      10,
      730,
      '长期法律顾问，专业可靠。',
      50
    ),
  ];
}

// ===== 信用历史 Mock 数据 =====

// 全部信用历史记录（每个合作方 3-4 条）
const ALL_CREDIT_HISTORIES: PartnerCreditHistory[] = [
  // ptn-001 上海科创制造有限公司（4 条）
  {
    id: 'ch-001',
    partner_id: 'ptn-001',
    date: daysAgo(720),
    event: '首次合作评级',
    impact: 'neutral',
    rating_before: 'bbb',
    rating_after: 'bbb',
    description: '首次建立合作，初始信用评级 BBB。',
  },
  {
    id: 'ch-002',
    partner_id: 'ptn-001',
    date: daysAgo(400),
    event: '连续准时交付',
    impact: 'positive',
    rating_before: 'bbb',
    rating_after: 'aa',
    description: '连续多次准时交付且质量稳定，信用评级上调至 AA。',
  },
  {
    id: 'ch-003',
    partner_id: 'ptn-001',
    date: daysAgo(120),
    event: '年度综合评估优秀',
    impact: 'positive',
    rating_before: 'aa',
    rating_after: 'aaa',
    description: '年度综合评估优秀，无违约记录，信用评级上调至 AAA。',
  },
  {
    id: 'ch-004',
    partner_id: 'ptn-001',
    date: daysAgo(15),
    event: '续签长期框架协议',
    impact: 'positive',
    rating_before: 'aaa',
    rating_after: 'aaa',
    description: '续签三年期长期框架采购协议，合作关系进一步稳固。',
  },

  // ptn-002 广州迅捷贸易有限公司（3 条）
  {
    id: 'ch-005',
    partner_id: 'ptn-002',
    date: daysAgo(500),
    event: '首次合作评级',
    impact: 'neutral',
    rating_before: 'a',
    rating_after: 'a',
    description: '首次建立合作，初始信用评级 A。',
  },
  {
    id: 'ch-006',
    partner_id: 'ptn-002',
    date: daysAgo(200),
    event: '付款记录良好',
    impact: 'positive',
    rating_before: 'a',
    rating_after: 'aa',
    description: '过去半年付款及时无逾期，信用评级上调至 AA。',
  },
  {
    id: 'ch-007',
    partner_id: 'ptn-002',
    date: daysAgo(30),
    event: '扩大采购规模',
    impact: 'positive',
    rating_before: 'aa',
    rating_after: 'aa',
    description: '本季度采购规模扩大 30%，合作关系稳定。',
  },

  // ptn-003 深圳云图技术服务有限公司（3 条）
  {
    id: 'ch-008',
    partner_id: 'ptn-003',
    date: daysAgo(450),
    event: '首次合作评级',
    impact: 'neutral',
    rating_before: 'bbb',
    rating_after: 'bbb',
    description: '首次建立合作，初始信用评级 BBB。',
  },
  {
    id: 'ch-009',
    partner_id: 'ptn-003',
    date: daysAgo(90),
    event: '扩大合作范围',
    impact: 'positive',
    rating_before: 'bbb',
    rating_after: 'a',
    description: '双方扩大合作范围，增加双向采购，信用评级上调至 A。',
  },
  {
    id: 'ch-010',
    partner_id: 'ptn-003',
    date: daysAgo(20),
    event: '技术交付质量提升',
    impact: 'positive',
    rating_before: 'a',
    rating_after: 'a',
    description: '近期技术交付质量显著提升，客户满意度高。',
  },

  // ptn-004 杭州数云科技有限公司（3 条）
  {
    id: 'ch-011',
    partner_id: 'ptn-004',
    date: daysAgo(600),
    event: '首次合作评级',
    impact: 'neutral',
    rating_before: 'a',
    rating_after: 'a',
    description: '首次建立合作，初始信用评级 A。',
  },
  {
    id: 'ch-012',
    partner_id: 'ptn-004',
    date: daysAgo(300),
    event: '项目延期交付',
    impact: 'negative',
    rating_before: 'a',
    rating_after: 'bbb',
    description: '软件项目多次延期交付，信用评级下调至 BBB。',
  },
  {
    id: 'ch-013',
    partner_id: 'ptn-004',
    date: daysAgo(180),
    event: '暂停新增业务',
    impact: 'negative',
    rating_before: 'bbb',
    rating_after: 'bbb',
    description: '因合作活跃度下降，暂停新增业务，状态变更为已停用。',
  },

  // ptn-005 北京海泰置业管理有限公司（4 条）
  {
    id: 'ch-014',
    partner_id: 'ptn-005',
    date: daysAgo(800),
    event: '首次合作评级',
    impact: 'neutral',
    rating_before: 'bbb',
    rating_after: 'bbb',
    description: '首次建立合作，初始信用评级 BBB。',
  },
  {
    id: 'ch-015',
    partner_id: 'ptn-005',
    date: daysAgo(300),
    event: '拖欠款项',
    impact: 'negative',
    rating_before: 'bbb',
    rating_after: 'bb',
    description: '多次拖欠合同款项，信用评级下调至 BB。',
  },
  {
    id: 'ch-016',
    partner_id: 'ptn-005',
    date: daysAgo(120),
    event: '合同违约',
    impact: 'negative',
    rating_before: 'bb',
    rating_after: 'b',
    description: '发生合同违约事件且拒不赔偿，信用评级降至 B。',
  },
  {
    id: 'ch-017',
    partner_id: 'ptn-005',
    date: daysAgo(60),
    event: '严重违约列入黑名单',
    impact: 'negative',
    rating_before: 'b',
    rating_after: 'c',
    description: '发生严重违约事件，列入合作黑名单，信用评级降至 C。',
  },

  // ptn-006 成都西部物流有限公司（3 条）
  {
    id: 'ch-018',
    partner_id: 'ptn-006',
    date: daysAgo(400),
    event: '首次合作评级',
    impact: 'neutral',
    rating_before: 'bbb',
    rating_after: 'bbb',
    description: '首次建立合作，初始信用评级 BBB。',
  },
  {
    id: 'ch-019',
    partner_id: 'ptn-006',
    date: daysAgo(150),
    event: '服务稳定期',
    impact: 'positive',
    rating_before: 'bbb',
    rating_after: 'bbb',
    description: '物流服务整体稳定，准时率达标。',
  },
  {
    id: 'ch-020',
    partner_id: 'ptn-006',
    date: daysAgo(30),
    event: '物流延误',
    impact: 'negative',
    rating_before: 'bbb',
    rating_after: 'bb',
    description: '近期出现两次物流延误，信用评级下调至 BB。',
  },

  // ptn-007 北京正义律师事务所（3 条）
  {
    id: 'ch-021',
    partner_id: 'ptn-007',
    date: daysAgo(600),
    event: '首次合作评级',
    impact: 'neutral',
    rating_before: 'aa',
    rating_after: 'aa',
    description: '首次建立合作，初始信用评级 AA。',
  },
  {
    id: 'ch-022',
    partner_id: 'ptn-007',
    date: daysAgo(200),
    event: '专业服务获认可',
    impact: 'positive',
    rating_before: 'aa',
    rating_after: 'aaa',
    description: '法律服务质量获高度认可，信用评级上调至 AAA。',
  },
  {
    id: 'ch-023',
    partner_id: 'ptn-007',
    date: daysAgo(10),
    event: '续签顾问合同',
    impact: 'positive',
    rating_before: 'aaa',
    rating_after: 'aaa',
    description: '续签常年法律顾问合同，合作关系稳固。',
  },
];

// 重新导出标签与配置，方便页面统一引用
export {
  PARTNER_TYPE_LABELS,
  PARTNER_STATUS_CONFIG,
  CREDIT_RATING_CONFIG,
};
