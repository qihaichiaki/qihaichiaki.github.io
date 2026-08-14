import { blogPage } from "./components/blogPage.js";
import { siteHeader } from "./components/siteHeader.js";
import { parseMarkdown } from "./lib/markdown.js";
import { initNebulaBackground } from "./lib/nebulaBackground.js";
import { fetchRemotePosts, pushRemotePost } from "./lib/postsApi.js";
import { deletePostDraft, listPostDrafts, savePostDraft } from "./lib/postDraftsStore.js";
import { initSiteHeaderAuth } from "./lib/siteHeaderAuth.js";

document.querySelector("#app").innerHTML = renderPageWithHeader(blogPage(), {
  homeHref: "./index.html#top",
  currentPage: "blog"
});
document.body.classList.add("blog-page");
initNebulaBackground();

function renderPageWithHeader(markup, headerOptions) {
  return `${siteHeader(headerOptions)}${String(markup || "").replace(/^\s*<header class="site-header">[\s\S]*?<\/header>\s*/, "")}`;
}

const urlParams = new URLSearchParams(window.location.search);
const state = {
  posts: [],
  activeFile: urlParams.get("post") || "",
  activeMarkdown: "",
  view: urlParams.get("post") ? "detail" : "catalog",
  previousView: "catalog",
  tocCollapsed: window.matchMedia("(max-width: 1160px)").matches,
  tocObserver: null,
  previewRaf: 0,
  draftSaveTimer: 0,
  drafts: [],
  draftsLoaded: false,
  editor: {
    mode: "new",
    originalFile: "",
    createdAt: "",
    updatedAt: "",
    currentDraftId: "",
    draftCreatedAt: "",
    draftPending: false,
    draftVersion: 0,
    indexSha: "",
    postSha: "",
    dirty: false,
    loading: false,
    loadFailed: false,
    draftConflict: false,
    saving: false,
    imageBusy: false,
    assetUpserts: [],
    assetDeletes: []
  },
  auth: {
    config: null,
    session: null
  }
};

const escapeText = (value) =>
  String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const getModuleOf = (post) => post.module || "杂记";

const getCreatedAtOf = (post) => String(post?.createdAt || post?.date || "");
const getUpdatedAtOf = (post) => String(post?.updatedAt || getCreatedAtOf(post));

const POST_IMAGE_TYPES = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/gif", "gif"],
  ["image/webp", "webp"]
]);
const MAX_POST_IMAGE_SIZE = 6 * 1024 * 1024;
const MAX_POST_IMAGE_TOTAL_SIZE = 20 * 1024 * 1024;
const MAX_POST_IMAGE_COUNT = 12;
const POST_IMAGE_PATTERN = /!\[([^\]]*)\]\((\S+?)(?:\s+["'][^"']*["'])?\)/g;

const normalizeManagedImagePath = (source) => {
  const value = String(source || "").trim().split(/[?#]/, 1)[0];
  if (/^\.\/content\/posts\/assets\//i.test(value)) {
    return value.slice("./content/posts/".length);
  }
  if (/^\/content\/posts\/assets\//i.test(value)) {
    return value.slice("/content/posts/".length);
  }
  if (/^\.\/assets\//i.test(value)) {
    return value.slice(2);
  }
  return "";
};

const extractMarkdownImages = (markdown) => {
  const images = [];
  String(markdown || "").replace(POST_IMAGE_PATTERN, (raw, alt, source, offset) => {
    images.push({ raw, alt: String(alt || ""), source: String(source || ""), offset });
    return raw;
  });
  return images;
};

const formatPostTimestamp = (value, { short = false } = {}) => {
  const source = String(value || "").trim();
  if (!source) return "";
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(source) ? `${source}T00:00:00` : source);
  if (Number.isNaN(date.getTime())) return source;

  const includeTime = !short && source.includes("T") && !/T00:00:00(?:\.000)?(?:Z|[+-]\d{2}:?\d{2})?$/.test(source);
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    ...(includeTime ? { hour: "2-digit", minute: "2-digit" } : {})
  });
};

