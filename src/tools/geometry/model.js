export const PROJECT_SCHEMA_VERSION = 1;
export const WORLD_UNIT_PX = 32;
export const AUTOSAVE_DELAY_MS = 750;
export const HISTORY_LIMIT = 100;

/**
 * @typedef {Object} GeometryPoint
 * @property {number} x
 * @property {number} y
 */

/**
 * @typedef {Object} ObjectTransform
 * @property {number} x
 * @property {number} y
 * @property {number} scaleX
 * @property {number} scaleY
 * @property {number} rotation
 */

/**
 * @typedef {Object} ObjectStyle
 * @property {string} stroke
 * @property {string} fill
 * @property {number} strokeWidth
 * @property {"solid"|"dashed"} dash
 * @property {number} opacity
 * @property {boolean} arrowStart
 * @property {boolean} arrowEnd
 * @property {string} fontFamily
 * @property {number} fontSize
 * @property {string} fontWeight
 * @property {string} fontStyle
 * @property {"left"|"center"|"right"} textAlign
 */

/**
 * @typedef {Object} GeometryObjectV1
 * @property {string} id
 * @property {string} type
 * @property {string} name
 * @property {Record<string, *>} geometry
 * @property {ObjectTransform} transform
 * @property {ObjectStyle} style
 * @property {number} zIndex
 * @property {boolean} hidden
 * @property {boolean} locked
 * @property {string|null} groupId
 */

/**
 * @typedef {Object} GeometryGroupV1
 * @property {string} id
 * @property {string} name
 * @property {string[]} memberIds
 */

/**
 * @typedef {Object} GeometryRelationV1
 * @property {string} id
 * @property {"junction"|"binding"|"measurement"} kind
 * @property {string} sourceId
 * @property {string[]} targetIds
 * @property {Record<string, *>} data
 */

/**
 * 可移植的几何工程文件格式。Fabric 对象不进入此结构。
 * @typedef {Object} ProjectDocumentV1
 * @property {1} schemaVersion
 * @property {{title:string, createdAt:string, updatedAt:string}} meta
 * @property {{background:"white"|"dark"|"transparent", backgroundColor:string, grid:{mode:"line"|"dot"|"none", visible:boolean, axesVisible:boolean, snapEnabled:boolean, spacing:number, majorEvery:number}}} document
 * @property {{zoom:number, panX:number, panY:number}} viewport
 * @property {GeometryObjectV1[]} objects
 * @property {GeometryGroupV1[]} groups
 * @property {GeometryRelationV1[]} relations
 */

export const LINE_TYPES = new Set(["segment", "ray", "infiniteLine", "polyline", "bezier", "arc", "arrow"]);
export const CLOSED_SHAPE_TYPES = new Set(["circle", "ellipse", "rect", "triangle", "polygon", "regularPolygon", "sector"]);

export const DEFAULT_STYLE = Object.freeze({
  stroke: "#273052",
  fill: "transparent",
  strokeWidth: 2,
  dash: "solid",
  opacity: 1,
  arrowStart: false,
  arrowEnd: false,
  fontFamily: "ZCOOL XiaoWei",
  fontSize: 18,
  fontWeight: "normal",
  fontStyle: "normal",
  textAlign: "left"
});

const makeId = (prefix = "object") => {
  if (globalThis.crypto?.randomUUID) {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
};

export const deepClone = (value) => {
  if (globalThis.structuredClone) {
    return globalThis.structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value));
};

/** @returns {ProjectDocumentV1} */
export const createDefaultProject = () => ({
  schemaVersion: PROJECT_SCHEMA_VERSION,
  meta: {
    title: "未命名作图",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  document: {
    background: "white",
    backgroundColor: "#ffffff",
    grid: {
      mode: "line",
      visible: true,
      axesVisible: true,
      snapEnabled: true,
      spacing: 1,
      majorEvery: 5
    }
  },
  viewport: {
    zoom: 1,
    panX: 0,
    panY: 0
  },
  objects: [],
  groups: [],
  relations: []
});

export const createGeometryObject = (type, geometry = {}, options = {}) => ({
  id: options.id || makeId(type),
  type,
  name: options.name || type,
  geometry: deepClone(geometry),
  transform: {
    x: Number(options.transform?.x || 0),
    y: Number(options.transform?.y || 0),
    scaleX: Number(options.transform?.scaleX || 1),
    scaleY: Number(options.transform?.scaleY || 1),
    rotation: Number(options.transform?.rotation || 0)
  },
  style: {
    ...DEFAULT_STYLE,
    ...(options.style || {})
  },
  zIndex: Number.isFinite(options.zIndex) ? options.zIndex : 0,
  hidden: Boolean(options.hidden),
  locked: Boolean(options.locked),
  groupId: options.groupId || null
});

export const createGroup = (memberIds, name = "组合") => ({
  id: makeId("group"),
  name,
  memberIds: [...new Set(memberIds.filter(Boolean))]
});

export const createRelation = (kind, sourceId, targetIds, data = {}) => ({
  id: makeId("relation"),
  kind,
  sourceId,
  targetIds: [...new Set((targetIds || []).filter(Boolean))],
  data: deepClone(data)
});

export const touchProject = (project) => {
  project.meta.updatedAt = new Date().toISOString();
  return project;
};

export const normalizeZIndexes = (project) => {
  project.objects
    .sort((left, right) => Number(left.zIndex || 0) - Number(right.zIndex || 0))
    .forEach((object, index) => {
      object.zIndex = index;
    });
  return project;
};

export const getObjectById = (project, id) => project.objects.find((object) => object.id === id) || null;

export const getGroupMembers = (project, objectOrId) => {
  const object = typeof objectOrId === "string" ? getObjectById(project, objectOrId) : objectOrId;
  if (!object?.groupId) return object ? [object] : [];
  return project.objects.filter((candidate) => candidate.groupId === object.groupId);
};

export const removeObjects = (project, ids) => {
  const removeIds = new Set(ids);
  project.objects.forEach((object) => {
    if (removeIds.has(object.id) && object.groupId) {
      project.objects
        .filter((candidate) => candidate.groupId === object.groupId)
        .forEach((candidate) => removeIds.add(candidate.id));
    }
  });

  project.objects = project.objects.filter((object) => !removeIds.has(object.id));
  project.relations = project.relations.filter(
    (relation) => !removeIds.has(relation.sourceId) && !relation.targetIds.some((id) => removeIds.has(id))
  );
  project.groups = project.groups
    .map((group) => ({ ...group, memberIds: group.memberIds.filter((id) => !removeIds.has(id)) }))
    .filter((group) => group.memberIds.length > 1);
  normalizeZIndexes(project);
  return project;
};

const isPlainObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);

