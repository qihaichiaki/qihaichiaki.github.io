const NAV_ITEMS = [
  { id: "tasks", label: "任务板", href: "./tasks.html" },
  { id: "blog", label: "博客", href: "./blog.html" }
];

export function siteHeader({ homeHref = "./index.html#top", currentPage = "home" } = {}) {
  const navHtml = NAV_ITEMS.map((item) => {
    const isCurrent = item.id === currentPage;
    const href = isCurrent ? "#top" : item.href;

    return `<a class="${isCurrent ? "is-current" : ""}" href="${href}">${item.label}</a>`;
  }).join("");

  return `
    <header class="site-header">
      <a class="brand" href="${homeHref}">qihai</a>
      <div class="header-controls">
        <nav class="site-nav">
          ${navHtml}
        </nav>
        <div class="site-user-area">
          <div id="site-user-menu" class="site-user-menu">
            <button
              id="site-user-trigger"
              class="site-user-trigger"
              type="button"
              aria-label="打开站点菜单"
              aria-haspopup="menu"
              aria-expanded="false"
            >
              <span id="site-user-fallback" class="site-user-fallback" aria-hidden="true">GH</span>
              <img id="site-user-avatar" class="site-user-avatar is-hidden" src="" alt="" />
              <span id="site-user-status" class="site-user-status" aria-hidden="true"></span>
            </button>
            <div id="site-user-dropdown" class="site-user-dropdown is-hidden" role="menu" aria-label="站点菜单">
              <div class="site-user-summary">
                <strong id="site-user-name">访客模式</strong>
                <span id="site-user-hint">展开后可切换主题，也可连接 GitHub。</span>
              </div>
              <button id="theme-toggle" class="site-menu-item theme-toggle theme-toggle-menu" type="button" role="menuitem">
                夜晚
              </button>
              <a id="site-connect-button" class="site-menu-item site-menu-link" href="#" role="menuitem">
                连接 GitHub
              </a>
              <p id="site-connect-note" class="site-menu-note is-hidden">当前页面未配置 GitHub 同步。</p>
              <button id="site-logout-button" class="site-menu-item site-menu-item-danger is-hidden" type="button" role="menuitem">
                退出登录
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  `;
}
