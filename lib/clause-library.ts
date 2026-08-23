// ===== 智能条款库 =====
// 提供可复用的标准条款模板，支持变量替换、分类筛选、全文搜索、
// 条款推荐与统计聚合。演示模式下条款存储在内存中。

import {
  ClauseLibraryItem,
  ClauseVariable,
  AlternativeClause,
  ClauseRecommendation,
  ClauseCategory,
  ClauseRiskLevel,
  ClauseSource,
  CLAUSE_CATEGORY_LABELS,
  CLAUSE_RISK_CONFIG,
  CLAUSE_SOURCE_LABELS,
} from './types';

// ===== 模拟条款数据 =====
// 覆盖全部 10 个条款分类，共 13 条标准条款
export function getMockClauses(): ClauseLibraryItem[] {
  return [
    // ===== 付款条款（2 条） =====
    {
      id: 'clause-payment-standard',
      title: '标准付款条款',
      category: 'payment',
      risk_level: 'low',
      source: 'standard',
      text: '甲方应于收到乙方开具的合规发票后 {{payment_days}} 日内，通过银行转账方式向乙方支付 {{payment_amount}}。乙方指定收款账户信息详见本合同附件。若甲方逾期付款，每逾期一日应按未付金额的 {{late_fee_rate}} 向乙方支付违约金。',
      variables: [
        { name: 'payment_days', type: 'number', default_value: '30', required: true, description: '甲方收到发票后的付款天数' },
        { name: 'payment_amount', type: 'currency', default_value: '合同总金额', required: true, description: '本次应支付的款项金额' },
        { name: 'late_fee_rate', type: 'percentage', default_value: '0.05%', required: true, description: '逾期付款每日违约金比例' },
        { name: 'invoice_type', type: 'choice', default_value: '增值税专用发票', required: true, options: ['增值税专用发票', '增值税普通发票', '电子发票'], description: '乙方需开具的发票类型' },
      ],
      applicable_contracts: ['采购合同', '服务合同', '租赁合同', '加工承揽合同'],
      jurisdictions: ['中国大陆'],
      tags: ['付款', '银行转账', '发票', '违约金'],
      favor_count: 128,
      usage_count: 542,
      last_updated: '2025-09-12',
      alternative_versions: [
        {
          id: 'alt-payment-standard-strict',
          label: '严格版（偏向乙方）',
          text: '甲方应于收到发票后 {{payment_days}} 日内足额支付款项，逾期超过 {{grace_days}} 日的，乙方有权暂停后续供货并要求支付全部未结款项。',
          risk_level: 'medium',
          advantage: '保护乙方回款权益，约束甲方付款节奏',
          disadvantage: '付款时限偏紧，甲方资金压力较大',
        },
        {
          id: 'alt-payment-standard-lenient',
          label: '宽松版（偏向甲方）',
          text: '甲方收到发票并经内部审批后 {{payment_days}} 日内安排付款。因甲方内部流程导致延误的，不视为违约。',
          risk_level: 'low',
          advantage: '给予甲方充足的资金安排空间',
          disadvantage: '付款时间不确定，乙方回款风险上升',
        },
      ],
      risk_notes: '需明确付款起算时点（发票送达日 vs 收到日），避免起算争议；建议设置合理的逾期违约金上限。',
      negotiation_tips: '可争取将付款天数从30日延长至45-60日；逾期违约金比例建议封顶为未付金额的20%。',
    },
    {
      id: 'clause-payment-installment',
      title: '分期付款条款',
      category: 'payment',
      risk_level: 'medium',
      source: 'best_practice',
      text: '本合同总价款 {{total_amount}} 分 {{installment_count}} 期支付：首期预付款 {{prepayment_ratio}} 于合同签订后 {{prepay_days}} 日内支付；进度款按交付节点分期支付，每期 {{progress_amount}}；尾款 {{final_ratio}} 于验收合格后 {{final_days}} 日内付清。任一期逾期超过 {{overdue_days}} 日的，乙方有权中止后续履行。',
      variables: [
        { name: 'total_amount', type: 'currency', default_value: '0', required: true, description: '合同总价款' },
        { name: 'installment_count', type: 'number', default_value: '3', required: true, description: '分期总期数' },
        { name: 'prepayment_ratio', type: 'percentage', default_value: '30%', required: true, description: '预付款占总价比例' },
        { name: 'prepay_days', type: 'number', default_value: '7', required: true, description: '签订后预付款支付天数' },
        { name: 'final_ratio', type: 'percentage', default_value: '20%', required: true, description: '尾款占总价比例' },
      ],
      applicable_contracts: ['采购合同', '工程合同', '服务合同', '技术开发合同'],
      jurisdictions: ['中国大陆'],
      tags: ['分期付款', '预付款', '进度款', '尾款'],
      favor_count: 96,
      usage_count: 318,
      last_updated: '2025-10-05',
      alternative_versions: [
        {
          id: 'alt-payment-installment-milestone',
          label: '里程碑付款版',
          text: '付款按项目里程碑触发：需求确认支付 {{milestone1_ratio}}，开发完成支付 {{milestone2_ratio}}，验收通过支付尾款。',
          risk_level: 'medium',
          advantage: '与交付进度挂钩，降低一方垫资风险',
          disadvantage: '里程碑定义需明确，否则易生争议',
        },
        {
          id: 'alt-payment-installment-high-prepay',
          label: '高预付版（偏向乙方）',
          text: '合同签订后支付预付款 {{high_prepay_ratio}}，发货前结清全款。甲方未按时付款的，乙方有权延迟发货。',
          risk_level: 'high',
          advantage: '乙方资金回笼快，履约风险低',
          disadvantage: '甲方预付比例高，存在对方违约后追偿风险',
        },
      ],
      risk_notes: '分期方案需与交付节点严格对应；高预付款比例时建议增设担保或留置条款以对冲对方违约风险。',
      negotiation_tips: '争取降低预付款比例至20%以下；要求尾款比例不低于10%-15%以确保交付质量。',
    },

    // ===== 交付条款（1 条） =====
    {
      id: 'clause-delivery-acceptance',
      title: '交付与验收条款',
      category: 'delivery',
      risk_level: 'medium',
      source: 'standard',
      text: '乙方应于 {{delivery_date}} 前将 {{delivery_subject}} 交付至甲方指定地点 {{delivery_location}}，运输费用由 {{freight_bearer}} 承担。甲方应在收货后 {{inspection_days}} 个工作日内完成验收并出具验收结论。验收不合格的，乙方应在 {{remedy_days}} 日内免费更换或修复。',
      variables: [
        { name: 'delivery_date', type: 'date', default_value: '2025-12-31', required: true, description: '约定交付截止日期' },
        { name: 'delivery_subject', type: 'text', default_value: '合同标的物', required: true, description: '交付标的名称' },
        { name: 'delivery_location', type: 'text', default_value: '甲方仓库', required: true, description: '交付目的地' },
        { name: 'freight_bearer', type: 'choice', default_value: '乙方', required: true, options: ['甲方', '乙方', '双方各半'], description: '运输费用承担方' },
        { name: 'inspection_days', type: 'number', default_value: '5', required: true, description: '验收工作日天数' },
      ],
      applicable_contracts: ['采购合同', '加工承揽合同', '工程合同', '设备买卖合同'],
      jurisdictions: ['中国大陆'],
      tags: ['交付', '验收', '运输', '更换'],
      favor_count: 142,
      usage_count: 610,
      last_updated: '2025-08-20',
      alternative_versions: [
        {
          id: 'alt-delivery-tight',
          label: '紧凑交付版（偏向甲方）',
          text: '乙方应于 {{delivery_date}} 前完成交付，逾期每日按合同总额 {{penalty_rate}} 支付违约金，逾期超过 {{max_overdue}} 日甲方可解除合同。',
          risk_level: 'high',
          advantage: '强约束交付时效，保障甲方项目进度',
          disadvantage: '乙方履约压力大，可能推高报价',
        },
        {
          id: 'alt-delivery-flexible',
          label: '弹性交付版（偏向乙方）',
          text: '乙方在合理期限内安排交付，遇不可抗力或甲方原因延误的，交付期限顺延。',
          risk_level: 'low',
          advantage: '乙方交付灵活性高，成本可控',
          disadvantage: '交付时点不确定，甲方排期风险高',
        },
      ],
      risk_notes: '须明确交付定义（到货 vs 安装完成）、验收标准与异议期；未约定异议期可能视为验收合格。',
      negotiation_tips: '争取将"视为验收合格"的默认期限缩短；要求分阶段验收以分摊风险。',
    },

    // ===== 保修条款（1 条） =====
    {
      id: 'clause-warranty-quality',
      title: '质量保证与保修条款',
      category: 'warranty',
      risk_level: 'low',
      source: 'best_practice',
      text: '乙方保证所交付的 {{warranty_subject}} 符合国家标准及甲方技术要求。质保期为验收合格后 {{warranty_months}} 个月，质保期内出现质量问题的，乙方应在接到通知后 {{response_days}} 日内免费维修或更换。因质量问题造成的损失，乙方应承担相应赔偿责任。',
      variables: [
        { name: 'warranty_subject', type: 'text', default_value: '产品', required: true, description: '质保标的物' },
        { name: 'warranty_months', type: 'number', default_value: '12', required: true, description: '质保期月数' },
        { name: 'response_days', type: 'number', default_value: '3', required: true, description: '质保响应天数' },
        { name: 'warranty_scope', type: 'choice', default_value: '整机质保', required: true, options: ['整机质保', '核心部件质保', '全免费质保', '免人工费质保'], description: '质保覆盖范围' },
      ],
      applicable_contracts: ['采购合同', '设备买卖合同', '工程合同', '服务合同'],
      jurisdictions: ['中国大陆'],
      tags: ['质保', '维修', '更换', '质量标准'],
      favor_count: 118,
      usage_count: 487,
      last_updated: '2025-09-28',
      alternative_versions: [
        {
          id: 'alt-warranty-extended',
          label: '延保版（偏向甲方）',
          text: '质保期延长至 {{extended_months}} 个月，且质保期最后3个月可申请一次免费巡检。',
          risk_level: 'low',
          advantage: '甲方获得更长质量保障周期',
          disadvantage: '乙方维保成本上升，可能体现在报价中',
        },
        {
          id: 'alt-warranty-limited',
          label: '限制版（偏向乙方）',
          text: '质保仅限非人为损坏，易耗件不在质保范围。维修产生的人工及材料费用由甲方承担。',
          risk_level: 'medium',
          advantage: '乙方质保成本可控',
          disadvantage: '甲方质保权益受限，可能产生额外费用',
        },
      ],
      risk_notes: '须明确质保起算时点、质保范围与除外情形；建议约定质量异议举证责任归属。',
      negotiation_tips: '争取质保期延长至18-24个月；明确易耗件清单避免争议。',
    },

    // ===== 责任条款（2 条） =====
    {
      id: 'clause-liability-limitation',
      title: '责任限制条款',
      category: 'liability',
      risk_level: 'high',
      source: 'negotiated',
      text: '除故意或重大过失外，任何一方在本合同项下的累计赔偿责任以 {{liability_cap}} 为上限。对于间接损失、利润损失、数据丢失及商业机会损失，任何一方均不承担赔偿责任。前述责任限制不适用于因违约产生的违约金及法定强制责任。',
      variables: [
        { name: 'liability_cap', type: 'currency', default_value: '合同总额', required: true, description: '累计赔偿金额上限' },
        { name: 'cap_basis', type: 'choice', default_value: '合同总额', required: true, options: ['合同总额', '年度服务费', '单次交易额', '固定金额'], description: '赔偿上限计算基准' },
        { name: 'exclusion_clause', type: 'text', default_value: '间接损失、利润损失', required: false, description: '除外赔偿事项描述' },
      ],
      applicable_contracts: ['服务合同', '技术开发合同', '采购合同', '许可协议'],
      jurisdictions: ['中国大陆'],
      tags: ['责任限制', '间接损失', '赔偿上限', '除外情形'],
      favor_count: 87,
      usage_count: 264,
      last_updated: '2025-07-15',
      alternative_versions: [
        {
          id: 'alt-liability-no-cap',
          label: '无上限版（偏向甲方）',
          text: '乙方违约赔偿责任不受金额上限限制，应赔偿甲方因此遭受的全部直接损失。',
          risk_level: 'critical',
          advantage: '甲方获得充分赔偿保障',
          disadvantage: '乙方风险敞口大，可能拒签或加价',
        },
        {
          id: 'alt-liability-low-cap',
          label: '低上限版（偏向乙方）',
          text: '累计赔偿以 {{low_cap}} 为限，且仅赔偿直接财产损失，不含任何间接或衍生损失。',
          risk_level: 'medium',
          advantage: '乙方赔偿责任可控',
          disadvantage: '甲方实际损失可能远超上限',
        },
      ],
      risk_notes: '责任限制条款风险较高，须注意不得排除故意/重大过失及人身损害责任；间接损失排除须明确列举。',
      negotiation_tips: '争取将赔偿上限提高至合同总额的2-3倍；保留对知识产权侵权与保密违约的无限责任。',
    },
    {
      id: 'clause-liability-indemnity',
      title: '赔偿条款',
      category: 'liability',
      risk_level: 'medium',
      source: 'standard',
      text: '因 {{liable_party}} 违反本合同约定导致对方遭受第三方索赔、行政处罚或诉讼的，违约方应负责赔偿守约方因此产生的全部损失，包括但不限于赔偿金、诉讼费、律师费 {{legal_fee_borne}} 及合理维权成本。赔偿应在收到守约方书面通知后 {{indemnify_days}} 日内支付。',
      variables: [
        { name: 'liable_party', type: 'choice', default_value: '违约方', required: true, options: ['违约方', '甲方', '乙方', '双方各自'], description: '赔偿义务承担方' },
        { name: 'legal_fee_borne', type: 'choice', default_value: '含律师费', required: true, options: ['含律师费', '不含律师费', '按胜诉比例'], description: '律师费用承担方式' },
        { name: 'indemnify_days', type: 'number', default_value: '15', required: true, description: '赔偿支付天数' },
      ],
      applicable_contracts: ['采购合同', '服务合同', '知识产权许可合同', '合作协议'],
      jurisdictions: ['中国大陆'],
      tags: ['赔偿', '第三方索赔', '律师费', '维权'],
      favor_count: 73,
      usage_count: 231,
      last_updated: '2025-06-30',
      alternative_versions: [
        {
          id: 'alt-indemnity-full',
          label: '全额赔偿版（偏向甲方）',
          text: '乙方应赔偿甲方全部直接及间接损失，且不得设置赔偿上限。',
          risk_level: 'high',
          advantage: '甲方维权成本由对方承担，保障充分',
          disadvantage: '乙方赔偿范围过宽，风险敞口大',
        },
        {
          id: 'alt-indemnity-capped',
          label: '封顶赔偿版（偏向乙方）',
          text: '赔偿总额以 {{cap_amount}} 为限，律师费按 {{fee_ratio}} 比例承担。',
          risk_level: 'low',
          advantage: '乙方赔偿成本可预期',
          disadvantage: '甲方可能无法覆盖全部维权支出',
        },
      ],
      risk_notes: '赔偿范围与律师费承担须明确；建议约定维权义务的配合要求以避免扩大损失。',
      negotiation_tips: '争取将律师费纳入赔偿范围并明确"合理"标准；设置赔偿上限触发严重违约时的解除权。',
    },

    // ===== 终止条款（1 条） =====
    {
      id: 'clause-termination',
      title: '合同终止条款',
      category: 'termination',
      risk_level: 'medium',
      source: 'standard',
      text: '本合同自双方签字盖章之日起生效，有效期为 {{valid_months}} 个月。任一方提前 {{notice_days}} 日书面通知对方，可终止本合同。一方严重违约且经催告后 {{cure_days}} 日内未纠正的，守约方有权书面解除合同。合同终止后，已履行部分不受影响，保密义务继续有效。',
      variables: [
        { name: 'valid_months', type: 'number', default_value: '12', required: true, description: '合同有效期月数' },
        { name: 'notice_days', type: 'number', default_value: '30', required: true, description: '提前终止通知天数' },
        { name: 'cure_days', type: 'number', default_value: '15', required: true, description: '违约纠正宽限期天数' },
        { name: 'termination_cause', type: 'choice', default_value: '严重违约', required: true, options: ['严重违约', '不可抗力', '双方协商', '一方破产'], description: '可解除合同的事由' },
      ],
      applicable_contracts: ['服务合同', '采购合同', '租赁合同', '合作协议'],
      jurisdictions: ['中国大陆'],
      tags: ['终止', '解除', '有效期', '宽限期'],
      favor_count: 104,
      usage_count: 398,
      last_updated: '2025-08-08',
      alternative_versions: [
        {
          id: 'alt-termination-convenience',
          label: '便利终止版（偏向甲方）',
          text: '甲方有权随时提前 {{notice_days}} 日通知终止，且无需承担违约责任，仅需结清已发生费用。',
          risk_level: 'high',
          advantage: '甲方退出灵活，沉没成本低',
          disadvantage: '乙方投资难以收回，合作稳定性差',
        },
        {
          id: 'alt-termination-strict',
          label: '严格终止版（偏向乙方）',
          text: '仅在对方严重违约且催告后 {{cure_days}} 日仍未纠正时方可解除，提前终止需支付 {{early_term_fee}} 违约金。',
          risk_level: 'low',
          advantage: '保障合作稳定性，乙方收益可预期',
          disadvantage: '甲方退出成本高，灵活性低',
        },
      ],
      risk_notes: '须明确"严重违约"的认定标准与催告程序；终止后的费用结算与资料返还须约定。',
      negotiation_tips: '争取保留便利终止权并降低提前终止违约金；明确终止后数据与资料返还义务。',
    },

    // ===== 保密条款（2 条） =====
    {
      id: 'clause-confidentiality-nda',
      title: '保密协议条款',
      category: 'confidentiality',
      risk_level: 'low',
      source: 'standard',
      text: '双方对在履行本合同过程中获知的对方商业秘密、技术信息及经营信息承担保密义务，保密期限为合同终止后 {{confidentiality_years}} 年。未经对方书面同意，任何一方不得向第三方披露保密信息。违反保密义务的，应支付违约金 {{breach_penalty}} 并赔偿全部损失。',
      variables: [
        { name: 'confidentiality_years', type: 'number', default_value: '5', required: true, description: '保密义务持续年数' },
        { name: 'breach_penalty', type: 'currency', default_value: '合同总额10%', required: true, description: '违反保密义务的违约金' },
        { name: 'confidential_scope', type: 'choice', default_value: '商业秘密及技术信息', required: true, options: ['商业秘密及技术信息', '仅技术信息', '仅商业秘密', '全部非公开信息'], description: '保密信息范围' },
        { name: 'permitted_disclosure', type: 'text', default_value: '法律法规要求或已公开信息', required: false, description: '可披露的除外情形' },
      ],
      applicable_contracts: ['服务合同', '技术开发合同', '采购合同', '合作协议'],
      jurisdictions: ['中国大陆'],
      tags: ['保密', '商业秘密', '违约金', '保密期'],
      favor_count: 156,
      usage_count: 720,
      last_updated: '2025-10-01',
      alternative_versions: [
        {
          id: 'alt-confidentiality-long',
          label: '长期保密版（偏向甲方）',
          text: '核心商业秘密保密期限为合同终止后 {{long_years}} 年，违约金提升至 {{enhanced_penalty}}。',
          risk_level: 'medium',
          advantage: '核心信息保护期更长，威慑力更强',
          disadvantage: '长期保密增加合规管理成本',
        },
        {
          id: 'alt-confidentiality-short',
          label: '短期保密版（偏向乙方）',
          text: '保密期限为合同终止后 {{short_years}} 年，仅限明确标注的文件属于保密信息。',
          risk_level: 'low',
          advantage: '乙方保密负担较轻，范围清晰',
          disadvantage: '甲方信息保护期短，泄露风险上升',
        },
      ],
      risk_notes: '保密信息范围须界定清晰；建议明确标注机制与返还/销毁义务以降低举证难度。',
      negotiation_tips: '争取保密期延长至5年以上；要求违约金不低于实际损失且不设上限。',
    },
    {
      id: 'clause-confidentiality-data-protection',
      title: '数据保护条款',
      category: 'confidentiality',
      risk_level: 'high',
      source: 'regulatory',
      text: '双方在处理个人信息及重要数据时，应遵守《中华人民共和国个人信息保护法》《数据安全法》等法律法规。未经授权不得收集、存储、传输或处理对方提供的用户数据。发生数据安全事件的，应于 {{breach_notify_hours}} 小时内通知对方并采取补救措施。数据跨境传输须经对方书面同意。',
      variables: [
        { name: 'breach_notify_hours', type: 'number', default_value: '24', required: true, description: '数据安全事件通知时限（小时）' },
        { name: 'data_scope', type: 'choice', default_value: '个人信息及重要数据', required: true, options: ['个人信息及重要数据', '仅个人信息', '仅重要数据', '全部电子数据'], description: '数据保护适用范围' },
        { name: 'cross_border', type: 'choice', default_value: '需书面同意', required: true, options: ['需书面同意', '禁止跨境', '无需同意'], description: '数据跨境传输规则' },
      ],
      applicable_contracts: ['服务合同', '技术开发合同', '数据处理协议', '云服务合同'],
      jurisdictions: ['中国大陆'],
      tags: ['数据保护', '个人信息', '数据安全', '跨境传输'],
      favor_count: 91,
      usage_count: 276,
      last_updated: '2025-09-20',
      alternative_versions: [
        {
          id: 'alt-data-protection-strict',
          label: '严格合规版（偏向甲方）',
          text: '数据处理须经数据影响主体明示同意，违约方承担无限连带赔偿责任。',
          risk_level: 'critical',
          advantage: '数据合规要求最高，风险最低',
          disadvantage: '合规流程复杂，履约成本高',
        },
        {
          id: 'alt-data-protection-basic',
          label: '基础合规版（偏向乙方）',
          text: '按法律法规最低要求处理数据，数据安全事件通知时限为 {{relaxed_hours}} 小时。',
          risk_level: 'medium',
          advantage: '乙方合规负担较轻',
          disadvantage: '数据保护力度不足，监管风险上升',
        },
      ],
      risk_notes: '数据保护条款涉及法定强制义务，不得通过约定排除法定责任；跨境传输须特别注意安全评估要求。',
      negotiation_tips: '争取将通知时限缩短至24小时内；明确数据泄露的连带责任与赔偿机制。',
    },

    // ===== 知识产权条款（1 条） =====
    {
      id: 'clause-ip-ownership',
      title: '知识产权归属条款',
      category: 'ip',
      risk_level: 'high',
      source: 'negotiated',
      text: '本合同履行过程中产生的技术成果及知识产权归 {{ip_owner}} 所有。乙方在履行合同前已拥有的背景知识产权仍归乙方所有。甲方对交付成果享有 {{license_scope}} 的使用权。任何一方不得将上述知识产权擅自转让或授权第三方使用，法律法规另有规定的除外。',
      variables: [
        { name: 'ip_owner', type: 'choice', default_value: '甲方', required: true, options: ['甲方', '乙方', '双方共有', '按成果分别归属'], description: '新成果知识产权归属方' },
        { name: 'license_scope', type: 'choice', default_value: '非独占、可转授权', required: true, options: ['独占许可', '非独占、不可转授权', '非独占、可转授权', '仅内部使用'], description: '甲方使用权范围' },
        { name: 'background_ip', type: 'text', default_value: '乙方原有知识产权', required: false, description: '背景知识产权归属描述' },
      ],
      applicable_contracts: ['技术开发合同', '服务合同', '委托设计合同', '许可协议'],
      jurisdictions: ['中国大陆'],
      tags: ['知识产权', '归属', '许可', '背景知识产权'],
      favor_count: 112,
      usage_count: 389,
      last_updated: '2025-07-25',
      alternative_versions: [
        {
          id: 'alt-ip-owner-client',
          label: '甲方独有版（偏向甲方）',
          text: '全部成果知识产权归甲方独占所有，乙方不得自行使用或授权第三方。',
          risk_level: 'high',
          advantage: '甲方完全控制成果，商业价值最大化',
          disadvantage: '乙方失去技术复用空间，报价可能提高',
        },
        {
          id: 'alt-ip-shared',
          label: '共有版（平衡）',
          text: '新成果由双方共有，任一方商业化使用须经对方同意并按 {{revenue_share}} 比例分配收益。',
          risk_level: 'medium',
          advantage: '双方共享成果价值，利益平衡',
          disadvantage: '共有权属后续处分需协商，效率较低',
        },
      ],
      risk_notes: '须区分背景知识产权与新生成果；约定使用权范围时注意是否含转授权及商业化权限。',
      negotiation_tips: '争取新成果归属甲方且含转授权；保留乙方背景知识产权清单以避免权属混淆。',
    },

    // ===== 争议解决条款（1 条） =====
    {
      id: 'clause-dispute-arbitration',
      title: '争议解决与仲裁条款',
      category: 'dispute_resolution',
      risk_level: 'low',
      source: 'standard',
      text: '双方因履行本合同发生的争议，应首先通过友好协商解决；协商不成的，任何一方可向 {{arbitration_org}} 申请仲裁。仲裁裁决为终局裁决，对双方均有约束力。仲裁费用由败诉方承担。本条款的效力独立于合同其他条款，合同其他条款无效不影响本争议解决条款的效力。',
      variables: [
        { name: 'arbitration_org', type: 'choice', default_value: '甲方所在地仲裁委员会', required: true, options: ['甲方所在地仲裁委员会', '乙方所在地仲裁委员会', '北京仲裁委员会', '中国国际经济贸易仲裁委员会'], description: '仲裁机构选择' },
        { name: 'dispute_method', type: 'choice', default_value: '仲裁', required: true, options: ['仲裁', '诉讼', '调解后仲裁'], description: '争议解决方式' },
        { name: 'applicable_law', type: 'text', default_value: '中华人民共和国法律', required: false, description: '适用法律' },
      ],
      applicable_contracts: ['采购合同', '服务合同', '工程合同', '国际合作合同'],
      jurisdictions: ['中国大陆'],
      tags: ['争议解决', '仲裁', '终局裁决', '独立效力'],
      favor_count: 135,
      usage_count: 580,
      last_updated: '2025-08-30',
      alternative_versions: [
        {
          id: 'alt-dispute-litigation',
          label: '诉讼版（偏向甲方）',
          text: '协商不成的，向甲方所在地有管辖权的人民法院提起诉讼。',
          risk_level: 'medium',
          advantage: '甲方主场诉讼，地利与程序熟悉度占优',
          disadvantage: '诉讼周期较长，公开性较高',
        },
        {
          id: 'alt-dispute-mediation',
          label: '调解优先版（平衡）',
          text: '先行调解，调解不成再提交 {{arbitration_org}} 仲裁，仲裁与调解结合以提高效率。',
          risk_level: 'low',
          advantage: '兼顾效率与关系维护，成本较低',
          disadvantage: '调解无强制力，可能拖延争议解决',
        },
      ],
      risk_notes: '仲裁条款须明确机构名称与仲裁地，避免条款无效；争议解决条款具有独立效力，即使主合同无效仍有效。',
      negotiation_tips: '争取约定己方所在地仲裁机构；选择仲裁可兼顾保密性与终局性。',
    },

    // ===== 不可抗力条款（1 条） =====
    {
      id: 'clause-force-majeure',
      title: '不可抗力条款',
      category: 'force_majeure',
      risk_level: 'low',
      source: 'standard',
      text: '因 {{fm_definition}} 导致一方不能履行或不能及时履行合同义务的，应在事件发生后 {{notify_days}} 日内书面通知对方并提供证明，可部分或全部免除责任。不可抗力持续超过 {{termination_days}} 日的，任一方有权书面解除合同。不可抗力消除后，双方应协商恢复履行。',
      variables: [
        { name: 'fm_definition', type: 'text', default_value: '不能预见、不能避免且不能克服的客观情况', required: true, description: '不可抗力定义描述' },
        { name: 'notify_days', type: 'number', default_value: '5', required: true, description: '事件通知天数' },
        { name: 'termination_days', type: 'number', default_value: '30', required: true, description: '可解除合同的天数阈值' },
        { name: 'fm_scope', type: 'choice', default_value: '自然灾害、政府行为、疫情', required: true, options: ['自然灾害、政府行为、疫情', '仅自然灾害', '自然灾害与战争', '扩展至供应链中断'], description: '不可抗力覆盖情形' },
      ],
      applicable_contracts: ['采购合同', '服务合同', '工程合同', '租赁合同'],
      jurisdictions: ['中国大陆'],
      tags: ['不可抗力', '免责', '解除', '通知'],
      favor_count: 98,
      usage_count: 412,
      last_updated: '2025-06-18',
      alternative_versions: [
        {
          id: 'alt-fm-narrow',
          label: '狭义版（偏向甲方）',
          text: '不可抗力仅限自然灾害与政府行为，疫情及供应链中断不属免责事由。',
          risk_level: 'medium',
          advantage: '免责范围窄，对方履约约束强',
          disadvantage: '遇疫情等情形时仍需承担违约责任',
        },
        {
          id: 'alt-fm-broad',
          label: '广义版（偏向乙方）',
          text: '不可抗力扩展至第三方违约、原材料短缺及市场异常波动，免责范围更广。',
          risk_level: 'low',
          advantage: '乙方免责空间大，履约压力小',
          disadvantage: '甲方风险敞口扩大，可能成为免责借口',
        },
      ],
      risk_notes: '须明确不可抗力定义与除外情形；通知与举证义务应及时，否则可能丧失免责权。',
      negotiation_tips: '争取保留疫情与供应链中断的免责空间；设置解除触发天数以避免长期悬而未决。',
    },

    // ===== 通用条款（1 条） =====
    {
      id: 'clause-general-representation',
      title: '通用声明与保证条款',
      category: 'general',
      risk_level: 'low',
      source: 'standard',
      text: '双方声明并保证：具备签署及履行本合同的合法主体资格与授权；签署本合同已获得一切必要的内部审批；履行本合同不违反对其有约束力的法律法规及第三方合同。任一方声明不实的，应向对方承担违约责任并赔偿因此造成的全部损失。本合同未尽事宜，双方可签订补充协议，补充协议与本合同具有同等法律效力。',
      variables: [
        { name: 'representation_scope', type: 'choice', default_value: '主体资格与授权', required: true, options: ['主体资格与授权', '财务状况', '合规性', '无重大未披露风险'], description: '声明保证范围' },
        { name: 'supplement_clause', type: 'choice', default_value: '补充协议同等效力', required: true, options: ['补充协议同等效力', '以本合同为准', '另行协商'], description: '未尽事宜处理方式' },
      ],
      applicable_contracts: ['采购合同', '服务合同', '租赁合同', '合作协议', '劳动合同'],
      jurisdictions: ['中国大陆'],
      tags: ['声明保证', '主体资格', '补充协议', '违约责任'],
      favor_count: 119,
      usage_count: 495,
      last_updated: '2025-09-05',
      alternative_versions: [
        {
          id: 'alt-general-enhanced',
          label: '增强版（偏向甲方）',
          text: '乙方额外保证所交付成果不存在权属瑕疵，且未处于重大诉讼或行政处罚之中。',
          risk_level: 'medium',
          advantage: '甲方获得更全面的对方资质保证',
          disadvantage: '乙方声明义务增加，尽调成本上升',
        },
        {
          id: 'alt-general-minimal',
          label: '精简版（偏向乙方）',
          text: '双方仅就主体资格与签署授权作出声明，不涉及财务与合规保证。',
          risk_level: 'low',
          advantage: '声明义务精简，履约负担轻',
          disadvantage: '保证范围有限，潜在风险未覆盖',
        },
      ],
      risk_notes: '声明保证条款为合同基础性条款，建议覆盖主体资格、授权、合规与无重大未披露风险。',
      negotiation_tips: '争取扩大对方声明范围以覆盖权属瑕疵与重大诉讼；约定声明不实的违约金以增强约束力。',
    },
  ];
}

