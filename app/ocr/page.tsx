'use client';

export const runtime = 'edge';

import { useState, useEffect, useCallback } from 'react';
import {
  ScanLine,
  FileImage,
  History,
  Info,
  Clock,
} from 'lucide-react';
import OCRUpload from '@/components/OCRUpload';
import { OCRResult, LANGUAGE_LABELS } from '@/lib/types';

// ===== 扫描件 OCR 识别页面 =====
// 左侧上传扫描件进行OCR识别，右侧展示历史识别记录，底部附使用说明

// 置信度颜色
function getConfidenceColor(value: number): string {
  if (value >= 85) return '#16a34a';
  if (value >= 70) return '#d97706';
  return '#dc2626';
}

// 格式化时间
function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    const now = Date.now();
    const diff = now - d.getTime();
    const hour = 3600 * 1000;
    if (diff < hour) return `${Math.max(1, Math.floor(diff / 60000))}分钟前`;
    if (diff < 24 * hour) return `${Math.floor(diff / hour)}小时前`;
    if (diff < 7 * 24 * hour) return `${Math.floor(diff / (24 * hour))}天前`;
    return d.toLocaleDateString('zh-CN');
  } catch {
    return '未知时间';
  }
}

export default function OCRPage() {
  const [history, setHistory] = useState<OCRResult[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // 加载历史OCR记录
  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch('/api/ocr');
      const data = await res.json();
      setHistory(data.results || []);
    } catch (err) {
      console.error('加载历史记录失败:', err);
      setHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* 页面标题 */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-11 h-11 rounded-xl gradient-bg flex items-center justify-center">
          <ScanLine className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">扫描件OCR识别</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            上传合同扫描件图片或PDF，自动识别文字并提取用于智能审查
          </p>
        </div>
      </div>

      {/* 主体：左右两栏 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
        {/* 左侧：上传与识别 */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <FileImage className="w-5 h-5 text-brand-600" />
              <h2 className="text-base font-semibold text-slate-800">上传扫描件</h2>
            </div>
            <OCRUpload />
          </div>
        </div>

        {/* 右侧：历史记录 */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden sticky top-4">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
              <History className="w-5 h-5 text-brand-600" />
              <h2 className="text-base font-semibold text-slate-800">历史识别记录</h2>
              <span className="ml-auto text-xs text-slate-400">{history.length} 条</span>
            </div>

            <div className="max-h-[560px] overflow-y-auto">
              {loadingHistory ? (
                <div className="p-8 text-center">
                  <div className="w-8 h-8 border-2 border-brand-200 border-t-brand-500 rounded-full spinner mx-auto mb-3" />
                  <p className="text-sm text-slate-400">加载历史记录...</p>
                </div>
              ) : history.length === 0 ? (
                <div className="p-8 text-center">
                  <History className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">暂无历史记录</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {history.map((item) => (
                    <div key={item.id} className="p-4 hover:bg-slate-50/60 transition-colors">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileImage className="w-4 h-4 text-slate-400 shrink-0" />
                          <p className="text-sm font-medium text-slate-700 truncate">
                            {item.filename}
                          </p>
                        </div>
                        <span
                          className="text-xs font-semibold shrink-0"
                          style={{ color: getConfidenceColor(item.confidence) }}
                        >
                          {item.confidence}%
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-400 flex-wrap">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatTime(item.created_at)}
                        </span>
                        <span className="text-slate-300">|</span>
                        <span>{LANGUAGE_LABELS[item.language]}</span>
                        <span className="text-slate-300">|</span>
                        <span>{item.total_pages}页</span>
                      </div>
                      {/* 置信度进度条 */}
                      <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${item.confidence}%`,
                            backgroundColor: getConfidenceColor(item.confidence),
                          }}
                        />
                      </div>
                      {item.warnings.length > 0 && (
                        <p className="text-xs text-amber-500 mt-2 truncate">
                          ⚠ {item.warnings[0]}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 底部：使用说明 */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <Info className="w-5 h-5 text-brand-600" />
          <h2 className="text-base font-semibold text-slate-800">OCR使用说明</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 支持的格式 */}
          <div className="bg-slate-50 rounded-xl p-4">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 mb-2">
              <FileImage className="w-4 h-4 text-brand-500" />
              支持的格式
            </div>
            <ul className="space-y-1.5 text-sm text-slate-600">
              <li className="flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-brand-400" />
                PNG 图片（.png）
              </li>
              <li className="flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-brand-400" />
                JPG / JPEG 图片（.jpg / .jpeg）
              </li>
              <li className="flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-brand-400" />
                PDF 文档（.pdf，多页）
              </li>
              <li className="flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-brand-400" />
                单文件最大 20MB
              </li>
            </ul>
          </div>

          {/* 识别能力 */}
          <div className="bg-slate-50 rounded-xl p-4">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 mb-2">
              <ScanLine className="w-4 h-4 text-brand-500" />
              识别能力
            </div>
            <ul className="space-y-1.5 text-sm text-slate-600">
              <li className="flex items-start gap-1.5">
                <span className="w-1 h-1 rounded-full bg-brand-400 mt-1.5 shrink-0" />
                自动识别中英文及双语合同
              </li>
              <li className="flex items-start gap-1.5">
                <span className="w-1 h-1 rounded-full bg-brand-400 mt-1.5 shrink-0" />
                逐页输出文本与区域级置信度
              </li>
              <li className="flex items-start gap-1.5">
                <span className="w-1 h-1 rounded-full bg-brand-400 mt-1.5 shrink-0" />
                智能检测印章、水印、手写区域
              </li>
              <li className="flex items-start gap-1.5">
                <span className="w-1 h-1 rounded-full bg-brand-400 mt-1.5 shrink-0" />
                一键提取文本进入智能审查
              </li>
            </ul>
          </div>

          {/* 注意事项 */}
          <div className="bg-amber-50 rounded-xl p-4">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-amber-700 mb-2">
              <Info className="w-4 h-4 text-amber-500" />
              注意事项
            </div>
            <ul className="space-y-1.5 text-sm text-amber-700">
              <li className="flex items-start gap-1.5">
                <span className="w-1 h-1 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                请确保扫描件清晰、无倾斜
              </li>
              <li className="flex items-start gap-1.5">
                <span className="w-1 h-1 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                置信度低于 70% 的页面建议人工复核
              </li>
              <li className="flex items-start gap-1.5">
                <span className="w-1 h-1 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                手写批注区域识别准确度有限
              </li>
              <li className="flex items-start gap-1.5">
                <span className="w-1 h-1 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                印章遮挡处文字可能识别不全
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
