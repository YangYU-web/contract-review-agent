// ===== 供应商/客户档案 API =====
// 提供合作方档案列表、统计与信用历史查询，以及创建、更新、状态变更与评级更新能力
// 数据存储：优先使用 Supabase 数据库（partner_profiles / partner_credit_history），
// 数据库未配置或操作失败时优雅降级到内存 Mock 数据

import { NextRequest, NextResponse } from 'next/server';
import {
  PartnerProfile,
  PartnerCreditHistory,
  PartnerType,
  PartnerStatus,
  CreditRating,
} from '@/lib/types';
import {
  getMockPartners,
  getMockCreditHistory,
  getMockCreditHistories,
  createPartner,
  getPartnerStats,
  calculateRiskScore,
} from '@/lib/partner-profiles';
import { isSupabaseConfigured } from '@/lib/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

// 模块级内存存储（演示模式降级时使用）：初始化为 Mock 数据
let partnersStore: PartnerProfile[] = getMockPartners();

// 有效的合作方类型集合
const VALID_TYPES: PartnerType[] = ['supplier', 'customer', 'both'];
// 有效的合作方状态集合
const VALID_STATUSES: PartnerStatus[] = ['active', 'inactive', 'blacklisted'];
// 有效的信用评级集合
const VALID_RATINGS: CreditRating[] = [
  'aaa',
  'aa',
  'a',
  'bbb',
  'bb',
  'b',
  'c',
];

// 允许通过 update action 更新的字段白名单
const ALLOWED_UPDATE_FIELDS: (keyof PartnerProfile)[] = [
  'name',
  'type',
  'status',
  'credit_rating',
  'industry',
  'registered_capital',
  'currency',
  'legal_representative',
  'contact_person',
  'contact_email',
  'contact_phone',
  'address',
  'tax_id',
  'bank_account',
  'contract_count',
  'total_contract_value',
  'avg_risk_score',
  'high_risk_count',
  'last_contract_date',
  'established_date',
  'notes',
];

