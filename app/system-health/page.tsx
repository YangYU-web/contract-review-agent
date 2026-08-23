// ===== 系统健康监控页面 =====
// 服务端组件：标题区 + 自动刷新间隔提示 + 嵌入 SystemHealthDashboard 客户端组件

import { Activity, Server, RefreshCw } from 'lucide-react';
import SystemHealthDashboard from '@/components/SystemHealthDashboard';
import { getHealthDashboard } from '@/lib/system-health';

export const dynamic = 'force-dynamic';

export default async function SystemHealthPage() {
  // 服务端预取用于展示概要信息
  const dashboard = getHealthDashboard();
  const downCount = dashboard.services.filter(
    (s) => s.status === 'down'
  ).length;
  const degradedCount = dashboard.services.filter(
    (s) => s.status === 'degraded'
  ).length;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* 页头 */}
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="w-6 h-6 text-brand-600" />
            系统健康监控
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            实时监控各服务运行状态、系统资源指标与可用性，自动发现并跟踪系统告警
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* 自动刷新间隔提示 */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-slate-200">
            <RefreshCw className="w-4 h-4 text-brand-600" />
            <span className="text-xs text-slate-500">自动刷新</span>
            <span className="text-xs text-slate-300">·</span>
            <span className="text-xs text-slate-400">每 30 秒</span>
          </div>
          {/* 演示模式提示 */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-slate-200">
            <Server className="w-4 h-4 text-brand-600" />
            <span className="text-xs text-slate-500">演示模式</span>
            <span className="text-xs text-slate-300">·</span>
            <span className="text-xs text-slate-400">
              服务 {dashboard.services.length} 个 · 指标{' '}
              {dashboard.recent_metrics.length} 点
            </span>
          </div>
          {/* 状态汇总 */}
          {downCount > 0 ? (
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-50 border border-red-100">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-xs font-medium text-red-600">
                {downCount} 个服务故障
              </span>
            </div>
          ) : degradedCount > 0 ? (
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-50 border border-amber-100">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="text-xs font-medium text-amber-600">
                {degradedCount} 个服务降级
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-green-50 border border-green-100">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-xs font-medium text-green-600">
                全部服务正常
              </span>
            </div>
          )}
        </div>
      </div>

      <SystemHealthDashboard />
    </div>
  );
}
