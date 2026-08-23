// ===== AI 智能定价分析模块 =====
// 基于市场基准价格对合同单价进行偏离度分析，识别定价影响因素
// 提供市场基准、历史价格趋势、定价统计与 Mock 数据
// 供定价 API 与定价分析页面共用

import {
  PricingAnalysis,
  MarketBenchmark,
  PricingFactor,
  PriceComparison,
  PRICE_COMPARISON_CONFIG,
} from './types';

// ===== 市场基准价格配置 =====
// 按合同类型维护一份模拟市场基准（单价基线、波动范围、样本数）
interface BenchmarkTemplate {
  contractType: string;
  contractTypeLabel: string;
  unit: string; // 计价单位
  basePrice: number; // 市场平均单价
  spread: number; // 市场价格区间半宽（min = base - spread, max = base + spread）
  sampleCount: number;
  source: string;
}

const BENCHMARK_TEMPLATES: BenchmarkTemplate[] = [
  {
    contractType: '采购合同',
    contractTypeLabel: '采购合同',
    unit: '件',
    basePrice: 580,
    spread: 120,
    sampleCount: 128,
    source: '行业采购价格指数 2026Q2',
  },
  {
    contractType: '服务合同',
    contractTypeLabel: '服务合同',
    unit: '人天',
    basePrice: 1800,
    spread: 450,
    sampleCount: 96,
    source: '人力资源服务报价调研 2026',
  },
  {
    contractType: '租赁合同',
    contractTypeLabel: '租赁合同',
    unit: '㎡/月',
    basePrice: 95,
    spread: 35,
    sampleCount: 212,
    source: '商业地产租金月报 2026-08',
  },
  {
    contractType: '技术开发合同',
    contractTypeLabel: '技术开发合同',
    unit: '人月',
    basePrice: 25000,
    spread: 6500,
    sampleCount: 74,
    source: '软件外包开发报价基准 2026',
  },
  {
    contractType: '咨询服务合同',
    contractTypeLabel: '咨询服务合同',
    unit: '人天',
    basePrice: 3200,
    spread: 800,
    sampleCount: 58,
    source: '管理咨询费率调研 2026',
  },
];

// 默认市场基准（合同类型未命中时使用）
const DEFAULT_TEMPLATE: BenchmarkTemplate = {
  contractType: '其他',
  contractTypeLabel: '其他',
  unit: '项',
  basePrice: 1000,
  spread: 250,
  sampleCount: 40,
  source: '通用合同价格基准 2026',
};

// 查找指定合同类型的基准模板
function findTemplate(contractType: string): BenchmarkTemplate {
  return (
    BENCHMARK_TEMPLATES.find(
      (t) =>
        t.contractType === contractType ||
        t.contractTypeLabel === contractType ||
        contractType.includes(t.contractType)
    ) || DEFAULT_TEMPLATE
  );
}

// 生成距离今天指定天数的 ISO 时间字符串
function daysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

// ===== 市场基准 =====
// 根据合同类型返回模拟市场基准价格
export function getMarketBenchmark(contractType: string): MarketBenchmark {
  const tpl = findTemplate(contractType);
  const minPrice = Math.round(tpl.basePrice - tpl.spread);
  const maxPrice = Math.round(tpl.basePrice + tpl.spread);
  // 中位价略低于均价（模拟右偏分布）
  const medianPrice = Math.round(tpl.basePrice - tpl.spread * 0.05);
  const avgPrice = Math.round(tpl.basePrice + tpl.spread * 0.08);
  return {
    min_price: minPrice,
    max_price: maxPrice,
    avg_price: avgPrice,
    median_price: medianPrice,
    sample_count: tpl.sampleCount,
    source: tpl.source,
    last_updated: daysAgo(3),
  };
}

// ===== 历史价格趋势 =====
// 返回 7 个历史价格点（最近 7 个月），价格围绕基线小幅波动
export function getMockHistoricalPrices(
  contractType: string
): { date: string; price: number; source: string }[] {
  const tpl = findTemplate(contractType);
  // 7 个月的波动系数（模拟小幅上行趋势 + 季节性波动）
  const coefficients = [0.94, 0.97, 1.0, 0.98, 1.03, 1.06, 1.09];
  const sources = [
    '行业价格指数',
    '招标平台均价',
    '供应商报价',
    '采购调研',
    '行业价格指数',
    '招标平台均价',
    '供应商报价',
  ];
  const now = new Date();
  const result: { date: string; price: number; source: string }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const coef = coefficients[6 - i];
    result.push({
      date: `${y}-${m}`,
      price: Math.round(tpl.basePrice * coef),
      source: sources[6 - i],
    });
  }
  return result;
}

