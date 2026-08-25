// ===== 自定义风险规则 API =====
// 提供规则列表查询、创建、更新与删除能力
// 数据存储：Supabase custom_risk_rules 表，失败时降级为 Mock 数据
// 说明：DELETE 通过 POST + action=delete 实现，以适配演示模式

export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import {
  CustomRiskRule,
  RuleOperator,
  RuleSeverity,
  RuleStatus,
} from '@/lib/types';
import { getMockRules, createRule } from '@/lib/rule-engine';

// 将数据库行映射为 CustomRiskRule 类型
function mapRow(row: any): CustomRiskRule {
  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    rule_type: row.rule_type,
    field: row.field,
    operator: row.operator,
    value: row.value,
    severity: row.severity,
    suggestion: row.suggestion || '',
    status: row.status || 'active',
    match_count: row.match_count ?? 0,
    created_by: 'system',
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// 有效的操作符集合
const VALID_OPERATORS: RuleOperator[] = [
  'contains',
  'not_contains',
  'equals',
  'regex',
  'greater_than',
  'less_than',
];

// 有效的严重程度集合
const VALID_SEVERITIES: RuleSeverity[] = ['high', 'medium', 'low'];

// 统计信息
function getStats(rules: CustomRiskRule[]) {
  return {
    total: rules.length,
    active: rules.filter((r) => r.status === 'active').length,
    inactive: rules.filter((r) => r.status === 'inactive').length,
    total_matches: rules.reduce((sum, r) => sum + r.match_count, 0),
  };
}

// 按创建时间倒序排序
function sortByCreatedDesc(rules: CustomRiskRule[]): CustomRiskRule[] {
  return [...rules].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

// GET: 返回规则列表与统计
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as RuleStatus | null;
    const severity = searchParams.get('severity') as RuleSeverity | null;

    // 尝试使用 Supabase
    try {
      const { getSupabaseServer } = await import('@/lib/supabase');
      const supabase = getSupabaseServer();
      if (supabase) {
        let query = supabase
          .from('custom_risk_rules')
          .select('*')
          .order('created_at', { ascending: false });

        if (status) {
          query = query.eq('status', status);
        }
        if (severity) {
          query = query.eq('severity', severity);
        }

        const { data, error } = await query;

        if (error) throw error;

        const allRules: CustomRiskRule[] = (data || []).map(mapRow);

        // 统计基于全量（无筛选）数据
        let statsRules = allRules;
        if (status || severity) {
          // 需要全量统计，重新查询
          const { data: allData, error: allError } = await supabase
            .from('custom_risk_rules')
            .select('*');
          if (!allError && allData) {
            statsRules = allData.map(mapRow);
          }
        }

        return NextResponse.json({
          rules: allRules,
          stats: getStats(statsRules),
          mock: false,
        });
      }
    } catch (dbErr) {
      console.error('Rules DB query failed, falling back to mock:', dbErr);
    }

    // 降级：使用内存 Mock 数据
    let list = getMockRules();
    if (status) {
      list = list.filter((r) => r.status === status);
    }
    if (severity) {
      list = list.filter((r) => r.severity === severity);
    }
    list = sortByCreatedDesc(list);

    return NextResponse.json({
      rules: list,
      stats: getStats(getMockRules()),
      mock: true,
    });
  } catch (err) {
    console.error('Rules GET error:', err);
    return NextResponse.json(
      { error: `服务器错误: ${err instanceof Error ? err.message : '未知错误'}` },
      { status: 500 }
    );
  }
}

