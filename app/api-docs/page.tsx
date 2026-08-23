'use client';

import { useState } from 'react';
import {
  Code,
  Terminal,
  Copy,
  ChevronRight,
  BookOpen,
  Webhook,
  Key,
  Check,
} from 'lucide-react';
import { getApiEndpoints, getApiCategories } from '@/lib/api-docs';
import { ApiEndpointDoc } from '@/lib/types';

const BASE_URL = 'http://localhost:3000';

// HTTP 方法对应的颜色样式
const METHOD_STYLES: Record<string, string> = {
  GET: 'bg-blue-100 text-blue-700 border-blue-200',
  POST: 'bg-green-100 text-green-700 border-green-200',
  PUT: 'bg-orange-100 text-orange-700 border-orange-200',
  DELETE: 'bg-red-100 text-red-700 border-red-200',
};

export default function ApiDocsPage() {
  const categories = getApiCategories();
  const allEndpoints = getApiEndpoints();

  // 默认选中第一个端点
  const [selected, setSelected] = useState<ApiEndpointDoc>(allEndpoints[0]);
  const [copied, setCopied] = useState<string | null>(null);

  // 复制文本到剪贴板
  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  // 生成选中端点的 key
  const endpointKey = (ep: ApiEndpointDoc) => `${ep.method}-${ep.path}`;

  // 当前端点的完整 curl 示例
  const curlExample = `curl -X ${selected.method} ${BASE_URL}${selected.path}`;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* 页头 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Code className="w-6 h-6 text-brand-600" />
          开放 API 文档
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          企业合同智能审查 Agent 全部 API 端点的详细文档，参考 Swagger / Postman 风格编排。
        </p>
      </div>

      {/* 顶部信息栏：基础 URL 与认证说明 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center shrink-0">
            <Webhook className="w-5 h-5 text-brand-600" />
          </div>
          <div className="min-w-0">
            <div className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">
              API 基础地址
            </div>
            <code className="text-sm font-mono text-slate-800 break-all">
              {BASE_URL}
            </code>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
            <Key className="w-5 h-5 text-amber-600" />
          </div>
          <div className="min-w-0">
            <div className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">
              认证方式
            </div>
            <p className="text-sm text-slate-600">
              当前为本地演示，无需认证。生产环境建议通过 API Key 或 Bearer Token 鉴权。
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* 左侧侧边栏：按分类分组的端点列表 */}
        <aside className="lg:col-span-1">
          <div className="bg-white rounded-xl border border-slate-200 p-4 sticky top-20">
            <div className="flex items-center gap-2 mb-3 px-1">
              <BookOpen className="w-4 h-4 text-brand-600" />
              <h2 className="font-semibold text-slate-800 text-sm">端点列表</h2>
            </div>
            <nav className="space-y-4 max-h-[calc(100vh-220px)] overflow-y-auto pr-1">
              {categories.map((cat) => (
                <div key={cat.name}>
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide px-2 mb-1.5">
                    {cat.name}
                  </div>
                  <div className="space-y-0.5">
                    {cat.endpoints.map((ep) => {
                      const key = endpointKey(ep);
                      const isActive =
                        selected.method === ep.method && selected.path === ep.path;
                      return (
                        <button
                          key={key}
                          onClick={() => setSelected(ep)}
                          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-colors ${
                            isActive
                              ? 'bg-brand-50 text-brand-700'
                              : 'text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${
                              METHOD_STYLES[ep.method] ||
                              'bg-slate-100 text-slate-600 border-slate-200'
                            }`}
                          >
                            {ep.method}
                          </span>
                          <span className="text-xs font-mono truncate flex-1">
                            {ep.path}
                          </span>
                          {isActive && (
                            <ChevronRight className="w-3.5 h-3.5 text-brand-500 shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>
          </div>
        </aside>

        {/* 右侧主区域：端点详细文档 */}
        <main className="lg:col-span-3 space-y-6">
          {/* 端点标题与描述 */}
          <section className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex flex-wrap items-center gap-3 mb-3">
              <span
                className={`text-sm font-bold px-2.5 py-1 rounded-md border ${
                  METHOD_STYLES[selected.method] ||
                  'bg-slate-100 text-slate-600 border-slate-200'
                }`}
              >
                {selected.method}
              </span>
              <code className="text-base font-mono text-slate-800 break-all">
                {selected.path}
              </code>
            </div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">
              {selected.summary}
            </h2>
            <p className="text-sm text-slate-500 leading-relaxed">
              {selected.description}
            </p>
          </section>

          {/* 请求参数表格 */}
          <section className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
              <Terminal className="w-4 h-4 text-brand-600" />
              请求参数
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs text-slate-400 uppercase tracking-wide">
                    <th className="py-2 pr-4 font-medium">名称</th>
                    <th className="py-2 pr-4 font-medium">类型</th>
                    <th className="py-2 pr-4 font-medium">必填</th>
                    <th className="py-2 font-medium">描述</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.request_params.map((param) => (
                    <tr
                      key={param.name}
                      className="border-b border-slate-100 last:border-0"
                    >
                      <td className="py-2.5 pr-4">
                        <code className="text-xs font-mono text-brand-600 font-medium">
                          {param.name}
                        </code>
                      </td>
                      <td className="py-2.5 pr-4">
                        <span className="text-xs text-slate-500">
                          {param.type}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4">
                        {param.required ? (
                          <span className="text-xs font-medium text-red-600">
                            是
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">否</span>
                        )}
                      </td>
                      <td className="py-2.5 text-xs text-slate-600">
                        {param.description}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* 响应字段表格 */}
          <section className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
              <Code className="w-4 h-4 text-brand-600" />
              响应字段
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs text-slate-400 uppercase tracking-wide">
                    <th className="py-2 pr-4 font-medium">字段</th>
                    <th className="py-2 pr-4 font-medium">类型</th>
                    <th className="py-2 font-medium">描述</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.response_fields.map((field) => (
                    <tr
                      key={field.name}
                      className="border-b border-slate-100 last:border-0"
                    >
                      <td className="py-2.5 pr-4">
                        <code className="text-xs font-mono text-brand-600 font-medium">
                          {field.name}
                        </code>
                      </td>
                      <td className="py-2.5 pr-4">
                        <span className="text-xs text-slate-500">
                          {field.type}
                        </span>
                      </td>
                      <td className="py-2.5 text-xs text-slate-600">
                        {field.description}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* curl 命令示例 */}
          <section className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
              <Terminal className="w-4 h-4 text-brand-600" />
              cURL 命令
            </h3>
            <div className="relative">
              <pre className="bg-slate-900 rounded-lg p-4 overflow-x-auto">
                <code className="text-xs font-mono text-slate-100 whitespace-pre-wrap break-all">
                  {curlExample}
                </code>
              </pre>
              <button
                onClick={() => handleCopy(curlExample, 'curl-base')}
                className="absolute top-2.5 right-2.5 p-1.5 rounded-md bg-slate-700 hover:bg-slate-600 transition-colors"
                title="复制"
              >
                {copied === 'curl-base' ? (
                  <Check className="w-3.5 h-3.5 text-green-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-slate-300" />
                )}
              </button>
            </div>
          </section>

          {/* 请求示例 */}
          {selected.example_request && (
            <section className="bg-white rounded-xl border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                <Terminal className="w-4 h-4 text-brand-600" />
                请求示例
              </h3>
              <div className="relative">
                <pre className="bg-slate-900 rounded-lg p-4 overflow-x-auto">
                  <code className="text-xs font-mono text-slate-100 whitespace-pre-wrap break-all">
                    {selected.example_request}
                  </code>
                </pre>
                <button
                  onClick={() =>
                    handleCopy(selected.example_request!, 'request')
                  }
                  className="absolute top-2.5 right-2.5 p-1.5 rounded-md bg-slate-700 hover:bg-slate-600 transition-colors"
                  title="复制"
                >
                  {copied === 'request' ? (
                    <Check className="w-3.5 h-3.5 text-green-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-slate-300" />
                  )}
                </button>
              </div>
            </section>
          )}

          {/* 响应示例 */}
          {selected.example_response && (
            <section className="bg-white rounded-xl border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                <Code className="w-4 h-4 text-brand-600" />
                响应示例
              </h3>
              <div className="relative">
                <pre className="bg-slate-900 rounded-lg p-4 overflow-x-auto">
                  <code className="text-xs font-mono text-slate-100 whitespace-pre-wrap break-all">
                    {selected.example_response}
                  </code>
                </pre>
                <button
                  onClick={() =>
                    handleCopy(selected.example_response!, 'response')
                  }
                  className="absolute top-2.5 right-2.5 p-1.5 rounded-md bg-slate-700 hover:bg-slate-600 transition-colors"
                  title="复制"
                >
                  {copied === 'response' ? (
                    <Check className="w-3.5 h-3.5 text-green-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-slate-300" />
                  )}
                </button>
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
