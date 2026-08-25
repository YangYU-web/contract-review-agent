// ===== 邮件通知中心页面 =====
// 服务端组件：标题区 + 嵌入 NotificationList 客户端组件

export const runtime = 'edge';

import { Bell, Mail } from 'lucide-react';
import NotificationList from '@/components/NotificationList';
import { getMockNotifications, getNotificationStats } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

export default async function NotificationsPage() {
  // 服务端预取用于展示概要信息
  const notifications = getMockNotifications();
  const stats = getNotificationStats(notifications);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* 页头 */}
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bell className="w-6 h-6 text-brand-600" />
            邮件通知中心
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            集中管理合同审查全流程的邮件通知，支持按事件类型筛选与手动发送
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-slate-200">
            <Mail className="w-4 h-4 text-brand-600" />
            <span className="text-xs text-slate-500">演示模式</span>
            <span className="text-xs text-slate-300">·</span>
            <span className="text-xs text-slate-400">
              共 {stats.total} 条通知
            </span>
          </div>
          {stats.pending > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-50 border border-amber-100">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <span className="text-xs font-medium text-amber-600">
                {stats.pending} 条待发送
              </span>
            </div>
          )}
          {stats.pending === 0 && stats.total > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-green-50 border border-green-100">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-xs font-medium text-green-600">
                全部已发送
              </span>
            </div>
          )}
        </div>
      </div>

      <NotificationList />
    </div>
  );
}
