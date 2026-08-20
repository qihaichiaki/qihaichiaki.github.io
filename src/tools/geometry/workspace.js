import { initSiteHeaderAuth } from "../../lib/siteHeaderAuth.js";
import {
  DEFAULT_STYLE,
  LINE_TYPES,
  WORLD_UNIT_PX,
  createDefaultProject,
  createGeometryObject,
  createGroup,
  createRelation,
  deepClone,
  getGroupMembers,
  getObjectById,
  normalizeZIndexes,
  parseProject,
  removeObjects,
  serializeProject,
  touchProject
} from "./model.js";
import { HistoryManager } from "./history.js";
import { createAutosaver, loadCurrentProject } from "./persistence.js";
import {
  add,
  collectIntersections,
  createLineObject,
  createPolylineObject,
  distance,
  formatNumber,
  getObjectCenter,
  getWorldPoints,
  isLineType,
  midpoint,
  multiply,
  normalizeVector,
  point,
  setEditableWorldPoint,
  snapPoint,
  splitLineObject,
  subtract,
  syncDerivedRelations
} from "./geometry.js?v=20260820";
import { createFabricObject, extractModelTransform, FabricScene } from "./renderer.js?v=20260820";
import { copyPng, downloadPng, downloadProject, downloadSvg } from "./exporter.js";
import { geometryWorkspaceMarkup } from "./ui.js";
import { findToolByShortcut, getToolDefinition } from "./toolRegistry.js";

