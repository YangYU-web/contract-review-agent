// ===== 合规检查 API =====
// 提供合规规则列表查询与合同合规报告生成能力
// 演示模式：当 text 缺失或 demo=true 时返回 mock 合规报告

import { NextRequest, NextResponse } from 'next/server';
import {
  getComplianceRules,
  generateComplianceReport,
  getMockComplianceReport,
} from '@/lib/compliance-engine';

// GET: 返回合规规则列表
export async function GET() {
  try {
    const rules = getComplianceRules();
    // 按类别与编号排序
    const sorted = [...rules].sort((a, b) =>
      `${a.category}-${a.rule_number}`.localeCompare(
        `${b.category}-${b.rule_number}`
      )
    );
    return NextResponse.json({
      rules: sorted,
      total: sorted.length,
      mock: true,
    });
  } catch (err) {
    console.error('Compliance GET error:', err);
    return NextResponse.json(
      { error: `服务器错误: ${err instanceof Error ? err.message : '未知错误'}` },
      { status: 500 }
    );
  }
}

// POST: 生成合规报告
// 请求体：{ contract_id, text, title?, demo? }
// 演示模式（demo=true 或 text 为空）返回 mock 报告
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { contract_id, text, title, demo } = body;

    if (!contract_id || typeof contract_id !== 'string') {
      return NextResponse.json(
        { error: '缺少 contract_id 参数' },
        { status: 400 }
      );
    }

    // 演示模式：显式 demo 或合同文本缺失
    const isDemo = demo === true || !text || String(text).trim() === '';

    if (isDemo) {
      const mock = getMockComplianceReport(contract_id);
      // 若提供了 title，覆盖模拟数据中的标题
      const report = {
        ...mock,
        contract_id,
        contract_title: title || mock.contract_title,
      };
      return NextResponse.json({
        report,
        mock: true,
      });
    }

    // 正式模式：基于真实文本生成合规报告
    const report = generateComplianceReport(
      String(text),
      contract_id,
      title || `合同-${contract_id.slice(-6)}`
    );

    return NextResponse.json({
      report,
      mock: false,
    });
  } catch (err) {
    console.error('Compliance POST error:', err);
    return NextResponse.json(
      { error: `服务器错误: ${err instanceof Error ? err.message : '未知错误'}` },
      { status: 500 }
    );
  }
}
