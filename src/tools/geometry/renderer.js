import {
  ActiveSelection,
  Canvas,
  Circle,
  Ellipse,
  FabricImage,
  IText,
  Path,
  Point as FabricPoint,
  Polygon,
  Rect,
  util
} from "../../vendor/fabric-7.4.0.min.js";
import { WORLD_UNIT_PX } from "./model.js";
import { getEditableWorldPoints, getWorldPoints, pointOnArc } from "./geometry.js?v=20260820";

const TAU = Math.PI * 2;
const LINE_RENDER_LENGTH = 10000;

const cssColor = (background) => {
  if (background === "transparent") return "transparent";
  if (background === "dark") return "#111a35";
  return "#ffffff";
};

const toPx = (value) => Number(value || 0) * WORLD_UNIT_PX;
const pt = (value) => ({ x: toPx(value.x), y: toPx(value.y) });
const pathPoint = (value) => `${toPx(value.x).toFixed(4)} ${toPx(value.y).toFixed(4)}`;

const lineDash = (style) => (style.dash === "dashed" ? [9, 7] : null);

const transformOffset = (offset, scaleX, scaleY, angleDegrees) => {
  const x = Number(offset?.x || 0) * Number(scaleX || 1);
  const y = Number(offset?.y || 0) * Number(scaleY || 1);
  const angle = (Number(angleDegrees || 0) * Math.PI) / 180;
  return {
    x: x * Math.cos(angle) - y * Math.sin(angle),
    y: x * Math.sin(angle) + y * Math.cos(angle)
  };
};

const arrowHeadCommands = (tip, direction, size = 0.38) => {
  const length = Math.hypot(direction.x, direction.y) || 1;
  const unit = { x: direction.x / length, y: direction.y / length };
  const normal = { x: -unit.y, y: unit.x };
  const base = { x: tip.x - unit.x * size, y: tip.y - unit.y * size };
  const left = { x: base.x + normal.x * size * 0.46, y: base.y + normal.y * size * 0.46 };
  const right = { x: base.x - normal.x * size * 0.46, y: base.y - normal.y * size * 0.46 };
  return `M ${pathPoint(left)} L ${pathPoint(tip)} L ${pathPoint(right)}`;
};

const localLinePoints = (object) => object.geometry?.points || [];

const createLinePath = (object) => {
  let points = localLinePoints(object);
  let command = "";
  let startDirection = { x: 1, y: 0 };
  let endDirection = { x: 1, y: 0 };

  if (["segment", "arrow", "polyline", "freehand"].includes(object.type) && points.length > 1) {
    command = `M ${pathPoint(points[0])} ${points.slice(1).map((value) => `L ${pathPoint(value)}`).join(" ")}`;
    startDirection = { x: points[0].x - points[1].x, y: points[0].y - points[1].y };
    endDirection = { x: points.at(-1).x - points.at(-2).x, y: points.at(-1).y - points.at(-2).y };
  } else if (object.type === "bezier" && points.length === 4) {
    command = `M ${pathPoint(points[0])} C ${pathPoint(points[1])}, ${pathPoint(points[2])}, ${pathPoint(points[3])}`;
    startDirection = { x: points[0].x - points[1].x, y: points[0].y - points[1].y };
    endDirection = { x: points[3].x - points[2].x, y: points[3].y - points[2].y };
  } else if (object.type === "ray" || object.type === "infiniteLine") {
    const direction = object.geometry?.direction || { x: 1, y: 0 };
    const start = object.type === "ray" ? { x: 0, y: 0 } : { x: -direction.x * LINE_RENDER_LENGTH, y: -direction.y * LINE_RENDER_LENGTH };
    const end = { x: direction.x * LINE_RENDER_LENGTH, y: direction.y * LINE_RENDER_LENGTH };
    points = [start, end];
    command = `M ${pathPoint(start)} L ${pathPoint(end)}`;
    startDirection = { x: -direction.x, y: -direction.y };
    endDirection = direction;
  } else if (object.type === "arc") {
    const radius = Number(object.geometry.radius || 1);
    const startAngle = Number(object.geometry.startAngle || 0);
    const endAngle = Number(object.geometry.endAngle || Math.PI);
    const clockwise = Boolean(object.geometry.clockwise);
    const start = { x: Math.cos(startAngle) * radius, y: Math.sin(startAngle) * radius };
    const end = { x: Math.cos(endAngle) * radius, y: Math.sin(endAngle) * radius };
    let sweep = clockwise ? startAngle - endAngle : endAngle - startAngle;
    while (sweep < 0) sweep += TAU;
    while (sweep > TAU) sweep -= TAU;
    const largeArc = sweep > Math.PI ? 1 : 0;
    const sweepFlag = clockwise ? 0 : 1;
    command = `M ${pathPoint(start)} A ${toPx(radius)} ${toPx(radius)} 0 ${largeArc} ${sweepFlag} ${pathPoint(end)}`;
    startDirection = { x: clockwise ? -Math.sin(startAngle) : Math.sin(startAngle), y: clockwise ? Math.cos(startAngle) : -Math.cos(startAngle) };
    endDirection = { x: clockwise ? Math.sin(endAngle) : -Math.sin(endAngle), y: clockwise ? -Math.cos(endAngle) : Math.cos(endAngle) };
    points = [start, end];
  }

  const showStart = object.style.arrowStart || (object.type === "arrow" && !object.style.arrowEnd);
  const showEnd = object.style.arrowEnd || object.type === "arrow";
  if (showStart && points.length) command += ` ${arrowHeadCommands(points[0], startDirection)}`;
  if (showEnd && points.length) command += ` ${arrowHeadCommands(points.at(-1), endDirection)}`;
  return command;
};

