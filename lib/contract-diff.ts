// ===== 合同对比分析模块 =====
// 将两份合同按条款分割，逐条比对，识别差异与风险影响

import { ContractComparisonItem, ContractComparisonResult } from './types';

// ===== 辅助函数 =====

// Levenshtein编辑距离（字符级，适用于中文）
function levenshtein(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;
  if (m === 0) return n;
  if (n === 0) return m;
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

// 文本相似度计算（基于编辑距离，0-100）
function calculateSimilarity(text1: string, text2: string): number {
  if (!text1 && !text2) return 100;
  if (!text1 || !text2) return 0;
  const s1 = text1.replace(/\s+/g, ' ').trim();
  const s2 = text2.replace(/\s+/g, ' ').trim();
  if (s1 === s2) return 100;
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  const distance = levenshtein(shorter, longer);
  return Math.round((1 - distance / longer.length) * 100);
}

// 词重叠率（Jaccard相似度，基于关键词集合）
function wordOverlapRate(text1: string, text2: string): number {
  const kw1 = Array.from(new Set(extractKeywords(text1)));
  const kw2 = Array.from(new Set(extractKeywords(text2)));
  if (kw1.length === 0 && kw2.length === 0) return 50;
  const intersection = kw1.filter(k => kw2.includes(k));
  const union = Array.from(new Set(kw1.concat(kw2)));
  return Math.round((intersection.length / union.length) * 100);
}

// 关键词提取（用于条款匹配和差异识别）
function extractKeywords(text: string): string[] {
  const keywords: string[] = [];
  const patterns = [
    { regex: /付款|支付|预付|货款|价款|结算|金额/g, label: '付款' },
    { regex: /交付|验收|发货|交货|运输/g, label: '交付' },
    { regex: /违约|违约金|赔偿|损失/g, label: '违约' },
    { regex: /知识产权|专利|商标|著作权|成果归属/g, label: '知识产权' },
    { regex: /保密|机密|商业秘密/g, label: '保密' },
    { regex: /争议|仲裁|诉讼|管辖/g, label: '争议' },
    { regex: /不可抗力/g, label: '不可抗力' },
    { regex: /终止|解除|期满|续签/g, label: '终止' },
    { regex: /数据|隐私|个人信息/g, label: '数据保护' },
    { regex: /竞业/g, label: '竞业' },
    { regex: /适用法律|管辖法律/g, label: '管辖法律' },
    { regex: /甲方/g, label: '甲方' },
    { regex: /乙方/g, label: '乙方' },
  ];
  for (const { regex, label } of patterns) {
    regex.lastIndex = 0;
    if (regex.test(text)) keywords.push(label);
  }
  return keywords;
}

// ===== 条款分割 =====

interface ClauseSegment {
  clause_label: string;
  clause_text: string;
}

// 将合同文本按"第X条"模式分割为条款
function splitContractIntoClauses(text: string): ClauseSegment[] {
  const clauses: ClauseSegment[] = [];
  if (!text || text.trim().length === 0) return clauses;

  // 匹配"第X条"开头模式（支持中文数字和阿拉伯数字）
  const articlePattern = /第[一二三四五六七八九十百千零〇0-9]+条[^\n]*/g;
  const matches = text.match(articlePattern);

  if (matches && matches.length > 0) {
    let lastIndex = 0;
    for (let i = 0; i < matches.length; i++) {
      const matchText = matches[i];
      const startIndex = text.indexOf(matchText, lastIndex);
      const endIndex = i < matches.length - 1
        ? text.indexOf(matches[i + 1], startIndex + matchText.length)
        : text.length;

      const fullClause = text.substring(startIndex, endIndex).trim();
      if (fullClause.length > 5) {
        // 提取条款标签（如"第3.2条"）
        const labelMatch = matchText.match(/第[一二三四五六七八九十百千零〇0-9]+条(?:[\.．][0-9]+)?/);
        clauses.push({
          clause_label: labelMatch ? labelMatch[0] : matchText.replace(/\s+/g, ' ').slice(0, 20),
          clause_text: fullClause,
        });
      }
      lastIndex = startIndex + matchText.length;
    }
  }

  // 若未匹配到"第X条"，则按双换行段落分割
  if (clauses.length === 0) {
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 20);
    paragraphs.forEach((para, idx) => {
      clauses.push({
        clause_label: `段落${idx + 1}`,
        clause_text: para.trim(),
      });
    });
  }

  return clauses;
}

