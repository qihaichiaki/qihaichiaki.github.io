import { hero } from "./components/hero.js";

document.querySelector("#app").innerHTML = hero();

const GITHUB_USER = "qihaichiaki";

const FALLBACK_COMMITS = [
  { name: "qihaichiaki/qihaichiaki.github.io", url: "https://github.com/qihaichiaki/qihaichiaki.github.io", text: "本地兜底数据" },
  { name: "qihaichiaki/namica", url: "https://github.com/qihaichiaki/namica", text: "本地兜底数据" },
  { name: "qihaichiaki/namica-editor", url: "https://github.com/qihaichiaki/namica-editor", text: "本地兜底数据" }
];

const FALLBACK_STARS = [
  { name: "microsoft/vscode", url: "https://github.com/microsoft/vscode", text: "示例兜底数据" },
  { name: "facebook/react", url: "https://github.com/facebook/react", text: "示例兜底数据" },
  { name: "vitejs/vite", url: "https://github.com/vitejs/vite", text: "示例兜底数据" }
];

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
        await new Promise((resolve) => setTimeout(resolve, 400 * (i + 1)));
      }
    }
  }

  throw lastError;
};

const setRepoList = (containerId, items, emptyText, mapper) => {
  const root = document.querySelector(containerId);
  if (!root) return;

  if (!items.length) {
    root.innerHTML = `<p class="empty">${emptyText}</p>`;
    return;
  }

  root.innerHTML = items
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

const loadRecentCommits = async () => {
  try {
    const events = await fetchJSON(`https://api.github.com/users/${GITHUB_USER}/events/public?per_page=100`, 2);
    const seen = new Set();
    const repos = [];

    for (const event of events) {
      if (event.type !== "PushEvent") continue;

      const repoName = event.repo?.name;
      if (!repoName || seen.has(repoName)) continue;

      seen.add(repoName);
      repos.push({
        name: repoName,
        url: `https://github.com/${repoName}`,
        date: event.created_at,
        commits: event.payload?.commits?.length || 0
      });

      if (repos.length === 3) break;
    }

    if (!repos.length) {
      throw new Error("NO_PUSH_EVENTS");
    }

    setRepoList("#recent-works", repos, "近期没有公开 Push 记录。", (item) => {
      return `${formatDate(item.date)} · 本次提交数 ${item.commits}`;
    });
    return;
  } catch (_) {}

  try {
    const repos = await fetchJSON(`https://api.github.com/users/${GITHUB_USER}/repos?sort=pushed&per_page=3`, 1);
    const mapped = repos.map((repo) => ({
      name: repo.full_name,
      url: repo.html_url,
      text: `${formatDate(repo.pushed_at)} · 由最近推送时间推断`
    }));

    if (!mapped.length) {
      throw new Error("NO_REPOS");
    }

    setRepoList("#recent-works", mapped, "近期没有公开仓库数据。", (item) => item.text);
    return;
  } catch (_) {}

  setRepoList("#recent-works", FALLBACK_COMMITS, "读取 GitHub 提交数据失败。", (item) => item.text);
};

const loadRecentStars = async () => {
  try {
    const stars = await fetchJSON(
      `https://api.github.com/users/${GITHUB_USER}/starred?per_page=3&sort=created&direction=desc`,
      2
    );

    const repos = stars.map((repo) => ({
      name: repo.full_name,
      url: repo.html_url,
      description: repo.description || "暂无仓库描述",
      stars: repo.stargazers_count
    }));

    if (!repos.length) {
      throw new Error("NO_STARS");
    }

    setRepoList("#recent-stars", repos, "近期没有公开 Star 记录。", (item) => {
      return `★ ${item.stars} · ${item.description}`;
    });
    return;
  } catch (_) {}

  setRepoList("#recent-stars", FALLBACK_STARS, "读取 GitHub Star 数据失败。", (item) => item.text);
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
            <p>${post.date} · ${post.summary || ""}</p>
          </div>
        </a>
      `
      )
      .join("");
  } catch (error) {
    root.innerHTML = '<p class="empty">博客索引读取失败，请检查 content/posts/index.json</p>';
  }
};

setScrollShift();
window.addEventListener("scroll", setScrollShift, { passive: true });
loadRecentCommits();
loadRecentStars();
loadRecentPosts();
