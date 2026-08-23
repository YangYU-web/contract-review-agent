// ===== 风险趋势预警页面 =====
// 服务端组件：标题区 + 嵌入 RiskAlertDashboard 客户端组件

import { Bell, Shield } from 'lucide-react';
import RiskAlertDashboard from '@/components/RiskAlertDashboard';
import { getMockAlerts, getMockTrendData } from '@/lib/risk-alerts';

export const dynamic = 'force-dynamic';

export default async function AlertsPage() {
  // 服务端预取用于展示概要信息
  const alerts = getMockAlerts();
  const trend = getMockTrendData();

  const criticalCount = alerts.filter((a) => a.severity === 'critical' && a.status !== 'resolved').length;
  const activeCount = alerts.filter((a) => a.status === 'active').length;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* 页头 */}
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bell className="w-6 h-6 text-brand-600" />
            风险趋势预警
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            基于合同审查数据实时监控风险指标，自动生成预警并跟踪处理进度
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-slate-200">
            <Shield className="w-4 h-4 text-brand-600" />
            <span className="text-xs text-slate-500">演示模式</span>
            <span className="text-xs text-slate-300">·</span>
            <span className="text-xs text-slate-400">
              预警 {alerts.length} 条 / 趋势 {trend.length} 期
            </span>
          </div>
          {criticalCount > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-50 border border-red-100">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-xs font-medium text-red-600">
                {criticalCount} 项严重预警待处理
              </span>
            </div>
          )}
          {criticalCount === 0 && activeCount > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-50 border border-amber-100">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="text-xs font-medium text-amber-600">
                {activeCount} 项活跃预警
              </span>
            </div>
          )}
          {activeCount === 0 && (
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-green-50 border border-green-100">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-xs font-medium text-green-600">
                风险可控
              </span>
            </div>
          )}
        </div>
      </div>

      <RiskAlertDashboard />
    </div>
  );
}
