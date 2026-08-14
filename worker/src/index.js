import rs from "jsrsasign";

const SESSION_COOKIE = "__Host-qihai-task-session";
const GITHUB_USER_AGENT = "qihai-site-api/1.0 (+https://qihaichiaki.github.io)";
const DEFAULT_ALLOWED_ORIGINS = [
  "https://qihaichiaki.github.io",
  "http://127.0.0.1:4173",
  "http://localhost:4173"
];
const DEFAULT_RETURN_PATH = "/tasks.html";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
const STATE_TTL_SECONDS = 60 * 10;
const MAX_POST_CONTENT_LENGTH = 500_000;
const MAX_POST_IMAGE_COUNT = 12;
const MAX_POST_IMAGE_SIZE = 6 * 1024 * 1024;
const MAX_POST_IMAGE_TOTAL_SIZE = 20 * 1024 * 1024;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const DEFAULT_COLUMNS = [
  { id: "backlog", title: "待整理" },
  { id: "active", title: "进行中" },
  { id: "done", title: "已完成" }
];

const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...headers
    }
  });

const parseCookies = (cookieHeader) => {
  const entries = String(cookieHeader || "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);

  return entries.reduce((acc, item) => {
    const index = item.indexOf("=");
    if (index === -1) return acc;
    acc[item.slice(0, index)] = item.slice(index + 1);
    return acc;
  }, {});
};

const base64UrlEncode = (value) => {
  const bytes = value instanceof Uint8Array ? value : encoder.encode(String(value));
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

const base64Encode = (value) => {
  const bytes = value instanceof Uint8Array ? value : encoder.encode(String(value));
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
};

const base64Decode = (value) => {
  const binary = atob(String(value || ""));
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
};

const base64UrlDecode = (value) => {
  const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  const binary = atob(normalized + padding);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
};

const hmacKey = async (secret) =>
  crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);

const signPayload = async (secret, payload) => {
  const body = base64UrlEncode(JSON.stringify(payload));
  const key = await hmacKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  return `${body}.${base64UrlEncode(new Uint8Array(signature))}`;
};

const verifySignedPayload = async (secret, token) => {
  const [body, signature] = String(token || "").split(".");
  if (!body || !signature) {
    throw new Error("INVALID_TOKEN");
  }

  const key = await hmacKey(secret);
  const isValid = await crypto.subtle.verify(
    "HMAC",
    key,
    base64UrlDecode(signature),
    encoder.encode(body)
  );

  if (!isValid) {
    throw new Error("INVALID_SIGNATURE");
  }

  const payload = JSON.parse(decoder.decode(base64UrlDecode(body)));
  if (typeof payload.exp === "number" && payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error("TOKEN_EXPIRED");
  }

  return payload;
};

const serializeCookie = (name, value, options = {}) => {
  const parts = [`${name}=${value}`];
  parts.push(`Path=${options.path || "/"}`);

  if (options.httpOnly !== false) {
    parts.push("HttpOnly");
  }

  if (options.secure !== false) {
    parts.push("Secure");
  }

  parts.push(`SameSite=${options.sameSite || "None"}`);

  if (typeof options.maxAge === "number") {
    parts.push(`Max-Age=${options.maxAge}`);
  }

  return parts.join("; ");
};

const getAllowedOrigins = (env) =>
  String(env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .concat(DEFAULT_ALLOWED_ORIGINS)
    .filter((value, index, array) => array.indexOf(value) === index);

const getCorsHeaders = (request, env) => {
  const origin = request.headers.get("Origin");
  const allowedOrigins = getAllowedOrigins(env);

  if (!origin || !allowedOrigins.includes(origin)) {
    return {};
  }

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": "Content-Type, Accept",
    "Access-Control-Allow-Methods": "GET, PUT, POST, OPTIONS",
    Vary: "Origin"
  };
};

const withCors = (response, request, env, extraHeaders = {}) => {
  const headers = new Headers(response.headers);
  const corsHeaders = getCorsHeaders(request, env);
  Object.entries({ ...corsHeaders, ...extraHeaders }).forEach(([key, value]) => {
    if (value) {
      headers.set(key, value);
    }
  });

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
};

const sanitizeReturnTo = (value, env, request) => {
  const allowedOrigins = getAllowedOrigins(env);
  const fallbackOrigin = allowedOrigins.find((origin) => origin.startsWith("https://")) || new URL(request.url).origin;
  const fallback = `${fallbackOrigin}${DEFAULT_RETURN_PATH}`;

  if (!value) return fallback;

  try {
    const target = new URL(value);
    if (allowedOrigins.includes(target.origin)) {
      return target.toString();
    }
  } catch {
    return fallback;
  }

  return fallback;
};

const normalizeBoard = (input) => {
  const source = input && typeof input === "object" ? input : {};
  const tasks = Array.isArray(source.tasks) ? source.tasks : [];
  const columns = DEFAULT_COLUMNS.map((column) => {
    const matched = Array.isArray(source.columns) ? source.columns.find((item) => item && item.id === column.id) : null;
    return {
      ...column,
      taskIds: Array.isArray(matched?.taskIds) ? matched.taskIds.map((item) => String(item)) : []
    };
  });

  const taskMap = new Map();
  tasks.forEach((task) => {
    if (!task || typeof task !== "object") return;
    const normalized = {
      id: String(task.id || `task-${crypto.randomUUID()}`),
      title: String(task.title || "未命名任务"),
      description: String(task.description || ""),
      tags: Array.isArray(task.tags) ? task.tags.map((item) => String(item)).filter(Boolean) : [],
      columnId: String(task.columnId || "backlog"),
      createdAt: String(task.createdAt || new Date().toISOString()),
      updatedAt: String(task.updatedAt || new Date().toISOString())
    };
    taskMap.set(normalized.id, normalized);
  });

  columns.forEach((column) => {
    column.taskIds = column.taskIds.filter((taskId) => {
      const task = taskMap.get(taskId);
      if (!task) return false;
      task.columnId = column.id;
      return true;
    });
  });

  taskMap.forEach((task) => {
    const column = columns.find((item) => item.id === task.columnId) || columns[0];
    if (!column.taskIds.includes(task.id)) {
      column.taskIds.push(task.id);
      task.columnId = column.id;
    }
  });

  return {
    version: 1,
    title: String(source.title || "qihai task board"),
    updatedAt: String(source.updatedAt || new Date().toISOString()),
    updatedBy: String(source.updatedBy || "qihaichiaki"),
    columns,
    tasks: Array.from(taskMap.values())
  };
};

const createDefaultBoard = (env) =>
  normalizeBoard({
    title: "qihai task board",
    updatedBy: env.GITHUB_ALLOWED_LOGIN || env.GITHUB_OWNER || "qihaichiaki",
    columns: DEFAULT_COLUMNS.map((column) => ({
      ...column,
      taskIds: []
    })),
    tasks: []
  });

const toGitHubPath = (path) => String(path).split("/").map(encodeURIComponent).join("/");

const githubRequest = async (url, options = {}) => {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": GITHUB_USER_AGENT,
      "X-GitHub-Api-Version": "2026-03-10",
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    let message = `GitHub API ${response.status}`;
    try {
      const data = await response.json();
      if (typeof data?.message === "string" && data.message) {
        message = data.message;
      }
      if (typeof data?.documentation_url === "string" && data.documentation_url) {
        message = `${message} (${data.documentation_url})`;
      }
    } catch {
      // ignore parse failures
    }
    const error = new Error(message);
    error.status = response.status;
    error.url = url;
    throw error;
  }

  return response;
};

