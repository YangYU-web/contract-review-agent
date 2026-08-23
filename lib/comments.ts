// ===== 团队协作评论 Mock 数据模块 =====
// 提供评论的初始模拟数据，供 API 路由与协作页面共用

import { ContractComment } from './types';

// 从内容中提取 @提及（匹配 @ 后面的中英文/数字直到空白或标点）
export function extractMentions(content: string): string[] {
  const matches = content.match(/@[\u4e00-\u9fa5A-Za-z0-9_]+/g) || [];
  return Array.from(new Set(matches.map((m) => m.slice(1))));
}

// 协作页面演示用的合同映射
export const DEMO_CONTRACT_TITLES: Record<string, string> = {
  'mock-001': 'XX产品采购合同',
  'mock-002': 'IT基础设施运维服务合同',
  'mock-003': '中关村办公室租赁合同',
};

// 返回初始 Mock 评论数据（每次调用返回全新数组，互不影响）
export function getMockComments(): ContractComment[] {
  const now = Date.now();
  const hour = 3600 * 1000;
  return [
    {
      id: 'cmt-001',
      contract_id: 'mock-001',
      risk_id: undefined,
      user_id: 'u-legal-001',
      user_name: '张法务',
      user_role: '法务专员',
      content:
        '第3.2条预付款50%比例过高，建议调整为30%。@李经理 请确认是否与供应商重新协商。',
      mentions: ['李经理'],
      parent_id: undefined,
      resolved: false,
      created_at: new Date(now - hour * 5).toISOString(),
    },
    {
      id: 'cmt-002',
      contract_id: 'mock-001',
      risk_id: undefined,
      user_id: 'u-manager-001',
      user_name: '李经理',
      user_role: '法务经理',
      content: '同意张法务的意见，预付款比例需控制。已联系供应商，本周内反馈。',
      mentions: [],
      parent_id: 'cmt-001',
      resolved: false,
      created_at: new Date(now - hour * 4).toISOString(),
    },
    {
      id: 'cmt-003',
      contract_id: 'mock-001',
      risk_id: undefined,
      user_id: 'u-legal-001',
      user_name: '张法务',
      user_role: '法务专员',
      content: '违约责任条款缺少违约金上限，需要补充明确金额或计算方式。',
      mentions: [],
      parent_id: undefined,
      resolved: true,
      created_at: new Date(now - hour * 24).toISOString(),
    },
    {
      id: 'cmt-004',
      contract_id: 'mock-002',
      risk_id: undefined,
      user_id: 'u-biz-001',
      user_name: '王业务',
      user_role: '业务部门',
      content: '服务合同中SLA响应时间约定为48小时偏长，建议缩短至4小时。@张法务',
      mentions: ['张法务'],
      parent_id: undefined,
      resolved: false,
      created_at: new Date(now - hour * 12).toISOString(),
    },
    {
      id: 'cmt-005',
      contract_id: 'mock-002',
      risk_id: undefined,
      user_id: 'u-legal-001',
      user_name: '张法务',
      user_role: '法务专员',
      content: '已与云图技术服务方沟通，SLA响应时间可调整为4小时，正在修改条款。',
      mentions: [],
      parent_id: 'cmt-004',
      resolved: false,
      created_at: new Date(now - hour * 8).toISOString(),
    },
  ];
}
