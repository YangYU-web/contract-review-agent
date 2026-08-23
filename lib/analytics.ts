// ===== 数据分析模块 =====
// 合同审查数据统计与分析

import { DashboardStats, RiskLevel, RiskType, RISK_TYPE_LABELS } from './types';
import { getMockContracts, getMockRisks } from './mock-data';

// 计算仪表盘统计数据
export function calculateDashboardStats(
  contracts: any[],
  risks: any[]
): DashboardStats {
  const total = contracts.length;
  const completed = contracts.filter(c => c.status === 'completed').length;
  const pending = contracts.filter(c => c.status === 'pending' || c.status === 'reviewing').length;

  const completedContracts = contracts.filter(c => c.status === 'completed');
  const avgScore = completedContracts.length > 0
    ? Math.round(completedContracts.reduce((sum, c) => sum + (c.risk_score || 0), 0) / completedContracts.length)
    : 0;

  const highRiskContracts = completedContracts.filter(c => (c.high_risk_count || 0) > 0).length;

  // 风险等级分布
  const riskLevels: RiskLevel[] = ['high', 'medium', 'low'];
  const riskDistribution = riskLevels.map(level => ({
    level,
    count: risks.filter(r => r.risk_level === level).length,
  }));

  // 风险类型分布
  const riskTypes: RiskType[] = [
    'payment_risk', 'delivery_risk', 'breach_liability', 'intellectual_property',
    'confidentiality', 'dispute_resolution', 'force_majeure', 'termination',
    'indemnification', 'data_protection', 'non_compete', 'governing_law', 'other',
  ];
  const riskTypeDistribution = riskTypes
    .map(type => ({ type, count: risks.filter(r => r.risk_type === type).length }))
    .filter(item => item.count > 0)
    .sort((a, b) => b.count - a.count);

  // 月度趋势（近6个月）
  const now = new Date();
  const monthlyTrend = [];
  for (let i = 5; i >= 0; i--) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthStr = monthDate.toLocaleDateString('zh-CN', { year: '2-digit', month: '2-digit' });
    const monthContracts = completedContracts.filter(c => {
      const cDate = new Date(c.created_at);
      return cDate.getFullYear() === monthDate.getFullYear() && cDate.getMonth() === monthDate.getMonth();
    });
    const avgScore = monthContracts.length > 0
      ? Math.round(monthContracts.reduce((s, c) => s + (c.risk_score || 0), 0) / monthContracts.length)
      : 0;
    monthlyTrend.push({
      month: monthStr,
      count: monthContracts.length,
      avg_score: avgScore,
    });
  }

  // Top风险类型
  const totalRisks = risks.length;
  const topRisks = riskTypeDistribution.slice(0, 5).map(item => ({
    ...item,
    percentage: totalRisks > 0 ? Math.round((item.count / totalRisks) * 100) : 0,
  }));

  return {
    total_contracts: total,
    completed_reviews: completed,
    pending_reviews: pending,
    avg_risk_score: avgScore,
    high_risk_contracts: highRiskContracts,
    risk_distribution: riskDistribution,
    risk_type_distribution: riskTypeDistribution,
    monthly_trend: monthlyTrend,
    top_risks: topRisks,
  };
}

// 获取Mock仪表盘数据
export function getMockDashboardStats(): DashboardStats {
  const contracts = getMockContracts();
  // 为每份mock合同生成风险数据
  const allRisks = contracts.flatMap(c => getMockRisks(c.id));
  // 添加更多历史数据使图表更丰富
  const extraContracts = [
    { ...getMockContracts()[0], id: 'mock-004', risk_score: 48, high_risk_count: 1, created_at: new Date(Date.now() - 86400000 * 10).toISOString() },
    { ...getMockContracts()[0], id: 'mock-005', risk_score: 72, high_risk_count: 3, created_at: new Date(Date.now() - 86400000 * 15).toISOString() },
    { ...getMockContracts()[1], id: 'mock-006', risk_score: 35, high_risk_count: 0, created_at: new Date(Date.now() - 86400000 * 20).toISOString() },
    { ...getMockContracts()[2], id: 'mock-007', risk_score: 58, high_risk_count: 1, created_at: new Date(Date.now() - 86400000 * 25).toISOString() },
  ];
  const allContracts = [...contracts, ...extraContracts];
  const extraRisks = extraContracts.flatMap(c => getMockRisks(c.id));
  return calculateDashboardStats(allContracts, [...allRisks, ...extraRisks]);
}
