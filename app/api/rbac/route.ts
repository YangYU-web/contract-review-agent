// ===== 角色权限管理 API（RBAC） =====
// 提供团队成员、部门、权限矩阵的查询，以及成员管理与角色更新能力
// 数据存储：优先使用 Supabase 数据库（team_members / departments / access_control），
// 数据库未配置或操作失败时优雅降级到内存 Mock 数据

import { NextRequest, NextResponse } from 'next/server';
import {
  SystemRole,
  TeamMember,
  Department,
  AccessControlEntry,
  Permission,
} from '@/lib/types';
import {
  getMockTeamMembers,
  getMockDepartments,
  getMockAccessControlEntries,
  getRoleMatrix,
  getTeamStats,
} from '@/lib/rbac';
import { isSupabaseConfigured } from '@/lib/supabase';

// 模块级内存存储（演示模式降级时使用）：初始化为 Mock 数据
let membersStore: TeamMember[] = getMockTeamMembers();
let departmentsStore: Department[] = getMockDepartments();

// 有效的角色集合
const VALID_ROLES: SystemRole[] = [
  'admin',
  'legal_manager',
  'legal_reviewer',
  'business_user',
  'viewer',
];

// 头像品牌色候选
const AVATAR_COLORS: string[] = [
  '#7c3aed',
  '#2563eb',
  '#dc2626',
  '#d97706',
  '#16a34a',
  '#0891b2',
  '#db2777',
  '#4f46e5',
];

// ===== DB 行 -> TeamMember 映射 =====
function mapMember(row: Record<string, any>): TeamMember {
  return {
    id: String(row.id),
    name: row.name,
    email: row.email,
    role: row.role as SystemRole,
    department_id: row.department_id ?? '',
    department_name: row.department_name ?? '',
    avatar_color: row.avatar_color ?? '#7c3aed',
    contracts_reviewed: row.contracts_reviewed ?? 0,
    pending_approvals: row.pending_approvals ?? 0,
    last_active: row.last_active ?? row.created_at ?? new Date().toISOString(),
    status: row.status ?? 'active',
  };
}

// ===== DB 行 -> Department 映射 =====
function mapDepartment(row: Record<string, any>): Department {
  return {
    id: String(row.id),
    name: row.name,
    parent_id: row.parent_id ?? undefined,
    member_count: row.member_count ?? 0,
    contract_count: row.contract_count ?? 0,
  };
}

// ===== DB 行 -> AccessControlEntry 映射 =====
function mapAccessControl(row: Record<string, any>): AccessControlEntry {
  return {
    id: String(row.id),
    resource_type: row.resource_type,
    resource_id: String(row.resource_id),
    resource_name: row.resource_name ?? '',
    principal_type: row.principal_type,
    principal_id: row.principal_id,
    principal_name: row.principal_name ?? '',
    permissions: (row.permissions ?? []) as Permission[],
    created_at: row.created_at,
  };
}

// GET: 返回团队成员、部门、权限矩阵与统计
export async function GET() {
  try {
    const matrix = getRoleMatrix();

    if (isSupabaseConfigured()) {
      try {
        const { getSupabaseServer } = await import('@/lib/supabase');
        const supabase = getSupabaseServer();
        if (supabase) {
          const [membersRes, deptsRes, aclRes] = await Promise.all([
            supabase
              .from('team_members')
              .select('*')
              .order('created_at', { ascending: false }),
            supabase
              .from('departments')
              .select('*')
              .order('created_at', { ascending: false }),
            supabase
              .from('access_control')
              .select('*')
              .order('created_at', { ascending: false }),
          ]);

          if (membersRes.error) throw membersRes.error;
          if (deptsRes.error) throw deptsRes.error;
          if (aclRes.error) throw aclRes.error;

          const members = (membersRes.data ?? []).map(mapMember);
          const departments = (deptsRes.data ?? []).map(mapDepartment);
          const accessControl = (aclRes.data ?? []).map(mapAccessControl);

          return NextResponse.json({
            members,
            departments,
            matrix,
            stats: getTeamStats(members),
            accessControl,
            roles: VALID_ROLES,
            mock: false,
          });
        }
      } catch (dbErr) {
        console.error('RBAC DB 查询失败，降级到 Mock 数据:', dbErr);
      }
    }

    // 降级：内存 Mock 数据
    const stats = getTeamStats(membersStore);
    const accessControl = getMockAccessControlEntries();

    return NextResponse.json({
      members: membersStore,
      departments: departmentsStore,
      matrix,
      stats,
      accessControl,
      roles: VALID_ROLES,
      mock: true,
    });
  } catch (err) {
    console.error('RBAC GET error:', err);
    return NextResponse.json(
      { error: `服务器错误: ${err instanceof Error ? err.message : '未知错误'}` },
      { status: 500 }
    );
  }
}

