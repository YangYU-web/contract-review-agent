// ===== 合同到期管理页面 =====
// 服务端组件：展示合同生命周期统计与到期列表

import { Calendar, Clock, AlertTriangle, CheckCircle, XCircle, FileText } from 'lucide-react';
import {
  getMockLifecycles,
  getExpiringSoon,
  formatCurrency,
  LIFECYCLE_STATUS_CONFIG,
} from '@/lib/contract-lifecycle';
import { ContractLifecycle } from '@/lib/types';

export const dynamic = 'force-dynamic';

// 格式化日期显示
function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// 剩余天数展示文案
function formatDaysUntilExpiry(days: number, status: string): string {
  if (status === 'terminated') return '已终止';
  if (days < 0) return `已过期 ${Math.abs(days)} 天`;
  if (days === 0) return '今日到期';
  return `剩余 ${days} 天`;
}

// 剩余天数展示颜色
function daysColor(days: number, status: string): string {
  if (status === 'terminated') return 'text-slate-400';
  if (days < 0) return 'text-red-600';
  if (days <= 7) return 'text-red-600 font-medium';
  if (days <= 30) return 'text-amber-600 font-medium';
  return 'text-slate-500';
}

export default async function LifecyclePage() {
  const lifecycles = getMockLifecycles();

  // 统计数据
  const total = lifecycles.length;
  const expiringSoon = getExpiringSoon(lifecycles, 30).length;
  const expired = lifecycles.filter((l) => l.status === 'expired').length;
  const active = lifecycles.filter((l) => l.status === 'active').length;

  // 按到期日期升序排序（已过期排前，最远排后）
  const sortedLifecycles = [...lifecycles].sort(
    (a, b) => new Date(a.end_date).getTime() - new Date(b.end_date).getTime()
  );

  const stats = [
    {
      label: '总合同数',
      value: total,
      icon: FileText,
      color: 'text-brand-600',
      bg: 'bg-brand-50',
    },
    {
      label: '即将到期（30天）',
      value: expiringSoon,
      icon: AlertTriangle,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
    {
      label: '已到期',
      value: expired,
      icon: XCircle,
      color: 'text-red-600',
      bg: 'bg-red-50',
    },
    {
      label: '生效中',
      value: active,
      icon: CheckCircle,
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* 页头 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Calendar className="w-6 h-6 text-brand-600" />
          合同到期管理
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          跟踪合同生命周期，及时处理即将到期与已过期合同，避免业务中断
        </p>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="bg-white rounded-xl border border-slate-200 p-4"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-lg ${stat.bg} flex items-center justify-center`}
                >
                  <Icon className={`w-5 h-5 ${stat.color}`} />
                </div>
                <div>
                  <div className="text-2xl font-bold text-slate-800">
                    {stat.value}
                  </div>
                  <div className="text-xs text-slate-400">{stat.label}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 合同列表表格 */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800 flex items-center gap-2">
            <Clock className="w-4 h-4 text-brand-600" />
            合同到期清单
          </h2>
          <span className="text-xs text-slate-400">按到期日期升序排列</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs">
                <th className="px-4 py-3 text-left font-medium">合同名称</th>
                <th className="px-4 py-3 text-left font-medium">类型</th>
                <th className="px-4 py-3 text-left font-medium">甲方</th>
                <th className="px-4 py-3 text-left font-medium">乙方</th>
                <th className="px-4 py-3 text-left font-medium">开始日期</th>
                <th className="px-4 py-3 text-left font-medium">结束日期</th>
                <th className="px-4 py-3 text-left font-medium">状态</th>
                <th className="px-4 py-3 text-left font-medium">剩余天数</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedLifecycles.map((lc: ContractLifecycle) => {
                const config =
                  LIFECYCLE_STATUS_CONFIG[lc.status] ?? LIFECYCLE_STATUS_CONFIG.active;
                return (
                  <tr key={lc.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-slate-300 shrink-0" />
                        <span className="font-medium text-slate-800">
                          {lc.contract_title}
                        </span>
                      </div>
                      {lc.value !== undefined && (
                        <div className="text-xs text-slate-400 mt-1 ml-6">
                          金额：{formatCurrency(lc.value, lc.currency)}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                        {lc.contract_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{lc.party_a}</td>
                    <td className="px-4 py-3 text-slate-600">{lc.party_b}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {formatDate(lc.start_date)}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {formatDate(lc.end_date)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded"
                        style={{ color: config.color, backgroundColor: config.bg }}
                      >
                        {config.label}
                      </span>
                      {lc.auto_renew && (
                        <span className="ml-1 text-xs text-brand-600">自动续签</span>
                      )}
                    </td>
                    <td className={`px-4 py-3 ${daysColor(lc.days_until_expiry, lc.status)}`}>
                      {formatDaysUntilExpiry(lc.days_until_expiry, lc.status)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {sortedLifecycles.length === 0 && (
          <div className="p-12 text-center">
            <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-400">暂无合同生命周期数据</p>
          </div>
        )}
      </div>
    </div>
  );
}
