# qihai task board worker

这个目录提供 GitHub Pages 站点所需的 Cloudflare Workers 小后端，用来处理：

- GitHub 登录
- 登录态校验
- 读取最新任务板
- 将任务板写回 `content/tasks/board.json`

## 本地开发

1. 在 `worker/` 下安装依赖：`npm install`
2. 复制 `.dev.vars.example` 为 `.dev.vars`
3. 填入 GitHub App 与会话密钥
4. 运行：`npm run dev`

默认本地地址为 `http://127.0.0.1:8787`

## 部署

1. 在 `worker/` 下登录 Cloudflare：`npx wrangler login`
2. 配置生产 secrets：
   - `npx wrangler secret put GITHUB_APP_ID`
   - `npx wrangler secret put GITHUB_APP_CLIENT_ID`
   - `npx wrangler secret put GITHUB_APP_CLIENT_SECRET`
   - `npx wrangler secret put GITHUB_APP_PRIVATE_KEY`
   - `npx wrangler secret put SESSION_SECRET`
3. 部署：`npm run deploy`

部署完成后，把生成的 `workers.dev` 地址写回仓库根目录的 `content/site-config.json` 中 `apiBaseUrl`。
