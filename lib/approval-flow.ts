// ===== 审批流路由模块 =====
// 基于风险等级动态生成审批链

import { ApprovalFlow, ApprovalNode, ApproverRole, RouteReason, APPROVER_ROLE_LABELS } from './types';
import { Contract } from './types';

// 根据风险评分确定路由原因
function determineRouteReason(riskScore: number, highRiskCount: number): RouteReason {
  if (riskScore >= 60 || highRiskCount >= 2) return 'high_risk';
  if (riskScore >= 40 || highRiskCount >= 1) return 'medium_risk';
  if (riskScore >= 20) return 'low_risk';
  return 'auto_approved';
}

// 根据路由原因生成审批链
function generateApprovalChain(reason: RouteReason): { role: ApproverRole; order: number }[] {
  switch (reason) {
    case 'high_risk':
      // 高风险：法务专员 → 法务经理 → 法务总监 → 业务部门 → 总经理
      return [
        { role: 'legal_specialist', order: 1 },
        { role: 'legal_manager', order: 2 },
        { role: 'legal_director', order: 3 },
        { role: 'business_dept', order: 4 },
        { role: 'general_manager', order: 5 },
      ];
    case 'medium_risk':
      // 中风险：法务专员 → 法务经理 → 业务部门
      return [
        { role: 'legal_specialist', order: 1 },
        { role: 'legal_manager', order: 2 },
        { role: 'business_dept', order: 3 },
      ];
    case 'low_risk':
      // 低风险：法务专员 → 法务经理
      return [
        { role: 'legal_specialist', order: 1 },
        { role: 'legal_manager', order: 2 },
      ];
    case 'auto_approved':
      // 自动通过：仅法务专员确认
      return [
        { role: 'legal_specialist', order: 1 },
      ];
  }
}

// 生成审批流
export function createApprovalFlow(contract: Contract): ApprovalFlow {
  const riskScore = contract.risk_score || 0;
  const highRiskCount = contract.high_risk_count || 0;
  const reason = determineRouteReason(riskScore, highRiskCount);
  const chain = generateApprovalChain(reason);
  const now = new Date().toISOString();

  const nodes: ApprovalNode[] = chain.map((item, idx) => ({
    id: `node-${contract.id}-${idx}`,
    order: item.order,
    role: item.role,
    role_label: APPROVER_ROLE_LABELS[item.role],
    status: idx === 0 ? 'pending' : 'pending',
    route_reason: reason,
    created_at: now,
  }));

  // 如果是自动通过，第一个节点直接标记为已通过
  if (reason === 'auto_approved') {
    nodes[0].status = 'approved';
    nodes[0].approver_name = '系统自动';
    nodes[0].comment = '风险评分低于阈值，自动通过';
    nodes[0].completed_at = now;
  }

  return {
    id: `flow-${contract.id}`,
    contract_id: contract.id,
    nodes,
    current_node: reason === 'auto_approved' ? -1 : 0,
    status: reason === 'auto_approved' ? 'approved' : 'pending',
    route_reason: reason,
    auto_approved: reason === 'auto_approved',
    created_at: now,
    completed_at: reason === 'auto_approved' ? now : undefined,
  };
}

// 推进审批流（审批通过/拒绝）
export function advanceApprovalFlow(
  flow: ApprovalFlow,
  decision: 'approved' | 'rejected',
  approverName: string,
  comment?: string
): ApprovalFlow {
  const updatedFlow = { ...flow, nodes: [...flow.nodes] };
  const currentNode = updatedFlow.nodes[updatedFlow.current_node];

  if (!currentNode) return updatedFlow;

  // 更新当前节点
  updatedFlow.nodes[updatedFlow.current_node] = {
    ...currentNode,
    status: decision,
    approver_name: approverName,
    comment: comment || '',
    completed_at: new Date().toISOString(),
  };

  if (decision === 'rejected') {
    // 拒绝：审批流终止
    updatedFlow.status = 'rejected';
    updatedFlow.completed_at = new Date().toISOString();
  } else {
    // 通过：检查是否有下一个节点
    const nextIndex = updatedFlow.current_node + 1;
    if (nextIndex < updatedFlow.nodes.length) {
      // 激活下一个节点
      updatedFlow.nodes[nextIndex] = {
        ...updatedFlow.nodes[nextIndex],
        status: 'pending',
      };
      updatedFlow.current_node = nextIndex;
      updatedFlow.status = 'in_progress';
    } else {
      // 所有节点通过
      updatedFlow.status = 'approved';
      updatedFlow.completed_at = new Date().toISOString();
    }
  }

  return updatedFlow;
}

// 生成Mock审批流数据
export function getMockApprovalFlow(contractId: string, riskScore: number, highRiskCount: number): ApprovalFlow {
  const mockContract: Contract = {
    id: contractId,
    user_id: 'mock-user',
    filename: 'mock.pdf',
    file_type: 'pdf',
    file_size: 0,
    status: 'completed',
    risk_score: riskScore,
    high_risk_count: highRiskCount,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  return createApprovalFlow(mockContract);
}
