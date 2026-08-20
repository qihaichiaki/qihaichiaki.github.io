import test from "node:test";
import assert from "node:assert/strict";
import {
  collectIntersections,
  createLineObject,
  createPolylineObject,
  cubicPoint,
  distance,
  getEditableWorldPoints,
  getWorldPoints,
  measurementText,
  point,
  setObjectWorldPoint,
  setEditableWorldPoint,
  snapPoint,
  splitCubicBezier,
  splitLineObject,
  syncDerivedRelations,
  transformLocalPoint
} from "../../src/tools/geometry/geometry.js";
import { createDefaultProject, createGeometryObject } from "../../src/tools/geometry/model.js";

const closePoint = (actual, expected, tolerance = 1e-6) => {
  assert.ok(distance(actual, expected) <= tolerance, `${JSON.stringify(actual)} != ${JSON.stringify(expected)}`);
};

test("local coordinates apply scale, rotation and translation", () => {
  const result = transformLocalPoint(point(1, 0), { x: 3, y: 4, scaleX: 2, scaleY: 1, rotation: 90 });
  closePoint(result, point(3, 6));
});

test("de Casteljau split preserves the original cubic", () => {
  const controls = [point(0, 0), point(1, 3), point(3, 3), point(4, 0)];
  const split = splitCubicBezier(controls, 0.4);
  closePoint(split.point, cubicPoint(controls, 0.4));
  closePoint(cubicPoint(split.left, 1), split.point);
  closePoint(cubicPoint(split.right, 0), split.point);
});

test("snapping prioritizes object endpoints over grid", () => {
  const project = createDefaultProject();
  const segment = createLineObject("segment", point(0.18, 0.12), point(3, 0));
  project.objects.push(segment);
  const result = snapPoint(point(0.16, 0.11), project, { tolerance: 0.3, intersections: [] });
  assert.equal(result.kind, "端点");
  assert.equal(result.targetId, segment.id);
  closePoint(result.point, point(0.18, 0.12));
});

test("intersections are collected and snapped before the grid", () => {
  const project = createDefaultProject();
  const horizontal = createLineObject("segment", point(-2, 0), point(2, 0));
  const vertical = createLineObject("segment", point(0, -2), point(0, 2));
  project.objects.push(horizontal, vertical);
  const intersections = collectIntersections(project.objects);
  assert.equal(intersections.length, 1);
  closePoint(intersections[0].point, point(0, 0));

  const snapped = snapPoint(point(0.08, 0.06), project, { tolerance: 0.2, intersections });
  assert.equal(snapped.kind, "交点");
  closePoint(snapped.point, point(0, 0));
});

test("segment split creates two objects and a shared junction", () => {
  const segment = createLineObject("segment", point(0, 0), point(10, 0));
  const result = splitLineObject(segment, point(4, 0.2));
  assert.deepEqual(result.objects.map((object) => object.type), ["segment", "segment", "point"]);
  closePoint(getWorldPoints(result.objects[0]).at(-1), point(4, 0));
  closePoint(getWorldPoints(result.objects[1])[0], point(4, 0));
  assert.equal(result.relation.kind, "junction");
});

test("ray and infinite line split into the specified line types", () => {
  const ray = createGeometryObject("ray", { direction: point(1, 0) }, { transform: { x: 0, y: 0 } });
  assert.deepEqual(splitLineObject(ray, point(3, 1)).objects.map((object) => object.type), ["segment", "ray", "point"]);

  const line = createGeometryObject("infiniteLine", { direction: point(0, 1) }, { transform: { x: 2, y: 0 } });
  assert.deepEqual(splitLineObject(line, point(3, 4)).objects.map((object) => object.type), ["ray", "ray", "point"]);
});

test("polyline and bezier split retain matching endpoints", () => {
  const polyline = createPolylineObject("polyline", [point(0, 0), point(2, 0), point(2, 2)]);
  const polySplit = splitLineObject(polyline, point(2, 1));
  closePoint(getWorldPoints(polySplit.objects[0]).at(-1), getWorldPoints(polySplit.objects[1])[0]);

  const bezier = createPolylineObject("bezier", [point(0, 0), point(1, 3), point(3, 3), point(4, 0)]);
  const bezierSplit = splitLineObject(bezier, point(2, 2));
  closePoint(getWorldPoints(bezierSplit.objects[0]).at(-1), getWorldPoints(bezierSplit.objects[1])[0]);
});

