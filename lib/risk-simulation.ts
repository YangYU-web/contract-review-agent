// ===== 合同风险模拟模块 =====
// 基于蒙特卡洛 / 压力测试 / 最差情景等场景对合同损失进行概率模拟
// 提供模拟数据、运行模拟、统计汇总与风险因子生成，供模拟 API 与模拟页面共用

import {
  RiskSimulation,
  SimulationSummary,
  SimulationRiskFactor,
  ScenarioResult,
  ValueAtRisk,
  SimulationScenario,
  RiskCategory,
  SIMULATION_SCENARIO_LABELS,
  RISK_CATEGORY_LABELS,
} from './types';

// ===== 工具函数 =====

// 字符串哈希（用于生成确定性种子）
function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h) + 1;
}

// 线性同余生成器（LCG），返回 [0,1) 伪随机数
function seededRandom(seed: number): () => number {
  let state = seed % 4294967296;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

// Box-Muller 变换生成正态分布随机数
function normalRandom(
  rng: () => number,
  mean: number,
  std: number
): number {
  let u1 = rng();
  while (u1 === 0) u1 = rng(); // 避免 log(0)
  const u2 = rng();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z * std;
}

// 金额简短格式化（用于分布区间标签）
function formatAmountShort(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 100000000) return (v / 100000000).toFixed(2) + '亿';
  if (abs >= 10000) return (v / 10000).toFixed(1) + '万';
  return Math.round(v).toLocaleString('zh-CN');
}

// ===== 场景参数配置 =====
// 不同场景下损失均值占比（相对合同敞口）与标准差比例
const SCENARIO_PARAMS: Record<
  SimulationScenario,
  { lossRatio: number; stdRatio: number }
> = {
  best_case: { lossRatio: 0.03, stdRatio: 0.5 },
  base_case: { lossRatio: 0.08, stdRatio: 0.6 },
  worst_case: { lossRatio: 0.18, stdRatio: 0.7 },
  stress_test: { lossRatio: 0.15, stdRatio: 0.9 },
  monte_carlo: { lossRatio: 0.07, stdRatio: 0.75 },
};

// 从合同标题推断合同类型（runSimulation 仅接收标题，据此生成针对性风险因子）
function inferContractType(title: string): string {
  if (/采购|供应|供货/.test(title)) return '采购合同';
  if (/服务|外包/.test(title)) return '服务合同';
  if (/租赁|租金/.test(title)) return '租赁合同';
  if (/技术开发|研发/.test(title)) return '技术开发合同';
  if (/咨询/.test(title)) return '咨询服务合同';
  if (/人力|劳动/.test(title)) return '人力资源服务合同';
  return '通用合同';
}

