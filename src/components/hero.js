export function hero() {
  return `
    <header class="site-header">
      <a class="brand" href="#top">qihai</a>
      <nav class="site-nav">
        <a href="#works">提交</a>
        <a href="#stars">Star</a>
        <a href="#posts">最近博客</a>
        <a href="./blog.html">博客</a>
        <a href="#contact">联系</a>
      </nav>
    </header>

    <main id="top">
      <section class="hero">
        <div class="sky-layer"></div>
        <div class="hero-shell">
          <div class="hero-copy">
            <p class="kicker">QIHAI PERSONAL SITE</p>
            <h1>qihai的世界</h1>
            <p class="lead">
              以简洁排版呈现近期代码参与、收藏偏好与写作节奏。
            </p>
            <div class="hero-actions">
              <a class="btn btn-main" href="#works">查看近期提交</a>
              <a class="btn btn-sub" href="./blog.html">进入博客页</a>
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

      <section id="posts" class="section reveal">
        <p class="section-tag">LATEST POSTS</p>
        <h2>最近添加的博客</h2>
        <div id="recent-posts" class="repo-list">
          <p class="loading">正在读取文章列表...</p>
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
