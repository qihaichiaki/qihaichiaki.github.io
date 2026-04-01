import { buildAuthStartUrl, fetchSession, hasRemoteApi, logoutRemoteSession } from "./tasksApi.js";
import { getDefaultSiteConfig, loadSiteConfig } from "./siteConfig.js";
import { setupThemeToggle } from "./theme.js";

const SESSION_CACHE_KEY = "qihai_site_header_session_v1";

const createAnonymousSession = (mode = "local") => ({
  authenticated: false,
  canEdit: false,
  login: "",
  avatarUrl: "",
  mode
});

const getSessionLogin = (session) => String(session?.login || session?.username || "").trim();

const getSessionAvatarUrl = (session, login = getSessionLogin(session)) => {
  const explicit = String(session?.avatarUrl || session?.avatar_url || "").trim();
  return explicit || avatarUrlOf(login);
};

const normalizeSession = (session, fallbackMode = "local") => {
  const source = session && typeof session === "object" ? session : {};
  const mode = String(source.mode || fallbackMode || "local").trim() === "remote" ? "remote" : "local";
  const login = getSessionLogin(source);
  const avatarUrl = getSessionAvatarUrl(source, login);
  const authenticated = Boolean(source.authenticated) && Boolean(login || avatarUrl);

  return {
    ...createAnonymousSession(mode),
    ...source,
    login,
    avatarUrl,
    authenticated,
    canEdit: authenticated && Boolean(source.canEdit),
    mode
  };
};

const readCachedSession = (fallbackMode = "local") => {
  try {
    const raw = localStorage.getItem(SESSION_CACHE_KEY);
    if (!raw) {
      return createAnonymousSession(fallbackMode);
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return createAnonymousSession(fallbackMode);
    }

    return normalizeSession(parsed, fallbackMode);
  } catch {
    return createAnonymousSession(fallbackMode);
  }
};

const writeCachedSession = (session) => {
  try {
    localStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(session));
  } catch {
    // ignore storage errors
  }
};

const avatarUrlOf = (login) => {
  const value = String(login || "").trim();
  return value ? `https://github.com/${encodeURIComponent(value)}.png?size=96` : "";
};

const closeDropdown = () => {
  const trigger = document.querySelector("#site-user-trigger");
  const dropdown = document.querySelector("#site-user-dropdown");
  if (!trigger || !dropdown) return;

  trigger.setAttribute("aria-expanded", "false");
  dropdown.classList.add("is-hidden");
};

const openDropdown = () => {
  const trigger = document.querySelector("#site-user-trigger");
  const dropdown = document.querySelector("#site-user-dropdown");
  if (!trigger || !dropdown) return;

  trigger.setAttribute("aria-expanded", "true");
  dropdown.classList.remove("is-hidden");
};

const syncHeaderAuthUi = (config, session) => {
  const connectButton = document.querySelector("#site-connect-button");
  const connectNote = document.querySelector("#site-connect-note");
  const trigger = document.querySelector("#site-user-trigger");
  const fallback = document.querySelector("#site-user-fallback");
  const status = document.querySelector("#site-user-status");
  const userAvatar = document.querySelector("#site-user-avatar");
  const userName = document.querySelector("#site-user-name");
  const userHint = document.querySelector("#site-user-hint");
  const logoutButton = document.querySelector("#site-logout-button");

  const remoteEnabled = hasRemoteApi(config);
  const login = getSessionLogin(session);
  const avatarUrl = getSessionAvatarUrl(session, login);
  const authenticated = Boolean(session?.authenticated);
  const editable = authenticated && Boolean(session?.canEdit);
  const triggerLabel = authenticated
    ? editable
      ? "GitHub 已连接，打开站点菜单"
      : "GitHub 只读状态，打开站点菜单"
    : remoteEnabled
      ? "访客模式，打开站点菜单"
      : "本地模式，打开站点菜单";

  if (connectButton) {
    connectButton.classList.toggle("is-hidden", !remoteEnabled || authenticated);
    if (!connectButton.classList.contains("is-hidden")) {
      connectButton.href = buildAuthStartUrl(config, window.location.href);
    }
  }

  if (connectNote) {
    connectNote.classList.toggle("is-hidden", remoteEnabled);
  }

  if (logoutButton) {
    logoutButton.classList.toggle("is-hidden", !authenticated);
  }

  if (trigger) {
    trigger.classList.toggle("is-authenticated", authenticated);
    trigger.classList.toggle("is-readonly", authenticated && !editable);
    trigger.setAttribute("aria-label", triggerLabel);
    trigger.title = triggerLabel;
  }

  if (status) {
    status.className = `site-user-status${authenticated ? " is-authenticated" : ""}${authenticated && !editable ? " is-readonly" : ""}`;
  }

  if (userAvatar) {
    if (authenticated && avatarUrl) {
      userAvatar.src = avatarUrl;
      userAvatar.alt = "";
      userAvatar.classList.remove("is-hidden");
    } else {
      userAvatar.removeAttribute("src");
      userAvatar.alt = "";
      userAvatar.classList.add("is-hidden");
    }
  }

  if (fallback) {
    fallback.classList.toggle("is-hidden", authenticated && Boolean(avatarUrl));
  }

  if (userName) {
    if (authenticated) {
      userName.textContent = editable ? "GitHub 已连接" : "GitHub 只读模式";
    } else {
      userName.textContent = remoteEnabled ? "访客模式" : "本地模式";
    }
  }

  if (userHint) {
    if (authenticated) {
      userHint.textContent = editable
        ? "当前已连接 GitHub，可在任务板页继续编辑并手动同步。"
        : "当前账号只有浏览权限；如需写入仓库，请切换到有权限的 GitHub 账号。";
    } else if (remoteEnabled) {
      userHint.textContent = "可连接 GitHub，也可仅浏览当前页面并切换主题。";
    } else {
      userHint.textContent = "当前页面未启用 GitHub 同步，可继续本地浏览并切换主题。";
    }
  }
};

