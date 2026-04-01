import { tasksPage } from "./components/tasksPage.js";
import { setupThemeToggle } from "./lib/theme.js";
import { initNebulaBackground } from "./lib/nebulaBackground.js";
import { loadSiteConfig } from "./lib/siteConfig.js";
import {
  buildAuthStartUrl,
  fetchRemoteBoard,
  fetchSession,
  hasRemoteApi,
  logoutRemoteSession,
  pushRemoteBoard
} from "./lib/tasksApi.js";
import {
  cloneBoard,
  createInitialBoard,
  createTask,
  deleteTask,
  getTaskMap,
  moveTaskToPosition,
  normalizeBoard,
  updateTaskField
} from "./lib/tasksModel.js";
import { loadTaskState, saveTaskState } from "./lib/tasksStore.js";

document.querySelector("#app").innerHTML = tasksPage();
document.body.classList.add("tasks-page");
setupThemeToggle();
initNebulaBackground();

const revealNodes = document.querySelectorAll(".reveal");
const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("in");
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.22 }
);

revealNodes.forEach((node) => revealObserver.observe(node));

const state = {
  config: null,
  session: {
    authenticated: false,
    canEdit: false,
    login: "",
    mode: "local"
  },
  board: createInitialBoard(),
  draftBoard: createInitialBoard(),
  syncedBoard: createInitialBoard(),
  dirtyTaskIds: new Set(),
  editingTaskIds: new Set(),
  baseSha: "",
  pendingSync: false,
  hasDraft: false,
  syncStatus: "loading",
  syncMessage: "正在读取任务板...",
  lastSyncedAt: "",
  online: navigator.onLine !== false,
  syncInFlight: false,
  dragTaskId: "",
  dropPlaceholder: null
};

const escapeText = (value) =>
  String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const formatDateTime = (iso) => {
  if (!iso) return "暂未同步";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "暂未同步";

  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
};

const canSync = () => hasRemoteApi(state.config) && state.session.canEdit;
const canEdit = () => canSync() || !hasRemoteApi(state.config);
const getVisibleBoard = () => (canEdit() ? state.draftBoard : state.board);
const hasAppliedTask = (taskId) => state.board.tasks.some((task) => task.id === taskId);
const hasDraftTask = (taskId) => state.draftBoard.tasks.some((task) => task.id === taskId);
const isTaskDirty = (taskId) => state.dirtyTaskIds.has(taskId);
const isTaskEditing = (taskId) => state.editingTaskIds.has(taskId) || isTaskDirty(taskId) || !hasAppliedTask(taskId);
const canDragTask = (taskId) => canEdit() && hasAppliedTask(taskId) && !isTaskDirty(taskId) && !state.editingTaskIds.has(taskId);

const setSyncState = (status, message) => {
  state.syncStatus = status;
  state.syncMessage = message;
  renderTopBar();
};

const toComparableBoard = (board) => {
  const normalized = normalizeBoard(board);

  return {
    version: normalized.version,
    title: normalized.title,
    columns: normalized.columns.map((column) => ({
      id: column.id,
      title: column.title,
      taskIds: [...column.taskIds]
    })),
    tasks: normalized.tasks
      .map((task) => ({
        id: task.id,
        title: task.title,
        description: task.description,
        tags: [...task.tags],
        columnId: task.columnId,
        createdAt: task.createdAt
      }))
      .sort((left, right) => left.id.localeCompare(right.id))
  };
};

const areBoardsEquivalent = (leftBoard, rightBoard) =>
  JSON.stringify(toComparableBoard(leftBoard)) === JSON.stringify(toComparableBoard(rightBoard));

const computeDirtyTaskIds = (appliedBoard, draftBoard) => {
  const dirty = new Set();
  const appliedMap = getTaskMap(appliedBoard);
  const draftMap = getTaskMap(draftBoard);
  const ids = new Set([...appliedMap.keys(), ...draftMap.keys()]);

  ids.forEach((taskId) => {
    const appliedTask = appliedMap.get(taskId);
    const draftTask = draftMap.get(taskId);

    if (!appliedTask || !draftTask) {
      dirty.add(taskId);
      return;
    }

    const sameFields =
      appliedTask.title === draftTask.title &&
      appliedTask.description === draftTask.description &&
      JSON.stringify(appliedTask.tags) === JSON.stringify(draftTask.tags) &&
      appliedTask.columnId === draftTask.columnId;

    if (!sameFields) {
      dirty.add(taskId);
    }
  });

  return dirty;
};

