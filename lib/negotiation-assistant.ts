// ===== 合同谈判助手 =====
// 提供谈判会话管理、谈判力分析、ZOPA 计算、反建议生成能力
// 供谈判助手 API 与谈判助手页面共用

import {
  NegotiationSession,
  NegotiationPosition,
  NegotiationPoint,
  AgreedTerm,
  Concession,
  NegotiationAnalysis,
  NegotiationStatus,
  NegotiationStance,
  ConcessionType,
  NEGOTIATION_STATUS_CONFIG,
  CONCESSION_TYPE_LABELS,
} from './types';

// 一天的毫秒数
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// 生成距离今天指定天数的 ISO 时间字符串
function daysAgoISO(days: number): string {
  return new Date(Date.now() - days * ONE_DAY_MS).toISOString();
}

// ===== 谈判力分析 =====

// 分析谈判会话：评估平衡度、杠杆、ZOPA 与破裂风险
export function analyzeNegotiation(
  session: NegotiationSession
): NegotiationAnalysis {
  const analysis = session.ai_analysis;

  // 综合评估：根据平衡分数生成总体评估文案
  let overallAssessment = analysis.overall_assessment;
  if (analysis.balance_score >= 75) {
    overallAssessment =
      '谈判态势对我方有利，我方在关键条款上占据主导地位，建议把握节奏推进收尾。';
  } else if (analysis.balance_score >= 50) {
    overallAssessment =
      '谈判双方势均力敌，核心利益基本平衡，建议聚焦未决条款继续推进。';
  } else if (analysis.balance_score >= 30) {
    overallAssessment =
      '谈判态势偏向对方，我方在多项条款上处于被动，建议重新评估 BATNA 并调整策略。';
  } else {
    overallAssessment =
      '谈判形势对我方不利，对方在大部分条款上占据优势，破裂风险较高，建议考虑替代方案。';
  }

  // 破裂风险：平衡分数越低，风险越高；停滞状态额外加分
  let riskOfBreakdown = analysis.risk_of_breakdown;
  if (session.status === 'stalled') {
    riskOfBreakdown = Math.min(90, riskOfBreakdown + 20);
  } else if (session.status === 'agreed') {
    riskOfBreakdown = 5;
  } else if (session.status === 'draft') {
    riskOfBreakdown = Math.min(80, riskOfBreakdown + 10);
  }

  return {
    overall_assessment: overallAssessment,
    balance_score: analysis.balance_score,
    our_leverage: analysis.our_leverage,
    their_leverage: analysis.their_leverage,
    recommendations: analysis.recommendations,
    batna: analysis.batna,
    zone_of_possible_agreement: analysis.zone_of_possible_agreement,
    risk_of_breakdown: riskOfBreakdown,
  };
}

// ===== 统计 =====

// 统计谈判会话概况
export function getNegotiationStats(sessions: NegotiationSession[]): {
  total: number;
  inProgress: number;
  agreed: number;
  avgBalanceScore: number;
  totalConcessionsValue: number;
  stalledCount: number;
} {
  let inProgress = 0;
  let agreed = 0;
  let stalledCount = 0;
  let balanceSum = 0;
  let totalConcessionsValue = 0;

  for (const s of sessions) {
    // 状态计数
    if (s.status === 'in_progress') inProgress += 1;
    if (s.status === 'agreed') agreed += 1;
    if (s.status === 'stalled') stalledCount += 1;

    // 平衡分累计
    balanceSum += s.ai_analysis.balance_score;

    // 让步价值累计
    for (const c of s.concessions) {
      totalConcessionsValue += c.estimated_value;
    }
  }

  return {
    total: sessions.length,
    inProgress,
    agreed,
    avgBalanceScore:
      sessions.length > 0 ? Math.round(balanceSum / sessions.length) : 0,
    totalConcessionsValue,
    stalledCount,
  };
}

// ===== 反建议生成 =====

// 根据条款与立场生成 AI 反建议文本
export function generateCounterProposal(point: NegotiationPoint): string {
  const stanceTexts: Record<NegotiationStance, string> = {
    accept: '我方原则接受该条款',
    counter: '我方提出以下反建议',
    reject: '我方无法接受该条款',
    conditional: '我方有条件接受该条款',
  };

  const prefix = stanceTexts[point.stance];

  // 根据立场生成不同反建议文案
  switch (point.stance) {
    case 'accept':
      return `${prefix}。关于「${point.clause}」，我方认可对方提案「${point.their_proposal}」的核心内容，建议在此基础上进一步明确执行细节与验收标准，确保双方权责对等。理由：${point.rationale}`;

    case 'counter':
      return `${prefix}。关于「${point.clause}」，对方提案为「${point.their_proposal}」，我方原提案为「${point.our_proposal}」。综合考虑双方诉求，建议折中方案：在对方提案基础上调整关键参数，同时引入分阶段履行与违约对冲机制，以平衡双方风险。理由：${point.rationale}`;

    case 'reject':
      return `${prefix}。关于「${point.clause}」，对方提案「${point.their_proposal}」与我方核心利益存在根本冲突，我方坚持「${point.our_proposal}」。若对方无法调整，建议将该条款列为待定项，转而优先推进其他共识条款。理由：${point.rationale}`;

    case 'conditional':
      return `${prefix}。关于「${point.clause}」，我方可在满足以下条件时接受对方提案「${point.their_proposal}」：一是增设履约保证金或第三方担保；二是明确触发条件与退出机制；三是约定分阶段验收与付款节点。理由：${point.rationale}`;

    default:
      return `${prefix}。关于「${point.clause}」，请结合双方立场进一步协商。`;
  }
}