// ===== 风险因子生成 =====
// 依据合同类型生成 6 个跨类别的风险因子，并针对首要类别进行类型化调整
export function generateRiskFactors(
  contractType: string
): SimulationRiskFactor[] {
  // 6 类基础风险因子（权重之和为 1）
  const base: {
    category: RiskCategory;
    name: string;
    probability: number;
    impact: number;
    weight: number;
    description: string;
    mitigation: string;
  }[] = [
    {
      category: 'financial',
      name: '汇率与利率波动',
      probability: 0.35,
      impact: 0.4,
      weight: 0.2,
      description: '汇率与利率波动影响合同实际成本与收益，跨境或长期合同尤为敏感。',
      mitigation: '采用远期结售汇或利率互换工具对冲，并在合同中约定汇率分摊机制。',
    },
    {
      category: 'operational',
      name: '交付或履约延误',
      probability: 0.25,
      impact: 0.5,
      weight: 0.18,
      description: '交付或履约进度延误导致额外成本与连锁违约风险。',
      mitigation: '设置里程碑考核节点与逾期违约金，关键路径预留缓冲。',
    },
    {
      category: 'legal',
      name: '条款合规瑕疵',
      probability: 0.2,
      impact: 0.6,
      weight: 0.17,
      description: '合同条款存在合规瑕疵、效力风险或举证困难。',
      mitigation: '法务前置审查并引用标准条款库，关键条款附加取证要求。',
    },
    {
      category: 'market',
      name: '市场价格波动',
      probability: 0.4,
      impact: 0.45,
      weight: 0.15,
      description: '市场价格波动影响合同定价合理性与履约经济性。',
      mitigation: '设置价格调整机制与涨跌幅上限，定期对标市场基准。',
    },
    {
      category: 'counterparty',
      name: '对手方信用恶化',
      probability: 0.15,
      impact: 0.7,
      weight: 0.18,
      description: '对手方信用评级下降、财务恶化或涉诉导致违约风险上升。',
      mitigation: '要求担保或保证金，并定期跟踪对手方资信与经营状况。',
    },
    {
      category: 'force_majeure',
      name: '不可抗力事件',
      probability: 0.05,
      impact: 0.9,
      weight: 0.12,
      description: '自然灾害、政策变化或公共卫生事件等不可抗力影响履约。',
      mitigation: '完善不可抗力条款与通知义务，制定业务连续性预案。',
    },
  ];

  // 按合同类型对首要风险因子进行类型化覆盖
  const overrides: Record<
    string,
    { idx: number; name: string; description: string; probability: number; impact: number }
  > = {
    采购合同: {
      idx: 3,
      name: '原材料与供应链价格波动',
      description: '原材料价格与供应链波动直接影响采购成本与交付稳定性。',
      probability: 0.45,
      impact: 0.5,
    },
    服务合同: {
      idx: 1,
      name: '服务交付质量与进度风险',
      description: '服务质量不达标或进度滞后引发返工与赔偿。',
      probability: 0.3,
      impact: 0.55,
    },
    租赁合同: {
      idx: 3,
      name: '租金市场价格波动',
      description: '租赁市场价格波动影响续租定价与空置成本。',
      probability: 0.35,
      impact: 0.4,
    },
    技术开发合同: {
      idx: 2,
      name: '知识产权归属与侵权风险',
      description: '成果归属约定不明或第三方侵权主张导致权属与赔偿风险。',
      probability: 0.25,
      impact: 0.7,
    },
    咨询服务合同: {
      idx: 1,
      name: '交付成果质量与验收争议',
      description: '咨询成果质量与验收标准争议导致付款与履约纠纷。',
      probability: 0.28,
      impact: 0.5,
    },
    人力资源服务合同: {
      idx: 2,
      name: '用工合规与劳动关系风险',
      description: '劳务派遣或灵活用工被认定为事实劳动关系的合规风险。',
      probability: 0.22,
      impact: 0.65,
    },
  };

  const override = overrides[contractType];
  const factors = base.map((f, idx) => {
    if (override && idx === override.idx) {
      return {
        ...f,
        name: override.name,
        description: override.description,
        probability: override.probability,
        impact: override.impact,
      };
    }
    return f;
  });

  return factors.map((f, idx) => ({
    id: `rf-${idx + 1}`,
    category: f.category,
    name: f.name,
    probability: f.probability,
    impact: f.impact,
    weight: f.weight,
    description: f.description,
    mitigation: f.mitigation,
  }));
}

// ===== 子情景结果生成 =====
// 生成 5 个命名子情景的概率与损失预估
function generateScenarioResults(
  mean: number,
  maxLoss: number
): ScenarioResult[] {
  const cap = (v: number) => Math.min(Math.round(v), Math.round(maxLoss));
  return [
    {
      scenario: '乐观情景',
      probability: 0.2,
      loss: cap(mean * 0.3),
      description: '对手方履约顺利，市场与外部环境有利，损失显著低于预期。',
    },
    {
      scenario: '基准情景',
      probability: 0.5,
      loss: cap(mean),
      description: '按当前条件正常履约，损失接近模拟期望值。',
    },
    {
      scenario: '悲观情景',
      probability: 0.2,
      loss: cap(mean * 1.6),
      description: '出现单一重大风险事件，损失高于预期但可控。',
    },
    {
      scenario: '极端情景',
      probability: 0.08,
      loss: cap(mean * 2.2),
      description: '多个风险因子叠加触发，损失接近尾部区间。',
    },
    {
      scenario: '尾部情景',
      probability: 0.02,
      loss: cap(mean * 2.8),
      description: '小概率极端事件叠加对手方违约，损失触及模拟上限。',
    },
  ];
}