const refreshDerivedState = () => {
  state.dirtyTaskIds = computeDirtyTaskIds(state.board, state.draftBoard);
  state.hasDraft = state.dirtyTaskIds.size > 0;
  state.pendingSync = canSync() && !areBoardsEquivalent(state.board, state.syncedBoard);
};

const persistState = async () => {
  refreshDerivedState();
  await saveTaskState({
    board: state.draftBoard,
    meta: {
      appliedBoard: state.board,
      syncedBoard: state.syncedBoard,
      baseSha: state.baseSha,
      pendingSync: state.pendingSync,
      hasDraft: state.hasDraft,
      lastSyncedAt: state.lastSyncedAt,
      configApiBase: state.config?.apiBaseUrl || ""
    }
  });
};

const clearDragArtifacts = () => {
  document.querySelectorAll(".task-column-body.is-drop-target").forEach((node) => {
    node.classList.remove("is-drop-target");
  });

  document.querySelectorAll(".task-card.is-dragging").forEach((node) => {
    node.classList.remove("is-dragging");
  });

  if (state.dropPlaceholder?.parentNode) {
    state.dropPlaceholder.parentNode.removeChild(state.dropPlaceholder);
  }

  state.dropPlaceholder = null;
  state.dragTaskId = "";
};

const ensureDropPlaceholder = () => {
  if (state.dropPlaceholder) return state.dropPlaceholder;

  const placeholder = document.createElement("div");
  placeholder.className = "task-drop-placeholder";
  placeholder.innerHTML = "<span>拖到这里</span>";
  state.dropPlaceholder = placeholder;
  return placeholder;
};

const getRenderableDropCards = (body, taskId) =>
  Array.from(body.querySelectorAll('.task-card[data-applied="true"]')).filter((card) => card.dataset.taskId !== taskId);

const getDropIndex = (body, taskId) => {
  const placeholder = state.dropPlaceholder;
  if (!placeholder || placeholder.parentElement !== body) {
    return getRenderableDropCards(body, taskId).length;
  }

  let index = 0;
  Array.from(body.children).forEach((child) => {
    if (child === placeholder) return;
    if (child instanceof HTMLElement && child.matches('.task-card[data-applied="true"]') && child.dataset.taskId !== taskId) {
      index += 1;
    }
  });

  return index;
};

const positionDropPlaceholder = (body, taskId, clientY) => {
  document.querySelectorAll(".task-column-body.is-drop-target").forEach((node) => {
    if (node !== body) {
      node.classList.remove("is-drop-target");
    }
  });

  const placeholder = ensureDropPlaceholder();
  const cards = getRenderableDropCards(body, taskId);
  body.classList.add("is-drop-target");

  const target = cards.find((card) => {
    const rect = card.getBoundingClientRect();
    return clientY < rect.top + rect.height / 2;
  });

  if (target) {
    body.insertBefore(placeholder, target);
  } else {
    body.appendChild(placeholder);
  }
};

const getInsertionIndexFromDraft = (taskId, targetColumnId) => {
  const draftColumn = state.draftBoard.columns.find((column) => column.id === targetColumnId);
  if (!draftColumn) return 0;

  const draftIds = draftColumn.taskIds.filter((id) => id === taskId || hasAppliedTask(id));
  const index = draftIds.indexOf(taskId);
  return index === -1 ? draftIds.length : index;
};

const updateDraftBoard = async (nextBoard, options = {}) => {
  state.draftBoard = normalizeBoard(nextBoard);
  await persistState();
  renderTopBar();

  if (options.renderBoard !== false) {
    renderBoard();
  }
};

const openTaskEditor = async (taskId) => {
  state.editingTaskIds.add(taskId);
  await persistState();
  renderTopBar();
  renderBoard();
  setSyncState("draft", "卡片已进入编辑状态。修改完成后点 ✔ 应用，再决定是否同步到 GitHub。");
};

