// ===== 合规检查引擎 =====
// 提供合规规则库、合同文本合规检查与合规报告生成能力
// 覆盖公司法、合同法、劳动法、数据保护、税法、行业规范六大领域
// 供合规 API 与合规页面共用

import {
  ComplianceRule,
  ComplianceCheckResult,
  ComplianceReport,
  ComplianceCategory,
  ComplianceStatus,
  COMPLIANCE_CATEGORY_LABELS,
  COMPLIANCE_STATUS_CONFIG,
} from './types';

// ===== 规则匹配语义说明 =====
// check_pattern 为正则字符串，rule.status 表示"命中"时的语义：
//   - status='compliant'：命中即合规（规则要求某要素"存在"），未命中则判定为违规
//   - status='warning'/'violation'：命中即发现风险（命中=问题），未命中则判定为合规
//   - status='not_applicable'：不参与命中判定（由适用性逻辑决定）
// 个别数值阈值规则（违约金比例、试用期上限）采用专门的数值比较逻辑

// ===== 合规规则库 =====

// 返回 12 条合规规则，覆盖六大法律领域
export function getComplianceRules(): ComplianceRule[] {
  return [
    // ===== 公司法 =====
    {
      id: 'CR-CL-01',
      category: 'company_law',
      rule_number: '公司法-01',
      title: '法定代表人授权确认',
      description: '重大合同应确认由法定代表人或其授权代表签署，并附授权委托手续。',
      legal_basis: '《中华人民共和国公司法》第十三条、第五十条',
      check_pattern: '法定代表人|授权代表|授权委托书|负责人',
      status: 'compliant',
      severity: 'high',
      recommendation: '建议在合同中载明签署人姓名、职务，并附法定代表人身份证明或授权委托书。',
    },
    {
      id: 'CR-CL-02',
      category: 'company_law',
      rule_number: '公司法-02',
      title: '重大事项决议程序',
      description: '对外担保、重大资产处置等事项应经股东会或董事会决议。',
      legal_basis: '《中华人民共和国公司法》第十六条、第一百四十八条',
      check_pattern: '股东会决议|董事会决议|股东大会|股东决定',
      status: 'compliant',
      severity: 'medium',
      recommendation: '建议附上股东会或董事会决议文件，确保签约行为经合法内部决议。',
    },
    // ===== 合同法 =====
    {
      id: 'CR-CT-01',
      category: 'contract_law',
      rule_number: '合同法-01',
      title: '合同书面形式',
      description: '合同应当采用书面形式订立，法律法规另有规定的除外。',
      legal_basis: '《中华人民共和国民法典》第四百九十条',
      check_pattern: '合同|协议|契约|本协议',
      status: 'compliant',
      severity: 'low',
      recommendation: '建议以书面形式订立合同并由双方签章确认。',
    },
    {
      id: 'CR-CT-02',
      category: 'contract_law',
      rule_number: '合同法-02',
      title: '违约金比例合理性',
      description: '违约金约定不宜过分高于实际损失，建议不超过合同总额的 30%。',
      legal_basis: '《中华人民共和国民法典》第五百八十五条',
      check_pattern: '违约金[^。；\\n]*?(\\d{1,3})\\s*[%％]',
      status: 'warning',
      severity: 'medium',
      recommendation: '建议将违约金比例控制在合同总额 30% 以内，并约定损失差额补足条款。',
    },
    {
      id: 'CR-CT-03',
      category: 'contract_law',
      rule_number: '合同法-03',
      title: '格式条款提示说明义务',
      description: '采用格式条款的，提供方应采取合理方式提示免除或限制责任的条款。',
      legal_basis: '《中华人民共和国民法典》第四百九十六条、第四百九十七条',
      check_pattern: '格式条款|格式合同|免责条款|免除责任',
      status: 'warning',
      severity: 'medium',
      recommendation: '建议对格式免责条款以加粗、下划线等方式予以显著提示，并保留提示说明证据。',
    },
    // ===== 劳动法 =====
    {
      id: 'CR-LB-01',
      category: 'labor_law',
      rule_number: '劳动法-01',
      title: '试用期期限合规',
      description: '三年以上固定期限或无固定期限劳动合同试用期不得超过六个月。',
      legal_basis: '《中华人民共和国劳动合同法》第十九条',
      check_pattern: '试用期[^。；\\n]{0,15}([7-9]|1[0-2])\\s*个月',
      status: 'violation',
      severity: 'high',
      recommendation: '建议将试用期调整为六个月以内，并按规定约定合同期限。',
    },
    {
      id: 'CR-LB-02',
      category: 'labor_law',
      rule_number: '劳动法-02',
      title: '社会保险缴纳',
      description: '用人单位应依法为劳动者缴纳社会保险费，不得约定免除。',
      legal_basis: '《中华人民共和国社会保险法》第五十八条、第六十条',
      check_pattern: '社会保险|社保|五险一金|缴纳社保',
      status: 'compliant',
      severity: 'high',
      recommendation: '建议明确约定用人单位依法缴纳社会保险，不得以现金补偿替代。',
    },
    // ===== 数据保护 =====
    {
      id: 'CR-DP-01',
      category: 'data_protection',
      rule_number: '数据保护-01',
      title: '个人信息处理同意',
      description: '处理个人信息应取得个人同意，并告知处理目的、方式与范围。',
      legal_basis: '《中华人民共和国个人信息保护法》第十三条、第十四条',
      check_pattern: '同意|知情|授权|个人同意|书面同意',
      status: 'compliant',
      severity: 'high',
      recommendation: '建议约定取得信息主体同意，并告知处理目的、方式与存储期限。',
    },
    {
      id: 'CR-DP-02',
      category: 'data_protection',
      rule_number: '数据保护-02',
      title: '数据跨境传输合规',
      description: '向境外提供个人信息应通过安全评估或签订标准合同并备案。',
      legal_basis: '《中华人民共和国个人信息保护法》第三十八条、《数据出境安全评估办法》',
      check_pattern: '跨境|境外|出境|数据出境|向境外',
      status: 'warning',
      severity: 'medium',
      recommendation: '建议约定数据出境前完成安全评估或签订个人信息出境标准合同并备案。',
    },
    // ===== 税法 =====
    {
      id: 'CR-TX-01',
      category: 'tax_law',
      rule_number: '税法-01',
      title: '发票开具约定',
      description: '合同应约定发票的开具类型（增值税专用/普通发票）与时间。',
      legal_basis: '《中华人民共和国税收征收管理法》第二十一条、《发票管理办法》第十九条',
      check_pattern: '发票|增值税专用发票|普通发票|开具发票',
      status: 'compliant',
      severity: 'medium',
      recommendation: '建议明确约定发票类型、税率及开具时间，以便进项税抵扣。',
    },
    {
      id: 'CR-TX-02',
      category: 'tax_law',
      rule_number: '税法-02',
      title: '税费承担约定',
      description: '合同应明确约定各项税费（增值税、印花税等）的承担主体。',
      legal_basis: '《中华人民共和国税收征收管理法》第四条',
      check_pattern: '税费|税负|税收承担|含税|税费承担|承担方',
      status: 'compliant',
      severity: 'low',
      recommendation: '建议明确约定增值税、印花税等税费承担主体与含税/不含税价款。',
    },
    // ===== 行业规范 =====
    {
      id: 'CR-IS-01',
      category: 'industry_specific',
      rule_number: '行业规范-01',
      title: '行业准入资质',
      description: '涉及特许经营的，应核实并附相关行政许可或资质证书。',
      legal_basis: '《中华人民共和国行政许可法》及相关行业准入规定',
      check_pattern: '资质|许可证|经营许可|行政许可|执业资质|资质证书',
      status: 'compliant',
      severity: 'medium',
      recommendation: '建议核实并附上对方相关经营资质或许可证书复印件。',
    },
  ];
}

