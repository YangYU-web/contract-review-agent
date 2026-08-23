// ===== 批量合同审查 API 路由 =====
// 接收多个合同文件，并行执行审查逻辑，返回批量结果

import { NextRequest, NextResponse } from 'next/server';
import { parseDocument, detectContractType, extractContractTitle } from '@/lib/contract-parser';
import { isClaudeConfigured, reviewContract } from '@/lib/claude';
import { isSupabaseConfigured } from '@/lib/supabase';
import { MOCK_REVIEW_RESULT } from '@/lib/mock-data';
import { BatchReviewItem, BatchReviewResult, AIReviewResult } from '@/lib/types';

// 文件大小限制 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// 支持的文件类型
type FileType = 'pdf' | 'docx' | 'txt';

// 检测文件类型
function detectFileType(filename: string): FileType | null {
  if (filename.endsWith('.pdf')) return 'pdf';
  if (filename.endsWith('.docx')) return 'docx';
  if (filename.endsWith('.txt')) return 'txt';
  return null;
}

// 处理单个文件的审查逻辑（参考 review/route.ts 的流程）
async function reviewSingleFile(file: File, index: number): Promise<BatchReviewItem> {
  const filename = file.name;
  const itemId = `${Date.now()}-${index}`;

  // 文件大小校验
  if (file.size > MAX_FILE_SIZE) {
    return {
      id: itemId,
      filename,
      status: 'failed',
      error: '文件大小超过10MB限制',
    };
  }

  // 文件类型校验
  const fileType = detectFileType(filename);
  if (!fileType) {
    return {
      id: itemId,
      filename,
      status: 'failed',
      error: '不支持的文件格式，请上传 PDF、Word 或文本文件',
    };
  }

  // 读取文件内容
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // ===== Step 1: 解析文档 =====
  let contractText: string;
  try {
    contractText = await parseDocument(buffer, fileType);
  } catch (err) {
    return {
      id: itemId,
      filename,
      status: 'failed',
      error: `文档解析失败: ${err instanceof Error ? err.message : '未知错误'}`,
    };
  }

  if (!contractText || contractText.trim().length < 50) {
    return {
      id: itemId,
      filename,
      status: 'failed',
      error: '文档解析结果为空或内容过少，请检查文件是否为有效合同文档',
    };
  }

  // ===== Step 2: AI审查 =====
  const reviewId = crypto.randomUUID();
  let reviewResult: AIReviewResult;

  if (isClaudeConfigured()) {
    // 实际模式：调用Claude API
    try {
      reviewResult = await reviewContract(contractText);
    } catch (err) {
      return {
        id: itemId,
        filename,
        status: 'failed',
        error: `AI审查失败: ${err instanceof Error ? err.message : '未知错误'}`,
      };
    }
  } else {
    // 演示模式：使用模拟数据，延迟500ms模拟处理时间
    await new Promise(resolve => setTimeout(resolve, 500));
    reviewResult = { ...MOCK_REVIEW_RESULT };
    // 根据文件内容动态检测合同类型和标题（演示模式下也尝试解析）
    try {
      reviewResult.contract_type = detectContractType(contractText);
      reviewResult.contract_title = extractContractTitle(contractText);
    } catch {
      // 解析失败则保留mock数据默认值
    }
  }

  // ===== Step 3: 保存到数据库 =====
  if (isSupabaseConfigured()) {
    try {
      const { getSupabaseServer } = await import('@/lib/supabase');
      const supabase = getSupabaseServer();
      if (supabase) {
        // 保存合同记录
        const { data: contractRecord, error: contractError } = await supabase
          .from('contracts')
          .insert({
            id: reviewId,
            user_id: '00000000-0000-0000-0000-000000000000', // TODO: 替换为真实用户ID
            filename: filename,
            file_type: fileType,
            file_size: file.size,
            contract_text: contractText,
            contract_type: reviewResult.contract_type,
            contract_title: reviewResult.contract_title || filename,
            status: 'completed',
            risk_score: reviewResult.overall_risk_score,
            risk_count: reviewResult.risks.length,
            high_risk_count: reviewResult.risks.filter(r => r.risk_level === 'high').length,
          })
          .select()
          .single();

        if (contractError) throw contractError;

        // 保存风险记录
        if (reviewResult.risks.length > 0 && contractRecord) {
          const riskRecords = reviewResult.risks.map(risk => ({
            contract_id: reviewId,
            clause_id: risk.clause_id,
            clause_text: risk.clause_text,
            risk_type: risk.risk_type,
            risk_level: risk.risk_level,
            risk_explanation: risk.risk_explanation,
            is_standard_clause: risk.is_standard_clause,
            suggested_redline: risk.suggested_redline,
            citation_verified: risk.citation_verified ?? false,
            user_decision: 'pending',
          }));

          await supabase
            .from('contract_risks')
            .insert(riskRecords);
        }

        // 记录审计日志
        await supabase
          .from('audit_logs')
          .insert({
            contract_id: reviewId,
            action: 'review_completed',
            actor: 'system',
            details: {
              risk_count: reviewResult.risks.length,
              risk_score: reviewResult.overall_risk_score,
              model: isClaudeConfigured() ? 'claude-3-5-sonnet' : 'mock',
              batch_review: true,
            },
          });
      }
    } catch (dbErr) {
      // 数据库保存失败不阻塞响应，结果已在reviewResult中
      console.error(`Database save failed for ${filename}:`, dbErr);
    }
  }

  // ===== Step 4: 返回单个文件结果 =====
  const finalReviewId = isSupabaseConfigured() ? reviewId : `mock-${reviewId}`;

  return {
    id: itemId,
    filename,
    status: 'completed',
    contract_type: reviewResult.contract_type,
    risk_score: reviewResult.overall_risk_score,
    risk_count: reviewResult.risks.length,
    high_risk_count: reviewResult.risks.filter(r => r.risk_level === 'high').length,
    reviewId: finalReviewId,
  };
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    // 获取所有上传的文件（files字段支持多个）
    const files = formData.getAll('files').filter(
      (entry): entry is File => entry instanceof File
    );

    if (files.length === 0) {
      return NextResponse.json({ error: '未找到文件' }, { status: 400 });
    }

    // 限制单次批量审查的文件数量（最多20个）
    if (files.length > 20) {
      return NextResponse.json(
        { error: '单次批量审查最多支持20个文件' },
        { status: 400 }
      );
    }

    // 并行处理所有文件
    const results = await Promise.all(
      files.map((file, index) => reviewSingleFile(file, index))
    );

    // 统计结果
    const completed = results.filter(r => r.status === 'completed').length;
    const failed = results.filter(r => r.status === 'failed').length;

    const batchResult: BatchReviewResult = {
      total: files.length,
      completed,
      failed,
      items: results,
    };

    return NextResponse.json(batchResult);
  } catch (err) {
    console.error('Batch review API error:', err);
    return NextResponse.json({
      error: `服务器错误: ${err instanceof Error ? err.message : '未知错误'}`,
    }, { status: 500 });
  }
}