const createSectorPath = (object) => {
  const radius = Number(object.geometry.radius || 1);
  const startAngle = Number(object.geometry.startAngle || 0);
  const endAngle = Number(object.geometry.endAngle || Math.PI / 2);
  const start = { x: Math.cos(startAngle) * radius, y: Math.sin(startAngle) * radius };
  const end = { x: Math.cos(endAngle) * radius, y: Math.sin(endAngle) * radius };
  let sweep = endAngle - startAngle;
  while (sweep < 0) sweep += TAU;
  const largeArc = sweep > Math.PI ? 1 : 0;
  return `M 0 0 L ${pathPoint(start)} A ${toPx(radius)} ${toPx(radius)} 0 ${largeArc} 1 ${pathPoint(end)} Z`;
};

const baseOptions = (object) => ({
  left: toPx(object.transform.x),
  top: toPx(object.transform.y),
  originX: "center",
  originY: "center",
  scaleX: Number(object.transform.scaleX || 1),
  scaleY: Number(object.transform.scaleY || 1),
  angle: Number(object.transform.rotation || 0),
  fill: object.style.fill === "transparent" ? "rgba(0,0,0,0)" : object.style.fill,
  stroke: object.style.stroke,
  strokeWidth: Number(object.style.strokeWidth || 2),
  strokeDashArray: lineDash(object.style),
  opacity: Number(object.style.opacity ?? 1),
  visible: !object.hidden,
  selectable: !object.locked && !object.hidden,
  evented: !object.locked && !object.hidden,
  transparentCorners: false,
  cornerColor: "#4f6bff",
  cornerStrokeColor: "#ffffff",
  borderColor: "#4f6bff",
  cornerSize: 9,
  padding: 4,
  objectCaching: object.type === "image"
});

const attachMetadata = (fabricObject, model, extra = {}) => {
  fabricObject.modelId = model.id;
  fabricObject.modelType = model.type;
  fabricObject.modelPathOffset = extra.pathOffset || null;
  fabricObject.modelBaseScale = extra.baseScale || { x: 1, y: 1 };
  fabricObject.setCoords();
  return fabricObject;
};

const positionPath = (fabricObject, object) => {
  const offset = transformOffset(fabricObject.pathOffset, object.transform.scaleX, object.transform.scaleY, object.transform.rotation);
  fabricObject.set({
    left: toPx(object.transform.x) + offset.x,
    top: toPx(object.transform.y) + offset.y
  });
  return attachMetadata(fabricObject, object, { pathOffset: { x: fabricObject.pathOffset.x, y: fabricObject.pathOffset.y } });
};

