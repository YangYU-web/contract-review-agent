// ===== 合同版本管理模块 =====
// 提供合同历史版本的 Mock 数据、版本对比与版本快照生成能力
// 供版本管理 API 与版本对比页面共用

import {
  ContractVersion,
  VersionChange,
  VersionChangeType,
  CHANGE_TYPE_CONFIG,
} from './types';

// 一天的毫秒数
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// 生成距离今天指定天数的 ISO 时间字符串
function daysAgo(days: number): string {
  return new Date(Date.now() - days * ONE_DAY_MS).toISOString();
}

// ===== 辅助：文本相似度计算 =====

// Levenshtein 编辑距离（字符级，适用于中文）
function levenshtein(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) dp[i][j] = dp[i - 1][j - 1];
      else
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + 1
        );
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

// ===== 条款分割 =====

interface ClauseSegment {
  clause_label: string;
  clause_text: string;
}

// 将合同文本按"第X条"模式分割为条款（支持中文数字与阿拉伯数字）
function splitIntoClauses(text: string): ClauseSegment[] {
  const clauses: ClauseSegment[] = [];
  if (!text || text.trim().length === 0) return clauses;

  const articlePattern = /第[一二三四五六七八九十百千零〇0-9]+条[^\n]*/g;
  const matches = text.match(articlePattern);

  if (matches && matches.length > 0) {
    let lastIndex = 0;
    for (let i = 0; i < matches.length; i++) {
      const matchText = matches[i];
      const startIndex = text.indexOf(matchText, lastIndex);
      const endIndex =
        i < matches.length - 1
          ? text.indexOf(matches[i + 1], startIndex + matchText.length)
          : text.length;

      const fullClause = text.substring(startIndex, endIndex).trim();
      if (fullClause.length > 5) {
        const labelMatch = matchText.match(
          /第[一二三四五六七八九十百千零〇0-9]+条(?:[\.．][0-9]+)?/
        );
        clauses.push({
          clause_label: labelMatch ? labelMatch[0] : matchText.slice(0, 20),
          clause_text: fullClause,
        });
      }
      lastIndex = startIndex + matchText.length;
    }
  }

  // 若未匹配到"第X条"，则按双换行段落分割
  if (clauses.length === 0) {
    const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 20);
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
  oldClause: ClauseSegment;
  newClause: ClauseSegment;
  similarity: number;
}

// 在两个版本的条款间进行匹配（优先条款标签相同，再综合文本相似度）
function matchClauses(
  oldClauses: ClauseSegment[],
  newClauses: ClauseSegment[]
): { matched: MatchedPair[]; onlyOld: ClauseSegment[]; onlyNew: ClauseSegment[] } {
  const matched: MatchedPair[] = [];
  const usedNew = new Set<number>();

  for (const oldC of oldClauses) {
    let bestIdx = -1;
    let bestSim = 0;

    for (let j = 0; j < newClauses.length; j++) {
      if (usedNew.has(j)) continue;
      const newC = newClauses[j];
      const labelSim = oldC.clause_label === newC.clause_label ? 100 : 0;
      const textSim = calculateSimilarity(oldC.clause_text, newC.clause_text);
      const combined = Math.max(labelSim, textSim);
      if (combined > bestSim) {
        bestSim = combined;
        bestIdx = j;
      }
    }

    // 相似度超过 30% 才视为匹配成功
    if (bestIdx >= 0 && bestSim >= 30) {
      matched.push({ oldClause: oldC, newClause: newClauses[bestIdx], similarity: bestSim });
      usedNew.add(bestIdx);
    }
  }

  const onlyOld = oldClauses.filter((_, i) => {
    return !matched.some((m) => m.oldClause === oldClauses[i]);
  });
  const onlyNew = newClauses.filter((_, j) => !usedNew.has(j));

  return { matched, onlyOld, onlyNew };
}

// ===== 变更描述与风险影响评估 =====

// 提取金额（百分比 / 元 / 万元）与期限信息，用于生成描述与判断风险影响
function extractNumbers(text: string): { amounts: string[]; periods: string[] } {
  const amounts = text.match(/[\d.]+\s*[%％]|\d+\s*万元?|\d+\s*元/g) || [];
  const periods = text.match(/\d+\s*(?:日|天|个工作日|个月|月|年)/g) || [];
  return { amounts, periods };
}

