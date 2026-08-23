'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Webhook,
  Plus,
  Trash2,
  Send,
  Check,
  X,
  Activity,
  Clock,
  AlertTriangle,
  Copy,
} from 'lucide-react';
import {
  WebhookConfig,
  WebhookDeliveryLog,
  WebhookEvent,
  WEBHOOK_EVENT_LABELS,
} from '@/lib/types';

// Webhook 状态样式
const STATUS_STYLE: Record<
  WebhookConfig['status'],
  { cls: string; dot: string; label: string }
> = {
  active: { cls: 'bg-green-50 text-green-600', dot: 'bg-green-500', label: '活跃' },
  inactive: { cls: 'bg-slate-100 text-slate-500', dot: 'bg-slate-400', label: '停用' },
  failing: { cls: 'bg-red-50 text-red-600', dot: 'bg-red-500', label: '失败' },
};

// 响应状态颜色
function responseStyle(status: number): string {
  if (status >= 200 && status < 300) return 'text-green-600 bg-green-50';
  if (status === 408) return 'text-amber-600 bg-amber-50';
  return 'text-red-600 bg-red-50';
}

// 相对时间格式化
function formatRelativeTime(dateStr?: string): string {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  const now = Date.now();
  const diff = now - date.getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute) return '刚刚';
  if (diff < hour) return `${Math.floor(diff / minute)} 分钟前`;
  if (diff < day) return `${Math.floor(diff / hour)} 小时前`;
  if (diff < day * 7) return `${Math.floor(diff / day)} 天前`;
  return date.toLocaleDateString('zh-CN');
}

interface Stats {
  total: number;
  active: number;
  failing: number;
  totalDeliveries: number;
  successRate: number;
}

const ALL_EVENTS = Object.keys(WEBHOOK_EVENT_LABELS) as WebhookEvent[];