const discardTaskDraft = async (taskId) => {
  if (!hasDraftTask(taskId)) return;

  const existedInBoard = hasAppliedTask(taskId);
  let nextDraft = cloneBoard(state.draftBoard);

  if (existedInBoard) {
    const appliedBoard = cloneBoard(state.board);
    const appliedMap = getTaskMap(appliedBoard);
    const appliedTask = appliedMap.get(taskId);
    const draftTask = nextDraft.tasks.find((task) => task.id === taskId);
    const appliedColumn = appliedBoard.columns.find((column) => column.id === appliedTask?.columnId);
    const appliedIndex = appliedColumn ? appliedColumn.taskIds.indexOf(taskId) : 0;

    if (!appliedTask || !draftTask) {
      return;
    }

    draftTask.title = appliedTask.title;
    draftTask.description = appliedTask.description;
    draftTask.tags = [...appliedTask.tags];
    draftTask.columnId = appliedTask.columnId;
    draftTask.createdAt = appliedTask.createdAt;
    draftTask.updatedAt = appliedTask.updatedAt;
    nextDraft = moveTaskToPosition(nextDraft, taskId, appliedTask.columnId, appliedIndex);
    const revertedTask = nextDraft.tasks.find((task) => task.id === taskId);
    if (revertedTask) {
      revertedTask.updatedAt = appliedTask.updatedAt;
    }
    nextDraft.updatedAt = state.board.updatedAt;
    nextDraft.updatedBy = state.board.updatedBy;
  } else {
    nextDraft = deleteTask(nextDraft, taskId);
  }

  state.draftBoard = normalizeBoard(nextDraft);
  state.editingTaskIds.delete(taskId);
  await persistState();
  renderTopBar();
  renderBoard();

  const nextStatus = state.hasDraft ? "draft" : state.pendingSync ? "pending" : canSync() ? "saved" : "local";
  const nextMessage = existedInBoard
    ? state.pendingSync
      ? "已退出编辑，并保留当前任务板中的待同步修改。"
      : "已退出编辑，这张卡片未应用的修改已放弃。"
    : "已取消这张尚未应用的新卡片。";

  setSyncState(nextStatus, nextMessage);
};

const confirmDeleteTask = (taskId) => {
  const taskMap = getTaskMap(state.draftBoard);
  const task = taskMap.get(taskId);
  const label = task?.title || "这张任务卡片";

  if (typeof window === "undefined" || typeof window.confirm !== "function") {
    return true;
  }

  return window.confirm(
    `确认删除“${label}”吗？${canSync() ? "删除后需要你手动同步，GitHub 仓库中的任务板才会更新。" : ""}`
  );
};

const applyTask = async (taskId) => {
  if (!hasDraftTask(taskId)) return;

  const draftMap = getTaskMap(state.draftBoard);
  const draftTask = draftMap.get(taskId);
  if (!draftTask) return;

  if (!isTaskDirty(taskId)) {
    state.editingTaskIds.delete(taskId);
    await persistState();
    renderTopBar();
    renderBoard();
    setSyncState(
      state.pendingSync && canSync() ? "pending" : canSync() ? "saved" : "local",
      state.pendingSync && canSync()
        ? "当前有已应用但未同步的任务板修改。"
        : canSync()
          ? "已收起编辑状态。当前卡片可以拖拽排序。"
          : "已收起编辑状态。当前任务板保存在本地浏览器中。"
    );
    return;
  }

  let nextBoard = cloneBoard(state.board);
  const existingTask = nextBoard.tasks.find((task) => task.id === taskId);
  if (existingTask) {
    existingTask.title = draftTask.title;
    existingTask.description = draftTask.description;
    existingTask.tags = [...draftTask.tags];
    existingTask.columnId = draftTask.columnId;
    existingTask.updatedAt = new Date().toISOString();
  } else {
    nextBoard.tasks.push({
      ...draftTask,
      tags: [...draftTask.tags],
      updatedAt: new Date().toISOString()
    });
  }

  const targetIndex = getInsertionIndexFromDraft(taskId, draftTask.columnId);
  nextBoard = moveTaskToPosition(nextBoard, taskId, draftTask.columnId, targetIndex);

  state.board = normalizeBoard(nextBoard);
  state.editingTaskIds.delete(taskId);
  await persistState();
  renderTopBar();
  renderBoard();

  if (canSync()) {
    setSyncState("pending", "卡片已应用到任务板。现在可以继续拖拽排序，或手动同步到 GitHub。");
  } else {
    setSyncState("local", "卡片已应用到本地任务板，并保存在浏览器中。");
  }
};

