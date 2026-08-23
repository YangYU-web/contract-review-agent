// ===== 高级数据可视化 - 图表数据模块 =====

import { ContractRisk, DashboardStats, RiskType, RISK_TYPE_LABELS } from './types';

// 风险类型对应的颜色映射（12种风险类型各分配一种颜色）
export const RISK_TYPE_COLORS: Record<RiskType, string> = {
  payment_risk: '#ef4444',          // 红色
  delivery_risk: '#f97316',         // 橙色
  breach_liability: '#f59e0b',      // 琥珀色
  intellectual_property: '#eab308', // 黄色
  confidentiality: '#84cc16',       // 靸檬绿
  dispute_resolution: '#22c55e',    // 绿色
  force_majeure: '#14b8a6',         // 青色
  termination: '#06b6d4',           // 天蓝色
  indemnification: '#3b82f6',       // 蓝色
  data_protection: '#6366f1',       // 靛蓝色
  non_compete: '#8b5cf6',           // 紫色
  governing_law: '#a855f7',         // 紫罗兰色
  other: '#64748b',                 // 灰色
};

// 合同类型颜色
const CONTRACT_TYPE_COLORS = [
  '#7c3aed', '#4f46e5', '#3b82f6', '#06b6d4',
  '#10b981', '#84cc16', '#f59e0b', '#ef4444',
];

// 风险分布数据
export interface RiskDistributionItem {
  label: string;
  value: number;
  color: string;
}

// 风险趋势数据
export interface RiskTrendItem {
  month: string;
  high: number;
  medium: number;
  low: number;
  total: number;
}

// 合同类型分布数据
export interface ContractTypeItem {
  type: string;
  count: number;
  percentage: number;
  color: string;
}

// 风险热力图数据
export interface RiskHeatmapItem {
  clause_type: string;
  risk_count: number;
  avg_severity: number;
}

// 审批流程数据
export interface ApprovalFlowItem {
  stage: string;
  count: number;
  avg_days: number;
}

// 评分分布数据
export interface ScoreDistributionItem {
  range: string;
  count: number;
  percentage: number;
}

// 月度综合摘要
export interface MonthlySummaryItem {
  month: string;
  contracts: number;
  avg_score: number;
  high_risks: number;
  resolved: number;
}

// 所有风险类型列表（用于遍历，保证返回12类风险）
const ALL_RISK_TYPES: RiskType[] = [
  'payment_risk', 'delivery_risk', 'breach_liability', 'intellectual_property',
  'confidentiality', 'dispute_resolution', 'force_majeure', 'termination',
  'indemnification', 'data_protection', 'non_compete', 'governing_law',
];

// 月份标签
const MONTH_LABELS = [
  '1月', '2月', '3月', '4月', '5月', '6月',
  '7月', '8月', '9月', '10月', '11月', '12月',
];

/**
 * 按风险类型统计分布，返回12类风险的分布数据
 */
export function getRiskDistributionData(risks: ContractRisk[]): RiskDistributionItem[] {
  // 初始化所有风险类型的计数为0
  const countMap: Record<string, number> = {};
  ALL_RISK_TYPES.forEach(type => {
    countMap[type] = 0;
  });

  // 统计传入风险数据
  risks.forEach(risk => {
    if (countMap[risk.risk_type] !== undefined) {
      countMap[risk.risk_type]++;
    } else {
      // 兜底处理 other 类型
      countMap['other'] = (countMap['other'] || 0) + 1;
    }
  });

  // 构造结果（仅返回有数据或前12类的标准类型）
  return ALL_RISK_TYPES.map(type => ({
    label: RISK_TYPE_LABELS[type] || type,
    value: countMap[type] || 0,
    color: RISK_TYPE_COLORS[type] || '#64748b',
  }));
}

/**
 * 返回12个月的风险趋势数据（模拟数据）
 */
export function getRiskTrendData(): RiskTrendItem[] {
  // 模拟12个月的风险趋势数据
  const mockData: Omit<RiskTrendItem, 'month'>[] = [
    { high: 8, medium: 15, low: 22, total: 45 },
    { high: 6, medium: 18, low: 25, total: 49 },
    { high: 12, medium: 20, low: 18, total: 50 },
    { high: 15, medium: 22, low: 30, total: 67 },
    { high: 10, medium: 19, low: 28, total: 57 },
    { high: 18, medium: 24, low: 32, total: 74 },
    { high: 14, medium: 21, low: 26, total: 61 },
    { high: 9, medium: 16, low: 24, total: 49 },
    { high: 11, medium: 23, low: 29, total: 63 },
    { high: 16, medium: 26, low: 34, total: 76 },
    { high: 13, medium: 20, low: 27, total: 60 },
    { high: 7, medium: 14, low: 21, total: 42 },
  ];

  return MONTH_LABELS.map((month, idx) => ({
    month,
    ...mockData[idx],
  }));
}

/**
 * 合同类型分布（采购、销售、服务等）
 */
