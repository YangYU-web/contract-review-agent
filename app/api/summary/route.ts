// ===== 智能合同摘要 API =====
// 提供合同摘要生成能力：接收合同文本，调用摘要库提取主体、财务、日期、术语并生成风险评估
// 演示模式：当 text 缺失或 demo=true 时返回 mock 摘要数据

export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { generateSummary, getMockSummary } from '@/lib/contract-summary';

// GET: 健康检查，返回接口可用状态
export async function GET() {
  try {
    return NextResponse.json({
      status: 'ok',
      mock: true,
      message: '合同摘要 API 可用',
    });
  } catch (err) {
    console.error('Summary GET error:', err);
    return NextResponse.json(
      { error: `服务器错误: ${err instanceof Error ? err.message : '未知错误'}` },
      { status: 500 }
    );
  }
}

// POST: 生成合同摘要
// 请求体：{ contract_id, text, title?, type?, demo? }
// 演示模式（demo=true 或 text 为空）返回 mock 数据
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      contract_id,
      text,
      title,
      type,
      demo,
    } = body;

    if (!contract_id || typeof contract_id !== 'string') {
      return NextResponse.json(
        { error: '缺少 contract_id 参数' },
        { status: 400 }
      );
    }

    // 演示模式：显式 demo 或合同文本缺失
    const isDemo = demo === true || !text || String(text).trim() === '';

    if (isDemo) {
      const mock = getMockSummary(contract_id);
      // 若提供了 title/type，覆盖模拟数据中的标题与类型
      const summary = {
        ...mock,
        contract_id,
        contract_title: title || mock.contract_title,
        contract_type: type || mock.contract_type,
      };
      return NextResponse.json({
        summary,
        mock: true,
      });
    }

    // 正式模式：基于真实文本生成摘要
    const summary = generateSummary(
      String(text),
      contract_id,
      title || `合同-${contract_id.slice(-6)}`,
      type || '合同'
    );

    return NextResponse.json({
      summary,
      mock: false,
    });
  } catch (err) {
    console.error('Summary POST error:', err);
    return NextResponse.json(
      { error: `服务器错误: ${err instanceof Error ? err.message : '未知错误'}` },
      { status: 500 }
    );
  }
}