// ===== 适用性判定 =====

// 判定规则对当前合同文本是否适用
// 劳动法规则仅适用于劳动合同；数据保护规则仅在涉及个人信息时适用
function isApplicable(rule: ComplianceRule, text: string): boolean {
  if (rule.category === 'labor_law') {
    return /劳动|员工|试用期|工资|社保|用工|雇员|用人单位/.test(text);
  }
  if (rule.category === 'data_protection') {
    return /个人信息|用户数据|数据收集|隐私|数据出境|个人信息处理/.test(text);
  }
  // 公司法决议规则仅当合同涉及担保/重大事项时重点提示，但仍视为适用
  return true;
}

// ===== 单条规则检查 =====

// 对单条规则执行检查，返回检查结果
function checkRule(rule: ComplianceRule, text: string): ComplianceCheckResult {
  const base: ComplianceCheckResult = {
    rule_id: rule.id,
    category: rule.category,
    title: rule.title,
    legal_basis: rule.legal_basis,
    status: 'compliant',
    severity: rule.severity,
    details: '',
    clause_refs: [],
    recommendation: rule.recommendation,
  };

  // 适用性：不适用直接返回
  if (!isApplicable(rule, text)) {
    return {
      ...base,
      status: 'not_applicable',
      details: '当前合同文本不涉及本规则适用范围，已自动标记为不适用。',
    };
  }

  // ===== 特殊数值规则：违约金比例上限 =====
  if (rule.id === 'CR-CT-02') {
    const matches: number[] = [];
    // 定位所有"违约金"出现位置，在其前后窗口内查找百分比
    // 兼容"违约金30%"与"合同总额35%的违约金"两种写法
    let pIdx = text.indexOf('违约金');
    while (pIdx !== -1) {
      const winStart = Math.max(0, pIdx - 40);
      const winEnd = Math.min(text.length, pIdx + 40);
      const windowText = text.slice(winStart, winEnd);
      const pctMatches = windowText.match(/(\d{1,3})\s*[%％]/g) || [];
      for (const p of pctMatches) {
        const n = parseFloat(p);
        if (!Number.isNaN(n)) matches.push(n);
      }
      pIdx = text.indexOf('违约金', pIdx + 1);
    }
    if (matches.length === 0) {
      // 未发现百分比形式的违约金
      if (/违约金|违约责任/.test(text)) {
        return {
          ...base,
          status: 'warning',
          details: '合同约定了违约金，但未以百分比形式明确比例，存在比例不明的合规隐患。',
        };
      }
      return {
        ...base,
        status: 'warning',
        details: '未发现违约金条款，争议时可能难以有效主张违约赔偿。',
      };
    }
    const maxRatio = Math.max(...matches);
    if (maxRatio > 30) {
      return {
        ...base,
        status: 'violation',
        details: `合同约定违约金比例为 ${maxRatio}%，超过合同总额 30% 的合理性参考上限，存在被法院调减风险。`,
      };
    }
    return {
      ...base,
      status: 'compliant',
      details: `合同约定违约金比例为 ${maxRatio}%，未超过 30% 参考上限，比例较为合理。`,
    };
  }

  // ===== 通用正则/关键词匹配 =====
  let regex: RegExp;
  try {
    regex = new RegExp(rule.check_pattern);
  } catch {
    // 非法正则降级为关键词包含检查
    return {
      ...base,
      status: 'warning',
      details: `规则正则表达式异常，无法执行匹配检查：${rule.check_pattern}`,
    };
  }

  const matched = regex.test(text);

  if (rule.status === 'compliant') {
    // 命中即合规，未命中则违规（缺少必要要素）
    if (matched) {
      return {
        ...base,
        status: 'compliant',
        details: `合同中包含「${rule.title}」要求的要素，符合合规要求。`,
      };
    }
    return {
      ...base,
      status: 'violation',
      details: `合同中未发现「${rule.title}」要求的要素，可能存在合规缺失。`,
    };
  }

  // 命中即发现问题（warning/violation），未命中则合规
  if (matched) {
    return {
      ...base,
      status: rule.status,
      details: `合同中检测到「${rule.title}」相关情形，建议关注：${rule.description}`,
    };
  }
  return {
    ...base,
    status: 'compliant',
    details: `合同中未发现「${rule.title}」相关风险情形，符合合规要求。`,
  };
}

