// ===== 合同审查 API 路由（异步模式） =====
// POST: 接收文件，解析文档，启动后台AI审查，立即返回任务ID
// GET: 轮询审查状态

export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { parseDocument } from '@/lib/contract-parser';
import { isClaudeConfigured, reviewContract } from '@/lib/claude';
import { isSupabaseConfigured } from '@/lib/supabase';
import { MOCK_REVIEW_RESULT } from '@/lib/mock-data';

// 全局任务存储（开发模式下服务器持续运行）
type JobStatus = 'parsing' | 'analyzing' | 'completed' | 'failed';
interface ReviewJob {
  status: JobStatus;
  reviewId: string;
  error?: string;
  result?: {
    reviewId: string;
    contract_type: string;
    contract_title: string;
    risk_score: number;
    risk_count: number;
    high_risk_count: number;
    summary: string;
    mock: boolean;
  };
}

const globalForReview = globalThis as unknown as {
  __reviewJobs?: Map<string, ReviewJob>;
};

if (!globalForReview.__reviewJobs) {
  globalForReview.__reviewJobs = new Map();
}

const reviewJobs = globalForReview.__reviewJobs;

// ===== POST: 启动审查 =====
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: '未找到文件' }, { status: 400 });
    }

    // 文件大小限制 10MB
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: '文件大小超过10MB限制' }, { status: 400 });
    }

    // 检测文件类型
    const filename = file.name;
    let fileType: 'pdf' | 'docx' | 'txt';
    if (filename.endsWith('.pdf')) fileType = 'pdf';
    else if (filename.endsWith('.docx')) fileType = 'docx';
    else if (filename.endsWith('.txt')) fileType = 'txt';
    else return NextResponse.json({ error: '不支持的文件格式，请上传 PDF、Word 或文本文件' }, { status: 400 });

    // 读取文件内容
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // ===== Step 1: 同步解析文档 =====
    let contractText: string;
    try {
      contractText = await parseDocument(buffer, fileType);
    } catch (err) {
      return NextResponse.json({
        error: `文档解析失败: ${err instanceof Error ? err.message : '未知错误'}`
      }, { status: 500 });
    }

    if (!contractText || contractText.trim().length < 50) {
      return NextResponse.json({
        error: '文档解析结果为空或内容过少，请检查文件是否为有效合同文档'
      }, { status: 400 });
    }

    // ===== Step 2: 创建审查任务，后台执行 =====
    const reviewId = crypto.randomUUID();
    const jobId = crypto.randomUUID();

    reviewJobs.set(jobId, {
      status: 'analyzing',
      reviewId,
    });

    // 后台执行 AI 审查（不阻塞响应）
    processReviewAsync(jobId, reviewId, contractText, filename, fileType, file.size).catch(err => {
      console.error('Background review failed:', err);
      const job = reviewJobs.get(jobId);
      if (job) {
        job.status = 'failed';
        job.error = err instanceof Error ? err.message : '后台审查失败';
      }
    });

    // 立即返回任务 ID
    return NextResponse.json({
      jobId,
      reviewId,
      status: 'analyzing',
    });

  } catch (err) {
    console.error('Review API error:', err);
    return NextResponse.json({
      error: `服务器错误: ${err instanceof Error ? err.message : '未知错误'}`
    }, { status: 500 });
  }
}

// ===== GET: 轮询审查状态 =====
export async function GET(request: NextRequest) {
  const jobId = request.nextUrl.searchParams.get('jobId');

  if (!jobId) {
    return NextResponse.json({ error: '缺少 jobId 参数' }, { status: 400 });
  }

  const job = reviewJobs.get(jobId);

  if (!job) {
    return NextResponse.json({ error: '任务不存在或已过期' }, { status: 404 });
  }

  return NextResponse.json({
    jobId,
    status: job.status,
    error: job.error,
    result: job.result,
  });
}

// ===== 后台审查处理 =====
async function processReviewAsync(
  jobId: string,
  reviewId: string,
  contractText: string,
  filename: string,
  fileType: 'pdf' | 'docx' | 'txt',
  fileSize: number,
) {
  console.log(`[Review] 后台任务开始: jobId=${jobId}, filename=${filename}, textLen=${contractText.length}`);

  let reviewResult;

  // ===== AI 审查 =====
  if (isClaudeConfigured()) {
    console.log('[Review] 开始调用 DeepSeek API...');
    reviewResult = await reviewContract(contractText);
    console.log('[Review] DeepSeek API 调用完成，风险数:', reviewResult.risks?.length || 0);
  } else {
    // 演示模式
    await new Promise(resolve => setTimeout(resolve, 2000));
    reviewResult = { ...MOCK_REVIEW_RESULT };
  }

  // ===== 保存到数据库 =====
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
            filename: filename,
            file_type: fileType,
            file_size: fileSize,
            contract_text: contractText,
            contract_type: reviewResult.contract_type,
            contract_title: reviewResult.contract_title || filename,
            status: 'completed',
            risk_score: reviewResult.overall_risk_score,
            risk_count: reviewResult.risks.length,
            high_risk_count: reviewResult.risks.filter((r: any) => r.risk_level === 'high').length,
          })
          .select()
          .single();

        if (contractError) throw contractError;

        // 保存风险记录
        if (reviewResult.risks.length > 0 && contractRecord) {
          const riskRecords = reviewResult.risks.map((risk: any) => ({
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
              model: isClaudeConfigured() ? 'deepseek-chat' : 'mock',
            },
          });
      }
    } catch (dbErr) {
      console.error('Database save failed:', dbErr);
    }
  }

  // ===== 更新任务状态为完成 =====
  const finalReviewId = isSupabaseConfigured() ? reviewId : `mock-${Date.now()}`;

  const job = reviewJobs.get(jobId);
  if (job) {
    job.status = 'completed';
    job.result = {
      reviewId: finalReviewId,
      contract_type: reviewResult.contract_type,
      contract_title: reviewResult.contract_title,
      risk_score: reviewResult.overall_risk_score,
      risk_count: reviewResult.risks.length,
      high_risk_count: reviewResult.risks.filter((r: any) => r.risk_level === 'high').length,
      summary: reviewResult.summary,
      mock: !isClaudeConfigured(),
    };
  }
}