// 生成变更描述
function describeChange(
  changeType: VersionChangeType,
  oldText: string | undefined,
  newText: string | undefined
): string {
  switch (changeType) {
    case 'added':
      return `新增条款：${(newText || '').slice(0, 60)}${(newText || '').length > 60 ? '...' : ''}`;
    case 'removed':
      return `删除条款：${(oldText || '').slice(0, 60)}${(oldText || '').length > 60 ? '...' : ''}`;
    case 'unchanged':
      return '条款内容未发生变化，保持原状。';
    case 'modified': {
      const oldNums = extractNumbers(oldText || '');
      const newNums = extractNumbers(newText || '');
      const parts: string[] = [];
      if (
        oldNums.amounts.join(',') !== newNums.amounts.join(',') &&
        (oldNums.amounts.length > 0 || newNums.amounts.length > 0)
      ) {
        parts.push(`金额由「${oldNums.amounts.join('/') || '无'}」调整为「${newNums.amounts.join('/') || '无'}」`);
      }
      if (
        oldNums.periods.join(',') !== newNums.periods.join(',') &&
        (oldNums.periods.length > 0 || newNums.periods.length > 0)
      ) {
        parts.push(`期限由「${oldNums.periods.join('/') || '无'}」调整为「${newNums.periods.join('/') || '无'}」`);
      }
      if (parts.length === 0) {
        parts.push('条款表述或部分措辞进行了调整');
      }
      return parts.join('；') + '。';
    }
    default:
      return '条款发生变更。';
  }
}

// 评估风险影响：none / positive / negative / neutral
function assessRiskImpact(
  changeType: VersionChangeType,
  oldText: string | undefined,
  newText: string | undefined
): VersionChange['risk_impact'] {
  if (changeType === 'unchanged') return 'none';
  if (changeType === 'added') {
    // 新增保密 / 违约 / 知识产权等保护性条款 → 正面
    if (/保密|违约金|知识产权|赔偿|争议|不可抗力/.test(newText || '')) {
      return 'positive';
    }
    return 'neutral';
  }
  if (changeType === 'removed') {
    // 删除保护性条款 → 负面
    if (/保密|违约金|知识产权|赔偿|争议|不可抗力/.test(oldText || '')) {
      return 'negative';
    }
    return 'neutral';
  }
  // modified：比较金额 / 期限变化方向
  const oldNums = extractNumbers(oldText || '');
  const newNums = extractNumbers(newText || '');

  // 预付款比例下降 → 正面（降低买方风险）
  const oldPct = oldNums.amounts.find((a) => /[%％]/.test(a));
  const newPct = newNums.amounts.find((a) => /[%％]/.test(a));
  if (oldPct && newPct) {
    const oldV = parseFloat(oldPct);
    const newV = parseFloat(newPct);
    if (!Number.isNaN(oldV) && !Number.isNaN(newV) && oldV !== newV) {
      // 涉及付款 / 违约金：比例上升对守约方有利视为正面，预付款上升视为负面
      if (/预付/.test(oldText || '')) {
        return newV < oldV ? 'positive' : 'negative';
      }
      if (/违约金|赔偿/.test(oldText || '')) {
        return newV > oldV ? 'positive' : 'negative';
      }
    }
  }

  // 交付 / 期限缩短 → 正面（对买方有利）
  const oldPeriod = oldNums.periods[0];
  const newPeriod = newNums.periods[0];
  if (oldPeriod && newPeriod) {
    const oldV = parseInt(oldPeriod, 10);
    const newV = parseInt(newPeriod, 10);
    if (!Number.isNaN(oldV) && !Number.isNaN(newV) && oldV !== newV) {
      if (/交付|验收|工期/.test(oldText || '')) {
        return newV < oldV ? 'positive' : 'negative';
      }
      if (/保密/.test(oldText || '')) {
        return newV > oldV ? 'positive' : 'negative';
      }
    }
  }

  return 'neutral';
}

// ===== Mock 版本内容 =====
// 以"采购合同"为模板，构造 v1.0 → v2.0 的条款演进
// 不同 contractId 复用同一演进内容，便于演示对比

