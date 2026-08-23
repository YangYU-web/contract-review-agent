// ===== 条款比对与异常检测模块 =====

import { ClauseDiff, ClauseComparisonResult, DiffType } from './types';
import { getStandardTemplate, StandardClause } from './standard-clauses';

// 文本相似度计算（基于编辑距离）
function calculateSimilarity(text1: string, text2: string): number {
  if (!text1 || !text2) return 0;
  const s1 = text1.replace(/\s+/g, ' ').trim();
  const s2 = text2.replace(/\s+/g, ' ').trim();
  if (s1 === s2) return 100;

  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  const distance = levenshtein(shorter, longer);
  return Math.round((1 - distance / longer.length) * 100);
}

function levenshtein(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) dp[i][j] = dp[i - 1][j - 1];
      else dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + 1);
    }
  }
  return dp[m][n];
}

// 关键词提取（用于匹配条款）
function extractKeywords(text: string): string[] {
  const keywords: string[] = [];
  const patterns = [
    { regex: /付款|支付|预付|货款|价款|结算|金额/g, label: '付款' },
    { regex: /交付|验收|发货|交货|运输/g, label: '交付' },
    { regex: /违约|违约金|赔偿|损失/g, label: '违约' },
    { regex: /知识产权|专利|商标|著作权/g, label: '知识产权' },
    { regex: /保密|机密|商业秘密/g, label: '保密' },
    { regex: /争议|仲裁|诉讼|管辖/g, label: '争议' },
    { regex: /不可抗力/g, label: '不可抗力' },
    { regex: /终止|解除|期满|续签/g, label: '终止' },
    { regex: /数据|隐私|个人信息/g, label: '数据保护' },
    { regex: /竞业/g, label: '竞业' },
  ];
  for (const { regex, label } of patterns) {
    if (regex.test(text)) keywords.push(label);
  }
  return keywords;
}

// 匹配合同条款与标准条款
type ContractClauseItem = { clause_number: string; clause_text: string; clause_type: string };

function matchClauses(
  contractClauses: ContractClauseItem[],
  standardClauses: StandardClause[]
): { matched: { contract: ContractClauseItem; standard: StandardClause; similarity: number }[]; missing: StandardClause[]; extra: ContractClauseItem[] } {
  const matched: { contract: typeof contractClauses[0]; standard: StandardClause; similarity: number }[] = [];
  const missing: StandardClause[] = [];
  const usedContractIndices = new Set<number>();

  for (const standard of standardClauses) {
    let bestMatch: { contract: typeof contractClauses[0]; standard: StandardClause; similarity: number } | null = null;
    let bestSimilarity = 0;

    for (let i = 0; i < contractClauses.length; i++) {
      if (usedContractIndices.has(i)) continue;
      const contractClause = contractClauses[i];
      const similarity = calculateSimilarity(contractClause.clause_text, standard.clause_text);
      const stdKeywords = extractKeywords(standard.clause_text);
      const contractKeywords = extractKeywords(contractClause.clause_text);
      const keywordMatch = stdKeywords.some(k => contractKeywords.includes(k));

      if (keywordMatch && similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestMatch = { contract: contractClause, standard, similarity };
      }
    }

    if (bestMatch && bestSimilarity > 30) {
      matched.push(bestMatch);
      const idx = contractClauses.indexOf(bestMatch.contract);
      usedContractIndices.add(idx);
    } else {
      missing.push(standard);
    }
  }

  const extra = contractClauses.filter((_, i) => !usedContractIndices.has(i));
  return { matched, missing, extra };
}

