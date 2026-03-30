import { marked } from "../vendor/marked.esm.js";

marked.setOptions({
  gfm: true,
  breaks: false,
  async: false
});

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[`*_~]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^\w\u4e00-\u9fa5-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function parseMarkdown(markdown) {
  const source = typeof markdown === "string" ? markdown : "";
  const html = marked.parse(source);

  const doc = document.implementation.createHTMLDocument("");
  const container = doc.createElement("div");
  container.innerHTML = html;

  const headingCount = new Map();
  const headings = [];

  container.querySelectorAll("h1, h2, h3").forEach((node) => {
    const text = (node.textContent || "").trim();
    const base = slugify(text) || "section";
    const count = headingCount.get(base) || 0;
    headingCount.set(base, count + 1);
    const id = count === 0 ? base : `${base}-${count + 1}`;

    node.id = id;
    headings.push({
      level: Number(node.tagName.substring(1)),
      text,
      id
    });
  });

  container.querySelectorAll("img").forEach((img) => {
    const label = img.getAttribute("alt") || img.getAttribute("src") || "图片";
    const note = doc.createElement("span");
    note.className = "md-image-note";
    note.textContent = `[图片资源] ${label}`;
    img.replaceWith(note);
  });

  return {
    html: container.innerHTML,
    headings
  };
}
