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
    const error = new Error(await parseErrorBody(response));
    error.status = response.status;
    throw error;
  }

  return response.json();
};

const createPostsApiVersionError = () => {
  const error = new Error("博客同步服务版本过旧，请先部署最新 Worker。");
  error.code = "POSTS_API_VERSION_MISMATCH";
  return error;
};

export const fetchRemotePosts = async (config, file = "") => {
  if (!config?.apiBaseUrl) {
    throw new Error("REMOTE_API_NOT_CONFIGURED");
  }

  const url = new URL(`${config.apiBaseUrl}/api/posts`);
  if (file) {
    url.searchParams.set("file", file);
  }
  const data = await requestJson(url.toString());
  if (!data || !Array.isArray(data.posts) || typeof data.indexSha !== "string") {
    throw createPostsApiVersionError();
  }
  if (file && (!data.post || typeof data.post.content !== "string" || typeof data.post.sha !== "string")) {
    throw new Error("同步服务没有返回原文章正文。");
  }
  return data;
};

export const pushRemotePost = async (config, payload) => {
  if (!config?.apiBaseUrl) {
    throw new Error("REMOTE_API_NOT_CONFIGURED");
  }

  const data = await requestJson(`${config.apiBaseUrl}/api/posts`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  if (!data || !Array.isArray(data.posts) || !data.post?.file || !data.commitSha) {
    throw createPostsApiVersionError();
  }
  return data;
};