// ===== 建议生成 =====
// 基于模拟结果生成针对性风险缓释建议
function generateRecommendations(
  probLoss: number,
  expectedLoss: number,
  var95: number,
  maxLoss: number,
  scenario: SimulationScenario
): string[] {
  const recs: string[] = [];

  if (probLoss > 0.5) {
    recs.push(
      '损失发生概率较高，建议在合同中强化违约金、担保与抵销条款以转移风险。'
    );
  }
  if (var95 > expectedLoss * 1.5) {
    recs.push(
      '尾部风险敞口显著（VaR95 显著高于期望损失），建议购买商业保险或设置损失上限条款。'
    );
  }
  if (maxLoss > 1000000) {
    recs.push(
      '最大单次损失超过百万级，建议分拆履约批次或引入第三方担保以分散敞口。'
    );
  }
  if (scenario === 'stress_test' || scenario === 'worst_case') {
    recs.push(
      '当前为压力 / 最差情景，建议结合基准情景制定分级应急预案与触发条件。'
    );
  }
  // 基础建议（确保不少于 3 条）
  recs.push('建立风险因子监控看板，对概率或影响超阈值的因子设置预警。');
  recs.push('定期复跑模拟并对比历史结果，持续校准风险因子权重与参数。');

  return recs.slice(0, 4);
}

// ===== 运行模拟 =====
// 基于合同信息与场景生成模拟结果：使用伪随机正态分布生成损失样本，
// 构建分布直方图并计算 VaR / CVaR 等指标
export function runSimulation(
  contractId: string,
  contractTitle: string,
  scenario: SimulationScenario,
  iterations: number
): RiskSimulation {
  const params = SCENARIO_PARAMS[scenario];
  const exposureSeed = hashString(contractId);
  // 合同名义敞口（80 万 - 500 万）
  const exposure = 800000 + (exposureSeed % 4200000);

  const mean = exposure * params.lossRatio;
  const std = mean * params.stdRatio;

  const rng = seededRandom(hashString(contractId + '|' + scenario));
  // 生成损失样本（非负，0 表示未发生损失）
  const samples: number[] = [];
  for (let i = 0; i < iterations; i++) {
    samples.push(Math.max(0, normalRandom(rng, mean, std)));
  }

  // ===== 基础统计量 =====
  const sum = samples.reduce((s, v) => s + v, 0);
  const expectedLoss = sum / iterations;
  let minLoss = samples[0];
  let maxLoss = samples[0];
  for (const v of samples) {
    if (v < minLoss) minLoss = v;
    if (v > maxLoss) maxLoss = v;
  }
  const variance =
    samples.reduce((s, v) => s + (v - expectedLoss) ** 2, 0) / iterations;
  const stdDeviation = Math.sqrt(variance);
  const lossCount = samples.filter((v) => v > 0).length;
  const probabilityOfLoss = lossCount / iterations;
  // 期望净损失（按发生概率加权）
  const expectedValue = expectedLoss * probabilityOfLoss;
  // 均值的 95% 置信区间
  const ci = (1.96 * stdDeviation) / Math.sqrt(iterations);

  const summary: SimulationSummary = {
    expected_loss: Math.round(expectedLoss),
    max_loss: Math.round(maxLoss),
    min_loss: Math.round(minLoss),
    std_deviation: Math.round(stdDeviation),
    probability_of_loss: probabilityOfLoss,
    expected_value: Math.round(expectedValue),
    confidence_interval: {
      lower: Math.round(expectedLoss - ci),
      upper: Math.round(expectedLoss + ci),
      level: 95,
    },
  };

  // ===== VaR / CVaR 计算 =====
  const sorted = [...samples].sort((a, b) => a - b);
  const idx95 = Math.min(Math.floor(iterations * 0.95), iterations - 1);
  const idx99 = Math.min(Math.floor(iterations * 0.99), iterations - 1);
  const var95 = sorted[idx95];
  const var99 = sorted[idx99];
  const tail95 = sorted.slice(idx95);
  const tail99 = sorted.slice(idx99);
  const cvar95 = tail95.length
    ? tail95.reduce((s, v) => s + v, 0) / tail95.length
    : var95;
  const cvar99 = tail99.length
    ? tail99.reduce((s, v) => s + v, 0) / tail99.length
    : var99;

  const varAnalysis: ValueAtRisk = {
    var_95: Math.round(var95),
    var_99: Math.round(var99),
    cvar_95: Math.round(cvar95),
    cvar_99: Math.round(cvar99),
    max_drawdown: Math.round(maxLoss),
  };

  // ===== 分布直方图（9 个区间）=====
  const bucketCount = 9;
  const ceiling = maxLoss || 1;
  const width = ceiling / bucketCount;
  const distribution = [];
  for (let b = 0; b < bucketCount; b++) {
    const low = b * width;
    const high = b === bucketCount - 1 ? ceiling : low + width;
    const count = samples.filter(
      (v) => v >= low && (b === bucketCount - 1 ? v <= high : v < high)
    ).length;
    distribution.push({
      range: `${formatAmountShort(low)} - ${formatAmountShort(high)}`,
      probability: count / iterations,
      count,
    });
  }

  // ===== 风险因子 / 子情景 / 建议 =====
  const contractType = inferContractType(contractTitle);
  const riskFactors = generateRiskFactors(contractType);
  const scenarioResults = generateScenarioResults(expectedLoss, maxLoss);
  const recommendations = generateRecommendations(
    probabilityOfLoss,
    expectedLoss,
    var95,
    maxLoss,
    scenario
  );

  return {
    id: `sim-${Date.now().toString(36)}-${hashString(
      contractId + scenario
    ).toString(36)}`,
    contract_id: contractId,
    contract_title: contractTitle,
    scenario,
    iterations,
    generated_at: new Date().toISOString(),
    summary,
    risk_factors: riskFactors,
    scenario_results: scenarioResults,
    distribution,
    var_analysis: varAnalysis,
    recommendations,
  };
}

