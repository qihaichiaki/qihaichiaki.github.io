import { adminPage } from "./components/adminPage.js";
import { siteHeader } from "./components/siteHeader.js";
import { initNebulaBackground } from "./lib/nebulaBackground.js";
import { initSiteHeaderAuth } from "./lib/siteHeaderAuth.js";
import { fetchRemoteSiteImages, updateRemoteSiteImages } from "./lib/siteImagesApi.js";
import { hasRemoteApi } from "./lib/tasksApi.js";

document.querySelector("#app").innerHTML = `${siteHeader({ homeHref: "./index.html#top" })}${adminPage()}`;
document.body.classList.add("admin-page");
initNebulaBackground();

const SUPPORTED_IMAGE_TYPES = new Map([
  ["image/avif", ["avif"]],
  ["image/gif", ["gif"]],
  ["image/jpeg", ["jpg", "jpeg"]],
  ["image/png", ["png"]],
  ["image/webp", ["webp"]]
]);

const getFileMimeType = (file) => {
  const explicit = String(file?.type || "").toLowerCase();
  if (SUPPORTED_IMAGE_TYPES.has(explicit)) return explicit;
  const extension = String(file?.name || "").split(".").pop()?.toLowerCase() || "";
  return (
    Array.from(SUPPORTED_IMAGE_TYPES.entries()).find(([, extensions]) => extensions.includes(extension))?.[0] || ""
  );
};

const state = {
  config: null,
  session: null,
  images: [],
  headSha: "",
  busy: false
};

const escapeText = (value) =>
  String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const isOwnerSession = () => {
  const login = String(state.session?.login || "").trim();
  const allowedLogin = String(state.config?.allowedLogin || "").trim();
  return (
    hasRemoteApi(state.config) &&
    Boolean(state.session?.verified) &&
    Boolean(state.session?.authenticated) &&
    Boolean(state.session?.canEdit) &&
    Boolean(login) &&
    login === allowedLogin
  );
};

