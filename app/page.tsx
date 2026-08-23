import Link from 'next/link';
import {
  FileSearch, Shield, Zap, ArrowRight, CheckCircle2,
  Layers, FileText, CalendarClock, Users, FileStack,
  MessageSquare, GitCompare, Bell, Mail, Code,
  GitCommit, History, Webhook,
  Languages, ScanLine, PenLine, BarChart3,
  Scale, FileSignature, Search, Activity,
  RefreshCw, Building2, DollarSign, Workflow, Network,
  Handshake, Gavel, FlaskConical, Library,
} from 'lucide-react';
import { isClaudeConfigured } from '@/lib/claude';
import { isSupabaseConfigured } from '@/lib/supabase';

export default function HomePage() {
  const claudeReady = isClaudeConfigured();
  const supabaseReady = isSupabaseConfigured();
  const allReady = claudeReady && supabaseReady;

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      {/* Hero */}
      <div className="text-center mb-16">
        <div className="inline-block px-4 py-1.5 rounded-full bg-brand-50 text-brand-700 text-sm font-medium mb-6">
          AI驱动的合同风险识别
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold mb-6 leading-tight">
          <span className="gradient-text">企业合同智能审查</span>
          <br />
          Agent
        </h1>
        <p className="text-lg text-slate-600 max-w-2xl mx-auto mb-8">
          上传合同文件，AI在15秒内识别风险条款、给出评分和修改建议。
          覆盖12类风险识别，引用验证确保准确性。
        </p>
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <Link
            href="/upload"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl gradient-bg text-white font-semibold shadow-lg shadow-brand-500/30 hover:shadow-xl hover:shadow-brand-500/40 transition-all"
          >
            <Zap className="w-5 h-5" />
            立即审查合同
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/batch-upload"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white border border-slate-200 text-slate-700 font-semibold hover:border-brand-300 hover:text-brand-600 transition-all"
          >
            <Layers className="w-5 h-5" />
            批量审查
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white border border-slate-200 text-slate-700 font-semibold hover:border-brand-300 hover:text-brand-600 transition-all"
          >
            查看审查记录
          </Link>
        </div>
      </div>

      {/* 环境状态 */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-12">
        <h3 className="text-sm font-semibold text-slate-500 mb-4 uppercase tracking-wide">
          环境配置状态
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatusItem label="Claude API" configured={claudeReady} hint="未配置时使用模拟数据" />
          <StatusItem label="Supabase 数据库" configured={supabaseReady} hint="未配置时数据存储在内存" />
          <StatusItem label="整体就绪" configured={allReady} hint={allReady ? '所有服务已就绪' : '可以使用演示模式'} />
        </div>
        {!allReady && (
          <p className="text-sm text-slate-500 mt-4">
            当前以演示模式运行。配置API密钥后即可使用真实AI审查功能。详见 <code className="bg-slate-100 px-1.5 py-0.5 rounded text-sm">.env.example</code> 文件。
          </p>
        )}
      </div>

      {/* 功能特性 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <FeatureCard icon={FileSearch} title="智能文档解析" desc="支持PDF和Word文档上传，自动提取文本并按法律条款边界分割。" />
        <FeatureCard icon={Shield} title="12类风险识别" desc="覆盖付款、交付、违约、知识产权、保密等12种风险类型，附引用验证。" />
        <FeatureCard icon={CheckCircle2} title="修改建议与审批" desc="AI生成条款修改建议，支持逐条采纳/驳回，保留完整审计日志。" />
      </div>

      {/* Phase 4 功能入口 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <QuickLink href="/batch-upload" icon={Layers} title="批量审查" desc="多文件并行AI审查" />
        <QuickLink href="/lifecycle" icon={CalendarClock} title="到期管理" desc="合同生命周期跟踪" />
        <QuickLink href="/collaboration" icon={Users} title="团队协作" desc="风险条款讨论评论" />
        <QuickLink href="/templates" icon={FileStack} title="模板库" desc="8类标准合同模板" />
      </div>

      {/* Phase 5 功能入口 */}
      <div className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-4">
        <QuickLink href="/qa" icon={MessageSquare} title="AI问答" desc="合同条款智能问答" />
        <QuickLink href="/compare" icon={GitCompare} title="合同对比" desc="多版本条款差异分析" />
        <QuickLink href="/alerts" icon={Bell} title="风险预警" desc="风险趋势实时监控" />
        <QuickLink href="/notifications" icon={Mail} title="邮件通知" desc="审查结果自动推送" />
        <QuickLink href="/api-docs" icon={Code} title="API文档" desc="开放接口集成指南" />
      </div>

      {/* Phase 6 功能入口 */}
      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
        <QuickLink href="/versions" icon={GitCommit} title="版本管理" desc="合同版本追溯与回滚" />
        <QuickLink href="/rules" icon={Shield} title="风险规则" desc="自定义风险识别规则" />
        <QuickLink href="/audit" icon={History} title="审计追踪" desc="完整操作日志记录" />
        <QuickLink href="/webhooks" icon={Webhook} title="Webhook集成" desc="事件回调自动通知" />
      </div>

      {/* Phase 7 功能入口 */}
      <div className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-4">
        <QuickLink href="/multilingual" icon={Languages} title="多语言审查" desc="中英双语合同对照" />
        <QuickLink href="/ocr" icon={ScanLine} title="OCR识别" desc="扫描件智能识别" />
        <QuickLink href="/rbac" icon={Shield} title="权限管理" desc="角色权限精细化" />
        <QuickLink href="/drafting" icon={PenLine} title="合同起草" desc="AI智能条款生成" />
        <QuickLink href="/visualizations" icon={BarChart3} title="高级图表" desc="多维度数据可视化" />
      </div>

      {/* Phase 8 功能入口 */}
      <div className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-4">
        <QuickLink href="/summary" icon={FileText} title="智能摘要" desc="合同要点一键提炼" />
        <QuickLink href="/compliance" icon={Scale} title="合规检查" desc="法律法规合规校验" />
        <QuickLink href="/signatures" icon={FileSignature} title="电子签章" desc="在线签署与存证" />
        <QuickLink href="/search" icon={Search} title="全文搜索" desc="合同内容快速检索" />
        <QuickLink href="/system-health" icon={Activity} title="系统监控" desc="服务健康实时监控" />
      </div>

      {/* Phase 9 功能入口 */}
      <div className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-4">
        <QuickLink href="/renewals" icon={RefreshCw} title="自动续签" desc="智能续签策略引擎" />
        <QuickLink href="/partners" icon={Building2} title="合作档案" desc="供应商客户信用管理" />
        <QuickLink href="/pricing" icon={DollarSign} title="智能定价" desc="AI智能定价对比" />
        <QuickLink href="/workflow-editor" icon={Workflow} title="流程引擎" desc="可视化审批流程编排" />
        <QuickLink href="/knowledge-graph" icon={Network} title="知识图谱" desc="合同实体关系网络" />
      </div>

      {/* Phase 10 功能入口 */}
      <div className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-4">
        <QuickLink href="/negotiation" icon={Handshake} title="谈判助手" desc="合同条款智能谈判" />
        <QuickLink href="/performance" icon={Activity} title="履约监控" desc="合同履约进度跟踪" />
        <QuickLink href="/regulatory" icon={Gavel} title="法规监控" desc="法律法规变更追踪" />
        <QuickLink href="/risk-simulation" icon={FlaskConical} title="风险模拟" desc="合同风险情景推演" />
        <QuickLink href="/clause-library" icon={Library} title="条款库" desc="智能标准条款管理" />
      </div>
    </div>
  );
}

