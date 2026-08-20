import {
  LINE_TYPES,
  createGeometryObject,
  createRelation,
  deepClone,
  getObjectById
} from "./model.js";

const TAU = Math.PI * 2;
const EPSILON = 1e-8;

export const point = (x = 0, y = 0) => ({ x: Number(x), y: Number(y) });
export const add = (left, right) => point(left.x + right.x, left.y + right.y);
export const subtract = (left, right) => point(left.x - right.x, left.y - right.y);
export const multiply = (value, scalar) => point(value.x * scalar, value.y * scalar);
export const dot = (left, right) => left.x * right.x + left.y * right.y;
export const distance = (left, right) => Math.hypot(left.x - right.x, left.y - right.y);
export const midpoint = (left, right) => point((left.x + right.x) / 2, (left.y + right.y) / 2);
export const lerpPoint = (left, right, t) => point(left.x + (right.x - left.x) * t, left.y + (right.y - left.y) * t);
export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export const normalizeVector = (value) => {
  const length = Math.hypot(value.x, value.y);
  return length < EPSILON ? point(1, 0) : point(value.x / length, value.y / length);
};

export const normalizeAngle = (angle) => {
  let value = Number(angle || 0) % TAU;
  if (value < 0) value += TAU;
  return value;
};

const radians = (degrees) => (Number(degrees || 0) * Math.PI) / 180;

export const transformLocalPoint = (local, transform = {}) => {
  const scaled = point(local.x * Number(transform.scaleX || 1), local.y * Number(transform.scaleY || 1));
  const angle = radians(transform.rotation);
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return point(
    Number(transform.x || 0) + scaled.x * cosine - scaled.y * sine,
    Number(transform.y || 0) + scaled.x * sine + scaled.y * cosine
  );
};

export const inverseTransformPoint = (world, transform = {}) => {
  const dx = world.x - Number(transform.x || 0);
  const dy = world.y - Number(transform.y || 0);
  const angle = -radians(transform.rotation);
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  const rotated = point(dx * cosine - dy * sine, dx * sine + dy * cosine);
  return point(
    rotated.x / (Math.abs(Number(transform.scaleX || 1)) < EPSILON ? 1 : Number(transform.scaleX || 1)),
    rotated.y / (Math.abs(Number(transform.scaleY || 1)) < EPSILON ? 1 : Number(transform.scaleY || 1))
  );
};

const centerPoints = (points) => {
  const minX = Math.min(...points.map((item) => item.x));
  const maxX = Math.max(...points.map((item) => item.x));
  const minY = Math.min(...points.map((item) => item.y));
  const maxY = Math.max(...points.map((item) => item.y));
  const center = point((minX + maxX) / 2, (minY + maxY) / 2);
  return {
    center,
    points: points.map((item) => subtract(item, center))
  };
};

export const createLineObject = (type, start, end, options = {}) => {
  const centered = centerPoints([start, end]);
  return createGeometryObject(
    type,
    { points: centered.points },
    { ...options, transform: { ...options.transform, x: centered.center.x, y: centered.center.y } }
  );
};

export const createPolylineObject = (type, worldPoints, options = {}) => {
  const centered = centerPoints(worldPoints);
  return createGeometryObject(
    type,
    { points: centered.points },
    { ...options, transform: { ...options.transform, x: centered.center.x, y: centered.center.y } }
  );
};

export const getWorldPoints = (object) =>
  (object.geometry?.points || []).map((local) => transformLocalPoint(local, object.transform));

export const getObjectCenter = (object) => transformLocalPoint(point(0, 0), object.transform);

const directionFor = (object) => {
  const local = normalizeVector(object.geometry?.direction || point(1, 0));
  const origin = transformLocalPoint(point(0, 0), object.transform);
  const target = transformLocalPoint(local, object.transform);
  return normalizeVector(subtract(target, origin));
};

export const cubicPoint = (points, t) => {
  const [p0, p1, p2, p3] = points;
  const a = lerpPoint(p0, p1, t);
  const b = lerpPoint(p1, p2, t);
  const c = lerpPoint(p2, p3, t);
  const d = lerpPoint(a, b, t);
  const e = lerpPoint(b, c, t);
  return lerpPoint(d, e, t);
};

