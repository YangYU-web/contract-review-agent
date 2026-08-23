'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import FileUpload from '@/components/FileUpload';
import { Loader2, CheckCircle2, AlertCircle, ArrowRight, Layers } from 'lucide-react';

type Step = 'upload' | 'parsing' | 'analyzing' | 'complete' | 'error';

export default function UploadPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState<Step>('upload');
  const [error, setError] = useState('');
  const [progressMsg, setProgressMsg] = useState('');
  const [reviewId, setReviewId] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const startTimer = () => {
    const startTime = Date.now();
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const pollReviewStatus = async (jobId: string) => {
    let attempts = 0;
    const maxAttempts = 60; // 最多轮询 60 次（约 120 秒）

    while (attempts < maxAttempts) {
      attempts++;
      await new Promise(resolve => setTimeout(resolve, 2000)); // 每 2 秒轮询一次

      try {
        const response = await fetch(`/api/review?jobId=${jobId}`);
        const data = await response.json();

        if (data.status === 'completed' && data.result) {
          stopTimer();
          setStep('complete');
          setReviewId(data.result.reviewId);
          return;
        }

        if (data.status === 'failed') {
          stopTimer();
          setError(data.error || 'AI审查失败');
          setStep('error');
          return;
        }

        // 更新进度提示
        if (attempts > 5) {
          setProgressMsg('AI正在深入分析合同条款...');
        }
        if (attempts > 15) {
          setProgressMsg('正在生成风险报告...');
        }
      } catch {
        // 轮询失败，继续重试
      }
    }

    // 超时
    stopTimer();
    setError('审查超时（120秒），请稍后重试');
    setStep('error');
  };

  const handleReview = async () => {
    if (!file) return;
    setStep('parsing');
    setProgressMsg('正在解析文档...');
    setElapsed(0);
    startTimer();

    try {
      const formData = new FormData();
      formData.append('file', file);

      setProgressMsg('AI正在审查合同风险...');
      setStep('analyzing');

      // 提交审查请求（异步，立即返回 jobId）
      const response = await fetch('/api/review', {
        method: 'POST',
        body: formData,
      });

      // 安全解析响应
      const responseText = await response.text();
      let data;
      try {
        data = JSON.parse(responseText);
      } catch {
        if (responseText.includes('upstream')) {
          throw new Error('AI 审查超时，请稍后重试');
        }
        throw new Error('服务器返回了无效响应，请稍后重试');
      }

      if (!response.ok) {
        throw new Error(data.error || '审查失败');
      }

      // 开始轮询审查状态
      setProgressMsg('AI正在审查合同风险...');
      await pollReviewStatus(data.jobId);

    } catch (err) {
      stopTimer();
      if (err instanceof Error && err.name === 'AbortError') {
        setError('审查超时，请稍后重试');
      } else {
        setError(err instanceof Error ? err.message : '未知错误');
      }
      setStep('error');
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-2">上传合同</h1>
      <p className="text-slate-500 mb-8">
        上传合同文件，AI将自动识别风险条款并给出修改建议
      </p>

      {/* 步骤指示器 */}
      <div className="flex items-center gap-2 mb-8">
        <StepIndicator number={1} label="上传文件" active={step === 'upload'} done={step !== 'upload'} />
        <Connector done={step !== 'upload'} />
        <StepIndicator number={2} label="文档解析" active={step === 'parsing'} done={['analyzing', 'complete'].includes(step)} />
        <Connector done={['analyzing', 'complete'].includes(step)} />
        <StepIndicator number={3} label="AI审查" active={step === 'analyzing'} done={step === 'complete'} />
        <Connector done={step === 'complete'} />
        <StepIndicator number={4} label="完成" active={step === 'complete'} done={false} />
      </div>

      {/* 内容区域 */}
      {step === 'upload' && (
        <div className="space-y-4">
          <FileUpload onFileSelect={setFile} />
          {file && (
            <button
              onClick={handleReview}
              className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl gradient-bg text-white font-semibold shadow-lg shadow-brand-500/30 hover:shadow-xl transition-all"
            >
              开始AI审查
              <ArrowRight className="w-5 h-5" />
            </button>
          )}
        </div>
      )}

      {(step === 'parsing' || step === 'analyzing') && (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <Loader2 className="w-12 h-12 text-brand-500 spinner mx-auto mb-4" />
          <p className="text-lg font-medium text-slate-700 mb-2">{progressMsg}</p>
          <p className="text-sm text-slate-400">
            {elapsed > 0 ? `已用时 ${elapsed} 秒，请稍候` : '请稍候，通常需要10-30秒'}
          </p>
          {/* 进度条 */}
          <div className="max-w-xs mx-auto mt-6">
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className={`h-full gradient-bg ${step === 'analyzing' ? 'animate-progress' : ''}`} style={{ width: step === 'parsing' ? '30%' : '60%' }} />
            </div>
          </div>
        </div>
      )}

      {step === 'complete' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
          <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">审查完成</h2>
          <p className="text-slate-500 mb-6">AI已完成合同风险识别，点击下方查看详细结果</p>
          <button
            onClick={() => router.push(`/dashboard/${reviewId}`)}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl gradient-bg text-white font-semibold shadow-lg hover:shadow-xl transition-all"
          >
            查看审查结果
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {step === 'error' && (
        <div className="bg-red-50 rounded-2xl border border-red-200 p-8 text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-red-700 mb-2">审查失败</h2>
          <p className="text-red-600 mb-6">{error}</p>
          <button
            onClick={() => { setStep('upload'); setError(''); setFile(null); setElapsed(0); }}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white border border-red-200 text-red-700 font-semibold hover:bg-red-50 transition-all"
          >
            重新上传
          </button>
        </div>
      )}

      {/* 批量审查入口 */}
      <div className="mt-10 pt-8 border-t border-slate-100">
        <Link
          href="/batch-upload"
          className="group flex items-center justify-between gap-4 bg-white rounded-2xl border border-slate-200 p-5 card-hover"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-brand-50 flex items-center justify-center shrink-0">
              <Layers className="w-6 h-6 text-brand-600" />
            </div>
            <div>
              <p className="font-semibold text-slate-800 group-hover:text-brand-600 transition-colors">
                需要批量审查？点击进入批量上传
              </p>
              <p className="text-sm text-slate-400 mt-0.5">
                支持同时上传多份合同文件，并行审查提高效率
              </p>
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-brand-500 group-hover:translate-x-1 transition-all shrink-0" />
        </Link>
      </div>
    </div>
  );
}

function StepIndicator({ number, label, active, done }: { number: number; label: string; active: boolean; done: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
        done ? 'bg-green-500 text-white' : active ? 'gradient-bg text-white' : 'bg-slate-100 text-slate-400'
      }`}>
        {done ? <CheckCircle2 className="w-5 h-5" /> : number}
      </div>
      <span className={`text-sm hidden sm:inline ${active ? 'font-medium text-slate-700' : 'text-slate-400'}`}>
        {label}
      </span>
    </div>
  );
}

function Connector({ done }: { done: boolean }) {
  return (
    <div className={`flex-1 h-0.5 ${done ? 'bg-green-500' : 'bg-slate-200'}`} />
  );
}
