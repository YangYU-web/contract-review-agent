'use client';

import { Check, Minus, Shield, Users, Lock, Eye } from 'lucide-react';
import { SystemRole, Permission, ROLE_LABELS } from '@/lib/types';

// ===== 权限矩阵组件 =====
// 行=角色，列=权限；有权限显示绿色 Check，无权限显示灰色 Minus
// 顶部展示总用户数、活跃用户与角色分布统计

// 权限矩阵行数据结构
interface MatrixPermission {
  permission: Permission;
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

interface PermissionMatrixProps {
  matrix: MatrixRow[];
  stats: TeamStats | null;
}

// 角色主题色（用于行首角色标识）
const ROLE_THEME: Record<
  SystemRole,
  { dot: string; badge: string; bar: string }
> = {
  admin: {
    dot: 'bg-purple-500',
    badge: 'bg-purple-50 text-purple-700',
    bar: 'bg-purple-500',
  },
  legal_manager: {
    dot: 'bg-blue-500',
    badge: 'bg-blue-50 text-blue-700',
    bar: 'bg-blue-500',
  },
  legal_reviewer: {
    dot: 'bg-cyan-500',
    badge: 'bg-cyan-50 text-cyan-700',
    bar: 'bg-cyan-500',
  },
  business_user: {
    dot: 'bg-amber-500',
    badge: 'bg-amber-50 text-amber-700',
    bar: 'bg-amber-500',
  },
  viewer: {
    dot: 'bg-slate-400',
    badge: 'bg-slate-100 text-slate-600',
    bar: 'bg-slate-400',
  },
};

export default function PermissionMatrix({
  matrix,
  stats,
}: PermissionMatrixProps) {
  // 全部权限列（取第一行的 permissions 顺序）
  const allPermissions: MatrixPermission[] =
    matrix[0]?.permissions || [];

  // 顶部统计卡片
  const statCards = [
    {
      label: '总用户数',
      value: stats?.total ?? 0,
      icon: Users,
      color: 'text-brand-600',
      bg: 'bg-brand-50',
    },
    {
      label: '活跃用户',
      value: stats?.activeCount ?? 0,
      icon: Eye,
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
    {
      label: '角色种类',
      value: stats ? Object.keys(ROLE_LABELS).length : 0,
      icon: Shield,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: '权限项数',
      value: allPermissions.length,
      icon: Lock,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
  ];

  return (
    <div className="space-y-4">
      {/* 顶部统计卡片 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="bg-white rounded-xl border border-slate-200 p-3"
            >
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-8 h-8 rounded-lg ${card.bg} flex items-center justify-center shrink-0`}
                >
                  <Icon className={`w-4 h-4 ${card.color}`} />
                </div>
                <div className="min-w-0">
                  <div className="text-xl font-bold text-slate-800 leading-tight">
                    {card.value}
                  </div>
                  <div className="text-[11px] text-slate-400 truncate">
                    {card.label}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 角色分布条 */}
      {stats && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-brand-600" />
            <h3 className="text-sm font-semibold text-slate-800">角色分布</h3>
          </div>
          <div className="space-y-2">
            {(Object.keys(ROLE_LABELS) as SystemRole[]).map((role) => {
              const count = stats.byRole[role] || 0;
              const total = stats.total || 1;
              const pct = Math.round((count / total) * 100);
              const theme = ROLE_THEME[role];
              return (
                <div key={role} className="flex items-center gap-2 text-xs">
                  <span className="w-20 shrink-0 text-slate-500">
                    {ROLE_LABELS[role]}
                  </span>
                  <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${theme.bar} transition-all`}
                      style={{ width: `${Math.max(pct, count > 0 ? 6 : 0)}%` }}
                    />
                  </div>
                  <span className="w-14 shrink-0 text-right text-slate-600">
                    {count} 人 · {pct}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 权限矩阵表格 */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
          <Shield className="w-4 h-4 text-brand-600" />
          <h3 className="text-sm font-semibold text-slate-800">权限矩阵</h3>
          <span className="text-xs text-slate-400">
            · 行为角色，列为权限项
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50/60">
                <th className="text-left px-4 py-2.5 font-medium text-slate-500 whitespace-nowrap sticky left-0 bg-slate-50/60 z-10">
                  角色
                </th>
                {allPermissions.map((col) => (
                  <th
                    key={col.permission}
                    className="px-2 py-2.5 font-medium text-slate-500 text-center min-w-[88px]"
                    title={col.label}
                  >
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="text-[11px] leading-tight">
                        {col.label}
                      </span>
                    </div>
                  </th>
                ))}
                <th className="px-3 py-2.5 font-medium text-slate-500 text-center min-w-[60px]">
                  合计
                </th>
              </tr>
            </thead>
            <tbody>
              {matrix.map((row) => {
                const grantedCount = row.permissions.filter(
                  (p) => p.granted
                ).length;
                const theme = ROLE_THEME[row.role];
                return (
                  <tr
                    key={row.role}
                    className="border-t border-slate-100 hover:bg-slate-50/50 transition-colors"
                  >
                    <td className="px-4 py-2.5 sticky left-0 bg-white z-10">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2 h-2 rounded-full ${theme.dot}`}
                        />
                        <div className="min-w-0">
                          <div className="font-medium text-slate-700 text-xs whitespace-nowrap">
                            {row.roleLabel}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate max-w-[120px]">
                            {row.description}
                          </div>
                        </div>
                      </div>
                    </td>
                    {row.permissions.map((cell) => (
                      <td
                        key={cell.permission}
                        className="px-2 py-2.5 text-center"
                      >
                        {cell.granted ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-50">
                            <Check className="w-3.5 h-3.5 text-green-600" />
                          </span>
                        ) : (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-50">
                            <Minus className="w-3.5 h-3.5 text-slate-300" />
                          </span>
                        )}
                      </td>
                    ))}
                    <td className="px-3 py-2.5 text-center">
                      <span
                        className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full ${theme.badge}`}
                      >
                        {grantedCount}/{row.permissions.length}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* 图例 */}
        <div className="flex items-center gap-4 px-4 py-2.5 border-t border-slate-100 text-[11px] text-slate-400">
          <span className="flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5 text-green-600" />
            已授权
          </span>
          <span className="flex items-center gap-1.5">
            <Minus className="w-3.5 h-3.5 text-slate-300" />
            未授权
          </span>
        </div>
      </div>
    </div>
  );
}
