import { hero } from "./components/hero.js";
import { backgroundGallery, roxyBlueFallback } from "./data/backgrounds.js";

document.querySelector("#app").innerHTML = hero();

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

const shuffle = (list) => [...list].sort(() => Math.random() - 0.5);

const loadImage = (url) =>
  new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
  });

const applyFallbackTheme = () => {
  document.body.classList.remove("has-hero-bg");
  document.documentElement.style.setProperty("--hero-bg-image", "none");
  document.documentElement.style.setProperty("--ink", roxyBlueFallback.ink);
  document.documentElement.style.setProperty("--muted", roxyBlueFallback.muted);
  document.documentElement.style.setProperty("--line", roxyBlueFallback.line);
  document.documentElement.style.setProperty("--accent", roxyBlueFallback.accent);
  document.documentElement.style.setProperty("--accent-2", roxyBlueFallback.accent2);
  document.documentElement.style.setProperty("--sky", roxyBlueFallback.sky);

  const hint = document.querySelector("#bg-hint");
  if (hint) {
    hint.textContent = "当前为蓝发基调配色（无背景图模式）";
  }
};

const applyRandomBackground = async () => {
  if (!backgroundGallery.length) {
    applyFallbackTheme();
    return;
  }

  const pool = shuffle(backgroundGallery);
  for (const item of pool) {
    const ok = await loadImage(item.url);
    if (!ok) continue;

    document.documentElement.style.setProperty("--hero-bg-image", `url(${item.url})`);
    document.body.classList.add("has-hero-bg");

    const hint = document.querySelector("#bg-hint");
    if (hint) {
      hint.innerHTML = `背景图：<a href="${item.page}" target="_blank" rel="noreferrer">${item.author}</a>`;
    }
    return;
  }

  applyFallbackTheme();
};

setScrollShift();
window.addEventListener("scroll", setScrollShift, { passive: true });
applyRandomBackground();
