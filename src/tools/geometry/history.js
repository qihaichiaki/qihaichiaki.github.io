import { HISTORY_LIMIT, deepClone } from "./model.js";

const signature = (project) => JSON.stringify(project);

/**
 * 可撤销的文档命令。命令只返回工程快照，不直接操作 Fabric 场景。
 * @typedef {Object} Command
 * @property {string} label
 * @property {() => import("./model.js").ProjectDocumentV1} undo
 * @property {() => import("./model.js").ProjectDocumentV1} redo
 */

/**
 * @param {import("./model.js").ProjectDocumentV1} before
 * @param {import("./model.js").ProjectDocumentV1} after
 * @param {string} label
 * @returns {Command}
 */
export const createSnapshotCommand = (before, after, label = "编辑") => ({
  label,
  undo: () => deepClone(before),
  redo: () => deepClone(after)
});

export class HistoryManager {
  constructor(limit = HISTORY_LIMIT) {
    this.limit = limit;
    this.past = [];
    this.future = [];
  }

  record(before, after, label = "编辑") {
    if (signature(before) === signature(after)) return false;
    this.past.push(createSnapshotCommand(before, after, label));
    if (this.past.length > this.limit) this.past.shift();
    this.future = [];
    return true;
  }

  undo(current) {
    const command = this.past.pop();
    if (!command) return null;
    this.future.push(command);
    return { project: command.undo(), label: command.label };
  }

  redo(current) {
    const command = this.future.pop();
    if (!command) return null;
    this.past.push(command);
    return { project: command.redo(), label: command.label };
  }

  clear() {
    this.past = [];
    this.future = [];
  }

  get canUndo() {
    return this.past.length > 0;
  }

  get canRedo() {
    return this.future.length > 0;
  }
}
