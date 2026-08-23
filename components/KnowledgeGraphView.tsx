'use client';

// ===== 合同知识图谱可视化组件 =====
// 基于 SVG 的交互式知识图谱：节点/边渲染、拖拽平移、滚轮缩放、
// 节点高亮、搜索筛选、类型过滤、洞察关联与全屏查看
// 使用 CSS transform 实现平移与缩放

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Share2, Search, ZoomIn, ZoomOut, Maximize, Network,
  Lightbulb, AlertTriangle, Info, Eye, Filter, Circle,
} from 'lucide-react';
import {
  getMockKnowledgeGraph,
  getMockInsights,
  GRAPH_ENTITY_TYPE_COLORS,
  GRAPH_RELATION_LINE_STYLE,
} from '@/lib/knowledge-graph';
import {
  KnowledgeGraph,
  GraphNode,
  GraphEdge,
  GraphInsight,
  GraphEntityType,
  GraphRelationType,
  GRAPH_ENTITY_TYPE_LABELS,
  GRAPH_RELATION_TYPE_LABELS,
} from '@/lib/types';

// 全部实体类型（用于统计与筛选）
const ALL_ENTITY_TYPES: GraphEntityType[] = [
  'contract', 'party', 'clause', 'risk', 'payment', 'date', 'obligation',
];

// 全部关系类型
const ALL_RELATION_TYPES: GraphRelationType[] = [
  'has_party', 'has_clause', 'has_risk', 'has_payment',
  'has_date', 'references', 'conflicts_with', 'depends_on',
];

// 节点基础半径（按类型）
const NODE_BASE_RADIUS: Record<GraphEntityType, number> = {
  contract: 24,
  party: 20,
  clause: 17,
  risk: 18,
  payment: 15,
  date: 14,
  obligation: 16,
};

// SVG 画布尺寸
const CANVAS_W = 1100;
const CANVAS_H = 720;

// 缩放上下限
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 3;

