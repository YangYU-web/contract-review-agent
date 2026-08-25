'use client';

export const runtime = 'edge';

import { useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import BatchFileUpload from '@/components/BatchFileUpload';
import { BatchReviewItem, BatchReviewResult } from '@/lib/types';
import {
  FileText,
  Loader,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  Layers,
  Clock,
  FileCheck,
  RefreshCw,
} from 'lucide-react';

type PageStep = 'upload' | 'reviewing' | 'completed';

// 审查状态配置
const STATUS_CONFIG: Record<
  BatchReviewItem['status'],
  { label: string; color: string; bgColor: string }
> = {
  pending: { label: '等待中', color: 'text-slate-400', bgColor: 'bg-slate-50' },
  parsing: { label: '解析中', color: 'text-blue-500', bgColor: 'bg-blue-50' },
  reviewing: { label: '审查中', color: 'text-brand-500', bgColor: 'bg-brand-50' },
  completed: { label: '已完成', color: 'text-green-500', bgColor: 'bg-green-50' },
  failed: { label: '失败', color: 'text-red-500', bgColor: 'bg-red-50' },
};

// 格式化风险评分颜色
function getRiskScoreColor(score: number): string {
  if (score >= 60) return 'text-red-500';
  if (score >= 40) return 'text-amber-500';
  return 'text-green-500';
}

export default function BatchUploadPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [step, setStep] = useState<PageStep>('upload');
  const [items, setItems] = useState<BatchReviewItem[]>([]);
  const [result, setResult] = useState<BatchReviewResult | null>(null);
  const [globalError, setGlobalError] = useState('');
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const handleFilesSelect = useCallback((selectedFiles: File[]) => {
    setFiles(selectedFiles);
  }, []);

  // 清理定时器
  const clearTimers = () => {
    timersRef.current.forEach(t => clearTimeout(t));
    timersRef.current = [];
  };

  const handleBatchReview = useCallback(async () => {
    if (files.length === 0) return;
    clearTimers();
    setGlobalError('');
    setStep('reviewing');

    // 初始化所有文件为 pending 状态
    const initialItems: BatchReviewItem[] = files.map((file, index) => ({
      id: `${Date.now()}-${index}`,
      filename: file.name,
      status: 'pending',
    }));
    setItems(initialItems);
    setResult(null);

    // 模拟状态推进：pending -> parsing -> reviewing
    timersRef.current.push(
      setTimeout(() => {
        setItems(prev =>
          prev.map(item =>
            item.status === 'pending' ? { ...item, status: 'parsing' } : item
          )
        );
      }, 400)
    );

    timersRef.current.push(
      setTimeout(() => {
        setItems(prev =>
          prev.map(item =>
            item.status === 'parsing' ? { ...item, status: 'reviewing' } : item
          )
        );
      }, 1000)
    );

    try {
      const formData = new FormData();
      files.forEach(file => formData.append('files', file));

      const response = await fetch('/api/batch-review', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '批量审查失败');
      }

      const batchResult = data as BatchReviewResult;

      // 用实际结果更新 items
      setItems(batchResult.items);
      setResult(batchResult);
      setStep('completed');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '未知错误';
      setGlobalError(errorMsg);
      setItems(prev =>
        prev.map(item =>
          item.status !== 'completed' && item.status !== 'failed'
            ? { ...item, status: 'failed', error: errorMsg }
            : item
        )
      );
      setStep('completed');
    } finally {
      clearTimers();
    }
  }, [files]);

  // 重置页面
  const handleReset = () => {
    clearTimers();
    setFiles([]);
    setItems([]);
    setResult(null);
    setGlobalError('');
    setStep('upload');
  };

  // 格式化文件大小
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // 从 files 中查找对应文件的大小
  const getFileSize = (filename: string): number | undefined => {
    const file = files.find(f => f.name === filename);
    return file?.size;
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* 页面标题 */}
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-lg gradient-bg flex items-center justify-center">
          <Layers className="w-5 h-5 text-white" />
        </div>
        <h1 className="text-2xl font-bold">批量合同审查</h1>
      </div>
      <p className="text-slate-500 mb-8 ml-13">
        一次性上传多份合同文件，AI 将并行审查所有合同并输出风险报告
      </p>

      {/* 上传步骤 */}
      {step === 'upload' && (
        <div className="space-y-6">
          <BatchFileUpload
            onFilesSelect={handleFilesSelect}
            onBatchReview={handleBatchReview}
          />
          {files.length > 0 && (
            <div className="bg-brand-50 rounded-xl border border-brand-100 p-4 flex items-center gap-3">
              <FileCheck className="w-5 h-5 text-brand-600 shrink-0" />
              <p className="text-sm text-brand-700">
                已准备审查 <span className="font-bold">{files.length}</span> 份合同，点击上方按钮开始批量审查
              </p>
            </div>
          )}
        </div>
      )}

      {/* 审查中 / 结果展示 */}
      {(step === 'reviewing' || step === 'completed') && (
        <div className="space-y-6">
          {/* 总体进度条 */}
          {step === 'reviewing' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <Loader className="w-5 h-5 text-brand-500 spinner" />
                <h2 className="text-lg font-semibold text-slate-800">
                  正在批量审查 {files.length} 份合同...
                </h2>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full gradient-bg animate-progress" style={{ width: '100%' }} />
              </div>
              <p className="text-sm text-slate-400 mt-3">
                AI 正在并行解析和审查所有合同，请稍候
              </p>
            </div>
          )}

          {/* 审查结果统计 */}
          {step === 'completed' && result && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-800">批量审查完成</h2>
                    <p className="text-sm text-slate-400">
                      共 {result.total} 份合同，成功 {result.completed} 份，失败 {result.failed} 份
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleReset}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-all"
                >
                  <RefreshCw className="w-4 h-4" />
                  重新审查
                </button>
              </div>

              {/* 统计卡片 */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-slate-50 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-slate-800">{result.total}</div>
                  <div className="text-xs text-slate-400 mt-1">总文件数</div>
                </div>
                <div className="bg-green-50 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-green-500">{result.completed}</div>
                  <div className="text-xs text-slate-400 mt-1">审查成功</div>
                </div>
                <div className="bg-red-50 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-red-500">{result.failed}</div>
                  <div className="text-xs text-slate-400 mt-1">审查失败</div>
                </div>
              </div>
            </div>
          )}

          {/* 全局错误提示 */}
          {globalError && (
            <div className="bg-red-50 rounded-xl border border-red-200 p-4 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
              <p className="text-sm text-red-600">{globalError}</p>
            </div>
          )}

          {/* 文件审查列表 */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h3 className="text-sm font-semibold text-slate-700">审查详情</h3>
            </div>
            <div className="divide-y divide-slate-100">
              {items.map((item, index) => {
                const statusConfig = STATUS_CONFIG[item.status];
                const fileSize = getFileSize(item.filename);

                return (
                  <div key={item.id || index} className="px-6 py-4 hover:bg-slate-50/50 transition-colors">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {/* 状态图标 */}
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${statusConfig.bgColor}`}>
                          {item.status === 'completed' ? (
                            <CheckCircle className={`w-5 h-5 ${statusConfig.color}`} />
                          ) : item.status === 'failed' ? (
                            <AlertCircle className={`w-5 h-5 ${statusConfig.color}`} />
                          ) : (
                            <Loader className={`w-5 h-5 ${statusConfig.color} spinner`} />
                          )}
                        </div>

                        {/* 文件信息 */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                            <p className="font-medium text-slate-800 truncate text-sm">
                              {item.filename}
                            </p>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-slate-400 mt-1 ml-6">
                            {fileSize && <span>{formatSize(fileSize)}</span>}
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig.bgColor} ${statusConfig.color}`}>
                              {statusConfig.label}
                            </span>
                            {/* 完成后显示合同类型 */}
                            {item.status === 'completed' && item.contract_type && (
                              <span className="text-slate-500">{item.contract_type}</span>
                            )}
                            {/* 失败时显示错误信息 */}
                            {item.status === 'failed' && item.error && (
                              <span className="text-red-400 truncate">{item.error}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* 右侧：风险评分或查看详情 */}
                      <div className="flex items-center gap-3 shrink-0">
                        {item.status === 'completed' && item.reviewId && (
                          <>
                            {/* 风险评分 */}
                            {item.risk_score !== undefined && (
                              <div className="text-right">
                                <div className={`text-xl font-bold ${getRiskScoreColor(item.risk_score)}`}>
                                  {item.risk_score}
                                </div>
                                <div className="text-xs text-slate-400">风险评分</div>
                              </div>
                            )}
                            {/* 风险数量 */}
                            {item.risk_count !== undefined && (
                              <div className="text-right hidden sm:block">
                                <div className="text-sm font-medium text-slate-600">
                                  {item.risk_count} 项风险
                                  {item.high_risk_count && item.high_risk_count > 0 && (
                                    <span className="text-red-500 ml-1">
                                      ({item.high_risk_count}项高危)
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-slate-400">已识别</div>
                              </div>
                            )}
                            {/* 查看详情链接 */}
                            <Link
                              href={`/dashboard/${item.reviewId}`}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg gradient-bg text-white text-xs font-medium hover:shadow-md transition-all whitespace-nowrap"
                            >
                              查看详情
                              <ArrowRight className="w-3.5 h-3.5" />
                            </Link>
                          </>
                        )}

                        {item.status === 'failed' && (
                          <span className="text-xs text-red-400 px-2">需重试</span>
                        )}

                        {(item.status === 'pending' ||
                          item.status === 'parsing' ||
                          item.status === 'reviewing') && (
                          <div className="flex items-center gap-1 text-xs text-slate-400">
                            <Clock className="w-3.5 h-3.5" />
                            <span>处理中</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 底部操作 */}
          {step === 'completed' && (
            <div className="flex items-center justify-between">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
              >
                <ArrowRight className="w-4 h-4 rotate-180" />
                返回审查记录
              </Link>
              <button
                onClick={handleReset}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-bg text-white text-sm font-semibold shadow-lg hover:shadow-xl transition-all"
              >
                <Layers className="w-4 h-4" />
                批量审查更多合同
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