// ===== 批量合规检查 =====

// 对全部（或指定）规则执行检查，返回检查结果列表
export function checkCompliance(
  contractText: string,
  rules: ComplianceRule[] = getComplianceRules()
): ComplianceCheckResult[] {
  const text = contractText || '';
  return rules.map((rule) => checkRule(rule, text));
}

// ===== 合规分数计算 =====

// 基于检查结果计算合规分数（0-100）
function calculateScore(results: ComplianceCheckResult[]): number {
  let score = 100;
  const violationWeight: Record<string, number> = { high: 15, medium: 10, low: 5 };
  const warningWeight: Record<string, number> = { high: 8, medium: 5, low: 2 };

  for (const r of results) {
    if (r.status === 'violation') {
      score -= violationWeight[r.severity] ?? 10;
    } else if (r.status === 'warning') {
      score -= warningWeight[r.severity] ?? 5;
    }
  }
  return Math.max(0, Math.min(100, score));
}

// ===== 合规报告生成 =====

// 生成完整合规报告：检查、统计、分数、总体状态
export function generateComplianceReport(
  contractText: string,
  contractId: string,
  contractTitle: string
): ComplianceReport {
  const results = checkCompliance(contractText);

  const passed = results.filter((r) => r.status === 'compliant').length;
  const warnings = results.filter((r) => r.status === 'warning').length;
  const violations = results.filter((r) => r.status === 'violation').length;
  const not_applicable = results.filter(
    (r) => r.status === 'not_applicable'
  ).length;

  const compliance_score = calculateScore(results);

  // 总体状态：有违规即违规，否则有警告即警告，否则合规
  let overall_status: ComplianceStatus;
  if (violations > 0) overall_status = 'violation';
  else if (warnings > 0) overall_status = 'warning';
  else overall_status = 'compliant';

  return {
    contract_id: contractId,
    contract_title: contractTitle,
    overall_status,
    compliance_score,
    total_checks: results.length,
    passed,
    warnings,
    violations,
    not_applicable,
    results,
    generated_at: new Date().toISOString(),
  };
}

