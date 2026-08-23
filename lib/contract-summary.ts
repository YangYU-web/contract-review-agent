// ===== 智能合同摘要模块 =====
// 提供合同主体、财务条款、关键日期、关键术语的自动提取，以及整体摘要与风险评估
// 供摘要 API 与摘要页面共用

import {
  ContractSummary,
  KeyTerm,
  FinancialTerm,
  ContractTimelineEvent,
  ContractParty,
  KeyDate,
} from './types';

// ===== 常量定义 =====

// 合同主体角色与对应称谓（按优先级排序，先匹配者为准）
const PARTY_ROLE_LABELS: {
  role: ContractParty['role'];
  labels: string[];
}[] = [
  {
    role: 'party_a',
    labels: ['甲方', '出卖人', '供方', '发包人', '委托人', '出租人', '许可方', '转让方', '定作方', '买方'],
  },
  {
    role: 'party_b',
    labels: ['乙方', '买受人', '需方', '承包人', '受托人', '承租人', '被许可方', '受让方', '承揽方', '卖方'],
  },
  { role: 'guarantor', labels: ['保证人', '担保人', '保证方', '担保方'] },
  { role: 'witness', labels: ['见证人', '见证方', '居间方', '中介方'] },
];

// 财务条款类型与对应关键词
const FINANCIAL_KEYWORDS: {
  type: FinancialTerm['type'];
  keywords: string[];
}[] = [
  { type: 'total_amount', keywords: ['合同总金额', '总金额', '合同金额', '合同价款', '总价款', '总造价', '金额合计', '金额为', '总价格', '价款'] },
  { type: 'unit_price', keywords: ['单价', '每件', '每吨', '每平方米', '每公里', '每套', '月租金', '日租金'] },
  { type: 'penalty', keywords: ['违约金', '罚金', '罚款', '滞纳金', '惩罚'] },
  { type: 'deposit', keywords: ['定金', '押金', '保证金', '预付款', '订金', '履约保证金'] },
];

// 关键术语分类与对应关键词
const KEY_TERM_CATEGORIES: { category: string; keywords: string[] }[] = [
  { category: '付款方式', keywords: ['付款方式', '支付方式', '结算方式', '付款安排', '付款'] },
  { category: '交付方式', keywords: ['交付方式', '交货', '交付', '运输方式', '运输'] },
  { category: '违约责任', keywords: ['违约责任', '违约金', '违约', '赔偿'] },
  { category: '保密义务', keywords: ['保密', '保密义务', '商业秘密', '保密期限'] },
  { category: '知识产权', keywords: ['知识产权', '著作权', '专利', '商标', '权属', '归属'] },
  { category: '争议解决', keywords: ['争议解决', '争议', '仲裁', '诉讼', '管辖'] },
  { category: '不可抗力', keywords: ['不可抗力'] },
  { category: '合同期限', keywords: ['合同期限', '合同期限为', '有效期', '期限'] },
  { category: '验收标准', keywords: ['验收', '验收标准', '验收方式'] },
  { category: '质量保证', keywords: ['质量保证', '质保', '质量标准', '保修'] },
  { category: '合同终止', keywords: ['终止', '解除', '合同终止', '解除合同'] },
];

// 关键日期标签与对应关键词及重要性
const KEY_DATE_LABELS: {
  label: string;
  keywords: string[];
  significance: KeyDate['significance'];
}[] = [
  { label: '签订日期', keywords: ['签订', '签署', '订立', '签订地'], significance: 'normal' },
  { label: '生效日期', keywords: ['生效', '合同生效', '生效之日'], significance: 'critical' },
  { label: '到期日期', keywords: ['到期', '届满', '终止日', '届满之日', '合同期限'], significance: 'critical' },
  { label: '交付日期', keywords: ['交付', '交货', '交付时间'], significance: 'important' },
  { label: '付款日期', keywords: ['付款', '支付', '付款期限', '付款时间'], significance: 'important' },
  { label: '验收日期', keywords: ['验收', '验收期', '验收时间'], significance: 'important' },
  { label: '签署日期', keywords: ['签署日', '签订日'], significance: 'normal' },
];