// POST: 管理成员与权限
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'update_role') {
      // ===== 修改成员角色 =====
      const { member_id, role } = body;
      if (!member_id) {
        return NextResponse.json(
          { error: '缺少 member_id 参数' },
          { status: 400 }
        );
      }
      if (!role || !VALID_ROLES.includes(role)) {
        return NextResponse.json(
          { error: `role 无效，需为 ${VALID_ROLES.join(' / ')}` },
          { status: 400 }
        );
      }

      if (isSupabaseConfigured()) {
        try {
          const { getSupabaseServer } = await import('@/lib/supabase');
          const supabase = getSupabaseServer();
          if (supabase) {
            const { error: updateError } = await supabase
              .from('team_members')
              .update({ role: role as SystemRole })
              .eq('id', member_id);
            if (updateError) throw updateError;

            const { data: membersData, error: mErr } = await supabase
              .from('team_members')
              .select('*')
              .order('created_at', { ascending: false });
            if (mErr) throw mErr;

            const members = (membersData ?? []).map(mapMember);
            const updated = members.find((m) => m.id === String(member_id));
            if (!updated) {
              return NextResponse.json(
                { error: '成员不存在' },
                { status: 404 }
              );
            }

            return NextResponse.json({
              member: updated,
              members,
              stats: getTeamStats(members),
              mock: false,
            });
          }
        } catch (dbErr) {
          console.error('RBAC update_role DB 失败，降级到 Mock:', dbErr);
        }
      }

      // 降级：内存操作
      const idx = membersStore.findIndex((m) => m.id === member_id);
      if (idx < 0) {
        return NextResponse.json({ error: '成员不存在' }, { status: 404 });
      }

      membersStore[idx] = {
        ...membersStore[idx],
        role: role as SystemRole,
      };

      return NextResponse.json({
        member: membersStore[idx],
        members: membersStore,
        stats: getTeamStats(membersStore),
        mock: true,
      });
    }

    if (action === 'create_member') {
      // ===== 创建新成员 =====
      const { name, email, role, department_id } = body;

      if (!name || typeof name !== 'string' || name.trim() === '') {
        return NextResponse.json(
          { error: '缺少 name 参数' },
          { status: 400 }
        );
      }
      if (!email || typeof email !== 'string' || email.trim() === '') {
        return NextResponse.json(
          { error: '缺少 email 参数' },
          { status: 400 }
        );
      }
      if (!role || !VALID_ROLES.includes(role)) {
        return NextResponse.json(
          { error: `role 无效，需为 ${VALID_ROLES.join(' / ')}` },
          { status: 400 }
        );
      }
      if (!department_id) {
        return NextResponse.json(
          { error: '缺少 department_id 参数' },
          { status: 400 }
        );
      }

      if (isSupabaseConfigured()) {
        try {
          const { getSupabaseServer } = await import('@/lib/supabase');
          const supabase = getSupabaseServer();
          if (supabase) {
            // 校验部门存在
            const { data: department, error: deptErr } = await supabase
              .from('departments')
              .select('*')
              .eq('id', department_id)
              .maybeSingle();
            if (deptErr) throw deptErr;
            if (!department) {
              return NextResponse.json(
                { error: '部门不存在' },
                { status: 404 }
              );
            }

            // 邮箱唯一性校验
            const { data: existing, error: exErr } = await supabase
              .from('team_members')
              .select('id')
              .eq('email', email.trim())
              .maybeSingle();
            if (exErr) throw exErr;
            if (existing) {
              return NextResponse.json(
                { error: '该邮箱已被使用' },
                { status: 400 }
              );
            }

            const now = new Date().toISOString();
            const avatar_color =
              AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

            const { data: inserted, error: insErr } = await supabase
              .from('team_members')
              .insert({
                user_id: null,
                name: name.trim(),
                email: email.trim(),
                role: role as SystemRole,
                department_id: department.id,
                department_name: department.name,
                avatar_color,
                status: 'active',
                contracts_reviewed: 0,
                pending_approvals: 0,
                last_active: now,
              })
              .select()
              .single();
            if (insErr) throw insErr;

            // 同步部门成员计数
            await supabase
              .from('departments')
              .update({
                member_count: (department.member_count ?? 0) + 1,
              })
              .eq('id', department.id);

            const { data: membersData } = await supabase
              .from('team_members')
              .select('*')
              .order('created_at', { ascending: false });
            const members = (membersData ?? []).map(mapMember);

            return NextResponse.json({
              member: mapMember(inserted),
              members,
              stats: getTeamStats(members),
              mock: false,
            });
          }
        } catch (dbErr) {
          console.error('RBAC create_member DB 失败，降级到 Mock:', dbErr);
        }
      }

      // 降级：内存操作
      const department = departmentsStore.find((d) => d.id === department_id);
      if (!department) {
        return NextResponse.json(
          { error: '部门不存在' },
          { status: 404 }
        );
      }

      // 邮箱唯一性校验
      if (membersStore.some((m) => m.email === email)) {
        return NextResponse.json(
          { error: '该邮箱已被使用' },
          { status: 400 }
        );
      }

      const now = new Date().toISOString();
      const newMember: TeamMember = {
        id: `member-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: name.trim(),
        email: email.trim(),
        role: role as SystemRole,
        department_id: department.id,
        department_name: department.name,
        avatar_color:
          AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
        contracts_reviewed: 0,
        pending_approvals: 0,
        last_active: now,
        status: 'active',
      };

      membersStore.push(newMember);
      // 同步部门成员计数
      department.member_count += 1;

      return NextResponse.json({
        member: newMember,
        members: membersStore,
        stats: getTeamStats(membersStore),
        mock: true,
      });
    }

    if (action === 'delete_member') {
      // ===== 删除成员 =====
      const { member_id } = body;
      if (!member_id) {
        return NextResponse.json(
          { error: '缺少 member_id 参数' },
          { status: 400 }
        );
      }

      if (isSupabaseConfigured()) {
        try {
          const { getSupabaseServer } = await import('@/lib/supabase');
          const supabase = getSupabaseServer();
          if (supabase) {
            const { data: member, error: mErr } = await supabase
              .from('team_members')
              .select('*')
              .eq('id', member_id)
              .maybeSingle();
            if (mErr) throw mErr;
            if (!member) {
              return NextResponse.json(
                { error: '成员不存在' },
                { status: 404 }
              );
            }

            const { error: delErr } = await supabase
              .from('team_members')
              .delete()
              .eq('id', member_id);
            if (delErr) throw delErr;

            // 同步部门成员计数
            if (member.department_id) {
              const { data: dept } = await supabase
                .from('departments')
                .select('*')
                .eq('id', member.department_id)
                .maybeSingle();
              if (dept) {
                await supabase
                  .from('departments')
                  .update({
                    member_count: Math.max(0, (dept.member_count ?? 0) - 1),
                  })
                  .eq('id', dept.id);
              }
            }

            const { data: membersData } = await supabase
              .from('team_members')
              .select('*')
              .order('created_at', { ascending: false });
            const members = (membersData ?? []).map(mapMember);

            return NextResponse.json({
              members,
              stats: getTeamStats(members),
              mock: false,
            });
          }
        } catch (dbErr) {
          console.error('RBAC delete_member DB 失败，降级到 Mock:', dbErr);
        }
      }

      // 降级：内存操作
      const idx = membersStore.findIndex((m) => m.id === member_id);
      if (idx < 0) {
        return NextResponse.json({ error: '成员不存在' }, { status: 404 });
      }

      const removed = membersStore[idx];
      membersStore.splice(idx, 1);

      // 同步部门成员计数
      const department = departmentsStore.find(
        (d) => d.id === removed.department_id
      );
      if (department && department.member_count > 0) {
        department.member_count -= 1;
      }

      return NextResponse.json({
        members: membersStore,
        stats: getTeamStats(membersStore),
        mock: true,
      });
    }

    return NextResponse.json(
      {
        error:
          "action 无效，需为 'update_role' / 'create_member' / 'delete_member'",
      },
      { status: 400 }
    );
  } catch (err) {
    console.error('RBAC POST error:', err);
    return NextResponse.json(
      { error: `服务器错误: ${err instanceof Error ? err.message : '未知错误'}` },
      { status: 500 }
    );
  }
}
