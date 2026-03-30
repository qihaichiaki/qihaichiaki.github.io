# qihaichiaki.github.io

一个用于 GitHub Pages 的个人网站模板，标题固定为 **qihai的世界**。

## 页面结构

- 首页（`index.html`）
  - 近期参与提交的前三个仓库
  - 最近 Star 的三个仓库
  - 最近添加的三篇博客预览
- 博客页（`blog.html`）
  - 模块筛选（如 C++ / Git / 杂记）
  - 目录可折叠，阅读时自动回收
  - Markdown 文章完整阅读与切换

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
  "date": "2026-03-30",
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

## 本地自检

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\self-check.ps1
```

可视化预览：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\self-check.ps1 -Preview -KeepServer
```

## 发布到 GitHub Pages

1. 推送到 `main`
2. 在仓库 Settings -> Pages 中选择 `GitHub Actions`
3. Actions 通过后访问：`https://qihaichiaki.github.io/`