export const splitCubicBezier = (points, t) => {
  const [p0, p1, p2, p3] = points;
  const p01 = lerpPoint(p0, p1, t);
  const p12 = lerpPoint(p1, p2, t);
  const p23 = lerpPoint(p2, p3, t);
  const p012 = lerpPoint(p01, p12, t);
  const p123 = lerpPoint(p12, p23, t);
  const split = lerpPoint(p012, p123, t);
  return {
    point: split,
    left: [p0, p01, p012, split],
    right: [split, p123, p23, p3]
  };
};

const arcSweep = (start, end, clockwise = false) => {
  const normalizedStart = normalizeAngle(start);
  const normalizedEnd = normalizeAngle(end);
  if (clockwise) {
    return -normalizeAngle(normalizedStart - normalizedEnd || TAU);
  }
  return normalizeAngle(normalizedEnd - normalizedStart || TAU);
};

export const pointOnArc = (object, t) => {
  const radius = Number(object.geometry.radius || 1);
  const start = Number(object.geometry.startAngle || 0);
  const sweep = arcSweep(start, Number(object.geometry.endAngle || 0), Boolean(object.geometry.clockwise));
  return transformLocalPoint(point(Math.cos(start + sweep * t) * radius, Math.sin(start + sweep * t) * radius), object.transform);
};

export const getEditableWorldPoints = (object) => {
  const center = getObjectCenter(object);
  if (object.geometry?.points?.length) return getWorldPoints(object);
  if (object.type === "point") return [center];
  if (object.type === "ray" || object.type === "infiniteLine") {
    return [center, add(center, multiply(directionFor(object), 3))];
  }
  if (object.type === "circle") {
    return [center, transformLocalPoint(point(Number(object.geometry.radius || 1), 0), object.transform)];
  }
  if (object.type === "ellipse") {
    return [
      center,
      transformLocalPoint(point(Number(object.geometry.rx || 1), 0), object.transform),
      transformLocalPoint(point(0, Number(object.geometry.ry || 1)), object.transform)
    ];
  }
  if (object.type === "arc" || object.type === "sector") return [center, pointOnArc(object, 0), pointOnArc(object, 1)];
  if (object.type === "rect") {
    return [
      center,
      transformLocalPoint(point(Number(object.geometry.width || 1) / 2, Number(object.geometry.height || 1) / 2), object.transform)
    ];
  }
  return [];
};

const sampleObjectBoundary = (object, segments = 72) => {
  if (["segment", "arrow", "polyline", "freehand"].includes(object.type)) {
    return getWorldPoints(object);
  }

  if (object.type === "bezier") {
    const controls = getWorldPoints(object);
    return Array.from({ length: segments + 1 }, (_, index) => cubicPoint(controls, index / segments));
  }

  if (object.type === "ray" || object.type === "infiniteLine") {
    const anchor = getObjectCenter(object);
    const direction = directionFor(object);
    return object.type === "ray"
      ? [anchor, add(anchor, multiply(direction, 10000))]
      : [add(anchor, multiply(direction, -10000)), add(anchor, multiply(direction, 10000))];
  }

  if (object.type === "circle" || object.type === "ellipse") {
    const rx = object.type === "circle" ? Number(object.geometry.radius || 1) : Number(object.geometry.rx || 1);
    const ry = object.type === "circle" ? Number(object.geometry.radius || 1) : Number(object.geometry.ry || 1);
    return Array.from({ length: segments + 1 }, (_, index) => {
      const angle = (index / segments) * TAU;
      return transformLocalPoint(point(Math.cos(angle) * rx, Math.sin(angle) * ry), object.transform);
    });
  }

  if (object.type === "arc" || object.type === "sector") {
    const boundary = Array.from({ length: segments + 1 }, (_, index) => pointOnArc(object, index / segments));
    if (object.type === "sector") {
      const center = getObjectCenter(object);
      return [center, ...boundary, center];
    }
    return boundary;
  }

  if (object.type === "rect" || object.type === "image") {
    const halfWidth = Number(object.geometry.width || 1) / 2;
    const halfHeight = Number(object.geometry.height || 1) / 2;
    return [
      point(-halfWidth, -halfHeight),
      point(halfWidth, -halfHeight),
      point(halfWidth, halfHeight),
      point(-halfWidth, halfHeight),
      point(-halfWidth, -halfHeight)
    ].map((local) => transformLocalPoint(local, object.transform));
  }

  if (["triangle", "polygon", "regularPolygon"].includes(object.type)) {
    const points = getWorldPoints(object);
    return points.length ? [...points, points[0]] : [];
  }

  return [];
};