// ===== 模拟合规报告 =====

// 返回模拟合规报告，用于演示模式
export function getMockComplianceReport(contractId: string): ComplianceReport {
  const now = new Date().toISOString();
  const results: ComplianceCheckResult[] = [
    {
      rule_id: 'CR-CL-01',
      category: 'company_law',
      title: '法定代表人授权确认',
      legal_basis: '《中华人民共和国公司法》第十三条、第五十条',
      status: 'compliant',
      severity: 'high',
      details: '合同中包含「法定代表人」要求的要素，符合合规要求。',
      clause_refs: ['首部'],
      recommendation: '建议在合同中载明签署人姓名、职务，并附法定代表人身份证明或授权委托书。',
    },
    {
      rule_id: 'CR-CL-02',
      category: 'company_law',
      title: '重大事项决议程序',
      legal_basis: '《中华人民共和国公司法》第十六条、第一百四十八条',
      status: 'warning',
      severity: 'medium',
      details: '合同中未发现股东会或董事会决议相关表述，如涉及重大事项建议补充决议文件。',
      recommendation: '建议附上股东会或董事会决议文件，确保签约行为经合法内部决议。',
    },
    {
      rule_id: 'CR-CT-01',
      category: 'contract_law',
      title: '合同书面形式',
      legal_basis: '《中华人民共和国民法典》第四百九十条',
      status: 'compliant',
      severity: 'low',
      details: '合同采用书面形式订立，符合合规要求。',
      recommendation: '建议以书面形式订立合同并由双方签章确认。',
    },
    {
      rule_id: 'CR-CT-02',
      category: 'contract_law',
      title: '违约金比例合理性',
      legal_basis: '《中华人民共和国民法典》第五百八十五条',
      status: 'compliant',
      severity: 'medium',
      details: '合同约定违约金比例为 10%，未超过 30% 参考上限，比例较为合理。',
      clause_refs: ['第八条'],
      recommendation: '建议将违约金比例控制在合同总额 30% 以内，并约定损失差额补足条款。',
    },
    {
      rule_id: 'CR-CT-03',
      category: 'contract_law',
      title: '格式条款提示说明义务',
      legal_basis: '《中华人民共和国民法典》第四百九十六条、第四百九十七条',
      status: 'warning',
      severity: 'medium',
      details: '合同中检测到「格式条款提示说明义务」相关情形，建议关注：采用格式条款的，提供方应采取合理方式提示免除或限制责任的条款。',
      recommendation: '建议对格式免责条款以加粗、下划线等方式予以显著提示，并保留提示说明证据。',
    },
    {
      rule_id: 'CR-LB-01',
      category: 'labor_law',
      title: '试用期期限合规',
      legal_basis: '《中华人民共和国劳动合同法》第十九条',
      status: 'not_applicable',
      severity: 'high',
      details: '当前合同文本不涉及本规则适用范围，已自动标记为不适用。',
      recommendation: '建议将试用期调整为六个月以内，并按规定约定合同期限。',
    },
    {
      rule_id: 'CR-LB-02',
      category: 'labor_law',
      title: '社会保险缴纳',
      legal_basis: '《中华人民共和国社会保险法》第五十八条、第六十条',
      status: 'not_applicable',
      severity: 'high',
      details: '当前合同文本不涉及本规则适用范围，已自动标记为不适用。',
      recommendation: '建议明确约定用人单位依法缴纳社会保险，不得以现金补偿替代。',
    },
    {
      rule_id: 'CR-DP-01',
      category: 'data_protection',
      title: '个人信息处理同意',
      legal_basis: '《中华人民共和国个人信息保护法》第十三条、第十四条',
      status: 'not_applicable',
      severity: 'high',
      details: '当前合同文本不涉及本规则适用范围，已自动标记为不适用。',
      recommendation: '建议约定取得信息主体同意，并告知处理目的、方式与存储期限。',
    },
    {
      rule_id: 'CR-DP-02',
      category: 'data_protection',
      title: '数据跨境传输合规',
      legal_basis: '《中华人民共和国个人信息保护法》第三十八条、《数据出境安全评估办法》',
      status: 'not_applicable',
      severity: 'medium',
      details: '当前合同文本不涉及本规则适用范围，已自动标记为不适用。',
      recommendation: '建议约定数据出境前完成安全评估或签订个人信息出境标准合同并备案。',
    },
    {
      rule_id: 'CR-TX-01',
      category: 'tax_law',
      title: '发票开具约定',
      legal_basis: '《中华人民共和国税收征收管理法》第二十一条、《发票管理办法》第十九条',
      status: 'violation',
      severity: 'medium',
      details: '合同中未发现「发票开具约定」要求的要素，可能存在合规缺失。',
      recommendation: '建议明确约定发票类型、税率及开具时间，以便进项税抵扣。',
    },
    {
      rule_id: 'CR-TX-02',
      category: 'tax_law',
      title: '税费承担约定',
      legal_basis: '《中华人民共和国税收征收管理法》第四条',
      status: 'compliant',
      severity: 'low',
      details: '合同中包含「税费承担约定」要求的要素（含税价款），符合合规要求。',
      clause_refs: ['第二条'],
      recommendation: '建议明确约定增值税、印花税等税费承担主体与含税/不含税价款。',
    },
    {
      rule_id: 'CR-IS-01',
      category: 'industry_specific',
      title: '行业准入资质',
      legal_basis: '《中华人民共和国行政许可法》及相关行业准入规定',
      status: 'warning',
      severity: 'medium',
      details: '合同中未发现「行业准入资质」相关要素，建议核实对方经营资质。',
      recommendation: '建议核实并附上对方相关经营资质或许可证书复印件。',
    },
  ];

  const passed = results.filter((r) => r.status === 'compliant').length;
  const warnings = results.filter((r) => r.status === 'warning').length;
  const violations = results.filter((r) => r.status === 'violation').length;
  const not_applicable = results.filter(
    (r) => r.status === 'not_applicable'
  ).length;

  return {
    contract_id: contractId,
    contract_title: 'XX产品采购合同',
    overall_status: 'violation',
    compliance_score: 73,
    total_checks: results.length,
    passed,
    warnings,
    violations,
    not_applicable,
    results,
    generated_at: now,
  };
}

// 重新导出标签与配置，方便页面统一引用
export {
  COMPLIANCE_CATEGORY_LABELS,
  COMPLIANCE_STATUS_CONFIG,
};
