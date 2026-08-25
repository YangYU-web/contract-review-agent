// ===== 条款比对 API =====
export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { compareClauses, getMockComparison } from '@/lib/clause-comparison';
import { isSupabaseConfigured } from '@/lib/supabase';
import { splitIntoClauses, detectContractType } from '@/lib/contract-parser';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { contractId, contractText, contractType } = body;

    if (!contractId) {
      return NextResponse.json({ error: '缺少 contractId' }, { status: 400 });
    }

    let result;

    if (contractText && contractText.length > 50) {
      // 实际比对：解析条款并比对
      const clauses = splitIntoClauses(contractText);
      const type = contractType || detectContractType(contractText);
      result = compareClauses(contractText, type, contractId, clauses);
    } else {
      // Mock比对
      result = getMockComparison(contractId, contractType || '采购合同');
    }

    // 保存到数据库
    if (isSupabaseConfigured()) {
      try {
        const { getSupabaseServer } = await import('@/lib/supabase');
        const supabase = getSupabaseServer();
        if (supabase) {
          await supabase.from('clause_comparisons').upsert({
            contract_id: contractId,
            contract_type: result.contract_type,
            total_clauses: result.total_clauses,
            matched_clauses: result.matched_clauses,
            modified_clauses: result.modified_clauses,
            missing_clauses: result.missing_clauses,
            extra_clauses: result.extra_clauses,
            summary: result.summary,
            diffs: result.diffs,
          });
        }
      } catch (dbErr) {
        console.error('DB save failed:', dbErr);
      }
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error('Comparison API error:', err);
    return NextResponse.json({
      error: `服务器错误: ${err instanceof Error ? err.message : '未知错误'}`
    }, { status: 500 });
  }
}
