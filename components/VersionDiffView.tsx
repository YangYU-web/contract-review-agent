'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  GitCommit,
  GitCompare,
  ArrowRight,
  Plus,
  Minus,
  Edit3,
  Check,
  AlertTriangle,
  Clock,
  FileText,
} from 'lucide-react';
import {
  ContractVersion,
  VersionChange,
  VersionChangeType,
  CHANGE_TYPE_CONFIG,
} from '@/lib/types';
import { compareVersions } from '@/lib/contract-versions';

// 变更类型图标映射
const CHANGE_TYPE_ICONS: Record<VersionChangeType, React.ElementType> = {
  added: Plus,
  removed: Minus,
  modified: Edit3,
  unchanged: Check,
};

// 风险影响标签配置
const RISK_IMPACT_CONFIG: Record<
  VersionChange['risk_impact'],
  { label: string; cls: string }
> = {
  none: { label: '无影响', cls: 'bg-slate-100 text-slate-500' },
  positive: { label: '风险降低', cls: 'bg-green-50 text-green-600' },
  negative: { label: '风险上升', cls: 'bg-red-50 text-red-600' },
  neutral: { label: '风险中性', cls: 'bg-amber-50 text-amber-600' },
};

// 日期格式化
function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate()
    ).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(
      d.getMinutes()
    ).padStart(2, '0')}`;
  } catch {
    return dateStr;
  }
}

// 相对时间格式化
function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = Date.now();
  const diff = now - date.getTime();
  const day = 24 * 60 * 60 * 1000;
  if (diff < day) return '今天';
  if (diff < day * 2) return '昨天';
  if (diff < day * 30) return `${Math.floor(diff / day)} 天前`;
  return date.toLocaleDateString('zh-CN');
}

interface VersionDiffViewProps {
  versions: ContractVersion[];
  contractId: string;
}

export default function VersionDiffView({
  versions,
  contractId,
}: VersionDiffViewProps) {
  // 按版本号升序（旧 → 新）展示时间线
  const sortedVersions = useMemo(
    () =>
      [...versions].sort((a, b) => a.version_number - b.version_number),
    [versions]
  );

  // 默认选择最早与最新版本进行对比
  const [fromVersionId, setFromVersionId] = useState<string>('');
  const [toVersionId, setToVersionId] = useState<string>('');

  // 初始化默认选择项
  useEffect(() => {
    if (sortedVersions.length === 0) return;
    const first = sortedVersions[0];
    const last = sortedVersions[sortedVersions.length - 1];
    setFromVersionId(first.id);
    setToVersionId(last.id);
  }, [contractId, sortedVersions.length > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  const fromVersion = sortedVersions.find((v) => v.id === fromVersionId);
  const toVersion = sortedVersions.find((v) => v.id === toVersionId);

  // 计算两个选中版本的差异
  const changes: VersionChange[] = useMemo(() => {
    if (!fromVersion || !toVersion) return [];
    if (fromVersion.id === toVersion.id) return [];
    return compareVersions(fromVersion, toVersion);
  }, [fromVersion, toVersion]);

  // 差异统计
  const changeStats = useMemo(() => {
    const count = (t: VersionChangeType) =>
      changes.filter((c) => c.change_type === t).length;
    return {
      modified: count('modified'),
      added: count('added'),
      removed: count('removed'),
      unchanged: count('unchanged'),
      total: changes.length,
    };
  }, [changes]);

  return (
    <div className="space-y-6">
      {/* ===== 版本时间线 ===== */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <GitCommit className="w-4 h-4 text-brand-600" />
            版本时间线
          </h3>
          <span className="text-xs text-slate-400">
            共 {sortedVersions.length} 个版本
          </span>
        </div>

        <div className="relative pl-6">
          {/* 垂直时间轴线 */}
          <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-slate-200" />

          <div className="space-y-5">
            {sortedVersions.map((v) => {
              const isLatest = v.id === sortedVersions[sortedVersions.length - 1].id;
              const isFrom = v.id === fromVersionId;
              const isTo = v.id === toVersionId;
              return (
                <div key={v.id} className="relative">
                  {/* 时间线节点 */}
                  <div
                    className={`absolute -left-6 top-1 w-3.5 h-3.5 rounded-full border-2 border-white ${
                      isLatest
                        ? 'bg-brand-500 ring-4 ring-brand-100'
                        : 'bg-slate-300'
                    }`}
                  />

                  <div
                    className={`rounded-lg border p-3 transition-colors ${
                      isFrom
                        ? 'border-amber-300 bg-amber-50'
                        : isTo
                        ? 'border-brand-300 bg-brand-50'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-slate-800">
                          {v.version_label}
                        </span>
                        {isLatest && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-brand-100 text-brand-700 font-medium">
                            最新
                          </span>
                        )}
                        {isFrom && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">
                            对比起点
                          </span>
                        )}
                        {isTo && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-brand-100 text-brand-700 font-medium">
                            对比终点
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatRelativeTime(v.created_at)}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">
                      {v.change_summary}
                    </p>
                    <div className="mt-2 flex items-center gap-3 text-xs text-slate-400">
                      <span className="flex items-center gap-1">
                        <FileText className="w-3 h-3" />
                        {v.changes.length} 处变更
                      </span>
                      <span>·</span>
                      <span>{v.created_by}</span>
                      <span>·</span>
                      <span>{formatDate(v.created_at)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ===== 版本选择器 ===== */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <h3 className="font-semibold text-slate-800 flex items-center gap-2 mb-4">
          <GitCompare className="w-4 h-4 text-brand-600" />
          版本对比
        </h3>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs text-slate-500 mb-1.5">
              起始版本（旧）
            </label>
            <select
              value={fromVersionId}
              onChange={(e) => setFromVersionId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-300"
            >
              {sortedVersions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.version_label} - {formatDate(v.created_at)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end pb-2">
            <ArrowRight className="w-5 h-5 text-slate-400" />
          </div>

          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs text-slate-500 mb-1.5">
              目标版本（新）
            </label>
            <select
              value={toVersionId}
              onChange={(e) => setToVersionId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-300"
            >
              {sortedVersions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.version_label} - {formatDate(v.created_at)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 对比摘要 */}
        {fromVersion && toVersion && fromVersion.id !== toVersion.id && (
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <DiffStat label="修改" value={changeStats.modified} cls="text-amber-600" />
            <DiffStat label="新增" value={changeStats.added} cls="text-green-600" />
            <DiffStat label="删除" value={changeStats.removed} cls="text-red-600" />
            <DiffStat label="未变" value={changeStats.unchanged} cls="text-slate-500" />
          </div>
        )}
      </div>

      {/* ===== 差异列表 ===== */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <GitCompare className="w-4 h-4 text-brand-600" />
            差异详情
          </h3>
          <span className="text-xs text-slate-400">
            {fromVersion?.version_label} → {toVersion?.version_label}
          </span>
        </div>

        {!fromVersion || !toVersion ? (
          <div className="py-12 text-center text-sm text-slate-400">
            请选择两个版本进行对比
          </div>
        ) : fromVersion.id === toVersion.id ? (
          <div className="py-12 text-center">
            <Check className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-400">请选择两个不同的版本进行对比</p>
          </div>
        ) : changes.length === 0 ? (
          <div className="py-12 text-center">
            <Check className="w-10 h-10 text-green-300 mx-auto mb-2" />
            <p className="text-sm text-slate-400">两版本内容完全一致，无差异</p>
          </div>
        ) : (
          <div className="space-y-3">
            {changes.map((change, idx) => (
              <ChangeCard key={idx} change={change} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ===== 差异统计小卡片 =====
function DiffStat({
  label,
  value,
  cls,
}: {
  label: string;
  value: number;
  cls: string;
}) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-center">
      <div className={`text-2xl font-bold ${cls}`}>{value}</div>
      <div className="text-xs text-slate-400 mt-0.5">{label}</div>
    </div>
  );
}

// ===== 单条变更卡片 =====
function ChangeCard({ change }: { change: VersionChange }) {
  const config = CHANGE_TYPE_CONFIG[change.change_type];
  const Icon = CHANGE_TYPE_ICONS[change.change_type];
  const impactCfg = RISK_IMPACT_CONFIG[change.risk_impact];

  return (
    <div
      className="rounded-lg border p-4"
      style={{ borderColor: `${config.color}33`, backgroundColor: config.bg }}
    >
      <div className="flex items-start gap-3">
        {/* 变更类型图标 */}
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${config.color}1a` }}
        >
          <Icon className="w-4 h-4" style={{ color: config.color }} />
        </div>

        <div className="flex-1 min-w-0">
          {/* 头部：条款编号 + 变更类型标签 + 风险影响标签 */}
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span className="font-medium text-slate-800">
              {change.clause_id}
            </span>
            <span
              className="inline-flex items-center text-xs px-1.5 py-0.5 rounded font-medium"
              style={{ color: config.color, backgroundColor: `${config.color}1a` }}
            >
              {config.label}
            </span>
            {change.change_type !== 'unchanged' && (
              <span
                className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded font-medium ${impactCfg.cls}`}
              >
                <AlertTriangle className="w-3 h-3" />
                {impactCfg.label}
              </span>
            )}
          </div>

          {/* 旧文本（删除线） */}
          {change.old_text && (
            <div className="mb-2">
              <div className="text-xs text-slate-400 mb-1">旧版本</div>
              <div className="text-sm text-red-700 line-through decoration-red-300 bg-red-50/60 rounded px-2 py-1.5 leading-relaxed">
                {change.old_text}
              </div>
            </div>
          )}

          {/* 新文本 */}
          {change.new_text && (
            <div className="mb-2">
              <div className="text-xs text-slate-400 mb-1">新版本</div>
              <div className="text-sm text-green-700 bg-green-50/60 rounded px-2 py-1.5 leading-relaxed">
                {change.new_text}
              </div>
            </div>
          )}

          {/* 变更描述 */}
          <div className="text-sm text-slate-600 leading-relaxed mt-2">
            {change.description}
          </div>
        </div>
      </div>
    </div>
  );
}