function StatusItem({ label, configured, hint }: { label: string; configured: boolean; hint: string; }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50">
      <div className={`w-3 h-3 rounded-full ${configured ? 'bg-green-500' : 'bg-amber-400'}`} />
      <div>
        <div className="text-sm font-medium text-slate-700">{label}</div>
        <div className="text-xs text-slate-400">{hint}</div>
      </div>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, desc }: { icon: React.ElementType; title: string; desc: string; }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 card-hover">
      <div className="w-12 h-12 rounded-xl bg-brand-50 flex items-center justify-center mb-4">
        <Icon className="w-6 h-6 text-brand-600" />
      </div>
      <h3 className="font-semibold text-lg mb-2">{title}</h3>
      <p className="text-sm text-slate-500">{desc}</p>
    </div>
  );
}

function QuickLink({ href, icon: Icon, title, desc }: { href: string; icon: React.ElementType; title: string; desc: string; }) {
  return (
    <Link href={href} className="bg-white rounded-xl border border-slate-200 p-4 card-hover group">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-9 h-9 rounded-lg bg-brand-50 flex items-center justify-center group-hover:bg-brand-100 transition-colors">
          <Icon className="w-5 h-5 text-brand-600" />
        </div>
        <span className="font-semibold text-slate-800">{title}</span>
      </div>
      <p className="text-xs text-slate-400">{desc}</p>
    </Link>
  );
}
