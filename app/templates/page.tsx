'use client';

import { useState, useMemo } from 'react';
import {
  Search,
  FileText,
  Shield,
  AlertTriangle,
  Download,
  ChevronDown,
  Tag,
  Eye,
  Calendar,
} from 'lucide-react';
import {
  getContractTemplates,
  getTemplateCategories,
} from '@/lib/contract-templates';
import { ContractTemplate } from '@/lib/types';

// 分类筛选颜色
const CATEGORY_COLORS: Record<string, string> = {
  采购: 'bg-blue-50 text-blue-600',
  销售: 'bg-emerald-50 text-emerald-600',
  服务: 'bg-brand-50 text-brand-600',
  租赁: 'bg-amber-50 text-amber-600',
  保密: 'bg-rose-50 text-rose-600',
  劳动: 'bg-cyan-50 text-cyan-600',
  技术开发: 'bg-indigo-50 text-indigo-600',
  委托: 'bg-purple-50 text-purple-600',
};

export default function TemplatesPage() {
  const allTemplates = useMemo(() => getContractTemplates(), []);
  const categories = useMemo(() => ['全部', ...getTemplateCategories()], []);

  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('全部');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // 搜索 + 分类筛选
  const filtered = useMemo(() => {
    return allTemplates.filter((t) => {
      const matchCategory =
        activeCategory === '全部' || t.category === activeCategory;
      const q = query.trim().toLowerCase();
      const matchQuery =
        !q ||
        t.name.toLowerCase().includes(q) ||
        t.contract_type.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q);
      return matchCategory && matchQuery;
    });
  }, [allTemplates, activeCategory, query]);

  const handleDownload = (template: ContractTemplate) => {
    // 演示：将模板内容下载为 txt 文件
    const blob = new Blob([template.content], {
      type: 'text/plain;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${template.name}_${template.version}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* 页头 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FileText className="w-6 h-6 text-brand-600" />
          合同模板库
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          标准合同模板，覆盖常见业务场景，支持快速查阅与下载使用
        </p>
      </div>

      {/* 搜索栏与分类筛选 */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索模板名称、类型或描述..."
            className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
          />
        </div>

        {/* 分类筛选 */}
        <div className="mt-4 flex items-center gap-2 flex-wrap">
          <Tag className="w-4 h-4 text-slate-400" />
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                activeCategory === cat
                  ? 'gradient-bg text-white'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* 结果计数 */}
      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm text-slate-500">
          共 {filtered.length} 个模板
        </span>
      </div>

      {/* 模板卡片网格 */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <Search className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-400">未找到匹配的模板</p>
          <p className="text-sm text-slate-300 mt-1">尝试更换关键词或分类</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              expanded={expandedId === template.id}
              onToggle={() =>
                setExpandedId(
                  expandedId === template.id ? null : template.id
                )
              }
              onDownload={() => handleDownload(template)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// 单个模板卡片（含展开详情面板）
function TemplateCard({
  template,
  expanded,
  onToggle,
  onDownload,
}: {
  template: ContractTemplate;
  expanded: boolean;
  onToggle: () => void;
  onDownload: () => void;
}) {
  const categoryColor =
    CATEGORY_COLORS[template.category] || 'bg-slate-100 text-slate-600';

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden card-hover flex flex-col">
      {/* 卡片头部 */}
      <div className="p-4 flex-1">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-brand-50 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5 text-brand-600" />
            </div>
            <h3 className="font-semibold text-slate-800 truncate">
              {template.name}
            </h3>
          </div>
          <span
            className={`text-xs px-2 py-0.5 rounded shrink-0 ${categoryColor}`}
          >
            {template.category}
          </span>
        </div>

        <p className="text-xs text-slate-500 line-clamp-2 mb-3 leading-relaxed">
          {template.description}
        </p>

        {/* 统计信息 */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-1.5 text-slate-500">
            <Shield className="w-3.5 h-3.5 text-blue-500" />
            <span>{template.key_clauses.length} 项关键条款</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-500">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            <span>{template.risk_notes.length} 项风险提示</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-500">
            <Eye className="w-3.5 h-3.5 text-slate-400" />
            <span>使用 {template.usage_count} 次</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-500">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>{template.updated_at}</span>
          </div>
        </div>
      </div>

      {/* 卡片底部操作 */}
      <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between gap-2">
        <span className="text-xs text-slate-400">
          版本 <span className="font-medium text-slate-500">{template.version}</span>
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={onDownload}
            className="p-1.5 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
            title="下载模板"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={onToggle}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-brand-600 bg-brand-50 hover:bg-brand-100 transition-colors"
          >
            {expanded ? '收起' : '查看详情'}
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform ${
                expanded ? 'rotate-180' : ''
              }`}
            />
          </button>
        </div>
      </div>

      {/* 展开详情面板 */}
      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50/50 p-4 space-y-4 max-h-[480px] overflow-y-auto">
          {/* 合同全文 */}
          <div>
            <h4 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-brand-600" />
              合同全文
            </h4>
            <pre className="text-xs text-slate-600 whitespace-pre-wrap font-sans bg-white border border-slate-200 rounded-lg p-3 leading-relaxed">
              {template.content}
            </pre>
          </div>

          {/* 关键条款 */}
          <div>
            <h4 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-blue-500" />
              关键条款
            </h4>
            <ul className="space-y-1.5">
              {template.key_clauses.map((clause, idx) => (
                <li
                  key={idx}
                  className="text-xs text-slate-600 flex items-start gap-2"
                >
                  <span className="text-brand-500 mt-0.5">•</span>
                  <span>{clause}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* 风险提示 */}
          <div>
            <h4 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              风险提示
            </h4>
            <ul className="space-y-1.5">
              {template.risk_notes.map((note, idx) => (
                <li
                  key={idx}
                  className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1.5 flex items-start gap-2"
                >
                  <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                  <span>{note}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