export const createFabricObject = async (object) => {
  const options = baseOptions(object);
  let fabricObject;

  if (object.type === "point") {
    fabricObject = new Circle({ ...options, radius: toPx(object.geometry.radius || 0.11), fill: object.style.fill === "transparent" ? object.style.stroke : object.style.fill });
  } else if (["segment", "ray", "infiniteLine", "polyline", "bezier", "arc", "arrow", "freehand"].includes(object.type)) {
    fabricObject = new Path(createLinePath(object), { ...options, fill: "rgba(0,0,0,0)", strokeLineCap: "round", strokeLineJoin: "round" });
    return positionPath(fabricObject, object);
  } else if (object.type === "circle") {
    fabricObject = new Circle({ ...options, radius: toPx(object.geometry.radius || 1) });
  } else if (object.type === "ellipse") {
    fabricObject = new Ellipse({ ...options, rx: toPx(object.geometry.rx || 1), ry: toPx(object.geometry.ry || 0.65) });
  } else if (object.type === "rect") {
    fabricObject = new Rect({ ...options, width: toPx(object.geometry.width || 2), height: toPx(object.geometry.height || 1.4), rx: 2, ry: 2 });
  } else if (["triangle", "polygon", "regularPolygon"].includes(object.type)) {
    fabricObject = new Polygon((object.geometry.points || []).map(pt), { ...options, strokeLineJoin: "round" });
  } else if (object.type === "sector") {
    fabricObject = new Path(createSectorPath(object), { ...options, strokeLineJoin: "round" });
    return positionPath(fabricObject, object);
  } else if (object.type === "text" || object.type === "measurement") {
    fabricObject = new IText(String(object.geometry.text || (object.type === "measurement" ? "—" : "批注")), {
      ...options,
      fill: object.style.stroke,
      stroke: null,
      fontFamily: object.style.fontFamily || "ZCOOL XiaoWei",
      fontSize: Number(object.style.fontSize || 18),
      fontWeight: object.style.fontWeight || "normal",
      fontStyle: object.style.fontStyle || "normal",
      textAlign: object.style.textAlign || "left",
      backgroundColor: object.type === "measurement" ? "rgba(255,255,255,0.78)" : ""
    });
  } else if (object.type === "image") {
    fabricObject = await FabricImage.fromURL(object.geometry.src, { crossOrigin: "anonymous" });
    const baseScale = {
      x: toPx(object.geometry.width || fabricObject.width / WORLD_UNIT_PX) / Math.max(1, fabricObject.width),
      y: toPx(object.geometry.height || fabricObject.height / WORLD_UNIT_PX) / Math.max(1, fabricObject.height)
    };
    fabricObject.set({ ...options, scaleX: baseScale.x * options.scaleX, scaleY: baseScale.y * options.scaleY });
    return attachMetadata(fabricObject, object, { baseScale });
  } else {
    fabricObject = new Rect({ ...options, width: toPx(1), height: toPx(1) });
  }

  return attachMetadata(fabricObject, object);
};

export const extractModelTransform = (fabricObject) => {
  const baseScale = fabricObject.modelBaseScale || { x: 1, y: 1 };
  const decomposed = util.qrDecompose(fabricObject.calcTransformMatrix());
  const scaleX = Number(decomposed.scaleX || 1) / Number(baseScale.x || 1);
  const scaleY = Number(decomposed.scaleY || 1) / Number(baseScale.y || 1);
  const angle = Number(decomposed.angle || 0);
  const offset = transformOffset(fabricObject.modelPathOffset, scaleX, scaleY, angle);
  return {
    x: (Number(decomposed.translateX || 0) - offset.x) / WORLD_UNIT_PX,
    y: (Number(decomposed.translateY || 0) - offset.y) / WORLD_UNIT_PX,
    scaleX,
    scaleY,
    rotation: angle
  };
};

