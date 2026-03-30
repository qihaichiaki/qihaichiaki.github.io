function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[`*_~]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^\w\u4e00-\u9fa5-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function inlineFormat(text) {
  return text
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_m, alt, src) => {
      const label = alt || src;
      return `<span class="md-image-note">[图片资源] ${label}</span>`;
    })
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_]+)__/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>")
    .replace(/(^|[^_])_([^_\n]+)_(?!_)/g, "$1<em>$2</em>")
    .replace(/~~([^~]+)~~/g, "<del>$1</del>");
}

export function parseMarkdown(markdown) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const out = [];
  const headings = [];
  const headingCount = new Map();
  const listStack = [];

  let inCode = false;
  let codeLang = "";
  let paragraph = [];

  const getIndent = (line) => {
    const normalized = line.replace(/\t/g, "    ");
    const match = normalized.match(/^\s*/);
    return match ? match[0].length : 0;
  };

  const closeParagraph = () => {
    if (!paragraph.length) return;
    const text = paragraph.join(" ").trim();
    if (text) {
      out.push(`<p>${inlineFormat(escapeHtml(text))}</p>`);
    }
    paragraph = [];
  };

  const closeTopListItem = () => {
    if (!listStack.length) return;
    const top = listStack[listStack.length - 1];
    if (top.itemOpen) {
      out.push("</li>");
      top.itemOpen = false;
    }
  };

  const closeTopList = () => {
    if (!listStack.length) return;
    closeTopListItem();
    const top = listStack.pop();
    out.push(`</${top.type}>`);
  };

  const closeAllLists = () => {
    while (listStack.length) {
      closeTopList();
    }
  };

  const makeHeadingId = (text) => {
    const base = slugify(text) || "section";
    const count = headingCount.get(base) || 0;
    headingCount.set(base, count + 1);
    return count === 0 ? base : `${base}-${count + 1}`;
  };

  for (const rawLine of lines) {
    const line = rawLine.replace(/\r/g, "");
    const trimmed = line.trim();

    const fenceMatch = trimmed.match(/^```([\w-]+)?$/);
    if (fenceMatch) {
      closeParagraph();
      closeAllLists();

      if (!inCode) {
        inCode = true;
        codeLang = fenceMatch[1] || "";
        const className = codeLang ? ` class="language-${codeLang}"` : "";
        out.push(`<pre><code${className}>`);
      } else {
        inCode = false;
        codeLang = "";
        out.push("</code></pre>");
      }
      continue;
    }

    if (inCode) {
      out.push(`${escapeHtml(line)}\n`);
      continue;
    }

    if (!trimmed) {
      closeParagraph();
      closeAllLists();
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      closeParagraph();
      closeAllLists();

      const level = headingMatch[1].length;
      const title = headingMatch[2].trim();
      const id = makeHeadingId(title);
      headings.push({
        level,
        text: title,
        id
      });
      out.push(`<h${level} id="${id}">${inlineFormat(escapeHtml(title))}</h${level}>`);
      continue;
    }

    if (/^([-*_])\1{2,}$/.test(trimmed)) {
      closeParagraph();
      closeAllLists();
      out.push("<hr>");
      continue;
    }

    if (trimmed.startsWith("> ")) {
      closeParagraph();
      closeAllLists();
      out.push(`<blockquote>${inlineFormat(escapeHtml(trimmed.slice(2).trim()))}</blockquote>`);
      continue;
    }

    const listMatch = line.match(/^(\s*)([-*+]|\d+\.)\s+(.+)$/);
    if (listMatch) {
      closeParagraph();

      const indent = getIndent(listMatch[1]);
      const marker = listMatch[2];
      const itemText = listMatch[3].trim();
      const listType = /\d+\./.test(marker) ? "ol" : "ul";

      while (listStack.length && indent < listStack[listStack.length - 1].indent) {
        closeTopList();
      }

      if (!listStack.length || indent > listStack[listStack.length - 1].indent) {
        out.push(`<${listType}>`);
        listStack.push({ type: listType, indent, itemOpen: false });
      } else {
        const top = listStack[listStack.length - 1];
        if (top.type !== listType) {
          closeTopList();
          out.push(`<${listType}>`);
          listStack.push({ type: listType, indent, itemOpen: false });
        } else {
          closeTopListItem();
        }
      }

      const top = listStack[listStack.length - 1];
      out.push(`<li>${inlineFormat(escapeHtml(itemText))}`);
      top.itemOpen = true;
      continue;
    }

    if (listStack.length) {
      const indent = getIndent(line);
      const top = listStack[listStack.length - 1];

      if (indent > top.indent) {
        out.push(`<p>${inlineFormat(escapeHtml(trimmed))}</p>`);
        continue;
      }

      closeAllLists();
    }

    paragraph.push(trimmed);
  }

  closeParagraph();
  closeAllLists();

  if (inCode) {
    out.push("</code></pre>");
  }

  return {
    html: out.join("\n"),
    headings
  };
}