// ===== Mock 数据构建辅助 =====

// 构建谈判立场（必须项、期望项、底线项）
function buildPosition(
  mustHaves: NegotiationPoint[],
  niceToHaves: NegotiationPoint[],
  dealBreakers: NegotiationPoint[]
): NegotiationPosition {
  return { must_haves: mustHaves, nice_to_haves: niceToHaves, deal_breakers: dealBreakers };
}

// 构建谈判分析
function buildAnalysis(
  overallAssessment: string,
  balanceScore: number,
  ourLeverage: string[],
  theirLeverage: string[],
  recommendations: string[],
  batna: string,
  zopaMin: number,
  zopaMax: number,
  riskOfBreakdown: number
): NegotiationAnalysis {
  return {
    overall_assessment: overallAssessment,
    balance_score: balanceScore,
    our_leverage: ourLeverage,
    their_leverage: theirLeverage,
    recommendations: recommendations,
    batna: batna,
    zone_of_possible_agreement: { min: zopaMin, max: zopaMax },
    risk_of_breakdown: riskOfBreakdown,
  };
}

// ===== Mock 数据 =====

// 返回 5 条 Mock 谈判会话，覆盖草稿、谈判中、已达成、停滞等不同状态
export function getMockNegotiationSessions(): NegotiationSession[] {
  return [
    // 1. 云计算服务采购合同 —— 谈判中（我方略占优势）
    {
      id: 'neg-001',
      contract_id: 'mock-009',
      contract_title: '云计算服务采购合同',
      counterparty: '上海智云科技有限公司',
      status: 'in_progress',
      round: 3,
      started_at: daysAgoISO(14),
      last_updated: daysAgoISO(1),
      our_position: buildPosition(
        [
          {
            id: 'pt-001',
            clause: '服务等级协议（SLA）',
            our_proposal: '可用性不低于 99.95%，每月可用性低于 99.9% 按比例退款',
            their_proposal: '可用性不低于 99.9%，每月可用性低于 99.5% 按比例退款',
            stance: 'counter',
            rationale: '核心业务对服务连续性要求极高，99.95% 为行业高标准',
            priority: 'critical',
          },
          {
            id: 'pt-002',
            clause: '数据安全与保密',
            our_proposal: '数据存储于境内，加密传输，禁止跨境传输',
            their_proposal: '数据可跨境传输，符合 GDPR 即可',
            stance: 'reject',
            rationale: '涉及客户敏感数据，受《数据安全法》约束，不可跨境',
            priority: 'critical',
          },
        ],
        [
          {
            id: 'pt-003',
            clause: '技术支持响应时间',
            our_proposal: '7×24 小时，严重故障 15 分钟响应',
            their_proposal: '工作日 9×8 小时，严重故障 2 小时响应',
            stance: 'counter',
            rationale: '期望获得更优支持，非核心条款可适当让步',
            priority: 'medium',
          },
          {
            id: 'pt-003b',
            clause: '容量弹性扩容',
            our_proposal: '支持秒级扩容，按实际用量计费',
            their_proposal: '扩容需提前申请，按包月计费',
            stance: 'conditional',
            rationale: '业务存在突发流量，弹性扩容可降低成本',
            priority: 'medium',
          },
        ],
        [
          {
            id: 'pt-004',
            clause: '知识产权归属',
            our_proposal: '定制开发成果归我方所有',
            their_proposal: '所有成果归服务方所有，我方仅获使用权',
            stance: 'reject',
            rationale: '定制开发投入由我方承担，知识产权必须归属我方',
            priority: 'critical',
          },
          {
            id: 'pt-004b',
            clause: '数据锁定与迁移',
            our_proposal: '合同终止后免费提供数据导出与迁移支持',
            their_proposal: '数据导出需额外付费，迁移不提供支持',
            stance: 'reject',
            rationale: '数据锁定会导致供应商依赖，必须保障退出权',
            priority: 'critical',
          },
        ]
      ),
      their_position: buildPosition(
        [
          {
            id: 'pt-005',
            clause: '合同总价',
            their_proposal: '年费 480 万元，不含额外服务',
            our_proposal: '年费 380 万元，包含全部服务',
            stance: 'counter',
            rationale: '基于行业基准与服务范围定价',
            priority: 'critical',
          },
          {
            id: 'pt-006',
            clause: '合同期限',
            their_proposal: '5 年期，锁定价格',
            our_proposal: '1 年期，逐年续签',
            stance: 'counter',
            rationale: '长期合同可摊薄成本，保证收益稳定性',
            priority: 'high',
          },
        ],
        [
          {
            id: 'pt-007',
            clause: '增值服务',
            their_proposal: '免费提供季度架构评估',
            our_proposal: '按需付费获取增值服务',
            stance: 'accept',
            rationale: '增值服务可增加客户粘性',
            priority: 'medium',
          },
          {
            id: 'pt-007b',
            clause: '技术培训',
            their_proposal: '提供 2 次免费技术培训',
            our_proposal: '要求不限次数培训',
            stance: 'conditional',
            rationale: '培训有助于客户更好地使用平台',
            priority: 'low',
          },
        ],
        [
          {
            id: 'pt-008',
            clause: '自动续签条款',
            their_proposal: '到期自动续签 3 年，价格上浮 10%',
            our_proposal: '到期手动续签，价格维持不变',
            stance: 'reject',
            rationale: '自动续签限制客户选择权，不可接受',
            priority: 'critical',
          },
          {
            id: 'pt-008b',
            clause: '竞业限制',
            their_proposal: '服务期内不得使用竞争对手云平台',
            our_proposal: '保留多云策略，不限制供应商选择',
            stance: 'reject',
            rationale: '多云策略为业务连续性保障，不接受排他限制',
            priority: 'critical',
          },
        ]
      ),
      agreed_terms: [
        {
          id: 'at-001',
          clause: '付款方式',
          agreed_text: '按季度预付，首期款在合同签署后 15 个工作日内支付',
          original_gap: '我方要求月付，对方要求年付',
          round_agreed: 2,
        },
        {
          id: 'at-002',
          clause: '验收标准',
          agreed_text: '部署完成后 30 天内完成验收，验收标准以技术附件为准',
          original_gap: '验收周期与标准存在分歧',
          round_agreed: 2,
        },
      ],
      concessions: [
        {
          id: 'cs-001',
          type: 'price',
          description: '对方将年费从 480 万降至 440 万',
          given_by: 'them',
          estimated_value: 400000,
          trade_off: '我方同意将合同期限从 1 年延长至 3 年',
          round: 2,
        },
        {
          id: 'cs-002',
          type: 'payment_terms',
          description: '我方同意从月付调整为季付',
          given_by: 'us',
          estimated_value: 50000,
          trade_off: '对方同意提供更灵活的扩容选项',
          round: 2,
        },
        {
          id: 'cs-003',
          type: 'warranty',
          description: '对方将服务可用性从 99.9% 提升至 99.95%',
          given_by: 'them',
          estimated_value: 120000,
          trade_off: '我方同意超出部分按标准费率计费',
          round: 3,
        },
        {
          id: 'cs-004',
          type: 'delivery',
          description: '对方承诺部署周期缩短至 30 天',
          given_by: 'them',
          estimated_value: 80000,
          trade_off: '我方提前支付首期款',
          round: 3,
        },
      ],
      ai_analysis: buildAnalysis(
        '谈判态势对我方有利，对方在价格与可用性上已做出让步，建议把握节奏推进收尾。',
        68,
        [
          '我方为战略客户，采购规模具有议价优势',
          '市场存在多家云服务商，可随时切换',
          '数据安全合规要求为我方提供谈判筹码',
          '对方急需大客户案例拓展行业影响力',
        ],
        [
          '对方技术方案在特定领域具有稀缺性',
          '长期合同锁定对方收益预期',
          '对方拥有成熟的迁移工具，切换成本可控',
          '对方在知识产权条款上态度强硬',
        ],
        [
          '聚焦 SLA 与数据安全条款，争取在第三轮达成共识',
          '以合同期限让步换取知识产权归属的灵活性',
          '引入第三方安全审计条款增强数据保护',
          '设定退出机制，避免长期锁定风险',
        ],
        '可选择华为云或阿里云作为替代方案，迁移周期约 45 天，成本增加约 15%',
        3800000,
        4400000,
        30,
      ),
    },

    // 2. 办公设备租赁合同 —— 已达成（双赢局面）
    {
      id: 'neg-002',
      contract_id: 'mock-010',
      contract_title: '办公设备租赁合同',
      counterparty: '北京恒达办公设备有限公司',
      status: 'agreed',
      round: 4,
      started_at: daysAgoISO(21),
      last_updated: daysAgoISO(2),
      our_position: buildPosition(
        [
          {
            id: 'pt-009',
            clause: '设备维护责任',
            our_proposal: '出租方负责全部维护与更换',
            their_proposal: '出租方负责重大维修，日常维护由承租方承担',
            stance: 'counter',
            rationale: '租赁模式下维护应由出租方负责',
            priority: 'high',
          },
          {
            id: 'pt-010',
            clause: '租金调整机制',
            our_proposal: '租金 3 年固定不变',
            their_proposal: '每年按 CPI 上浮 3%-5%',
            stance: 'reject',
            rationale: '固定租金有利于预算控制',
            priority: 'critical',
          },
        ],
        [
          {
            id: 'pt-011',
            clause: '设备升级',
            our_proposal: '每 18 个月免费升级一次',
            their_proposal: '升级需额外付费',
            stance: 'conditional',
            rationale: '期望获得设备更新，可适当延长租期',
            priority: 'medium',
          },
          {
            id: 'pt-011b',
            clause: '安装调试服务',
            our_proposal: '对方负责全部安装调试与培训',
            their_proposal: '仅提供基础安装，调试由我方完成',
            stance: 'conditional',
            rationale: '专业安装可减少设备故障率',
            priority: 'low',
          },
        ],
        [
          {
            id: 'pt-012',
            clause: '提前终止罚金',
            our_proposal: '提前 30 天通知即可终止',
            their_proposal: '提前终止需支付剩余租金 50% 罚金',
            stance: 'reject',
            rationale: '高额罚金限制经营灵活性',
            priority: 'critical',
          },
          {
            id: 'pt-012b',
            clause: '设备质量保证',
            our_proposal: '设备使用年限不低于 5 年，故障率低于 2%',
            their_proposal: '设备按现状提供，不承诺使用年限',
            stance: 'reject',
            rationale: '设备质量直接影响办公效率，必须保障',
            priority: 'high',
          },
        ]
      ),
      their_position: buildPosition(
        [
          {
            id: 'pt-013',
            clause: '租赁期限',
            their_proposal: '最低 5 年起租',
            our_proposal: '2 年起租',
            stance: 'counter',
            rationale: '设备折旧周期较长，需长期回收成本',
            priority: 'high',
          },
          {
            id: 'pt-013b',
            clause: '最低租赁数量',
            their_proposal: '最低租赁 100 台设备',
            our_proposal: '按实际需求租赁 50 台',
            stance: 'counter',
            rationale: '需保证最低出货量以摊薄物流成本',
            priority: 'high',
          },
        ],
        [
          {
            id: 'pt-014',
            clause: '押金',
            their_proposal: '3 个月租金押金',
            our_proposal: '1 个月租金押金',
            stance: 'conditional',
            rationale: '押金可降低违约风险',
            priority: 'medium',
          },
          {
            id: 'pt-014b',
            clause: '保险费用',
            their_proposal: '由承租方购买设备保险',
            our_proposal: '由出租方承担保险费用',
            stance: 'conditional',
            rationale: '设备保险可覆盖意外损坏风险',
            priority: 'low',
          },
        ],
        [
          {
            id: 'pt-015',
            clause: '设备损坏赔偿',
            their_proposal: '人为损坏按原价赔偿',
            our_proposal: '按折旧后价值赔偿',
            stance: 'reject',
            rationale: '原价赔偿不合理，应考虑折旧',
            priority: 'critical',
          },
          {
            id: 'pt-015b',
            clause: '转租限制',
            their_proposal: '禁止将设备转租给第三方',
            our_proposal: '允许关联公司间调配使用',
            stance: 'reject',
            rationale: '集团内调配为正常经营需求，不应限制',
            priority: 'high',
          },
        ]
      ),
      agreed_terms: [
        {
          id: 'at-003',
          clause: '租赁期限',
          agreed_text: '租期 3 年，到期可续签，续签价格不变',
          original_gap: '我方要求 2 年，对方要求 5 年',
          round_agreed: 2,
        },
        {
          id: 'at-004',
          clause: '维护责任',
          agreed_text: '出租方负责全部维护与更换，响应时间不超过 4 小时',
          original_gap: '日常维护责任归属存在分歧',
          round_agreed: 3,
        },
        {
          id: 'at-005',
          clause: '租金调整',
          agreed_text: '3 年内租金固定，第 4 年起按 CPI 调整，上限 3%',
          original_gap: '我方要求固定租金，对方要求每年上调',
          round_agreed: 4,
        },
      ],
      concessions: [
        {
          id: 'cs-005',
          type: 'price',
          description: '对方将月租金从 8 万降至 7.2 万',
          given_by: 'them',
          estimated_value: 96000,
          trade_off: '我方同意将租期从 2 年延长至 3 年',
          round: 2,
        },
        {
          id: 'cs-006',
          type: 'scope',
          description: '我方同意增加 20 台设备',
          given_by: 'us',
          estimated_value: 60000,
          trade_off: '对方提供免费的设备升级服务',
          round: 3,
        },
        {
          id: 'cs-007',
          type: 'liability',
          description: '设备损坏赔偿按折旧计算',
          given_by: 'them',
          estimated_value: 40000,
          trade_off: '我方提高押金至 2 个月租金',
          round: 4,
        },
      ],
      ai_analysis: buildAnalysis(
        '谈判双方势均力敌，核心利益基本平衡，建议聚焦未决条款继续推进。',
        72,
        [
          '我方采购量较大，具有规模议价优势',
          '市场上办公设备租赁供应商充足',
          '我方信用评级良好，违约风险低',
          '对方亟需拓展大型企业客户',
        ],
        [
          '对方设备品牌具有市场认可度',
          '对方维护网络覆盖广泛',
          '长期租约保障对方稳定收益',
        ],
        [
          '以租期延长换取租金优惠与维护责任',
          '引入设备升级条款提升长期价值',
          '明确赔偿标准避免后续争议',
          '设定续签条款锁定长期合作',
        ],
        '可选择其他 3 家设备租赁公司，价格相当，迁移成本约 2 万元',
        70000,
        80000,
        15,
      ),
    },

    // 3. 软件定制开发合同 —— 谈判中（双方胶着）
    {
      id: 'neg-003',
      contract_id: 'mock-011',
      contract_title: '软件定制开发合同',
      counterparty: '深圳创新软件有限公司',
      status: 'in_progress',
      round: 5,
      started_at: daysAgoISO(30),
      last_updated: daysAgoISO(3),
      our_position: buildPosition(
        [
          {
            id: 'pt-016',
            clause: '交付里程碑',
            our_proposal: '分 4 个里程碑交付，每阶段验收后付款',
            their_proposal: '整体交付，验收通过后一次性付款',
            stance: 'counter',
            rationale: '分阶段交付可控制风险，确保质量',
            priority: 'critical',
          },
          {
            id: 'pt-017',
            clause: '源代码交付',
            our_proposal: '全部源代码及文档随交付移交',
            their_proposal: '仅交付编译后程序，源代码另购',
            stance: 'reject',
            rationale: '定制开发必须包含源代码，否则无法自主维护',
            priority: 'critical',
          },
        ],
        [
          {
            id: 'pt-018',
            clause: '后期维护',
            our_proposal: '免费维护 12 个月',
            their_proposal: '免费维护 3 个月',
            stance: 'counter',
            rationale: '期望获得更长维护期保障稳定性',
            priority: 'medium',
          },
          {
            id: 'pt-018b',
            clause: '技术文档完整性',
            our_proposal: '提供完整设计文档、接口文档与操作手册',
            their_proposal: '仅提供基本操作手册',
            stance: 'counter',
            rationale: '完整文档有利于后续自主运维',
            priority: 'medium',
          },
        ],
        [
          {
            id: 'pt-019',
            clause: '违约责任上限',
            our_proposal: '违约赔偿无上限',
            their_proposal: '违约赔偿上限为合同总额 10%',
            stance: 'reject',
            rationale: '低额上限无法覆盖因延期造成的业务损失',
            priority: 'critical',
          },
          {
            id: 'pt-019b',
            clause: '第三方代码安全',
            our_proposal: '禁止使用存在已知漏洞的开源组件',
            their_proposal: '由开发方自行选择技术栈',
            stance: 'reject',
            rationale: '第三方组件漏洞可能导致系统安全风险',
            priority: 'critical',
          },
        ]
      ),
      their_position: buildPosition(
        [
          {
            id: 'pt-020',
            clause: '项目总价',
            their_proposal: '总价 280 万元',
            our_proposal: '总价 200 万元',
            stance: 'counter',
            rationale: '基于人月成本与项目复杂度定价',
            priority: 'critical',
          },
          {
            id: 'pt-021',
            clause: '需求变更',
            their_proposal: '需求变更需额外计费',
            our_proposal: '合理范围内需求变更免费',
            stance: 'counter',
            rationale: '需求变更增加开发成本与周期',
            priority: 'high',
          },
        ],
        [
          {
            id: 'pt-022',
            clause: '团队配置',
            their_proposal: '配置 1 名项目经理与 5 名开发',
            our_proposal: '配置 1 名项目经理与 8 名开发',
            stance: 'conditional',
            rationale: '可按需调整团队规模',
            priority: 'medium',
          },
          {
            id: 'pt-022b',
            clause: '开发环境',
            their_proposal: '使用开发方自有开发环境',
            our_proposal: '使用我方提供的开发环境',
            stance: 'accept',
            rationale: '自有环境可保障代码安全与合规',
            priority: 'low',
          },
        ],
        [
          {
            id: 'pt-023',
            clause: '知识产权',
            their_proposal: '底层框架知识产权归开发方',
            our_proposal: '全部知识产权归我方',
            stance: 'reject',
            rationale: '底层框架为通用产品，不可转让',
            priority: 'critical',
          },
          {
            id: 'pt-023b',
            clause: '保密期限',
            their_proposal: '保密义务仅限合同期内',
            our_proposal: '保密义务延续至合同终止后 5 年',
            stance: 'reject',
            rationale: '商业秘密保护不应因合同终止而失效',
            priority: 'high',
          },
        ]
      ),
      agreed_terms: [
        {
          id: 'at-006',
          clause: '开发范围',
          agreed_text: '包含需求分析、设计、开发、测试、部署全流程',
          original_gap: '开发范围边界不清晰',
          round_agreed: 2,
        },
        {
          id: 'at-007',
          clause: '技术标准',
          agreed_text: '采用 React + Node.js 技术栈，符合企业架构规范',
          original_gap: '技术方案存在分歧',
          round_agreed: 3,
        },
      ],
      concessions: [
        {
          id: 'cs-008',
          type: 'payment_terms',
          description: '我方同意从一次性付款改为分 4 期付款',
          given_by: 'us',
          estimated_value: 100000,
          trade_off: '对方同意分阶段交付与验收',
          round: 3,
        },
        {
          id: 'cs-009',
          type: 'price',
          description: '对方将总价从 280 万降至 250 万',
          given_by: 'them',
          estimated_value: 300000,
          trade_off: '我方同意免费维护期从 12 个月缩短至 6 个月',
          round: 4,
        },
        {
          id: 'cs-010',
          type: 'scope',
          description: '我方同意需求变更在 10% 范围内免费',
          given_by: 'us',
          estimated_value: 80000,
          trade_off: '对方同意提供额外的技术培训',
          round: 4,
        },
        {
          id: 'cs-011',
          type: 'liability',
          description: '对方将违约上限从 10% 提升至 20%',
          given_by: 'them',
          estimated_value: 150000,
          trade_off: '我方同意缩短验收周期',
          round: 5,
        },
      ],
      ai_analysis: buildAnalysis(
        '谈判双方势均力敌，核心利益基本平衡，建议聚焦未决条款继续推进。',
        52,
        [
          '我方项目预算充足，可灵活调整',
          '市场上软件开发服务商众多',
          '我方拥有详细的需求文档，降低对方开发风险',
          '对方希望树立行业标杆案例',
        ],
        [
          '对方在特定技术领域具有稀缺经验',
          '对方团队规模与交付能力经过验证',
          '需求变更为对方提供了成本弹性',
          '底层框架为对方核心资产，难以让步',
        ],
        [
          '在源代码与知识产权上寻求折中：业务代码归我方，底层框架授权使用',
          '以维护期让步换取违约责任的提升',
          '引入第三方代码托管确保源代码交付',
          '明确需求变更的量化标准与计费规则',
        ],
        '可选择另外 2 家软件开发公司，报价约 230 万，交付周期多 2 个月',
        2000000,
        2600000,
        45,
      ),
    },

    // 4. 物流配送服务合同 —— 停滞（谈判陷入僵局）
    {
      id: 'neg-004',
      contract_id: 'mock-012',
      contract_title: '物流配送服务合同',
      counterparty: '广州速达物流股份有限公司',
      status: 'stalled',
      round: 6,
      started_at: daysAgoISO(45),
      last_updated: daysAgoISO(10),
      our_position: buildPosition(
        [
          {
            id: 'pt-024',
            clause: '配送时效',
            our_proposal: '同城 24 小时，跨省 72 小时',
            their_proposal: '同城 48 小时，跨省 120 小时',
            stance: 'counter',
            rationale: '电商业务对时效要求严格，影响客户体验',
            priority: 'critical',
          },
          {
            id: 'pt-025',
            clause: '赔偿标准',
            our_proposal: '丢损按商品售价全额赔偿',
            their_proposal: '丢损按运费 3 倍赔偿',
            stance: 'reject',
            rationale: '运费倍数赔偿远低于商品实际价值',
            priority: 'critical',
          },
        ],
        [
          {
            id: 'pt-026',
            clause: '增值服务',
            our_proposal: '免费提供仓储管理与数据分析',
            their_proposal: '增值服务单独计费',
            stance: 'conditional',
            rationale: '期望获得一站式服务，可适当增加费用',
            priority: 'medium',
          },
          {
            id: 'pt-026b',
            clause: '逆向物流',
            our_proposal: '退换货由对方上门取件，费用由对方承担',
            their_proposal: '退换货由寄件方自行寄回',
            stance: 'conditional',
            rationale: '便捷的逆向物流可提升客户满意度',
            priority: 'medium',
          },
        ],
        [
          {
            id: 'pt-027',
            clause: '排他条款',
            our_proposal: '我方可同时使用多家物流',
            their_proposal: '要求排他合作，禁止使用其他物流',
            stance: 'reject',
            rationale: '排他条款限制供应链灵活性，风险过高',
            priority: 'critical',
          },
          {
            id: 'pt-027b',
            clause: '旺季运力保障',
            our_proposal: '旺季保证优先配送，不限单量',
            their_proposal: '旺季按运量分配运力，不保证优先',
            stance: 'reject',
            rationale: '旺季为销售高峰，运力保障直接影响营收',
            priority: 'critical',
          },
        ]
      ),
      their_position: buildPosition(
        [
          {
            id: 'pt-028',
            clause: '服务费率',
            their_proposal: '按商品价值 8% 收取',
            our_proposal: '按商品价值 5% 收取',
            stance: 'counter',
            rationale: '高时效与全额赔偿增加运营成本',
            priority: 'critical',
          },
          {
            id: 'pt-029',
            clause: '最低运量保证',
            their_proposal: '月最低运量 10 万单',
            our_proposal: '不设最低运量保证',
            stance: 'counter',
            rationale: '需保证运量以摊薄固定成本',
            priority: 'high',
          },
        ],
        [
          {
            id: 'pt-030',
            clause: '系统对接',
            their_proposal: '提供标准 API 免费对接',
            our_proposal: '要求定制化系统对接',
            stance: 'accept',
            rationale: '标准 API 可快速上线',
            priority: 'medium',
          },
          {
            id: 'pt-030b',
            clause: '品牌露出',
            their_proposal: '要求包裹印有物流方品牌标识',
            our_proposal: '仅使用我方品牌包装',
            stance: 'conditional',
            rationale: '品牌露出可增加对方曝光度',
            priority: 'low',
          },
        ],
        [
          {
            id: 'pt-031',
            clause: '价格调整',
            their_proposal: '每年可上调费率 5%',
            our_proposal: '3 年内费率固定',
            stance: 'reject',
            rationale: '费率上调影响成本可控性',
            priority: 'critical',
          },
          {
            id: 'pt-031b',
            clause: '账期限制',
            their_proposal: '要求预付运费，不支持账期',
            our_proposal: '月结 30 天账期',
            stance: 'reject',
            rationale: '预付模式增加资金占用，影响现金流',
            priority: 'high',
          },
        ]
      ),
      agreed_terms: [
        {
          id: 'at-008',
          clause: '服务区域',
          agreed_text: '覆盖全国 31 个省市自治区，含港澳台',
          original_gap: '服务覆盖范围存在分歧',
          round_agreed: 2,
        },
        {
          id: 'at-009',
          clause: '系统对接',
          agreed_text: '采用标准 API 对接，对方免费提供技术支持',
          original_gap: '系统对接方式与费用存在分歧',
          round_agreed: 3,
        },
      ],
      concessions: [
        {
          id: 'cs-012',
          type: 'price',
          description: '对方将费率从 8% 降至 6.5%',
          given_by: 'them',
          estimated_value: 200000,
          trade_off: '我方同意设置月最低运量 5 万单',
          round: 3,
        },
        {
          id: 'cs-013',
          type: 'delivery',
          description: '对方承诺同城时效提升至 36 小时',
          given_by: 'them',
          estimated_value: 60000,
          trade_off: '我方同意支付加急服务费',
          round: 4,
        },
        {
          id: 'cs-014',
          type: 'liability',
          description: '对方将丢损赔偿提升至运费 5 倍',
          given_by: 'them',
          estimated_value: 100000,
          trade_off: '我方同意购买物流保险分担风险',
          round: 5,
        },
        {
          id: 'cs-015',
          type: 'scope',
          description: '对方同意提供基础仓储管理',
          given_by: 'them',
          estimated_value: 80000,
          trade_off: '我方同意签订 2 年期合同',
          round: 5,
        },
      ],
      ai_analysis: buildAnalysis(
        '谈判形势对我方不利，对方在大部分条款上占据优势，破裂风险较高，建议考虑替代方案。',
        38,
        [
          '我方日均运量较大，具有规模优势',
          '物流市场竞品众多，替代方案丰富',
          '电商旺季运量可带来额外收益',
        ],
        [
          '对方拥有全国性配送网络，覆盖优势明显',
          '对方仓储资源稀缺，切换成本较高',
          '对方在排他条款上态度强硬',
          '旺季运力紧张，对方掌握运力分配权',
        ],
        [
          '考虑引入第二家物流商打破排他僵局',
          '以运量保证换取费率优惠与赔偿提升',
          '将赔偿标准与保险机制结合，降低对方风险',
          '设定谈判期限，避免无限期拖延',
        ],
        '可选择顺丰或京东物流，费率约 6%，时效更优但旺季运力受限',
        50000,
        70000,
        65,
      ),
    },

    // 5. 市场营销服务合同 —— 草稿（谈判尚未正式启动）
    {
      id: 'neg-005',
      contract_id: 'mock-013',
      contract_title: '市场营销服务合同',
      counterparty: '杭州创想营销策划有限公司',
      status: 'draft',
      round: 1,
      started_at: daysAgoISO(5),
      last_updated: daysAgoISO(2),
      our_position: buildPosition(
        [
          {
            id: 'pt-032',
            clause: '服务费模式',
            our_proposal: '基础服务费 + 绩效提成',
            their_proposal: '固定月费模式',
            stance: 'counter',
            rationale: '绩效提成模式可激励服务商提升效果',
            priority: 'high',
          },
          {
            id: 'pt-033',
            clause: '数据归属',
            our_proposal: '所有营销数据归我方所有',
            their_proposal: '数据双方共享，各有使用权',
            stance: 'reject',
            rationale: '客户数据为核心资产，必须独占',
            priority: 'critical',
          },
        ],
        [
          {
            id: 'pt-034',
            clause: '团队驻场',
            our_proposal: '核心成员驻场办公',
            their_proposal: '远程办公为主',
            stance: 'conditional',
            rationale: '驻场可提升沟通效率，可适当灵活',
            priority: 'medium',
          },
          {
            id: 'pt-034b',
            clause: '创意审核权',
            our_proposal: '所有创意方案需经我方审核后发布',
            their_proposal: '按月度计划批量发布，无需逐条审核',
            stance: 'conditional',
            rationale: '品牌形象需统一管控，但可优化审核流程',
            priority: 'medium',
          },
        ],
        [
          {
            id: 'pt-035',
            clause: '竞业限制',
            our_proposal: '服务期内不得服务同行业竞品',
            their_proposal: '仅承诺不泄露商业机密',
            stance: 'reject',
            rationale: '同行业服务存在利益冲突',
            priority: 'critical',
          },
          {
            id: 'pt-035b',
            clause: '效果承诺',
            our_proposal: '未达约定 KPI 按比例退还服务费',
            their_proposal: '不承诺具体效果，按投入工时计费',
            stance: 'reject',
            rationale: '无效果承诺的营销服务缺乏 accountability',
            priority: 'high',
          },
        ]
      ),
      their_position: buildPosition(
        [
          {
            id: 'pt-036',
            clause: '合同金额',
            their_proposal: '月费 30 万元，年付',
            our_proposal: '月费 20 万元，月付',
            stance: 'counter',
            rationale: '基于团队成本与服务范围定价',
            priority: 'high',
          },
          {
            id: 'pt-036b',
            clause: '素材制作费',
            their_proposal: '视频拍摄与设计费用另计',
            our_proposal: '全部素材制作包含在月费中',
            stance: 'counter',
            rationale: '高质量素材制作成本较高，需单独核算',
            priority: 'high',
          },
        ],
        [
          {
            id: 'pt-037',
            clause: '合作期限',
            their_proposal: '合作 12 个月',
            our_proposal: '合作 6 个月试运行',
            stance: 'conditional',
            rationale: '长期合作可保证团队稳定性',
            priority: 'medium',
          },
          {
            id: 'pt-037b',
            clause: '资源投入',
            their_proposal: '配置专职客户经理与策划团队',
            our_proposal: '要求配置总监级人员把关',
            stance: 'conditional',
            rationale: '专职团队可保障服务质量',
            priority: 'low',
          },
        ],
        [
          {
            id: 'pt-038',
            clause: '知识产权',
            their_proposal: '营销方案知识产权归策划方',
            our_proposal: '全部知识产权归我方',
            stance: 'reject',
            rationale: '营销方案为定制成果，知识产权应归属客户',
            priority: 'critical',
          },
          {
            id: 'pt-038b',
            clause: '案例使用权',
            their_proposal: '有权将合作案例用于对外宣传',
            our_proposal: '未经许可不得公开合作信息',
            stance: 'reject',
            rationale: '合作信息涉及商业策略，不应公开披露',
            priority: 'high',
          },
        ]
      ),
      agreed_terms: [
        {
          id: 'at-010',
          clause: '服务范围',
          agreed_text: '包含品牌策划、内容营销、社交媒体运营与数据分析',
          original_gap: '服务范围边界待明确',
          round_agreed: 1,
        },
        {
          id: 'at-011',
          clause: '汇报机制',
          agreed_text: '每周提交进度报告，每月召开复盘会议',
          original_gap: '汇报频率与形式需统一',
          round_agreed: 1,
        },
      ],
      concessions: [
        {
          id: 'cs-016',
          type: 'payment_terms',
          description: '我方同意从月付调整为季付',
          given_by: 'us',
          estimated_value: 30000,
          trade_off: '对方同意提供月度免费策略咨询',
          round: 1,
        },
        {
          id: 'cs-017',
          type: 'scope',
          description: '对方增加数据分析服务',
          given_by: 'them',
          estimated_value: 50000,
          trade_off: '我方同意延长合作期至 9 个月',
          round: 1,
        },
        {
          id: 'cs-018',
          type: 'warranty',
          description: '对方承诺核心成员稳定性',
          given_by: 'them',
          estimated_value: 20000,
          trade_off: '我方同意不强制要求驻场',
          round: 1,
        },
      ],
      ai_analysis: buildAnalysis(
        '谈判双方势均力敌，核心利益基本平衡，建议聚焦未决条款继续推进。',
        60,
        [
          '我方品牌预算充足，合作吸引力强',
          '营销服务商市场竞争激烈',
          '我方拥有丰富用户数据，赋能营销效果',
        ],
        [
          '对方在快消行业具有成功案例',
          '对方创意团队具有稀缺性',
          '长期合作保障对方团队投入',
          '对方在知识产权条款上坚持立场',
        ],
        [
          '以绩效提成模式激励对方提升效果',
          '数据归属与竞业限制为底线，不可让步',
          '在合作期限上寻求折中，设试用期',
          '明确知识产权分层：定制成果归我方，通用方法归对方',
        ],
        '可选择另外 3 家营销公司，报价约 25 万/月，行业经验略逊',
        200000,
        280000,
        25,
      ),
    },
  ];
}

// 重新导出标签与配置，方便页面统一引用
export { NEGOTIATION_STATUS_CONFIG, CONCESSION_TYPE_LABELS };