// ===== 定价因素识别 =====
// 根据合同类型与偏离度生成影响定价的因素清单
export function getPricingFactors(
  contractType: string,
  deviation: number
): PricingFactor[] {
  const factors: PricingFactor[] = [];
  const absDeviation = Math.abs(deviation);

  // 数量折扣：偏离越低越可能因量大获得折扣
  factors.push({
    name: '数量折扣',
    impact:
      deviation < -5 ? 'positive' : deviation > 10 ? 'negative' : 'neutral',
    description:
      deviation < -5
        ? '采购数量较大，获得供应商批量折扣，单价低于市场均值。'
        : deviation > 10
        ? '采购数量偏小，未达到批量折扣门槛，单价偏高。'
        : '采购量处于常规区间，未触发明显的批量折扣。',
    weight: deviation < -5 ? 0.25 : deviation > 10 ? 0.2 : 0.1,
  });

  // 付款条件：预付比例与账期影响
  factors.push({
    name: '付款条件',
    impact:
      deviation < -3 ? 'positive' : deviation > 8 ? 'negative' : 'neutral',
    description:
      deviation < -3
        ? '采用高比例预付 / 短账期，获得供应商价格让利。'
        : deviation > 8
        ? '付款账期较长或分期较多，供应商提高单价以覆盖资金成本。'
        : '付款条件中规中矩，对单价影响有限。',
    weight: 0.18,
  });

  // 市场波动
  factors.push({
    name: '市场行情',
    impact: absDeviation > 8 ? 'negative' : 'neutral',
    description:
      absDeviation > 8
        ? '近期市场价格波动较大，需关注签约时点与锁价机制。'
        : '近期市场价格平稳，偏离主要源于非市场因素。',
    weight: 0.15,
  });

  // 合作伙伴关系
  factors.push({
    name: '合作伙伴关系',
    impact: deviation < -2 ? 'positive' : deviation > 8 ? 'negative' : 'neutral',
    description:
      deviation < -2
        ? '与供应商建立长期战略合作，获得稳定优惠定价。'
        : deviation > 8
        ? '为新合作关系，缺乏历史合作基础，议价空间有限。'
        : '合作关系处于常规水平，定价接近市场基准。',
    weight: 0.14,
  });

  // 合同类型相关因素
  if (contractType.includes('采购') || contractType.includes('租赁')) {
    factors.push({
      name: '交付周期',
      impact: deviation > 10 ? 'negative' : 'neutral',
      description:
        deviation > 10
          ? '要求加急交付，供应商加收加急费用推高单价。'
          : '交付周期正常，未产生额外加急成本。',
      weight: 0.1,
    });
  }
  if (contractType.includes('服务') || contractType.includes('技术开发')) {
    factors.push({
      name: '服务等级（SLA）',
      impact: deviation > 8 ? 'negative' : 'neutral',
      description:
        deviation > 8
          ? '约定较高响应等级与驻场服务，对应更高人月单价。'
          : '服务等级为常规标准，单价与市场一致。',
      weight: 0.13,
    });
  }

  return factors;
}

// ===== 偏离度计算 =====
// 返回偏离百分比（正数高于市场，负数低于市场），基于市场中位价
function calcDeviation(unitPrice: number, benchmark: MarketBenchmark): number {
  const base = benchmark.median_price || benchmark.avg_price;
  if (!base) return 0;
  return Math.round(((unitPrice - base) / base) * 1000) / 10;
}

// ===== 比较结果判定 =====
// ±5% 以内为 at_market，低于 -5% 为 below_market，高于 +5% 为 above_market
function classifyComparison(deviation: number): PriceComparison {
  if (deviation <= -5) return 'below_market';
  if (deviation >= 5) return 'above_market';
  return 'at_market';
}

// ===== 生成分析文本与建议 =====
function buildAnalysisText(
  contractTitle: string,
  contractType: string,
  unitPrice: number,
  unit: string,
  benchmark: MarketBenchmark,
  deviation: number,
  comparison: PriceComparison
): { analysis: string; recommendation: string } {
  let analysis = '';
  let recommendation = '';

  if (comparison === 'below_market') {
    analysis = `「${contractTitle}」的${contractType}单价为 ${unitPrice} 元/${unit}，较市场中位价 ${benchmark.median_price} 元/${unit} 低 ${Math.abs(deviation)}%。当前价格处于市场低位，在样本量 ${benchmark.sample_count} 的比对中具有明显价格优势。低价可能源于批量采购折扣、付款条件让利或供应商争取合作机会，但也需核实是否存在质量或服务等级折让。`;
    recommendation = `建议：1) 核实低价是否伴随服务等级 / 交付标准的降低；2) 在合同中明确质量验收标准与违约责任以对冲低价风险；3) 锁定该价格的有效期限，避免后续涨价；4) 关注供应商履约能力，必要时设置分阶段付款。`;
  } else if (comparison === 'above_market') {
    analysis = `「${contractTitle}」的${contractType}单价为 ${unitPrice} 元/${unit}，较市场中位价 ${benchmark.median_price} 元/${unit} 高 ${deviation}%。当前价格高于市场均值，可能源于供应商资质溢价、加急交付、高等级 SLA 或付款账期较长等因素。需结合业务必要性与可替代供应商情况综合评估。`;
    recommendation = `建议：1) 引入 2-3 家供应商进行比价，验证溢价的合理性；2) 评估高单价对应的服务等级是否为业务必需；3) 谈判调整付款条件以换取价格让利；4) 若溢价过高且无合理支撑，考虑更换供应商或重新招标。`;
  } else {
    analysis = `「${contractTitle}」的${contractType}单价为 ${unitPrice} 元/${unit}，较市场中位价 ${benchmark.median_price} 元/${unit} 偏离 ${deviation}%，处于市场合理区间（±5%）。定价与市场水平基本一致，具备公允性，无需重点调整。`;
    recommendation = `建议：1) 保持当前定价方案；2) 关注后续市场价格波动，设置定期复核机制；3) 在合同中约定价格调整条款以应对原材料 / 人力成本变化。`;
  }

  return { analysis, recommendation };
}

