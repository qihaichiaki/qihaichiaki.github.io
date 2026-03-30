export function blogPage() {
  return `
    <header class="site-header">
      <a class="brand" href="./index.html#top">qihai</a>
      <nav class="site-nav">
        <a href="./index.html#works">提交</a>
        <a href="./index.html#stars">Star</a>
        <a href="./index.html#posts">最近博客</a>
        <a href="#top">博客页</a>
      </nav>
    </header>

    <main id="top" class="blog-page-main">
      <section class="section blog-page-hero reveal">
        <p class="section-tag">BLOG</p>
        <h1 class="blog-page-title">qihai的世界 · 博客</h1>
        <p class="lead">聚焦阅读体验：左侧文章目录、右侧当前文章目录，均支持边缘收展。</p>
      </section>

      <section class="section reveal blog-reading-zone">
        <div class="blog-shell" id="blog-shell">
          <aside id="blog-left-rail" class="blog-side blog-side-left">
            <button id="toggle-left-rail" class="side-handle side-handle-left" type="button" aria-label="收起文章目录">
              <span aria-hidden="true">◀</span>
            </button>
            <div class="side-inner">
              <div class="rail-head">
                <div class="rail-title">文章目录</div>
              </div>
              <div id="blog-list" class="blog-list">
                <p class="loading">正在读取文章列表...</p>
              </div>
            </div>
          </aside>

          <div class="blog-article-wrap">
            <header id="blog-meta" class="blog-meta">
              <p class="loading">正在准备文章信息...</p>
            </header>
            <article id="blog-content" class="blog-content">
              <p class="loading">请选择一篇文章开始阅读。</p>
            </article>
          </div>

          <aside id="blog-right-rail" class="blog-side blog-side-right">
            <button id="toggle-right-rail" class="side-handle side-handle-right" type="button" aria-label="收起文章内目录">
              <span aria-hidden="true">▶</span>
            </button>
            <div class="side-inner">
              <div class="rail-head">
                <div class="rail-title">文章内目录</div>
              </div>
              <nav id="article-toc" class="article-toc" aria-label="当前文章目录">
                <p class="loading">正在生成文章目录...</p>
              </nav>
            </div>
          </aside>
        </div>
      </section>
    </main>
  `;
}
