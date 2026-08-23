'use client';

// ===== 工作流可视化编辑器 =====
// 自包含组件：通过 /api/workflows 获取工作流定义与实例
// 左侧节点面板 + 中间 SVG 画布（可拖拽 / 连线 / 平移缩放）+ 右侧属性面板 + 底部实例列表
// 纯 SVG + HTML 实现，不依赖第三方流程图库

import { useRef, useState, useCallback, useEffect } from 'react';
import {
  Workflow,
  Plus,
  Save,
  Play,
  Settings,
  Trash2,
  GitBranch,
  Circle,
  Square,
  Diamond,
  Bell,
  Mail,
  ArrowRight,
  Clock,
} from 'lucide-react';
import {
  WorkflowDefinition,
  WorkflowNode,
  WorkflowEdge,
  WorkflowNodeType,
  WorkflowInstance,
  WORKFLOW_NODE_TYPE_LABELS,
} from '@/lib/types';
import { validateWorkflow } from '@/lib/workflow-engine';

// ===== 常量配置 =====

const NODE_W = 150;
const NODE_H = 64;
const CANVAS_W = 2000;
const CANVAS_H = 800;

// 节点类型外观配置（颜色 + 图标）
// start=green, approve=blue, review=purple, condition=amber, notify=cyan, end=gray
const NODE_TYPE_CONFIG: Record<
  WorkflowNodeType,
  { fill: string; stroke: string; text: string; icon: React.ElementType }
> = {
  start: { fill: '#f0fdf4', stroke: '#16a34a', text: '#15803d', icon: Circle },
  approve: { fill: '#eff6ff', stroke: '#2563eb', text: '#1d4ed8', icon: ArrowRight },
  review: { fill: '#f5f3ff', stroke: '#7c3aed', text: '#6d28d9', icon: Settings },
  condition: { fill: '#fffbeb', stroke: '#d97706', text: '#b45309', icon: Diamond },
  notify: { fill: '#ecfeff', stroke: '#0891b2', text: '#0e7490', icon: Bell },
  parallel: { fill: '#eef2ff', stroke: '#4f46e5', text: '#4338ca', icon: GitBranch },
  end: { fill: '#f8fafc', stroke: '#64748b', text: '#475569', icon: Square },
};

// 左侧可添加的节点类型清单
const NODE_PALETTE: { type: WorkflowNodeType; desc: string }[] = [
  { type: 'start', desc: '流程起点' },
  { type: 'approve', desc: '审批节点' },
  { type: 'review', desc: '审查节点' },
  { type: 'condition', desc: '条件分支' },
  { type: 'notify', desc: '通知节点' },
  { type: 'parallel', desc: '并行处理' },
  { type: 'end', desc: '流程终点' },
];

// 条件操作符标签
const CONDITION_OPERATORS = [
  { value: 'greater_than', label: '大于 (>)' },
  { value: 'less_than', label: '小于 (<)' },
  { value: 'equals', label: '等于 (=)' },
  { value: 'contains', label: '包含' },
];

// 生成节点 ID
function genId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}

// 计算节点某侧锚点
function getAnchor(node: WorkflowNode, side: 'right' | 'left' | 'top' | 'bottom') {
  switch (side) {
    case 'right':
      return { x: node.x + NODE_W, y: node.y + NODE_H / 2 };
    case 'left':
      return { x: node.x, y: node.y + NODE_H / 2 };
    case 'top':
      return { x: node.x + NODE_W / 2, y: node.y };
    case 'bottom':
      return { x: node.x + NODE_W / 2, y: node.y + NODE_H };
  }
}

// 计算两个节点之间的连线路径（贝塞尔曲线）
function edgePath(src: WorkflowNode, tgt: WorkflowNode): string {
  const srcCx = src.x + NODE_W / 2;
  const srcCy = src.y + NODE_H / 2;
  const tgtCx = tgt.x + NODE_W / 2;
  const tgtCy = tgt.y + NODE_H / 2;
  const dx = tgtCx - srcCx;
  const dy = tgtCy - srcCy;

  if (Math.abs(dx) >= Math.abs(dy)) {
    // 横向连接
    const p1 = getAnchor(src, dx >= 0 ? 'right' : 'left');
    const p2 = getAnchor(tgt, dx >= 0 ? 'left' : 'right');
    const ctrl = Math.max(40, Math.abs(dx) / 2);
    const c1x = p1.x + (dx >= 0 ? ctrl : -ctrl);
    const c2x = p2.x + (dx >= 0 ? -ctrl : ctrl);
    return `M ${p1.x} ${p1.y} C ${c1x} ${p1.y}, ${c2x} ${p2.y}, ${p2.x} ${p2.y}`;
  } else {
    // 纵向连接
    const p1 = getAnchor(src, dy >= 0 ? 'bottom' : 'top');
    const p2 = getAnchor(tgt, dy >= 0 ? 'top' : 'bottom');
    const ctrl = Math.max(40, Math.abs(dy) / 2);
    const c1y = p1.y + (dy >= 0 ? ctrl : -ctrl);
    const c2y = p2.y + (dy >= 0 ? -ctrl : ctrl);
    return `M ${p1.x} ${p1.y} C ${p1.x} ${c1y}, ${p2.x} ${c2y}, ${p2.x} ${p2.y}`;
  }
}