export function getContractTypeDistribution(): ContractTypeItem[] {
  const types = [
    { type: '采购合同', count: 42 },
    { type: '销售合同', count: 35 },
    { type: '服务合同', count: 28 },
    { type: '租赁合同', count: 15 },
    { type: '劳动合同', count: 22 },
    { type: '技术开发合同', count: 18 },
    { type: '保密协议', count: 12 },
    { type: '其他合同', count: 8 },
  ];

  const total = types.reduce((sum, t) => sum + t.count, 0);

  return types.map((item, idx) => ({
    type: item.type,
    count: item.count,
    percentage: Math.round((item.count / total) * 100),
    color: CONTRACT_TYPE_COLORS[idx % CONTRACT_TYPE_COLORS.length],
  }));
}

/**
 * 条款-风险热力图数据
 */
export function getRiskHeatmapData(): RiskHeatmapItem[] {
  return [
    { clause_type: '付款条款', risk_count: 38, avg_severity: 78 },
    { clause_type: '交付条款', risk_count: 25, avg_severity: 62 },
    { clause_type: '违约责任', risk_count: 42, avg_severity: 85 },
    { clause_type: '知识产权', risk_count: 18, avg_severity: 55 },
    { clause_type: '保密条款', risk_count: 22, avg_severity: 48 },
    { clause_type: '争议解决', risk_count: 15, avg_severity: 40 },
    { clause_type: '不可抗力', risk_count: 8, avg_severity: 35 },
    { clause_type: '终止条款', risk_count: 20, avg_severity: 58 },
    { clause_type: '赔偿责任', risk_count: 30, avg_severity: 72 },
    { clause_type: '数据保护', risk_count: 12, avg_severity: 50 },
    { clause_type: '竞业限制', risk_count: 10, avg_severity: 45 },
    { clause_type: '管辖法律', risk_count: 14, avg_severity: 38 },
  ];
}

/**
 * 审批流程各阶段统计
 */
export function getApprovalFlowData(): ApprovalFlowItem[] {
  return [
    { stage: '法务专员', count: 180, avg_days: 1.2 },
    { stage: '法务经理', count: 145, avg_days: 2.5 },
    { stage: '法务总监', count: 98, avg_days: 3.8 },
    { stage: '业务部门', count: 76, avg_days: 2.1 },
    { stage: '总经理', count: 42, avg_days: 4.5 },
  ];
}

/**
 * 风险评分区间分布（0-20, 21-40, 41-60, 61-80, 81-100）
 */
export function getScoreDistribution(): ScoreDistributionItem[] {
  const distributions = [
    { range: '0-20', count: 35 },
    { range: '21-40', count: 68 },
    { range: '41-60', count: 92 },
    { range: '61-80', count: 54 },
    { range: '81-100', count: 23 },
  ];

  const total = distributions.reduce((sum, d) => sum + d.count, 0);

  return distributions.map(d => ({
    range: d.range,
    count: d.count,
    percentage: Math.round((d.count / total) * 100),
  }));
}

/**
 * 12个月综合摘要
 */
export function getMonthlySummary(): MonthlySummaryItem[] {
  const mockData: Omit<MonthlySummaryItem, 'month'>[] = [
    { contracts: 45, avg_score: 52, high_risks: 8, resolved: 38 },
    { contracts: 49, avg_score: 48, high_risks: 6, resolved: 42 },
    { contracts: 50, avg_score: 55, high_risks: 12, resolved: 41 },
    { contracts: 67, avg_score: 61, high_risks: 15, resolved: 55 },
    { contracts: 57, avg_score: 50, high_risks: 10, resolved: 49 },
    { contracts: 74, avg_score: 58, high_risks: 18, resolved: 62 },
    { contracts: 61, avg_score: 54, high_risks: 14, resolved: 52 },
    { contracts: 49, avg_score: 47, high_risks: 9, resolved: 43 },
    { contracts: 63, avg_score: 56, high_risks: 11, resolved: 54 },
    { contracts: 76, avg_score: 63, high_risks: 16, resolved: 65 },
    { contracts: 60, avg_score: 51, high_risks: 13, resolved: 50 },
    { contracts: 42, avg_score: 45, high_risks: 7, resolved: 38 },
  ];

  return MONTH_LABELS.map((month, idx) => ({
    month,
    ...mockData[idx],
  }));
}

/**
 * 根据风险等级获取颜色
 */
export function getSeverityColor(severity: number): string {
  if (severity >= 75) return '#dc2626'; // 高严重度 - 红色
  if (severity >= 50) return '#d97706'; // 中严重度 - 橙色
  if (severity >= 30) return '#eab308'; // 低中严重度 - 黄色
  return '#16a34a'; // 低严重度 - 绿色
}

/**
 * 根据热力图数值获取背景色（用于HeatMap渐变）
 */
export function getHeatColor(value: number, max: number): string {
  if (max === 0) return '#f8fafc';
  const ratio = Math.min(value / max, 1);
  // 从浅紫到深紫的渐变
  if (ratio < 0.2) return '#ede9fe';
  if (ratio < 0.4) return '#c4b5fd';
  if (ratio < 0.6) return '#a78bfa';
  if (ratio < 0.8) return '#7c3aed';
  return '#5b21b6';
}