const normalizePrivateKeyPem = (pem) => String(pem || "").replace(/\\n/g, "\n").trim();

const createAppJwt = async (env) => {
  const now = Math.floor(Date.now() / 1000);
  const header = JSON.stringify({ alg: "RS256", typ: "JWT" });
  const payload = JSON.stringify({
    iat: now - 60,
    exp: now + 9 * 60,
    iss: env.GITHUB_APP_CLIENT_ID || env.GITHUB_APP_ID
  });

  return rs.KJUR.jws.JWS.sign("RS256", header, payload, normalizePrivateKeyPem(env.GITHUB_APP_PRIVATE_KEY));
};

const getInstallationToken = async (env) => {
  const appJwt = await createAppJwt(env);
  const installationResponse = await githubRequest(
    `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/installation`,
    {
      headers: {
        Authorization: `Bearer ${appJwt}`
      }
    }
  );

  const installation = await installationResponse.json();
  const tokenResponse = await githubRequest(
    `https://api.github.com/app/installations/${installation.id}/access_tokens`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${appJwt}`,
        "Content-Type": "application/json"
      }
    }
  );

  const tokenData = await tokenResponse.json();
  return tokenData.token;
};

const decodeGitHubContent = (data) => decoder.decode(base64Decode(String(data?.content || "").replaceAll("\n", "")));

const getRepoFile = async (env, installationToken, path, ref = "") => {
  try {
    const url = new URL(`https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${toGitHubPath(path)}`);
    if (ref) {
      url.searchParams.set("ref", ref);
    }
    const response = await githubRequest(
      url.toString(),
      {
        headers: {
          Authorization: `token ${installationToken}`
        }
      }
    );
    const data = await response.json();
    return {
      path,
      sha: String(data.sha || ""),
      content: decodeGitHubContent(data)
    };
  } catch (error) {
    if (error?.status === 404) return null;
    throw error;
  }
};

const getPostsIndexPath = (env) => String(env.GITHUB_POSTS_INDEX_PATH || "content/posts/index.json").trim();

const getPostsDirectory = (env) => {
  const indexPath = getPostsIndexPath(env);
  const slash = indexPath.lastIndexOf("/");
  return slash >= 0 ? indexPath.slice(0, slash) : "content/posts";
};

const isValidPostFile = (value) => /^[a-z0-9][a-z0-9._-]*\.md$/i.test(String(value || ""));
const isValidPostImagePath = (value) => /^assets\/[a-z0-9][a-z0-9._-]{0,119}\.(?:png|jpe?g|gif|webp)$/i.test(String(value || ""));

const isPostImageReferenced = (content, path) => {
  const source = String(content || "");
  return [`./content/posts/${path}`, `/content/posts/${path}`, `./${path}`].some((value) => source.includes(value));
};

const hasValidPostImageSignature = (bytes, mimeType) => {
  if (mimeType === "image/png") {
    return bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value);
  }
  if (mimeType === "image/jpeg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (mimeType === "image/gif") {
    const signature = decoder.decode(bytes.slice(0, 6));
    return signature === "GIF87a" || signature === "GIF89a";
  }
  if (mimeType === "image/webp") {
    return bytes.length >= 12 && decoder.decode(bytes.slice(0, 4)) === "RIFF" && decoder.decode(bytes.slice(8, 12)) === "WEBP";
  }
  return false;
};

const normalizePostAssets = (input, postContent) => {
  const source = input && typeof input === "object" ? input : {};
  const rawUpserts = Array.isArray(source.upserts) ? source.upserts : [];
  const rawDeletes = Array.isArray(source.deletes) ? source.deletes : [];
  if (rawUpserts.length > MAX_POST_IMAGE_COUNT || rawDeletes.length > MAX_POST_IMAGE_COUNT * 2) {
    throw Object.assign(new Error("单次同步的图片数量过多。"), { status: 400 });
  }

  const paths = new Set();
  let totalSize = 0;
  const upserts = rawUpserts.map((item) => {
    const path = String(item?.path || "").trim();
    const mimeType = String(item?.mimeType || "").trim().toLowerCase();
    const content = String(item?.content || "").replace(/\s+/g, "");
    const extension = path.split(".").pop()?.toLowerCase() || "";
    const validExtension = {
      "image/png": ["png"],
      "image/jpeg": ["jpg", "jpeg"],
      "image/gif": ["gif"],
      "image/webp": ["webp"]
    }[mimeType];

    if (!isValidPostImagePath(path) || !validExtension?.includes(extension) || paths.has(path)) {
      throw Object.assign(new Error("图片路径或类型不合法。"), { status: 400 });
    }
    if (!content || !/^[a-z0-9+/]+={0,2}$/i.test(content)) {
      throw Object.assign(new Error("图片内容不是有效的 Base64。"), { status: 400 });
    }

    let bytes;
    try {
      bytes = base64Decode(content);
    } catch {
      throw Object.assign(new Error("图片内容不是有效的 Base64。"), { status: 400 });
    }
    if (!bytes.length || bytes.length > MAX_POST_IMAGE_SIZE || !hasValidPostImageSignature(bytes, mimeType)) {
      throw Object.assign(new Error("图片内容、格式或大小不合法。"), { status: 400 });
    }
    if (!isPostImageReferenced(postContent, path)) {
      throw Object.assign(new Error("待上传图片尚未插入文章正文。"), { status: 400 });
    }

    paths.add(path);
    totalSize += bytes.length;
    return { path, mimeType, content, size: bytes.length };
  });

  if (totalSize > MAX_POST_IMAGE_TOTAL_SIZE) {
    throw Object.assign(new Error("待上传图片总大小不能超过 20 MB。"), { status: 400 });
  }

  const deletes = [...new Set(rawDeletes.map((item) => String(item || "").trim()).filter(Boolean))];
  deletes.forEach((path) => {
    if (!isValidPostImagePath(path) || paths.has(path)) {
      throw Object.assign(new Error("待删除图片路径不合法。"), { status: 400 });
    }
    if (isPostImageReferenced(postContent, path)) {
      throw Object.assign(new Error("待删除图片仍被文章正文引用。"), { status: 400 });
    }
  });

  return { upserts, deletes };
};

const normalizePostTimestamp = (value) => {
  const source = String(value || "").trim();
  if (!source) return "";
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(source) ? `${source}T00:00:00.000Z` : source);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
};

const normalizePostMetadata = (input) => {
  const source = input && typeof input === "object" ? input : {};
  const createdAt = normalizePostTimestamp(source.createdAt || source.date);
  return {
    title: String(source.title || "").trim(),
    createdAt,
    updatedAt: normalizePostTimestamp(source.updatedAt || createdAt),
    file: String(source.file || "").trim(),
    summary: String(source.summary || "").trim(),
    module: String(source.module || "杂记").trim() || "杂记"
  };
};

const normalizePostsIndex = (input) => {
  if (!Array.isArray(input)) return [];
  const files = new Set();
  return input
    .map(normalizePostMetadata)
    .filter((post) => {
      if (!post.title || !isValidPostFile(post.file) || files.has(post.file)) return false;
      files.add(post.file);
      return true;
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.title.localeCompare(b.title, "zh-CN"));
};

const parsePostsIndex = (file) => {
  if (!file) return [];
  try {
    return normalizePostsIndex(JSON.parse(file.content));
  } catch {
    const error = new Error("远端博客索引不是有效的 JSON。");
    error.status = 500;
    throw error;
  }
};

const validatePost = (input) => {
  const source = input && typeof input === "object" ? input : {};
  const post = {
    title: String(source.title || "").trim(),
    summary: String(source.summary || "").trim(),
    module: String(source.module || "").trim(),
    content: String(source.content || "")
  };

  if (!post.title || post.title.length > 120) {
    throw Object.assign(new Error("文章标题不能为空且不能超过 120 个字符。"), { status: 400 });
  }
  if (!post.module || post.module.length > 60) {
    throw Object.assign(new Error("文章分类不能为空且不能超过 60 个字符。"), { status: 400 });
  }
  if (post.summary.length > 300) {
    throw Object.assign(new Error("文章描述不能超过 300 个字符。"), { status: 400 });
  }
  if (!post.content.trim() || post.content.length > MAX_POST_CONTENT_LENGTH) {
    throw Object.assign(new Error("文章正文不能为空且不能超过 500 KB。"), { status: 400 });
  }

  return post;
};

const createPostFile = (title, timestamp, posts) => {
  const slug = String(title || "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
  const date = timestamp.slice(0, 10);
  const time = timestamp.slice(11, 19).replaceAll(":", "");
  const base = `${date}-${slug || `post-${time}`}`;
  const files = new Set(posts.map((post) => post.file));
  let file = `${base}.md`;
  let suffix = 2;
  while (files.has(file)) {
    file = `${base}-${suffix}.md`;
    suffix += 1;
  }
  return file;
};

const fetchPostsFromRepo = async (env, requestedFile = "") => {
  if (requestedFile && !isValidPostFile(requestedFile)) {
    throw Object.assign(new Error("文章文件名不合法。"), { status: 400 });
  }

  const installationToken = await getInstallationToken(env);
  const head = await getRepoHead(env, installationToken);
  const indexFile = await getRepoFile(env, installationToken, getPostsIndexPath(env), head.commitSha);
  const posts = parsePostsIndex(indexFile);
  let post = null;

  if (requestedFile) {
    const metadata = posts.find((item) => item.file === requestedFile);
    if (!metadata) {
      throw Object.assign(new Error("远端博客索引中不存在这篇文章。"), { status: 404 });
    }

    const contentFile = await getRepoFile(
      env,
      installationToken,
      `${getPostsDirectory(env)}/${requestedFile}`,
      head.commitSha
    );
    if (!contentFile) {
      throw Object.assign(new Error("远端 Markdown 文件不存在。"), { status: 404 });
    }
    post = {
      metadata,
      content: contentFile.content,
      sha: contentFile.sha
    };
  }

  return {
    posts,
    indexSha: indexFile?.sha || "",
    headSha: head.commitSha,
    post
  };
};

const getRepoHead = async (env, installationToken) => {
  const branch = String(env.GITHUB_BRANCH || "main").trim();
  const refResponse = await githubRequest(
    `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/git/ref/heads/${encodeURIComponent(branch)}`,
    {
      headers: {
        Authorization: `token ${installationToken}`
      }
    }
  );
  const ref = await refResponse.json();
  const commitSha = String(ref.object?.sha || "");
  const commitResponse = await githubRequest(
    `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/git/commits/${commitSha}`,
    {
      headers: {
        Authorization: `token ${installationToken}`
      }
    }
  );
  const commit = await commitResponse.json();
  return {
    branch,
    commitSha,
    treeSha: String(commit.tree?.sha || "")
  };
};

const createGitBlob = async (env, installationToken, content, encoding = "utf-8") => {
  const response = await githubRequest(
    `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/git/blobs`,
    {
      method: "POST",
      headers: {
        Authorization: `token ${installationToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ content, encoding })
    }
  );
  const data = await response.json();
  return String(data.sha || "");
};

