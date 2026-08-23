// ===== 合同谈判助手 API =====
// 提供谈判会话列表与统计查询，以及创建、添加条款、达成条款、添加让步、更新立场、分析能力
// 优先使用 Supabase 数据库（negotiation_sessions 表），数据库未配置或操作失败时优雅降级到内存 Mock 数据。

import { NextRequest, NextResponse } from 'next/server';
import {
  NegotiationSession,
  NegotiationStatus,
  NegotiationStance,
  ConcessionType,
} from '@/lib/types';
import { isSupabaseConfigured } from '@/lib/supabase';
import {
  getMockNegotiationSessions,
  getNegotiationStats,
  analyzeNegotiation,
  generateCounterProposal,
} from '@/lib/negotiation-assistant';

// 模块级内存存储（仅作降级兜底）：初始化为 Mock 数据
let sessionsStore: NegotiationSession[] = getMockNegotiationSessions();

// 有效的谈判状态集合
const VALID_STATUSES: NegotiationStatus[] = [
  'draft',
  'in_progress',
  'agreed',
  'rejected',
  'stalled',
];

// 有效的谈判立场集合
const VALID_STANCES: NegotiationStance[] = [
  'accept',
  'counter',
  'reject',
  'conditional',
];

// 有效的让步类型集合
const VALID_CONCESSION_TYPES: ConcessionType[] = [
  'price',
  'payment_terms',
  'delivery',
  'warranty',
  'liability',
  'scope',
  'ip_rights',
  'termination',
];

// 按最后更新时间降序排序（最近更新的在前）
function sortByLastUpdated(list: NegotiationSession[]): NegotiationSession[] {
  return [...list].sort(
    (a, b) =>
      new Date(b.last_updated).getTime() - new Date(a.last_updated).getTime()
  );
}

// 获取 Supabase 服务端客户端（如未配置返回 null）
async function getDb() {
  if (!isSupabaseConfigured()) return null;
  const { getSupabaseServer } = await import('@/lib/supabase');
  return getSupabaseServer();
}

// 判断字符串是否为合法 UUID
function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

// 从数据库读取全部会话（可选状态过滤）
async function fetchSessionsFromDb(
  supabase: any,
  status?: string | null
): Promise<NegotiationSession[]> {
  let query = supabase
    .from('negotiation_sessions')
    .select('*')
    .order('last_updated', { ascending: false });
  if (status) query = query.eq('status', status);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as NegotiationSession[];
}

// GET: 返回谈判会话列表与统计
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as NegotiationStatus | null;

    // 优先尝试数据库
    const supabase = await getDb();
    if (supabase) {
      try {
        const allSessions = await fetchSessionsFromDb(supabase, status);
        const fullList = status ? allSessions : await fetchSessionsFromDb(supabase);
        return NextResponse.json({
          sessions: sortByLastUpdated(allSessions),
          stats: getNegotiationStats(fullList),
          mock: false,
        });
      } catch (dbErr) {
        console.error('Negotiation GET DB error, falling back to mock:', dbErr);
      }
    }

    // 降级：内存 Mock 数据
    let list = sessionsStore;
    if (status) {
      list = list.filter((s) => s.status === status);
    }
    return NextResponse.json({
      sessions: sortByLastUpdated(list),
      stats: getNegotiationStats(sessionsStore),
      mock: true,
    });
  } catch (err) {
    console.error('Negotiation GET error:', err);
    return NextResponse.json(
      { error: `服务器错误: ${err instanceof Error ? err.message : '未知错误'}` },
      { status: 500 }
    );
  }
}

