import { hero } from "./components/hero.js";
import { siteHeader } from "./components/siteHeader.js";
import { initNebulaBackground } from "./lib/nebulaBackground.js";
import { initHeroMagicCircle } from "./lib/magicCircle.js";
import { initSiteHeaderAuth } from "./lib/siteHeaderAuth.js";
import { fetchRemoteBoard, hasRemoteApi } from "./lib/tasksApi.js";
import { normalizeBoard } from "./lib/tasksModel.js";

document.querySelector("#app").innerHTML = renderPageWithHeader(hero(), { homeHref: "#top", currentPage: "home" });
mountHomeTaskPreviewSection();
const headerStatePromise = initSiteHeaderAuth();
initNebulaBackground();
initHeroMagicCircle();

const GITHUB_USER = "qihaichiaki";

const CACHE_POLICY = {
  commits: {
    key: "qihai_cache_commits_v1",
    ttlMs: 1000 * 60 * 60
  },
  stars: {
    key: "qihai_cache_stars_v1",
    ttlMs: 1000 * 60 * 60 * 2
  }
};

function renderPageWithHeader(markup, headerOptions) {
  return `${siteHeader(headerOptions)}${String(markup || "").replace(/^\s*<header class="site-header">[\s\S]*?<\/header>\s*/, "")}`;
}

function mountHomeTaskPreviewSection() {
  if (document.querySelector("#home-task-board-preview")) {
    return;
  }

  const anchorSection = document.querySelector("#works") || document.querySelector("#contact");
  if (!anchorSection) {
    return;
  }

  const section = document.createElement("section");
  section.id = "task-board-preview-section";
  section.className = "section reveal";
  section.innerHTML = `
    <div class="home-tasks-head">
      <div>
        <p class="section-tag">TASK BOARD</p>
        <h2>任务板概览</h2>
        <p class="tasks-preview-lead">展示仓库中的当前任务板快照；进入任务板页后再做编辑与同步。</p>
      </div>
      <a class="btn btn-sub" href="./tasks.html">打开任务板</a>
    </div>
    <div id="home-task-board-preview" class="home-task-board-preview">
      <p class="loading">正在读取任务板...</p>
    </div>
  `;

  anchorSection.insertAdjacentElement("beforebegin", section);
}

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

const setScrollShift = () => {
  const shift = Math.min(window.scrollY * 0.12, 40);
  document.documentElement.style.setProperty("--sky-shift", `${shift}px`);
};

const formatDate = (iso) => {
  if (!iso) return "";
  const date = new Date(iso);
  return date.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
};

const formatDateTime = (iso) => {
  if (!iso) return "";
  const date = new Date(iso);
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
};

const trimText = (text, max = 90) => {
  const value = String(text || "");
  if (value.length <= max) return value;
  return `${value.slice(0, max)}...`;
};

const escapeText = (value) =>
  String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const readCache = (policy) => {
  try {
    const raw = localStorage.getItem(policy.key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.items)) return null;

    const savedAt = parsed.savedAt || "";
    const ageMs = savedAt ? Date.now() - new Date(savedAt).getTime() : Number.MAX_SAFE_INTEGER;

    return {
      items: parsed.items,
      savedAt,
      fresh: ageMs >= 0 && ageMs < policy.ttlMs
    };
  } catch {
    return null;
  }
};

const writeCache = (policy, items) => {
  try {
    localStorage.setItem(
      policy.key,
      JSON.stringify({
        savedAt: new Date().toISOString(),
        items
      })
    );
  } catch {
    // ignore storage errors
  }
};

const fetchJSON = async (url, retries = 1) => {
  let lastError = null;

  for (let i = 0; i <= retries; i += 1) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const resp = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (!resp.ok) {
        let message = `HTTP ${resp.status}`;
        try {
          const data = await resp.json();
          if (typeof data?.message === "string" && data.message) {
            message = data.message;
          }
        } catch {
          // ignore parse errors
        }
        const error = new Error(message);
        error.status = resp.status;
        throw error;
      }

      return resp.json();
    } catch (error) {
      lastError = error;
      if (i < retries) {
        await new Promise((resolve) => setTimeout(resolve, 450 * (i + 1)));
      }
    }
  }

  throw lastError;
};

