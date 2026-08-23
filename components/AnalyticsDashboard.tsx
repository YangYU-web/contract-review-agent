'use client';

import { DashboardStats, RISK_TYPE_LABELS, RISK_LEVEL_CONFIG } from '@/lib/types';
import { BarChart3, PieChart, TrendingUp, AlertTriangle } from 'lucide-react';

interface AnalyticsDashboardProps {
  stats: DashboardStats;
}

export default function AnalyticsDashboard({ stats }: AnalyticsDashboardProps) {
  return (
    <div className="space-y-6">
      {/* KPI卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard label="审查合同总数" value={stats.total_contracts} icon={BarChart3} color="text-brand-600" bg="bg-brand-50" />
        <KPICard label="平均风险评分" value={stats.avg_risk_score} icon={TrendingUp} color={stats.avg_risk_score >= 50 ? 'text-red-500' : 'text-green-500'} bg="bg-slate-50" />
        <KPICard label="高风险合同" value={stats.high_risk_contracts} icon={AlertTriangle} color="text-red-500" bg="bg-red-50" />
        <KPICard label="待审查" value={stats.pending_reviews} icon={PieChart} color="text-amber-500" bg="bg-amber-50" />
      </div>

      {/* 月度趋势 */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-brand-600" />
          <h3 className="font-semibold text-slate-800">月度审查趋势</h3>
        </div>
        <div className="flex items-end gap-2 sm:gap-4 h-48">
          {stats.monthly_trend.map((item, idx) => {
            const maxCount = Math.max(...stats.monthly_trend.map(t => t.count), 1);
            const heightPercent = (item.count / maxCount) * 100;
            return (
              <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-xs font-medium text-slate-600">{item.count}</span>
                <div className="w-full flex-1 flex items-end">
                  <div
                    className="w-full rounded-t-lg gradient-bg transition-all hover:opacity-80"
                    style={{ height: `${Math.max(heightPercent, 5)}%`, minHeight: '4px' }}
                    title={`${item.count}份合同，平均风险评分${item.avg_score}`}
                  />
                </div>
                <span className="text-xs text-slate-400">{item.month}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 风险分布 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 风险等级分布 */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <PieChart className="w-5 h-5 text-brand-600" />
            <h3 className="font-semibold text-slate-800">风险等级分布</h3>
          </div>
          <div className="space-y-3">
            {stats.risk_distribution.map(item => {
              const config = RISK_LEVEL_CONFIG[item.level];
              const total = stats.risk_distribution.reduce((sum, r) => sum + r.count, 0) || 1;
              const percent = Math.round((item.count / total) * 100);
              return (
                <div key={item.level}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-slate-600">{config.label}</span>
                    <span className="text-sm font-medium text-slate-800">{item.count}项 ({percent}%)</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${percent}%`, backgroundColor: config.color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top风险类型 */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-5 h-5 text-brand-600" />
            <h3 className="font-semibold text-slate-800">Top 5 风险类型</h3>
          </div>
          <div className="space-y-2.5">
            {stats.top_risks.length > 0 ? stats.top_risks.map((item, idx) => {
              const label = RISK_TYPE_LABELS[item.type] || item.type;
              const maxCount = stats.top_risks[0].count || 1;
              const barWidth = (item.count / maxCount) * 100;
              return (
                <div key={item.type} className="flex items-center gap-3">
                  <span className="w-8 h-6 flex items-center justify-center text-xs font-bold text-slate-400 bg-slate-100 rounded">
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-slate-600 truncate">{label}</span>
                      <span className="text-xs text-slate-400">{item.count}次 ({item.percentage}%)</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full gradient-bg rounded-full" style={{ width: `${barWidth}%` }} />
                    </div>
                  </div>
                </div>
              );
            }) : (
              <p className="text-sm text-slate-400 text-center py-4">暂无数据</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function KPICard({ label, value, icon: Icon, color, bg }: { label: string; value: number; icon: React.ElementType; color: string; bg: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center`}>
          <Icon className={`w-5 h-5 ${color}`} />
        </div>
        <div>
          <div className="text-2xl font-bold text-slate-800">{value}</div>
          <div className="text-xs text-slate-400">{label}</div>
        </div>
      </div>
    </div>
  );
}
