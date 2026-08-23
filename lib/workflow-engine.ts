// ===== 工作流引擎模块 =====
// 提供工作流定义、节点 / 连线操作、流程校验与 Mock 数据
// 供工作流 API 与工作流编辑器 / 工作流页面共用

import {
  WorkflowDefinition,
  WorkflowNode,
  WorkflowEdge,
  WorkflowInstance,
  WorkflowStepHistory,
  WorkflowNodeType,
  WorkflowStatus,
  WORKFLOW_NODE_TYPE_LABELS,
} from './types';

// 生成距离今天指定天数的 ISO 时间字符串
function daysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

// 生成唯一 ID
function genId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

// ===== 节点工厂 =====
// 创建一个工作流节点，统一生成 ID 与默认 config
function makeNode(
  type: WorkflowNodeType,
  label: string,
  x: number,
  y: number,
  config: WorkflowNode['config'] = {}
): WorkflowNode {
  return {
    id: genId('node'),
    type,
    label,
    x,
    y,
    config,
  };
}

// 创建一条边的辅助函数
function makeEdge(
  source: string,
  target: string,
  label?: string
): WorkflowEdge {
  return {
    id: genId('edge'),
    source,
    target,
    label,
    condition: label,
  };
}

// ===== Mock 工作流定义 =====
// 返回 4 个预置工作流定义，覆盖标准采购 / 大额合同 / 简单流程 / 服务合同
export function getMockWorkflows(): WorkflowDefinition[] {
  return [
    buildProcurementWorkflow(),
    buildHighValueWorkflow(),
    buildSimpleWorkflow(),
    buildServiceWorkflow(),
  ];
}

// 标准采购合同审批流程：
// 开始 → 法务审查 → 经理审批 → 结束
function buildProcurementWorkflow(): WorkflowDefinition {
  const start = makeNode('start', '开始', 80, 200);
  const review = makeNode('review', '法务审查', 300, 200, {
    assignee_role: '法务专员',
    sla_hours: 24,
  });
  const approve = makeNode('approve', '经理审批', 540, 200, {
    assignee_role: '法务经理',
    sla_hours: 48,
  });
  const end = makeNode('end', '结束', 780, 200);

  const nodes = [start, review, approve, end];
  const edges: WorkflowEdge[] = [
    makeEdge(start.id, review.id),
    makeEdge(review.id, approve.id),
    makeEdge(approve.id, end.id),
  ];

  return {
    id: 'wf-procurement',
    name: '标准采购审批流程',
    description: '标准采购合同审批流：法务审查 → 经理审批',
    contract_type: '采购合同',
    nodes,
    edges,
    status: 'active',
    version: 1,
    created_at: daysAgo(30),
    updated_at: daysAgo(3),
  };
}

// 大额合同审批流程：
// 开始 → 法务审查 → 条件判断(金额>100万?) → 法务复审 → 经理审批 → 结束
function buildHighValueWorkflow(): WorkflowDefinition {
  const start = makeNode('start', '开始', 60, 220);
  const review = makeNode('review', '法务审查', 260, 220, {
    assignee_role: '法务专员',
    sla_hours: 24,
  });
  const condition = makeNode('condition', '金额>100万?', 480, 220, {
    condition_field: 'contract_value',
    condition_operator: 'greater_than',
    condition_value: '1000000',
    next_node_true: '',
    next_node_false: '',
  });
  const legalReview = makeNode('review', '法务复审', 720, 100, {
    assignee_role: '法务总监',
    sla_hours: 48,
  });
  const manager = makeNode('approve', '经理审批', 720, 340, {
    assignee_role: '法务经理',
    sla_hours: 48,
  });
  const end = makeNode('end', '结束', 960, 220);

  // 条件分支：大额走法务复审，非大额走经理审批
  condition.config.next_node_true = legalReview.id;
  condition.config.next_node_false = manager.id;

  const nodes = [start, review, condition, legalReview, manager, end];
  const edges: WorkflowEdge[] = [
    makeEdge(start.id, review.id),
    makeEdge(review.id, condition.id),
    makeEdge(condition.id, legalReview.id, '是'),
    makeEdge(condition.id, manager.id, '否'),
    makeEdge(legalReview.id, end.id),
    makeEdge(manager.id, end.id),
  ];

  return {
    id: 'wf-highvalue',
    name: '大额合同审批流程',
    description: '大额合同审批流：法务审查 → 条件判断 → 法务复审 / 经理审批',
    contract_type: '采购合同',
    nodes,
    edges,
    status: 'active',
    version: 2,
    created_at: daysAgo(25),
    updated_at: daysAgo(1),
  };
}