const setRepoList = (containerId, items, emptyText, mapper, note = "") => {
  const root = document.querySelector(containerId);
  if (!root) return;

  if (!items.length) {
    root.innerHTML = `<p class="empty">${emptyText}</p>`;
    return;
  }

  const noteHtml = note ? `<p class="cache-note">${note}</p>` : "";

  root.innerHTML =
    noteHtml +
    items
      .map(
        (item, index) => `
      <a class="repo-item" href="${item.url}" target="_blank" rel="noreferrer">
        <span class="repo-index">${String(index + 1).padStart(2, "0")}</span>
        <div class="repo-main">
          <strong>${item.name}</strong>
          <p>${mapper(item)}</p>
        </div>
      </a>
    `
      )
      .join("");
};

const setRepoError = (containerId, title, error) => {
  const root = document.querySelector(containerId);
  if (!root) return;

  const message = String(error?.message || "");
  const rateLimited = message.toLowerCase().includes("rate limit");
  const detail = rateLimited ? "当前触发 GitHub API 频率限制，请稍后刷新。" : `错误信息：${message || "网络异常"}`;

  root.innerHTML = `
    <p class="empty">${title}</p>
    <p class="cache-note">${detail}</p>
  `;
};

const fetchRecentCommitItems = async () => {
  try {
    const events = await fetchJSON(`https://api.github.com/users/${GITHUB_USER}/events/public?per_page=100`, 2);
    const seen = new Set();
    const items = [];

    for (const event of events) {
      if (event.type !== "PushEvent") continue;
      const repoName = event.repo?.name;
      if (!repoName || seen.has(repoName)) continue;

      seen.add(repoName);
      items.push({
        name: repoName,
        url: `https://github.com/${repoName}`,
        text: `${formatDate(event.created_at)} · 本次提交数 ${event.payload?.commits?.length || 0}`
      });

      if (items.length === 3) break;
    }

    if (items.length < 3) {
      const repos = await fetchJSON(`https://api.github.com/users/${GITHUB_USER}/repos?sort=pushed&per_page=6`, 1);
      for (const repo of repos) {
        if (!repo?.full_name || seen.has(repo.full_name)) continue;
        seen.add(repo.full_name);
        items.push({
          name: repo.full_name,
          url: repo.html_url,
          text: `${formatDate(repo.pushed_at)} · 按最近推送时间`
        });
        if (items.length === 3) break;
      }
    }

    if (items.length) return items;
    throw new Error("NO_PUSH_EVENTS");
  } catch {
    const repos = await fetchJSON(`https://api.github.com/users/${GITHUB_USER}/repos?sort=pushed&per_page=3`, 1);
    const mapped = repos.map((repo) => ({
      name: repo.full_name,
      url: repo.html_url,
      text: `${formatDate(repo.pushed_at)} · 按最近推送时间`
    }));

    if (!mapped.length) {
      throw new Error("NO_REPOS");
    }

    return mapped;
  }
};

const fetchRecentStarItems = async () => {
  const stars = await fetchJSON(
    `https://api.github.com/users/${GITHUB_USER}/starred?per_page=3&sort=created&direction=desc`,
    2
  );

  const mapped = stars.map((repo) => ({
    name: repo.full_name,
    url: repo.html_url,
    text: `★ ${repo.stargazers_count} · ${trimText(repo.description || "暂无仓库描述", 72)}`
  }));

  if (!mapped.length) {
    throw new Error("NO_STARS");
  }

  return mapped;
};

const loadRecentCommits = async () => {
  const cache = readCache(CACHE_POLICY.commits);

  if (cache?.items?.length) {
    setRepoList(
      "#recent-works",
      cache.items,
      "近期没有公开提交记录。",
      (item) => item.text,
      cache.fresh ? `已使用缓存 · ${formatDateTime(cache.savedAt)}` : `缓存数据 · ${formatDateTime(cache.savedAt)}`
    );
    if (cache.fresh) return;
  }

  let fetchError = null;
  try {
    const items = await fetchRecentCommitItems();
    writeCache(CACHE_POLICY.commits, items);
    setRepoList("#recent-works", items, "近期没有公开提交记录。", (item) => item.text);
    return;
  } catch (error) {
    fetchError = error;
  }

  if (cache?.items?.length) {
    setRepoList(
      "#recent-works",
      cache.items,
      "近期没有公开提交记录。",
      (item) => item.text,
      `网络不可用，已显示缓存 · ${formatDateTime(cache.savedAt)}`
    );
    return;
  }

  setRepoError("#recent-works", "读取 GitHub 提交数据失败。", fetchError);
};

