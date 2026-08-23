// ===== 合同起草助手模块 =====
// 提供条款模板、变量填充与完整合同文本生成能力
// 供起草 API 与合同起草页面共用

import {
  DraftedClause,
  DraftingClauseType,
  ClauseVariable,
  DraftingProject,
  DRAFTING_CLAUSE_TYPE_LABELS,
} from './types';

// 一天的毫秒数
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// 生成距离今天指定天数的 ISO 时间字符串
function daysAgo(days: number): string {
  return new Date(Date.now() - days * ONE_DAY_MS).toISOString();
}

// ===== 条款模板数据 =====
// 返回 8 个标准条款模板，每个模板含可填充变量与风险提示
export function getDraftingClauseTemplates(): DraftedClause[] {
  return [
    // 1. 付款条款
    {
      id: 'clause-tpl-payment',
      clause_type: 'payment',
      title: '付款条款',
      content: `付款方式与期限
甲方应向乙方支付合同总金额 {payment_amount} {payment_currency}。付款安排如下：
1. 合同签署后 7 个工作日内，甲方支付全部款项的 30% 作为预付款；
2. 乙方交付全部标的并经甲方验收合格后 15 个工作日内，甲方支付剩余 70% 尾款。
全部款项应于 {payment_deadline} 前付清。甲方未按期付款的，每逾期一日按欠付金额的 0.3% 支付违约金。`,
      variables: [
        {
          name: 'payment_amount',
          label: '合同金额',
          type: 'currency',
          default_value: '100000',
          required: true,
        },
        {
          name: 'payment_currency',
          label: '币种',
          type: 'select',
          default_value: '人民币（CNY）',
          options: ['人民币（CNY）', '美元（USD）', '欧元（EUR）', '日元（JPY）'],
          required: true,
        },
        {
          name: 'payment_deadline',
          label: '付款截止日期',
          type: 'date',
          required: true,
        },
      ],
      risk_notes: [
        '预付款比例建议不超过 30%，过高将增加资金回收风险',
        '建议明确约定逾期付款违约金比例及违约金上限',
        '付款截止日期应与验收节点匹配，避免脱节',
      ],
    },
    // 2. 交付条款
    {
      id: 'clause-tpl-delivery',
      clause_type: 'delivery',
      title: '交付条款',
      content: `交付方式与时间
乙方应于 {delivery_date} 前完成全部标的的交付，交付地点为 {delivery_location}，交付方式为 {delivery_method}。
1. 乙方承担标的物交付至约定地点前的运输费用与运输途中的风险；
2. 标的物交付后，甲方应在 5 个工作日内完成验收并出具验收意见；
3. 验收不合格的，乙方应在 10 个工作日内免费更换或修复，由此产生的费用由乙方承担。`,
      variables: [
        {
          name: 'delivery_date',
          label: '交付日期',
          type: 'date',
          required: true,
        },
        {
          name: 'delivery_location',
          label: '交付地点',
          type: 'text',
          default_value: '甲方指定仓库',
          required: true,
        },
        {
          name: 'delivery_method',
          label: '交付方式',
          type: 'select',
          default_value: '陆运',
          options: ['陆运', '海运', '空运', '铁路运输', '现场交付'],
          required: true,
        },
      ],
      risk_notes: [
        '交付日期应明确具体，避免使用"尽快"等模糊表述',
        '运输费用与风险负担方需明确约定',
        '验收期限与异议处理方式应明确，避免默认验收合格',
      ],
    },
    // 3. 保密条款
    {
      id: 'clause-tpl-confidentiality',
      clause_type: 'confidentiality',
      title: '保密条款',
      content: `保密义务
双方对在合同履行过程中知悉的对方商业秘密、技术资料及经营信息负有保密义务。保密期限为 {confidentiality_period}。
1. 未经对方书面同意，任何一方不得向第三方披露、转让或允许第三方使用上述保密信息；
2. 违反保密义务的，违约方应向守约方支付违约金 {penalty_amount} 元，并赔偿由此给守约方造成的全部损失；
3. 本条义务在合同终止或解除后继续有效。`,
      variables: [
        {
          name: 'confidentiality_period',
          label: '保密期限',
          type: 'text',
          default_value: '合同终止后 3 年',
          required: true,
        },
        {
          name: 'penalty_amount',
          label: '违约金金额（元）',
          type: 'currency',
          default_value: '50000',
          required: true,
        },
      ],
      risk_notes: [
        '保密期限建议不少于合同终止后 2 年',
        '建议明确界定保密信息的范围与除外情形',
        '违约金应足以覆盖潜在损失，建议设置赔偿上限',
      ],
    },
    // 4. 知识产权归属
    {
      id: 'clause-tpl-ip-ownership',
      clause_type: 'ip_ownership',
      title: '知识产权归属',
      content: `知识产权归属
1. 本合同项下交付成果的知识产权归 {ip_owner} 所有，知识产权范围包括 {ip_scope}；
2. 乙方保证其交付的成果不侵犯任何第三方的知识产权，否则由乙方承担全部法律责任并赔偿甲方损失；
3. 一方许可对方使用的知识产权，对方仅可在本合同约定范围内使用，不得擅自转让或授权第三方使用。`,
      variables: [
        {
          name: 'ip_owner',
          label: '知识产权归属方',
          type: 'select',
          default_value: '甲方',
          options: ['甲方', '乙方', '双方共有'],
          required: true,
        },
        {
          name: 'ip_scope',
          label: '知识产权范围',
          type: 'text',
          default_value: '著作权、专利申请权及商业秘密',
          required: true,
        },
      ],
      risk_notes: [
        '建议明确职务成果与委托成果的权属区分',
        '需约定背景知识产权与前景知识产权的归属',
        '应加入知识产权不侵权保证条款',
      ],
    },
    // 5. 违约责任
    {
      id: 'clause-tpl-liability',
      clause_type: 'liability',
      title: '违约责任',
      content: `违约责任
1. 任何一方未按约定履行合同义务的，构成违约，应向守约方承担违约责任；
2. 乙方逾期交付的，每逾期一日，应按合同总金额的 {breach_penalty_rate} 向甲方支付违约金，违约金累计不超过合同总金额的 {max_penalty}；
3. 甲方逾期付款的，每逾期一日，应按欠付金额的 {breach_penalty_rate} 向乙方支付违约金，违约金累计不超过欠付金额的 {max_penalty}；
4. 违约方支付违约金后，仍应继续履行合同义务。`,
      variables: [
        {
          name: 'breach_penalty_rate',
          label: '日违约金比例',
          type: 'text',
          default_value: '0.3%',
          required: true,
        },
        {
          name: 'max_penalty',
          label: '违约金上限比例',
          type: 'text',
          default_value: '20%',
          required: true,
        },
      ],
      risk_notes: [
        '日违约金比例建议为 0.3% - 0.5%，过高可能不被法院支持',
        '建议设置违约金上限，避免无限累积',
        '应区分不同违约情形设置差异化责任',
      ],
    },
    // 6. 终止条款
    {
      id: 'clause-tpl-termination',
      clause_type: 'termination',
      title: '终止条款',
      content: `合同终止
1. 出现下列情形之一时，一方可书面通知对方解除本合同：{termination_conditions}；
2. 一方主张解除合同的，应提前 {notice_period} 书面通知对方；
3. 合同解除后，不影响合同中结算、清理、保密及争议解决等条款的效力；
4. 因一方根本违约导致合同解除的，守约方有权要求违约方赔偿损失。`,
      variables: [
        {
          name: 'notice_period',
          label: '提前通知期',
          type: 'text',
          default_value: '30 日',
          required: true,
        },
        {
          name: 'termination_conditions',
          label: '解除条件',
          type: 'text',
          default_value: '对方根本违约、不可抗力致合同目的不能实现、对方进入破产清算程序',
          required: true,
        },
      ],
      risk_notes: [
        '建议明确约定单方解除的具体情形，避免争议',
        '通知期应合理，建议不少于 15 日',
        '应约定解除后的清算与交接安排',
      ],
    },
    // 7. 争议解决
    {
      id: 'clause-tpl-dispute',
      clause_type: 'dispute_resolution',
      title: '争议解决',
      content: `争议解决
1. 本合同的订立、效力、解释、履行及争议解决均适用 {jurisdiction} 法律；
2. 因本合同引起的或与本合同有关的任何争议，双方应首先通过友好协商解决；协商不成的，提交 {arbitration_body} 仲裁解决，仲裁裁决为终局裁决，对双方均有约束力；
3. 仲裁费用由败诉方承担。`,
      variables: [
        {
          name: 'jurisdiction',
          label: '适用法律/管辖地',
          type: 'text',
          default_value: '中华人民共和国',
          required: true,
        },
        {
          name: 'arbitration_body',
          label: '仲裁/诉讼机构',
          type: 'text',
          default_value: '北京仲裁委员会',
          required: true,
        },
      ],
      risk_notes: [
        '建议在仲裁与诉讼之间明确选择其一，避免条款无效',
        '仲裁机构应明确具体名称，避免约定不明',
        '建议约定管辖地，便于争议处理',
      ],
    },
    // 8. 不可抗力
    {
      id: 'clause-tpl-force-majeure',
      clause_type: 'force_majeure',
      title: '不可抗力',
      content: `不可抗力
1. 不可抗力范围包括 {force_majeure_scope}；
2. 受不可抗力影响的一方应在不可抗力发生后 {notice_days} 内书面通知对方，并提供有权机构出具的证明文件；
3. 因不可抗力致使合同不能履行或不能完全履行的，根据不可抗力的影响，部分或全部免除违约责任；
4. 不可抗力持续 30 日以上，双方应就是否继续履行合同协商，协商不成的，任何一方可解除合同。`,
      variables: [
        {
          name: 'force_majeure_scope',
          label: '不可抗力范围',
          type: 'text',
          default_value: '地震、台风、洪水、战争、政府行为等不能预见、不能避免并不能克服的客观情况',
          required: true,
        },
        {
          name: 'notice_days',
          label: '通知期限（日）',
          type: 'number',
          default_value: '7',
          required: true,
        },
      ],
      risk_notes: [
        '建议明确列举不可抗力情形并设置兜底条款',
        '通知期限建议不超过 10 日，避免举证困难',
        '应约定不可抗力持续时的合同处理机制',
      ],
    },
  ];
}

