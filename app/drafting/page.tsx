'use client';

// ===== 合同起草助手页面 =====
// 客户端组件：标题 + 起草编辑器 + 右侧历史起草项目侧边栏

import { useState, useEffect, useCallback } from 'react';
import {
  PenLine,
  FileText,
  History,
  XCircle,
} from 'lucide-react';
import DraftingEditor from '@/components/DraftingEditor';
import { DraftingProject } from '@/lib/types';

// 项目状态样式
const STATUS_CONFIG: Record<
  DraftingProject['status'],
  { label: string; cls: string }
> = {
  draft: { label: '草稿', cls: 'bg-slate-100 text-slate-600' },
  review: { label: '审查中', cls: 'bg-amber-50 text-amber-600' },
  finalized: { label: '已定稿', cls: 'bg-green-50 text-green-600' },
};

// 相对时间格式化
function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const diff = Date.now() - date.getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) return '刚刚';
  if (diff < hour) return `${Math.floor(diff / minute)} 分钟前`;
  if (diff < day) return `${Math.floor(diff / hour)} 小时前`;
  if (diff < day * 30) return `${Math.floor(diff / day)} 天前`;
  return date.toLocaleDateString('zh-CN');
}

export default function DraftingPage() {
  const [projects, setProjects] = useState<DraftingProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/drafting', { cache: 'no-store' });
      if (!res.ok) throw new Error('加载项目失败');
      const data = await res.json();
      setProjects(data.projects || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载项目失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // 统计
  const draftCount = projects.filter((p) => p.status === 'draft').length;
  const reviewCount = projects.filter((p) => p.status === 'review').length;
  const finalizedCount = projects.filter(
    (p) => p.status === 'finalized'
  ).length;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* 页头 */}
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <PenLine className="w-6 h-6 text-brand-600" />
            合同起草助手
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            基于标准条款模板快速起草合同，实时预览并一键生成完整合同文本
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-slate-200">
          <FileText className="w-4 h-4 text-brand-600" />
          <span className="text-xs text-slate-500">演示模式</span>
          <span className="text-xs text-slate-300">·</span>
          <span className="text-xs text-slate-400">
            历史 {projects.length} 项
          </span>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-600 text-sm flex items-center gap-2">
          <XCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-red-400 hover:text-red-600"
          >
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 编辑器 + 右侧历史侧边栏 */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* 起草编辑器（主体） */}
        <div className="flex-1 min-w-0">
          <DraftingEditor />
        </div>

        {/* 右侧：历史起草项目 */}
        <aside className="lg:w-72 shrink-0">
          <div className="bg-white rounded-xl border border-slate-200 p-4 sticky top-4">
            <div className="flex items-center gap-2 mb-3">
              <History className="w-4 h-4 text-brand-600" />
              <h3 className="text-sm font-semibold text-slate-800">
                历史起草项目
              </h3>
            </div>

            {/* 状态统计 */}
            <div className="grid grid-cols-3 gap-2 mb-3 text-center">
              <div className="rounded-lg bg-slate-50 py-1.5">
                <div className="text-sm font-bold text-slate-700">
                  {draftCount}
                </div>
                <div className="text-[10px] text-slate-400">草稿</div>
              </div>
              <div className="rounded-lg bg-amber-50 py-1.5">
                <div className="text-sm font-bold text-amber-600">
                  {reviewCount}
                </div>
                <div className="text-[10px] text-slate-400">审查中</div>
              </div>
              <div className="rounded-lg bg-green-50 py-1.5">
                <div className="text-sm font-bold text-green-600">
                  {finalizedCount}
                </div>
                <div className="text-[10px] text-slate-400">已定稿</div>
              </div>
            </div>

            {/* 项目列表 */}
            {loading ? (
              <div className="py-6 text-center text-xs text-slate-400">
                加载中...
              </div>
            ) : projects.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">
                暂无历史项目
              </div>
            ) : (
              <div className="space-y-2 max-h-[480px] overflow-y-auto">
                {projects.map((p) => {
                  const cfg = STATUS_CONFIG[p.status];
                  return (
                    <div
                      key={p.id}
                      className="rounded-lg border border-slate-100 p-2.5 hover:border-brand-200 hover:bg-brand-50/30 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <span className="text-xs font-medium text-slate-700 truncate">
                          {p.name}
                        </span>
                        <span
                          className={`inline-flex items-center text-[10px] px-1.5 py-0.5 rounded ${cfg.cls} shrink-0`}
                        >
                          {cfg.label}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">
                        {p.contract_type} · {p.party_a} ↔ {p.party_b}
                      </div>
                      <div className="flex items-center justify-between mt-1 text-[10px] text-slate-400">
                        <span>{p.clauses.length} 个条款</span>
                        <span>{formatRelativeTime(p.updated_at)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
