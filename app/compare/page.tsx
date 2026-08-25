'use client';

export const runtime = 'edge';

import { useState } from 'react';
import { GitCompare, ArrowRight, FileText } from 'lucide-react';
import ContractDiffView from '@/components/ContractDiffView';
import { ContractComparisonResult } from '@/lib/types';

// ===== 合同对比分析页面 =====
// 左右两个文本输入区，粘贴合同文本后点击对比，展示差异分析结果

// 演示用合同文本A（原版）
const DEMO_TEXT_A = `XX产品采购合同

第3.2条 甲方应在合同签署后7个工作日内向乙方支付合同总金额的50%作为预付款。

第4.2条 乙方应在收到甲方订单后45日内完成交付。

第5.1条 任何一方违反本合同约定，应向守约方支付违约金，违约金数额由双方另行协商确定。

第8.2条 乙方应对其在履行本合同过程中获知的甲方商业信息承担保密义务，保密期限为本合同终止后3年。

第9.1条 双方因履行本合同发生的争议，应友好协商解决；协商不成的，任何一方可向有管辖权的人民法院提起诉讼。

第10.1条 本合同履行过程中由甲方提供的技术方案和已有知识产权归甲方所有；乙方新开发的技术成果知识产权归甲乙双方共同所有。`;

// 演示用合同文本B（修订版）
const DEMO_TEXT_B = `XX产品采购合同（修订版）

第3.2条 甲方应在收到乙方交付的全部货物并验收合格后10个工作日内，向乙方支付合同总金额的30%作为首期付款；剩余70%在验收合格后30日内付清。

第4.2条 乙方应在收到甲方订单后30日内完成交付。逾期交付的，每逾期一日，乙方应按合同总金额的0.5%向甲方支付违约金。

第5.1条 任何一方违反本合同约定，应向守约方支付违约金，违约金金额为合同总金额的15%。如违约金不足以弥补守约方实际损失的，违约方应补足差额。

第8.2条 乙方应对其在履行本合同过程中获知的甲方商业信息承担保密义务，保密期限为本合同终止后5年。乙方违反保密义务的，应向甲方支付合同总金额20%的违约金。

第9.1条 双方因履行本合同发生的争议，应友好协商解决；协商不成的，任何一方可向有管辖权的人民法院提起诉讼。`;

export default function ComparePage() {
  const [textA, setTextA] = useState('');
  const [textB, setTextB] = useState('');
  const [titleA, setTitleA] = useState('合同A');
  const [titleB, setTitleB] = useState('合同B');
  const [typeA, setTypeA] = useState('采购合同');
  const [typeB, setTypeB] = useState('采购合同');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ContractComparisonResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 开始对比
  async function handleCompare() {
    if (textA.trim().length < 20 || textB.trim().length < 20) {
      setError('请粘贴有效的合同文本（至少20个字符）');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch('/api/contract-diff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text_a: textA,
          text_b: textB,
          title_a: titleA || '合同A',
          title_b: titleB || '合同B',
          type_a: typeA || '未分类',
          type_b: typeB || '未分类',
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `请求失败 (${res.status})`);
      }

      const data = await res.json();
      setResult(data as ContractComparisonResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : '对比分析失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }

  // 一键填充示例合同
  function handleDemoFill() {
    setTextA(DEMO_TEXT_A);
    setTextB(DEMO_TEXT_B);
    setTitleA('XX产品采购合同（原版）');
    setTitleB('XX产品采购合同（修订版）');
    setTypeA('采购合同');
    setTypeB('采购合同');
    setResult(null);
    setError(null);
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* 页面标题 */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-11 h-11 rounded-xl gradient-bg flex items-center justify-center">
          <GitCompare className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">合同对比分析</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            粘贴两份合同文本，AI自动逐条比对差异并分析风险影响
          </p>
        </div>
      </div>

      {/* 输入区域 */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-5">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* 合同A */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
              <FileText className="w-4 h-4 text-brand-600" />
              合同A
            </div>
            <input
              type="text"
              value={titleA}
              onChange={e => setTitleA(e.target.value)}
              placeholder="合同A标题"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-200"
            />
            <textarea
              value={textA}
              onChange={e => setTextA(e.target.value)}
              placeholder="在此粘贴合同A的文本内容..."
              rows={12}
              className="w-full resize-y rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-200 font-mono"
            />
            <div className="text-xs text-slate-400 text-right">
              {textA.length} 字符
            </div>
          </div>

          {/* 合同B */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
              <FileText className="w-4 h-4 text-brand-600" />
              合同B
            </div>
            <input
              type="text"
              value={titleB}
              onChange={e => setTitleB(e.target.value)}
              placeholder="合同B标题"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-200"
            />
            <textarea
              value={textB}
              onChange={e => setTextB(e.target.value)}
              placeholder="在此粘贴合同B的文本内容..."
              rows={12}
              className="w-full resize-y rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-200 font-mono"
            />
            <div className="text-xs text-slate-400 text-right">
              {textB.length} 字符
            </div>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center justify-between gap-3 mt-4 pt-4 border-t border-slate-100">
          <button
            onClick={handleDemoFill}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-brand-700 bg-brand-50 border border-brand-200 hover:bg-brand-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FileText className="w-4 h-4" />
            填充示例合同
          </button>

          <button
            onClick={handleCompare}
            disabled={loading || textA.trim().length < 20 || textB.trim().length < 20}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-lg gradient-bg text-white text-sm font-medium hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full spinner" />
                分析中...
              </>
            ) : (
              <>
                <ArrowRight className="w-4 h-4" />
                开始对比
              </>
            )}
          </button>
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-5">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* 结果区域 */}
      {result && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <GitCompare className="w-5 h-5 text-brand-600" />
            <h2 className="text-lg font-semibold text-slate-800">对比结果</h2>
          </div>
          <ContractDiffView result={result} />
        </div>
      )}

      {/* 空状态提示 */}
      {!result && !loading && !error && (
        <div className="bg-white rounded-xl border border-dashed border-slate-200 p-12 text-center">
          <GitCompare className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-400">
            粘贴两份合同文本后点击「开始对比」，或点击「填充示例合同」快速体验
          </p>
        </div>
      )}
    </div>
  );
}