export const drawGrid = (context, width, height, viewportTransform, documentSettings, overrides = {}) => {
  const background = overrides.background || documentSettings.background || "white";
  const includeGrid = overrides.includeGrid ?? documentSettings.grid.visible;
  const includeAxes = overrides.includeAxes ?? documentSettings.grid.axesVisible;
  const mode = overrides.gridMode || documentSettings.grid.mode;
  const backgroundColor = cssColor(background);

  context.save();
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, width, height);
  if (backgroundColor !== "transparent") {
    context.fillStyle = backgroundColor;
    context.fillRect(0, 0, width, height);
  }

  const zoom = Number(viewportTransform[0] || 1);
  const spacingUnits = Math.max(0.05, Number(documentSettings.grid.spacing || 1));
  let spacing = WORLD_UNIT_PX * spacingUnits * zoom;
  let visualFactor = 1;
  while (spacing * visualFactor < 12) visualFactor *= 2;
  const visualSpacing = spacing * visualFactor;
  const originX = Number(viewportTransform[4] || 0);
  const originY = Number(viewportTransform[5] || 0);
  const dark = background === "dark";
  const minor = dark ? "rgba(190,205,255,0.12)" : "rgba(57,72,112,0.10)";
  const major = dark ? "rgba(190,205,255,0.22)" : "rgba(57,72,112,0.20)";

  if (includeGrid && mode !== "none") {
    const startX = ((originX % visualSpacing) + visualSpacing) % visualSpacing;
    const startY = ((originY % visualSpacing) + visualSpacing) % visualSpacing;
    if (mode === "dot") {
      context.fillStyle = minor;
      for (let x = startX; x <= width; x += visualSpacing) {
        for (let y = startY; y <= height; y += visualSpacing) {
          context.beginPath();
          context.arc(x, y, 1.15, 0, TAU);
          context.fill();
        }
      }
    } else {
      context.lineWidth = 1;
      for (let x = startX; x <= width; x += visualSpacing) {
        const worldIndex = Math.round((x - originX) / spacing);
        context.strokeStyle = worldIndex % Math.max(1, Number(documentSettings.grid.majorEvery || 5)) === 0 ? major : minor;
        context.beginPath(); context.moveTo(Math.round(x) + 0.5, 0); context.lineTo(Math.round(x) + 0.5, height); context.stroke();
      }
      for (let y = startY; y <= height; y += visualSpacing) {
        const worldIndex = Math.round((y - originY) / spacing);
        context.strokeStyle = worldIndex % Math.max(1, Number(documentSettings.grid.majorEvery || 5)) === 0 ? major : minor;
        context.beginPath(); context.moveTo(0, Math.round(y) + 0.5); context.lineTo(width, Math.round(y) + 0.5); context.stroke();
      }
    }
  }

  if (includeAxes) {
    context.strokeStyle = dark ? "rgba(162,182,255,0.62)" : "rgba(39,48,82,0.52)";
    context.lineWidth = 1.35;
    context.beginPath(); context.moveTo(originX, 0); context.lineTo(originX, height); context.stroke();
    context.beginPath(); context.moveTo(0, originY); context.lineTo(width, originY); context.stroke();
  }
  context.restore();
};

export class FabricScene {
  constructor(canvasElement, getProject) {
    this.getProject = getProject;
    this.isRendering = false;
    this.objectMap = new Map();
    this.nodeHandles = [];
    this.nodeEditVisual = null;
    this.gridOverrides = null;
    this.canvas = new Canvas(canvasElement, {
      preserveObjectStacking: true,
      selection: true,
      selectionKey: "shiftKey",
      stopContextMenu: true,
      fireRightClick: true,
      enableRetinaScaling: true
    });

    this.canvas.on("before:render", ({ ctx }) => {
      const project = this.getProject();
      drawGrid(ctx, this.canvas.width, this.canvas.height, this.canvas.viewportTransform, project.document, this.gridOverrides || {});
    });
  }

  resize(width, height) {
    this.canvas.setDimensions({ width: Math.max(1, width), height: Math.max(1, height) });
  }

  async render(project, selectedIds = []) {
    this.isRendering = true;
    try {
      this.clearNodeHandles();
      this.canvas.discardActiveObject();
      this.canvas.remove(...this.canvas.getObjects());
      this.objectMap.clear();
      const objects = [...project.objects].sort((left, right) => left.zIndex - right.zIndex);
      for (const model of objects) {
        try {
          const fabricObject = await createFabricObject(model);
          this.objectMap.set(model.id, fabricObject);
          this.canvas.add(fabricObject);
        } catch (error) {
          console.warn(`无法渲染对象 ${model.id}`, error);
        }
      }
      const selected = selectedIds.map((id) => this.objectMap.get(id)).filter((object) => object?.selectable);
      if (selected.length === 1) this.canvas.setActiveObject(selected[0]);
      else if (selected.length > 1) this.canvas.setActiveObject(new ActiveSelection(selected, { canvas: this.canvas }));
      this.canvas.requestRenderAll();
    } finally {
      this.isRendering = false;
    }
  }

