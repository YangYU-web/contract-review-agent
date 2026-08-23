'use client';

// ===== 合同摘要展示组件 =====
// 展示合同摘要文本、合同主体、财务条款、关键日期时间线、关键术语与风险评估
// 纯展示组件，接收 summary 数据渲染

import {
  FileText,
  Users,
  DollarSign,
  Calendar,
  Tag,
  AlertTriangle,
  CheckCircle,
  Lightbulb,
  MapPin,
  Phone,
  User as UserIcon,
} from 'lucide-react';
import {
  ContractSummary,
  ContractParty,
  FinancialTerm,
  KeyDate,
  KeyTerm,
  ContractTimelineEvent,
} from '@/lib/types';

// 风险等级样式配置
const RISK_LEVEL_CONFIG: Record<
  'low' | 'medium' | 'high',
  { label: string; cls: string; dot: string; bg: string; text: string }
> = {
  low: {
    label: '低风险',
    cls: 'bg-green-50 text-green-600 border-green-200',
    dot: 'bg-green-500',
    bg: 'bg-green-50',
    text: 'text-green-600',
  },
  medium: {
    label: '中风险',
    cls: 'bg-amber-50 text-amber-600 border-amber-200',
    dot: 'bg-amber-500',
    bg: 'bg-amber-50',
    text: 'text-amber-600',
  },
  high: {
    label: '高风险',
    cls: 'bg-red-50 text-red-600 border-red-200',
    dot: 'bg-red-500',
    bg: 'bg-red-50',
    text: 'text-red-600',
  },
};

// 日期重要性样式
const DATE_SIGNIFICANCE_CONFIG: Record<
  KeyDate['significance'],
  { label: string; dot: string; cls: string }
> = {
  critical: { label: '关键', dot: 'bg-red-500', cls: 'bg-red-50 text-red-600' },
  important: { label: '重要', dot: 'bg-amber-500', cls: 'bg-amber-50 text-amber-600' },
  normal: { label: '普通', dot: 'bg-slate-400', cls: 'bg-slate-100 text-slate-500' },
};

// 合同主体角色样式
const PARTY_ROLE_CONFIG: Record<
  ContractParty['role'],
  { label: string; cls: string }
