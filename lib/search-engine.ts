// ===== 全文搜索引擎模块 =====
// 提供合同全文检索能力：关键词匹配、相关度评分、高亮、摘要提取、分面统计与分页
// 基于内存中的 Mock 合同与风险数据构建可搜索文档
// 供搜索 API 与搜索组件共用

import {
  SearchFilter,
  SearchResultItem,
  SearchResponse,
  Contract,
  ContractRisk,
  RiskLevel,
} from './types';
import { getMockContracts, getMockRisks } from './mock-data';

// ===== 风险等级权重（用于相关度计算）=====
const RISK_LEVEL_WEIGHT: Record<RiskLevel, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

// ===== 可搜索文档 =====
// 将合同与其关联风险条款组合成可检索的文档结构
interface SearchableDocument {
  contract: Contract;
  risks: ContractRisk[];
  // 用于检索的全文（标题 + 类型 + 文件名 + 风险条款文本与解释）
  fullText: string;
  // 当事人（从风险条款中抽取模拟，演示用）
  party: string;
  // 最高风险等级
  maxRiskLevel: RiskLevel | null;
}

// 构建可搜索文档列表
function buildSearchableDocuments(): SearchableDocument[] {
  const contracts = getMockContracts();
  // 追加更多演示合同，丰富搜索结果
  const extraContracts: Contract[] = [
    {
      id: 'mock-004',
      user_id: 'mock-user',
      filename: '保密协议_NDA.docx',
      file_type: 'docx',
      file_size: 96000,
      contract_type: '保密协议',
      contract_title: '技术合作保密协议',
      status: 'completed',
      risk_score: 28,
      risk_count: 2,
      high_risk_count: 0,
      created_at: new Date(Date.now() - 86400000 * 10).toISOString(),
      updated_at: new Date(Date.now() - 86400000 * 10).toISOString(),
    },
    {
      id: 'mock-005',
      user_id: 'mock-user',
      filename: '劳动合同_2025.pdf',
      file_type: 'pdf',
      file_size: 142000,
      contract_type: '劳动合同',
      contract_title: '员工劳动合同',
      status: 'completed',
      risk_score: 50,
      risk_count: 4,
      high_risk_count: 1,
      created_at: new Date(Date.now() - 86400000 * 15).toISOString(),
      updated_at: new Date(Date.now() - 86400000 * 15).toISOString(),
    },
    {
      id: 'mock-006',
      user_id: 'mock-user',
      filename: '股权转让协议.docx',
      file_type: 'docx',
      file_size: 210000,
      contract_type: '股权转让协议',
      contract_title: 'XX公司股权转让协议',
      status: 'reviewing',
      risk_score: 72,
      risk_count: 7,
      high_risk_count: 3,
      created_at: new Date(Date.now() - 86400000 * 20).toISOString(),
      updated_at: new Date(Date.now() - 86400000 * 20).toISOString(),
    },
    {
      id: 'mock-007',
      user_id: 'mock-user',
      filename: '软件开发外包合同.pdf',
      file_type: 'pdf',
      file_size: 188000,
      contract_type: '服务合同',
      contract_title: '软件开发外包服务合同',
      status: 'completed',
      risk_score: 38,
      risk_count: 3,
      high_risk_count: 0,
      created_at: new Date(Date.now() - 86400000 * 35).toISOString(),
      updated_at: new Date(Date.now() - 86400000 * 35).toISOString(),
    },
  ];

  const allContracts = [...contracts, ...extraContracts];

  return allContracts.map((contract) => {
    const risks = getMockRisks(contract.id);
    // 风险条款文本与解释拼接为可检索内容
    const riskText = risks
      .map((r) => `${r.clause_id} ${r.clause_text} ${r.risk_explanation}`)
      .join(' ');
    const fullText = `${contract.contract_title} ${contract.contract_type} ${contract.filename} ${riskText}`;

    // 当事人模拟（演示用）
    const partyMap: Record<string, string> = {
      'mock-001': '甲方科技有限公司 / 乙方供应商集团',
      'mock-002': '委托方 / 受托技术服务公司',
      'mock-003': '出租方物业 / 承租方企业',
      'mock-004': '披露方 / 接收方',
      'mock-005': '用人单位 / 劳动者',
      'mock-006': '转让方 / 受让方',
      'mock-007': '甲方 / 乙方软件公司',
    };

    // 最高风险等级
    const levels: RiskLevel[] = risks.map((r) => r.risk_level);
    let maxRiskLevel: RiskLevel | null = null;
    if (levels.length > 0) {
      maxRiskLevel = levels.reduce((max, l) =>
        RISK_LEVEL_WEIGHT[l] > RISK_LEVEL_WEIGHT[max] ? l : max
      );
    }

    return {
      contract,
      risks,
      fullText,
      party: partyMap[contract.id] || '甲方 / 乙方',
      maxRiskLevel,
    };
  });
}