const calcReadMinutes = (markdown) => {
  const chars = String(markdown || "").replace(/\s/g, "").length;
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

const canEditPosts = () => Boolean(state.auth.session?.authenticated && state.auth.session?.canEdit && state.auth.config?.apiBaseUrl);

const syncOwnerActions = () => {
  document.querySelectorAll(".blog-owner-action").forEach((element) => {
    element.classList.toggle("is-hidden", !canEditPosts());
  });

  if (!canEditPosts() && state.view === "editor") {
    closeEditor({ force: true });
  }
  if (!canEditPosts() && state.view === "drafts") {
    showCatalog();
  }
};

const syncUrl = () => {
  if (state.view === "editor") return;

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

const setView = (view) => {
  const views = {
    catalog: document.querySelector("#blog-catalog-view"),
    detail: document.querySelector("#blog-detail-view"),
    drafts: document.querySelector("#blog-drafts-view"),
    editor: document.querySelector("#blog-editor-view")
  };
  if (!views.catalog || !views.detail || !views.drafts || !views.editor) return;

  state.view = view;
  Object.entries(views).forEach(([name, element]) => {
    element.classList.toggle("is-hidden", name !== view);
  });

  if (view === "catalog") {
    document.title = "qihai的世界 | Blog";
  } else if (view === "drafts") {
    document.title = "草稿箱 | qihai的世界";
  }

  syncTocBookmark();
  syncArticleTopButton();
  syncUrl();
};

const syncTocBookmark = () => {
  const bookmark = document.querySelector("#toc-bookmark");
  if (!bookmark) return;
  bookmark.classList.toggle("is-visible", state.view === "detail" && state.tocCollapsed);
};

const setTocCollapsed = (collapsed) => {
  const layout = document.querySelector("#blog-reading-layout");
  const stack = document.querySelector("#blog-right-stack");
  const rail = document.querySelector("#blog-right-rail");
  const toggle = document.querySelector("#toggle-right-rail");
  if (!layout || !stack || !rail || !toggle) return;

  state.tocCollapsed = Boolean(collapsed);
  layout.classList.toggle("is-rail-collapsed", state.tocCollapsed);
  stack.classList.toggle("is-collapsed", state.tocCollapsed);
  rail.classList.toggle("is-collapsed", state.tocCollapsed);
  toggle.classList.toggle("is-collapsed", state.tocCollapsed);
  toggle.setAttribute("aria-label", state.tocCollapsed ? "展开文章目录" : "收起文章目录");
  toggle.setAttribute("aria-expanded", String(!state.tocCollapsed));

  const icon = toggle.querySelector(".rail-collapse-icon");
  if (icon) {
    icon.textContent = state.tocCollapsed ? ">" : "<";
  }
  syncTocBookmark();
};

const syncArticleTopButton = () => {
  const button = document.querySelector("#scroll-top-right");
  if (!button) return;

  const visible = state.view === "detail" && window.scrollY > 320;
  button.classList.toggle("is-visible", visible);
  button.setAttribute("aria-hidden", String(!visible));
  button.tabIndex = visible ? 0 : -1;
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
      <span>提交 ${escapeText(formatPostTimestamp(getCreatedAtOf(post)))}</span>
      <span>更新 ${escapeText(formatPostTimestamp(getUpdatedAtOf(post)))}</span>
      <span>${minutes} 分钟阅读</span>
    </div>
    ${post.summary ? `<p class="meta-summary">${escapeText(post.summary)}</p>` : ""}
  `;
};

const renderArticleToc = (headings) => {
  const tocRoot = document.querySelector("#article-toc");
  if (!tocRoot) return;

  const visible = headings.filter((item) => item.level <= 3);
  if (!visible.length) {
    tocRoot.innerHTML = '<p class="toc-empty">本文没有标题层级。</p>';
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

  tocRoot.querySelectorAll(".toc-link").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      const target = document.getElementById(link.dataset.id || "");
      if (!target) return;
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      if (window.matchMedia("(max-width: 780px)").matches) {
        setTocCollapsed(true);
      }
    });
  });
};

const bindArticleTocObserver = () => {
  clearTocObserver();
  const headings = Array.from(document.querySelectorAll("#blog-content h1[id], #blog-content h2[id], #blog-content h3[id]"));
  const links = Array.from(document.querySelectorAll("#article-toc .toc-link"));
  if (!headings.length || !links.length) return;

  const setActive = (id) => {
    links.forEach((link) => {
      const active = link.dataset.id === id;
      link.classList.toggle("is-active", active);
      if (active) {
        link.scrollIntoView({ block: "nearest" });
      }
    });
  };

  setActive(headings[0].id);
  state.tocObserver = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible.length) {
        setActive(visible[0].target.id);
        return;
      }

      const passed = headings.filter((heading) => heading.getBoundingClientRect().top <= 130);
      if (passed.length) {
        setActive(passed[passed.length - 1].id);
      }
    },
    {
      rootMargin: "-90px 0px -68% 0px",
      threshold: [0, 0.2, 1]
    }
  );
  headings.forEach((heading) => state.tocObserver.observe(heading));
};

const syncReadingProgress = () => {
  syncArticleTopButton();
  const progress = document.querySelector("#reading-progress");
  const article = document.querySelector("#blog-content");
  if (!progress || !article || state.view !== "detail") return;

  const articleTop = article.getBoundingClientRect().top + window.scrollY;
  const readableHeight = Math.max(article.scrollHeight - window.innerHeight * 0.55, 1);
  const percent = Math.min(100, Math.max(0, Math.round(((window.scrollY - articleTop + 120) / readableHeight) * 100)));
  progress.textContent = `已阅读 ${percent}%`;
};

const markCatalogActive = () => {
  document.querySelectorAll(".catalog-post-btn").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.file === state.activeFile);
  });
};

const renderCatalog = () => {
  const root = document.querySelector("#blog-catalog");
  const meta = document.querySelector("#blog-catalog-meta");
  if (!root) return;

  if (!state.posts.length) {
    root.innerHTML = '<p class="empty">暂无文章。</p>';
    if (meta) meta.textContent = "0 篇";
    return;
  }

  const groupedPosts = groupPostsByModule(state.posts);
  if (meta) {
    meta.textContent = `${state.posts.length} 篇 · ${groupedPosts.length} 个分类`;
  }

  root.innerHTML = groupedPosts
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
                    <span class="catalog-post-main">
                      <strong>${escapeText(post.title)}</strong>
                      ${post.summary ? `<em>${escapeText(post.summary)}</em>` : ""}
                    </span>
                    <time datetime="${escapeText(getUpdatedAtOf(post))}">${escapeText(formatPostTimestamp(getUpdatedAtOf(post), { short: true }))}</time>
                    <span class="catalog-post-arrow" aria-hidden="true">↗</span>
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

const renderPostContent = async (post, providedMarkdown = null) => {
  const contentRoot = document.querySelector("#blog-content");
  if (!contentRoot) return;

  try {
    let markdown = providedMarkdown;
    if (typeof markdown !== "string") {
      const response = await fetch(`./content/posts/${post.file}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      markdown = await response.text();
    }

    const rendered = parseMarkdown(markdown);
    contentRoot.innerHTML = rendered.html;
    renderPostMeta(post, calcReadMinutes(markdown));
    renderArticleToc(rendered.headings);
    bindArticleTocObserver();

    state.activeFile = post.file;
    state.activeMarkdown = markdown;
    markCatalogActive();
    setView("detail");
    document.title = `${post.title} | qihai的世界`;
    window.requestAnimationFrame(syncReadingProgress);
  } catch {
    contentRoot.innerHTML = '<p class="empty">文章加载失败，请检查 Markdown 文件。</p>';
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

const formatDraftTime = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
};

const syncDraftCount = () => {
  const count = document.querySelector("#draft-count");
  if (count) count.textContent = String(state.drafts.length);
};

const renderDrafts = () => {
  const root = document.querySelector("#post-drafts-list");
  const meta = document.querySelector("#drafts-meta");
  if (!root) return;

  syncDraftCount();
  if (meta) meta.textContent = `${state.drafts.length} 篇草稿`;
  if (!state.drafts.length) {
    root.innerHTML = '<p class="empty">暂无草稿。</p>';
    return;
  }

  root.innerHTML = state.drafts
    .map((draft) => {
      const post = draft.post && typeof draft.post === "object" ? draft.post : {};
      const title = String(post.title || "").trim() || "未命名草稿";
      const type = draft.mode === "edit" ? "编辑文章" : "新文章";
      return `
        <article class="post-draft-row" data-draft-id="${escapeText(draft.id)}">
          <button class="post-draft-open" type="button" data-draft-action="open">
            <strong>${escapeText(title)}</strong>
            <span class="post-draft-meta">
              <span>${type}</span>
              <span>${escapeText(post.module || "杂记")}</span>
              ${getUpdatedAtOf(post) ? `<time datetime="${escapeText(getUpdatedAtOf(post))}">${escapeText(formatPostTimestamp(getUpdatedAtOf(post), { short: true }))}</time>` : ""}
              <span>${escapeText(formatDraftTime(draft.updatedAt))}</span>
            </span>
            ${post.summary ? `<p class="post-draft-summary">${escapeText(post.summary)}</p>` : ""}
          </button>
          <button class="post-draft-remove" type="button" data-draft-action="delete" aria-label="删除草稿：${escapeText(title)}">删除</button>
        </article>
      `;
    })
    .join("");
};

const refreshDrafts = async () => {
  state.drafts = await listPostDrafts();
  state.draftsLoaded = true;
  renderDrafts();
};

const showDrafts = async () => {
  if (!canEditPosts()) return;
  setView("drafts");
  await refreshDrafts();
};

const createDraftId = () => {
  const id = typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `new:${id}`;
};

const setEditorStatus = (message, tone = "") => {
  const status = document.querySelector("#post-editor-status");
  if (!status) return;
  status.textContent = message;
  status.className = `post-editor-status${tone ? ` is-${tone}` : ""}`;
};

const renderEditorVersion = () => {
  const root = document.querySelector("#post-editor-version");
  if (!root) return;
  if (!state.editor.createdAt) {
    root.textContent = "提交时间将在首次同步后生成";
    return;
  }

  root.innerHTML = `
    <span>提交 ${escapeText(formatPostTimestamp(state.editor.createdAt))}</span>
    <span>更新 ${escapeText(formatPostTimestamp(state.editor.updatedAt || state.editor.createdAt))}</span>
  `;
};

const syncEditorBusy = () => {
  const form = document.querySelector("#post-editor-form");
  const saveButton = document.querySelector("#save-post-button");
  const deleteDraftButton = document.querySelector("#delete-current-draft");
  const insertImageButton = document.querySelector("#insert-post-image");
  const busy = state.editor.loading || state.editor.saving || state.editor.imageBusy;
  const unavailable = busy || state.editor.loadFailed;
  if (form) {
    form.setAttribute("aria-busy", String(busy));
    form.querySelectorAll("input, textarea").forEach((control) => {
      control.disabled = unavailable;
    });
  }
  if (saveButton) {
    saveButton.disabled = unavailable || state.editor.draftConflict;
    saveButton.textContent = state.editor.saving ? "正在同步..." : "同步到 GitHub";
  }
  if (deleteDraftButton) {
    const hasSavedDraft = state.drafts.some((draft) => draft.id === state.editor.currentDraftId);
    deleteDraftButton.classList.toggle("is-hidden", !hasSavedDraft);
    deleteDraftButton.disabled = busy;
  }
  if (insertImageButton) {
    insertImageButton.disabled = unavailable;
    insertImageButton.textContent = state.editor.imageBusy ? "处理中..." : "插入图片";
  }
};

const fillModuleOptions = () => {
  const options = document.querySelector("#post-module-options");
  if (!options) return;
  const modules = [...new Set(state.posts.map(getModuleOf))].sort((a, b) => a.localeCompare(b, "zh-CN"));
  options.innerHTML = modules.map((module) => `<option value="${escapeText(module)}"></option>`).join("");
};

const renderEditorPreview = () => {
  const source = document.querySelector("#post-content-input");
  const preview = document.querySelector("#post-preview-content");
  const count = document.querySelector("#post-editor-count");
  if (!source || !preview || !count) return;

  const markdown = source.value;
  count.textContent = `${markdown.replace(/\s/g, "").length} 字`;
  const imageSources = state.editor.assetUpserts.reduce((result, asset) => {
    const sourceUrl = getPostImagePreviewUrl("", asset);
    result[`./content/posts/${asset.path}`] = sourceUrl;
    result[`/content/posts/${asset.path}`] = sourceUrl;
    result[`./${asset.path}`] = sourceUrl;
    result[asset.path] = sourceUrl;
    return result;
  }, {});
  preview.innerHTML = markdown.trim()
    ? parseMarkdown(markdown, { imageSources }).html
    : '<p class="post-preview-empty">预览将在这里显示。</p>';
};

const scheduleEditorPreview = () => {
  if (state.previewRaf) return;
  state.previewRaf = window.requestAnimationFrame(() => {
    state.previewRaf = 0;
    renderEditorPreview();
  });
};

const getPostImagePreviewUrl = (source, asset = null) => {
  if (asset) {
    if (asset.previewUrl) return asset.previewUrl;
    try {
      const binary = atob(String(asset.content || ""));
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
      asset.previewUrl = URL.createObjectURL(new Blob([bytes], { type: asset.mimeType }));
      return asset.previewUrl;
    } catch {
      return "";
    }
  }
  const value = String(source || "").trim();
  if (/^\.\/assets\//i.test(value)) return `./content/posts/${value.slice(2)}`;
  if (/^(?:https?:|\/|\.\/|\.\.\/)/i.test(value) || /^data:image\/(?:png|gif|jpeg|webp);base64,/i.test(value)) return value;
  return "";
};

const releaseEditorImageUrls = () => {
  state.editor.assetUpserts?.forEach((asset) => {
    if (String(asset.previewUrl || "").startsWith("blob:")) URL.revokeObjectURL(asset.previewUrl);
    delete asset.previewUrl;
  });
};

const normalizeAssetDelete = (item) => {
  if (typeof item === "string") return { path: item, markdown: "", alt: "" };
  return {
    path: String(item?.path || ""),
    markdown: String(item?.markdown || ""),
    alt: String(item?.alt || "")
  };
};

const renderEditorImages = () => {
  const root = document.querySelector("#post-image-list");
  const summary = document.querySelector("#post-image-summary");
  const content = document.querySelector("#post-content-input")?.value || "";
  if (!root || !summary) return;

  const images = extractMarkdownImages(content);
  const referencedPaths = new Set(images.map((image) => normalizeManagedImagePath(image.source)).filter(Boolean));
  state.editor.assetDeletes = state.editor.assetDeletes
    .map(normalizeAssetDelete)
    .filter((item) => item.path && !referencedPaths.has(item.path));

  const rows = images.map((image, index) => {
    const path = normalizeManagedImagePath(image.source);
    const asset = path ? state.editor.assetUpserts.find((item) => item.path === path) : null;
    const previewUrl = getPostImagePreviewUrl(image.source, asset);
    const name = image.alt.trim() || image.source.split("/").pop() || "图片";
    const status = asset ? "待上传" : path ? "仓库图片" : "外部图片";
    return `
      <div class="post-image-item" data-image-index="${index}">
        ${previewUrl ? `<img src="${escapeText(previewUrl)}" alt="" />` : '<span class="post-image-placeholder">IMG</span>'}
        <span class="post-image-item-copy">
          <strong>${escapeText(name)}</strong>
          <span>${status}</span>
        </span>
        <button class="post-image-remove" type="button" data-image-action="remove" aria-label="移除图片：${escapeText(name)}">移除</button>
      </div>
    `;
  });

  state.editor.assetUpserts.forEach((asset, index) => {
    if (referencedPaths.has(asset.path)) return;
    const name = String(asset.alt || asset.path.split("/").pop() || "图片");
    rows.push(`
      <div class="post-image-item">
        <img src="${escapeText(getPostImagePreviewUrl("", asset))}" alt="" />
        <span class="post-image-item-copy">
          <strong>${escapeText(name)}</strong>
          <span>未插入</span>
        </span>
        <span class="post-image-item-buttons">
          <button class="post-image-restore" type="button" data-image-action="insert-pending" data-asset-index="${index}">插入</button>
          <button class="post-image-remove" type="button" data-image-action="remove-pending" data-asset-index="${index}">移除</button>
        </span>
      </div>
    `);
  });

  state.editor.assetDeletes.forEach((item, index) => {
    const name = item.alt.trim() || item.path.split("/").pop() || "图片";
    rows.push(`
      <div class="post-image-item is-deleted">
        <span class="post-image-placeholder">IMG</span>
        <span class="post-image-item-copy">
          <strong>${escapeText(name)}</strong>
          <span>待删除</span>
        </span>
        <button class="post-image-restore" type="button" data-image-action="restore" data-delete-index="${index}">撤销</button>
      </div>
    `);
  });

  const pendingCount = state.editor.assetUpserts.length;
  const deleteCount = state.editor.assetDeletes.length;
  summary.textContent = images.length || pendingCount || deleteCount
    ? `${images.length} 张${pendingCount ? ` · ${pendingCount} 待上传` : ""}${deleteCount ? ` · ${deleteCount} 待删除` : ""}`
    : "";
  root.innerHTML = rows.join("");
};

const markEditorChanged = ({ preview = true } = {}) => {
  state.editor.dirty = true;
  state.editor.draftPending = true;
  state.editor.draftVersion += 1;
  if (preview) scheduleEditorPreview();
  renderEditorImages();
  setEditorStatus("有尚未同步的修改");
  scheduleDraftSave();
};

const insertMarkdownAtCursor = (markdown) => {
  const textarea = document.querySelector("#post-content-input");
  if (!textarea) return;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const prefix = start > 0 && textarea.value[start - 1] !== "\n" ? "\n\n" : "";
  const suffix = end < textarea.value.length && textarea.value[end] !== "\n" ? "\n\n" : "\n";
  const insertion = `${prefix}${markdown}${suffix}`;
  textarea.setRangeText(insertion, start, end, "end");
  textarea.focus();
};

const readPostImage = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error("图片读取失败。"));
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      const separator = dataUrl.indexOf(",");
      if (separator < 0) {
        reject(new Error("图片内容无效。"));
        return;
      }
      resolve(dataUrl.slice(separator + 1));
    };
    reader.readAsDataURL(file);
  });