> = {
  party_a: { label: '甲方', cls: 'bg-brand-50 text-brand-700 border-brand-200' },
  party_b: { label: '乙方', cls: 'bg-blue-50 text-blue-600 border-blue-200' },
  guarantor: { label: '保证人', cls: 'bg-amber-50 text-amber-600 border-amber-200' },
  witness: { label: '见证人', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
};

// 财务条款类型标签
const FINANCIAL_TYPE_LABELS: Record<FinancialTerm['type'], string> = {
  total_amount: '合同金额',
  unit_price: '单价',
  penalty: '违约金',
  deposit: '保证金/预付',
  other: '其他金额',
};

// 币种中文名
function currencyLabel(currency: string): string {
  const map: Record<string, string> = {
    CNY: '人民币',
    USD: '美元',
    EUR: '欧元',
    HKD: '港币',
    JPY: '日元',
  };
  return map[currency] || currency;
}

// 格式化金额为千分位
function formatAmount(amount: number): string {
  return amount.toLocaleString('zh-CN', { maximumFractionDigits: 2 });
}

interface Props {
  summary: ContractSummary;
}

export default function ContractSummaryView({ summary }: Props) {
  const { risk_assessment } = summary;
  const riskCfg = RISK_LEVEL_CONFIG[risk_assessment.overall_level];

  return (
    <div className="space-y-5">
      {/* 顶部：合同摘要文本高亮卡片 */}
      <div className="bg-gradient-to-br from-brand-600 to-brand-800 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <FileText className="w-5 h-5 text-white" />
          <h3 className="font-semibold text-white">合同摘要</h3>
          <span className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/15 text-white text-xs">
            {summary.contract_type}
          </span>
        </div>
        <p className="text-sm leading-relaxed text-brand-50">
          {summary.summary}
        </p>
        {/* 统计指标 */}
        <div className="mt-4 flex items-center gap-4 text-xs text-brand-100">
          <span className="inline-flex items-center gap-1">
            <FileText className="w-3.5 h-3.5" />
            {summary.word_count.toLocaleString()} 字
          </span>
          <span className="inline-flex items-center gap-1">
            <Tag className="w-3.5 h-3.5" />
            {summary.clause_count} 个条款
          </span>
          {summary.parties.length > 0 && (
            <span className="inline-flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />
              {summary.parties.length} 方主体
            </span>
          )}
        </div>
      </div>

      {/* 网格布局：主体 + 财务 + 日期 + 术语 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* 合同主体卡片 */}
        <PartiesCard parties={summary.parties} />
        {/* 财务条款卡片 */}
        <FinancialsCard financials={summary.financial_terms} />
        {/* 关键日期时间线 */}
        <TimelineCard timeline={summary.timeline} keyDates={summary.key_dates} />
        {/* 关键术语列表 */}
        <KeyTermsCard terms={summary.key_terms} />
      </div>

      {/* 底部：风险评估摘要 */}
      <div className={`rounded-2xl border p-5 ${riskCfg.bg} border-current/20`} style={{ borderColor: 'transparent' }}>
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-brand-600" />
              风险评估摘要
            </h3>
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-sm font-medium ${riskCfg.cls}`}
            >
              <span className={`w-2 h-2 rounded-full ${riskCfg.dot}`} />
              {riskCfg.label}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 关键风险 */}
            <div className="rounded-xl border border-slate-100 p-4 bg-slate-50/60">
              <div className="flex items-center gap-1.5 mb-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <span className="text-sm font-medium text-slate-700">
                  关键风险
                </span>
                <span className="text-xs text-slate-400 ml-auto">
                  {risk_assessment.key_risks.length} 项
                </span>
              </div>
              <ul className="space-y-2">
                {risk_assessment.key_risks.map((risk, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2 text-xs text-slate-600 leading-relaxed"
                  >
                    <span className="w-4 h-4 shrink-0 rounded-full bg-amber-100 text-amber-700 text-[10px] flex items-center justify-center font-medium mt-0.5">
                      {idx + 1}
                    </span>
                    <span>{risk}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* 修改建议 */}
            <div className="rounded-xl border border-slate-100 p-4 bg-slate-50/60">
              <div className="flex items-center gap-1.5 mb-2.5">
                <Lightbulb className="w-4 h-4 text-brand-500" />
                <span className="text-sm font-medium text-slate-700">
                  修改建议
                </span>
                <span className="text-xs text-slate-400 ml-auto">
                  {risk_assessment.recommendations.length} 项
                </span>
              </div>
              <ul className="space-y-2">
                {risk_assessment.recommendations.map((rec, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2 text-xs text-slate-600 leading-relaxed"
                  >
                    <CheckCircle className="w-3.5 h-3.5 text-brand-500 shrink-0 mt-0.5" />
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ===== 合同主体卡片 =====
function PartiesCard({ parties }: { parties: ContractParty[] }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center">
          <Users className="w-4 h-4 text-brand-600" />
        </div>
        <h3 className="font-semibold text-slate-800">合同主体</h3>
        <span className="text-xs text-slate-400 ml-auto">
          {parties.length} 方
        </span>
      </div>

      {parties.length === 0 ? (
        <div className="py-8 text-center text-sm text-slate-400">
          未识别到合同主体信息
        </div>
      ) : (
        <div className="space-y-3">
          {parties.map((party, idx) => {
            const cfg = PARTY_ROLE_CONFIG[party.role];
            return (
              <div
                key={idx}
                className="rounded-xl border border-slate-100 p-3 hover:border-slate-200 transition-colors"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className={`inline-flex items-center text-xs px-2 py-0.5 rounded border ${cfg.cls}`}
                  >
                    {cfg.label}
                  </span>
                  <span className="text-sm font-medium text-slate-800 truncate">
                    {party.name}
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-1.5 text-xs text-slate-500">
                  {party.legal_rep && (
                    <div className="flex items-center gap-1.5">
                      <UserIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>法定代表人：{party.legal_rep}</span>
                    </div>
                  )}
                  {party.address && (
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">地址：{party.address}</span>
                    </div>
                  )}
                  {party.contact && (
                    <div className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>联系方式：{party.contact}</span>
                    </div>
                  )}
                  {!party.legal_rep && !party.address && !party.contact && (
                    <div className="text-slate-400">暂无详细主体信息</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ===== 财务条款卡片 =====
function FinancialsCard({ financials }: { financials: FinancialTerm[] }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
          <DollarSign className="w-4 h-4 text-green-600" />
        </div>
        <h3 className="font-semibold text-slate-800">财务条款</h3>
        <span className="text-xs text-slate-400 ml-auto">
          {financials.length} 项
        </span>
      </div>

      {financials.length === 0 ? (
        <div className="py-8 text-center text-sm text-slate-400">
          未识别到财务条款信息
        </div>
      ) : (
        <ul className="space-y-2.5">
          {financials.map((item, idx) => (
            <li
              key={idx}
              className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 p-3"
            >
              <div className="min-w-0">
                <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 mb-1">
                  {FINANCIAL_TYPE_LABELS[item.type]}
                </span>
                <div className="text-xs text-slate-400 truncate">
                  {item.clause_ref ? `${item.clause_ref} · ` : ''}
                  {item.description}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-sm font-semibold text-slate-800">
                  {currencyLabel(item.currency)}
                  {formatAmount(item.amount)}
                </div>
                <div className="text-[10px] text-slate-400">{item.currency}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ===== 关键日期时间线卡片 =====
function TimelineCard({
  timeline,
  keyDates,
}: {
  timeline: ContractTimelineEvent[];
  keyDates: KeyDate[];
}) {
  // 优先使用 keyDates（含重要性），回退到 timeline
  const items = keyDates.length > 0 ? keyDates : timeline.map((t) => ({
    label: t.event,
    date: t.date,
    significance: 'normal' as KeyDate['significance'],
  }));

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
          <Calendar className="w-4 h-4 text-blue-600" />
        </div>
        <h3 className="font-semibold text-slate-800">关键日期</h3>
        <span className="text-xs text-slate-400 ml-auto">
          {items.length} 个
        </span>
      </div>

      {items.length === 0 ? (
        <div className="py-8 text-center text-sm text-slate-400">
          未识别到关键日期
        </div>
      ) : (
        <div className="relative pl-6">
          {/* 时间线竖线 */}
          <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-slate-200" />
          <div className="space-y-3.5">
            {items.map((item, idx) => {
              const sig =
                'significance' in item
                  ? (item as KeyDate).significance
                  : 'normal';
              const cfg = DATE_SIGNIFICANCE_CONFIG[sig];
              return (
                <div key={idx} className="relative">
                  <div
                    className={`absolute -left-[18px] top-1 w-4 h-4 rounded-full ring-4 ring-white ${cfg.dot}`}
                  />
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-slate-700 font-medium">
                      {item.label}
                    </span>
                    <span
                      className={`inline-flex items-center text-[10px] px-1.5 py-0.5 rounded ${cfg.cls}`}
                    >
                      {cfg.label}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {item.date}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ===== 关键术语列表卡片 =====
function KeyTermsCard({ terms }: { terms: KeyTerm[] }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
          <Tag className="w-4 h-4 text-amber-600" />
        </div>
        <h3 className="font-semibold text-slate-800">关键条款</h3>
        <span className="text-xs text-slate-400 ml-auto">
          {terms.length} 项
        </span>
      </div>

      {terms.length === 0 ? (
        <div className="py-8 text-center text-sm text-slate-400">
          未识别到关键条款
        </div>
      ) : (
        <div className="space-y-2.5">
          {terms.map((term, idx) => (
            <div
              key={idx}
              className="rounded-xl border border-slate-100 p-3"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span className="inline-flex items-center text-xs px-2 py-0.5 rounded bg-brand-50 text-brand-700 font-medium">
                  {term.category}
                </span>
                {term.clause_ref && (
                  <span className="text-[10px] text-slate-400">
                    {term.clause_ref}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">
                {term.value}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