// ===== 分词 =====
// 将查询字符串拆分为关键词（支持中英文混合，中文按字符 / 2-gram，英文按单词）
function tokenize(query: string): string[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return [];
  const tokens: string[] = [];
  // 英文 / 数字单词
  const wordMatches = trimmed.match(/[a-z0-9]+/g) || [];
  tokens.push(...wordMatches);
  // 中文：提取连续中文片段，按 2-gram 切分（同时保留完整片段）
  const chineseSegments = trimmed.match(/[\u4e00-\u9fa5]+/g) || [];
  for (const seg of chineseSegments) {
    tokens.push(seg);
    if (seg.length > 2) {
      for (let i = 0; i < seg.length - 1; i++) {
        tokens.push(seg.substring(i, i + 2));
      }
    }
  }
  // 去重
  return Array.from(new Set(tokens));
}

// ===== 高亮搜索词位置 =====
// 在文本中查找所有匹配词的出现位置（字符索引）
export function highlightTerms(
  text: string,
  terms: string[]
): { term: string; positions: number[] }[] {
  const lowerText = text.toLowerCase();
  return terms
    .map((term) => {
      const lowerTerm = term.toLowerCase();
      if (!lowerTerm) return { term, positions: [] };
      const positions: number[] = [];
      let idx = lowerText.indexOf(lowerTerm);
      while (idx !== -1) {
        positions.push(idx);
        idx = lowerText.indexOf(lowerTerm, idx + lowerTerm.length);
      }
      return { term, positions };
    })
    .filter((item) => item.positions.length > 0);
}

// ===== 提取搜索结果摘要 =====
// 围绕首个匹配词截取 maxLength 长度的文本片段
export function extractSnippet(text: string, query: string, maxLength: number): string {
  const terms = tokenize(query);
  const lowerText = text.toLowerCase();

  // 找到首个匹配位置
  let firstPos = -1;
  for (const term of terms) {
    const pos = lowerText.indexOf(term.toLowerCase());
    if (pos !== -1 && (firstPos === -1 || pos < firstPos)) {
      firstPos = pos;
    }
  }

  // 无匹配时取开头
  if (firstPos === -1) {
    return text.length > maxLength
      ? text.substring(0, maxLength) + '...'
      : text;
  }

  // 以匹配词为中心截取
  const half = Math.floor((maxLength - terms.join('').length) / 2);
  let start = Math.max(0, firstPos - half);
  let end = Math.min(text.length, start + maxLength);
  // 避免截断到字符中间（按整句边界微调）
  const sentenceStart = text.lastIndexOf('。', start);
  if (sentenceStart !== -1 && start - sentenceStart < 20) start = sentenceStart + 1;
  const sentenceEnd = text.indexOf('。', end);
  if (sentenceEnd !== -1 && sentenceEnd - end < 20) end = sentenceEnd + 1;

  let snippet = text.substring(start, end);
  if (start > 0) snippet = '...' + snippet;
  if (end < text.length) snippet = snippet + '...';
  return snippet;
}

