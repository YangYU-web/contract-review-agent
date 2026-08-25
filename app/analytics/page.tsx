export const runtime = 'edge';

import AnalyticsDashboard from '@/components/AnalyticsDashboard';
import { getMockDashboardStats } from '@/lib/analytics';
import { isSupabaseConfigured } from '@/lib/supabase';
import { DashboardStats } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function AnalyticsPage() {
  let stats: DashboardStats = getMockDashboardStats();

  if (isSupabaseConfigured()) {
    try {
      const { getSupabaseServer } = await import('@/lib/supabase');
      const supabase = getSupabaseServer();
      if (supabase) {
        const { data: contracts } = await supabase.from('contracts').select('*');
        const { data: risks } = await supabase.from('contract_risks').select('*');
        const { calculateDashboardStats } = await import('@/lib/analytics');
        stats = calculateDashboardStats(contracts || [], risks || []);
      }
    } catch {
      stats = getMockDashboardStats();
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">数据分析仪表盘</h1>
        <p className="text-slate-500 text-sm mt-1">
          {isSupabaseConfigured() ? '基于真实审查数据' : '演示模式 — 模拟数据'}
        </p>
      </div>
      <AnalyticsDashboard stats={stats} />
    </div>
  );
}
