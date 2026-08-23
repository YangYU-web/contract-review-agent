'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  FileSearch, LayoutDashboard, Upload, BarChart3, BookOpen,
  CalendarClock, Users, FileStack,
  MessageSquare, GitCompare, Bell, Mail, Code,
  GitCommit, Shield, History, Webhook,
  Languages, ScanLine, PenLine,
  FileText, Scale, FileSignature, Search, Activity,
  RefreshCw, Building2, DollarSign, Workflow, Network,
  Handshake, Gavel, FlaskConical, Library,
} from 'lucide-react';
import UserMenu from '@/components/UserMenu';

export default function Navbar() {
  const pathname = usePathname();

  const navItems = [
    { href: '/', label: '首页', icon: FileSearch },
    { href: '/upload', label: '上传', icon: Upload },
    { href: '/dashboard', label: '记录', icon: LayoutDashboard },
    { href: '/lifecycle', label: '生命周期', icon: CalendarClock },
    { href: '/templates', label: '模板库', icon: FileStack },
    { href: '/collaboration', label: '协作', icon: Users },
    { href: '/knowledge-base', label: '知识库', icon: BookOpen },
    { href: '/analytics', label: '分析', icon: BarChart3 },
    { href: '/qa', label: '问答', icon: MessageSquare },
    { href: '/compare', label: '对比', icon: GitCompare },
    { href: '/alerts', label: '预警', icon: Bell },
    { href: '/notifications', label: '通知', icon: Mail },
    { href: '/api-docs', label: 'API', icon: Code },
    { href: '/versions', label: '版本', icon: GitCommit },
    { href: '/rules', label: '规则', icon: Shield },
    { href: '/audit', label: '审计', icon: History },
    { href: '/webhooks', label: 'Webhook', icon: Webhook },
    { href: '/multilingual', label: '双语', icon: Languages },
    { href: '/ocr', label: 'OCR', icon: ScanLine },
    { href: '/rbac', label: '权限', icon: Shield },
    { href: '/drafting', label: '起草', icon: PenLine },
    { href: '/visualizations', label: '图表', icon: BarChart3 },
    // ===== Phase 8 功能入口 =====
    { href: '/summary', label: '摘要', icon: FileText },
    { href: '/compliance', label: '合规', icon: Scale },
    { href: '/signatures', label: '签章', icon: FileSignature },
    { href: '/search', label: '搜索', icon: Search },
    { href: '/system-health', label: '监控', icon: Activity },
    // ===== Phase 9 功能入口 =====
    { href: '/renewals', label: '续签', icon: RefreshCw },
    { href: '/partners', label: '档案', icon: Building2 },
    { href: '/pricing', label: '定价', icon: DollarSign },
    { href: '/workflow-editor', label: '流程', icon: Workflow },
    { href: '/knowledge-graph', label: '图谱', icon: Network },
    // ===== Phase 10 功能入口 =====
    { href: '/negotiation', label: '谈判', icon: Handshake },
    { href: '/performance', label: '履约', icon: Activity },
    { href: '/regulatory', label: '法规', icon: Gavel },
    { href: '/risk-simulation', label: '模拟', icon: FlaskConical },
    { href: '/clause-library', label: '条款库', icon: Library },
  ];

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <div className="w-9 h-9 rounded-lg gradient-bg flex items-center justify-center">
              <FileSearch className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg gradient-text hidden sm:inline">
              合同智能审查
            </span>
          </Link>

          {/* 导航链接 */}
          <div className="flex items-center gap-0.5 sm:gap-1 overflow-x-auto scrollbar-hide flex-1 min-w-0 mx-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={item.label}
                  className={`flex items-center gap-1.5 px-2 sm:px-3 py-2 rounded-lg text-sm font-medium transition-colors shrink-0 ${
                    isActive
                      ? 'text-brand-700 bg-brand-50'
                      : 'text-slate-600 hover:text-brand-600 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden lg:inline">{item.label}</span>
                </Link>
              );
            })}
          </div>

          {/* 用户菜单 */}
          <div className="shrink-0">
            <UserMenu />
          </div>
        </div>
      </div>
    </nav>
  );
}
