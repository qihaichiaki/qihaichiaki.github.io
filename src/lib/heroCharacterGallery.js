import { getDefaultSiteConfig } from "./siteConfig.js";

const FALLBACK_IMAGE_SOURCES = [
  "./assets/img/1784769503774.jpeg",
  "./assets/img/1784026433667.jpeg",
  "./assets/img/1780663854540.png",
  "./assets/img/1785285704879.jpeg",
  "./assets/img/1783535286062.png",
  "./assets/img/IMG_1786931474270.png.jpg",
  "./assets/img/1784769500284.jpeg",
  "./assets/img/Image_1785948086193_228.jpg",
  "./assets/img/IMG_20260817_140111.jpg"
];

const IMAGE_DIRECTORY = "assets/img";
const IMAGE_EXTENSION_PATTERN = /\.(?:avif|gif|jpe?g|png|webp)$/i;
const ROTATION_INTERVAL_MS = 30_000;
const TRANSITION_DURATION_MS = 2_800;

const IMAGE_PROFILES = [
  {
    id: "portrait-tall",
    maxRatio: 0.72,
    fit: "cover",
    position: "50% 36%",
    scale: "1.04",
    hoverScale: "1.075",
    inlineInset: "-3%",
    blockInset: "-3%",
    centerX: "52%",
    centerY: "48%",
    clearRadiusX: "44%",
    clearRadiusY: "56%",
    softRadiusX: "58%",
    softRadiusY: "64%"
  },
  {
    id: "portrait",
    maxRatio: 0.92,
    fit: "cover",
    position: "50% 40%",
    scale: "1.025",
    hoverScale: "1.06",
    inlineInset: "-3%",
    blockInset: "-3%",
    centerX: "52%",
    centerY: "50%",
    clearRadiusX: "48%",
    clearRadiusY: "55%",
    softRadiusX: "60%",
    softRadiusY: "63%"
  },
  {
    id: "balanced",
    maxRatio: 1.18,
    fit: "cover",
    position: "50% 48%",
    scale: "1.015",
    hoverScale: "1.05",
    inlineInset: "-3%",
    blockInset: "-3%",
    centerX: "50%",
    centerY: "50%",
    clearRadiusX: "52%",
    clearRadiusY: "52%",
    softRadiusX: "62%",
    softRadiusY: "61%"
  },
  {
    id: "landscape",
    maxRatio: 1.72,
    fit: "cover",
    position: "50% 50%",
    scale: "1.075",
    hoverScale: "1.14",
    inlineInset: "-9%",
    blockInset: "11%",
    centerX: "50%",
    centerY: "50%",
    clearRadiusX: "56%",
    clearRadiusY: "40%",
    softRadiusX: "63%",
    softRadiusY: "53%"
  },
  {
    id: "landscape-wide",
    maxRatio: Number.POSITIVE_INFINITY,
    fit: "cover",
    position: "50% 52%",
    scale: "1.1",
    hoverScale: "1.18",
    inlineInset: "-12%",
    blockInset: "16%",
    centerX: "50%",
    centerY: "52%",
    clearRadiusX: "58%",
    clearRadiusY: "35%",
    softRadiusX: "64%",
    softRadiusY: "49%"
  }
];

const fallbackOrder = new Map(FALLBACK_IMAGE_SOURCES.map((src, index) => [src.toLowerCase(), index]));
const fileNameCollator = new Intl.Collator("zh-CN", { numeric: true, sensitivity: "base" });
const preloadCache = new Map();

const createAsset = (src, name = "") => ({
  src,
  name: name || src.split("/").pop() || src
});

const FALLBACK_IMAGES = FALLBACK_IMAGE_SOURCES.map((src) => createAsset(src));

const sortImages = (images) =>
  images.sort((left, right) => {
    const leftOrder = fallbackOrder.get(left.src.toLowerCase());
    const rightOrder = fallbackOrder.get(right.src.toLowerCase());
    if (leftOrder !== undefined || rightOrder !== undefined) {
      return (leftOrder ?? Number.MAX_SAFE_INTEGER) - (rightOrder ?? Number.MAX_SAFE_INTEGER);
    }
    return fileNameCollator.compare(left.name, right.name);
  });

