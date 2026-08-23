'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { MessageSquare, Send, Reply, Check, AtSign } from 'lucide-react';
import { ContractComment } from '@/lib/types';

interface CommentSectionProps {
  contractId: string;
  riskId?: string;
}

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
        <span key={idx} className="text-brand-600 font-medium bg-brand-50 px-1 rounded">
          {part}
        </span>
      );
    }
    return <span key={idx}>{part}</span>;
  });
}

// 从内容中提取 @提及
function extractMentions(content: string): string[] {
  const matches = content.match(/@[\u4e00-\u9fa5A-Za-z0-9_]+/g) || [];
  return Array.from(new Set(matches.map((m) => m.slice(1))));
}

export default function CommentSection({ contractId, riskId }: CommentSectionProps) {
  const [comments, setComments] = useState<ContractComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState('');
  const [replyTo, setReplyTo] = useState<ContractComment | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 当前输入框中检测到的 @提及
  const detectedMentions = useMemo(() => extractMentions(content), [content]);

  const loadComments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ contract_id: contractId });
      if (riskId) params.set('risk_id', riskId);
      const res = await fetch(`/api/comments?${params.toString()}`, {
        cache: 'no-store',
      });
      if (!res.ok) throw new Error('加载评论失败');
      const data = await res.json();
      setComments(data.comments || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载评论失败');
    } finally {
      setLoading(false);
    }
  }, [contractId, riskId]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  // 创建评论（顶级）
  const handleSubmit = async () => {
    if (!content.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contract_id: contractId,
          risk_id: riskId,
          content: content.trim(),
          user_name: '当前用户',
          user_role: '法务专员',
          mentions: extractMentions(content),
        }),
      });
      if (!res.ok) throw new Error('发送评论失败');
      setContent('');
      await loadComments();
    } catch (err) {
      setError(err instanceof Error ? err.message : '发送评论失败');
    } finally {
      setSubmitting(false);
    }
  };

  // 创建回复
  const handleReply = async (parent: ContractComment) => {
    if (!replyContent.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contract_id: contractId,
          risk_id: riskId,
          content: replyContent.trim(),
          user_name: '当前用户',
          user_role: '法务专员',
          mentions: extractMentions(replyContent),
          parent_id: parent.id,
        }),
      });
      if (!res.ok) throw new Error('发送回复失败');
      setReplyContent('');
      setReplyTo(null);
      await loadComments();
    } catch (err) {
      setError(err instanceof Error ? err.message : '发送回复失败');
    } finally {
      setSubmitting(false);
    }
  };

  // 标记已解决 / 取消
  const handleToggleResolve = async (comment: ContractComment) => {
    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'resolve',
          comment_id: comment.id,
          resolved: !comment.resolved,
        }),
      });
      if (!res.ok) throw new Error('操作失败');
      await loadComments();
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败');
    }
  };

  // 将评论组织为顶级 + 回复的树形结构
  const topLevel = comments.filter((c) => !c.parent_id);
  const repliesOf = (parentId: string) =>
    comments.filter((c) => c.parent_id === parentId);

  const unresolvedCount = topLevel.filter((c) => !c.resolved).length;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      {/* 头部 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-brand-600" />
          <h3 className="font-semibold text-slate-800">协作评论</h3>
          <span className="text-xs text-slate-400">
            ({comments.length} 条 · {unresolvedCount} 条待处理)
          </span>
        </div>
      </div>

      {error && (
        <div className="mb-3 p-2 rounded-lg bg-red-50 text-red-600 text-xs">
          {error}
        </div>
      )}

      {/* 评论输入框 */}
      <div className="mb-5">
        <div className="relative">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="发表评论，输入 @ 可提及团队成员..."
            className="w-full text-sm p-3 border border-slate-200 rounded-lg resize-none focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            rows={3}
          />
          {detectedMentions.length > 0 && (
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <AtSign className="w-3 h-3" />将提及：
              </span>
              {detectedMentions.map((m) => (
                <span
                  key={m}
                  className="text-xs px-2 py-0.5 rounded bg-brand-50 text-brand-600"
                >
                  @{m}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="mt-2 flex justify-end">
          <button
            onClick={handleSubmit}
            disabled={submitting || !content.trim()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white gradient-bg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
            {submitting ? '发送中...' : '发表评论'}
          </button>
        </div>
      </div>

      {/* 评论列表 */}
      {loading ? (
        <div className="py-8 text-center text-sm text-slate-400">加载评论中...</div>
      ) : topLevel.length === 0 ? (
        <div className="py-8 text-center">
          <MessageSquare className="w-8 h-8 text-slate-200 mx-auto mb-2" />
          <p className="text-sm text-slate-400">还没有评论，发表第一条评论吧</p>
        </div>
      ) : (
        <div className="space-y-4">
          {topLevel.map((comment) => {
            const replies = repliesOf(comment.id);
            return (
              <div key={comment.id} className="space-y-3">
                <CommentItem
                  comment={comment}
                  onReply={() => {
                    setReplyTo(comment);
                    setReplyContent('');
                  }}
                  onToggleResolve={() => handleToggleResolve(comment)}
                />

                {/* 回复列表 */}
                {replies.length > 0 && (
                  <div className="ml-10 space-y-3 border-l-2 border-slate-100 pl-4">
                    {replies.map((reply) => (
                      <CommentItem
                        key={reply.id}
                        comment={reply}
                        isReply
                        onReply={() => {
                          setReplyTo(reply);
                          setReplyContent('');
                        }}
                        onToggleResolve={() => handleToggleResolve(reply)}
                      />
                    ))}
                  </div>
                )}

                {/* 回复输入框 */}
                {replyTo?.id === comment.id && (
                  <div className="ml-10 bg-slate-50 rounded-lg p-3">
                    <div className="flex items-center gap-1 text-xs text-slate-500 mb-2">
                      <Reply className="w-3 h-3" />
                      回复 @{comment.user_name}
                    </div>
                    <textarea
                      value={replyContent}
                      onChange={(e) => setReplyContent(e.target.value)}
                      placeholder={`回复 @${comment.user_name}...`}
                      className="w-full text-sm p-2 border border-slate-200 rounded-lg resize-none focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 bg-white"
                      rows={2}
                    />
                    <div className="mt-2 flex items-center justify-end gap-2">
                      <button
                        onClick={() => {
                          setReplyTo(null);
                          setReplyContent('');
                        }}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-500 bg-white hover:bg-slate-100 transition-colors"
                      >
                        取消
                      </button>
                      <button
                        onClick={() => handleReply(comment)}
                        disabled={submitting || !replyContent.trim()}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-white gradient-bg hover:shadow transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Send className="w-3 h-3" />
                        {submitting ? '发送中...' : '回复'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// 单条评论组件
function CommentItem({
  comment,
  isReply = false,
  onReply,
  onToggleResolve,
}: {
  comment: ContractComment;
  isReply?: boolean;
  onReply: () => void;
  onToggleResolve: () => void;
}) {
  const roleColor: Record<string, string> = {
    法务专员: 'bg-brand-50 text-brand-600',
    法务经理: 'bg-blue-50 text-blue-600',
    法务总监: 'bg-indigo-50 text-indigo-600',
    业务部门: 'bg-amber-50 text-amber-600',
    总经理: 'bg-purple-50 text-purple-600',
  };

  return (
    <div
      className={`flex gap-3 ${comment.resolved ? 'opacity-60' : ''}`}
    >
      {/* 头像 */}
      <div className="w-8 h-8 rounded-full gradient-bg flex items-center justify-center text-white text-xs font-medium shrink-0">
        {comment.user_name.slice(-2)}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-slate-800">
            {comment.user_name}
          </span>
          <span
            className={`text-xs px-1.5 py-0.5 rounded ${
              roleColor[comment.user_role] || 'bg-slate-100 text-slate-500'
            }`}
          >
            {comment.user_role}
          </span>
          {comment.resolved && (
            <span className="inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded bg-green-50 text-green-600">
              <Check className="w-3 h-3" />已解决
            </span>
          )}
          <span className="text-xs text-slate-400">
            {formatRelativeTime(comment.created_at)}
          </span>
        </div>

        <p className="text-sm text-slate-600 mt-1 leading-relaxed break-words">
          {renderContentWithMentions(comment.content)}
        </p>

        <div className="flex items-center gap-3 mt-2">
          <button
            onClick={onReply}
            className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-brand-600 transition-colors"
          >
            <Reply className="w-3 h-3" />
            回复
          </button>
          <button
            onClick={onToggleResolve}
            className={`inline-flex items-center gap-1 text-xs transition-colors ${
              comment.resolved
                ? 'text-slate-400 hover:text-amber-600'
                : 'text-slate-400 hover:text-green-600'
            }`}
          >
            <Check className="w-3 h-3" />
            {comment.resolved ? '取消已解决' : '标记已解决'}
          </button>
        </div>
      </div>
    </div>
  );
}
