import { hero } from "./components/hero.js";

document.querySelector("#app").innerHTML = hero();

const GITHUB_USER = "qihaichiaki";

const FALLBACK_COMMITS = [
  { name: "qihaichiaki/qihaichiaki.github.io", url: "https://github.com/qihaichiaki/qihaichiaki.github.io", text: "离线记录" },
  { name: "qihaichiaki/namica", url: "https://github.com/qihaichiaki/namica", text: "离线记录" },
  { name: "qihaichiaki/namica-editor", url: "https://github.com/qihaichiaki/namica-editor", text: "离线记录" }
];

const FALLBACK_STARS = [
  { name: "microsoft/vscode", url: "https://github.com/microsoft/vscode", text: "离线记录" },
  { name: "facebook/react", url: "https://github.com/facebook/react", text: "离线记录" },
  { name: "vitejs/vite", url: "https://github.com/vitejs/vite", text: "离线记录" }
];

const CACHE_POLICY = {
  commits: {
    key: "qihai_cache_commits_v1",
    ttlMs: 1000 * 60 * 60 * 6
  },
  stars: {
    key: "qihai_cache_stars_v1",
    ttlMs: 1000 * 60 * 60 * 6
  }
};

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
      const resp = await fetch(url, {
        headers: {
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28"
        },
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
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
    text: `★ ${repo.stargazers_count} · ${repo.description || "暂无仓库描述"}`
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

  try {
    const items = await fetchRecentCommitItems();
    writeCache(CACHE_POLICY.commits, items);
    setRepoList("#recent-works", items, "近期没有公开提交记录。", (item) => item.text);
    return;
  } catch {}

  if (!cache?.items?.length) {
    setRepoList("#recent-works", FALLBACK_COMMITS, "读取 GitHub 提交数据失败。", (item) => item.text, "网络不可用，暂用离线记录");
  }
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

  try {
    const items = await fetchRecentStarItems();
    writeCache(CACHE_POLICY.stars, items);
    setRepoList("#recent-stars", items, "近期没有公开 Star 记录。", (item) => item.text);
    return;
  } catch {}

  if (!cache?.items?.length) {
    setRepoList("#recent-stars", FALLBACK_STARS, "读取 GitHub Star 数据失败。", (item) => item.text, "网络不可用，暂用离线记录");
  }
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

setScrollShift();
window.addEventListener("scroll", setScrollShift, { passive: true });
loadRecentCommits();
loadRecentStars();
loadRecentPosts();
