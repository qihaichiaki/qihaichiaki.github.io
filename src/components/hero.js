export function hero() {
  return `
    <header class="site-header">
      <a class="brand" href="#top">qihai</a>
      <nav class="site-nav">
        <a href="#works">提交</a>
        <a href="#stars">Star</a>
        <a href="#blog">博客</a>
        <a href="#contact">联系</a>
      </nav>
    </header>

    <main id="top">
      <section class="hero">
        <div class="sky-layer"></div>
        <div class="hero-shell">
          <div class="hero-copy">
            <p class="kicker">QIHAI PERSONAL SITE</p>
            <h1>蓝发基调的个人网站</h1>
            <p class="lead">
              以简洁排版呈现近期代码参与、收藏偏好与本地博客内容。
            </p>
            <div class="hero-actions">
              <a class="btn btn-main" href="#works">查看近期提交</a>
              <a class="btn btn-sub" href="#blog">浏览博客</a>
            </div>
          </div>
          <div class="hero-orb" aria-hidden="true"></div>
        </div>
      </section>

      <section id="works" class="section reveal">
        <p class="section-tag">COMMITS</p>
        <h2>近期参与提交的仓库</h2>
        <div id="recent-works" class="repo-list">
          <p class="loading">正在加载 GitHub 数据...</p>
        </div>
      </section>

      <section id="stars" class="section reveal">
        <p class="section-tag">STARS</p>
        <h2>最近 Star 的仓库</h2>
        <div id="recent-stars" class="repo-list">
          <p class="loading">正在加载 GitHub 数据...</p>
        </div>
      </section>

      <section id="blog" class="section reveal">
        <p class="section-tag">BLOG</p>
        <h2>本地 Markdown 博客</h2>
        <div class="blog-layout">
          <aside id="blog-list" class="blog-list">
            <p class="loading">正在读取文章列表...</p>
          </aside>
          <article id="blog-content" class="blog-content">
            <p class="loading">请选择一篇文章开始阅读。</p>
          </article>
        </div>
      </section>

      <section id="contact" class="section cta reveal">
        <p class="section-tag">CONTACT</p>
        <h2>如果你也喜欢清爽有节奏的网页，我们可以聊聊。</h2>
        <a class="btn btn-main" href="https://github.com/qihaichiaki" target="_blank" rel="noreferrer">GitHub</a>
      </section>
    </main>
  `;
}
