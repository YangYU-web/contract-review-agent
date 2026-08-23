# 企业合同智能审查Agent

AI驱动的合同风险识别与修改建议平台。上传合同文件，AI在15秒内识别风险条款、给出评分和修改建议，支持条款比对、Redline导出、审批流程和知识库检索。

## 快速开始

### 1. 安装依赖

```bash
cd contract-review-agent
npm install
```

### 2. 演示模式（无需API密钥）

直接运行，使用模拟数据预览功能：

```bash
npm run dev
```

打开 http://localhost:3000 即可看到完整界面。所有页面均可在演示模式下浏览。

### 3. 完整模式（连接真实AI和数据库）

#### 3.1 注册账号

| 服务 | 用途 | 注册地址 |
|------|------|---------|
| Supabase | 数据库+认证+文件存储 | https://supabase.com |
| Anthropic | AI合同审查引擎 | https://console.anthropic.com |
| Vercel | 部署上线 | https://vercel.com |

#### 3.2 配置环境变量

复制 `.env.example` 为 `.env.local`，填入你的密钥：

```bash
cp .env.example .env.local
```

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx
SUPABASE_SERVICE_ROLE_KEY=eyJxxx
ANTHROPIC_API_KEY=sk-ant-xxx
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

#### 3.3 初始化数据库

1. 登录 Supabase Dashboard
2. 打开 SQL Editor
3. 复制 `supabase/schema.sql` 的全部内容
4. 粘贴并执行

#### 3.4 启动

```bash
npm run dev
```

## 部署到 Vercel

1. 推送代码到 GitHub
2. 在 Vercel 导入该仓库
3. 在 Vercel 项目设置中添加环境变量（同 `.env.local`）
4. 部署完成

## 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 前端 | Next.js 14 + TypeScript | App Router，全栈一体化 |
| 样式 | Tailwind CSS | 响应式设计 |
| 数据库 | Supabase (PostgreSQL) | 含认证、存储、pgvector向量检索 |
| AI引擎 | Anthropic Claude API | 200K上下文，法律推理，多模型路由 |
| 文档解析 | pdf-parse + mammoth | PDF和Word文本提取 |
| 部署 | Vercel | 零配置部署 |

## 项目结构

```
contract-review-agent/
├── app/                              # Next.js App Router
│   ├── api/
│   │   ├── review/route.ts          # 合同审查API
│   │   ├── comparison/route.ts      # 条款比对API
│   │   ├── approval/route.ts        # 审批流程API
│   │   ├── decision/route.ts        # 风险决策API
│   │   └── feedback/route.ts        # 用户反馈API
│   ├── upload/page.tsx             # 合同上传页面
│   ├── dashboard/
│   │   ├── page.tsx                # 审查记录列表
│   │   └── [id]/page.tsx           # 审查结果详情
│   ├── knowledge-base/page.tsx     # 合同知识库检索
│   ├── analytics/page.tsx          # 数据分析仪表盘
│   ├── settings/page.tsx           # 用户设置
│   ├── login/page.tsx              # 登录注册
│   ├── page.tsx                    # 首页
│   ├── layout.tsx                  # 根布局
│   └── globals.css                 # 全局样式
├── components/
│   ├── Navbar.tsx                  # 导航栏
│   ├── FileUpload.tsx              # 拖拽上传组件
│   ├── RiskCard.tsx                # 风险卡片+采纳/驳回
│   ├── ClauseComparisonView.tsx    # 条款比对视图
│   ├── ApprovalFlowView.tsx       # 审批流程视图
│   ├── AnalyticsDashboard.tsx     # 分析仪表盘
│   ├── KnowledgeBaseView.tsx      # 知识库检索界面
│   ├── FeedbackWidget.tsx         # 反馈收集组件
│   ├── AuthForm.tsx               # 登录注册表单
│   ├── AuthProvider.tsx           # 认证上下文
│   ├── UserMenu.tsx               # 用户菜单
│   ├── ReviewDetailClient.tsx     # 审查详情客户端
│   ├── BatchFileUpload.tsx        # 批量文件上传组件
│   ├── ReportDownload.tsx         # 报告下载组件
│   └── CommentSection.tsx         # 团队协作评论组件
├── lib/
│   ├── types.ts                   # TypeScript类型定义
│   ├── supabase.ts                # Supabase客户端
│   ├── claude.ts                  # Claude API集成
│   ├── contract-parser.ts         # 文档解析+条款分割
│   ├── clause-comparison.ts       # 条款比对+异常检测
│   ├── standard-clauses.ts        # 标准条款模板库
│   ├── redline-export.ts          # Redline文档导出
│   ├── approval-flow.ts           # 审批流程路由
│   ├── knowledge-base.ts          # 知识库+智能检索
│   ├── cost-optimization.ts       # 成本优化+模型路由
│   ├── analytics.ts               # 数据分析统计
│   ├── feedback.ts                # 反馈收集逻辑
│   ├── auth.ts                    # 用户认证
│   ├── report-generator.ts        # 审查报告生成
│   ├── contract-lifecycle.ts      # 合同生命周期管理
│   ├── contract-templates.ts      # 合同模板库数据
│   ├── comments.ts                # 评论Mock数据
│   └── mock-data.ts               # 演示模式模拟数据
├── supabase/
│   └── schema.sql                 # 数据库表结构+RLS策略
├── package.json
├── tailwind.config.ts
├── tsconfig.json
└── next.config.js
```

