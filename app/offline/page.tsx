'use client';

export const runtime = 'edge';

import Link from 'next/link';
import { FileSearch, WifiOff } from 'lucide-react';

export default function OfflinePage() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-6">
          <WifiOff className="w-10 h-10 text-slate-400" />
        </div>
        <h1 className="text-2xl font-bold text-slate-800 mb-3">离线模式</h1>
        <p className="text-slate-500 mb-8">
          当前网络不可用，部分功能可能受限。已缓存的页面仍可查看，但需要网络的功能（如AI审查、数据上传）暂时无法使用。
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl gradient-bg text-white font-semibold"
        >
          <FileSearch className="w-4 h-4" />
          返回首页
        </Link>
      </div>
    </div>
  );
}