const preloadImage = (src) => {
  if (preloadCache.has(src)) return preloadCache.get(src);

  const promise = new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () =>
      resolve({
        src,
        width: image.naturalWidth,
        height: image.naturalHeight,
        ratio: image.naturalHeight > 0 ? image.naturalWidth / image.naturalHeight : 1
      });
    image.onerror = () => {
      preloadCache.delete(src);
      reject(new Error(`IMAGE_LOAD_FAILED: ${src}`));
    };
    image.src = src;

    if (image.complete && image.naturalWidth > 0) {
      image.onload();
    }
  });

  preloadCache.set(src, promise);
  return promise;
};

const selectImageProfile = (metadata) => {
  const ratio = Number.isFinite(metadata?.ratio) && metadata.ratio > 0 ? metadata.ratio : 0.82;
  return IMAGE_PROFILES.find((profile) => ratio <= profile.maxRatio) || IMAGE_PROFILES.at(-1);
};

const applyProfile = (layer, profile) => {
  layer.dataset.imageProfile = profile.id;
  layer.style.setProperty("--character-position", profile.position);
  layer.style.setProperty("--character-scale", profile.scale);
  layer.style.setProperty("--character-hover-scale", profile.hoverScale);
  layer.style.setProperty("--character-fit", profile.fit);
  layer.style.setProperty("--character-inline-inset", profile.inlineInset);
  layer.style.setProperty("--character-block-inset", profile.blockInset);
  layer.style.setProperty("--contour-x", profile.centerX);
  layer.style.setProperty("--contour-y", profile.centerY);
  layer.style.setProperty("--contour-clear-rx", profile.clearRadiusX);
  layer.style.setProperty("--contour-clear-ry", profile.clearRadiusY);
  layer.style.setProperty("--contour-soft-rx", profile.softRadiusX);
  layer.style.setProperty("--contour-soft-ry", profile.softRadiusY);
};

const applyAsset = (layer, asset, metadata = null) => {
  const foreground = layer.querySelector("[data-character-image]");
  const backdrop = layer.querySelector("[data-character-backdrop]");
  if (!foreground || !backdrop) return null;

  foreground.src = asset.src;
  backdrop.src = asset.src;
  layer.dataset.characterSrc = asset.src;
  applyProfile(layer, selectImageProfile(metadata));
  return foreground;
};

const discoverLocalDirectoryImages = async (signal) => {
  const response = await fetch(`./${IMAGE_DIRECTORY}/`, { cache: "no-cache", signal });
  if (!response.ok) {
    throw new Error(`LOCAL_HERO_IMAGE_DISCOVERY_FAILED: HTTP ${response.status}`);
  }

  const documentNode = new DOMParser().parseFromString(await response.text(), "text/html");
  const images = Array.from(documentNode.querySelectorAll("a[href]"))
    .map((link) => {
      const resolvedUrl = new URL(link.getAttribute("href"), response.url);
      if (resolvedUrl.origin !== window.location.origin) return null;

      const encodedName = resolvedUrl.pathname.split("/").pop() || "";
      const name = decodeURIComponent(encodedName);
      if (!IMAGE_EXTENSION_PATTERN.test(name)) return null;
      return createAsset(`./${IMAGE_DIRECTORY}/${encodeURIComponent(name)}`, name);
    })
    .filter(Boolean);

  if (images.length < 2) {
    throw new Error("LOCAL_HERO_IMAGE_DISCOVERY_FAILED: NOT_ENOUGH_IMAGES");
  }

  return sortImages(images);
};

