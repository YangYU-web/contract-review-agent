'use client';

import { Search } from 'lucide-react';
import FullTextSearch from '@/components/FullTextSearch';

// ===== 全文搜索页面 =====
// 标题区 + FullTextSearch 组件

export default function SearchPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* 页头 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Search className="w-6 h-6 text-brand-600" />
          全文搜索
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          跨合同标题、条款正文与风险说明进行全文检索，支持关键词高亮、相关度排序与分面筛选
        </p>
      </div>

      {/* 搜索组件 */}
      <FullTextSearch />

      {/* 底部说明 */}
      <div className="mt-8 p-4 rounded-xl bg-slate-50 border border-slate-100">
        <h3 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
          <Search className="w-4 h-4 text-brand-600" />
          搜索说明
        </h3>
        <ul className="space-y-1.5 text-xs text-slate-500">
          <li className="flex gap-2">
            <span className="text-brand-500 shrink-0">·</span>
            <span>支持中文关键词与英文单词混合检索，自动分词匹配</span>
          </li>
          <li className="flex gap-2">
            <span className="text-brand-500 shrink-0">·</span>
            <span>结果按相关度排序，匹配标题权重高于正文</span>
          </li>
          <li className="flex gap-2">
            <span className="text-brand-500 shrink-0">·</span>
            <span>左侧面板可按合同类型、风险等级、日期范围、风险评分与当事人多维度筛选</span>
          </li>
          <li className="flex gap-2">
            <span className="text-brand-500 shrink-0">·</span>
            <span>空查询将返回全部合同，可结合筛选条件快速定位目标</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
