'use client';

// ===== 智能条款库页面 =====
// 客户端组件：页头 + 智能条款库展示组件
// 提供标准条款浏览、搜索筛选、变量渲染与条款推荐

export const runtime = 'edge';

import ClauseLibraryView from '@/components/ClauseLibraryView';
import { Library, BookOpen, Sparkles } from 'lucide-react';

export default function ClauseLibraryPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* 页头 */}
      <div className="mb-6 flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl gradient-bg flex items-center justify-center">
          <Library className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">智能条款库</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            汇集标准条款模板，支持分类筛选、全文搜索、变量渲染与智能推荐
          </p>
        </div>
      </div>

      {/* 功能说明 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <FeatureHint
          icon={BookOpen}
          title="标准条款库"
          desc="覆盖付款、交付、保修、责任等 10 大条款分类"
        />
        <FeatureHint
          icon={Sparkles}
          title="变量渲染"
          desc="填充条款变量，一键生成可直接使用的条款文本"
        />
        <FeatureHint
          icon={Library}
          title="智能推荐"
          desc="根据合同类型与上下文推荐相关条款与缺失项"
        />
      </div>

      {/* 条款库主体 */}
      <ClauseLibraryView />
    </div>
  );
}

// ===== 功能说明小卡片 =====
function FeatureHint({
  icon: Icon,
  title,
  desc,
}: {
  icon: React.ElementType;
  title: string;
  desc: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-start gap-3">
      <div className="w-9 h-9 rounded-lg bg-brand-50 flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5 text-brand-600" />
      </div>
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        <p className="text-xs text-slate-400 mt-0.5">{desc}</p>
      </div>
    </div>
  );
}