// 提取关键差异点
function extractKeyDifferences(original: string, standard: string): string[] {
  const differences: string[] = [];
  const origWords = original.replace(/\s+/g, ' ').split(' ');
  const stdWords = standard.replace(/\s+/g, ' ').split(' ');

  // 检查金额差异
  const origAmounts: string[] = original.match(/[\d.]+[%％]?万?元?/g) || [];
  const stdAmounts: string[] = standard.match(/[\d.]+[%％]?万?元?/g) || [];
  if (origAmounts.length > 0 && stdAmounts.length > 0) {
    if (origAmounts.some(a => !stdAmounts.includes(a))) {
      differences.push(`金额差异：合同中为${origAmounts.join('/')}，标准条款为${stdAmounts.join('/')}`);
    }
  }

  // 检查期限差异
  const origDays: string[] = original.match(/\d+\s*(日|天|日|月|年)/g) || [];
  const stdDays: string[] = standard.match(/\d+\s*(日|天|日|月|年)/g) || [];
  if (origDays.length > 0 && stdDays.length > 0) {
    if (origDays.some(d => !stdDays.includes(d))) {
      differences.push(`期限差异：合同中为${origDays.join('/')}，标准条款为${stdDays.join('/')}`);
    }
  }

  // 检查方向性差异
  if (/甲方.*承担/.test(original) && /乙方.*承担/.test(standard)) {
    differences.push('责任主体差异：合同中由甲方承担，标准条款中由乙方承担');
  }
  if (/乙方.*承担/.test(original) && /甲方.*承担/.test(standard)) {
    differences.push('责任主体差异：合同中由乙方承担，标准条款中由甲方承担');
  }

  // 长度差异
  const lenDiff = Math.abs(original.length - standard.length);
  if (lenDiff > standard.length * 0.3) {
    differences.push(`条款详尽度差异：合同条款与标准条款长度差异${Math.round(lenDiff / standard.length * 100)}%`);
  }

  if (differences.length === 0) {
    differences.push('条款表述方式与标准模板存在措辞差异，但实质性内容基本一致');
  }

  return differences;
}

// 评估条款风险
function assessRisk(diffType: DiffType, similarity: number, isRequired: boolean): { assessment: string; suggestion: string } {
  switch (diffType) {
    case 'removed':
      return {
        assessment: isRequired ? '关键条款缺失，合同存在重大缺陷' : '非必要条款缺失，不影响合同效力',
        suggestion: isRequired ? '强烈建议补充该条款，否则合同存在法律风险' : '可选择性补充该条款',
      };
    case 'added':
      return {
        assessment: '合同中存在标准模板之外的额外条款，需评估其对甲方的影响',
        suggestion: '请法务专员审查该额外条款是否对甲方不利',
      };
    case 'modified':
      if (similarity < 50) {
        return {
          assessment: '条款与标准模板存在重大偏差，可能导致权利义务失衡',
          suggestion: '建议修改为接近标准模板的表述，或明确偏差理由',
        };
      } else if (similarity < 80) {
        return {
          assessment: '条款与标准模板存在中度偏差，需关注关键参数差异',
          suggestion: '建议核对金额、期限等关键参数是否符合市场惯例',
        };
      } else {
        return {
          assessment: '条款与标准模板基本一致，仅有措辞差异',
          suggestion: '可选择性微调措辞，无重大风险',
        };
      }
    default:
      return {
        assessment: '条款与标准模板一致',
        suggestion: '无需修改',
      };
  }
}

