-- ===== 企业合同智能审查Agent 数据库Schema =====
-- 在Supabase SQL Editor中执行此文件

-- 开启pgvector扩展（用于向量检索）
CREATE EXTENSION IF NOT EXISTS vector;

-- ===== 1. contracts 表 =====
CREATE TABLE IF NOT EXISTS contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('pdf', 'docx', 'txt')),
  file_size BIGINT NOT NULL,
  file_path TEXT,
  contract_text TEXT,
  contract_type TEXT,
  contract_title TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'completed', 'failed')),
  risk_score INTEGER,
  risk_count INTEGER DEFAULT 0,
  high_risk_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===== 2. contract_risks 表 =====
CREATE TABLE IF NOT EXISTS contract_risks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE,
  clause_id TEXT,
  clause_text TEXT NOT NULL,
  risk_type TEXT NOT NULL CHECK (risk_type IN (
    'payment_risk', 'delivery_risk', 'breach_liability',
    'intellectual_property', 'confidentiality', 'dispute_resolution',
    'force_majeure', 'termination', 'indemnification',
    'data_protection', 'non_compete', 'governing_law', 'other'
  )),
  risk_level TEXT NOT NULL CHECK (risk_level IN ('high', 'medium', 'low')),
  risk_explanation TEXT NOT NULL,
  is_standard_clause BOOLEAN DEFAULT false,
  suggested_redline TEXT,
  citation_verified BOOLEAN DEFAULT false,
  user_decision TEXT CHECK (user_decision IN ('accepted', 'rejected', 'pending')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===== 3. contract_clauses 表（条款分割结果） =====
CREATE TABLE IF NOT EXISTS contract_clauses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE,
  clause_number TEXT NOT NULL,
  clause_type TEXT,
  clause_text TEXT NOT NULL,
  embedding VECTOR(1536),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===== 4. audit_logs 表（审计日志） =====
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  actor TEXT NOT NULL DEFAULT 'system',
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===== 5. approval_flows 表（审批流） =====
CREATE TABLE IF NOT EXISTS approval_flows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE,
  approver_role TEXT CHECK (approver_role IN ('legal_specialist', 'legal_manager', 'legal_director', 'business_dept')),
  approver_id UUID,
  current_node INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'approved', 'rejected')),
  route_reason TEXT NOT NULL DEFAULT 'low_risk' CHECK (route_reason IN ('high_risk', 'medium_risk', 'low_risk', 'auto_approved')),
  auto_approved BOOLEAN DEFAULT false,
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- ===== 6. approval_nodes 表（审批节点） =====
CREATE TABLE IF NOT EXISTS approval_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id UUID REFERENCES approval_flows(id) ON DELETE CASCADE,
  contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE,
  node_order INTEGER NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('legal_specialist', 'legal_manager', 'legal_director', 'business_dept', 'general_manager')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'skipped')),
  approver_id UUID,
  approver_name TEXT,
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- ===== 7. clause_comparisons 表（条款比对结果） =====
CREATE TABLE IF NOT EXISTS clause_comparisons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE,
  contract_type TEXT,
  total_clauses INTEGER DEFAULT 0,
  matched_clauses INTEGER DEFAULT 0,
  modified_clauses INTEGER DEFAULT 0,
  missing_clauses INTEGER DEFAULT 0,
  extra_clauses INTEGER DEFAULT 0,
  summary TEXT,
  diffs JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===== 索引 =====
CREATE INDEX IF NOT EXISTS idx_contracts_user ON contracts(user_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status);
CREATE INDEX IF NOT EXISTS idx_risks_contract ON contract_risks(contract_id);
CREATE INDEX IF NOT EXISTS idx_risks_level ON contract_risks(risk_level);
CREATE INDEX IF NOT EXISTS idx_clauses_contract ON contract_clauses(contract_id);
CREATE INDEX IF NOT EXISTS idx_audit_contract ON audit_logs(contract_id);
CREATE INDEX IF NOT EXISTS idx_approval_contract ON approval_flows(contract_id);
CREATE INDEX IF NOT EXISTS idx_approval_nodes_flow ON approval_nodes(flow_id);
CREATE INDEX IF NOT EXISTS idx_approval_nodes_contract ON approval_nodes(contract_id);
CREATE INDEX IF NOT EXISTS idx_comparison_contract ON clause_comparisons(contract_id);