const bindHeaderInteractions = (getConfig, getSession, setSession, onSessionChange) => {
  const connectButton = document.querySelector("#site-connect-button");
  const trigger = document.querySelector("#site-user-trigger");
  const dropdown = document.querySelector("#site-user-dropdown");
  const logoutButton = document.querySelector("#site-logout-button");

  if (connectButton && connectButton.dataset.bound !== "true") {
    connectButton.dataset.bound = "true";
    connectButton.addEventListener("click", () => {
      closeDropdown();
    });
  }

  if (trigger && trigger.dataset.bound !== "true") {
    trigger.dataset.bound = "true";
    trigger.addEventListener("click", (event) => {
      event.preventDefault();

      if (!dropdown) {
        return;
      }

      const expanded = trigger.getAttribute("aria-expanded") === "true";
      if (expanded) {
        closeDropdown();
      } else {
        openDropdown();
      }
    });
  }

  if (logoutButton && logoutButton.dataset.bound !== "true") {
    logoutButton.dataset.bound = "true";
    logoutButton.addEventListener("click", async () => {
      const config = getConfig();
      try {
        await logoutRemoteSession(config);
      } catch {
        // ignore logout failures
      }

      closeDropdown();
      const previousSession = getSession();
      const nextSession = createAnonymousSession(hasRemoteApi(config) ? "remote" : "local");
      setSession(nextSession);
      onSessionChange?.({
        config,
        session: nextSession,
        previousSession
      });
    });
  }

  if (!document.body.dataset.siteHeaderMenuBound) {
    document.body.dataset.siteHeaderMenuBound = "true";

    document.addEventListener("click", (event) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (!target) return;

      if (target.closest("#site-user-menu")) {
        return;
      }

      closeDropdown();
    });

    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeDropdown();
      }
    });
  }
};

export const initSiteHeaderAuth = async ({ onSessionChange } = {}) => {
  setupThemeToggle("#theme-toggle");

  let config = getDefaultSiteConfig();
  let session = readCachedSession(hasRemoteApi(config) ? "remote" : "local");

  const getConfig = () => config;
  const getSession = () => session;
  const setSession = (nextSession) => {
    session = normalizeSession(nextSession, hasRemoteApi(getConfig()) ? "remote" : "local");
    writeCachedSession(session);
    syncHeaderAuthUi(getConfig(), session);
  };

  syncHeaderAuthUi(config, session);
  bindHeaderInteractions(getConfig, getSession, setSession, onSessionChange);

  config = await loadSiteConfig();
  setSession(session);

  if (hasRemoteApi(config)) {
    try {
      setSession(await fetchSession(config));
    } catch {
      setSession(session.authenticated ? { ...session, mode: "remote" } : createAnonymousSession("remote"));
    }
  } else {
    setSession(createAnonymousSession("local"));
  }

  return {
    config,
    session: getSession()
  };
};