export const nearestPointOnSegment = (value, start, end) => {
  const vector = subtract(end, start);
  const lengthSquared = dot(vector, vector);
  const t = lengthSquared < EPSILON ? 0 : clamp(dot(subtract(value, start), vector) / lengthSquared, 0, 1);
  const result = add(start, multiply(vector, t));
  return { point: result, distance: distance(value, result), t };
};

export const nearestPointOnObject = (value, object) => {
  if (object.type === "point" || object.type === "text" || object.type === "measurement") {
    const center = getObjectCenter(object);
    return { point: center, distance: distance(value, center), segmentIndex: 0, t: 0 };
  }

  const boundary = sampleObjectBoundary(object, object.type === "bezier" ? 120 : 96);
  if (boundary.length < 2) {
    const center = getObjectCenter(object);
    return { point: center, distance: distance(value, center), segmentIndex: 0, t: 0 };
  }

  let best = null;
  for (let index = 0; index < boundary.length - 1; index += 1) {
    const candidate = nearestPointOnSegment(value, boundary[index], boundary[index + 1]);
    if (!best || candidate.distance < best.distance) {
      best = { ...candidate, segmentIndex: index, sampledSegments: boundary.length - 1 };
    }
  }
  return best;
};

export const getObjectKeyPoints = (object) => {
  const keys = [];
  const center = getObjectCenter(object);

  if (object.type === "point") return [{ point: center, kind: "端点" }];

  if (["segment", "arrow", "polyline", "bezier", "freehand"].includes(object.type)) {
    const points = getWorldPoints(object);
    if (points.length) {
      keys.push({ point: points[0], kind: "端点" }, { point: points.at(-1), kind: "端点" });
      if (object.type === "segment" || object.type === "arrow") {
        keys.push({ point: midpoint(points[0], points[1]), kind: "中点" });
      }
    }
  }

  if (object.type === "ray" || object.type === "infiniteLine") {
    keys.push({ point: center, kind: object.type === "ray" ? "端点" : "基点" });
  }

  if (["circle", "ellipse", "arc", "sector", "rect", "triangle", "polygon", "regularPolygon", "image"].includes(object.type)) {
    keys.push({ point: center, kind: ["circle", "ellipse", "arc", "sector"].includes(object.type) ? "圆心" : "中心" });
  }

  if (object.type === "arc" || object.type === "sector") {
    keys.push({ point: pointOnArc(object, 0), kind: "端点" }, { point: pointOnArc(object, 1), kind: "端点" });
  }

  if (["triangle", "polygon", "regularPolygon"].includes(object.type)) {
    getWorldPoints(object).forEach((item) => keys.push({ point: item, kind: "顶点" }));
  }

  return keys;
};

const segmentIntersection = (a, b, c, d) => {
  const r = subtract(b, a);
  const s = subtract(d, c);
  const denominator = r.x * s.y - r.y * s.x;
  if (Math.abs(denominator) < EPSILON) return null;
  const relative = subtract(c, a);
  const t = (relative.x * s.y - relative.y * s.x) / denominator;
  const u = (relative.x * r.y - relative.y * r.x) / denominator;
  if (t < -EPSILON || t > 1 + EPSILON || u < -EPSILON || u > 1 + EPSILON) return null;
  return add(a, multiply(r, t));
};