-- ===== RLS 策略（行级安全） =====
-- 用户只能访问自己的数据
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_risks ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_clauses ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_flows ENABLE ROW LEVEL SECURITY;

-- contracts: 用户只能CRUD自己的合同
CREATE POLICY "Users can view own contracts"
  ON contracts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own contracts"
  ON contracts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own contracts"
  ON contracts FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own contracts"
  ON contracts FOR DELETE
  USING (auth.uid() = user_id);

-- contract_risks: 通过contract_id关联用户
CREATE POLICY "Users can view risks of own contracts"
  ON contract_risks FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM contracts
    WHERE contracts.id = contract_risks.contract_id
    AND contracts.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert risks of own contracts"
  ON contract_risks FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM contracts
    WHERE contracts.id = contract_risks.contract_id
    AND contracts.user_id = auth.uid()
  ));

CREATE POLICY "Users can update risks of own contracts"
  ON contract_risks FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM contracts
    WHERE contracts.id = contract_risks.contract_id
    AND contracts.user_id = auth.uid()
  ));

-- 其他表同理（省略重复策略，实际部署时需要为每张表添加）
CREATE POLICY "Users can view own clauses"
  ON contract_clauses FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM contracts
    WHERE contracts.id = contract_clauses.contract_id
    AND contracts.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert own clauses"
  ON contract_clauses FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM contracts
    WHERE contracts.id = contract_clauses.contract_id
    AND contracts.user_id = auth.uid()
  ));

-- ===== 触发器：自动更新updated_at =====
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER contracts_updated_at
  BEFORE UPDATE ON contracts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ===== Storage Bucket =====
-- 创建合同文件存储桶
INSERT INTO storage.buckets (id, name, public)
VALUES ('contracts', 'contracts', false)
ON CONFLICT (id) DO NOTHING;

-- Storage策略：用户只能访问自己的文件
CREATE POLICY "Users can upload own contract files"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'contracts' AND auth.uid() = owner);

CREATE POLICY "Users can read own contract files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'contracts' AND auth.uid() = owner);

-- ===== Phase 4: 新增表 =====

-- ===== 8. contract_lifecycles 表（合同生命周期/到期管理） =====
CREATE TABLE IF NOT EXISTS contract_lifecycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE,
  contract_title TEXT NOT NULL,
  contract_type TEXT,
  party_a TEXT NOT NULL,
  party_b TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'expiring_soon', 'expired', 'terminated')),
  auto_renew BOOLEAN DEFAULT false,
  renewal_notice_days INTEGER DEFAULT 30,
  value DECIMAL(14, 2),
  currency TEXT DEFAULT 'CNY',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===== 9. contract_comments 表（团队协作评论） =====
CREATE TABLE IF NOT EXISTS contract_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE,
  risk_id UUID REFERENCES contract_risks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  user_name TEXT NOT NULL,
  user_role TEXT,
  content TEXT NOT NULL,
  mentions TEXT[],
  parent_id UUID REFERENCES contract_comments(id) ON DELETE CASCADE,
  resolved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===== 10. review_reports 表（审查报告） =====
CREATE TABLE IF NOT EXISTS review_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE,
  report_format TEXT NOT NULL CHECK (report_format IN ('html', 'txt')),
  risk_score INTEGER,
  risk_count INTEGER DEFAULT 0,
  summary TEXT,
  generated_by UUID REFERENCES auth.users(id),
  file_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===== Phase 4 索引 =====
