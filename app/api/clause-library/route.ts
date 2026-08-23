// ===== 智能条款库 API =====
// 提供条款列表查询、统计聚合、全文搜索、条款推荐与变量渲染能力
// 优先使用 Supabase 数据库（clause_library 表），数据库未配置或操作失败时优雅降级到内存 Mock 数据。

import { NextRequest, NextResponse } from 'next/server';
import {
  ClauseLibraryItem,
  ClauseCategory,
  ClauseRiskLevel,
  ClauseSource,
} from '@/lib/types';
import { isSupabaseConfigured } from '@/lib/supabase';
import {
  getMockClauses,
  getClauseRecommendations,
  searchClauses,
  getClauseStats,
  renderClause,
} from '@/lib/clause-library';

// 模块级内存存储（仅作降级兜底）：初始化为 Mock 数据
let clausesStore: ClauseLibraryItem[] = getMockClauses();

// 收藏集合（演示模式，仅用于记录当前实例的收藏状态）
const favoriteSet = new Set<string>();

// 有效的枚举集合校验
const VALID_CATEGORIES: ClauseCategory[] = [
  'payment', 'delivery', 'warranty', 'liability', 'termination',
  'confidentiality', 'ip', 'dispute_resolution', 'force_majeure', 'general',
];
const VALID_RISK_LEVELS: ClauseRiskLevel[] = ['low', 'medium', 'high', 'critical'];
const VALID_SOURCES: ClauseSource[] = [
  'standard', 'best_practice', 'regulatory', 'negotiated', 'custom',
];

// 获取 Supabase 服务端客户端（如未配置返回 null）
async function getDb() {
  if (!isSupabaseConfigured()) return null;
  const { getSupabaseServer } = await import('@/lib/supabase');
  return getSupabaseServer();
}

// 将数据库行映射为 ClauseLibraryItem（DB 用 updated_at，前端期望 last_updated）
function mapRow(row: any): ClauseLibraryItem {
  const updated = row.updated_at || row.created_at || new Date().toISOString();
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    risk_level: row.risk_level,
    source: row.source,
    text: row.text,
    variables: row.variables || [],
    applicable_contracts: row.applicable_contracts || [],
    jurisdictions: row.jurisdictions || [],
    tags: row.tags || [],
    favor_count: row.favor_count ?? 0,
    usage_count: row.usage_count ?? 0,
    last_updated: typeof updated === 'string' ? updated.slice(0, 10) : '',
    alternative_versions: row.alternative_versions || [],
    risk_notes: row.risk_notes || '',
    negotiation_tips: row.negotiation_tips || '',
  };
}

// 从数据库读取全部条款
async function fetchClausesFromDb(supabase: any): Promise<ClauseLibraryItem[]> {
  const { data, error } = await supabase
    .from('clause_library')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(mapRow);
}

// GET: 返回条款列表、统计与可选推荐（?recommend=contractType）
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const recommendType = searchParams.get('recommend');
    const recommendContext = searchParams.get('context') || '';

    // 优先尝试数据库
    const supabase = await getDb();
    if (supabase) {
      try {
        const clauses = await fetchClausesFromDb(supabase);
        const stats = getClauseStats(clauses);
        const result: Record<string, unknown> = {
          clauses,
          stats,
          mock: false,
        };
        if (recommendType) {
          result.recommendation = getClauseRecommendations(recommendType, recommendContext);
        }
        return NextResponse.json(result);
      } catch (dbErr) {
        console.error('ClauseLibrary GET DB error, falling back to mock:', dbErr);
      }
    }

    // 降级：内存 Mock 数据
    const stats = getClauseStats(clausesStore);
    const result: Record<string, unknown> = {
      clauses: clausesStore,
      stats,
      mock: true,
    };
    if (recommendType) {
      result.recommendation = getClauseRecommendations(recommendType, recommendContext);
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error('ClauseLibrary GET error:', err);
    return NextResponse.json(
      { error: `服务器错误: ${err instanceof Error ? err.message : '未知错误'}` },
      { status: 500 }
    );
  }
}