// ===== Mock 起草项目 =====
// 返回 3 个起草项目，覆盖 draft / review / finalized 三种状态
export function getDraftingProjects(): DraftingProject[] {
  const templates = getDraftingClauseTemplates();
  return [
    {
      id: 'draft-prj-001',
      name: 'XX产品采购合同',
      contract_type: '采购合同',
      party_a: '北京科技有限公司',
      party_b: '深圳制造有限公司',
      clauses: [templates[0], templates[1], templates[4], templates[6]],
      status: 'review',
      created_at: daysAgo(5),
      updated_at: daysAgo(2),
    },
    {
      id: 'draft-prj-002',
      name: '软件外包开发合同',
      contract_type: '服务合同',
      party_a: '北京科技有限公司',
      party_b: '上海软件开发公司',
      clauses: [
        templates[2],
        templates[3],
        templates[4],
        templates[5],
        templates[7],
      ],
      status: 'draft',
      created_at: daysAgo(12),
      updated_at: daysAgo(10),
    },
    {
      id: 'draft-prj-003',
      name: '办公设备租赁合同',
      contract_type: '租赁合同',
      party_a: '北京科技有限公司',
      party_b: '广州租赁服务公司',
      clauses: [templates[0], templates[1], templates[6]],
      status: 'finalized',
      created_at: daysAgo(30),
      updated_at: daysAgo(25),
    },
  ];
}