## 功能模块

### Phase 1 — 核心审查引擎

1. **合同导入与解析** — 拖拽上传PDF/Word，自动提取文本并按法律条款边界分割
2. **AI风险识别与评分** — 12类风险识别（付款、交付、违约、知识产权等），引用验证防幻觉
3. **修改建议** — AI生成建议修改后的条款文本，支持采纳/驳回
4. **审查记录** — 历史审查记录列表，风险评分展示

### Phase 2 — 深度分析与协作

5. **条款比对** — 逐条分析，与标准模板比对，识别偏离市场惯例的异常条款
6. **Redline导出** — 生成带有修改标记的Word文档，保留原文与建议修改的对比
7. **审批流程** — 根据风险等级自动路由审批流（低风险自动通过，中风险法务审核，高风险管理层审批）

### Phase 3 — 智能化与运营

8. **用户认证** — Supabase Auth登录注册，数据按用户隔离（RLS策略）
9. **合同知识库** — 历史审查的条款和风险可检索，支持关键词搜索和相似度排序
10. **用户反馈系统** — 对AI建议评分（有帮助/无帮助），收集改进意见
11. **成本优化** — 模型智能路由（简单任务用Haiku，复杂任务用Sonnet），提示缓存，用量统计
12. **数据分析仪表盘** — 审查量趋势、风险分布、风险类型统计、成本分析
13. **设置页面** — 用户偏好管理（自动审批、通知、模型选择、导出格式）

### Phase 4 — 生命周期与协作

14. **批量合同审查** — 多文件同时上传，并行AI审查，进度实时展示
15. **审查报告导出** — 生成HTML/文本格式完整审查报告，支持下载和在线预览
16. **合同到期管理** — 合同生命周期跟踪，到期提醒，自动续签标记
17. **团队协作与评论** — 风险条款讨论，@提及，回复嵌套，标记已解决
18. **合同模板库** — 8类标准合同模板，分类筛选，关键词搜索，风险提示

### Phase 5 — 智能问答与预警

19. **AI合同问答** — 基于合同内容的智能问答助手，支持条款引用和上下文对话
20. **合同对比分析** — 两份合同并排对比，逐条差异分析，风险影响评估
21. **风险趋势预警** — 风险指标监控，自动生成预警，趋势图表，确认/解决流程
22. **邮件通知系统** — 6类事件通知（审查完成、高风险、审批待办等），发送状态跟踪
23. **开放API文档** — 完整API接口文档，参数说明，代码示例，cURL命令

### Phase 6 — 企业级管理

