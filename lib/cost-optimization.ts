// ===== 成本优化模块 =====
// 模型路由 + 提示缓存 + 用量统计

export type ModelTier = 'fast' | 'standard' | 'deep';

export interface ModelConfig {
  tier: ModelTier;
  model: string;
  cost_per_1k_input: number; // 美元
  cost_per_1k_output: number;
  max_tokens: number;
  use_case: string;
}

// 模型路由表
export const MODEL_ROUTING: Record<ModelTier, ModelConfig> = {
  fast: {
    tier: 'fast',
    model: 'claude-3-5-haiku-20241022',
    cost_per_1k_input: 0.0008,
    cost_per_1k_output: 0.004,
    max_tokens: 4000,
    use_case: '合同分类、简单条款提取、格式检查',
  },
  standard: {
    tier: 'standard',
    model: 'claude-3-5-sonnet-20241022',
    cost_per_1k_input: 0.003,
    cost_per_1k_output: 0.015,
    max_tokens: 8000,
    use_case: '风险识别、条款比对、修改建议',
  },
  deep: {
    tier: 'deep',
    model: 'claude-3-5-sonnet-20241022',
    cost_per_1k_input: 0.003,
    cost_per_1k_output: 0.015,
    max_tokens: 16000,
    use_case: '复杂合同深度审查、跨条款逻辑冲突检测',
  },
};

// 根据合同特征选择模型
export function selectModel(
  contractLength: number,
  contractType: string,
  hasHighRisk: boolean
): ModelConfig {
  // 短合同（<5K字符）且非高风险：用快速模型
  if (contractLength < 5000 && !hasHighRisk) {
    return MODEL_ROUTING.fast;
  }
  // 长合同（>50K字符）或高风险：用深度模型
  if (contractLength > 50000 || hasHighRisk) {
    return MODEL_ROUTING.deep;
  }
  // 默认：标准模型
  return MODEL_ROUTING.standard;
}

// ===== 用量统计 =====

export interface UsageRecord {
  id: string;
  date: string;
  contract_id: string;
  model_tier: ModelTier;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  cached: boolean;
}

export interface UsageStats {
  total_contracts: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cost_usd: number;
  estimated_cost_cny: number;
  cached_requests: number;
  cache_rate: number;
  monthly_projection: number;
  breakdown: { tier: ModelTier; count: number; cost: number }[];
}

// 计算单次调用成本
export function calculateCost(
  tier: ModelTier,
  inputTokens: number,
  outputTokens: number
): number {
  const config = MODEL_ROUTING[tier];
  return (inputTokens / 1000) * config.cost_per_1k_input + (outputTokens / 1000) * config.cost_per_1k_output;
}

// Mock用量数据
export function getMockUsageStats(): UsageStats {
  const records: UsageRecord[] = [
    { id: '1', date: '2026-08-20', contract_id: 'mock-001', model_tier: 'standard', model: 'claude-3-5-sonnet', input_tokens: 12000, output_tokens: 3000, cost_usd: 0.081, cached: false },
    { id: '2', date: '2026-08-19', contract_id: 'mock-002', model_tier: 'standard', model: 'claude-3-5-sonnet', input_tokens: 8000, output_tokens: 2000, cost_usd: 0.054, cached: true },
    { id: '3', date: '2026-08-18', contract_id: 'mock-003', model_tier: 'fast', model: 'claude-3-5-haiku', input_tokens: 4000, output_tokens: 1000, cost_usd: 0.007, cached: false },
    { id: '4', date: '2026-08-17', contract_id: 'mock-004', model_tier: 'deep', model: 'claude-3-5-sonnet', input_tokens: 45000, output_tokens: 6000, cost_usd: 0.225, cached: false },
    { id: '5', date: '2026-08-16', contract_id: 'mock-005', model_tier: 'standard', model: 'claude-3-5-sonnet', input_tokens: 15000, output_tokens: 3500, cost_usd: 0.097, cached: true },
    { id: '6', date: '2026-08-15', contract_id: 'mock-006', model_tier: 'fast', model: 'claude-3-5-haiku', input_tokens: 3500, output_tokens: 800, cost_usd: 0.006, cached: true },
    { id: '7', date: '2026-08-14', contract_id: 'mock-007', model_tier: 'standard', model: 'claude-3-5-sonnet', input_tokens: 10000, output_tokens: 2500, cost_usd: 0.067, cached: false },
  ];

  const totalInput = records.reduce((s, r) => s + r.input_tokens, 0);
  const totalOutput = records.reduce((s, r) => s + r.output_tokens, 0);
  const totalCost = records.reduce((s, r) => s + r.cost_usd, 0);
  const cached = records.filter(r => r.cached).length;

  const breakdown: { tier: ModelTier; count: number; cost: number }[] = [];
  for (const tier of ['fast', 'standard', 'deep'] as ModelTier[]) {
    const tierRecords = records.filter(r => r.model_tier === tier);
    breakdown.push({
      tier,
      count: tierRecords.length,
      cost: tierRecords.reduce((s, r) => s + r.cost_usd, 0),
    });
  }

  return {
    total_contracts: records.length,
    total_input_tokens: totalInput,
    total_output_tokens: totalOutput,
    total_cost_usd: totalCost,
    estimated_cost_cny: Math.round(totalCost * 7.2 * 100) / 100,
    cached_requests: cached,
    cache_rate: Math.round((cached / records.length) * 100),
    monthly_projection: Math.round((totalCost / 7 * 30) * 100) / 100,
    breakdown,
  };
}

// 提示缓存（避免重复发送相同的系统提示）
const promptCache = new Map<string, { prompt: string; timestamp: number }>();
const CACHE_TTL = 3600000; // 1小时

export function getCachedPrompt(key: string): string | null {
  const cached = promptCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.prompt;
  }
  promptCache.delete(key);
  return null;
}

export function setCachedPrompt(key: string, prompt: string): void {
  promptCache.set(key, { prompt, timestamp: Date.now() });
}