const removeTaskCard = async (taskId) => {
  const existedInBoard = hasAppliedTask(taskId);

  state.draftBoard = deleteTask(state.draftBoard, taskId);
  if (existedInBoard) {
    state.board = deleteTask(state.board, taskId);
  }

  state.editingTaskIds.delete(taskId);
  await persistState();
  renderTopBar();
  renderBoard();

  if (existedInBoard && canSync()) {
    setSyncState("pending", "卡片已删除。当前任务板存在待同步修改。");
  } else if (existedInBoard) {
    setSyncState("local", "卡片已从本地任务板删除。");
  } else {
    setSyncState("draft", "已放弃这张未应用的新卡片。");
  }
};

const createDraftTask = async (columnId) => {
  const beforeIds = new Set(state.draftBoard.tasks.map((task) => task.id));
  const nextDraft = createTask(state.draftBoard, columnId || "backlog");
  const newTask = nextDraft.tasks.find((task) => !beforeIds.has(task.id));
  state.draftBoard = normalizeBoard(nextDraft);
  if (newTask) {
    state.editingTaskIds.add(newTask.id);
  }
  await persistState();
  renderTopBar();
  renderBoard();
  setSyncState("draft", "新卡片已创建。填写内容后点 ✔ 应用，它才会进入可拖拽和待同步状态。");
};

const moveAppliedTask = async (taskId, targetColumnId, targetIndex) => {
  const nextApplied = moveTaskToPosition(state.board, taskId, targetColumnId, targetIndex);
  const nextDraft = moveTaskToPosition(state.draftBoard, taskId, targetColumnId, targetIndex);

  if (areBoardsEquivalent(nextApplied, state.board)) {
    clearDragArtifacts();
    return;
  }

  state.board = normalizeBoard(nextApplied);
  state.draftBoard = normalizeBoard(nextDraft);
  await persistState();
  renderTopBar();
  renderBoard();

  if (canSync()) {
    setSyncState("pending", "卡片顺序已调整。当前任务板存在待同步修改。");
  } else {
    setSyncState("local", "卡片顺序已调整，并保存在本地任务板中。");
  }
};

const discardLocalChanges = async () => {
  if (!hasRemoteApi(state.config) || state.syncInFlight) return;

  if (typeof window !== "undefined" && typeof window.confirm === "function") {
    const confirmed = window.confirm("放弃当前未同步的本地修改，并恢复为 GitHub 仓库中的任务板吗？");
    if (!confirmed) {
      return;
    }
  }

  state.syncInFlight = true;
  renderTopBar();
  setSyncState("syncing", "正在恢复 GitHub 仓库中的任务板...");

  try {
    const remoteBoard = await fetchRemoteBoard(state.config);
    state.board = normalizeBoard(remoteBoard.board);
    state.draftBoard = cloneBoard(state.board);
    state.syncedBoard = cloneBoard(state.board);
    state.baseSha = String(remoteBoard.sha || "");
    state.lastSyncedAt = String(remoteBoard.updatedAt || state.board.updatedAt);
    state.editingTaskIds.clear();
    await persistState();
    renderTopBar();
    renderBoard();
    setSyncState("saved", "已放弃本地未同步修改，任务板已恢复为 GitHub 仓库中的版本。");
  } catch (error) {
    if (!state.online) {
      setSyncState("offline", "当前离线，暂时无法恢复 GitHub 仓库中的任务板。");
    } else {
      setSyncState("error", `恢复失败：${String(error?.message || "网络异常")}`);
    }
  } finally {
    state.syncInFlight = false;
    renderTopBar();
  }
};