// ===== 条款推荐生成 =====
// 根据合同类型与上下文，生成推荐条款与缺失条款建议
export function getClauseRecommendations(
  contractType: string,
  context: string
): ClauseRecommendation {
  const clauses = getMockClauses();
  const type = contractType || '通用合同';

  // 合同类型与条款分类的关联权重
  const typeRelevance: Record<string, Record<ClauseCategory, number>> = {
    '采购合同': {
      payment: 95, delivery: 92, warranty: 80, liability: 85,
      termination: 70, confidentiality: 60, ip: 55, dispute_resolution: 75,
      force_majeure: 70, general: 65,
    },
    '服务合同': {
      payment: 90, delivery: 88, warranty: 70, liability: 88,
      termination: 82, confidentiality: 85, ip: 80, dispute_resolution: 75,
      force_majeure: 65, general: 68,
    },
    '租赁合同': {
      payment: 92, delivery: 70, warranty: 60, liability: 75,
      termination: 90, confidentiality: 40, ip: 30, dispute_resolution: 72,
      force_majeure: 68, general: 60,
    },
    '技术开发合同': {
      payment: 85, delivery: 80, warranty: 65, liability: 82,
      termination: 75, confidentiality: 95, ip: 98, dispute_resolution: 78,
      force_majeure: 60, general: 70,
    },
    '工程合同': {
      payment: 95, delivery: 95, warranty: 85, liability: 88,
      termination: 72, confidentiality: 50, ip: 45, dispute_resolution: 80,
      force_majeure: 85, general: 65,
    },
  };

  // 上下文关键词加成
  const contextLower = context.toLowerCase();
  const contextBoost: Partial<Record<ClauseCategory, number>> = {};
  if (contextLower.includes('数据') || contextLower.includes('隐私') || contextLower.includes('个人信息')) {
    contextBoost.confidentiality = 20;
  }
  if (contextLower.includes('知识产权') || contextLower.includes('技术') || contextLower.includes('专利')) {
    contextBoost.ip = 20;
  }
  if (contextLower.includes('分期') || contextLower.includes('预付') || contextLower.includes('回款')) {
    contextBoost.payment = 15;
  }
  if (contextLower.includes('风险') || contextLower.includes('赔偿') || contextLower.includes('违约')) {
    contextBoost.liability = 15;
  }

  const relevanceMap = typeRelevance[type] || typeRelevance['采购合同'];

  // 生成推荐条款（按相关度排序取前 5）
  const scored = clauses
    .map((c) => {
      const base = relevanceMap[c.category] ?? 50;
      const boost = contextBoost[c.category] ?? 0;
      const relevance = Math.min(100, base + boost);
      return { clause: c, relevance };
    })
    .sort((a, b) => b.relevance - a.relevance);

  const recommended = scored.slice(0, 5).map(({ clause, relevance }) => ({
    clause_id: clause.id,
    relevance,
    reason: `${CLAUSE_CATEGORY_LABELS[clause.category]}在${type}中相关度较高${
      contextBoost[clause.category] ? '，且与输入上下文关键词匹配' : ''
    }，建议优先采用。`,
  }));

  // 生成缺失条款建议（相关度偏低的分类）
  const missingCandidates = scored
    .filter((s) => s.relevance < 70 && s.relevance >= 45)
    .slice(0, 3)
    .map(({ clause }) => ({
      category: clause.category,
      importance:
        clause.risk_level === 'high' || clause.risk_level === 'critical'
          ? '重要'
          : clause.risk_level === 'medium'
            ? '一般'
            : '建议',
      reason: `当前${type}未充分覆盖${CLAUSE_CATEGORY_LABELS[clause.category]}，如缺少相关约定可能在履约与争议中产生风险。`,
    }));

  // 若缺失项不足，补充固定建议
  if (missingCandidates.length < 2) {
    const fallback: { category: ClauseCategory; importance: string; reason: string }[] = [
      {
        category: 'force_majeure',
        importance: '重要',
        reason: '建议补充不可抗力条款以合理分配不可控事件导致的风险，避免履约争议。',
      },
      {
        category: 'dispute_resolution',
        importance: '重要',
        reason: '建议明确争议解决方式与管辖机构，确保纠纷发生时有清晰的救济路径。',
      },
    ];
    fallback.forEach((f) => {
      if (!missingCandidates.find((m) => m.category === f.category)) {
        missingCandidates.push(f);
      }
    });
  }

  return {
    id: `rec-${Date.now()}`,
    contract_type: type,
    context: context || '',
    recommended_clauses: recommended,
    missing_clauses: missingCandidates.slice(0, 3),
  };
}

