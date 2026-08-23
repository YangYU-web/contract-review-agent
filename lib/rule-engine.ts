// ===== 自定义风险规则引擎 =====
// 提供预设规则、规则匹配评估与规则创建能力
// 供规则管理 API 与规则管理页面共用

import {
  CustomRiskRule,
  RuleMatchResult,
  RuleOperator,
  RuleSeverity,
  RULE_OPERATOR_LABELS,
} from './types';

// 一天的毫秒数
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// 生成距离今天指定天数的 ISO 时间字符串
function daysAgo(days: number): string {
  return new Date(Date.now() - days * ONE_DAY_MS).toISOString();
}

// ===== 辅助：数值提取与比较 =====

// 从文本中提取所有数字（含小数），用于 greater_than / less_than 比较
function extractNumbers(text: string): number[] {
  const matches = text.match(/-?\d+(?:\.\d+)?/g) || [];
  return matches.map(Number).filter((n) => !Number.isNaN(n));
}

// 从文本中提取百分比数值（如 "50%"、"/50%"），返回数值数组
function extractPercentages(text: string): number[] {
  const matches = text.match(/(\d+(?:\.\d+)?)\s*[%％]/g) || [];
  return matches
    .map((m) => parseFloat(m))
    .filter((n) => !Number.isNaN(n));
}

// ===== 单条规则评估 =====

// 根据操作符对单个条款进行匹配评估，命中返回 RuleMatchResult，否则返回 null
export function evaluateRule(
  rule: CustomRiskRule,
  clauses: { clause_id: string; clause_text: string }[]
): RuleMatchResult | null {
  const ruleValue = rule.value || '';

  for (const clause of clauses) {
    const text = clause.clause_text || '';
    let matched = false;
    let matchedValue = '';

    switch (rule.operator) {
      case 'contains': {
        // 检查文本是否包含指定关键词
        if (text.includes(ruleValue)) {
          matched = true;
          matchedValue = ruleValue;
        }
        break;
      }
      case 'not_contains': {
        // 检查文本是否不包含指定关键词
        if (!text.includes(ruleValue)) {
          matched = true;
          matchedValue = `未包含「${ruleValue}」`;
        }
        break;
      }
      case 'equals': {
        // 精确匹配
        if (text.trim() === ruleValue.trim()) {
          matched = true;
          matchedValue = ruleValue;
        }
        break;
      }
      case 'regex': {
        // 正则匹配
        try {
          const regex = new RegExp(ruleValue);
          const m = text.match(regex);
          if (m) {
            matched = true;
            matchedValue = m[0];
          }
        } catch {
          // 非法正则，跳过
        }
        break;
      }
      case 'greater_than': {
        // 提取数字进行比较：优先匹配百分比，其次匹配普通数字
        const threshold = parseFloat(ruleValue);
        if (!Number.isNaN(threshold)) {
          const pcts = extractPercentages(text);
          const nums = extractNumbers(text);
          const candidates = pcts.length > 0 ? pcts : nums;
          const over = candidates.find((n) => n > threshold);
          if (over !== undefined) {
            matched = true;
            matchedValue = `${over}`;
          }
        }
        break;
      }
      case 'less_than': {
        const threshold = parseFloat(ruleValue);
        if (!Number.isNaN(threshold)) {
          const pcts = extractPercentages(text);
          const nums = extractNumbers(text);
          const candidates = pcts.length > 0 ? pcts : nums;
          const under = candidates.find((n) => n < threshold && n >= 0);
          if (under !== undefined) {
            matched = true;
            matchedValue = `${under}`;
          }
        }
        break;
      }
      default:
        break;
    }

    if (matched) {
      return {
        rule_id: rule.id,
        rule_name: rule.name,
        clause_id: clause.clause_id,
        clause_text: clause.clause_text,
        matched_value: matchedValue,
        severity: rule.severity,
        suggestion: rule.suggestion,
      };
    }
  }

  return null;
}

// ===== 批量规则评估 =====

