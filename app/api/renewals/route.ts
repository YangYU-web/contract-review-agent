// ===== 自动续签引擎 API =====
// 提供续签策略列表与统计查询，以及创建、触发、完成检查项、取消续签能力
// 数据存储：优先使用 Supabase 数据库（renewal_policies），
// 数据库未配置或操作失败时优雅降级到内存 Mock 数据

import { NextRequest, NextResponse } from 'next/server';
import {
  RenewalPolicy,
  RenewalStrategy,
  RenewalStatus,
} from '@/lib/types';
import {
  getMockRenewalPolicies,
  createRenewalPolicy,
  completeChecklistItem,
  getRenewalStats,
  getUpcomingRenewals,
  generateDefaultChecklist,
} from '@/lib/renewal-engine';
import { isSupabaseConfigured } from '@/lib/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

// 模块级内存存储（演示模式降级时使用）：初始化为 Mock 数据
let renewalsStore: RenewalPolicy[] = getMockRenewalPolicies();

// 有效的续签策略集合
const VALID_STRATEGIES: RenewalStrategy[] = [
  'auto_renew',
  'notify_only',
  'manual_review',
  'no_renewal',
];

// 按到期日期升序排序（已过期排前）
function sortByEndDate(list: RenewalPolicy[]): RenewalPolicy[] {
  return [...list].sort(
    (a, b) =>
      new Date(a.current_end_date).getTime() -
      new Date(b.current_end_date).getTime()
  );
}

// 对策略应用续签触发转换（供 API 内部使用，操作内存存储或回写数据库前计算）
function applyTriggerToStore(policy: RenewalPolicy): RenewalPolicy {
  const now = new Date().toISOString();
  return {
    ...policy,
    status: 'in_progress',
    triggered_at: now,
    // 重新生成检查清单（保留已有完成项状态）
    checklist: generateDefaultChecklist(policy.strategy).map((item) => {
      const existing = policy.checklist.find((c) => c.id === item.id);
      return existing
        ? { ...item, completed: existing.completed, completed_at: existing.completed_at }
        : item;
    }),
  };
}

// 获取 Supabase 服务端客户端（已配置时返回实例，否则返回 null）
async function getDb(): Promise<SupabaseClient | null> {
  if (!isSupabaseConfigured()) return null;
  const { getSupabaseServer } = await import('@/lib/supabase');
  return getSupabaseServer();
}

// ===== DB 行 -> RenewalPolicy 映射 =====
function mapPolicy(row: Record<string, any>): RenewalPolicy {
  return {
    id: String(row.id),
    contract_id: row.contract_id ? String(row.contract_id) : '',
    contract_title: row.contract_title ?? '',
    contract_type: row.contract_type ?? '',
    strategy: row.strategy as RenewalStrategy,
    renewal_term_months: row.renewal_term_months ?? 0,
    notice_days_before: row.notice_days_before ?? 0,
    price_adjustment_cap: Number(row.price_adjustment_cap ?? 0),
    auto_conditions:
      row.auto_conditions ?? {
        min_risk_score: 0,
        max_risk_score: 60,
        requires_approval: true,
        max_price_increase: Number(row.price_adjustment_cap ?? 0),
      },
    status: row.status as RenewalStatus,
    current_end_date: row.current_end_date ?? '',
    proposed_end_date: row.proposed_end_date ?? '',
    triggered_at: row.triggered_at ?? undefined,
    completed_at: row.completed_at ?? undefined,
    checklist: Array.isArray(row.checklist) ? row.checklist : [],
  };
}

// 从数据库查询全部续签策略
async function fetchPoliciesFromDb(
  supabase: SupabaseClient
): Promise<RenewalPolicy[]> {
  const { data, error } = await supabase
    .from('renewal_policies')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapPolicy);
}

// GET: 返回续签策略列表与统计
// 支持 ?status= 过滤状态，?upcoming=30 查询未来 N 天内到期的续签
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as RenewalStatus | null;
    const upcoming = searchParams.get('upcoming');

    const supabase = await getDb();
    if (supabase) {
      try {
        const all = await fetchPoliciesFromDb(supabase);

        let list = all;
        if (status) {
          list = list.filter((p) => p.status === status);
        }
        if (upcoming) {
          const days = parseInt(upcoming, 10);
          if (!Number.isNaN(days) && days > 0) {
            list = getUpcomingRenewals(list, days);
          }
        }

        return NextResponse.json({
          policies: sortByEndDate(list),
          stats: getRenewalStats(all),
          mock: false,
        });
      } catch (dbErr) {
        console.error('Renewals DB 查询失败，降级到 Mock 数据:', dbErr);
      }
    }

    // 降级：内存 Mock 数据
    let list = renewalsStore;
    if (status) {
      list = list.filter((p) => p.status === status);
    }
    if (upcoming) {
      const days = parseInt(upcoming, 10);
      if (!Number.isNaN(days) && days > 0) {
        list = getUpcomingRenewals(list, days);
      }
    }

    return NextResponse.json({
      policies: sortByEndDate(list),
      stats: getRenewalStats(renewalsStore),
      mock: true,
    });
  } catch (err) {
    console.error('Renewals GET error:', err);
    return NextResponse.json(
      { error: `服务器错误: ${err instanceof Error ? err.message : '未知错误'}` },
      { status: 500 }
    );
  }
}

