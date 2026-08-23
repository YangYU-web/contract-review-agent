'use client';

// ===== 环形图（饼图）组件 =====
// 纯SVG实现，不依赖第三方图表库
// 环形图（中间空心），中心显示总数，右侧图例

import { useState } from 'react';

interface DonutDataItem {
  label: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  data: DonutDataItem[];
  size?: number;
}

export default function DonutChart({ data, size = 220 }: DonutChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const total = data.reduce((sum, item) => sum + item.value, 0) || 1;
  const radius = size / 2;
  const strokeWidth = size * 0.14; // 环形宽度
  const innerRadius = radius - strokeWidth;
  const cx = radius;
  const cy = radius;

  // 计算每段的弧度
  let currentAngle = -Math.PI / 2; // 从顶部12点钟方向开始

  const segments = data.map((item, idx) => {
    const angle = (item.value / total) * Math.PI * 2;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;
    currentAngle = endAngle;

    // 计算弧形路径
    const x1 = cx + radius * Math.cos(startAngle);
    const y1 = cy + radius * Math.sin(startAngle);
    const x2 = cx + radius * Math.cos(endAngle);
    const y2 = cy + radius * Math.sin(endAngle);

    const x3 = cx + innerRadius * Math.cos(endAngle);
    const y3 = cy + innerRadius * Math.sin(endAngle);
    const x4 = cx + innerRadius * Math.cos(startAngle);
    const y4 = cy + innerRadius * Math.sin(startAngle);

    const largeArc = angle > Math.PI ? 1 : 0;

    const path = [
      `M ${x1} ${y1}`,
      `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
      `L ${x3} ${y3}`,
      `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x4} ${y4}`,
      'Z',
    ].join(' ');

    const percentage = Math.round((item.value / total) * 100);

    // 计算标签位置（中点角度）
    const midAngle = (startAngle + endAngle) / 2;
    const labelRadius = radius + 14;
    const labelX = cx + labelRadius * Math.cos(midAngle);
    const labelY = cy + labelRadius * Math.sin(midAngle);

    return {
      idx,
      path,
      color: item.color,
      label: item.label,
      value: item.value,
      percentage,
      labelX,
      labelY,
      midAngle,
    };
  });

  return (
    <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
      {/* SVG 环形图 */}
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="overflow-visible"
        >
          {/* 背景环 */}
          <circle
            cx={cx}
            cy={cy}
            r={(radius + innerRadius) / 2}
            fill="none"
            stroke="#f1f5f9"
            strokeWidth={strokeWidth}
          />

          {/* 各段 */}
          {segments.map(seg => {
            const isHovered = hoveredIndex === seg.idx;
            return (
              <path
                key={seg.idx}
                d={seg.path}
                fill={seg.color}
                style={{
                  transition: 'opacity 0.2s ease, transform 0.2s ease',
                  transformOrigin: `${cx}px ${cy}px`,
                  transform: isHovered ? 'scale(1.04)' : 'scale(1)',
                  opacity: hoveredIndex === null ? 1 : isHovered ? 1 : 0.4,
                  cursor: 'pointer',
                }}
                onMouseEnter={() => setHoveredIndex(seg.idx)}
                onMouseLeave={() => setHoveredIndex(null)}
              />
            );
          })}

          {/* 中心文字 */}
          <text
            x={cx}
            y={cy - 6}
            textAnchor="middle"
            className="fill-slate-800 font-bold"
            style={{ fontSize: size * 0.13 }}
          >
            {hoveredIndex !== null ? segments[hoveredIndex].value : total}
          </text>
          <text
            x={cx}
            y={cy + 12}
            textAnchor="middle"
            className="fill-slate-400"
            style={{ fontSize: size * 0.06 }}
          >
            {hoveredIndex !== null ? `${segments[hoveredIndex].percentage}%` : '总数'}
          </text>
        </svg>

        {/* Tooltip */}
        {hoveredIndex !== null && (
          <div
            className="absolute z-20 bg-slate-800 text-white text-xs px-2.5 py-1.5 rounded shadow-lg whitespace-nowrap pointer-events-none"
            style={{
              left: segments[hoveredIndex].labelX,
              top: segments[hoveredIndex].labelY,
              transform: 'translate(-50%, -120%)',
            }}
          >
            <div className="font-medium">{segments[hoveredIndex].label}</div>
            <div className="text-slate-300">
              {segments[hoveredIndex].value} ({segments[hoveredIndex].percentage}%)
            </div>
          </div>
        )}
      </div>

      {/* 图例 */}
      <div className="flex-1 grid grid-cols-1 gap-1.5 min-w-0 w-full sm:w-auto">
        {data.map((item, idx) => {
          const isHovered = hoveredIndex === idx;
          const percentage = Math.round((item.value / total) * 100);
          return (
            <div
              key={idx}
              className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer transition-colors ${
                isHovered ? 'bg-slate-100' : 'hover:bg-slate-50'
              }`}
              onMouseEnter={() => setHoveredIndex(idx)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              <span
                className="w-3 h-3 rounded-sm shrink-0 transition-transform"
                style={{
                  backgroundColor: item.color,
                  transform: isHovered ? 'scale(1.2)' : 'scale(1)',
                }}
              />
              <span className="text-xs text-slate-600 truncate flex-1">{item.label}</span>
              <span className="text-xs font-medium text-slate-800 shrink-0">{item.value}</span>
              <span className="text-xs text-slate-400 shrink-0 w-8 text-right">{percentage}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