const renderTopBar = () => {
  const modeCopy = document.querySelector("#tasks-mode-copy");
  const modeBadge = document.querySelector("#task-mode-badge");
  const syncBadge = document.querySelector("#task-sync-badge");
  const alert = document.querySelector("#tasks-alert");
  const meta = document.querySelector("#tasks-board-meta");
  const loginButton = document.querySelector("#task-login-button");
  const syncButton = document.querySelector("#task-sync-button");
  const discardButton = document.querySelector("#task-discard-button");
  const logoutButton = document.querySelector("#task-logout-button");

  if (!modeCopy || !modeBadge || !syncBadge || !alert || !meta || !loginButton || !syncButton || !discardButton || !logoutButton) {
    return;
  }

  refreshDerivedState();
  const board = getVisibleBoard();
  const totalTasks = board.tasks.length;
  const syncTextMap = {
    loading: "正在初始化",
    local: "本地草稿模式",
    readonly: "只读浏览",
    draft: "卡片草稿中",
    pending: "待手动同步",
    syncing: "同步中",
    saved: "已连接远端",
    offline: "离线中",
    error: "同步异常",
    conflict: "远端冲突"
  };

  if (!hasRemoteApi(state.config)) {
    modeCopy.textContent = "当前没有配置远端 API。你可以先编辑卡片、应用、拖拽排序，所有内容仅保存在本地浏览器。";
    modeBadge.textContent = "本地模式";
    modeBadge.className = "task-pill task-pill-local";
  } else if (state.session.canEdit) {
    modeCopy.textContent = `已登录 ${state.session.login || "qihaichiaki"}。卡片先编辑并单独应用，进入任务板后再手动同步到 GitHub。`;
    modeBadge.textContent = "可编辑";
    modeBadge.className = "task-pill task-pill-live";
  } else {
    modeCopy.textContent = "当前是只读浏览模式。登录 GitHub 后，才允许把任务板写回仓库。";
    modeBadge.textContent = state.session.authenticated ? "权限不足" : "只读访客";
    modeBadge.className = "task-pill task-pill-readonly";
  }

  syncBadge.textContent = syncTextMap[state.syncStatus] || state.syncMessage;
  syncBadge.className = `task-pill task-pill-soft sync-${state.syncStatus}`;

  alert.className = `tasks-alert tasks-alert-${state.syncStatus}`;
  alert.textContent = state.syncMessage;

  meta.innerHTML = `
    <span>任务数 ${totalTasks}</span>
    <span>未应用卡片 ${state.dirtyTaskIds.size}</span>
    <span>最近同步 ${formatDateTime(state.lastSyncedAt)}</span>
    <span>待同步 ${state.pendingSync ? "是" : "否"}</span>
    <span>SHA ${escapeText(state.baseSha ? state.baseSha.slice(0, 7) : "local")}</span>
  `;

  loginButton.classList.toggle("is-hidden", !hasRemoteApi(state.config) || state.session.authenticated);
  if (!loginButton.classList.contains("is-hidden")) {
    loginButton.href = buildAuthStartUrl(state.config, window.location.href);
  }

  syncButton.classList.toggle("is-hidden", !(canSync() && (state.pendingSync || state.syncInFlight)));
  syncButton.disabled = state.syncInFlight || !state.online || state.hasDraft || !state.pendingSync;
  if (state.syncInFlight) {
    syncButton.textContent = "同步中...";
  } else {
    syncButton.textContent = "手动同步";
  }

  discardButton.classList.toggle("is-hidden", !(canSync() && (state.hasDraft || state.pendingSync || state.syncInFlight)));
  discardButton.disabled = state.syncInFlight || !state.online;

  logoutButton.classList.toggle("is-hidden", !state.session.authenticated);
};

