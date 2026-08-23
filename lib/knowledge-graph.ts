// ===== 合同知识图谱模块 =====
// 构建合同、主体、条款、风险、付款、日期、义务等实体之间的关系网络
// 提供图谱构建、检索、关联展开、洞察生成能力（演示模式使用模拟数据）

import {
  KnowledgeGraph,
  GraphNode,
  GraphEdge,
  GraphEntityType,
  GraphRelationType,
  GraphInsight,
  GRAPH_ENTITY_TYPE_LABELS,
  GRAPH_RELATION_TYPE_LABELS,
} from './types';

// ===== 节点类型主题色（用于前端可视化） =====
export const GRAPH_ENTITY_TYPE_COLORS: Record<GraphEntityType, string> = {
  contract: '#8b5cf6', // 紫色 - 合同
  party: '#2563eb', // 蓝色 - 主体
  clause: '#16a34a', // 绿色 - 条款
  risk: '#dc2626', // 红色 - 风险
  payment: '#d97706', // 橙色 - 付款
  date: '#0891b2', // 青色 - 日期
  obligation: '#db2777', // 粉色 - 义务
};

// ===== 关系类型线型（solid 实线 / dashed 虚线） =====
export const GRAPH_RELATION_LINE_STYLE: Record<GraphRelationType, 'solid' | 'dashed'> = {
  has_party: 'solid',
  has_clause: 'solid',
  has_risk: 'solid',
  has_payment: 'solid',
  has_date: 'solid',
  references: 'dashed',
  conflicts_with: 'dashed',
  depends_on: 'dashed',
};

// 全部实体类型（用于统计与筛选）
const ALL_ENTITY_TYPES: GraphEntityType[] = [
  'contract', 'party', 'clause', 'risk', 'payment', 'date', 'obligation',
];

// 全部关系类型
const ALL_RELATION_TYPES: GraphRelationType[] = [
  'has_party', 'has_clause', 'has_risk', 'has_payment',
  'has_date', 'references', 'conflicts_with', 'depends_on',
];

// ===== 图谱原始节点数据（演示用） =====
// 坐标采用力导向布局的简化近似：中心节点居中，周围节点放射状分布
// 画布范围约 1100 x 720
const RAW_NODES: GraphNode[] = [
  // 合同节点（3个）—— 放置在画布中心区域
  { id: 'c1', type: 'contract', label: '采购合同', properties: { contract_type: '采购合同', amount: 1200000, currency: 'CNY', status: 'active' }, x: 550, y: 360 },
  { id: 'c2', type: 'contract', label: '服务外包合同', properties: { contract_type: '服务合同', amount: 580000, currency: 'CNY', status: 'active' }, x: 300, y: 320 },
  { id: 'c3', type: 'contract', label: '保密协议', properties: { contract_type: '保密协议', amount: 0, currency: 'CNY', status: 'active' }, x: 820, y: 320 },

  // 主体节点（4个）—— 放射至画布上方与两侧
  { id: 'p1', type: 'party', label: '本企业', properties: { role: '甲方', type: 'company', industry: '综合' }, x: 560, y: 130 },
  { id: 'p2', type: 'party', label: 'TechCorp Ltd', properties: { role: '乙方', type: 'supplier', industry: '科技' }, x: 340, y: 70 },
  { id: 'p3', type: 'party', label: 'Global Services Inc', properties: { role: '乙方', type: 'service_provider', industry: '咨询服务' }, x: 140, y: 340 },
  { id: 'p4', type: 'party', label: 'DataSafe Solutions', properties: { role: '乙方', type: 'partner', industry: '数据安全' }, x: 860, y: 90 },

  // 条款节点（4个）—— 放射至画布下方
  { id: 'cl1', type: 'clause', label: '付款条款', properties: { clause_type: 'payment', section: '第四条' }, x: 340, y: 500 },
  { id: 'cl2', type: 'clause', label: '违约责任条款', properties: { clause_type: 'liability', section: '第八条' }, x: 500, y: 580 },
  { id: 'cl3', type: 'clause', label: '保密条款', properties: { clause_type: 'confidentiality', section: '第六条', duration: '3年' }, x: 680, y: 500 },
  { id: 'cl4', type: 'clause', label: '交付条款', properties: { clause_type: 'delivery', section: '第五条' }, x: 180, y: 520 },

  // 风险节点（3个）—— 放射至画布左下与右下
  { id: 'r1', type: 'risk', label: '付款延迟风险', properties: { risk_level: 'medium', risk_type: 'payment_risk' }, x: 220, y: 640 },
  { id: 'r2', type: 'risk', label: '违约金过高风险', properties: { risk_level: 'high', risk_type: 'breach_liability' }, x: 430, y: 670 },
  { id: 'r3', type: 'risk', label: '知识产权归属不明风险', properties: { risk_level: 'high', risk_type: 'intellectual_property' }, x: 880, y: 600 },

  // 付款节点（2个）—— 放射至画布右侧
  { id: 'pay1', type: 'payment', label: '预付款 30%', properties: { amount: 360000, currency: 'CNY', stage: 'prepay' }, x: 720, y: 220 },
  { id: 'pay2', type: 'payment', label: '尾款 70%', properties: { amount: 840000, currency: 'CNY', stage: 'final' }, x: 860, y: 410 },

  // 日期节点（2个）—— 放射至画布右上
  { id: 'd1', type: 'date', label: '签订日', properties: { date: '2024-03-15', significance: 'important' }, x: 400, y: 200 },
  { id: 'd2', type: 'date', label: '交付截止日', properties: { date: '2024-09-30', significance: 'critical' }, x: 200, y: 220 },

  // 义务节点（2个）—— 放射至画布底部
  { id: 'o1', type: 'obligation', label: '交付义务', properties: { obligor: '乙方', deadline: '2024-09-30' }, x: 300, y: 680 },
  { id: 'o2', type: 'obligation', label: '保密义务', properties: { obligor: '双方', duration: '3年' }, x: 780, y: 640 },
];