// ===== 计算相关度评分 =====
// 基于匹配字段数量、匹配次数与字段权重综合计算 0-100 的相关度
export function calculateRelevance(
  query: string,
  text: string,
  matchedFields: string[]
): number {
  const terms = tokenize(query);
  if (terms.length === 0) return 0;

  const lowerText = text.toLowerCase();
  // 匹配次数
  let matchCount = 0;
  for (const term of terms) {
    const lowerTerm = term.toLowerCase();
    let idx = lowerText.indexOf(lowerTerm);
    while (idx !== -1) {
      matchCount++;
      idx = lowerText.indexOf(lowerTerm, idx + lowerTerm.length);
    }
  }

  // 字段权重：标题权重最高
  const fieldWeight: Record<string, number> = {
    contract_title: 3,
    contract_type: 2,
    filename: 1.5,
    fullText: 1,
  };
  const fieldScore = matchedFields.reduce(
    (sum, f) => sum + (fieldWeight[f] || 1),
    0
  );

  // 词覆盖率
  const matchedTerms = terms.filter(
    (t) => lowerText.indexOf(t.toLowerCase()) !== -1
  ).length;
  const coverage = matchedTerms / terms.length;

  // 综合评分（0-100）
  const base = Math.min(matchCount * 8, 60);
  const fieldBonus = Math.min(fieldScore * 5, 25);
  const coverageBonus = coverage * 15;
  return Math.round(Math.min(base + fieldBonus + coverageBonus, 100));
}

// ===== 应用筛选条件 =====
function applyFilters(
  docs: SearchableDocument[],
  filters: SearchFilter
): SearchableDocument[] {
  return docs.filter((doc) => {
    const { contract } = doc;
    // 合同类型
    if (filters.contract_type && contract.contract_type !== filters.contract_type) {
      return false;
    }
    // 风险等级
    if (filters.risk_level) {
      if (filters.risk_level === 'none') {
        if (doc.maxRiskLevel !== null) return false;
      } else if (doc.maxRiskLevel !== filters.risk_level) {
        return false;
      }
    }
    // 日期范围
    if (filters.date_from) {
      const from = new Date(filters.date_from).getTime();
      const created = new Date(contract.created_at).getTime();
      if (!Number.isNaN(from) && created < from) return false;
    }
    if (filters.date_to) {
      const to = new Date(filters.date_to);
      to.setHours(23, 59, 59, 999);
      const created = new Date(contract.created_at).getTime();
      if (!Number.isNaN(to.getTime()) && created > to.getTime()) return false;
    }
    // 风险评分范围
    if (typeof filters.risk_score_min === 'number' && (contract.risk_score ?? 0) < filters.risk_score_min) {
      return false;
    }
    if (typeof filters.risk_score_max === 'number' && (contract.risk_score ?? 0) > filters.risk_score_max) {
      return false;
    }
    // 当事人
    if (filters.party_name) {
      if (!doc.party.toLowerCase().includes(filters.party_name.toLowerCase())) {
        return false;
      }
    }
    // 状态
    if (filters.status && contract.status !== filters.status) {
      return false;
    }
    return true;
  });
}

// ===== 生成分面统计 =====
// 基于筛选后的结果集统计合同类型、风险等级与日期分布
export function getFacets(results: SearchResultItem[]): SearchResponse['facets'] {
  // 合同类型分面
  const typeMap: Record<string, number> = {};
  for (const r of results) {
    typeMap[r.contract_type] = (typeMap[r.contract_type] || 0) + 1;
  }
  const contract_types = Object.entries(typeMap)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);

  // 风险等级分面（基于风险评分映射）
  const levelMap: Record<string, number> = { high: 0, medium: 0, low: 0 };
  for (const r of results) {
    if (r.risk_score >= 60) levelMap.high++;
    else if (r.risk_score >= 30) levelMap.medium++;
    else levelMap.low++;
  }
  const risk_levels = [
    { label: '高风险', count: levelMap.high },
    { label: '中风险', count: levelMap.medium },
    { label: '低风险', count: levelMap.low },
  ];

  // 日期范围分面
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  let last7 = 0;
  let last30 = 0;
  let earlier = 0;
  for (const r of results) {
    const t = new Date(r.date).getTime();
    if (now - t <= 7 * day) last7++;
    else if (now - t <= 30 * day) last30++;
    else earlier++;
  }
  const date_ranges = [
    { label: '近7天', count: last7 },
    { label: '近30天', count: last30 },
    { label: '更早', count: earlier },
  ];

  return { contract_types, risk_levels, date_ranges };
}

