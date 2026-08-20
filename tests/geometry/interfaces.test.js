import test from "node:test";
import assert from "node:assert/strict";
import { createSnapshotCommand } from "../../src/tools/geometry/history.js";
import { createDefaultProject } from "../../src/tools/geometry/model.js";
import {
  findToolByShortcut,
  getToolDefinition,
  listToolDefinitions,
  registerToolDefinition
} from "../../src/tools/geometry/toolRegistry.js";

test("snapshot commands expose deterministic undo and redo", () => {
  const before = createDefaultProject();
  const after = structuredClone(before);
  after.meta.title = "修改后";
  const command = createSnapshotCommand(before, after, "重命名");
  assert.equal(command.label, "重命名");
  assert.equal(command.undo().meta.title, "未命名作图");
  assert.equal(command.redo().meta.title, "修改后");
});

test("tool definitions are discoverable and extensible", () => {
  assert.equal(getToolDefinition("select").selects, true);
  assert.equal(findToolByShortcut("L").id, "segment");
  const beforeCount = listToolDefinitions().length;
  registerToolDefinition({ id: "test-tool", label: "测试工具", kind: "instant", onPointerDown: () => true });
  assert.equal(listToolDefinitions().length, beforeCount + 1);
  assert.equal(getToolDefinition("test-tool").onPointerDown(), true);
});
