'use client';

// ===== 合规报告展示组件 =====
// 展示合规分数、总体状态、统计卡片与按类别分组的检查结果
// 违规项以红色突出显示，纯展示组件，接收 report 数据渲染

import { useMemo } from 'react';
import {
  Shield,
  CheckCircle,
  AlertTriangle,
  XCircle,
  MinusCircle,
  Scale,
  BookOpen,
  Gavel,
  Lightbulb,
} from 'lucide-react';
import {
  ComplianceReport,
  ComplianceCheckResult,
  ComplianceCategory,
  ComplianceStatus,
  COMPLIANCE_CATEGORY_LABELS,
  COMPLIANCE_STATUS_CONFIG,
} from '@/lib/types';

// 状态图标配置
const STATUS_ICON: Record<ComplianceStatus, typeof CheckCircle> = {
  compliant: CheckCircle,
  warning: AlertTriangle,
  violation: XCircle,
  not_applicable: MinusCircle,
};

// 状态 Tailwind 样式（基于 COMPLIANCE_STATUS_CONFIG 的颜色衍生）
const STATUS_CLS: Record<ComplianceStatus, { tag: string; border: string; bg: string; text: string }> = {
  compliant: {
    tag: 'bg-green-50 text-green-600 border-green-200',
    border: 'border-green-200',
    bg: 'bg-green-50/40',
    text: 'text-green-600',
  },
  warning: {
    tag: 'bg-amber-50 text-amber-600 border-amber-200',
    border: 'border-amber-200',
    bg: 'bg-amber-50/40',
    text: 'text-amber-600',
  },
  violation: {
    tag: 'bg-red-50 text-red-600 border-red-200',
    border: 'border-red-300',
    bg: 'bg-red-50/50',
    text: 'text-red-600',
  },
  not_applicable: {
    tag: 'bg-slate-100 text-slate-500 border-slate-200',
    border: 'border-slate-200',
    bg: 'bg-slate-50/60',
    text: 'text-slate-500',
  },
};

// 严重程度标签
const SEVERITY_LABELS: Record<string, string> = {
  high: '高',
  medium: '中',
  low: '低',
};

// 总体状态大图标样式
const OVERALL_STYLE: Record<
  ComplianceStatus,
  { ring: string; bar: string; text: string }
> = {
  compliant: { ring: 'text-green-500', bar: 'bg-green-500', text: 'text-green-600' },
  warning: { ring: 'text-amber-500', bar: 'bg-amber-500', text: 'text-amber-600' },
  violation: { ring: 'text-red-500', bar: 'bg-red-500', text: 'text-red-600' },
  not_applicable: { ring: 'text-slate-400', bar: 'bg-slate-400', text: 'text-slate-500' },
};

interface Props {
  report: ComplianceReport;
}

export default function ComplianceReportView({ report }: Props) {
  const overallCfg = COMPLIANCE_STATUS_CONFIG[report.overall_status];
  const overallStyle = OVERALL_STYLE[report.overall_status];
  const score = report.compliance_score;

  // 按类别分组检查结果
  const grouped = useMemo(() => {
    const map = new Map<ComplianceCategory, ComplianceCheckResult[]>();
    for (const r of report.results) {
      const list = map.get(r.category) || [];
      list.push(r);
      map.set(r.category, list);
    }
    return Array.from(map.entries());
  }, [report.results]);

  // 统计卡片数据
  const statCards = [
    {
      label: '通过',
      value: report.passed,
      icon: CheckCircle,
      color: 'text-green-600',
      bg: 'bg-green-50',
      border: 'border-green-100',
    },
    {
      label: '警告',
      value: report.warnings,
      icon: AlertTriangle,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      border: 'border-amber-100',
    },
    {
      label: '违规',
      value: report.violations,
      icon: XCircle,
      color: report.violations > 0 ? 'text-red-600' : 'text-slate-400',
      bg: report.violations > 0 ? 'bg-red-50' : 'bg-slate-50',
      border: report.violations > 0 ? 'border-red-200' : 'border-slate-100',
    },
    {
      label: '不适用',
      value: report.not_applicable,
      icon: MinusCircle,
      color: 'text-slate-500',
      bg: 'bg-slate-50',
      border: 'border-slate-100',
    },
  ];

  return (
    <div className="space-y-5">
      {/* 顶部：合规分数大数字 + 总体状态 */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex flex-col md:flex-row items-center gap-6">
          {/* 分数环形展示 */}
          <div className="relative w-28 h-28 shrink-0">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                stroke="#e2e8f0"
                strokeWidth="8"
              />
              <circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                stroke={overallCfg.color}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${(score / 100) * 264} 264`}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-3xl font-bold ${overallStyle.text}`}>
                {score}
              </span>
              <span className="text-xs text-slate-400">合规分</span>
            </div>
          </div>

          {/* 总体状态信息 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Shield className={`w-5 h-5 ${overallStyle.ring}`} />
              <h3 className="font-semibold text-slate-800">合规总体评估</h3>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium"
                style={{
                  color: overallCfg.color,
                  backgroundColor: overallCfg.bg,
                }}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: overallCfg.color }}
                />
                {overallCfg.label}
              </span>
              <span className="text-sm text-slate-500">
                共检查 {report.total_checks} 项规则
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-400 leading-relaxed">
              合规分数基于违规项与警告项的严重程度加权扣分计算，满分 100 分。违规项权重高于警告项。
            </p>
          </div>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className={`bg-white rounded-xl border ${card.border} p-4`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-lg ${card.bg} flex items-center justify-center`}
                >
                  <Icon className={`w-5 h-5 ${card.color}`} />
                </div>
                <div>
                  <div className="text-2xl font-bold text-slate-800">
                    {card.value}
                  </div>
                  <div className="text-xs text-slate-400">{card.label}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 按类别分组的检查结果 */}
      <div className="space-y-5">
        {grouped.map(([category, items]) => (
          <CategoryGroup key={category} category={category} items={items} />
        ))}
      </div>
    </div>
  );
}