CREATE INDEX IF NOT EXISTS idx_lifecycle_contract ON contract_lifecycles(contract_id);
CREATE INDEX IF NOT EXISTS idx_lifecycle_status ON contract_lifecycles(status);
CREATE INDEX IF NOT EXISTS idx_lifecycle_end_date ON contract_lifecycles(end_date);
CREATE INDEX IF NOT EXISTS idx_comments_contract ON contract_comments(contract_id);
CREATE INDEX IF NOT EXISTS idx_comments_risk ON contract_comments(risk_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON contract_comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_reports_contract ON review_reports(contract_id);

-- ===== Phase 4 RLS 策略 =====
ALTER TABLE contract_lifecycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own lifecycles"
  ON contract_lifecycles FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM contracts
    WHERE contracts.id = contract_lifecycles.contract_id
    AND contracts.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert own lifecycles"
  ON contract_lifecycles FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM contracts
    WHERE contracts.id = contract_lifecycles.contract_id
    AND contracts.user_id = auth.uid()
  ));

CREATE POLICY "Users can view own comments"
  ON contract_comments FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM contracts
    WHERE contracts.id = contract_comments.contract_id
    AND contracts.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert own comments"
  ON contract_comments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own reports"
  ON review_reports FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM contracts
    WHERE contracts.id = review_reports.contract_id
    AND contracts.user_id = auth.uid()
  ));

-- ===== Phase 4 触发器 =====
CREATE TRIGGER contract_lifecycles_updated_at
  BEFORE UPDATE ON contract_lifecycles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ===== Phase 5: 新增表 =====

-- ===== 11. risk_alerts 表（风险预警） =====
CREATE TABLE IF NOT EXISTS risk_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'warning', 'info')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'acknowledged', 'resolved')),
  title TEXT NOT NULL,
  description TEXT,
  contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE,
  contract_title TEXT,
  metric TEXT NOT NULL,
  threshold DECIMAL(10, 2),
  current_value DECIMAL(10, 2),
  trend TEXT DEFAULT 'stable' CHECK (trend IN ('up', 'down', 'stable')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

-- ===== 12. email_notifications 表（邮件通知） =====
CREATE TABLE IF NOT EXISTS email_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL CHECK (event_type IN (
    'review_completed', 'high_risk_detected', 'approval_required',
    'approval_completed', 'contract_expiring', 'comment_received'
  )),
  recipient TEXT NOT NULL,
  recipient_name TEXT,
  subject TEXT NOT NULL,
  body TEXT,
  contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE,
  contract_title TEXT,
  sent BOOLEAN DEFAULT false,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===== 13. contract_qa_history 表（问答历史） =====
CREATE TABLE IF NOT EXISTS contract_qa_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  references_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===== Phase 5 索引 =====
CREATE INDEX IF NOT EXISTS idx_alerts_status ON risk_alerts(status);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON risk_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON email_notifications(recipient);
CREATE INDEX IF NOT EXISTS idx_notifications_event ON email_notifications(event_type);
CREATE INDEX IF NOT EXISTS idx_qa_contract ON contract_qa_history(contract_id);

-- ===== Phase 5 RLS 策略 =====
ALTER TABLE risk_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_qa_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own alerts"
  ON risk_alerts FOR SELECT
  USING (
    contract_id IS NULL OR EXISTS (
      SELECT 1 FROM contracts
      WHERE contracts.id = risk_alerts.contract_id
      AND contracts.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view own notifications"
  ON email_notifications FOR SELECT
  USING (
    contract_id IS NULL OR EXISTS (
      SELECT 1 FROM contracts
      WHERE contracts.id = email_notifications.contract_id
      AND contracts.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view own qa history"
  ON contract_qa_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own qa history"
  ON contract_qa_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ===== Phase 6: 新增表 =====

-- ===== 14. contract_versions 表（合同版本管理） =====
CREATE TABLE IF NOT EXISTS contract_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  version_label TEXT NOT NULL,
  content TEXT NOT NULL,
  change_summary TEXT,
  changes JSONB,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===== 15. custom_risk_rules 表（自定义风险规则） =====
CREATE TABLE IF NOT EXISTS custom_risk_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  rule_type TEXT NOT NULL,
  field TEXT NOT NULL,
  operator TEXT NOT NULL CHECK (operator IN ('contains', 'not_contains', 'equals', 'regex', 'greater_than', 'less_than')),
  value TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('high', 'medium', 'low')),
  suggestion TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  match_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===== 16. webhook_configs 表（Webhook配置） =====
CREATE TABLE IF NOT EXISTS webhook_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  events TEXT[] NOT NULL,
  secret TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'failing')),
  last_triggered TIMESTAMPTZ,
  last_response_status INTEGER,
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===== Phase 6 索引 =====
CREATE INDEX IF NOT EXISTS idx_versions_contract ON contract_versions(contract_id);
CREATE INDEX IF NOT EXISTS idx_versions_number ON contract_versions(version_number);
CREATE INDEX IF NOT EXISTS idx_rules_user ON custom_risk_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_rules_status ON custom_risk_rules(status);
CREATE INDEX IF NOT EXISTS idx_webhooks_user ON webhook_configs(user_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_status ON webhook_configs(status);

-- ===== Phase 6 RLS 策略 =====
ALTER TABLE contract_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_risk_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own versions"
  ON contract_versions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM contracts
    WHERE contracts.id = contract_versions.contract_id
    AND contracts.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert own versions"
  ON contract_versions FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM contracts
    WHERE contracts.id = contract_versions.contract_id
    AND contracts.user_id = auth.uid()
  ));

CREATE POLICY "Users can manage own rules"
  ON custom_risk_rules FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own webhooks"
  ON webhook_configs FOR ALL
  USING (auth.uid() = user_id);

-- ===== Phase 6 触发器 =====
CREATE TRIGGER custom_risk_rules_updated_at
  BEFORE UPDATE ON custom_risk_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER webhook_configs_updated_at
  BEFORE UPDATE ON webhook_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ===== Phase 7: 新增表 =====

-- ===== 17. ocr_results 表（OCR识别结果） =====
CREATE TABLE IF NOT EXISTS ocr_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  language TEXT DEFAULT 'zh',
  total_pages INTEGER DEFAULT 1,
  processed_pages INTEGER DEFAULT 0,
  extracted_text TEXT,
  confidence DECIMAL(5, 2),
  page_results JSONB,
  warnings TEXT[],
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- ===== 18. team_members 表（团队成员） =====
CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'legal_manager', 'legal_reviewer', 'business_user', 'viewer')),
  department_id TEXT,
  department_name TEXT,
  avatar_color TEXT DEFAULT '#7c3aed',
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  contracts_reviewed INTEGER DEFAULT 0,
  pending_approvals INTEGER DEFAULT 0,
  last_active TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===== 19. departments 表（部门） =====