// POST: 创建或执行 action（create / trigger / complete_checklist / cancel）
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = body.action as
      | 'create'
      | 'trigger'
      | 'complete_checklist'
      | 'cancel'
      | undefined;

    // ===== 创建续签策略 =====
    if (!action || action === 'create') {
      const {
        contract_id,
        contract_title,
        contract_type,
        strategy,
        renewal_term_months,
        notice_days_before,
        price_adjustment_cap,
        auto_conditions,
      } = body;

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
      if (!strategy || !VALID_STRATEGIES.includes(strategy)) {
        return NextResponse.json(
          { error: `strategy 无效，需为 ${VALID_STRATEGIES.join(' / ')}` },
          { status: 400 }
        );
      }

      // 通过领域函数计算默认日期/检查清单/自动续签条件
      const draft = createRenewalPolicy(
        contract_id,
        contract_title,
        contract_type || '其他',
        strategy,
        Number(renewal_term_months) || 12,
        Number(notice_days_before) || 30,
        Number(price_adjustment_cap) || 5,
        auto_conditions
      );

      const supabase = await getDb();
      if (supabase) {
        try {
          const { data: inserted, error: insErr } = await supabase
            .from('renewal_policies')
            .insert({
              contract_id: draft.contract_id,
              contract_title: draft.contract_title,
              contract_type: draft.contract_type,
              strategy: draft.strategy,
              renewal_term_months: draft.renewal_term_months,
              notice_days_before: draft.notice_days_before,
              price_adjustment_cap: draft.price_adjustment_cap,
              auto_conditions: draft.auto_conditions,
              status: draft.status,
              current_end_date: draft.current_end_date,
              proposed_end_date: draft.proposed_end_date,
              checklist: draft.checklist,
            })
            .select()
            .single();
          if (insErr) throw insErr;

          const policy = mapPolicy(inserted);
          const all = await fetchPoliciesFromDb(supabase);

          return NextResponse.json({
            policy,
            policies: sortByEndDate(all),
            stats: getRenewalStats(all),
            mock: false,
          });
        } catch (dbErr) {
          console.error('Renewals create DB 失败，降级到 Mock:', dbErr);
        }
      }

      // 降级：内存操作
      renewalsStore.unshift(draft);

      return NextResponse.json({
        policy: draft,
        policies: sortByEndDate(renewalsStore),
        stats: getRenewalStats(renewalsStore),
        mock: true,
      });
    }

    // ===== 触发续签 =====
    if (action === 'trigger') {
      const { policy_id } = body;
      if (!policy_id) {
        return NextResponse.json(
          { error: '缺少 policy_id 参数' },
          { status: 400 }
        );
      }

      const supabase = await getDb();
      if (supabase) {
        try {
          const { data: row, error: pErr } = await supabase
            .from('renewal_policies')
            .select('*')
            .eq('id', policy_id)
            .maybeSingle();
          if (pErr) throw pErr;
          if (!row) {
            return NextResponse.json(
              { error: '续签策略不存在' },
              { status: 404 }
            );
          }
          const current = mapPolicy(row);
          if (current.status !== 'scheduled') {
            return NextResponse.json(
              {
                error: `当前状态为 ${current.status}，仅已安排状态可触发续签`,
              },
              { status: 400 }
            );
          }

          const triggered = applyTriggerToStore(current);
          const now = triggered.triggered_at!;
          const { error: updErr } = await supabase
            .from('renewal_policies')
            .update({
              status: 'in_progress',
              triggered_at: now,
              checklist: triggered.checklist,
            })
            .eq('id', policy_id);
          if (updErr) throw updErr;

          const all = await fetchPoliciesFromDb(supabase);
          const updated = all.find((p) => p.id === String(policy_id)) ?? triggered;

          return NextResponse.json({
            policy: updated,
            policies: sortByEndDate(all),
            stats: getRenewalStats(all),
            mock: false,
          });
        } catch (dbErr) {
          console.error('Renewals trigger DB 失败，降级到 Mock:', dbErr);
        }
      }

      // 降级：内存操作
      const idx = renewalsStore.findIndex((p) => p.id === policy_id);
      if (idx < 0) {
        return NextResponse.json({ error: '续签策略不存在' }, { status: 404 });
      }
      if (renewalsStore[idx].status !== 'scheduled') {
        return NextResponse.json(
          {
            error: `当前状态为 ${renewalsStore[idx].status}，仅已安排状态可触发续签`,
          },
          { status: 400 }
        );
      }
      renewalsStore[idx] = applyTriggerToStore(renewalsStore[idx]);

      return NextResponse.json({
        policy: renewalsStore[idx],
        policies: sortByEndDate(renewalsStore),
        stats: getRenewalStats(renewalsStore),
        mock: true,
      });
    }

    // ===== 完成检查清单项 =====
    if (action === 'complete_checklist') {
      const { policy_id, item_id } = body;
      if (!policy_id) {
        return NextResponse.json(
          { error: '缺少 policy_id 参数' },
          { status: 400 }
        );
      }
      if (!item_id) {
        return NextResponse.json(
          { error: '缺少 item_id 参数' },
          { status: 400 }
        );
      }

      const supabase = await getDb();
      if (supabase) {
        try {
          const { data: row, error: pErr } = await supabase
            .from('renewal_policies')
            .select('*')
            .eq('id', policy_id)
            .maybeSingle();
          if (pErr) throw pErr;
          if (!row) {
            return NextResponse.json(
              { error: '续签策略不存在' },
              { status: 404 }
            );
          }

          const current = mapPolicy(row);
          const updated = completeChecklistItem(current, item_id);
          const { error: updErr } = await supabase
            .from('renewal_policies')
            .update({ checklist: updated.checklist })
            .eq('id', policy_id);
          if (updErr) throw updErr;

          const all = await fetchPoliciesFromDb(supabase);
          const result = all.find((p) => p.id === String(policy_id)) ?? updated;

          return NextResponse.json({
            policy: result,
            policies: sortByEndDate(all),
            stats: getRenewalStats(all),
            mock: false,
          });
        } catch (dbErr) {
          console.error('Renewals complete_checklist DB 失败，降级到 Mock:', dbErr);
        }
      }

      // 降级：内存操作
      const idx = renewalsStore.findIndex((p) => p.id === policy_id);
      if (idx < 0) {
        return NextResponse.json({ error: '续签策略不存在' }, { status: 404 });
      }

      renewalsStore[idx] = completeChecklistItem(renewalsStore[idx], item_id);

      return NextResponse.json({
        policy: renewalsStore[idx],
        policies: sortByEndDate(renewalsStore),
        stats: getRenewalStats(renewalsStore),
        mock: true,
      });
    }

    // ===== 取消续签 =====
    if (action === 'cancel') {
      const { policy_id, reason } = body;
      if (!policy_id) {
        return NextResponse.json(
          { error: '缺少 policy_id 参数' },
          { status: 400 }
        );
      }

      const supabase = await getDb();
      if (supabase) {
        try {
          const { data: row, error: pErr } = await supabase
            .from('renewal_policies')
            .select('*')
            .eq('id', policy_id)
            .maybeSingle();
          if (pErr) throw pErr;
          if (!row) {
            return NextResponse.json(
              { error: '续签策略不存在' },
              { status: 404 }
            );
          }
          const current = mapPolicy(row);
          if (current.status === 'completed') {
            return NextResponse.json(
              { error: '已完成的续签不可取消' },
              { status: 400 }
            );
          }

          const { error: updErr } = await supabase
            .from('renewal_policies')
            .update({ status: 'cancelled' })
            .eq('id', policy_id);
          if (updErr) throw updErr;

          const all = await fetchPoliciesFromDb(supabase);
          const updated = all.find((p) => p.id === String(policy_id)) ?? {
            ...current,
            status: 'cancelled' as RenewalStatus,
          };

          return NextResponse.json({
            policy: updated,
            cancel_reason: reason || null,
            policies: sortByEndDate(all),
            stats: getRenewalStats(all),
            mock: false,
          });
        } catch (dbErr) {
          console.error('Renewals cancel DB 失败，降级到 Mock:', dbErr);
        }
      }

      // 降级：内存操作
      const idx = renewalsStore.findIndex((p) => p.id === policy_id);
      if (idx < 0) {
        return NextResponse.json({ error: '续签策略不存在' }, { status: 404 });
      }
      if (renewalsStore[idx].status === 'completed') {
        return NextResponse.json(
          { error: '已完成的续签不可取消' },
          { status: 400 }
        );
      }

      renewalsStore[idx] = {
        ...renewalsStore[idx],
        status: 'cancelled' as RenewalStatus,
      };

      return NextResponse.json({
        policy: renewalsStore[idx],
        cancel_reason: reason || null,
        policies: sortByEndDate(renewalsStore),
        stats: getRenewalStats(renewalsStore),
        mock: true,
      });
    }

    return NextResponse.json(
      { error: 'action 无效，需为 create / trigger / complete_checklist / cancel' },
      { status: 400 }
    );
  } catch (err) {
    console.error('Renewals POST error:', err);
    return NextResponse.json(
      { error: `服务器错误: ${err instanceof Error ? err.message : '未知错误'}` },
      { status: 500 }
    );
  }
}
