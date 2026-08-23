// ===== Mock数据模块 =====
// 当没有配置API密钥时，使用模拟数据让应用可运行预览

import { AIReviewResult, Contract, ContractRisk } from './types';

export const MOCK_REVIEW_RESULT: AIReviewResult = {
  contract_type: '采购合同',
  contract_title: 'XX产品采购合同',
  summary: '本合同整体风险中等偏高（综合评分65/100）。主要风险集中在付款条款（预付比例过高）、违约责任（违约金上限缺失）、知识产权（成果归属不明）三个方面。建议在签署前重点修改这3处条款。',
  overall_risk_score: 65,
  risks: [
    {
      clause_id: '第3.2条',
      clause_text: '甲方应在合同签署后7个工作日内向乙方支付合同总金额的50%作为预付款。',
      risk_type: 'payment_risk',
      risk_level: 'high',
      risk_explanation: '50%预付款比例过高，市场惯例为20-30%。若乙方未交付货物，甲方损失巨大且追偿困难。',
      is_standard_clause: false,
      suggested_redline: '甲方应在收到乙方交付的全部货物并验收合格后10个工作日内，向乙方支付合同总金额的30%作为首期付款；剩余70%在验收合格后30日内付清。',
    },
    {
      clause_id: '第5.1条',
      clause_text: '任何一方违反本合同约定，应向守约方支付违约金，违约金数额由双方另行协商确定。',
      risk_type: 'breach_liability',
      risk_level: 'high',
      risk_explanation: '违约金数额"另行协商"意味着违约时需要重新谈判，实际执行困难，无法有效约束对方。应明确约定违约金具体金额或计算方式。',
      is_standard_clause: false,
      suggested_redline: '任何一方违反本合同约定，应向守约方支付违约金，违约金金额为合同总金额的15%。如违约金不足以弥补守约方实际损失的，违约方应补足差额。',
    },
    {
      clause_id: '第7.3条',
      clause_text: '本合同履行过程中产生的技术成果及知识产权归属，由双方另行签订补充协议约定。',
      risk_type: 'intellectual_property',
      risk_level: 'medium',
      risk_explanation: '知识产权归属"另行约定"导致权属不确定。若未签订补充协议，可能产生权属纠纷。应在合同中明确约定。',
      is_standard_clause: false,
      suggested_redline: '本合同履行过程中由甲方提供的技术方案和已有知识产权归甲方所有；乙方为履行本合同而新开发的技术成果知识产权归甲乙双方共同所有，未经对方书面同意，任何一方不得向第三方转让或许可使用。',
    },
    {
      clause_id: '第4.2条',
      clause_text: '乙方应在收到甲方订单后45日内完成交付。',
      risk_type: 'delivery_risk',
      risk_level: 'medium',
      risk_explanation: '45天交付周期偏长，且未约定逾期交付的违约责任。建议缩短交付周期并添加逾期条款。',
      is_standard_clause: false,
      suggested_redline: '乙方应在收到甲方订单后30日内完成交付。逾期交付的，每逾期一日，乙方应按合同总金额的0.5%向甲方支付违约金；逾期超过15日的，甲方有权解除合同并要求乙方退还已付款项。',
    },
    {
      clause_id: '第9.1条',
      clause_text: '双方因履行本合同发生的争议，应友好协商解决；协商不成的，任何一方可向有管辖权的人民法院提起诉讼。',
      risk_type: 'dispute_resolution',
      risk_level: 'low',
      risk_explanation: '争议解决条款未约定具体的管辖法院，可能导致诉讼管辖不确定。建议明确约定甲方所在地法院管辖。',
      is_standard_clause: true,
      suggested_redline: '双方因履行本合同发生的争议，应友好协商解决；协商不成的，任何一方均可向甲方所在地有管辖权的人民法院提起诉讼。',
    },
    {
      clause_id: '第8.2条',
      clause_text: '乙方应对其在履行本合同过程中获知的甲方商业信息承担保密义务，保密期限为本合同终止后3年。',
      risk_type: 'confidentiality',
      risk_level: 'low',
      risk_explanation: '保密期限3年偏短，建议延长至5年。同时缺少违约赔偿条款。',
      is_standard_clause: true,
      suggested_redline: '乙方应对其在履行本合同过程中获知的甲方商业信息承担保密义务，保密期限为本合同终止后5年。乙方违反保密义务的，应向甲方支付合同总金额20%的违约金，并赔偿甲方因此遭受的全部损失。',
    },
  ],
};

// 生成Mock合同列表
export function getMockContracts(): Contract[] {
  return [
    {
      id: 'mock-001',
      user_id: 'mock-user',
      filename: '采购合同_2025-03.pdf',
      file_type: 'pdf',
      file_size: 256000,
      contract_type: '采购合同',
      contract_title: 'XX产品采购合同',
      status: 'completed',
      risk_score: 65,
      risk_count: 6,
      high_risk_count: 2,
      created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      updated_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    },
    {
      id: 'mock-002',
      user_id: 'mock-user',
      filename: '技术服务协议.docx',
      file_type: 'docx',
      file_size: 128000,
      contract_type: '服务合同',
      contract_title: 'IT技术服务协议',
      status: 'completed',
      risk_score: 42,
      risk_count: 4,
      high_risk_count: 1,
      created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
      updated_at: new Date(Date.now() - 86400000 * 5).toISOString(),
    },
    {
      id: 'mock-003',
      user_id: 'mock-user',
      filename: '房屋租赁合同.pdf',
      file_type: 'pdf',
      file_size: 180000,
      contract_type: '租赁合同',
      contract_title: '办公室租赁合同',
      status: 'completed',
      risk_score: 30,
      risk_count: 3,
      high_risk_count: 0,
      created_at: new Date(Date.now() - 86400000 * 7).toISOString(),
      updated_at: new Date(Date.now() - 86400000 * 7).toISOString(),
    },
  ];
}

// 生成Mock风险列表（对应mock-001）
export function getMockRisks(contractId: string): ContractRisk[] {
  return MOCK_REVIEW_RESULT.risks.map((risk, idx) => ({
    id: `mock-risk-${idx}`,
    contract_id: contractId,
    clause_id: risk.clause_id,
    clause_text: risk.clause_text,
    risk_type: risk.risk_type,
    risk_level: risk.risk_level,
    risk_explanation: risk.risk_explanation,
    is_standard_clause: risk.is_standard_clause,
    suggested_redline: risk.suggested_redline,
    citation_verified: true,
    user_decision: 'pending',
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
  }));
}