// ===== 搜索建议 =====
// 基于查询前缀在合同标题 / 类型 / 风险类型中匹配，返回建议词
export function getSearchSuggestions(query: string): string[] {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const lower = trimmed.toLowerCase();
  const docs = buildSearchableDocuments();
  const candidates = new Set<string>();

  // 合同标题 / 类型作为候选
  for (const doc of docs) {
    if (doc.contract.contract_title?.toLowerCase().includes(lower)) {
      candidates.add(doc.contract.contract_title);
    }
    if (doc.contract.contract_type?.toLowerCase().includes(lower)) {
      candidates.add(doc.contract.contract_type);
    }
  }

  // 常见搜索词
  const commonTerms = [
    '付款条款', '违约责任', '保密义务', '知识产权', '争议解决',
    '不可抗力', '合同终止', '预付款', '交付风险', '违约金',
  ];
  for (const term of commonTerms) {
    if (term.toLowerCase().includes(lower)) {
      candidates.add(term);
    }
  }

  return Array.from(candidates).slice(0, 6);
}

// ===== 全文搜索主入口 =====
// 执行关键词匹配、应用筛选、计算相关度、生成摘要与分面、支持分页
export function searchContracts(
  query: string,
  filters: SearchFilter,
  page: number,
  pageSize: number
): SearchResponse {
  const startTime = performance.now();
  const docs = buildSearchableDocuments();
  const terms = tokenize(query);
  const hasQuery = terms.length > 0;

  // 应用筛选条件
  let filtered = applyFilters(docs, filters);

  // 构建搜索结果项
  let results: SearchResultItem[] = filtered.map((doc) => {
    const { contract } = doc;
    const matchedFields: string[] = [];

    if (hasQuery) {
      if (contract.contract_title && containsAny(contract.contract_title, terms)) {
        matchedFields.push('contract_title');
      }
      if (contract.contract_type && containsAny(contract.contract_type, terms)) {
        matchedFields.push('contract_type');
      }
      if (contract.filename && containsAny(contract.filename, terms)) {
        matchedFields.push('filename');
      }
      if (containsAny(doc.fullText, terms)) {
        matchedFields.push('fullText');
      }
    } else {
      // 无查询时默认匹配全部
      matchedFields.push('contract_title');
    }

    const relevance = hasQuery
      ? calculateRelevance(query, doc.fullText, matchedFields)
      : 0;

    const snippet = hasQuery
      ? extractSnippet(doc.fullText, query, 120)
      : (contract.contract_title || '') + ' · ' + (contract.contract_type || '');

    return {
      contract_id: contract.id,
      contract_title: contract.contract_title || contract.filename,
      contract_type: contract.contract_type || '未分类',
      snippet,
      highlighted_terms: highlightTerms(snippet, terms),
      risk_score: contract.risk_score ?? 0,
      risk_count: contract.risk_count ?? 0,
      date: contract.created_at,
      relevance,
      matched_fields: matchedFields,
    };
  });

  // 有查询时仅保留有匹配的结果，并按相关度排序
  if (hasQuery) {
    results = results.filter((r) => r.matched_fields.length > 0);
    results.sort((a, b) => b.relevance - a.relevance);
  } else {
    // 无查询时按创建时间倒序
    results.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }

  const total = results.length;

  // 分页
  const safePage = Math.max(1, page);
  const safeSize = Math.max(1, pageSize);
  const startIdx = (safePage - 1) * safeSize;
  const paged = results.slice(startIdx, startIdx + safeSize);

  // 分面统计基于完整结果集
  const facets = getFacets(results);

  const searchTimeMs = Math.round(performance.now() - startTime);

  return {
    query,
    total,
    page: safePage,
    page_size: safeSize,
    results: paged,
    facets,
    search_time_ms: searchTimeMs,
    suggestions: total === 0 ? getSearchSuggestions(query) : undefined,
  };
}

// 检查文本是否包含任一关键词
function containsAny(text: string, terms: string[]): boolean {
  const lower = text.toLowerCase();
  return terms.some((t) => lower.includes(t.toLowerCase()));
}