// 对所有活跃规则执行匹配，返回所有匹配结果
export function evaluateAllRules(
  rules: CustomRiskRule[],
  clauses: { clause_id: string; clause_text: string }[]
): RuleMatchResult[] {
  const results: RuleMatchResult[] = [];
  for (const rule of rules) {
    if (rule.status !== 'active') continue;
    const result = evaluateRule(rule, clauses);
    if (result) {
      results.push(result);
    }
  }
  return results;
}

// ===== 创建规则 =====

// 基于参数创建一条新的自定义风险规则
export function createRule(
  name: string,
  description: string,
  rule_type: string,
  field: string,
  operator: RuleOperator,
  value: string,
  severity: RuleSeverity,
  suggestion: string
): CustomRiskRule {
  const now = new Date().toISOString();
  return {
    id: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    description,
    rule_type,
    field,
    operator,
    value,
    severity,
    suggestion,
    status: 'active',
    match_count: 0,
    created_by: '法务部-张明',
    created_at: now,
    updated_at: now,
  };
}

// ===== 预设规则 =====

// 返回 5-6 条预设规则，覆盖付款、违约、保密、争议等常见风险场景
export function getMockRules(): CustomRiskRule[] {
  const base = (
    id: string,
    name: string,
    description: string,
    rule_type: string,
    field: string,
    operator: RuleOperator,
    value: string,
    severity: RuleSeverity,
    suggestion: string,
    match_count: number,
    days: number
  ): CustomRiskRule => ({
    id,
    name,
    description,
    rule_type,
    field,
    operator,
    value,
    severity,
    suggestion,
    status: 'active',
    match_count,
    created_by: '法务部-张明',
    created_at: daysAgo(days),
    updated_at: daysAgo(days),
  });

  return [
    base(
      'rule-001',
      '预付款比例超过40%',
      '检测付款条款中预付款比例是否超过 40%，过高的预付款会增加买方资金风险。',
      'payment_risk',
      '付款条款',
      'greater_than',
      '40',
      'high',
      '建议将预付款比例控制在 30% 以内，或约定分期付款并在验收合格后支付尾款。',
      8,
      30
    ),
    base(
      'rule-002',
      '缺少违约金条款',
      '检测合同是否缺少明确的违约金条款，避免违约时无法有效主张赔偿。',
      'breach_liability',
      '违约责任',
      'not_contains',
      '违约金',
      'high',
      '建议明确约定违约金的具体金额或计算方式（如合同总金额的 15%），并约定损失差额补足。',
      5,
      28
    ),
    base(
      'rule-003',
      '保密期限不足5年',
      '检测保密条款约定期限是否低于 5 年，避免商业秘密保护期过短。',
      'confidentiality',
      '保密义务',
      'less_than',
      '5',
      'medium',
      '建议将保密期限延长至合同终止后 5 年以上，并补充违约赔偿条款。',
      3,
      25
    ),
    base(
      'rule-004',
      '无争议解决条款',
      '检测合同是否缺少争议解决条款（仲裁或诉讼），避免纠纷时管辖不明。',
      'dispute_resolution',
      '争议解决',
      'not_contains',
      '争议',
      'medium',
      '建议补充争议解决条款，明确协商不成时向甲方所在地有管辖权的法院提起诉讼。',
      2,
      20
    ),
    base(
      'rule-005',
      '交付周期超过30天',
      '检测交付条款中交付周期是否超过 30 天，避免影响项目进度。',
      'delivery_risk',
      '交付条款',
      'greater_than',
      '30',
      'medium',
      '建议将交付周期缩短至 30 天以内，并约定逾期交付的违约金计算方式。',
      6,
      18
    ),
    base(
      'rule-006',
      '未约定知识产权归属',
      '检测合同是否未明确约定履行过程中产生成果的知识产权归属。',
      'intellectual_property',
      '知识产权',
      'not_contains',
      '知识产权',
      'low',
      '建议明确约定已有知识产权归属及新开发成果的权属，避免后续权属纠纷。',
      4,
      15
    ),
  ];
}

// 重新导出操作符标签，方便页面统一引用
export { RULE_OPERATOR_LABELS };