const createPostImagePath = (mimeType) => {
  const extension = POST_IMAGE_TYPES.get(mimeType);
  const id = typeof crypto.randomUUID === "function"
    ? crypto.randomUUID().replaceAll("-", "").slice(0, 18)
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  return `assets/${new Date().toISOString().slice(0, 10)}-${id}.${extension}`;
};

const preparePostImage = async (file) => {
  const mimeType = String(file?.type || "").toLowerCase();
  if (!POST_IMAGE_TYPES.has(mimeType)) throw new Error("仅支持 PNG、JPEG、GIF 和 WebP。");
  if (!file.size || file.size > MAX_POST_IMAGE_SIZE) throw new Error("单张图片不能超过 6 MB。");
  const alt = String(file.name || "图片")
    .replace(/\.[^.]+$/, "")
    .replace(/[\[\]\r\n]/g, " ")
    .trim()
    .slice(0, 80) || "图片";
  return {
    path: createPostImagePath(mimeType),
    mimeType,
    content: await readPostImage(file),
    size: Number(file.size || 0),
    alt
  };
};

const handlePostImageSelection = async (files) => {
  const selected = Array.from(files || []);
  if (!selected.length || state.editor.imageBusy) return;

  const currentTotal = state.editor.assetUpserts.reduce((total, asset) => total + Number(asset.size || 0), 0);
  const selectedTotal = selected.reduce((total, file) => total + Number(file.size || 0), 0);
  if (state.editor.assetUpserts.length + selected.length > MAX_POST_IMAGE_COUNT) {
    setEditorStatus(`每次同步最多上传 ${MAX_POST_IMAGE_COUNT} 张图片。`, "error");
    return;
  }
  if (currentTotal + selectedTotal > MAX_POST_IMAGE_TOTAL_SIZE) {
    setEditorStatus("待上传图片总大小不能超过 20 MB。", "error");
    return;
  }

  state.editor.imageBusy = true;
  setEditorStatus("正在处理图片...");
  syncEditorBusy();
  try {
    const assets = await Promise.all(selected.map(preparePostImage));
    state.editor.assetUpserts.push(...assets);
    const markdown = assets.map((asset) => `![${asset.alt}](./content/posts/${asset.path})`).join("\n\n");
    insertMarkdownAtCursor(markdown);
    markEditorChanged();
  } catch (error) {
    setEditorStatus(error.message || "图片处理失败。", "error");
  } finally {
    state.editor.imageBusy = false;
    const input = document.querySelector("#post-image-input");
    if (input) input.value = "";
    syncEditorBusy();
  }
};