// 主函数：执行条款比对
export function compareClauses(
  contractText: string,
  contractType: string,
  contractId: string,
  contractClauses: { clause_number: string; clause_text: string; clause_type: string }[]
): ClauseComparisonResult {
  const template = getStandardTemplate(contractType);

  // 如果没有找到匹配的模板，返回通用分析
  if (!template) {
    return {
      contract_id: contractId,
      contract_type: contractType,
      total_clauses: contractClauses.length,
      matched_clauses: 0,
      modified_clauses: 0,
      missing_clauses: 0,
      extra_clauses: contractClauses.length,
      diffs: contractClauses.map((c, i) => ({
        clause_id: c.clause_number || `段落${i + 1}`,
        original_text: c.clause_text,
        standard_text: '（无标准模板）',
        diff_type: 'added' as DiffType,
        similarity: 0,
        key_differences: ['无对应的标准条款模板'],
        risk_assessment: '未找到该合同类型的标准条款模板，无法进行比对',
        suggestion: '建议手动审查所有条款',
      })),
      summary: `未找到「${contractType}」的标准条款模板，已列出全部${contractClauses.length}个条款供人工审查。`,
    };
  }

  const { matched, missing, extra } = matchClauses(contractClauses, template.clauses);

  const diffs: ClauseDiff[] = [];

  // 匹配的条款（modified 或 unchanged）
  for (const m of matched) {
    const diffType: DiffType = m.similarity >= 90 ? 'unchanged' : 'modified';
    const keyDiffs = diffType === 'unchanged' ? ['条款与标准模板一致'] : extractKeyDifferences(m.contract.clause_text, m.standard.clause_text);
    const { assessment, suggestion } = assessRisk(diffType, m.similarity, m.standard.is_required);

    diffs.push({
      clause_id: m.contract.clause_number,
      original_text: m.contract.clause_text,
      standard_text: m.standard.clause_text,
      diff_type: diffType,
      similarity: m.similarity,
      key_differences: keyDiffs,
      risk_assessment: assessment,
      suggestion,
    });
  }

  // 缺失的条款（removed）
  for (const m of missing) {
    const { assessment, suggestion } = assessRisk('removed', 0, m.is_required);
    diffs.push({
      clause_id: m.clause_id,
      original_text: '（合同中未包含此条款）',
      standard_text: m.clause_text,
      diff_type: 'removed',
      similarity: 0,
      key_differences: [m.risk_if_missing],
      risk_assessment: assessment,
      suggestion,
    });
  }

  // 额外条款（added）
  for (const e of extra) {
    const { assessment, suggestion } = assessRisk('added', 0, false);
    diffs.push({
      clause_id: e.clause_number,
      original_text: e.clause_text,
      standard_text: '（标准模板中无此条款）',
      diff_type: 'added',
      similarity: 0,
      key_differences: ['合同中存在标准模板之外的额外条款'],
      risk_assessment: assessment,
      suggestion,
    });
  }

  // 按差异严重程度排序
  const sortOrder = { removed: 0, modified: 1, added: 2, unchanged: 3 };
  diffs.sort((a, b) => sortOrder[a.diff_type] - sortOrder[b.diff_type]);

  const modifiedCount = diffs.filter(d => d.diff_type === 'modified').length;
  const missingCount = diffs.filter(d => d.diff_type === 'removed').length;
  const extraCount = diffs.filter(d => d.diff_type === 'added').length;
  const matchedCount = diffs.filter(d => d.diff_type === 'unchanged').length;

  const summary = `合同类型「${contractType}」，共${diffs.length}项条款分析：${matchedCount}项与标准一致，${modifiedCount}项存在偏差，${missingCount}项关键条款缺失，${extraCount}项为额外条款。${missingCount > 0 ? '存在关键条款缺失，建议补全。' : ''}`;

  return {
    contract_id: contractId,
    contract_type: contractType,
    total_clauses: diffs.length,
    matched_clauses: matchedCount,
    modified_clauses: modifiedCount,
    missing_clauses: missingCount,
    extra_clauses: extraCount,
    diffs,
    summary,
  };
}

// 生成Mock比对数据
export function getMockComparison(contractId: string, contractType: string): ClauseComparisonResult {
  return compareClauses('', contractType, contractId, [
    { clause_number: '第3.2条', clause_text: '甲方应在合同签署后7个工作日内向乙方支付合同总金额的50%作为预付款。', clause_type: 'payment' },
    { clause_number: '第4.2条', clause_text: '乙方应在收到甲方订单后45日内完成交付。', clause_type: 'delivery' },
    { clause_number: '第5.1条', clause_text: '任何一方违反本合同约定，应向守约方支付违约金，违约金数额由双方另行协商确定。', clause_type: 'breach' },
    { clause_number: '第7.3条', clause_text: '本合同履行过程中产生的技术成果及知识产权归属，由双方另行签订补充协议约定。', clause_type: 'ip' },
    { clause_number: '第8.2条', clause_text: '乙方应对其在履行本合同过程中获知的甲方商业信息承担保密义务，保密期限为本合同终止后3年。', clause_type: 'confidentiality' },
    { clause_number: '第9.1条', clause_text: '双方因履行本合同发生的争议，应友好协商解决；协商不成的，任何一方可向有管辖权的人民法院提起诉讼。', clause_type: 'dispute' },
  ]);
}
