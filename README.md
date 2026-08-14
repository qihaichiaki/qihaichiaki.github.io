# qihaichiaki.github.io

一个用于 GitHub Pages 的个人网站模板，标题固定为 **qihai的世界**。

## 页面结构

- 首页（`index.html`）
  - 近期参与提交的前三个仓库
  - 最近 Star 的三个仓库
  - 最近添加的三篇博客预览
- 博客页（`blog.html`）
  - 按分类展示文章索引
  - 文章目录、阅读进度与快捷导航
  - Markdown 文章完整阅读与实时预览编辑
  - GitHub 登录后同步正文、分类和描述
- 任务板页（`tasks.html`）
  - 本地 `IndexedDB` 草稿保存
  - 预留 GitHub 登录与仓库同步状态
  - 任务板数据文件为 `content/tasks/board.json`

## GitHub 数据与缓存

首页 GitHub 模块采用「缓存优先」策略：

1. 先读浏览器本地缓存（减少 API 频繁调用）
2. 缓存过期时后台刷新
3. 网络不可用时显示缓存或离线记录

缓存时长默认 6 小时，配置位置：`src/main.js` 的 `CACHE_POLICY`。

## 本地 Markdown 博客上传方式

1. 在 `content/posts/` 新增 `.md` 文件
2. 在 `content/posts/index.json` 追加文章元数据：

```json
{
  "title": "文章标题",
  "createdAt": "2026-03-30T00:00:00.000Z",
  "updatedAt": "2026-03-30T00:00:00.000Z",
  "file": "your-post.md",
  "summary": "一句摘要",
  "module": "C++"
}
```

3. 提交并推送后：
- 首页自动显示最近三篇预览
- `blog.html` 自动显示完整文章列表，并按模块筛选

## 新增博客脚手架（推荐）

一键创建文章并自动更新索引：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\new-post.ps1 -Title "我的新文章" -Summary "一句摘要" -Module "Git" -Open
```

可选参数：
- `-Slug`：自定义文件名后缀（默认从标题生成）
- `-Module`：文章模块（默认 `杂记`）
- `-Open`：创建后自动打开 md 文件

## 网页博客编辑

部署 Worker 并连接 GitHub 后，允许的账号可在博客目录中新建文章，也可在阅读页编辑当前文章。编辑器支持：

- 标题、分类和描述；文件名由服务端生成，时间只读展示
- Markdown 正文与实时预览
- PNG、JPEG、GIF、WebP 图片插入、预览、移除与仓库文件删除
- IndexedDB 本地草稿箱、自动保存、恢复和删除
- 正文、图片与 `content/posts/index.json` 单次 commit 同步
- SHA 冲突检测，避免覆盖远端的新版本

草稿只保存在当前浏览器中，不会产生 GitHub commit。点击“同步到 GitHub”成功发布后，对应草稿会自动删除。

新文章首次同步时由 Worker 生成 Markdown 文件名与 `createdAt` / `updatedAt`；再次编辑只更新 `updatedAt`，并保持原文件名及 `createdAt` 不变。旧索引中的 `date` 字段仍可兼容读取。

编辑器插入的图片自动保存到 `content/posts/assets/`，无需手动设置文件名。移除已同步的编辑器图片后，对应资源会在下次同步时从仓库删除；外部图片只移除正文引用。

GitHub App 需要具备仓库 `Contents: Read and write` 权限。Worker 的博客接口为 `GET /api/posts` 与 `PUT /api/posts`。

## 本地自检

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\self-check.ps1
```

可视化预览：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\self-check.ps1 -Preview -KeepServer
```

## 任务板同步配置

- 站点侧配置文件：`content/site-config.json`
- 任务板数据文件：`content/tasks/board.json`
- Worker 项目目录：`worker/`

首版默认是“本地模式”：

- 如果 `content/site-config.json` 中 `apiBaseUrl` 为空，`tasks.html` 只做本地草稿保存
- 部署好 Cloudflare Worker 后，将 `apiBaseUrl` 改为对应的 `workers.dev` 地址即可启用登录与仓库同步

Worker 本地开发与部署说明见：`worker/README.md`

### 任务板本地联调

可以分两种方式测试：

1. 前端本地预览，直连线上 Worker

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\self-check.ps1 -Preview -KeepServer
```

然后打开本地预览地址中的 `tasks.html` 即可。

2. 前后端都在本地联调

先启动 Worker：

```powershell
cd .\worker
copy .dev.vars.example .dev.vars
npm run dev
```

再启动站点本地预览，并在地址上追加本地 API 参数：

```text
http://127.0.0.1:4173/tasks.html?apiBaseUrl=http://127.0.0.1:8787
```

这样无需改动仓库中的正式 `apiBaseUrl`，只对当前本地浏览器会话生效。

## 发布到 GitHub Pages

1. 推送到 `main`
2. 在仓库 Settings -> Pages 中选择 `GitHub Actions`
3. Actions 通过后访问：`https://qihaichiaki.github.io/`
