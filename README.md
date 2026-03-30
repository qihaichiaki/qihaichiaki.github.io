# qihaichiaki.github.io

一个用于 GitHub Pages 的个人网站模板，标题固定为 **qihai的世界**。

## 页面结构

- 首页（`index.html`）
  - 近期参与提交的前三个仓库
  - 最近 Star 的三个仓库
  - 最近添加的三篇博客预览
- 博客页（`blog.html`）
  - 本地 Markdown 文章完整阅读与切换

## GitHub 数据说明

首页 GitHub 模块采用三层策略：

1. 优先读取 `events/public`（最接近“近期参与提交”）
2. 失败时回退 `repos?sort=pushed`
3. 仍失败时展示本地兜底列表

因此即使网络波动，也不会整块报错空白。

## 本地 Markdown 博客上传方式

1. 在 `content/posts/` 新增 `.md` 文件
2. 在 `content/posts/index.json` 追加文章元数据：

```json
{
  "title": "文章标题",
  "date": "2026-03-30",
  "file": "your-post.md",
  "summary": "一句摘要"
}
```

3. 提交并推送后：
- 首页自动显示最近三篇预览
- `blog.html` 自动显示完整文章列表

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
