'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FileSearch, Upload, LayoutDashboard, BarChart3, User } from 'lucide-react';

export default function MobileNav() {
  const pathname = usePathname();

  const items = [
    { href: '/', label: '首页', icon: FileSearch },
    { href: '/upload', label: '上传', icon: Upload },
    { href: '/dashboard', label: '记录', icon: LayoutDashboard },
    { href: '/analytics', label: '分析', icon: BarChart3 },
    { href: '/settings', label: '我的', icon: User },
  ];

  return (
    <>
      {/* 底部固定导航栏 - 仅移动端显示 */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200 safe-area-pb">
        <div className="flex items-center justify-around h-14">
          {items.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center gap-0.5 px-2 py-1.5 ${
                  isActive ? 'text-brand-600' : 'text-slate-400'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
      {/* 底部占位空间 */}
      <div className="md:hidden h-14" />
    </>
  );
}
