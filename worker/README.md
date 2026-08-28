# qihai site worker

这个目录提供 GitHub Pages 站点所需的 Cloudflare Workers 小后端，用来处理：

- GitHub 登录
- 登录态校验
- 读取最新任务板
- 将任务板写回 `content/tasks/board.json`
- 读取博客索引与 Markdown 正文
- 在一次 GitHub commit 中同步文章正文、图片和 `content/posts/index.json`
- 仅允许指定 GitHub 账号读取和管理 `assets/img/` 中的首页展示图片

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

GitHub App 需要对仓库开启 `Contents: Read and write` 权限。博客编辑入口仅在允许的 GitHub 账号登录后显示；提交时会校验文章与索引 SHA，远端有更新时不会直接覆盖。新文章的文件名、`createdAt` 和 `updatedAt` 由 Worker 生成，编辑文章时保留原文件名与 `createdAt`，只刷新 `updatedAt`。

后台展示图片接口为 `GET /api/site-images` 与 `PUT /api/site-images`，两者都会校验 owner session。目录由 `GITHUB_SITE_IMAGES_PATH` 配置，默认是 `assets/img`；上传和移除使用 Git Data API 合并为单次 commit，并校验操作基于的分支 HEAD，避免覆盖远端更新。

博客图片写入 `content/posts/assets/`，支持 PNG、JPEG、GIF 与 WebP。单张上限 6 MB，单次同步总计不超过 20 MB；新增和删除图片均与文章正文使用同一次 commit。
