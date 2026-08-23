// ===== 类型定义 =====

// 合同状态
export type ContractStatus = 'pending' | 'reviewing' | 'completed' | 'failed';

// 风险等级
export type RiskLevel = 'high' | 'medium' | 'low';

// 风险类型
export type RiskType =
  | 'payment_risk'
  | 'delivery_risk'
  | 'breach_liability'
  | 'intellectual_property'
  | 'confidentiality'
  | 'dispute_resolution'
  | 'force_majeure'
  | 'termination'
  | 'indemnification'
  | 'data_protection'
  | 'non_compete'
  | 'governing_law'
  | 'other';

// 用户决策
export type UserDecision = 'accepted' | 'rejected' | 'pending';

// 合同记录
export interface Contract {
  id: string;
  user_id: string;
  filename: string;
  file_type: 'pdf' | 'docx' | 'txt';
  file_size: number;
  file_path?: string;
  contract_text?: string;
  contract_type?: string;
  contract_title?: string;
  status: ContractStatus;
  risk_score?: number;
  risk_count?: number;
  high_risk_count?: number;
  created_at: string;
  updated_at: string;
}

// 风险项
export interface ContractRisk {
  id: string;
  contract_id: string;
  clause_id: string;
  clause_text: string;
  risk_type: RiskType;
  risk_level: RiskLevel;
  risk_explanation: string;
  is_standard_clause: boolean;
  suggested_redline?: string;
  citation_verified: boolean;
  user_decision: UserDecision;
  created_at: string;
}

// AI返回的风险分析结构
export interface AIRiskAnalysis {
  clause_id: string;
  clause_text: string;
  risk_type: RiskType;
  risk_level: RiskLevel;
  risk_explanation: string;
  is_standard_clause: boolean;
  suggested_redline: string;
  citation_verified?: boolean;
}

// AI审查结果
export interface AIReviewResult {
  contract_type: string;
  contract_title: string;
  risks: AIRiskAnalysis[];
  summary: string;
  overall_risk_score: number;
}

// 审查进度
export interface ReviewProgress {
  step: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  message?: string;
}

// 风险类型中文标签
export const RISK_TYPE_LABELS: Record<RiskType, string> = {
  payment_risk: '付款风险',
  delivery_risk: '交付风险',
  breach_liability: '违约责任',
  intellectual_property: '知识产权',
  confidentiality: '保密义务',
  dispute_resolution: '争议解决',
  force_majeure: '不可抗力',
  termination: '合同终止',
  indemnification: '赔偿责任',
  data_protection: '数据保护',
  non_compete: '竞业限制',
  governing_law: '管辖法律',
  other: '其他',
};

// 风险等级中文标签和颜色
export const RISK_LEVEL_CONFIG: Record<RiskLevel, { label: string; color: string; bg: string }> = {
  high: { label: '高风险', color: '#dc2626', bg: '#fef2f2' },
  medium: { label: '中风险', color: '#d97706', bg: '#fffbeb' },
  low: { label: '低风险', color: '#16a34a', bg: '#f0fdf4' },
};

// ===== Phase 2: 条款比对类型 =====

// 条款比对差异类型
export type DiffType = 'added' | 'removed' | 'modified' | 'unchanged';

// 单个条款比对结果
export interface ClauseDiff {
  clause_id: string;
  original_text: string;
  standard_text: string;
  diff_type: DiffType;
  similarity: number; // 0-100
  key_differences: string[];
  risk_assessment: string;
  suggestion: string;
}

// 条款比对结果
export interface ClauseComparisonResult {
  contract_id: string;
  contract_type: string;
  total_clauses: number;
  matched_clauses: number;
  modified_clauses: number;
  missing_clauses: number;
  extra_clauses: number;
  diffs: ClauseDiff[];
  summary: string;
}

// ===== Phase 2: 审批流类型 =====

export type ApproverRole = 'legal_specialist' | 'legal_manager' | 'legal_director' | 'business_dept' | 'general_manager';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'skipped';
export type RouteReason = 'high_risk' | 'medium_risk' | 'low_risk' | 'auto_approved';

// 审批节点
export interface ApprovalNode {
  id: string;
  order: number;
  role: ApproverRole;
  role_label: string;
  status: ApprovalStatus;
  approver_id?: string;
  approver_name?: string;
  comment?: string;
  route_reason: RouteReason;
  created_at: string;
  completed_at?: string;
}

// 审批流
export interface ApprovalFlow {
  id: string;
  contract_id: string;
  nodes: ApprovalNode[];
  current_node: number;
  status: 'pending' | 'in_progress' | 'approved' | 'rejected';
  route_reason: RouteReason;
  auto_approved: boolean;
  created_at: string;
  completed_at?: string;
}

// 审批流角色标签
export const APPROVER_ROLE_LABELS: Record<ApproverRole, string> = {
  legal_specialist: '法务专员',
  legal_manager: '法务经理',
  legal_director: '法务总监',
  business_dept: '业务部门',
  general_manager: '总经理',
};

// 路由原因标签
export const ROUTE_REASON_LABELS: Record<RouteReason, { label: string; color: string }> = {
  high_risk: { label: '高风险触发', color: '#dc2626' },
  medium_risk: { label: '中风险触发', color: '#d97706' },
  low_risk: { label: '低风险触发', color: '#16a34a' },
  auto_approved: { label: '自动通过', color: '#6b7280' },
};

// ===== Phase 2: 数据分析类型 =====

export interface DashboardStats {
  total_contracts: number;
  completed_reviews: number;
  pending_reviews: number;
  avg_risk_score: number;
  high_risk_contracts: number;
  risk_distribution: { level: RiskLevel; count: number }[];
  risk_type_distribution: { type: RiskType; count: number }[];
  monthly_trend: { month: string; count: number; avg_score: number }[];
  top_risks: { type: RiskType; count: number; percentage: number }[];
}

// ===== Phase 4: 批量审查类型 =====

export interface BatchReviewItem {
  id: string;
  filename: string;
  status: 'pending' | 'parsing' | 'reviewing' | 'completed' | 'failed';
  contract_type?: string;
  risk_score?: number;
  risk_count?: number;
  high_risk_count?: number;
  error?: string;
  reviewId?: string;
}

export interface BatchReviewResult {
  total: number;
  completed: number;
  failed: number;
  items: BatchReviewItem[];
}

