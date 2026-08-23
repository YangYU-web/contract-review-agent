'use client';

// ===== 折线图组件 =====
// 纯SVG实现，不依赖第三方图表库
// 支持多条线、X轴标签、Y轴网格线、数据点圆点、hover显示数值
// 动画：线条从左到右绘制

import { useState, useEffect, useRef } from 'react';

interface LineSeries {
  label: string;
  values: number[];
  color: string;
}

interface LineChartProps {
  data: LineSeries[];
  height?: number;
}

export default function LineChart({ data, height = 280 }: LineChartProps) {
  const [hoveredPoint, setHoveredPoint] = useState<{ seriesIdx: number; pointIdx: number } | null>(null);
  const [animated, setAnimated] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(800);

  // 监听容器宽度变化（响应式）
  useEffect(() => {
    if (!containerRef.current) return;
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth);
      }
    };
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // 动画：组件挂载后触发线条绘制
  useEffect(() => {
    const timer = setTimeout(() => setAnimated(true), 50);
    return () => clearTimeout(timer);
  }, []);

  const width = containerWidth;
  const padding = { top: 24, right: 20, bottom: 36, left: 44 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // 所有数据点数量（取第一条线的长度作为X轴标签数）
  const labelsCount = data[0]?.values.length || 0;
  const allValues = data.flatMap(s => s.values);
  const maxValue = Math.max(...allValues, 1);
  const minValue = Math.min(...allValues, 0);

  // X轴标签（从第一条线的数据点数量推断月份）
  const monthLabels = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
  const labels = monthLabels.slice(0, labelsCount);

  // 计算坐标
  const getX = (idx: number) => {
    if (labelsCount <= 1) return padding.left + chartWidth / 2;
    return padding.left + (idx / (labelsCount - 1)) * chartWidth;
  };
  const getY = (value: number) => {
    const range = maxValue - minValue || 1;
    return padding.top + chartHeight - ((value - minValue) / range) * chartHeight;
  };

  // 生成路径
  const getLinePath = (values: number[]) => {
    return values
      .map((value, idx) => {
        const x = getX(idx);
        const y = getY(value);
        return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
      })
      .join(' ');
  };

  // 生成填充区域路径（渐变区域）
  const getAreaPath = (values: number[]) => {
    if (values.length === 0) return '';
    const startX = getX(0);
    const endX = getX(values.length - 1);
    const linePath = values
      .map((value, idx) => {
        const x = getX(idx);
        const y = getY(value);
        return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
      })
      .join(' ');
    return `${linePath} L ${endX} ${padding.top + chartHeight} L ${startX} ${padding.top + chartHeight} Z`;
  };

  // Y轴刻度（5格）
  const yTicks = Array.from({ length: 5 }, (_, i) => {
    const value = minValue + ((maxValue - minValue) * i) / 4;
    return Math.round(value);
  }).reverse();

  // 计算线条路径总长度（用于动画）
  const getPathLength = (values: number[]) => {
    let length = 0;
    for (let i = 1; i < values.length; i++) {
      const x1 = getX(i - 1);
      const y1 = getY(values[i - 1]);
      const x2 = getX(i);
      const y2 = getY(values[i]);
      length += Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    }
    return length;
  };

  return (
    <div ref={containerRef} className="w-full">
      {/* 图例 */}
      <div className="flex items-center gap-4 mb-2 flex-wrap">
        {data.map((series, idx) => (
          <div key={idx} className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: series.color }} />
            <span className="text-xs text-slate-600">{series.label}</span>
          </div>
        ))}
      </div>

      {/* SVG图表 */}
      <svg width={width} height={height} className="overflow-visible">
        <defs>
          {data.map((series, idx) => (
            <linearGradient key={idx} id={`area-gradient-${idx}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={series.color} stopOpacity="0.25" />
              <stop offset="100%" stopColor={series.color} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>

        {/* Y轴网格线 */}
        {yTicks.map((tick, idx) => {
          const y = padding.top + (chartHeight * idx) / 4;
          return (
            <g key={idx}>
              <line
                x1={padding.left}
                y1={y}
                x2={padding.left + chartWidth}
                y2={y}
                stroke="#e2e8f0"
                strokeWidth="1"
                strokeDasharray="3 3"
              />
              <text
                x={padding.left - 8}
                y={y + 4}
                textAnchor="end"
                className="fill-slate-400"
                style={{ fontSize: 11 }}
              >
                {tick}
              </text>
            </g>
          );
        })}

        {/* X轴 */}
        <line
          x1={padding.left}
          y1={padding.top + chartHeight}
          x2={padding.left + chartWidth}
          y2={padding.top + chartHeight}
          stroke="#cbd5e1"
          strokeWidth="1"
        />

        {/* X轴标签 */}
        {labels.map((label, idx) => {
          const x = getX(idx);
          return (
            <text
              key={idx}
              x={x}
              y={padding.top + chartHeight + 20}
              textAnchor="middle"
              className="fill-slate-400"
              style={{ fontSize: 11 }}
            >
              {label}
            </text>
          );
        })}

        {/* 每条线的填充区域和线条 */}
        {data.map((series, seriesIdx) => {
          const linePath = getLinePath(series.values);
          const areaPath = getAreaPath(series.values);
          const pathLength = getPathLength(series.values);
          return (
            <g key={seriesIdx}>
              {/* 填充区域 */}
              {seriesIdx === 0 && (
                <path
                  d={areaPath}
                  fill={`url(#area-gradient-${seriesIdx})`}
                  style={{
                    opacity: animated ? 1 : 0,
                    transition: 'opacity 0.8s ease 0.3s',
                  }}
                />
              )}

              {/* 线条 */}
              <path
                d={linePath}
                fill="none"
                stroke={series.color}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  strokeDasharray: pathLength,
                  strokeDashoffset: animated ? 0 : pathLength,
                  transition: 'stroke-dashoffset 1.2s ease',
                }}
              />

              {/* 数据点 */}
              {series.values.map((value, pointIdx) => {
                const x = getX(pointIdx);
                const y = getY(value);
                const isHovered =
                  hoveredPoint?.seriesIdx === seriesIdx && hoveredPoint.pointIdx === pointIdx;
                return (
                  <g key={pointIdx}>
                    {/* 透明的大点击区域 */}
                    <circle
                      cx={x}
                      cy={y}
                      r="10"
                      fill="transparent"
                      style={{ cursor: 'pointer' }}
                      onMouseEnter={() => setHoveredPoint({ seriesIdx, pointIdx })}
                      onMouseLeave={() => setHoveredPoint(null)}
                    />
                    {/* 实际数据点 */}
                    <circle
                      cx={x}
                      cy={y}
                      r={isHovered ? 5.5 : 3.5}
                      fill="white"
                      stroke={series.color}
                      strokeWidth="2"
                      style={{
                        transition: 'r 0.15s ease',
                        opacity: animated ? 1 : 0,
                      }}
                    />
                  </g>
                );
              })}
            </g>
          );
        })}

        {/* Tooltip */}
        {hoveredPoint && (() => {
          const { seriesIdx, pointIdx } = hoveredPoint;
          const series = data[seriesIdx];
          const value = series.values[pointIdx];
          const x = getX(pointIdx);
          const y = getY(value);
          const tooltipWidth = 80;
          const tooltipHeight = 44;
          const tooltipX = Math.max(padding.left, Math.min(x - tooltipWidth / 2, width - padding.right - tooltipWidth));
          const tooltipY = Math.max(padding.top, y - tooltipHeight - 8);
          return (
            <g pointerEvents="none">
              {/* 竖直辅助线 */}
              <line
                x1={x}
                y1={padding.top}
                x2={x}
                y2={padding.top + chartHeight}
                stroke={series.color}
                strokeWidth="1"
                strokeDasharray="3 3"
                opacity="0.4"
              />
              <rect
                x={tooltipX}
                y={tooltipY}
                width={tooltipWidth}
                height={tooltipHeight}
                rx="6"
                fill="rgba(30, 41, 59, 0.95)"
              />
              <text
                x={tooltipX + tooltipWidth / 2}
                y={tooltipY + 16}
                textAnchor="middle"
                fill="white"
                style={{ fontSize: 11, fontWeight: 600 }}
              >
                {labels[pointIdx]}
              </text>
              <text
                x={tooltipX + tooltipWidth / 2}
                y={tooltipY + 32}
                textAnchor="middle"
                fill={series.color}
                style={{ fontSize: 12, fontWeight: 700 }}
              >
                {series.label}: {value}
              </text>
            </g>
          );
        })()}
      </svg>
    </div>
  );
}