CREATE TABLE IF NOT EXISTS departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  parent_id UUID REFERENCES departments(id) ON DELETE CASCADE,
  member_count INTEGER DEFAULT 0,
  contract_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===== 20. access_control 表（访问控制） =====
CREATE TABLE IF NOT EXISTS access_control (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_type TEXT NOT NULL CHECK (resource_type IN ('contract', 'template', 'rule', 'webhook')),
  resource_id UUID NOT NULL,
  resource_name TEXT,
  principal_type TEXT NOT NULL CHECK (principal_type IN ('user', 'role', 'department')),
  principal_id TEXT NOT NULL,
  principal_name TEXT,
  permissions TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===== 21. drafting_projects 表（合同起草项目） =====
CREATE TABLE IF NOT EXISTS drafting_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  contract_type TEXT NOT NULL,
  party_a TEXT,
  party_b TEXT,
  clauses JSONB DEFAULT '[]',
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'finalized')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===== Phase 7 索引 =====
CREATE INDEX IF NOT EXISTS idx_ocr_user ON ocr_results(user_id);
CREATE INDEX IF NOT EXISTS idx_ocr_status ON ocr_results(status);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_role ON team_members(role);
CREATE INDEX IF NOT EXISTS idx_departments_parent ON departments(parent_id);
CREATE INDEX IF NOT EXISTS idx_access_control_resource ON access_control(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_access_control_principal ON access_control(principal_type, principal_id);
CREATE INDEX IF NOT EXISTS idx_drafting_user ON drafting_projects(user_id);
CREATE INDEX IF NOT EXISTS idx_drafting_status ON drafting_projects(status);

-- ===== Phase 7 RLS 策略 =====
ALTER TABLE ocr_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE drafting_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own OCR results"
  ON ocr_results FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own OCR results"
  ON ocr_results FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view team members"
  ON team_members FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage team members"
  ON team_members FOR ALL
  USING (EXISTS (
    SELECT 1 FROM team_members tm
    WHERE tm.user_id = auth.uid() AND tm.role = 'admin'
  ));

CREATE POLICY "Users can manage own drafting projects"
  ON drafting_projects FOR ALL
  USING (auth.uid() = user_id);

-- ===== Phase 7 触发器 =====
CREATE TRIGGER drafting_projects_updated_at
  BEFORE UPDATE ON drafting_projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ===== Phase 8: 新增表 =====

-- ===== 22. contract_summaries 表（合同摘要） =====
CREATE TABLE IF NOT EXISTS contract_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE,
  summary TEXT,
  key_terms JSONB DEFAULT '[]',
  financial_terms JSONB DEFAULT '[]',
  timeline JSONB DEFAULT '[]',
  parties JSONB DEFAULT '[]',
  key_dates JSONB DEFAULT '[]',
  risk_assessment JSONB,
  word_count INTEGER,
  clause_count INTEGER,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===== 23. compliance_reports 表（合规报告） =====
CREATE TABLE IF NOT EXISTS compliance_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE,
  contract_title TEXT,
  overall_status TEXT CHECK (overall_status IN ('compliant', 'warning', 'violation', 'not_applicable')),
  compliance_score INTEGER,
  total_checks INTEGER,
  passed INTEGER,
  warnings INTEGER,
  violations INTEGER,
  not_applicable INTEGER,
  results JSONB DEFAULT '[]',
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===== 24. signature_requests 表（电子签章） =====
CREATE TABLE IF NOT EXISTS signature_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE,
  contract_title TEXT NOT NULL,
  signers JSONB NOT NULL DEFAULT '[]',
  signing_order TEXT DEFAULT 'sequential' CHECK (signing_order IN ('sequential', 'parallel', 'any')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'signed', 'rejected', 'expired', 'voided')),
  document_hash TEXT NOT NULL,
  certificate_info JSONB,
  audit_trail JSONB DEFAULT '[]',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ
);

