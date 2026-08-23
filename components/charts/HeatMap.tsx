'use client';

// ===== 热力图组件 =====
// 网格布局，每个格子颜色深浅表示风险数量
// hover显示详情tooltip
// 使用 Tailwind CSS

import { useState } from 'react';

interface HeatmapDataItem {
  clause_type: string;
  risk_count: number;
  avg_severity: number;
}

interface HeatMapProps {
  data: HeatmapDataItem[];
}

// 根据数值占比返回背景色（从浅到深的紫色渐变）
function getHeatColor(ratio: number): string {
  if (ratio < 0.15) return '#f5f3ff';
  if (ratio < 0.3) return '#ddd6fe';
  if (ratio < 0.45) return '#c4b5fd';
  if (ratio < 0.6) return '#a78bfa';
  if (ratio < 0.75) return '#8b5cf6';
  if (ratio < 0.9) return '#7c3aed';
  return '#5b21b6';
}

// 根据数值占比返回文字颜色（深色背景用白色文字）
function getTextColor(ratio: number): string {
  return ratio >= 0.45 ? '#ffffff' : '#4c1d95';
}

// 根据严重度返回等级标签和颜色
function getSeverityInfo(severity: number): { label: string; color: string } {
  if (severity >= 75) return { label: '高', color: '#dc2626' };
  if (severity >= 50) return { label: '中', color: '#d97706' };
  return { label: '低', color: '#16a34a' };
}

export default function HeatMap({ data }: HeatMapProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const maxCount = Math.max(...data.map(d => d.risk_count), 1);
  const totalRisks = data.reduce((sum, d) => sum + d.risk_count, 0);
  const avgSeverity = data.length > 0
    ? Math.round(data.reduce((sum, d) => sum + d.avg_severity, 0) / data.length)
    : 0;

  return (
    <div className="w-full">
      {/* 摘要统计 */}
      <div className="flex items-center gap-4 mb-4 flex-wrap">
        <div className="text-xs text-slate-500">
          条款类型：<span className="font-semibold text-slate-700">{data.length}</span> 类
        </div>
        <div className="text-xs text-slate-500">
          风险总数：<span className="font-semibold text-slate-700">{totalRisks}</span> 项
        </div>
        <div className="text-xs text-slate-500">
          平均严重度：<span className="font-semibold text-slate-700">{avgSeverity}</span>
        </div>
      </div>

      {/* 网格 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        {data.map((item, idx) => {
          const ratio = item.risk_count / maxCount;
          const bg = getHeatColor(ratio);
          const textColor = getTextColor(ratio);
          const severityInfo = getSeverityInfo(item.avg_severity);
          const isHovered = hoveredIdx === idx;

          return (
            <div
              key={idx}
              className="relative rounded-lg p-3 cursor-pointer transition-all duration-200 group"
              style={{
                backgroundColor: bg,
                transform: isHovered ? 'scale(1.05)' : 'scale(1)',
                zIndex: isHovered ? 10 : 1,
                boxShadow: isHovered ? '0 8px 25px rgba(124, 58, 237, 0.25)' : 'none',
              }}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              {/* 条款类型名称 */}
              <div
                className="text-xs font-medium mb-1 truncate"
                style={{ color: textColor }}
              >
                {item.clause_type}
              </div>

              {/* 风险数量 */}
              <div className="flex items-baseline gap-1">
                <span
                  className="text-2xl font-bold"
                  style={{ color: textColor }}
                >
                  {item.risk_count}
                </span>
                <span
                  className="text-xs"
                  style={{ color: textColor, opacity: 0.7 }}
                >
                  项风险
                </span>
              </div>

              {/* 严重度标签 */}
              <div className="flex items-center gap-1 mt-1">
                <span
                  className="inline-block px-1.5 py-0.5 rounded text-xs font-medium"
                  style={{
                    backgroundColor: ratio >= 0.45 ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.6)',
                    color: ratio >= 0.45 ? textColor : severityInfo.color,
                  }}
                >
                  {severityInfo.label}严重
                </span>
              </div>

              {/* Tooltip */}
              {isHovered && (
                <div className="absolute z-30 left-1/2 -translate-x-1/2 -top-2 -translate-y-full bg-slate-800 text-white text-xs rounded-lg shadow-xl px-3 py-2 whitespace-nowrap pointer-events-none">
                  <div className="font-semibold mb-1">{item.clause_type}</div>
                  <div className="text-slate-300">风险数量：{item.risk_count} 项</div>
                  <div className="text-slate-300">平均严重度：{item.avg_severity}</div>
                  <div className="text-slate-300">严重等级：{severityInfo.label}</div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 图例 */}
      <div className="flex items-center justify-end gap-2 mt-4">
        <span className="text-xs text-slate-400">低</span>
        <div className="flex items-center gap-0.5">
          <div className="w-5 h-3 rounded-sm" style={{ backgroundColor: '#f5f3ff' }} />
          <div className="w-5 h-3 rounded-sm" style={{ backgroundColor: '#c4b5fd' }} />
          <div className="w-5 h-3 rounded-sm" style={{ backgroundColor: '#8b5cf6' }} />
          <div className="w-5 h-3 rounded-sm" style={{ backgroundColor: '#7c3aed' }} />
          <div className="w-5 h-3 rounded-sm" style={{ backgroundColor: '#5b21b6' }} />
        </div>
        <span className="text-xs text-slate-400">高</span>
      </div>
    </div>
  );
}
