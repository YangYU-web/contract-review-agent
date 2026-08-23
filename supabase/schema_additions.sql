-- ===== 补充表（如果不存在则创建） =====
-- 注意：PostgreSQL 的 CREATE POLICY 不支持 IF NOT EXISTS
-- 用 DO $$ BEGIN ... END $$ 实现幂等

-- 用户设置表
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  language TEXT DEFAULT 'zh',
  theme TEXT DEFAULT 'light' CHECK (theme IN ('light', 'dark', 'auto')),
  risk_threshold INTEGER DEFAULT 50 CHECK (risk_threshold BETWEEN 0 AND 100),
  auto_escalate BOOLEAN DEFAULT false,
  email_notifications BOOLEAN DEFAULT true,
  webhook_url TEXT,
  ai_model TEXT DEFAULT 'deepseek-chat',
  review_depth TEXT DEFAULT 'standard' CHECK (review_depth IN ('quick', 'standard', 'deep')),
  notification_events JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all access to user_settings' AND tablename = 'user_settings') THEN
    CREATE POLICY "Allow all access to user_settings" ON user_settings FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- OCR 结果表（如果不存在）
CREATE TABLE IF NOT EXISTS ocr_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename TEXT NOT NULL,
  language TEXT DEFAULT 'zh',
  total_pages INTEGER DEFAULT 1,
  processed_pages INTEGER DEFAULT 0,
  extracted_text TEXT,
  confidence DECIMAL(5,2) DEFAULT 0,
  page_results JSONB DEFAULT '[]'::jsonb,
  warnings TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

ALTER TABLE ocr_results ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all access to ocr_results' AND tablename = 'ocr_results') THEN
    CREATE POLICY "Allow all access to ocr_results" ON ocr_results FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 谈判会话表（如果不存在）
CREATE TABLE IF NOT EXISTS negotiation_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID,
  contract_title TEXT,
  counterparty TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'abandoned')),
  round INTEGER DEFAULT 1,
  our_position JSONB DEFAULT '{}'::jsonb,
  their_position JSONB DEFAULT '{}'::jsonb,
  agreed_terms JSONB DEFAULT '[]'::jsonb,
  concessions JSONB DEFAULT '[]'::jsonb,
  ai_analysis JSONB DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ DEFAULT now(),
  last_updated TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE negotiation_sessions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all access to negotiation_sessions' AND tablename = 'negotiation_sessions') THEN
    CREATE POLICY "Allow all access to negotiation_sessions" ON negotiation_sessions FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 履约追踪表（如果不存在）
CREATE TABLE IF NOT EXISTS performance_trackers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID,
  contract_title TEXT,
  counterparty TEXT,
  start_date DATE,
  end_date DATE,
  overall_progress DECIMAL(5,2) DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'overdue', 'at_risk')),
  kpis JSONB DEFAULT '[]'::jsonb,
  milestones JSONB DEFAULT '[]'::jsonb,
  obligations JSONB DEFAULT '[]'::jsonb,
  alerts JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE performance_trackers ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all access to performance_trackers' AND tablename = 'performance_trackers') THEN
    CREATE POLICY "Allow all access to performance_trackers" ON performance_trackers FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 法规变更表（如果不存在）
CREATE TABLE IF NOT EXISTS regulatory_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  type TEXT,
  jurisdiction TEXT,
  effective_date DATE,
  published_date DATE,
  summary TEXT,
  full_text_url TEXT,
  affected_areas TEXT[] DEFAULT '{}',
  impact_level TEXT DEFAULT 'medium' CHECK (impact_level IN ('low', 'medium', 'high', 'critical')),
  affected_contracts JSONB DEFAULT '[]'::jsonb,
  recommended_actions TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'addressed', 'ignored')),
  deadline DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE regulatory_changes ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all access to regulatory_changes' AND tablename = 'regulatory_changes') THEN
    CREATE POLICY "Allow all access to regulatory_changes" ON regulatory_changes FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 风险模拟表（如果不存在）
CREATE TABLE IF NOT EXISTS risk_simulations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID,
  contract_title TEXT,
  scenario TEXT,
  iterations INTEGER DEFAULT 1000,
  summary JSONB DEFAULT '{}'::jsonb,
  risk_factors JSONB DEFAULT '[]'::jsonb,
  scenario_results JSONB DEFAULT '[]'::jsonb,
  distribution JSONB DEFAULT '{}'::jsonb,
  var_analysis JSONB DEFAULT '{}'::jsonb,
  recommendations TEXT[] DEFAULT '{}',
  generated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE risk_simulations ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all access to risk_simulations' AND tablename = 'risk_simulations') THEN
    CREATE POLICY "Allow all access to risk_simulations" ON risk_simulations FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 条款库表（如果不存在）
CREATE TABLE IF NOT EXISTS clause_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  category TEXT,
  risk_level TEXT DEFAULT 'medium' CHECK (risk_level IN ('low', 'medium', 'high')),
  source TEXT,
  text TEXT NOT NULL,
  variables JSONB DEFAULT '[]'::jsonb,
  applicable_contracts TEXT[] DEFAULT '{}',
  jurisdictions TEXT[] DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  favor_count INTEGER DEFAULT 0,
  usage_count INTEGER DEFAULT 0,
  alternative_versions JSONB DEFAULT '[]'::jsonb,
  risk_notes TEXT,
  negotiation_tips TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE clause_library ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all access to clause_library' AND tablename = 'clause_library') THEN
    CREATE POLICY "Allow all access to clause_library" ON clause_library FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 工作流定义表（如果不存在）
CREATE TABLE IF NOT EXISTS workflow_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  contract_type TEXT,
  nodes JSONB DEFAULT '[]'::jsonb,
  edges JSONB DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'draft')),
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE workflow_definitions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all access to workflow_definitions' AND tablename = 'workflow_definitions') THEN
    CREATE POLICY "Allow all access to workflow_definitions" ON workflow_definitions FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 工作流实例表（如果不存在）
CREATE TABLE IF NOT EXISTS workflow_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID REFERENCES workflow_definitions(id) ON DELETE CASCADE,
  workflow_name TEXT,
  contract_id UUID,
  contract_title TEXT,
  current_node_id TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled', 'rejected')),
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  history JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE workflow_instances ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all access to workflow_instances' AND tablename = 'workflow_instances') THEN
    CREATE POLICY "Allow all access to workflow_instances" ON workflow_instances FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