// ===== 单个类别分组 =====
function CategoryGroup({
  category,
  items,
}: {
  category: ComplianceCategory;
  items: ComplianceCheckResult[];
}) {
  const categoryLabel = COMPLIANCE_CATEGORY_LABELS[category];
  // 该类别下的违规数
  const violationCount = items.filter((i) => i.status === 'violation').length;
  const warningCount = items.filter((i) => i.status === 'warning').length;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      {/* 类别标题栏 */}
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-100 bg-slate-50/70">
        <Gavel className="w-4 h-4 text-brand-600" />
        <h3 className="font-semibold text-slate-800">{categoryLabel}</h3>
        <span className="text-xs text-slate-400">
          · {items.length} 项规则
        </span>
        <div className="ml-auto flex items-center gap-2">
          {violationCount > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-600 border border-red-200">
              <XCircle className="w-3 h-3" />
              {violationCount} 违规
            </span>
          )}
          {warningCount > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 border border-amber-200">
              <AlertTriangle className="w-3 h-3" />
              {warningCount} 警告
            </span>
          )}
        </div>
      </div>

      {/* 检查结果列表 */}
      <div className="divide-y divide-slate-100">
        {items.map((item) => (
          <CheckResultItem key={item.rule_id} item={item} />
        ))}
      </div>
    </div>
  );
}

// ===== 单条检查结果 =====
function CheckResultItem({ item }: { item: ComplianceCheckResult }) {
  const cfg = COMPLIANCE_STATUS_CONFIG[item.status];
  const cls = STATUS_CLS[item.status];
  const Icon = STATUS_ICON[item.status];
  const isViolation = item.status === 'violation';

  return (
    <div
      className={`px-5 py-4 transition-colors ${
        isViolation ? 'bg-red-50/30' : ''
      } hover:bg-slate-50/40`}
    >
      <div className="flex items-start gap-3">
        {/* 状态图标 */}
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${cls.bg}`}
        >
          <Icon className={`w-4 h-4 ${cls.text}`} />
        </div>

        {/* 内容区 */}
        <div className="flex-1 min-w-0">
          {/* 标题行 */}
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-sm font-medium text-slate-800">
              {item.title}
            </span>
            <span
              className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border ${cls.tag}`}
            >
              {cfg.label}
            </span>
            <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
              {SEVERITY_LABELS[item.severity] || item.severity}
            </span>
          </div>

          {/* 法律依据 */}
          <div className="flex items-start gap-1.5 text-xs text-slate-500 mb-1.5">
            <BookOpen className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{item.legal_basis}</span>
          </div>

          {/* 详情 */}
          <div className="flex items-start gap-1.5 text-xs text-slate-600 mb-1.5">
            <Scale className="w-3.5 h-3.5 text-brand-400 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{item.details}</span>
          </div>

          {/* 条款引用 */}
          {item.clause_refs && item.clause_refs.length > 0 && (
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-1.5">
              <span>条款引用：</span>
              {item.clause_refs.map((ref, idx) => (
                <span
                  key={idx}
                  className="px-1.5 py-0.5 rounded bg-brand-50 text-brand-700 text-[10px]"
                >
                  {ref}
                </span>
              ))}
            </div>
          )}

          {/* 修改建议 */}
          {item.recommendation && item.status !== 'compliant' && (
            <div
              className={`flex items-start gap-1.5 text-xs p-2 rounded-lg ${cls.bg} border ${cls.border}`}
            >
              <Lightbulb className="w-3.5 h-3.5 text-brand-500 shrink-0 mt-0.5" />
              <span className="leading-relaxed text-slate-600">
                {item.recommendation}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
