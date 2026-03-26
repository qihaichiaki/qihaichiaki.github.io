# qihaichiaki.github.io

一个用于 GitHub Pages 的简洁现代静态前端项目。

## 快速开始

1. 在 GitHub 创建一个空仓库，仓库名为 `qihaichiaki.github.io`。
2. 在当前目录执行：

```bash
git remote add origin https://github.com/<你的用户名>/qihaichiaki.github.io.git
git push -u origin main
```

3. 在 GitHub 仓库设置中，将 **Pages** 的来源设置为 **GitHub Actions**。
4. 工作流执行成功后，你的网站地址为：

`https://qihaichiaki.github.io/`

## 本地预览

直接用浏览器打开 `index.html` 即可。

## 本地自检（建议每次推送前执行）

在项目根目录运行：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\self-check.ps1
```

如果输出 `本地自检通过`，再执行 `git push`。

## 可视化本地预览（推荐）

如果你希望在自检后直接看到网页效果：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\self-check.ps1 -Preview -KeepServer
```

说明：
- 会先完成资源和 HTTP 检查。
- 自动打开浏览器访问 `http://127.0.0.1:4173/index.html`。
- 本地服务会保持运行，便于你检查页面；按 Enter 后结束。

## 可授权图片候选（高分辨率）

以下候选来自 Pixabay，受 Pixabay Content License 约束，可免费使用并允许修改（请避免单独转售原图）。

- https://pixabay.com/illustrations/anime-girl-generative-ai-7736177/ （7680 x 4320）
- https://pixabay.com/illustrations/anime-fantasy-girl-fantasy-8880111/ （4096 x 4096）
- https://pixabay.com/illustrations/ai-generated-fantasy-mage-9318044/ （4096 x 4096）

图片选择建议：
- 选冷色系（蓝/青）图作为主视觉，和当前站点配色更统一。
- 人物主体尽量偏右或偏左，避免遮挡标题区域。
- 优先下载原始分辨率，再在本地压缩到网页版本。
