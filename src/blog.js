import { blogPage } from "./components/blogPage.js";
import { parseMarkdown } from "./lib/markdown.js";

document.querySelector("#app").innerHTML = blogPage();
document.body.classList.add("blog-page");

const revealNodes = document.querySelectorAll(".reveal");
const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("in");
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.22 }
);

revealNodes.forEach((node) => revealObserver.observe(node));

const urlParams = new URLSearchParams(window.location.search);

const state = {
  posts: [],
  activeFile: urlParams.get("post") || "",
  view: urlParams.get("post") ? "detail" : "catalog",
  tocCollapsed: window.matchMedia("(max-width: 1160px)").matches,
  tocObserver: null,
  topButtonVisible: false,
  topButtonRaf: 0
};

const escapeText = (value) =>
  String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const getModuleOf = (post) => post.module || "杂记";

const calcReadMinutes = (markdown) => {
  const chars = markdown.replace(/\s/g, "").length;
  return Math.max(1, Math.round(chars / 480));
};

const groupPostsByModule = (posts) => {
  const map = new Map();
  posts.forEach((post) => {
    const module = getModuleOf(post);
    if (!map.has(module)) {
      map.set(module, []);
    }
    map.get(module).push(post);
  });
  return Array.from(map.entries());
};

const syncUrl = () => {
  const url = new URL(window.location.href);

  if (state.view === "detail" && state.activeFile) {
    url.searchParams.set("post", state.activeFile);
    const post = state.posts.find((item) => item.file === state.activeFile);
    if (post) {
      url.searchParams.set("module", getModuleOf(post));
    }
  } else {
    url.searchParams.delete("post");
    url.searchParams.delete("module");
  }

  window.history.replaceState(null, "", url.toString());
};

const syncBookmarkVisibility = () => {
  const bookmark = document.querySelector("#toc-bookmark");
  if (!bookmark) return;

  const visible = state.view === "detail" && state.tocCollapsed;
  bookmark.classList.toggle("is-visible", visible);
};

const syncTopButtonVisibility = () => {
  const topButton = document.querySelector("#scroll-top-right");
  if (!topButton) return;

  const scrollY = window.scrollY || window.pageYOffset || 0;
  const shouldShow = state.view === "detail" && scrollY > (state.topButtonVisible ? 140 : 240);
  if (shouldShow === state.topButtonVisible) return;

  state.topButtonVisible = shouldShow;
  topButton.classList.toggle("is-visible", shouldShow);
};

const scheduleTopButtonSync = () => {
  if (state.topButtonRaf) return;
  state.topButtonRaf = window.requestAnimationFrame(() => {
    state.topButtonRaf = 0;
    syncTopButtonVisibility();
  });
};

const setView = (view) => {
  const catalog = document.querySelector("#blog-catalog-view");
  const detail = document.querySelector("#blog-detail-view");
  if (!catalog || !detail) return;

  state.view = view;
  catalog.classList.toggle("is-hidden", view !== "catalog");
  detail.classList.toggle("is-hidden", view !== "detail");

  if (view === "catalog") {
    document.title = "qihai的世界 | Blog";
  }

  syncBookmarkVisibility();
  syncTopButtonVisibility();
  syncUrl();
};

const setTocCollapsed = (collapsed) => {
  const layout = document.querySelector("#blog-reading-layout");
  const stack = document.querySelector("#blog-right-stack");
  const rail = document.querySelector("#blog-right-rail");
  const toggle = document.querySelector("#toggle-right-rail");
  if (!layout || !stack || !rail || !toggle) return;

  const forceExpanded = window.matchMedia("(max-width: 780px)").matches;
  const nextCollapsed = forceExpanded ? false : collapsed;

  state.tocCollapsed = nextCollapsed;
  layout.classList.toggle("is-rail-collapsed", nextCollapsed);
  stack.classList.toggle("is-collapsed", nextCollapsed);
  rail.classList.toggle("is-collapsed", nextCollapsed);
  toggle.classList.toggle("is-collapsed", nextCollapsed);
  toggle.setAttribute("aria-label", nextCollapsed ? "展开文章内目录" : "收起文章内目录");

  const icon = toggle.querySelector(".rail-collapse-icon");
  if (icon) {
    icon.textContent = nextCollapsed ? ">" : "<";
  }

  syncBookmarkVisibility();
};

const clearTocObserver = () => {
  if (state.tocObserver) {
    state.tocObserver.disconnect();
    state.tocObserver = null;
  }
};

const renderPostMeta = (post, minutes) => {
  const meta = document.querySelector("#blog-meta");
  if (!meta) return;

  meta.innerHTML = `
    <p class="meta-kicker">${escapeText(getModuleOf(post).toUpperCase())}</p>
    <h2>${escapeText(post.title)}</h2>
    <div class="meta-row">
      <span>${escapeText(post.date)}</span>
      <span>${minutes} 分钟阅读</span>
      <span>${escapeText(post.file)}</span>
    </div>
    ${post.summary ? `<p class="meta-summary">${escapeText(post.summary)}</p>` : ""}
  `;
};

const renderArticleToc = (headings) => {
  const tocRoot = document.querySelector("#article-toc");
  if (!tocRoot) return;

  const visible = headings.filter((item) => item.level <= 3);
  if (!visible.length) {
    tocRoot.innerHTML = '<p class="toc-empty">当前文章没有可提取的标题目录。</p>';
    clearTocObserver();
    return;
  }

  tocRoot.innerHTML = visible
    .map(
      (item) => `
      <a class="toc-link toc-level-${item.level}" href="#${item.id}" data-id="${item.id}">
        ${escapeText(item.text)}
      </a>
    `
    )
    .join("");

  const links = Array.from(tocRoot.querySelectorAll(".toc-link"));
  links.forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      const id = link.dataset.id;
      const target = id ? document.getElementById(id) : null;
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  });
};