const commitPostToRepo = async (env, input, originalFile, base = {}, assetInput = {}) => {
  const postInput = validatePost(input);
  const assets = normalizePostAssets(assetInput, postInput.content);
  const previousFile = String(originalFile || "").trim();
  if (previousFile && !isValidPostFile(previousFile)) {
    throw Object.assign(new Error("原文章文件名不合法。"), { status: 400 });
  }

  const installationToken = await getInstallationToken(env);
  const indexPath = getPostsIndexPath(env);
  const postsDirectory = getPostsDirectory(env);
  const head = await getRepoHead(env, installationToken);
  const indexFile = await getRepoFile(env, installationToken, indexPath, head.commitSha);
  const posts = parsePostsIndex(indexFile);
  const currentMetadata = previousFile ? posts.find((item) => item.file === previousFile) : null;
  const updatedAt = new Date().toISOString();
  const post = {
    ...postInput,
    file: previousFile || createPostFile(postInput.title, updatedAt, posts)
  };
  const targetMetadata = posts.find((item) => item.file === post.file);
  const previousContentFile = previousFile
    ? await getRepoFile(env, installationToken, `${postsDirectory}/${previousFile}`, head.commitSha)
    : null;
  const targetContentFile = previousFile
    ? previousContentFile
    : await getRepoFile(env, installationToken, `${postsDirectory}/${post.file}`, head.commitSha);

  if (String(base.indexSha || "") !== String(indexFile?.sha || "")) {
    throw Object.assign(new Error("远端博客索引已变化，请重新读取后再保存。"), { status: 409 });
  }
  if (previousFile && !currentMetadata) {
    throw Object.assign(new Error("远端文章已被移除，请重新读取博客目录。"), { status: 409 });
  }
  if (previousFile && !previousContentFile) {
    throw Object.assign(new Error("远端文章正文已被移除，请重新读取博客目录。"), { status: 409 });
  }
  if (previousFile && String(base.postSha || "") !== String(previousContentFile?.sha || "")) {
    throw Object.assign(new Error("远端文章正文已变化，请重新读取后再保存。"), { status: 409 });
  }
  if (!previousFile && (targetMetadata || targetContentFile)) {
    throw Object.assign(new Error("远端已存在同名文章文件。"), { status: 409 });
  }

  const assetStates = await Promise.all(
    [...assets.upserts.map((asset) => asset.path), ...assets.deletes].map(async (path) => ({
      path,
      file: await getRepoFile(env, installationToken, `${postsDirectory}/${path}`, head.commitSha)
    }))
  );
  const assetStateMap = new Map(assetStates.map((item) => [item.path, item.file]));
  if (assets.upserts.some((asset) => assetStateMap.get(asset.path))) {
    throw Object.assign(new Error("远端已存在同名图片，请重新选择图片。"), { status: 409 });
  }

  const metadata = {
    title: post.title,
    createdAt: currentMetadata?.createdAt || updatedAt,
    updatedAt,
    file: post.file,
    summary: post.summary,
    module: post.module
  };
  const nextPosts = previousFile
    ? posts.map((item) => (item.file === previousFile ? metadata : item))
    : [...posts, metadata];
  const normalizedPosts = normalizePostsIndex(nextPosts);
  const indexContent = `${JSON.stringify(normalizedPosts, null, 2)}\n`;
  const [indexBlobSha, postBlobSha, ...assetBlobShas] = await Promise.all([
    createGitBlob(env, installationToken, indexContent),
    createGitBlob(env, installationToken, post.content),
    ...assets.upserts.map((asset) => createGitBlob(env, installationToken, asset.content, "base64"))
  ]);

  const tree = [
    { path: indexPath, mode: "100644", type: "blob", sha: indexBlobSha },
    { path: `${postsDirectory}/${post.file}`, mode: "100644", type: "blob", sha: postBlobSha },
    ...assets.upserts.map((asset, index) => ({
      path: `${postsDirectory}/${asset.path}`,
      mode: "100644",
      type: "blob",
      sha: assetBlobShas[index]
    })),
    ...assets.deletes
      .filter((path) => assetStateMap.get(path))
      .map((path) => ({ path: `${postsDirectory}/${path}`, mode: "100644", type: "blob", sha: null }))
  ];

  const treeResponse = await githubRequest(
    `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/git/trees`,
    {
      method: "POST",
      headers: {
        Authorization: `token ${installationToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ base_tree: head.treeSha, tree })
    }
  );
  const nextTree = await treeResponse.json();
  const action = previousFile ? "更新" : "发布";
  const commitResponse = await githubRequest(
    `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/git/commits`,
    {
      method: "POST",
      headers: {
        Authorization: `token ${installationToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: `博客：${action}${post.title}`,
        tree: nextTree.sha,
        parents: [head.commitSha],
        author: {
          name: env.GITHUB_COMMITTER_NAME || env.GITHUB_ALLOWED_LOGIN || env.GITHUB_OWNER,
          email: env.GITHUB_COMMITTER_EMAIL || "yushenqihai@gmail.com"
        },
        committer: {
          name: env.GITHUB_COMMITTER_NAME || env.GITHUB_ALLOWED_LOGIN || env.GITHUB_OWNER,
          email: env.GITHUB_COMMITTER_EMAIL || "yushenqihai@gmail.com"
        }
      })
    }
  );
  const commit = await commitResponse.json();

  try {
    await githubRequest(
      `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/git/refs/heads/${encodeURIComponent(head.branch)}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `token ${installationToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ sha: commit.sha, force: false })
      }
    );
  } catch (error) {
    if (error?.status === 409 || error?.status === 422) {
      throw Object.assign(new Error("远端分支刚刚发生变化，请重新读取后再保存。"), { status: 409 });
    }
    throw error;
  }

  return {
    posts: normalizedPosts,
    indexSha: indexBlobSha,
    postSha: postBlobSha,
    post: { ...metadata, content: post.content },
    assets: {
      uploaded: assets.upserts.map((asset) => asset.path),
      deleted: assets.deletes.filter((path) => assetStateMap.get(path))
    },
    commitSha: String(commit.sha || ""),
    commitUrl: String(commit.html_url || ""),
    updatedAt
  };
};