const state = {
  project: createDefaultProject(),
  history: new HistoryManager(),
  scene: null,
  tool: "select",
  intersections: [],
  pointerDown: false,
  drawingStart: null,
  drawingPoints: [],
  freehandPoints: [],
  erasedDuringStroke: new Set(),
  eraserBusy: false,
  previewObject: null,
  previewToken: 0,
  panning: false,
  panStart: null,
  spaceDown: false,
  transformBefore: null,
  nodeMoveBefore: null,
  expandingGroup: false,
  cropStart: null,
  cropRegion: null,
  toastTimer: 0,
  renderToken: 0,
  renderScheduled: false
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const UI_PREFERENCES_KEY = "qihai_geometry_ui_v1";

const loadUiPreferences = () => {
  try {
    return { inspectorOpen: false, ...JSON.parse(localStorage.getItem(UI_PREFERENCES_KEY) || "{}") };
  } catch {
    return { inspectorOpen: false };
  }
};

const uiPreferences = loadUiPreferences();
const saveUiPreferences = () => {
  try { localStorage.setItem(UI_PREFERENCES_KEY, JSON.stringify(uiPreferences)); } catch { /* preferences are optional */ }
};

const stage = () => $("#geometry-stage");
const currentToolDefinition = () => getToolDefinition(state.tool);
const toolIs = (kind, tool = state.tool) => getToolDefinition(tool)?.kind === kind;

const showToast = (message, duration = 2400) => {
  const toast = $("#geometry-toast");
  if (!toast) return;
  clearTimeout(state.toastTimer);
  toast.textContent = message;
  toast.classList.remove("is-hidden");
  state.toastTimer = setTimeout(() => toast.classList.add("is-hidden"), duration);
};

const updateSaveState = (status, error) => {
  const value = $("#geometry-save-state");
  if (!value) return;
  if (status === "saving") value.textContent = "保存中";
  else if (status === "saved") value.textContent = "已保存在本地";
  else if (status === "error") {
    value.textContent = "保存失败";
    showToast(`本地保存失败：${String(error?.message || "未知错误")}`);
  } else value.textContent = "本地";
};

const autosaver = createAutosaver({ getProject: () => deepClone(state.project), onStatus: updateSaveState });

const selectedIds = () => state.scene?.getSelectedIds() || [];

const getSelectedModels = () => selectedIds().map((id) => getObjectById(state.project, id)).filter(Boolean);

const updateHistoryButtons = () => {
  const undo = $('[data-action="undo"]');
  const redo = $('[data-action="redo"]');
  if (undo) undo.disabled = !state.history.canUndo;
  if (redo) redo.disabled = !state.history.canRedo;
};

const updateEmptyGuide = () => {
  $("#geometry-empty-guide")?.classList.toggle("is-hidden", state.project.objects.length > 0);
};

const updateDocumentControls = () => {
  const grid = state.project.document.grid;
  $("#grid-mode").value = grid.mode;
  $("#grid-spacing").value = String(grid.spacing);
  $("#grid-axes").checked = Boolean(grid.axesVisible);
  $("#grid-snap").checked = Boolean(grid.snapEnabled);
  $("#document-background").value = state.project.document.background;
  $("#geometry-title").value = state.project.meta.title;
  $("#status-snap").textContent = `吸附：${grid.snapEnabled ? "开启" : "关闭"}`;
  const canvas = $("#geometry-stage");
  if (canvas) canvas.dataset.background = state.project.document.background;
};

const typeName = (type) => getToolDefinition(type)?.label || ({ image: "图片", measurement: "测量标注" }[type] || type);

const normalizeColor = (value, fallback = "#ffffff") => (/^#[0-9a-f]{6}$/i.test(String(value || "")) ? value : fallback);

const updateInspector = () => {
  const selected = getSelectedModels();
  const controls = $("#inspector-object-controls");
  const empty = $("#inspector-empty");
  $("#inspector-count").textContent = String(selected.length);
  $("#inspector-title").textContent = selected.length === 1 ? selected[0].name || typeName(selected[0].type) : selected.length ? `${selected.length} 个对象` : "未选择对象";
  controls?.classList.toggle("is-hidden", !selected.length);
  empty?.classList.toggle("is-hidden", Boolean(selected.length));
  if (!selected.length) return;

  const first = selected[0];
  $("#object-name").value = selected.length === 1 ? first.name || "" : "";
  $("#object-stroke").value = normalizeColor(first.style.stroke, "#273052");
  $("#object-fill").value = normalizeColor(first.style.fill);
  $("#object-stroke-width").value = String(first.style.strokeWidth || 2);
  $("#object-dash").value = first.style.dash || "solid";
  $("#object-opacity").value = String(Math.round(Number(first.style.opacity ?? 1) * 100));
  $("#object-opacity-output").textContent = `${$("#object-opacity").value}%`;
  $("#object-arrow-start").checked = Boolean(first.style.arrowStart);
  $("#object-arrow-end").checked = Boolean(first.style.arrowEnd);
  $("#arrow-controls")?.classList.toggle("is-hidden", !selected.some((object) => LINE_TYPES.has(object.type)));
  const textSelection = selected.every((object) => ["text", "measurement"].includes(object.type));
  $("#text-controls")?.classList.toggle("is-hidden", !textSelection);
  if (textSelection) {
    $("#object-font-size").value = String(first.style.fontSize || 18);
    $("#object-text-align").value = first.style.textAlign || "left";
    $("#object-font-bold").checked = first.style.fontWeight === "bold";
    $("#object-font-italic").checked = first.style.fontStyle === "italic";
  }
};

const refreshDerivedCache = () => {
  syncDerivedRelations(state.project);
  state.intersections = collectIntersections(state.project.objects);
};

const applyToolSelectionMode = () => {
  if (!state.scene) return;
  const definition = currentToolDefinition();
  const canSelect = Boolean(definition?.selects);
  state.scene.canvas.selection = canSelect;
  state.scene.canvas.skipTargetFind = state.tool === "pan" || state.tool === "exportCrop";
  state.scene.canvas.defaultCursor = definition?.cursor || (canSelect ? "default" : "crosshair");
  for (const fabricObject of state.scene.canvas.getObjects()) {
    if (fabricObject.isNodeHandle) continue;
    const model = getObjectById(state.project, fabricObject.modelId);
    if (!model) continue;
    fabricObject.selectable = canSelect && !model.locked && !model.hidden;
    fabricObject.evented = state.tool !== "pan" && !model.hidden;
  }
  state.scene.canvas.discardActiveObject();
  state.scene.clearNodeHandles();
  state.scene.canvas.requestRenderAll();
};

const refreshProject = async ({ selection = selectedIds(), keepViewport = true } = {}) => {
  const renderToken = ++state.renderToken;
  refreshDerivedCache();
  const viewport = keepViewport && state.scene ? state.scene.getViewport() : state.project.viewport;
  await state.scene.render(state.project, selection);
  if (renderToken !== state.renderToken) return;
  state.scene.setViewport(viewport.zoom, viewport.panX, viewport.panY);
  applyToolSelectionMode();
  if (currentToolDefinition()?.selects && selection.length) state.scene.selectIds(selection);
  updateHistoryButtons();
  updateEmptyGuide();
  updateDocumentControls();
  updateInspector();
};

const commitMutation = async (label, mutator, options = {}) => {
  const before = deepClone(state.project);
  mutator(state.project);
  touchProject(state.project);
  normalizeZIndexes(state.project);
  refreshDerivedCache();
  state.history.record(before, state.project, label);
  autosaver.schedule();
  await refreshProject({ selection: options.selection || selectedIds(), keepViewport: options.keepViewport !== false });
};

const activateTool = (tool, { announce = true } = {}) => {
  const definition = getToolDefinition(tool);
  if (!definition) return;
  state.tool = tool;
  state.pointerDown = false;
  state.drawingStart = null;
  state.freehandPoints = [];
  state.erasedDuringStroke.clear();
  if (!["multi", "triple"].includes(definition.kind)) state.drawingPoints = [];
  clearPreview();
  $$("[data-tool]").forEach((button) => button.classList.toggle("is-active", button.dataset.tool === tool));
  $("#status-tool").textContent = definition.label;
  applyToolSelectionMode();
  if (announce && definition.hint) showToast(definition.hint);
};

const clearPreview = () => {
  state.previewToken += 1;
  if (state.previewObject && state.scene) state.scene.canvas.remove(state.previewObject);
  state.previewObject = null;
  state.scene?.canvas.requestRenderAll();
};

const showPreview = async (model) => {
  const token = ++state.previewToken;
  if (state.previewObject) state.scene.canvas.remove(state.previewObject);
  const preview = await createFabricObject({ ...model, style: { ...model.style, opacity: Math.min(0.68, model.style.opacity ?? 1) } });
  if (token !== state.previewToken) return;
  preview.selectable = false;
  preview.evented = false;
  preview.excludeFromExport = true;
  preview.strokeDashArray ||= [7, 5];
  state.previewObject = preview;
  state.scene.canvas.add(preview);
  state.scene.canvas.requestRenderAll();
};

const pointerFromEvent = (event, { useSnap = true, excludeIds = new Set() } = {}) => {
  const raw = state.scene.viewportPointToWorld(event.clientX, event.clientY);
  const zoom = state.scene.canvas.getZoom();
  const snapped = useSnap
    ? snapPoint(raw, state.project, {
        tolerance: 11 / Math.max(0.15, zoom) / WORLD_UNIT_PX,
        disabled: event.altKey,
        excludeIds,
        intersections: state.intersections
      })
    : { point: raw, kind: "自由", snapped: false, targetId: null };
  return { raw, ...snapped };
};

const updatePointerStatus = (pointer) => {
  $("#status-coordinates").textContent = `x ${formatNumber(pointer.point.x)} · y ${formatNumber(-pointer.point.y)}`;
  const hint = $("#geometry-snap-hint");
  if (!hint || !state.scene) return;
  if (!pointer.snapped || state.tool === "pan") {
    hint.classList.add("is-hidden");
    return;
  }
  const viewport = state.scene.worldPointToViewport(pointer.point);
  hint.style.left = `${viewport.x}px`;
  hint.style.top = `${viewport.y}px`;
  const target = pointer.targetId ? getObjectById(state.project, pointer.targetId) : null;
  const split = state.tool === "point" && target && isLineType(target.type) && pointer.kind === "边界";
  hint.dataset.label = split ? `分割 · ${formatNumber(pointer.point.x)}, ${formatNumber(-pointer.point.y)}` : pointer.kind;
  hint.classList.remove("is-hidden");
};

const currentStyle = (overrides = {}) => ({ ...DEFAULT_STYLE, ...overrides });

const buildDragObject = (tool, start, end) => {
  const delta = subtract(end, start);
  const center = midpoint(start, end);
  const length = Math.max(0.05, distance(start, end));
  if (tool === "segment") return createLineObject("segment", start, end, { style: currentStyle() });
  if (tool === "arrow") return createLineObject("arrow", start, end, { style: currentStyle({ arrowEnd: true }) });
  if (tool === "ray" || tool === "infiniteLine") {
    return createGeometryObject(tool, { direction: normalizeVector(delta) }, { transform: { x: start.x, y: start.y }, style: currentStyle({ arrowEnd: tool === "ray" }) });
  }
  if (tool === "circle") return createGeometryObject("circle", { radius: length }, { transform: { x: start.x, y: start.y }, style: currentStyle() });
  if (tool === "ellipse") return createGeometryObject("ellipse", { rx: Math.max(0.1, Math.abs(delta.x) / 2), ry: Math.max(0.1, Math.abs(delta.y) / 2) }, { transform: { x: center.x, y: center.y }, style: currentStyle() });
  if (tool === "rect") return createGeometryObject("rect", { width: Math.max(0.1, Math.abs(delta.x)), height: Math.max(0.1, Math.abs(delta.y)) }, { transform: { x: center.x, y: center.y }, style: currentStyle() });
  if (tool === "regularPolygon") {
    const sides = 6;
    const angleOffset = Math.atan2(delta.y, delta.x);
    const points = Array.from({ length: sides }, (_, index) => point(Math.cos(angleOffset + (index * Math.PI * 2) / sides) * length, Math.sin(angleOffset + (index * Math.PI * 2) / sides) * length));
    return createGeometryObject("regularPolygon", { points, sides }, { transform: { x: start.x, y: start.y }, style: currentStyle() });
  }
  if (tool === "bezier") {
    const normal = normalizeVector(point(-delta.y, delta.x));
    const bend = Math.min(2, length * 0.18);
    const controls = [
      start,
      add(add(start, multiply(delta, 1 / 3)), multiply(normal, bend)),
      add(add(start, multiply(delta, 2 / 3)), multiply(normal, bend)),
      end
    ];
    return createPolylineObject("bezier", controls, { style: currentStyle() });
  }
  return null;
};

const buildMultiPointObject = (tool, points) => {
  if (tool === "polyline") return createPolylineObject("polyline", points, { style: currentStyle() });
  if (tool === "triangle") return createPolylineObject("triangle", points, { style: currentStyle() });
  if (tool === "polygon") return createPolylineObject("polygon", points, { style: currentStyle() });
  return null;
};

const buildArcObject = (tool, points) => {
  const [center, start, end] = points;
  const radius = distance(center, start);
  return createGeometryObject(
    tool,
    {
      radius: Math.max(0.05, radius),
      startAngle: Math.atan2(start.y - center.y, start.x - center.x),
      endAngle: Math.atan2(end.y - center.y, end.x - center.x),
      clockwise: false
    },
    { transform: { x: center.x, y: center.y }, style: currentStyle() }
  );
};

const finishMultiPoint = async () => {
  if (!toolIs("multi")) return;
  const minimum = state.tool === "polyline" ? 2 : 3;
  if (state.drawingPoints.length < minimum) {
    showToast(`至少需要 ${minimum} 个点。`);
    return;
  }
  const model = buildMultiPointObject(state.tool, state.drawingPoints);
  state.drawingPoints = [];
  clearPreview();
  await commitMutation(`创建${typeName(model.type)}`, (project) => {
    model.zIndex = project.objects.length;
    project.objects.push(model);
  }, { selection: [] });
};

const splitAtPoint = async (target, value) => {
  const result = splitLineObject(target, value);
  await commitMutation(`分割${typeName(target.type)}`, (project) => {
    const index = project.objects.findIndex((object) => object.id === target.id);
    project.objects.splice(index, 1, ...result.objects);
    project.relations = project.relations.filter((relation) => relation.sourceId !== target.id && !relation.targetIds.includes(target.id));
    project.relations.push(result.relation);
  }, { selection: [result.objects[2].id] });
};

const addPoint = async (pointer) => {
  const target = pointer.targetId ? getObjectById(state.project, pointer.targetId) : null;
  if (target && isLineType(target.type) && pointer.kind === "边界") {
    await splitAtPoint(target, pointer.point);
    return;
  }
  const model = createGeometryObject("point", { radius: 0.11 }, { transform: { x: pointer.point.x, y: pointer.point.y }, style: currentStyle({ fill: "#273052" }) });
  await commitMutation("创建点", (project) => {
    model.zIndex = project.objects.length;
    project.objects.push(model);
  }, { selection: [] });
};

const createTextAt = async (value) => {
  const model = createGeometryObject("text", { text: "批注" }, { transform: { x: value.x, y: value.y }, style: currentStyle({ fill: "transparent" }) });
  await commitMutation("创建文字", (project) => {
    model.zIndex = project.objects.length;
    project.objects.push(model);
  }, { selection: [model.id] });
  activateTool("text", { announce: false });
  const textObject = state.scene.objectMap.get(model.id);
  if (textObject?.enterEditing) {
    textObject.enterEditing();
    textObject.selectAll();
  }
};

const eraseTarget = async (fabricTarget) => {
  const id = fabricTarget?.modelId;
  const model = id ? getObjectById(state.project, id) : null;
  if (!model || model.locked || state.eraserBusy || state.erasedDuringStroke.has(model.id)) return;
  const ids = getGroupMembers(state.project, model).map((object) => object.id);
  ids.forEach((objectId) => state.erasedDuringStroke.add(objectId));
  state.eraserBusy = true;
  try {
    await commitMutation("擦除对象", (project) => removeObjects(project, ids), { selection: [] });
  } finally {
    state.eraserBusy = false;
  }
};

const measurementKindFor = (models) => {
  if (models.length === 1 && models[0].type === "point") return "coordinate";
  if (models.length === 1 && ["segment", "arrow", "polyline"].includes(models[0].type)) return "length";
  if (models.length === 1 && ["circle", "arc"].includes(models[0].type)) return "radius";
  if (models.length === 2 && models.every((model) => isLineType(model.type))) return "angle";
  return "";
};

const createMeasurementForSelection = async () => {
  const targets = getSelectedModels().filter((model) => model.type !== "measurement");
  const kind = measurementKindFor(targets);
  if (!kind) {
    showToast("测量支持：一个点、一个有限线对象、一个圆/圆弧，或两条线类对象。", 3200);
    return false;
  }
  const center = targets.reduce((sum, model) => add(sum, getObjectCenter(model)), point(0, 0));
  center.x /= targets.length;
  center.y /= targets.length;
  const label = createGeometryObject("measurement", { text: "—" }, { transform: { x: center.x + 0.6, y: center.y - 0.6 }, style: currentStyle({ fontSize: 15, fill: "transparent" }) });
  const relation = createRelation("measurement", label.id, targets.map((model) => model.id), { measurementKind: kind, offset: { x: 0.6, y: -0.6 } });
  await commitMutation("创建测量标注", (project) => {
    label.zIndex = project.objects.length;
    project.objects.push(label);
    project.relations.push(relation);
  }, { selection: [label.id] });
  return true;
};

const updateCropBox = (startValue, endValue) => {
  const box = $("#geometry-crop-box");
  if (!box) return;
  const left = Math.min(startValue.x, endValue.x);
  const top = Math.min(startValue.y, endValue.y);
  const width = Math.abs(endValue.x - startValue.x);
  const height = Math.abs(endValue.y - startValue.y);
  Object.assign(box.style, { left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px` });
  box.classList.remove("is-hidden");
  state.cropRegion = { left, top, width, height };
};

const viewportPointer = (event) => {
  const rect = stage().getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
};

const createToolHookContext = () => ({
  state,
  scene: state.scene,
  getProject: () => state.project,
  commitMutation,
  pointerFromEvent,
  showPreview,
  clearPreview,
  showToast
});

const runToolHook = async (name, ...args) => {
  const hook = currentToolDefinition()?.[name];
  return typeof hook === "function" ? Boolean(await hook(createToolHookContext(), ...args)) : false;
};

const handleDrawingDown = async (event, fabricTarget) => {
  if (await runToolHook("onPointerDown", event, fabricTarget)) return;
  const pointer = pointerFromEvent(event, { useSnap: state.tool !== "freehand" });
  updatePointerStatus(pointer);

  if (state.tool === "point") {
    await addPoint(pointer);
    return;
  }
  if (state.tool === "text") {
    await createTextAt(pointer.point);
    return;
  }
  if (state.tool === "eraser") {
    state.pointerDown = true;
    state.erasedDuringStroke.clear();
    await eraseTarget(fabricTarget || state.scene.canvas.findTarget(event));
    return;
  }
  if (state.tool === "measure") {
    await createMeasurementForSelection();
    return;
  }
  if (state.tool === "exportCrop") {
    state.pointerDown = true;
    state.cropStart = viewportPointer(event);
    updateCropBox(state.cropStart, state.cropStart);
    return;
  }
  if (toolIs("multi")) {
    state.drawingPoints.push(pointer.point);
    if (state.tool === "triangle" && state.drawingPoints.length === 3) await finishMultiPoint();
    return;
  }
  if (toolIs("triple")) {
    state.drawingPoints.push(pointer.point);
    if (state.drawingPoints.length === 3) {
      const model = buildArcObject(state.tool, state.drawingPoints);
      state.drawingPoints = [];
      clearPreview();
      await commitMutation(`创建${typeName(model.type)}`, (project) => { model.zIndex = project.objects.length; project.objects.push(model); }, { selection: [] });
    }
    return;
  }
  if (state.tool === "freehand") {
    state.pointerDown = true;
    state.freehandPoints = [pointer.raw];
    return;
  }
  if (toolIs("drag")) {
    state.pointerDown = true;
    state.drawingStart = pointer.point;
  }
};

const handleDrawingMove = async (event) => {
  if (await runToolHook("onPointerMove", event)) return;
  const pointer = pointerFromEvent(event, { useSnap: state.tool !== "freehand" });
  updatePointerStatus(pointer);

  if (state.tool === "eraser" && state.pointerDown) {
    await eraseTarget(state.scene.canvas.findTarget(event));
    return;
  }

  if (state.tool === "exportCrop" && state.pointerDown && state.cropStart) {
    updateCropBox(state.cropStart, viewportPointer(event));
    return;
  }
  if (state.tool === "freehand" && state.pointerDown) {
    if (!state.freehandPoints.length || distance(state.freehandPoints.at(-1), pointer.raw) > 0.06) state.freehandPoints.push(pointer.raw);
    if (state.freehandPoints.length > 1) showPreview(createPolylineObject("freehand", state.freehandPoints, { style: currentStyle() }));
    return;
  }
  if (state.pointerDown && state.drawingStart && toolIs("drag")) {
    const model = buildDragObject(state.tool, state.drawingStart, pointer.point);
    if (model) showPreview(model);
    return;
  }
  if (toolIs("multi") && state.drawingPoints.length) {
    const previewPoints = [...state.drawingPoints, pointer.point];
    const model = buildMultiPointObject(state.tool, previewPoints);
    if (model) showPreview(model);
    return;
  }
  if (toolIs("triple") && state.drawingPoints.length === 2) {
    showPreview(buildArcObject(state.tool, [...state.drawingPoints, pointer.point]));
  }
};

const handleDrawingUp = async (event) => {
  if (await runToolHook("onPointerUp", event)) return;
  if (state.tool === "eraser") {
    state.pointerDown = false;
    state.erasedDuringStroke.clear();
    return;
  }
  if (state.tool === "exportCrop" && state.pointerDown) {
    state.pointerDown = false;
    const box = state.cropRegion;
    if (box?.width >= 4 && box?.height >= 4) showToast("已保存导出框选区域。打开“导出”即可使用。", 2600);
    return;
  }
  if (state.tool === "freehand" && state.pointerDown) {
    state.pointerDown = false;
    clearPreview();
    if (state.freehandPoints.length > 1) {
      const model = createPolylineObject("freehand", state.freehandPoints, { style: currentStyle() });
      state.freehandPoints = [];
      await commitMutation("创建自由笔迹", (project) => { model.zIndex = project.objects.length; project.objects.push(model); }, { selection: [] });
    }
    return;
  }
  if (!state.pointerDown || !state.drawingStart || !toolIs("drag")) return;
  const pointer = pointerFromEvent(event);
  const model = buildDragObject(state.tool, state.drawingStart, pointer.point);
  state.pointerDown = false;
  state.drawingStart = null;
  clearPreview();
  if (!model || distance(getObjectCenter(model), pointer.point) < 0.001 && ["segment", "arrow"].includes(model.type)) return;
  await commitMutation(`创建${typeName(model.type)}`, (project) => { model.zIndex = project.objects.length; project.objects.push(model); }, { selection: [] });
};

const syncFabricTransformsToModel = (target) => {
  const objects = target?.modelId ? [target] : (target?.getObjects?.() || []);
  for (const fabricObject of objects) {
    const model = getObjectById(state.project, fabricObject.modelId);
    if (!model || fabricObject.isNodeHandle) continue;
    model.transform = extractModelTransform(fabricObject);
    if (["text", "measurement"].includes(model.type) && typeof fabricObject.text === "string") model.geometry.text = fabricObject.text;
    const relation = state.project.relations.find(
      (candidate) => candidate.sourceId === model.id && ["binding", "measurement"].includes(candidate.kind)
    );
    if (relation) {
      const relationTarget = getObjectById(state.project, relation.targetIds[0]);
      if (relationTarget) relation.data.offset = subtract(getObjectCenter(model), getObjectCenter(relationTarget));
    }
  }
  syncDerivedRelations(state.project);
};

const syncDerivedFabricObjects = () => {
  for (const relation of state.project.relations) {
    if (!["binding", "measurement"].includes(relation.kind)) continue;
    const source = getObjectById(state.project, relation.sourceId);
    const fabricObject = state.scene.objectMap.get(relation.sourceId);
    if (!source || !fabricObject) continue;
    fabricObject.set({ left: source.transform.x * WORLD_UNIT_PX, top: source.transform.y * WORLD_UNIT_PX });
    if (relation.kind === "measurement" && fabricObject.text !== source.geometry.text) fabricObject.set("text", source.geometry.text);
    fabricObject.setCoords();
  }
  state.scene.canvas.requestRenderAll();
};

const updateJunctionTargets = async (sourceId) => {
  const relations = state.project.relations.filter((relation) => relation.kind === "junction" && relation.sourceId === sourceId);
  const ids = new Set(relations.flatMap((relation) => relation.targetIds));
  for (const id of ids) {
    const model = getObjectById(state.project, id);
    if (model) await state.scene.updateObject(model);
  }
};

const handleObjectMoving = async (target) => {
  if (state.scene?.isRendering) return;
  if (!state.transformBefore) state.transformBefore = deepClone(state.project);
  syncFabricTransformsToModel(target);
  const ids = target?.modelId ? [target.modelId] : (target?.getObjects?.() || []).map((object) => object.modelId);
  for (const id of ids) await updateJunctionTargets(id);
  syncDerivedFabricObjects();
  updateInspector();
};

const handleObjectModified = async (target) => {
  if (state.scene?.isRendering) return;
  const before = state.transformBefore || deepClone(state.project);
  syncFabricTransformsToModel(target);
  touchProject(state.project);
  state.history.record(before, state.project, "变换对象");
  state.transformBefore = null;
  autosaver.schedule();
  await refreshProject({ selection: target?.modelId ? [target.modelId] : selectedIds() });
};

const handleNodeMove = async (handle, committed) => {
  const model = getObjectById(state.project, handle.nodeTargetId);
  if (!model) return;
  if (!state.nodeMoveBefore) state.nodeMoveBefore = deepClone(state.project);
  setEditableWorldPoint(model, handle.nodeIndex, point(handle.left / WORLD_UNIT_PX, handle.top / WORLD_UNIT_PX));
  syncDerivedRelations(state.project);
  await state.scene.updateObject(model);
  syncDerivedFabricObjects();
  if (committed) {
    state.history.record(state.nodeMoveBefore, state.project, "编辑节点");
    state.nodeMoveBefore = null;
    autosaver.schedule();
    state.intersections = collectIntersections(state.project.objects);
    state.scene.selectIds([model.id]);
    state.scene.showNodeHandles(model, handleNodeMove);
    updateHistoryButtons();
    updateInspector();
  }
};

const expandLogicalGroupSelection = () => {
  if (state.expandingGroup || !currentToolDefinition()?.selects) return;
  const ids = selectedIds();
  if (ids.length !== 1) return;
  const model = getObjectById(state.project, ids[0]);
  if (!model?.groupId) return;
  const members = getGroupMembers(state.project, model).filter((item) => !item.locked && !item.hidden).map((item) => item.id);
  if (members.length < 2) return;
  state.expandingGroup = true;
  queueMicrotask(() => {
    state.scene.selectIds(members);
    state.expandingGroup = false;
    updateInspector();
  });
};

const handleCanvasMouseDown = async ({ e, target }) => {
  stage()?.focus({ preventScroll: true });
  if (state.spaceDown || state.tool === "pan") {
    state.panning = true;
    state.panStart = { x: e.clientX, y: e.clientY, viewport: [...state.scene.canvas.viewportTransform] };
    state.scene.canvas.defaultCursor = "grabbing";
    e.preventDefault();
    return;
  }
  if (currentToolDefinition()?.selects) {
    if (target && !target.isNodeHandle) state.transformBefore = deepClone(state.project);
    return;
  }
  await handleDrawingDown(e, target);
};

const handleCanvasMouseMove = async ({ e }) => {
  if (state.panning && state.panStart) {
    const viewport = state.panStart.viewport;
    viewport[4] += e.clientX - state.panStart.x;
    viewport[5] += e.clientY - state.panStart.y;
    state.scene.canvas.setViewportTransform(viewport);
    updateZoomStatus();
    return;
  }
  await handleDrawingMove(e);
};

const handleCanvasMouseUp = async ({ e }) => {
  if (state.panning) {
    state.panning = false;
    state.panStart = null;
    state.scene.canvas.defaultCursor = state.tool === "pan" ? "grab" : "default";
    syncViewportToProject();
    autosaver.schedule();
    return;
  }
  await handleDrawingUp(e);
};

const updateZoomStatus = () => {
  $("#status-zoom").textContent = `${Math.round(state.scene.canvas.getZoom() * 100)}%`;
};

const syncViewportToProject = () => {
  state.project.viewport = state.scene.getViewport();
};

const handleWheel = (event) => {
  event.e.preventDefault();
  event.e.stopPropagation();
  const delta = event.e.deltaY;
  const current = state.scene.canvas.getZoom();
  const next = Math.max(0.15, Math.min(8, current * Math.pow(0.999, delta)));
  const rect = state.scene.canvas.upperCanvasEl.getBoundingClientRect();
  const pointer = { x: event.e.clientX - rect.left, y: event.e.clientY - rect.top };
  state.scene.canvas.zoomToPoint(pointer, next);
  syncViewportToProject();
  updateZoomStatus();
  autosaver.schedule();
};

const bindCanvasEvents = () => {
  const canvas = state.scene.canvas;
  canvas.on("mouse:down", handleCanvasMouseDown);
  canvas.on("mouse:move", handleCanvasMouseMove);
  canvas.on("mouse:up", handleCanvasMouseUp);
  canvas.on("mouse:wheel", handleWheel);
  canvas.on("mouse:dblclick", () => finishMultiPoint());
  canvas.on("selection:created", () => { expandLogicalGroupSelection(); updateInspector(); });
  canvas.on("selection:updated", () => { expandLogicalGroupSelection(); updateInspector(); });
  canvas.on("selection:cleared", updateInspector);
  canvas.on("object:moving", ({ target }) => handleObjectMoving(target));
  canvas.on("object:scaling", ({ target }) => handleObjectMoving(target));
  canvas.on("object:rotating", ({ target }) => handleObjectMoving(target));
  canvas.on("object:modified", ({ target }) => handleObjectModified(target));
  canvas.on("text:changed", ({ target }) => {
    const model = getObjectById(state.project, target?.modelId);
    if (model) model.geometry.text = target.text;
  });
  canvas.on("text:editing:exited", ({ target }) => {
    if (!target?.modelId) return;
    const before = state.transformBefore || deepClone(state.project);
    syncFabricTransformsToModel(target);
    state.history.record(before, state.project, "编辑文字");
    state.transformBefore = null;
    autosaver.schedule();
    updateHistoryButtons();
  });
};

const mutateSelectedStyles = async (label, mutator) => {
  const ids = selectedIds();
  if (!ids.length) return;
  await commitMutation(label, (project) => ids.forEach((id) => {
    const model = getObjectById(project, id);
    if (model) mutator(model);
  }), { selection: ids });
};

const groupSelection = async () => {
  const ids = selectedIds();
  if (ids.length < 2) return showToast("至少选择两个对象才能组合。");
  const allIds = new Set();
  ids.forEach((id) => getGroupMembers(state.project, id).forEach((model) => allIds.add(model.id)));
  const group = createGroup([...allIds]);
  await commitMutation("组合对象", (project) => {
    project.groups = project.groups.filter((candidate) => !candidate.memberIds.some((id) => allIds.has(id)));
    project.groups.push(group);
    project.objects.forEach((model) => { if (allIds.has(model.id)) model.groupId = group.id; });
  }, { selection: [...allIds] });
};

const ungroupSelection = async () => {
  const groupIds = new Set(getSelectedModels().map((model) => model.groupId).filter(Boolean));
  if (!groupIds.size) return showToast("当前选择中没有组合对象。");
  const ids = state.project.objects.filter((model) => groupIds.has(model.groupId)).map((model) => model.id);
  await commitMutation("取消组合", (project) => {
    project.objects.forEach((model) => { if (groupIds.has(model.groupId)) model.groupId = null; });
    project.groups = project.groups.filter((group) => !groupIds.has(group.id));
  }, { selection: ids });
};

const changeLayer = async (action) => {
  const ids = new Set(selectedIds());
  if (!ids.size) return;
  await commitMutation("调整层级", (project) => {
    normalizeZIndexes(project);
    const selected = project.objects.filter((model) => ids.has(model.id));
    const unselected = project.objects.filter((model) => !ids.has(model.id));
    if (action === "send-back") project.objects = [...selected, ...unselected];
    if (action === "bring-front") project.objects = [...unselected, ...selected];
    if (action === "move-back") {
      for (const model of selected) {
        const index = project.objects.indexOf(model);
        if (index > 0) [project.objects[index - 1], project.objects[index]] = [project.objects[index], project.objects[index - 1]];
      }
    }
    if (action === "move-forward") {
      for (const model of [...selected].reverse()) {
        const index = project.objects.indexOf(model);
        if (index < project.objects.length - 1) [project.objects[index], project.objects[index + 1]] = [project.objects[index + 1], project.objects[index]];
      }
    }
    project.objects.forEach((model, index) => { model.zIndex = index; });
  }, { selection: [...ids] });
};

const bindSelectedText = async () => {
  const models = getSelectedModels();
  const text = models.find((model) => model.type === "text");
  const target = models.find((model) => model.type !== "text" && model.type !== "measurement");
  if (!text || !target || models.length !== 2) return showToast("请同时选择一个文字对象和一个目标图形。");
  const offset = subtract(getObjectCenter(text), getObjectCenter(target));
  await commitMutation("绑定文字", (project) => {
    project.relations = project.relations.filter((relation) => !(relation.kind === "binding" && relation.sourceId === text.id));
    project.relations.push(createRelation("binding", text.id, [target.id], { offset }));
  }, { selection: [text.id, target.id] });
};

const toggleNodeEdit = () => {
  const models = getSelectedModels();
  if (models.length !== 1) return showToast("节点编辑一次只能处理一个对象。");
  const handles = state.scene.showNodeHandles(models[0], handleNodeMove);
  if (!handles.length) showToast("此对象使用缩放与旋转手柄编辑，不提供独立节点。");
  else showToast("拖动蓝色节点调整几何结构；再次选择其他工具可退出。", 2800);
};

const resetView = () => {
  const rect = stage().getBoundingClientRect();
  state.scene.setViewport(1, rect.width / 2, rect.height / 2);
  syncViewportToProject();
  updateZoomStatus();
  autosaver.schedule();
};

const fitContent = () => {
  const visible = state.scene.canvas.getObjects().filter((object) => object.modelId && !object.isNodeHandle && !["ray", "infiniteLine"].includes(object.modelType));
  if (!visible.length) return resetView();
  const bounds = visible.reduce((result, object) => {
    const rect = object.getBoundingRect();
    return {
      left: Math.min(result.left, rect.left), top: Math.min(result.top, rect.top),
      right: Math.max(result.right, rect.left + rect.width), bottom: Math.max(result.bottom, rect.top + rect.height)
    };
  }, { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity });
  const width = Math.max(1, bounds.right - bounds.left);
  const height = Math.max(1, bounds.bottom - bounds.top);
  const zoom = Math.max(0.15, Math.min(4, Math.min((state.scene.canvas.width - 120) / width, (state.scene.canvas.height - 120) / height)));
  const center = { x: (bounds.left + bounds.right) / 2, y: (bounds.top + bounds.bottom) / 2 };
  state.scene.setViewport(zoom, state.scene.canvas.width / 2 - center.x * zoom, state.scene.canvas.height / 2 - center.y * zoom);
  syncViewportToProject();
  updateZoomStatus();
  autosaver.schedule();
};

const deleteSelection = async () => {
  const ids = selectedIds();
  if (!ids.length) return;
  await commitMutation("删除对象", (project) => removeObjects(project, ids), { selection: [] });
};

const undo = async () => {
  const entry = state.history.undo(state.project);
  if (!entry) return;
  const viewport = state.scene.getViewport();
  state.project = entry.project;
  state.project.viewport = viewport;
  autosaver.schedule();
  await refreshProject({ selection: [] });
  showToast(`已撤销：${entry.label}`, 1400);
};

const redo = async () => {
  const entry = state.history.redo(state.project);
  if (!entry) return;
  const viewport = state.scene.getViewport();
  state.project = entry.project;
  state.project.viewport = viewport;
  autosaver.schedule();
  await refreshProject({ selection: [] });
  showToast(`已重做：${entry.label}`, 1400);
};

const openExportDialog = () => {
  $("#export-scope").value = uiPreferences.exportScope || "viewport";
  $("#export-background").value = uiPreferences.exportBackground || "current";
  $("#export-grid").checked = uiPreferences.exportGrid ?? state.project.document.grid.mode !== "none";
  $("#export-axes").checked = uiPreferences.exportAxes ?? state.project.document.grid.axesVisible;
  $("#export-crop-note").classList.toggle("is-hidden", Boolean(state.cropRegion));
  $("#geometry-export-dialog").showModal();
};

const exportOptions = () => ({
  scope: $("#export-scope").value,
  background: $("#export-background").value,
  includeGrid: $("#export-grid").checked,
  includeAxes: $("#export-axes").checked
});

const handleExport = async (format) => {
  const button = $(`[data-export="${format}"]`);
  if (button) button.disabled = true;
  try {
    const options = exportOptions();
    Object.assign(uiPreferences, {
      exportScope: options.scope,
      exportBackground: options.background,
      exportGrid: options.includeGrid,
      exportAxes: options.includeAxes
    });
    saveUiPreferences();
    if (format === "png") await downloadPng(state.scene, state.project, options, state.cropRegion);
    if (format === "svg") downloadSvg(state.scene, state.project, options, state.cropRegion);
    if (format === "clipboard") {
      const result = await copyPng(state.scene, state.project, options, state.cropRegion);
      showToast(result.fallback ? "浏览器未允许写入剪贴板，已改为下载 PNG。" : "PNG 已复制到剪贴板。");
    } else showToast(`${format.toUpperCase()} 已导出。`);
  } catch (error) {
    showToast(`导出失败：${String(error?.message || "未知错误")}`, 3200);
  } finally {
    if (button) button.disabled = false;
  }
};

const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result || ""));
  reader.onerror = () => reject(reader.error || new Error("文件读取失败。"));
  reader.readAsDataURL(file);
});

const readImageSize = (src) => new Promise((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
  image.onerror = () => reject(new Error("图片格式无法识别。"));
  image.src = src;
});

const importImageFile = async (file) => {
  const supportedTypes = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);
  if (!supportedTypes.has(file?.type)) throw new Error("请选择 PNG、JPEG、GIF 或 WebP 图片。");
  const src = await readFileAsDataUrl(file);
  const size = await readImageSize(src);
  const maxWidthUnits = 12;
  const width = Math.min(maxWidthUnits, size.width / WORLD_UNIT_PX);
  const height = width * (size.height / size.width);
  const viewportCenter = state.scene.canvas.getVpCenter();
  const model = createGeometryObject("image", { src, width, height, naturalWidth: size.width, naturalHeight: size.height }, {
    name: file.name || "图片",
    transform: { x: viewportCenter.x / WORLD_UNIT_PX, y: viewportCenter.y / WORLD_UNIT_PX },
    style: currentStyle({ stroke: "#8891ad", fill: "transparent" })
  });
  await commitMutation("导入图片", (project) => { model.zIndex = project.objects.length; project.objects.push(model); }, { selection: [model.id] });
};

const openProjectFile = async (file) => {
  const source = await file.text();
  const project = parseProject(source);
  state.project = project;
  state.history.clear();
  await refreshProject({ selection: [], keepViewport: false });
  autosaver.schedule();
  showToast("工程文件已打开。");
};

const bindInspectorInputs = () => {
  const styleBindings = [
    ["#object-stroke", (model, value) => { model.style.stroke = value; }],
    ["#object-fill", (model, value) => { model.style.fill = value; }],
    ["#object-stroke-width", (model, value) => { model.style.strokeWidth = Number(value); }],
    ["#object-dash", (model, value) => { model.style.dash = value; }],
    ["#object-opacity", (model, value) => { model.style.opacity = Number(value) / 100; }],
    ["#object-arrow-start", (model, value) => { if (LINE_TYPES.has(model.type)) model.style.arrowStart = value; }, "checked"],
    ["#object-arrow-end", (model, value) => { if (LINE_TYPES.has(model.type)) model.style.arrowEnd = value; }, "checked"],
    ["#object-font-size", (model, value) => { model.style.fontSize = Number(value); }],
    ["#object-text-align", (model, value) => { model.style.textAlign = value; }],
    ["#object-font-bold", (model, value) => { model.style.fontWeight = value ? "bold" : "normal"; }, "checked"],
    ["#object-font-italic", (model, value) => { model.style.fontStyle = value ? "italic" : "normal"; }, "checked"]
  ];
  styleBindings.forEach(([selector, apply, mode]) => {
    $(selector)?.addEventListener("change", async (event) => {
      if (selector === "#object-opacity") $("#object-opacity-output").textContent = `${event.target.value}%`;
      await mutateSelectedStyles("修改对象样式", (model) => apply(model, mode === "checked" ? event.target.checked : event.target.value));
    });
  });
  $("#object-opacity")?.addEventListener("input", (event) => { $("#object-opacity-output").textContent = `${event.target.value}%`; });
  $("#object-name")?.addEventListener("change", async (event) => {
    const ids = selectedIds();
    if (ids.length !== 1) return;
    await commitMutation("重命名对象", (project) => { const model = getObjectById(project, ids[0]); if (model) model.name = event.target.value.trim() || typeName(model.type); }, { selection: ids });
  });

  $("#grid-mode")?.addEventListener("change", async (event) => commitMutation("切换网格", (project) => {
    project.document.grid.mode = event.target.value;
    project.document.grid.visible = event.target.value !== "none";
  }, { selection: selectedIds() }));
  $("#grid-spacing")?.addEventListener("change", async (event) => commitMutation("调整网格间距", (project) => {
    project.document.grid.spacing = Math.max(0.25, Math.min(10, Number(event.target.value) || 1));
  }, { selection: selectedIds() }));
  $("#grid-axes")?.addEventListener("change", async (event) => commitMutation("切换坐标轴", (project) => { project.document.grid.axesVisible = event.target.checked; }, { selection: selectedIds() }));
  $("#grid-snap")?.addEventListener("change", async (event) => commitMutation("切换吸附", (project) => { project.document.grid.snapEnabled = event.target.checked; }, { selection: selectedIds() }));
  $("#document-background")?.addEventListener("change", async (event) => commitMutation("切换文档背景", (project) => { project.document.background = event.target.value; }, { selection: selectedIds() }));
  $("#geometry-title")?.addEventListener("change", async (event) => commitMutation("修改工程名称", (project) => { project.meta.title = event.target.value.trim() || "未命名作图"; }, { selection: selectedIds() }));
};

const handleAction = async (action) => {
  if (action === "undo") return undo();
  if (action === "redo") return redo();
  if (action === "new-project") {
    if (state.project.objects.length && !window.confirm("新建工程会替换当前画布；当前工程仍可先导出工程文件。继续吗？")) return;
    state.project = createDefaultProject(); state.history.clear(); resetView(); await refreshProject({ selection: [] }); autosaver.schedule(); return;
  }
  if (action === "import-image") return $("#geometry-image-input").click();
  if (action === "open-project") return $("#geometry-project-input").click();
  if (action === "save-project") return downloadProject(state.project, serializeProject(state.project));
  if (action === "open-export") return openExportDialog();
  if (action === "toggle-inspector") {
    uiPreferences.inspectorOpen = document.body.classList.toggle("geometry-inspector-open");
    saveUiPreferences();
    return;
  }
  if (action === "group") return groupSelection();
  if (action === "ungroup") return ungroupSelection();
  if (action === "toggle-node-edit") return toggleNodeEdit();
  if (action === "bind-text") return bindSelectedText();
  if (["send-back", "move-back", "move-forward", "bring-front"].includes(action)) return changeLayer(action);
  if (action === "toggle-lock") return mutateSelectedStyles("切换锁定", (model) => { model.locked = !model.locked; });
  if (action === "toggle-hidden") return mutateSelectedStyles("切换隐藏", (model) => { model.hidden = !model.hidden; });
  if (action === "delete-selection") return deleteSelection();
  if (action === "reset-view") return resetView();
  if (action === "fit-content") return fitContent();
  if (action === "show-all") return commitMutation("显示全部对象", (project) => {
    project.objects.forEach((model) => { model.hidden = false; });
  }, { selection: [] });
};

const bindUiEvents = () => {
  document.addEventListener("click", async (event) => {
    const tool = event.target.closest("[data-tool]");
    if (tool) {
      if (tool.dataset.tool === "measure" && getSelectedModels().length) await createMeasurementForSelection();
      else activateTool(tool.dataset.tool);
      tool.closest("details")?.removeAttribute("open");
      return;
    }
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (action) await handleAction(action);
    const format = event.target.closest("[data-export]")?.dataset.export;
    if (format) await handleExport(format);
  });

  $("#geometry-image-input").addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try { await importImageFile(file); } catch (error) { showToast(`图片导入失败：${String(error?.message || "未知错误")}`, 3200); }
  });
  $("#geometry-project-input").addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try { await openProjectFile(file); } catch (error) { showToast(`工程打开失败：${String(error?.message || "未知错误")}`, 3600); }
  });

  const stageElement = stage();
  stageElement.addEventListener("dragover", (event) => { event.preventDefault(); $("#geometry-drop-hint").classList.remove("is-hidden"); });
  stageElement.addEventListener("dragleave", () => $("#geometry-drop-hint").classList.add("is-hidden"));
  stageElement.addEventListener("drop", async (event) => {
    event.preventDefault(); $("#geometry-drop-hint").classList.add("is-hidden");
    const file = [...(event.dataTransfer?.files || [])].find((item) => item.type.startsWith("image/"));
    if (file) try { await importImageFile(file); } catch (error) { showToast(`图片导入失败：${String(error?.message || "未知错误")}`); }
  });
  document.addEventListener("paste", async (event) => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || state.scene.canvas.getActiveObject()?.isEditing) return;
    const file = [...(event.clipboardData?.files || [])].find((item) => item.type.startsWith("image/"));
    if (file) try { await importImageFile(file); } catch (error) { showToast(`剪贴板图片导入失败：${String(error?.message || "未知错误")}`); }
  });
  bindInspectorInputs();
};

const bindKeyboard = () => {
  window.addEventListener("keydown", async (event) => {
    const editing = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement || state.scene.canvas.getActiveObject()?.isEditing;
    if (event.code === "Space" && !editing) { state.spaceDown = true; event.preventDefault(); }
    if (editing) return;
    const modifier = event.ctrlKey || event.metaKey;
    if (modifier && event.key.toLowerCase() === "z") { event.preventDefault(); return event.shiftKey ? redo() : undo(); }
    if (modifier && event.key.toLowerCase() === "y") { event.preventDefault(); return redo(); }
    if (modifier && event.key.toLowerCase() === "g") { event.preventDefault(); return event.shiftKey ? ungroupSelection() : groupSelection(); }
    if (["Delete", "Backspace"].includes(event.key)) { event.preventDefault(); return deleteSelection(); }
    if (event.key === "Escape") { state.drawingPoints = []; clearPreview(); return activateTool("select", { announce: false }); }
    if (event.key === "Enter" && toolIs("multi")) { event.preventDefault(); return finishMultiPoint(); }
    const shortcutTool = findToolByShortcut(event.key);
    if (shortcutTool) {
      event.preventDefault();
      if (shortcutTool.id === "measure" && getSelectedModels().length) return createMeasurementForSelection();
      activateTool(shortcutTool.id);
    }
    if (event.key === "0") resetView();
    if (event.key === "1") fitContent();
  });
  window.addEventListener("keyup", (event) => { if (event.code === "Space") state.spaceDown = false; });
};

const setupResizeObserver = () => {
  const observer = new ResizeObserver(([entry]) => {
    const { width, height } = entry.contentRect;
    state.scene.resize(width, height);
    if (state.project.viewport.panX === 0 && state.project.viewport.panY === 0) resetView();
  });
  observer.observe(stage());
};

export const initializeGeometryWorkspace = async () => {
  $("#app").innerHTML = geometryWorkspaceMarkup();
  document.body.classList.toggle("geometry-inspector-open", Boolean(uiPreferences.inspectorOpen));
  initSiteHeaderAuth();

  let restored = null;
  try { restored = await loadCurrentProject(); } catch { /* local persistence is optional */ }
  if (restored) state.project = restored;

  state.scene = new FabricScene($("#geometry-canvas"), () => state.project);
  const rect = stage().getBoundingClientRect();
  state.scene.resize(rect.width, rect.height);
  if (state.project.viewport.panX === 0 && state.project.viewport.panY === 0) {
    state.project.viewport.panX = rect.width / 2;
    state.project.viewport.panY = rect.height / 2;
  }
  state.scene.setViewport(state.project.viewport.zoom, state.project.viewport.panX, state.project.viewport.panY);

  bindCanvasEvents();
  bindUiEvents();
  bindKeyboard();
  setupResizeObserver();
  await refreshProject({ selection: [], keepViewport: false });
  activateTool("select", { announce: false });
  updateZoomStatus();
  updateSaveState(restored ? "saved" : "local");
};