const renderBoard = () => {
  const root = document.querySelector("#tasks-board-columns");
  if (!root) return;

  clearDragArtifacts();
  refreshDerivedState();

  const board = getVisibleBoard();
  const taskMap = getTaskMap(board);
  const editable = canEdit();

  root.innerHTML = board.columns
    .map((column) => {
      const cards = column.taskIds
        .map((taskId) => taskMap.get(taskId))
        .filter(Boolean)
        .map((task) => {
          const tagsText = task.tags.join(", ");
          const dirty = isTaskDirty(task.id);
          const editing = editable && isTaskEditing(task.id);
          const applied = hasAppliedTask(task.id);
          const draggable = editable && canDragTask(task.id);

          const headActions = editing
            ? `
                <div class="task-card-tools task-card-tools-editing">
                  <button class="task-card-icon task-card-icon-apply" type="button" data-action="apply-task" title="应用卡片">✔</button>
                  <button class="task-card-icon task-card-icon-close" type="button" data-action="close-task-editor" title="退出编辑">x</button>
                  <button class="task-card-icon task-card-icon-delete" type="button" data-action="delete-task" title="删除卡片">🗑</button>
                </div>
              `
            : `
                <div class="task-card-tools">
                  ${editable ? '<button class="task-card-icon task-card-icon-edit" type="button" data-action="edit-task" title="再次编辑">✎</button>' : ""}
                  ${draggable ? '<span class="task-drag-handle" draggable="true" title="拖拽排序或跨列移动">⋮⋮</span>' : ""}
                </div>
              `;

          return `
            <article class="task-card${dirty ? " is-dirty" : ""}${editing ? " is-editing" : ""}" data-task-id="${escapeText(task.id)}" data-applied="${applied ? "true" : "false"}" data-column-id="${escapeText(column.id)}">
              <div class="task-card-head">
                <span class="task-card-date">${formatDateTime(task.updatedAt)}</span>
                ${headActions}
              </div>
              ${
                editing
                  ? `
                    <input class="task-title-input" data-field="title" type="text" value="${escapeText(task.title)}" maxlength="120" />
                    <textarea class="task-desc-input" data-field="description" rows="4" placeholder="补充任务说明">${escapeText(task.description)}</textarea>
                    <input class="task-tags-input" data-field="tags" type="text" value="${escapeText(tagsText)}" placeholder="标签，使用逗号分隔" />
                  `
                  : `
                    <h3>${escapeText(task.title)}</h3>
                    <p>${escapeText(task.description || "暂无任务说明。")}</p>
                    <div class="task-tags">
                      ${
                        task.tags.length
                          ? task.tags.map((tag) => `<span class="task-chip">${escapeText(tag)}</span>`).join("")
                          : '<span class="task-chip task-chip-muted">未设置标签</span>'
                      }
                    </div>
                  `
              }
            </article>
          `;
        })
        .join("");

      return `
        <section class="task-column" data-column-id="${escapeText(column.id)}">
          <header class="task-column-head">
            <div>
              <p class="section-tag">${escapeText(column.id.toUpperCase())}</p>
              <h3>${escapeText(column.title)}</h3>
            </div>
            <span class="task-column-count">${column.taskIds.length}</span>
          </header>
          <div class="task-column-body" data-column-id="${escapeText(column.id)}">
            ${cards || '<p class="task-column-empty">拖进一张卡片，或者先创建一个新的任务。</p>'}
          </div>
          ${editable ? `<button class="btn btn-sub task-add-btn" type="button" data-column-id="${escapeText(column.id)}">新增任务</button>` : ""}
        </section>
      `;
    })
    .join("");
};

const syncBoard = async () => {
  if (!canSync() || state.syncInFlight) return;

  refreshDerivedState();
  if (state.hasDraft) {
    setSyncState("draft", "还有未应用的卡片修改，请先在卡片上点 ✔ 应用。");
    return;
  }

  if (!state.pendingSync) {
    setSyncState("saved", "当前没有待同步内容。任务板已经是最新应用状态。");
    return;
  }

  state.syncInFlight = true;
  renderTopBar();
  setSyncState("syncing", "正在将任务板写回 GitHub 仓库...");

  try {
    const result = await pushRemoteBoard(state.config, state.board, state.baseSha);
    state.board = normalizeBoard(result.board || state.board);
    state.draftBoard = cloneBoard(state.board);
    state.syncedBoard = cloneBoard(state.board);
    state.baseSha = String(result.sha || "");
    state.lastSyncedAt = String(result.updatedAt || new Date().toISOString());
    state.editingTaskIds.clear();
    await persistState();
    renderTopBar();
    renderBoard();
    setSyncState("saved", "任务板已经同步到 GitHub 仓库。Worker 会直接创建或更新 content/tasks/board.json。");
  } catch (error) {
    if (error?.status === 409) {
      setSyncState("conflict", "远端任务板已经变化，请刷新页面后决定是否覆盖。");
    } else if (!state.online) {
      setSyncState("offline", "当前离线，已应用的任务板仍保存在本地，等你联网后再手动同步。");
    } else {
      setSyncState("error", `同步失败：${String(error?.message || "网络异常")}`);
    }
  } finally {
    state.syncInFlight = false;
    renderTopBar();
  }
};

