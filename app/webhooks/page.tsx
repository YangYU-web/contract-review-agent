// ===== Webhook 集成页面 =====
// 服务端组件：标题区 + Webhook 管理面板 + 底部说明区域

import { Webhook, Settings, Info, Shield, Key, Activity } from 'lucide-react';
import WebhookManager from '@/components/WebhookManager';
import { getStoredWebhooks, getWebhookStats } from '@/lib/webhooks';

export const dynamic = 'force-dynamic';

export default async function WebhooksPage() {
  // 服务端预取用于展示概要信息
  const webhooks = getStoredWebhooks();
  const stats = getWebhookStats(webhooks);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* 页头 */}
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Webhook className="w-6 h-6 text-brand-600" />
            Webhook 集成
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            管理外部系统事件订阅，自动推送合同审查关键节点到第三方应用
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-slate-200">
            <Settings className="w-4 h-4 text-brand-600" />
            <span className="text-xs text-slate-500">演示模式</span>
            <span className="text-xs text-slate-300">·</span>
            <span className="text-xs text-slate-400">
              {stats.total} 个 Webhook / 成功率 {stats.successRate}%
            </span>
          </div>
          {stats.failing > 0 ? (
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-50 border border-red-100">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-xs font-medium text-red-600">
                {stats.failing} 个 Webhook 异常
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-green-50 border border-green-100">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-xs font-medium text-green-600">运行正常</span>
            </div>
          )}
        </div>
      </div>

      {/* Webhook 管理面板 */}
      <WebhookManager />

      {/* 底部说明区域 */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 工作原理 */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center">
              <Info className="w-4 h-4 text-brand-600" />
            </div>
            <h2 className="font-semibold text-slate-800">Webhook 工作原理</h2>
          </div>
          <ol className="space-y-2 text-xs text-slate-500 leading-relaxed">
            <li className="flex gap-2">
              <span className="w-5 h-5 shrink-0 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center font-medium">
                1
              </span>
              <span>在第三方系统配置一个可接收 POST 请求的回调 URL</span>
            </li>
            <li className="flex gap-2">
              <span className="w-5 h-5 shrink-0 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center font-medium">
                2
              </span>
              <span>在本平台创建 Webhook 并订阅关心的事件类型</span>
            </li>
            <li className="flex gap-2">
              <span className="w-5 h-5 shrink-0 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center font-medium">
                3
              </span>
              <span>当对应事件发生时，平台主动向回调 URL 推送事件数据</span>
            </li>
            <li className="flex gap-2">
              <span className="w-5 h-5 shrink-0 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center font-medium">
                4
              </span>
              <span>第三方系统根据响应状态码返回处理结果</span>
            </li>
          </ol>
        </div>

        {/* 签名验证 */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center">
              <Shield className="w-4 h-4 text-brand-600" />
            </div>
            <h2 className="font-semibold text-slate-800">签名验证说明</h2>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            每次投递会在请求头中携带基于密钥生成的签名，格式为
            <code className="mx-1 px-1 py-0.5 rounded bg-slate-100 text-brand-700">
              sha256=&lt;base64&gt;
            </code>
            。接收方应使用相同密钥对请求体重新计算签名并比对，以确认请求来自本平台且未被篡改。
          </p>
          <div className="mt-3 p-2.5 rounded-lg bg-slate-50 border border-slate-100">
            <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
              <Key className="w-3 h-3" />
              签名计算
            </div>
            <pre className="text-xs text-slate-500 overflow-x-auto whitespace-pre-wrap break-all">
{`signature =
  "sha256=" +
  base64(hash(secret + ":" + payload))`}
            </pre>
          </div>
        </div>

        {/* 重试与监控 */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center">
              <Activity className="w-4 h-4 text-brand-600" />
            </div>
            <h2 className="font-semibold text-slate-800">投递与监控</h2>
          </div>
          <ul className="space-y-2 text-xs text-slate-500 leading-relaxed">
            <li className="flex gap-2">
              <span className="text-brand-500">·</span>
              <span>响应状态 2xx 视为成功，408 / 5xx 视为失败</span>
            </li>
            <li className="flex gap-2">
              <span className="text-brand-500">·</span>
              <span>累计失败较多时 Webhook 自动标记为「失败」状态</span>
            </li>
            <li className="flex gap-2">
              <span className="text-brand-500">·</span>
              <span>支持对单个 Webhook 发送测试事件，验证连通性</span>
            </li>
            <li className="flex gap-2">
              <span className="text-brand-500">·</span>
              <span>投递日志保留最近记录，可用于排查与审计</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
