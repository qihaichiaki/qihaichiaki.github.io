import { blogPage } from "./components/blogPage.js";
import { parseMarkdown } from "./lib/markdown.js";

document.querySelector("#app").innerHTML = blogPage();
document.body.classList.add("blog-page");

const revealNodes = document.querySelectorAll(".reveal");
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("in");
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.22 }
);

revealNodes.forEach((node) => observer.observe(node));

const urlParams = new URLSearchParams(window.location.search);

const state = {
  posts: [],
  activeModule: urlParams.get("module") || "全部",
  activeFile: urlParams.get("post") || "",
  railCollapsed: true
};

const calcReadMinutes = (markdown) => {
  const chars = markdown.replace(/\s/g, "").length;
  return Math.max(1, Math.round(chars / 480));
};

const getModuleOf = (post) => post.module || "杂记";
const getModules = () => ["全部", ...new Set(state.posts.map(getModuleOf))];
const getVisiblePosts = () =>
  state.activeModule === "全部" ? state.posts : state.posts.filter((post) => getModuleOf(post) === state.activeModule);

const setRailCollapsed = (collapsed) => {
  const layout = document.querySelector("#blog-layout");
  const toggle = document.querySelector("#toggle-rail");
  if (!layout || !toggle) return;

  state.railCollapsed = collapsed;
  layout.classList.toggle("is-collapsed", collapsed);
  toggle.textContent = collapsed ? "展开目录" : "收起目录";
};

const renderModuleTabs = () => {
  const root = document.querySelector("#blog-modules");
  if (!root) return;

  const modules = getModules();
  if (!modules.length) {
    root.innerHTML = "";
    return;
  }

  root.innerHTML = modules
    .map(
      (module) => `
      <button class="module-btn ${module === state.activeModule ? "is-active" : ""}" data-module="${module}">
        ${module}
      </button>
    `
    )
    .join("");

  root.querySelectorAll(".module-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      state.activeModule = btn.dataset.module || "全部";
      renderModuleTabs();
      await renderBlogListAndContent();
      setRailCollapsed(true);
    });
  });
};

const setActive = (buttons, file) => {
  buttons.forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.file === file);
  });
};

const renderPostMeta = (post, minutes) => {
  const meta = document.querySelector("#blog-meta");
  if (!meta) return;

  meta.innerHTML = `
    <p class="meta-kicker">${getModuleOf(post).toUpperCase()}</p>
    <h2>${post.title}</h2>
    <div class="meta-row">
      <span>${post.date}</span>
      <span>${minutes} 分钟阅读</span>
      <span>${post.file}</span>
    </div>
    ${post.summary ? `<p class="meta-summary">${post.summary}</p>` : ""}
  `;
};

const syncUrl = () => {
  const url = new URL(window.location.href);
  url.searchParams.set("module", state.activeModule);
  if (state.activeFile) {
    url.searchParams.set("post", state.activeFile);
  }
  window.history.replaceState(null, "", url.toString());
};

const renderPostContent = async (post, buttons) => {
  const contentRoot = document.querySelector("#blog-content");
  if (!contentRoot) return;

  try {
    const resp = await fetch(`./content/posts/${post.file}`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

    const markdown = await resp.text();
    contentRoot.innerHTML = parseMarkdown(markdown);
    setActive(buttons, post.file);
    renderPostMeta(post, calcReadMinutes(markdown));

    state.activeFile = post.file;
    syncUrl();
    document.title = `${post.title} | qihai的世界`;
  } catch {
    contentRoot.innerHTML = '<p class="empty">文章加载失败，请检查 md 文件路径。</p>';
  }
};

const renderBlogListAndContent = async () => {
  const listRoot = document.querySelector("#blog-list");
  const contentRoot = document.querySelector("#blog-content");

  if (!listRoot || !contentRoot) return;

  const posts = getVisiblePosts();
  if (!posts.length) {
    listRoot.innerHTML = '<p class="empty">该模块下暂无文章。</p>';
    contentRoot.innerHTML = '<p class="empty">请选择其他模块查看内容。</p>';
    return;
  }

  const current = posts.find((post) => post.file === state.activeFile) || posts[0];
  state.activeFile = current.file;

  listRoot.innerHTML = posts
    .map(
      (post) => `
      <button class="post-btn ${post.file === state.activeFile ? "is-active" : ""}" data-file="${post.file}">
        <strong>${post.title}</strong>
        <span>${post.date}</span>
        <em>${post.summary || ""}</em>
      </button>
    `
    )
    .join("");

  const buttons = Array.from(listRoot.querySelectorAll(".post-btn"));
  await renderPostContent(current, buttons);

  buttons.forEach((btn) => {
    btn.addEventListener("click", async () => {
      const post = posts.find((item) => item.file === btn.dataset.file);
      if (post) {
        await renderPostContent(post, buttons);
        setRailCollapsed(true);
      }
    });
  });
};

const loadBlogPage = async () => {
  try {
    const resp = await fetch("./content/posts/index.json");
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

    state.posts = await resp.json();

    const modules = getModules();
    if (!modules.includes(state.activeModule)) {
      state.activeModule = "全部";
    }

    renderModuleTabs();
    setRailCollapsed(true);
    await renderBlogListAndContent();
  } catch {
    const listRoot = document.querySelector("#blog-list");
    const meta = document.querySelector("#blog-meta");
    const contentRoot = document.querySelector("#blog-content");

    if (listRoot) {
      listRoot.innerHTML = '<p class="empty">博客索引读取失败，请检查 content/posts/index.json</p>';
    }
    if (meta) {
      meta.innerHTML = '<p class="empty">无法读取文章元信息。</p>';
    }
    if (contentRoot) {
      contentRoot.innerHTML = '<p class="empty">无法展示文章内容。</p>';
    }
  }
};

const setupRailToggle = () => {
  const toggle = document.querySelector("#toggle-rail");
  if (!toggle) return;

  toggle.addEventListener("click", () => {
    setRailCollapsed(!state.railCollapsed);
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      setRailCollapsed(true);
    }
  });
};

setupRailToggle();
loadBlogPage();
