// ===== 团队协作页面 =====
// 服务端组件：展示团队协作概览（最近评论、待处理讨论）并嵌入评论组件

import {
  MessageSquare,
  Clock,
  CheckCircle,
  AlertCircle,
  Users,
  AtSign,
} from 'lucide-react';
import CommentSection from '@/components/CommentSection';
import { getMockComments, DEMO_CONTRACT_TITLES } from '@/lib/comments';

export const dynamic = 'force-dynamic';

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

// 把内容中的 @提及 高亮渲染
function renderContentWithMentions(content: string) {
  const parts = content.split(/(@[\u4e00-\u9fa5A-Za-z0-9_]+)/g);
  return parts.map((part, idx) => {
    if (/^@[\u4e00-\u9fa5A-Za-z0-9_]+$/.test(part)) {
      return (
        <span key={idx} className="text-brand-600 font-medium">
          {part}
        </span>
      );
    }
    return <span key={idx}>{part}</span>;
  });
}

export default async function CollaborationPage() {
  const comments = getMockComments();

  // 顶级评论
  const topLevel = comments.filter((c) => !c.parent_id);
  // 待处理讨论：未解决的顶级评论
  const pending = topLevel.filter((c) => !c.resolved);
  // 已解决
  const resolved = topLevel.filter((c) => c.resolved);
  // 最近评论：按时间倒序
  const recent = [...comments].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  // 涉及的团队成员
  const teamMembers = Array.from(
    new Set(comments.map((c) => `${c.user_name}·${c.user_role}`))
  );

  const stats = [
    {
      label: '总评论数',
      value: comments.length,
      icon: MessageSquare,
      color: 'text-brand-600',
      bg: 'bg-brand-50',
    },
    {
      label: '待处理讨论',
      value: pending.length,
      icon: AlertCircle,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
    {
      label: '已解决',
      value: resolved.length,
      icon: CheckCircle,
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
    {
      label: '参与成员',
      value: teamMembers.length,
      icon: Users,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
  ];

  // 角色颜色
  const roleColor: Record<string, string> = {
    法务专员: 'bg-brand-50 text-brand-600',
    法务经理: 'bg-blue-50 text-blue-600',
    法务总监: 'bg-indigo-50 text-indigo-600',
    业务部门: 'bg-amber-50 text-amber-600',
    总经理: 'bg-purple-50 text-purple-600',
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* 页头 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <MessageSquare className="w-6 h-6 text-brand-600" />
          团队协作
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          集中查看合同审查讨论、待办事项，与团队成员高效协作
        </p>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="bg-white rounded-xl border border-slate-200 p-4"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-lg ${stat.bg} flex items-center justify-center`}
                >
                  <Icon className={`w-5 h-5 ${stat.color}`} />
                </div>
                <div>
                  <div className="text-2xl font-bold text-slate-800">
                    {stat.value}
                  </div>
                  <div className="text-xs text-slate-400">{stat.label}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左侧：评论组件 */}
        <div className="lg:col-span-2">
          <div className="mb-3 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-brand-600" />
            <h2 className="font-semibold text-slate-800">合同讨论</h2>
            <span className="text-xs text-slate-400">
              · {DEMO_CONTRACT_TITLES['mock-001']}
            </span>
          </div>
          <CommentSection contractId="mock-001" />
        </div>

        {/* 右侧：最近评论 & 待处理讨论 */}
        <div className="space-y-6">
          {/* 待处理讨论 */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center gap-2 mb-4">
              <AlertCircle className="w-4 h-4 text-amber-600" />
              <h3 className="font-semibold text-slate-800">待处理讨论</h3>
              <span className="text-xs text-slate-400">({pending.length})</span>
            </div>
            {pending.length === 0 ? (
              <p className="text-sm text-slate-400 py-4 text-center">
                暂无待处理讨论
              </p>
            ) : (
              <div className="space-y-3">
                {pending.map((c) => (
                  <div
                    key={c.id}
                    className="p-3 rounded-lg bg-amber-50/50 border border-amber-100"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-slate-700">
                        {c.user_name}
                      </span>
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded ${
                          roleColor[c.user_role] || 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {c.user_role}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                      {renderContentWithMentions(c.content)}
                    </p>
                    <div className="flex items-center gap-1 mt-1.5 text-xs text-slate-400">
                      <Clock className="w-3 h-3" />
                      {formatRelativeTime(c.created_at)}
                      <span className="mx-1">·</span>
                      <span className="truncate">
                        {DEMO_CONTRACT_TITLES[c.contract_id] || c.contract_id}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 最近评论 */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-4 h-4 text-brand-600" />
              <h3 className="font-semibold text-slate-800">最近评论</h3>
              <span className="text-xs text-slate-400">({recent.length})</span>
            </div>
            <div className="space-y-3">
              {recent.slice(0, 6).map((c) => (
                <div key={c.id} className="flex gap-3">
                  <div className="w-7 h-7 rounded-full gradient-bg flex items-center justify-center text-white text-xs font-medium shrink-0">
                    {c.user_name.slice(-2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-slate-700">
                        {c.user_name}
                      </span>
                      <span className="text-xs text-slate-400">
                        {formatRelativeTime(c.created_at)}
                      </span>
                      {c.resolved && (
                        <span className="inline-flex items-center gap-0.5 text-xs text-green-600">
                          <CheckCircle className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">
                      {renderContentWithMentions(c.content)}
                    </p>
                    {c.mentions.length > 0 && (
                      <div className="flex items-center gap-1 mt-1">
                        <AtSign className="w-3 h-3 text-slate-300" />
                        {c.mentions.map((m) => (
                          <span
                            key={m}
                            className="text-xs text-brand-600"
                          >
                            {m}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 团队成员 */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-4 h-4 text-brand-600" />
              <h3 className="font-semibold text-slate-800">参与成员</h3>
            </div>
            <div className="space-y-2">
              {teamMembers.map((member) => {
                const [name, role] = member.split('·');
                return (
                  <div
                    key={member}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full gradient-bg flex items-center justify-center text-white text-xs font-medium shrink-0">
                      {name.slice(-2)}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-slate-700">
                        {name}
                      </div>
                      <div className="text-xs text-slate-400">{role}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
