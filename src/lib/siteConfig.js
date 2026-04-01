const DEFAULT_SITE_CONFIG = {
  apiBaseUrl: "",
  owner: "qihaichiaki",
  repo: "qihaichiaki.github.io",
  tasksPath: "content/tasks/board.json",
  allowedLogin: "qihaichiaki"
};

const resolveRuntimeApiBaseUrl = () => {
  if (typeof window === "undefined") {
    return "";
  }

  try {
    const url = new URL(window.location.href);
    return String(url.searchParams.get("apiBaseUrl") || "").trim();
  } catch {
    return "";
  }
};

export const getDefaultSiteConfig = () => ({ ...DEFAULT_SITE_CONFIG });

export const normalizeSiteConfig = (value) => {
  const next = {
    ...DEFAULT_SITE_CONFIG,
    ...(value && typeof value === "object" ? value : {})
  };

  next.apiBaseUrl = String(next.apiBaseUrl || "").trim().replace(/\/+$/, "");
  next.owner = String(next.owner || DEFAULT_SITE_CONFIG.owner).trim();
  next.repo = String(next.repo || DEFAULT_SITE_CONFIG.repo).trim();
  next.tasksPath = String(next.tasksPath || DEFAULT_SITE_CONFIG.tasksPath).trim();
  next.allowedLogin = String(next.allowedLogin || DEFAULT_SITE_CONFIG.allowedLogin).trim();

  return next;
};

export const loadSiteConfig = async () => {
  try {
    const response = await fetch("./content/site-config.json", { cache: "no-cache" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const runtimeApiBaseUrl = resolveRuntimeApiBaseUrl();
    return normalizeSiteConfig({
      ...data,
      ...(runtimeApiBaseUrl ? { apiBaseUrl: runtimeApiBaseUrl } : {})
    });
  } catch {
    const runtimeApiBaseUrl = resolveRuntimeApiBaseUrl();
    return normalizeSiteConfig(runtimeApiBaseUrl ? { apiBaseUrl: runtimeApiBaseUrl } : undefined);
  }
};
