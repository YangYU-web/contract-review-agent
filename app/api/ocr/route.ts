// ===== OCR 扫描件识别 API =====
// 接收上传的图片/PDF文件，模拟OCR处理并返回识别结果
// 优先使用 Supabase 数据库（ocr_results 表）存储/查询历史记录，数据库未配置或操作失败时优雅降级到内存 Mock 数据。
// 注意：OCR 识别本身保留模拟实现（因为没有真实OCR引擎），仅历史记录改为数据库查询。

import { NextRequest, NextResponse } from 'next/server';
import {
  simulateOCR,
  getMockOCRResults,
  getOCRStats,
} from '@/lib/ocr-simulator';
import { OCRResult, OCRStatus, ContractLanguage } from '@/lib/types';
import { isSupabaseConfigured } from '@/lib/supabase';

// 模拟处理延迟
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 获取 Supabase 服务端客户端（如未配置返回 null）
async function getDb() {
  if (!isSupabaseConfigured()) return null;
  const { getSupabaseServer } = await import('@/lib/supabase');
  return getSupabaseServer();
}

// 将数据库行映射为 OCRResult（处理 DECIMAL -> number 等类型转换）
function mapRow(row: any): OCRResult {
  return {
    id: row.id,
    filename: row.filename,
    status: (row.status as OCRStatus) || 'completed',
    language: (row.language as ContractLanguage) || 'zh',
    total_pages: row.total_pages ?? 1,
    processed_pages: row.processed_pages ?? 0,
    extracted_text: row.extracted_text || '',
    confidence: Number(row.confidence) || 0,
    page_results: Array.isArray(row.page_results)
      ? row.page_results
      : row.page_results
        ? JSON.parse(row.page_results)
        : [],
    warnings: row.warnings || [],
    created_at: row.created_at || new Date().toISOString(),
    completed_at: row.completed_at || undefined,
  };
}

// 从数据库读取全部 OCR 历史记录
async function fetchOcrFromDb(supabase: any): Promise<OCRResult[]> {
  const { data, error } = await supabase
    .from('ocr_results')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(mapRow);
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: '未检测到上传文件，请选择图片或PDF文件' },
        { status: 400 }
      );
    }

    const filename = file.name || '未命名文件';
    const fileSize = file.size;

    // 文件类型校验：支持图片与PDF
    const acceptedExtensions = ['.png', '.jpg', '.jpeg', '.pdf'];
    const isAccepted =
      acceptedExtensions.some(ext => filename.toLowerCase().endsWith(ext)) ||
      file.type.startsWith('image/') ||
      file.type === 'application/pdf';

    if (!isAccepted) {
      return NextResponse.json(
        { error: '不支持的文件格式，仅支持 PNG / JPG / JPEG 图片与 PDF 文件' },
        { status: 400 }
      );
    }

    // 文件大小校验（最大20MB）
    if (fileSize > 20 * 1024 * 1024) {
      return NextResponse.json(
        { error: '文件过大，请上传小于 20MB 的文件' },
        { status: 400 }
      );
    }

    // 随机生成页数（1-10），PDF按体积粗略估算更合理
    let pageCount: number;
    if (filename.toLowerCase().endsWith('.pdf')) {
      // PDF按每2MB约1页估算，并在1-10间
      const estimated = Math.max(1, Math.round(fileSize / (2 * 1024 * 1024)));
      pageCount = Math.min(10, estimated);
    } else {
      // 图片固定1页
      pageCount = 1;
    }
    // 兜底随机
    if (pageCount < 1) pageCount = 1;

    // 模拟OCR处理延迟
    await sleep(1500);

    // OCR 识别保留模拟实现（没有真实OCR引擎）
    const result = simulateOCR(filename, pageCount);

    // 尝试将识别结果写入数据库（user_id 置空，因未启用认证）
    const supabase = await getDb();
    if (supabase) {
      try {
        const insertPayload: any = {
          filename: result.filename,
          language: result.language,
          total_pages: result.total_pages,
          processed_pages: result.processed_pages,
          extracted_text: result.extracted_text,
          confidence: result.confidence,
          page_results: result.page_results,
          warnings: result.warnings,
          status: result.status,
          completed_at: result.completed_at || null,
          user_id: null,
        };
        const { data, error } = await supabase
          .from('ocr_results')
          .insert(insertPayload)
          .select()
          .single();
        if (error) throw error;
        // 使用数据库返回的记录（含真实 id 和 created_at）
        if (data) {
          const dbResult = mapRow(data);
          return NextResponse.json(dbResult);
        }
      } catch (dbErr) {
        console.error('OCR POST DB insert error, returning simulated result:', dbErr);
      }
    }

    // 降级：直接返回模拟结果（不持久化）
    return NextResponse.json(result);
  } catch (err) {
    console.error('OCR API error:', err);
    return NextResponse.json(
      { error: `服务器错误: ${err instanceof Error ? err.message : '未知错误'}` },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    // 优先尝试数据库
    const supabase = await getDb();
    if (supabase) {
      try {
        const results = await fetchOcrFromDb(supabase);
        const stats = getOCRStats(results);
        return NextResponse.json({ results, stats, mock: false });
      } catch (dbErr) {
        console.error('OCR GET DB error, falling back to mock:', dbErr);
      }
    }

    // 降级：内存 Mock 数据
    const results = getMockOCRResults();
    const stats = getOCRStats(results);
    return NextResponse.json({ results, stats, mock: true });
  } catch (err) {
    console.error('OCR GET API error:', err);
    return NextResponse.json(
      { error: `服务器错误: ${err instanceof Error ? err.message : '未知错误'}` },
      { status: 500 }
    );
  }
}
