'use client';

import { useState, useEffect } from 'react';
import {
  Users,
  Shield,
  Mail,
  Clock,
  CheckCircle,
  UserCog,
  Filter,
} from 'lucide-react';
import { TeamMember, SystemRole, ROLE_LABELS } from '@/lib/types';

// ===== 团队成员管理组件 =====
// 列表展示团队成员，支持按角色筛选与直接在行内修改角色

// 团队统计结构（修改角色后由父组件刷新）
interface TeamStats {
  total: number;
  activeCount: number;
  byRole: Record<SystemRole, number>;
  byDepartment: Record<string, number>;
}

interface TeamMemberListProps {
  members: TeamMember[];
  onMembersChange?: (members: TeamMember[], stats: TeamStats) => void;
}

// 角色标签样式
const ROLE_BADGE: Record<SystemRole, string> = {
  admin: 'bg-purple-50 text-purple-700 border-purple-100',
  legal_manager: 'bg-blue-50 text-blue-700 border-blue-100',
  legal_reviewer: 'bg-cyan-50 text-cyan-700 border-cyan-100',
  business_user: 'bg-amber-50 text-amber-700 border-amber-100',
  viewer: 'bg-slate-100 text-slate-600 border-slate-200',
};

// 角色下拉项顺序
const ROLE_OPTIONS: SystemRole[] = [
  'admin',
  'legal_manager',
  'legal_reviewer',
  'business_user',
  'viewer',
];

// 相对时间格式化
function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const diff = Date.now() - date.getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) return '刚刚';
  if (diff < hour) return `${Math.floor(diff / minute)} 分钟前`;
  if (diff < day) return `${Math.floor(diff / hour)} 小时前`;
  if (diff < day * 30) return `${Math.floor(diff / day)} 天前`;
  return date.toLocaleDateString('zh-CN');
}

export default function TeamMemberList({
  members,
  onMembersChange,
}: TeamMemberListProps) {
  const [memberList, setMemberList] = useState<TeamMember[]>(members);
  const [roleFilter, setRoleFilter] = useState<SystemRole | 'all'>('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 父组件数据变化时同步本地列表（如首次加载或外部刷新）
  useEffect(() => {
    setMemberList(members);
  }, [members]);

  // 按角色筛选
  const filtered =
    roleFilter === 'all'
      ? memberList
      : memberList.filter((m) => m.role === roleFilter);

  // 修改成员角色
  const handleRoleChange = async (
    member: TeamMember,
    newRole: SystemRole
  ) => {
    if (newRole === member.role) return;
    setUpdatingId(member.id);
    setError(null);
    try {
      const res = await fetch('/api/rbac', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_role',
          member_id: member.id,
          role: newRole,
        }),
      });
      if (!res.ok) throw new Error('修改角色失败');
      const data = await res.json();
      setMemberList(data.members || []);
      if (onMembersChange && data.stats) {
        onMembersChange(data.members, data.stats);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '修改角色失败');
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* 头部：标题 + 角色筛选 */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-100">
        <div className="flex items-center gap-2 min-w-0">
          <Users className="w-4 h-4 text-brand-600 shrink-0" />
          <h3 className="text-sm font-semibold text-slate-800 truncate">
            团队成员
          </h3>
          <span className="text-xs text-slate-400 shrink-0">
            · {filtered.length}/{memberList.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={roleFilter}
            onChange={(e) =>
              setRoleFilter(e.target.value as SystemRole | 'all')
            }
            className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400"
          >
            <option value="all">全部角色</option>
            {ROLE_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="mx-4 mt-3 p-2.5 rounded-lg bg-red-50 text-red-600 text-xs">
          {error}
        </div>
      )}

      {/* 成员列表表格 */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50/60 text-xs text-slate-400">
              <th className="text-left px-4 py-2 font-medium whitespace-nowrap">
                成员
              </th>
              <th className="text-left px-3 py-2 font-medium whitespace-nowrap">
                部门
              </th>
              <th className="text-center px-3 py-2 font-medium whitespace-nowrap">
                审查数
              </th>
              <th className="text-center px-3 py-2 font-medium whitespace-nowrap">
                待审批
              </th>
              <th className="text-center px-3 py-2 font-medium whitespace-nowrap">
                状态
              </th>
              <th className="text-left px-3 py-2 font-medium whitespace-nowrap">
                最后活跃
              </th>
              <th className="text-left px-3 py-2 font-medium whitespace-nowrap min-w-[140px]">
                角色
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-10 text-center text-slate-400 text-sm"
                >
                  暂无符合条件的成员
                </td>
              </tr>
            ) : (
              filtered.map((m) => {
                const isUpdating = updatingId === m.id;
                return (
                  <tr
                    key={m.id}
                    className="border-t border-slate-100 hover:bg-slate-50/50 transition-colors"
                  >
                    {/* 成员：头像 + 姓名 + 邮箱 */}
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium shrink-0"
                          style={{ backgroundColor: m.avatar_color }}
                        >
                          {m.name.slice(-2)}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-slate-700 truncate">
                            {m.name}
                          </div>
                          <div className="flex items-center gap-1 text-[11px] text-slate-400 truncate">
                            <Mail className="w-3 h-3 shrink-0" />
                            <span className="truncate">{m.email}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    {/* 部门 */}
                    <td className="px-3 py-2.5 text-xs text-slate-600 whitespace-nowrap">
                      {m.department_name}
                    </td>
                    {/* 审查数 */}
                    <td className="px-3 py-2.5 text-center text-xs text-slate-700 font-medium">
                      {m.contracts_reviewed}
                    </td>
                    {/* 待审批数 */}
                    <td className="px-3 py-2.5 text-center">
                      {m.pending_approvals > 0 ? (
                        <span className="inline-flex items-center justify-center min-w-[20px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 text-xs font-medium">
                          {m.pending_approvals}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-300">-</span>
                      )}
                    </td>
                    {/* 状态 */}
                    <td className="px-3 py-2.5 text-center">
                      {m.status === 'active' ? (
                        <span className="inline-flex items-center gap-1 text-xs text-green-600">
                          <CheckCircle className="w-3.5 h-3.5" />
                          活跃
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                          <Clock className="w-3.5 h-3.5" />
                          停用
                        </span>
                      )}
                    </td>
                    {/* 最后活跃 */}
                    <td className="px-3 py-2.5 text-[11px] text-slate-400 whitespace-nowrap">
                      {formatRelativeTime(m.last_active)}
                    </td>
                    {/* 角色下拉（行内修改） */}
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded border ${
                            ROLE_BADGE[m.role]
                          }`}
                        >
                          <Shield className="w-3 h-3" />
                          {ROLE_LABELS[m.role]}
                        </span>
                        <select
                          value={m.role}
                          disabled={isUpdating}
                          onChange={(e) =>
                            handleRoleChange(
                              m,
                              e.target.value as SystemRole
                            )
                          }
                          className="text-[11px] border border-slate-200 rounded-md px-1.5 py-1 bg-white text-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400 disabled:opacity-50 disabled:cursor-not-allowed"
                          title="修改角色"
                        >
                          {ROLE_OPTIONS.map((r) => (
                            <option key={r} value={r}>
                              {ROLE_LABELS[r]}
                            </option>
                          ))}
                        </select>
                        {isUpdating && (
                          <UserCog className="w-3.5 h-3.5 text-brand-500 animate-pulse" />
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
