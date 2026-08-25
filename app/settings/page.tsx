'use client';

export const runtime = 'edge';

import { useState } from 'react';
import { Settings, Key, Database, Zap, Bell, Save, Check } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { isSupabaseConfigured } from '@/lib/supabase';
import { isClaudeConfigured } from '@/lib/claude';
import { getMockUsageStats, MODEL_ROUTING } from '@/lib/cost-optimization';

export default function SettingsPage() {
  const { user, isDemoMode } = useAuth();
  const [saved, setSaved] = useState(false);
  const [prefs, setPrefs] = useState({
    autoApproveLowRisk: true,
    notifyHighRisk: true,
    language: 'zh-CN',
    modelPreference: 'auto',
    cachePrompts: true,
    exportFormat: 'doc',
  });
  const usageStats = getMockUsageStats();

  const handleSave = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('user_preferences', JSON.stringify(prefs));
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center gap-2 mb-8">
        <Settings className="w-6 h-6 text-brand-600" />
        <h1 className="text-2xl font-bold">设置</h1>
      </div>

      {/* 账户信息 */}
      <Section icon={Key} title="账户信息">
        {isDemoMode ? (
          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-700">
            当前为演示模式。配置Supabase后可启用用户认证和个性化设置。
          </div>
        ) : user ? (
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">邮箱</span>
              <span className="font-medium text-slate-700">{user.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">用户ID</span>
              <span className="font-mono text-xs text-slate-400">{user.id}</span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-400">未登录</p>
        )}
      </Section>

      {/* 服务状态 */}
      <Section icon={Database} title="服务状态">
        <div className="space-y-2">
          <ServiceRow name="Claude API" configured={isClaudeConfigured()} hint="AI合同审查引擎" />
          <ServiceRow name="Supabase 数据库" configured={isSupabaseConfigured()} hint="数据存储与检索" />
        </div>
      </Section>

      {/* 审查偏好 */}
      <Section icon={Zap} title="审查偏好">
        <div className="space-y-3">
          <ToggleItem
            label="低风险合同自动通过审批"
            desc="风险评分低于20分的合同自动跳过审批流"
            value={prefs.autoApproveLowRisk}
            onChange={(v) => setPrefs({ ...prefs, autoApproveLowRisk: v })}
          />
          <ToggleItem
            label="高风险合同通知"
            desc="发现高风险条款时发送通知"
            value={prefs.notifyHighRisk}
            onChange={(v) => setPrefs({ ...prefs, notifyHighRisk: v })}
          />
          <ToggleItem
            label="启用提示缓存"
            desc="缓存系统提示以降低API成本（预计节省30%费用）"
            value={prefs.cachePrompts}
            onChange={(v) => setPrefs({ ...prefs, cachePrompts: v })}
          />
        </div>
      </Section>

      {/* 模型路由配置 */}
      <Section icon={Zap} title="AI模型配置">
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium text-slate-600 mb-1 block">模型选择策略</label>
            <select
              value={prefs.modelPreference}
              onChange={(e) => setPrefs({ ...prefs, modelPreference: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-brand-400"
            >
              <option value="auto">自动路由（推荐）</option>
              <option value="standard">仅使用标准模型</option>
              <option value="fast">优先使用快速模型（省钱）</option>
              <option value="deep">优先使用深度模型（更准确）</option>
            </select>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {Object.values(MODEL_ROUTING).map(m => (
              <div key={m.tier} className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                <div className="text-sm font-medium text-slate-700">{m.tier === 'fast' ? '快速' : m.tier === 'standard' ? '标准' : '深度'}</div>
                <div className="text-xs text-slate-400 mt-1">{m.model.split('-').slice(-2).join('-')}</div>
                <div className="text-xs text-slate-500 mt-1">${m.cost_per_1k_input}/1K输入</div>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* 成本统计 */}
      <Section icon={Zap} title="用量与成本统计">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <CostCard label="总用量" value={`${usageStats.total_contracts}`} unit="次" />
          <CostCard label="总成本" value={`$${usageStats.total_cost_usd.toFixed(3)}`} unit="" />
          <CostCard label="约人民币" value={`¥${usageStats.estimated_cost_cny}`} unit="" />
          <CostCard label="缓存率" value={`${usageStats.cache_rate}%`} unit="" />
        </div>
        <div className="mt-3 p-3 rounded-lg bg-brand-50/50 border border-brand-100">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-600">本月预计成本</span>
            <span className="font-bold text-brand-600">¥{(usageStats.monthly_projection * 7.2).toFixed(0)}</span>
          </div>
        </div>
      </Section>

      {/* 保存按钮 */}
      <div className="flex justify-end mt-6">
        <button
          onClick={handleSave}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg gradient-bg text-white font-medium text-sm hover:shadow-lg transition-all"
        >
          {saved ? (
            <>
              <Check className="w-4 h-4" /> 已保存
            </>
          ) : (
            <>
              <Save className="w-4 h-4" /> 保存设置
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function Section({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 mb-4">
      <div className="flex items-center gap-2 mb-4">
        <Icon className="w-5 h-5 text-brand-600" />
        <h2 className="font-semibold text-slate-800">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function ServiceRow({ name, configured, hint }: { name: string; configured: boolean; hint: string }) {
  return (
    <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50">
      <div>
        <span className="text-sm font-medium text-slate-700">{name}</span>
        <span className="text-xs text-slate-400 ml-2">{hint}</span>
      </div>
      <div className={`flex items-center gap-1.5 text-xs font-medium ${configured ? 'text-green-600' : 'text-amber-500'}`}>
        <div className={`w-2 h-2 rounded-full ${configured ? 'bg-green-500' : 'bg-amber-400'}`} />
        {configured ? '已连接' : '未配置'}
      </div>
    </div>
  );
}

function ToggleItem({ label, desc, value, onChange }: { label: string; desc: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex-1">
        <p className="text-sm font-medium text-slate-700">{label}</p>
        <p className="text-xs text-slate-400 mt-0.5">{desc}</p>
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${value ? 'bg-brand-600' : 'bg-slate-300'}`}
      >
        <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${value ? 'left-0.5 translate-x-5' : 'left-0.5'}`} />
      </button>
    </div>
  );
}

function CostCard({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="text-center p-3 rounded-lg bg-slate-50">
      <div className="text-lg font-bold text-slate-800">{value}</div>
      <div className="text-xs text-slate-400">{label}{unit && ` (${unit})`}</div>
    </div>
  );
}