// 简单审批流程：
// 开始 → 经理审批 → 结束
function buildSimpleWorkflow(): WorkflowDefinition {
  const start = makeNode('start', '开始', 120, 200);
  const approve = makeNode('approve', '经理审批', 400, 200, {
    assignee_role: '法务经理',
    sla_hours: 24,
  });
  const end = makeNode('end', '结束', 680, 200);

  const nodes = [start, approve, end];
  const edges: WorkflowEdge[] = [
    makeEdge(start.id, approve.id),
    makeEdge(approve.id, end.id),
  ];

  return {
    id: 'wf-simple',
    name: '简单审批流程',
    description: '适用于低风险 / 小额合同的快速审批：经理审批',
    contract_type: '其他',
    nodes,
    edges,
    status: 'active',
    version: 1,
    created_at: daysAgo(20),
    updated_at: daysAgo(5),
  };
}

// 服务合同审批流程：
// 开始 → 法务审查 → 条件判断(涉密?) → 通知 → 结束
function buildServiceWorkflow(): WorkflowDefinition {
  const start = makeNode('start', '开始', 60, 220);
  const review = makeNode('review', '法务审查', 260, 220, {
    assignee_role: '法务专员',
    sla_hours: 24,
  });
  const condition = makeNode('condition', '是否涉密?', 480, 220, {
    condition_field: 'is_confidential',
    condition_operator: 'equals',
    condition_value: 'true',
    next_node_true: '',
    next_node_false: '',
  });
  const notify = makeNode('notify', '通知业务部门', 720, 220, {
    notification_template: '服务合同审批完成通知',
  });
  const end = makeNode('end', '结束', 960, 220);

  condition.config.next_node_true = notify.id;
  condition.config.next_node_false = notify.id;

  const nodes = [start, review, condition, notify, end];
  const edges: WorkflowEdge[] = [
    makeEdge(start.id, review.id),
    makeEdge(review.id, condition.id),
    makeEdge(condition.id, notify.id, '是'),
    makeEdge(condition.id, notify.id, '否'),
    makeEdge(notify.id, end.id),
  ];

  return {
    id: 'wf-service',
    name: '服务合同审批流程',
    description: '服务合同审批流：法务审查 → 涉密判断 → 通知业务部门',
    contract_type: '服务合同',
    nodes,
    edges,
    status: 'draft',
    version: 1,
    created_at: daysAgo(15),
    updated_at: daysAgo(2),
  };
}

// ===== Mock 工作流实例 =====
// 返回 4 个运行中 / 已完成 / 异常的工作流实例
export function getMockWorkflowInstances(): WorkflowInstance[] {
  return [
    {
      id: 'inst-001',
      workflow_id: 'wf-procurement',
      workflow_name: '标准采购审批流程',
      contract_id: 'CON-2026-0301',
      contract_title: '办公设备批量采购合同',
      current_node_id: '',
      status: 'running',
      started_at: hoursAgo(20),
      history: [
        stepHistory('开始', 'enter', '系统', hoursAgo(20)),
        stepHistory('法务审查', 'approve', '张法务', hoursAgo(18), '条款合规'),
        stepHistory('经理审批', 'enter', '系统', hoursAgo(10)),
      ],
    },
    {
      id: 'inst-002',
      workflow_id: 'wf-highvalue',
      workflow_name: '大额合同审批流程',
      contract_id: 'CON-2026-0302',
      contract_title: 'IT运维外包服务合同',
      current_node_id: '',
      status: 'running',
      started_at: hoursAgo(8),
      history: [
        stepHistory('开始', 'enter', '系统', hoursAgo(8)),
        stepHistory('法务审查', 'approve', '王法务', hoursAgo(6), '通过'),
        stepHistory('金额>100万?', 'enter', '系统', hoursAgo(5)),
        stepHistory('法务复审', 'enter', '系统', hoursAgo(5)),
      ],
    },
    {
      id: 'inst-003',
      workflow_id: 'wf-simple',
      workflow_name: '简单审批流程',
      contract_id: 'CON-2026-0303',
      contract_title: '办公用品零星采购合同',
      current_node_id: '',
      status: 'completed',
      started_at: daysAgo(3),
      completed_at: daysAgo(2),
      history: [
        stepHistory('开始', 'enter', '系统', daysAgo(3)),
        stepHistory('经理审批', 'approve', '李经理', daysAgo(2), '同意'),
        stepHistory('结束', 'enter', '系统', daysAgo(2)),
      ],
    },
    {
      id: 'inst-004',
      workflow_id: 'wf-service',
      workflow_name: '服务合同审批流程',
      contract_id: 'CON-2026-0304',
      contract_title: '数据分析平台定制开发合同',
      current_node_id: '',
      status: 'error',
      started_at: daysAgo(5),
      history: [
        stepHistory('开始', 'enter', '系统', daysAgo(5)),
        stepHistory('法务审查', 'approve', '张法务', daysAgo(4), '通过'),
        stepHistory('是否涉密?', 'enter', '系统', daysAgo(3)),
        stepHistory('通知业务部门', 'timeout', '系统', daysAgo(1), '通知发送超时'),
      ],
    },
  ];
}