const fetchTasksFromRepo = async (env) => {
  const installationToken = await getInstallationToken(env);
  try {
    const response = await githubRequest(
      `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${toGitHubPath(env.GITHUB_TASKS_PATH)}`,
      {
        headers: {
          Authorization: `token ${installationToken}`
        }
      }
    );

    const data = await response.json();
    const content = decoder.decode(base64Decode(String(data.content || "").replaceAll("\n", "")));
    return {
      sha: String(data.sha || ""),
      board: normalizeBoard(JSON.parse(content))
    };
  } catch (error) {
    if (error?.status === 404) {
      return {
        sha: "",
        board: createDefaultBoard(env)
      };
    }
    throw error;
  }
};

const commitTasksToRepo = async (env, board, baseSha) => {
  const installationToken = await getInstallationToken(env);
  let currentSha = "";
  try {
    const current = await githubRequest(
      `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${toGitHubPath(env.GITHUB_TASKS_PATH)}`,
      {
        headers: {
          Authorization: `token ${installationToken}`
        }
      }
    );

    const currentData = await current.json();
    currentSha = String(currentData.sha || "");
  } catch (error) {
    if (error?.status !== 404) {
      throw error;
    }
  }

  if (baseSha && currentSha && baseSha !== currentSha) {
    const error = new Error("REMOTE_BOARD_CONFLICT");
    error.status = 409;
    throw error;
  }

  const normalizedBoard = normalizeBoard({
    ...board,
    updatedAt: new Date().toISOString(),
    updatedBy: env.GITHUB_ALLOWED_LOGIN || env.GITHUB_OWNER
  });

  const payload = {
    message: `feat(tasks): sync board ${normalizedBoard.updatedAt}`,
    content: base64Encode(JSON.stringify(normalizedBoard, null, 2)),
    sha: currentSha,
    committer: {
      name: env.GITHUB_COMMITTER_NAME || env.GITHUB_ALLOWED_LOGIN || env.GITHUB_OWNER,
      email: env.GITHUB_COMMITTER_EMAIL || "yushenqihai@gmail.com"
    },
    author: {
      name: env.GITHUB_COMMITTER_NAME || env.GITHUB_ALLOWED_LOGIN || env.GITHUB_OWNER,
      email: env.GITHUB_COMMITTER_EMAIL || "yushenqihai@gmail.com"
    }
  };

  const response = await githubRequest(
    `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${toGitHubPath(env.GITHUB_TASKS_PATH)}`,
    {
      method: "PUT",
      headers: {
        Authorization: `token ${installationToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    }
  );

  const result = await response.json();
  return {
    sha: String(result.content?.sha || ""),
    board: normalizedBoard,
    commitUrl: String(result.commit?.html_url || ""),
    updatedAt: normalizedBoard.updatedAt
  };
};

const exchangeCodeForUserToken = async (env, code) => {
  const body = new URLSearchParams({
    client_id: env.GITHUB_APP_CLIENT_ID,
    client_secret: env.GITHUB_APP_CLIENT_SECRET,
    code
  });

  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "User-Agent": GITHUB_USER_AGENT,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });

  const data = await response.json();
  if (!response.ok || !data.access_token) {
    const error = new Error(String(data.error_description || data.error || "AUTH_TOKEN_EXCHANGE_FAILED"));
    error.status = 502;
    throw error;
  }

  return data.access_token;
};

const fetchViewerLogin = async (userToken) => {
  const response = await githubRequest("https://api.github.com/user", {
    headers: {
      Authorization: `token ${userToken}`
    }
  });
  const viewer = await response.json();
  return String(viewer.login || "");
};

const getSession = async (request, env) => {
  const cookies = parseCookies(request.headers.get("Cookie"));
  const token = cookies[SESSION_COOKIE];
  if (!token) return null;

  try {
    return await verifySignedPayload(env.SESSION_SECRET, token);
  } catch {
    return null;
  }
};

const requireOwnerSession = async (request, env) => {
  const session = await getSession(request, env);
  if (!session || session.login !== (env.GITHUB_ALLOWED_LOGIN || env.GITHUB_OWNER)) {
    const error = new Error("UNAUTHORIZED");
    error.status = 401;
    throw error;
  }
  return session;
};

const makeRedirect = (location, headers = {}) =>
  new Response(null, {
    status: 302,
    headers: {
      Location: location,
      ...headers
    }
  });

const handleAuthStart = async (request, env) => {
  const url = new URL(request.url);
  const returnTo = sanitizeReturnTo(url.searchParams.get("returnTo"), env, request);
  const stateToken = await signPayload(env.SESSION_SECRET, {
    kind: "auth-state",
    returnTo,
    nonce: crypto.randomUUID(),
    exp: Math.floor(Date.now() / 1000) + STATE_TTL_SECONDS
  });

  const authorizeUrl = new URL("https://github.com/login/oauth/authorize");
  authorizeUrl.searchParams.set("client_id", env.GITHUB_APP_CLIENT_ID);
  authorizeUrl.searchParams.set("state", stateToken);
  authorizeUrl.searchParams.set("allow_signup", "false");

  return makeRedirect(authorizeUrl.toString());
};

const handleAuthCallback = async (request, env) => {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const stateToken = url.searchParams.get("state");

  if (!code || !stateToken) {
    return json({ message: "缺少 GitHub 登录回调参数。" }, 400);
  }

  let statePayload;
  try {
    statePayload = await verifySignedPayload(env.SESSION_SECRET, stateToken);
  } catch {
    return json({ message: "登录状态校验失败，请重新发起授权。" }, 400);
  }

  let userToken;
  try {
    userToken = await exchangeCodeForUserToken(env, code);
  } catch (error) {
    return json(
      {
        message: `GitHub 登录令牌交换失败：${String(error?.message || "AUTH_TOKEN_EXCHANGE_FAILED")}`
      },
      Number(error?.status || 502)
    );
  }

  const login = await fetchViewerLogin(userToken);

  if (login !== (env.GITHUB_ALLOWED_LOGIN || env.GITHUB_OWNER)) {
    return json({ message: `当前登录账号 ${login} 不具备站点写权限。` }, 403);
  }

  const sessionToken = await signPayload(env.SESSION_SECRET, {
    kind: "session",
    login,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS
  });

  return makeRedirect(statePayload.returnTo || `${new URL(request.url).origin}${DEFAULT_RETURN_PATH}`, {
    "Set-Cookie": serializeCookie(SESSION_COOKIE, sessionToken, {
      maxAge: SESSION_TTL_SECONDS
    })
  });
};

const handleSession = async (request, env) => {
  const session = await getSession(request, env);

  return withCors(
    json({
      authenticated: Boolean(session),
      canEdit: Boolean(session && session.login === (env.GITHUB_ALLOWED_LOGIN || env.GITHUB_OWNER)),
      login: session?.login || "",
      mode: "remote"
    }),
    request,
    env
  );
};

const handleLogout = async (request, env) =>
  withCors(
    json({ ok: true }, 200, {
      "Set-Cookie": serializeCookie(SESSION_COOKIE, "", {
        maxAge: 0
      })
    }),
    request,
    env
  );

const handleGetTasks = async (request, env) => {
  const data = await fetchTasksFromRepo(env);
  return withCors(json({ ...data, updatedAt: data.board.updatedAt }), request, env);
};

const handlePutTasks = async (request, env) => {
  await requireOwnerSession(request, env);

  let payload;
  try {
    payload = await request.json();
  } catch {
    return withCors(json({ message: "请求体不是有效的 JSON。" }, 400), request, env);
  }

  if (!payload || typeof payload !== "object" || !payload.board) {
    return withCors(json({ message: "缺少任务板内容。" }, 400), request, env);
  }

  try {
    const result = await commitTasksToRepo(env, payload.board, String(payload.baseSha || ""));
    return withCors(json(result), request, env);
  } catch (error) {
    if (error?.status === 409) {
      return withCors(json({ message: "远端任务板已变化，请刷新后重试。" }, 409), request, env);
    }
    throw error;
  }
};

const handleGetPosts = async (request, env) => {
  const url = new URL(request.url);
  const data = await fetchPostsFromRepo(env, String(url.searchParams.get("file") || "").trim());
  return withCors(json(data), request, env);
};

const handlePutPost = async (request, env) => {
  await requireOwnerSession(request, env);

  let payload;
  try {
    payload = await request.json();
  } catch {
    return withCors(json({ message: "请求体不是有效的 JSON。" }, 400), request, env);
  }

  if (!payload || typeof payload !== "object" || !payload.post) {
    return withCors(json({ message: "缺少文章内容。" }, 400), request, env);
  }

  const result = await commitPostToRepo(
    env,
    payload.post,
    String(payload.originalFile || ""),
    payload.base && typeof payload.base === "object" ? payload.base : {},
    payload.assets && typeof payload.assets === "object" ? payload.assets : {}
  );
  return withCors(json(result), request, env);
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return withCors(new Response(null, { status: 204 }), request, env);
    }

    try {
      if (url.pathname === "/api/auth/start" && request.method === "GET") {
        return handleAuthStart(request, env);
      }

      if (url.pathname === "/api/auth/callback" && request.method === "GET") {
        return handleAuthCallback(request, env);
      }

      if (url.pathname === "/api/session" && request.method === "GET") {
        return handleSession(request, env);
      }

      if (url.pathname === "/api/logout" && request.method === "POST") {
        return handleLogout(request, env);
      }

      if (url.pathname === "/api/tasks" && request.method === "GET") {
        return handleGetTasks(request, env);
      }

      if (url.pathname === "/api/tasks" && request.method === "PUT") {
        return handlePutTasks(request, env);
      }

      if (url.pathname === "/api/posts" && request.method === "GET") {
        return handleGetPosts(request, env);
      }

      if (url.pathname === "/api/posts" && request.method === "PUT") {
        return handlePutPost(request, env);
      }

      return withCors(
        json({
          name: "qihai-site-api",
          routes: [
            "GET /api/session",
            "GET /api/auth/start",
            "GET /api/auth/callback",
            "POST /api/logout",
            "GET /api/tasks",
            "PUT /api/tasks",
            "GET /api/posts?file=example.md",
            "PUT /api/posts"
          ]
        }),
        request,
        env
      );
    } catch (error) {
      const status = Number(error?.status || 500);
      console.error("Worker request failed", {
        path: url.pathname,
        method: request.method,
        status,
        message: String(error?.message || "UNKNOWN_ERROR"),
        stack: typeof error?.stack === "string" ? error.stack : ""
      });
      return withCors(
        json(
          {
            message: status >= 500 ? "Worker 处理请求时发生错误。" : String(error?.message || "请求失败")
          },
          status
        ),
        request,
        env
      );
    }
  }
};
