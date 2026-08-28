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

const assertRemoteApi = (config) => {
  if (!config?.apiBaseUrl) {
    throw new Error("REMOTE_API_NOT_CONFIGURED");
  }
};

const assertSiteImagesResponse = (data) => {
  if (!data || !Array.isArray(data.images) || typeof data.headSha !== "string") {
    const error = new Error("展示图片管理服务版本过旧，请先部署最新 Worker。");
    error.code = "SITE_IMAGES_API_VERSION_MISMATCH";
    throw error;
  }
  return data;
};

export const fetchRemoteSiteImages = async (config) => {
  assertRemoteApi(config);
  return assertSiteImagesResponse(await requestJson(`${config.apiBaseUrl}/api/site-images`));
};

export const updateRemoteSiteImages = async (config, changes, baseHeadSha) => {
  assertRemoteApi(config);
  return assertSiteImagesResponse(
    await requestJson(`${config.apiBaseUrl}/api/site-images`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        upserts: Array.isArray(changes?.upserts) ? changes.upserts : [],
        deletes: Array.isArray(changes?.deletes) ? changes.deletes : [],
        baseHeadSha: String(baseHeadSha || "")
      })
    })
  );
};
