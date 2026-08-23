// ===== 标准条款库 =====
// 按合同类型存储市场标准条款模板，用于条款比对

export interface StandardClause {
  clause_id: string;
  clause_type: string;
  clause_text: string;
  is_required: boolean;
  risk_if_missing: string;
}

export interface StandardContractTemplate {
  contract_type: string;
  description: string;
  clauses: StandardClause[];
}

// 标准条款库
export const STANDARD_CLAUSE_LIBRARY: StandardContractTemplate[] = [
  {
    contract_type: '采购合同',
    description: '标准采购合同条款模板，基于市场惯例和法律规定',
    clauses: [
      {
        clause_id: '标的物',
        clause_type: 'payment',
        clause_text: '甲方拟向乙方采购的货物名称、规格、数量、单价及总金额详见本合同附件一《采购清单》。',
        is_required: true,
        risk_if_missing: '缺少标的物条款将导致合同不成立',
      },
      {
        clause_id: '付款方式',
        clause_type: 'payment',
        clause_text: '甲方应在收到乙方开具的合规发票后30日内，通过银行转账方式向乙方支付货款。预付款比例不超过合同总金额的30%。',
        is_required: true,
        risk_if_missing: '付款条件不明确可能导致资金风险',
      },
      {
        clause_id: '交付方式',
        clause_type: 'delivery',
        clause_text: '乙方应于合同签订后30日内将货物交付至甲方指定地点，运输费用由乙方承担。',
        is_required: true,
        risk_if_missing: '交付条款缺失会导致履约争议',
      },
      {
        clause_id: '验收标准',
        clause_type: 'delivery',
        clause_text: '甲方应在收到货物后10个工作日内完成验收。验收不合格的，甲方有权拒收并要求乙方在15日内更换。',
        is_required: true,
        risk_if_missing: '验收标准缺失会导致质量争议',
      },
      {
        clause_id: '违约责任',
        clause_type: 'breach',
        clause_text: '任何一方违反本合同约定，应向守约方支付违约金，违约金金额为合同总金额的15%。违约金不足以弥补损失的，违约方应补足差额。',
        is_required: true,
        risk_if_missing: '违约责任缺失将导致违约无约束',
      },
      {
        clause_id: '知识产权',
        clause_type: 'ip',
        clause_text: '乙方保证所供货物不侵犯任何第三方知识产权。如因乙方货物导致甲方遭受知识产权侵权指控，乙方应承担全部赔偿责任。',
        is_required: true,
        risk_if_missing: '知识产权条款缺失可能导致侵权风险',
      },
      {
        clause_id: '保密义务',
        clause_type: 'confidentiality',
        clause_text: '双方应对在履行本合同过程中获知的对方商业信息承担保密义务，保密期限为合同终止后5年。',
        is_required: true,
        risk_if_missing: '保密条款缺失可能导致商业秘密泄露',
      },
      {
        clause_id: '不可抗力',
        clause_type: 'force_majeure',
        clause_text: '因不可抗力导致一方不能履行合同的，应及时通知对方并提供证明，可部分或全部免除责任。',
        is_required: true,
        risk_if_missing: '不可抗力条款缺失导致风险分担不明',
      },
      {
        clause_id: '争议解决',
        clause_type: 'dispute',
        clause_text: '双方因履行本合同发生的争议，应友好协商解决；协商不成的，任何一方可向甲方所在地有管辖权的人民法院提起诉讼。',
        is_required: true,
        risk_if_missing: '争议解决条款缺失导致诉讼管辖不确定',
      },
      {
        clause_id: '合同期限',
        clause_type: 'termination',
        clause_text: '本合同自双方签字盖章之日起生效，有效期为一年。期满前30日，双方可协商续签。',
        is_required: true,
        risk_if_missing: '合同期限不明导致长期义务不确定',
      },
    ],
  },
  {
    contract_type: '服务合同',
    description: '标准技术服务合同条款模板',
    clauses: [
      {
        clause_id: '服务内容',
        clause_type: 'delivery',
        clause_text: '乙方应按照本合同约定，为甲方提供具体的服务内容、服务标准和服务期限详见附件。',
        is_required: true,
        risk_if_missing: '服务内容不明确导致履约标准争议',
      },
      {
        clause_id: '服务费用',
        clause_type: 'payment',
        clause_text: '甲方应按月/季度向乙方支付服务费用，具体金额及支付方式详见附件。',
        is_required: true,
        risk_if_missing: '费用条款不明确导致付款争议',
      },
      {
        clause_id: '服务标准',
        clause_type: 'delivery',
        clause_text: '乙方应保证提供的服务符合行业标准和甲方要求，服务成果应满足约定的验收标准。',
        is_required: true,
        risk_if_missing: '服务标准缺失导致质量无法衡量',
      },
      {
        clause_id: '违约责任',
        clause_type: 'breach',
        clause_text: '乙方未按约定提供服务的，应按月服务费的10%向甲方支付违约金。',
        is_required: true,
        risk_if_missing: '违约约束缺失',
      },
      {
        clause_id: '知识产权归属',
        clause_type: 'ip',
        clause_text: '乙方在履行本合同过程中创作的技术成果知识产权归甲方所有，乙方不得自行使用或向第三方转让。',
        is_required: true,
        risk_if_missing: '知识产权归属不明导致权属纠纷',
      },
      {
        clause_id: '保密义务',
        clause_type: 'confidentiality',
        clause_text: '乙方应对甲方商业信息和技术信息承担保密义务，保密期限为合同终止后5年。',
        is_required: true,
        risk_if_missing: '保密条款缺失',
      },
      {
        clause_id: '合同终止',
        clause_type: 'termination',
        clause_text: '任何一方提前30日书面通知对方，可终止本合同。提前终止的，乙方应完成已开始的服务工作。',
        is_required: true,
        risk_if_missing: '终止条款不明导致合同解除困难',
      },
      {
        clause_id: '争议解决',
        clause_type: 'dispute',
        clause_text: '双方因履行本合同发生的争议，应友好协商解决；协商不成的，任何一方可向甲方所在地人民法院提起诉讼。',
        is_required: true,
        risk_if_missing: '争议解决条款缺失',
      },
    ],
  },
  {
    contract_type: '租赁合同',
    description: '标准房屋租赁合同条款模板',
    clauses: [
      {
        clause_id: '租赁标的',
        clause_type: 'delivery',
        clause_text: '甲方将位于指定地点的房屋出租给乙方使用，建筑面积以产权证为准。',
        is_required: true,
        risk_if_missing: '租赁标的不明导致合同无效',
      },
      {
        clause_id: '租金及支付',
        clause_type: 'payment',
        clause_text: '乙方应按月向甲方支付租金，租金标准及调整机制详见附件。',
        is_required: true,
        risk_if_missing: '租金条款缺失',
      },
      {
        clause_id: '租赁期限',
        clause_type: 'termination',
        clause_text: '租赁期限为约定年限，自交付之日起算。期满乙方需续租的，应提前30日书面通知甲方。',
        is_required: true,
        risk_if_missing: '期限不明导致租赁关系不确定',
      },
      {
        clause_id: '维修责任',
        clause_type: 'breach',
        clause_text: '房屋主体结构由甲方负责维修，日常维护由乙方负责。乙方改变房屋用途需经甲方书面同意。',
        is_required: true,
        risk_if_missing: '维修责任不明导致纠纷',
      },
      {
        clause_id: '违约责任',
        clause_type: 'breach',
        clause_text: '乙方逾期支付租金的，每逾期一日按月租金的0.5%支付违约金。逾期超过30日的，甲方有权解除合同。',
        is_required: true,
        risk_if_missing: '违约约束缺失',
      },
      {
        clause_id: '争议解决',
        clause_type: 'dispute',
        clause_text: '双方争议应协商解决；协商不成的，可向房屋所在地人民法院提起诉讼。',
        is_required: true,
        risk_if_missing: '争议解决条款缺失',
      },
    ],
  },
];

// 获取标准条款模板
export function getStandardTemplate(contractType: string): StandardContractTemplate | null {
  return STANDARD_CLAUSE_LIBRARY.find(t => t.contract_type === contractType) || null;
}

// 获取所有合同类型
export function getAvailableContractTypes(): string[] {
  return STANDARD_CLAUSE_LIBRARY.map(t => t.contract_type);
}
