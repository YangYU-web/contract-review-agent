// ===== 全文搜索 API =====
// 接收查询参数并调用搜索引擎返回结果
// 支持空查询返回全部合同

import { NextRequest, NextResponse } from 'next/server';
import { searchContracts, getSearchSuggestions } from '@/lib/search-engine';
import { SearchFilter } from '@/lib/types';

// GET: 执行全文搜索
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const q = searchParams.get('q') || '';
    const page = parseInt(searchParams.get('page') || '1', 10) || 1;
    const pageSize = parseInt(searchParams.get('page_size') || '10', 10) || 10;

    // 构建筛选条件
    const filters: SearchFilter = {
      contract_type: searchParams.get('contract_type') || undefined,
      risk_level: searchParams.get('risk_level') || undefined,
      date_from: searchParams.get('date_from') || undefined,
      date_to: searchParams.get('date_to') || undefined,
      party_name: searchParams.get('party_name') || undefined,
      status: searchParams.get('status') || undefined,
    };

    // 风险评分范围
    const scoreMin = searchParams.get('risk_score_min');
    const scoreMax = searchParams.get('risk_score_max');
    if (scoreMin !== null) {
      const v = Number(scoreMin);
      if (!Number.isNaN(v)) filters.risk_score_min = v;
    }
    if (scoreMax !== null) {
      const v = Number(scoreMax);
      if (!Number.isNaN(v)) filters.risk_score_max = v;
    }

    const response = searchContracts(q, filters, page, pageSize);

    return NextResponse.json({
      ...response,
      mock: true,
    });
  } catch (err) {
    console.error('Search GET error:', err);
    return NextResponse.json(
      { error: `服务器错误: ${err instanceof Error ? err.message : '未知错误'}` },
      { status: 500 }
    );
  }
}

// POST: 获取搜索建议（独立接口，便于前端即时调用）
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, action } = body as { query?: string; action?: string };

    if (action === 'suggest') {
      const suggestions = getSearchSuggestions(query || '');
      return NextResponse.json({ suggestions, mock: true });
    }

    return NextResponse.json(
      { error: 'action 必须为 suggest' },
      { status: 400 }
    );
  } catch (err) {
    console.error('Search POST error:', err);
    return NextResponse.json(
      { error: `服务器错误: ${err instanceof Error ? err.message : '未知错误'}` },
      { status: 500 }
    );
  }
}
