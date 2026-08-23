'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Mail,
  Bell,
  Check,
  Clock,
  Filter,
  Send,
} from 'lucide-react';
import {
  EmailNotification,
  NotificationEventType,
  NOTIFICATION_EVENT_LABELS,
} from '@/lib/types';

// 事件类型标签颜色配置
const EVENT_STYLE: Record<
  NotificationEventType,
  { cls: string; dot: string }
> = {
  review_completed: { cls: 'bg-green-50 text-green-600', dot: 'bg-green-500' },
  high_risk_detected: { cls: 'bg-red-50 text-red-600', dot: 'bg-red-500' },
  approval_required: { cls: 'bg-amber-50 text-amber-600', dot: 'bg-amber-500' },
  approval_completed: { cls: 'bg-blue-50 text-blue-600', dot: 'bg-blue-500' },
  contract_expiring: { cls: 'bg-orange-50 text-orange-600', dot: 'bg-orange-500' },
  comment_received: { cls: 'bg-brand-50 text-brand-600', dot: 'bg-brand-500' },
};

// 相对时间格式化
function formatRelativeTime(dateStr: string): string {
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
  sent: number;
  pending: number;
  byEvent: Record<NotificationEventType, number>;
}

export default function NotificationList() {
  const [notifications, setNotifications] = useState<EmailNotification[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // 筛选：'all' 或具体事件类型
  const [filter, setFilter] = useState<NotificationEventType | 'all'>('all');
  // 创建通知表单
  const [showForm, setShowForm] = useState(false);
  const [formEvent, setFormEvent] = useState<NotificationEventType>('review_completed');
  const [formRecipient, setFormRecipient] = useState('');
  const [formContractTitle, setFormContractTitle] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/notifications', { cache: 'no-store' });
      if (!res.ok) throw new Error('加载通知失败');
      const data = await res.json();
      setNotifications(data.notifications || []);
      setStats(data.stats || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载通知失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // 创建并发送通知
  const handleCreate = async () => {
    if (!formRecipient.trim()) {
      setError('请填写收件人邮箱');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_type: formEvent,
          recipient: formRecipient.trim(),
          contract_title: formContractTitle.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error('发送通知失败');
      const data = await res.json();
      setNotifications((prev) => [data.notification, ...prev]);
      setStats(data.stats || null);
      setFormRecipient('');
      setFormContractTitle('');
      setShowForm(false);
      const sent = data.notification?.sent;
      setToast(
        sent
          ? '通知已发送成功'
          : '通知已创建，发送失败（演示模式模拟）'
      );
      setTimeout(() => setToast(null), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : '发送通知失败');
    } finally {
      setSubmitting(false);
    }
  };

  // 筛选后的列表
  const filtered =
    filter === 'all'
      ? notifications
      : notifications.filter((n) => n.event_type === filter);

  // 统计卡片
  const statCards = [
    {
      label: '通知总数',
      value: stats?.total ?? 0,
      icon: Bell,
      color: 'text-brand-600',
      bg: 'bg-brand-50',
    },
    {
      label: '已发送',
      value: stats?.sent ?? 0,
      icon: Check,
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
    {
      label: '待发送',
      value: stats?.pending ?? 0,
      icon: Clock,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
    {
      label: '事件类型',
      value: stats
        ? Object.values(stats.byEvent).filter((c) => c > 0).length
        : 0,
      icon: Filter,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
  ];

  // 事件类型筛选选项
  const eventTypeOptions: { value: NotificationEventType | 'all'; label: string; count: number }[] = [
    { value: 'all', label: '全部', count: stats?.total ?? 0 },
    ...(Object.keys(NOTIFICATION_EVENT_LABELS) as NotificationEventType[])
      .map((t) => ({
        value: t,
        label: NOTIFICATION_EVENT_LABELS[t],
        count: stats?.byEvent[t] ?? 0,
      }))
      .filter((o) => o.count > 0),
  ];

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm flex items-center gap-2">
          <Mail className="w-4 h-4 shrink-0" />
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

      {/* 顶部统计栏 */}
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

      {/* 按事件类型分布 */}
      {stats && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-4 h-4 text-brand-600" />
            <h3 className="font-semibold text-slate-800">事件类型分布</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {(Object.keys(NOTIFICATION_EVENT_LABELS) as NotificationEventType[]).map(
              (t) => {
                const count = stats.byEvent[t] ?? 0;
                const style = EVENT_STYLE[t];
                const total = stats.total || 1;
                const percent = Math.round((count / total) * 100);
                return (
                  <div
                    key={t}
                    className={`p-3 rounded-lg border ${count > 0 ? 'border-slate-200' : 'border-slate-100 opacity-60'}`}
                  >
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className={`w-2 h-2 rounded-full ${style.dot}`} />
                      <span className="text-xs text-slate-500 truncate">
                        {NOTIFICATION_EVENT_LABELS[t]}
                      </span>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-lg font-bold text-slate-800">
                        {count}
                      </span>
                      <span className="text-xs text-slate-400">
                        / {percent}%
                      </span>
                    </div>
                  </div>
                );
              }
            )}
          </div>
        </div>
      )}

      {/* 筛选 + 新建 */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
          <h2 className="font-semibold text-slate-800 flex items-center gap-2">
            <Mail className="w-4 h-4 text-brand-600" />
            通知列表
          </h2>
          <button
            onClick={() => setShowForm(!showForm)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white gradient-bg hover:shadow-lg transition-all"
          >
            <Send className="w-4 h-4" />
            {showForm ? '收起表单' : '新建通知'}
          </button>
        </div>

        {/* 新建通知表单 */}
        {showForm && (
          <div className="mb-4 p-4 rounded-lg bg-slate-50 border border-slate-100">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">
                  事件类型
                </label>
                <select
                  value={formEvent}
                  onChange={(e) => setFormEvent(e.target.value as NotificationEventType)}
                  className="w-full text-sm p-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                >
                  {(Object.keys(NOTIFICATION_EVENT_LABELS) as NotificationEventType[]).map(
                    (t) => (
                      <option key={t} value={t}>
                        {NOTIFICATION_EVENT_LABELS[t]}
                      </option>
                    )
                  )}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">
                  收件人邮箱
                </label>
                <input
                  type="email"
                  value={formRecipient}
                  onChange={(e) => setFormRecipient(e.target.value)}
                  placeholder="zhang.lawyer@example.com"
                  className="w-full text-sm p-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">
                  合同名称（可选）
                </label>
                <input
                  type="text"
                  value={formContractTitle}
                  onChange={(e) => setFormContractTitle(e.target.value)}
                  placeholder="XX产品采购合同"
                  className="w-full text-sm p-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                />
              </div>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowForm(false);
                  setFormRecipient('');
                  setFormContractTitle('');
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-500 bg-white hover:bg-slate-100 border border-slate-200 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleCreate}
                disabled={submitting || !formRecipient.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium text-white gradient-bg hover:shadow transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-3.5 h-3.5" />
                {submitting ? '发送中...' : '创建并发送'}
              </button>
            </div>
          </div>
        )}

        {/* 筛选标签 */}
        <div className="flex items-center gap-2 flex-wrap mb-4">
          <span className="text-xs text-slate-400 flex items-center gap-1">
            <Filter className="w-3 h-3" />筛选：
          </span>
          {eventTypeOptions.map((opt) => {
            const isActive = filter === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => setFilter(opt.value)}
                className={`text-xs px-2.5 py-1 rounded-full transition-colors ${
                  isActive
                    ? 'text-white gradient-bg'
                    : 'text-slate-500 bg-slate-100 hover:bg-slate-200'
                }`}
              >
                {opt.label}
                <span className="ml-1 opacity-70">({opt.count})</span>
              </button>
            );
          })}
        </div>

        {/* 通知列表 */}
        {loading ? (
          <div className="py-12 text-center text-sm text-slate-400">
            加载通知中...
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center">
            <Mail className="w-10 h-10 text-slate-200 mx-auto mb-2" />
            <p className="text-sm text-slate-400">
              {filter === 'all' ? '暂无通知' : '该类型下暂无通知'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((n) => (
              <NotificationItem key={n.id} notification={n} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ===== 单条通知 =====
function NotificationItem({ notification: n }: { notification: EmailNotification }) {
  const style = EVENT_STYLE[n.event_type];
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border border-slate-100 hover:border-slate-200 hover:bg-slate-50/50 transition-colors">
      {/* 事件类型图标 */}
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${style.cls}`}>
        <Mail className="w-4 h-4" />
      </div>

      <div className="flex-1 min-w-0">
        {/* 顶部行：事件类型 + 状态 + 时间 */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs px-1.5 py-0.5 rounded ${style.cls}`}>
            {NOTIFICATION_EVENT_LABELS[n.event_type]}
          </span>
          {n.sent ? (
            <span className="inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded bg-green-50 text-green-600">
              <Check className="w-3 h-3" />已发送
            </span>
          ) : (
            <span className="inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded bg-amber-50 text-amber-600">
              <Clock className="w-3 h-3" />待发送
            </span>
          )}
          <span className="text-xs text-slate-400 ml-auto">
            {formatRelativeTime(n.created_at)}
          </span>
        </div>

        {/* 主题 */}
        <div className="text-sm font-medium text-slate-800 mt-1.5 truncate">
          {n.subject}
        </div>

        {/* 收件人 + 合同 */}
        <div className="flex items-center gap-2 mt-1 text-xs text-slate-400 flex-wrap">
          <span className="flex items-center gap-1">
            <Mail className="w-3 h-3" />
            {n.recipient_name} ({n.recipient})
          </span>
          {n.contract_title && (
            <>
              <span className="text-slate-300">·</span>
              <span className="truncate">{n.contract_title}</span>
            </>
          )}
        </div>

        {/* 正文 */}
        <p className="text-xs text-slate-500 mt-1.5 line-clamp-2 leading-relaxed">
          {n.body}
        </p>

        {/* 发送时间 */}
        {n.sent && n.sent_at && (
          <div className="text-xs text-slate-300 mt-1">
            发送于 {formatRelativeTime(n.sent_at)}
          </div>
        )}
      </div>
    </div>
  );
}