// ===== 主分析函数 =====
// 输入合同信息，输出完整的定价分析结果
export function analyzePricing(
  contractValue: number,
  currency: string,
  contractType: string,
  unitPrice: number,
  unit: string,
  contractId: string,
  contractTitle: string
): PricingAnalysis {
  const benchmark = getMarketBenchmark(contractType);
  const deviation = calcDeviation(unitPrice, benchmark);
  const comparison = classifyComparison(deviation);
  const factors = getPricingFactors(contractType, deviation);
  const historicalPrices = getMockHistoricalPrices(contractType);
  const { analysis, recommendation } = buildAnalysisText(
    contractTitle,
    contractType,
    unitPrice,
    unit,
    benchmark,
    deviation,
    comparison
  );

  // 置信度：基于样本量与数据时效综合评估
  // 样本越充足、偏离幅度越明显，置信度越高
  const sampleFactor = Math.min(benchmark.sample_count / 150, 1);
  const deviationFactor = Math.min(Math.abs(deviation) / 30, 1);
  const confidence = Math.round((0.55 + 0.25 * sampleFactor + 0.2 * deviationFactor) * 100);

  return {
    contract_id: contractId,
    contract_title: contractTitle,
    contract_type: contractType,
    contract_value: contractValue,
    currency: currency || 'CNY',
    unit_price: unitPrice,
    unit,
    market_benchmark: benchmark,
    comparison,
    deviation_percentage: deviation,
    analysis,
    recommendation,
    confidence,
    factors,
    historical_prices: historicalPrices,
  };
}

// ===== Mock 定价分析数据 =====
// 返回 5 个覆盖不同合同类型与比较结果的模拟分析
export function getMockPricingAnalyses(): PricingAnalysis[] {
  return [
    analyzePricing(
      1160000,
      'CNY',
      '采购合同',
      510,
      '件',
      'CON-2026-0301',
      '办公设备批量采购合同'
    ),
    analyzePricing(
      432000,
      'CNY',
      '服务合同',
      1600,
      '人天',
      'CON-2026-0302',
      'IT运维外包服务合同'
    ),
    analyzePricing(
      684000,
      'CNY',
      '租赁合同',
      95,
      '㎡/月',
      'CON-2026-0303',
      '研发中心办公场地租赁合同'
    ),
    analyzePricing(
      875000,
      'CNY',
      '技术开发合同',
      27500,
      '人月',
      'CON-2026-0304',
      '数据分析平台定制开发合同'
    ),
    analyzePricing(
      38400,
      'CNY',
      '咨询服务合同',
      3400,
      '人天',
      'CON-2026-0305',
      '战略咨询专项服务合同'
    ),
  ];
}

// ===== 定价统计 =====
// 汇总分析列表的比较结果分布、平均偏离度与潜在节约金额
export function getPricingStats(analyses: PricingAnalysis[]): {
  total: number;
  belowMarket: number;
  atMarket: number;
  aboveMarket: number;
  avgDeviation: number;
  potentialSavings: number;
} {
  const total = analyses.length;
  if (total === 0) {
    return {
      total: 0,
      belowMarket: 0,
      atMarket: 0,
      aboveMarket: 0,
      avgDeviation: 0,
      potentialSavings: 0,
    };
  }
  const belowMarket = analyses.filter((a) => a.comparison === 'below_market').length;
  const atMarket = analyses.filter((a) => a.comparison === 'at_market').length;
  const aboveMarket = analyses.filter((a) => a.comparison === 'above_market').length;
  const avgDeviation =
    Math.round(
      (analyses.reduce((sum, a) => sum + a.deviation_percentage, 0) / total) * 10
    ) / 10;

  // 潜在节约金额：高于市场的合同，若将单价调整至市场中位价可节省的金额
  // 节约 = (单价 - 中位价) × 数量；数量 = 合同金额 / 单价
  const potentialSavings = analyses.reduce((sum, a) => {
    if (a.comparison !== 'above_market') return sum;
    const quantity = a.unit_price > 0 ? a.contract_value / a.unit_price : 0;
    const diff = a.unit_price - a.market_benchmark.median_price;
    return sum + Math.max(0, diff * quantity);
  }, 0);

  return {
    total,
    belowMarket,
    atMarket,
    aboveMarket,
    avgDeviation,
    potentialSavings: Math.round(potentialSavings),
  };
}

// 重新导出配置，方便页面统一引用
export { PRICE_COMPARISON_CONFIG };
