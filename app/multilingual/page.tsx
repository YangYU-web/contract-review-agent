'use client';

export const runtime = 'edge';

import { useState } from 'react';
import {
  Languages,
  Globe,
  ArrowRight,
  FileText,
  Sparkles,
  Loader2,
} from 'lucide-react';
import BilingualDiffView from '@/components/BilingualDiffView';
import { LanguageDetectionResult, BilingualClause, LANGUAGE_LABELS } from '@/lib/types';

// ===== 多语言合同审查页面 =====
// 提供中文与英文合同文本输入，支持语言检测与中英文条款逐条对比

// 示例中文合同文本（含差异，用于演示对比能力）
const SAMPLE_ZH = `产品采购合同

第一条 合同总金额为人民币五十万元整（￥500,000），甲方应在合同签署后7个工作日内向乙方支付合同总金额的50%作为预付款。

第二条 乙方应在收到甲方订单后45日内完成交付。逾期交付的，每逾期一日，乙方应按合同总金额的0.5%向甲方支付违约金。

第三条 任何一方违反本合同约定，应向守约方支付违约金，违约金金额为合同总金额的15%。

第四条 乙方应对其在履行本合同过程中获知的甲方商业信息承担保密义务，保密期限为本合同终止后3年。

第五条 双方因履行本合同发生的争议，应友好协商解决；协商不成的，任何一方可向有管辖权的人民法院提起诉讼。`;

// 示例英文合同文本（与中文存在数值/术语差异，用于演示）
const SAMPLE_EN = `Product Purchase Agreement

Article 1 The total contract amount is RMB 500,000. Party A shall pay 30% of the total contract amount as advance payment to Party B within 10 working days after signing the contract.

Article 2 Party B shall complete delivery within 45 days after receiving Party A's order. In case of delayed delivery, Party B shall pay liquidated damages equal to 0.5% of the total contract amount for each day of delay.

Article 3 Either party breaching this contract shall pay liquidated damages equal to 20% of the total contract amount to the non-breaching party.

Article 4 Party B shall keep confidential the commercial information of Party A obtained during the performance of this contract for 3 years after termination of this contract.

Article 5 Disputes arising from the performance of this contract shall be settled through amicable negotiation; if negotiation fails, either party may submit the dispute to arbitration.`;