// ===== Mock 模拟数据 =====
// 返回 4 条针对不同合同的模拟，覆盖 monte_carlo / stress_test / worst_case 场景
export function getMockRiskSimulations(): RiskSimulation[] {
  return [
    runSimulation(
      'CON-2026-0401',
      'XX产品采购合同',
      'monte_carlo',
      1000
    ),
    runSimulation(
      'CON-2026-0312',
      '云服务外包协议',
      'stress_test',
      2000
    ),
    runSimulation(
      'CON-2026-0228',
      '办公场地租赁合同',
      'worst_case',
      1000
    ),
    runSimulation(
      'CON-2026-0510',
      '技术开发合作协议',
      'monte_carlo',
      5000
    ),
  ];
}

// ===== 模拟统计 =====
// 汇总模拟列表的统计：总数、平均期望损失、最大损失、平均损失概率、VaR95 合计
export function getSimulationStats(simulations: RiskSimulation[]): {
  total: number;
  avgExpectedLoss: number;
  maxLoss: number;
  avgProbabilityOfLoss: number;
  totalVaR95: number;
} {
  const n = simulations.length || 1;
  const avgExpectedLoss =
    simulations.reduce((s, sim) => s + sim.summary.expected_loss, 0) / n;
  const maxLoss = simulations.reduce(
    (max, sim) => Math.max(max, sim.summary.max_loss),
    0
  );
  const avgProb =
    (simulations.reduce((s, sim) => s + sim.summary.probability_of_loss, 0) /
      n) *
    100; // 转为百分比
  const totalVaR95 = simulations.reduce(
    (s, sim) => s + sim.var_analysis.var_95,
    0
  );

  return {
    total: simulations.length,
    avgExpectedLoss: Math.round(avgExpectedLoss),
    maxLoss: Math.round(maxLoss),
    avgProbabilityOfLoss: Math.round(avgProb),
    totalVaR95: Math.round(totalVaR95),
  };
}

// 重新导出标签，方便页面统一引用
export { SIMULATION_SCENARIO_LABELS, RISK_CATEGORY_LABELS };
