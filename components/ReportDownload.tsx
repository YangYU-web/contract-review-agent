'use client';

import { useState } from 'react';
import { Download, FileText, Loader2 } from 'lucide-react';

interface ReportDownloadProps {
  contractId: string;
  contractTitle?: string;
}

type LoadingFormat = 'html' | 'txt' | null;

export default function ReportDownload({ contractId, contractTitle }: ReportDownloadProps) {
  const [loadingFormat, setLoadingFormat] = useState<LoadingFormat>(null);
  const [error, setError] = useState<string | null>(null);

  // 调用导出API并触发浏览器下载
  const handleDownload = async (format: 'html' | 'txt') => {
    setLoadingFormat(format);
    setError(null);

    try {
      const response = await fetch('/api/export-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contract_id: contractId, format }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `下载失败（${response.status}）`);
      }

      // 将响应转为Blob并触发下载
      const blob = await response.blob();

      // 从 Content-Disposition 头部解析文件名
      const contentDisposition = response.headers.get('Content-Disposition') || '';
      let filename = `${contractTitle || '审查报告'}.${format}`;
      const filenameMatch = contentDisposition.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
      if (filenameMatch) {
        try {
          filename = decodeURIComponent(filenameMatch[1]);
        } catch {
          filename = filenameMatch[1];
        }
      }

      // 创建临时URL并触发下载
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download error:', err);
      setError(err instanceof Error ? err.message : '下载失败，请重试');
    } finally {
      setLoadingFormat(null);
    }
  };

  const isHtmlLoading = loadingFormat === 'html';
  const isTxtLoading = loadingFormat === 'txt';

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {/* 下载HTML报告 */}
        <button
          onClick={() => handleDownload('html')}
          disabled={loadingFormat !== null}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg gradient-bg text-white text-sm font-medium hover:shadow-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isHtmlLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          下载HTML报告
        </button>

        {/* 下载文本报告 */}
        <button
          onClick={() => handleDownload('txt')}
          disabled={loadingFormat !== null}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 text-sm font-medium hover:border-brand-300 hover:text-brand-600 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isTxtLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <FileText className="w-4 h-4" />
          )}
          下载文本报告
        </button>
      </div>

      {error && (
        <p className="text-xs text-red-500">{error}</p>
      )}
    </div>
  );
}