const objectSvgPath = (object) => {
  const format = (value) => Number(value.toFixed(6));
  const writePoint = (value) => `${format(value.x)} ${format(value.y)}`;
  const points = getWorldPoints(object);

  if (["segment", "arrow", "polyline", "freehand"].includes(object.type) && points.length > 1) {
    return `M ${writePoint(points[0])} ${points.slice(1).map((item) => `L ${writePoint(item)}`).join(" ")}`;
  }
  if (object.type === "bezier" && points.length === 4) {
    return `M ${writePoint(points[0])} C ${writePoint(points[1])}, ${writePoint(points[2])}, ${writePoint(points[3])}`;
  }
  if (object.type === "ray" || object.type === "infiniteLine") {
    const sampled = sampleObjectBoundary(object, 2);
    return `M ${writePoint(sampled[0])} L ${writePoint(sampled[1])}`;
  }
  const boundary = sampleObjectBoundary(object, 96);
  if (boundary.length > 1) {
    return `M ${writePoint(boundary[0])} ${boundary.slice(1).map((item) => `L ${writePoint(item)}`).join(" ")}`;
  }
  return "";
};

export const intersectionsBetween = (left, right) => {
  const leftPath = objectSvgPath(left);
  const rightPath = objectSvgPath(right);
  const kld = globalThis.KldIntersections;
  if (leftPath && rightPath && kld?.ShapeInfo?.path && kld?.Intersection?.intersect) {
    try {
      return kld.Intersection.intersect(kld.ShapeInfo.path(leftPath), kld.ShapeInfo.path(rightPath)).points.map((item) =>
        point(item.x, item.y)
      );
    } catch {
      // Fall through to the deterministic polyline approximation.
    }
  }

  const leftBoundary = sampleObjectBoundary(left, 80);
  const rightBoundary = sampleObjectBoundary(right, 80);
  const intersections = [];
  for (let leftIndex = 0; leftIndex < leftBoundary.length - 1; leftIndex += 1) {
    for (let rightIndex = 0; rightIndex < rightBoundary.length - 1; rightIndex += 1) {
      const result = segmentIntersection(
        leftBoundary[leftIndex],
        leftBoundary[leftIndex + 1],
        rightBoundary[rightIndex],
        rightBoundary[rightIndex + 1]
      );
      if (result && !intersections.some((candidate) => distance(candidate, result) < 1e-4)) intersections.push(result);
    }
  }
  return intersections;
};

export const collectIntersections = (objects) => {
  const candidates = objects.filter((object) => !object.hidden && object.type !== "text" && object.type !== "image");
  const intersections = [];
  for (let leftIndex = 0; leftIndex < candidates.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < candidates.length; rightIndex += 1) {
      intersectionsBetween(candidates[leftIndex], candidates[rightIndex]).forEach((value) => {
        if (!intersections.some((candidate) => distance(candidate.point, value) < 1e-4)) {
          intersections.push({ point: value, kind: "交点" });
        }
      });
    }
  }
  return intersections;
};

export const snapPoint = (raw, project, options = {}) => {
  const tolerance = Number(options.tolerance || 0.3);
  if (!project.document.grid.snapEnabled || options.disabled) {
    return { point: raw, kind: "自由", snapped: false, targetId: null };
  }

  const candidates = [];
  const keyPriority = { "端点": 0, "顶点": 0, "基点": 0, "圆心": 2, "中心": 2, "中点": 3 };
  for (const object of project.objects) {
    if (object.hidden || options.excludeIds?.has(object.id)) continue;
    getObjectKeyPoints(object).forEach((candidate) => candidates.push({
      ...candidate,
      targetId: object.id,
      priority: keyPriority[candidate.kind] ?? 2
    }));
  }
  (options.intersections || []).forEach((candidate) => candidates.push({ ...candidate, targetId: null, priority: 1 }));

  let best = null;
  for (const candidate of candidates) {
    const delta = distance(raw, candidate.point);
    if (delta <= tolerance && (!best || candidate.priority < best.priority || (candidate.priority === best.priority && delta < best.distance))) {
      best = { ...candidate, distance: delta };
    }
  }

  for (const object of project.objects) {
    if (object.hidden || object.locked || options.excludeIds?.has(object.id) || object.type === "text") continue;
    const nearest = nearestPointOnObject(raw, object);
    if (nearest?.distance <= tolerance && (!best || best.priority > 4 || (best.priority === 4 && nearest.distance < best.distance))) {
      best = { point: nearest.point, kind: "边界", targetId: object.id, priority: 4, distance: nearest.distance };
    }
  }

  const spacing = Math.max(0.05, Number(project.document.grid.spacing || 1));
  const gridPoint = point(Math.round(raw.x / spacing) * spacing, Math.round(raw.y / spacing) * spacing);
  const gridDistance = distance(raw, gridPoint);
  if (gridDistance <= tolerance && (!best || best.priority > 5 || (best.priority === 5 && gridDistance < best.distance))) {
    best = { point: gridPoint, kind: "网格", targetId: null, priority: 5, distance: gridDistance };
  }

  return best ? { ...best, snapped: true } : { point: raw, kind: "自由", snapped: false, targetId: null };
};