// ===== Phase 4: 审查报告类型 =====

export interface ReviewReport {
  report_id: string;
  contract_id: string;
  contract_title: string;
  contract_type: string;
  filename: string;
  review_date: string;
  risk_score: number;
  risk_count: number;
  high_risk_count: number;
  medium_risk_count: number;
  low_risk_count: number;
  summary: string;
  risks: ContractRisk[];
  approval_status?: string;
  generated_at: string;
}

// ===== Phase 4: 合同到期管理类型 =====

export type ContractLifecycleStatus = 'draft' | 'active' | 'expiring_soon' | 'expired' | 'terminated';

export interface ContractLifecycle {
  id: string;
  contract_id: string;
  contract_title: string;
  contract_type: string;
  party_a: string;
  party_b: string;
  start_date: string;
  end_date: string;
  status: ContractLifecycleStatus;
  auto_renew: boolean;
  renewal_notice_days: number;
  value?: number;
  currency?: string;
  days_until_expiry: number;
}

export const LIFECYCLE_STATUS_CONFIG: Record<ContractLifecycleStatus, { label: string; color: string; bg: string }> = {
  draft: { label: '草案', color: '#6b7280', bg: '#f9fafb' },
  active: { label: '生效中', color: '#16a34a', bg: '#f0fdf4' },
  expiring_soon: { label: '即将到期', color: '#d97706', bg: '#fffbeb' },
  expired: { label: '已到期', color: '#dc2626', bg: '#fef2f2' },
  terminated: { label: '已终止', color: '#6b7280', bg: '#f3f4f6' },
};

// ===== Phase 4: 团队协作类型 =====

export interface ContractComment {
  id: string;
  contract_id: string;
  risk_id?: string;
  user_id: string;
  user_name: string;
  user_role: string;
  content: string;
  mentions: string[];
  parent_id?: string;
  resolved: boolean;
  created_at: string;
}

// ===== Phase 4: 合同模板库类型 =====

export interface ContractTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  contract_type: string;
  content: string;
  key_clauses: string[];
  risk_notes: string[];
  version: string;
  updated_at: string;
  usage_count: number;
}

// ===== Phase 5: AI合同问答类型 =====

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  references?: { clause_id: string; clause_text: string }[];
}

export interface ContractQAContext {
  contract_id: string;
  contract_title: string;
  contract_type: string;
  contract_text: string;
  risks: ContractRisk[];
}

// ===== Phase 5: 合同对比分析类型 =====

export interface ContractComparisonItem {
  clause_label: string;
  contract_a_text: string;
  contract_b_text: string;
  diff_type: 'same' | 'modified' | 'only_a' | 'only_b';
  similarity: number;
  key_differences: string[];
  risk_implication: string;
}

export interface ContractComparisonResult {
  contract_a: { id: string; title: string; type: string };
  contract_b: { id: string; title: string; type: string };
  summary: string;
  overall_similarity: number;
  items: ContractComparisonItem[];
  unique_risks_a: string[];
  unique_risks_b: string[];
}

// ===== Phase 5: 风险趋势预警类型 =====

export type AlertSeverity = 'critical' | 'warning' | 'info';
export type AlertStatus = 'active' | 'acknowledged' | 'resolved';

export interface RiskAlert {
  id: string;
  severity: AlertSeverity;
  status: AlertStatus;
  title: string;
  description: string;
  contract_id?: string;
  contract_title?: string;
  metric: string;
  threshold: number;
  current_value: number;
  trend: 'up' | 'down' | 'stable';
  created_at: string;
  resolved_at?: string;
}

export interface RiskTrendData {
  period: string;
  avg_risk_score: number;
  high_risk_count: number;
  total_contracts: number;
  top_risk_type: string;
}

export const ALERT_SEVERITY_CONFIG: Record<AlertSeverity, { label: string; color: string; bg: string; icon: string }> = {
  critical: { label: '严重', color: '#dc2626', bg: '#fef2f2', icon: 'alert-octagon' },
  warning: { label: '警告', color: '#d97706', bg: '#fffbeb', icon: 'alert-triangle' },
  info: { label: '提示', color: '#2563eb', bg: '#eff6ff', icon: 'info' },
};

// ===== Phase 5: 邮件通知类型 =====

export type NotificationEventType = 'review_completed' | 'high_risk_detected' | 'approval_required' | 'approval_completed' | 'contract_expiring' | 'comment_received';

export interface EmailNotification {
  id: string;
  event_type: NotificationEventType;
  recipient: string;
  recipient_name: string;
  subject: string;
  body: string;
  contract_id?: string;
  contract_title?: string;
  sent: boolean;
  sent_at?: string;
  created_at: string;
}

export const NOTIFICATION_EVENT_LABELS: Record<NotificationEventType, string> = {
  review_completed: '审查完成',
  high_risk_detected: '高风险预警',
  approval_required: '审批待办',
  approval_completed: '审批完成',
  contract_expiring: '合同即将到期',
  comment_received: '收到评论',
};

// ===== Phase 5: 开放API类型 =====

export interface ApiEndpointDoc {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  summary: string;
  description: string;
  request_params: { name: string; type: string; required: boolean; description: string }[];
  response_fields: { name: string; type: string; description: string }[];
  example_request?: string;
  example_response?: string;
}

// ===== Phase 6: 合同版本管理类型 =====

export type VersionChangeType = 'added' | 'removed' | 'modified' | 'unchanged';

export interface ContractVersion {
  id: string;
  contract_id: string;
  version_number: number;
  version_label: string;
  content: string;
  change_summary: string;
  changes: VersionChange[];
  created_by: string;
  created_at: string;
}

export interface VersionChange {
  clause_id: string;
  change_type: VersionChangeType;
  old_text?: string;
  new_text?: string;
  description: string;
  risk_impact: 'none' | 'positive' | 'negative' | 'neutral';
}

export const CHANGE_TYPE_CONFIG: Record<VersionChangeType, { label: string; color: string; bg: string }> = {
  added: { label: '新增', color: '#16a34a', bg: '#f0fdf4' },
  removed: { label: '删除', color: '#dc2626', bg: '#fef2f2' },
  modified: { label: '修改', color: '#d97706', bg: '#fffbeb' },
  unchanged: { label: '未变', color: '#6b7280', bg: '#f9fafb' },
};

