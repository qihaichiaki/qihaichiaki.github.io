const parseErrorBody = async (response) => {
  try {
    const data = await response.json();
    if (typeof data?.message === "string" && data.message) {
      return data.message;
    }
  } catch {
    // ignore parse failures
  }

  return `HTTP ${response.status}`;
};

const requestJson = async (url, options = {}) => {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.headers || {})
    },
    credentials: "include"
  });

  if (!response.ok) {
    const message = await parseErrorBody(response);
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  return response.json();
};

export const hasRemoteApi = (config) => Boolean(config?.apiBaseUrl);

export const buildAuthStartUrl = (config, returnTo) => {
  const url = new URL(`${config.apiBaseUrl}/api/auth/start`);
  if (returnTo) {
    url.searchParams.set("returnTo", returnTo);
  }
  return url.toString();
};

export const fetchSession = async (config) => {
  if (!hasRemoteApi(config)) {
    return {
      authenticated: false,
      canEdit: false,
      login: "",
      mode: "local"
    };
  }

  return requestJson(`${config.apiBaseUrl}/api/session`);
};

export const fetchRemoteBoard = async (config) => {
  if (!hasRemoteApi(config)) {
    throw new Error("REMOTE_API_NOT_CONFIGURED");
  }

  return requestJson(`${config.apiBaseUrl}/api/tasks`);
};

export const pushRemoteBoard = async (config, board, baseSha) => {
  if (!hasRemoteApi(config)) {
    throw new Error("REMOTE_API_NOT_CONFIGURED");
  }

  return requestJson(`${config.apiBaseUrl}/api/tasks`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      board,
      baseSha
    })
  });
};

export const logoutRemoteSession = async (config) => {
  if (!hasRemoteApi(config)) {
    return { ok: true };
  }

  return requestJson(`${config.apiBaseUrl}/api/logout`, {
    method: "POST"
  });
};