// ===== 辅助函数 =====

// 根据字符位置查找所属"第X条"条款引用
function findClauseRef(text: string, index: number): string | undefined {
  // 向前查找最近的"第X条"标记
  const before = text.slice(0, index);
  const clauseRegex = /第[一二三四五六七八九十百千零\d]+条/g;
  let lastMatch: RegExpExecArray | null = null;
  let m: RegExpExecArray | null;
  while ((m = clauseRegex.exec(before)) !== null) {
    lastMatch = m;
  }
  return lastMatch ? lastMatch[0] : undefined;
}

// 提取紧跟关键词之后的名称（公司名/人名），遇分隔符截断
function extractNameAfter(text: string, startIdx: number): string {
  // 从关键词之后开始，跳过分隔符与空白
  let i = startIdx;
  const len = text.length;
  // 跳过冒号、括号、空白等
  while (i < len && /[\s:：（(\[【、，,]/.test(text[i])) i++;
  // 截取直到下一个分隔符或换行
  let end = i;
  while (
    end < len &&
    !/[\n。；;，,）)\]】、]/.test(text[end]) &&
    !(text[end] === '，' || text[end] === ' ')
  ) {
    end++;
  }
  // 回退掉结尾可能的空白
  let raw = text.slice(i, end).trim();
  // 去除可能附带的"以下简称"等后缀
  raw = raw.replace(/(以下简称|简称|以下称|以下简称为).*$/, '').trim();
  return raw;
}