// ===== Phase 6: 自定义风险规则类型 =====

export type RuleOperator = 'contains' | 'not_contains' | 'equals' | 'regex' | 'greater_than' | 'less_than';
export type RuleSeverity = 'high' | 'medium' | 'low';
export type RuleStatus = 'active' | 'inactive';

export interface CustomRiskRule {
  id: string;
  name: string;
  description: string;
  rule_type: string;
  field: string;
  operator: RuleOperator;
  value: string;
  severity: RuleSeverity;
  suggestion: string;
  status: RuleStatus;
  match_count: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface RuleMatchResult {
  rule_id: string;
  rule_name: string;
  clause_id: string;
  clause_text: string;
  matched_value: string;
  severity: RuleSeverity;
  suggestion: string;
}

export const RULE_OPERATOR_LABELS: Record<RuleOperator, string> = {
  contains: '包含',
  not_contains: '不包含',
  equals: '等于',
  regex: '正则匹配',
  greater_than: '大于',
  less_than: '小于',
};

// ===== Phase 6: 审计追踪类型 =====

export type AuditAction =
  | 'contract_uploaded' | 'review_started' | 'review_completed'
  | 'risk_accepted' | 'risk_rejected' | 'approval_submitted' | 'approval_approved'
  | 'approval_rejected' | 'comment_added' | 'report_exported'
  | 'version_created' | 'rule_created' | 'rule_updated' | 'rule_deleted'
  | 'settings_changed' | 'user_login' | 'user_logout';

export interface AuditLogEntry {
  id: string;
  action: AuditAction;
  actor_id: string;
  actor_name: string;
  actor_role: string;
  contract_id?: string;
  contract_title?: string;
  risk_id?: string;
  details: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  timestamp: string;
}

export interface AuditComplianceReport {
  total_actions: number;
  unique_users: number;
  actions_by_type: Record<string, number>;
  recent_activities: AuditLogEntry[];
  compliance_score: number;
  issues: string[];
  period: { start: string; end: string };
}

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  contract_uploaded: '合同上传',
  review_started: '审查开始',
  review_completed: '审查完成',
  risk_accepted: '采纳风险建议',
  risk_rejected: '驳回风险建议',
  approval_submitted: '提交审批',
  approval_approved: '审批通过',
  approval_rejected: '审批驳回',
  comment_added: '添加评论',
  report_exported: '导出报告',
  version_created: '创建版本',
  rule_created: '创建规则',
  rule_updated: '更新规则',
  rule_deleted: '删除规则',
  settings_changed: '修改设置',
  user_login: '用户登录',
  user_logout: '用户登出',
};

// ===== Phase 6: Webhook集成类型 =====

export type WebhookEvent = 'review.completed' | 'risk.high_detected' | 'approval.created' | 'approval.completed' | 'contract.expiring' | 'comment.added';
export type WebhookStatus = 'active' | 'inactive' | 'failing';

export interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  events: WebhookEvent[];
  secret: string;
  status: WebhookStatus;
  last_triggered?: string;
  last_response_status?: number;
  success_count: number;
  failure_count: number;
  created_at: string;
  updated_at: string;
}

export interface WebhookDeliveryLog {
  id: string;
  webhook_id: string;
  webhook_name: string;
  event: WebhookEvent;
  payload: Record<string, any>;
  response_status: number;
  response_body: string;
  duration_ms: number;
  success: boolean;
  timestamp: string;
}

export const WEBHOOK_EVENT_LABELS: Record<WebhookEvent, string> = {
  'review.completed': '审查完成',
  'risk.high_detected': '高风险检测',
  'approval.created': '审批创建',
  'approval.completed': '审批完成',
  'contract.expiring': '合同到期',
  'comment.added': '评论添加',
};

// ===== Phase 7: 多语言合同审查类型 =====

export type ContractLanguage = 'zh' | 'en' | 'bilingual';

export interface LanguageDetectionResult {
  language: ContractLanguage;
  confidence: number;
  chinese_ratio: number;
  english_ratio: number;
  total_chars: number;
}

export interface BilingualClause {
  clause_id: string;
  chinese_text?: string;
  english_text?: string;
  alignment_confidence: number;
  semantic_similarity: number;
  discrepancies: BilingualDiscrepancy[];
}

export interface BilingualDiscrepancy {
  type: 'missing_clause' | 'value_mismatch' | 'term_mismatch' | 'structure_mismatch';
  description: string;
  chinese_ref?: string;
  english_ref?: string;
  severity: 'high' | 'medium' | 'low';
}

export const LANGUAGE_LABELS: Record<ContractLanguage, string> = {
  zh: '中文',
  en: '英文',
  bilingual: '中英双语',
};

// ===== Phase 7: OCR扫描件识别类型 =====

export type OCRStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface OCRResult {
  id: string;
  filename: string;
  status: OCRStatus;
  language: ContractLanguage;
  total_pages: number;
  processed_pages: number;
  extracted_text: string;
  confidence: number;
  page_results: OCRPageResult[];
  warnings: string[];
  created_at: string;
  completed_at?: string;
}

export interface OCRPageResult {
  page_number: number;
  text: string;
  confidence: number;
  regions: OcrTextRegion[];
}

export interface OcrTextRegion {
  bbox: { x: number; y: number; width: number; height: number };
  text: string;
  confidence: number;
}

// ===== Phase 7: 角色权限管理类型 =====

export type SystemRole = 'admin' | 'legal_manager' | 'legal_reviewer' | 'business_user' | 'viewer';
export type Permission = 'contract:read' | 'contract:write' | 'contract:delete' | 'review:execute' | 'review:approve' | 'rules:manage' | 'audit:read' | 'webhook:manage' | 'users:manage' | 'settings:manage';

export interface RolePermission {
  role: SystemRole;
  permissions: Permission[];
  description: string;
}

export interface Department {
  id: string;
  name: string;
  parent_id?: string;
  member_count: number;
  contract_count: number;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: SystemRole;
  department_id: string;
  department_name: string;
  avatar_color: string;
  contracts_reviewed: number;
  pending_approvals: number;
  last_active: string;
  status: 'active' | 'inactive';
}

export interface AccessControlEntry {
  id: string;
  resource_type: 'contract' | 'template' | 'rule' | 'webhook';
  resource_id: string;
  resource_name: string;
  principal_type: 'user' | 'role' | 'department';
  principal_id: string;
  principal_name: string;
  permissions: Permission[];
  created_at: string;
}

