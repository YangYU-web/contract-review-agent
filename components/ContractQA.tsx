'use client';

import {
  forwardRef,
  useState,
  useRef,
  useEffect,
  useImperativeHandle,
  FormEvent,
} from 'react';
import {
  MessageSquare,
  Send,
  Sparkles,
  ChevronDown,
  Quote,
  User,
  Bot,
} from 'lucide-react';
import { ChatMessage } from '@/lib/types';

// ===== AI合同问答组件 =====
// 聊天界面：用户消息靠右，AI消息靠左，AI回答附带可展开的条款引用卡片

interface ContractQAProps {
  contractId: string;
  contractTitle?: string;
}

export interface ContractQAHandle {
  // 供父组件调用：自动填充并发送一条问题
  sendQuestion: (question: string) => void;
}

// 生成唯一ID
function genId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

// 打字动画指示器
function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-1 py-1">
      <span className="w-2 h-2 rounded-full bg-brand-400 animate-bounce" style={{ animationDelay: '0ms' }} />
      <span className="w-2 h-2 rounded-full bg-brand-400 animate-bounce" style={{ animationDelay: '150ms' }} />
      <span className="w-2 h-2 rounded-full bg-brand-400 animate-bounce" style={{ animationDelay: '300ms' }} />
    </div>
  );
}

// 单条引用条款卡片（可展开/折叠）
function ReferenceCard({
  reference,
  index,
}: {
  reference: { clause_id: string; clause_text: string };
  index: number;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50/70"
    >
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-100 transition-colors"
      >
        <Quote className="w-3.5 h-3.5 text-brand-500 shrink-0" />
        <span className="text-xs font-medium text-brand-700 shrink-0">
          {reference.clause_id}
        </span>
        <span className={`text-xs text-slate-500 flex-1 truncate ${expanded ? 'whitespace-normal' : ''}`}>
          {reference.clause_text}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </button>
      {expanded && (
        <div className="px-3 pb-3 pt-1">
          <div className="text-xs text-slate-600 leading-relaxed bg-white rounded-md p-2.5 border border-slate-100">
            {reference.clause_text}
          </div>
        </div>
      )}
    </div>
  );
}

// 消息气泡
function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="flex items-start gap-2 max-w-[85%]">
          <div className="gradient-bg text-white rounded-2xl rounded-tr-sm px-4 py-2.5 shadow-sm">
            <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
              {message.content}
            </p>
          </div>
          <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
            <User className="w-4 h-4 text-slate-600" />
          </div>
        </div>
      </div>
    );
  }

  // AI消息
  return (
    <div className="flex justify-start">
      <div className="flex items-start gap-2 max-w-[85%]">
        <div className="w-8 h-8 rounded-full gradient-bg flex items-center justify-center shrink-0">
          <Bot className="w-4 h-4 text-white" />
        </div>
        <div className="space-y-2">
          <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm px-4 py-2.5 shadow-sm">
            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap break-words">
              {message.content}
            </p>
          </div>
          {/* 引用条款卡片 */}
          {message.references && message.references.length > 0 && (
            <div className="space-y-1.5 pl-1">
              <div className="flex items-center gap-1 text-xs text-slate-400">
                <Quote className="w-3 h-3" />
                <span>引用条款（{message.references.length}）</span>
              </div>
              {message.references.map((ref, idx) => (
                <ReferenceCard key={idx} reference={ref} index={idx} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const ContractQA = forwardRef<ContractQAHandle, ContractQAProps>(
  function ContractQA({ contractId, contractTitle }, ref) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // 自动滚动到底部
    useEffect(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }, [messages, loading]);

    // 暴露给父组件的方法：发送问题
    useImperativeHandle(ref, () => ({
      sendQuestion: (question: string) => {
        handleSend(question);
      },
    }));

    // 实际发送逻辑
    async function handleSend(questionText: string) {
      const question = questionText.trim();
      if (!question || loading) return;

      const userMsg: ChatMessage = {
        id: genId(),
        role: 'user',
        content: question,
        timestamp: new Date().toISOString(),
      };

      const newMessages = [...messages, userMsg];
      setMessages(newMessages);
      setInput('');
      setLoading(true);

      try {
        // 构建历史对话（排除当前用户消息）
        const history = messages.map(m => ({
          id: m.id,
          role: m.role,
          content: m.content,
          timestamp: m.timestamp,
          references: m.references,
        }));

        const res = await fetch('/api/qa', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contract_id: contractId,
            question,
            history,
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `请求失败 (${res.status})`);
        }

        const data = await res.json();

        const aiMsg: ChatMessage = {
          id: genId(),
          role: 'assistant',
          content: data.answer,
          timestamp: new Date().toISOString(),
          references: data.references || [],
        };

        setMessages(prev => [...prev, aiMsg]);
      } catch (err) {
        const errMsg: ChatMessage = {
          id: genId(),
          role: 'assistant',
          content: `抱歉，回答时出现错误：${err instanceof Error ? err.message : '未知错误'}。请稍后重试。`,
          timestamp: new Date().toISOString(),
        };
        setMessages(prev => [...prev, errMsg]);
      } finally {
        setLoading(false);
        inputRef.current?.focus();
      }
    }

    // 表单提交
    function handleSubmit(e: FormEvent) {
      e.preventDefault();
      handleSend(input);
    }

    // 键盘事件：Enter发送，Shift+Enter换行
    function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend(input);
      }
    }

    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-[600px]">
        {/* 顶部标题栏 */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
          <div className="w-8 h-8 rounded-lg gradient-bg flex items-center justify-center">
            <MessageSquare className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
              AI合同问答助手
              <Sparkles className="w-3.5 h-3.5 text-brand-500" />
            </h3>
            {contractTitle && (
              <p className="text-xs text-slate-400 truncate">{contractTitle}</p>
            )}
          </div>
        </div>

        {/* 消息列表 */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.length === 0 && !loading && (
            <div className="h-full flex flex-col items-center justify-center text-center px-6">
              <div className="w-14 h-14 rounded-2xl gradient-bg flex items-center justify-center mb-3">
                <Bot className="w-7 h-7 text-white" />
              </div>
              <p className="text-sm font-medium text-slate-600 mb-1">
                向AI提问关于本合同的任何问题
              </p>
              <p className="text-xs text-slate-400">
                例如：付款条件是否合理？违约责任如何？有什么修改建议？
              </p>
            </div>
          )}

          {messages.map(msg => (
            <MessageBubble key={msg.id} message={msg} />
          ))}

          {/* 加载状态：打字动画 */}
          {loading && (
            <div className="flex justify-start">
              <div className="flex items-start gap-2">
                <div className="w-8 h-8 rounded-full gradient-bg flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                  <TypingIndicator />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 底部输入框 */}
        <form
          onSubmit={handleSubmit}
          className="flex items-end gap-2 px-4 py-3 border-t border-slate-100"
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入您的问题，Enter发送，Shift+Enter换行..."
            rows={1}
            disabled={loading}
            className="flex-1 resize-none rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-200 disabled:bg-slate-50 disabled:cursor-not-allowed max-h-32"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="gradient-bg text-white rounded-xl px-4 py-2.5 text-sm font-medium hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 shrink-0"
          >
            <Send className="w-4 h-4" />
            <span className="hidden sm:inline">发送</span>
          </button>
        </form>
      </div>
    );
  }
);

export default ContractQA;