const closestBezierT = (controls, value) => {
  let bestT = 0;
  let bestDistance = Infinity;
  for (let index = 0; index <= 160; index += 1) {
    const t = index / 160;
    const delta = distance(cubicPoint(controls, t), value);
    if (delta < bestDistance) {
      bestDistance = delta;
      bestT = t;
    }
  }
  let low = Math.max(0, bestT - 1 / 160);
  let high = Math.min(1, bestT + 1 / 160);
  for (let iteration = 0; iteration < 18; iteration += 1) {
    const leftT = low + (high - low) / 3;
    const rightT = high - (high - low) / 3;
    if (distance(cubicPoint(controls, leftT), value) < distance(cubicPoint(controls, rightT), value)) high = rightT;
    else low = leftT;
  }
  return (low + high) / 2;
};

const cloneStyle = (object, overrides = {}) => ({ ...deepClone(object.style), ...overrides });

const relationEndpoint = (objectId, endpoint) => ({ objectId, endpoint });

export const splitLineObject = (object, requestedPoint) => {
  if (!LINE_TYPES.has(object.type)) throw new Error("所选对象不支持分割。");
  const style = cloneStyle(object);
  const zIndex = object.zIndex;
  let first;
  let second;
  let splitPoint = requestedPoint;
  let endpoints;

  if (["segment", "arrow"].includes(object.type)) {
    const [start, end] = getWorldPoints(object);
    splitPoint = nearestPointOnSegment(requestedPoint, start, end).point;
    first = createLineObject(object.type, start, splitPoint, { style: cloneStyle(object, { arrowEnd: false }), zIndex });
    second = createLineObject(object.type, splitPoint, end, { style: cloneStyle(object, { arrowStart: false }), zIndex: zIndex + 1 });
    endpoints = [relationEndpoint(first.id, "end"), relationEndpoint(second.id, "start")];
  } else if (object.type === "polyline") {
    const points = getWorldPoints(object);
    const nearest = nearestPointOnObject(requestedPoint, object);
    splitPoint = nearest.point;
    const edge = Math.min(points.length - 2, nearest.segmentIndex);
    const leftPoints = [...points.slice(0, edge + 1), splitPoint];
    const rightPoints = [splitPoint, ...points.slice(edge + 1)];
    first = createPolylineObject("polyline", leftPoints, { style: cloneStyle(object, { arrowEnd: false }), zIndex });
    second = createPolylineObject("polyline", rightPoints, { style: cloneStyle(object, { arrowStart: false }), zIndex: zIndex + 1 });
    endpoints = [relationEndpoint(first.id, "end"), relationEndpoint(second.id, "start")];
  } else if (object.type === "bezier") {
    const controls = getWorldPoints(object);
    const split = splitCubicBezier(controls, closestBezierT(controls, requestedPoint));
    splitPoint = split.point;
    first = createPolylineObject("bezier", split.left, { style: cloneStyle(object, { arrowEnd: false }), zIndex });
    second = createPolylineObject("bezier", split.right, { style: cloneStyle(object, { arrowStart: false }), zIndex: zIndex + 1 });
    endpoints = [relationEndpoint(first.id, "end"), relationEndpoint(second.id, "start")];
  } else if (object.type === "arc") {
    const local = inverseTransformPoint(requestedPoint, object.transform);
    const splitAngle = Math.atan2(local.y, local.x);
    splitPoint = transformLocalPoint(
      point(Math.cos(splitAngle) * Number(object.geometry.radius), Math.sin(splitAngle) * Number(object.geometry.radius)),
      object.transform
    );
    first = createGeometryObject("arc", { ...deepClone(object.geometry), endAngle: splitAngle }, { ...object, id: undefined, style: cloneStyle(object, { arrowEnd: false }) });
    second = createGeometryObject("arc", { ...deepClone(object.geometry), startAngle: splitAngle }, { ...object, id: undefined, zIndex: zIndex + 1, style: cloneStyle(object, { arrowStart: false }) });
    endpoints = [relationEndpoint(first.id, "arcEnd"), relationEndpoint(second.id, "arcStart")];
  } else if (object.type === "ray") {
    const anchor = getObjectCenter(object);
    const direction = directionFor(object);
    const projectedDistance = Math.max(0, dot(subtract(requestedPoint, anchor), direction));
    splitPoint = add(anchor, multiply(direction, projectedDistance));
    first = createLineObject("segment", anchor, splitPoint, { style: cloneStyle(object, { arrowEnd: false }), zIndex });
    second = createGeometryObject("ray", { direction }, { transform: { x: splitPoint.x, y: splitPoint.y }, style: cloneStyle(object, { arrowStart: false }), zIndex: zIndex + 1 });
    endpoints = [relationEndpoint(first.id, "end"), relationEndpoint(second.id, "anchor")];
  } else if (object.type === "infiniteLine") {
    const anchor = getObjectCenter(object);
    const direction = directionFor(object);
    const projection = dot(subtract(requestedPoint, anchor), direction);
    splitPoint = add(anchor, multiply(direction, projection));
    first = createGeometryObject("ray", { direction: multiply(direction, -1) }, { transform: { x: splitPoint.x, y: splitPoint.y }, style: cloneStyle(object, { arrowEnd: false }), zIndex });
    second = createGeometryObject("ray", { direction }, { transform: { x: splitPoint.x, y: splitPoint.y }, style: cloneStyle(object, { arrowStart: false }), zIndex: zIndex + 1 });
    endpoints = [relationEndpoint(first.id, "anchor"), relationEndpoint(second.id, "anchor")];
  }

  const junction = createGeometryObject("point", { radius: 0.11 }, { transform: { x: splitPoint.x, y: splitPoint.y }, zIndex: zIndex + 2 });
  const relation = createRelation("junction", junction.id, [first.id, second.id], { endpoints });
  return { objects: [first, second, junction], relation, splitPoint };
};