export const ROLE_LABELS: Record<SystemRole, string> = {
  admin: '系统管理员',
  legal_manager: '法务经理',
  legal_reviewer: '法务专员',
  business_user: '业务用户',
  viewer: '只读用户',
};

export const PERMISSION_LABELS: Record<Permission, string> = {
  'contract:read': '查看合同',
  'contract:write': '编辑合同',
  'contract:delete': '删除合同',
  'review:execute': '执行审查',
  'review:approve': '审批审查',
  'rules:manage': '管理规则',
  'audit:read': '查看审计',
  'webhook:manage': '管理Webhook',
  'users:manage': '管理用户',
  'settings:manage': '管理设置',
};

export const ROLE_PERMISSIONS: RolePermission[] = [
  { role: 'admin', permissions: ['contract:read', 'contract:write', 'contract:delete', 'review:execute', 'review:approve', 'rules:manage', 'audit:read', 'webhook:manage', 'users:manage', 'settings:manage'], description: '全部权限' },
  { role: 'legal_manager', permissions: ['contract:read', 'contract:write', 'review:execute', 'review:approve', 'rules:manage', 'audit:read'], description: '法务管理权限' },
  { role: 'legal_reviewer', permissions: ['contract:read', 'contract:write', 'review:execute', 'audit:read'], description: '审查与编辑权限' },
  { role: 'business_user', permissions: ['contract:read', 'contract:write', 'review:execute'], description: '业务操作权限' },
  { role: 'viewer', permissions: ['contract:read'], description: '只读权限' },
];

// ===== Phase 7: 合同起草助手类型 =====

export type DraftingClauseType = 'payment' | 'delivery' | 'confidentiality' | 'ip_ownership' | 'liability' | 'termination' | 'dispute_resolution' | 'force_majeure' | 'custom';

export interface DraftedClause {
  id: string;
  clause_type: DraftingClauseType;
  title: string;
  content: string;
  variables: ClauseVariable[];
  risk_notes: string[];
}

export interface DraftingProject {
  id: string;
  name: string;
  contract_type: string;
  party_a: string;
  party_b: string;
  clauses: DraftedClause[];
  status: 'draft' | 'review' | 'finalized';
  created_at: string;
  updated_at: string;
}

export const DRAFTING_CLAUSE_TYPE_LABELS: Record<DraftingClauseType, string> = {
  payment: '付款条款',
  delivery: '交付条款',
  confidentiality: '保密条款',
  ip_ownership: '知识产权归属',
  liability: '违约责任',
  termination: '终止条款',
  dispute_resolution: '争议解决',
  force_majeure: '不可抗力',
  custom: '自定义条款',
};

// ===== Phase 8: 智能合同摘要类型 =====

export interface ContractSummary {
  contract_id: string;
  contract_title: string;
  contract_type: string;
  summary: string;
  key_terms: KeyTerm[];
  financial_terms: FinancialTerm[];
  timeline: ContractTimelineEvent[];
  parties: ContractParty[];
  key_dates: KeyDate[];
  risk_assessment: {
    overall_level: 'low' | 'medium' | 'high';
    key_risks: string[];
    recommendations: string[];
  };
  word_count: number;
  clause_count: number;
  generated_at: string;
}

export interface KeyTerm {
  category: string;
  term: string;
  value: string;
  clause_ref?: string;
}

export interface FinancialTerm {
  type: 'total_amount' | 'unit_price' | 'penalty' | 'deposit' | 'other';
  description: string;
  amount: number;
  currency: string;
  clause_ref?: string;
}

export interface ContractTimelineEvent {
  event: string;
  date: string;
  condition?: string;
  clause_ref?: string;
}

export interface ContractParty {
  role: 'party_a' | 'party_b' | 'guarantor' | 'witness';
  name: string;
  legal_rep?: string;
  address?: string;
  contact?: string;
}

export interface KeyDate {
  label: string;
  date: string;
  significance: 'critical' | 'important' | 'normal';
}

// ===== Phase 8: 合规检查引擎类型 =====

export type ComplianceCategory = 'company_law' | 'contract_law' | 'labor_law' | 'data_protection' | 'tax_law' | 'industry_specific';
export type ComplianceStatus = 'compliant' | 'warning' | 'violation' | 'not_applicable';

export interface ComplianceRule {
  id: string;
  category: ComplianceCategory;
  rule_number: string;
  title: string;
  description: string;
  legal_basis: string;
  check_pattern: string;
  status: ComplianceStatus;
  severity: 'high' | 'medium' | 'low';
  recommendation?: string;
}

export interface ComplianceCheckResult {
  rule_id: string;
  category: ComplianceCategory;
  title: string;
  legal_basis: string;
  status: ComplianceStatus;
  severity: 'high' | 'medium' | 'low';
  details: string;
  clause_refs?: string[];
  recommendation?: string;
}

export interface ComplianceReport {
  contract_id: string;
  contract_title: string;
  overall_status: ComplianceStatus;
  compliance_score: number;
  total_checks: number;
  passed: number;
  warnings: number;
  violations: number;
  not_applicable: number;
  results: ComplianceCheckResult[];
  generated_at: string;
}

export const COMPLIANCE_CATEGORY_LABELS: Record<ComplianceCategory, string> = {
  company_law: '公司法',
  contract_law: '合同法',
  labor_law: '劳动法',
  data_protection: '数据保护',
  tax_law: '税法',
  industry_specific: '行业规范',
};

export const COMPLIANCE_STATUS_CONFIG: Record<ComplianceStatus, { label: string; color: string; bg: string }> = {
  compliant: { label: '合规', color: '#16a34a', bg: '#f0fdf4' },
  warning: { label: '警告', color: '#d97706', bg: '#fffbeb' },
  violation: { label: '违规', color: '#dc2626', bg: '#fef2f2' },
  not_applicable: { label: '不适用', color: '#6b7280', bg: '#f9fafb' },
};

// ===== Phase 8: 电子签章类型 =====

export type SignatureStatus = 'pending' | 'signed' | 'rejected' | 'expired' | 'voided';
export type SignerStatus = 'waiting' | 'signed' | 'rejected' | 'delegated';