// ===== 条款搜索 =====
// 全文搜索 + 分类/风险等级/来源筛选
export function searchClauses(
  clauses: ClauseLibraryItem[],
  query: string,
  filters: {
    category?: ClauseCategory;
    riskLevel?: ClauseRiskLevel;
    source?: ClauseSource;
  }
): ClauseLibraryItem[] {
  const q = query.trim().toLowerCase();

  return clauses.filter((c) => {
    // 分类筛选
    if (filters.category && c.category !== filters.category) return false;
    // 风险等级筛选
    if (filters.riskLevel && c.risk_level !== filters.riskLevel) return false;
    // 来源筛选
    if (filters.source && c.source !== filters.source) return false;

    // 全文搜索
    if (q) {
      const haystack = [
        c.title,
        c.text,
        c.risk_notes,
        c.negotiation_tips,
        c.tags.join(' '),
        c.applicable_contracts.join(' '),
      ]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }

    return true;
  });
}

// ===== 条款统计聚合 =====
// 汇总条款总数、分类分布、风险等级分布、使用量与收藏量
export function getClauseStats(clauses: ClauseLibraryItem[]): {
  total: number;
  byCategory: Record<ClauseCategory, number>;
  byRiskLevel: Record<ClauseRiskLevel, number>;
  totalUsage: number;
  totalFavorites: number;
  avgRiskLevel: string;
} {
  // 初始化各分类计数
  const byCategory = Object.keys(CLAUSE_CATEGORY_LABELS).reduce(
    (acc, key) => {
      acc[key as ClauseCategory] = 0;
      return acc;
    },
    {} as Record<ClauseCategory, number>
  );

  // 初始化各风险等级计数
  const byRiskLevel = Object.keys(CLAUSE_RISK_CONFIG).reduce(
    (acc, key) => {
      acc[key as ClauseRiskLevel] = 0;
      return acc;
    },
    {} as Record<ClauseRiskLevel, number>
  );

  // 风险等级量化（用于计算平均）
  const riskWeight: Record<ClauseRiskLevel, number> = {
    low: 1,
    medium: 2,
    high: 3,
    critical: 4,
  };

  let totalUsage = 0;
  let totalFavorites = 0;
  let riskSum = 0;

  clauses.forEach((c) => {
    byCategory[c.category] += 1;
    byRiskLevel[c.risk_level] += 1;
    totalUsage += c.usage_count;
    totalFavorites += c.favor_count;
    riskSum += riskWeight[c.risk_level] || 0;
  });

  // 计算平均风险等级
  const avg = clauses.length > 0 ? riskSum / clauses.length : 0;
  let avgRiskLevel: string;
  if (avg <= 1.5) {
    avgRiskLevel = '低风险';
  } else if (avg <= 2.5) {
    avgRiskLevel = '中风险';
  } else if (avg <= 3.5) {
    avgRiskLevel = '高风险';
  } else {
    avgRiskLevel = '极高风险';
  }

  return {
    total: clauses.length,
    byCategory,
    byRiskLevel,
    totalUsage,
    totalFavorites,
    avgRiskLevel,
  };
}

// ===== 条款渲染 =====
// 将条款文本中的 {{variable}} 占位符替换为实际变量值
export function renderClause(
  clause: ClauseLibraryItem,
  variables: Record<string, string>
): string {
  let text = clause.text;

  // 替换所有占位符 {{name}}
  clause.variables.forEach((v) => {
    const value = variables[v.name] ?? v.default_value;
    const placeholder = `{{${v.name}}}`;
    text = text.split(placeholder).join(value);
  });

  // 清理未匹配的残余占位符（兜底）
  text = text.replace(/\{\{[^}]+\}\}/g, (match) => {
    const key = match.slice(2, -2).trim();
    return variables[key] ?? match;
  });

  return text;
}