-- ===== 25. search_index 表（全文搜索索引） =====
CREATE TABLE IF NOT EXISTS search_index (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE,
  contract_title TEXT,
  contract_type TEXT,
  content TEXT,
  party_names TEXT[],
  risk_score INTEGER,
  risk_count INTEGER,
  status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===== Phase 8 索引 =====
CREATE INDEX IF NOT EXISTS idx_summaries_contract ON contract_summaries(contract_id);
CREATE INDEX IF NOT EXISTS idx_compliance_contract ON compliance_reports(contract_id);
CREATE INDEX IF NOT EXISTS idx_signatures_contract ON signature_requests(contract_id);
CREATE INDEX IF NOT EXISTS idx_signatures_status ON signature_requests(status);
CREATE INDEX IF NOT EXISTS idx_search_contract ON search_index(contract_id);
CREATE INDEX IF NOT EXISTS idx_search_content ON search_index USING gin(to_tsvector('simple', content));

-- ===== Phase 8 RLS 策略 =====
ALTER TABLE contract_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE signature_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_index ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own summaries"
  ON contract_summaries FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM contracts
    WHERE contracts.id = contract_summaries.contract_id
    AND contracts.user_id = auth.uid()
  ));

CREATE POLICY "Users can view own compliance reports"
  ON compliance_reports FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM contracts
    WHERE contracts.id = compliance_reports.contract_id
    AND contracts.user_id = auth.uid()
  ));

CREATE POLICY "Users can view own signatures"
  ON signature_requests FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM contracts
    WHERE contracts.id = signature_requests.contract_id
    AND contracts.user_id = auth.uid()
  ));

CREATE POLICY "Users can view own search index"
  ON search_index FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM contracts
    WHERE contracts.id = search_index.contract_id
    AND contracts.user_id = auth.uid()
  ));

-- ===== Phase 9: 新增表 =====

