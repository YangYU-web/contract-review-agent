// ===== AI 智能定价分析 API =====
// 提供定价分析列表与统计查询，以及基于合同信息的新分析生成
// 数据存储：优先使用 Supabase 数据库（pricing_analyses），
// 数据库未配置或操作失败时优雅降级到内存 Mock 数据

import { NextRequest, NextResponse } from 'next/server';
import { PricingAnalysis, PriceComparison } from '@/lib/types';
import {
  getMockPricingAnalyses,
  analyzePricing,
  getPricingStats,
} from '@/lib/pricing-analysis';
import { isSupabaseConfigured } from '@/lib/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

// 模块级内存存储（演示模式降级时使用）：初始化为 Mock 数据
let pricingStore: PricingAnalysis[] = getMockPricingAnalyses();

// 获取 Supabase 服务端客户端（已配置时返回实例，否则返回 null）
async function getDb(): Promise<SupabaseClient | null> {
  if (!isSupabaseConfigured()) return null;
  const { getSupabaseServer } = await import('@/lib/supabase');
  return getSupabaseServer();
}

// ===== DB 行 -> PricingAnalysis 映射 =====
function mapAnalysis(row: Record<string, any>): PricingAnalysis {
  return {
    contract_id: row.contract_id ? String(row.contract_id) : '',
    contract_title: row.contract_title ?? '',
    contract_type: row.contract_type ?? '',
    contract_value: Number(row.contract_value ?? 0),
    currency: row.currency ?? 'CNY',
    unit_price: Number(row.unit_price ?? 0),
    unit: row.unit ?? '',
    market_benchmark: row.market_benchmark ?? {
      min_price: 0,
      max_price: 0,
      avg_price: 0,
      median_price: 0,
      sample_count: 0,
      source: '',
      last_updated: '',
    },
    comparison: (row.comparison ?? 'at_market') as PriceComparison,
    deviation_percentage: Number(row.deviation_percentage ?? 0),
    analysis: row.analysis ?? '',
    recommendation: row.recommendation ?? '',
    confidence: Number(row.confidence ?? 0),
    factors: Array.isArray(row.factors) ? row.factors : [],
    historical_prices: Array.isArray(row.historical_prices)
      ? row.historical_prices
      : [],
  };
}

// 将 PricingAnalysis 拆分为可写入数据库的对象（省略 id / created_at，由数据库生成）
function analysisToRow(a: PricingAnalysis): Record<string, any> {
  return {
    contract_id: a.contract_id || null,
    contract_title: a.contract_title,
    contract_type: a.contract_type,
    contract_value: a.contract_value,
    currency: a.currency,
    unit_price: a.unit_price,
    unit: a.unit,
    market_benchmark: a.market_benchmark,
    comparison: a.comparison,
    deviation_percentage: a.deviation_percentage,
    analysis: a.analysis,
    recommendation: a.recommendation,
    confidence: a.confidence,
    factors: a.factors,
    historical_prices: a.historical_prices,
  };
}

// 从数据库查询全部定价分析（按创建时间倒序）
async function fetchAnalysesFromDb(
  supabase: SupabaseClient
): Promise<PricingAnalysis[]> {
  const { data, error } = await supabase
    .from('pricing_analyses')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapAnalysis);
}

// GET: 返回定价分析列表与统计信息
// 支持 ?comparison= 与 ?contract_type= 过滤
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const comparison = searchParams.get('comparison') as PriceComparison | null;
    const contractType = searchParams.get('contract_type');

    const supabase = await getDb();
    if (supabase) {
      try {
        const all = await fetchAnalysesFromDb(supabase);

        let list = all;
        if (comparison) {
          list = list.filter((a) => a.comparison === comparison);
        }
        if (contractType) {
          list = list.filter((a) => a.contract_type === contractType);
        }

        // 统计基于全部分析（非过滤后），与原行为一致
        const stats = getPricingStats(all);

        return NextResponse.json({
          analyses: list,
          stats,
          mock: false,
        });
      } catch (dbErr) {
        console.error('Pricing DB 查询失败，降级到 Mock 数据:', dbErr);
      }
    }

    // 降级：内存 Mock 数据
    let list = pricingStore;
    if (comparison) {
      list = list.filter((a) => a.comparison === comparison);
    }
    if (contractType) {
      list = list.filter((a) => a.contract_type === contractType);
    }

    const stats = getPricingStats(pricingStore);

    return NextResponse.json({
      analyses: list,
      stats,
      mock: true,
    });
  } catch (err) {
    console.error('Pricing GET error:', err);
    return NextResponse.json(
      { error: `服务器错误: ${err instanceof Error ? err.message : '未知错误'}` },
      { status: 500 }
    );
  }
}

// POST: 基于合同信息生成新的定价分析
// 接收 { contract_id, contract_title, contract_type, contract_value, currency, unit_price, unit }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      contract_id,
      contract_title,
      contract_type,
      contract_value,
      currency,
      unit_price,
      unit,
    } = body;

    // 参数校验
    if (!contract_id || !contract_title || !contract_type) {
      return NextResponse.json(
        { error: '缺少必要参数：contract_id / contract_title / contract_type' },
        { status: 400 }
      );
    }
    if (
      typeof contract_value !== 'number' ||
      typeof unit_price !== 'number'
    ) {
      return NextResponse.json(
        { error: 'contract_value 与 unit_price 必须为数字' },
        { status: 400 }
      );
    }
    if (!unit || typeof unit !== 'string') {
      return NextResponse.json(
        { error: '缺少计价单位 unit' },
        { status: 400 }
      );
    }

    const analysis = analyzePricing(
      contract_value,
      currency || 'CNY',
      contract_type,
      unit_price,
      unit,
      contract_id,
      contract_title
    );

    const supabase = await getDb();
    if (supabase) {
      try {
        // 移除同 contract_id 的旧记录（保持单一最新分析）
        // 若 contract_id 不是合法 UUID，删除会无匹配或报错，由 try/catch 兜底降级
        await supabase
          .from('pricing_analyses')
          .delete()
          .eq('contract_id', contract_id);

        const { error: insErr } = await supabase
          .from('pricing_analyses')
          .insert(analysisToRow(analysis));
        if (insErr) throw insErr;

        const all = await fetchAnalysesFromDb(supabase);
        const stats = getPricingStats(all);

        return NextResponse.json({
          analysis,
          analyses: all,
          stats,
          mock: false,
        });
      } catch (dbErr) {
        console.error('Pricing create DB 失败，降级到 Mock:', dbErr);
      }
    }

    // 降级：内存操作
    // 移除同 ID 旧记录后追加新记录（演示模式下保持单一最新分析）
    pricingStore = pricingStore.filter((a) => a.contract_id !== contract_id);
    pricingStore.push(analysis);

    const stats = getPricingStats(pricingStore);

    return NextResponse.json({
      analysis,
      analyses: pricingStore,
      stats,
      mock: true,
    });
  } catch (err) {
    console.error('Pricing POST error:', err);
    return NextResponse.json(
      { error: `服务器错误: ${err instanceof Error ? err.message : '未知错误'}` },
      { status: 500 }
    );
  }
}