// 按创建时间倒序排序
function sortByCreated(list: PartnerProfile[]): PartnerProfile[] {
  return [...list].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

// 计算带风险评分的档案（附带动态计算的 risk_score 字段，便于前端展示）
// histories 缺省时使用 Mock 信用历史（降级路径）
function withRiskScore(
  p: PartnerProfile,
  histories: PartnerCreditHistory[] = getMockCreditHistories()
): PartnerProfile & { risk_score: number } {
  const score = calculateRiskScore(p, histories);
  return { ...p, risk_score: score };
}

// 获取 Supabase 服务端客户端（已配置时返回实例，否则返回 null）
async function getDb(): Promise<SupabaseClient | null> {
  if (!isSupabaseConfigured()) return null;
  const { getSupabaseServer } = await import('@/lib/supabase');
  return getSupabaseServer();
}

// ===== DB 行 -> PartnerProfile 映射 =====
function mapPartner(row: Record<string, any>): PartnerProfile {
  return {
    id: String(row.id),
    name: row.name ?? '',
    type: row.type as PartnerType,
    status: (row.status ?? 'active') as PartnerStatus,
    credit_rating: (row.credit_rating ?? 'bbb') as CreditRating,
    industry: row.industry ?? '',
    registered_capital: Number(row.registered_capital ?? 0),
    currency: row.currency ?? 'CNY',
    legal_representative: row.legal_representative ?? '',
    contact_person: row.contact_person ?? '',
    contact_email: row.contact_email ?? '',
    contact_phone: row.contact_phone ?? '',
    address: row.address ?? '',
    tax_id: row.tax_id ?? '',
    bank_account: row.bank_account ?? undefined,
    contract_count: Number(row.contract_count ?? 0),
    total_contract_value: Number(row.total_contract_value ?? 0),
    avg_risk_score: Number(row.avg_risk_score ?? 0),
    high_risk_count: Number(row.high_risk_count ?? 0),
    last_contract_date: row.last_contract_date ?? '',
    established_date: row.established_date ?? '',
    notes: row.notes ?? '',
    created_at: row.created_at ?? new Date().toISOString(),
  };
}

// ===== DB 行 -> PartnerCreditHistory 映射 =====
// 注意：数据库列 event_date 对应接口字段 date
function mapCreditHistory(row: Record<string, any>): PartnerCreditHistory {
  return {
    id: String(row.id),
    partner_id: row.partner_id ? String(row.partner_id) : '',
    date: row.event_date ?? '',
    event: row.event ?? '',
    impact: row.impact as 'positive' | 'negative' | 'neutral',
    rating_before: (row.rating_before ?? 'bbb') as CreditRating,
    rating_after: (row.rating_after ?? 'bbb') as CreditRating,
    description: row.description ?? '',
  };
}

// 一次性查询全部合作方档案与信用历史
async function fetchAllFromDb(supabase: SupabaseClient): Promise<{
  partners: PartnerProfile[];
  histories: PartnerCreditHistory[];
}> {
  const [partnersRes, historiesRes] = await Promise.all([
    supabase
      .from('partner_profiles')
      .select('*')
      .order('created_at', { ascending: false }),
    supabase
      .from('partner_credit_history')
      .select('*')
      .order('event_date', { ascending: false }),
  ]);
  if (partnersRes.error) throw partnersRes.error;
  if (historiesRes.error) throw historiesRes.error;
  return {
    partners: (partnersRes.data ?? []).map(mapPartner),
    histories: (historiesRes.data ?? []).map(mapCreditHistory),
  };
}

// GET: 返回合作方档案列表与统计
// 支持 ?partner_id= 查询特定合作方的信用历史
// 支持 ?type= / ?status= / ?rating= 过滤
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const partnerId = searchParams.get('partner_id');
    const type = searchParams.get('type') as PartnerType | null;
    const status = searchParams.get('status') as PartnerStatus | null;
    const rating = searchParams.get('rating') as CreditRating | null;

    const supabase = await getDb();

    // ===== 如果指定了 partner_id，返回该合作方的信用历史 =====
    if (partnerId) {
      if (supabase) {
        try {
          const [partnerRes, historyRes] = await Promise.all([
            supabase
              .from('partner_profiles')
              .select('*')
              .eq('id', partnerId)
              .maybeSingle(),
            supabase
              .from('partner_credit_history')
              .select('*')
              .eq('partner_id', partnerId)
              .order('event_date', { ascending: false }),
          ]);
          if (partnerRes.error) throw partnerRes.error;
          if (historyRes.error) throw historyRes.error;

          if (!partnerRes.data) {
            return NextResponse.json(
              { error: '合作方不存在' },
              { status: 404 }
            );
          }

          const partner = mapPartner(partnerRes.data);
          const creditHistory = (historyRes.data ?? []).map(mapCreditHistory);

          return NextResponse.json({
            partner: withRiskScore(partner, creditHistory),
            creditHistory,
            mock: false,
          });
        } catch (dbErr) {
          console.error('Partners DB 查询失败，降级到 Mock 数据:', dbErr);
        }
      }

      // 降级：内存 Mock 数据
      const partner = partnersStore.find((p) => p.id === partnerId);
      if (!partner) {
        return NextResponse.json(
          { error: '合作方不存在' },
          { status: 404 }
        );
      }
      return NextResponse.json({
        partner: withRiskScore(partner),
        creditHistory: getMockCreditHistory(partnerId),
        mock: true,
      });
    }

    // ===== 否则返回所有合作方列表与统计 =====
    if (supabase) {
      try {
        const { partners: allPartners, histories } = await fetchAllFromDb(
          supabase
        );

        let list = allPartners;
        if (type) {
          list = list.filter((p) => p.type === type);
        }
        if (status) {
          list = list.filter((p) => p.status === status);
        }
        if (rating) {
          list = list.filter((p) => p.credit_rating === rating);
        }

        const listWithScore = sortByCreated(list).map((p) =>
          withRiskScore(p, histories)
        );
        // 统计基于全部合作方（非过滤后），与原行为一致
        const stats = getPartnerStats(allPartners);

        return NextResponse.json({
          partners: listWithScore,
          stats,
          creditHistories: histories,
          mock: false,
        });
      } catch (dbErr) {
        console.error('Partners DB 查询失败，降级到 Mock 数据:', dbErr);
      }
    }

    // 降级：内存 Mock 数据
    let list = partnersStore;
    if (type) {
      list = list.filter((p) => p.type === type);
    }
    if (status) {
      list = list.filter((p) => p.status === status);
    }
    if (rating) {
      list = list.filter((p) => p.credit_rating === rating);
    }

    const listWithScore = sortByCreated(list).map((p) => withRiskScore(p));
    const stats = getPartnerStats(partnersStore);

    return NextResponse.json({
      partners: listWithScore,
      stats,
      creditHistories: getMockCreditHistories(),
      mock: true,
    });
  } catch (err) {
    console.error('Partners GET error:', err);
    return NextResponse.json(
      { error: `服务器错误: ${err instanceof Error ? err.message : '未知错误'}` },
      { status: 500 }
    );
  }
}