// 创建步骤历史辅助函数
function stepHistory(
  nodeLabel: string,
  action: WorkflowStepHistory['action'],
  actor: string,
  timestamp: string,
  comment?: string
): WorkflowStepHistory {
  return {
    node_id: '',
    node_label: nodeLabel,
    action,
    actor,
    timestamp,
    comment,
  };
}

// ===== 工作流统计 =====
// 汇总工作流定义的总数、活跃数、归档数与平均节点数
export function getWorkflowStats(
  workflows: WorkflowDefinition[]
): {
  total: number;
  active: number;
  archived: number;
  avgNodes: number;
} {
  const total = workflows.length;
  if (total === 0) {
    return { total: 0, active: 0, archived: 0, avgNodes: 0 };
  }
  const active = workflows.filter((w) => w.status === 'active').length;
  const archived = workflows.filter((w) => w.status === 'archived').length;
  const avgNodes =
    Math.round(
      (workflows.reduce((sum, w) => sum + w.nodes.length, 0) / total) * 10
    ) / 10;
  return { total, active, archived, avgNodes };
}

// ===== 工作流实例统计 =====
// 汇总实例总数、运行中数、已完成数与平均耗时（小时）
export function getInstanceStats(
  instances: WorkflowInstance[]
): {
  total: number;
  running: number;
  completed: number;
  avgDuration: number;
} {
  const total = instances.length;
  if (total === 0) {
    return { total: 0, running: 0, completed: 0, avgDuration: 0 };
  }
  const running = instances.filter((i) => i.status === 'running').length;
  const completed = instances.filter((i) => i.status === 'completed').length;

  // 平均完成时长（小时）：基于已完成实例的 started_at / completed_at
  const done = instances.filter(
    (i) => i.status === 'completed' && i.started_at && i.completed_at
  );
  let avgDuration = 0;
  if (done.length > 0) {
    const totalHours = done.reduce((sum, i) => {
      const ms =
        new Date(i.completed_at!).getTime() - new Date(i.started_at).getTime();
      return sum + ms / (60 * 60 * 1000);
    }, 0);
    avgDuration = Math.round((totalHours / done.length) * 10) / 10;
  }

  return { total, running, completed, avgDuration };
}

// ===== 创建工作流 =====
// 创建一个包含开始与结束节点的新工作流（草稿状态）
export function createWorkflow(
  name: string,
  description: string,
  contractType: string
): WorkflowDefinition {
  const now = new Date().toISOString();
  const start = makeNode('start', '开始', 120, 200);
  const end = makeNode('end', '结束', 560, 200);
  const edge = makeEdge(start.id, end.id);
  return {
    id: genId('wf'),
    name,
    description,
    contract_type: contractType,
    nodes: [start, end],
    edges: [edge],
    status: 'draft',
    version: 1,
    created_at: now,
    updated_at: now,
  };
}

// ===== 添加节点 =====
// 向工作流追加一个节点（自动生成 ID），返回新的工作流副本
export function addNode(
  workflow: WorkflowDefinition,
  node: Omit<WorkflowNode, 'id'>
): WorkflowDefinition {
  const newNode: WorkflowNode = {
    ...node,
    id: genId('node'),
  };
  return {
    ...workflow,
    nodes: [...workflow.nodes, newNode],
    updated_at: new Date().toISOString(),
  };
}

// ===== 添加连线 =====
// 向工作流追加一条边（自动生成 ID），返回新的工作流副本
export function addEdge(
  workflow: WorkflowDefinition,
  edge: Omit<WorkflowEdge, 'id'>
): WorkflowDefinition {
  const newEdge: WorkflowEdge = {
    ...edge,
    id: genId('edge'),
  };
  return {
    ...workflow,
    edges: [...workflow.edges, newEdge],
    updated_at: new Date().toISOString(),
  };
}

// ===== 按 ID 查找工作流 =====
export function getWorkflowById(id: string): WorkflowDefinition | undefined {
  return getMockWorkflows().find((w) => w.id === id);
}

// 在指定列表中按 ID 查找工作流
export function findWorkflowInList(
  workflows: WorkflowDefinition[],
  id: string
): WorkflowDefinition | undefined {
  return workflows.find((w) => w.id === id);
}

