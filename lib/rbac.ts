// ===== 角色权限管理模块（RBAC） =====
// 提供团队成员、部门、权限矩阵的 Mock 数据与权限判定能力
// 供 RBAC API 与角色权限管理页面共用

import {
  SystemRole,
  Permission,
  RolePermission,
  TeamMember,
  Department,
  AccessControlEntry,
  ROLE_LABELS,
  PERMISSION_LABELS,
  ROLE_PERMISSIONS,
} from './types';

// 一天的毫秒数
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// 生成距离今天指定天数的 ISO 时间字符串
function daysAgo(days: number): string {
  return new Date(Date.now() - days * ONE_DAY_MS).toISOString();
}

// 生成距离今天指定小时数的 ISO 时间字符串
function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

// 头像品牌色候选（与 Tailwind 调色板对齐的十六进制值）
const AVATAR_COLORS: string[] = [
  '#7c3aed', // brand-600 紫
  '#2563eb', // blue-600 蓝
  '#dc2626', // red-600 红
  '#d97706', // amber-600 琥珀
  '#16a34a', // green-600 绿
  '#0891b2', // cyan-600 青
  '#db2777', // pink-600 粉
  '#4f46e5', // indigo-600 靛
];

// ===== Mock 部门数据 =====
// 返回 5 个部门，覆盖法务、业务、采购、IT 与行政
export function getMockDepartments(): Department[] {
  return [
    {
      id: 'dept-legal',
      name: '法务部',
      parent_id: undefined,
      member_count: 3,
      contract_count: 128,
    },
    {
      id: 'dept-business',
      name: '业务部',
      parent_id: undefined,
      member_count: 2,
      contract_count: 86,
    },
    {
      id: 'dept-procurement',
      name: '采购部',
      parent_id: undefined,
      member_count: 1,
      contract_count: 54,
    },
    {
      id: 'dept-it',
      name: 'IT部',
      parent_id: undefined,
      member_count: 1,
      contract_count: 12,
    },
    {
      id: 'dept-admin',
      name: '行政部',
      parent_id: undefined,
      member_count: 1,
      contract_count: 9,
    },
  ];
}

// ===== Mock 团队成员数据 =====
// 返回 8 个成员，覆盖全部 5 种角色，分属 4 个部门
export function getMockTeamMembers(): TeamMember[] {
  return [
    {
      id: 'member-001',
      name: '张伟',
      email: 'zhangwei@company.com',
      role: 'admin',
      department_id: 'dept-it',
      department_name: 'IT部',
      avatar_color: AVATAR_COLORS[7], // indigo
      contracts_reviewed: 0,
      pending_approvals: 0,
      last_active: hoursAgo(1),
      status: 'active',
    },
    {
      id: 'member-002',
      name: '李娜',
      email: 'lina@company.com',
      role: 'legal_manager',
      department_id: 'dept-legal',
      department_name: '法务部',
      avatar_color: AVATAR_COLORS[0], // brand 紫
      contracts_reviewed: 156,
      pending_approvals: 4,
      last_active: hoursAgo(2),
      status: 'active',
    },
    {
      id: 'member-003',
      name: '王芳',
      email: 'wangfang@company.com',
      role: 'legal_reviewer',
      department_id: 'dept-legal',
      department_name: '法务部',
      avatar_color: AVATAR_COLORS[5], // cyan
      contracts_reviewed: 203,
      pending_approvals: 2,
      last_active: hoursAgo(5),
      status: 'active',
    },
    {
      id: 'member-004',
      name: '刘强',
      email: 'liuqiang@company.com',
      role: 'legal_reviewer',
      department_id: 'dept-legal',
      department_name: '法务部',
      avatar_color: AVATAR_COLORS[2], // red
      contracts_reviewed: 98,
      pending_approvals: 1,
      last_active: daysAgo(1),
      status: 'active',
    },
    {
      id: 'member-005',
      name: '陈静',
      email: 'chenjing@company.com',
      role: 'business_user',
      department_id: 'dept-business',
      department_name: '业务部',
      avatar_color: AVATAR_COLORS[3], // amber
      contracts_reviewed: 67,
      pending_approvals: 3,
      last_active: hoursAgo(8),
      status: 'active',
    },
    {
      id: 'member-006',
      name: '赵磊',
      email: 'zhaolei@company.com',
      role: 'business_user',
      department_id: 'dept-procurement',
      department_name: '采购部',
      avatar_color: AVATAR_COLORS[4], // green
      contracts_reviewed: 45,
      pending_approvals: 2,
      last_active: daysAgo(2),
      status: 'active',
    },
    {
      id: 'member-007',
      name: '孙洋',
      email: 'sunyang@company.com',
      role: 'viewer',
      department_id: 'dept-business',
      department_name: '业务部',
      avatar_color: AVATAR_COLORS[1], // blue
      contracts_reviewed: 12,
      pending_approvals: 0,
      last_active: daysAgo(3),
      status: 'active',
    },
    {
      id: 'member-008',
      name: '周敏',
      email: 'zhoumin@company.com',
      role: 'viewer',
      department_id: 'dept-admin',
      department_name: '行政部',
      avatar_color: AVATAR_COLORS[6], // pink
      contracts_reviewed: 5,
      pending_approvals: 0,
      last_active: daysAgo(14),
      status: 'inactive',
    },
  ];
}

