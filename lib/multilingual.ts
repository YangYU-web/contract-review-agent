// ===== 多语言合同审查模块 =====
// 提供语言检测、双语条款分割、中英文条款对比与数字差异分析能力

import {
  ContractLanguage,
  LanguageDetectionResult,
  BilingualClause,
  BilingualDiscrepancy,
  LANGUAGE_LABELS,
} from './types';

// 中文字符正则（基本汉字区）
const CHINESE_CHAR_REGEX = /[\u4e00-\u9fa5]/g;
// 英文字母正则
const ENGLISH_LETTER_REGEX = /[a-zA-Z]/g;
// 数字正则（含中文数字量词与英文金额/日期格式）
const NUMBER_REGEX = /(?:￥|¥|\$|RMB|USD|CNY)?\s*\d[\d,]*\.?\d*\s*(?:%|‰|万|亿|元|美元|日|天|个|月|年|days?|months?|years?|%|percent)?/gi;

// ===== 语言检测 =====

/**
 * 检测文本语言
 * 统计中文字符比例与英文字母比例，按阈值判定 zh / en / bilingual
 * 置信度由主导语言比例与字符总量综合得出
 */
export function detectLanguage(text: string): LanguageDetectionResult {
  const cleaned = text.replace(/\s+/g, '');
  const totalChars = cleaned.length;

  if (totalChars === 0) {
    return {
      language: 'bilingual',
      confidence: 0,
      chinese_ratio: 0,
      english_ratio: 0,
      total_chars: 0,
    };
  }

  const chineseMatches = cleaned.match(CHINESE_CHAR_REGEX) || [];
  const englishMatches = cleaned.match(ENGLISH_LETTER_REGEX) || [];

  const chineseCount = chineseMatches.length;
  const englishCount = englishMatches.length;
  const chineseRatio = chineseCount / totalChars;
  const englishRatio = englishCount / totalChars;

  // 判定语言
  let language: ContractLanguage;
  if (chineseRatio > 0.6) {
    language = 'zh';
  } else if (englishRatio > 0.6) {
    language = 'en';
  } else if (chineseRatio > 0.2 && englishRatio > 0.2) {
    language = 'bilingual';
  } else if (chineseRatio >= englishRatio) {
    // 非典型双语但中文占优
    language = chineseRatio > 0.1 ? 'zh' : 'bilingual';
  } else {
    language = englishRatio > 0.1 ? 'en' : 'bilingual';
  }

  // 计算置信度：主导语言比例越高、文本越长越可信
  const dominantRatio = Math.max(chineseRatio, englishRatio);
  // 文本量加权：长文本更可信，短文本降低置信度
  const lengthFactor = Math.min(1, totalChars / 100);
  let confidence = Math.round(dominantRatio * 100 * (0.6 + 0.4 * lengthFactor));

  if (language === 'bilingual') {
    // 双语场景：两种语言都占有相当比例时置信度较高
    const balance = 1 - Math.abs(chineseRatio - englishRatio);
    confidence = Math.round((balance * 0.5 + dominantRatio * 0.5) * 100 * (0.6 + 0.4 * lengthFactor));
  }

  confidence = Math.max(0, Math.min(100, confidence));

  return {
    language,
    confidence,
    chinese_ratio: Number(chineseRatio.toFixed(4)),
    english_ratio: Number(englishRatio.toFixed(4)),
    total_chars: totalChars,
  };
}

// ===== 双语条款分割 =====

/**
 * 将单一语言合同文本按条款标记切分为条款字符串数组
 * 识别「第X条」「Article X」「X.X」等编号，按标记位置切分；无标记时按段落切分
 */
export function splitContractClauses(text: string): string[] {
  if (!text || text.trim().length === 0) return [];
  const markers = extractClauseMarkers(text);

  if (markers.length === 0) {
    // 按空行段落切分
    return text
      .split(/\n\s*\n/)
      .map(p => p.trim())
      .filter(p => p.length > 5);
  }

  const segments: string[] = [];
  for (let i = 0; i < markers.length; i++) {
    const start = markers[i].index;
    const end = i < markers.length - 1 ? markers[i + 1].index : text.length;
    const seg = text.substring(start, end).trim();
    if (seg.length > 0) segments.push(seg);
  }
  return segments;
}

/**
 * 从文本中提取条款编号列表（如 第1条 / 1.1 / Article 1）
 * 支持中文「第X条」与英文「Article X / X.X」两种风格
 */
