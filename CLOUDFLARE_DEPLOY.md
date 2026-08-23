# Cloudflare Pages 部署指南

## 为什么选 Cloudflare Pages？
- 免费，无限请求
- 国内访问速度比 Vercel 快很多
- 自动 HTTPS
- 支持 Next.js

## 第一步：注册 Cloudflare

1. 打开 https://dash.cloudflare.com/sign-up
2. 用邮箱注册（或用 GitHub 登录）
3. 验证邮箱

## 第二步：创建 Pages 项目

1. 登录后，打开 https://dash.cloudflare.com
2. 左侧菜单点击 **Workers & Pages**
3. 点击 **Create application**（创建应用程序）
4. 选择 **Pages** 标签
5. 点击 **Connect to Git**（连接到 Git）
6. 授权 Cloudflare 访问你的 GitHub
7. 选择仓库：`contract-review-agent`
8. 点击 **Begin setup**（开始设置）

## 第三步：配置构建设置

| 配置项 | 值 |
|--------|-----|
| Project name | `contract-review-agent` |
| Production branch | `main` |
| Framework preset | **None** |
| Build command | `npx @cloudflare/next-on-pages@1` |
| Build output directory | `.vercel/output/static` |
| Root directory | `/` (保持默认) |

## 第四步：配置环境变量

在构建设置页面下方找到 **Environment variables**，逐个添加：

| 变量名 | 值 |
|--------|-----|
| `NEXT_PUBLIC_SUPABASE_URL` | 你的 Supabase 项目 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 你的 Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | 你的 Supabase service role key |
| `ANTHROPIC_BASE_URL` | `https://api.deepseek.com/anthropic` |
| `ANTHROPIC_API_KEY` | 你的 DeepSeek API key |
| `AI_MODEL_NAME` | `deepseek-chat` |

每个变量：
1. 在 Variable name 填变量名
2. 在 Value 填值
3. 点击 **Add**
4. 重复添加下一个

## 第五步：部署

1. 全部变量添加完后，点击 **Save and Deploy**
2. 等待 3-5 分钟构建完成
3. 构建成功后会给你一个网址：
   ```
   https://contract-review-agent.pages.dev
   ```
4. 这个网址国内可以直接访问！

## 第六步：设置 nodejs_compat 兼容性标记（重要！）

1. 部署完成后，进入项目 **Settings**
2. 找到 **Functions** → **Compatibility flags**
3. 在 **Configure Production compatibility flags** 添加：`nodejs_compat`
4. 在 **Configure Preview compatibility flags** 也添加：`nodejs_compat`
5. 保存后重新部署

## 完成！

现在任何人都可以通过你的 Cloudflare 网址访问应用了。

## 常见问题

### Q: 构建失败怎么办？
A: 检查环境变量是否全部添加，确认 Build command 是 `npx @cloudflare/next-on-pages@1`

### Q: 页面能打开但功能不工作？
A: 确认环境变量配置正确，特别是 `ANTHROPIC_API_KEY` 和 `SUPABASE_SERVICE_ROLE_KEY`

### Q: 想用自己的域名？
A: 在项目 Settings → Custom domains 里添加