// ===== 条款匹配 =====

interface MatchedPair {
  a: ClauseSegment;
  b: ClauseSegment;
  similarity: number;
}

// 在两份合同的条款间进行匹配
function matchClauses(
  clausesA: ClauseSegment[],
  clausesB: ClauseSegment[]
): { matched: MatchedPair[]; onlyA: ClauseSegment[]; onlyB: ClauseSegment[] } {
  const matched: MatchedPair[] = [];
  const usedB = new Set<number>();

  for (const a of clausesA) {
    let bestIdx = -1;
    let bestSim = 0;

    for (let j = 0; j < clausesB.length; j++) {
      if (usedB.has(j)) continue;
      const b = clausesB[j];

      // 优先：条款标签相同则直接匹配
      const labelSim = a.clause_label === b.clause_label ? 100 : 0;

      // 文本相似度 + 词重叠率综合
      const textSim = calculateSimilarity(a.clause_text, b.clause_text);
      const overlap = wordOverlapRate(a.clause_text, b.clause_text);
      const combined = Math.max(labelSim, Math.round(textSim * 0.6 + overlap * 0.4));

      if (combined > bestSim) {
        bestSim = combined;
        bestIdx = j;
      }
    }

    // 相似度超过30%才视为匹配成功
    if (bestIdx >= 0 && bestSim >= 30) {
      matched.push({ a, b: clausesB[bestIdx], similarity: bestSim });
      usedB.add(bestIdx);
    }
  }

  const onlyA = clausesA.filter((_, i) => {
    // A中未匹配上的条款
    return !matched.some(m => m.a === clausesA[i]);
  });
  const onlyB = clausesB.filter((_, j) => !usedB.has(j));

  return { matched, onlyA, onlyB };
}

// ===== 差异分析 =====

// 提取两段文本间的关键差异点
function extractKeyDifferences(textA: string, textB: string): string[] {
  const differences: string[] = [];

  // 金额差异
  const amountsA: string[] = textA.match(/[\d.]+[%％]?万?元?/g) || [];
  const amountsB: string[] = textB.match(/[\d.]+[%％]?万?元?/g) || [];
  if (amountsA.length > 0 || amountsB.length > 0) {
    const setA = new Set(amountsA);
    const setB = new Set(amountsB);
    const aOnly = amountsA.filter(a => !setB.has(a));
    const bOnly = amountsB.filter(b => !setA.has(b));
    if (aOnly.length > 0 || bOnly.length > 0) {
      differences.push(`金额差异：合同A为「${amountsA.join('/')}」，合同B为「${amountsB.join('/')}」`);
    }
  }

  // 期限差异
  const daysA: string[] = textA.match(/\d+\s*(日|天|个月|月|年|工作日)/g) || [];
  const daysB: string[] = textB.match(/\d+\s*(日|天|个月|月|年|工作日)/g) || [];
  if (daysA.length > 0 || daysB.length > 0) {
    const setA = new Set(daysA);
    const setB = new Set(daysB);
    if (daysA.some(d => !setB.has(d)) || daysB.some(d => !setA.has(d))) {
      differences.push(`期限差异：合同A为「${daysA.join('/')}」，合同B为「${daysB.join('/')}」`);
    }
  }

  // 责任主体差异
  const aParty = /甲方.*承担/.test(textA) ? '甲方' : (/乙方.*承担/.test(textA) ? '乙方' : '');
  const bParty = /甲方.*承担/.test(textB) ? '甲方' : (/乙方.*承担/.test(textB) ? '乙方' : '');
  if (aParty && bParty && aParty !== bParty) {
    differences.push(`责任主体差异：合同A由${aParty}承担，合同B由${bParty}承担`);
  }

  // 长度差异
  const lenDiff = Math.abs(textA.length - textB.length);
  const baseLen = Math.max(textA.length, textB.length);
  if (baseLen > 0 && lenDiff > baseLen * 0.3) {
    differences.push(`条款详尽度差异：长度相差约${Math.round((lenDiff / baseLen) * 100)}%`);
  }

  // 关键词差异
  const kwA = extractKeywords(textA);
  const kwB = extractKeywords(textB);
  const kwAOnly = kwA.filter(k => !kwB.includes(k));
  const kwBOnly = kwB.filter(k => !kwA.includes(k));
  if (kwAOnly.length > 0) {
    differences.push(`合同A独有关键内容：${kwAOnly.join('、')}`);
  }
  if (kwBOnly.length > 0) {
    differences.push(`合同B独有关键内容：${kwBOnly.join('、')}`);
  }

  if (differences.length === 0) {
    differences.push('两条款表述方式存在措辞差异，但实质性内容基本一致');
  }

  return differences;
}

