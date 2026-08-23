import KnowledgeBaseView from '@/components/KnowledgeBaseView';
import { getMockKnowledgeBase } from '@/lib/knowledge-base';
import { isSupabaseConfigured } from '@/lib/supabase';
import { Contract, ContractRisk } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function KnowledgeBasePage() {
  let contracts: Contract[] = [];
  let risks: ContractRisk[] = [];

  if (isSupabaseConfigured()) {
    try {
      const { getSupabaseServer } = await import('@/lib/supabase');
      const supabase = getSupabaseServer();
      if (supabase) {
        const { data: contractData } = await supabase.from('contracts').select('*');
        contracts = (contractData as Contract[]) || [];
        const contractIds = contracts.map(c => c.id);
        if (contractIds.length > 0) {
          const { data: riskData } = await supabase.from('contract_risks').select('*').in('contract_id', contractIds);
          risks = (riskData as ContractRisk[]) || [];
        }
      }
    } catch { /* fall back */ }
  }

  if (contracts.length === 0) {
    const mock = getMockKnowledgeBase();
    contracts = mock.contracts;
    risks = mock.risks;
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">合同知识库</h1>
        <p className="text-slate-500 text-sm mt-1">
          搜索历史审查记录中的条款、风险和修改建议
        </p>
      </div>
      <KnowledgeBaseView contracts={contracts} risks={risks} />
    </div>
  );
}