// POST: 创建规则或执行 action（delete）
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // ===== 通过 action=delete 删除规则 =====
    if (body.action === 'delete') {
      const { id } = body;
      if (!id) {
        return NextResponse.json(
          { error: '缺少 id 参数' },
          { status: 400 }
        );
      }

      // 尝试使用 Supabase
      try {
        const { getSupabaseServer } = await import('@/lib/supabase');
        const supabase = getSupabaseServer();
        if (supabase) {
          const { error, count } = await supabase
            .from('custom_risk_rules')
            .delete({ count: 'exact' })
            .eq('id', id);

          if (error) throw error;

          if (count === 0) {
            return NextResponse.json({ error: '规则不存在' }, { status: 404 });
          }

          // 查询全量列表返回
          const { data: allData, error: allError } = await supabase
            .from('custom_risk_rules')
            .select('*')
            .order('created_at', { ascending: false });

          if (allError) throw allError;

          const allRules: CustomRiskRule[] = (allData || []).map(mapRow);

          return NextResponse.json({
            rules: allRules,
            stats: getStats(allRules),
            mock: false,
          });
        }
      } catch (dbErr) {
        console.error('Rules DB delete failed, falling back to mock:', dbErr);
      }

      // 降级：使用内存 Mock 数据
      const mockRules = getMockRules();
      const idx = mockRules.findIndex((r) => r.id === id);
      if (idx < 0) {
        return NextResponse.json({ error: '规则不存在' }, { status: 404 });
      }
      // mockRules 是 getMockRules() 返回的新数组，splice 不影响原始数据
      const filteredRules = mockRules.filter((r) => r.id !== id);

      return NextResponse.json({
        rules: sortByCreatedDesc(filteredRules),
        stats: getStats(filteredRules),
        mock: true,
      });
    }

    // ===== 创建新规则 =====
    const {
      name,
      description,
      rule_type,
      field,
      operator,
      value,
      severity,
      suggestion,
    } = body;

    // 参数校验
    if (!name || typeof name !== 'string') {
      return NextResponse.json(
        { error: '缺少 name 参数' },
        { status: 400 }
      );
    }
    if (!operator || !VALID_OPERATORS.includes(operator)) {
      return NextResponse.json(
        {
          error: `operator 无效，需为 ${VALID_OPERATORS.join(' / ')}`,
        },
        { status: 400 }
      );
    }
    if (value === undefined || value === null || String(value).trim() === '') {
      return NextResponse.json(
        { error: '缺少 value 参数' },
        { status: 400 }
      );
    }
    if (severity && !VALID_SEVERITIES.includes(severity)) {
      return NextResponse.json(
        { error: `severity 无效，需为 ${VALID_SEVERITIES.join(' / ')}` },
        { status: 400 }
      );
    }

    // 尝试使用 Supabase
    try {
      const { getSupabaseServer } = await import('@/lib/supabase');
      const supabase = getSupabaseServer();
      if (supabase) {
        const insertData: Record<string, any> = {
          name,
          description: description || '',
          rule_type: rule_type || 'other',
          field: field || '',
          operator,
          value: String(value),
          severity: severity || 'medium',
          suggestion: suggestion || '',
          status: 'active',
          match_count: 0,
        };

        const { data, error } = await supabase
          .from('custom_risk_rules')
          .insert(insertData)
          .select('*')
          .single();

        if (error) throw error;

        const rule = mapRow(data);

        // 查询全量列表返回
        const { data: allData, error: allError } = await supabase
          .from('custom_risk_rules')
          .select('*')
          .order('created_at', { ascending: false });

        if (allError) throw allError;

        const allRules: CustomRiskRule[] = (allData || []).map(mapRow);

        return NextResponse.json({
          rule,
          rules: allRules,
          stats: getStats(allRules),
          mock: false,
        });
      }
    } catch (dbErr) {
      console.error('Rules DB insert failed, falling back to mock:', dbErr);
    }

    // 降级：使用内存 Mock 数据
    const rule = createRule(
      name,
      description || '',
      rule_type || 'other',
      field || '',
      operator,
      String(value),
      (severity as RuleSeverity) || 'medium',
      suggestion || ''
    );

    const mockRules = getMockRules();
    mockRules.unshift(rule);

    return NextResponse.json({
      rule,
      rules: sortByCreatedDesc(mockRules),
      stats: getStats(mockRules),
      mock: true,
    });
  } catch (err) {
    console.error('Rules POST error:', err);
    return NextResponse.json(
      { error: `服务器错误: ${err instanceof Error ? err.message : '未知错误'}` },
      { status: 500 }
    );
  }
}

// PUT: 更新规则（接收 { id, ...updates }）
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { error: '缺少 id 参数' },
        { status: 400 }
      );
    }

    // 校验更新字段
    if (
      updates.operator !== undefined &&
      !VALID_OPERATORS.includes(updates.operator)
    ) {
      return NextResponse.json(
        { error: `operator 无效，需为 ${VALID_OPERATORS.join(' / ')}` },
        { status: 400 }
      );
    }
    if (
      updates.severity !== undefined &&
      !VALID_SEVERITIES.includes(updates.severity)
    ) {
      return NextResponse.json(
        { error: `severity 无效，需为 ${VALID_SEVERITIES.join(' / ')}` },
        { status: 400 }
      );
    }
    if (
      updates.status !== undefined &&
      updates.status !== 'active' &&
      updates.status !== 'inactive'
    ) {
      return NextResponse.json(
        { error: 'status 无效，需为 active / inactive' },
        { status: 400 }
      );
    }

    // 尝试使用 Supabase
    try {
      const { getSupabaseServer } = await import('@/lib/supabase');
      const supabase = getSupabaseServer();
      if (supabase) {
        // 构建更新数据，只包含已提供的字段
        const updateData: Record<string, any> = { ...updates };
        delete updateData.created_by; // created_by 不在数据库表中
        updateData.updated_at = new Date().toISOString();

        const { data, error } = await supabase
          .from('custom_risk_rules')
          .update(updateData)
          .eq('id', id)
          .select('*')
          .single();

        if (error) {
          if (error.code === 'PGRST116') {
            return NextResponse.json({ error: '规则不存在' }, { status: 404 });
          }
          throw error;
        }

        const rule = mapRow(data);

        // 查询全量列表返回
        const { data: allData, error: allError } = await supabase
          .from('custom_risk_rules')
          .select('*')
          .order('created_at', { ascending: false });

        if (allError) throw allError;

        const allRules: CustomRiskRule[] = (allData || []).map(mapRow);

        return NextResponse.json({
          rule,
          rules: allRules,
          stats: getStats(allRules),
          mock: false,
        });
      }
    } catch (dbErr) {
      console.error('Rules DB update failed, falling back to mock:', dbErr);
    }

    // 降级：使用内存 Mock 数据
    const mockRules = getMockRules();
    const idx = mockRules.findIndex((r) => r.id === id);
    if (idx < 0) {
      return NextResponse.json({ error: '规则不存在' }, { status: 404 });
    }

    const now = new Date().toISOString();
    const updatedRule: CustomRiskRule = {
      ...mockRules[idx],
      ...updates,
      updated_at: now,
    };

    return NextResponse.json({
      rule: updatedRule,
      rules: sortByCreatedDesc(mockRules),
      stats: getStats(mockRules),
      mock: true,
    });
  } catch (err) {
    console.error('Rules PUT error:', err);
    return NextResponse.json(
      { error: `服务器错误: ${err instanceof Error ? err.message : '未知错误'}` },
      { status: 500 }
    );
  }
}