const removeEditorImage = (index) => {
  const textarea = document.querySelector("#post-content-input");
  if (!textarea) return;
  const images = extractMarkdownImages(textarea.value);
  const image = images[index];
  if (!image) return;

  const path = normalizeManagedImagePath(image.source);
  const assetIndex = path ? state.editor.assetUpserts.findIndex((item) => item.path === path) : -1;
  textarea.value = `${textarea.value.slice(0, image.offset)}${textarea.value.slice(image.offset + image.raw.length)}`;
  const stillReferenced = path && extractMarkdownImages(textarea.value).some((item) => normalizeManagedImagePath(item.source) === path);
  if (assetIndex >= 0 && !stillReferenced) {
    const [removed] = state.editor.assetUpserts.splice(assetIndex, 1);
    if (String(removed?.previewUrl || "").startsWith("blob:")) URL.revokeObjectURL(removed.previewUrl);
  } else if (path && !stillReferenced && !state.editor.assetDeletes.some((item) => normalizeAssetDelete(item).path === path)) {
    state.editor.assetDeletes.push({ path, markdown: image.raw, alt: image.alt });
  }
  markEditorChanged();
};

const restoreDeletedImage = (index) => {
  const item = normalizeAssetDelete(state.editor.assetDeletes[index]);
  if (!item.path) return;
  state.editor.assetDeletes.splice(index, 1);
  insertMarkdownAtCursor(item.markdown || `![${item.alt || "图片"}](./content/posts/${item.path})`);
  markEditorChanged();
};