export default function WebhookManager() {
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
  const [deliveryLogs, setDeliveryLogs] = useState<WebhookDeliveryLog[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // 创建表单
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formEvents, setFormEvents] = useState<WebhookEvent[]>(['review.completed']);
  const [formSecret, setFormSecret] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/webhooks?logs_limit=10', { cache: 'no-store' });
      if (!res.ok) throw new Error('加载 Webhook 数据失败');
      const data = await res.json();
      setWebhooks(data.webhooks || []);
      setDeliveryLogs(data.deliveryLogs || []);
      setStats(data.stats || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载 Webhook 数据失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  // 创建 webhook
  const handleCreate = async () => {
    if (!formName.trim() || !formUrl.trim() || formEvents.length === 0) {
      setError('请填写名称、URL 并至少订阅一个事件');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          name: formName.trim(),
          url: formUrl.trim(),
          events: formEvents,
          secret: formSecret.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || '创建失败');
      }
      setShowForm(false);
      setFormName('');
      setFormUrl('');
      setFormEvents(['review.completed']);
      setFormSecret('');
      showToast('Webhook 创建成功');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  // 删除 webhook
  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`确定删除 Webhook「${name}」吗？`)) return;
    try {
      const res = await fetch('/api/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', id }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || '删除失败');
      }
      showToast('已删除 Webhook');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败');
    }
  };

  // 测试 webhook（发送测试事件，自动使用该 webhook 订阅的第一个事件）
  const handleTest = async (wh: WebhookConfig) => {
    const id = wh.id;
    const testEvent = wh.events[0];
    setTestingId(id);
    setError(null);
    try {
      const res = await fetch('/api/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'test',
          webhook_id: id,
          event: testEvent,
          payload: {
            test: true,
            message: '来自 Webhook 管理面板的测试事件',
            timestamp: new Date().toISOString(),
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '测试失败');
      }
      const deliveries = data.deliveries || [];
      if (deliveries.length === 0) {
        showToast('该 Webhook 未订阅此事件，未触发');
      } else {
        const ok = deliveries[0].success;
        showToast(
          ok
            ? `测试成功（${deliveries[0].response_status}）`
            : `测试失败（${deliveries[0].response_status}）`
        );
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '测试失败');
    } finally {
      setTestingId(null);
    }
  };

  // 切换事件订阅（创建表单）
  const toggleFormEvent = (ev: WebhookEvent) => {
    setFormEvents((prev) =>
      prev.includes(ev) ? prev.filter((e) => e !== ev) : [...prev, ev]
    );
  };

  // 复制密钥
  const handleCopySecret = async (id: string, secret: string) => {
    try {
      await navigator.clipboard.writeText(secret);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      setError('复制失败，请手动复制');
    }
  };

  // 统计卡片
  const statCards = useMemo(
    () => [
      {
        label: 'Webhook 总数',
        value: stats?.total ?? 0,
        icon: Webhook,
        color: 'text-brand-600',
        bg: 'bg-brand-50',
      },
      {
        label: '活跃',
        value: stats?.active ?? 0,
        icon: Check,
        color: 'text-green-600',
        bg: 'bg-green-50',
      },
      {
        label: '失败',
        value: stats?.failing ?? 0,
        icon: AlertTriangle,
        color: stats?.failing ? 'text-red-600' : 'text-slate-400',
        bg: stats?.failing ? 'bg-red-50' : 'bg-slate-50',
      },
      {
        label: '投递成功率',
        value: `${stats?.successRate ?? 100}%`,
        icon: Activity,
        color: (stats?.successRate ?? 100) >= 90 ? 'text-green-600' : 'text-amber-600',
        bg: 'bg-blue-50',
      },
    ],
    [stats]
  );

  return (
    <div className="space-y-5">
      {error && (
        <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-red-400 hover:text-red-600"
          >
            ×
          </button>
        </div>
      )}

      {toast && (
        <div className="p-3 rounded-lg bg-green-50 text-green-600 text-sm flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      {/* 顶部统计 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="bg-white rounded-xl border border-slate-200 p-4"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-lg ${card.bg} flex items-center justify-center`}
                >
                  <Icon className={`w-5 h-5 ${card.color}`} />
                </div>
                <div>
                  <div className="text-2xl font-bold text-slate-800">
                    {card.value}
                  </div>
                  <div className="text-xs text-slate-400">{card.label}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Webhook 列表 */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
          <h2 className="font-semibold text-slate-800 flex items-center gap-2">
            <Webhook className="w-4 h-4 text-brand-600" />
            Webhook 列表
          </h2>
          <button
            onClick={() => setShowForm(!showForm)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white gradient-bg hover:shadow-lg transition-all"
          >
            <Plus className="w-4 h-4" />
            {showForm ? '收起表单' : '新建 Webhook'}
          </button>
        </div>

        {/* 创建表单 */}
        {showForm && (
          <div className="mb-4 p-4 rounded-lg bg-slate-50 border border-slate-100">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">名称</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="如：ERP系统集成"
                  className="w-full text-sm p-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">回调 URL</label>
                <input
                  type="url"
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                  placeholder="https://example.com/webhooks/contract"
                  className="w-full text-sm p-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                />
              </div>
            </div>
            <div className="mt-3">
              <label className="block text-xs text-slate-500 mb-1.5">
                订阅事件（多选）
              </label>
              <div className="flex flex-wrap gap-2">
                {ALL_EVENTS.map((ev) => {
                  const active = formEvents.includes(ev);
                  return (
                    <button
                      key={ev}
                      type="button"
                      onClick={() => toggleFormEvent(ev)}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                        active
                          ? 'text-white gradient-bg border-transparent'
                          : 'text-slate-500 bg-white border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {WEBHOOK_EVENT_LABELS[ev]}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="mt-3">
              <label className="block text-xs text-slate-500 mb-1">
                密钥（用于签名校验，可选）
              </label>
              <input
                type="text"
                value={formSecret}
                onChange={(e) => setFormSecret(e.target.value)}
                placeholder="whsec_xxxxxxxx"
                className="w-full text-sm p-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
              />
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowForm(false);
                  setFormName('');
                  setFormUrl('');
                  setFormEvents(['review.completed']);
                  setFormSecret('');
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-500 bg-white hover:bg-slate-100 border border-slate-200 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleCreate}
                disabled={submitting}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium text-white gradient-bg hover:shadow transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-3.5 h-3.5" />
                {submitting ? '创建中...' : '创建'}
              </button>
            </div>
          </div>
        )}

        {/* Webhook 表格 */}
        {loading ? (
          <div className="py-12 text-center text-sm text-slate-400">
            加载 Webhook 列表中...
          </div>
        ) : webhooks.length === 0 ? (
          <div className="py-12 text-center">
            <Webhook className="w-10 h-10 text-slate-200 mx-auto mb-2" />
            <p className="text-sm text-slate-400">暂无 Webhook 配置</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-400 border-b border-slate-100">
                  <th className="text-left font-medium py-2 px-2">名称 / URL</th>
                  <th className="text-left font-medium py-2 px-2">订阅事件</th>
                  <th className="text-left font-medium py-2 px-2">状态</th>
                  <th className="text-left font-medium py-2 px-2">成功 / 失败</th>
                  <th className="text-left font-medium py-2 px-2">最后触发</th>
                  <th className="text-right font-medium py-2 px-2">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {webhooks.map((wh) => {
                  const st = STATUS_STYLE[wh.status];
                  return (
                    <tr key={wh.id} className="hover:bg-slate-50/50">
                      <td className="py-3 px-2 align-top">
                        <div className="font-medium text-slate-800">{wh.name}</div>
                        <div className="text-xs text-slate-400 truncate max-w-[220px]">
                          {wh.url}
                        </div>
                        {wh.secret && (
                          <button
                            onClick={() => handleCopySecret(wh.id, wh.secret)}
                            className="mt-1 inline-flex items-center gap-1 text-xs text-slate-400 hover:text-brand-600"
                          >
                            <Copy className="w-3 h-3" />
                            {copiedId === wh.id ? '已复制密钥' : '复制密钥'}
                          </button>
                        )}
                      </td>
                      <td className="py-3 px-2 align-top">
                        <div className="flex flex-wrap gap-1">
                          {wh.events.map((ev) => (
                            <span
                              key={ev}
                              className="text-xs px-1.5 py-0.5 rounded bg-brand-50 text-brand-600"
                            >
                              {WEBHOOK_EVENT_LABELS[ev]}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-2 align-top">
                        <span
                          className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded ${st.cls}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                          {st.label}
                        </span>
                      </td>
                      <td className="py-3 px-2 align-top text-xs">
                        <span className="text-green-600 font-medium">
                          {wh.success_count}
                        </span>
                        <span className="text-slate-300 mx-1">/</span>
                        <span className="text-red-600 font-medium">
                          {wh.failure_count}
                        </span>
                        {wh.last_response_status !== undefined && (
                          <div className="text-xs text-slate-400 mt-0.5">
                            HTTP {wh.last_response_status}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-2 align-top text-xs text-slate-400">
                        <Clock className="w-3 h-3 inline mr-1" />
                        {formatRelativeTime(wh.last_triggered)}
                      </td>
                      <td className="py-3 px-2 align-top text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => handleTest(wh)}
                            disabled={testingId === wh.id}
                            title="发送测试事件"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-brand-600 hover:bg-brand-50 transition-colors disabled:opacity-50"
                          >
                            <Send className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(wh.id, wh.name)}
                            title="删除"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 投递日志 */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-4 h-4 text-brand-600" />
          <h2 className="font-semibold text-slate-800">最近投递日志</h2>
          <span className="text-xs text-slate-400 ml-auto">
            最近 {deliveryLogs.length} 条
          </span>
        </div>

        {deliveryLogs.length === 0 ? (
          <div className="py-12 text-center">
            <Activity className="w-10 h-10 text-slate-200 mx-auto mb-2" />
            <p className="text-sm text-slate-400">暂无投递记录</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {deliveryLogs.map((log) => (
              <div
                key={log.id}
                className="flex items-start gap-3 p-3 rounded-lg border border-slate-100 hover:border-slate-200 hover:bg-slate-50/50 transition-colors"
              >
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    log.success ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
                  }`}
                >
                  {log.success ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <X className="w-4 h-4" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-slate-800">
                      {log.webhook_name}
                    </span>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-brand-50 text-brand-600">
                      {WEBHOOK_EVENT_LABELS[log.event]}
                    </span>
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded ${responseStyle(
                        log.response_status
                      )}`}
                    >
                      HTTP {log.response_status}
                    </span>
                    <span className="text-xs text-slate-400 ml-auto flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatRelativeTime(log.timestamp)}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-slate-400">
                    耗时 {log.duration_ms}ms
                  </div>
                  <pre className="mt-1.5 p-2 rounded bg-slate-50 border border-slate-100 text-xs text-slate-500 overflow-x-auto whitespace-pre-wrap break-all">
                    {log.response_body}
                  </pre>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
