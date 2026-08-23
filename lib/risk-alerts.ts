// ===== 风险趋势预警模块 =====
// 基于合同与风险数据生成预警、提供 Mock 数据及趋势变化计算
// 供预警 API 与预警仪表盘共用

import {
  RiskAlert,
  AlertSeverity,
  RiskTrendData,
  ALERT_SEVERITY_CONFIG,
} from './types';
import { Contract, ContractRisk, RISK_TYPE_LABELS } from './types';

// 预警状态排序权重（active 排前，resolved 排后）
const STATUS_ORDER: Record<string, number> = {
  active: 0,
  acknowledged: 1,
  resolved: 2,
};

// 严重程度排序权重（critical → warning → info）
const SEVERITY_ORDER: Record<AlertSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

// 生成距离今天指定天数的 ISO 时间字符串
function daysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

// 生成近6个月的标签（YYYY-MM）
function recentMonthLabels(count: number): string[] {
  const labels: string[] = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    labels.push(`${y}-${m}`);
  }
  return labels;
}

// ===== Mock 预警数据 =====
// 返回 5-6 条模拟预警，覆盖 critical / warning / info 与 active / acknowledged / resolved
export function getMockAlerts(): RiskAlert[] {
  return [
    {
      id: 'alert-001',
      severity: 'critical',
      status: 'active',
      title: '高风险合同占比超标',
      description:
        '近30天已完成审查的合同中，高风险合同占比达到45%，已超过30%的安全阈值，需重点关注合同质量与供应商资质。',
      metric: '高风险合同占比',
      threshold: 30,
      current_value: 45,
      trend: 'up',
      created_at: daysAgo(1),
    },
    {
      id: 'alert-002',
      severity: 'warning',
      status: 'active',
      title: '付款风险频繁出现',
      description:
        '近30天共发现 5 次付款相关风险，集中在预付款比例过高、付款条件不明确等问题，建议规范付款条款模板。',
      metric: '付款风险出现次数',
      threshold: 3,
      current_value: 5,
      trend: 'up',
      contract_title: 'XX产品采购合同',
      created_at: daysAgo(2),
    },
    {
      id: 'alert-003',
      severity: 'warning',
      status: 'acknowledged',
      title: '平均风险评分偏高',
      description:
        '近30天已完成合同的平均风险评分为 58 分，高于 50 分的告警线，建议加强高风险条款的预审流程。',
      metric: '平均风险评分',
      threshold: 50,
      current_value: 58,
      trend: 'stable',
      created_at: daysAgo(3),
    },
    {
      id: 'alert-004',
      severity: 'info',
      status: 'active',
      title: '合同审查平均耗时增加',
      description:
        '近30天合同平均审查耗时为 3.2 小时，较上期上升 12%，可能与新增复杂合同类型有关。',
      metric: '平均审查耗时(小时)',
      threshold: 3,
      current_value: 3.2,
      trend: 'up',
      created_at: daysAgo(4),
    },
    {
      id: 'alert-005',
      severity: 'info',
      status: 'resolved',
      title: '违约责任风险下降',
      description:
        '违约责任相关风险出现次数从上期的 4 次下降至本期的 2 次，已低于 3 次的关注阈值。',
      metric: '违约责任风险次数',
      threshold: 3,
      current_value: 2,
      trend: 'down',
      created_at: daysAgo(7),
      resolved_at: daysAgo(5),
    },
    {
      id: 'alert-006',
      severity: 'warning',
      status: 'resolved',
      title: '保密义务条款缺失',
      description:
        '部分服务合同未约定保密期限与违约赔偿条款，已通过模板规范修复，本周内未再发现此类问题。',
      metric: '保密条款缺失合同数',
      threshold: 2,
      current_value: 0,
      trend: 'down',
      created_at: daysAgo(12),
      resolved_at: daysAgo(9),
    },
  ];
}

// ===== Mock 趋势数据 =====
// 返回近6个月的风险趋势数据
export function getMockTrendData(): RiskTrendData[] {
  const labels = recentMonthLabels(6);
  return labels.map((period, idx) => {
    // 模拟一个随时间缓慢上升、后期回落的趋势
    const avgRiskScore = [38, 42, 48, 55, 62, 58][idx];
    const highRiskCount = [2, 3, 4, 5, 7, 6][idx];
    const totalContracts = [12, 15, 18, 20, 24, 22][idx];
    const topRiskTypes = [
      '交付风险',
      '付款风险',
      '付款风险',
      '违约责任',
      '付款风险',
      '违约责任',
    ];
    return {
      period,
      avg_risk_score: avgRiskScore,
      high_risk_count: highRiskCount,
      total_contracts: totalContracts,
      top_risk_type: topRiskTypes[idx],
    };
  });
}

