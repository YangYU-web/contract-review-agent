// ===== 法规变更监控模块 =====
// 跟踪法规变更对存量合同的影响，提供 Mock 数据、合规差距、统计与影响评估
// 供法规监控 API 与法规监控页面共用

import {
  RegulatoryChange,
  AffectedContract,
  RegulatoryComplianceGap,
  RegulatoryChangeType,
  RegulatoryImpactLevel,
  RegulatoryStatus,
  REGULATORY_CHANGE_TYPE_LABELS,
  REGULATORY_IMPACT_CONFIG,
  REGULATORY_STATUS_CONFIG,
} from './types';

// 生成相对今天指定天数的日期字符串（YYYY-MM-DD）
function dateStr(daysOffset: number): string {
  const d = new Date(Date.now() + daysOffset * 24 * 60 * 60 * 1000);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// 影响等级排序权重（critical → none）
const IMPACT_ORDER: RegulatoryImpactLevel[] = [
  'critical',
  'high',
  'medium',
  'low',
  'none',
];

// ===== Mock 法规变更数据 =====
// 返回 6 条模拟法规变更，覆盖 new_law / amendment / repeal / interpretation / guideline
// 覆盖中国大陆、欧盟、美国等司法管辖区，覆盖 critical / high / medium / low 影响等级
// 覆盖 monitoring / assessing / action_required / compliant 状态
export function getMockRegulatoryChanges(): RegulatoryChange[] {
  return [
    // 1) 新法规 · 数据保护 · 严重影响 · 需行动
    {
      id: 'reg-001',
      title: '《个人信息保护法实施条例》正式发布',
      type: 'new_law',
      jurisdiction: '中国大陆',
      effective_date: dateStr(45),
      published_date: dateStr(-12),
      summary:
        '条例进一步细化个人信息处理的最小必要原则、跨境传输安全评估与个人信息影响评估要求，明确数据处理者需在条例生效前完成存量合同的数据处理合规整改。',
      full_text_url: 'http://example.gov.cn/pipl/implementation-regulation',
      affected_areas: ['数据保护', '隐私合规', '信息安全', '跨境传输'],
      impact_level: 'critical',
      status: 'action_required',
      deadline: dateStr(30),
      affected_contracts: [
        {
          contract_id: 'CON-2026-0312',
          contract_title: '云服务外包协议',
          impact_description: '涉及客户数据云端存储与跨境传输，需补充数据本地化存储与安全评估条款。',
          action_required: 'amend',
          urgency: 'immediate',
        },
        {
          contract_id: 'CON-2026-0510',
          contract_title: '技术开发合作协议',
          impact_description: '联合开发过程中共享个人信息，需明确双方作为共同处理者的权利义务。',
          action_required: 'amend',
          urgency: 'immediate',
        },
        {
          contract_id: 'CON-2026-0601',
          contract_title: '人力资源服务合同',
          impact_description: '员工个人信息处理需取得单独同意，建议增补个人信息保护附件。',
          action_required: 'monitor',
          urgency: 'short_term',
        },
      ],
      recommended_actions: [
        '梳理所有涉及个人信息处理的合同，建立数据资产台账。',
        '对跨境传输合同补充数据出境安全评估或标准合同备案条款。',
        '在相关合同中增设个人信息影响评估（PIA）义务与违约责任。',
        '组织业务与法务团队开展条例专项培训，明确整改时间表。',
      ],
    },
    // 2) 修正案 · 人工智能 · 较大影响 · 评估中
    {
      id: 'reg-002',
      title: '欧盟《人工智能法案》高风险AI系统合规要求生效',
      type: 'amendment',
      jurisdiction: '欧盟',
      effective_date: dateStr(90),
      published_date: dateStr(-30),
      summary:
        '修正案对高风险AI系统引入透明度、人工监督、技术与文件要求，供应商与部署方均需履行合规义务，违规将面临高额罚款。',
      full_text_url: 'http://example.eu/ai-act/amendment-2026',
      affected_areas: ['数据保护', '人工智能', '知识产权', '产品合规'],
      impact_level: 'high',
      status: 'assessing',
      affected_contracts: [
        {
          contract_id: 'CON-2026-0510',
          contract_title: '技术开发合作协议',
          impact_description: '合作开发的AI模型可能被认定为高风险系统，需补充合规义务与责任分担条款。',
          action_required: 'renegotiate',
          urgency: 'short_term',
        },
        {
          contract_id: 'CON-2026-0312',
          contract_title: '云服务外包协议',
          impact_description: '若部署方向欧盟用户提供AI服务，需满足部署方合规义务。',
          action_required: 'amend',
          urgency: 'short_term',
        },
      ],
      recommended_actions: [
        '识别合同涉及AI系统的风险等级，完成分级标注。',
        '补充AI系统透明度、技术文件与人工监督义务条款。',
        '明确违规情形下的责任分担与赔偿上限。',
      ],
    },
    // 3) 司法解释 · 劳动法 · 中等影响 · 监控中
    {
      id: 'reg-003',
      title: '最高人民法院关于审理劳动争议案件适用法律若干问题的解释（三）',
      type: 'interpretation',
      jurisdiction: '中国大陆',
      effective_date: dateStr(15),
      published_date: dateStr(-5),
      summary:
        '司法解释进一步明确竞业限制的范围、经济补偿标准与违约金调整规则，对劳务派遣与灵活用工的劳动关系认定作出指引。',
      affected_areas: ['劳动法', '用工合规', '竞业限制'],
      impact_level: 'medium',
      status: 'monitoring',
      affected_contracts: [
        {
          contract_id: 'CON-2026-0601',
          contract_title: '人力资源服务合同',
          impact_description: '劳务派遣用工关系认定标准变化，需复核派遣协议合规性。',
          action_required: 'amend',
          urgency: 'short_term',
        },
        {
          contract_id: 'CON-2026-0228',
          contract_title: '核心员工竞业限制协议',
          impact_description: '竞业限制范围与补偿标准需调整，避免被认定无效。',
          action_required: 'amend',
          urgency: 'short_term',
        },
        {
          contract_id: 'CON-2026-0701',
          contract_title: '灵活用工服务框架协议',
          impact_description: '劳动关系认定指引更新，需评估是否存在事实劳动关系风险。',
          action_required: 'monitor',
          urgency: 'long_term',
        },
      ],
      recommended_actions: [
        '复核现有竞业限制协议的范围与经济补偿标准。',
        '梳理劳务派遣合同，确认用工合规性。',
        '评估灵活用工合同被认定为劳动关系的风险敞口。',
      ],
    },
    // 4) 指导方针 · 知识产权 · 轻微影响 · 已合规
    {
      id: 'reg-004',
      title: 'US ICTS Supply Chain Rule · 信息通信技术与服务供应链审查指南',
      type: 'guideline',
      jurisdiction: '美国',
      effective_date: dateStr(120),
      published_date: dateStr(-20),
      summary:
        '指南对涉及外国对手的信息通信技术与服务供应链交易给出审查指引，建议企业对高风险供应商建立尽职调查与替代方案。',
      full_text_url: 'http://example.us/icts/supply-chain-guideline',
      affected_areas: ['知识产权', '出口管制', '供应链', '国家安全'],
      impact_level: 'low',
      status: 'compliant',
      affected_contracts: [
        {
          contract_id: 'CON-2026-0401',
          contract_title: 'XX产品采购合同',
          impact_description: '若供应商涉及受限地区，需补充供应链尽职调查条款。',
          action_required: 'no_action',
          urgency: 'long_term',
        },
        {
          contract_id: 'CON-2026-0312',
          contract_title: '云服务外包协议',
          impact_description: '云服务商供应链来源需关注，建议保留替代方案权利。',
          action_required: 'monitor',
          urgency: 'long_term',
        },
      ],
      recommended_actions: [
        '建立供应商尽职调查清单，定期评估供应链风险。',
        '在采购合同中保留因合规原因变更供应商的权利。',
        '关注后续正式立法动态，及时更新合规要求。',
      ],
    },
    // 5) 废止 · 税法 · 中等影响 · 需行动
    {
      id: 'reg-005',
      title: '《增值税法》正式实施，原《增值税暂行条例》同时废止',
      type: 'repeal',
      jurisdiction: '中国大陆',
      effective_date: dateStr(60),
      published_date: dateStr(-40),
      summary:
        '增值税法将征收率、抵扣规则与跨境服务税收处理予以法定化，原暂行条例及其配套文件同步废止，企业需在过渡期内更新合同涉税条款与发票管理流程。',
      affected_areas: ['税法', '发票管理', '跨境交易', '合同定价'],
      impact_level: 'medium',
      status: 'action_required',
      deadline: dateStr(50),
      affected_contracts: [
        {
          contract_id: 'CON-2026-0401',
          contract_title: 'XX产品采购合同',
          impact_description: '含税价与不含税价表述需统一更新，避免抵扣争议。',
          action_required: 'amend',
          urgency: 'short_term',
        },
        {
          contract_id: 'CON-2026-0228',
          contract_title: '办公场地租赁合同',
          impact_description: '租赁服务税收处理调整，需复核租金税收承担条款。',
          action_required: 'amend',
          urgency: 'short_term',
        },
      ],
      recommended_actions: [
        '统一合同中含税价/不含税价表述与发票类型要求。',
        '复核跨境服务合同的代扣代缴义务与税收承担条款。',
        '更新发票管理与合同模板，确保过渡期内合规。',
        '与财务部门对齐过渡期申报与开票流程。',
      ],
    },
    // 6) 修正案 · 合同法 · 较大影响 · 监控中
    {
      id: 'reg-006',
      title: '《民法典合同编通则司法解释》对格式条款的新规',
      type: 'amendment',
      jurisdiction: '中国大陆',
      effective_date: dateStr(20),
      published_date: dateStr(-15),
      summary:
        '司法解释细化格式条款的提示说明义务、不合理免责条款的认定标准与效力规则，对面向不特定相对人的标准合同文本影响显著。',
      affected_areas: ['合同法', '格式条款', '消费者保护', '违约责任'],
      impact_level: 'high',
      status: 'monitoring',
      affected_contracts: [
        {
          contract_id: 'CON-2026-0312',
          contract_title: '云服务外包协议',
          impact_description: '服务条款中存在格式免责条款，需评估提示说明义务履行情况。',
          action_required: 'amend',
          urgency: 'short_term',
        },
        {
          contract_id: 'CON-2026-0801',
          contract_title: '标准化服务订购协议',
          impact_description: '面向不特定用户的标准条款需重新审查不合理免责条款。',
          action_required: 'amend',
          urgency: 'immediate',
        },
        {
          contract_id: 'CON-2026-0601',
          contract_title: '人力资源服务合同',
          impact_description: '部分条款可能被认定为格式条款，建议补充协商记录。',
          action_required: 'monitor',
          urgency: 'long_term',
        },
      ],
      recommended_actions: [
        '审查标准合同文本中的格式条款，排查不合理免责条款。',
        '完善格式条款的提示与说明义务履行证据链。',
        '在标准合同中增设协商确认与特别提示条款。',
      ],
    },
  ];
}

// ===== Mock 合规差距数据 =====
// 返回 4 条模拟合规差距，标识存量合同与法规要求的差距
export function getMockComplianceGaps(): RegulatoryComplianceGap[] {
  return [
    {
      contract_id: 'CON-2026-0312',
      contract_title: '云服务外包协议',
      gap_description: '缺少数据跨境传输安全评估或标准合同备案条款。',
      current_clause: '乙方应采取合理措施保障数据安全。',
      required_clause:
        '乙方在向境外提供个人信息前，应依法完成数据出境安全评估或订立标准合同并备案。',
      regulation_reference: '《个人信息保护法实施条例》第38-40条',
    },
    {
      contract_id: 'CON-2026-0510',
      contract_title: '技术开发合作协议',
      gap_description: '未明确AI系统风险等级与合规义务分担。',
      current_clause: '双方共同拥有合作开发成果的知识产权。',
      required_clause:
        '双方应识别AI系统风险等级并履行透明度、技术文件与人工监督义务，违规责任按过错比例分担。',
      regulation_reference: '欧盟《人工智能法案》修正案（2026）',
    },
    {
      contract_id: 'CON-2026-0228',
      contract_title: '核心员工竞业限制协议',
      gap_description: '竞业限制范围过宽、经济补偿低于法定下限。',
      current_clause: '员工离职后两年内不得从事同类业务，补偿为月薪30%。',
      required_clause:
        '竞业限制范围应与员工接触的商业秘密相适应，经济补偿不低于离职前十二个月平均工资的30%且不低于法定标准。',
      regulation_reference: '劳动争议司法解释（三）',
    },
    {
      contract_id: 'CON-2026-0401',
      contract_title: 'XX产品采购合同',
      gap_description: '含税价表述不统一，可能引发增值税抵扣争议。',
      current_clause: '合同总价为人民币100万元。',
      required_clause:
        '合同不含税总价为人民币88.50万元，增值税税率为13%，含税总价为人民币100.00万元，乙方应开具合规增值税专用发票。',
      regulation_reference: '《增值税法》（2026）',
    },
  ];
}

// ===== 法规变更统计 =====
// 基于变更列表汇总统计：总数、严重影响、需行动、已合规、即将到期、受影响合同数
export function getRegulatoryStats(changes: RegulatoryChange[]): {
  total: number;
  critical: number;
  actionRequired: number;
  compliant: number;
  upcomingDeadlines: number;
  affectedContracts: number;
} {
  const now = Date.now();
  // 受影响合同去重统计
  const contractSet = new Set<string>();
  for (const c of changes) {
    for (const ac of c.affected_contracts) {
      contractSet.add(ac.contract_id);
    }
  }

  return {
    total: changes.length,
    critical: changes.filter((c) => c.impact_level === 'critical').length,
    actionRequired: changes.filter((c) => c.status === 'action_required').length,
    compliant: changes.filter((c) => c.status === 'compliant').length,
    upcomingDeadlines: changes.filter(
      (c) => c.deadline && new Date(c.deadline).getTime() >= now
    ).length,
    affectedContracts: contractSet.size,
  };
}

// ===== 影响等级评估 =====
// 模拟对指定合同类型的影响评估：基于法规影响等级与合同类型敏感度综合判定
export function assessImpact(
  change: RegulatoryChange,
  contractType: string
): RegulatoryImpactLevel {
  // 合同类型 → 敏感法规领域映射
  const sensitivity: Record<string, string[]> = {
    采购合同: ['税法', '发票管理', '供应链', '出口管制', '合同定价'],
    服务合同: ['劳动法', '用工合规', '数据保护', '隐私合规'],
    租赁合同: ['税法', '合同法', '合同定价'],
    技术开发合同: ['知识产权', '数据保护', '人工智能', '产品合规'],
    咨询服务合同: ['劳动法', '数据保护', '隐私合规', '竞业限制'],
    人力资源服务合同: ['劳动法', '用工合规', '竞业限制'],
  };

  const sensitiveAreas = sensitivity[contractType] || [];
  const matchCount = change.affected_areas.filter((a) =>
    sensitiveAreas.includes(a)
  ).length;

  // 基础等级 + 敏感度提升
  const baseIdx = IMPACT_ORDER.indexOf(change.impact_level);
  let idx = baseIdx >= 0 ? baseIdx : 3; // 默认 low
  if (matchCount >= 2) idx = Math.min(idx + 1, IMPACT_ORDER.length - 1);
  if (matchCount >= 3) idx = Math.min(idx + 1, IMPACT_ORDER.length - 1);
  // 无敏感领域匹配时降级一档
  if (matchCount === 0 && idx < IMPACT_ORDER.length - 1) {
    idx = Math.max(idx - 1, 0);
  }

  return IMPACT_ORDER[idx];
}

// 重新导出配置与标签，方便页面统一引用
export {
  REGULATORY_CHANGE_TYPE_LABELS,
  REGULATORY_IMPACT_CONFIG,
  REGULATORY_STATUS_CONFIG,
};
