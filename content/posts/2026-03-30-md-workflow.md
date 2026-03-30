# 本地 Markdown 博客工作流

这套博客系统是“本地文件优先”的：

1. 在 `content/posts/` 新增 `.md` 文件
2. 在 `content/posts/index.json` 追加文章元数据
3. 推送后网页会自动展示文章列表

## 索引格式

```json
{
  "title": "文章标题",
  "date": "2026-03-30",
  "file": "example.md",
  "summary": "摘要"
}
```

这样做的好处是：

- 不依赖后端
- 可直接版本化管理
- 便于长期维护和迁移
