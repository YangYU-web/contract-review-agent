'use client';

// ===== 智能合同摘要页面 =====
// 客户端组件：合同文本输入区 + 生成摘要按钮 + 摘要展示组件
// 支持粘贴合同文本一键生成摘要，并提供示例合同一键填充

import { useState } from 'react';
import {
  Sparkles,
  FileText,
  Wand2,
  Loader2,
  XCircle,
  Eraser,
} from 'lucide-react';
import ContractSummaryView from '@/components/ContractSummaryView';
import { ContractSummary } from '@/lib/types';

// 示例合同文本（采购合同，覆盖主体、金额、日期、关键条款）
const SAMPLE_CONTRACT = `产品采购合同

甲方：北京智诚科技有限公司，法定代表人：王建国，注册地址：北京市海淀区中关村南大街28号，联系电话：010-88886666
乙方：深圳科创电子有限公司，法定代表人：李明华，注册地址：深圳市南山区科技园南区8栋，联系电话：0755-26668888

鉴于甲方拟向乙方采购电子元器件，经双方友好协商，根据《中华人民共和国民法典》及相关法律法规，达成如下协议：

第一条 合同标的
甲方向乙方采购型号为SC-2024的电子元器件共计10000件，用于甲方产品的生产制造。

第二条 合同金额
本合同总金额为￥1,200,000元（人民币壹佰贰拾万元整），含税。

第三条 付款方式
1. 合同签署后7个工作日内，甲方支付合同总金额30%的预付款，即￥360,000元；
2. 乙方交付全部标的并经甲方验收合格后15个工作日内，甲方支付剩余70%尾款，即￥840,000元。
付款日期为2024年7月15日前，全部款项应于该日前付清。

第四条 交付方式
乙方应于2024年6月30日前将全部标的交付至甲方指定地点：北京市海淀区中关村南大街28号仓库。运输费用由乙方承担。

第五条 验收标准
甲方在收到货物后5个工作日内进行验收。验收合格的，签署验收合格书；不合格的，乙方应在10个工作日内更换或修复。

第六条 质量保证
乙方保证所供产品符合国家标准及甲方技术要求，质保期为验收合格后12个月。

第七条 知识产权
本合同项下产品的知识产权归乙方所有，甲方仅在合同范围内使用。合同履行过程中新开发成果的权属归双方共有。

第八条 违约责任
任何一方违约应向守约方支付合同总额10%的违约金，即￥120,000元，并赔偿由此造成的损失。

第九条 保密义务
双方对合作过程中获知的商业秘密负有保密义务，保密期限为合同终止后5年。

第十条 不可抗力
因不可抗力导致不能履行合同的，根据不可抗力的影响程度部分或全部免除责任。

第十一条 合同终止
经双方协商一致可解除合同。一方严重违约的，守约方有权书面通知解除合同。

第十二条 争议解决
本合同履行过程中发生争议的，双方应友好协商解决；协商不成的，向甲方所在地有管辖权的人民法院提起诉讼。

第十三条 合同期限
本合同自2024年4月1日生效，至2025年4月1日届满。本合同于2024年3月15日签订。`;

export default function SummaryPage() {
  const [text, setText] = useState('');
  const [summary, setSummary] = useState<ContractSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 生成摘要
  async function handleGenerate() {
    const trimmed = text.trim();
    if (!trimmed) {
      setError('请输入或粘贴合同文本');
      return;
    }
    setLoading(true);
    setError(null);
    setSummary(null);
    try {
      const res = await fetch('/api/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contract_id: `sum-${Date.now()}`,
          text: trimmed,
          title: '智能摘要合同',
          type: '合同',
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || '生成摘要失败');
      }
      const data = await res.json();
      setSummary(data.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成摘要失败');
    } finally {
      setLoading(false);
    }
  }

  // 加载示例合同
  function handleLoadSample() {
    setText(SAMPLE_CONTRACT);
    setError(null);
    setSummary(null);
  }

  // 清空
  function handleClear() {
    setText('');
    setSummary(null);
    setError(null);
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* 页头 */}
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl gradient-bg flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              智能合同摘要
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              自动提取合同主体、金额、日期与关键条款，生成结构化摘要与风险评估
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-slate-200">
          <FileText className="w-4 h-4 text-brand-600" />
          <span className="text-xs text-slate-500">演示模式</span>
          <span className="text-xs text-slate-300">·</span>
          <span className="text-xs text-slate-400">
            {text.replace(/\s/g, '').length} 字
          </span>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-600 text-sm flex items-center gap-2">
          <XCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-red-400 hover:text-red-600"
          >
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 合同文本输入区 */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 mb-5">
        <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
          <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
            <FileText className="w-4 h-4 text-brand-600" />
            合同文本
            <span className="text-xs text-slate-400 font-normal">
              · 粘贴合同全文以生成摘要
            </span>
          </label>
          <div className="flex items-center gap-2">
            <button
              onClick={handleLoadSample}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-brand-700 bg-brand-50 hover:bg-brand-100 border border-brand-200 transition-colors"
            >
              <Wand2 className="w-3.5 h-3.5" />
              加载示例合同
            </button>
            {text && (
              <button
                onClick={handleClear}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-500 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors"
              >
                <Eraser className="w-3.5 h-3.5" />
                清空
              </button>
            )}
          </div>
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="在此粘贴合同全文，系统将自动识别甲方乙方、合同金额、关键日期与付款方式、交付方式、违约责任等关键条款..."
          rows={10}
          className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-700 bg-slate-50/60 focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400 resize-y leading-relaxed"
        />

        {/* 生成按钮 */}
        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="text-xs text-slate-400">
            {text.trim()
              ? `已输入 ${text.replace(/\s/g, '').length} 字`
              : '请输入合同文本或加载示例'}
          </span>
          <button
            onClick={handleGenerate}
            disabled={loading || !text.trim()}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 border border-brand-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            {loading ? '生成中...' : '生成摘要'}
          </button>
        </div>
      </div>

      {/* 摘要展示 */}
      {loading && !summary && (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <Loader2 className="w-8 h-8 text-brand-500 animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-400">正在分析合同内容并生成摘要...</p>
        </div>
      )}

      {summary && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-brand-600" />
            <h2 className="font-semibold text-slate-800">摘要结果</h2>
          </div>
          <ContractSummaryView summary={summary} />
        </div>
      )}
    </div>
  );
}
