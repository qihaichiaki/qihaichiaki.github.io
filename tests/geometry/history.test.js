import test from "node:test";
import assert from "node:assert/strict";
import { HistoryManager } from "../../src/tools/geometry/history.js";
import { createDefaultProject, createGeometryObject } from "../../src/tools/geometry/model.js";

test("history records, undoes and redoes document mutations", () => {
  const history = new HistoryManager(3);
  const before = createDefaultProject();
  const after = structuredClone(before);
  after.objects.push(createGeometryObject("point", { radius: 0.1 }));

  assert.equal(history.record(before, after, "创建点"), true);
  assert.equal(history.canUndo, true);
  const undone = history.undo(after);
  assert.equal(undone.label, "创建点");
  assert.equal(undone.project.objects.length, 0);
  const redone = history.redo(undone.project);
  assert.equal(redone.project.objects.length, 1);
});

test("history ignores identical snapshots and enforces limit", () => {
  const history = new HistoryManager(2);
  const project = createDefaultProject();
  assert.equal(history.record(project, structuredClone(project)), false);

  for (let index = 0; index < 3; index += 1) {
    const before = structuredClone(project);
    project.meta.title = `project-${index}`;
    history.record(before, project, `rename-${index}`);
  }
  assert.equal(history.past.length, 2);
});