24. **合同版本管理** — 版本历史追踪，版本间条款对比，变更影响评估
25. **自定义风险规则** — 用户自定义检测规则，6种匹配操作符，规则引擎自动评估
26. **审计追踪与合规** — 17种操作日志，合规报告评分，筛选与导出
27. **Webhook集成** — 6类事件订阅，外部系统对接，签名验证，投递日志
28. **PWA移动端** — Service Worker离线支持，可安装应用，响应式增强

### Phase 7 — 智能化与企业管理

29. **多语言合同审查** — 中英双语自动检测，跨语言条款比对，4类差异识别（缺失/值不匹配/术语/结构）
30. **OCR扫描件识别** — 图片/PDF扫描件文字提取，页级置信度，区域识别，警告提示
31. **角色权限管理** — 5种角色RBAC，10种权限，部门隔离，权限矩阵，团队管理
32. **合同起草助手** — 8类条款模板，变量化填充，实时预览，一键生成合同
33. **高级数据可视化** — 7种交互式图表（柱状/环形/折线/热力图），趋势分析，纯CSS/SVG实现

### Phase 8 — 智能摘要与系统集成

34. **智能合同摘要** — 自动提取合同主体、财务条款、关键日期，生成结构化摘要和风险评估
35. **合规检查引擎** — 6大法规领域（公司法/合同法/劳动法/数据保护/税法/行业规范），12条合规规则自动检查
36. **电子签章集成** — 签章流程管理，顺序/并行签署，CA证书，审计追踪，文档哈希
37. **全文搜索引擎** — 跨合同搜索，高级筛选，分面统计，相关度评分，搜索建议
38. **系统健康监控** — 8项服务健康检查，24小时系统指标趋势，告警管理，可用性统计

### Phase 9 — 智能管理与深度分析

39. **合同到期自动续签** — 4种续签策略，自动条件评估，续签清单，30天预警
40. **供应商/客户档案** — 合作方信用评级，信用历史追踪，7级信用评分，风险评分
41. **AI智能定价分析** — 市场基准比对，偏差分析，定价因子评估，历史价格趋势
42. **工作流引擎** — 可视化流程编辑器，7种节点类型，SVG画布拖拽，审批流程管理
43. **合同知识图谱** — 实体关系图可视化，智能推理洞察，图谱搜索，邻域探索

### Phase 10 — 谈判与深度分析

44. **合同谈判助手** — AI条款反建议，BATNA/ZOPA分析，让步管理，谈判平衡评估
45. **合同履约监控** — KPI追踪，里程碑管理，义务履行跟踪，履约告警
46. **法规变更监控** — 法律更新追踪，影响合同评估，合规差距分析，行动建议
47. **合同风险模拟** — 蒙特卡洛模拟，VaR/CVaR分析，风险因子评估，分布直方图
48. **智能条款库** — 10大类条款，变量模板，替代版本，AI条款推荐，条款渲染

## API 端点

| 端点 | 方法 | 功能 |
|------|------|------|
| `/api/review` | POST | 提交合同文本进行AI审查 |
| `/api/batch-review` | POST | 批量合同审查（多文件并行） |
| `/api/comparison` | POST | 条款比对分析 |
| `/api/contract-diff` | POST | 两份合同对比分析 |
| `/api/approval` | POST | 创建/查询审批流程 |
| `/api/decision` | POST | 提交风险采纳/驳回决策 |
| `/api/comments` | GET/POST | 获取/创建团队评论 |
| `/api/qa` | POST | AI合同问答 |
| `/api/alerts` | GET/POST | 风险预警查询/更新状态 |
| `/api/notifications` | GET/POST | 邮件通知查询/创建 |
| `/api/versions` | GET/POST | 合同版本管理 |
| `/api/rules` | GET/POST/PUT | 自定义风险规则管理 |
| `/api/audit` | GET/POST | 审计日志查询/记录 |
| `/api/webhooks` | GET/POST | Webhook管理与测试 |
| `/api/multilingual` | POST | 多语言检测与双语对比 |
| `/api/ocr` | GET/POST | OCR识别与历史查询 |
| `/api/rbac` | GET/POST | 角色权限管理 |
| `/api/drafting` | GET/POST | 合同起草项目管理 |
| `/api/summary` | POST | 智能合同摘要生成 |
| `/api/compliance` | POST | 合规检查报告 |
| `/api/signatures` | GET/POST | 电子签章管理 |
| `/api/search` | GET/POST | 全文搜索 |
| `/api/health` | GET | 系统健康监控 |
| `/api/renewals` | GET/POST | 自动续签管理 |
| `/api/partners` | GET/POST | 供应商/客户档案 |
| `/api/pricing` | GET/POST | AI定价分析 |
| `/api/workflows` | GET/POST | 工作流引擎 |
| `/api/knowledge-graph` | GET/POST | 合同知识图谱 |
| `/api/negotiation` | GET/POST | 合同谈判助手 |
| `/api/performance` | GET/POST | 合同履约监控 |
| `/api/regulatory` | GET/POST | 法规变更监控 |
| `/api/risk-simulation` | GET/POST | 合同风险模拟 |
| `/api/clause-library` | GET/POST | 智能条款库 |
| `/api/export-report` | POST | 导出审查报告（HTML/文本） |
| `/api/feedback` | POST/GET | 提交/获取用户反馈 |