export interface SignatureRequest {
  id: string;
  contract_id: string;
  contract_title: string;
  initiators: Signer[];
  signers: Signer[];
  signing_order: 'sequential' | 'parallel' | 'any';
  status: SignatureStatus;
  created_at: string;
  expires_at: string;
  completed_at?: string;
  document_hash: string;
  certificate_info?: CertificateInfo;
  audit_trail: SignatureAuditEntry[];
}

export interface Signer {
  id: string;
  name: string;
  email: string;
  role: string;
  status: SignerStatus;
  signed_at?: string;
  ip_address?: string;
  device_info?: string;
  signature_image?: string;
  delegated_to?: string;
}

export interface CertificateInfo {
  issuer: string;
  subject: string;
  serial_number: string;
  valid_from: string;
  valid_to: string;
  algorithm: string;
}

export interface SignatureAuditEntry {
  timestamp: string;
  action: string;
  actor: string;
  details: string;
  ip_address?: string;
}

export const SIGNATURE_STATUS_CONFIG: Record<SignatureStatus, { label: string; color: string; bg: string }> = {
  pending: { label: '待签', color: '#d97706', bg: '#fffbeb' },
  signed: { label: '已签', color: '#16a34a', bg: '#f0fdf4' },
  rejected: { label: '拒签', color: '#dc2626', bg: '#fef2f2' },
  expired: { label: '过期', color: '#6b7280', bg: '#f9fafb' },
  voided: { label: '作废', color: '#6b7280', bg: '#f3f4f6' },
};

export const SIGNER_STATUS_CONFIG: Record<SignerStatus, { label: string; color: string; bg: string }> = {
  waiting: { label: '待签', color: '#d97706', bg: '#fffbeb' },
  signed: { label: '已签', color: '#16a34a', bg: '#f0fdf4' },
  rejected: { label: '拒签', color: '#dc2626', bg: '#fef2f2' },
  delegated: { label: '已委托', color: '#2563eb', bg: '#eff6ff' },
};

// ===== Phase 8: 全文搜索类型 =====

export interface SearchFilter {
  contract_type?: string;
  risk_level?: string;
  date_from?: string;
  date_to?: string;
  risk_score_min?: number;
  risk_score_max?: number;
  party_name?: string;
  status?: string;
}

export interface SearchResultItem {
  contract_id: string;
  contract_title: string;
  contract_type: string;
  snippet: string;
  highlighted_terms: { term: string; positions: number[] }[];
  risk_score: number;
  risk_count: number;
  date: string;
  relevance: number;
  matched_fields: string[];
}

export interface SearchResponse {
  query: string;
  total: number;
  page: number;
  page_size: number;
  results: SearchResultItem[];
  facets: {
    contract_types: { label: string; count: number }[];
    risk_levels: { label: string; count: number }[];
    date_ranges: { label: string; count: number }[];
  };
  search_time_ms: number;
  suggestions?: string[];
}

// ===== Phase 8: 系统健康监控类型 =====

export type ServiceStatus = 'healthy' | 'degraded' | 'down' | 'maintenance';
export type MetricTrend = 'up' | 'down' | 'stable';

export interface ServiceHealth {
  name: string;
  status: ServiceStatus;
  uptime: number;
  response_time: number;
  last_check: string;
  details?: string;
}

export interface SystemMetrics {
  timestamp: string;
  cpu_usage: number;
  memory_usage: number;
  disk_usage: number;
  network_in: number;
  network_out: number;
  active_users: number;
  requests_per_minute: number;
  avg_response_time: number;
  error_rate: number;
}

export interface HealthCheckResult {
  id: string;
  name: string;
  category: 'api' | 'database' | 'ai_service' | 'storage' | 'cache' | 'email';
  status: ServiceStatus;
  response_time: number;
  uptime: number;
  last_error?: string;
  last_check: string;
  metrics: { label: string; value: string; trend: MetricTrend }[];
}

export interface SystemHealthDashboard {
  overall_status: ServiceStatus;
  services: HealthCheckResult[];
  recent_metrics: SystemMetrics[];
  alerts: { id: string; severity: 'critical' | 'warning' | 'info'; message: string; timestamp: string }[];
  uptime_stats: { period: string; uptime: number; downtime: number; incidents: number }[];
}

export const SERVICE_STATUS_CONFIG: Record<ServiceStatus, { label: string; color: string; bg: string }> = {
  healthy: { label: '健康', color: '#16a34a', bg: '#f0fdf4' },
  degraded: { label: '降级', color: '#d97706', bg: '#fffbeb' },
  down: { label: '故障', color: '#dc2626', bg: '#fef2f2' },
  maintenance: { label: '维护中', color: '#2563eb', bg: '#eff6ff' },
};

// ===== Phase 9: 自动续签引擎类型 =====

export type RenewalStrategy = 'auto_renew' | 'notify_only' | 'manual_review' | 'no_renewal';
export type RenewalStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'overdue';

export interface RenewalPolicy {
  id: string;
  contract_id: string;
  contract_title: string;
  contract_type: string;
  strategy: RenewalStrategy;
  renewal_term_months: number;
  notice_days_before: number;
  price_adjustment_cap: number;
  auto_conditions: {
    min_risk_score: number;
    max_risk_score: number;
    requires_approval: boolean;
    max_price_increase: number;
  };
  status: RenewalStatus;
  current_end_date: string;
  proposed_end_date: string;
  triggered_at?: string;
  completed_at?: string;
  checklist: RenewalChecklistItem[];
}

export interface RenewalChecklistItem {
  id: string;
  label: string;
  completed: boolean;
  required: boolean;
  completed_at?: string;
}

export const RENEWAL_STRATEGY_LABELS: Record<RenewalStrategy, string> = {
  auto_renew: '自动续签',
  notify_only: '仅通知',
  manual_review: '人工审查',
  no_renewal: '不续签',
};

export const RENEWAL_STATUS_CONFIG: Record<RenewalStatus, { label: string; color: string; bg: string }> = {
  scheduled: { label: '已安排', color: '#2563eb', bg: '#eff6ff' },
  in_progress: { label: '进行中', color: '#d97706', bg: '#fffbeb' },
  completed: { label: '已完成', color: '#16a34a', bg: '#f0fdf4' },
  cancelled: { label: '已取消', color: '#dc2626', bg: '#fef2f2' },
  overdue: { label: '已逾期', color: '#dc2626', bg: '#fef2f2' },
};

