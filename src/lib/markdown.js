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

function isSafeUrl(value, { allowImageData = false } = {}) {
  const url = String(value || "").trim();
  if (!url || url.startsWith("#") || url.startsWith("/") || url.startsWith("./") || url.startsWith("../")) {
    return true;
  }

  if (allowImageData && (/^data:image\/(?:png|gif|jpeg|webp);base64,/i.test(url) || url.startsWith("blob:"))) {
    return true;
  }

  try {
    const protocol = new URL(url, window.location.href).protocol;
    return ["http:", "https:", "mailto:"].includes(protocol);
  } catch {
    return false;
  }
}

function sanitizeMarkdownHtml(container) {
  container
    .querySelectorAll("script, style, iframe, object, embed, link, meta, form, input, button, textarea, select")
    .forEach((node) => node.remove());

  container.querySelectorAll("*").forEach((node) => {
    Array.from(node.attributes).forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      if (name.startsWith("on") || name === "style" || name === "srcdoc") {
        node.removeAttribute(attribute.name);
      }
    });

    if (node.hasAttribute("href") && !isSafeUrl(node.getAttribute("href"))) {
      node.removeAttribute("href");
    }
    if (node.hasAttribute("src") && !isSafeUrl(node.getAttribute("src"), { allowImageData: node.tagName === "IMG" })) {
      node.removeAttribute("src");
    }
  });
}

export function parseMarkdown(markdown, options = {}) {
  const source = typeof markdown === "string" ? markdown : "";
  const html = marked.parse(source);
  const imageSources = options.imageSources && typeof options.imageSources === "object" ? options.imageSources : {};

  const doc = document.implementation.createHTMLDocument("");
  const container = doc.createElement("div");
  container.innerHTML = html;
  sanitizeMarkdownHtml(container);

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
    const sourceUrl = String(img.getAttribute("src") || "");
    const localSource = imageSources[sourceUrl] || imageSources[sourceUrl.replace(/^\.\//, "")];
    if (localSource && isSafeUrl(localSource, { allowImageData: true })) {
      img.setAttribute("src", localSource);
    } else if (sourceUrl.startsWith("./assets/")) {
      img.setAttribute("src", `./content/posts/${sourceUrl.slice(2)}`);
    }
    img.loading = "lazy";
    img.decoding = "async";
    img.classList.add("md-image");
  });

  container.querySelectorAll("a[href]").forEach((link) => {
    try {
      const target = new URL(link.getAttribute("href"), window.location.href);
      if (["http:", "https:"].includes(target.protocol) && target.origin !== window.location.origin) {
        link.target = "_blank";
        link.rel = "noreferrer noopener";
      }
    } catch {
      // unsafe URLs have already been removed above
    }
  });

  return {
    html: container.innerHTML,
    headings
  };
}
