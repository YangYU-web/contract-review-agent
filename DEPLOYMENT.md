# 企业合同智能审查Agent — 部署指南

## 一、环境要求

- Node.js 18.17+ 
- npm 9+ 或 pnpm
- Supabase 账户（免费版即可）
- DeepSeek API 密钥（约¥1/百万token）

## 二、项目结构

```
contract-review-agent/
├── app/                    # Next.js 14 App Router
│   ├── api/               # 37个API路由
│   ├── [页面]/            # 42个功能页面
│   ├── layout.tsx         # 全局布局（PWA配置）
│   └── globals.css        # 全局样式
├── components/            # React组件
├── lib/                   # 核心库
│   ├── claude.ts          # AI集成（DeepSeek/Anthropic）
│   ├── supabase.ts        # 数据库客户端
│   ├── contract-parser.ts # 文档解析
│   └── types.ts           # TypeScript类型
├── public/                # 静态资源（PWA图标、manifest、SW）
├── supabase/              # 数据库SQL
│   ├── schema.sql         # 主建表脚本（36张表）
│   └── schema_additions.sql # 补充表
├── .env.local             # 环境变量（需自建）
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

## 三、部署步骤

### 1. 安装依赖

```bash
cd contract-review-agent
npm install
```

### 2. 配置环境变量

创建 `.env.local` 文件：

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# AI模型（DeepSeek — 国内直接可用）
ANTHROPIC_BASE_URL=https://api.deepseek.com/anthropic
ANTHROPIC_API_KEY=your-deepseek-api-key
AI_MODEL_NAME=deepseek-chat

# 应用
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. 初始化数据库

1. 登录 Supabase Dashboard
2. 进入 SQL Editor
3. 执行 `supabase/schema.sql`（36张表）
4. 执行 `supabase/schema_additions.sql`（补充表）

### 4. 开发模式运行

```bash
npm run dev
# 访问 http://localhost:3000
```

### 5. 生产模式构建

```bash
npm run build
npm start
# 访问 http://localhost:3000
```

## 四、部署到 Vercel（推荐，免费）

1. 将代码上传到 GitHub
2. 在 Vercel 导入仓库
3. 配置环境变量（同上 .env.local）
4. 自动构建部署

## 五、移动端安装（PWA）

### Android Chrome
1. 用 Chrome 打开应用网址
2. 点击浏览器菜单 → "添加到主屏幕"
3. 确认安装

### iOS Safari
1. 用 Safari 打开应用网址
2. 点击分享按钮 → "添加到主屏幕"
3. 确认安装

### 微信内打开
1. 点击右上角 → 在浏览器中打开
2. 再按上述步骤安装

安装后可作为独立 App 使用，支持离线访问已缓存页面。

## 六、功能清单

### 已接入真实后端的功能（37个API）
- 合同上传与AI审查（DeepSeek）
- 批量合同审查
- 条款比对与合同对比
- 审批流程管理
- 风险决策记录
- AI合同问答
- 智能摘要与合规检查
- 审查报告导出
- 团队协作评论
- 风险预警与通知
- 版本管理与审计日志
- 自定义风险规则
- Webhook集成
- RBAC权限管理
- 合同起草助手
- 合同生命周期管理
- 系统健康监控
- 自动续签管理
- 供应商/客户档案
- AI定价分析
- 工作流引擎
- 合同知识图谱
- 合同谈判助手
- 履约监控
- 法规变更监控
- 合同风险模拟
- 智能条款库
- OCR扫描件识别
- 多语言双语审查
- 全文搜索
- 用户设置
- 数据分析仪表盘

## 七、技术栈

- **前端**: Next.js 14, React 18, TypeScript, Tailwind CSS
- **后端**: Next.js API Routes (37个)
- **数据库**: Supabase (PostgreSQL + RLS)
- **AI**: DeepSeek (Anthropic兼容API)
- **移动端**: PWA (Service Worker + Web App Manifest)
- **图标库**: lucide-react
