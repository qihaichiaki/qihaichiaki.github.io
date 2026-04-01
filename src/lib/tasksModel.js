const DEFAULT_COLUMNS = [
  { id: "backlog", title: "待整理" },
  { id: "active", title: "进行中" },
  { id: "done", title: "已完成" }
];

const DEFAULT_TIMESTAMP = "2026-04-01T00:00:00.000Z";

const cloneJson = (value) => JSON.parse(JSON.stringify(value));
const asArray = (value) => (Array.isArray(value) ? value : []);

const clampIndex = (value, min, max) => Math.min(Math.max(value, min), max);

export const createInitialBoard = () => ({
  version: 1,
  title: "qihai task board",
  updatedAt: DEFAULT_TIMESTAMP,
  updatedBy: "system",
  columns: DEFAULT_COLUMNS.map((column) => ({
    ...column,
    taskIds: []
  })),
  tasks: []
});

const normalizeTask = (task, fallbackColumnId) => {
  const now = new Date().toISOString();
  const normalized = task && typeof task === "object" ? task : {};
  const title = String(normalized.title || "").trim();

  return {
    id: String(normalized.id || `task-${Math.random().toString(36).slice(2, 10)}`),
    title: title || "未命名任务",
    description: String(normalized.description || "").trim(),
    tags: asArray(normalized.tags)
      .map((item) => String(item || "").trim())
      .filter(Boolean),
    columnId: String(normalized.columnId || fallbackColumnId),
    createdAt: String(normalized.createdAt || now),
    updatedAt: String(normalized.updatedAt || now)
  };
};

export const normalizeBoard = (board) => {
  const source = board && typeof board === "object" ? board : {};
  const tasks = asArray(source.tasks);
  const taskMap = new Map();

  const columns = DEFAULT_COLUMNS.map((column) => {
    const matched = asArray(source.columns).find((item) => item && item.id === column.id);
    const taskIds = asArray(matched?.taskIds).map((id) => String(id));

    return {
      ...column,
      taskIds
    };
  });

  tasks.forEach((task) => {
    const normalized = normalizeTask(task, DEFAULT_COLUMNS[0].id);
    taskMap.set(normalized.id, normalized);
  });

  columns.forEach((column) => {
    column.taskIds = column.taskIds.filter((id) => {
      const task = taskMap.get(id);
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
    updatedAt: String(source.updatedAt || DEFAULT_TIMESTAMP),
    updatedBy: String(source.updatedBy || "system"),
    columns,
    tasks: Array.from(taskMap.values())
  };
};

export const cloneBoard = (board) => cloneJson(normalizeBoard(board));

export const getTaskMap = (board) => {
  const map = new Map();
  normalizeBoard(board).tasks.forEach((task) => {
    map.set(task.id, task);
  });
  return map;
};

export const touchBoard = (board, updatedBy = "qihaichiaki") => {
  board.updatedAt = new Date().toISOString();
  board.updatedBy = updatedBy;
  return board;
};

export const createTask = (board, columnId, updatedBy = "qihaichiaki") => {
  const next = cloneBoard(board);
  const column = next.columns.find((item) => item.id === columnId) || next.columns[0];
  const now = new Date().toISOString();
  const task = {
    id: `task-${Math.random().toString(36).slice(2, 10)}`,
    title: "新的任务",
    description: "",
    tags: [],
    columnId: column.id,
    createdAt: now,
    updatedAt: now
  };

  next.tasks.push(task);
  column.taskIds.unshift(task.id);
  return touchBoard(next, updatedBy);
};

export const updateTaskField = (board, taskId, field, value, updatedBy = "qihaichiaki") => {
  const next = cloneBoard(board);
  const task = next.tasks.find((item) => item.id === taskId);
  if (!task) return next;

  if (field === "tags") {
    task.tags = asArray(value)
      .map((item) => String(item || "").trim())
      .filter(Boolean);
  } else if (field === "title" || field === "description") {
    task[field] = String(value || "");
  }

  task.updatedAt = new Date().toISOString();
  return touchBoard(next, updatedBy);
};

const moveInArray = (items, fromIndex, toIndex) => {
  if (fromIndex < 0 || toIndex < 0 || fromIndex >= items.length || toIndex >= items.length) {
    return items;
  }

  const next = items.slice();
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
};

export const moveTaskWithinColumn = (board, taskId, delta, updatedBy = "qihaichiaki") => {
  const next = cloneBoard(board);
  const column = next.columns.find((item) => item.taskIds.includes(taskId));
  if (!column) return next;

  const index = column.taskIds.indexOf(taskId);
  const target = index + delta;
  if (target < 0 || target >= column.taskIds.length) return next;

  column.taskIds = moveInArray(column.taskIds, index, target);
  return touchBoard(next, updatedBy);
};

export const moveTaskAcrossColumns = (board, taskId, direction, updatedBy = "qihaichiaki") => {
  const next = cloneBoard(board);
  const fromIndex = next.columns.findIndex((item) => item.taskIds.includes(taskId));
  if (fromIndex === -1) return next;

  const toIndex = fromIndex + direction;
  if (toIndex < 0 || toIndex >= next.columns.length) return next;

  const fromColumn = next.columns[fromIndex];
  const toColumn = next.columns[toIndex];
  fromColumn.taskIds = fromColumn.taskIds.filter((id) => id !== taskId);
  toColumn.taskIds.unshift(taskId);

  const task = next.tasks.find((item) => item.id === taskId);
  if (task) {
    task.columnId = toColumn.id;
    task.updatedAt = new Date().toISOString();
  }

  return touchBoard(next, updatedBy);
};

export const moveTaskToPosition = (board, taskId, targetColumnId, targetIndex, updatedBy = "qihaichiaki") => {
  const next = cloneBoard(board);
  const task = next.tasks.find((item) => item.id === taskId);
  const targetColumn = next.columns.find((item) => item.id === targetColumnId);
  if (!task || !targetColumn) return next;

  next.columns.forEach((column) => {
    column.taskIds = column.taskIds.filter((id) => id !== taskId);
  });

  const index = clampIndex(Number.isFinite(targetIndex) ? targetIndex : targetColumn.taskIds.length, 0, targetColumn.taskIds.length);
  targetColumn.taskIds.splice(index, 0, taskId);
  task.columnId = targetColumn.id;
  task.updatedAt = new Date().toISOString();

  return touchBoard(next, updatedBy);
};

export const deleteTask = (board, taskId, updatedBy = "qihaichiaki") => {
  const next = cloneBoard(board);
  next.tasks = next.tasks.filter((item) => item.id !== taskId);
  next.columns.forEach((column) => {
    column.taskIds = column.taskIds.filter((id) => id !== taskId);
  });
  return touchBoard(next, updatedBy);
};