-- ===== 26. renewal_policies 表（续签策略） =====
CREATE TABLE IF NOT EXISTS renewal_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE,
  contract_title TEXT,
  contract_type TEXT,
  strategy TEXT NOT NULL CHECK (strategy IN ('auto_renew', 'notify_only', 'manual_review', 'no_renewal')),
  renewal_term_months INTEGER NOT NULL,
  notice_days_before INTEGER NOT NULL,
  price_adjustment_cap DECIMAL(5, 2),
  auto_conditions JSONB,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled', 'overdue')),
  current_end_date DATE,
  proposed_end_date DATE,
  checklist JSONB DEFAULT '[]',
  triggered_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===== 27. partner_profiles 表（供应商/客户档案） =====
CREATE TABLE IF NOT EXISTS partner_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('supplier', 'customer', 'both')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'blacklisted')),
  credit_rating TEXT DEFAULT 'bbb' CHECK (credit_rating IN ('aaa', 'aa', 'a', 'bbb', 'bb', 'b', 'c')),
  industry TEXT,
  registered_capital DECIMAL(15, 2),
  currency TEXT DEFAULT 'CNY',
  legal_representative TEXT,
  contact_person TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  address TEXT,
  tax_id TEXT,
  bank_account TEXT,
  contract_count INTEGER DEFAULT 0,
  total_contract_value DECIMAL(18, 2) DEFAULT 0,
  avg_risk_score DECIMAL(5, 2) DEFAULT 0,
  high_risk_count INTEGER DEFAULT 0,
  last_contract_date DATE,
  established_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===== 28. partner_credit_history 表（信用历史） =====
CREATE TABLE IF NOT EXISTS partner_credit_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID REFERENCES partner_profiles(id) ON DELETE CASCADE,
  event_date DATE NOT NULL,
  event TEXT NOT NULL,
  impact TEXT CHECK (impact IN ('positive', 'negative', 'neutral')),
  rating_before TEXT,
  rating_after TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===== 29. pricing_analyses 表（定价分析） =====
CREATE TABLE IF NOT EXISTS pricing_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE,
  contract_title TEXT,
  contract_type TEXT,
  contract_value DECIMAL(18, 2),
  currency TEXT DEFAULT 'CNY',
  unit_price DECIMAL(15, 2),
  unit TEXT,
  market_benchmark JSONB,
  comparison TEXT CHECK (comparison IN ('below_market', 'at_market', 'above_market')),
  deviation_percentage DECIMAL(5, 2),
  analysis TEXT,
  recommendation TEXT,
  confidence DECIMAL(5, 2),
  factors JSONB DEFAULT '[]',
  historical_prices JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===== 30. workflow_definitions 表（工作流定义） =====
CREATE TABLE IF NOT EXISTS workflow_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  contract_type TEXT,
  nodes JSONB NOT NULL DEFAULT '[]',
  edges JSONB NOT NULL DEFAULT '[]',
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  version INTEGER DEFAULT 1,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===== 31. workflow_instances 表（工作流实例） =====
CREATE TABLE IF NOT EXISTS workflow_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID REFERENCES workflow_definitions(id) ON DELETE CASCADE,
  workflow_name TEXT,
  contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE,
  contract_title TEXT,
  current_node_id TEXT,
  status TEXT DEFAULT 'running' CHECK (status IN ('running', 'completed', 'cancelled', 'error')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  history JSONB DEFAULT '[]'
);

-- ===== Phase 9 索引 =====
CREATE INDEX IF NOT EXISTS idx_renewals_contract ON renewal_policies(contract_id);
CREATE INDEX IF NOT EXISTS idx_renewals_status ON renewal_policies(status);
CREATE INDEX IF NOT EXISTS idx_partners_type ON partner_profiles(type);
CREATE INDEX IF NOT EXISTS idx_partners_status ON partner_profiles(status);
CREATE INDEX IF NOT EXISTS idx_partners_rating ON partner_profiles(credit_rating);
CREATE INDEX IF NOT EXISTS idx_credit_history_partner ON partner_credit_history(partner_id);
CREATE INDEX IF NOT EXISTS idx_pricing_contract ON pricing_analyses(contract_id);
CREATE INDEX IF NOT EXISTS idx_workflow_def_status ON workflow_definitions(status);
CREATE INDEX IF NOT EXISTS idx_workflow_inst_status ON workflow_instances(status);
CREATE INDEX IF NOT EXISTS idx_workflow_inst_contract ON workflow_instances(contract_id);