## 页面路由

| 路由 | 说明 |
|------|------|
| `/` | 首页 — 功能概览 |
| `/upload` | 合同上传（单文件） |
| `/batch-upload` | 批量合同上传与审查 |
| `/dashboard` | 审查记录列表 |
| `/dashboard/[id]` | 审查结果详情（风险卡片+条款比对+审批流） |
| `/qa` | AI合同问答助手 |
| `/compare` | 合同对比分析 |
| `/versions` | 合同版本管理 |
| `/rules` | 自定义风险规则 |
| `/audit` | 审计追踪与合规 |
| `/webhooks` | Webhook集成 |
| `/lifecycle` | 合同生命周期与到期管理 |
| `/templates` | 合同模板库 |
| `/collaboration` | 团队协作与评论 |
| `/alerts` | 风险趋势预警仪表盘 |
| `/notifications` | 邮件通知中心 |
| `/api-docs` | 开放API文档 |
| `/reports/[id]` | 审查报告预览 |
| `/knowledge-base` | 合同知识库检索 |
| `/analytics` | 数据分析仪表盘 |
| `/settings` | 用户设置 |
| `/login` | 登录注册 |
| `/offline` | 离线提示页（PWA） |
| `/multilingual` | 多语言合同审查 |
| `/ocr` | 扫描件OCR识别 |
| `/rbac` | 角色权限管理 |
| `/drafting` | 合同起草助手 |
| `/visualizations` | 高级数据可视化 |
| `/summary` | 智能合同摘要 |
| `/compliance` | 合规检查引擎 |
| `/signatures` | 电子签章集成 |
| `/search` | 全文搜索引擎 |
| `/system-health` | 系统健康监控 |
| `/renewals` | 合同到期自动续签 |
| `/partners` | 供应商/客户档案 |
| `/pricing` | AI智能定价分析 |
| `/workflow-editor` | 工作流引擎 |
| `/knowledge-graph` | 合同知识图谱 |
| `/negotiation` | 合同谈判助手 |
| `/performance` | 合同履约监控 |
| `/regulatory` | 法规变更监控 |
| `/risk-simulation` | 合同风险模拟 |
| `/clause-library` | 智能条款库 |

## 成本优化策略

系统根据合同特征自动选择AI模型：

| 模型 | 适用场景 | 输入成本/1K | 输出成本/1K |
|------|---------|------------|------------|
| Claude 3.5 Haiku | 合同分类、简单条款提取、格式检查 | $0.0008 | $0.004 |
| Claude 3.5 Sonnet | 风险识别、条款比对、修改建议 | $0.003 | $0.015 |
| Claude 3.5 Sonnet (深度) | 复杂合同深度审查、跨条款逻辑冲突 | $0.003 | $0.015 |

路由逻辑：短合同(<5K字符)且无高风险 → Haiku；长合同(>50K字符)或高风险 → 深度Sonnet；其他 → 标准Sonnet。
