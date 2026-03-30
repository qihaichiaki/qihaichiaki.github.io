export function hero() {
  return `
    <header class="site-header">
      <a class="brand" href="#top">qihai</a>
      <nav class="site-nav">
        <a href="#about">关于</a>
        <a href="#works">作品</a>
        <a href="#contact">联系</a>
      </nav>
    </header>

    <main id="top">
      <section class="hero">
        <div class="sky-layer"></div>
        <div class="hero-shell">
          <div class="hero-copy">
            <p class="kicker">QIHAI PERSONAL SITE</p>
            <h1>qihai 的个人网站</h1>
            <p class="lead">
              用清爽、轻幻想的视觉语言组织内容，
              展示项目、记录创作，也保留一点想象力。
            </p>
            <div class="hero-actions">
              <a class="btn btn-main" href="#works">查看作品</a>
              <a class="btn btn-sub" href="#contact">联系我</a>
            </div>
            <p class="bg-hint" id="bg-hint"></p>
          </div>
          <div class="hero-gallery" aria-label="授权图片展示位">
            <figure class="art art-main">
              <span>图库随机背景启用</span>
            </figure>
            <figure class="art art-sub">
              <span>可在 src/data/backgrounds.js 扩展</span>
            </figure>
          </div>
        </div>
      </section>

      <section id="about" class="section reveal">
        <p class="section-tag">ABOUT</p>
        <h2>我喜欢把想法做成可访问、可交互的网页。</h2>
        <div class="split">
          <p>
            主要关注前端体验、视觉叙事和性能平衡。
            偏好简洁架构，不堆砌组件，用少量设计语言表达明确风格。
          </p>
          <ul class="stack-list">
            <li>HTML / CSS / JavaScript</li>
            <li>React / Vue / Vite</li>
            <li>GitHub Pages / CI</li>
          </ul>
        </div>
      </section>

      <section id="works" class="section reveal">
        <p class="section-tag">WORKS</p>
        <h2>近期作品</h2>
        <div class="works">
          <a class="work" href="#" aria-label="project one">
            <span>01</span>
            <strong>视觉交互实验页</strong>
            <em>Animation / Landing</em>
          </a>
          <a class="work" href="#" aria-label="project two">
            <span>02</span>
            <strong>小游戏原型集合</strong>
            <em>Canvas / Game UI</em>
          </a>
          <a class="work" href="#" aria-label="project three">
            <span>03</span>
            <strong>个人博客模板</strong>
            <em>Blog / Content System</em>
          </a>
        </div>
      </section>

      <section id="contact" class="section cta reveal">
        <p class="section-tag">CONTACT</p>
        <h2>如果你也想做一个有个性的网站，我们可以聊聊。</h2>
        <a class="btn btn-main" href="https://github.com/qihaichiaki" target="_blank" rel="noreferrer">GitHub</a>
      </section>
    </main>
  `;
}