// POST: 创建或执行 action（create / add_point / agree_term / add_concession / update_stance / analyze）
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = body.action as
      | 'create'
      | 'add_point'
      | 'agree_term'
      | 'add_concession'
      | 'update_stance'
      | 'analyze'
      | undefined;

    // ===== 创建谈判会话 =====
    if (!action || action === 'create') {
      const { contract_id, contract_title, counterparty } = body;

      // 参数校验
      if (!contract_id) {
        return NextResponse.json(
          { error: '缺少 contract_id 参数' },
          { status: 400 }
        );
      }
      if (!contract_title) {
        return NextResponse.json(
          { error: '缺少 contract_title 参数' },
          { status: 400 }
        );
      }

      const now = new Date().toISOString();
      const session: NegotiationSession = {
        id: `neg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        contract_id,
        contract_title,
        counterparty: counterparty || '未知对手方',
        status: 'draft',
        round: 1,
        started_at: now,
        last_updated: now,
        our_position: {
          must_haves: [],
          nice_to_haves: [],
          deal_breakers: [],
        },
        their_position: {
          must_haves: [],
          nice_to_haves: [],
          deal_breakers: [],
        },
        agreed_terms: [],
        concessions: [],
        ai_analysis: {
          overall_assessment: '谈判会话已创建，等待录入双方立场后进行分析。',
          balance_score: 50,
          our_leverage: [],
          their_leverage: [],
          recommendations: ['请先录入双方谈判立场与条款，再启动 AI 分析'],
          batna: '尚未评估替代方案',
          zone_of_possible_agreement: { min: 0, max: 0 },
          risk_of_breakdown: 20,
        },
      };

      // 尝试写入数据库（contract_id 需为合法 UUID 且对应合同存在）
      const supabase = await getDb();
      if (supabase) {
        try {
          const insertPayload: any = {
            contract_title,
            counterparty: session.counterparty,
            status: session.status,
            round: session.round,
            our_position: session.our_position,
            their_position: session.their_position,
            agreed_terms: session.agreed_terms,
            concessions: session.concessions,
            ai_analysis: session.ai_analysis,
            started_at: now,
            last_updated: now,
          };
          // 仅当 contract_id 为合法 UUID 时才写入外键，否则置空避免外键报错
          if (isUuid(contract_id)) {
            insertPayload.contract_id = contract_id;
          }
          const { data, error } = await supabase
            .from('negotiation_sessions')
            .insert(insertPayload)
            .select()
            .single();
          if (error) throw error;
          const created = { ...session, ...(data as any) } as NegotiationSession;
          const allSessions = await fetchSessionsFromDb(supabase);
          return NextResponse.json({
            session: created,
            sessions: sortByLastUpdated(allSessions),
            stats: getNegotiationStats(allSessions),
            mock: false,
          });
        } catch (dbErr) {
          console.error('Negotiation create DB error, falling back to mock:', dbErr);
        }
      }

      // 降级：内存
      sessionsStore.unshift(session);
      return NextResponse.json({
        session,
        sessions: sortByLastUpdated(sessionsStore),
        stats: getNegotiationStats(sessionsStore),
        mock: true,
      });
    }

    // ===== 添加谈判条款 =====
    if (action === 'add_point') {
      const { session_id, side, category, point } = body;
      if (!session_id) {
        return NextResponse.json(
          { error: '缺少 session_id 参数' },
          { status: 400 }
        );
      }

      const newPoint = {
        id: `pt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        ...point,
      };

      // 尝试数据库
      const supabase = await getDb();
      if (supabase) {
        try {
          const { data: row, error } = await supabase
            .from('negotiation_sessions')
            .select('*')
            .eq('id', session_id)
            .single();
          if (error) throw error;
          if (!row) {
            return NextResponse.json({ error: '谈判会话不存在' }, { status: 404 });
          }
          const session = row as NegotiationSession;
          const position =
            side === 'their' ? session.their_position : session.our_position;
          if (category === 'must_haves') position.must_haves.push(newPoint);
          else if (category === 'nice_to_haves') position.nice_to_haves.push(newPoint);
          else if (category === 'deal_breakers') position.deal_breakers.push(newPoint);

          const now = new Date().toISOString();
          const { error: updErr } = await supabase
            .from('negotiation_sessions')
            .update({
              our_position: session.our_position,
              their_position: session.their_position,
              last_updated: now,
            })
            .eq('id', session_id);
          if (updErr) throw updErr;
          const updated = { ...session, last_updated: now };
          const allSessions = await fetchSessionsFromDb(supabase);
          return NextResponse.json({
            session: updated,
            sessions: sortByLastUpdated(allSessions),
            stats: getNegotiationStats(allSessions),
            mock: false,
          });
        } catch (dbErr) {
          console.error('Negotiation add_point DB error, falling back to mock:', dbErr);
        }
      }

      // 降级：内存
      const idx = sessionsStore.findIndex((s) => s.id === session_id);
      if (idx < 0) {
        return NextResponse.json({ error: '谈判会话不存在' }, { status: 404 });
      }
      const session = sessionsStore[idx];
      const position = side === 'their' ? session.their_position : session.our_position;
      if (category === 'must_haves') position.must_haves.push(newPoint);
      else if (category === 'nice_to_haves') position.nice_to_haves.push(newPoint);
      else if (category === 'deal_breakers') position.deal_breakers.push(newPoint);
      sessionsStore[idx] = {
        ...session,
        last_updated: new Date().toISOString(),
      };
      return NextResponse.json({
        session: sessionsStore[idx],
        sessions: sortByLastUpdated(sessionsStore),
        stats: getNegotiationStats(sessionsStore),
        mock: true,
      });
    }

    // ===== 达成条款共识 =====
    if (action === 'agree_term') {
      const { session_id, clause, agreed_text, original_gap } = body;
      if (!session_id) {
        return NextResponse.json(
          { error: '缺少 session_id 参数' },
          { status: 400 }
        );
      }

      // 尝试数据库
      const supabase = await getDb();
      if (supabase) {
        try {
          const { data: row, error } = await supabase
            .from('negotiation_sessions')
            .select('*')
            .eq('id', session_id)
            .single();
          if (error) throw error;
          if (!row) {
            return NextResponse.json({ error: '谈判会话不存在' }, { status: 404 });
          }
          const session = row as NegotiationSession;
          const agreedTerm = {
            id: `at-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            clause: clause || '',
            agreed_text: agreed_text || '',
            original_gap: original_gap || '',
            round_agreed: session.round,
          };
          session.agreed_terms.push(agreedTerm);
          const now = new Date().toISOString();
          const { error: updErr } = await supabase
            .from('negotiation_sessions')
            .update({
              agreed_terms: session.agreed_terms,
              last_updated: now,
            })
            .eq('id', session_id);
          if (updErr) throw updErr;
          const updated = { ...session, last_updated: now };
          const allSessions = await fetchSessionsFromDb(supabase);
          return NextResponse.json({
            session: updated,
            sessions: sortByLastUpdated(allSessions),
            stats: getNegotiationStats(allSessions),
            mock: false,
          });
        } catch (dbErr) {
          console.error('Negotiation agree_term DB error, falling back to mock:', dbErr);
        }
      }

      // 降级：内存
      const idx = sessionsStore.findIndex((s) => s.id === session_id);
      if (idx < 0) {
        return NextResponse.json({ error: '谈判会话不存在' }, { status: 404 });
      }
      const session = sessionsStore[idx];
      const agreedTerm = {
        id: `at-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        clause: clause || '',
        agreed_text: agreed_text || '',
        original_gap: original_gap || '',
        round_agreed: session.round,
      };
      session.agreed_terms.push(agreedTerm);
      sessionsStore[idx] = {
        ...session,
        last_updated: new Date().toISOString(),
      };
      return NextResponse.json({
        session: sessionsStore[idx],
        sessions: sortByLastUpdated(sessionsStore),
        stats: getNegotiationStats(sessionsStore),
        mock: true,
      });
    }

    // ===== 添加让步记录 =====
    if (action === 'add_concession') {
      const { session_id, type, description, given_by, estimated_value, trade_off } = body;
      if (!session_id) {
        return NextResponse.json(
          { error: '缺少 session_id 参数' },
          { status: 400 }
        );
      }
      if (type && !VALID_CONCESSION_TYPES.includes(type)) {
        return NextResponse.json(
          { error: `type 无效，需为 ${VALID_CONCESSION_TYPES.join(' / ')}` },
          { status: 400 }
        );
      }

      // 尝试数据库
      const supabase = await getDb();
      if (supabase) {
        try {
          const { data: row, error } = await supabase
            .from('negotiation_sessions')
            .select('*')
            .eq('id', session_id)
            .single();
          if (error) throw error;
          if (!row) {
            return NextResponse.json({ error: '谈判会话不存在' }, { status: 404 });
          }
          const session = row as NegotiationSession;
          const concession = {
            id: `cs-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            type: (type || 'price') as ConcessionType,
            description: description || '',
            given_by: (given_by || 'both') as 'us' | 'them' | 'both',
            estimated_value: Number(estimated_value) || 0,
            trade_off: trade_off || '',
            round: session.round,
          };
          session.concessions.push(concession);
          const now = new Date().toISOString();
          const { error: updErr } = await supabase
            .from('negotiation_sessions')
            .update({
              concessions: session.concessions,
              last_updated: now,
            })
            .eq('id', session_id);
          if (updErr) throw updErr;
          const updated = { ...session, last_updated: now };
          const allSessions = await fetchSessionsFromDb(supabase);
          return NextResponse.json({
            session: updated,
            sessions: sortByLastUpdated(allSessions),
            stats: getNegotiationStats(allSessions),
            mock: false,
          });
        } catch (dbErr) {
          console.error('Negotiation add_concession DB error, falling back to mock:', dbErr);
        }
      }

      // 降级：内存
      const idx = sessionsStore.findIndex((s) => s.id === session_id);
      if (idx < 0) {
        return NextResponse.json({ error: '谈判会话不存在' }, { status: 404 });
      }
      const session = sessionsStore[idx];
      const concession = {
        id: `cs-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: (type || 'price') as ConcessionType,
        description: description || '',
        given_by: (given_by || 'both') as 'us' | 'them' | 'both',
        estimated_value: Number(estimated_value) || 0,
        trade_off: trade_off || '',
        round: session.round,
      };
      session.concessions.push(concession);
      sessionsStore[idx] = {
        ...session,
        last_updated: new Date().toISOString(),
      };
      return NextResponse.json({
        session: sessionsStore[idx],
        sessions: sortByLastUpdated(sessionsStore),
        stats: getNegotiationStats(sessionsStore),
        mock: true,
      });
    }

    // ===== 更新条款立场 =====
    if (action === 'update_stance') {
      const { session_id, point_id, stance } = body;
      if (!session_id) {
        return NextResponse.json(
          { error: '缺少 session_id 参数' },
          { status: 400 }
        );
      }
      if (!stance || !VALID_STANCES.includes(stance)) {
        return NextResponse.json(
          { error: `stance 无效，需为 ${VALID_STANCES.join(' / ')}` },
          { status: 400 }
        );
      }

      // 尝试数据库
      const supabase = await getDb();
      if (supabase) {
        try {
          const { data: row, error } = await supabase
            .from('negotiation_sessions')
            .select('*')
            .eq('id', session_id)
            .single();
          if (error) throw error;
          if (!row) {
            return NextResponse.json({ error: '谈判会话不存在' }, { status: 404 });
          }
          const session = row as NegotiationSession;
          const allPoints = [
            ...session.our_position.must_haves,
            ...session.our_position.nice_to_haves,
            ...session.our_position.deal_breakers,
            ...session.their_position.must_haves,
            ...session.their_position.nice_to_haves,
            ...session.their_position.deal_breakers,
          ];
          const point = allPoints.find((p) => p.id === point_id);
          if (!point) {
            return NextResponse.json({ error: '条款不存在' }, { status: 404 });
          }
          point.stance = stance as NegotiationStance;
          const counterProposal = generateCounterProposal(point);
          const now = new Date().toISOString();
          const { error: updErr } = await supabase
            .from('negotiation_sessions')
            .update({
              our_position: session.our_position,
              their_position: session.their_position,
              last_updated: now,
            })
            .eq('id', session_id);
          if (updErr) throw updErr;
          const updated = { ...session, last_updated: now };
          const allSessions = await fetchSessionsFromDb(supabase);
          return NextResponse.json({
            session: updated,
            counter_proposal: counterProposal,
            sessions: sortByLastUpdated(allSessions),
            stats: getNegotiationStats(allSessions),
            mock: false,
          });
        } catch (dbErr) {
          console.error('Negotiation update_stance DB error, falling back to mock:', dbErr);
        }
      }

      // 降级：内存
      const idx = sessionsStore.findIndex((s) => s.id === session_id);
      if (idx < 0) {
        return NextResponse.json({ error: '谈判会话不存在' }, { status: 404 });
      }
      const session = sessionsStore[idx];
      const allPoints = [
        ...session.our_position.must_haves,
        ...session.our_position.nice_to_haves,
        ...session.our_position.deal_breakers,
        ...session.their_position.must_haves,
        ...session.their_position.nice_to_haves,
        ...session.their_position.deal_breakers,
      ];
      const point = allPoints.find((p) => p.id === point_id);
      if (!point) {
        return NextResponse.json({ error: '条款不存在' }, { status: 404 });
      }
      point.stance = stance as NegotiationStance;
      const counterProposal = generateCounterProposal(point);
      sessionsStore[idx] = {
        ...session,
        last_updated: new Date().toISOString(),
      };
      return NextResponse.json({
        session: sessionsStore[idx],
        counter_proposal: counterProposal,
        sessions: sortByLastUpdated(sessionsStore),
        stats: getNegotiationStats(sessionsStore),
        mock: true,
      });
    }

    // ===== AI 分析谈判会话 =====
    if (action === 'analyze') {
      const { session_id } = body;
      if (!session_id) {
        return NextResponse.json(
          { error: '缺少 session_id 参数' },
          { status: 400 }
        );
      }

      // 尝试数据库
      const supabase = await getDb();
      if (supabase) {
        try {
          const { data: row, error } = await supabase
            .from('negotiation_sessions')
            .select('*')
            .eq('id', session_id)
            .single();
          if (error) throw error;
          if (!row) {
            return NextResponse.json({ error: '谈判会话不存在' }, { status: 404 });
          }
          const session = row as NegotiationSession;
          const analysis = analyzeNegotiation(session);
          const now = new Date().toISOString();
          const { error: updErr } = await supabase
            .from('negotiation_sessions')
            .update({
              ai_analysis: analysis,
              last_updated: now,
            })
            .eq('id', session_id);
          if (updErr) throw updErr;
          const updated = { ...session, ai_analysis: analysis, last_updated: now };
          const allSessions = await fetchSessionsFromDb(supabase);
          return NextResponse.json({
            session: updated,
            analysis,
            sessions: sortByLastUpdated(allSessions),
            stats: getNegotiationStats(allSessions),
            mock: false,
          });
        } catch (dbErr) {
          console.error('Negotiation analyze DB error, falling back to mock:', dbErr);
        }
      }

      // 降级：内存
      const idx = sessionsStore.findIndex((s) => s.id === session_id);
      if (idx < 0) {
        return NextResponse.json({ error: '谈判会话不存在' }, { status: 404 });
      }
      const session = sessionsStore[idx];
      const analysis = analyzeNegotiation(session);
      sessionsStore[idx] = {
        ...session,
        ai_analysis: analysis,
        last_updated: new Date().toISOString(),
      };
      return NextResponse.json({
        session: sessionsStore[idx],
        analysis,
        sessions: sortByLastUpdated(sessionsStore),
        stats: getNegotiationStats(sessionsStore),
        mock: true,
      });
    }

    return NextResponse.json(
      {
        error:
          'action 无效，需为 create / add_point / agree_term / add_concession / update_stance / analyze',
      },
      { status: 400 }
    );
  } catch (err) {
    console.error('Negotiation POST error:', err);
    return NextResponse.json(
      { error: `服务器错误: ${err instanceof Error ? err.message : '未知错误'}` },
      { status: 500 }
    );
  }
}