const V1_CONTENT = `第一条 合同主体
本合同由甲方（北京智链科技有限公司）与乙方（上海科创制造有限公司）签订。

第二条 合同标的
甲方采购乙方生产的XX系列电子产品，具体型号与数量详见附件一。

第三条 付款条款
3.1 甲方应在合同签署后7个工作日内向乙方支付合同总金额的50%作为预付款。
3.2 乙方交付全部货物并经甲方验收合格后，甲方在30日内支付剩余50%尾款。

第四条 交付条款
4.1 乙方应在收到甲方订单后45日内完成交付。
4.2 交付地点为甲方指定仓库，运输费用由乙方承担。

第五条 违约责任
5.1 任何一方违反本合同约定，应向守约方支付违约金，违约金数额由双方另行协商确定。

第六条 争议解决
6.1 双方因履行本合同发生的争议，应友好协商解决；协商不成的，任何一方可向有管辖权的人民法院提起诉讼。

第七条 合同终止
7.1 本合同在双方履行完毕各自义务后终止。
7.2 任何一方严重违约的，守约方有权解除本合同。`;

// v1.1：修改付款条款（预付款 50% → 30%，尾款 50% → 70%）
const V1_1_CONTENT = `第一条 合同主体
本合同由甲方（北京智链科技有限公司）与乙方（上海科创制造有限公司）签订。

第二条 合同标的
甲方采购乙方生产的XX系列电子产品，具体型号与数量详见附件一。

第三条 付款条款
3.1 甲方应在合同签署后7个工作日内向乙方支付合同总金额的30%作为预付款。
3.2 乙方交付全部货物并经甲方验收合格后，甲方在30日内支付剩余70%尾款。

第四条 交付条款
4.1 乙方应在收到甲方订单后45日内完成交付。
4.2 交付地点为甲方指定仓库，运输费用由乙方承担。

第五条 违约责任
5.1 任何一方违反本合同约定，应向守约方支付违约金，违约金数额由双方另行协商确定。

第六条 争议解决
6.1 双方因履行本合同发生的争议，应友好协商解决；协商不成的，任何一方可向有管辖权的人民法院提起诉讼。

第七条 合同终止
7.1 本合同在双方履行完毕各自义务后终止。
7.2 任何一方严重违约的，守约方有权解除本合同。`;

// v1.2：增加保密条款（新增第八条）
const V1_2_CONTENT = `第一条 合同主体
本合同由甲方（北京智链科技有限公司）与乙方（上海科创制造有限公司）签订。

第二条 合同标的
甲方采购乙方生产的XX系列电子产品，具体型号与数量详见附件一。

第三条 付款条款
3.1 甲方应在合同签署后7个工作日内向乙方支付合同总金额的30%作为预付款。
3.2 乙方交付全部货物并经甲方验收合格后，甲方在30日内支付剩余70%尾款。

第四条 交付条款
4.1 乙方应在收到甲方订单后45日内完成交付。
4.2 交付地点为甲方指定仓库，运输费用由乙方承担。

第五条 违约责任
5.1 任何一方违反本合同约定，应向守约方支付违约金，违约金数额由双方另行协商确定。

第六条 争议解决
6.1 双方因履行本合同发生的争议，应友好协商解决；协商不成的，任何一方可向有管辖权的人民法院提起诉讼。

第七条 合同终止
7.1 本合同在双方履行完毕各自义务后终止。
7.2 任何一方严重违约的，守约方有权解除本合同。

第八条 保密义务
8.1 乙方应对其在履行本合同过程中获知的甲方商业信息承担保密义务，保密期限为本合同终止后3年。
8.2 乙方违反保密义务的，应向甲方支付违约金并赔偿甲方因此遭受的全部损失。`;