// ===== 图谱原始边数据（演示用，覆盖全部 8 种关系类型） =====
const RAW_EDGES: GraphEdge[] = [
  // has_party 主体关联（6条）
  { id: 'e1', source: 'c1', target: 'p1', type: 'has_party', label: '甲方', weight: 1 },
  { id: 'e2', source: 'c1', target: 'p2', type: 'has_party', label: '乙方', weight: 1 },
  { id: 'e3', source: 'c2', target: 'p1', type: 'has_party', label: '甲方', weight: 1 },
  { id: 'e4', source: 'c2', target: 'p3', type: 'has_party', label: '乙方', weight: 1 },
  { id: 'e5', source: 'c3', target: 'p1', type: 'has_party', label: '甲方', weight: 1 },
  { id: 'e6', source: 'c3', target: 'p4', type: 'has_party', label: '乙方', weight: 1 },

  // has_clause 包含条款（7条）
  { id: 'e7', source: 'c1', target: 'cl1', type: 'has_clause', label: '包含', weight: 1 },
  { id: 'e8', source: 'c1', target: 'cl2', type: 'has_clause', label: '包含', weight: 1 },
  { id: 'e9', source: 'c1', target: 'cl3', type: 'has_clause', label: '包含', weight: 1 },
  { id: 'e10', source: 'c2', target: 'cl3', type: 'has_clause', label: '包含', weight: 1 },
  { id: 'e11', source: 'c2', target: 'cl4', type: 'has_clause', label: '包含', weight: 1 },
  { id: 'e12', source: 'c2', target: 'cl1', type: 'has_clause', label: '包含', weight: 1 },
  { id: 'e13', source: 'c3', target: 'cl3', type: 'has_clause', label: '包含', weight: 1 },

  // has_risk 存在风险（4条）
  { id: 'e14', source: 'cl1', target: 'r1', type: 'has_risk', label: '风险', weight: 1 },
  { id: 'e15', source: 'cl1', target: 'r2', type: 'has_risk', label: '风险', weight: 1 },
  { id: 'e16', source: 'cl2', target: 'r2', type: 'has_risk', label: '风险', weight: 1 },
  { id: 'e17', source: 'cl4', target: 'r3', type: 'has_risk', label: '风险', weight: 1 },

  // has_payment 付款关联（2条）
  { id: 'e18', source: 'c1', target: 'pay1', type: 'has_payment', label: '预付', weight: 1 },
  { id: 'e19', source: 'c1', target: 'pay2', type: 'has_payment', label: '尾款', weight: 1 },

  // has_date 日期关联（4条）
  { id: 'e20', source: 'c1', target: 'd1', type: 'has_date', label: '签订', weight: 1 },
  { id: 'e21', source: 'c1', target: 'd2', type: 'has_date', label: '交付', weight: 1 },
  { id: 'e22', source: 'c2', target: 'd1', type: 'has_date', label: '签订', weight: 1 },
  { id: 'e23', source: 'c3', target: 'd1', type: 'has_date', label: '签订', weight: 1 },

  // references 引用（2条）
  { id: 'e24', source: 'cl1', target: 'pay1', type: 'references', label: '引用', weight: 1 },
  { id: 'e25', source: 'cl2', target: 'cl4', type: 'references', label: '引用', weight: 1 },

  // conflicts_with 冲突（1条）
  { id: 'e26', source: 'cl3', target: 'cl4', type: 'conflicts_with', label: '冲突', weight: 1 },

  // depends_on 依赖（3条）
  { id: 'e27', source: 'cl4', target: 'o1', type: 'depends_on', label: '依赖', weight: 1 },
  { id: 'e28', source: 'cl3', target: 'o2', type: 'depends_on', label: '依赖', weight: 1 },
  { id: 'e29', source: 'cl2', target: 'o1', type: 'depends_on', label: '依赖', weight: 1 },
];