// 分析差异对风险的影响
function analyzeRiskImplication(
  diffType: ContractComparisonItem['diff_type'],
  similarity: number,
  keyDiffs: string[]
): string {
  switch (diffType) {
    case 'same':
      return '两份合同该条款一致，无风险差异。';
    case 'modified':
      if (similarity < 50) {
        return '条款存在重大差异，可能导致双方权利义务显著不同，需重点关注金额、期限、责任主体等核心要素的变化，建议核实是否符合预期。';
      } else if (similarity < 80) {
        return '条款存在中度差异，关键参数（如金额比例、期限长短）有调整，需评估对己方权益的具体影响。';
      } else {
        return '条款仅有措辞或细微差异，对实质权利义务影响较小，风险可控。';
      }
    case 'only_a':
      return '该条款仅在合同A中存在，合同B缺失。可能导致合同B在此方面约定不明，产生法律不确定性，建议核实是否需要补充。';
    case 'only_b':
      return '该条款仅在合同B中存在，合同A缺失。可能导致合同A在此方面约定不明，产生法律不确定性，建议核实是否需要补充。';
    default:
      return '无法判断风险影响。';
  }
}

// ===== 主函数 =====

// 对比两份合同
export function compareContracts(
  textA: string,
  textB: string,
  titleA: string,
  titleB: string,
  typeA: string,
  typeB: string
): ContractComparisonResult {
  // 分割条款
  const clausesA = splitContractIntoClauses(textA);
  const clausesB = splitContractIntoClauses(textB);

  // 匹配条款
  const { matched, onlyA, onlyB } = matchClauses(clausesA, clausesB);

  const items: ContractComparisonItem[] = [];

  // 匹配的条款
  for (const pair of matched) {
    const textSim = calculateSimilarity(pair.a.clause_text, pair.b.clause_text);
    const overlap = wordOverlapRate(pair.a.clause_text, pair.b.clause_text);
    const finalSim = Math.round(textSim * 0.6 + overlap * 0.4);

    let diffType: ContractComparisonItem['diff_type'];
    if (finalSim > 90) {
      diffType = 'same';
    } else if (finalSim >= 30) {
      diffType = 'modified';
    } else {
      // 相似度过低，视为不同条款
      diffType = 'modified';
    }

    const keyDiffs = diffType === 'same'
      ? ['两份合同该条款内容基本一致']
      : extractKeyDifferences(pair.a.clause_text, pair.b.clause_text);

    items.push({
      clause_label: pair.a.clause_label,
      contract_a_text: pair.a.clause_text,
      contract_b_text: pair.b.clause_text,
      diff_type: diffType,
      similarity: finalSim,
      key_differences: keyDiffs,
      risk_implication: analyzeRiskImplication(diffType, finalSim, keyDiffs),
    });
  }

  // 仅A有的条款
  for (const a of onlyA) {
    items.push({
      clause_label: a.clause_label,
      contract_a_text: a.clause_text,
      contract_b_text: '（合同B中无此条款）',
      diff_type: 'only_a',
      similarity: 0,
      key_differences: ['该条款仅存在于合同A，合同B中缺失对应约定'],
      risk_implication: analyzeRiskImplication('only_a', 0, []),
    });
  }

  // 仅B有的条款
  for (const b of onlyB) {
    items.push({
      clause_label: b.clause_label,
      contract_a_text: '（合同A中无此条款）',
      contract_b_text: b.clause_text,
      diff_type: 'only_b',
      similarity: 0,
      key_differences: ['该条款仅存在于合同B，合同A中缺失对应约定'],
      risk_implication: analyzeRiskImplication('only_b', 0, []),
    });
  }

  // 计算整体相似度
  const matchedItems = items.filter(i => i.diff_type === 'same' || i.diff_type === 'modified');
  const overallSim = matchedItems.length > 0
    ? Math.round(matchedItems.reduce((sum, i) => sum + i.similarity, 0) / matchedItems.length)
    : 0;

  // 统计
  const sameCount = items.filter(i => i.diff_type === 'same').length;
  const modifiedCount = items.filter(i => i.diff_type === 'modified').length;
  const onlyACount = items.filter(i => i.diff_type === 'only_a').length;
  const onlyBCount = items.filter(i => i.diff_type === 'only_b').length;

  // 提取各自独有风险
  const uniqueRisksA = onlyA.map(a => `${a.clause_label}：${a.clause_text.slice(0, 50)}...`);
  const uniqueRisksB = onlyB.map(b => `${b.clause_label}：${b.clause_text.slice(0, 50)}...`);

  const summary = `本次对比了「${titleA}」与「${titleB}」两份合同，共分析${items.length}项条款。整体相似度${overallSim}%，其中${sameCount}项一致、${modifiedCount}项有差异、合同A独有${onlyACount}项、合同B独有${onlyBCount}项。${modifiedCount > 0 ? '存在差异条款，建议重点关注金额、期限、责任主体等核心要素的变化。' : '两份合同条款一致性良好。'}`;

  return {
    contract_a: { id: 'a', title: titleA, type: typeA },
    contract_b: { id: 'b', title: titleB, type: typeB },
    summary,
    overall_similarity: overallSim,
    items,
    unique_risks_a: uniqueRisksA,
    unique_risks_b: uniqueRisksB,
  };
}

