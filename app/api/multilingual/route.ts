// ===== 多语言合同审查 API =====
// 提供语言检测与中英文条款对比两类能力

export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import {
  detectLanguage,
  splitBilingualClauses,
  splitContractClauses,
  compareBilingualClauses,
} from '@/lib/multilingual';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, text, text_a, text_b } = body as {
      action?: 'detect' | 'compare';
      text?: string;
      text_a?: string;
      text_b?: string;
    };

    if (!action) {
      return NextResponse.json(
        { error: '缺少 action 参数，支持 detect 或 compare' },
        { status: 400 }
      );
    }

    // 语言检测
    if (action === 'detect') {
      if (!text || text.trim().length === 0) {
        return NextResponse.json(
          { error: '缺少待检测文本' },
          { status: 400 }
        );
      }
      const result = detectLanguage(text);
      return NextResponse.json(result);
    }

    // 双语对比
    if (action === 'compare') {
      // text_a 视为中文合同，text_b 视为英文合同
      if (!text_a || text_a.trim().length === 0) {
        return NextResponse.json(
          { error: '缺少中文合同文本（text_a）' },
          { status: 400 }
        );
      }
      if (!text_b || text_b.trim().length === 0) {
        return NextResponse.json(
          { error: '缺少英文合同文本（text_b）' },
          { status: 400 }
        );
      }

      // 当传入单一 text 同时包含中英文时也可直接分割
      if (text && !text_a && !text_b) {
        const clauses = splitBilingualClauses(text);
        return NextResponse.json({ clauses });
      }

      // 分别将中英文合同按条款切分，再逐条对比
      const zhClauses = splitContractClauses(text_a);
      const enClauses = splitContractClauses(text_b);
      const clauses = compareBilingualClauses(zhClauses, enClauses);
      return NextResponse.json({ clauses });
    }

    return NextResponse.json(
      { error: `不支持的 action: ${action}` },
      { status: 400 }
    );
  } catch (err) {
    console.error('Multilingual API error:', err);
    return NextResponse.json(
      { error: `服务器错误: ${err instanceof Error ? err.message : '未知错误'}` },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ status: 'ok' });
}