const resetPolylineWorldPoints = (object, points) => {
  const centered = centerPoints(points);
  object.geometry.points = centered.points;
  object.transform = { x: centered.center.x, y: centered.center.y, scaleX: 1, scaleY: 1, rotation: 0 };
};

export const setObjectWorldPoint = (object, index, value) => {
  const points = getWorldPoints(object);
  if (!points.length || index < 0 || index >= points.length) return false;
  points[index] = point(value.x, value.y);
  resetPolylineWorldPoints(object, points);
  return true;
};

export const setEditableWorldPoint = (object, index, value) => {
  if (object.geometry?.points?.length) return setObjectWorldPoint(object, index, value);
  if (index === 0 && ["point", "ray", "infiniteLine", "circle", "ellipse", "arc", "sector", "rect"].includes(object.type)) {
    object.transform.x = value.x;
    object.transform.y = value.y;
    return true;
  }
  if ((object.type === "ray" || object.type === "infiniteLine") && index === 1) {
    const center = getObjectCenter(object);
    object.geometry.direction = normalizeVector(subtract(value, center));
    object.transform.rotation = 0;
    object.transform.scaleX = 1;
    object.transform.scaleY = 1;
    return true;
  }

  const local = inverseTransformPoint(value, object.transform);
  if (object.type === "circle" && index === 1) {
    object.geometry.radius = Math.max(0.05, Math.hypot(local.x, local.y));
    return true;
  }
  if (object.type === "ellipse" && index === 1) {
    object.geometry.rx = Math.max(0.05, Math.abs(local.x));
    return true;
  }
  if (object.type === "ellipse" && index === 2) {
    object.geometry.ry = Math.max(0.05, Math.abs(local.y));
    return true;
  }
  if (["arc", "sector"].includes(object.type) && (index === 1 || index === 2)) {
    object.geometry.radius = Math.max(0.05, Math.hypot(local.x, local.y));
    object.geometry[index === 1 ? "startAngle" : "endAngle"] = Math.atan2(local.y, local.x);
    return true;
  }
  if (object.type === "rect" && index === 1) {
    object.geometry.width = Math.max(0.1, Math.abs(local.x) * 2);
    object.geometry.height = Math.max(0.1, Math.abs(local.y) * 2);
    return true;
  }
  return false;
};

