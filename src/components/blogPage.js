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
        <p class="lead">先浏览目录，再进入文章详情，专注阅读体验。</p>
      </section>

      <section class="section reveal blog-reading-zone">
        <div id="blog-catalog-view" class="blog-catalog-view">
          <header class="catalog-head">
            <p class="section-tag">CATALOG</p>
            <h2>博客目录</h2>
            <p class="catalog-lead">按模块浏览文章，点击任意条目进入详情阅读页。</p>
          </header>
          <div id="blog-catalog" class="blog-catalog">
            <p class="loading">正在读取文章目录...</p>
          </div>
        </div>

        <div id="blog-detail-view" class="blog-detail-view is-hidden">
          <div class="blog-detail-toolbar">
            <button id="back-to-catalog" class="btn btn-sub" type="button">返回博客目录</button>
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

            <aside id="blog-right-rail" class="blog-right-rail">
              <div class="right-rail-head">
                <p class="rail-title">文章内目录</p>
                <button id="toggle-right-rail" class="rail-collapse-btn" type="button" aria-label="收起文章内目录">
                  <span class="rail-collapse-icon" aria-hidden="true">&lt;</span>
                </button>
              </div>
              <nav id="article-toc" class="article-toc" aria-label="当前文章目录">
                <p class="loading">正在生成文章目录...</p>
              </nav>
              <button id="scroll-top-right" class="rail-top-btn" type="button">回到顶部</button>
            </aside>
          </div>
        </div>
      </section>
    </main>
  `;
}