const bindArticleTocObserver = () => {
  clearTocObserver();

  const headings = Array.from(document.querySelectorAll("#blog-content h1[id], #blog-content h2[id], #blog-content h3[id]"));
  const links = Array.from(document.querySelectorAll("#article-toc .toc-link"));

  if (!headings.length || !links.length) {
    return;
  }

  const setActive = (id) => {
    links.forEach((link) => {
      link.classList.toggle("is-active", link.dataset.id === id);
    });
  };

  setActive(headings[0].id);

  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

      if (visible.length) {
        setActive(visible[0].target.id);
        return;
      }

      const passed = headings.filter((item) => item.getBoundingClientRect().top <= 130);
      if (passed.length) {
        setActive(passed[passed.length - 1].id);
      }
    },
    {
      rootMargin: "-90px 0px -68% 0px",
      threshold: [0, 0.2, 1]
    }
  );

  headings.forEach((item) => observer.observe(item));
  state.tocObserver = observer;
};

const markCatalogActive = () => {
  document.querySelectorAll(".catalog-post-btn").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.file === state.activeFile);
  });
};

const renderCatalog = () => {
  const root = document.querySelector("#blog-catalog");
  if (!root) return;

  if (!state.posts.length) {
    root.innerHTML = '<p class="empty">暂无文章，请先新增 md 文件。</p>';
    return;
  }

  root.innerHTML = groupPostsByModule(state.posts)
    .map(
      ([module, posts]) => `
      <section class="catalog-module">
        <header class="catalog-module-head">
          <h3>${escapeText(module)}</h3>
          <span>${posts.length} 篇</span>
        </header>
        <div class="catalog-module-list">
          ${posts
            .map(
              (post) => `
              <button class="catalog-post-btn ${post.file === state.activeFile ? "is-active" : ""}" data-file="${escapeText(post.file)}" type="button">
                <strong>${escapeText(post.title)}</strong>
                <span>${escapeText(post.date)}</span>
                <em>${escapeText(post.summary || "")}</em>
              </button>
            `
            )
            .join("")}
        </div>
      </section>
    `
    )
    .join("");
};

const renderPostContent = async (post) => {
  const contentRoot = document.querySelector("#blog-content");
  if (!contentRoot) return;

  try {
    const resp = await fetch(`./content/posts/${post.file}`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

    const markdown = await resp.text();
    const rendered = parseMarkdown(markdown);

    contentRoot.innerHTML = rendered.html;
    renderPostMeta(post, calcReadMinutes(markdown));
    renderArticleToc(rendered.headings);
    bindArticleTocObserver();

    state.activeFile = post.file;
    markCatalogActive();
    setView("detail");
    document.title = `${post.title} | qihai的世界`;
  } catch {
    contentRoot.innerHTML = '<p class="empty">文章加载失败，请检查 md 文件路径。</p>';
    renderArticleToc([]);
    setView("detail");
  }
};

const openPost = async (file) => {
  const post = state.posts.find((item) => item.file === file);
  if (!post) return;

  await renderPostContent(post);
  if (window.matchMedia("(max-width: 1160px)").matches) {
    setTocCollapsed(true);
  }
};

const showCatalog = () => {
  clearTocObserver();
  setView("catalog");
};

const setupInteractions = () => {
  const catalogRoot = document.querySelector("#blog-catalog");
  const backButton = document.querySelector("#back-to-catalog");
  const toggleToc = document.querySelector("#toggle-right-rail");
  const topButton = document.querySelector("#scroll-top-right");
  const bookmark = document.querySelector("#toc-bookmark");

  if (catalogRoot) {
    catalogRoot.addEventListener("click", async (event) => {
      const target = event.target instanceof HTMLElement ? event.target.closest(".catalog-post-btn") : null;
      if (!target) return;

      const file = target.dataset.file;
      if (file) {
        await openPost(file);
      }
    });
  }

  if (backButton) {
    backButton.addEventListener("click", () => {
      showCatalog();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  if (toggleToc) {
    toggleToc.addEventListener("click", () => {
      setTocCollapsed(!state.tocCollapsed);
    });
  }

  if (bookmark) {
    bookmark.addEventListener("click", () => {
      setTocCollapsed(false);
    });
  }

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (topButton) {
    topButton.addEventListener("click", scrollToTop);
  }

  window.addEventListener("scroll", scheduleTopButtonSync, { passive: true });
  window.addEventListener("resize", scheduleTopButtonSync);
  syncTopButtonVisibility();

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state.view === "detail") {
      setTocCollapsed(true);
    }
  });
};

const loadBlogPage = async () => {
  const catalogRoot = document.querySelector("#blog-catalog");
  const contentRoot = document.querySelector("#blog-content");
  const meta = document.querySelector("#blog-meta");

  try {
    const resp = await fetch("./content/posts/index.json");
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

    state.posts = await resp.json();
    renderCatalog();
    setTocCollapsed(state.tocCollapsed);

    if (state.activeFile && state.posts.some((item) => item.file === state.activeFile)) {
      await openPost(state.activeFile);
    } else {
      showCatalog();
    }
  } catch {
    if (catalogRoot) {
      catalogRoot.innerHTML = '<p class="empty">博客索引读取失败，请检查 content/posts/index.json。</p>';
    }
    if (meta) {
      meta.innerHTML = '<p class="empty">无法读取文章元信息。</p>';
    }
    if (contentRoot) {
      contentRoot.innerHTML = '<p class="empty">无法展示文章内容。</p>';
    }
    showCatalog();
  }
};

setupInteractions();
loadBlogPage();