// ===== 工作流校验 =====
// 校验规则：
//  1) 有且仅有一个 start 节点
//  2) 有且仅有一个 end 节点
//  3) 所有边引用的 source / target 节点都存在
//  4) condition 节点必须同时配置 next_node_true 与 next_node_false
export function validateWorkflow(workflow: WorkflowDefinition): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const nodeIds = new Set(workflow.nodes.map((n) => n.id));

  // 1) start / end 节点数量
  const startNodes = workflow.nodes.filter((n) => n.type === 'start');
  const endNodes = workflow.nodes.filter((n) => n.type === 'end');
  if (startNodes.length === 0) {
    errors.push('缺少开始（start）节点');
  } else if (startNodes.length > 1) {
    errors.push(`存在 ${startNodes.length} 个开始节点，应仅有 1 个`);
  }
  if (endNodes.length === 0) {
    errors.push('缺少结束（end）节点');
  } else if (endNodes.length > 1) {
    errors.push(`存在 ${endNodes.length} 个结束节点，应仅有 1 个`);
  }

  // 2) 边引用的节点存在
  for (const e of workflow.edges) {
    if (!nodeIds.has(e.source)) {
      errors.push(`连线 ${e.id} 的 source 节点 ${e.source} 不存在`);
    }
    if (!nodeIds.has(e.target)) {
      errors.push(`连线 ${e.id} 的 target 节点 ${e.target} 不存在`);
    }
  }

  // 3) condition 节点必须有 true / false 分支
  const conditionNodes = workflow.nodes.filter((n) => n.type === 'condition');
  for (const c of conditionNodes) {
    if (!c.config.next_node_true || !c.config.next_node_false) {
      errors.push(
        `条件节点「${c.label}」必须同时配置 true 与 false 分支`
      );
    } else {
      if (!nodeIds.has(c.config.next_node_true)) {
        errors.push(
          `条件节点「${c.label}」的 true 分支指向不存在的节点 ${c.config.next_node_true}`
        );
      }
      if (!nodeIds.has(c.config.next_node_false)) {
        errors.push(
          `条件节点「${c.label}」的 false 分支指向不存在的节点 ${c.config.next_node_false}`
        );
      }
    }
  }

  // 4) start 节点应有出边，end 节点应有入边
  if (startNodes.length === 1) {
    const hasOut = workflow.edges.some((e) => e.source === startNodes[0].id);
    if (!hasOut) errors.push('开始节点没有出边');
  }
  if (endNodes.length === 1) {
    const hasIn = workflow.edges.some((e) => e.target === endNodes[0].id);
    if (!hasIn) errors.push('结束节点没有入边');
  }

  return { valid: errors.length === 0, errors };
}

// ===== 节点执行 =====
// 根据节点类型与合同数据决定下一步动作
//  - approve / review / notify / start / end / parallel：approve 推进
//  - condition：根据合同数据评估条件，返回对应分支节点
export function executeNode(
  node: WorkflowNode,
  contractData: any
): { action: 'approve' | 'reject' | 'skip'; nextNodeId: string } {
  switch (node.type) {
    case 'start':
    case 'approve':
    case 'review':
    case 'notify':
    case 'parallel': {
      return { action: 'approve', nextNodeId: '' };
    }
    case 'condition': {
      return evaluateCondition(node, contractData);
    }
    case 'end': {
      return { action: 'approve', nextNodeId: '' };
    }
    default:
      return { action: 'skip', nextNodeId: '' };
  }
}

// 评估条件节点，返回对应分支节点 ID
function evaluateCondition(
  node: WorkflowNode,
  contractData: any
): { action: 'approve' | 'reject' | 'skip'; nextNodeId: string } {
  const { condition_field, condition_operator, condition_value } = node.config;
  const trueId = node.config.next_node_true || '';
  const falseId = node.config.next_node_false || '';

  if (!condition_field) {
    return { action: 'approve', nextNodeId: trueId };
  }

  const actual = contractData?.[condition_field];
  const expected = condition_value;
  let result = false;

  switch (condition_operator) {
    case 'greater_than':
      result = Number(actual) > Number(expected);
      break;
    case 'less_than':
      result = Number(actual) < Number(expected);
      break;
    case 'equals':
      result = String(actual) === String(expected);
      break;
    case 'contains':
      result = String(actual ?? '').includes(String(expected));
      break;
    default:
      result = false;
  }

  return { action: 'approve', nextNodeId: result ? trueId : falseId };
}

// 重新导出标签，方便页面统一引用
export { WORKFLOW_NODE_TYPE_LABELS };