/** @param {*} input @returns {ProjectDocumentV1} */
export const validateProject = (input) => {
  if (!isPlainObject(input)) {
    throw new Error("工程文件不是有效的 JSON 对象。");
  }

  if (input.schemaVersion !== PROJECT_SCHEMA_VERSION) {
    throw new Error(`不支持的工程版本：${String(input.schemaVersion ?? "未知")}`);
  }

  if (!Array.isArray(input.objects) || !Array.isArray(input.groups) || !Array.isArray(input.relations)) {
    throw new Error("工程文件缺少 objects、groups 或 relations。");
  }

  const ids = new Set();
  for (const object of input.objects) {
    if (!isPlainObject(object) || typeof object.id !== "string" || typeof object.type !== "string") {
      throw new Error("工程文件包含无效对象。");
    }
    if (ids.has(object.id)) {
      throw new Error(`工程文件包含重复对象 ID：${object.id}`);
    }
    if (object.type === "image" && !/^data:image\/(?:png|jpeg|gif|webp);base64,/i.test(String(object.geometry?.src || ""))) {
      throw new Error(`图片对象必须包含 PNG、JPEG、GIF 或 WebP Data URL：${object.id}`);
    }
    ids.add(object.id);
  }

  const groupIds = new Set();
  for (const group of input.groups) {
    if (!isPlainObject(group) || typeof group.id !== "string" || !Array.isArray(group.memberIds)) {
      throw new Error("工程文件包含无效组合。");
    }
    if (groupIds.has(group.id)) throw new Error(`工程文件包含重复组合 ID：${group.id}`);
    if (group.memberIds.some((id) => !ids.has(id))) throw new Error(`组合引用了不存在的对象：${group.id}`);
    groupIds.add(group.id);
  }

  const relationIds = new Set();
  for (const relation of input.relations) {
    if (!isPlainObject(relation) || typeof relation.id !== "string" || typeof relation.sourceId !== "string" || !Array.isArray(relation.targetIds)) {
      throw new Error("工程文件包含无效关系。");
    }
    if (relationIds.has(relation.id)) throw new Error(`工程文件包含重复关系 ID：${relation.id}`);
    if (!ids.has(relation.sourceId) || relation.targetIds.some((id) => !ids.has(id))) {
      throw new Error(`关系引用了不存在的对象：${relation.id}`);
    }
    relationIds.add(relation.id);
  }

  const project = deepClone(input);
  project.document ||= createDefaultProject().document;
  project.document.grid = { ...createDefaultProject().document.grid, ...(project.document.grid || {}) };
  project.viewport = { ...createDefaultProject().viewport, ...(project.viewport || {}) };
  project.meta = { ...createDefaultProject().meta, ...(project.meta || {}) };
  project.objects = project.objects.map((object, index) => ({
    ...createGeometryObject(object.type, object.geometry, object),
    id: object.id,
    zIndex: Number.isFinite(object.zIndex) ? object.zIndex : index
  }));
  for (const object of project.objects) {
    if (![object.transform.x, object.transform.y, object.transform.scaleX, object.transform.scaleY, object.transform.rotation].every(Number.isFinite)) {
      throw new Error(`对象变换包含非有限数值：${object.id}`);
    }
    if (object.groupId && (!groupIds.has(object.groupId) || !project.groups.find((group) => group.id === object.groupId)?.memberIds.includes(object.id))) {
      throw new Error(`对象组合关系不一致：${object.id}`);
    }
  }
  normalizeZIndexes(project);
  return project;
};

/** @param {ProjectDocumentV1} project */
export const serializeProject = (project) => JSON.stringify(touchProject(deepClone(project)), null, 2);

/** @param {string} source @returns {ProjectDocumentV1} */
export const parseProject = (source) => {
  try {
    return validateProject(JSON.parse(String(source || "")));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error("工程文件 JSON 格式错误。");
    }
    throw error;
  }
};
