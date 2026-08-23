'use client';

// ===== 柱状图组件 =====
// 纯CSS实现，不依赖第三方图表库
// 支持纵向（默认）和横向两种布局

import { useState } from 'react';

interface BarDataItem {
  label: string;
  value: number;
  color?: string;
}

interface BarChartProps {
  data: BarDataItem[];
  height?: number;
  horizontal?: boolean;
}

const DEFAULT_COLOR = '#7c3aed';

export default function BarChart({
  data,
  height = 240,
  horizontal = false,
}: BarChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const maxValue = Math.max(...data.map(d => d.value), 1);

  // 横向布局
  if (horizontal) {
    return (
      <div className="w-full space-y-2" style={{ minHeight: height }}>
        {data.map((item, idx) => {
          const widthPercent = (item.value / maxValue) * 100;
          const isHovered = hoveredIndex === idx;
          const color = item.color || DEFAULT_COLOR;
          return (
            <div
              key={idx}
              className="group relative flex items-center gap-3"
              onMouseEnter={() => setHoveredIndex(idx)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              {/* 标签 */}
              <div className="w-24 sm:w-28 text-right shrink-0">
                <span className="text-xs text-slate-600 truncate block">{item.label}</span>
              </div>

              {/* 柱子容器 */}
              <div className="flex-1 relative h-7 bg-slate-100 rounded-md overflow-hidden">
                <div
                  className="h-full rounded-md transition-all duration-700 ease-out"
                  style={{
                    width: `${Math.max(widthPercent, 2)}%`,
                    backgroundColor: color,
                    opacity: isHovered ? 1 : 0.85,
                    filter: isHovered ? 'brightness(1.1)' : 'none',
                    transformOrigin: 'left',
                  }}
                />
                {/* 数值显示在柱子上 */}
                <div className="absolute inset-y-0 right-2 flex items-center">
                  <span
                    className={`text-xs font-medium transition-colors ${
                      isHovered ? 'text-white' : 'text-slate-600'
                    }`}
                    style={widthPercent > 15 ? { color: 'white' } : {}}
                  >
                    {item.value}
                  </span>
                </div>
              </div>

              {/* Tooltip */}
              {isHovered && (
                <div className="absolute z-20 left-28 -top-2 -translate-y-full bg-slate-800 text-white text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap pointer-events-none">
                  {item.label}: {item.value}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // 纵向布局（默认）
  return (
    <div className="w-full">
      <div
        className="flex items-end justify-around gap-1 sm:gap-2"
        style={{ height: height }}
      >
        {data.map((item, idx) => {
          const heightPercent = (item.value / maxValue) * 100;
          const isHovered = hoveredIndex === idx;
          const color = item.color || DEFAULT_COLOR;
          return (
            <div
              key={idx}
              className="flex-1 h-full flex flex-col items-center justify-end group relative"
              onMouseEnter={() => setHoveredIndex(idx)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              {/* 顶部数值 */}
              <div className="text-xs font-medium text-slate-700 mb-1 h-4">
                {isHovered ? (
                  <span className="text-slate-900 font-bold">{item.value}</span>
                ) : (
                  <span>{item.value}</span>
                )}
              </div>

              {/* 柱子 */}
              <div className="w-full px-0.5 flex-1 flex items-end">
                <div
                  className="w-full rounded-t-md transition-all duration-700 ease-out cursor-pointer"
                  style={{
                    height: `${Math.max(heightPercent, 2)}%`,
                    backgroundColor: color,
                    opacity: isHovered ? 1 : 0.85,
                    filter: isHovered ? 'brightness(1.1)' : 'none',
                    minHeight: '4px',
                  }}
                />
              </div>

              {/* 底部标签 */}
              <div className="mt-2 h-8 flex items-center justify-center">
                <span className="text-xs text-slate-500 text-center leading-tight truncate w-full px-1">
                  {item.label}
                </span>
              </div>

              {/* Tooltip */}
              {isHovered && (
                <div className="absolute z-20 -top-2 left-1/2 -translate-x-1/2 -translate-y-full bg-slate-800 text-white text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap pointer-events-none">
                  {item.label}: {item.value}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
