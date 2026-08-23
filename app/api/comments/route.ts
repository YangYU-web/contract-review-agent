// ===== 评论 API 路由 =====
// 团队协作评论的查询、创建、回复与标记已解决
// 数据存储：Supabase contract_comments 表，失败时降级为 Mock 数据

import { NextRequest, NextResponse } from 'next/server';
import { ContractComment } from '@/lib/types';
import { getMockComments, extractMentions } from '@/lib/comments';

// 将数据库行映射为 ContractComment 类型
function mapRow(row: any): ContractComment {
  return {
    id: row.id,
    contract_id: row.contract_id,
    risk_id: row.risk_id || undefined,
    user_id: row.user_id || '',
    user_name: row.user_name,
    user_role: row.user_role || '',
    content: row.content,
    mentions: row.mentions || [],
    parent_id: row.parent_id || undefined,
    resolved: row.resolved ?? false,
    created_at: row.created_at,
  };
}

// GET: 根据 contract_id 查询评论列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const contractId = searchParams.get('contract_id');

    if (!contractId) {
      return NextResponse.json(
        { error: '缺少 contract_id 查询参数' },
        { status: 400 }
      );
    }

    const riskId = searchParams.get('risk_id');

    // 尝试使用 Supabase
    try {
      const { getSupabaseServer } = await import('@/lib/supabase');
      const supabase = getSupabaseServer();
      if (supabase) {
        let query = supabase
          .from('contract_comments')
          .select('*')
          .eq('contract_id', contractId)
          .order('created_at', { ascending: true });

        if (riskId) {
          query = query.eq('risk_id', riskId);
        }

        const { data, error } = await query;

        if (error) throw error;

        const list: ContractComment[] = (data || []).map(mapRow);

        return NextResponse.json({ comments: list, mock: false });
      }
    } catch (dbErr) {
      console.error('Comments DB query failed, falling back to mock:', dbErr);
    }

    // 降级：使用内存 Mock 数据
    let list = getMockComments().filter((c) => c.contract_id === contractId);
    if (riskId) {
      list = list.filter((c) => c.risk_id === riskId);
    }
    list = [...list].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    return NextResponse.json({ comments: list, mock: true });
  } catch (err) {
    console.error('Comments GET error:', err);
    return NextResponse.json(
      { error: `服务器错误: ${err instanceof Error ? err.message : '未知错误'}` },
      { status: 500 }
    );
  }
}

// POST: 创建评论 / 回复 / 标记已解决
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // 标记已解决 / 取消已解决
    if (body.action === 'resolve' && body.comment_id) {
      // 尝试使用 Supabase
      try {
        const { getSupabaseServer } = await import('@/lib/supabase');
        const supabase = getSupabaseServer();
        if (supabase) {
          // 查询当前评论状态以支持 toggle
          const { data: current, error: fetchError } = await supabase
            .from('contract_comments')
            .select('*')
            .eq('id', body.comment_id)
            .single();

          if (fetchError) {
            if (fetchError.code === 'PGRST116') {
              return NextResponse.json({ error: '评论不存在' }, { status: 404 });
            }
            throw fetchError;
          }

          const newResolved = body.resolved ?? !current.resolved;
          const { data: updated, error: updateError } = await supabase
            .from('contract_comments')
            .update({ resolved: newResolved })
            .eq('id', body.comment_id)
            .select('*')
            .single();

          if (updateError) throw updateError;

          return NextResponse.json({ comment: mapRow(updated), mock: false });
        }
      } catch (dbErr) {
        console.error('Comments DB resolve failed, falling back to mock:', dbErr);
      }

      // 降级：使用内存 Mock 数据
      const mockComments = getMockComments();
      const idx = mockComments.findIndex((c) => c.id === body.comment_id);
      if (idx < 0) {
        return NextResponse.json({ error: '评论不存在' }, { status: 404 });
      }
      const comment: ContractComment = {
        ...mockComments[idx],
        resolved: body.resolved ?? !mockComments[idx].resolved,
      };

      return NextResponse.json({ comment, mock: true });
    }

    // 创建评论 / 回复
    const {
      contract_id,
      risk_id,
      content,
      user_name,
      user_role,
      mentions,
      parent_id,
    } = body;

    if (!contract_id || !content || !user_name) {
      return NextResponse.json(
        { error: '参数错误: 需要 contract_id、content、user_name' },
        { status: 400 }
      );
    }

    // 自动提取 @提及 并与传入的合并去重
    const autoMentions = extractMentions(content);
    const mergedMentions = Array.from(
      new Set([...(mentions || []), ...autoMentions])
    );

    // 尝试使用 Supabase
    try {
      const { getSupabaseServer } = await import('@/lib/supabase');
      const supabase = getSupabaseServer();
      if (supabase) {
        // 校验 parent_id 有效性
        if (parent_id) {
          const { data: parent, error: parentError } = await supabase
            .from('contract_comments')
            .select('id')
            .eq('id', parent_id)
            .single();
          if (parentError || !parent) {
            return NextResponse.json(
              { error: '回复的父评论不存在' },
              { status: 400 }
            );
          }
        }

        const insertData: Record<string, any> = {
          contract_id,
          user_name,
          user_role: user_role || '法务专员',
          content,
          mentions: mergedMentions,
          resolved: false,
        };
        if (risk_id) insertData.risk_id = risk_id;
        if (parent_id) insertData.parent_id = parent_id;
        // user_id 省略（未启用认证）

        const { data, error } = await supabase
          .from('contract_comments')
          .insert(insertData)
          .select('*')
          .single();

        if (error) throw error;

        return NextResponse.json({ comment: mapRow(data), mock: false });
      }
    } catch (dbErr) {
      console.error('Comments DB insert failed, falling back to mock:', dbErr);
    }

    // 降级：使用内存 Mock 数据
    const mockComments = getMockComments();
    if (parent_id) {
      const parent = mockComments.find((c) => c.id === parent_id);
      if (!parent) {
        return NextResponse.json(
          { error: '回复的父评论不存在' },
          { status: 400 }
        );
      }
    }

    const newComment: ContractComment = {
      id: `cmt-${crypto.randomUUID().slice(0, 8)}`,
      contract_id,
      risk_id: risk_id || undefined,
      user_id: `u-${user_name}`,
      user_name,
      user_role: user_role || '法务专员',
      content,
      mentions: mergedMentions,
      parent_id: parent_id || undefined,
      resolved: false,
      created_at: new Date().toISOString(),
    };

    return NextResponse.json({ comment: newComment, mock: true });
  } catch (err) {
    console.error('Comments POST error:', err);
    return NextResponse.json(
      { error: `服务器错误: ${err instanceof Error ? err.message : '未知错误'}` },
      { status: 500 }
    );
  }
}