// 深拷贝节点（避免外部修改原始数据）
function cloneNodes(): GraphNode[] {
  return RAW_NODES.map((n) => ({
    id: n.id,
    type: n.type,
    label: n.label,
    properties: { ...n.properties },
    x: n.x,
    y: n.y,
  }));
}

// 深拷贝边
function cloneEdges(): GraphEdge[] {
  return RAW_EDGES.map((e) => ({ ...e }));
}

// ===== 计算图谱统计信息 =====
function computeStats(nodes: GraphNode[], edges: GraphEdge[]): KnowledgeGraph['stats'] {
  const by_type = {} as Record<GraphEntityType, number>;
  const by_relation = {} as Record<GraphRelationType, number>;

  for (const t of ALL_ENTITY_TYPES) by_type[t] = 0;
  for (const t of ALL_RELATION_TYPES) by_relation[t] = 0;

  for (const n of nodes) by_type[n.type] += 1;
  for (const e of edges) by_relation[e.type] += 1;

  return {
    total_nodes: nodes.length,
    total_edges: edges.length,
    by_type,
    by_relation,
  };
}

// ===== 获取模拟知识图谱 =====
// 返回包含节点、边、统计的完整图谱对象（演示模式）
export function getMockKnowledgeGraph(): KnowledgeGraph {
  const nodes = cloneNodes();
  const edges = cloneEdges();
  const stats = computeStats(nodes, edges);
  return { nodes, edges, stats };
}

