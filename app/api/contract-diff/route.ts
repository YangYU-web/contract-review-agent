// ===== 合同对比分析 API =====
// 接收两份合同文本，调用对比分析函数，返回差异结果

export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { compareContracts, getMockComparisonResult } from '@/lib/contract-diff';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      text_a,
      text_b,
      title_a,
      title_b,
      type_a,
      type_b,
    } = body as {
      text_a?: string;
      text_b?: string;
      title_a?: string;
      title_b?: string;
      type_a?: string;
      type_b?: string;
    };

    // 参数校验
    if (!text_a || text_a.trim().length < 20) {
      return NextResponse.json(
        { error: '合同A文本过短或为空，请粘贴有效的合同内容' },
        { status: 400 }
      );
    }
    if (!text_b || text_b.trim().length < 20) {
      return NextResponse.json(
        { error: '合同B文本过短或为空，请粘贴有效的合同内容' },
        { status: 400 }
      );
    }

    // 执行对比分析
    const result = compareContracts(
      text_a,
      text_b,
      title_a || '合同A',
      title_b || '合同B',
      type_a || '未分类',
      type_b || '未分类'
    );

    return NextResponse.json(result);
  } catch (err) {
    console.error('Contract diff API error:', err);
    return NextResponse.json(
      { error: `服务器错误: ${err instanceof Error ? err.message : '未知错误'}` },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
  });
}