test("moving a junction updates both related line endpoints", () => {
  const original = createLineObject("segment", point(0, 0), point(8, 0));
  const result = splitLineObject(original, point(3, 0));
  const project = createDefaultProject();
  project.objects.push(...result.objects);
  project.relations.push(result.relation);
  result.objects[2].transform.x = 5;
  result.objects[2].transform.y = 1;
  syncDerivedRelations(project);
  closePoint(getWorldPoints(result.objects[0]).at(-1), point(5, 1));
  closePoint(getWorldPoints(result.objects[1])[0], point(5, 1));
});

test("node editing bakes a new world point without losing the others", () => {
  const segment = createLineObject("segment", point(0, 0), point(2, 0));
  assert.equal(setObjectWorldPoint(segment, 1, point(3, 1)), true);
  closePoint(getWorldPoints(segment)[0], point(0, 0));
  closePoint(getWorldPoints(segment)[1], point(3, 1));
});

test("node editing supports circles, ellipses, arcs and rectangles", () => {
  const circle = createGeometryObject("circle", { radius: 1 }, { transform: { x: 2, y: 3 } });
  assert.equal(getEditableWorldPoints(circle).length, 2);
  assert.equal(setEditableWorldPoint(circle, 1, point(5, 3)), true);
  assert.equal(circle.geometry.radius, 3);

  const ellipse = createGeometryObject("ellipse", { rx: 1, ry: 2 });
  setEditableWorldPoint(ellipse, 1, point(4, 0));
  setEditableWorldPoint(ellipse, 2, point(0, 3));
  assert.equal(ellipse.geometry.rx, 4);
  assert.equal(ellipse.geometry.ry, 3);

  const arc = createGeometryObject("arc", { radius: 2, startAngle: 0, endAngle: Math.PI / 2 });
  setEditableWorldPoint(arc, 2, point(-3, 0));
  assert.equal(arc.geometry.radius, 3);
  assert.ok(Math.abs(arc.geometry.endAngle - Math.PI) < 1e-8);

  const rect = createGeometryObject("rect", { width: 2, height: 2 });
  setEditableWorldPoint(rect, 1, point(3, 2));
  assert.deepEqual({ width: rect.geometry.width, height: rect.geometry.height }, { width: 6, height: 4 });
});

test("dynamic measurements format coordinate, length and radius", () => {
  const project = createDefaultProject();
  const marker = createGeometryObject("point", {}, { transform: { x: 2, y: -3 } });
  const segment = createLineObject("segment", point(0, 0), point(3, 4));
  const circle = createGeometryObject("circle", { radius: 2 });
  project.objects.push(marker, segment, circle);
  assert.equal(measurementText(project, { targetIds: [marker.id], data: { measurementKind: "coordinate" } }), "(2, 3)");
  assert.equal(measurementText(project, { targetIds: [segment.id], data: { measurementKind: "length" } }), "L = 5");
  assert.equal(measurementText(project, { targetIds: [circle.id], data: { measurementKind: "radius" } }), "R = 2");
});

test("text bindings and measurement labels follow their targets", () => {
  const project = createDefaultProject();
  const target = createGeometryObject("circle", { radius: 2 }, { transform: { x: 3, y: 4 } });
  const text = createGeometryObject("text", { text: "A" });
  const measurement = createGeometryObject("measurement", { text: "—" });
  project.objects.push(target, text, measurement);
  project.relations.push(
    { id: "binding", kind: "binding", sourceId: text.id, targetIds: [target.id], data: { offset: { x: 1, y: -1 } } },
    { id: "measurement", kind: "measurement", sourceId: measurement.id, targetIds: [target.id], data: { measurementKind: "radius", offset: { x: 2, y: 1 } } }
  );
  syncDerivedRelations(project);
  assert.deepEqual({ x: text.transform.x, y: text.transform.y }, { x: 4, y: 3 });
  assert.deepEqual({ x: measurement.transform.x, y: measurement.transform.y }, { x: 5, y: 5 });
  assert.equal(measurement.geometry.text, "R = 2");
});
