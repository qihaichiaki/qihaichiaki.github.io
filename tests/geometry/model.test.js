import test from "node:test";
import assert from "node:assert/strict";
import {
  PROJECT_SCHEMA_VERSION,
  createDefaultProject,
  createGeometryObject,
  parseProject,
  serializeProject,
  validateProject
} from "../../src/tools/geometry/model.js";

test("default project has a stable V1 shape", () => {
  const project = createDefaultProject();
  assert.equal(project.schemaVersion, PROJECT_SCHEMA_VERSION);
  assert.equal(project.document.grid.mode, "line");
  assert.equal(project.document.grid.snapEnabled, true);
  assert.deepEqual(project.objects, []);
});

test("project round-trip keeps embedded images", () => {
  const project = createDefaultProject();
  project.objects.push(
    createGeometryObject("image", {
      src: "data:image/png;base64,AAAA",
      width: 4,
      height: 3
    })
  );
  const restored = parseProject(serializeProject(project));
  assert.equal(restored.objects[0].geometry.src, "data:image/png;base64,AAAA");
  assert.equal(restored.objects[0].type, "image");
});

test("project validation rejects unknown versions and duplicate ids", () => {
  const project = createDefaultProject();
  project.schemaVersion = 2;
  assert.throws(() => validateProject(project), /不支持的工程版本/);

  const duplicate = createDefaultProject();
  duplicate.objects = [
    createGeometryObject("point", {}, { id: "same" }),
    createGeometryObject("point", {}, { id: "same" })
  ];
  assert.throws(() => validateProject(duplicate), /重复对象 ID/);
});

test("project validation rejects non-portable images and broken relations", () => {
  const remoteImage = createDefaultProject();
  remoteImage.objects.push(createGeometryObject("image", { src: "https://example.com/image.png" }));
  assert.throws(() => validateProject(remoteImage), /Data URL/);

  const brokenRelation = createDefaultProject();
  const point = createGeometryObject("point");
  brokenRelation.objects.push(point);
  brokenRelation.relations.push({ id: "broken", kind: "binding", sourceId: point.id, targetIds: ["missing"], data: {} });
  assert.throws(() => validateProject(brokenRelation), /不存在的对象/);
});
