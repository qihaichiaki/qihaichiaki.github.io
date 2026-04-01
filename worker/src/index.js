import rs from "jsrsasign";

const SESSION_COOKIE = "__Host-qihai-task-session";
const GITHUB_USER_AGENT = "qihai-task-board-api/1.0 (+https://qihaichiaki.github.io)";
const DEFAULT_ALLOWED_ORIGINS = [
  "https://qihaichiaki.github.io",
  "http://127.0.0.1:4173",
  "http://localhost:4173"
];
const DEFAULT_RETURN_PATH = "/tasks.html";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
const STATE_TTL_SECONDS = 60 * 10;

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
    return json({ message: `当前登录账号 ${login} 不具备任务板写权限。` }, 403);
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

      return withCors(
        json({
          name: "qihai-task-board-api",
          routes: [
            "GET /api/session",
            "GET /api/auth/start",
            "GET /api/auth/callback",
            "POST /api/logout",
            "GET /api/tasks",
            "PUT /api/tasks"
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
