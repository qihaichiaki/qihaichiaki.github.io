export function blogPage() {
  return `
    <header class="site-header">
      <a class="brand" href="./index.html#top">qihai</a>
      <div class="header-controls">
        <nav class="site-nav">
          <a href="./tasks.html">任务板</a>
          <a href="#top">博客</a>
        </nav>
        <div class="site-user-area"></div>
      </div>
    </header>

    <main id="top" class="blog-page-main">
      <section class="section blog-page-hero reveal">
        <p class="section-tag">BLOG</p>
        <h1 class="blog-page-title">qihai的世界 · 博客</h1>
      </section>

      <section class="section reveal blog-reading-zone">
        <div id="blog-catalog-view" class="blog-catalog-view">
          <header class="catalog-head">
            <div>
              <p class="section-tag">CATALOG</p>
              <h2>文章目录</h2>
            </div>
            <div class="catalog-head-actions">
              <p id="blog-catalog-meta" class="catalog-meta">正在读取...</p>
              <button id="open-drafts-button" class="btn btn-sub blog-owner-action is-hidden" type="button">
                草稿箱 <span id="draft-count" class="draft-count">0</span>
              </button>
              <button id="new-post-button" class="btn btn-main blog-owner-action is-hidden" type="button">新建文章</button>
            </div>
          </header>
          <div id="blog-catalog" class="blog-catalog">
            <p class="loading">正在读取文章目录...</p>
          </div>
        </div>

        <div id="blog-detail-view" class="blog-detail-view is-hidden">
          <div class="blog-detail-toolbar">
            <button id="back-to-catalog" class="blog-back-link" type="button">
              <span aria-hidden="true">←</span>
              <span>博客目录</span>
            </button>
            <button id="edit-post-button" class="btn btn-sub blog-owner-action is-hidden" type="button">编辑文章</button>
          </div>

          <div class="blog-reading-layout" id="blog-reading-layout">
            <div class="blog-article-wrap">
              <header id="blog-meta" class="blog-meta">
                <p class="loading">正在准备文章信息...</p>
              </header>
              <article id="blog-content" class="blog-content">
                <p class="loading">请选择一篇文章开始阅读。</p>
              </article>
            </div>

            <div class="blog-rail-column">
              <div id="blog-right-stack" class="blog-right-stack">
                <aside id="blog-right-rail" class="blog-right-rail">
                  <div class="right-rail-head">
                    <div>
                      <p class="rail-title">文章目录</p>
                      <p id="reading-progress" class="reading-progress">已阅读 0%</p>
                    </div>
                    <button id="toggle-right-rail" class="rail-collapse-btn" type="button" aria-label="收起文章内目录">
                      <span class="rail-collapse-icon" aria-hidden="true">&lt;</span>
                    </button>
                  </div>
                  <nav id="article-toc" class="article-toc" aria-label="当前文章目录">
                    <p class="loading">正在生成文章目录...</p>
                  </nav>
                </aside>
              </div>
              <button id="toc-bookmark" class="toc-bookmark" type="button" aria-label="展开文章目录">
                <span class="toc-bookmark-glyph" aria-hidden="true"></span>
                <span>目录</span>
              </button>
              <button id="scroll-top-right" class="article-top-button" type="button" aria-label="返回顶部" aria-hidden="true" tabindex="-1">
                <span aria-hidden="true">↑</span>
              </button>
            </div>
          </div>
        </div>

        <div id="blog-drafts-view" class="blog-drafts-view is-hidden">
          <header class="drafts-head">
            <div>
              <button id="close-drafts-button" class="blog-back-link" type="button">
                <span aria-hidden="true">←</span>
                <span>博客目录</span>
              </button>
              <p class="section-tag">DRAFTS</p>
              <h2>草稿箱</h2>
            </div>
            <p id="drafts-meta" class="catalog-meta">0 篇草稿</p>
          </header>
          <div id="post-drafts-list" class="post-drafts-list">
            <p class="loading">正在读取草稿...</p>
          </div>
        </div>

        <div id="blog-editor-view" class="blog-editor-view is-hidden">
          <header class="blog-editor-head">
            <div>
              <button id="close-post-editor" class="blog-back-link" type="button">
                <span aria-hidden="true">←</span>
                <span>退出编辑</span>
              </button>
              <p id="post-editor-kicker" class="section-tag">NEW POST</p>
              <h2 id="post-editor-title">新建文章</h2>
              <div id="post-editor-version" class="post-editor-version"></div>
            </div>
            <div class="blog-editor-actions">
              <span id="post-editor-status" class="post-editor-status" role="status" aria-live="polite"></span>
              <button id="delete-current-draft" class="btn btn-sub post-draft-delete is-hidden" type="button">删除草稿</button>
              <button id="save-post-button" class="btn btn-main" type="button">同步到 GitHub</button>
            </div>
          </header>

          <form id="post-editor-form" class="post-editor-form" novalidate>
            <div class="post-editor-fields">
              <label class="post-field post-field-title">
                <span>标题</span>
                <input id="post-title-input" name="title" type="text" maxlength="120" autocomplete="off" required />
              </label>
              <label class="post-field">
                <span>分类</span>
                <input id="post-module-input" name="module" type="text" maxlength="60" list="post-module-options" autocomplete="off" required />
                <datalist id="post-module-options"></datalist>
              </label>
              <label class="post-field post-field-summary">
                <span>描述</span>
                <input id="post-summary-input" name="summary" type="text" maxlength="300" autocomplete="off" />
              </label>
            </div>

            <div class="post-editor-workspace">
              <section class="post-editor-pane post-source-pane">
                <header>
                  <div class="post-editor-pane-title">
                    <strong>Markdown</strong>
                    <span id="post-editor-count">0 字</span>
                  </div>
                  <div class="post-image-actions">
                    <span id="post-image-summary"></span>
                    <button id="insert-post-image" class="post-image-insert" type="button">插入图片</button>
                    <input id="post-image-input" type="file" accept="image/png,image/jpeg,image/gif,image/webp" multiple hidden />
                  </div>
                </header>
                <div id="post-image-list" class="post-image-list"></div>
                <label class="sr-only" for="post-content-input">Markdown 正文</label>
                <textarea id="post-content-input" name="content" spellcheck="false" required></textarea>
              </section>
              <section class="post-editor-pane post-preview-pane">
                <header>
                  <strong>预览</strong>
                  <span>实时解析</span>
                </header>
                <article id="post-preview-content" class="blog-content post-preview-content"></article>
              </section>
            </div>
          </form>
        </div>
      </section>
    </main>
  `;
}