  setViewport(zoom, panX, panY) {
    this.canvas.setViewportTransform([zoom, 0, 0, zoom, panX, panY]);
  }

  getViewport() {
    const [zoom, , , , panX, panY] = this.canvas.viewportTransform;
    return { zoom, panX, panY };
  }

  viewportPointToWorld(clientX, clientY) {
    const rect = this.canvas.upperCanvasEl.getBoundingClientRect();
    const viewportPoint = new FabricPoint(clientX - rect.left, clientY - rect.top);
    const scene = viewportPoint.transform(
      // Fabric exports the inverse internally through getScenePoint, but this keeps pointer conversion testable.
      (() => {
        const [a, b, c, d, e, f] = this.canvas.viewportTransform;
        const determinant = a * d - b * c || 1;
        return [d / determinant, -b / determinant, -c / determinant, a / determinant, (c * f - d * e) / determinant, (b * e - a * f) / determinant];
      })()
    );
    return { x: scene.x / WORLD_UNIT_PX, y: scene.y / WORLD_UNIT_PX };
  }

  worldPointToViewport(value) {
    const [a, b, c, d, e, f] = this.canvas.viewportTransform;
    const x = toPx(value.x);
    const y = toPx(value.y);
    return { x: a * x + c * y + e, y: b * x + d * y + f };
  }

  getSelectedIds() {
    const active = this.canvas.getActiveObject();
    if (!active) return [];
    const values = active.modelId ? [active] : (active.getObjects?.() || []);
    return values.map((object) => object.modelId).filter(Boolean);
  }

  selectIds(ids) {
    const objects = ids.map((id) => this.objectMap.get(id)).filter((object) => object?.selectable);
    this.canvas.discardActiveObject();
    if (objects.length === 1) this.canvas.setActiveObject(objects[0]);
    else if (objects.length > 1) this.canvas.setActiveObject(new ActiveSelection(objects, { canvas: this.canvas }));
    this.canvas.requestRenderAll();
  }

  clearNodeHandles() {
    if (this.nodeHandles.length) this.canvas.remove(...this.nodeHandles);
    this.nodeHandles = [];
    if (this.nodeEditVisual) {
      this.nodeEditVisual.object.set({
        hasControls: this.nodeEditVisual.hasControls,
        hasBorders: this.nodeEditVisual.hasBorders
      });
      this.nodeEditVisual = null;
    }
  }

  showNodeHandles(model, onMove) {
    this.clearNodeHandles();
    const editablePoints = getEditableWorldPoints(model);
    if (!editablePoints.length) return [];
    const activeObject = this.canvas.getActiveObject();
    if (activeObject?.modelId === model.id) {
      this.nodeEditVisual = { object: activeObject, hasControls: activeObject.hasControls, hasBorders: activeObject.hasBorders };
      activeObject.set({ hasControls: false, hasBorders: false });
    }
    editablePoints.forEach((value, index) => {
      const handle = new Circle({
        left: toPx(value.x), top: toPx(value.y), originX: "center", originY: "center", radius: 5,
        fill: index === 0 || index === editablePoints.length - 1 ? "#4f6bff" : "#ffffff",
        stroke: "#4f6bff", strokeWidth: 2, hasControls: false, hasBorders: false,
        excludeFromExport: true, objectCaching: false
      });
      handle.isNodeHandle = true;
      handle.nodeTargetId = model.id;
      handle.nodeIndex = index;
      handle.on("moving", () => onMove(handle, false));
      handle.on("modified", () => onMove(handle, true));
      this.nodeHandles.push(handle);
      this.canvas.add(handle);
    });
    this.canvas.requestRenderAll();
    return this.nodeHandles;
  }

  async updateObject(model) {
    const previous = this.objectMap.get(model.id);
    const index = previous ? this.canvas.getObjects().indexOf(previous) : this.canvas.getObjects().length;
    if (previous) this.canvas.remove(previous);
    const next = await createFabricObject(model);
    this.objectMap.set(model.id, next);
    this.canvas.insertAt(Math.max(0, index), next);
    this.canvas.requestRenderAll();
    return next;
  }

  dispose() {
    this.canvas.dispose();
  }
}

export { cssColor };
