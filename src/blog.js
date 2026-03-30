import { blogPage } from "./components/blogPage.js";
import { parseMarkdown } from "./lib/markdown.js";

document.querySelector("#app").innerHTML = blogPage();

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

const selectedFile = new URLSearchParams(window.location.search).get("post");

const renderBlogList = (posts) => {
  const listRoot = document.querySelector("#blog-list");
  if (!listRoot) return;

  if (!posts.length) {
    listRoot.innerHTML = '<p class="empty">暂无本地文章，请上传 md 并更新索引。</p>';
    return;
  }

  listRoot.innerHTML = posts
    .map(
      (post) => `
      <button class="post-btn" data-file="${post.file}">
        <strong>${post.title}</strong>
        <span>${post.date}</span>
        <em>${post.summary || ""}</em>
      </button>
    `
    )
    .join("");
};

const setActive = (buttons, file) => {
  buttons.forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.file === file);
  });
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

    const url = new URL(window.location.href);
    url.searchParams.set("post", post.file);
    window.history.replaceState(null, "", url.toString());
  } catch (_) {
    contentRoot.innerHTML = '<p class="empty">文章加载失败，请检查 md 文件路径。</p>';
  }
};

const loadBlogPage = async () => {
  const contentRoot = document.querySelector("#blog-content");

  try {
    const resp = await fetch("./content/posts/index.json");
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

    const posts = await resp.json();
    renderBlogList(posts);
    const buttons = Array.from(document.querySelectorAll(".post-btn"));

    if (!posts.length) {
      if (contentRoot) {
        contentRoot.innerHTML = '<p class="empty">暂无文章内容。</p>';
      }
      return;
    }

    const current = posts.find((post) => post.file === selectedFile) || posts[0];
    await renderPostContent(current, buttons);

    buttons.forEach((btn) => {
      btn.addEventListener("click", async () => {
        const post = posts.find((item) => item.file === btn.dataset.file);
        if (post) {
          await renderPostContent(post, buttons);
        }
      });
    });
  } catch (_) {
    const listRoot = document.querySelector("#blog-list");
    if (listRoot) {
      listRoot.innerHTML = '<p class="empty">博客索引读取失败，请检查 content/posts/index.json</p>';
    }
    if (contentRoot) {
      contentRoot.innerHTML = '<p class="empty">无法展示文章内容。</p>';
    }
  }
};

loadBlogPage();