// ===== Phase 9: 供应商/客户档案类型 =====

export type PartnerType = 'supplier' | 'customer' | 'both';
export type PartnerStatus = 'active' | 'inactive' | 'blacklisted';
export type CreditRating = 'aaa' | 'aa' | 'a' | 'bbb' | 'bb' | 'b' | 'c';

export interface PartnerProfile {
  id: string;
  name: string;
  type: PartnerType;
  status: PartnerStatus;
  credit_rating: CreditRating;
  industry: string;
  registered_capital: number;
  currency: string;
  legal_representative: string;
  contact_person: string;
  contact_email: string;
  contact_phone: string;
  address: string;
  tax_id: string;
  bank_account?: string;
  contract_count: number;
  total_contract_value: number;
  avg_risk_score: number;
  high_risk_count: number;
  last_contract_date: string;
  established_date: string;
  notes: string;
  created_at: string;
}

export interface PartnerCreditHistory {
  id: string;
  partner_id: string;
  date: string;
  event: string;
  impact: 'positive' | 'negative' | 'neutral';
  rating_before: CreditRating;
  rating_after: CreditRating;
  description: string;
}

export const PARTNER_TYPE_LABELS: Record<PartnerType, string> = {
  supplier: '供应商',
  customer: '客户',
  both: '供应商/客户',
};

export const PARTNER_STATUS_CONFIG: Record<PartnerStatus, { label: string; color: string; bg: string }> = {
  active: { label: '合作中', color: '#16a34a', bg: '#f0fdf4' },
  inactive: { label: '已停用', color: '#6b7280', bg: '#f9fafb' },
  blacklisted: { label: '黑名单', color: '#dc2626', bg: '#fef2f2' },
};

export const CREDIT_RATING_CONFIG: Record<CreditRating, { label: string; color: string }> = {
  aaa: { label: 'AAA', color: '#16a34a' },
  aa: { label: 'AA', color: '#16a34a' },
  a: { label: 'A', color: '#65a30d' },
  bbb: { label: 'BBB', color: '#d97706' },
  bb: { label: 'BB', color: '#d97706' },
  b: { label: 'B', color: '#dc2626' },
  c: { label: 'C', color: '#dc2626' },
};

// ===== Phase 9: AI智能定价分析类型 =====

export type PriceComparison = 'below_market' | 'at_market' | 'above_market';

export interface PricingAnalysis {
  contract_id: string;
  contract_title: string;
  contract_type: string;
  contract_value: number;
  currency: string;
  unit_price: number;
  unit: string;
  market_benchmark: MarketBenchmark;
  comparison: PriceComparison;
  deviation_percentage: number;
  analysis: string;
  recommendation: string;
  confidence: number;
  factors: PricingFactor[];
  historical_prices: { date: string; price: number; source: string }[];
}

export interface MarketBenchmark {
  min_price: number;
  max_price: number;
  avg_price: number;
  median_price: number;
  sample_count: number;
  source: string;
  last_updated: string;
}

export interface PricingFactor {
  name: string;
  impact: 'positive' | 'negative' | 'neutral';
  description: string;
  weight: number;
}

export const PRICE_COMPARISON_CONFIG: Record<PriceComparison, { label: string; color: string; bg: string }> = {
  below_market: { label: '低于市场', color: '#16a34a', bg: '#f0fdf4' },
  at_market: { label: '符合市场', color: '#2563eb', bg: '#eff6ff' },
  above_market: { label: '高于市场', color: '#dc2626', bg: '#fef2f2' },
};

// ===== Phase 9: 工作流引擎类型 =====

export type WorkflowNodeType = 'start' | 'approve' | 'review' | 'condition' | 'notify' | 'parallel' | 'end';
export type WorkflowStatus = 'draft' | 'active' | 'archived';

export interface WorkflowNode {
  id: string;
  type: WorkflowNodeType;
  label: string;
  x: number;
  y: number;
  config: {
    assignee_role?: string;
    condition_field?: string;
    condition_operator?: string;
    condition_value?: string;
    next_node_true?: string;
    next_node_false?: string;
    notification_template?: string;
    sla_hours?: number;
  };
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  condition?: string;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  contract_type: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  status: WorkflowStatus;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface WorkflowInstance {
  id: string;
  workflow_id: string;
  workflow_name: string;
  contract_id: string;
  contract_title: string;
  current_node_id: string;
  status: 'running' | 'completed' | 'cancelled' | 'error';
  started_at: string;
  completed_at?: string;
  history: WorkflowStepHistory[];
}

export interface WorkflowStepHistory {
  node_id: string;
  node_label: string;
  action: 'enter' | 'approve' | 'reject' | 'skip' | 'timeout';
  actor: string;
  timestamp: string;
  comment?: string;
}

export const WORKFLOW_NODE_TYPE_LABELS: Record<WorkflowNodeType, string> = {
  start: '开始',
  approve: '审批',
  review: '审查',
  condition: '条件判断',
  notify: '通知',
  parallel: '并行处理',
  end: '结束',
};

// ===== Phase 9: 合同知识图谱类型 =====

export type GraphEntityType = 'contract' | 'party' | 'clause' | 'risk' | 'payment' | 'date' | 'obligation';
export type GraphRelationType = 'has_party' | 'has_clause' | 'has_risk' | 'has_payment' | 'has_date' | 'references' | 'conflicts_with' | 'depends_on';

export interface GraphNode {
  id: string;
  type: GraphEntityType;
  label: string;
  properties: Record<string, any>;
  x?: number;
  y?: number;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: GraphRelationType;
  label: string;
  weight: number;
}

export interface KnowledgeGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  stats: {
    total_nodes: number;
    total_edges: number;
    by_type: Record<GraphEntityType, number>;
    by_relation: Record<GraphRelationType, number>;
  };
}

export interface GraphInsight {
  id: string;
  type: 'pattern' | 'anomaly' | 'recommendation' | 'risk_cluster';
  title: string;
  description: string;
  related_nodes: string[];
  confidence: number;
}

export const GRAPH_ENTITY_TYPE_LABELS: Record<GraphEntityType, string> = {
  contract: '合同',
  party: '主体',
  clause: '条款',
  risk: '风险',
  payment: '付款',
  date: '日期',
  obligation: '义务',
};

