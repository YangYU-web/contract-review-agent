import type { Metadata, Viewport } from 'next';
import './globals.css';
import Navbar from '@/components/Navbar';
import MobileNav from '@/components/MobileNav';
import { AuthProvider } from '@/components/AuthProvider';
import PWARegister from '@/components/PWARegister';

// Cloudflare Pages: 所有路由使用 Edge Runtime
export const runtime = 'edge';

export const metadata: Metadata = {
  title: '企业合同智能审查Agent',
  description: 'AI驱动的企业合同风险识别与修改建议平台',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: '合同审查',
  },
  other: {
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'default',
  },
  icons: {
    icon: '/favicon.png',
    apple: '/icon-192.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#7c3aed',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>
        <AuthProvider>
          <Navbar />
          <main className="min-h-screen pb-14 md:pb-0">{children}</main>
          <MobileNav />
        </AuthProvider>
        <PWARegister />
      </body>
    </html>
  );
}