function extractClauseMarkers(text: string): { marker: string; index: number }[] {
  const markers: { marker: string; index: number }[] = [];

  // 中文条款编号：第一条 / 第1条 / 1.1 / 一、
  const zhMarkerRegex = /第[一二三四五六七八九十百千零〇0-9]+条(?:[^\n]*)?/g;
  const zhNumberedRegex = /^\s*(?:[0-9]+[\.、][0-9]+|第[一二三四五六七八九十百千零〇0-9]+[章节条])/gm;

  // 英文条款编号：Article 1 / 1.1 / Section 1
  const enMarkerRegex = /(?:Article|Section|Clause)\s+[IVX0-9]+(?:[\.\)][^\n]*)?/gi;

  const collect = (regex: RegExp) => {
    let m: RegExpExecArray | null;
    while ((m = regex.exec(text)) !== null) {
      markers.push({ marker: m[0].trim(), index: m.index });
    }
  };

  collect(zhMarkerRegex);
  collect(zhNumberedRegex);
  collect(enMarkerRegex);

  // 按出现位置排序并去重（位置接近的视为同一条款标记）
  markers.sort((a, b) => a.index - b.index);
  const deduped: { marker: string; index: number }[] = [];
  let lastIdx = -1;
  for (const mk of markers) {
    if (mk.index - lastIdx < 2) continue;
    deduped.push(mk);
    lastIdx = mk.index;
  }
  return deduped;
}

// 基于编辑距离的文本相似度（0-100）
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

// 判断段落是中文为主还是英文为主
function isChineseParagraph(text: string): boolean {
  const cleaned = text.replace(/\s+/g, '');
  if (!cleaned) return false;
  const chineseCount = (cleaned.match(CHINESE_CHAR_REGEX) || []).length;
  const englishCount = (cleaned.match(ENGLISH_LETTER_REGEX) || []).length;
  return chineseCount >= englishCount;
}

/**
 * 分割双语合同文本为中英文条款对
 * 识别合同中的中英文条款（如「第X条」后跟中文与英文），按条款切分并匹配
 */
export function splitBilingualClauses(text: string): BilingualClause[] {
  if (!text || text.trim().length === 0) return [];

  const markers = extractClauseMarkers(text);

  // 无明显条款标记时，按段落切分后两两配对
  if (markers.length === 0) {
    const paragraphs = text
      .split(/\n\s*\n/)
      .map(p => p.trim())
      .filter(p => p.length > 5);

    // 将段落分为中英文两组，按出现顺序配对
    const zhClauses: string[] = [];
    const enClauses: string[] = [];
    for (const para of paragraphs) {
      if (isChineseParagraph(para)) {
        zhClauses.push(para);
      } else {
        enClauses.push(para);
      }
    }
    return compareBilingualClauses(zhClauses, enClauses);
  }

  // 按标记位置切分条款片段
  const segments: string[] = [];
  for (let i = 0; i < markers.length; i++) {
    const start = markers[i].index;
    const end = i < markers.length - 1 ? markers[i + 1].index : text.length;
    const seg = text.substring(start, end).trim();
    if (seg.length > 0) segments.push(seg);
  }

  // 在每个条款内若同时包含中文与英文，则按语言进一步切分
  const chineseClauses: string[] = [];
  const englishClauses: string[] = [];

  for (const seg of segments) {
    const zhParts: string[] = [];
    const enParts: string[] = [];
    // 按行/段落细分
    const lines = seg.split(/\n+/).map(l => l.trim()).filter(l => l.length > 0);
    for (const line of lines) {
      if (isChineseParagraph(line)) {
        zhParts.push(line);
      } else {
        enParts.push(line);
      }
    }
    if (zhParts.length > 0) chineseClauses.push(zhParts.join('\n'));
    if (enParts.length > 0) englishClauses.push(enParts.join('\n'));
  }

  return compareBilingualClauses(chineseClauses, englishClauses);
}

// ===== 双语条款对比 =====

/**
 * 逐条匹配中英文条款并检测差异
 * 检测维度：missing_clause / value_mismatch / term_mismatch / structure_mismatch
 */