export const GRAPH_RELATION_TYPE_LABELS: Record<GraphRelationType, string> = {
  has_party: '主体关联',
  has_clause: '包含条款',
  has_risk: '存在风险',
  has_payment: '付款关联',
  has_date: '日期关联',
  references: '引用',
  conflicts_with: '冲突',
  depends_on: '依赖',
};

// ===== Phase 10: 合同谈判助手类型 =====

export type NegotiationStatus = 'draft' | 'in_progress' | 'agreed' | 'rejected' | 'stalled';
export type NegotiationStance = 'accept' | 'counter' | 'reject' | 'conditional';
export type ConcessionType = 'price' | 'payment_terms' | 'delivery' | 'warranty' | 'liability' | 'scope' | 'ip_rights' | 'termination';

export interface NegotiationSession {
  id: string;
  contract_id: string;
  contract_title: string;
  counterparty: string;
  status: NegotiationStatus;
  round: number;
  started_at: string;
  last_updated: string;
  our_position: NegotiationPosition;
  their_position: NegotiationPosition;
  agreed_terms: AgreedTerm[];
  concessions: Concession[];
  ai_analysis: NegotiationAnalysis;
}

export interface NegotiationPosition {
  must_haves: NegotiationPoint[];
  nice_to_haves: NegotiationPoint[];
  deal_breakers: NegotiationPoint[];
}

export interface NegotiationPoint {
  id: string;
  clause: string;
  our_proposal: string;
  their_proposal: string;
  stance: NegotiationStance;
  rationale: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
}

export interface AgreedTerm {
  id: string;
  clause: string;
  agreed_text: string;
  original_gap: string;
  round_agreed: number;
}

export interface Concession {
  id: string;
  type: ConcessionType;
  description: string;
  given_by: 'us' | 'them' | 'both';
  estimated_value: number;
  trade_off: string;
  round: number;
}

export interface NegotiationAnalysis {
  overall_assessment: string;
  balance_score: number;
  our_leverage: string[];
  their_leverage: string[];
  recommendations: string[];
  batna: string;
  zone_of_possible_agreement: { min: number; max: number };
  risk_of_breakdown: number;
}

export const NEGOTIATION_STATUS_CONFIG: Record<NegotiationStatus, { label: string; color: string; bg: string }> = {
  draft: { label: '草稿', color: '#6b7280', bg: '#f9fafb' },
  in_progress: { label: '谈判中', color: '#2563eb', bg: '#eff6ff' },
  agreed: { label: '已达成', color: '#16a34a', bg: '#f0fdf4' },
  rejected: { label: '已拒绝', color: '#dc2626', bg: '#fef2f2' },
  stalled: { label: '停滞', color: '#d97706', bg: '#fffbeb' },
};

export const CONCESSION_TYPE_LABELS: Record<ConcessionType, string> = {
  price: '价格',
  payment_terms: '付款条件',
  delivery: '交付',
  warranty: '保修',
  liability: '责任',
  scope: '范围',
  ip_rights: '知识产权',
  termination: '终止',
};

// ===== Phase 10: 合同履约监控类型 =====

export type PerformanceStatus = 'on_track' | 'at_risk' | 'delayed' | 'completed' | 'not_started';
export type MilestoneType = 'payment' | 'delivery' | 'review' | 'approval' | 'report' | 'renewal';

export interface PerformanceTracker {
  id: string;
  contract_id: string;
  contract_title: string;
  counterparty: string;
  start_date: string;
  end_date: string;
  overall_progress: number;
  status: PerformanceStatus;
  kpis: PerformanceKPI[];
  milestones: Milestone[];
  obligations: Obligation[];
  alerts: PerformanceAlert[];
}

export interface PerformanceKPI {
  id: string;
  name: string;
  target: number;
  actual: number;
  unit: string;
  status: PerformanceStatus;
  trend: 'up' | 'down' | 'flat';
  last_updated: string;
}

export interface Milestone {
  id: string;
  name: string;
  type: MilestoneType;
  planned_date: string;
  actual_date?: string;
  status: PerformanceStatus;
  responsible_party: 'us' | 'them';
  deliverables: string[];
  completed: boolean;
}

export interface Obligation {
  id: string;
  description: string;
  party: 'us' | 'them';
  due_date: string;
  status: PerformanceStatus;
  evidence: string;
  recurrence: 'one_time' | 'monthly' | 'quarterly' | 'annually';
}

export interface PerformanceAlert {
  id: string;
  type: 'milestone_delay' | 'kpi_breach' | 'obligation_overdue' | 'deadline_approaching';
  severity: 'critical' | 'warning' | 'info';
  message: string;
  timestamp: string;
}

export const PERFORMANCE_STATUS_CONFIG: Record<PerformanceStatus, { label: string; color: string; bg: string }> = {
  on_track: { label: '正常', color: '#16a34a', bg: '#f0fdf4' },
  at_risk: { label: '有风险', color: '#d97706', bg: '#fffbeb' },
  delayed: { label: '已延误', color: '#dc2626', bg: '#fef2f2' },
  completed: { label: '已完成', color: '#2563eb', bg: '#eff6ff' },
  not_started: { label: '未开始', color: '#6b7280', bg: '#f9fafb' },
};

export const MILESTONE_TYPE_LABELS: Record<MilestoneType, string> = {
  payment: '付款',
  delivery: '交付',
  review: '审查',
  approval: '审批',
  report: '报告',
  renewal: '续签',
};

// ===== Phase 10: 法规变更监控类型 =====

export type RegulatoryChangeType = 'new_law' | 'amendment' | 'repeal' | 'interpretation' | 'guideline';
export type RegulatoryImpactLevel = 'critical' | 'high' | 'medium' | 'low' | 'none';
export type RegulatoryStatus = 'monitoring' | 'assessing' | 'action_required' | 'compliant' | 'non_compliant';

export interface RegulatoryChange {
  id: string;
  title: string;
  type: RegulatoryChangeType;
  jurisdiction: string;
  effective_date: string;
  published_date: string;
  summary: string;
  full_text_url?: string;
  affected_areas: string[];
  impact_level: RegulatoryImpactLevel;
  affected_contracts: AffectedContract[];
  recommended_actions: string[];
  status: RegulatoryStatus;
  deadline?: string;
}

export interface AffectedContract {
  contract_id: string;
  contract_title: string;
  impact_description: string;
  action_required: 'amend' | 'renegotiate' | 'terminate' | 'monitor' | 'no_action';
  urgency: 'immediate' | 'short_term' | 'long_term';
}