const discoverRepositoryImages = async (signal) => {
  const { owner, repo } = getDefaultSiteConfig();
  const url = new URL(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${IMAGE_DIRECTORY}`
  );
  const response = await fetch(url, {
    cache: "no-cache",
    headers: { Accept: "application/vnd.github+json" },
    signal
  });

  if (!response.ok) {
    throw new Error(`HERO_IMAGE_DISCOVERY_FAILED: HTTP ${response.status}`);
  }

  const contents = await response.json();
  if (!Array.isArray(contents)) {
    throw new Error("HERO_IMAGE_DISCOVERY_FAILED: INVALID_RESPONSE");
  }

  const images = contents
    .filter((item) => item?.type === "file" && IMAGE_EXTENSION_PATTERN.test(String(item.name || "")))
    .map((item) => createAsset(`./${String(item.path).replace(/^\/+/, "")}`, String(item.name || "")));

  return images.length >= 2 ? sortImages(images) : FALLBACK_IMAGES;
};

const discoverCharacterImages = async (signal) => {
  const isLocalPreview = ["127.0.0.1", "localhost"].includes(window.location.hostname);
  if (isLocalPreview) {
    try {
      return await discoverLocalDirectoryImages(signal);
    } catch {
      // 本地服务器未开启目录索引时继续尝试 GitHub Contents API。
    }
  }

  return discoverRepositoryImages(signal);
};

export const initHeroCharacterGallery = (selector = "[data-character-gallery]") => {
  const root = document.querySelector(selector);
  if (!root) return () => {};

  const layers = Array.from(root.querySelectorAll("[data-character-layer]"));
  if (layers.length !== 2 || FALLBACK_IMAGES.length < 2) return () => {};

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const discoveryController = new AbortController();
  let characterImages = [...FALLBACK_IMAGES];
  let currentIndex = 0;
  let activeLayerIndex = 0;
  let rotationTimer = 0;
  let transitionTimer = 0;
  let inView = true;
  let transitioning = false;
  let destroyed = false;

  const updateAccessibleLabel = () => {
    const currentPosition = Math.max(0, currentIndex) + 1;
    root.setAttribute(
      "aria-label",
      `切换下一张插画，当前第 ${currentPosition} 张，共 ${characterImages.length} 张`
    );
  };

  const initialForeground = applyAsset(layers[0], characterImages[0]);
  updateAccessibleLabel();
  preloadImage(characterImages[0].src)
    .then((metadata) => {
      if (!destroyed) applyProfile(layers[0], selectImageProfile(metadata));
    })
    .catch(() => {});
  initialForeground?.decode().catch(() => {});
  window.requestAnimationFrame(() => root.classList.add("is-ready"));

  const clearRotationTimer = () => {
    window.clearTimeout(rotationTimer);
    rotationTimer = 0;
  };

  const canRotate = () => !destroyed && inView && !document.hidden && !reducedMotion.matches;

  const preloadFollowingImage = () => {
    if (destroyed || characterImages.length < 2) return;
    const followingIndex = (Math.max(0, currentIndex) + 1) % characterImages.length;
    preloadImage(characterImages[followingIndex].src).catch(() => {});
  };

  const scheduleRotation = (delay = ROTATION_INTERVAL_MS) => {
    clearRotationTimer();
    if (!canRotate() || transitioning || characterImages.length < 2) return;
    rotationTimer = window.setTimeout(showNextImage, delay);
  };

  const finishTransition = (currentLayer, nextLayer, nextIndex, nextLayerIndex) => {
    currentLayer.classList.remove("is-active", "is-leaving");
    nextLayer.classList.remove("is-entering");
    nextLayer.classList.add("is-active");
    root.classList.remove("is-transitioning");
    root.removeAttribute("aria-busy");

    currentIndex = nextIndex;
    activeLayerIndex = nextLayerIndex;
    transitioning = false;
    updateAccessibleLabel();
    preloadFollowingImage();
    scheduleRotation();
  };

  async function showNextImage({ manual = false } = {}) {
    if (destroyed || transitioning || characterImages.length < 2 || (!manual && !canRotate())) return;

    const nextIndex = (Math.max(-1, currentIndex) + 1) % characterImages.length;
    const nextAsset = characterImages[nextIndex];
    const nextLayerIndex = activeLayerIndex === 0 ? 1 : 0;
    const currentLayer = layers[activeLayerIndex];
    const nextLayer = layers[nextLayerIndex];

    transitioning = true;
    clearRotationTimer();

    try {
      const metadata = await preloadImage(nextAsset.src);
      if (destroyed) return;

      const foreground = applyAsset(nextLayer, nextAsset, metadata);
      try {
        await foreground?.decode();
      } catch {
        // 已预载的图片即使 decode 不可用也可以正常显示。
      }

      if (destroyed) return;
      root.classList.add("is-transitioning");
      root.setAttribute("aria-busy", "true");
      currentLayer.classList.add("is-leaving");
      nextLayer.classList.add("is-entering");

      window.clearTimeout(transitionTimer);
      transitionTimer = window.setTimeout(
        () => finishTransition(currentLayer, nextLayer, nextIndex, nextLayerIndex),
        reducedMotion.matches ? 80 : TRANSITION_DURATION_MS
      );
    } catch {
      transitioning = false;
      currentIndex = nextIndex;
      root.removeAttribute("aria-busy");
      scheduleRotation(4_000);
    }
  }

  const handleManualAdvance = () => {
    showNextImage({ manual: true });
  };

  const updatePointerPosition = (event) => {
    if (reducedMotion.matches || event.pointerType === "touch") return;

    const bounds = root.getBoundingClientRect();
    const pointerX = (event.clientX - bounds.left) / bounds.width - 0.5;
    const pointerY = (event.clientY - bounds.top) / bounds.height - 0.5;
    root.style.setProperty("--gallery-shift-x", `${(pointerX * 10).toFixed(2)}px`);
    root.style.setProperty("--gallery-shift-y", `${(pointerY * 8).toFixed(2)}px`);
    root.style.setProperty("--gallery-pointer-x", `${((pointerX + 0.5) * 100).toFixed(1)}%`);
    root.style.setProperty("--gallery-pointer-y", `${((pointerY + 0.5) * 100).toFixed(1)}%`);
  };

  const resetPointerPosition = () => {
    root.style.setProperty("--gallery-shift-x", "0px");
    root.style.setProperty("--gallery-shift-y", "0px");
    root.style.setProperty("--gallery-pointer-x", "50%");
    root.style.setProperty("--gallery-pointer-y", "50%");
  };

  const syncRotation = () => {
    if (canRotate()) {
      preloadFollowingImage();
      scheduleRotation();
    } else {
      clearRotationTimer();
    }
  };

  const refreshCharacterImages = async () => {
    try {
      const discoveredImages = await discoverCharacterImages(discoveryController.signal);
      if (destroyed) return;

      const activeSource = layers[activeLayerIndex].dataset.characterSrc || "";
      characterImages = discoveredImages;
      currentIndex = characterImages.findIndex((asset) => asset.src === activeSource);
      updateAccessibleLabel();
      preloadFollowingImage();
      scheduleRotation();
    } catch {
      // GitHub API 不可用时继续使用随站点发布的兜底图片列表。
    }
  };

  const visibilityObserver = new IntersectionObserver(
    ([entry]) => {
      inView = Boolean(entry?.isIntersecting);
      syncRotation();
    },
    { threshold: 0.08 }
  );

  const destroy = () => {
    destroyed = true;
    discoveryController.abort();
    clearRotationTimer();
    window.clearTimeout(transitionTimer);
    visibilityObserver.disconnect();
    root.removeEventListener("click", handleManualAdvance);
    root.removeEventListener("pointermove", updatePointerPosition);
    root.removeEventListener("pointerleave", resetPointerPosition);
    reducedMotion.removeEventListener("change", syncRotation);
    document.removeEventListener("visibilitychange", syncRotation);
    window.removeEventListener("pagehide", destroy);
  };

  visibilityObserver.observe(root);
  root.addEventListener("click", handleManualAdvance);
  root.addEventListener("pointermove", updatePointerPosition);
  root.addEventListener("pointerleave", resetPointerPosition);
  reducedMotion.addEventListener("change", syncRotation);
  document.addEventListener("visibilitychange", syncRotation);
  window.addEventListener("pagehide", destroy, { once: true });
  syncRotation();
  refreshCharacterImages();

  return destroy;
};
