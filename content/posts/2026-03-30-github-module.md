# GitHub 模块接入笔记

页面内新增了两个数据区块：

- 近期参与提交的前三个仓库
- 最近 Star 的三个仓库

## 数据来源

通过 GitHub Public API 在浏览器端实时拉取。

- Commit 区块：`/users/{user}/events/public`
- Star 区块：`/users/{user}/starred`

## 说明

如果请求频率过高，GitHub 可能出现速率限制，页面会显示友好降级提示。
