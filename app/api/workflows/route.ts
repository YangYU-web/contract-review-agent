// ===== 工作流引擎 API =====
// 提供工作流定义与运行实例的查询，以及工作流的创建 / 添加节点 / 添加连线 / 更新节点 / 激活 / 归档
// 优先使用 Supabase 数据库（workflow_definitions / workflow_instances 表），
// 数据库未配置或操作失败时优雅降级到内存 Mock 数据。

export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import {
  WorkflowDefinition,
  WorkflowNode,
} from '@/lib/types';
import { isSupabaseConfigured } from '@/lib/supabase';
import {
  getMockWorkflows,
  getMockWorkflowInstances,
  createWorkflow,
  addNode,
  addEdge,
  validateWorkflow,
  getWorkflowStats,
  getInstanceStats,
} from '@/lib/workflow-engine';

// 模块级内存存储（仅作降级兜底）：初始化为 Mock 数据
let workflowsStore: WorkflowDefinition[] = getMockWorkflows();
let instancesStore = getMockWorkflowInstances();

// 从数据库读取工作流定义与实例列表
async function fetchFromDb(
  supabase: any,
  status?: string | null,
  contractType?: string | null
): Promise<{ workflows: WorkflowDefinition[]; instances: any[] }> {
  let wfQuery = supabase
    .from('workflow_definitions')
    .select('*')
    .order('updated_at', { ascending: false });
  if (status) wfQuery = wfQuery.eq('status', status);
  if (contractType) wfQuery = wfQuery.eq('contract_type', contractType);
  const { data: workflows, error: wfErr } = await wfQuery;
  if (wfErr) throw wfErr;

  const { data: instances, error: instErr } = await supabase
    .from('workflow_instances')
    .select('*')
    .order('started_at', { ascending: false });
  if (instErr) throw instErr;

  return {
    workflows: (workflows || []) as WorkflowDefinition[],
    instances: instances || [],
  };
}

// ===== GET: 返回工作流定义、实例列表及统计 =====
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const contractType = searchParams.get('contract_type');

    // 优先尝试数据库
    if (isSupabaseConfigured()) {
      try {
        const { getSupabaseServer } = await import('@/lib/supabase');
        const supabase = getSupabaseServer();
        if (supabase) {
          const { workflows, instances } = await fetchFromDb(
            supabase as any,
            status,
            contractType
          );
          return NextResponse.json({
            workflows,
            instances,
            stats: getWorkflowStats(workflows),
            instanceStats: getInstanceStats(instances),
            mock: false,
          });
        }
      } catch (dbErr) {
        console.error('Workflows GET DB error, falling back to mock:', dbErr);
      }
    }

    // 降级：内存 Mock 数据
    let list = workflowsStore;
    if (status) list = list.filter((w) => w.status === status);
    if (contractType) list = list.filter((w) => w.contract_type === contractType);

    const stats = getWorkflowStats(workflowsStore);
    const instanceStats = getInstanceStats(instancesStore);

    return NextResponse.json({
      workflows: list,
      instances: instancesStore,
      stats,
      instanceStats,
      mock: true,
    });
  } catch (err) {
    console.error('Workflows GET error:', err);
    return NextResponse.json(
      { error: `服务器错误: ${err instanceof Error ? err.message : '未知错误'}` },
      { status: 500 }
    );
  }
}

// ===== POST: 支持 create / add_node / add_edge / update_node / activate / archive 操作 =====
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'create':
        return handleCreate(body);
      case 'add_node':
        return handleAddNode(body);
      case 'add_edge':
        return handleAddEdge(body);
      case 'update_node':
        return handleUpdateNode(body);
      case 'activate':
        return handleActivate(body);
      case 'archive':
        return handleArchive(body);
      default:
        return NextResponse.json(
          {
            error:
              'action 必须为 create / add_node / add_edge / update_node / activate / archive 之一',
          },
          { status: 400 }
        );
    }
  } catch (err) {
    console.error('Workflows POST error:', err);
    return NextResponse.json(
      { error: `服务器错误: ${err instanceof Error ? err.message : '未知错误'}` },
      { status: 500 }
    );
  }
}

// 获取 Supabase 服务端客户端（如未配置返回 null）
async function getDb() {
  if (!isSupabaseConfigured()) return null;
  const { getSupabaseServer } = await import('@/lib/supabase');
  return getSupabaseServer();
}

