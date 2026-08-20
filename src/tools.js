import { siteHeader } from "./components/siteHeader.js";
import { initNebulaBackground } from "./lib/nebulaBackground.js";
import { initSiteHeaderAuth } from "./lib/siteHeaderAuth.js";

document.querySelector("#app").innerHTML = `
  ${siteHeader({ currentPage: "tools" })}
  <main id="top" class="tools-page-main">
    <section class="tools-intro">
      <p class="section-tag">WEB TOOLS</p>
      <h1>轻量工具</h1>
      <p>直接在浏览器里完成常用工作；数据默认只留在本地。</p>
    </section>

    <section class="tools-list" aria-label="可用工具">
      <a class="tool-entry" href="./tools/geometry/">
        <span class="tool-entry-index">01</span>
        <span class="tool-entry-main">
          <strong>几何作图</strong>
          <span>网格吸附、基础图形、批注、测量与截图导出</span>
        </span>
        <span class="tool-entry-arrow" aria-hidden="true">→</span>
      </a>
    </section>
  </main>
`;

initSiteHeaderAuth();
initNebulaBackground();