const insertPendingImage = (index) => {
  const asset = state.editor.assetUpserts[index];
  if (!asset) return;
  insertMarkdownAtCursor(`![${asset.alt || "图片"}](./content/posts/${asset.path})`);
  markEditorChanged();
};

const removePendingImage = (index) => {
  if (!state.editor.assetUpserts[index]) return;
  const [removed] = state.editor.assetUpserts.splice(index, 1);
  if (String(removed?.previewUrl || "").startsWith("blob:")) URL.revokeObjectURL(removed.previewUrl);
  markEditorChanged();
};

const setEditorValues = (post) => {
  const fields = {
    title: document.querySelector("#post-title-input"),
    module: document.querySelector("#post-module-input"),
    summary: document.querySelector("#post-summary-input"),
    content: document.querySelector("#post-content-input")
  };
  Object.entries(fields).forEach(([name, field]) => {
    if (field) field.value = String(post[name] || "");
  });
  renderEditorPreview();
  renderEditorImages();
};

const collectEditorPost = () => ({
  title: document.querySelector("#post-title-input")?.value.trim() || "",
  module: document.querySelector("#post-module-input")?.value.trim() || "",
  summary: document.querySelector("#post-summary-input")?.value.trim() || "",
  content: document.querySelector("#post-content-input")?.value || ""
});

const upsertDraftState = (draft) => {
  state.drafts = [draft, ...state.drafts.filter((item) => item.id !== draft.id)].sort((a, b) =>
    String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""))
  );
  renderDrafts();
  syncEditorBusy();
};

const clearDraftSaveTimer = () => {
  if (!state.draftSaveTimer) return;
  window.clearTimeout(state.draftSaveTimer);
  state.draftSaveTimer = 0;
};