// 实例状态标签配置
const INSTANCE_STATUS_CONFIG: Record<
  WorkflowInstance['status'],
  { label: string; color: string; bg: string }
> = {
  running: { label: '运行中', color: '#d97706', bg: '#fffbeb' },
  completed: { label: '已完成', color: '#16a34a', bg: '#f0fdf4' },
  cancelled: { label: '已取消', color: '#6b7280', bg: '#f9fafb' },
  error: { label: '异常', color: '#dc2626', bg: '#fef2f2' },
};

export default function WorkflowEditor() {
  // ===== 数据状态 =====
  const [workflows, setWorkflows] = useState<WorkflowDefinition[]>([]);
  const [instances, setInstances] = useState<WorkflowInstance[]>([]);
  const [selectedWfId, setSelectedWfId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // ===== 编辑状态 =====
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [validation, setValidation] = useState<{ valid: boolean; errors: string[] } | null>(null);
  const [saving, setSaving] = useState(false);
  const [activating, setActivating] = useState(false);

  // ===== 画布状态（平移缩放） =====
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement | null>(null);

  // ===== 拖拽状态 =====
  const dragRef = useRef<{
    type: 'node' | 'pan';
    nodeId?: string;
    startClient: { x: number; y: number };
    startData: { x: number; y: number };
  } | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  // ===== 实例高亮 =====
  const [highlightInstanceId, setHighlightInstanceId] = useState<string | null>(null);

  // ===== 通知提示 =====
  const showToast = useCallback((type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    window.setTimeout(() => setToast(null), 2500);
  }, []);

  // ===== 加载数据 =====
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/workflows', { cache: 'no-store' });
      if (!res.ok) throw new Error('加载工作流失败');
      const data = await res.json();
      setWorkflows(data.workflows || []);
      setInstances(data.instances || []);
      if (data.workflows && data.workflows.length > 0 && !selectedWfId) {
        setSelectedWfId(data.workflows[0].id);
      }
    } catch {
      showToast('error', '加载工作流失败');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // 当前选中的工作流
  const currentWorkflow = workflows.find((w) => w.id === selectedWfId) || null;
  const selectedNode = currentWorkflow?.nodes.find((n) => n.id === selectedNodeId) || null;

  // 高亮实例的当前节点
  const highlightInstance = instances.find((i) => i.id === highlightInstanceId) || null;
  const highlightNodeLabels = highlightInstance
    ? new Set(highlightInstance.history.map((h) => h.node_label))
    : new Set<string>();
  // 当前节点 = 最后一条历史记录的 node_label
  const currentNodeLabel = highlightInstance?.history[highlightInstance.history.length - 1]?.node_label || null;

  // ===== 更新工作流到状态与 API =====
  const updateWorkflow = useCallback(
    (next: WorkflowDefinition) => {
      setWorkflows((prev) => prev.map((w) => (w.id === next.id ? next : w)));
    },
    []
  );

  // ===== 添加节点 =====
  const handleAddNode = useCallback(
    (type: WorkflowNodeType) => {
      if (!currentWorkflow) return;
      // start / end 只能有一个
      if ((type === 'start' || type === 'end') && currentWorkflow.nodes.some((n) => n.type === type)) {
        showToast('error', `${WORKFLOW_NODE_TYPE_LABELS[type]}节点已存在，每个流程只能有一个`);
        return;
      }
      const count = currentWorkflow.nodes.length;
      const newNode: WorkflowNode = {
        id: genId('node'),
        type,
        label: WORKFLOW_NODE_TYPE_LABELS[type],
        x: 120 + (count % 5) * 50,
        y: 100 + Math.floor(count / 5) * 100,
        config:
          type === 'condition'
            ? {
                condition_field: 'contract_value',
                condition_operator: 'greater_than',
                condition_value: '1000000',
                next_node_true: '',
                next_node_false: '',
              }
            : type === 'approve' || type === 'review'
            ? { assignee_role: '', sla_hours: 24 }
            : type === 'notify'
            ? { notification_template: '' }
            : {},
      };
      updateWorkflow({
        ...currentWorkflow,
        nodes: [...currentWorkflow.nodes, newNode],
        updated_at: new Date().toISOString(),
      });
      setSelectedNodeId(newNode.id);
    },
    [currentWorkflow, updateWorkflow, showToast]
  );

  // ===== 更新节点 =====
  const updateNode = useCallback(
    (nodeId: string, patch: Partial<WorkflowNode>) => {
      if (!currentWorkflow) return;
      updateWorkflow({
        ...currentWorkflow,
        nodes: currentWorkflow.nodes.map((n) =>
          n.id === nodeId ? { ...n, ...patch } : n
        ),
        updated_at: new Date().toISOString(),
      });
    },
    [currentWorkflow, updateWorkflow]
  );

  // ===== 更新节点 config =====
  const updateNodeConfig = useCallback(
    (nodeId: string, configPatch: Partial<WorkflowNode['config']>) => {
      if (!currentWorkflow) return;
      updateWorkflow({
        ...currentWorkflow,
        nodes: currentWorkflow.nodes.map((n) =>
          n.id === nodeId
            ? { ...n, config: { ...n.config, ...configPatch } }
            : n
        ),
        updated_at: new Date().toISOString(),
      });
    },
    [currentWorkflow, updateWorkflow]
  );

  // ===== 删除节点 =====
  const deleteNode = useCallback(
    (nodeId: string) => {
      if (!currentWorkflow) return;
      updateWorkflow({
        ...currentWorkflow,
        nodes: currentWorkflow.nodes.filter((n) => n.id !== nodeId),
        edges: currentWorkflow.edges.filter(
          (e) => e.source !== nodeId && e.target !== nodeId
        ),
        updated_at: new Date().toISOString(),
      });
      setSelectedNodeId(null);
    },
    [currentWorkflow, updateWorkflow]
  );

  // ===== 删除边 =====
  const deleteEdge = useCallback(
    (edgeId: string) => {
      if (!currentWorkflow) return;
      updateWorkflow({
        ...currentWorkflow,
        edges: currentWorkflow.edges.filter((e) => e.id !== edgeId),
        updated_at: new Date().toISOString(),
      });
    },
    [currentWorkflow, updateWorkflow]
  );

  // ===== 连线 =====
  const startConnect = useCallback((nodeId: string) => {
    setConnectingFrom(nodeId);
    setSelectedNodeId(nodeId);
  }, []);

  const finishConnect = useCallback(
    (targetId: string) => {
      if (!connectingFrom || !currentWorkflow) {
        setConnectingFrom(null);
        return;
      }
      if (connectingFrom === targetId) {
        setConnectingFrom(null);
        return;
      }
      const exists = currentWorkflow.edges.some(
        (e) => e.source === connectingFrom && e.target === targetId
      );
      if (exists) {
        showToast('error', '两个节点之间已存在连线');
        setConnectingFrom(null);
        return;
      }
      const newEdge: WorkflowEdge = {
        id: genId('edge'),
        source: connectingFrom,
        target: targetId,
      };
      updateWorkflow({
        ...currentWorkflow,
        edges: [...currentWorkflow.edges, newEdge],
        updated_at: new Date().toISOString(),
      });
      setConnectingFrom(null);
    },
    [connectingFrom, currentWorkflow, updateWorkflow, showToast]
  );

  // ===== 节点拖拽 / 画布平移 =====
  const onNodeMouseDown = useCallback(
    (e: React.MouseEvent, node: WorkflowNode) => {
      if (connectingFrom) {
        finishConnect(node.id);
        e.stopPropagation();
        return;
      }
      e.stopPropagation();
      dragRef.current = {
        type: 'node',
        nodeId: node.id,
        startClient: { x: e.clientX, y: e.clientY },
        startData: { x: node.x, y: node.y },
      };
      setDraggingId(node.id);
      setSelectedNodeId(node.id);
    },
    [connectingFrom, finishConnect]
  );

  const onCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    // 点击空白处：开始平移
    if (e.target === e.currentTarget || (e.target as HTMLElement).dataset.canvasBg) {
      dragRef.current = {
        type: 'pan',
        startClient: { x: e.clientX, y: e.clientY },
        startData: { x: pan.x, y: pan.y },
      };
      setSelectedNodeId(null);
      setConnectingFrom(null);
    }
  }, [pan]);

  // 全局监听 mousemove / mouseup
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const dx = e.clientX - drag.startClient.x;
      const dy = e.clientY - drag.startClient.y;

      if (drag.type === 'node' && drag.nodeId) {
        // 节点拖拽：将屏幕位移转换为画布位移（除以缩放）
        const nx = drag.startData.x + dx / zoom;
        const ny = drag.startData.y + dy / zoom;
        updateNode(drag.nodeId, {
          x: Math.max(0, Math.round(nx)),
          y: Math.max(0, Math.round(ny)),
        });
      } else if (drag.type === 'pan') {
        setPan({
          x: drag.startData.x + dx,
          y: drag.startData.y + dy,
        });
      }
    };
    const onUp = () => {
      dragRef.current = null;
      setDraggingId(null);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [zoom, updateNode]);

  // ===== 缩放（滚轮） =====
  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom((prev) => Math.max(0.3, Math.min(2.5, +(prev + delta).toFixed(2))));
  }, []);

  // ===== 操作栏：验证 =====
  const handleValidate = useCallback(() => {
    if (!currentWorkflow) return;
    const result = validateWorkflow(currentWorkflow);
    setValidation(result);
    if (result.valid) {
      showToast('success', '工作流校验通过');
    } else {
      showToast('error', `校验未通过：${result.errors.length} 项问题`);
    }
  }, [currentWorkflow, showToast]);

  // ===== 操作栏：保存 =====
  const handleSave = useCallback(async () => {
    if (!currentWorkflow) return;
    setSaving(true);
    try {
      // 保存时将所有节点 / 边更新到 API
      const promises = currentWorkflow.nodes.map((node) =>
        fetch('/api/workflows', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update_node',
            workflow_id: currentWorkflow.id,
            node_id: node.id,
            patch: { x: node.x, y: node.y, label: node.label, config: node.config },
          }),
        })
      );
      await Promise.all(promises);
      showToast('success', '工作流已保存');
    } catch {
      showToast('error', '保存失败');
    } finally {
      setSaving(false);
    }
  }, [currentWorkflow, showToast]);

  // ===== 操作栏：激活 =====
  const handleActivate = useCallback(async () => {
    if (!currentWorkflow) return;
    const result = validateWorkflow(currentWorkflow);
    setValidation(result);
    if (!result.valid) {
      showToast('error', '校验未通过，无法激活');
      return;
    }
    setActivating(true);
    try {
      const res = await fetch('/api/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'activate',
          workflow_id: currentWorkflow.id,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || '激活失败');
      }
      const data = await res.json();
      if (data.workflow) updateWorkflow(data.workflow);
      showToast('success', '工作流已激活');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : '激活失败');
    } finally {
      setActivating(false);
    }
  }, [currentWorkflow, updateWorkflow, showToast]);

  // 节点查找表
  const nodeMap = new Map(currentWorkflow?.nodes.map((n) => [n.id, n]) || []);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center text-sm text-slate-400">
        加载中...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ===== 工作流选择器 ===== */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Workflow className="w-4 h-4 text-brand-600" />
          <span className="font-semibold text-slate-800 text-sm">选择工作流</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {workflows.map((w) => (
            <button
              key={w.id}
              onClick={() => {
                setSelectedWfId(w.id);
                setSelectedNodeId(null);
                setValidation(null);
              }}
              className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
                w.id === selectedWfId
                  ? 'border-brand-300 bg-brand-50 text-brand-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {w.name}
              <span
                className={`ml-2 text-[10px] px-1.5 py-0.5 rounded-full ${
                  w.status === 'active'
                    ? 'bg-green-50 text-green-600'
                    : w.status === 'archived'
                    ? 'bg-slate-100 text-slate-500'
                    : 'bg-amber-50 text-amber-600'
                }`}
              >
                {w.status === 'active' ? '已激活' : w.status === 'archived' ? '已归档' : '草稿'}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ===== 编辑器主体 ===== */}
      {currentWorkflow ? (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          {/* 顶部工具栏 */}
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Workflow className="w-4 h-4 text-brand-600" />
              <span className="font-semibold text-slate-800 text-sm">{currentWorkflow.name}</span>
              <span className="text-xs text-slate-400">v{currentWorkflow.version}</span>
              <span className="text-xs text-slate-400">·</span>
              <span className="text-xs text-slate-400">{currentWorkflow.contract_type}</span>
            </div>
            <div className="flex items-center gap-2">
              {/* 缩放控制 */}
              <div className="flex items-center gap-1 mr-2">
                <button
                  onClick={() => setZoom((z) => Math.max(0.3, +(z - 0.1).toFixed(2)))}
                  className="w-7 h-7 rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 text-xs flex items-center justify-center"
                >
                  −
                </button>
                <span className="text-xs text-slate-500 w-10 text-center">{Math.round(zoom * 100)}%</span>
                <button
                  onClick={() => setZoom((z) => Math.min(2.5, +(z + 0.1).toFixed(2)))}
                  className="w-7 h-7 rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 text-xs flex items-center justify-center"
                >
                  +
                </button>
                <button
                  onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
                  className="px-2 h-7 rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 text-xs"
                >
                  重置
                </button>
              </div>
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-brand-700 bg-brand-50 hover:bg-brand-100 border border-brand-200 transition-colors disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                {saving ? '保存中...' : '保存'}
              </button>
              <button
                onClick={handleValidate}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors"
              >
                <Settings className="w-3.5 h-3.5" />
                验证
              </button>
              <button
                onClick={handleActivate}
                disabled={activating}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 transition-colors disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5" />
                {activating ? '激活中...' : '激活'}
              </button>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row">
            {/* 左侧节点面板 */}
            <div className="lg:w-44 shrink-0 border-b lg:border-b-0 lg:border-r border-slate-100 p-3">
              <div className="text-xs font-medium text-slate-500 mb-2 flex items-center gap-1">
                <Plus className="w-3.5 h-3.5" />
                节点类型
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-1 gap-2">
                {NODE_PALETTE.map((item) => {
                  const cfg = NODE_TYPE_CONFIG[item.type];
                  const Icon = cfg.icon;
                  return (
                    <button
                      key={item.type}
                      onClick={() => handleAddNode(item.type)}
                      className="flex items-center gap-2 p-2 rounded-lg border border-slate-100 hover:border-brand-200 hover:bg-brand-50 transition-colors text-left"
                      style={{ backgroundColor: cfg.fill }}
                    >
                      <Icon className="w-4 h-4 shrink-0" style={{ color: cfg.text }} />
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-slate-700 truncate">
                          {WORKFLOW_NODE_TYPE_LABELS[item.type]}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">
                          {item.desc}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 pt-3 border-t border-slate-100 text-[11px] text-slate-400 leading-relaxed">
                <p>点击添加节点到画布</p>
                <p className="mt-1">拖拽节点移动位置</p>
                <p className="mt-1">点击节点右侧圆点连线</p>
                <p className="mt-1">滚轮缩放 / 拖拽空白平移</p>
              </div>
            </div>

            {/* 中间画布 */}
            <div
              ref={containerRef}
              className="flex-1 min-w-0 bg-slate-50 relative overflow-hidden"
              style={{ height: 500 }}
              onMouseDown={onCanvasMouseDown}
              onWheel={onWheel}
            >
              {/* Toast 提示 */}
              {toast && (
                <div
                  className={`absolute top-3 left-1/2 -translate-x-1/2 z-30 px-3 py-1.5 rounded-lg text-xs font-medium shadow-sm ${
                    toast.type === 'success'
                      ? 'bg-green-50 text-green-700 border border-green-100'
                      : 'bg-red-50 text-red-700 border border-red-100'
                  }`}
                >
                  {toast.msg}
                </div>
              )}
              {connectingFrom && (
                <div className="absolute top-3 left-3 z-30 px-3 py-1.5 rounded-lg text-xs font-medium bg-brand-50 text-brand-700 border border-brand-100">
                  连线模式：请点击目标节点建立连线
                  <button
                    onClick={() => setConnectingFrom(null)}
                    className="ml-2 underline hover:text-brand-900"
                  >
                    取消
                  </button>
                </div>
              )}

              {/* 缩放平移容器 */}
              <div
                className="absolute top-0 left-0"
                style={{
                  width: CANVAS_W,
                  height: CANVAS_H,
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                  transformOrigin: '0 0',
                }}
              >
                {/* SVG 连线层 */}
                <svg
                  width={CANVAS_W}
                  height={CANVAS_H}
                  className="absolute top-0 left-0 pointer-events-none"
                  style={{ overflow: 'visible' }}
                >
                  <defs>
                    <marker
                      id="wf-arrow"
                      viewBox="0 0 10 10"
                      refX="9"
                      refY="5"
                      markerWidth="7"
                      markerHeight="7"
                      orient="auto-start-reverse"
                    >
                      <path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8" />
                    </marker>
                    <marker
                      id="wf-arrow-active"
                      viewBox="0 0 10 10"
                      refX="9"
                      refY="5"
                      markerWidth="7"
                      markerHeight="7"
                      orient="auto-start-reverse"
                    >
                      <path d="M 0 0 L 10 5 L 0 10 z" fill="#7c3aed" />
                    </marker>
                  </defs>

                  {/* 连线 */}
                  {currentWorkflow.edges.map((e) => {
                    const src = nodeMap.get(e.source);
                    const tgt = nodeMap.get(e.target);
                    if (!src || !tgt) return null;
                    const d = edgePath(src, tgt);
                    const isActive =
                      highlightNodeLabels.has(src.label) && highlightNodeLabels.has(tgt.label);
                    const midX = (src.x + tgt.x) / 2 + NODE_W / 2;
                    const midY = (src.y + tgt.y) / 2 + NODE_H / 2;
                    return (
                      <g key={e.id} className="group" style={{ pointerEvents: 'all' }}>
                        <path
                          d={d}
                          fill="none"
                          stroke={isActive ? '#7c3aed' : '#94a3b8'}
                          strokeWidth={isActive ? 2.5 : 1.8}
                          markerEnd={`url(#${isActive ? 'wf-arrow-active' : 'wf-arrow'})`}
                          className="transition-colors"
                        />
                        {/* 边标签 */}
                        {e.label && (
                          <g>
                            <rect
                              x={midX - 14}
                              y={midY - 9}
                              width="28"
                              height="18"
                              rx="9"
                              fill="white"
                              stroke="#cbd5e1"
                              strokeWidth="1"
                            />
                            <text
                              x={midX}
                              y={midY + 3}
                              textAnchor="middle"
                              style={{ fontSize: 10, fill: '#475569' }}
                            >
                              {e.label}
                            </text>
                          </g>
                        )}
                        {/* 删除边按钮 */}
                        <circle
                          cx={midX}
                          cy={midY + 16}
                          r="7"
                          fill="white"
                          stroke="#fca5a5"
                          strokeWidth="1"
                          className="opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            deleteEdge(e.id);
                          }}
                        />
                        <text
                          x={midX}
                          y={midY + 19}
                          textAnchor="middle"
                          className="cursor-pointer opacity-0 group-hover:opacity-100"
                          style={{ fontSize: 11, fill: '#ef4444' }}
                          onClick={(ev) => {
                            ev.stopPropagation();
                            deleteEdge(e.id);
                          }}
                        >
                          ×
                        </text>
                      </g>
                    );
                  })}
                </svg>

                {/* HTML 节点层 */}
                {currentWorkflow.nodes.map((node) => (
                  <NodeBox
                    key={node.id}
                    node={node}
                    selected={node.id === selectedNodeId}
                    connectingFrom={node.id === connectingFrom}
                    highlighted={highlightNodeLabels.has(node.label)}
                    isCurrent={node.label === currentNodeLabel}
                    dragging={node.id === draggingId}
                    onMouseDown={onNodeMouseDown}
                    onStartConnect={startConnect}
                  />
                ))}
              </div>

              {/* 校验结果浮层 */}
              {validation && (
                <div className="absolute bottom-3 right-3 z-30 max-w-xs">
                  {validation.valid ? (
                    <div className="px-3 py-2 rounded-lg bg-green-50 text-green-700 text-xs border border-green-100 flex items-center gap-1.5">
                      <Play className="w-3.5 h-3.5" />
                      校验通过
                    </div>
                  ) : (
                    <div className="px-3 py-2 rounded-lg bg-red-50 text-red-700 text-xs border border-red-100 space-y-1">
                      <div className="font-medium flex items-center gap-1.5">
                        <Settings className="w-3.5 h-3.5" />
                        {validation.errors.length} 项问题
                      </div>
                      {validation.errors.map((err, idx) => (
                        <div key={idx} className="text-[11px] text-red-600">• {err}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 右侧属性面板 */}
            <div className="lg:w-64 shrink-0 border-t lg:border-t-0 lg:border-l border-slate-100 p-3">
              <div className="text-xs font-medium text-slate-500 mb-3 flex items-center gap-1">
                <Settings className="w-3.5 h-3.5" />
                节点属性
              </div>
              {selectedNode ? (
                <NodePropertyPanel
                  node={selectedNode}
                  onUpdate={updateNode}
                  onUpdateConfig={updateNodeConfig}
                  onDelete={deleteNode}
                />
              ) : (
                <div className="py-8 text-center text-xs text-slate-400">
                  点击画布中的节点查看并编辑属性
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center text-sm text-slate-400">
          请在上方选择一个工作流进行编辑
        </div>
      )}

      {/* ===== 底部：工作流实例列表 ===== */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Play className="w-4 h-4 text-brand-600" />
          <h2 className="font-semibold text-slate-800 text-sm">运行实例</h2>
          <span className="text-xs text-slate-400">
            共 {instances.length} 个 · 点击高亮流程路径
          </span>
        </div>
        {instances.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-400">暂无运行实例</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {instances.map((inst) => {
              const cfg = INSTANCE_STATUS_CONFIG[inst.status];
              const isHighlighted = inst.id === highlightInstanceId;
              return (
                <button
                  key={inst.id}
                  onClick={() =>
                    setHighlightInstanceId(isHighlighted ? null : inst.id)
                  }
                  className={`text-left rounded-xl border p-3 transition-colors ${
                    isHighlighted
                      ? 'border-brand-300 bg-brand-50'
                      : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-medium text-slate-800 text-sm truncate">
                      {inst.contract_title}
                    </span>
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0"
                      style={{ color: cfg.color, backgroundColor: cfg.bg }}
                    >
                      {cfg.label}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 mb-2">{inst.workflow_name}</div>
                  {/* 步骤进度条 */}
                  <div className="flex items-center gap-1 flex-wrap">
                    {inst.history.map((h, idx) => {
                      const isLast = idx === inst.history.length - 1;
                      return (
                        <div key={idx} className="flex items-center gap-1">
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded ${
                              isLast && inst.status === 'running'
                                ? 'bg-amber-100 text-amber-700 font-medium'
                                : h.action === 'approve'
                                ? 'bg-green-50 text-green-600'
                                : h.action === 'timeout'
                                ? 'bg-red-50 text-red-600'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {h.node_label}
                          </span>
                          {idx < inst.history.length - 1 && (
                            <ArrowRight className="w-3 h-3 text-slate-300" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ===== 节点盒子组件（HTML 实现，支持 lucide 图标） =====
function NodeBox({
  node,
  selected,
  connectingFrom,
  highlighted,
  isCurrent,
  dragging,
  onMouseDown,
  onStartConnect,
}: {
  node: WorkflowNode;
  selected: boolean;
  connectingFrom: boolean;
  highlighted: boolean;
  isCurrent: boolean;
  dragging: boolean;
  onMouseDown: (e: React.MouseEvent, node: WorkflowNode) => void;
  onStartConnect: (nodeId: string) => void;
}) {
  const cfg = NODE_TYPE_CONFIG[node.type];
  const Icon = cfg.icon;

  return (
    <div
      className="absolute select-none"
      style={{
        left: node.x,
        top: node.y,
        width: NODE_W,
        height: NODE_H,
        cursor: dragging ? 'grabbing' : 'grab',
      }}
      onMouseDown={(e) => onMouseDown(e, node)}
    >
      {/* 选中 / 高亮外框 */}
      {(selected || highlighted) && (
        <div
          className="absolute -inset-1 rounded-xl"
          style={{
            border: `2px solid ${selected ? '#7c3aed' : cfg.stroke}`,
            opacity: 0.3,
          }}
        />
      )}
      {/* 节点主体 */}
      <div
        className="relative w-full h-full rounded-xl border-2 flex items-center gap-2 px-3 shadow-sm transition-shadow"
        style={{
          backgroundColor: cfg.fill,
          borderColor: selected ? '#7c3aed' : cfg.stroke,
          boxShadow: isCurrent ? `0 0 0 3px ${cfg.stroke}40` : undefined,
        }}
      >
        <Icon className="w-4 h-4 shrink-0" style={{ color: cfg.text }} />
        <div className="flex-1 min-w-0">
          <div
            className="text-xs font-medium truncate"
            style={{ color: cfg.text }}
          >
            {node.label}
          </div>
          <div className="text-[9px] text-slate-400 truncate">
            {WORKFLOW_NODE_TYPE_LABELS[node.type]}
          </div>
        </div>
        {/* 当前节点标记 */}
        {isCurrent && (
          <div
            className="absolute -top-1.5 -right-1.5 w-3 h-3 rounded-full animate-pulse"
            style={{ backgroundColor: cfg.stroke }}
          />
        )}
      </div>
      {/* 右侧连线圆点 */}
      <button
        className="absolute top-1/2 -translate-y-1/2 -right-1.5 w-3 h-3 rounded-full border-2 hover:scale-125 transition-transform"
        style={{
          backgroundColor: connectingFrom ? '#7c3aed' : '#fff',
          borderColor: cfg.stroke,
          cursor: 'crosshair',
        }}
        onMouseDown={(e) => {
          e.stopPropagation();
          onStartConnect(node.id);
        }}
      />
    </div>
  );
}

// ===== 节点属性面板 =====
function NodePropertyPanel({
  node,
  onUpdate,
  onUpdateConfig,
  onDelete,
}: {
  node: WorkflowNode;
  onUpdate: (nodeId: string, patch: Partial<WorkflowNode>) => void;
  onUpdateConfig: (nodeId: string, patch: Partial<WorkflowNode['config']>) => void;
  onDelete: (nodeId: string) => void;
}) {
  const cfg = NODE_TYPE_CONFIG[node.type];
  const Icon = cfg.icon;
  const isCondition = node.type === 'condition';
  const isApproveReview = node.type === 'approve' || node.type === 'review';
  const isNotify = node.type === 'notify';

  return (
    <div className="space-y-3">
      {/* 节点类型标识 */}
      <div
        className="flex items-center gap-2 p-2 rounded-lg"
        style={{ backgroundColor: cfg.fill }}
      >
        <Icon className="w-4 h-4" style={{ color: cfg.text }} />
        <span className="text-xs font-medium" style={{ color: cfg.text }}>
          {WORKFLOW_NODE_TYPE_LABELS[node.type]}
        </span>
      </div>

      {/* 节点标签 */}
      <div>
        <label className="block text-[11px] text-slate-500 mb-1">节点标签</label>
        <input
          type="text"
          value={node.label}
          onChange={(e) => onUpdate(node.id, { label: e.target.value })}
          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-100"
        />
      </div>

      {/* 位置（只读展示） */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[11px] text-slate-500 mb-1">X 坐标</label>
          <div className="px-2.5 py-1.5 rounded-lg bg-slate-50 text-xs text-slate-600">
            {Math.round(node.x)}
          </div>
        </div>
        <div>
          <label className="block text-[11px] text-slate-500 mb-1">Y 坐标</label>
          <div className="px-2.5 py-1.5 rounded-lg bg-slate-50 text-xs text-slate-600">
            {Math.round(node.y)}
          </div>
        </div>
      </div>

      {/* 审批 / 审查节点配置 */}
      {isApproveReview && (
        <>
          <div>
            <label className="block text-[11px] text-slate-500 mb-1 flex items-center gap-1">
              <ArrowRight className="w-3 h-3" />
              分配角色
            </label>
            <input
              type="text"
              value={node.config.assignee_role || ''}
              onChange={(e) =>
                onUpdateConfig(node.id, { assignee_role: e.target.value })
              }
              placeholder="如 法务经理"
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-100"
            />
          </div>
          <div>
            <label className="block text-[11px] text-slate-500 mb-1 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              SLA 时长（小时）
            </label>
            <input
              type="number"
              value={node.config.sla_hours ?? ''}
              onChange={(e) =>
                onUpdateConfig(node.id, {
                  sla_hours: Number(e.target.value) || 0,
                })
              }
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-100"
            />
          </div>
        </>
      )}

      {/* 条件节点配置 */}
      {isCondition && (
        <>
          <div className="pt-2 border-t border-slate-100">
            <div className="text-[11px] font-medium text-slate-500 mb-2 flex items-center gap-1">
              <GitBranch className="w-3 h-3" />
              条件配置
            </div>
          </div>
          <div>
            <label className="block text-[11px] text-slate-500 mb-1">判断字段</label>
            <input
              type="text"
              value={node.config.condition_field || ''}
              onChange={(e) =>
                onUpdateConfig(node.id, { condition_field: e.target.value })
              }
              placeholder="如 contract_value"
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-100"
            />
          </div>
          <div>
            <label className="block text-[11px] text-slate-500 mb-1">操作符</label>
            <select
              value={node.config.condition_operator || 'greater_than'}
              onChange={(e) =>
                onUpdateConfig(node.id, { condition_operator: e.target.value })
              }
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs bg-white focus:outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-100"
            >
              {CONDITION_OPERATORS.map((op) => (
                <option key={op.value} value={op.value}>
                  {op.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] text-slate-500 mb-1">比较值</label>
            <input
              type="text"
              value={node.config.condition_value || ''}
              onChange={(e) =>
                onUpdateConfig(node.id, { condition_value: e.target.value })
              }
              placeholder="如 1000000"
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-100"
            />
          </div>
          <div className="text-[10px] text-slate-400 leading-relaxed pt-1">
            条件成立走 true 分支，否则走 false 分支。分支目标通过画布连线自动识别。
          </div>
        </>
      )}

      {/* 通知节点配置 */}
      {isNotify && (
        <div>
          <label className="block text-[11px] text-slate-500 mb-1 flex items-center gap-1">
            <Mail className="w-3 h-3" />
            通知模板
          </label>
          <input
            type="text"
            value={node.config.notification_template || ''}
            onChange={(e) =>
              onUpdateConfig(node.id, { notification_template: e.target.value })
            }
            placeholder="如 审批完成通知"
            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-100"
          />
        </div>
      )}

      {/* 起止节点提示 */}
      {(node.type === 'start' || node.type === 'end') && (
        <div className="text-[10px] text-slate-400 leading-relaxed">
          {node.type === 'start'
            ? '开始节点：流程入口，每个工作流仅能有一个开始节点。'
            : '结束节点：流程出口，每个工作流仅能有一个结束节点。'}
        </div>
      )}

      {/* 删除按钮（起止节点不可删除） */}
      {node.type !== 'start' && node.type !== 'end' && (
        <button
          onClick={() => onDelete(node.id)}
          className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-100 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          删除节点
        </button>
      )}
    </div>
  );
}
