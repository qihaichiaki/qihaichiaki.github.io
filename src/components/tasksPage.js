export function tasksPage() {
  return `
    <header class="site-header">
      <a class="brand" href="./index.html#top">qihai</a>
      <div class="header-controls">
        <nav class="site-nav">
          <a href="#top">任务板</a>
          <a href="./blog.html">博客</a>
        </nav>
        <div class="site-user-area"></div>
      </div>
    </header>

    <main id="top" class="tasks-page-main">
      <section class="section tasks-page-hero reveal">
        <p class="section-tag">TASK BOARD</p>
        <h1 class="tasks-page-title">qihai的世界 · 任务板</h1>
        <p class="lead">先在浏览器里整理草稿，确认后再同步到 GitHub 仓库，写作感和管理感会更稳一些。</p>
      </section>

      <section class="section reveal tasks-board-zone">
        <div class="tasks-shell">
          <header class="tasks-shell-head">
            <div class="tasks-shell-copy">
              <p class="section-tag">SYNC</p>
              <h2>草稿、本地任务板与仓库同步分开处理</h2>
              <p id="tasks-mode-copy" class="tasks-mode-copy">正在检查任务板状态...</p>
            </div>

            <div class="tasks-shell-actions">
              <div class="tasks-state-pills">
                <span id="task-mode-badge" class="task-pill">加载中</span>
                <span id="task-sync-badge" class="task-pill task-pill-soft">等待初始化</span>
              </div>
              <div class="tasks-action-row">
                <button id="task-sync-button" class="btn btn-main is-hidden" type="button">手动同步</button>
                <button id="task-discard-button" class="btn btn-sub is-hidden" type="button">放弃本地修改</button>
              </div>
            </div>
          </header>

          <div id="tasks-alert" class="tasks-alert loading">正在读取任务板...</div>
          <div id="tasks-board-meta" class="tasks-board-meta"></div>
          <div id="tasks-board-columns" class="tasks-board-columns">
            <p class="loading">正在准备任务卡片...</p>
          </div>
        </div>
      </section>
    </main>
  `;
}