// ===== 主组件 =====
export default function KnowledgeGraphView() {
  const [graph, setGraph] = useState<KnowledgeGraph | null>(null);
  const [insights, setInsights] = useState<GraphInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 交互状态
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [searchQuery, setSearchQuery] = useState('');
  const [hiddenTypes, setHiddenTypes] = useState<Set<GraphEntityType>>(new Set());
  const [activeInsightId, setActiveInsightId] = useState<string | null>(null);

  // 视图变换状态（pan / zoom，基于 CSS transform）
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null);

  // ===== 初始化：优先从 API 获取，失败则客户端构建 =====
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/knowledge-graph', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (mounted && data.graph) {
            setGraph(data.graph);
            setInsights(data.insights || getMockInsights());
            setLoading(false);
            return;
          }
        }
        throw new Error('API 返回异常');
      } catch {
        // 回退：直接在客户端构建图谱
        if (mounted) {
          setGraph(getMockKnowledgeGraph());
          setInsights(getMockInsights());
          setError(null);
          setLoading(false);
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // ===== 滚轮缩放（非被动监听，阻止默认页面滚动） =====
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * factor));
      // 保持光标下的图点不动
      const graphX = (mouseX - pan.x) / zoom;
      const graphY = (mouseY - pan.y) / zoom;
      setPan({ x: mouseX - graphX * newZoom, y: mouseY - graphY * newZoom });
      setZoom(newZoom);
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [zoom, pan]);

  // ===== 拖拽平移 =====
  const handleMouseDown = (e: React.MouseEvent) => {
    // 仅在点击背景（非节点）时启动平移
    if ((e.target as Element).closest('[data-node-id]')) return;
    dragRef.current = { startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setPan({ x: dragRef.current.panX + dx, y: dragRef.current.panY + dy });
  };

  const handleMouseUp = () => {
    dragRef.current = null;
  };

  // ===== 缩放控制（按钮） =====
  const zoomBy = useCallback(
    (factor: number) => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      // 以画布中心为缩放基点
      const mouseX = rect.width / 2;
      const mouseY = rect.height / 2;
      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * factor));
      const graphX = (mouseX - pan.x) / zoom;
      const graphY = (mouseY - pan.y) / zoom;
      setPan({ x: mouseX - graphX * newZoom, y: mouseY - graphY * newZoom });
      setZoom(newZoom);
    },
    [zoom, pan]
  );

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const toggleFullscreen = () => {
    setIsFullscreen((prev) => !prev);
  };

  // ===== 导出/分享图谱（下载为 JSON） =====
  const handleShare = () => {
    try {
      const payload = JSON.stringify(
        { graph, insights, stats, exported_at: new Date().toISOString() },
        null,
        2
      );
      const blob = new Blob([payload], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'contract-knowledge-graph.json';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // 静默失败（演示模式）
    }
  };

  // ===== 节点交互 =====
  const handleNodeClick = (node: GraphNode) => {
    setSelectedNodeId((prev) => (prev === node.id ? null : node.id));
    setActiveInsightId(null);
  };

  const handleNodeEnter = (node: GraphNode, e: React.MouseEvent) => {
    setHoveredNodeId(node.id);
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      setTooltipPos({ x: e.clientX - rect.left + 14, y: e.clientY - rect.top + 14 });
    }
  };

  const handleNodeMouseMove = (e: React.MouseEvent) => {
    if (!hoveredNodeId) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      setTooltipPos({ x: e.clientX - rect.left + 14, y: e.clientY - rect.top + 14 });
    }
  };

  // ===== 类型筛选 =====
  const toggleType = (t: GraphEntityType) => {
    setHiddenTypes((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  };

  const isNodeVisible = (n: GraphNode) => !hiddenTypes.has(n.type);

  // ===== 搜索 =====
  const searchResults = useMemo<GraphNode[]>(() => {
    if (!graph || !searchQuery.trim()) return [];
    const q = searchQuery.trim().toLowerCase();
    return graph.nodes.filter((n) => {
      if (n.label.toLowerCase().includes(q)) return true;
      return Object.values(n.properties).some(
        (v) => typeof v === 'string' && v.toLowerCase().includes(q)
      );
    });
  }, [graph, searchQuery]);

  const hasSearch = searchQuery.trim().length > 0;

  // ===== 连接数统计（用于节点大小） =====
  const connectionCounts = useMemo(() => {
    const counts = new Map<string, number>();
    if (!graph) return counts;
    for (const n of graph.nodes) counts.set(n.id, 0);
    for (const e of graph.edges) {
      counts.set(e.source, (counts.get(e.source) || 0) + 1);
      counts.set(e.target, (counts.get(e.target) || 0) + 1);
    }
    return counts;
  }, [graph]);

  // 节点半径 = 基础半径 + 连接数加成
  const nodeRadius = (node: GraphNode) => {
    const base = NODE_BASE_RADIUS[node.type];
    const conn = connectionCounts.get(node.id) || 0;
    return base + Math.min(conn, 6) * 1.4;
  };

  // ===== 高亮集合计算 =====
  // 优先级：洞察 > 选中节点 > 搜索
  const { highlightedNodeIds, highlightedEdgeIds, hasFocus } = useMemo(() => {
    if (!graph) {
      return { highlightedNodeIds: new Set<string>(), highlightedEdgeIds: new Set<string>(), hasFocus: false };
    }
    const nodeSet = new Set<string>();
    const edgeSet = new Set<string>();

    if (activeInsightId) {
      const insight = insights.find((i) => i.id === activeInsightId);
      if (insight) {
        insight.related_nodes.forEach((id) => nodeSet.add(id));
        // 高亮 related_nodes 之间的边
        for (const e of graph.edges) {
          if (nodeSet.has(e.source) && nodeSet.has(e.target)) edgeSet.add(e.id);
        }
      }
    } else if (selectedNodeId) {
      nodeSet.add(selectedNodeId);
      // 高亮直接相连的边与邻居
      for (const e of graph.edges) {
        if (e.source === selectedNodeId || e.target === selectedNodeId) {
          edgeSet.add(e.id);
          nodeSet.add(e.source);
          nodeSet.add(e.target);
        }
      }
    } else if (hasSearch && searchResults.length > 0) {
      searchResults.forEach((n) => nodeSet.add(n.id));
      for (const e of graph.edges) {
        if (nodeSet.has(e.source) && nodeSet.has(e.target)) edgeSet.add(e.id);
      }
    }

    return {
      highlightedNodeIds: nodeSet,
      highlightedEdgeIds: edgeSet,
      hasFocus: nodeSet.size > 0,
    };
  }, [graph, activeInsightId, selectedNodeId, hasSearch, searchResults, insights]);

  // ===== 选中节点的直接连接 =====
  const selectedNode = useMemo(() => {
    if (!graph || !selectedNodeId) return null;
    return graph.nodes.find((n) => n.id === selectedNodeId) || null;
  }, [graph, selectedNodeId]);

  const selectedConnections = useMemo(() => {
    if (!graph || !selectedNodeId) return [];
    const result: { node: GraphNode; edge: GraphEdge }[] = [];
    for (const edge of graph.edges) {
      if (edge.source === selectedNodeId) {
        const node = graph.nodes.find((n) => n.id === edge.target);
        if (node) result.push({ node, edge });
      } else if (edge.target === selectedNodeId) {
        const node = graph.nodes.find((n) => n.id === edge.source);
        if (node) result.push({ node, edge });
      }
    }
    return result;
  }, [graph, selectedNodeId]);

  // ===== 加载/错误占位 =====
  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
        <div className="inline-block w-8 h-8 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin mb-3" />
        <p className="text-slate-500">正在构建知识图谱...</p>
      </div>
    );
  }

  if (error || !graph) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
        <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
        <p className="text-slate-500">{error || '图谱加载失败'}</p>
      </div>
    );
  }

  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));
  const stats = graph.stats;

  // 画布高度：全屏时填充视口，普通模式固定高度（保证至少 600px 可视区域）
  const canvasHeight = isFullscreen ? 'calc(100vh - 110px)' : '660px';

  // ===== 图谱画布渲染 =====
  const renderCanvas = () => (
    <div
      ref={containerRef}
      className="relative bg-slate-50 rounded-xl border border-slate-200 overflow-hidden"
      style={{ height: '100%', minHeight: '600px' }}
    >
      {/* 拖拽/缩放容器：CSS transform 实现平移与缩放 */}
      <div
        className="absolute top-0 left-0"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0',
          cursor: dragRef.current ? 'grabbing' : 'grab',
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <svg
          width={CANVAS_W}
          height={CANVAS_H}
          viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
          className="block select-none"
        >
          <defs>
            {/* 背景网格 */}
            <pattern id="kg-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e2e8f0" strokeWidth="1" />
            </pattern>
            {/* 节点投影 */}
            <filter id="kg-shadow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#0f172a" floodOpacity="0.18" />
            </filter>
          </defs>
          <rect width={CANVAS_W} height={CANVAS_H} fill="url(#kg-grid)" />

          {/* ===== 边 ===== */}
          {graph.edges.map((edge) => {
            const s = nodeMap.get(edge.source);
            const t = nodeMap.get(edge.target);
            if (!s || !t) return null;
            // 类型筛选：两端节点都可见才显示边
            if (!isNodeVisible(s) || !isNodeVisible(t)) return null;
            const isDashed = GRAPH_RELATION_LINE_STYLE[edge.type] === 'dashed';
            const isHighlighted = highlightedEdgeIds.has(edge.id);
            const dimmed = hasFocus && !isHighlighted;
            const sx = s.x ?? 0;
            const sy = s.y ?? 0;
            const tx = t.x ?? 0;
            const ty = t.y ?? 0;
            return (
              <g key={edge.id} opacity={dimmed ? 0.1 : 1}>
                <line
                  x1={sx}
                  y1={sy}
                  x2={tx}
                  y2={ty}
                  stroke={isHighlighted ? '#7c3aed' : '#94a3b8'}
                  strokeWidth={isHighlighted ? 2.5 : 1.5}
                  strokeDasharray={isDashed ? '6 4' : undefined}
                />
                {/* 关系标签（高亮时显示） */}
                {isHighlighted && (
                  <text
                    x={(sx + tx) / 2}
                    y={(sy + ty) / 2}
                    dy={-4}
                    textAnchor="middle"
                    fill="#64748b"
                    style={{ fontSize: 10, pointerEvents: 'none' }}
                  >
                    {edge.label}
                  </text>
                )}
              </g>
            );
          })}

          {/* ===== 节点 ===== */}
          {graph.nodes.map((node) => {
            if (!isNodeVisible(node)) return null;
            const color = GRAPH_ENTITY_TYPE_COLORS[node.type];
            const r = nodeRadius(node);
            const isHighlighted = highlightedNodeIds.has(node.id);
            const dimmed = hasFocus && !isHighlighted;
            const isSelected = selectedNodeId === node.id;
            const isHovered = hoveredNodeId === node.id;
            const cx = node.x ?? 0;
            const cy = node.y ?? 0;
            return (
              <g
                key={node.id}
                data-node-id={node.id}
                opacity={dimmed ? 0.2 : 1}
                style={{ cursor: 'pointer' }}
                onClick={() => handleNodeClick(node)}
                onMouseEnter={(e) => handleNodeEnter(node, e)}
                onMouseMove={handleNodeMouseMove}
                onMouseLeave={() => setHoveredNodeId(null)}
              >
                {/* 选中/高亮/悬停外环 */}
                {(isSelected || isHovered || isHighlighted) && (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={r + 6}
                    fill="none"
                    stroke={isSelected ? '#7c3aed' : isHighlighted ? '#a78bfa' : '#cbd5e1'}
                    strokeWidth={isSelected ? 2.5 : 2}
                    strokeDasharray={isSelected ? undefined : '4 3'}
                  />
                )}
                {/* 节点主体 */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill={color}
                  filter="url(#kg-shadow)"
                />
                {/* 节点类型首字图标 */}
                <text
                  x={cx}
                  y={cy}
                  dy="0.35em"
                  textAnchor="middle"
                  fill="#fff"
                  style={{ fontSize: r > 20 ? 13 : 11, fontWeight: 700, pointerEvents: 'none' }}
                >
                  {GRAPH_ENTITY_TYPE_LABELS[node.type].charAt(0)}
                </text>
                {/* 节点标签 */}
                <text
                  x={cx}
                  y={cy + r + 16}
                  textAnchor="middle"
                  fill="#334155"
                  style={{ fontSize: 12, fontWeight: 600, pointerEvents: 'none' }}
                >
                  {node.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* 悬停 tooltip */}
      {hoveredNodeId && graph && (() => {
        const node = graph.nodes.find((n) => n.id === hoveredNodeId);
        if (!node) return null;
        const propEntries = Object.entries(node.properties).slice(0, 4);
        return (
          <div
            className="absolute z-20 pointer-events-none bg-white rounded-lg border border-slate-200 shadow-lg p-3 max-w-[220px]"
            style={{ left: tooltipPos.x, top: tooltipPos.y }}
          >
            <div className="flex items-center gap-2 mb-2">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: GRAPH_ENTITY_TYPE_COLORS[node.type] }}
              />
              <span className="text-xs text-slate-400">
                {GRAPH_ENTITY_TYPE_LABELS[node.type]}
              </span>
            </div>
            <div className="font-semibold text-sm text-slate-800 mb-1.5">
              {node.label}
            </div>
            {propEntries.length > 0 && (
              <div className="space-y-0.5">
                {propEntries.map(([k, v]) => (
                  <div key={k} className="text-xs text-slate-500 flex justify-between gap-2">
                    <span className="text-slate-400">{k}</span>
                    <span className="truncate font-medium text-slate-600">
                      {typeof v === 'number' ? v.toLocaleString() : String(v)}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div className="text-[10px] text-slate-400 mt-2 pt-2 border-t border-slate-100">
              点击节点查看详情
            </div>
          </div>
        );
      })()}

      {/* 搜索结果浮层提示 */}
      {hasSearch && (
        <div className="absolute top-3 left-3 bg-white/95 backdrop-blur rounded-lg border border-slate-200 shadow px-3 py-2 text-xs text-slate-600">
          搜索到 <span className="font-semibold text-brand-600">{searchResults.length}</span> 个匹配节点
          {searchResults.length === 0 && <span className="text-slate-400 ml-1">（尝试其他关键词）</span>}
        </div>
      )}

      {/* 节点类型图例（右上角） */}
      <div className="absolute top-3 right-3 bg-white/95 backdrop-blur rounded-lg border border-slate-200 shadow px-3 py-2">
        <div className="text-[11px] font-medium text-slate-400 mb-1.5">节点类型</div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1">
          {ALL_ENTITY_TYPES.map((t) => {
            const hidden = hiddenTypes.has(t);
            return (
              <div key={t} className="flex items-center gap-1.5">
                <Circle
                  className="w-2.5 h-2.5"
                  style={{ color: GRAPH_ENTITY_TYPE_COLORS[t] }}
                  fill={hidden ? 'none' : GRAPH_ENTITY_TYPE_COLORS[t]}
                />
                <span className={`text-[11px] ${hidden ? 'text-slate-300 line-through' : 'text-slate-600'}`}>
                  {GRAPH_ENTITY_TYPE_LABELS[t]}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 底部工具栏 */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-white/95 backdrop-blur rounded-xl border border-slate-200 shadow px-2 py-1.5">
        <button
          onClick={() => zoomBy(1 / 1.2)}
          className="p-2 rounded-lg text-slate-500 hover:bg-slate-50 hover:text-brand-600 transition-colors"
          title="缩小"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <span className="text-xs text-slate-400 w-12 text-center tabular-nums">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={() => zoomBy(1.2)}
          className="p-2 rounded-lg text-slate-500 hover:bg-slate-50 hover:text-brand-600 transition-colors"
          title="放大"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <div className="w-px h-5 bg-slate-200 mx-0.5" />
        <button
          onClick={resetView}
          className="p-2 rounded-lg text-slate-500 hover:bg-slate-50 hover:text-brand-600 transition-colors"
          title="重置视图"
        >
          <Maximize className="w-4 h-4" />
        </button>
        <button
          onClick={toggleFullscreen}
          className={`p-2 rounded-lg transition-colors ${
            isFullscreen
              ? 'bg-brand-50 text-brand-600'
              : 'text-slate-500 hover:bg-slate-50 hover:text-brand-600'
          }`}
          title={isFullscreen ? '退出全屏' : '全屏查看'}
        >
          <Network className="w-4 h-4" />
        </button>
        <div className="w-px h-5 bg-slate-200 mx-0.5" />
        <button
          onClick={handleShare}
          className="p-2 rounded-lg text-slate-500 hover:bg-slate-50 hover:text-brand-600 transition-colors"
          title="导出图谱"
        >
          <Share2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  // ===== 主布局：左面板 + 画布 + 右面板 =====
  const mainContent = (
    <div className="flex flex-col lg:flex-row gap-4">
      {/* ===== 左侧边栏 ===== */}
      <aside className="lg:w-72 shrink-0 space-y-4">
        {/* 搜索框 */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Search className="w-4 h-4 text-brand-600" />
            <h3 className="font-semibold text-sm text-slate-700">节点搜索</h3>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSelectedNodeId(null);
                setActiveInsightId(null);
              }}
              placeholder="搜索节点名称或属性..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            />
            {hasSearch && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              >
                清除
              </button>
            )}
          </div>
        </div>

        {/* 节点类型筛选 */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-4 h-4 text-brand-600" />
            <h3 className="font-semibold text-sm text-slate-700">类型筛选</h3>
          </div>
          <div className="space-y-1.5">
            {ALL_ENTITY_TYPES.map((t) => {
              const hidden = hiddenTypes.has(t);
              const color = GRAPH_ENTITY_TYPE_COLORS[t];
              return (
                <label
                  key={t}
                  className="flex items-center gap-2 cursor-pointer group"
                >
                  <input
                    type="checkbox"
                    checked={!hidden}
                    onChange={() => toggleType(t)}
                    className="w-3.5 h-3.5 rounded border-slate-300 text-brand-600 focus:ring-brand-200"
                  />
                  <Circle
                    className="w-3 h-3"
                    style={{ color }}
                    fill={color}
                  />
                  <span className={`text-xs ${hidden ? 'text-slate-400' : 'text-slate-700'}`}>
                    {GRAPH_ENTITY_TYPE_LABELS[t]}
                  </span>
                  <span className="text-[10px] text-slate-400 ml-auto tabular-nums">
                    {stats.by_type[t] || 0}
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        {/* 选中节点详情 */}
        {selectedNode ? (
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-brand-600" />
                <h3 className="font-semibold text-sm text-slate-700">节点详情</h3>
              </div>
              <button
                onClick={() => setSelectedNodeId(null)}
                className="text-slate-400 hover:text-slate-600 text-xs"
              >
                关闭
              </button>
            </div>
            <div className="flex items-center gap-2 mb-3">
              <Circle
                className="w-3 h-3"
                style={{ color: GRAPH_ENTITY_TYPE_COLORS[selectedNode.type] }}
                fill={GRAPH_ENTITY_TYPE_COLORS[selectedNode.type]}
              />
              <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                {GRAPH_ENTITY_TYPE_LABELS[selectedNode.type]}
              </span>
              <span className="font-semibold text-sm text-slate-800">{selectedNode.label}</span>
            </div>
            {/* 属性 */}
            {Object.keys(selectedNode.properties).length > 0 && (
              <div className="space-y-1.5 mb-3">
                <div className="text-[11px] font-medium text-slate-400">属性</div>
                <div className="bg-slate-50 rounded-lg p-2 space-y-1">
                  {Object.entries(selectedNode.properties).map(([k, v]) => (
                    <div key={k} className="flex justify-between text-xs gap-2">
                      <span className="text-slate-400">{k}</span>
                      <span className="font-medium text-slate-600 text-right">
                        {typeof v === 'number' ? v.toLocaleString() : String(v)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* 关联节点列表 */}
            <div>
              <div className="text-[11px] font-medium text-slate-400 mb-1.5">
                关联节点（{selectedConnections.length}）
              </div>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {selectedConnections.map(({ node, edge }) => (
                  <div
                    key={`${edge.id}-${node.id}`}
                    className="flex items-center gap-2 p-1.5 rounded hover:bg-slate-50 cursor-pointer"
                    onClick={() => handleNodeClick(node)}
                  >
                    <Circle
                      className="w-2 h-2 shrink-0"
                      style={{ color: GRAPH_ENTITY_TYPE_COLORS[node.type] }}
                      fill={GRAPH_ENTITY_TYPE_COLORS[node.type]}
                    />
                    <span className="text-xs text-slate-600 truncate flex-1">{node.label}</span>
                    <span className="text-[10px] text-slate-400">
                      {GRAPH_RELATION_TYPE_LABELS[edge.type]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-dashed border-slate-200 p-4 text-center">
            <Eye className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-xs text-slate-400">点击图谱节点查看详情</p>
          </div>
        )}
      </aside>

      {/* ===== 画布区域 ===== */}
      <div className="flex-1 min-w-0" style={{ height: canvasHeight }}>
        {renderCanvas()}
      </div>

      {/* ===== 右侧边栏 ===== */}
      <aside className="lg:w-72 shrink-0 space-y-4">
        {/* 图谱统计 */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Network className="w-4 h-4 text-brand-600" />
            <h3 className="font-semibold text-sm text-slate-700">图谱统计</h3>
          </div>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="bg-brand-50 rounded-lg p-2.5 text-center">
              <div className="text-xl font-bold text-brand-700">{stats.total_nodes}</div>
              <div className="text-[11px] text-brand-600">节点总数</div>
            </div>
            <div className="bg-amber-50 rounded-lg p-2.5 text-center">
              <div className="text-xl font-bold text-amber-700">{stats.total_edges}</div>
              <div className="text-[11px] text-amber-600">边总数</div>
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="text-[11px] font-medium text-slate-400 mb-1">类型分布</div>
            {ALL_ENTITY_TYPES.map((t) => {
              const count = stats.by_type[t] || 0;
              const max = Math.max(...ALL_ENTITY_TYPES.map((x) => stats.by_type[x] || 0), 1);
              return (
                <div key={t} className="flex items-center gap-2">
                  <Circle
                    className="w-2 h-2 shrink-0"
                    style={{ color: GRAPH_ENTITY_TYPE_COLORS[t] }}
                    fill={GRAPH_ENTITY_TYPE_COLORS[t]}
                  />
                  <span className="text-xs text-slate-500 w-10 shrink-0">
                    {GRAPH_ENTITY_TYPE_LABELS[t]}
                  </span>
                  <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(count / max) * 100}%`,
                        backgroundColor: GRAPH_ENTITY_TYPE_COLORS[t],
                      }}
                    />
                  </div>
                  <span className="text-xs text-slate-600 w-5 text-right tabular-nums">{count}</span>
                </div>
              );
            })}
          </div>
          {/* 关系类型分布 */}
          <div className="mt-3 pt-3 border-t border-slate-100">
            <div className="text-[11px] font-medium text-slate-400 mb-1.5">关系分布</div>
            <div className="flex flex-wrap gap-1">
              {ALL_RELATION_TYPES.map((t) => {
                const count = stats.by_relation[t] || 0;
                const isDashed = GRAPH_RELATION_LINE_STYLE[t] === 'dashed';
                return (
                  <div
                    key={t}
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-50"
                    title={`${GRAPH_RELATION_TYPE_LABELS[t]}: ${count}`}
                  >
                    <svg width="14" height="6">
                      <line
                        x1="0"
                        y1="3"
                        x2="14"
                        y2="3"
                        stroke="#94a3b8"
                        strokeWidth="1.5"
                        strokeDasharray={isDashed ? '4 3' : undefined}
                      />
                    </svg>
                    <span className="text-[10px] text-slate-500">
                      {GRAPH_RELATION_TYPE_LABELS[t]}
                    </span>
                    <span className="text-[10px] text-slate-400 tabular-nums">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 图谱洞察 */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="w-4 h-4 text-brand-600" />
            <h3 className="font-semibold text-sm text-slate-700">图谱洞察</h3>
          </div>
          <div className="space-y-2">
            {insights.map((insight) => {
              const isActive = activeInsightId === insight.id;
              const Icon =
                insight.type === 'risk_cluster' || insight.type === 'anomaly'
                  ? AlertTriangle
                  : insight.type === 'recommendation'
                  ? Lightbulb
                  : Info;
              return (
                <button
                  key={insight.id}
                  onClick={() => {
                    setActiveInsightId((prev) => (prev === insight.id ? null : insight.id));
                    setSelectedNodeId(null);
                    setSearchQuery('');
                  }}
                  className={`w-full text-left p-2.5 rounded-lg border transition-all ${
                    isActive
                      ? 'border-brand-300 bg-brand-50'
                      : 'border-slate-200 hover:border-brand-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <Icon
                      className={`w-4 h-4 mt-0.5 shrink-0 ${
                        isActive ? 'text-brand-600' : 'text-slate-400'
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span
                          className={`text-[9px] px-1 py-0.5 rounded font-medium ${
                            insight.type === 'risk_cluster'
                              ? 'bg-red-100 text-red-600'
                              : insight.type === 'anomaly'
                              ? 'bg-amber-100 text-amber-600'
                              : insight.type === 'recommendation'
                              ? 'bg-blue-100 text-blue-600'
                              : 'bg-purple-100 text-purple-600'
                          }`}
                        >
                          {insight.type === 'risk_cluster'
                            ? '风险聚类'
                            : insight.type === 'anomaly'
                            ? '异常'
                            : insight.type === 'recommendation'
                            ? '建议'
                            : '模式'}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          置信度 {Math.round(insight.confidence * 100)}%
                        </span>
                      </div>
                      <div className="text-xs font-medium text-slate-700 mb-1">
                        {insight.title}
                      </div>
                      <div className="text-[11px] text-slate-500 leading-relaxed">
                        {insight.description}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </aside>
    </div>
  );

  // ===== 全屏模式：固定覆盖层 =====
  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-[100] bg-slate-100 p-4 flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Network className="w-5 h-5 text-brand-600" />
            <span className="font-semibold text-slate-700">合同知识图谱（全屏）</span>
          </div>
          <button
            onClick={toggleFullscreen}
            className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-600 hover:bg-slate-50"
          >
            退出全屏
          </button>
        </div>
        <div className="flex-1 min-h-0">{mainContent}</div>
      </div>
    );
  }

  return mainContent;
}