-- ===== Phase 9 RLS 策略 =====
ALTER TABLE renewal_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_credit_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own renewal policies"
  ON renewal_policies FOR ALL
  USING (EXISTS (
    SELECT 1 FROM contracts
    WHERE contracts.id = renewal_policies.contract_id
    AND contracts.user_id = auth.uid()
  ));

CREATE POLICY "Users can view all partners"
  ON partner_profiles FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage partners"
  ON partner_profiles FOR ALL
  USING (EXISTS (
    SELECT 1 FROM team_members
    WHERE team_members.user_id = auth.uid()
    AND team_members.role IN ('admin', 'legal_manager')
  ));

CREATE POLICY "Users can view partner credit history"
  ON partner_credit_history FOR SELECT
  USING (true);

CREATE POLICY "Users can view own pricing analyses"
  ON pricing_analyses FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM contracts
    WHERE contracts.id = pricing_analyses.contract_id
    AND contracts.user_id = auth.uid()
  ));

CREATE POLICY "Users can view workflow definitions"
  ON workflow_definitions FOR SELECT
  USING (true);

CREATE POLICY "Users can manage own workflow instances"
  ON workflow_instances FOR ALL
  USING (EXISTS (
    SELECT 1 FROM contracts
    WHERE contracts.id = workflow_instances.contract_id
    AND contracts.user_id = auth.uid()
  ));

-- ===== Phase 9 触发器 =====
CREATE TRIGGER workflow_definitions_updated_at
  BEFORE UPDATE ON workflow_definitions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ===== Phase 10: 新增表 =====

-- ===== 32. negotiation_sessions 表（谈判会话） =====
CREATE TABLE IF NOT EXISTS negotiation_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE,
  contract_title TEXT,
  counterparty TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'in_progress', 'agreed', 'rejected', 'stalled')),
  round INTEGER DEFAULT 0,
  our_position JSONB,
  their_position JSONB,
  agreed_terms JSONB DEFAULT '[]',
  concessions JSONB DEFAULT '[]',
  ai_analysis JSONB,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_updated TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===== 33. performance_trackers 表（履约跟踪） =====
CREATE TABLE IF NOT EXISTS performance_trackers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE,
  contract_title TEXT,
  counterparty TEXT,
  start_date DATE,
  end_date DATE,
  overall_progress DECIMAL(5, 2) DEFAULT 0,
  status TEXT DEFAULT 'not_started' CHECK (status IN ('on_track', 'at_risk', 'delayed', 'completed', 'not_started')),
  kpis JSONB DEFAULT '[]',
  milestones JSONB DEFAULT '[]',
  obligations JSONB DEFAULT '[]',
  alerts JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===== 34. regulatory_changes 表（法规变更） =====
CREATE TABLE IF NOT EXISTS regulatory_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  type TEXT CHECK (type IN ('new_law', 'amendment', 'repeal', 'interpretation', 'guideline')),
  jurisdiction TEXT,
  effective_date DATE,
  published_date DATE,
  summary TEXT,
  full_text_url TEXT,
  affected_areas TEXT[],
  impact_level TEXT CHECK (impact_level IN ('critical', 'high', 'medium', 'low', 'none')),
  affected_contracts JSONB DEFAULT '[]',
  recommended_actions TEXT[],
  status TEXT DEFAULT 'monitoring' CHECK (status IN ('monitoring', 'assessing', 'action_required', 'compliant', 'non_compliant')),
  deadline DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===== 35. risk_simulations 表（风险模拟） =====
