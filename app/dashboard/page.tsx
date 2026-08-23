import Link from 'next/link';
import { FileText, AlertTriangle, ChevronRight, Clock } from 'lucide-react';
import { getMockContracts } from '@/lib/mock-data';
import { isSupabaseConfigured } from '@/lib/supabase';
import { Contract } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  let contracts: Contract[] = [];

  if (isSupabaseConfigured()) {
    // 实际模式：从Supabase查询
    try {
      const { getSupabaseServer } = await import('@/lib/supabase');
      const supabase = getSupabaseServer();
      if (supabase) {
        const { data } = await supabase
          .from('contracts')
          .select('*')
          .order('created_at', { ascending: false });
        contracts = (data as Contract[]) || [];
      }
    } catch {
      // 查询失败，使用mock数据
      contracts = getMockContracts();
    }
  } else {
    // 演示模式：使用mock数据
    contracts = getMockContracts();
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 86400000);
    if (diff === 0) return '今天';
    if (diff === 1) return '昨天';
    if (diff < 7) return `${diff}天前`;
    return date.toLocaleDateString('zh-CN');
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">审查记录</h1>
          <p className="text-slate-500 text-sm mt-1">
            {isSupabaseConfigured() ? `共 ${contracts.length} 份合同` : '演示模式 — 模拟数据'}
          </p>
        </div>
        <Link
          href="/upload"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg gradient-bg text-white text-sm font-medium hover:shadow-lg transition-all"
        >
          <FileText className="w-4 h-4" />
          新建审查
        </Link>
      </div>

      {contracts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-400">还没有审查记录</p>
          <Link href="/upload" className="text-brand-600 text-sm font-medium mt-2 inline-block">
            上传第一份合同 →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {contracts.map((contract) => (
            <Link
              key={contract.id}
              href={`/dashboard/${contract.id}`}
              className="block bg-white rounded-xl border border-slate-200 p-5 card-hover"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="w-12 h-12 rounded-lg bg-brand-50 flex items-center justify-center shrink-0">
                    <FileText className="w-6 h-6 text-brand-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-800 truncate">
                      {contract.contract_title || contract.filename}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                      <span>{contract.contract_type || '未分类'}</span>
                      <span className="flex items-center gap-0.5">
                        <Clock className="w-3 h-3" />
                        {formatDate(contract.created_at)}
                      </span>
                      {contract.status === 'completed' && (
                        <span className="flex items-center gap-1">
                          {contract.high_risk_count && contract.high_risk_count > 0 ? (
                            <span className="flex items-center gap-0.5 text-red-500">
                              <AlertTriangle className="w-3 h-3" />
                              {contract.high_risk_count}项高风险
                            </span>
                          ) : (
                            <span className="text-green-500">风险可控</span>
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* 风险评分 */}
                {contract.status === 'completed' && contract.risk_score !== null && (
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <div className={`text-2xl font-bold ${
                        (contract.risk_score || 0) >= 60 ? 'text-red-500' :
                        (contract.risk_score || 0) >= 40 ? 'text-amber-500' :
                        'text-green-500'
                      }`}>
                        {contract.risk_score}
                      </div>
                      <div className="text-xs text-slate-400">风险评分</div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-300" />
                  </div>
                )}

                {contract.status !== 'completed' && (
                  <div className="text-sm text-amber-500 shrink-0">
                    {contract.status === 'reviewing' ? '审查中...' : '待审查'}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
