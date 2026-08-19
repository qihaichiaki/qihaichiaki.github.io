export function hero() {
  return `
    <header class="site-header">
      <a class="brand" href="#top">qihai</a>
      <div class="header-controls">
        <nav class="site-nav">
          <a href="./tasks.html">任务板</a>
          <a href="./blog.html">博客</a>
        </nav>
        <div class="site-user-area"></div>
      </div>
    </header>

    <main id="top">
      <section class="hero">
        <div class="sky-layer"></div>
        <div class="hero-shell">
          <div class="hero-copy">
            <p class="kicker">QIHAI PERSONAL SITE</p>
            <h1>qihai的世界</h1>
            <p class="lead">代码、笔记与进行中的事。</p>
            <div class="hero-actions">
              <a class="btn btn-main" href="#works">近期代码</a>
              <a class="btn btn-sub" href="./tasks.html">打开任务板</a>
            </div>
          </div>

          <button
            class="hero-character-gallery"
            data-character-gallery
            type="button"
            aria-label="切换下一张插画，当前第 1 张，共 9 张"
          >
            <div class="hero-character-aura"></div>
            <div class="hero-character-stage">
              <div
                class="hero-character-layer is-active"
                data-character-layer
              >
                <img
                  class="hero-character-backdrop"
                  data-character-backdrop
                  src="./assets/img/1784769503774.jpeg"
                  alt=""
                  decoding="async"
                  draggable="false"
                />
                <img
                  class="hero-character-image"
                  data-character-image
                  src="./assets/img/1784769503774.jpeg"
                  alt=""
                  decoding="async"
                  fetchpriority="high"
                  draggable="false"
                />
              </div>
              <div
                class="hero-character-layer"
                data-character-layer
              >
                <img
                  class="hero-character-backdrop"
                  data-character-backdrop
                  alt=""
                  decoding="async"
                  draggable="false"
                />
                <img
                  class="hero-character-image"
                  data-character-image
                  alt=""
                  decoding="async"
                  draggable="false"
                />
              </div>
              <span class="hero-character-dissolve"></span>
            </div>
          </button>
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
        <h2>更多代码与项目</h2>
        <a class="btn btn-main" href="https://github.com/qihaichiaki" target="_blank" rel="noreferrer">前往 GitHub</a>
      </section>
    </main>
  `;
}