// 统一返回的响应构造器（Mock 模式）
function buildResponse(extra: Record<string, any> = {}) {
  return NextResponse.json({
    ...extra,
    workflows: workflowsStore,
    instances: instancesStore,
    stats: getWorkflowStats(workflowsStore),
    instanceStats: getInstanceStats(instancesStore),
    mock: true,
  });
}

// 统一返回的响应构造器（数据库模式）
function buildDbResponse(
  extra: Record<string, any>,
  workflows: WorkflowDefinition[],
  instances: any[]
) {
  return NextResponse.json({
    ...extra,
    workflows,
    instances,
    stats: getWorkflowStats(workflows),
    instanceStats: getInstanceStats(instances),
    mock: false,
  });
}

// 创建新工作流（自动生成开始 → 结束的初始流程）
async function handleCreate(body: any) {
  const { name, description, contract_type } = body;
  if (!name || !contract_type) {
    return NextResponse.json(
      { error: '缺少必要参数：name / contract_type' },
      { status: 400 }
    );
  }
  const wf = createWorkflow(name, description || '', contract_type);

  // 尝试写入数据库
  const supabase = await getDb();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('workflow_definitions')
        .insert({
          name: wf.name,
          description: wf.description,
          contract_type: wf.contract_type,
          nodes: wf.nodes,
          edges: wf.edges,
          status: wf.status,
          version: wf.version,
        })
        .select()
        .single();
      if (error) throw error;
      const created = data as WorkflowDefinition;
      const { workflows, instances } = await fetchFromDb(supabase as any);
      return buildDbResponse({ workflow: created }, workflows, instances);
    } catch (dbErr) {
      console.error('Workflows create DB error, falling back to mock:', dbErr);
    }
  }

  // 降级：内存
  workflowsStore.push(wf);
  return buildResponse({ workflow: wf });
}

// 向工作流添加节点
async function handleAddNode(body: any) {
  const { workflow_id, node } = body;
  if (!workflow_id) {
    return NextResponse.json({ error: '缺少 workflow_id' }, { status: 400 });
  }
  if (!node || !node.type) {
    return NextResponse.json(
      { error: '缺少 node 参数或 node.type' },
      { status: 400 }
    );
  }
  // 构造节点数据（不含 id，由 addNode 自动生成）
  const nodeData: Omit<WorkflowNode, 'id'> = {
    type: node.type,
    label: node.label || '',
    x: typeof node.x === 'number' ? node.x : 300,
    y: typeof node.y === 'number' ? node.y : 200,
    config: node.config || {},
  };

  // 尝试数据库
  const supabase = await getDb();
  if (supabase) {
    try {
      const { data: existing, error: fetchErr } = await supabase
        .from('workflow_definitions')
        .select('*')
        .eq('id', workflow_id)
        .single();
      if (fetchErr) throw fetchErr;
      if (!existing) {
        return NextResponse.json({ error: '工作流不存在' }, { status: 404 });
      }
      const updated = addNode(existing as WorkflowDefinition, nodeData);
      const validation = validateWorkflow(updated);
      const { error: updateErr } = await supabase
        .from('workflow_definitions')
        .update({ nodes: updated.nodes, edges: updated.edges, updated_at: new Date().toISOString() })
        .eq('id', workflow_id);
      if (updateErr) throw updateErr;
      const { workflows, instances } = await fetchFromDb(supabase as any);
      return buildDbResponse({ workflow: updated, validation }, workflows, instances);
    } catch (dbErr) {
      console.error('Workflows add_node DB error, falling back to mock:', dbErr);
    }
  }

  // 降级：内存
  const idx = workflowsStore.findIndex((w) => w.id === workflow_id);
  if (idx < 0) {
    return NextResponse.json({ error: '工作流不存在' }, { status: 404 });
  }
  workflowsStore[idx] = addNode(workflowsStore[idx], nodeData);
  const validation = validateWorkflow(workflowsStore[idx]);
  return buildResponse({ workflow: workflowsStore[idx], validation });
}

