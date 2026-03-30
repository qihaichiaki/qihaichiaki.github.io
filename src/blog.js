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
const isNarrowScreen = () => window.matchMedia("(max-width: 1180px)").matches;

const state = {
  posts: [],
  activeFile: urlParams.get("post") || "",
  leftCollapsed: isNarrowScreen(),
  rightCollapsed: isNarrowScreen(),
  tocObserver: null
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

const setLeftCollapsed = (collapsed) => {
  const rail = document.querySelector("#blog-left-rail");
  const toggle = document.querySelector("#toggle-left-rail");
  if (!rail || !toggle) return;

  state.leftCollapsed = collapsed;
  rail.classList.toggle("is-collapsed", collapsed);

  toggle.setAttribute("aria-label", collapsed ? "展开文章目录" : "收起文章目录");
  toggle.innerHTML = `<span aria-hidden="true">${collapsed ? "▶" : "◀"}</span>`;
};

const setRightCollapsed = (collapsed) => {
  const rail = document.querySelector("#blog-right-rail");
  const toggle = document.querySelector("#toggle-right-rail");
  if (!rail || !toggle) return;

  state.rightCollapsed = collapsed;
  rail.classList.toggle("is-collapsed", collapsed);

  toggle.setAttribute("aria-label", collapsed ? "展开文章内目录" : "收起文章内目录");
  toggle.innerHTML = `<span aria-hidden="true">${collapsed ? "◀" : "▶"}</span>`;
};

const syncUrl = () => {
  const url = new URL(window.location.href);
  if (state.activeFile) {
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

const setActivePostButton = (buttons, file) => {
  buttons.forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.file === file);
  });
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

const clearTocObserver = () => {
  if (state.tocObserver) {
    state.tocObserver.disconnect();
    state.tocObserver = null;
  }
};

const renderArticleToc = (headings) => {
  const tocRoot = document.querySelector("#article-toc");
  if (!tocRoot) return;

  const visibleHeadings = headings.filter((item) => item.level <= 3);
  if (!visibleHeadings.length) {
    tocRoot.innerHTML = '<p class="toc-empty">当前文章没有可提取的标题目录。</p>';
    clearTocObserver();
    return;
  }

  tocRoot.innerHTML = visibleHeadings
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

const renderPostContent = async (post, buttons) => {
  const contentRoot = document.querySelector("#blog-content");
  if (!contentRoot) return;

  try {
    const resp = await fetch(`./content/posts/${post.file}`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

    const markdown = await resp.text();
    const rendered = parseMarkdown(markdown);

    contentRoot.innerHTML = rendered.html;
    setActivePostButton(buttons, post.file);
    renderPostMeta(post, calcReadMinutes(markdown));
    renderArticleToc(rendered.headings);
    bindArticleTocObserver();

    state.activeFile = post.file;
    syncUrl();
    document.title = `${post.title} | qihai的世界`;
  } catch {
    contentRoot.innerHTML = '<p class="empty">文章加载失败，请检查 md 文件路径。</p>';
    renderArticleToc([]);
  }
};

const renderGroupedPostList = async () => {
  const listRoot = document.querySelector("#blog-list");
  const contentRoot = document.querySelector("#blog-content");
  if (!listRoot || !contentRoot) return;

  if (!state.posts.length) {
    listRoot.innerHTML = '<p class="empty">暂无文章，请先新增 md 文件。</p>';
    contentRoot.innerHTML = '<p class="empty">暂无可阅读内容。</p>';
    return;
  }

  const grouped = groupPostsByModule(state.posts);
  const current = state.posts.find((item) => item.file === state.activeFile) || state.posts[0];
  state.activeFile = current.file;

  listRoot.innerHTML = grouped
    .map(
      ([module, posts]) => `
      <section class="module-group">
        <h3 class="module-title">${escapeText(module)}</h3>
        <div class="module-posts">
          ${posts
            .map(
              (post) => `
              <button class="post-btn ${post.file === state.activeFile ? "is-active" : ""}" data-file="${escapeText(post.file)}">
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

  const buttons = Array.from(listRoot.querySelectorAll(".post-btn"));
  await renderPostContent(current, buttons);

  buttons.forEach((btn) => {
    btn.addEventListener("click", async () => {
      const post = state.posts.find((item) => item.file === btn.dataset.file);
      if (!post) return;

      await renderPostContent(post, buttons);
      if (isNarrowScreen()) {
        setLeftCollapsed(true);
        setRightCollapsed(true);
      }
    });
  });
};

const setupRailToggle = () => {
  const leftToggle = document.querySelector("#toggle-left-rail");
  const rightToggle = document.querySelector("#toggle-right-rail");

  if (leftToggle) {
    leftToggle.addEventListener("click", () => {
      setLeftCollapsed(!state.leftCollapsed);
    });
  }

  if (rightToggle) {
    rightToggle.addEventListener("click", () => {
      setRightCollapsed(!state.rightCollapsed);
    });
  }

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      setLeftCollapsed(true);
      setRightCollapsed(true);
    }
  });
};

const loadBlogPage = async () => {
  try {
    const resp = await fetch("./content/posts/index.json");
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

    state.posts = await resp.json();

    setLeftCollapsed(state.leftCollapsed);
    setRightCollapsed(state.rightCollapsed);
    await renderGroupedPostList();
  } catch {
    const listRoot = document.querySelector("#blog-list");
    const meta = document.querySelector("#blog-meta");
    const contentRoot = document.querySelector("#blog-content");
    const tocRoot = document.querySelector("#article-toc");

    if (listRoot) {
      listRoot.innerHTML = '<p class="empty">博客索引读取失败，请检查 content/posts/index.json。</p>';
    }
    if (meta) {
      meta.innerHTML = '<p class="empty">无法读取文章元信息。</p>';
    }
    if (contentRoot) {
      contentRoot.innerHTML = '<p class="empty">无法展示文章内容。</p>';
    }
    if (tocRoot) {
      tocRoot.innerHTML = '<p class="toc-empty">目录暂不可用。</p>';
    }
  }
};

setupRailToggle();
loadBlogPage();