const loadStaticBoard = async () => {
  try {
    const response = await fetch("./content/tasks/board.json", { cache: "no-cache" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return normalizeBoard(await response.json());
  } catch {
    return createInitialBoard();
  }
};

const bootstrapBoard = async () => {
  state.config = await loadSiteConfig();

  const [persisted, staticBoard] = await Promise.all([loadTaskState(), loadStaticBoard()]);
  let remoteBoard = null;
  let remoteBoardError = null;

  if (hasRemoteApi(state.config)) {
    try {
      state.session = await fetchSession(state.config);
    } catch (error) {
      state.session = {
        authenticated: false,
        canEdit: false,
        login: "",
        mode: "remote"
      };
      setSyncState("error", `远端会话检查失败：${String(error?.message || "网络异常")}`);
    }

    try {
      remoteBoard = await fetchRemoteBoard(state.config);
    } catch (error) {
      remoteBoardError = error;
    }
  } else {
    state.session = {
      authenticated: false,
      canEdit: false,
      login: "",
      mode: "local"
    };
  }

  state.syncedBoard = normalizeBoard(remoteBoard?.board || persisted.meta?.syncedBoard || staticBoard);
  state.board = normalizeBoard(remoteBoard?.board || persisted.meta?.appliedBoard || state.syncedBoard);
  state.draftBoard = canEdit() ? normalizeBoard(persisted.board || state.board) : cloneBoard(state.board);
  state.baseSha = String(remoteBoard?.sha || persisted.meta?.baseSha || "");
  state.lastSyncedAt = String(remoteBoard?.updatedAt || persisted.meta?.lastSyncedAt || state.syncedBoard.updatedAt);
  refreshDerivedState();
  state.editingTaskIds = new Set(state.dirtyTaskIds);

  await persistState();
  renderTopBar();
  renderBoard();

  if (!hasRemoteApi(state.config)) {
    setSyncState("local", "当前未配置 Worker 地址，任务板只保存在浏览器本地。");
    return;
  }

  if (remoteBoardError) {
    setSyncState("error", `远端任务板读取失败：${String(remoteBoardError?.message || "网络异常")}`);
    return;
  }

  if (state.hasDraft) {
    setSyncState("draft", "检测到未应用的卡片草稿。请先在卡片上点 ✔ 应用。");
    return;
  }

  if (state.pendingSync && canSync()) {
    setSyncState("pending", "当前有已应用但未同步到 GitHub 的任务板修改。");
    return;
  }

  if (state.session.canEdit) {
    setSyncState("saved", "当前任务板已经连接远端。已应用的卡片可以拖拽，最终再手动同步到 GitHub。");
    return;
  }

  setSyncState("readonly", "当前是只读浏览模式。登录 GitHub 后，才允许同步到仓库。");
};

const handleTaskFieldInput = async (element) => {
  const card = element.closest(".task-card");
  const taskId = card?.dataset.taskId;
  if (!taskId) return;

  if (element.dataset.field === "tags") {
    const tags = element.value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    await updateDraftBoard(updateTaskField(state.draftBoard, taskId, "tags", tags), { renderBoard: false });
  } else {
    await updateDraftBoard(updateTaskField(state.draftBoard, taskId, element.dataset.field, element.value), { renderBoard: false });
  }

  setSyncState("draft", "这张卡片存在未应用修改。点 ✔ 应用后，才会进入任务板。");
};

const bindInteractions = () => {
  const boardRoot = document.querySelector("#tasks-board-columns");
  const syncButton = document.querySelector("#task-sync-button");
  const discardButton = document.querySelector("#task-discard-button");
  const logoutButton = document.querySelector("#task-logout-button");

  if (boardRoot) {
    boardRoot.addEventListener("click", async (event) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (!target) return;

      const addButton = target.closest(".task-add-btn");
      if (addButton) {
        await createDraftTask(addButton.dataset.columnId || "backlog");
        return;
      }

      const actionButton = target.closest("[data-action]");
      if (!actionButton) return;

      const card = actionButton.closest(".task-card");
      const taskId = card?.dataset.taskId;
      if (!taskId) return;

      if (actionButton.dataset.action === "edit-task") {
        await openTaskEditor(taskId);
      } else if (actionButton.dataset.action === "apply-task") {
        await applyTask(taskId);
      } else if (actionButton.dataset.action === "close-task-editor") {
        await discardTaskDraft(taskId);
      } else if (actionButton.dataset.action === "delete-task") {
        if (!confirmDeleteTask(taskId)) {
          return;
        }
        await removeTaskCard(taskId);
      }
    });

    boardRoot.addEventListener("input", (event) => {
      const target = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement ? event.target : null;
      if (!target || !target.dataset.field) return;
      handleTaskFieldInput(target);
    });

    boardRoot.addEventListener("dragstart", (event) => {
      if (!canEdit()) return;

      const handle = event.target instanceof HTMLElement ? event.target.closest(".task-drag-handle") : null;
      if (!(handle instanceof HTMLElement)) {
        event.preventDefault();
        return;
      }

      const card = handle.closest(".task-card");
      if (!(card instanceof HTMLElement)) {
        event.preventDefault();
        return;
      }

      const taskId = card.dataset.taskId || "";
      if (!taskId || !canDragTask(taskId)) {
        event.preventDefault();
        return;
      }

      state.dragTaskId = taskId;
      if (event.dataTransfer) {
        event.dataTransfer.setData("text/plain", taskId);
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.dropEffect = "move";
        event.dataTransfer.setDragImage(card, Math.min(card.clientWidth / 2, 120), 24);
      }

      window.requestAnimationFrame(() => {
        card.classList.add("is-dragging");
      });
    });

    boardRoot.addEventListener("dragover", (event) => {
      if (!state.dragTaskId) return;
      const body = event.target instanceof HTMLElement ? event.target.closest(".task-column-body") : null;
      if (!(body instanceof HTMLElement)) return;

      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = "move";
      }
      positionDropPlaceholder(body, state.dragTaskId, event.clientY);
    });

    boardRoot.addEventListener("drop", async (event) => {
      if (!state.dragTaskId) return;
      const body = event.target instanceof HTMLElement ? event.target.closest(".task-column-body") : null;
      if (!(body instanceof HTMLElement)) return;

      event.preventDefault();
      const taskId = state.dragTaskId;
      const targetColumnId = body.dataset.columnId || "backlog";
      const targetIndex = getDropIndex(body, taskId);
      clearDragArtifacts();
      await moveAppliedTask(taskId, targetColumnId, targetIndex);
    });

    boardRoot.addEventListener("dragend", () => {
      clearDragArtifacts();
    });
  }

  if (syncButton) {
    syncButton.addEventListener("click", () => {
      syncBoard();
    });
  }

  if (discardButton) {
    discardButton.addEventListener("click", () => {
      discardLocalChanges();
    });
  }

  if (logoutButton) {
    logoutButton.addEventListener("click", async () => {
      try {
        await logoutRemoteSession(state.config);
      } catch {
        // ignore logout failures
      }

      state.session = {
        authenticated: false,
        canEdit: false,
        login: "",
        mode: hasRemoteApi(state.config) ? "remote" : "local"
      };
      state.draftBoard = cloneBoard(state.board);
      state.editingTaskIds.clear();
      await persistState();
      renderTopBar();
      renderBoard();
      setSyncState("readonly", "已退出登录。当前任务板恢复为只读浏览状态。");
    });
  }

  window.addEventListener("online", () => {
    state.online = true;
    renderTopBar();
    if (state.pendingSync && !state.hasDraft && canSync()) {
      setSyncState("pending", "网络已恢复。当前有待同步内容，点击“同步到 GitHub”即可写回仓库。");
    }
  });

  window.addEventListener("offline", () => {
    state.online = false;
    if (state.pendingSync) {
      setSyncState("offline", "网络已断开。已应用的任务板仍保存在本地，待你联网后再同步。");
    }
    renderTopBar();
  });
};

bindInteractions();
bootstrapBoard();