// 向工作流添加连线
async function handleAddEdge(body: any) {
  const { workflow_id, edge } = body;
  if (!workflow_id) {
    return NextResponse.json({ error: '缺少 workflow_id' }, { status: 400 });
  }
  if (!edge || !edge.source || !edge.target) {
    return NextResponse.json(
      { error: '缺少 edge 参数或 edge.source / edge.target' },
      { status: 400 }
    );
  }

  // 尝试数据库
  const supabase = await getDb();
  if (supabase) {
    try {
      const { data: existing, error: fetchErr } = await supabase
        .from('workflow_definitions')
        .select('*')
        .eq('id', workflow_id)
        .single();
      if (fetchErr) throw fetchErr;
      if (!existing) {
        return NextResponse.json({ error: '工作流不存在' }, { status: 404 });
      }
      const updated = addEdge(existing as WorkflowDefinition, {
        source: edge.source,
        target: edge.target,
        label: edge.label,
        condition: edge.condition,
      });
      const validation = validateWorkflow(updated);
      const { error: updateErr } = await supabase
        .from('workflow_definitions')
        .update({ nodes: updated.nodes, edges: updated.edges, updated_at: new Date().toISOString() })
        .eq('id', workflow_id);
      if (updateErr) throw updateErr;
      const { workflows, instances } = await fetchFromDb(supabase as any);
      return buildDbResponse({ workflow: updated, validation }, workflows, instances);
    } catch (dbErr) {
      console.error('Workflows add_edge DB error, falling back to mock:', dbErr);
    }
  }

  // 降级：内存
  const idx = workflowsStore.findIndex((w) => w.id === workflow_id);
  if (idx < 0) {
    return NextResponse.json({ error: '工作流不存在' }, { status: 404 });
  }
  workflowsStore[idx] = addEdge(workflowsStore[idx], {
    source: edge.source,
    target: edge.target,
    label: edge.label,
    condition: edge.condition,
  });
  const validation = validateWorkflow(workflowsStore[idx]);
  return buildResponse({ workflow: workflowsStore[idx], validation });
}

// 更新节点（位置、标签、配置等）
async function handleUpdateNode(body: any) {
  const { workflow_id, node_id, patch } = body;
  if (!workflow_id || !node_id) {
    return NextResponse.json(
      { error: '缺少 workflow_id 或 node_id' },
      { status: 400 }
    );
  }

  // 尝试数据库
  const supabase = await getDb();
  if (supabase) {
    try {
      const { data: existing, error: fetchErr } = await supabase
        .from('workflow_definitions')
        .select('*')
        .eq('id', workflow_id)
        .single();
      if (fetchErr) throw fetchErr;
      if (!existing) {
        return NextResponse.json({ error: '工作流不存在' }, { status: 404 });
      }
      const wf = existing as WorkflowDefinition;
      const nodeIdx = wf.nodes.findIndex((n) => n.id === node_id);
      if (nodeIdx < 0) {
        return NextResponse.json({ error: '节点不存在' }, { status: 404 });
      }
      const oldNode = wf.nodes[nodeIdx];
      const newNode: WorkflowNode = {
        ...oldNode,
        ...patch,
        config: { ...oldNode.config, ...(patch?.config || {}) },
      };
      const newNodes = [...wf.nodes];
      newNodes[nodeIdx] = newNode;
      const updated: WorkflowDefinition = {
        ...wf,
        nodes: newNodes,
        updated_at: new Date().toISOString(),
      };
      const validation = validateWorkflow(updated);
      const { error: updateErr } = await supabase
        .from('workflow_definitions')
        .update({ nodes: updated.nodes, updated_at: updated.updated_at })
        .eq('id', workflow_id);
      if (updateErr) throw updateErr;
      const { workflows, instances } = await fetchFromDb(supabase as any);
      return buildDbResponse({ workflow: updated, validation }, workflows, instances);
    } catch (dbErr) {
      console.error('Workflows update_node DB error, falling back to mock:', dbErr);
    }
  }

  // 降级：内存
  const idx = workflowsStore.findIndex((w) => w.id === workflow_id);
  if (idx < 0) {
    return NextResponse.json({ error: '工作流不存在' }, { status: 404 });
  }
  const wf = workflowsStore[idx];
  const nodeIdx = wf.nodes.findIndex((n) => n.id === node_id);
  if (nodeIdx < 0) {
    return NextResponse.json({ error: '节点不存在' }, { status: 404 });
  }
  const oldNode = wf.nodes[nodeIdx];
  const newNode: WorkflowNode = {
    ...oldNode,
    ...patch,
    config: { ...oldNode.config, ...(patch?.config || {}) },
  };
  const newNodes = [...wf.nodes];
  newNodes[nodeIdx] = newNode;
  workflowsStore[idx] = {
    ...wf,
    nodes: newNodes,
    updated_at: new Date().toISOString(),
  };
  const validation = validateWorkflow(workflowsStore[idx]);
  return buildResponse({ workflow: workflowsStore[idx], validation });
}

