/**
 * 可插拔工具定义。自定义工具可提供 pointer hook，工作区事件循环无需再增加分支。
 * @typedef {Object} ToolDefinition
 * @property {string} id
 * @property {string} label
 * @property {"selection"|"pan"|"instant"|"drag"|"multi"|"triple"|"freehand"|"crop"} kind
 * @property {string} [shortcut]
 * @property {string} [hint]
 * @property {boolean} [selects]
 * @property {string} [cursor]
 * @property {(context:*, event:PointerEvent, target:*) => (boolean|Promise<boolean>)} [onPointerDown]
 * @property {(context:*, event:PointerEvent) => (boolean|Promise<boolean>)} [onPointerMove]
 * @property {(context:*, event:PointerEvent) => (boolean|Promise<boolean>)} [onPointerUp]
 */

const definitions = new Map();

/** @param {ToolDefinition} definition @returns {ToolDefinition} */
export const registerToolDefinition = (definition) => {
  if (!definition?.id || !definition?.label || !definition?.kind) {
    throw new TypeError("ToolDefinition 必须包含 id、label 和 kind。");
  }
  if (definitions.has(definition.id)) {
    throw new Error(`工具已注册：${definition.id}`);
  }
  const value = Object.freeze({ selects: false, cursor: "crosshair", ...definition });
  definitions.set(value.id, value);
  return value;
};

/** @param {string} id @returns {ToolDefinition|null} */
export const getToolDefinition = (id) => definitions.get(id) || null;

/** @returns {ToolDefinition[]} */
export const listToolDefinitions = () => [...definitions.values()];

/** @param {string} key @returns {ToolDefinition|null} */
export const findToolByShortcut = (key) => {
  const normalized = String(key || "").toLowerCase();
  return listToolDefinitions().find((definition) => definition.shortcut?.toLowerCase() === normalized) || null;
};

[
  { id: "select", label: "选择", kind: "selection", shortcut: "v", selects: true, cursor: "default" },
  { id: "pan", label: "平移", kind: "pan", shortcut: "h", cursor: "grab" },
  { id: "point", label: "点", kind: "instant", shortcut: "p", hint: "点击放置点；在线条边界出现“分割”提示时点击可分割。" },
  { id: "segment", label: "线段", kind: "drag", shortcut: "l" },
  { id: "ray", label: "射线", kind: "drag" },
  { id: "infiniteLine", label: "直线", kind: "drag" },
  { id: "polyline", label: "折线", kind: "multi", hint: "连续点击放置折线顶点，双击或按 Enter 完成。" },
  { id: "bezier", label: "Bézier 曲线", kind: "drag", shortcut: "b", hint: "拖动确定端点，完成后可用节点编辑调整控制柄。" },
  { id: "arrow", label: "箭头", kind: "drag" },
  { id: "circle", label: "圆", kind: "drag" },
  { id: "ellipse", label: "椭圆", kind: "drag" },
  { id: "arc", label: "圆弧", kind: "triple", hint: "依次点击圆心、起点和终点。" },
  { id: "sector", label: "扇形", kind: "triple", hint: "依次点击圆心、起点和终点。" },
  { id: "rect", label: "矩形", kind: "drag" },
  { id: "triangle", label: "三角形", kind: "multi", hint: "依次点击三个顶点。" },
  { id: "polygon", label: "多边形", kind: "multi", hint: "连续点击放置顶点，双击或按 Enter 闭合。" },
  { id: "regularPolygon", label: "正多边形", kind: "drag" },
  { id: "freehand", label: "自由笔迹", kind: "freehand", shortcut: "f" },
  { id: "text", label: "文字", kind: "instant", shortcut: "t" },
  { id: "measure", label: "测量", kind: "selection", shortcut: "m", selects: true, cursor: "default", hint: "先用选择工具选中点、线、圆弧，或两条线，再点击测量。" },
  { id: "eraser", label: "对象擦除", kind: "instant", shortcut: "e", cursor: "cell" },
  { id: "exportCrop", label: "框选导出", kind: "crop", hint: "在画布中拖出要导出的区域。" }
].forEach(registerToolDefinition);
