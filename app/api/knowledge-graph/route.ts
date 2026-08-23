// ===== 合同知识图谱 API =====
// 提供知识图谱的完整数据查询与节点检索/关联展开
// 优先使用 Supabase 数据库：从 contracts / partner_profiles / contract_risks /
// contract_lifecycles 表动态构建图节点与边；数据库未配置或查询失败时优雅降级到 Mock 数据。

import { NextRequest, NextResponse } from 'next/server';
import {
  getMockKnowledgeGraph,
  getMockInsights,
  getGraphStats,
  searchGraph,
  getRelatedNodes,
} from '@/lib/knowledge-graph';
import {
  KnowledgeGraph,
  GraphNode,
  GraphEdge,
  GraphEntityType,
  GraphRelationType,
} from '@/lib/types';
import { isSupabaseConfigured } from '@/lib/supabase';

// 模块级内存存储（仅作降级兜底）：首次调用时构建图谱
let graphStore: KnowledgeGraph | null = null;

function getMockGraph(): KnowledgeGraph {
  if (!graphStore) {
    graphStore = getMockKnowledgeGraph();
  }
  return graphStore;
}

// 全部实体类型 / 关系类型（用于统计初始化）
const ALL_ENTITY_TYPES: GraphEntityType[] = [
  'contract', 'party', 'clause', 'risk', 'payment', 'date', 'obligation',
];
const ALL_RELATION_TYPES: GraphRelationType[] = [
  'has_party', 'has_clause', 'has_risk', 'has_payment',
  'has_date', 'references', 'conflicts_with', 'depends_on',
];

// 节点坐标简易放射布局
function positionFor(index: number, total: number, cx = 550, cy = 360, radius = 220) {
  if (total <= 0) return { x: cx, y: cy };
  const angle = (index / total) * Math.PI * 2;
  return {
    x: Math.round(cx + radius * Math.cos(angle)),
    y: Math.round(cy + radius * Math.sin(angle)),
  };
}

// 计算图谱统计信息
function computeStats(nodes: GraphNode[], edges: GraphEdge[]): KnowledgeGraph['stats'] {
  const by_type = {} as Record<GraphEntityType, number>;
  const by_relation = {} as Record<GraphRelationType, number>;
  for (const t of ALL_ENTITY_TYPES) by_type[t] = 0;
  for (const t of ALL_RELATION_TYPES) by_relation[t] = 0;
  for (const n of nodes) {
    if (by_type[n.type] === undefined) by_type[n.type] = 0;
    by_type[n.type] += 1;
  }
  for (const e of edges) {
    if (by_relation[e.type] === undefined) by_relation[e.type] = 0;
    by_relation[e.type] += 1;
  }
  return {
    total_nodes: nodes.length,
    total_edges: edges.length,
    by_type,
    by_relation,
  };
}

// 从数据库数据动态构建知识图谱
function buildGraphFromData(
  contracts: any[],
  partners: any[],
  risks: any[],
  lifecycles: any[]
): KnowledgeGraph {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  let edgeSeq = 0;

  // 1) 合同节点
  contracts.forEach((c, i) => {
    const pos = positionFor(i, Math.max(contracts.length, 1), 550, 360, 180);
    nodes.push({
      id: `contract-${c.id}`,
      type: 'contract',
      label: c.contract_title || c.filename || '未命名合同',
      properties: {
        contract_type: c.contract_type || '',
        amount: 0,
        currency: 'CNY',
        status: c.status || 'active',
        risk_score: c.risk_score ?? 0,
        risk_count: c.risk_count ?? 0,
      },
      x: pos.x,
      y: pos.y,
    });
  });

  // 2) 合作方节点（去重 by name）
  const partnerByName = new Map<string, string>(); // name -> graph node id
  partners.forEach((p, i) => {
    const pos = positionFor(i, Math.max(partners.length, 1), 550, 130, 260);
    const nodeId = `partner-${p.id}`;
    partnerByName.set(p.name, nodeId);
    nodes.push({
      id: nodeId,
      type: 'party',
      label: p.name || '未知合作方',
      properties: {
        role: p.type || '',
        type: p.type || '',
        industry: p.industry || '',
        credit_rating: p.credit_rating || '',
        status: p.status || '',
        contract_count: p.contract_count ?? 0,
      },
      x: pos.x,
      y: pos.y,
    });
  });

  // 3) 风险节点（来自 contract_risks，按合同关联）
  const riskNodesByContract = new Map<string, string[]>();
  risks.forEach((r, i) => {
    const riskNodeId = `risk-${r.id}`;
    const pos = positionFor(i, Math.max(risks.length, 1), 300, 600, 240);
    nodes.push({
      id: riskNodeId,
      type: 'risk',
      label: r.clause_id ? `风险：${r.clause_id}` : '风险项',
      properties: {
        risk_level: r.risk_level || 'medium',
        risk_type: r.risk_type || 'other',
        explanation: r.risk_explanation || '',
      },
      x: pos.x,
      y: pos.y,
    });
    if (r.contract_id) {
      if (!riskNodesByContract.has(r.contract_id)) {
        riskNodesByContract.set(r.contract_id, []);
      }
      riskNodesByContract.get(r.contract_id)!.push(riskNodeId);
    }
  });

  // 4) 边：合同 -> 风险（has_risk）
  riskNodesByContract.forEach((riskIds, contractId) => {
    const contractNodeId = `contract-${contractId}`;
    riskIds.forEach((rid) => {
      edges.push({
        id: `edge-${++edgeSeq}`,
        source: contractNodeId,
        target: rid,
        type: 'has_risk',
        label: '风险',
        weight: 1,
      });
    });
  });

  // 5) 边：合同 -> 合作方（has_party）
  // 通过 contract_lifecycles.party_a / party_b 文本匹配 partner_profiles.name
  lifecycles.forEach((lc) => {
    const contractNodeId = `contract-${lc.contract_id}`;
    const parties = [lc.party_a, lc.party_b].filter(Boolean) as string[];
    parties.forEach((partyName) => {
      const partnerNodeId = partnerByName.get(partyName);
      if (partnerNodeId) {
        edges.push({
          id: `edge-${++edgeSeq}`,
          source: contractNodeId,
          target: partnerNodeId,
          type: 'has_party',
          label: '关联',
          weight: 1,
        });
      } else {
        // 合作方表里没有，但仍将其作为 party 节点加入，保证关系完整
        const newPartyId = `party-name-${partyName}`;
        if (!nodes.some((n) => n.id === newPartyId)) {
          nodes.push({
            id: newPartyId,
            type: 'party',
            label: partyName,
            properties: { role: '', type: '', industry: '' },
            x: 550,
            y: 130,
          });
          partnerByName.set(partyName, newPartyId);
        }
        edges.push({
          id: `edge-${++edgeSeq}`,
          source: contractNodeId,
          target: newPartyId,
          type: 'has_party',
          label: '关联',
          weight: 1,
        });
      }
    });
  });

  return { nodes, edges, stats: computeStats(nodes, edges) };
}