// ===== 条款模板填充 =====
// 将条款 content 中的 {variable_name} 占位符替换为实际值
// 未提供值的变量保留占位符，便于预览时识别未填项
export function fillClauseTemplate(
  clause: DraftedClause,
  variables: Record<string, string>
): string {
  let result = clause.content;
  for (const variable of clause.variables) {
    const value = variables[variable.name];
    // 仅在提供非空值时替换，否则保留原占位符
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      result = result.split(`{${variable.name}}`).join(String(value));
    }
  }
  return result;
}

// ===== 完整合同文本生成 =====
// 拼接项目信息与所有条款生成完整合同文本
// filledVariables 形如 { [clauseId]: { varName: value } }
export function generateContract(
  project: DraftingProject,
  filledVariables: Record<string, Record<string, string>>
): string {
  const lines: string[] = [];

  // 合同标题与基本信息
  lines.push(project.name);
  lines.push('');
  lines.push(`甲方：${project.party_a}`);
  lines.push(`乙方：${project.party_b}`);
  lines.push('');
  lines.push(
    `根据《中华人民共和国民法典》及相关法律法规，甲乙双方本着平等、自愿、公平和诚实信用的原则，就${project.contract_type}事宜协商一致，订立本合同。`
  );
  lines.push('');

  // 按条款顺序拼接
  project.clauses.forEach((clause, idx) => {
    const order = idx + 1;
    lines.push(`第${cnNumber(order)}条 ${clause.title}`);
    const variables = filledVariables[clause.id] || {};
    lines.push(fillClauseTemplate(clause, variables));
    lines.push('');
  });

  // 签署区
  lines.push('（以下无正文，为签署页）');
  lines.push('');
  lines.push('甲方（盖章）：__________________      乙方（盖章）：__________________');
  lines.push('授权代表：______________________      授权代表：______________________');
  lines.push('日期：________年____月____日          日期：________年____月____日');

  return lines.join('\n');
}

// ===== 创建起草项目 =====
export function createDraftingProject(
  name: string,
  contractType: string,
  partyA: string,
  partyB: string
): DraftingProject {
  const now = new Date().toISOString();
  return {
    id: `draft-prj-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    contract_type: contractType,
    party_a: partyA,
    party_b: partyB,
    clauses: [],
    status: 'draft',
    created_at: now,
    updated_at: now,
  };
}

// 将阿拉伯数字转为中文数字（用于条款序号，支持 1-20）
function cnNumber(num: number): string {
  const cn = [
    '一', '二', '三', '四', '五', '六', '七', '八', '九', '十',
    '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
  ];
  return cn[num - 1] || String(num);
}

// 重新导出标签配置，方便页面统一引用
export { DRAFTING_CLAUSE_TYPE_LABELS };