const formatFileSize = (value) => {
  const bytes = Number(value || 0);
  if (!Number.isFinite(bytes) || bytes <= 0) return "未知大小";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const setStatus = (message, type = "loading") => {
  const root = document.querySelector("#admin-access-status");
  if (!root) return;
  root.className = `admin-access-status admin-access-${type}`;
  root.textContent = message;
};

const setBusy = (busy) => {
  state.busy = busy;
  const uploadButton = document.querySelector("#admin-upload-button");
  const input = document.querySelector("#admin-image-input");
  if (uploadButton) {
    uploadButton.disabled = busy;
    uploadButton.textContent = busy ? "正在同步..." : "选择并上传";
  }
  if (input) input.disabled = busy;
  document.querySelectorAll("[data-admin-image-action='remove']").forEach((button) => {
    button.disabled = busy;
  });
};

const renderImages = () => {
  const list = document.querySelector("#admin-image-list");
  const summary = document.querySelector("#admin-image-summary");
  if (!list || !summary) return;

  summary.textContent = `${state.images.length} 张图片 · 上传或移除后会直接提交到 GitHub 仓库`;
  if (!state.images.length) {
    list.innerHTML = '<p class="empty">仓库中还没有展示图片。</p>';
    return;
  }

  list.innerHTML = state.images
    .map(
      (image) => `
        <article class="admin-image-item">
          <div class="admin-image-preview">
            <img src="${escapeText(image.url)}" alt="${escapeText(image.name)}" loading="lazy" decoding="async" />
          </div>
          <div class="admin-image-meta">
            <strong title="${escapeText(image.name)}">${escapeText(image.name)}</strong>
            <span>${escapeText(formatFileSize(image.size))}</span>
          </div>
          <button
            class="admin-image-remove"
            type="button"
            data-admin-image-action="remove"
            data-image-name="${escapeText(image.name)}"
            ${state.busy ? "disabled" : ""}
          >移除</button>
        </article>
      `
    )
    .join("");
};

const syncAccessUi = () => {
  const manager = document.querySelector("#admin-image-manager");
  const badge = document.querySelector("#admin-owner-badge");
  const owner = isOwnerSession();
  manager?.classList.toggle("is-hidden", !owner);

  if (!hasRemoteApi(state.config)) {
    if (badge) badge.textContent = "未配置";
    setStatus("当前站点未配置远端管理服务。", "error");
    return;
  }
  if (!state.session?.verified) {
    if (badge) badge.textContent = "未验证";
    setStatus("无法在线确认 GitHub 登录状态，后台管理功能保持关闭。", "error");
    return;
  }
  if (!state.session?.authenticated) {
    if (badge) badge.textContent = "未登录";
    setStatus("请通过右上角头像菜单连接获准的 GitHub 账号。", "readonly");
    return;
  }
  if (!owner) {
    if (badge) badge.textContent = "无权限";
    setStatus("当前 GitHub 账号不具备本站后台管理权限。", "error");
    return;
  }

  if (badge) badge.textContent = state.session.login;
  setStatus("GitHub 管理权限已确认。", "ready");
};

const loadImages = async () => {
  if (!isOwnerSession() || state.busy) return;
  setBusy(true);
  setStatus("正在读取 GitHub 仓库中的展示图片...", "loading");
  try {
    const data = await fetchRemoteSiteImages(state.config);
    state.images = data.images;
    state.headSha = data.headSha;
    renderImages();
    setStatus("展示图片已从 GitHub 仓库读取。", "ready");
  } catch (error) {
    setStatus(`读取失败：${String(error?.message || "网络异常")}`, "error");
  } finally {
    setBusy(false);
  }
};

const fileToBase64 = async (file) => {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const chunkSize = 0x8000;
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
};

const validateSelectedFiles = (files) => {
  const existingNames = new Set(state.images.map((image) => image.name.toLowerCase()));
  const selectedNames = new Set();
  files.forEach((file) => {
    const extension = String(file.name || "").split(".").pop()?.toLowerCase() || "";
    const validExtensions = SUPPORTED_IMAGE_TYPES.get(getFileMimeType(file));
    const normalizedName = String(file.name || "").toLowerCase();
    if (!validExtensions?.includes(extension)) {
      throw new Error(`不支持的图片格式：${file.name}`);
    }
    if (existingNames.has(normalizedName)) {
      throw new Error(`仓库中已存在同名图片：${file.name}`);
    }
    if (selectedNames.has(normalizedName)) {
      throw new Error(`本次选择包含同名图片：${file.name}`);
    }
    selectedNames.add(normalizedName);
  });
};

const uploadSelectedFiles = async (fileList) => {
  const files = Array.from(fileList || []);
  if (!files.length || !isOwnerSession() || state.busy) return;

  try {
    validateSelectedFiles(files);
  } catch (error) {
    setStatus(String(error?.message || "所选图片不合法。"), "error");
    return;
  }

  setBusy(true);
  setStatus(`正在上传 ${files.length} 张图片并提交到 GitHub...`, "loading");
  try {
    const upserts = await Promise.all(
      files.map(async (file) => ({
        name: file.name,
        mimeType: getFileMimeType(file),
        content: await fileToBase64(file)
      }))
    );
    const data = await updateRemoteSiteImages(state.config, { upserts }, state.headSha);
    state.images = data.images;
    state.headSha = data.headSha;
    renderImages();
    setStatus(`已上传 ${files.length} 张图片，GitHub Pages 更新需要少量时间。`, "ready");
  } catch (error) {
    const prefix = error?.status === 409 ? "远端仓库已有新变化" : "上传失败";
    setStatus(`${prefix}：${String(error?.message || "网络异常")}`, "error");
  } finally {
    const input = document.querySelector("#admin-image-input");
    if (input) input.value = "";
    setBusy(false);
  }
};

const removeImage = async (name) => {
  if (!name || !isOwnerSession() || state.busy) return;
  if (!window.confirm(`确定要从 assets/img 移除 ${name} 吗？此操作会创建 GitHub commit。`)) return;

  setBusy(true);
  setStatus(`正在移除 ${name} 并提交到 GitHub...`, "loading");
  try {
    const data = await updateRemoteSiteImages(state.config, { deletes: [name] }, state.headSha);
    state.images = data.images;
    state.headSha = data.headSha;
    renderImages();
    setStatus(`已移除 ${name}，GitHub Pages 更新需要少量时间。`, "ready");
  } catch (error) {
    const prefix = error?.status === 409 ? "远端仓库已有新变化" : "移除失败";
    setStatus(`${prefix}：${String(error?.message || "网络异常")}`, "error");
  } finally {
    setBusy(false);
  }
};

document.querySelector("#admin-upload-button")?.addEventListener("click", () => {
  document.querySelector("#admin-image-input")?.click();
});

document.querySelector("#admin-image-input")?.addEventListener("change", (event) => {
  uploadSelectedFiles(event.target.files);
});

document.querySelector("#admin-image-list")?.addEventListener("click", (event) => {
  const target = event.target instanceof HTMLElement ? event.target.closest("[data-admin-image-action='remove']") : null;
  if (!target) return;
  removeImage(target.dataset.imageName || "");
});

initSiteHeaderAuth({
  onSessionChange: async ({ config, session }) => {
    state.config = config;
    state.session = session;
    syncAccessUi();
    if (isOwnerSession()) await loadImages();
  }
}).then(async ({ config, session }) => {
  state.config = config;
  state.session = session;
  syncAccessUi();
  if (isOwnerSession()) await loadImages();
});
