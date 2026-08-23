'use client';

import { useState, useRef } from 'react';
import { FileText, MessageSquare, Sparkles } from 'lucide-react';
import ContractQA, { ContractQAHandle } from '@/components/ContractQA';
import { getMockContracts } from '@/lib/mock-data';
import { Contract } from '@/lib/types';

// ===== AI合同问答页面 =====
// 选择合同后，可针对合同内容向AI提问

// 建议问题列表
const SUGGESTED_QUESTIONS = [
  '这个合同有哪些高风险条款？',
  '付款条件是否合理？',
  '违约责任如何？',
  '有什么修改建议？',
];

export default function QAPage() {
  const contracts: Contract[] = getMockContracts();
  const [selectedId, setSelectedId] = useState<string>(contracts[0]?.id || '');
  const qaRef = useRef<ContractQAHandle>(null);

  const selectedContract = contracts.find(c => c.id === selectedId);

  // 点击建议问题：自动填充并发送
  function handleSuggestedQuestion(question: string) {
    qaRef.current?.sendQuestion(question);
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* 页面标题 */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-11 h-11 rounded-xl gradient-bg flex items-center justify-center">
          <MessageSquare className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">AI合同问答助手</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            选择合同，向AI提问关于条款、风险、修改建议的任何问题
          </p>
        </div>
      </div>

      {/* 合同选择器 */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-5">
        <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700 mb-2">
          <FileText className="w-4 h-4 text-brand-600" />
          选择合同
        </label>
        <select
          value={selectedId}
          onChange={e => setSelectedId(e.target.value)}
          className="w-full sm:w-96 rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-700 bg-white focus:outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-200"
        >
          {contracts.map(c => (
            <option key={c.id} value={c.id}>
              {c.contract_title || c.filename}
            </option>
          ))}
        </select>
        {selectedContract && (
          <div className="flex items-center gap-3 mt-3 text-xs text-slate-400">
            <span>类型：{selectedContract.contract_type || '未分类'}</span>
            <span>风险评分：{selectedContract.risk_score ?? '-'}</span>
            <span>风险项：{selectedContract.risk_count ?? 0}</span>
          </div>
        )}
      </div>

      {/* 建议问题快捷按钮 */}
      <div className="mb-4">
        <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 mb-2">
          <Sparkles className="w-3.5 h-3.5 text-brand-500" />
          建议问题（点击直接提问）
        </div>
        <div className="flex flex-wrap gap-2">
          {SUGGESTED_QUESTIONS.map(q => (
            <button
              key={q}
              onClick={() => handleSuggestedQuestion(q)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium text-brand-700 bg-brand-50 border border-brand-200 hover:bg-brand-100 hover:border-brand-300 transition-all"
            >
              <Sparkles className="w-3 h-3" />
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* 问答组件 */}
      {selectedId && (
        <ContractQA
          ref={qaRef}
          contractId={selectedId}
          contractTitle={selectedContract?.contract_title || selectedContract?.filename}
        />
      )}
    </div>
  );
}
