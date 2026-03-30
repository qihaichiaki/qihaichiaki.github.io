function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function inlineFormat(text) {
  return text
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
}

export function parseMarkdown(markdown) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const out = [];
  let inCode = false;
  let inList = false;

  const closeList = () => {
    if (inList) {
      out.push("</ul>");
      inList = false;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (line.startsWith("```")) {
      closeList();
      if (!inCode) {
        inCode = true;
        out.push("<pre><code>");
      } else {
        inCode = false;
        out.push("</code></pre>");
      }
      continue;
    }

    if (inCode) {
      out.push(`${escapeHtml(rawLine)}\n`);
      continue;
    }

    if (!line.trim()) {
      closeList();
      continue;
    }

    if (line.startsWith("### ")) {
      closeList();
      out.push(`<h3>${inlineFormat(escapeHtml(line.slice(4)))}</h3>`);
      continue;
    }

    if (line.startsWith("## ")) {
      closeList();
      out.push(`<h2>${inlineFormat(escapeHtml(line.slice(3)))}</h2>`);
      continue;
    }

    if (line.startsWith("# ")) {
      closeList();
      out.push(`<h1>${inlineFormat(escapeHtml(line.slice(2)))}</h1>`);
      continue;
    }

    if (line.startsWith("- ")) {
      if (!inList) {
        out.push("<ul>");
        inList = true;
      }
      out.push(`<li>${inlineFormat(escapeHtml(line.slice(2)))}</li>`);
      continue;
    }

    closeList();
    out.push(`<p>${inlineFormat(escapeHtml(line))}</p>`);
  }

  closeList();
  if (inCode) {
    out.push("</code></pre>");
  }

  return out.join("\n");
}
