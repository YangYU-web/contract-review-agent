// ===== 合同起草助手 API =====
// 提供起草模板、项目列表查询，以及项目创建、条款添加与合同生成能力
// 数据存储：优先使用 Supabase 数据库（drafting_projects），
// 数据库未配置或操作失败时优雅降级到内存 Mock 数据

export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { DraftingProject, DraftedClause } from '@/lib/types';
import {
  getDraftingClauseTemplates,
  getDraftingProjects,
  generateContract,
  createDraftingProject,
} from '@/lib/contract-drafting';
import { isSupabaseConfigured } from '@/lib/supabase';

// 模块级内存存储（演示模式降级时使用）：初始化为 Mock 数据
let projectsStore: DraftingProject[] = getDraftingProjects();

// ===== DB 行 -> DraftingProject 映射 =====
function mapProject(row: Record<string, any>): DraftingProject {
  return {
    id: String(row.id),
    name: row.name,
    contract_type: row.contract_type,
    party_a: row.party_a ?? '',
    party_b: row.party_b ?? '',
    clauses: Array.isArray(row.clauses) ? (row.clauses as DraftedClause[]) : [],
    status: row.status ?? 'draft',
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// 按更新时间倒序排序
function sortByUpdated(list: DraftingProject[]): DraftingProject[] {
  return [...list].sort(
    (a, b) =>
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );
}

// 从数据库查询全部项目（按更新时间倒序）
async function fetchProjectsFromDb(): Promise<DraftingProject[] | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const { getSupabaseServer } = await import('@/lib/supabase');
    const supabase = getSupabaseServer();
    if (!supabase) return null;
    const { data, error } = await supabase
      .from('drafting_projects')
      .select('*')
      .order('updated_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapProject);
  } catch (dbErr) {
    console.error('Drafting DB 查询失败，降级到 Mock 数据:', dbErr);
    return null;
  }
}

// GET: 返回起草模板与项目列表
export async function GET() {
  try {
    const templates = getDraftingClauseTemplates();

    const dbProjects = await fetchProjectsFromDb();
    if (dbProjects) {
      return NextResponse.json({
        templates,
        projects: sortByUpdated(dbProjects),
        mock: false,
      });
    }

    // 降级：内存 Mock 数据
    const projects = sortByUpdated(projectsStore);
    return NextResponse.json({
      templates,
      projects,
      mock: true,
    });
  } catch (err) {
    console.error('Drafting GET error:', err);
    return NextResponse.json(
      { error: `服务器错误: ${err instanceof Error ? err.message : '未知错误'}` },
      { status: 500 }
    );
  }
}

// POST: 创建项目 / 生成合同 / 添加条款
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'create_project') {
      // ===== 创建新起草项目 =====
      const { name, contract_type, party_a, party_b } = body;

      if (!name || typeof name !== 'string' || name.trim() === '') {
        return NextResponse.json(
          { error: '缺少 name 参数' },
          { status: 400 }
        );
      }
      if (!party_a || !party_b) {
        return NextResponse.json(
          { error: '缺少甲方/乙方信息' },
          { status: 400 }
        );
      }

      if (isSupabaseConfigured()) {
        try {
          const { getSupabaseServer } = await import('@/lib/supabase');
          const supabase = getSupabaseServer();
          if (supabase) {
            const { data: inserted, error: insErr } = await supabase
              .from('drafting_projects')
              .insert({
                user_id: null,
                name: name.trim(),
                contract_type: contract_type || '其他合同',
                party_a: party_a.trim(),
                party_b: party_b.trim(),
                clauses: [],
                status: 'draft',
              })
              .select()
              .single();
            if (insErr) throw insErr;

            const project = mapProject(inserted);
            const dbProjects = await fetchProjectsFromDb();

            return NextResponse.json({
              project,
              projects: sortByUpdated(dbProjects ?? [project]),
              mock: false,
            });
          }
        } catch (dbErr) {
          console.error('Drafting create_project DB 失败，降级到 Mock:', dbErr);
        }
      }

      // 降级：内存操作
      const project = createDraftingProject(
        name.trim(),
        contract_type || '其他合同',
        party_a.trim(),
        party_b.trim()
      );
      projectsStore.unshift(project);

      return NextResponse.json({
        project,
        projects: sortByUpdated(projectsStore),
        mock: true,
      });
    }

    if (action === 'add_clause') {
      // ===== 向项目添加条款 =====
      const { project_id, clause_id } = body;
      if (!project_id) {
        return NextResponse.json(
          { error: '缺少 project_id 参数' },
          { status: 400 }
        );
      }
      if (!clause_id) {
        return NextResponse.json(
          { error: '缺少 clause_id 参数' },
          { status: 400 }
        );
      }

      const template = getDraftingClauseTemplates().find(
        (t) => t.id === clause_id
      );
      if (!template) {
        return NextResponse.json(
          { error: '条款模板不存在' },
          { status: 404 }
        );
      }

      if (isSupabaseConfigured()) {
        try {
          const { getSupabaseServer } = await import('@/lib/supabase');
          const supabase = getSupabaseServer();
          if (supabase) {
            const { data: projectRow, error: pErr } = await supabase
              .from('drafting_projects')
              .select('*')
              .eq('id', project_id)
              .maybeSingle();
            if (pErr) throw pErr;
            if (!projectRow) {
              return NextResponse.json(
                { error: '项目不存在' },
                { status: 404 }
              );
            }

            const existingClauses: DraftedClause[] = Array.isArray(
              projectRow.clauses
            )
              ? (projectRow.clauses as DraftedClause[])
              : [];

            // 已添加的同类型条款避免重复（custom 类型除外）
            if (
              template.clause_type !== 'custom' &&
              existingClauses.some(
                (c) => c.clause_type === template.clause_type
              )
            ) {
              return NextResponse.json(
                { error: '该类型条款已添加，请勿重复添加' },
                { status: 400 }
              );
            }

            // 复制一份模板，生成项目内唯一 id 避免变量映射冲突
            const clause: DraftedClause = {
              ...template,
              id: `clause-${project_id}-${Date.now()}-${Math.random()
                .toString(36)
                .slice(2, 6)}`,
            };

            const now = new Date().toISOString();
            const { data: updated, error: updErr } = await supabase
              .from('drafting_projects')
              .update({
                clauses: [...existingClauses, clause],
                updated_at: now,
              })
              .eq('id', project_id)
              .select()
              .single();
            if (updErr) throw updErr;

            return NextResponse.json({
              project: mapProject(updated),
              clause,
              mock: false,
            });
          }
        } catch (dbErr) {
          console.error('Drafting add_clause DB 失败，降级到 Mock:', dbErr);
        }
      }

      // 降级：内存操作
      const project = projectsStore.find((p) => p.id === project_id);
      if (!project) {
        return NextResponse.json(
          { error: '项目不存在' },
          { status: 404 }
        );
      }

      // 已添加的同类型条款避免重复（custom 类型除外）
      if (
        template.clause_type !== 'custom' &&
        project.clauses.some((c) => c.clause_type === template.clause_type)
      ) {
        return NextResponse.json(
          { error: '该类型条款已添加，请勿重复添加' },
          { status: 400 }
        );
      }

      // 复制一份模板，生成项目内唯一 id 避免变量映射冲突
      const clause: DraftedClause = {
        ...template,
        id: `clause-${project.id}-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 6)}`,
      };

      project.clauses.push(clause);
      project.updated_at = new Date().toISOString();

      return NextResponse.json({
        project,
        clause,
        mock: true,
      });
    }

    if (action === 'generate') {
      // ===== 生成完整合同文本 =====
      const { project_id, variables } = body;
      if (!project_id) {
        return NextResponse.json(
          { error: '缺少 project_id 参数' },
          { status: 400 }
        );
      }

      const filledVariables: Record<string, Record<string, string>> =
        variables || {};

      if (isSupabaseConfigured()) {
        try {
          const { getSupabaseServer } = await import('@/lib/supabase');
          const supabase = getSupabaseServer();
          if (supabase) {
            const { data: projectRow, error: pErr } = await supabase
              .from('drafting_projects')
              .select('*')
              .eq('id', project_id)
              .maybeSingle();
            if (pErr) throw pErr;
            if (!projectRow) {
              return NextResponse.json(
                { error: '项目不存在' },
                { status: 404 }
              );
            }

            const project = mapProject(projectRow);
            const contractText = generateContract(project, filledVariables);

            const now = new Date().toISOString();
            await supabase
              .from('drafting_projects')
              .update({ updated_at: now })
              .eq('id', project_id);
            project.updated_at = now;

            return NextResponse.json({
              contract_text: contractText,
              project,
              mock: false,
            });
          }
        } catch (dbErr) {
          console.error('Drafting generate DB 失败，降级到 Mock:', dbErr);
        }
      }

      // 降级：内存操作
      const project = projectsStore.find((p) => p.id === project_id);
      if (!project) {
        return NextResponse.json(
          { error: '项目不存在' },
          { status: 404 }
        );
      }

      const contractText = generateContract(project, filledVariables);

      project.updated_at = new Date().toISOString();

      return NextResponse.json({
        contract_text: contractText,
        project,
        mock: true,
      });
    }

    return NextResponse.json(
      {
        error:
          "action 无效，需为 'create_project' / 'add_clause' / 'generate'",
      },
      { status: 400 }
    );
  } catch (err) {
    console.error('Drafting POST error:', err);
    return NextResponse.json(
      { error: `服务器错误: ${err instanceof Error ? err.message : '未知错误'}` },
      { status: 500 }
    );
  }
}