export interface RegulatoryComplianceGap {
  contract_id: string;
  contract_title: string;
  gap_description: string;
  current_clause: string;
  required_clause: string;
  regulation_reference: string;
}

export const REGULATORY_CHANGE_TYPE_LABELS: Record<RegulatoryChangeType, string> = {
  new_law: '新法规',
  amendment: '修正案',
  repeal: '废止',
  interpretation: '司法解释',
  guideline: '指导方针',
};

export const REGULATORY_IMPACT_CONFIG: Record<RegulatoryImpactLevel, { label: string; color: string; bg: string }> = {
  critical: { label: '严重影响', color: '#dc2626', bg: '#fef2f2' },
  high: { label: '较大影响', color: '#d97706', bg: '#fffbeb' },
  medium: { label: '中等影响', color: '#2563eb', bg: '#eff6ff' },
  low: { label: '轻微影响', color: '#65a30d', bg: '#f7fee7' },
  none: { label: '无影响', color: '#6b7280', bg: '#f9fafb' },
};

export const REGULATORY_STATUS_CONFIG: Record<RegulatoryStatus, { label: string; color: string; bg: string }> = {
  monitoring: { label: '监控中', color: '#2563eb', bg: '#eff6ff' },
  assessing: { label: '评估中', color: '#d97706', bg: '#fffbeb' },
  action_required: { label: '需行动', color: '#dc2626', bg: '#fef2f2' },
  compliant: { label: '已合规', color: '#16a34a', bg: '#f0fdf4' },
  non_compliant: { label: '不合规', color: '#dc2626', bg: '#fef2f2' },
};

// ===== Phase 10: 合同风险模拟类型 =====

export type SimulationScenario = 'best_case' | 'base_case' | 'worst_case' | 'stress_test' | 'monte_carlo';
export type RiskCategory = 'financial' | 'operational' | 'legal' | 'market' | 'counterparty' | 'force_majeure';

export interface RiskSimulation {
  id: string;
  contract_id: string;
  contract_title: string;
  scenario: SimulationScenario;
  iterations: number;
  generated_at: string;
  summary: SimulationSummary;
  risk_factors: SimulationRiskFactor[];
  scenario_results: ScenarioResult[];
  distribution: { range: string; probability: number; count: number }[];
  var_analysis: ValueAtRisk;
  recommendations: string[];
}

export interface SimulationSummary {
  expected_loss: number;
  max_loss: number;
  min_loss: number;
  std_deviation: number;
  probability_of_loss: number;
  expected_value: number;
  confidence_interval: { lower: number; upper: number; level: number };
}

export interface SimulationRiskFactor {
  id: string;
  category: RiskCategory;
  name: string;
  probability: number;
  impact: number;
  weight: number;
  description: string;
  mitigation: string;
}

export interface ScenarioResult {
  scenario: string;
  probability: number;
  loss: number;
  description: string;
}

export interface ValueAtRisk {
  var_95: number;
  var_99: number;
  cvar_95: number;
  cvar_99: number;
  max_drawdown: number;
}

export const SIMULATION_SCENARIO_LABELS: Record<SimulationScenario, string> = {
  best_case: '最佳情景',
  base_case: '基准情景',
  worst_case: '最差情景',
  stress_test: '压力测试',
  monte_carlo: '蒙特卡洛',
};

export const RISK_CATEGORY_LABELS: Record<RiskCategory, string> = {
  financial: '财务风险',
  operational: '运营风险',
  legal: '法律风险',
  market: '市场风险',
  counterparty: '对手方风险',
  force_majeure: '不可抗力',
};

// ===== Phase 10: 智能条款库类型 =====

export type ClauseCategory = 'payment' | 'delivery' | 'warranty' | 'liability' | 'termination' | 'confidentiality' | 'ip' | 'dispute_resolution' | 'force_majeure' | 'general';
export type ClauseRiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type ClauseSource = 'standard' | 'best_practice' | 'regulatory' | 'negotiated' | 'custom';

export interface ClauseLibraryItem {
  id: string;
  title: string;
  category: ClauseCategory;
  risk_level: ClauseRiskLevel;
  source: ClauseSource;
  text: string;
  variables: ClauseVariable[];
  applicable_contracts: string[];
  jurisdictions: string[];
  tags: string[];
  favor_count: number;
  usage_count: number;
  last_updated: string;
  alternative_versions: AlternativeClause[];
  risk_notes: string;
  negotiation_tips: string;
}

export interface ClauseVariable {
  name: string;
  label?: string;
  type: 'text' | 'number' | 'date' | 'select' | 'currency' | 'percentage' | 'choice';
  default_value?: string;
  options?: string[];
  required: boolean;
  description?: string;
}

export interface AlternativeClause {
  id: string;
  label: string;
  text: string;
  risk_level: ClauseRiskLevel;
  advantage: string;
  disadvantage: string;
}

export interface ClauseRecommendation {
  id: string;
  contract_type: string;
  context: string;
  recommended_clauses: { clause_id: string; relevance: number; reason: string }[];
  missing_clauses: { category: ClauseCategory; importance: string; reason: string }[];
}

export const CLAUSE_CATEGORY_LABELS: Record<ClauseCategory, string> = {
  payment: '付款条款',
  delivery: '交付条款',
  warranty: '保修条款',
  liability: '责任条款',
  termination: '终止条款',
  confidentiality: '保密条款',
  ip: '知识产权条款',
  dispute_resolution: '争议解决',
  force_majeure: '不可抗力',
  general: '通用条款',
};

export const CLAUSE_RISK_CONFIG: Record<ClauseRiskLevel, { label: string; color: string; bg: string }> = {
  low: { label: '低风险', color: '#16a34a', bg: '#f0fdf4' },
  medium: { label: '中风险', color: '#d97706', bg: '#fffbeb' },
  high: { label: '高风险', color: '#dc2626', bg: '#fef2f2' },
  critical: { label: '极高风险', color: '#991b1b', bg: '#fef2f2' },
};

export const CLAUSE_SOURCE_LABELS: Record<ClauseSource, string> = {
  standard: '标准条款',
  best_practice: '最佳实践',
  regulatory: '法规要求',
  negotiated: '谈判成果',
  custom: '自定义',
};