export function compareBilingualClauses(
  chineseClauses: string[],
  englishClauses: string[]
): BilingualClause[] {
  const result: BilingualClause[] = [];
  const maxLen = Math.max(chineseClauses.length, englishClauses.length);

  for (let i = 0; i < maxLen; i++) {
    const zh = chineseClauses[i];
    const en = englishClauses[i];
    const discrepancies: BilingualDiscrepancy[] = [];

    const zhText = zh?.trim() || '';
    const enText = en?.trim() || '';

    // 缺失条款检测
    if (!zhText && !enText) continue;
    if (!zhText || !enText) {
      discrepancies.push({
        type: 'missing_clause',
        description: !zhText
          ? '英文版本存在该条款，但中文版本缺失对应条款'
          : '中文版本存在该条款，但英文版本缺失对应条款',
        chinese_ref: zhText || undefined,
        english_ref: enText || undefined,
        severity: 'high',
      });

      result.push({
        clause_id: `clause-${i + 1}`,
        chinese_text: zhText || undefined,
        english_text: enText || undefined,
        alignment_confidence: 0,
        semantic_similarity: 0,
        discrepancies,
      });
      continue;
    }

    // 对齐置信度：基于文本长度比例与结构相似度估算
    const lengthRatio = Math.min(zhText.length, enText.length) / Math.max(zhText.length, enText.length);
    const similarity = calculateSimilarity(zhText, enText);
    // 中英文差异较大时相似度天然偏低，对齐置信度主要依赖长度比与结构信号
    const alignmentConfidence = Math.round(lengthRatio * 60 + (zhText.length > 0 && enText.length > 0 ? 40 : 0));

    // 金额/日期/数值差异检测
    const zhNumbers = extractNumbers(zhText);
    const enNumbers = extractNumbers(enText);
    const numberDiscrepancies = compareNumberSets(zhNumbers, enNumbers);
    discrepancies.push(...numberDiscrepancies);

    // 术语翻译一致性检测
    const termDiscrepancies = detectTermMismatches(zhText, enText);
    discrepancies.push(...termDiscrepancies);

    // 结构差异检测
    const structureDiscrepancy = detectStructureMismatch(zhText, enText);
    if (structureDiscrepancy) discrepancies.push(structureDiscrepancy);

    result.push({
      clause_id: `clause-${i + 1}`,
      chinese_text: zhText,
      english_text: enText,
      alignment_confidence: Math.max(0, Math.min(100, alignmentConfidence)),
      semantic_similarity: similarity,
      discrepancies,
    });
  }

  return result;
}

// 常见中英术语对照表（用于术语翻译一致性检测）
const TERM_DICTIONARY: { zh: string[]; en: string[]; label: string }[] = [
  { zh: ['甲方'], en: ['Party A', 'party A'], label: '甲方' },
  { zh: ['乙方'], en: ['Party B', 'party B'], label: '乙方' },
  { zh: ['违约金'], en: ['liquidated damages', 'penalty', 'breach of contract damages'], label: '违约金' },
  { zh: ['不可抗力'], en: ['force majeure', 'Force Majeure'], label: '不可抗力' },
  { zh: ['保密'], en: ['confidential', 'confidentiality'], label: '保密' },
  { zh: ['知识产权'], en: ['intellectual property', 'IP'], label: '知识产权' },
  { zh: ['仲裁'], en: ['arbitration'], label: '仲裁' },
  { zh: ['管辖'], en: ['jurisdiction'], label: '管辖' },
  { zh: ['终止'], en: ['termination', 'terminate'], label: '终止' },
  { zh: ['预付款'], en: ['advance payment', 'prepayment'], label: '预付款' },
];

// 术语翻译一致性检测
function detectTermMismatches(zhText: string, enText: string): BilingualDiscrepancy[] {
  const discrepancies: BilingualDiscrepancy[] = [];

  for (const term of TERM_DICTIONARY) {
    const zhHas = term.zh.some(t => zhText.includes(t));
    const enHas = term.en.some(t => new RegExp(t, 'i').test(enText));
    // 一方出现术语而另一方缺失对应翻译
    if (zhHas && !enHas) {
      discrepancies.push({
        type: 'term_mismatch',
        description: `中文条款包含术语「${term.label}」，但英文条款未出现对应翻译（${term.en.join('/')}）`,
        chinese_ref: term.label,
        english_ref: term.en.join(' / '),
        severity: 'medium',
      });
    } else if (enHas && !zhHas) {
      discrepancies.push({
        type: 'term_mismatch',
        description: `英文条款包含术语「${term.en.join('/')}」，但中文条款未出现对应翻译（${term.label}）`,
        chinese_ref: term.label,
        english_ref: term.en.join(' / '),
        severity: 'medium',
      });
    }
  }

  return discrepancies;
}