const saveCurrentDraft = async ({ silent = false } = {}) => {
  if (!state.editor.currentDraftId || state.editor.loading || state.editor.loadFailed || state.editor.saving) return false;

  clearDraftSaveTimer();
  const savedVersion = state.editor.draftVersion;
  const now = new Date().toISOString();
  const draft = {
    id: state.editor.currentDraftId,
    mode: state.editor.mode,
    originalFile: state.editor.originalFile,
    createdAt: state.editor.draftCreatedAt || now,
    updatedAt: now,
    base: {
      postSha: state.editor.postSha
    },
    metadata: {
      createdAt: state.editor.createdAt,
      updatedAt: state.editor.updatedAt
    },
    post: collectEditorPost(),
    assets: {
      upserts: state.editor.assetUpserts.map(({ path, mimeType, content, size, alt }) => ({ path, mimeType, content, size, alt })),
      deletes: state.editor.assetDeletes
    }
  };

  try {
    await savePostDraft(draft);
    state.editor.draftCreatedAt = draft.createdAt;
    if (state.editor.draftVersion === savedVersion) {
      state.editor.draftPending = false;
    }
    upsertDraftState(draft);
    const editorStatus = document.querySelector("#post-editor-status");
    if (!silent && state.view === "editor" && !editorStatus?.classList.contains("is-error")) {
      setEditorStatus(`草稿已保存 ${formatDraftTime(now)}`, "success");
    }
    if (state.editor.draftPending) {
      scheduleDraftSave();
    }
    return true;
  } catch {
    if (!silent && state.view === "editor") {
      setEditorStatus("草稿保存失败，请暂时不要关闭页面。", "error");
    }
    return false;
  }
};

function scheduleDraftSave() {
  clearDraftSaveTimer();
  state.draftSaveTimer = window.setTimeout(() => {
    state.draftSaveTimer = 0;
    saveCurrentDraft();
  }, 600);
}

const removeDraft = async (id) => {
  await deletePostDraft(id);
  state.drafts = state.drafts.filter((draft) => draft.id !== id);
  renderDrafts();
  syncEditorBusy();
};

const validateEditorPost = (post) => {
  if (!post.title) return "请填写文章标题。";
  if (!post.module) return "请填写文章分类。";
  if (!post.content.trim()) return "请填写 Markdown 正文。";
  const referencedPaths = new Set(extractMarkdownImages(post.content).map((image) => normalizeManagedImagePath(image.source)).filter(Boolean));
  if (state.editor.assetUpserts.some((asset) => !referencedPaths.has(asset.path))) return "有待上传图片尚未插入正文。";
  if (state.editor.assetDeletes.some((item) => referencedPaths.has(normalizeAssetDelete(item).path))) return "待删除图片仍被正文引用。";
  return "";
};

const openEditor = async (mode, { draft = null, returnView = "" } = {}) => {
  if (!canEditPosts()) return;

  releaseEditorImageUrls();

  if (!state.draftsLoaded) {
    await refreshDrafts();
  }

  const restoredDraft = draft || (mode === "edit" ? state.drafts.find((item) => item.mode === "edit" && item.originalFile === state.activeFile) : null);
  const originalFile = mode === "edit" ? String(restoredDraft?.originalFile || state.activeFile || "") : "";
  if (mode === "edit" && !originalFile) return;

  const currentPost = mode === "edit" ? state.posts.find((post) => post.file === originalFile) : null;
  let localPost = null;
  if (currentPost) {
    let content = state.activeFile === originalFile ? state.activeMarkdown : "";
    if (!content) {
      try {
        const response = await fetch(`./content/posts/${originalFile}`, { cache: "no-cache" });
        if (response.ok) content = await response.text();
      } catch {
        // 远端读取失败时仍可显示文章元数据
      }
    }
    localPost = { ...currentPost, content };
  }

  state.previousView = returnView || (["detail", "drafts"].includes(state.view) ? state.view : "catalog");
  state.editor = {
    mode,
    originalFile,
    createdAt: String(restoredDraft?.metadata?.createdAt || getCreatedAtOf(currentPost)),
    updatedAt: String(restoredDraft?.metadata?.updatedAt || getUpdatedAtOf(currentPost)),
    currentDraftId: restoredDraft?.id || (mode === "edit" ? `edit:${originalFile}` : createDraftId()),
    draftCreatedAt: String(restoredDraft?.createdAt || ""),
    draftPending: false,
    draftVersion: 0,
    indexSha: "",
    postSha: "",
    dirty: false,
    loading: true,
    loadFailed: false,
    draftConflict: false,
    saving: false,
    imageBusy: false,
    assetUpserts: Array.isArray(restoredDraft?.assets?.upserts)
      ? restoredDraft.assets.upserts.map(({ path, mimeType, content, size, alt }) => ({ path, mimeType, content, size, alt }))
      : [],
    assetDeletes: Array.isArray(restoredDraft?.assets?.deletes) ? restoredDraft.assets.deletes.map(normalizeAssetDelete) : []
  };
  setView("editor");
  const editorTargetTitle = String(restoredDraft?.post?.title || currentPost?.title || "").trim();
  document.title = `${mode === "edit" && editorTargetTitle ? `编辑：${editorTargetTitle}` : mode === "edit" ? "编辑文章" : "新建文章"} | qihai的世界`;
  document.querySelector("#post-editor-kicker").textContent = mode === "edit" ? "EDIT POST" : "NEW POST";
  document.querySelector("#post-editor-title").textContent = mode === "edit" && editorTargetTitle ? `编辑：${editorTargetTitle}` : mode === "edit" ? "编辑文章" : "新建文章";
  if (restoredDraft?.post) {
    setEditorValues(restoredDraft.post);
  } else if (localPost) {
    setEditorValues(localPost);
  } else {
    setEditorValues({ title: "", module: "杂记", summary: "", content: "" });
  }
  renderEditorVersion();
  setEditorStatus("正在读取 GitHub 最新版本...");
  syncEditorBusy();

  try {
    const remote = await fetchRemotePosts(state.auth.config, mode === "edit" ? originalFile : "");
    state.posts = Array.isArray(remote.posts) ? remote.posts : state.posts;
    state.editor.indexSha = String(remote.indexSha || "");
    const remotePostSha = String(remote.post?.sha || "");
    const draftPostSha = String(restoredDraft?.base?.postSha || "");
    const remoteMetadata = remote.post?.metadata || {};
    const remoteTitle = String(remoteMetadata.title || "").trim();
    if (mode === "edit" && remoteTitle) {
      document.querySelector("#post-editor-title").textContent = `编辑：${remoteTitle}`;
      document.title = `编辑：${remoteTitle} | qihai的世界`;
    }
    state.editor.createdAt = String(restoredDraft?.metadata?.createdAt || getCreatedAtOf(remoteMetadata));
    state.editor.updatedAt = String(restoredDraft?.metadata?.updatedAt || getUpdatedAtOf(remoteMetadata));
    state.editor.postSha = mode === "edit" && draftPostSha ? draftPostSha : remotePostSha;
    state.editor.draftConflict = Boolean(mode === "edit" && draftPostSha && draftPostSha !== remotePostSha);
    renderCatalog();
    fillModuleOptions();

    if (restoredDraft?.post) {
      setEditorValues(restoredDraft.post);
      state.editor.dirty = true;
      if (state.editor.draftConflict) {
        setEditorStatus("远端文章已变化，此草稿不能直接同步。", "error");
      } else {
        setEditorStatus("已恢复草稿", "success");
      }
    } else if (mode === "edit") {
      setEditorValues({ ...remote.post, ...remote.post.metadata, content: remote.post.content });
      setEditorStatus("已读取远端最新版本", "success");
    } else {
      setEditorValues({
        title: "",
        module: state.posts[0] ? getModuleOf(state.posts[0]) : "杂记",
        summary: "",
        content: "# 文章标题\n\n"
      });
      setEditorStatus("已读取远端最新版本", "success");
    }
    renderEditorVersion();
  } catch (error) {
    state.editor.loadFailed = true;
    const suffix = mode === "edit" && (restoredDraft?.post || localPost?.content) ? "已保留原文章，当前不可同步。" : "";
    setEditorStatus(`读取失败：${error.message}${suffix ? ` ${suffix}` : ""}`, "error");
  } finally {
    state.editor.loading = false;
    syncEditorBusy();
    document.querySelector("#post-title-input")?.focus();
  }
};