// 将 PartnerProfile 拆分为可写入数据库的对象（省略 id / created_at，由数据库生成）
function partnerToRow(p: PartnerProfile): Record<string, any> {
  return {
    name: p.name,
    type: p.type,
    status: p.status,
    credit_rating: p.credit_rating,
    industry: p.industry,
    registered_capital: p.registered_capital,
    currency: p.currency,
    legal_representative: p.legal_representative,
    contact_person: p.contact_person,
    contact_email: p.contact_email,
    contact_phone: p.contact_phone,
    address: p.address,
    tax_id: p.tax_id,
    bank_account: p.bank_account ?? null,
    contract_count: p.contract_count,
    total_contract_value: p.total_contract_value,
    avg_risk_score: p.avg_risk_score,
    high_risk_count: p.high_risk_count,
    last_contract_date: p.last_contract_date || null,
    established_date: p.established_date || null,
    notes: p.notes,
  };
}

// POST: 执行 action（create / update / update_status / update_rating）
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = body.action as
      | 'create'
      | 'update'
      | 'update_status'
      | 'update_rating'
      | undefined;

    // ===== 创建合作方 =====
    if (!action || action === 'create') {
      const {
        name,
        type,
        industry,
        registered_capital,
        currency,
        legal_representative,
        contact_person,
        contact_email,
        contact_phone,
        address,
        tax_id,
        credit_rating,
        established_date,
        notes,
      } = body;

      if (!name || typeof name !== 'string') {
        return NextResponse.json(
          { error: '缺少 name 参数' },
          { status: 400 }
        );
      }
      if (!type || !VALID_TYPES.includes(type)) {
        return NextResponse.json(
          { error: `type 无效，需为 ${VALID_TYPES.join(' / ')}` },
          { status: 400 }
        );
      }

      const rating: CreditRating = VALID_RATINGS.includes(credit_rating)
        ? credit_rating
        : 'bbb';

      const partner = createPartner(
        name,
        type,
        industry || '其他',
        contact_person || '',
        contact_email || '',
        contact_phone || '',
        {
          registeredCapital: Number(registered_capital) || 0,
          currency: currency || 'CNY',
          legalRepresentative: legal_representative || '',
          address: address || '',
          taxId: tax_id || '',
          creditRating: rating,
          establishedDate: established_date,
          notes: notes || '',
        }
      );

      const supabase = await getDb();
      if (supabase) {
        try {
          const { data: inserted, error: insErr } = await supabase
            .from('partner_profiles')
            .insert(partnerToRow(partner))
            .select()
            .single();
          if (insErr) throw insErr;

          const created = mapPartner(inserted);
          const { partners, histories } = await fetchAllFromDb(supabase);

          return NextResponse.json({
            partner: withRiskScore(created, histories),
            partners: sortByCreated(partners).map((p) =>
              withRiskScore(p, histories)
            ),
            stats: getPartnerStats(partners),
            creditHistories: histories,
            mock: false,
          });
        } catch (dbErr) {
          console.error('Partners create DB 失败，降级到 Mock:', dbErr);
        }
      }

      // 降级：内存操作
      partnersStore.unshift(partner);

      return NextResponse.json({
        partner: withRiskScore(partner),
        partners: sortByCreated(partnersStore).map((p) => withRiskScore(p)),
        stats: getPartnerStats(partnersStore),
        creditHistories: getMockCreditHistories(),
        mock: true,
      });
    }

    // ===== 更新合作方 =====
    if (action === 'update') {
      const { id, ...updates } = body;
      if (!id) {
        return NextResponse.json(
          { error: '缺少 id 参数' },
          { status: 400 }
        );
      }

      // 校验更新字段
      if (updates.type !== undefined && !VALID_TYPES.includes(updates.type)) {
        return NextResponse.json(
          { error: `type 无效，需为 ${VALID_TYPES.join(' / ')}` },
          { status: 400 }
        );
      }
      if (
        updates.credit_rating !== undefined &&
        !VALID_RATINGS.includes(updates.credit_rating)
      ) {
        return NextResponse.json(
          { error: `credit_rating 无效，需为 ${VALID_RATINGS.join(' / ')}` },
          { status: 400 }
        );
      }

      const supabase = await getDb();
      if (supabase) {
        try {
          // 仅保留白名单字段，避免写入无关字段（如 action）
          const rowUpdate: Record<string, any> = {};
          for (const key of ALLOWED_UPDATE_FIELDS) {
            if (updates[key] !== undefined) {
              rowUpdate[key] = updates[key];
            }
          }
          // 空字符串的日期字段写为 null（DATE 列不接受空串）
          if (rowUpdate.last_contract_date === '') rowUpdate.last_contract_date = null;
          if (rowUpdate.established_date === '') rowUpdate.established_date = null;

          const { data: updated, error: updErr } = await supabase
            .from('partner_profiles')
            .update(rowUpdate)
            .eq('id', id)
            .select()
            .single();
          if (updErr) throw updErr;
          if (!updated) {
            return NextResponse.json(
              { error: '合作方不存在' },
              { status: 404 }
            );
          }

          const result = mapPartner(updated);
          const { partners, histories } = await fetchAllFromDb(supabase);

          return NextResponse.json({
            partner: withRiskScore(result, histories),
            partners: sortByCreated(partners).map((p) =>
              withRiskScore(p, histories)
            ),
            stats: getPartnerStats(partners),
            creditHistories: histories,
            mock: false,
          });
        } catch (dbErr) {
          console.error('Partners update DB 失败，降级到 Mock:', dbErr);
        }
      }

      // 降级：内存操作
      const idx = partnersStore.findIndex((p) => p.id === id);
      if (idx < 0) {
        return NextResponse.json({ error: '合作方不存在' }, { status: 404 });
      }

      partnersStore[idx] = {
        ...partnersStore[idx],
        ...updates,
      };

      return NextResponse.json({
        partner: withRiskScore(partnersStore[idx]),
        partners: sortByCreated(partnersStore).map((p) => withRiskScore(p)),
        stats: getPartnerStats(partnersStore),
        creditHistories: getMockCreditHistories(),
        mock: true,
      });
    }

    // ===== 更新合作方状态（active / inactive / blacklisted） =====
    if (action === 'update_status') {
      const { id, status, reason } = body;
      if (!id) {
        return NextResponse.json(
          { error: '缺少 id 参数' },
          { status: 400 }
        );
      }
      if (!status || !VALID_STATUSES.includes(status)) {
        return NextResponse.json(
          { error: `status 无效，需为 ${VALID_STATUSES.join(' / ')}` },
          { status: 400 }
        );
      }

      const supabase = await getDb();
      if (supabase) {
        try {
          const { data: row, error: qErr } = await supabase
            .from('partner_profiles')
            .select('*')
            .eq('id', id)
            .maybeSingle();
          if (qErr) throw qErr;
          if (!row) {
            return NextResponse.json(
              { error: '合作方不存在' },
              { status: 404 }
            );
          }

          const current = mapPartner(row);

          // 拉黑时自动降级信用评级为 C
          const newRating: CreditRating =
            status === 'blacklisted' ? 'c' : current.credit_rating;
          // 解除黑名单时恢复到 BB
          const finalRating: CreditRating =
            current.status === 'blacklisted' && status !== 'blacklisted'
              ? 'bb'
              : newRating;

          const newNotes = reason
            ? `${current.notes}\n[状态变更] ${status}：${reason}`
            : current.notes;

          const { data: updated, error: updErr } = await supabase
            .from('partner_profiles')
            .update({
              status,
              credit_rating: finalRating,
              notes: newNotes,
            })
            .eq('id', id)
            .select()
            .single();
          if (updErr) throw updErr;

          const result = mapPartner(updated);
          const { partners, histories } = await fetchAllFromDb(supabase);

          return NextResponse.json({
            partner: withRiskScore(result, histories),
            partners: sortByCreated(partners).map((p) =>
              withRiskScore(p, histories)
            ),
            stats: getPartnerStats(partners),
            creditHistories: histories,
            mock: false,
          });
        } catch (dbErr) {
          console.error('Partners update_status DB 失败，降级到 Mock:', dbErr);
        }
      }

      // 降级：内存操作
      const idx = partnersStore.findIndex((p) => p.id === id);
      if (idx < 0) {
        return NextResponse.json({ error: '合作方不存在' }, { status: 404 });
      }

      // 拉黑时自动降级信用评级为 C
      const newRating: CreditRating =
        status === 'blacklisted' ? 'c' : partnersStore[idx].credit_rating;

      // 解除黑名单时恢复到 BB
      const finalRating: CreditRating =
        partnersStore[idx].status === 'blacklisted' && status !== 'blacklisted'
          ? 'bb'
          : newRating;

      partnersStore[idx] = {
        ...partnersStore[idx],
        status,
        credit_rating: finalRating,
        notes: reason
          ? `${partnersStore[idx].notes}\n[状态变更] ${status}：${reason}`
          : partnersStore[idx].notes,
      };

      return NextResponse.json({
        partner: withRiskScore(partnersStore[idx]),
        partners: sortByCreated(partnersStore).map((p) => withRiskScore(p)),
        stats: getPartnerStats(partnersStore),
        creditHistories: getMockCreditHistories(),
        mock: true,
      });
    }

    // ===== 更新合作方信用评级 =====
    if (action === 'update_rating') {
      const { id, credit_rating, reason } = body;
      if (!id) {
        return NextResponse.json(
          { error: '缺少 id 参数' },
          { status: 400 }
        );
      }
      if (!credit_rating || !VALID_RATINGS.includes(credit_rating)) {
        return NextResponse.json(
          { error: `credit_rating 无效，需为 ${VALID_RATINGS.join(' / ')}` },
          { status: 400 }
        );
      }

      const supabase = await getDb();
      if (supabase) {
        try {
          const { data: row, error: qErr } = await supabase
            .from('partner_profiles')
            .select('*')
            .eq('id', id)
            .maybeSingle();
          if (qErr) throw qErr;
          if (!row) {
            return NextResponse.json(
              { error: '合作方不存在' },
              { status: 404 }
            );
          }

          const current = mapPartner(row);
          const newNotes = reason
            ? `${current.notes}\n[评级变更] ${credit_rating}：${reason}`
            : current.notes;

          const { data: updated, error: updErr } = await supabase
            .from('partner_profiles')
            .update({
              credit_rating,
              notes: newNotes,
            })
            .eq('id', id)
            .select()
            .single();
          if (updErr) throw updErr;

          const result = mapPartner(updated);
          const { partners, histories } = await fetchAllFromDb(supabase);

          return NextResponse.json({
            partner: withRiskScore(result, histories),
            partners: sortByCreated(partners).map((p) =>
              withRiskScore(p, histories)
            ),
            stats: getPartnerStats(partners),
            creditHistories: histories,
            mock: false,
          });
        } catch (dbErr) {
          console.error('Partners update_rating DB 失败，降级到 Mock:', dbErr);
        }
      }

      // 降级：内存操作
      const idx = partnersStore.findIndex((p) => p.id === id);
      if (idx < 0) {
        return NextResponse.json({ error: '合作方不存在' }, { status: 404 });
      }

      partnersStore[idx] = {
        ...partnersStore[idx],
        credit_rating,
        notes: reason
          ? `${partnersStore[idx].notes}\n[评级变更] ${credit_rating}：${reason}`
          : partnersStore[idx].notes,
      };

      return NextResponse.json({
        partner: withRiskScore(partnersStore[idx]),
        partners: sortByCreated(partnersStore).map((p) => withRiskScore(p)),
        stats: getPartnerStats(partnersStore),
        creditHistories: getMockCreditHistories(),
        mock: true,
      });
    }

    return NextResponse.json(
      {
        error:
          'action 无效，需为 create / update / update_status / update_rating',
      },
      { status: 400 }
    );
  } catch (err) {
    console.error('Partners POST error:', err);
    return NextResponse.json(
      { error: `服务器错误: ${err instanceof Error ? err.message : '未知错误'}` },
      { status: 500 }
    );
  }
}
