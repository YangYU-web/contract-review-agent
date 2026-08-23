'use client';

// ===== 角色权限管理页面 =====
// 客户端组件：统计卡片 + 权限矩阵 + 团队成员列表 + 权限说明

import { useState, useEffect, useCallback } from 'react';
import { Shield, Users, Lock, KeyRound, XCircle } from 'lucide-react';
import PermissionMatrix from '@/components/PermissionMatrix';
import TeamMemberList from '@/components/TeamMemberList';
import {
  SystemRole,
  TeamMember,
  Department,
  ROLE_LABELS,
  PERMISSION_LABELS,
  ROLE_PERMISSIONS,
} from '@/lib/types';

// 权限矩阵行结构
interface MatrixPermission {
  permission: keyof typeof PERMISSION_LABELS;
  label: string;
  granted: boolean;
}
interface MatrixRow {
  role: SystemRole;
  roleLabel: string;
  description: string;
  permissions: MatrixPermission[];
}

// 团队统计结构
interface TeamStats {
  total: number;
  activeCount: number;
  byRole: Record<SystemRole, number>;
  byDepartment: Record<string, number>;
}

export default function RbacPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [matrix, setMatrix] = useState<MatrixRow[]>([]);
  const [stats, setStats] = useState<TeamStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/rbac', { cache: 'no-store' });
      if (!res.ok) throw new Error('加载数据失败');
      const data = await res.json();
      setMembers(data.members || []);
      setDepartments(data.departments || []);
      setMatrix(data.matrix || []);
      setStats(data.stats || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载数据失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // 成员变更回调：同步成员列表与统计（角色分布随之刷新）
  const handleMembersChange = (
    nextMembers: TeamMember[],
    nextStats: TeamStats
  ) => {
    setMembers(nextMembers);
    setStats(nextStats);
  };

  // 顶部统计卡片
  const statCards = [
    {
      label: '团队成员',
      value: stats?.total ?? 0,
      icon: Users,
      color: 'text-brand-600',
      bg: 'bg-brand-50',
    },
    {
      label: '活跃用户',
      value: stats?.activeCount ?? 0,
      icon: Shield,
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
    {
      label: '角色种类',
      value: stats ? Object.keys(ROLE_LABELS).length : 0,
      icon: KeyRound,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: '部门数量',
      value: stats ? Object.keys(stats.byDepartment).length : 0,
      icon: Lock,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* 页头 */}
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="w-6 h-6 text-brand-600" />
            角色权限管理
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            统一管理团队成员、角色与权限分配，保障合同审查流程的安全合规
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-slate-200">
          <Lock className="w-4 h-4 text-brand-600" />
          <span className="text-xs text-slate-500">演示模式</span>
          <span className="text-xs text-slate-300">·</span>
          <span className="text-xs text-slate-400">
            {members.length} 位成员 / {departments.length} 个部门
          </span>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-600 text-sm flex items-center gap-2">
          <XCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-red-400 hover:text-red-600"
          >
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 顶部统计卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="bg-white rounded-xl border border-slate-200 p-4"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-lg ${card.bg} flex items-center justify-center`}
                >
                  <Icon className={`w-5 h-5 ${card.color}`} />
                </div>
                <div>
                  <div className="text-2xl font-bold text-slate-800">
                    {card.value}
                  </div>
                  <div className="text-xs text-slate-400">{card.label}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {loading ? (
        <div className="py-20 text-center text-sm text-slate-400">
          加载中...
        </div>
      ) : (
        <div className="space-y-6">
          {/* 左右布局：权限矩阵 + 团队成员 */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5">
              <PermissionMatrix matrix={matrix} stats={stats} />
            </div>
            <div className="lg:col-span-7">
              <TeamMemberList
                members={members}
                onMembersChange={handleMembersChange}
              />
            </div>
          </div>

          {/* 底部：权限说明 */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="flex items-center gap-2 mb-4">
              <KeyRound className="w-4 h-4 text-brand-600" />
              <h2 className="font-semibold text-slate-800">权限说明</h2>
              <span className="text-xs text-slate-400">· 各角色权限描述</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {ROLE_PERMISSIONS.map((rp) => {
                const totalPerms = Object.keys(PERMISSION_LABELS).length;
                return (
                  <div
                    key={rp.role}
                    className="rounded-xl border border-slate-200 p-4 hover:border-brand-200 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-brand-500" />
                        <span className="text-sm font-semibold text-slate-800">
                          {ROLE_LABELS[rp.role]}
                        </span>
                      </div>
                      <span className="text-xs text-slate-400">
                        {rp.permissions.length}/{totalPerms} 项权限
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mb-2">
                      {rp.description}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {rp.permissions.map((p) => (
                        <span
                          key={p}
                          className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded bg-slate-50 text-slate-500 border border-slate-100"
                        >
                          {PERMISSION_LABELS[p]}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