export default function MultilingualPage() {
  const [zhText, setZhText] = useState('');
  const [enText, setEnText] = useState('');

  const [detectLoading, setDetectLoading] = useState(false);
  const [compareLoading, setCompareLoading] = useState(false);
  const [detection, setDetection] = useState<LanguageDetectionResult | null>(null);
  const [clauses, setClauses] = useState<BilingualClause[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 语言检测：合并两段文本后检测整体语言分布
  async function handleDetect() {
    const combined = (zhText + '\n' + enText).trim();
    if (combined.length < 10) {
      setError('请输入至少 10 个字符的合同文本以进行语言检测');
      setDetection(null);
      return;
    }
    setDetectLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/multilingual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'detect', text: combined }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `请求失败 (${res.status})`);
      }
      const data = await res.json();
      setDetection(data as LanguageDetectionResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : '语言检测失败，请稍后重试');
      setDetection(null);
    } finally {
      setDetectLoading(false);
    }
  }

  // 双语对比分析
  async function handleCompare() {
    if (zhText.trim().length < 20 || enText.trim().length < 20) {
      setError('请输入有效的中英文合同文本（至少 20 个字符）');
      setClauses(null);
      return;
    }
    setCompareLoading(true);
    setError(null);
    setClauses(null);
    try {
      const res = await fetch('/api/multilingual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'compare', text_a: zhText, text_b: enText }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `请求失败 (${res.status})`);
      }
      const data = await res.json();
      setClauses(data.clauses as BilingualClause[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : '对比分析失败，请稍后重试');
      setClauses(null);
    } finally {
      setCompareLoading(false);
    }
  }

  // 一键填充示例
  function handleSampleFill() {
    setZhText(SAMPLE_ZH);
    setEnText(SAMPLE_EN);
    setDetection(null);
    setClauses(null);
    setError(null);
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* 页面标题 */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-11 h-11 rounded-xl gradient-bg flex items-center justify-center">
          <Languages className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">多语言合同审查</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            自动检测合同语言，逐条对比中英文条款差异，识别数值与术语不一致
          </p>
        </div>
      </div>

      {/* 输入区域 */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-5">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* 中文合同 */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
              <FileText className="w-4 h-4 text-brand-600" />
              中文合同文本
            </div>
            <textarea
              value={zhText}
              onChange={e => setZhText(e.target.value)}
              placeholder="在此粘贴中文合同文本..."
              rows={14}
              className="w-full resize-y rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-200"
            />
            <div className="text-xs text-slate-400 text-right">{zhText.length} 字符</div>
          </div>

          {/* 英文合同 */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
              <FileText className="w-4 h-4 text-blue-500" />
              英文合同文本 (English)
            </div>
            <textarea
              value={enText}
              onChange={e => setEnText(e.target.value)}
              placeholder="Paste English contract text here..."
              rows={14}
              className="w-full resize-y rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-200"
            />
            <div className="text-xs text-slate-400 text-right">{enText.length} chars</div>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-4 border-t border-slate-100">
          <button
            onClick={handleSampleFill}
            disabled={detectLoading || compareLoading}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-brand-700 bg-brand-50 border border-brand-200 hover:bg-brand-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Sparkles className="w-4 h-4" />
            填充示例
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDetect}
              disabled={detectLoading || (zhText + enText).trim().length < 10}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-slate-700 bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {detectLoading ? (
                <Loader2 className="w-4 h-4 spinner" />
              ) : (
                <Globe className="w-4 h-4" />
              )}
              检测语言
            </button>

            <button
              onClick={handleCompare}
              disabled={compareLoading || zhText.trim().length < 20 || enText.trim().length < 20}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-lg gradient-bg text-white text-sm font-medium hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {compareLoading ? (
                <Loader2 className="w-4 h-4 spinner" />
              ) : (
                <ArrowRight className="w-4 h-4" />
              )}
              对比分析
            </button>
          </div>
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-5">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* 语言检测结果 */}
      {detection && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 mb-5">
          <div className="flex items-center gap-2 mb-4">
            <Globe className="w-5 h-5 text-brand-600" />
            <h2 className="text-lg font-semibold text-slate-800">语言检测结果</h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {/* 识别语言 */}
            <div className="bg-brand-50 rounded-xl p-4 text-center">
              <div className="text-xs text-slate-400 mb-1">识别语言</div>
              <div className="text-lg font-bold text-brand-700">
                {LANGUAGE_LABELS[detection.language]}
              </div>
            </div>

            {/* 置信度 */}
            <div className="bg-slate-50 rounded-xl p-4 text-center">
              <div className="text-xs text-slate-400 mb-1">置信度</div>
              <div className="text-lg font-bold text-slate-800">{detection.confidence}%</div>
            </div>

            {/* 中文字符比例 */}
            <div className="bg-slate-50 rounded-xl p-4 text-center">
              <div className="text-xs text-slate-400 mb-1">中文字符比例</div>
              <div className="text-lg font-bold text-slate-800">
                {(detection.chinese_ratio * 100).toFixed(1)}%
              </div>
            </div>

            {/* 英文字符比例 */}
            <div className="bg-slate-50 rounded-xl p-4 text-center">
              <div className="text-xs text-slate-400 mb-1">英文字母比例</div>
              <div className="text-lg font-bold text-slate-800">
                {(detection.english_ratio * 100).toFixed(1)}%
              </div>
            </div>
          </div>

          {/* 字符比例可视化 */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
              <span>字符比例分布</span>
              <span>总字符 {detection.total_chars}</span>
            </div>
            <div className="flex h-3 rounded-full overflow-hidden bg-slate-100">
              <div
                className="h-full bg-gradient-to-r from-brand-500 to-brand-600 flex items-center justify-center"
                style={{ width: `${detection.chinese_ratio * 100}%` }}
              />
              <div
                className="h-full bg-gradient-to-r from-blue-400 to-blue-500 flex items-center justify-center"
                style={{ width: `${detection.english_ratio * 100}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs mt-1.5">
              <span className="flex items-center gap-1 text-brand-600">
                <span className="w-2 h-2 rounded-sm bg-brand-500" />
                中文 {(detection.chinese_ratio * 100).toFixed(1)}%
              </span>
              <span className="flex items-center gap-1 text-blue-500">
                <span className="w-2 h-2 rounded-sm bg-blue-500" />
                英文 {(detection.english_ratio * 100).toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 双语对比结果 */}
      {clauses && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Languages className="w-5 h-5 text-brand-600" />
            <h2 className="text-lg font-semibold text-slate-800">双语条款对比结果</h2>
          </div>
          <BilingualDiffView clauses={clauses} />
        </div>
      )}

      {/* 空状态提示 */}
      {!detection && !clauses && !error && !detectLoading && !compareLoading && (
        <div className="bg-white rounded-xl border border-dashed border-slate-200 p-12 text-center">
          <Languages className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-400">
            输入中英文合同文本后点击「检测语言」或「对比分析」，或点击「填充示例」快速体验
          </p>
        </div>
      )}
    </div>
  );
}