// 从数据库构建知识图谱（失败时返回 null，由调用方降级）
async function getGraphFromDb(): Promise<KnowledgeGraph | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const { getSupabaseServer } = await import('@/lib/supabase');
    const supabase = getSupabaseServer();
    if (!supabase) return null;

    const [contractsRes, partnersRes, risksRes, lifecyclesRes] = await Promise.all([
      supabase.from('contracts').select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('partner_profiles').select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('contract_risks').select('*').order('created_at', { ascending: false }).limit(200),
      supabase.from('contract_lifecycles').select('*').limit(200),
    ]);

    if (contractsRes.error) throw contractsRes.error;
    if (partnersRes.error) throw partnersRes.error;
    if (risksRes.error) throw risksRes.error;
    if (lifecyclesRes.error) throw lifecyclesRes.error;

    const contracts = contractsRes.data || [];
    const partners = partnersRes.data || [];
    const risks = risksRes.data || [];
    const lifecycles = lifecyclesRes.data || [];

    // 全部为空时返回 null，以便降级到 Mock 图谱
    if (contracts.length === 0 && partners.length === 0 && risks.length === 0) {
      return null;
    }

    return buildGraphFromData(contracts, partners, risks, lifecycles);
  } catch (err) {
    console.error('KnowledgeGraph DB error, falling back to mock:', err);
    return null;
  }
}

// GET: 返回完整知识图谱数据 + 洞察 + 统计
export async function GET() {
  try {
    const graph = await getGraphFromDb();
    if (graph) {
      const insights = getMockInsights();
      const stats = getGraphStats(graph);
      return NextResponse.json({
        graph,
        insights,
        stats,
        mock: false,
      });
    }

    // 降级：Mock 图谱
    const mockGraph = getMockGraph();
    const insights = getMockInsights();
    const stats = getGraphStats(mockGraph);
    return NextResponse.json({
      graph: mockGraph,
      insights,
      stats,
      mock: true,
    });
  } catch (err) {
    console.error('KnowledgeGraph GET error:', err);
    return NextResponse.json(
      { error: `服务器错误: ${err instanceof Error ? err.message : '未知错误'}` },
      { status: 500 }
    );
  }
}

// POST: 节点检索 / 关联展开
// 请求体: { action: 'search' | 'related', query?, node_id?, depth? }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body as {
      action?: 'search' | 'related';
      query?: string;
      node_id?: string;
      depth?: number;
    };

    // 优先尝试数据库构建的图谱
    let graph = await getGraphFromDb();
    let usingMock = false;
    if (!graph) {
      graph = getMockGraph();
      usingMock = true;
    }

    switch (action) {
      case 'search': {
        // 搜索节点并返回匹配子图
        const query = typeof body.query === 'string' ? body.query : '';
        const sub = searchGraph(graph, query);
        return NextResponse.json({
          action: 'search',
          query,
          nodes: sub.nodes,
          edges: sub.edges,
          count: sub.nodes.length,
          mock: usingMock,
        });
      }

      case 'related': {
        // 获取节点 N 跳邻域
        const nodeId = body.node_id;
        if (!nodeId) {
          return NextResponse.json(
            { error: '参数错误: related 需要 node_id' },
            { status: 400 }
          );
        }
        const node = graph.nodes.find((n) => n.id === nodeId);
        if (!node) {
          return NextResponse.json(
            { error: `节点不存在: ${nodeId}` },
            { status: 404 }
          );
        }
        const depth = typeof body.depth === 'number' && body.depth > 0 ? body.depth : 1;
        const sub = getRelatedNodes(graph, nodeId, depth);
        return NextResponse.json({
          action: 'related',
          node_id: nodeId,
          depth,
          nodes: sub.nodes,
          edges: sub.edges,
          mock: usingMock,
        });
      }

      default:
        return NextResponse.json(
          { error: 'action 必须为 search 或 related' },
          { status: 400 }
        );
    }
  } catch (err) {
    console.error('KnowledgeGraph POST error:', err);
    return NextResponse.json(
      { error: `服务器错误: ${err instanceof Error ? err.message : '未知错误'}` },
      { status: 500 }
    );
  }
}