// 激活工作流
async function handleActivate(body: any) {
  const { workflow_id } = body;
  if (!workflow_id) {
    return NextResponse.json({ error: '缺少 workflow_id' }, { status: 400 });
  }

  // 尝试数据库
  const supabase = await getDb();
  if (supabase) {
    try {
      const { data: existing, error: fetchErr } = await supabase
        .from('workflow_definitions')
        .select('*')
        .eq('id', workflow_id)
        .single();
      if (fetchErr) throw fetchErr;
      if (!existing) {
        return NextResponse.json({ error: '工作流不存在' }, { status: 404 });
      }
      const wf = existing as WorkflowDefinition;
      const validation = validateWorkflow(wf);
      if (!validation.valid) {
        return NextResponse.json(
          { error: '工作流校验未通过，无法激活', validation },
          { status: 400 }
        );
      }
      const { error: updateErr } = await supabase
        .from('workflow_definitions')
        .update({ status: 'active', updated_at: new Date().toISOString() })
        .eq('id', workflow_id);
      if (updateErr) throw updateErr;
      const updated = { ...wf, status: 'active' as const, updated_at: new Date().toISOString() };
      const { workflows, instances } = await fetchFromDb(supabase as any);
      return buildDbResponse({ workflow: updated }, workflows, instances);
    } catch (dbErr) {
      console.error('Workflows activate DB error, falling back to mock:', dbErr);
    }
  }

  // 降级：内存
  const idx = workflowsStore.findIndex((w) => w.id === workflow_id);
  if (idx < 0) {
    return NextResponse.json({ error: '工作流不存在' }, { status: 404 });
  }
  const validation = validateWorkflow(workflowsStore[idx]);
  if (!validation.valid) {
    return NextResponse.json(
      { error: '工作流校验未通过，无法激活', validation },
      { status: 400 }
    );
  }
  workflowsStore[idx] = {
    ...workflowsStore[idx],
    status: 'active',
    updated_at: new Date().toISOString(),
  };
  return buildResponse({ workflow: workflowsStore[idx] });
}

// 归档工作流
async function handleArchive(body: any) {
  const { workflow_id } = body;
  if (!workflow_id) {
    return NextResponse.json({ error: '缺少 workflow_id' }, { status: 400 });
  }

  // 尝试数据库
  const supabase = await getDb();
  if (supabase) {
    try {
      const { data: existing, error: fetchErr } = await supabase
        .from('workflow_definitions')
        .select('*')
        .eq('id', workflow_id)
        .single();
      if (fetchErr) throw fetchErr;
      if (!existing) {
        return NextResponse.json({ error: '工作流不存在' }, { status: 404 });
      }
      const { error: updateErr } = await supabase
        .from('workflow_definitions')
        .update({ status: 'archived', updated_at: new Date().toISOString() })
        .eq('id', workflow_id);
      if (updateErr) throw updateErr;
      const updated = {
        ...(existing as WorkflowDefinition),
        status: 'archived' as const,
        updated_at: new Date().toISOString(),
      };
      const { workflows, instances } = await fetchFromDb(supabase as any);
      return buildDbResponse({ workflow: updated }, workflows, instances);
    } catch (dbErr) {
      console.error('Workflows archive DB error, falling back to mock:', dbErr);
    }
  }

  // 降级：内存
  const idx = workflowsStore.findIndex((w) => w.id === workflow_id);
  if (idx < 0) {
    return NextResponse.json({ error: '工作流不存在' }, { status: 404 });
  }
  workflowsStore[idx] = {
    ...workflowsStore[idx],
    status: 'archived',
    updated_at: new Date().toISOString(),
  };
  return buildResponse({ workflow: workflowsStore[idx] });
}
