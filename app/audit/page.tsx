// ===== 审计追踪与合规页面 =====
// 服务端组件：标题区 + 左侧合规报告摘要 + 右侧审计日志时间线

export const runtime = 'edge';

import { Shield, History, FileText, XCircle, Activity, User } from 'lucide-react';
import AuditTrailView from '@/components/AuditTrailView';
import { getMockAuditLogs, generateComplianceReport } from '@/lib/audit-trail';
import { AUDIT_ACTION_LABELS } from '@/lib/types';
import type { AuditAction } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function AuditPage() {
  // 服务端预取用于展示合规报告摘要
  const logs = getMockAuditLogs();
  const report = generateComplianceReport(logs);

  // 合规分数颜色与提示
  const score = report.compliance_score;
  const scoreColor =
    score >= 80 ? 'text-green-600' : score >= 60 ? 'text-amber-600' : 'text-red-600';
  const scoreBarColor =
    score >= 80 ? 'bg-green-500' : score >= 60 ? 'bg-amber-500' : 'bg-red-500';
  const scoreLabel =
    score >= 80 ? '合规良好' : score >= 60 ? '合规一般' : '需改进';

  // 按操作类型分布前 5
  const typeDistribution = Object.entries(report.actions_by_type)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5) as [AuditAction, number][];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* 页头 */}
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="w-6 h-6 text-brand-600" />
            审计追踪与合规
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            全流程操作审计留痕，自动生成合规报告并识别潜在风险
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-slate-200">
            <History className="w-4 h-4 text-brand-600" />
            <span className="text-xs text-slate-500">演示模式</span>
            <span className="text-xs text-slate-300">·</span>
            <span className="text-xs text-slate-400">
              共 {report.total_actions} 条审计日志
            </span>
          </div>
          {report.issues.length > 0 ? (
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-50 border border-amber-100">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <span className="text-xs font-medium text-amber-600">
                {report.issues.length} 项合规问题
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-green-50 border border-green-100">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-xs font-medium text-green-600">合规良好</span>
            </div>
          )}
        </div>
      </div>

      {/* 左右两栏布局 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左侧：合规报告摘要 */}
        <div className="space-y-5">
          {/* 合规分数大数字 */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="w-4 h-4 text-brand-600" />
              <h2 className="font-semibold text-slate-800">合规分数</h2>
            </div>
            <div className="flex items-baseline gap-2">
              <span className={`text-5xl font-bold ${scoreColor}`}>
                {score}
              </span>
              <span className="text-lg text-slate-400">/ 100</span>
              <span className={`ml-auto text-sm font-medium ${scoreColor}`}>
                {scoreLabel}
              </span>
            </div>
            {/* 分数进度条 */}
            <div className="mt-3 h-2.5 rounded-full bg-slate-100 overflow-hidden">
              <div
                className={`h-full rounded-full ${scoreBarColor} transition-all`}
                style={{ width: `${score}%` }}
              />
            </div>
            <p className="mt-3 text-xs text-slate-400 leading-relaxed">
              基于操作覆盖率（60%）与异常率（40%）加权计算，并扣除合规问题惩罚分
            </p>

            {/* 基础统计 */}
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                  <Activity className="w-3.5 h-3.5" />
                  总操作数
                </div>
                <div className="text-lg font-bold text-slate-800">
                  {report.total_actions}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                  <User className="w-3.5 h-3.5" />
                  独立用户
                </div>
                <div className="text-lg font-bold text-slate-800">
                  {report.unique_users}
                </div>
              </div>
            </div>
          </div>

          {/* 合规问题列表 */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="flex items-center gap-2 mb-3">
              <XCircle className="w-4 h-4 text-amber-600" />
              <h2 className="font-semibold text-slate-800">合规问题</h2>
              <span className="text-xs text-slate-400 ml-auto">
                {report.issues.length} 项
              </span>
            </div>
            {report.issues.length === 0 ? (
              <div className="py-6 text-center text-sm text-slate-400">
                未发现合规问题，流程符合规范
              </div>
            ) : (
              <ul className="space-y-2.5">
                {report.issues.map((issue, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2 text-sm text-slate-600 p-2.5 rounded-lg bg-amber-50/60 border border-amber-100"
                  >
                    <span className="w-5 h-5 shrink-0 rounded-full bg-amber-100 text-amber-700 text-xs flex items-center justify-center font-medium">
                      {idx + 1}
                    </span>
                    <span className="leading-relaxed">{issue}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* 操作类型分布 */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-4 h-4 text-brand-600" />
              <h2 className="font-semibold text-slate-800">操作类型分布</h2>
            </div>
            <div className="space-y-2.5">
              {typeDistribution.map(([action, count]) => {
                const total = report.total_actions || 1;
                const percent = Math.round((count / total) * 100);
                return (
                  <div key={action}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-slate-600">
                        {AUDIT_ACTION_LABELS[action] || action}
                      </span>
                      <span className="text-slate-400">
                        {count} · {percent}%
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full gradient-bg"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 右侧：审计日志时间线 */}
        <div className="lg:col-span-2">
          <AuditTrailView />
        </div>
      </div>
    </div>
  );
}
