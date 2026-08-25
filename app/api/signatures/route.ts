// ===== 电子签章 API =====
// 提供签章请求列表、统计查询，以及创建 / 签署 / 拒签 / 作废操作
// 演示模式：签章请求存储在内存中的模块级变量

export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import {
  signatureStore,
  createSignatureRequest,
  signDocument,
  rejectSignature,
  voidSignatureRequest,
  getSignatureStats,
} from '@/lib/e-signature';

// GET: 返回签章请求列表和统计信息
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    let list = signatureStore;
    if (status) {
      list = list.filter((r) => r.status === status);
    }

    const stats = getSignatureStats(signatureStore);

    return NextResponse.json({
      requests: list,
      stats,
      mock: true,
    });
  } catch (err) {
    console.error('Signatures GET error:', err);
    return NextResponse.json(
      { error: `服务器错误: ${err instanceof Error ? err.message : '未知错误'}` },
      { status: 500 }
    );
  }
}

// POST: 创建 / 签署 / 拒签 / 作废
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body as { action: string };

    // ===== 创建签章请求 =====
    if (action === 'create') {
      const {
        contract_id,
        contract_title,
        signers,
        order,
        expires_in_days,
      } = body as {
        contract_id: string;
        contract_title: string;
        signers: { name: string; email: string; role: string }[];
        order: 'sequential' | 'parallel' | 'any';
        expires_in_days: number;
      };

      if (!contract_id || !contract_title) {
        return NextResponse.json(
          { error: '缺少 contract_id 或 contract_title 参数' },
          { status: 400 }
        );
      }
      if (!signers || !Array.isArray(signers) || signers.length === 0) {
        return NextResponse.json(
          { error: '至少需要一位签署人' },
          { status: 400 }
        );
      }
      if (!['sequential', 'parallel', 'any'].includes(order)) {
        return NextResponse.json(
          { error: 'order 必须为 sequential / parallel / any' },
          { status: 400 }
        );
      }

      const newRequest = createSignatureRequest(
        contract_id,
        contract_title,
        signers,
        order,
        expires_in_days || 7
      );
      signatureStore.push(newRequest);

      return NextResponse.json({
        request: newRequest,
        requests: signatureStore,
        stats: getSignatureStats(signatureStore),
        mock: true,
      });
    }

    // ===== 签署文档 =====
    if (action === 'sign') {
      const { request_id, signer_id, signature_image } = body as {
        request_id: string;
        signer_id: string;
        signature_image?: string;
      };

      if (!request_id || !signer_id) {
        return NextResponse.json(
          { error: '缺少 request_id 或 signer_id 参数' },
          { status: 400 }
        );
      }

      const result = signDocument(request_id, signer_id, signature_image);
      if (!result.success) {
        return NextResponse.json(
          { error: result.error || '签署失败' },
          { status: 400 }
        );
      }

      return NextResponse.json({
        request: result.request,
        requests: signatureStore,
        stats: getSignatureStats(signatureStore),
        mock: true,
      });
    }

    // ===== 拒签 =====
    if (action === 'reject') {
      const { request_id, signer_id, reason } = body as {
        request_id: string;
        signer_id: string;
        reason: string;
      };

      if (!request_id || !signer_id) {
        return NextResponse.json(
          { error: '缺少 request_id 或 signer_id 参数' },
          { status: 400 }
        );
      }

      const result = rejectSignature(request_id, signer_id, reason || '未提供拒签原因');
      if (!result.success) {
        return NextResponse.json(
          { error: result.error || '拒签失败' },
          { status: 400 }
        );
      }

      return NextResponse.json({
        request: result.request,
        requests: signatureStore,
        stats: getSignatureStats(signatureStore),
        mock: true,
      });
    }

    // ===== 作废 =====
    if (action === 'void') {
      const { request_id } = body as { request_id: string };

      if (!request_id) {
        return NextResponse.json(
          { error: '缺少 request_id 参数' },
          { status: 400 }
        );
      }

      const result = voidSignatureRequest(request_id);
      if (!result.success) {
        return NextResponse.json(
          { error: result.error || '作废失败' },
          { status: 400 }
        );
      }

      return NextResponse.json({
        request: result.request,
        requests: signatureStore,
        stats: getSignatureStats(signatureStore),
        mock: true,
      });
    }

    return NextResponse.json(
      { error: 'action 必须为 create / sign / reject / void' },
      { status: 400 }
    );
  } catch (err) {
    console.error('Signatures POST error:', err);
    return NextResponse.json(
      { error: `服务器错误: ${err instanceof Error ? err.message : '未知错误'}` },
      { status: 500 }
    );
  }
}
