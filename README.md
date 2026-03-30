# qihaichiaki.github.io

一个用于 GitHub Pages 的个人网站模板，默认使用蓝发冷色调视觉。

## 页面模块

- 近期参与提交的前三个仓库（GitHub Public API）
- 最近 Star 的三个仓库（GitHub Public API）
- 本地 Markdown 博客系统（基于 `content/posts`）

## 本地博客上传方式

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

3. 提交并推送后，网页会自动显示在博客列表中

## 本地自检

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\self-check.ps1
```

可视化预览：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\self-check.ps1 -Preview -KeepServer
```

## 发布到 GitHub Pages

1. 确保远程仓库为 `qihaichiaki.github.io`
2. 推送到 `main`
3. 在仓库 Settings -> Pages 中选择 `GitHub Actions`
4. Actions 通过后访问：`https://qihaichiaki.github.io/`