async function closeEditor({ force = false, skipDraftSave = false } = {}) {
  if (!skipDraftSave && state.editor.draftPending && !state.editor.loadFailed) {
    const saved = await saveCurrentDraft({ silent: force });
    if (!saved && !force) return;
  }
  clearDraftSaveTimer();
  state.editor.draftPending = false;
  releaseEditorImageUrls();
  const nextView = state.previousView === "detail" && state.activeFile ? "detail" : state.previousView === "drafts" ? "drafts" : "catalog";
  setView(nextView);
  if (nextView === "drafts") {
    renderDrafts();
  }
  if (state.view === "detail") {
    const post = state.posts.find((item) => item.file === state.activeFile);
    document.title = post ? `${post.title} | qihai的世界` : "qihai的世界 | Blog";
  }
}

const deleteCurrentDraft = async () => {
  const id = state.editor.currentDraftId;
  if (!id) return;
  if (!window.confirm("仅删除本地草稿，不会删除 GitHub 中已发布的文章。确定删除吗？")) return;

  clearDraftSaveTimer();
  await removeDraft(id);
  releaseEditorImageUrls();
  state.editor.dirty = false;
  state.editor.draftPending = false;
  await closeEditor({ force: true, skipDraftSave: true });
};

const showSyncToast = (result) => {
  document.querySelector("#blog-sync-toast")?.remove();
  const toast = document.createElement("div");
  toast.id = "blog-sync-toast";
  toast.className = "blog-sync-toast";
  toast.setAttribute("role", "status");
  toast.innerHTML = `
    <strong>已同步到 GitHub</strong>
    ${result.commitUrl ? `<a href="${escapeText(result.commitUrl)}" target="_blank" rel="noreferrer">查看 commit ↗</a>` : ""}
  `;
  document.body.append(toast);
  window.setTimeout(() => toast.classList.add("is-visible"), 20);
  window.setTimeout(() => {
    toast.classList.remove("is-visible");
    window.setTimeout(() => toast.remove(), 220);
  }, 4800);
};

const saveEditorPost = async () => {
  if (!canEditPosts() || state.editor.loading || state.editor.loadFailed || state.editor.saving || state.editor.imageBusy) return;

  const post = collectEditorPost();
  const validationMessage = validateEditorPost(post);
  if (validationMessage) {
    setEditorStatus(validationMessage, "error");
    return;
  }

  state.editor.saving = true;
  setEditorStatus("正在创建 GitHub commit...");
  syncEditorBusy();

  try {
    const result = await pushRemotePost(state.auth.config, {
      post,
      originalFile: state.editor.originalFile,
      base: {
        indexSha: state.editor.indexSha,
        postSha: state.editor.postSha
      },
      assets: {
        upserts: state.editor.assetUpserts.map(({ path, mimeType, content, size, alt }) => ({ path, mimeType, content, size, alt })),
        deletes: state.editor.assetDeletes.map((item) => normalizeAssetDelete(item).path)
      }
    });

    state.posts = Array.isArray(result.posts) ? result.posts : state.posts;
    state.activeFile = result.post?.file || post.file;
    clearDraftSaveTimer();
    releaseEditorImageUrls();
    if (state.editor.currentDraftId) {
      await removeDraft(state.editor.currentDraftId);
    }
    state.editor.dirty = false;
    state.editor.draftPending = false;
    state.editor.currentDraftId = "";
    state.editor.indexSha = String(result.indexSha || "");
    state.editor.postSha = String(result.postSha || "");
    renderCatalog();
    await renderPostContent(result.post || post, result.post?.content || post.content);
    setTocCollapsed(window.matchMedia("(max-width: 1160px)").matches);
    showSyncToast(result);
  } catch (error) {
    const message = error.status === 409 ? "远端文章已经变化，请退出编辑后重新打开。" : `同步失败：${error.message}`;
    setEditorStatus(message, "error");
  } finally {
    state.editor.saving = false;
    syncEditorBusy();
  }
};

