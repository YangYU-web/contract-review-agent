// ===== 合同知识库与智能检索模块 =====
// 基于关键词和语义的合同条款检索

import { Contract, ContractRisk } from './types';
import { getMockContracts, getMockRisks } from './mock-data';

export interface SearchResult {
  contract_id: string;
  contract_title: string;
  contract_type: string;
  risk_type: string;
  clause_text: string;
  risk_explanation: string;
  suggested_redline: string;
  risk_level: string;
  similarity: number;
}

export interface KnowledgeBaseStats {
  total_contracts: number;
  total_risks: number;
  total_clauses: number;
  contract_types: { type: string; count: number }[];
  risk_types: { type: string; count: number }[];
}

// 关键词检索合同条款
export function searchClauses(
  query: string,
  contracts: Contract[],
  risks: ContractRisk[]
): SearchResult[] {
  if (!query.trim()) return [];

  const queryLower = query.toLowerCase().trim();
  const results: SearchResult[] = [];

  for (const risk of risks) {
    const contract = contracts.find(c => c.id === risk.contract_id);
    if (!contract) continue;

    let similarity = 0;
    const clauseText = risk.clause_text.toLowerCase();
    const explanation = risk.risk_explanation.toLowerCase();
    const redline = (risk.suggested_redline || '').toLowerCase();

    // 精确匹配加分
    if (clauseText.includes(queryLower)) similarity += 40;
    if (explanation.includes(queryLower)) similarity += 30;
    if (redline.includes(queryLower)) similarity += 20;

    // 关键词分词匹配
    const queryWords = queryLower.split(/\s+/);
    for (const word of queryWords) {
      if (word.length < 2) continue;
      if (clauseText.includes(word)) similarity += 10;
      if (explanation.includes(word)) similarity += 8;
      if (redline.includes(word)) similarity += 5;
    }

    // 风险类型关键词匹配
    const riskTypeKeywords: Record<string, string[]> = {
      payment_risk: ['付款', '支付', '预付', '货款', '价款'],
      delivery_risk: ['交付', '验收', '发货', '交货', '运输'],
      breach_liability: ['违约', '违约金', '赔偿', '损失'],
      intellectual_property: ['知识产权', '专利', '商标', '著作权'],
      confidentiality: ['保密', '机密', '商业秘密'],
      dispute_resolution: ['争议', '仲裁', '诉讼', '管辖'],
      force_majeure: ['不可抗力'],
      termination: ['终止', '解除', '期满', '续签'],
      indemnification: ['赔偿', ' indemnif'],
      data_protection: ['数据', '隐私', '个人信息'],
      non_compete: ['竞业'],
      governing_law: ['适用法律', '管辖法律'],
    };

    for (const [type, keywords] of Object.entries(riskTypeKeywords)) {
      if (risk.risk_type === type) continue;
      if (keywords.some(kw => queryLower.includes(kw))) {
        similarity += 15;
      }
    }

    if (similarity > 0) {
      results.push({
        contract_id: risk.contract_id,
        contract_title: contract.contract_title || contract.filename,
        contract_type: contract.contract_type || '未分类',
        risk_type: risk.risk_type,
        clause_text: risk.clause_text,
        risk_explanation: risk.risk_explanation,
        suggested_redline: risk.suggested_redline || '',
        risk_level: risk.risk_level,
        similarity,
      });
    }
  }

  // 按相似度排序
  results.sort((a, b) => b.similarity - a.similarity);
  return results.slice(0, 20);
}

// 获取知识库统计信息
export function getKnowledgeBaseStats(
  contracts: Contract[],
  risks: ContractRisk[]
): KnowledgeBaseStats {
  const contractTypes = new Map<string, number>();
  for (const c of contracts) {
    const type = c.contract_type || '未分类';
    contractTypes.set(type, (contractTypes.get(type) || 0) + 1);
  }

  const riskTypes = new Map<string, number>();
  for (const r of risks) {
    riskTypes.set(r.risk_type, (riskTypes.get(r.risk_type) || 0) + 1);
  }

  return {
    total_contracts: contracts.length,
    total_risks: risks.length,
    total_clauses: risks.length,
    contract_types: Array.from(contractTypes.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count),
    risk_types: Array.from(riskTypes.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count),
  };
}

// 获取Mock知识库数据
export function getMockKnowledgeBase(): { contracts: Contract[]; risks: ContractRisk[] } {
  const contracts = getMockContracts();
  const risks = contracts.flatMap(c => getMockRisks(c.id));
  return { contracts, risks };
}

// 搜索建议（自动补全）
export function getSearchSuggestions(): string[] {
  return [
    '付款条款',
    '违约责任',
    '知识产权归属',
    '保密义务',
    '争议解决',
    '不可抗力',
    '合同终止',
    '交付验收',
    '预付款比例',
    '违约金计算',
    '竞业限制',
    '数据保护',
  ];
}
