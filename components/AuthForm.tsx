'use client';

import { useState } from 'react';
import { Mail, Lock, Loader2, UserPlus, LogIn } from 'lucide-react';
import { signIn, signUp, isAuthConfigured } from '@/lib/auth';
import { useAuth } from '@/components/AuthProvider';

export default function AuthForm() {
  const { refreshUser, isDemoMode } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    if (!isAuthConfigured()) {
      setError('认证服务未配置，当前为演示模式。请在 .env.local 中配置 Supabase 密钥。');
      setLoading(false);
      return;
    }

    try {
      if (mode === 'register') {
        const { user, error } = await signUp(email, password);
        if (error) {
          setError(error.message);
        } else if (user) {
          if (user.email && !user.email_confirmed_at) {
            setSuccess('注册成功！请检查邮箱确认链接。');
          } else {
            setSuccess('注册成功！正在登录...');
            await refreshUser();
          }
        }
      } else {
        const { user, error } = await signIn(email, password);
        if (error) {
          setError(error.message);
        } else if (user) {
          await refreshUser();
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-8">
      <div className="bg-white rounded-2xl border border-slate-200 p-8">
        <h2 className="text-xl font-bold text-center mb-6">
          {mode === 'login' ? '登录' : '注册'}
        </h2>

        {isDemoMode && (
          <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-700">
            当前为演示模式，无需登录即可浏览。配置Supabase后可启用用户认证。
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-700">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">邮箱</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                placeholder="your@email.com"
                className="w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">密码</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                minLength={6}
                placeholder="至少6位"
                className="w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-400"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg gradient-bg text-white font-medium text-sm disabled:opacity-50 hover:shadow-lg transition-all"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 spinner" />
            ) : mode === 'login' ? (
              <>
                <LogIn className="w-4 h-4" /> 登录
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4" /> 注册
              </>
            )}
          </button>
        </form>

        <div className="mt-4 text-center text-sm">
          {mode === 'login' ? (
            <span className="text-slate-500">
              还没有账号？
              <button onClick={() => setMode('register')} className="text-brand-600 font-medium ml-1">
                注册
              </button>
            </span>
          ) : (
            <span className="text-slate-500">
              已有账号？
              <button onClick={() => setMode('login')} className="text-brand-600 font-medium ml-1">
                登录
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
