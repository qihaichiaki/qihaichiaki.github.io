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
        <p class="lead">这里展示本地 Markdown 文章，更新即推送。</p>
      </section>

      <section class="section reveal">
        <div class="blog-layout">
          <aside id="blog-list" class="blog-list">
            <p class="loading">正在读取文章列表...</p>
          </aside>
          <article id="blog-content" class="blog-content">
            <p class="loading">请选择一篇文章开始阅读。</p>
          </article>
        </div>
      </section>
    </main>
  `;
}