// 在指定文本窗口内提取法定代表人/地址/联系方式
function extractPartyDetails(windowText: string): {
  legal_rep?: string;
  address?: string;
  contact?: string;
} {
  const result: { legal_rep?: string; address?: string; contact?: string } = {};

  // 法定代表人 / 授权代表
  const repMatch =
    windowText.match(/法定(?:代表人|代表)[:：]?\s*([^\s,，。；;（(\n）]+)/) ||
    windowText.match(/授权代表[:：]?\s*([^\s,，。；;（(\n）]+)/) ||
    windowText.match(/代表人[:：]?\s*([^\s,，。；;（(\n）]+)/);
  if (repMatch) result.legal_rep = repMatch[1].trim();

  // 地址 / 住所 / 注册地（长称谓优先，避免"注册地"截断"注册地址"）
  const addrMatch = windowText.match(
    /(?:注册地址|注册地|办公地址|办公地|地址|住址|住所|所在地|通讯地址)[:：]?\s*([^\n，,。；;）)（）:：]+)/
  );
  if (addrMatch) result.address = addrMatch[1].trim();

  // 联系方式 / 电话 / 邮箱
  const contactMatch =
    windowText.match(/(?:联系电话|电话|联系方式|手机|邮箱|Email|E-mail|email)[:：]?\s*([^\s，,。；;（(\n）]+)/) ||
    windowText.match(/1[3-9]\d{9}/);
  if (contactMatch) result.contact = contactMatch[1] || contactMatch[0];

  return result;
}

// 解析金额数值与币种（处理 万/亿 单位换算）
function parseAmount(numStr: string, unit: string): { amount: number; currency: string } {
  let amount = parseFloat(numStr.replace(/,/g, ''));
  if (Number.isNaN(amount)) amount = 0;

  let currency = 'CNY';
  if (/美元|USD/i.test(unit)) currency = 'USD';
  else if (/欧元|EUR/i.test(unit)) currency = 'EUR';
  else if (/港币|HKD/i.test(unit)) currency = 'HKD';
  else if (/日元|JPY/i.test(unit)) currency = 'JPY';

  // 单位换算
  if (/亿/.test(unit)) amount *= 100000000;
  else if (/万/.test(unit)) amount *= 10000;

  return { amount, currency };
}

// 币种代码转中文名称
function currencyLabel(currency: string): string {
  const map: Record<string, string> = {
    CNY: '人民币',
    USD: '美元',
    EUR: '欧元',
    HKD: '港币',
    JPY: '日元',
  };
  return map[currency] || currency;
}

// 格式化金额为千分位字符串
function formatAmount(amount: number): string {
  return amount.toLocaleString('zh-CN', { maximumFractionDigits: 2 });
}

// 截取条款片段（去空白，限制长度）
function clipSnippet(text: string, startIdx: number, maxLen = 80): string {
  const snippet = text.slice(startIdx, startIdx + maxLen).trim();
  // 在句号/分号处截断
  const cut = snippet.search(/[。；;\n]/);
  return cut > 0 ? snippet.slice(0, cut).trim() : snippet;
}

// ===== 合同主体提取 =====

// 提取合同主体（甲方、乙方、保证人、见证人等）
// 对每个角色按称谓正则匹配，取首个命中者并附带法定代表人/地址/联系方式
export function extractParties(text: string): ContractParty[] {
  const parties: ContractParty[] = [];
  const seen = new Set<string>();

  for (const { role, labels } of PARTY_ROLE_LABELS) {
    for (const label of labels) {
      // 匹配 "甲方："、"甲方(、"甲方、"甲方、"出卖人：" 等
      const labelRegex = new RegExp(`${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*[:：（(]?\\s*`);
      const match = labelRegex.exec(text);
      if (!match) continue;

      const name = extractNameAfter(text, match.index + match[0].length);
      if (!name || name.length < 2) continue;

      // 去重：同一角色 + 名称只保留一条
      const key = `${role}:${name}`;
      if (seen.has(key)) continue;
      seen.add(key);

      // 取命中位置后的窗口用于提取详细信息
      const windowStart = match.index;
      const windowText = text.slice(windowStart, windowStart + 240);
      const details = extractPartyDetails(windowText);

      parties.push({
        role,
        name,
        legal_rep: details.legal_rep,
        address: details.address,
        contact: details.contact,
      });
      break; // 每个角色只取首个命中
    }
  }

  return parties;
}

// ===== 财务条款提取 =====

// 提取财务条款（总金额、单价、违约金、定金等）
// 通过金额正则匹配 ￥/元/万/亿/美元 等，并结合上下文关键词判定类型
export function extractFinancials(text: string): FinancialTerm[] {
  const terms: FinancialTerm[] = [];
  const seen = new Set<string>();

  // 金额匹配正则：覆盖 ￥金额、金额元、金额万元、金额亿元、金额美元 等形式
  const amountRegex =
    /￥\s*([\d,]+(?:\.\d+)?)\s*(亿元|万元|万|亿|元|美元|欧元|港币|日元)?|([\d,]+(?:\.\d+)?)\s*(亿元|万元|万|亿|元|美元|欧元|港币|日元)/g;

  let m: RegExpExecArray | null;
  while ((m = amountRegex.exec(text)) !== null) {
    const numStr = m[1] || m[3] || '';
    const unit = m[2] || m[4] || '';
    if (!numStr) continue;

    const { amount, currency } = parseAmount(numStr, unit);
    if (amount <= 0) continue;

    // 取匹配位置前 40 字符上下文，用于判定类型
    const ctxStart = Math.max(0, m.index - 40);
    const context = text.slice(ctxStart, m.index + m[0].length + 10);

    // 判定类型
    let type: FinancialTerm['type'] = 'other';
    for (const { type: t, keywords } of FINANCIAL_KEYWORDS) {
      if (keywords.some((kw) => context.includes(kw))) {
        type = t;
        break;
      }
    }

    // 生成描述
    const clauseRef = findClauseRef(text, m.index);
    const description = `${type === 'total_amount' ? '合同金额' : type === 'unit_price' ? '单价' : type === 'penalty' ? '违约金' : type === 'deposit' ? '保证金/预付款' : '其他金额'}：${currencyLabel(currency)}${formatAmount(amount)}${unit && /%|%/.test(unit) ? '%' : ''}`;

    // 去重
    const key = `${type}:${amount}:${currency}`;
    if (seen.has(key)) continue;
    seen.add(key);

    terms.push({ type, description, amount, currency, clause_ref: clauseRef });
  }

  // 同类型保留前 5 条，避免冗余
  const limited: FinancialTerm[] = [];
  const typeCount: Record<string, number> = {};
  for (const t of terms) {
    const c = (typeCount[t.type] = (typeCount[t.type] || 0) + 1);
    if (c <= 5) limited.push(t);
  }
  return limited;
}

// ===== 关键日期提取 =====

// 提取关键日期（签订、生效、到期、交付、付款、验收等）
// 通过日期正则匹配，并结合上下文关键词判定日期语义与重要性
export function extractKeyDates(text: string): KeyDate[] {
  const dates: KeyDate[] = [];
  const seen = new Set<string>();

  // 日期匹配正则：支持 2024年1月1日、2024-1-1、2024/1/1、2024.1.1
  const dateRegex =
    /(\d{4})\s*[-/年.]\s*(\d{1,2})\s*[-/月.]\s*(\d{1,2})\s*日?/g;

  let m: RegExpExecArray | null;
  while ((m = dateRegex.exec(text)) !== null) {
    const year = m[1];
    const month = m[2].padStart(2, '0');
    const day = m[3].padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    if (seen.has(dateStr)) {
      // 同一日期可对应不同语义，但仍保留首次以简化
    }
    const key = dateStr;

    // 基于关键词与日期的距离判定语义：取距离最近的关键词所属标签
    // 避免相邻日期的语义关键词互相干扰（如"生效"误标到"届满"日期）
    const dateStart = m.index;
    const dateEnd = m.index + m[0].length;

    let label = '重要日期';
    let significance: KeyDate['significance'] = 'normal';
    let bestDist = Infinity;
    for (const cfg of KEY_DATE_LABELS) {
      for (const kw of cfg.keywords) {
        let from = 0;
        let kIdx = text.indexOf(kw, from);
        while (kIdx !== -1) {
          const kwEnd = kIdx + kw.length;
          let dist: number;
          if (kwEnd <= dateStart) {
            // 关键词在日期之前
            dist = dateStart - kwEnd;
          } else if (kIdx >= dateEnd) {
            // 关键词在日期之后
            dist = kIdx - dateEnd;
          } else {
            // 关键词与日期重叠
            dist = 0;
          }
          // 仅在合理窗口内（25 字符）才纳入候选
          if (dist <= 25 && dist < bestDist) {
            bestDist = dist;
            label = cfg.label;
            significance = cfg.significance;
          }
          from = kIdx + 1;
          kIdx = text.indexOf(kw, from);
        }
      }
    }

    // 去重：同一日期 + 同一标签只保留一条
    const dedupKey = `${key}:${label}`;
    if (seen.has(dedupKey)) continue;
    seen.add(dedupKey);

    dates.push({ label, date: dateStr, significance });
  }

  // 按日期升序排序
  dates.sort((a, b) => a.date.localeCompare(b.date));
  return dates;
}

// ===== 关键术语提取 =====

// 提取关键条款（付款方式、交付方式、违约责任等）
// 针对每个分类关键词命中后，截取所在条款片段作为取值
export function extractKeyTerms(text: string): KeyTerm[] {
  const terms: KeyTerm[] = [];
  const seenCategories = new Set<string>();

  for (const { category, keywords } of KEY_TERM_CATEGORIES) {
    // 每个分类只取首个命中
    if (seenCategories.has(category)) continue;

    let found = false;
    for (const kw of keywords) {
      const idx = text.indexOf(kw);
      if (idx < 0) continue;

      const clauseRef = findClauseRef(text, idx);
      const value = clipSnippet(text, idx, 90);

      terms.push({
        category,
        term: kw,
        value: value || kw,
        clause_ref: clauseRef,
      });
      seenCategories.add(category);
      found = true;
      break;
    }
    if (!found) {
      // 未命中的分类也列出，提示缺失
      // 此处不加入，保持结果仅含已命中项
    }
  }

  return terms;
}

// ===== 风险评估 =====

// 基于提取结果评估整体风险等级、关键风险与建议
function assessRisk(
  text: string,
  parties: ContractParty[],
  financials: FinancialTerm[],
  keyTerms: KeyTerm[]
): { overall_level: 'low' | 'medium' | 'high'; key_risks: string[]; recommendations: string[] } {
  const key_risks: string[] = [];
  const recommendations: string[] = [];
  let score = 100; // 初始满分，逐项扣分

  // 1) 合同主体缺失
  if (parties.length === 0) {
    key_risks.push('未识别到明确的合同主体（甲方/乙方）信息');
    recommendations.push('请补充完整的甲乙双方名称、法定代表人与联系方式');
    score -= 15;
  } else if (parties.length < 2) {
    key_risks.push('合同主体不完整，仅识别到一方');
    recommendations.push('请核实并补充另一方主体信息');
    score -= 8;
  }

  // 2) 预付款比例过高
  const prepayMatch = text.match(/预付(?:款)?\s*(?:为|占|比例[:：]?)?\s*(\d+(?:\.\d+)?)\s*[%％]/);
  if (prepayMatch) {
    const ratio = parseFloat(prepayMatch[1]);
    if (ratio > 40) {
      key_risks.push(`预付款比例为 ${ratio}%，超过 40% 关注阈值，资金回收风险较高`);
      recommendations.push('建议将预付款比例控制在 30% 以内，并约定分期付款与验收后付尾款');
      score -= 15;
    } else if (ratio > 30) {
      key_risks.push(`预付款比例为 ${ratio}%，偏高`);
      recommendations.push('建议预付款比例控制在 30% 以内');
      score -= 5;
    }
  }

  // 3) 违约责任条款
  const hasPenalty = keyTerms.some((t) => t.category === '违约责任') || /违约金|违约责任|赔偿/.test(text);
  if (!hasPenalty) {
    key_risks.push('缺少明确的违约责任/违约金条款');
    recommendations.push('建议补充违约金条款，明确金额或计算方式（如合同总额的 10%-20%）');
    score -= 15;
  }

  // 4) 争议解决条款
  const hasDispute = keyTerms.some((t) => t.category === '争议解决') || /仲裁|诉讼|管辖/.test(text);
  if (!hasDispute) {
    key_risks.push('缺少争议解决条款，纠纷时管辖不明');
    recommendations.push('建议补充争议解决条款，明确协商不成时向有管辖权法院提起诉讼');
    score -= 10;
  }

  // 5) 不可抗力条款
  const hasFM = keyTerms.some((t) => t.category === '不可抗力') || /不可抗力/.test(text);
  if (!hasFM) {
    key_risks.push('缺少不可抗力条款');
    recommendations.push('建议补充不可抗力条款，约定免责情形与通知义务');
    score -= 8;
  }

  // 6) 保密条款
  const hasConf = /保密|商业秘密/.test(text);
  if (!hasConf) {
    key_risks.push('缺少保密义务条款');
    recommendations.push('建议补充保密条款，约定保密期限（建议终止后 5 年以上）与违约赔偿');
    score -= 5;
  }

  // 7) 终止/解除条款
  const hasTerm = /终止|解除合同|合同终止/.test(text);
  if (!hasTerm) {
    key_risks.push('缺少合同终止/解除条款');
    recommendations.push('建议补充合同终止条件与提前解除的通知义务');
    score -= 8;
  }

  // 8) 金额条款缺失
  if (financials.length === 0) {
    key_risks.push('未识别到明确的合同金额/价款条款');
    recommendations.push('请核实并补充合同金额、币种及付款安排');
    score -= 8;
  }

  // 综合判定风险等级
  let overall_level: 'low' | 'medium' | 'high';
  if (score >= 75) overall_level = 'low';
  else if (score >= 50) overall_level = 'medium';
  else overall_level = 'high';

  // 若无关键风险，给出正向提示
  if (key_risks.length === 0) {
    key_risks.push('未发现明显风险点，条款较为完备');
    recommendations.push('建议签署前由法务复核确认细节');
  }

  return { overall_level, key_risks, recommendations };
}

// ===== 摘要文本生成 =====

// 生成 200 字以内的概括性摘要文本
function buildSummaryText(
  contractTitle: string,
  contractType: string,
  parties: ContractParty[],
  financials: FinancialTerm[],
  keyDates: KeyDate[],
  keyTerms: KeyTerm[]
): string {
  const parts: string[] = [];

  // 合同类型与标题
  parts.push(`本${contractType || '合同'}「${contractTitle || '未命名'}」`);

  // 合同主体
  const partyA = parties.find((p) => p.role === 'party_a');
  const partyB = parties.find((p) => p.role === 'party_b');
  if (partyA && partyB) {
    parts.push(`由${partyA.name}与${partyB.name}共同签署`);
  } else if (parties.length > 0) {
    parts.push(`涉及主体：${parties.map((p) => p.name).join('、')}`);
  }

  // 金额
  const total = financials.find((f) => f.type === 'total_amount');
  if (total) {
    parts.push(`合同金额${currencyLabel(total.currency)}${formatAmount(total.amount)}`);
  }

  // 关键日期
  const effective = keyDates.find((d) => d.label === '生效日期' || d.label === '签订日期');
  const expire = keyDates.find((d) => d.label === '到期日期');
  if (effective && expire) {
    parts.push(`有效期${effective.date}至${expire.date}`);
  } else if (effective) {
    parts.push(`${effective.label}${effective.date}`);
  }

  // 关键条款
  const termCats = keyTerms.slice(0, 4).map((t) => t.category);
  if (termCats.length > 0) {
    parts.push(`涵盖${termCats.join('、')}等条款`);
  }

  let summary = parts.join('，');
  // 截断至 200 字
  if (summary.length > 200) {
    summary = summary.slice(0, 197) + '...';
  }
  return summary + '。';
}

// ===== 主入口：生成合同摘要 =====

// 综合提取主体、财务、日期、术语，生成摘要文本与风险评估，统计字数与条款数
export function generateSummary(
  contractText: string,
  contractId: string,
  contractTitle: string,
  contractType: string
): ContractSummary {
  const text = contractText || '';

  // 各项提取
  const parties = extractParties(text);
  const financials = extractFinancials(text);
  const keyDates = extractKeyDates(text);
  const keyTerms = extractKeyTerms(text);

  // 风险评估
  const riskAssessment = assessRisk(text, parties, financials, keyTerms);

  // 摘要文本
  const summary = buildSummaryText(
    contractTitle,
    contractType,
    parties,
    financials,
    keyDates,
    keyTerms
  );

  // 时间线事件（由关键日期推导）
  const timeline: ContractTimelineEvent[] = keyDates.map((d) => ({
    event: d.label,
    date: d.date,
    clause_ref: undefined,
  }));

  // 字数统计（中文字符按字符计）
  const word_count = text.replace(/\s/g, '').length;

  // 条款数统计（"第X条"出现次数）
  const clauseCount = (text.match(/第[一二三四五六七八九十百千零\d]+条/g) || []).length;

  return {
    contract_id: contractId,
    contract_title: contractTitle,
    contract_type: contractType,
    summary,
    key_terms: keyTerms,
    financial_terms: financials,
    timeline,
    parties,
    key_dates: keyDates,
    risk_assessment: riskAssessment,
    word_count,
    clause_count: clauseCount,
    generated_at: new Date().toISOString(),
  };
}

// ===== 模拟摘要数据 =====

// 返回模拟合同摘要数据，用于演示模式
export function getMockSummary(contractId: string): ContractSummary {
  const now = new Date().toISOString();
  const partyA: ContractParty = {
    role: 'party_a',
    name: '北京智诚科技有限公司',
    legal_rep: '王建国',
    address: '北京市海淀区中关村南大街 28 号',
    contact: '010-88886666',
  };
  const partyB: ContractParty = {
    role: 'party_b',
    name: '深圳科创电子有限公司',
    legal_rep: '李明华',
    address: '深圳市南山区科技园南区 8 栋',
    contact: '0755-26668888',
  };

  const financials: FinancialTerm[] = [
    {
      type: 'total_amount',
      description: '合同金额：人民币1,200,000',
      amount: 1200000,
      currency: 'CNY',
      clause_ref: '第三条',
    },
    {
      type: 'deposit',
      description: '保证金/预付款：人民币360,000',
      amount: 360000,
      currency: 'CNY',
      clause_ref: '第四条',
    },
    {
      type: 'penalty',
      description: '违约金：人民币120,000',
      amount: 120000,
      currency: 'CNY',
      clause_ref: '第八条',
    },
  ];

  const keyDates: KeyDate[] = [
    { label: '签订日期', date: '2024-03-15', significance: 'normal' },
    { label: '生效日期', date: '2024-04-01', significance: 'critical' },
    { label: '交付日期', date: '2024-06-30', significance: 'important' },
    { label: '付款日期', date: '2024-07-15', significance: 'important' },
    { label: '到期日期', date: '2025-04-01', significance: 'critical' },
  ];

  const keyTerms: KeyTerm[] = [
    { category: '付款方式', term: '付款', value: '合同签署后 7 个工作日内支付 30% 预付款，验收合格后支付 70% 尾款', clause_ref: '第四条' },
    { category: '交付方式', term: '交付', value: '乙方应于约定日期前将全部标的交付至甲方指定地点', clause_ref: '第五条' },
    { category: '违约责任', term: '违约金', value: '任何一方违约应向守约方支付合同总额 10% 的违约金', clause_ref: '第八条' },
    { category: '保密义务', term: '保密', value: '双方对合作过程中获知的商业秘密负有保密义务，期限为合同终止后 5 年', clause_ref: '第十条' },
    { category: '争议解决', term: '争议解决', value: '协商不成的，向甲方所在地有管辖权的人民法院提起诉讼', clause_ref: '第十二条' },
    { category: '不可抗力', term: '不可抗力', value: '因不可抗力导致不能履行的，根据影响程度部分或全部免除责任', clause_ref: '第十一条' },
  ];

  const timeline: ContractTimelineEvent[] = keyDates.map((d) => ({
    event: d.label,
    date: d.date,
  }));

  return {
    contract_id: contractId,
    contract_title: 'XX产品采购合同',
    contract_type: '采购合同',
    summary:
      '本采购合同「XX产品采购合同」由北京智诚科技有限公司与深圳科创电子有限公司共同签署，合同金额人民币1,200,000，有效期2024-04-01至2025-04-01，涵盖付款方式、交付方式、违约责任、保密义务等条款。',
    key_terms: keyTerms,
    financial_terms: financials,
    timeline,
    parties: [partyA, partyB],
    key_dates: keyDates,
    risk_assessment: {
      overall_level: 'low',
      key_risks: [
        '预付款比例为 30%，处于关注阈值边缘',
        '建议核实知识产权归属条款是否明确',
      ],
      recommendations: [
        '建议将预付款比例降至 30% 以内并约定验收后付尾款',
        '建议补充知识产权归属条款，明确新开发成果权属',
        '签署前由法务复核确认细节',
      ],
    },
    word_count: 3280,
    clause_count: 14,
    generated_at: now,
  };
}