const loadRecentStars = async () => {
  const cache = readCache(CACHE_POLICY.stars);

  if (cache?.items?.length) {
    setRepoList(
      "#recent-stars",
      cache.items,
      "近期没有公开 Star 记录。",
      (item) => item.text,
      cache.fresh ? `已使用缓存 · ${formatDateTime(cache.savedAt)}` : `缓存数据 · ${formatDateTime(cache.savedAt)}`
    );
    if (cache.fresh) return;
  }

  let fetchError = null;
  try {
    const items = await fetchRecentStarItems();
    writeCache(CACHE_POLICY.stars, items);
    setRepoList("#recent-stars", items, "近期没有公开 Star 记录。", (item) => item.text);
    return;
  } catch (error) {
    fetchError = error;
  }

  if (cache?.items?.length) {
    setRepoList(
      "#recent-stars",
      cache.items,
      "近期没有公开 Star 记录。",
      (item) => item.text,
      `网络不可用，已显示缓存 · ${formatDateTime(cache.savedAt)}`
    );
    return;
  }

  setRepoError("#recent-stars", "读取 GitHub Star 数据失败。", fetchError);
};

const loadRecentPosts = async () => {
  const root = document.querySelector("#recent-posts");
  if (!root) return;

  try {
    const resp = await fetch("./content/posts/index.json");
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

    const posts = await resp.json();
    const latest = posts.slice(0, 3);

    if (!latest.length) {
      root.innerHTML = '<p class="empty">暂无本地文章，请上传 md 并更新索引。</p>';
      return;
    }

    root.innerHTML = latest
      .map(
        (post, idx) => `
        <a class="repo-item" href="./blog.html?post=${encodeURIComponent(post.file)}">
          <span class="repo-index">${String(idx + 1).padStart(2, "0")}</span>
          <div class="repo-main">
            <strong>${post.title}</strong>
            <p><span class="post-module-tag">${post.module || "杂记"}</span> ${post.date} · ${post.summary || ""}</p>
          </div>
        </a>
      `
      )
      .join("");
  } catch {
    root.innerHTML = '<p class="empty">博客索引读取失败，请检查 content/posts/index.json</p>';
  }
};

const renderTaskPreview = (board) => {
  const root = document.querySelector("#home-task-board-preview");
  if (!root) return;

  const normalizedBoard = normalizeBoard(board);
  const taskMap = new Map(normalizedBoard.tasks.map((task) => [task.id, task]));

  root.innerHTML = `
    <div class="tasks-board-columns tasks-board-columns-preview">
      ${normalizedBoard.columns
        .map((column) => {
          const cards = column.taskIds
            .map((taskId) => taskMap.get(taskId))
            .filter(Boolean)
            .map(
              (task) => `
                <article class="task-card task-card-preview">
                  <h3>${escapeText(task.title)}</h3>
                  <p>${escapeText(task.description || "暂无任务说明。")}</p>
                  <div class="task-tags">
                    ${
                      task.tags.length
                        ? task.tags.map((tag) => `<span class="task-chip">${escapeText(tag)}</span>`).join("")
                        : '<span class="task-chip task-chip-muted">未设置标签</span>'
                    }
                  </div>
                </article>
              `
            )
            .join("");

          return `
            <section class="task-column task-column-preview" data-column-id="${escapeText(column.id)}">
              <header class="task-column-head">
                <div>
                  <p class="section-tag">${escapeText(column.id.toUpperCase())}</p>
                  <h3>${escapeText(column.title)}</h3>
                </div>
                <span class="task-column-count">${column.taskIds.length}</span>
              </header>
              <div class="task-column-body">
                ${cards || '<p class="task-column-empty">当前列还没有任务。</p>'}
              </div>
            </section>
          `;
        })
        .join("")}
    </div>
  `;
};

const loadTaskPreview = async () => {
  const root = document.querySelector("#home-task-board-preview");
  if (!root) return;

  try {
    const headerState = await headerStatePromise;
    let board = null;

    if (hasRemoteApi(headerState?.config)) {
      try {
        const remoteBoard = await fetchRemoteBoard(headerState.config);
        board = remoteBoard?.board || null;
      } catch {
        board = null;
      }
    }

    if (!board) {
      const response = await fetch("./content/tasks/board.json", { cache: "no-cache" });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      board = await response.json();
    }

    renderTaskPreview(board);
  } catch {
    root.innerHTML = '<p class="empty">任务板快照读取失败，请检查 content/tasks/board.json。</p>';
  }
};

setScrollShift();
window.addEventListener("scroll", setScrollShift, { passive: true });
loadRecentCommits();
loadRecentStars();
loadRecentPosts();
loadTaskPreview();