// ===== 获取模拟图谱洞察 =====
// 基于图结构分析，输出模式、异常、推荐、风险聚类等洞察
export function getMockInsights(): GraphInsight[] {
  return [
    {
      id: 'ins1',
      type: 'pattern',
      title: '多份合同共享相同违约金条款模板',
      description: '采购合同（C1）与服务外包合同（C2）的违约责任条款（CL2）使用相同模板，违约金过高风险（R2）在两份合同中重复出现，建议统一违约金条款标准。',
      related_nodes: ['c1', 'c2', 'cl2', 'r2'],
      confidence: 0.89,
    },
    {
      id: 'ins2',
      type: 'anomaly',
      title: '某供应商合同风险评分显著高于平均水平',
      description: 'TechCorp Ltd（P2）作为乙方的采购合同（C1）关联 3 项风险节点，风险密度显著高于其他供应商合同，建议加强该供应商的合同审查力度。',
      related_nodes: ['p2', 'c1', 'r1', 'r2', 'cl1'],
      confidence: 0.84,
    },
    {
      id: 'ins3',
      type: 'recommendation',
      title: '建议将保密条款统一为5年期限',
      description: '保密条款（CL3）当前保密义务（O2）期限为3年，涉及3份合同。结合行业惯例与数据保护要求，建议统一为5年期限以强化信息安全。',
      related_nodes: ['cl3', 'o2', 'c1', 'c2', 'c3'],
      confidence: 0.76,
    },
    {
      id: 'ins4',
      type: 'risk_cluster',
      title: '付款条件风险聚集：3份合同共享相同高风险付款模式',
      description: '付款条款（CL1）关联付款延迟风险（R1）与违约金过高风险（R2），预付款30%+尾款70%的付款模式在多份合同中重复，形成付款风险聚类。',
      related_nodes: ['cl1', 'r1', 'r2', 'pay1', 'pay2', 'c1', 'c2'],
      confidence: 0.91,
    },
    {
      id: 'ins5',
      type: 'pattern',
      title: '本企业为核心主体的中心辐射网络',
      description: '本企业（P1）作为甲方出现在全部3份合同中，构成中心辐射式主体关联网络。集中度高有利于统一管控，但需关注对手方集中度风险。',
      related_nodes: ['p1', 'c1', 'c2', 'c3'],
      confidence: 0.95,
    },
  ];
}

// ===== 图谱节点检索 =====
// 在节点 label 与 properties 中匹配关键词，返回匹配节点及其之间的边（子图）
export function searchGraph(
  graph: KnowledgeGraph,
  query: string
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const q = query.trim().toLowerCase();
  if (!q) return { nodes: [], edges: [] };

  // 匹配节点
  const matchedIds = new Set<string>();
  for (const n of graph.nodes) {
    if (n.label.toLowerCase().includes(q)) {
      matchedIds.add(n.id);
      continue;
    }
    const inProps = Object.values(n.properties).some(
      (v) => typeof v === 'string' && v.toLowerCase().includes(q)
    );
    if (inProps) matchedIds.add(n.id);
  }

  const nodes = graph.nodes.filter((n) => matchedIds.has(n.id));
  // 返回两端均在匹配集合中的边
  const edges = graph.edges.filter(
    (e) => matchedIds.has(e.source) && matchedIds.has(e.target)
  );
  return { nodes, edges };
}

// ===== 获取关联节点（N 跳邻域） =====
// BFS 遍历至 depth 跳，返回邻域内的节点与边（含起点节点以保证边的完整性）
export function getRelatedNodes(
  graph: KnowledgeGraph,
  nodeId: string,
  depth: number
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodeSet = new Set<string>([nodeId]);
  const edgeSet = new Set<string>();

  let frontier: string[] = [nodeId];
  for (let d = 0; d < depth; d++) {
    const nextFrontier: string[] = [];
    for (const cur of frontier) {
      for (const edge of graph.edges) {
        let neighbor: string | null = null;
        if (edge.source === cur) neighbor = edge.target;
        else if (edge.target === cur) neighbor = edge.source;
        if (!neighbor) continue;
        edgeSet.add(edge.id);
        if (!nodeSet.has(neighbor)) {
          nodeSet.add(neighbor);
          nextFrontier.push(neighbor);
        }
      }
    }
    if (nextFrontier.length === 0) break;
    frontier = nextFrontier;
  }

  const nodes = graph.nodes.filter((n) => nodeSet.has(n.id));
  const edges = graph.edges.filter((e) => edgeSet.has(e.id));
  return { nodes, edges };
}

// ===== 获取图谱统计 =====
export function getGraphStats(graph: KnowledgeGraph): KnowledgeGraph['stats'] {
  return graph.stats;
}

// 便于复用：导出标签映射
export { GRAPH_ENTITY_TYPE_LABELS, GRAPH_RELATION_TYPE_LABELS };