// ===== 基于真实/演示数据生成预警 =====
// 分析合同与风险数据，自动生成预警
//  - 高风险合同占比 > 30% → critical
//  - 某类风险出现 > 3 次 → warning
//  - 平均风险评分 > 50 → warning
export function generateAlerts(
  contracts: Contract[],
  risks: ContractRisk[]
): RiskAlert[] {
  const alerts: RiskAlert[] = [];
  const now = new Date().toISOString();

  const completed = contracts.filter((c) => c.status === 'completed');

  // 1) 高风险合同占比
  if (completed.length > 0) {
    const highRiskContracts = completed.filter(
      (c) => (c.high_risk_count || 0) > 0
    ).length;
    const ratio = Math.round((highRiskContracts / completed.length) * 100);
    if (ratio > 30) {
      alerts.push({
        id: `alert-high-ratio-${Date.now()}`,
        severity: 'critical',
        status: 'active',
        title: '高风险合同占比超标',
        description: `已审查 ${completed.length} 份合同中有 ${highRiskContracts} 份含高风险，占比 ${ratio}%，已超过 30% 安全阈值。`,
        metric: '高风险合同占比(%)',
        threshold: 30,
        current_value: ratio,
        trend: 'up',
        created_at: now,
      });
    }
  }

  // 2) 某类风险出现次数 > 3
  const riskTypeCount: Record<string, number> = {};
  for (const r of risks) {
    riskTypeCount[r.risk_type] = (riskTypeCount[r.risk_type] || 0) + 1;
  }
  const frequentTypes = Object.entries(riskTypeCount).filter(
    ([, count]) => count > 3
  );
  for (const [type, count] of frequentTypes) {
    const label = RISK_TYPE_LABELS[type as keyof typeof RISK_TYPE_LABELS] || type;
    alerts.push({
      id: `alert-type-${type}-${Date.now()}`,
      severity: 'warning',
      status: 'active',
      title: `${label}频繁出现`,
      description: `近30天共发现 ${count} 次「${label}」，超过 3 次的关注阈值，建议核查相关合同条款并规范模板。`,
      metric: `${label}出现次数`,
      threshold: 3,
      current_value: count,
      trend: 'up',
      created_at: now,
    });
  }

  // 3) 平均风险评分 > 50
  if (completed.length > 0) {
    const scores = completed
      .map((c) => c.risk_score)
      .filter((s): s is number => typeof s === 'number');
    if (scores.length > 0) {
      const avgScore = Math.round(
        scores.reduce((sum, s) => sum + s, 0) / scores.length
      );
      if (avgScore > 50) {
        alerts.push({
          id: `alert-avg-score-${Date.now()}`,
          severity: 'warning',
          status: 'active',
          title: '平均风险评分偏高',
          description: `已审查合同的平均风险评分为 ${avgScore} 分，高于 50 分告警线，建议加强高风险条款预审。`,
          metric: '平均风险评分',
          threshold: 50,
          current_value: avgScore,
          trend: 'stable',
          created_at: now,
        });
      }
    }
  }

  return alerts;
}

// ===== 趋势变化计算 =====
// 对比当前值与上一周期值，返回变化量、方向与百分比
export function formatTrendChange(
  current: number,
  previous: number
): { value: number; direction: 'up' | 'down' | 'stable'; percentage: number } {
  const value = current - previous;
  let direction: 'up' | 'down' | 'stable' = 'stable';
  if (value > 0) direction = 'up';
  else if (value < 0) direction = 'down';

  const base = Math.abs(previous);
  const percentage =
    base === 0
      ? current === 0
        ? 0
        : 100
      : Math.round((Math.abs(value) / base) * 100);

  return { value, direction, percentage };
}

// ===== 排序工具 =====
// 按严重程度升序、再按状态升序、最后按创建时间倒序
export function sortAlerts(alerts: RiskAlert[]): RiskAlert[] {
  return [...alerts].sort((a, b) => {
    const sev = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (sev !== 0) return sev;
    const st = (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9);
    if (st !== 0) return st;
    return (
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  });
}

// 重新导出配置，方便页面统一引用
export { ALERT_SEVERITY_CONFIG };