CREATE TABLE IF NOT EXISTS risk_simulations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE,
  contract_title TEXT,
  scenario TEXT CHECK (scenario IN ('best_case', 'base_case', 'worst_case', 'stress_test', 'monte_carlo')),
  iterations INTEGER,
  summary JSONB,
  risk_factors JSONB DEFAULT '[]',
  scenario_results JSONB DEFAULT '[]',
  distribution JSONB DEFAULT '[]',
  var_analysis JSONB,
  recommendations TEXT[],
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===== 36. clause_library 表（条款库） =====
CREATE TABLE IF NOT EXISTS clause_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  category TEXT CHECK (category IN ('payment', 'delivery', 'warranty', 'liability', 'termination', 'confidentiality', 'ip', 'dispute_resolution', 'force_majeure', 'general')),
  risk_level TEXT CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  source TEXT CHECK (source IN ('standard', 'best_practice', 'regulatory', 'negotiated', 'custom')),
  text TEXT NOT NULL,
  variables JSONB DEFAULT '[]',
  applicable_contracts TEXT[],
  jurisdictions TEXT[],
  tags TEXT[],
  favor_count INTEGER DEFAULT 0,
  usage_count INTEGER DEFAULT 0,
  alternative_versions JSONB DEFAULT '[]',
  risk_notes TEXT,
  negotiation_tips TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===== Phase 10 索引 =====
CREATE INDEX IF NOT EXISTS idx_negotiation_contract ON negotiation_sessions(contract_id);
CREATE INDEX IF NOT EXISTS idx_negotiation_status ON negotiation_sessions(status);
CREATE INDEX IF NOT EXISTS idx_performance_contract ON performance_trackers(contract_id);
CREATE INDEX IF NOT EXISTS idx_performance_status ON performance_trackers(status);
CREATE INDEX IF NOT EXISTS idx_regulatory_type ON regulatory_changes(type);
CREATE INDEX IF NOT EXISTS idx_regulatory_impact ON regulatory_changes(impact_level);
CREATE INDEX IF NOT EXISTS idx_regulatory_status ON regulatory_changes(status);
CREATE INDEX IF NOT EXISTS idx_regulatory_effective ON regulatory_changes(effective_date);
CREATE INDEX IF NOT EXISTS idx_risk_sim_contract ON risk_simulations(contract_id);
CREATE INDEX IF NOT EXISTS idx_clause_category ON clause_library(category);
CREATE INDEX IF NOT EXISTS idx_clause_risk ON clause_library(risk_level);
CREATE INDEX IF NOT EXISTS idx_clause_source ON clause_library(source);
CREATE INDEX IF NOT EXISTS idx_clause_search ON clause_library USING gin(to_tsvector('simple', title || ' ' || text));

-- ===== Phase 10 RLS 策略 =====
ALTER TABLE negotiation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_trackers ENABLE ROW LEVEL SECURITY;
ALTER TABLE regulatory_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_simulations ENABLE ROW LEVEL SECURITY;
ALTER TABLE clause_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own negotiations"
  ON negotiation_sessions FOR ALL
  USING (EXISTS (
    SELECT 1 FROM contracts
    WHERE contracts.id = negotiation_sessions.contract_id
    AND contracts.user_id = auth.uid()
  ));

CREATE POLICY "Users can manage own performance trackers"
  ON performance_trackers FOR ALL
  USING (EXISTS (
    SELECT 1 FROM contracts
    WHERE contracts.id = performance_trackers.contract_id
    AND contracts.user_id = auth.uid()
  ));

CREATE POLICY "Users can view regulatory changes"
  ON regulatory_changes FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage regulatory changes"
  ON regulatory_changes FOR ALL
  USING (EXISTS (
    SELECT 1 FROM team_members
    WHERE team_members.user_id = auth.uid()
    AND team_members.role IN ('admin', 'legal_manager')
  ));

CREATE POLICY "Users can view own risk simulations"
  ON risk_simulations FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM contracts
    WHERE contracts.id = risk_simulations.contract_id
    AND contracts.user_id = auth.uid()
  ));

CREATE POLICY "Users can view clause library"
  ON clause_library FOR SELECT
  USING (true);

CREATE POLICY "Users can manage own clause library entries"
  ON clause_library FOR ALL
  USING (created_by = auth.uid());

-- ===== Phase 10 触发器 =====
CREATE TRIGGER negotiation_sessions_updated_at
  BEFORE UPDATE ON negotiation_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER performance_trackers_updated_at
  BEFORE UPDATE ON performance_trackers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER clause_library_updated_at
  BEFORE UPDATE ON clause_library
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
