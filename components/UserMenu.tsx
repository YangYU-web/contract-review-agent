'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { User, LogOut, Settings, ChevronDown } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { signOut } from '@/lib/auth';
import Link from 'next/link';

export default function UserMenu() {
  const { user, isDemoMode, refreshUser } = useAuth();
  const [open, setOpen] = useState(false);
  const [showAuthForm, setShowAuthForm] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    await refreshUser();
    router.push('/');
  };

  if (isDemoMode) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 text-xs font-medium">
        <span className="w-2 h-2 rounded-full bg-amber-400" />
        演示模式
      </div>
    );
  }

  if (!user) {
    return (
      <Link
        href="/login"
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white gradient-bg hover:shadow-md transition-all"
      >
        <User className="w-4 h-4" />
        登录
      </Link>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-slate-50 transition-colors"
      >
        <div className="w-7 h-7 rounded-full gradient-bg flex items-center justify-center text-white text-xs font-bold">
          {user.email?.[0].toUpperCase()}
        </div>
        <span className="hidden sm:inline text-slate-600 max-w-[120px] truncate">
          {user.email}
        </span>
        <ChevronDown className="w-4 h-4 text-slate-400" />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl border border-slate-200 shadow-lg py-1 z-50">
          <div className="px-3 py-2 border-b border-slate-100">
            <p className="text-xs text-slate-400">已登录</p>
            <p className="text-sm font-medium text-slate-700 truncate">{user.email}</p>
          </div>
          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            <Settings className="w-4 h-4" /> 设置
          </Link>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
          >
            <LogOut className="w-4 h-4" /> 登出
          </button>
        </div>
      )}
    </div>
  );
}