// ===== Mock 权限分配记录（资源级 ACL） =====
// 返回 4 条资源级权限分配记录
export function getMockAccessControlEntries(): AccessControlEntry[] {
  return [
    {
      id: 'acl-001',
      resource_type: 'contract',
      resource_id: 'contract-2026-001',
      resource_name: 'XX产品采购合同',
      principal_type: 'role',
      principal_id: 'legal_manager',
      principal_name: '法务经理',
      permissions: ['contract:read', 'contract:write', 'review:approve'],
      created_at: daysAgo(10),
    },
    {
      id: 'acl-002',
      resource_type: 'template',
      resource_id: 'tpl-purchase',
      resource_name: '产品采购合同模板',
      principal_type: 'department',
      principal_id: 'dept-procurement',
      principal_name: '采购部',
      permissions: ['contract:read', 'contract:write'],
      created_at: daysAgo(20),
    },
    {
      id: 'acl-003',
      resource_type: 'rule',
      resource_id: 'rule-payment-001',
      resource_name: '预付款比例规则',
      principal_type: 'user',
      principal_id: 'member-002',
      principal_name: '李娜',
      permissions: ['rules:manage'],
      created_at: daysAgo(7),
    },
    {
      id: 'acl-004',
      resource_type: 'webhook',
      resource_id: 'wh-001',
      resource_name: '风险预警 Webhook',
      principal_type: 'role',
      principal_id: 'admin',
      principal_name: '系统管理员',
      permissions: ['webhook:manage', 'audit:read'],
      created_at: daysAgo(15),
    },
  ];
}

// ===== 权限查询能力 =====

// 获取指定角色拥有的全部权限列表
export function getPermissionsForRole(role: SystemRole): Permission[] {
  const entry: RolePermission | undefined = ROLE_PERMISSIONS.find(
    (r) => r.role === role
  );
  return entry ? [...entry.permissions] : [];
}

// 检查指定角色是否拥有某项权限
export function hasPermission(
  role: SystemRole,
  permission: Permission
): boolean {
  return getPermissionsForRole(role).includes(permission);
}

// ===== 角色-权限矩阵 =====
// 生成行=角色、列=权限的矩阵数据，便于表格化渲染
export function getRoleMatrix(): {
  role: SystemRole;
  roleLabel: string;
  description: string;
  permissions: { permission: Permission; label: string; granted: boolean }[];
}[] {
  // 按固定顺序排列全部权限
  const allPermissions = Object.keys(PERMISSION_LABELS) as Permission[];

  return (Object.keys(ROLE_LABELS) as SystemRole[]).map((role) => {
    const granted = getPermissionsForRole(role);
    const entry = ROLE_PERMISSIONS.find((r) => r.role === role);
    return {
      role,
      roleLabel: ROLE_LABELS[role],
      description: entry?.description || '',
      permissions: allPermissions.map((permission) => ({
        permission,
        label: PERMISSION_LABELS[permission],
        granted: granted.includes(permission),
      })),
    };
  });
}

// ===== 团队成员统计 =====
// 汇总总人数、活跃人数、各角色与各部门分布
export function getTeamStats(members: TeamMember[]): {
  total: number;
  activeCount: number;
  byRole: Record<SystemRole, number>;
  byDepartment: Record<string, number>;
} {
  // 初始化各角色计数为 0，确保未出现角色也有计数
  const byRole = (Object.keys(ROLE_LABELS) as SystemRole[]).reduce(
    (acc, role) => {
      acc[role] = 0;
      return acc;
    },
    {} as Record<SystemRole, number>
  );

  const byDepartment: Record<string, number> = {};

  for (const m of members) {
    byRole[m.role] = (byRole[m.role] || 0) + 1;
    byDepartment[m.department_name] =
      (byDepartment[m.department_name] || 0) + 1;
  }

  return {
    total: members.length,
    activeCount: members.filter((m) => m.status === 'active').length,
    byRole,
    byDepartment,
  };
}

// 重新导出标签配置，方便页面统一引用
export { ROLE_LABELS, PERMISSION_LABELS, ROLE_PERMISSIONS };
