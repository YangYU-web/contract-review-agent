'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  GitCommit,
  FileText,
  Clock,
  BarChart,
  ChevronDown,
} from 'lucide-react';
import VersionDiffView from '@/components/VersionDiffView';
import { getMockContracts } from '@/lib/mock-data';
import { ContractVersion } from '@/lib/types';

// 月份标签（YYYY-MM）
function monthLabel(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function VersionsPage() {
  // 合同下拉数据
  const contracts = useMemo(() => getMockContracts(), []);
  const [contractId, setContractId] = useState<string>(contracts[0]?.id || '');

  const [versions, setVersions] = useState<ContractVersion[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // 加载某合同的版本列表
  useEffect(() => {
    if (!contractId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/versions?contract_id=${encodeURIComponent(contractId)}`, {
      cache: 'no-store',
    })
      .then(async (res) => {
        if (!res.ok) throw new Error('加载版本失败');
        const data = await res.json();
        if (cancelled) return;
        setVersions(data.versions || []);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : '加载版本失败');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [contractId]);

  // 统计信息
  const stats = useMemo(() => {
    const sorted = [...versions].sort(
      (a, b) => b.version_number - a.version_number
    );
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(
      now.getMonth() + 1
    ).padStart(2, '0')}`;
    const monthUpdates = versions.filter(
      (v) => monthLabel(v.created_at) === currentMonth
    ).length;
    const totalChanges = versions.reduce(
      (sum, v) => sum + v.changes.length,
      0
    );
    return {
      total: versions.length,
      latest: sorted[0]?.version_label || '-',
      monthUpdates,
      totalChanges,
    };
  }, [versions]);

  const statCards = [
    {
      label: '总版本数',
      value: stats.total,
      icon: GitCommit,
      color: 'text-brand-600',
      bg: 'bg-brand-50',
    },
    {
      label: '最新版本号',
      value: stats.latest,
      icon: FileText,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: '本月更新次数',
      value: stats.monthUpdates,
      icon: Clock,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
    {
      label: '总变更数',
      value: stats.totalChanges,
      icon: BarChart,
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
  ];

  const selectedContract = contracts.find((c) => c.id === contractId);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* 页头 */}
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <GitCommit className="w-6 h-6 text-brand-600" />
            合同版本管理
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            追踪合同历史版本，可视化对比不同版本的条款差异与风险影响
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-slate-200">
          <GitCommit className="w-4 h-4 text-brand-600" />
          <span className="text-xs text-slate-500">演示模式</span>
          <span className="text-xs text-slate-300">·</span>
          <span className="text-xs text-slate-400">
            {versions.length} 个版本
          </span>
        </div>
      </div>

      {/* 顶部合同选择器 */}
      <div className="mb-6 bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <label className="block text-xs text-slate-500 mb-2 flex items-center gap-1">
          <FileText className="w-3.5 h-3.5" />
          选择合同
        </label>
        <div className="relative">
          <select
            value={contractId}
            onChange={(e) => setContractId(e.target.value)}
            className="w-full sm:w-96 appearance-none px-3 py-2.5 pr-10 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-300 cursor-pointer"
          >
            {contracts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.contract_title}（{c.contract_type}）
              </option>
            ))}
          </select>
          <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
        {selectedContract && (
          <div className="mt-2 text-xs text-slate-400">
            合同编号：{selectedContract.id} · 类型：{selectedContract.contract_type}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* 左侧：版本对比视图 */}
        <div className="lg:col-span-3">
          {error ? (
            <div className="p-4 rounded-xl bg-red-50 text-red-600 text-sm">
              {error}
            </div>
          ) : loading ? (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center text-sm text-slate-400">
              加载版本中...
            </div>
          ) : versions.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
              <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-400">该合同暂无版本记录</p>
            </div>
          ) : (
            <VersionDiffView versions={versions} contractId={contractId} />
          )}
        </div>

        {/* 右侧：统计卡片 */}
        <div className="lg:col-span-1">
          <div className="sticky top-20 space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2 mb-3 text-sm">
                <BarChart className="w-4 h-4 text-brand-600" />
                版本统计
              </h3>
              <div className="space-y-3">
                {statCards.map((card) => {
                  const Icon = card.icon;
                  return (
                    <div
                      key={card.label}
                      className="flex items-center gap-3 rounded-lg border border-slate-100 p-3"
                    >
                      <div
                        className={`w-9 h-9 rounded-lg ${card.bg} flex items-center justify-center shrink-0`}
                      >
                        <Icon className={`w-4 h-4 ${card.color}`} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-lg font-bold text-slate-800">
                          {card.value}
                        </div>
                        <div className="text-xs text-slate-400">
                          {card.label}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 版本演进说明 */}
            <div className="bg-gradient-to-br from-brand-50 to-white rounded-xl border border-brand-100 p-4">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2 mb-2 text-sm">
                <Clock className="w-4 h-4 text-brand-600" />
                版本演进
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                系统自动记录每次合同修订，按"第X条"条款粒度进行版本比对，
                识别新增、删除、修改条款并评估对风险的影响，便于追溯变更历史。
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
