'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Upload,
  FileImage,
  ScanLine,
  Loader2,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  Eye,
} from 'lucide-react';
import { OCRResult, LANGUAGE_LABELS } from '@/lib/types';

// ===== OCR 扫描件上传与识别组件 =====
// 拖拽/点击上传图片或PDF，模拟OCR处理后展示语言、页数、置信度、警告与文本预览

const ACCEPTED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.pdf'];
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

type UploadStatus = 'idle' | 'uploading' | 'processing' | 'completed' | 'error';

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// 置信度颜色
function getConfidenceColor(value: number): string {
  if (value >= 85) return '#16a34a';
  if (value >= 70) return '#d97706';
  return '#dc2626';
}

export default function OCRUpload() {
  const router = useRouter();
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<OCRResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showFullText, setShowFullText] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // 校验文件类型与大小
  const validateFile = (file: File): { valid: boolean; error?: string } => {
    const isValidType =
      ACCEPTED_EXTENSIONS.some(ext => file.name.toLowerCase().endsWith(ext)) ||
      file.type.startsWith('image/') ||
      file.type === 'application/pdf';
    if (!isValidType) {
      return { valid: false, error: '不支持的格式，仅支持 PNG / JPG / JPEG 图片与 PDF' };
    }
    if (file.size > MAX_FILE_SIZE) {
      return { valid: false, error: '文件超过 20MB 大小限制' };
    }
    return { valid: true };
  };

  const clearProgressTimer = () => {
    if (progressTimer.current) {
      clearInterval(progressTimer.current);
      progressTimer.current = null;
    }
  };

  // 处理文件上传与OCR
  const processFile = useCallback(async (file: File) => {
    const { valid, error: validationError } = validateFile(file);
    if (!valid) {
      setStatus('error');
      setError(validationError || null);
      return;
    }

    setSelectedFile(file);
    setError(null);
    setResult(null);
    setShowFullText(false);
    setStatus('uploading');
    setProgress(0);

    // 模拟上传进度推进
    clearProgressTimer();
    progressTimer.current = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearProgressTimer();
          return 100;
        }
        return Math.min(100, prev + Math.random() * 18);
      });
    }, 120);

    try {
      const formData = new FormData();
      formData.append('file', file);

      setStatus('processing');

      const res = await fetch('/api/ocr', {
        method: 'POST',
        body: formData,
      });

      clearProgressTimer();
      setProgress(100);

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `请求失败 (${res.status})`);
      }

      const data = await res.json();
      setResult(data as OCRResult);
      setStatus('completed');
    } catch (err) {
      clearProgressTimer();
      setStatus('error');
      setError(err instanceof Error ? err.message : 'OCR处理失败，请稍后重试');
    }
  }, []);

  // 拖拽放置
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) {
        processFile(file);
      }
    },
    [processFile]
  );

  // 选择文件
  const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
    e.target.value = '';
  };

  // 重置
  const handleReset = () => {
    clearProgressTimer();
    setStatus('idle');
    setResult(null);
    setError(null);
    setSelectedFile(null);
    setProgress(0);
    setShowFullText(false);
  };

  // 使用提取文本进行审查
  const handleUseText = () => {
    if (!result?.extracted_text) return;
    const text = encodeURIComponent(result.extracted_text);
    router.push(`/upload?text=${text}`);
  };

  // 渲染上传区域
  if (status === 'idle' || status === 'error') {
    return (
      <div className="w-full">
        <div
          className={`dropzone rounded-2xl p-10 text-center cursor-pointer ${
            isDragging ? 'dragging' : ''
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
        >
          <div className="w-16 h-16 rounded-full bg-brand-50 flex items-center justify-center mx-auto mb-4">
            <Upload className="w-8 h-8 text-brand-500" />
          </div>
          <p className="text-lg font-medium text-slate-700 mb-1">
            拖拽扫描件到此处，或点击选择
          </p>
          <p className="text-sm text-slate-400">
            支持 PNG、JPG、JPEG 图片与 PDF 文件，最大 20MB
          </p>
          <input
            ref={inputRef}
            type="file"
            accept=".png,.jpg,.jpeg,.pdf"
            onChange={handleSelect}
            className="hidden"
          />
        </div>

        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}
      </div>
    );
  }

  // 渲染处理中
  if (status === 'uploading' || status === 'processing') {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Loader2 className="w-6 h-6 text-brand-500 spinner" />
          <div>
            <h3 className="text-base font-semibold text-slate-800">
              {status === 'uploading' ? '正在上传文件...' : '正在进行OCR识别...'}
            </h3>
            <p className="text-sm text-slate-400">{selectedFile?.name}</p>
          </div>
        </div>

        {/* 进度条 */}
        <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full gradient-bg rounded-full transition-all duration-300"
            style={{ width: `${Math.round(progress)}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-slate-400">
            {status === 'uploading' ? '上传中' : 'OCR识别中，请耐心等待'}
          </span>
          <span className="text-xs font-medium text-brand-600">
            {Math.round(progress)}%
          </span>
        </div>
      </div>
    );
  }

  // 渲染结果
  if (status === 'completed' && result) {
    const confidenceColor = getConfidenceColor(result.confidence);
    const textPreview = result.extracted_text.substring(0, 500);
    const hasMoreText = result.extracted_text.length > 500;

    return (
      <div className="space-y-4">
        {/* 文件信息头 */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-lg bg-green-50 flex items-center justify-center shrink-0">
              <CheckCircle className="w-6 h-6 text-green-500" />
            </div>
            <div className="min-w-0">
              <p className="font-medium text-slate-800 truncate">{result.filename}</p>
              <p className="text-xs text-slate-400">
                {selectedFile ? formatSize(selectedFile.size) : ''} · OCR识别完成
              </p>
            </div>
          </div>
          <button
            onClick={handleReset}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm text-slate-500 border border-slate-200 hover:bg-slate-50 transition-all shrink-0"
          >
            重新上传
          </button>
        </div>

        {/* 结果统计 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* 识别语言 */}
          <div className="bg-white rounded-xl border border-slate-200 p-3 text-center">
            <ScanLine className="w-5 h-5 text-brand-500 mx-auto mb-1" />
            <div className="text-sm font-bold text-slate-800">
              {LANGUAGE_LABELS[result.language]}
            </div>
            <div className="text-xs text-slate-400">识别语言</div>
          </div>

          {/* 总页数 */}
          <div className="bg-white rounded-xl border border-slate-200 p-3 text-center">
            <FileImage className="w-5 h-5 text-blue-500 mx-auto mb-1" />
            <div className="text-sm font-bold text-slate-800">{result.total_pages}</div>
            <div className="text-xs text-slate-400">总页数</div>
          </div>

          {/* 处理页数 */}
          <div className="bg-white rounded-xl border border-slate-200 p-3 text-center">
            <CheckCircle className="w-5 h-5 text-green-500 mx-auto mb-1" />
            <div className="text-sm font-bold text-slate-800">{result.processed_pages}</div>
            <div className="text-xs text-slate-400">处理页数</div>
          </div>

          {/* 平均置信度 */}
          <div className="bg-white rounded-xl border border-slate-200 p-3 text-center">
            <ScanLine className="w-5 h-5 mx-auto mb-1" style={{ color: confidenceColor }} />
            <div className="text-sm font-bold" style={{ color: confidenceColor }}>
              {result.confidence}%
            </div>
            <div className="text-xs text-slate-400">平均置信度</div>
          </div>
        </div>

        {/* 置信度进度条 */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
              <ScanLine className="w-4 h-4 text-brand-500" />
              整体识别置信度
            </span>
            <span className="text-sm font-bold" style={{ color: confidenceColor }}>
              {result.confidence}%
            </span>
          </div>
          <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${result.confidence}%`,
                backgroundColor: confidenceColor,
              }}
            />
          </div>
        </div>

        {/* 警告列表 */}
        {result.warnings.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-amber-700 mb-2">
              <AlertTriangle className="w-4 h-4" />
              识别警告（{result.warnings.length}）
            </div>
            <ul className="space-y-1.5">
              {result.warnings.map((w, i) => (
                <li key={i} className="text-sm text-amber-700 flex items-start gap-2">
                  <span className="text-amber-400 mt-0.5">•</span>
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 提取文本预览 */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <span className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
              <Eye className="w-4 h-4 text-brand-500" />
              提取文本预览
            </span>
            <span className="text-xs text-slate-400">
              共 {result.extracted_text.length} 字符
            </span>
          </div>
          <div className="p-4 max-h-72 overflow-y-auto">
            <pre className="text-sm text-slate-700 whitespace-pre-wrap font-sans leading-relaxed">
              {showFullText ? result.extracted_text : textPreview}
              {!showFullText && hasMoreText && (
                <span className="text-slate-400">...</span>
              )}
            </pre>
          </div>
          {hasMoreText && (
            <button
              onClick={() => setShowFullText(!showFullText)}
              className="w-full px-4 py-2.5 border-t border-slate-100 text-sm text-brand-600 hover:bg-brand-50 transition-colors"
            >
              {showFullText ? '收起文本' : '查看完整文本'}
            </button>
          )}
        </div>

        {/* 操作按钮 */}
        <button
          onClick={handleUseText}
          className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl gradient-bg text-white font-semibold shadow-lg shadow-brand-500/30 hover:shadow-xl transition-all"
        >
          <ArrowRight className="w-5 h-5" />
          使用提取文本进行审查
        </button>
      </div>
    );
  }

  return null;
}