// POST: 执行 action（search / recommend / render / add_clause / favorite）
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = body.action as
      | 'search'
      | 'recommend'
      | 'render'
      | 'add_clause'
      | 'favorite'
      | undefined;

    // ===== 搜索条款 =====
    if (action === 'search') {
      const { query, filters } = body;

      // 尝试数据库
      const supabase = await getDb();
      if (supabase) {
        try {
          const clauses = await fetchClausesFromDb(supabase);
          const result = searchClauses(clauses, query || '', {
            category: filters?.category as ClauseCategory | undefined,
            riskLevel: filters?.riskLevel as ClauseRiskLevel | undefined,
            source: filters?.source as ClauseSource | undefined,
          });
          return NextResponse.json({
            clauses: result,
            total: result.length,
            mock: false,
          });
        } catch (dbErr) {
          console.error('ClauseLibrary search DB error, falling back to mock:', dbErr);
        }
      }

      // 降级：内存
      const result = searchClauses(clausesStore, query || '', {
        category: filters?.category as ClauseCategory | undefined,
        riskLevel: filters?.riskLevel as ClauseRiskLevel | undefined,
        source: filters?.source as ClauseSource | undefined,
      });
      return NextResponse.json({
        clauses: result,
        total: result.length,
        mock: true,
      });
    }

    // ===== 生成条款推荐 =====
    if (action === 'recommend') {
      const { contract_type, context } = body;
      if (!contract_type) {
        return NextResponse.json(
          { error: '缺少 contract_type 参数' },
          { status: 400 }
        );
      }
      // 推荐基于合同类型，纯逻辑计算，与存储无关
      const supabase = await getDb();
      const usingMock = !supabase;
      const recommendation = getClauseRecommendations(contract_type, context || '');
      return NextResponse.json({
        recommendation,
        mock: usingMock,
      });
    }

    // ===== 渲染条款文本 =====
    if (action === 'render') {
      const { clause_id, variables } = body;
      if (!clause_id) {
        return NextResponse.json(
          { error: '缺少 clause_id 参数' },
          { status: 400 }
        );
      }

      // 尝试数据库
      const supabase = await getDb();
      if (supabase) {
        try {
          const { data: row, error } = await supabase
            .from('clause_library')
            .select('*')
            .eq('id', clause_id)
            .single();
          if (error) throw error;
          if (!row) {
            return NextResponse.json(
              { error: '条款不存在' },
              { status: 404 }
            );
          }
          const clause = mapRow(row);
          const rendered = renderClause(clause, variables || {});
          return NextResponse.json({
            clause_id,
            rendered_text: rendered,
            mock: false,
          });
        } catch (dbErr) {
          console.error('ClauseLibrary render DB error, falling back to mock:', dbErr);
        }
      }

      // 降级：内存
      const clause = clausesStore.find((c) => c.id === clause_id);
      if (!clause) {
        return NextResponse.json(
          { error: '条款不存在' },
          { status: 404 }
        );
      }
      const rendered = renderClause(clause, variables || {});
      return NextResponse.json({
        clause_id,
        rendered_text: rendered,
        mock: true,
      });
    }

    // ===== 新增条款 =====
    if (action === 'add_clause') {
      const { title, category, risk_level, source, text, variables } = body;
      if (!title || !text) {
        return NextResponse.json(
          { error: '缺少 title 或 text 参数' },
          { status: 400 }
        );
      }
      if (category && !VALID_CATEGORIES.includes(category)) {
        return NextResponse.json(
          { error: `category 无效，需为 ${VALID_CATEGORIES.join(' / ')}` },
          { status: 400 }
        );
      }
      if (risk_level && !VALID_RISK_LEVELS.includes(risk_level)) {
        return NextResponse.json(
          { error: `risk_level 无效，需为 ${VALID_RISK_LEVELS.join(' / ')}` },
          { status: 400 }
        );
      }
      if (source && !VALID_SOURCES.includes(source)) {
        return NextResponse.json(
          { error: `source 无效，需为 ${VALID_SOURCES.join(' / ')}` },
          { status: 400 }
        );
      }

      const newClause: ClauseLibraryItem = {
        id: `clause-custom-${Date.now()}`,
        title,
        category: category || 'general',
        risk_level: risk_level || 'medium',
        source: source || 'custom',
        text,
        variables: Array.isArray(variables) ? variables : [],
        applicable_contracts: body.applicable_contracts || [],
        jurisdictions: body.jurisdictions || ['中国大陆'],
        tags: body.tags || [],
        favor_count: 0,
        usage_count: 0,
        last_updated: new Date().toISOString().slice(0, 10),
        alternative_versions: [],
        risk_notes: body.risk_notes || '',
        negotiation_tips: body.negotiation_tips || '',
      };

      // 尝试写入数据库（created_by 置空，因未启用认证）
      const supabase = await getDb();
      if (supabase) {
        try {
          const insertPayload: any = {
            title: newClause.title,
            category: newClause.category,
            risk_level: newClause.risk_level,
            source: newClause.source,
            text: newClause.text,
            variables: newClause.variables,
            applicable_contracts: newClause.applicable_contracts,
            jurisdictions: newClause.jurisdictions,
            tags: newClause.tags,
            favor_count: 0,
            usage_count: 0,
            alternative_versions: newClause.alternative_versions,
            risk_notes: newClause.risk_notes,
            negotiation_tips: newClause.negotiation_tips,
            created_by: null,
          };
          const { data, error } = await supabase
            .from('clause_library')
            .insert(insertPayload)
            .select()
            .single();
          if (error) throw error;
          const created = mapRow(data);
          const allClauses = await fetchClausesFromDb(supabase);
          return NextResponse.json({
            clause: created,
            stats: getClauseStats(allClauses),
            mock: false,
          });
        } catch (dbErr) {
          console.error('ClauseLibrary add_clause DB error, falling back to mock:', dbErr);
        }
      }

      // 降级：内存
      clausesStore.unshift(newClause);
      return NextResponse.json({
        clause: newClause,
        stats: getClauseStats(clausesStore),
        mock: true,
      });
    }

    // ===== 收藏 / 取消收藏 =====
    if (action === 'favorite') {
      const { clause_id } = body;
      if (!clause_id) {
        return NextResponse.json(
          { error: '缺少 clause_id 参数' },
          { status: 400 }
        );
      }

      let favorited: boolean;
      // 尝试数据库
      const supabase = await getDb();
      if (supabase) {
        try {
          const { data: row, error } = await supabase
            .from('clause_library')
            .select('*')
            .eq('id', clause_id)
            .single();
          if (error) throw error;
          if (!row) {
            return NextResponse.json(
              { error: '条款不存在' },
              { status: 404 }
            );
          }
          if (favoriteSet.has(clause_id)) {
            favoriteSet.delete(clause_id);
            favorited = false;
          } else {
            favoriteSet.add(clause_id);
            favorited = true;
          }
          const newCount = Math.max(0, (row.favor_count ?? 0) + (favorited ? 1 : -1));
          const { error: updErr } = await supabase
            .from('clause_library')
            .update({ favor_count: newCount })
            .eq('id', clause_id);
          if (updErr) throw updErr;
          return NextResponse.json({
            clause_id,
            favorited,
            favor_count: newCount,
            mock: false,
          });
        } catch (dbErr) {
          console.error('ClauseLibrary favorite DB error, falling back to mock:', dbErr);
        }
      }

      // 降级：内存
      const idx = clausesStore.findIndex((c) => c.id === clause_id);
      if (idx < 0) {
        return NextResponse.json(
          { error: '条款不存在' },
          { status: 404 }
        );
      }
      if (favoriteSet.has(clause_id)) {
        favoriteSet.delete(clause_id);
        clausesStore[idx].favor_count = Math.max(
          0,
          clausesStore[idx].favor_count - 1
        );
        favorited = false;
      } else {
        favoriteSet.add(clause_id);
        clausesStore[idx].favor_count += 1;
        favorited = true;
      }
      return NextResponse.json({
        clause_id,
        favorited,
        favor_count: clausesStore[idx].favor_count,
        mock: true,
      });
    }

    return NextResponse.json(
      { error: 'action 无效，需为 search / recommend / render / add_clause / favorite' },
      { status: 400 }
    );
  } catch (err) {
    console.error('ClauseLibrary POST error:', err);
    return NextResponse.json(
      { error: `服务器错误: ${err instanceof Error ? err.message : '未知错误'}` },
      { status: 500 }
    );
  }
}
