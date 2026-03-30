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
        <p class="lead">聚焦阅读，按模块筛选，目录可自动回收。</p>
      </section>

      <section class="section reveal blog-reading-zone">
        <div class="blog-layout is-collapsed" id="blog-layout">
          <aside class="blog-rail">
            <div class="rail-head">
              <div class="rail-title">文章目录</div>
              <button id="toggle-rail" class="rail-toggle" type="button">展开目录</button>
            </div>
            <div id="blog-modules" class="module-tabs"></div>
            <div id="blog-list" class="blog-list">
              <p class="loading">正在读取文章列表...</p>
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
        </div>
      </section>
    </main>
  `;
}