// ===== 模拟对比数据 =====

// 返回模拟的合同对比结果（用于演示）
export function getMockComparisonResult(): ContractComparisonResult {
  return {
    contract_a: { id: 'mock-a', title: 'XX产品采购合同（原版）', type: '采购合同' },
    contract_b: { id: 'mock-b', title: 'XX产品采购合同（修订版）', type: '采购合同' },
    summary: '本次对比了「XX产品采购合同（原版）」与「XX产品采购合同（修订版）」两份合同，共分析5项条款。整体相似度72%，其中1项一致、3项有差异、合同A独有1项。存在差异条款，建议重点关注金额、期限、责任主体等核心要素的变化。',
    overall_similarity: 72,
    items: [
      {
        clause_label: '第3.2条',
        contract_a_text: '甲方应在合同签署后7个工作日内向乙方支付合同总金额的50%作为预付款。',
        contract_b_text: '甲方应在收到乙方交付的全部货物并验收合格后10个工作日内，向乙方支付合同总金额的30%作为首期付款；剩余70%在验收合格后30日内付清。',
        diff_type: 'modified',
        similarity: 45,
        key_differences: [
          '金额差异：合同A为「50%/30%」，合同B为「30%/70%」',
          '期限差异：合同A为「7日/工作日」，合同B为「10日/30日/工作日」',
          '责任主体差异：合同A由甲方承担，合同B由乙方承担',
        ],
        risk_implication: '条款存在重大差异，可能导致双方权利义务显著不同，需重点关注金额、期限、责任主体等核心要素的变化，建议核实是否符合预期。',
      },
      {
        clause_label: '第4.2条',
        contract_a_text: '乙方应在收到甲方订单后45日内完成交付。',
        contract_b_text: '乙方应在收到甲方订单后30日内完成交付。逾期交付的，每逾期一日，乙方应按合同总金额的0.5%向甲方支付违约金。',
        diff_type: 'modified',
        similarity: 58,
        key_differences: [
          '期限差异：合同A为「45日」，合同B为「30日」',
          '合同B独有关键内容：违约',
        ],
        risk_implication: '条款存在中度差异，关键参数（如金额比例、期限长短）有调整，需评估对己方权益的具体影响。',
      },
      {
        clause_label: '第5.1条',
        contract_a_text: '任何一方违反本合同约定，应向守约方支付违约金，违约金数额由双方另行协商确定。',
        contract_b_text: '任何一方违反本合同约定，应向守约方支付违约金，违约金金额为合同总金额的15%。如违约金不足以弥补守约方实际损失的，违约方应补足差额。',
        diff_type: 'modified',
        similarity: 52,
        key_differences: [
          '金额差异：合同A为「/」，合同B为「15%」',
          '合同B独有关键内容：违约',
        ],
        risk_implication: '条款存在重大差异，可能导致双方权利义务显著不同，需重点关注金额、期限、责任主体等核心要素的变化，建议核实是否符合预期。',
      },
      {
        clause_label: '第8.2条',
        contract_a_text: '乙方应对其在履行本合同过程中获知的甲方商业信息承担保密义务，保密期限为本合同终止后3年。',
        contract_b_text: '乙方应对其在履行本合同过程中获知的甲方商业信息承担保密义务，保密期限为本合同终止后5年。乙方违反保密义务的，应向甲方支付合同总金额20%的违约金。',
        diff_type: 'modified',
        similarity: 68,
        key_differences: [
          '期限差异：合同A为「3年」，合同B为「5年」',
          '金额差异：合同B为「20%」',
          '合同B独有关键内容：违约',
        ],
        risk_implication: '条款存在中度差异，关键参数（如金额比例、期限长短）有调整，需评估对己方权益的具体影响。',
      },
      {
        clause_label: '第9.1条',
        contract_a_text: '双方因履行本合同发生的争议，应友好协商解决；协商不成的，任何一方可向有管辖权的人民法院提起诉讼。',
        contract_b_text: '双方因履行本合同发生的争议，应友好协商解决；协商不成的，任何一方可向有管辖权的人民法院提起诉讼。',
        diff_type: 'same',
        similarity: 100,
        key_differences: ['两份合同该条款内容基本一致'],
        risk_implication: '两份合同该条款一致，无风险差异。',
      },
      {
        clause_label: '第10.1条',
        contract_a_text: '本合同履行过程中由甲方提供的技术方案和已有知识产权归甲方所有；乙方新开发的技术成果知识产权归甲乙双方共同所有。',
        contract_b_text: '（合同B中无此条款）',
        diff_type: 'only_a',
        similarity: 0,
        key_differences: ['该条款仅存在于合同A，合同B中缺失对应约定'],
        risk_implication: '该条款仅在合同A中存在，合同B缺失。可能导致合同B在此方面约定不明，产生法律不确定性，建议核实是否需要补充。',
      },
    ],
    unique_risks_a: ['第10.1条：本合同履行过程中由甲方提供的技术方案和已有知识产权归甲方所有...'],
    unique_risks_b: [],
  };
}
