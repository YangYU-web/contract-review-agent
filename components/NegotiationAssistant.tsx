'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Handshake,
  Scale,
  Target,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ChevronDown,
  Plus,
  Users,
  ArrowLeftRight,
  Lightbulb,
  DollarSign,
  RefreshCw,
} from 'lucide-react';
import {
  NegotiationSession,
  NegotiationPosition,
  NegotiationPoint,
  NegotiationStance,
  NEGOTIATION_STATUS_CONFIG,
  CONCESSION_TYPE_LABELS,
} from '@/lib/types';

// ===== 立场配色（必须项 / 期望项 / 底线项） =====
const POSITION_CATEGORY_CONFIG = {
  must_haves: {
    label: '必须项',
    icon: Target,
    color: 'text-brand-700',
    bg: 'bg-brand-50',
    border: 'border-brand-200',
    dot: 'bg-brand-500',
  },
  nice_to_haves: {
    label: '期望项',
    icon: TrendingUp,
    color: 'text-blue-700',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    dot: 'bg-blue-500',
  },
  deal_breakers: {
    label: '底线项',
    icon: XCircle,
    color: 'text-red-700',
    bg: 'bg-red-50',
    border: 'border-red-200',
    dot: 'bg-red-500',
  },
} as const;

// ===== 立场标签样式 =====
const STANCE_BADGE: Record<NegotiationStance, { label: string; cls: string }> = {
  accept: { label: '接受', cls: 'bg-green-50 text-green-700 border-green-200' },
  counter: { label: '反建议', cls: 'bg-brand-50 text-brand-700 border-brand-200' },
  reject: { label: '拒绝', cls: 'bg-red-50 text-red-700 border-red-200' },
  conditional: { label: '有条件', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
};

// ===== 让步方标签样式 =====
const GIVEN_BY_LABELS: Record<'us' | 'them' | 'both', { label: string; cls: string }> = {
  us: { label: '我方让步', cls: 'bg-red-50 text-red-700' },
  them: { label: '对方让步', cls: 'bg-green-50 text-green-700' },
  both: { label: '双方让步', cls: 'bg-slate-100 text-slate-600' },
};

// 优先级标签
const PRIORITY_LABELS: Record<string, { label: string; cls: string }> = {
  critical: { label: '关键', cls: 'bg-red-100 text-red-700' },
  high: { label: '高', cls: 'bg-orange-100 text-orange-700' },
  medium: { label: '中', cls: 'bg-blue-100 text-blue-700' },
  low: { label: '低', cls: 'bg-slate-100 text-slate-600' },
};

// 格式化日期时间
function formatDateTime(dateStr?: string): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// 格式化金额
function formatCurrency(value: number): string {
  if (value >= 10000) {
    return `¥${(value / 10000).toFixed(1)} 万`;
  }
  return `¥${value.toLocaleString('zh-CN')}`;
}

// 平衡分颜色
function balanceScoreColor(score: number): { text: string; bg: string } {
  if (score >= 70) return { text: 'text-green-600', bg: 'bg-green-500' };
  if (score >= 50) return { text: 'text-blue-600', bg: 'bg-blue-500' };
  if (score >= 30) return { text: 'text-amber-600', bg: 'bg-amber-500' };
  return { text: 'text-red-600', bg: 'bg-red-500' };
}

// 破裂风险颜色
function riskColor(risk: number): { text: string; bg: string } {
  if (risk >= 60) return { text: 'text-red-600', bg: 'bg-red-500' };
  if (risk >= 35) return { text: 'text-amber-600', bg: 'bg-amber-500' };
  return { text: 'text-green-600', bg: 'bg-green-500' };
}

interface Stats {
  total: number;
  inProgress: number;
  agreed: number;
  avgBalanceScore: number;
  totalConcessionsValue: number;
  stalledCount: number;
}

export default function NegotiationAssistant() {
  const [sessions, setSessions] = useState<NegotiationSession[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // 加载谈判会话列表
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/negotiation', { cache: 'no-store' });
      if (!res.ok) throw new Error('加载谈判会话失败');
      const data = await res.json();
      setSessions(data.sessions || []);
      setStats(data.stats || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载谈判会话失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // 触发 AI 分析
  const handleAnalyze = async (session: NegotiationSession) => {
    setActionLoading(`analyze-${session.id}`);
    setError(null);
    try {
      const res = await fetch('/api/negotiation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'analyze', session_id: session.id }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || '分析失败');
      }
      const data = await res.json();
      setSessions(data.sessions || []);
      setStats(data.stats || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '分析失败');
    } finally {
      setActionLoading(null);
    }
  };

  // 顶部统计卡片
  const statCards = [
    {
      label: '谈判会话总数',
      value: stats?.total ?? 0,
      icon: Handshake,
      color: 'text-brand-600',
      bg: 'bg-brand-50',
    },
    {
      label: '谈判中',
      value: stats?.inProgress ?? 0,
      icon: ArrowLeftRight,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: '已达成',
      value: stats?.agreed ?? 0,
      icon: CheckCircle2,
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
    {
      label: '平均平衡分',
      value: stats?.avgBalanceScore ?? 0,
      icon: Scale,
      color: 'text-brand-600',
      bg: 'bg-brand-50',
    },
    {
      label: '让步总价值',
      value: formatCurrency(stats?.totalConcessionsValue ?? 0),
      icon: DollarSign,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
    {
      label: '停滞会话',
      value: stats?.stalledCount ?? 0,
      icon: AlertTriangle,
      color: 'text-red-600',
      bg: 'bg-red-50',
    },
  ];

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm flex items-center gap-2">
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

      {/* ===== 顶部统计 ===== */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="bg-white rounded-xl border border-slate-200 shadow-sm p-4"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-lg ${card.bg} flex items-center justify-center shrink-0`}
                >
                  <Icon className={`w-5 h-5 ${card.color}`} />
                </div>
                <div className="min-w-0">
                  <div className="text-xl font-bold text-slate-800 truncate">
                    {card.value}
                  </div>
                  <div className="text-xs text-slate-400 truncate">{card.label}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ===== 谈判会话列表 ===== */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <Handshake className="w-4 h-4 text-brand-600" />
            谈判会话列表
          </h3>
          <span className="text-xs text-slate-400">
            共 {sessions.length} 个会话
          </span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm text-slate-400">
            加载谈判会话中...
          </div>
        ) : sessions.length === 0 ? (
          <div className="py-12 text-center">
            <Handshake className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-400">暂无谈判会话</p>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {sessions.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                actionLoading={actionLoading}
                onAnalyze={() => handleAnalyze(session)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ===== 谈判会话卡片 =====
function SessionCard({
  session,
  actionLoading,
  onAnalyze,
}: {
  session: NegotiationSession;
  actionLoading: string | null;
  onAnalyze: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const statusCfg = NEGOTIATION_STATUS_CONFIG[session.status];
  const analysis = session.ai_analysis;
  const scoreColors = balanceScoreColor(analysis.balance_score);
  const riskColors = riskColor(analysis.risk_of_breakdown);

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden hover:shadow-md transition-shadow">
      {/* 卡片头部 */}
      <div className="px-5 py-4 border-b border-slate-100">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <Handshake className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="font-semibold text-slate-800">
              {session.contract_title}
            </span>
            <span
              className="inline-flex items-center text-xs px-2 py-0.5 rounded"
              style={{ color: statusCfg.color, backgroundColor: statusCfg.bg }}
            >
              {statusCfg.label}
            </span>
            <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600">
              第 {session.round} 轮
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onAnalyze}
              disabled={actionLoading === `analyze-${session.id}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Lightbulb className="w-3.5 h-3.5" />
              {actionLoading === `analyze-${session.id}` ? '分析中...' : 'AI 分析'}
            </button>
            <button
              onClick={() => setExpanded((prev) => !prev)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors"
            >
              {expanded ? '收起' : '展开'}
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform ${
                  expanded ? 'rotate-180' : ''
                }`}
              />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
          <span className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            {session.counterparty}
          </span>
          <span>更新于 {formatDateTime(session.last_updated)}</span>
        </div>
      </div>

      {/* 概览区：平衡分 + ZOPA + 破裂风险 */}
      <div className="px-5 py-4 grid grid-cols-1 md:grid-cols-3 gap-4 border-b border-slate-100 bg-slate-50/40">
        {/* 平衡分仪表 */}
        <div className="flex items-center gap-3">
          <div className="relative w-14 h-14 shrink-0">
            <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
              <circle
                cx="28"
                cy="28"
                r="24"
                fill="none"
                stroke="#e2e8f0"
                strokeWidth="5"
              />
              <circle
                cx="28"
                cy="28"
                r="24"
                fill="none"
                stroke="currentColor"
                strokeWidth="5"
                strokeDasharray={`${(analysis.balance_score / 100) * 150.8} 150.8`}
                strokeLinecap="round"
                className={scoreColors.text}
              />
            </svg>
            <div
              className={`absolute inset-0 flex items-center justify-center text-sm font-bold ${scoreColors.text}`}
            >
              {analysis.balance_score}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400">谈判平衡分</div>
            <div className={`text-sm font-semibold ${scoreColors.text}`}>
              {analysis.balance_score >= 70
                ? '我方占优'
                : analysis.balance_score >= 50
                ? '势均力敌'
                : analysis.balance_score >= 30
                ? '对方占优'
                : '形势不利'}
            </div>
          </div>
        </div>

        {/* ZOPA 区间可视化 */}
        <div>
          <div className="text-xs text-slate-400 mb-1.5">可能达成协议区间（ZOPA）</div>
          <div className="relative h-6 rounded-full bg-slate-200 overflow-hidden">
            <div
              className="absolute h-full bg-gradient-to-r from-brand-300 to-brand-500"
              style={{
                left: '15%',
                right: '15%',
              }}
            />
          </div>
          <div className="flex justify-between mt-1 text-xs text-slate-500">
            <span className="font-medium">{formatCurrency(analysis.zone_of_possible_agreement.min)}</span>
            <span className="text-slate-400">协议区间</span>
            <span className="font-medium">{formatCurrency(analysis.zone_of_possible_agreement.max)}</span>
          </div>
        </div>

        {/* 破裂风险 */}
        <div>
          <div className="text-xs text-slate-400 mb-1.5">谈判破裂风险</div>
          <div className="relative h-6 rounded-full bg-slate-200 overflow-hidden">
            <div
              className={`absolute h-full ${riskColors.bg} transition-all`}
              style={{ width: `${analysis.risk_of_breakdown}%` }}
            />
          </div>
          <div className="flex justify-between mt-1 text-xs">
            <span className={`font-semibold ${riskColors.text}`}>
              {analysis.risk_of_breakdown}%
            </span>
            <span className="text-slate-400">
              {analysis.risk_of_breakdown >= 60
                ? '高风险'
                : analysis.risk_of_breakdown >= 35
                ? '中等风险'
                : '低风险'}
            </span>
          </div>
        </div>
      </div>

      {/* AI 综合评估 */}
      <div className="px-5 py-3 border-b border-slate-100">
        <div className="flex items-start gap-2">
          <Lightbulb className="w-4 h-4 text-brand-600 mt-0.5 shrink-0" />
          <p className="text-sm text-slate-600 leading-relaxed">
            {analysis.overall_assessment}
          </p>
        </div>
      </div>

      {/* 杠杆对比 */}
      <div className="px-5 py-4 grid grid-cols-1 md:grid-cols-2 gap-4 border-b border-slate-100">
        {/* 我方杠杆 */}
        <div className="rounded-lg border border-brand-100 bg-brand-50/50 p-3">
          <div className="text-sm font-medium text-brand-700 mb-2 flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4" />
            我方杠杆（{analysis.our_leverage.length}）
          </div>
          <ul className="space-y-1.5">
            {analysis.our_leverage.map((item, i) => (
              <li key={i} className="text-xs text-slate-600 flex items-start gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-500 mt-1 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>
        {/* 对方杠杆 */}
        <div className="rounded-lg border border-red-100 bg-red-50/50 p-3">
          <div className="text-sm font-medium text-red-700 mb-2 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4" />
            对方杠杆（{analysis.their_leverage.length}）
          </div>
          <ul className="space-y-1.5">
            {analysis.their_leverage.map((item, i) => (
              <li key={i} className="text-xs text-slate-600 flex items-start gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* 展开区：完整详情 */}
      {expanded && (
        <div className="px-5 py-4 space-y-4">
          {/* 双方立场 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <PositionView title="我方立场" position={session.our_position} side="our" />
            <PositionView title="对方立场" position={session.their_position} side="their" />
          </div>

          {/* AI 建议 */}
          <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4">
            <div className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-1.5">
              <Lightbulb className="w-4 h-4 text-brand-600" />
              AI 谈判建议
            </div>
            <ul className="space-y-2">
              {analysis.recommendations.map((rec, i) => (
                <li
                  key={i}
                  className="text-xs text-slate-600 flex items-start gap-2"
                >
                  <span className="w-5 h-5 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[10px] font-bold shrink-0">
                    {i + 1}
                  </span>
                  {rec}
                </li>
              ))}
            </ul>
          </div>

          {/* BATNA */}
          <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-4">
            <div className="text-sm font-medium text-blue-700 mb-1.5 flex items-center gap-1.5">
              <ArrowLeftRight className="w-4 h-4" />
              BATNA（最佳替代方案）
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">{analysis.batna}</p>
          </div>

          {/* 已达成条款 */}
          {session.agreed_terms.length > 0 && (
            <div>
              <div className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                已达成条款（{session.agreed_terms.length}）
              </div>
              <div className="space-y-2">
                {session.agreed_terms.map((term) => (
                  <div
                    key={term.id}
                    className="rounded-lg border border-green-100 bg-green-50/40 p-3"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-slate-700">
                        {term.clause}
                      </span>
                      <span className="text-xs text-slate-400">
                        第 {term.round_agreed} 轮达成
                      </span>
                    </div>
                    <p className="text-xs text-slate-600">{term.agreed_text}</p>
                    {term.original_gap && (
                      <p className="text-xs text-slate-400 mt-1">
                        原始分歧：{term.original_gap}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 让步记录表格 */}
          {session.concessions.length > 0 && (
            <div>
              <div className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-amber-600" />
                让步记录（{session.concessions.length}）
              </div>
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500">
                      <th className="px-3 py-2 text-left font-medium">类型</th>
                      <th className="px-3 py-2 text-left font-medium">描述</th>
                      <th className="px-3 py-2 text-left font-medium">让步方</th>
                      <th className="px-3 py-2 text-right font-medium">估值</th>
                      <th className="px-3 py-2 text-left font-medium">交换条件</th>
                      <th className="px-3 py-2 text-center font-medium">轮次</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {session.concessions.map((c) => {
                      const givenByCfg = GIVEN_BY_LABELS[c.given_by];
                      return (
                        <tr key={c.id} className="hover:bg-slate-50/50">
                          <td className="px-3 py-2">
                            <span className="inline-block px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                              {CONCESSION_TYPE_LABELS[c.type]}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-slate-600">{c.description}</td>
                          <td className="px-3 py-2">
                            <span className={`inline-block px-1.5 py-0.5 rounded ${givenByCfg.cls}`}>
                              {givenByCfg.label}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right font-medium text-slate-700">
                            {formatCurrency(c.estimated_value)}
                          </td>
                          <td className="px-3 py-2 text-slate-500">{c.trade_off}</td>
                          <td className="px-3 py-2 text-center text-slate-400">
                            R{c.round}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ===== 谈判立场展示 =====
function PositionView({
  title,
  position,
  side,
}: {
  title: string;
  position: NegotiationPosition;
  side: 'our' | 'their';
}) {
  const categories: (keyof typeof POSITION_CATEGORY_CONFIG)[] = [
    'must_haves',
    'nice_to_haves',
    'deal_breakers',
  ];
  const sideColor = side === 'our' ? 'text-brand-700' : 'text-slate-700';

  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className={`text-sm font-medium ${sideColor} mb-3 flex items-center gap-1.5`}>
        {side === 'our' ? (
          <Scale className="w-4 h-4 text-brand-600" />
        ) : (
          <Users className="w-4 h-4 text-slate-500" />
        )}
        {title}
      </div>
      <div className="space-y-3">
        {categories.map((cat) => {
          const cfg = POSITION_CATEGORY_CONFIG[cat];
          const points = position[cat];
          const Icon = cfg.icon;
          return (
            <div key={cat}>
              <div className={`text-xs font-medium ${cfg.color} mb-1.5 flex items-center gap-1`}>
                <Icon className="w-3 h-3" />
                {cfg.label}（{points.length}）
              </div>
              <div className="space-y-1.5">
                {points.length === 0 ? (
                  <p className="text-xs text-slate-300 pl-4">暂无</p>
                ) : (
                  points.map((pt) => {
                    const stanceCfg = STANCE_BADGE[pt.stance];
                    const priCfg = PRIORITY_LABELS[pt.priority] || PRIORITY_LABELS.medium;
                    return (
                      <div
                        key={pt.id}
                        className={`rounded border ${cfg.border} ${cfg.bg} p-2`}
                      >
                        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                          <span className="text-xs font-medium text-slate-700">
                            {pt.clause}
                          </span>
                          <span
                            className={`inline-block text-[10px] px-1 py-0.5 rounded border ${stanceCfg.cls}`}
                          >
                            {stanceCfg.label}
                          </span>
                          <span
                            className={`inline-block text-[10px] px-1 py-0.5 rounded ${priCfg.cls}`}
                          >
                            {priCfg.label}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 space-y-0.5 pl-1">
                          <div>
                            <span className="text-slate-400">我方：</span>
                            {pt.our_proposal}
                          </div>
                          <div>
                            <span className="text-slate-400">对方：</span>
                            {pt.their_proposal}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