// v2.0：重大修订——付款改为分期、交付周期缩短、违约金明确为15%、保密期限延长至5年、新增知识产权条款
const V2_CONTENT = `第一条 合同主体
本合同由甲方（北京智链科技有限公司）与乙方（上海科创制造有限公司）签订。

第二条 合同标的
甲方采购乙方生产的XX系列电子产品，具体型号与数量详见附件一。

第三条 付款条款
3.1 甲方应在合同签署后7个工作日内向乙方支付合同总金额的30%作为首期付款。
3.2 乙方交付全部货物并经甲方验收合格后10个工作日内，甲方向乙方支付合同总金额的60%。
3.3 剩余10%作为质量保证金，在验收合格满12个月后无质量问题予以支付。

第四条 交付条款
4.1 乙方应在收到甲方订单后30日内完成交付。逾期交付的，每逾期一日，乙方应按合同总金额的0.5%向甲方支付违约金。
4.2 交付地点为甲方指定仓库，运输费用由乙方承担。

第五条 违约责任
5.1 任何一方违反本合同约定，应向守约方支付违约金，违约金金额为合同总金额的15%。如违约金不足以弥补守约方实际损失的，违约方应补足差额。

第六条 争议解决
6.1 双方因履行本合同发生的争议，应友好协商解决；协商不成的，任何一方可向甲方所在地有管辖权的人民法院提起诉讼。

第七条 合同终止
7.1 本合同在双方履行完毕各自义务后终止。
7.2 任何一方严重违约的，守约方有权解除本合同。

第八条 保密义务
8.1 乙方应对其在履行本合同过程中获知的甲方商业信息承担保密义务，保密期限为本合同终止后5年。
8.2 乙方违反保密义务的，应向甲方支付合同总金额20%的违约金，并赔偿甲方因此遭受的全部损失。

第九条 知识产权
9.1 本合同履行过程中由甲方提供的技术方案和已有知识产权归甲方所有。
9.2 乙方为履行本合同而新开发的技术成果知识产权归甲乙双方共同所有，未经对方书面同意，任何一方不得向第三方转让或许可使用。`;

// 版本内容与摘要映射
const VERSION_TEMPLATES: {
  content: string;
  version_label: string;
  change_summary: string;
  daysAgo: number;
}[] = [
  {
    content: V1_CONTENT,
    version_label: 'v1.0',
    change_summary: '合同初版，约定基础付款、交付、违约与争议解决条款。',
    daysAgo: 90,
  },
  {
    content: V1_1_CONTENT,
    version_label: 'v1.1',
    change_summary: '修改付款条款：预付款比例由50%下调至30%，尾款相应调整为70%，降低甲方预付风险。',
    daysAgo: 60,
  },
  {
    content: V1_2_CONTENT,
    version_label: 'v1.2',
    change_summary: '增加保密义务条款，约定保密期限3年及违约赔偿，完善合同保护机制。',
    daysAgo: 30,
  },
  {
    content: V2_CONTENT,
    version_label: 'v2.0',
    change_summary: '重大修订：付款改为三期分期并设质量保证金、交付周期缩短至30日、违约金明确为15%、保密期限延长至5年、新增知识产权条款。',
    daysAgo: 3,
  },
];

// ===== Mock 版本数据 =====
// 返回某合同的 3-4 个历史版本（v1.0 初版、v1.1 修改付款、v1.2 增加保密、v2.0 重大修订）
export function getMockVersions(contractId: string): ContractVersion[] {
  return VERSION_TEMPLATES.map((tpl, idx) => {
    // 为相邻版本预计算变更（用于 change_summary 展示）
    const prevContent = idx > 0 ? VERSION_TEMPLATES[idx - 1].content : undefined;
    const changes: VersionChange[] =
      idx === 0
        ? []
        : compareVersions(
            {
              id: `${contractId}-prev`,
              contract_id: contractId,
              version_number: idx,
              version_label: VERSION_TEMPLATES[idx - 1].version_label,
              content: prevContent!,
              change_summary: VERSION_TEMPLATES[idx - 1].change_summary,
              changes: [],
              created_by: 'system',
              created_at: daysAgo(VERSION_TEMPLATES[idx - 1].daysAgo),
            },
            {
              id: `${contractId}-curr`,
              contract_id: contractId,
              version_number: idx + 1,
              version_label: tpl.version_label,
              content: tpl.content,
              change_summary: tpl.change_summary,
              changes: [],
              created_by: 'system',
              created_at: daysAgo(tpl.daysAgo),
            }
          );

    return {
      id: `${contractId}-ver-${idx + 1}`,
      contract_id: contractId,
      version_number: idx + 1,
      version_label: tpl.version_label,
      content: tpl.content,
      change_summary: tpl.change_summary,
      changes,
      created_by: '法务部-张明',
      created_at: daysAgo(tpl.daysAgo),
    } as ContractVersion;
  });
}