const moveEndpoint = (object, endpoint, value) => {
  if (["segment", "arrow", "polyline", "bezier"].includes(object.type)) {
    const points = getWorldPoints(object);
    if (!points.length) return;
    if (endpoint === "start") points[0] = value;
    else points[points.length - 1] = value;
    resetPolylineWorldPoints(object, points);
  } else if (object.type === "ray" && endpoint === "anchor") {
    object.transform.x = value.x;
    object.transform.y = value.y;
  } else if (object.type === "arc") {
    const local = inverseTransformPoint(value, object.transform);
    object.geometry.radius = Math.max(0.01, Math.hypot(local.x, local.y));
    object.geometry[endpoint === "arcStart" ? "startAngle" : "endAngle"] = Math.atan2(local.y, local.x);
  }
};

export const syncJunctionRelation = (project, relation) => {
  const junction = getObjectById(project, relation.sourceId);
  if (!junction) return;
  const value = getObjectCenter(junction);
  for (const descriptor of relation.data?.endpoints || []) {
    const target = getObjectById(project, descriptor.objectId);
    if (target) moveEndpoint(target, descriptor.endpoint, value);
  }
};

const lineAngle = (object) => {
  if (object.type === "ray" || object.type === "infiniteLine") {
    const direction = directionFor(object);
    return Math.atan2(direction.y, direction.x);
  }
  const points = getWorldPoints(object);
  if (points.length < 2) return 0;
  const direction = subtract(points.at(-1), points[0]);
  return Math.atan2(direction.y, direction.x);
};

export const measurementText = (project, relation) => {
  const targets = relation.targetIds.map((id) => getObjectById(project, id)).filter(Boolean);
  if (!targets.length) return "—";
  const kind = relation.data?.measurementKind;
  if (kind === "coordinate") {
    const center = getObjectCenter(targets[0]);
    return `(${formatNumber(center.x)}, ${formatNumber(-center.y)})`;
  }
  if (kind === "length") {
    const points = getWorldPoints(targets[0]);
    if (points.length < 2) return "—";
    return `L = ${formatNumber(distance(points[0], points.at(-1)))}`;
  }
  if (kind === "radius") {
    const radius = Number(targets[0].geometry?.radius || Math.max(targets[0].geometry?.rx || 0, targets[0].geometry?.ry || 0));
    const averageScale = (Math.abs(targets[0].transform.scaleX || 1) + Math.abs(targets[0].transform.scaleY || 1)) / 2;
    return `R = ${formatNumber(radius * averageScale)}`;
  }
  if (kind === "angle" && targets.length >= 2) {
    let angle = Math.abs(lineAngle(targets[0]) - lineAngle(targets[1])) % Math.PI;
    if (angle > Math.PI / 2) angle = Math.PI - angle;
    return `∠ ${formatNumber((angle * 180) / Math.PI)}°`;
  }
  return "—";
};

export const formatNumber = (value) => {
  const rounded = Math.round(Number(value) * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
};

export const syncDerivedRelations = (project) => {
  for (const relation of project.relations) {
    if (relation.kind === "junction") syncJunctionRelation(project, relation);
    const source = getObjectById(project, relation.sourceId);
    const target = getObjectById(project, relation.targetIds[0]);
    if (!source || !target) continue;

    if (relation.kind === "binding") {
      const targetCenter = getObjectCenter(target);
      source.transform.x = targetCenter.x + Number(relation.data?.offset?.x || 0);
      source.transform.y = targetCenter.y + Number(relation.data?.offset?.y || 0);
    }

    if (relation.kind === "measurement") {
      source.geometry.text = measurementText(project, relation);
      const targetCenter = getObjectCenter(target);
      source.transform.x = targetCenter.x + Number(relation.data?.offset?.x || 0.6);
      source.transform.y = targetCenter.y + Number(relation.data?.offset?.y || -0.6);
    }
  }
  return project;
};

export const isLineType = (type) => LINE_TYPES.has(type);