const setupInteractions = () => {
  document.querySelector("#blog-catalog")?.addEventListener("click", async (event) => {
    const target = event.target instanceof HTMLElement ? event.target.closest(".catalog-post-btn") : null;
    const file = target?.dataset.file;
    if (file) await openPost(file);
  });

  const backToCatalog = () => {
    showCatalog();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  document.querySelector("#back-to-catalog")?.addEventListener("click", backToCatalog);
  document.querySelector("#open-drafts-button")?.addEventListener("click", showDrafts);
  document.querySelector("#close-drafts-button")?.addEventListener("click", backToCatalog);
  document.querySelector("#new-post-button")?.addEventListener("click", () => openEditor("new"));
  document.querySelector("#edit-post-button")?.addEventListener("click", () => openEditor("edit"));
  document.querySelector("#close-post-editor")?.addEventListener("click", () => closeEditor());
  document.querySelector("#delete-current-draft")?.addEventListener("click", deleteCurrentDraft);
  document.querySelector("#save-post-button")?.addEventListener("click", saveEditorPost);
  document.querySelector("#insert-post-image")?.addEventListener("click", () => {
    document.querySelector("#post-image-input")?.click();
  });
  document.querySelector("#post-image-input")?.addEventListener("change", (event) => {
    handlePostImageSelection(event.target.files);
  });
  document.querySelector("#post-image-list")?.addEventListener("click", (event) => {
    const target = event.target instanceof HTMLElement ? event.target.closest("[data-image-action]") : null;
    if (!target) return;
    if (target.dataset.imageAction === "remove") removeEditorImage(Number(target.closest("[data-image-index]")?.dataset.imageIndex));
    if (target.dataset.imageAction === "restore") restoreDeletedImage(Number(target.dataset.deleteIndex));
    if (target.dataset.imageAction === "insert-pending") insertPendingImage(Number(target.dataset.assetIndex));
    if (target.dataset.imageAction === "remove-pending") removePendingImage(Number(target.dataset.assetIndex));
  });

  document.querySelector("#post-drafts-list")?.addEventListener("click", async (event) => {
    const target = event.target instanceof HTMLElement ? event.target.closest("[data-draft-action]") : null;
    const row = target?.closest(".post-draft-row");
    const draft = state.drafts.find((item) => item.id === row?.dataset.draftId);
    if (!target || !draft) return;

    if (target.dataset.draftAction === "open") {
      await openEditor(draft.mode === "edit" ? "edit" : "new", { draft, returnView: "drafts" });
      return;
    }
    if (target.dataset.draftAction === "delete") {
      const title = String(draft.post?.title || "").trim() || "未命名草稿";
      if (window.confirm(`确定删除草稿“${title}”吗？此操作不会影响 GitHub 中已发布的文章。`)) {
        await removeDraft(draft.id);
      }
    }
  });

  document.querySelector("#toggle-right-rail")?.addEventListener("click", () => {
    setTocCollapsed(!state.tocCollapsed);
  });
  document.querySelector("#toc-bookmark")?.addEventListener("click", () => setTocCollapsed(false));
  document.querySelector("#scroll-top-right")?.addEventListener("click", () => {
    const button = document.querySelector("#scroll-top-right");
    button?.classList.remove("is-jumping");
    window.requestAnimationFrame(() => button?.classList.add("is-jumping"));
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  const form = document.querySelector("#post-editor-form");
  form?.addEventListener("input", (event) => {
    const target = event.target;
    if (target?.id === "post-image-input") return;
    markEditorChanged({ preview: target?.id === "post-content-input" });
  });
  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    saveEditorPost();
  });

  window.addEventListener("scroll", syncReadingProgress, { passive: true });
  window.addEventListener("resize", syncReadingProgress);
  window.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s" && state.view === "editor") {
      event.preventDefault();
      saveEditorPost();
      return;
    }
    if (event.key === "Escape") {
      if (state.view === "editor") {
        closeEditor();
      } else if (state.view === "detail") {
        setTocCollapsed(true);
      }
    }
  });
  window.addEventListener("beforeunload", (event) => {
    if (!state.editor.draftPending) return;
    event.preventDefault();
    event.returnValue = "";
  });
};

const loadBlogPage = async () => {
  const catalogRoot = document.querySelector("#blog-catalog");
  const contentRoot = document.querySelector("#blog-content");
  const meta = document.querySelector("#blog-meta");

  try {
    const response = await fetch("./content/posts/index.json", { cache: "no-cache" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.posts = await response.json();
    renderCatalog();
    fillModuleOptions();
    setTocCollapsed(state.tocCollapsed);

    if (state.activeFile && state.posts.some((post) => post.file === state.activeFile)) {
      await openPost(state.activeFile);
    } else {
      showCatalog();
    }
  } catch {
    if (catalogRoot) catalogRoot.innerHTML = '<p class="empty">博客索引读取失败。</p>';
    if (meta) meta.innerHTML = '<p class="empty">无法读取文章信息。</p>';
    if (contentRoot) contentRoot.innerHTML = '<p class="empty">无法展示文章内容。</p>';
    showCatalog();
  }
};

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
document.querySelectorAll(".reveal").forEach((node) => revealObserver.observe(node));

setupInteractions();
loadBlogPage();
initSiteHeaderAuth({
  onSessionChange: ({ config, session }) => {
    state.auth = { config, session };
    syncOwnerActions();
    if (canEditPosts()) refreshDrafts();
  }
}).then(({ config, session }) => {
  state.auth = { config, session };
  syncOwnerActions();
  if (canEditPosts()) refreshDrafts();
});
