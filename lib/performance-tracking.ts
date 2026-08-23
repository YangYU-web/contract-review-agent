// ===== 合同履约监控 =====
// 提供履约追踪、KPI 监控、里程碑管理、义务跟踪与预警能力
// 供履约监控 API 与履约监控页面共用

import {
  PerformanceTracker,
  PerformanceKPI,
  Milestone,
  Obligation,
  PerformanceAlert,
  PerformanceStatus,
  MilestoneType,
  PERFORMANCE_STATUS_CONFIG,
  MILESTONE_TYPE_LABELS,
} from './types';

// 一天的毫秒数
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// 生成距离今天指定天数的日期字符串（YYYY-MM-DD）
function daysFromNow(days: number): string {
  const d = new Date(Date.now() + days * ONE_DAY_MS);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// 生成距离今天指定天数的日期字符串（过去）
function daysAgo(days: number): string {
  return daysFromNow(-days);
}

// ===== 统计 =====

// 统计履约追踪概况
export function getPerformanceStats(trackers: PerformanceTracker[]): {
  total: number;
  onTrack: number;
  atRisk: number;
  delayed: number;
  completed: number;
  avgProgress: number;
  totalAlerts: number;
} {
  let onTrack = 0;
  let atRisk = 0;
  let delayed = 0;
  let completed = 0;
  let progressSum = 0;
  let totalAlerts = 0;

  for (const t of trackers) {
    // 状态计数
    if (t.status === 'on_track') onTrack += 1;
    if (t.status === 'at_risk') atRisk += 1;
    if (t.status === 'delayed') delayed += 1;
    if (t.status === 'completed') completed += 1;

    // 进度累计
    progressSum += t.overall_progress;

    // 预警数量累计
    totalAlerts += t.alerts.length;
  }

  return {
    total: trackers.length,
    onTrack,
    atRisk,
    delayed,
    completed,
    avgProgress:
      trackers.length > 0 ? Math.round(progressSum / trackers.length) : 0,
    totalAlerts,
  };
}

// ===== 里程碑更新 =====

// 更新指定里程碑：合并更新字段并同步完成状态与实际日期
export function updateMilestone(
  tracker: PerformanceTracker,
  milestoneId: string,
  updates: Partial<Milestone>
): PerformanceTracker {
  const milestones = tracker.milestones.map((m) => {
    if (m.id !== milestoneId) return m;
    const updated = { ...m, ...updates };
    // 若标记为完成且未填实际日期，则填入今天
    if (updates.completed === true && !updated.actual_date) {
      updated.actual_date = daysFromNow(0);
    }
    // 完成状态与里程碑状态联动
    if (updates.completed === true) {
      updated.status = 'completed';
    } else if (updates.status && updates.status !== 'completed') {
      updated.completed = false;
    }
    return updated;
  });

  // 重新计算整体进度：已完成里程碑占比
  const completedCount = milestones.filter((m) => m.completed).length;
  const overallProgress =
    milestones.length > 0
      ? Math.round((completedCount / milestones.length) * 100)
      : tracker.overall_progress;

  // 根据整体进度与里程碑延误情况更新合同状态
  let status = tracker.status;
  const hasDelayed = milestones.some(
    (m) => m.status === 'delayed' && !m.completed
  );
  const allCompleted = milestones.every((m) => m.completed);
  if (allCompleted) {
    status = 'completed';
  } else if (hasDelayed) {
    status = 'delayed';
  } else if (overallProgress < 50) {
    status = 'on_track';
  } else {
    status = 'on_track';
  }

  return {
    ...tracker,
    milestones,
    overall_progress: overallProgress,
    status,
  };
}

// ===== 即将到期里程碑查询 =====

// 返回未来 N 天内到期的里程碑（未完成）
export function getUpcomingMilestones(
  trackers: PerformanceTracker[],
  daysAhead: number
): { tracker: PerformanceTracker; milestone: Milestone }[] {
  const now = Date.now();
  const futureLimit = now + daysAhead * ONE_DAY_MS;
  const result: { tracker: PerformanceTracker; milestone: Milestone }[] = [];

  for (const tracker of trackers) {
    for (const milestone of tracker.milestones) {
      // 跳过已完成的里程碑
      if (milestone.completed) continue;
      const plannedTime = new Date(milestone.planned_date).getTime();
      // 计划日期在当前到未来 N 天之间
      if (plannedTime >= now && plannedTime <= futureLimit) {
        result.push({ tracker, milestone });
      }
    }
  }

  // 按计划日期升序排序
  result.sort(
    (a, b) =>
      new Date(a.milestone.planned_date).getTime() -
      new Date(b.milestone.planned_date).getTime()
  );

  return result;
}

// ===== Mock 数据 =====

// 返回 5 条 Mock 履约追踪记录，覆盖正常、有风险、已延误、已完成等不同状态
export function getMockPerformanceTrackers(): PerformanceTracker[] {
  return [
    // 1. 云计算服务采购合同 —— 正常履约
    {
      id: 'pf-001',
      contract_id: 'mock-009',
      contract_title: '云计算服务采购合同',
      counterparty: '上海智云科技有限公司',
      start_date: daysAgo(60),
      end_date: daysFromNow(305),
      overall_progress: 45,
      status: 'on_track',
      kpis: [
        {
          id: 'kpi-001',
          name: '服务可用性',
          target: 99.95,
          actual: 99.97,
          unit: '%',
          status: 'on_track',
          trend: 'up',
          last_updated: daysAgo(1),
        },
        {
          id: 'kpi-002',
          name: '工单响应时间',
          target: 15,
          actual: 12,
          unit: '分钟',
          status: 'on_track',
          trend: 'up',
          last_updated: daysAgo(1),
        },
        {
          id: 'kpi-003',
          name: '故障恢复时间',
          target: 60,
          actual: 45,
          unit: '分钟',
          status: 'on_track',
          trend: 'flat',
          last_updated: daysAgo(2),
        },
        {
          id: 'kpi-004',
          name: '资源利用率',
          target: 80,
          actual: 72,
          unit: '%',
          status: 'on_track',
          trend: 'down',
          last_updated: daysAgo(3),
        },
      ],
      milestones: [
        {
          id: 'ms-001',
          name: '基础设施部署完成',
          type: 'delivery',
          planned_date: daysAgo(45),
          actual_date: daysAgo(43),
          status: 'completed',
          responsible_party: 'them',
          deliverables: ['云服务器集群', '网络配置', '安全策略'],
          completed: true,
        },
        {
          id: 'ms-002',
          name: '系统迁移验收',
          type: 'review',
          planned_date: daysAgo(20),
          actual_date: daysAgo(18),
          status: 'completed',
          responsible_party: 'us',
          deliverables: ['迁移报告', '验收清单'],
          completed: true,
        },
        {
          id: 'ms-003',
          name: '第一期服务费支付',
          type: 'payment',
          planned_date: daysAgo(15),
          actual_date: daysAgo(14),
          status: 'completed',
          responsible_party: 'us',
          deliverables: ['付款凭证'],
          completed: true,
        },
        {
          id: 'ms-004',
          name: '季度服务评审',
          type: 'review',
          planned_date: daysFromNow(10),
          status: 'on_track',
          responsible_party: 'them',
          deliverables: ['服务报告', '改进计划'],
          completed: false,
        },
        {
          id: 'ms-005',
          name: '年度续费审批',
          type: 'renewal',
          planned_date: daysFromNow(280),
          status: 'not_started',
          responsible_party: 'us',
          deliverables: ['续费申请', '审批记录'],
          completed: false,
        },
        {
          id: 'ms-006',
          name: '第二期服务费支付',
          type: 'payment',
          planned_date: daysFromNow(75),
          status: 'on_track',
          responsible_party: 'us',
          deliverables: ['付款凭证'],
          completed: false,
        },
      ],
      obligations: [
        {
          id: 'ob-001',
          description: '按季度支付服务费',
          party: 'us',
          due_date: daysFromNow(75),
          status: 'on_track',
          evidence: '第一期付款凭证已归档',
          recurrence: 'quarterly',
        },
        {
          id: 'ob-002',
          description: '提供 7×24 小时技术支持',
          party: 'them',
          due_date: daysFromNow(305),
          status: 'on_track',
          evidence: '工单系统记录完整',
          recurrence: 'one_time',
        },
        {
          id: 'ob-003',
          description: '每月提交服务运行报告',
          party: 'them',
          due_date: daysFromNow(5),
          status: 'on_track',
          evidence: '已连续提交 2 个月报告',
          recurrence: 'monthly',
        },
        {
          id: 'ob-004',
          description: '保障数据安全合规',
          party: 'them',
          due_date: daysFromNow(305),
          status: 'on_track',
          evidence: '通过 ISO 27001 认证',
          recurrence: 'annually',
        },
      ],
      alerts: [
        {
          id: 'al-001',
          type: 'deadline_approaching',
          severity: 'info',
          message: '季度服务评审将在 10 天后到期，请准备评审材料',
          timestamp: daysAgo(1),
        },
        {
          id: 'al-002',
          type: 'obligation_overdue',
          severity: 'warning',
          message: '月度服务报告提交日期临近，请关注对方履约情况',
          timestamp: daysAgo(2),
        },
      ],
    },

    // 2. 办公设备租赁合同 —— 有风险
    {
      id: 'pf-002',
      contract_id: 'mock-010',
      contract_title: '办公设备租赁合同',
      counterparty: '北京恒达办公设备有限公司',
      start_date: daysAgo(90),
      end_date: daysFromNow(1005),
      overall_progress: 30,
      status: 'at_risk',
      kpis: [
        {
          id: 'kpi-005',
          name: '设备完好率',
          target: 98,
          actual: 94,
          unit: '%',
          status: 'at_risk',
          trend: 'down',
          last_updated: daysAgo(2),
        },
        {
          id: 'kpi-006',
          name: '维修响应时间',
          target: 4,
          actual: 8,
          unit: '小时',
          status: 'at_risk',
          trend: 'down',
          last_updated: daysAgo(2),
        },
        {
          id: 'kpi-007',
          name: '设备使用率',
          target: 85,
          actual: 88,
          unit: '%',
          status: 'on_track',
          trend: 'up',
          last_updated: daysAgo(3),
        },
        {
          id: 'kpi-008',
          name: '维护成本',
          target: 5000,
          actual: 6200,
          unit: '元/月',
          status: 'at_risk',
          trend: 'down',
          last_updated: daysAgo(5),
        },
      ],
      milestones: [
        {
          id: 'ms-007',
          name: '设备安装调试完成',
          type: 'delivery',
          planned_date: daysAgo(85),
          actual_date: daysAgo(82),
          status: 'completed',
          responsible_party: 'them',
          deliverables: ['设备清单', '安装报告'],
          completed: true,
        },
        {
          id: 'ms-008',
          name: '首期租金支付',
          type: 'payment',
          planned_date: daysAgo(80),
          actual_date: daysAgo(78),
          status: 'completed',
          responsible_party: 'us',
          deliverables: ['付款凭证'],
          completed: true,
        },
        {
          id: 'ms-009',
          name: '设备巡检',
          type: 'review',
          planned_date: daysAgo(10),
          actual_date: daysAgo(5),
          status: 'completed',
          responsible_party: 'them',
          deliverables: ['巡检报告'],
          completed: true,
        },
        {
          id: 'ms-010',
          name: '设备升级评估',
          type: 'review',
          planned_date: daysFromNow(15),
          status: 'at_risk',
          responsible_party: 'them',
          deliverables: ['评估报告', '升级方案'],
          completed: false,
        },
        {
          id: 'ms-011',
          name: '第二期租金支付',
          type: 'payment',
          planned_date: daysFromNow(20),
          status: 'on_track',
          responsible_party: 'us',
          deliverables: ['付款凭证'],
          completed: false,
        },
      ],
      obligations: [
        {
          id: 'ob-005',
          description: '按季度支付租金',
          party: 'us',
          due_date: daysFromNow(20),
          status: 'on_track',
          evidence: '首期租金已支付',
          recurrence: 'quarterly',
        },
        {
          id: 'ob-006',
          description: '负责设备日常维护',
          party: 'them',
          due_date: daysFromNow(1005),
          status: 'at_risk',
          evidence: '近期维修响应超时 2 次',
          recurrence: 'one_time',
        },
        {
          id: 'ob-007',
          description: '每季度提交设备状态报告',
          party: 'them',
          due_date: daysFromNow(8),
          status: 'on_track',
          evidence: '已提交 1 次报告',
          recurrence: 'quarterly',
        },
      ],
      alerts: [
        {
          id: 'al-003',
          type: 'kpi_breach',
          severity: 'warning',
          message: '设备完好率低于目标值 98%，当前为 94%',
          timestamp: daysAgo(2),
        },
        {
          id: 'al-004',
          type: 'kpi_breach',
          severity: 'warning',
          message: '维修响应时间超出目标 4 小时，当前为 8 小时',
          timestamp: daysAgo(2),
        },
        {
          id: 'al-005',
          type: 'deadline_approaching',
          severity: 'info',
          message: '设备升级评估将在 15 天后到期',
          timestamp: daysAgo(1),
        },
      ],
    },

    // 3. 软件定制开发合同 —— 已延误
    {
      id: 'pf-003',
      contract_id: 'mock-011',
      contract_title: '软件定制开发合同',
      counterparty: '深圳创新软件有限公司',
      start_date: daysAgo(120),
      end_date: daysFromNow(60),
      overall_progress: 55,
      status: 'delayed',
      kpis: [
        {
          id: 'kpi-009',
          name: '代码质量评分',
          target: 85,
          actual: 82,
          unit: '分',
          status: 'on_track',
          trend: 'flat',
          last_updated: daysAgo(3),
        },
        {
          id: 'kpi-010',
          name: '需求完成率',
          target: 90,
          actual: 65,
          unit: '%',
          status: 'delayed',
          trend: 'down',
          last_updated: daysAgo(1),
        },
        {
          id: 'kpi-011',
          name: '缺陷修复率',
          target: 95,
          actual: 78,
          unit: '%',
          status: 'delayed',
          trend: 'down',
          last_updated: daysAgo(1),
        },
        {
          id: 'kpi-012',
          name: '迭代交付频率',
          target: 4,
          actual: 2,
          unit: '次/月',
          status: 'delayed',
          trend: 'down',
          last_updated: daysAgo(5),
        },
      ],
      milestones: [
        {
          id: 'ms-012',
          name: '需求分析完成',
          type: 'approval',
          planned_date: daysAgo(100),
          actual_date: daysAgo(95),
          status: 'completed',
          responsible_party: 'them',
          deliverables: ['需求文档', '确认书'],
          completed: true,
        },
        {
          id: 'ms-013',
          name: '系统设计评审',
          type: 'review',
          planned_date: daysAgo(70),
          actual_date: daysAgo(65),
          status: 'completed',
          responsible_party: 'us',
          deliverables: ['设计文档', '评审记录'],
          completed: true,
        },
        {
          id: 'ms-014',
          name: '核心模块开发完成',
          type: 'delivery',
          planned_date: daysAgo(20),
          actual_date: daysAgo(5),
          status: 'completed',
          responsible_party: 'them',
          deliverables: ['核心模块代码', '单元测试报告'],
          completed: true,
        },
        {
          id: 'ms-015',
          name: '系统集成测试',
          type: 'review',
          planned_date: daysAgo(5),
          status: 'delayed',
          responsible_party: 'them',
          deliverables: ['测试报告', '缺陷清单'],
          completed: false,
        },
        {
          id: 'ms-016',
          name: '用户验收测试',
          type: 'approval',
          planned_date: daysFromNow(15),
          status: 'delayed',
          responsible_party: 'us',
          deliverables: ['验收报告'],
          completed: false,
        },
        {
          id: 'ms-017',
          name: '系统上线部署',
          type: 'delivery',
          planned_date: daysFromNow(40),
          status: 'not_started',
          responsible_party: 'them',
          deliverables: ['部署文档', '上线报告'],
          completed: false,
        },
      ],
      obligations: [
        {
          id: 'ob-008',
          description: '按里程碑支付开发费用',
          party: 'us',
          due_date: daysFromNow(5),
          status: 'on_track',
          evidence: '前两期费用已支付',
          recurrence: 'one_time',
        },
        {
          id: 'ob-009',
          description: '交付全部源代码及文档',
          party: 'them',
          due_date: daysFromNow(50),
          status: 'delayed',
          evidence: '核心模块代码已交付，文档滞后',
          recurrence: 'one_time',
        },
        {
          id: 'ob-010',
          description: '提供免费维护服务',
          party: 'them',
          due_date: daysFromNow(215),
          status: 'not_started',
          evidence: '尚未进入维护期',
          recurrence: 'one_time',
        },
      ],
      alerts: [
        {
          id: 'al-006',
          type: 'milestone_delay',
          severity: 'critical',
          message: '系统集成测试已延误 5 天，影响后续验收与上线计划',
          timestamp: daysAgo(1),
        },
        {
          id: 'al-007',
          type: 'kpi_breach',
          severity: 'critical',
          message: '需求完成率仅 65%，远低于目标 90%',
          timestamp: daysAgo(1),
        },
        {
          id: 'al-008',
          type: 'obligation_overdue',
          severity: 'warning',
          message: '源代码文档交付滞后，需催促对方尽快补齐',
          timestamp: daysAgo(3),
        },
      ],
    },

    // 4. 物流配送服务合同 —— 已完成
    {
      id: 'pf-004',
      contract_id: 'mock-012',
      contract_title: '物流配送服务合同',
      counterparty: '广州速达物流股份有限公司',
      start_date: daysAgo(365),
      end_date: daysAgo(5),
      overall_progress: 100,
      status: 'completed',
      kpis: [
        {
          id: 'kpi-013',
          name: '配送准时率',
          target: 95,
          actual: 96.5,
          unit: '%',
          status: 'completed',
          trend: 'up',
          last_updated: daysAgo(7),
        },
        {
          id: 'kpi-014',
          name: '货物完好率',
          target: 99,
          actual: 99.2,
          unit: '%',
          status: 'completed',
          trend: 'flat',
          last_updated: daysAgo(7),
        },
        {
          id: 'kpi-015',
          name: '客户满意度',
          target: 90,
          actual: 93,
          unit: '分',
          status: 'completed',
          trend: 'up',
          last_updated: daysAgo(7),
        },
        {
          id: 'kpi-016',
          name: '投诉处理时效',
          target: 24,
          actual: 18,
          unit: '小时',
          status: 'completed',
          trend: 'up',
          last_updated: daysAgo(7),
        },
      ],
      milestones: [
        {
          id: 'ms-018',
          name: '服务启动',
          type: 'delivery',
          planned_date: daysAgo(365),
          actual_date: daysAgo(365),
          status: 'completed',
          responsible_party: 'them',
          deliverables: ['启动确认书'],
          completed: true,
        },
        {
          id: 'ms-019',
          name: '中期服务评审',
          type: 'review',
          planned_date: daysAgo(180),
          actual_date: daysAgo(178),
          status: 'completed',
          responsible_party: 'them',
          deliverables: ['评审报告'],
          completed: true,
        },
        {
          id: 'ms-020',
          name: '年度费用结算',
          type: 'payment',
          planned_date: daysAgo(30),
          actual_date: daysAgo(28),
          status: 'completed',
          responsible_party: 'us',
          deliverables: ['结算单', '付款凭证'],
          completed: true,
        },
        {
          id: 'ms-021',
          name: '合同终止确认',
          type: 'approval',
          planned_date: daysAgo(5),
          actual_date: daysAgo(5),
          status: 'completed',
          responsible_party: 'them',
          deliverables: ['终止确认书'],
          completed: true,
        },
        {
          id: 'ms-022',
          name: '服务总结报告',
          type: 'report',
          planned_date: daysAgo(3),
          actual_date: daysAgo(2),
          status: 'completed',
          responsible_party: 'them',
          deliverables: ['年度服务总结'],
          completed: true,
        },
      ],
      obligations: [
        {
          id: 'ob-011',
          description: '全年配送服务履约',
          party: 'them',
          due_date: daysAgo(5),
          status: 'completed',
          evidence: '全年配送记录完整',
          recurrence: 'one_time',
        },
        {
          id: 'ob-012',
          description: '按月支付服务费',
          party: 'us',
          due_date: daysAgo(5),
          status: 'completed',
          evidence: '12 个月费用均已结清',
          recurrence: 'monthly',
        },
        {
          id: 'ob-013',
          description: '提交年度服务报告',
          party: 'them',
          due_date: daysAgo(2),
          status: 'completed',
          evidence: '年度报告已归档',
          recurrence: 'annually',
        },
      ],
      alerts: [
        {
          id: 'al-009',
          type: 'deadline_approaching',
          severity: 'info',
          message: '合同已圆满履行完毕，建议归档并评估续签意向',
          timestamp: daysAgo(5),
        },
        {
          id: 'al-012',
          type: 'kpi_breach',
          severity: 'info',
          message: '年度客户满意度达 93 分，超出目标 90 分，建议在续签谈判中作为优势筹码',
          timestamp: daysAgo(6),
        },
      ],
    },

    // 5. 市场营销服务合同 —— 正常履约（初期阶段）
    {
      id: 'pf-005',
      contract_id: 'mock-013',
      contract_title: '市场营销服务合同',
      counterparty: '杭州创想营销策划有限公司',
      start_date: daysAgo(20),
      end_date: daysFromNow(250),
      overall_progress: 15,
      status: 'on_track',
      kpis: [
        {
          id: 'kpi-017',
          name: '品牌曝光增长',
          target: 50,
          actual: 18,
          unit: '%',
          status: 'on_track',
          trend: 'up',
          last_updated: daysAgo(1),
        },
        {
          id: 'kpi-018',
          name: '内容产出数量',
          target: 30,
          actual: 12,
          unit: '篇/月',
          status: 'on_track',
          trend: 'up',
          last_updated: daysAgo(2),
        },
        {
          id: 'kpi-019',
          name: '社交媒体互动率',
          target: 5,
          actual: 4.2,
          unit: '%',
          status: 'on_track',
          trend: 'up',
          last_updated: daysAgo(2),
        },
        {
          id: 'kpi-020',
          name: '获客成本',
          target: 200,
          actual: 185,
          unit: '元/人',
          status: 'on_track',
          trend: 'up',
          last_updated: daysAgo(3),
        },
      ],
      milestones: [
        {
          id: 'ms-023',
          name: '品牌策略确认',
          type: 'approval',
          planned_date: daysAgo(15),
          actual_date: daysAgo(14),
          status: 'completed',
          responsible_party: 'us',
          deliverables: ['品牌策略方案', '确认书'],
          completed: true,
        },
        {
          id: 'ms-024',
          name: '首月内容上线',
          type: 'delivery',
          planned_date: daysAgo(5),
          actual_date: daysAgo(4),
          status: 'completed',
          responsible_party: 'them',
          deliverables: ['内容排期表', '已发布内容'],
          completed: true,
        },
        {
          id: 'ms-025',
          name: '首月服务费支付',
          type: 'payment',
          planned_date: daysAgo(3),
          actual_date: daysAgo(2),
          status: 'completed',
          responsible_party: 'us',
          deliverables: ['付款凭证'],
          completed: true,
        },
        {
          id: 'ms-026',
          name: '首月效果复盘',
          type: 'review',
          planned_date: daysFromNow(8),
          status: 'on_track',
          responsible_party: 'them',
          deliverables: ['效果分析报告'],
          completed: false,
        },
        {
          id: 'ms-027',
          name: '季度策略调整',
          type: 'review',
          planned_date: daysFromNow(70),
          status: 'not_started',
          responsible_party: 'them',
          deliverables: ['调整方案'],
          completed: false,
        },
      ],
      obligations: [
        {
          id: 'ob-014',
          description: '按月支付服务费',
          party: 'us',
          due_date: daysFromNow(25),
          status: 'on_track',
          evidence: '首月费用已支付',
          recurrence: 'monthly',
        },
        {
          id: 'ob-015',
          description: '每月产出 30 篇营销内容',
          party: 'them',
          due_date: daysFromNow(10),
          status: 'on_track',
          evidence: '首月已产出 12 篇',
          recurrence: 'monthly',
        },
        {
          id: 'ob-016',
          description: '每周提交进度报告',
          party: 'them',
          due_date: daysFromNow(3),
          status: 'on_track',
          evidence: '已连续提交 3 周报告',
          recurrence: 'monthly',
        },
      ],
      alerts: [
        {
          id: 'al-010',
          type: 'deadline_approaching',
          severity: 'info',
          message: '首月效果复盘将在 8 天后进行，请准备数据分析',
          timestamp: daysAgo(1),
        },
        {
          id: 'al-011',
          type: 'deadline_approaching',
          severity: 'info',
          message: '周度进度报告提交日期临近',
          timestamp: daysAgo(2),
        },
      ],
    },
  ];
}

// 重新导出标签与配置，方便页面统一引用
export { PERFORMANCE_STATUS_CONFIG, MILESTONE_TYPE_LABELS };
