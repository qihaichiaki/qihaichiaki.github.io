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
            <p class="lead">
              以简洁排版呈现近期代码参与、收藏偏好与写作节奏。
            </p>
            <div class="hero-actions">
              <a class="btn btn-main" href="#works">查看近期提交</a>
              <a class="btn btn-sub" href="./tasks.html">进入任务板</a>
              <a class="btn btn-sub" href="./blog.html">进入博客页</a>
            </div>
          </div>
          <div class="hero-magic" aria-hidden="true">
            <div class="arcane-panel" data-magic-circle data-mode="0">
              <svg class="arcane-svg" viewBox="0 0 600 600" overflow="visible" focusable="false" aria-hidden="true">
                <defs>
                  <radialGradient id="coreGlow" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stop-color="rgba(245,255,255,1)"></stop>
                    <stop offset="16%" stop-color="rgba(182,242,255,0.98)"></stop>
                    <stop offset="42%" stop-color="rgba(98,208,255,0.72)"></stop>
                    <stop offset="75%" stop-color="rgba(60,120,255,0.18)"></stop>
                    <stop offset="100%" stop-color="rgba(0,0,0,0)"></stop>
                  </radialGradient>
                  <radialGradient id="expandWave" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stop-color="rgba(255,255,255,0.32)"></stop>
                    <stop offset="70%" stop-color="rgba(132,224,255,0.1)"></stop>
                    <stop offset="100%" stop-color="rgba(0,0,0,0)"></stop>
                  </radialGradient>
                </defs>

                <g class="thunder-clouds">
                  <g class="cloud cloud-1" style="--cloud-delay: 0s; --cloud-drift: 0.2;">
                    <ellipse cx="118" cy="92" rx="53" ry="20"></ellipse>
                    <ellipse cx="92" cy="96" rx="40" ry="16"></ellipse>
                    <ellipse cx="144" cy="94" rx="42" ry="15"></ellipse>
                    <path class="cloud-bolt" d="M 108 110 L 120 126 L 112 126 L 128 152"></path>
                  </g>
                  <g class="cloud cloud-2" style="--cloud-delay: 0.17s; --cloud-drift: 0.36;">
                    <ellipse cx="408" cy="100" rx="52" ry="20"></ellipse>
                    <ellipse cx="382" cy="104" rx="39" ry="16"></ellipse>
                    <ellipse cx="434" cy="102" rx="41" ry="15"></ellipse>
                    <path class="cloud-bolt" d="M 398 118 L 410 134 L 402 134 L 418 160"></path>
                  </g>
                  <g class="cloud cloud-3" style="--cloud-delay: 0.28s; --cloud-drift: 0.48;">
                    <ellipse cx="112" cy="500" rx="54" ry="20"></ellipse>
                    <ellipse cx="86" cy="504" rx="41" ry="16"></ellipse>
                    <ellipse cx="138" cy="502" rx="43" ry="15"></ellipse>
                    <path class="cloud-bolt" d="M 102 518 L 114 534 L 106 534 L 122 560"></path>
                  </g>
                  <g class="cloud cloud-4" style="--cloud-delay: 0.4s; --cloud-drift: 0.6;">
                    <ellipse cx="418" cy="492" rx="52" ry="19"></ellipse>
                    <ellipse cx="392" cy="496" rx="39" ry="15"></ellipse>
                    <ellipse cx="444" cy="494" rx="40" ry="14"></ellipse>
                    <path class="cloud-bolt" d="M 408 510 L 420 526 L 412 526 L 428 552"></path>
                  </g>
                </g>

                <g class="arcane-body">
                  <circle class="expand-wave" cx="300" cy="300" r="294" fill="url(#expandWave)"></circle>
                  <g class="constellation-ring"></g>
                  <circle cx="300" cy="300" r="284" class="ring ring-0"></circle>
                  <circle cx="300" cy="300" r="254" class="ring ring-1"></circle>
                  <circle cx="300" cy="300" r="236" class="ring ring-2"></circle>
                  <circle cx="300" cy="300" r="210" class="ring ring-3"></circle>
                  <circle cx="300" cy="300" r="188" class="ring ring-4"></circle>
                  <circle cx="300" cy="300" r="148" class="ring ring-5"></circle>
                  <circle cx="300" cy="300" r="104" class="ring ring-6"></circle>
                  <circle cx="300" cy="300" r="40" class="ring ring-7"></circle>

                  <g class="outer-spin">
                    <g class="polar-marks polar-marks-outer"></g>
                    <g class="grand-rune-ring"></g>
                  </g>

                  <g class="reverse-spin">
                    <polygon class="majestic-star star-a" points="300,96 326,218 452,178 382,282 504,320 382,338 452,442 326,402 300,524 274,402 148,442 218,338 96,320 218,282 148,178 274,218"></polygon>
                    <polygon class="majestic-star star-b" points="300,130 325,229 419,168 370,257 470,300 370,343 419,432 325,371 300,470 275,371 181,432 230,343 130,300 230,257 181,168 275,229"></polygon>
                    <g class="polar-marks polar-marks-mid"></g>
                  </g>

                  <g class="diamond-spin">
                    <g class="diamond-web"></g>
                  </g>

                  <g class="center-star-stack">
                    <path d="M300 138 L362 232 L480 250 L400 330 L420 452 L300 392 L180 452 L200 330 L120 250 L238 232 Z"></path>
                    <path d="M300 168 L348 242 L432 256 L374 318 L390 410 L300 366 L210 410 L226 318 L168 256 L252 242 Z"></path>
                    <path d="M300 220 L334 269 L392 278 L352 319 L362 378 L300 350 L238 378 L248 319 L208 278 L266 269 Z"></path>
                  </g>

                  <g class="arc-burst"></g>

                  <g class="floating-glyphs">
                    <text x="84" y="98">✦</text>
                    <text x="516" y="104">✧</text>
                    <text x="62" y="298">ᚠ</text>
                    <text x="540" y="300">ᚱ</text>
                    <text x="96" y="500">✶</text>
                    <text x="504" y="498">✴</text>
                    <text x="300" y="50">✦</text>
                    <text x="300" y="550">✧</text>
                  </g>

                  <g class="cross-lines">
                    <line x1="300" y1="40" x2="300" y2="560"></line>
                    <line x1="40" y1="300" x2="560" y2="300"></line>
                    <line x1="104" y1="104" x2="496" y2="496"></line>
                    <line x1="496" y1="104" x2="104" y2="496"></line>
                  </g>
                </g>

                <g class="core-parallax">
                  <circle class="core-glow" cx="300" cy="300" r="106" fill="url(#coreGlow)"></circle>
                  <circle class="core-dot" cx="300" cy="300" r="14"></circle>
                </g>
              </svg>

              <div class="arcane-pulse arcane-pulse-a"></div>
              <div class="arcane-pulse arcane-pulse-b"></div>
              <div class="arcane-burst">
                <div class="burst-layer burst-layer-a"></div>
                <div class="burst-layer burst-layer-b"></div>
              </div>
            </div>
          </div>
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
