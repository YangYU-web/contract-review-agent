'use client';

// ===== 合规检查页面 =====
// 客户端组件：合同文本输入区 + 执行合规检查按钮 + 合规报告展示
// 支持粘贴合同文本一键执行合规检查，并提供示例合同一键填充

import { useState } from 'react';
import {
  Scale,
  ShieldCheck,
  FileText,
  Loader2,
  XCircle,
  Wand2,
  Eraser,
} from 'lucide-react';
import ComplianceReportView from '@/components/ComplianceReportView';
import { ComplianceReport } from '@/lib/types';

// 示例合同文本（含发票缺失、违约金比例、格式条款等合规检查点）
const SAMPLE_CONTRACT = `软件技术开发与服务合同

甲方：北京云图数据科技有限公司，法定代表人：陈志远，注册地址：北京市朝阳区建国路88号，联系电话：010-56667788
乙方：上海智链软件有限公司，授权代表：刘芳，注册地址：上海市浦东新区张江高科技园区，联系电话：021-68889900

根据《中华人民共和国民法典》及相关法律法规，双方就软件开发与服务事宜协商一致，达成如下协议：

第一条 合同标的
乙方为甲方开发企业数据管理平台一套，并提供为期一年的运维服务。

第二条 合同金额
本合同总金额为人民币￥880,000元（含税）。增值税由乙方承担。

第三条 付款方式
合同签署后10个工作日内，甲方支付40%预付款；系统上线验收后支付剩余60%尾款。

第四条 交付方式
乙方应于2024年9月30日前完成系统交付与部署。

第五条 知识产权
合同履行过程中新开发成果的知识产权归双方共有。

第六条 违约金
任何一方违约应向守约方支付合同总额35%的违约金，并赔偿实际损失。

第七条 格式条款
本合同采用格式条款订立，乙方对免除或限制自身责任的条款已作说明。

第八条 保密义务
双方对合作中获知的商业秘密负有保密义务，期限为合同终止后3年。

第九条 个人信息处理
乙方在数据处理过程中涉及用户个人信息，应取得用户同意并告知处理目的。如需将数据跨境传输至境外服务器，应完成数据出境安全评估。

第十条 争议解决
协商不成的，向甲方所在地有管辖权的人民法院提起诉讼。

第十一条 合同期限
本合同自2024年5月1日生效，至2025年5月1日届满。于2024年4月10日签订。`;

export default function CompliancePage() {
  const [text, setText] = useState('');
  const [report, setReport] = useState<ComplianceReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 执行合规检查
  async function handleCheck() {
    const trimmed = text.trim();
    if (!trimmed) {
      setError('请输入或粘贴合同文本');
      return;
    }
    setLoading(true);
    setError(null);
    setReport(null);
    try {
      const res = await fetch('/api/compliance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contract_id: `comp-${Date.now()}`,
          text: trimmed,
          title: '合规检查合同',
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || '合规检查失败');
      }
      const data = await res.json();
      setReport(data.report);
    } catch (err) {
      setError(err instanceof Error ? err.message : '合规检查失败');
    } finally {
      setLoading(false);
    }
  }

  // 加载示例
  function handleLoadSample() {
    setText(SAMPLE_CONTRACT);
    setError(null);
    setReport(null);
  }

  // 清空
  function handleClear() {
    setText('');
    setReport(null);
    setError(null);
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* 页头 */}
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl gradient-bg flex items-center justify-center">
            <Scale className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">合规检查引擎</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              基于公司法、合同法、劳动法、数据保护、税法与行业规范自动检查合同合规性
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-slate-200">
          <ShieldCheck className="w-4 h-4 text-brand-600" />
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
              · 粘贴合同全文以执行合规检查
            </span>
          </label>
          <div className="flex items-center gap-2">
            <button
              onClick={handleLoadSample}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-brand-700 bg-brand-50 hover:bg-brand-100 border border-brand-200 transition-colors"
            >
              <Wand2 className="w-3.5 h-3.5" />
              加载示例
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
          placeholder="在此粘贴合同全文，系统将依据公司法、合同法、劳动法、数据保护、税法及行业规范等规则进行合规检查..."
          rows={10}
          className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-700 bg-slate-50/60 focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400 resize-y leading-relaxed"
        />

        {/* 检查按钮 */}
        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="text-xs text-slate-400">
            {text.trim()
              ? `已输入 ${text.replace(/\s/g, '').length} 字`
              : '请输入合同文本或加载示例'}
          </span>
          <button
            onClick={handleCheck}
            disabled={loading || !text.trim()}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 border border-brand-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ShieldCheck className="w-4 h-4" />
            )}
            {loading ? '检查中...' : '执行合规检查'}
          </button>
        </div>
      </div>

      {/* 合规报告展示 */}
      {loading && !report && (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <Loader2 className="w-8 h-8 text-brand-500 animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-400">
            正在执行合规检查并生成报告...
          </p>
        </div>
      )}

      {report && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Scale className="w-4 h-4 text-brand-600" />
            <h2 className="font-semibold text-slate-800">合规检查报告</h2>
          </div>
          <ComplianceReportView report={report} />
        </div>
      )}
    </div>
  );
}