// 结构差异检测：基于条款长度差异与标点/分段数量
function detectStructureMismatch(zhText: string, enText: string): BilingualDiscrepancy | null {
  const zhSentences = zhText.split(/[。；！？\n]/).filter(s => s.trim().length > 0);
  const enSentences = enText.split(/[.;!\n]/).filter(s => s.trim().length > 0);

  const sentenceDiff = Math.abs(zhSentences.length - enSentences.length);
  // 子句数量差异较大
  if (sentenceDiff >= 2) {
    return {
      type: 'structure_mismatch',
      description: `条款结构差异：中文含 ${zhSentences.length} 个子句，英文含 ${enSentences.length} 个子句，数量差异 ${sentenceDiff}`,
      chinese_ref: `${zhSentences.length} 个子句`,
      english_ref: `${enSentences.length} 个子句`,
      severity: sentenceDiff >= 3 ? 'high' : 'low',
    };
  }

  // 长度比例严重失衡
  const lenRatio = Math.min(zhText.length, enText.length) / Math.max(zhText.length, enText.length);
  if (lenRatio < 0.3 && zhText.length > 20 && enText.length > 20) {
    return {
      type: 'structure_mismatch',
      description: `条款详尽度差异较大：中文 ${zhText.length} 字符，英文 ${enText.length} 字符，长度比约 ${(lenRatio * 100).toFixed(0)}%`,
      chinese_ref: `${zhText.length} 字符`,
      english_ref: `${enText.length} 字符`,
      severity: 'medium',
    };
  }

  return null;
}

// ===== 数字提取与对比 =====

/**
 * 提取文本中的数字及其上下文
 * 识别金额、百分比、期限等数值，并截取周边上下文便于比对
 */
export function extractNumbers(text: string): { value: string; context: string }[] {
  if (!text) return [];
  const results: { value: string; context: string }[] = [];
  const seen = new Set<string>();

  let match: RegExpExecArray | null;
  NUMBER_REGEX.lastIndex = 0;
  while ((match = NUMBER_REGEX.exec(text)) !== null) {
    const raw = match[0].trim();
    // 提取纯数字部分作为比对键（去除货币符号与单位）
    const numMatch = raw.match(/[\d,]+\.?\d*/);
    if (!numMatch) continue;
    const value = numMatch[0].replace(/,/g, '');
    if (!value || value === '0' || seen.has(value)) continue;
    seen.add(value);

    // 截取数字前后约 15 字符作为上下文
    const start = Math.max(0, match.index - 15);
    const end = Math.min(text.length, match.index + raw.length + 15);
    const context = text.substring(start, end).replace(/\s+/g, ' ').trim();

    results.push({ value, context });
  }

  return results;
}

/**
 * 对比中英文数字集合，检测金额/日期/期限等数值不匹配
 */
export function compareNumberSets(
  zhNumbers: { value: string; context: string }[],
  enNumbers: { value: string; context: string }[]
): BilingualDiscrepancy[] {
  const discrepancies: BilingualDiscrepancy[] = [];
  const enValues = new Set(enNumbers.map(n => n.value));

  // 中文有而英文无的数值
  for (const zhNum of zhNumbers) {
    if (!enValues.has(zhNum.value)) {
      // 尝试模糊匹配：英文中是否存在相近数值
      const zhVal = parseFloat(zhNum.value);
      const hasClose = enNumbers.some(n => {
        const enVal = parseFloat(n.value);
        if (isNaN(zhVal) || isNaN(enVal)) return false;
        return Math.abs(zhVal - enVal) <= Math.max(1, zhVal * 0.02);
      });

      if (!hasClose) {
        discrepancies.push({
          type: 'value_mismatch',
          description: `数值不匹配：中文条款含数值「${zhNum.value}」（上下文：${zhNum.context}），英文条款未发现对应数值`,
          chinese_ref: zhNum.context,
          english_ref: undefined,
          severity: 'high',
        });
      }
    }
  }

  // 英文有而中文无的数值
  const zhValues = new Set(zhNumbers.map(n => n.value));
  for (const enNum of enNumbers) {
    if (!zhValues.has(enNum.value)) {
      const enVal = parseFloat(enNum.value);
      const hasClose = zhNumbers.some(n => {
        const zhVal = parseFloat(n.value);
        if (isNaN(zhVal) || isNaN(enVal)) return false;
        return Math.abs(zhVal - enVal) <= Math.max(1, enVal * 0.02);
      });

      if (!hasClose) {
        discrepancies.push({
          type: 'value_mismatch',
          description: `数值不匹配：英文条款含数值「${enNum.value}」（上下文：${enNum.context}），中文条款未发现对应数值`,
          chinese_ref: undefined,
          english_ref: enNum.context,
          severity: 'high',
        });
      }
    }
  }

  return discrepancies;
}

// 导出语言标签便于外部使用
export { LANGUAGE_LABELS };
