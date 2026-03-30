import { hero } from "./components/hero.js";
import { parseMarkdown } from "./lib/markdown.js";

document.querySelector("#app").innerHTML = hero();

const GITHUB_USER = "qihaichiaki";

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

const fetchJSON = async (url) => {
  const resp = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json"
    }
  });

  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status}`);
  }

  return resp.json();
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
    const events = await fetchJSON(`https://api.github.com/users/${GITHUB_USER}/events/public?per_page=100`);
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

    setRepoList("#recent-works", repos, "近期没有公开 Push 记录。", (item) => {
      const date = formatDate(item.date);
      return `${date} · 本次提交数 ${item.commits}`;
    });
  } catch (error) {
    setRepoList("#recent-works", [], "读取 GitHub 提交数据失败，请稍后刷新重试。", () => "");
  }
};

const loadRecentStars = async () => {
  try {
    const stars = await fetchJSON(
      `https://api.github.com/users/${GITHUB_USER}/starred?per_page=3&sort=created&direction=desc`
    );

    const repos = stars.map((repo) => ({
      name: repo.full_name,
      url: repo.html_url,
      description: repo.description || "暂无仓库描述",
      stars: repo.stargazers_count
    }));

    setRepoList("#recent-stars", repos, "近期没有公开 Star 记录。", (item) => {
      return `★ ${item.stars} · ${item.description}`;
    });
  } catch (error) {
    setRepoList("#recent-stars", [], "读取 GitHub Star 数据失败，请稍后刷新重试。", () => "");
  }
};

const renderBlogList = (posts) => {
  const listRoot = document.querySelector("#blog-list");
  if (!listRoot) return;

  if (!posts.length) {
    listRoot.innerHTML = '<p class="empty">暂无本地文章，请上传 md 并更新索引。</p>';
    return;
  }

  listRoot.innerHTML = posts
    .map(
      (post, idx) => `
      <button class="post-btn ${idx === 0 ? "is-active" : ""}" data-file="${post.file}">
        <strong>${post.title}</strong>
        <span>${post.date}</span>
        <em>${post.summary || ""}</em>
      </button>
    `
    )
    .join("");
};

const renderPostContent = async (post, listButtons) => {
  const contentRoot = document.querySelector("#blog-content");
  if (!contentRoot) return;

  try {
    const resp = await fetch(`./content/posts/${post.file}`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const markdown = await resp.text();
    contentRoot.innerHTML = parseMarkdown(markdown);

    listButtons.forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.file === post.file);
    });
  } catch (error) {
    contentRoot.innerHTML = '<p class="empty">文章加载失败，请检查 md 文件路径。</p>';
  }
};

const loadBlog = async () => {
  const contentRoot = document.querySelector("#blog-content");

  try {
    const resp = await fetch("./content/posts/index.json");
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

    const posts = await resp.json();
    renderBlogList(posts);

    const listButtons = Array.from(document.querySelectorAll(".post-btn"));
    if (!posts.length) {
      if (contentRoot) {
        contentRoot.innerHTML = '<p class="empty">暂无文章内容。</p>';
      }
      return;
    }

    await renderPostContent(posts[0], listButtons);

    listButtons.forEach((btn) => {
      btn.addEventListener("click", async () => {
        const current = posts.find((post) => post.file === btn.dataset.file);
        if (current) {
          await renderPostContent(current, listButtons);
        }
      });
    });
  } catch (error) {
    const listRoot = document.querySelector("#blog-list");
    if (listRoot) {
      listRoot.innerHTML = '<p class="empty">博客索引读取失败，请检查 content/posts/index.json</p>';
    }
    if (contentRoot) {
      contentRoot.innerHTML = '<p class="empty">无法展示文章内容。</p>';
    }
  }
};

setScrollShift();
window.addEventListener("scroll", setScrollShift, { passive: true });
loadRecentCommits();
loadRecentStars();
loadBlog();