// ===== 版本对比 =====
// 比较两个版本差异：按"第X条"分割条款 → 匹配 → 识别 added/removed/modified/unchanged
export function compareVersions(
  v1: ContractVersion,
  v2: ContractVersion
): VersionChange[] {
  const oldClauses = splitIntoClauses(v1.content);
  const newClauses = splitIntoClauses(v2.content);

  const { matched, onlyOld, onlyNew } = matchClauses(oldClauses, newClauses);
  const changes: VersionChange[] = [];

  // 匹配的条款：根据相似度判定 modified / unchanged
  for (const pair of matched) {
    const similarity = calculateSimilarity(
      pair.oldClause.clause_text,
      pair.newClause.clause_text
    );
    const changeType: VersionChangeType =
      similarity >= 95 ? 'unchanged' : 'modified';

    changes.push({
      clause_id: pair.newClause.clause_label,
      change_type: changeType,
      old_text: pair.oldClause.clause_text,
      new_text: pair.newClause.clause_text,
      description: describeChange(
        changeType,
        pair.oldClause.clause_text,
        pair.newClause.clause_text
      ),
      risk_impact: assessRiskImpact(
        changeType,
        pair.oldClause.clause_text,
        pair.newClause.clause_text
      ),
    });
  }

  // 仅旧版本存在 → removed
  for (const oldC of onlyOld) {
    changes.push({
      clause_id: oldC.clause_label,
      change_type: 'removed',
      old_text: oldC.clause_text,
      new_text: undefined,
      description: describeChange('removed', oldC.clause_text, undefined),
      risk_impact: assessRiskImpact('removed', oldC.clause_text, undefined),
    });
  }

  // 仅新版本存在 → added
  for (const newC of onlyNew) {
    changes.push({
      clause_id: newC.clause_label,
      change_type: 'added',
      old_text: undefined,
      new_text: newC.clause_text,
      description: describeChange('added', undefined, newC.clause_text),
      risk_impact: assessRiskImpact('added', undefined, newC.clause_text),
    });
  }

  // 排序：modified > added > removed > unchanged，保持条款顺序
  const order: Record<VersionChangeType, number> = {
    modified: 0,
    added: 1,
    removed: 2,
    unchanged: 3,
  };
  return changes.sort((a, b) => order[a.change_type] - order[b.change_type]);
}

// ===== 获取最新版本 =====
// 返回某合同版本号最大的历史版本
export function getLatestVersion(
  contractId: string
): ContractVersion | undefined {
  const versions = getMockVersions(contractId);
  if (versions.length === 0) return undefined;
  return versions.reduce((latest, v) =>
    v.version_number > latest.version_number ? v : latest
  );
}

// ===== 创建版本快照 =====
// 基于内容、标签与变更生成一个新的版本快照（用于演示模式新增版本）
export function createVersionSnapshot(
  content: string,
  contractId: string,
  label: string,
  changes: VersionChange[]
): ContractVersion {
  const existing = getMockVersions(contractId);
  const nextNumber =
    existing.length > 0
      ? Math.max(...existing.map((v) => v.version_number)) + 1
      : 1;

  const changeCount = changes.length;
  const modifiedCount = changes.filter((c) => c.change_type === 'modified').length;
  const addedCount = changes.filter((c) => c.change_type === 'added').length;
  const removedCount = changes.filter((c) => c.change_type === 'removed').length;

  const summary =
    changeCount === 0
      ? `新建版本 ${label}，暂无变更记录。`
      : `新建版本 ${label}，共 ${changeCount} 处变更（修改 ${modifiedCount}、新增 ${addedCount}、删除 ${removedCount}）。`;

  return {
    id: `${contractId}-ver-${nextNumber}-${Date.now()}`,
    contract_id: contractId,
    version_number: nextNumber,
    version_label: label,
    content,
    change_summary: summary,
    changes,
    created_by: '法务部-张明',
    created_at: new Date().toISOString(),
  };
}

// 重新导出配置，方便页面统一引用
export { CHANGE_TYPE_CONFIG };
