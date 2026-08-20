import { WORLD_UNIT_PX } from "./model.js";
import { cssColor } from "./renderer.js";

/**
 * @typedef {Object} ExportOptions
 * @property {"viewport"|"crop"} scope
 * @property {"current"|"white"|"dark"|"transparent"} background
 * @property {boolean} includeGrid
 * @property {boolean} includeAxes
 */

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const safeFilename = (title, extension) => {
  const base = String(title || "geometry")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .slice(0, 80) || "geometry";
  return `${base}.${extension}`;
};

const canvasToBlob = (canvas) =>
  new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("PNG 编码失败。"))), "image/png");
  });

const resolveRegion = (scene, scope, crop) => {
  if (scope === "crop") {
    if (!crop || crop.width < 2 || crop.height < 2) throw new Error("请先框选有效的导出区域。");
    return crop;
  }
  return { left: 0, top: 0, width: scene.canvas.width, height: scene.canvas.height };
};

/** @param {*} scene @param {import("./model.js").ProjectDocumentV1} project @param {ExportOptions} options */
export const renderPngBlob = async (scene, project, options, crop) => {
  const region = resolveRegion(scene, options.scope, crop);
  scene.gridOverrides = {
    background: options.background === "current" ? project.document.background : options.background,
    includeGrid: options.includeGrid,
    includeAxes: options.includeAxes
  };
  try {
    const exported = scene.canvas.toCanvasElement(2, {
      left: region.left,
      top: region.top,
      width: region.width,
      height: region.height,
      filter: (object) => !object.excludeFromExport && !object.isNodeHandle
    });
    return await canvasToBlob(exported);
  } finally {
    scene.gridOverrides = null;
    scene.canvas.requestRenderAll();
  }
};

const svgGridMarkup = (project, options, region, viewport) => {
  const background = options.background === "current" ? project.document.background : options.background;
  const backgroundColor = cssColor(background);
  const zoom = viewport.zoom;
  const spacing = WORLD_UNIT_PX * Number(project.document.grid.spacing || 1) * zoom;
  let visualFactor = 1;
  while (spacing * visualFactor < 12) visualFactor *= 2;
  const step = spacing * visualFactor;
  const dark = background === "dark";
  const minor = dark ? "rgba(190,205,255,0.14)" : "rgba(57,72,112,0.12)";
  const originX = viewport.panX;
  const originY = viewport.panY;
  const offsetX = ((originX % step) + step) % step;
  const offsetY = ((originY % step) + step) % step;
  const values = [];

  if (backgroundColor !== "transparent") {
    values.push(`<rect x="${region.left}" y="${region.top}" width="${region.width}" height="${region.height}" fill="${backgroundColor}"/>`);
  }
  if (options.includeGrid && project.document.grid.mode !== "none") {
    if (project.document.grid.mode === "dot") {
      values.push(`<defs><pattern id="qihai-grid" x="${offsetX}" y="${offsetY}" width="${step}" height="${step}" patternUnits="userSpaceOnUse"><circle cx="0" cy="0" r="1.15" fill="${minor}"/></pattern></defs><rect x="${region.left}" y="${region.top}" width="${region.width}" height="${region.height}" fill="url(#qihai-grid)"/>`);
    } else {
      values.push(`<defs><pattern id="qihai-grid" x="${offsetX}" y="${offsetY}" width="${step}" height="${step}" patternUnits="userSpaceOnUse"><path d="M ${step} 0 L 0 0 0 ${step}" fill="none" stroke="${minor}" stroke-width="1"/></pattern></defs><rect x="${region.left}" y="${region.top}" width="${region.width}" height="${region.height}" fill="url(#qihai-grid)"/>`);
    }
  }
  if (options.includeAxes) {
    const axis = dark ? "rgba(162,182,255,0.66)" : "rgba(39,48,82,0.58)";
    values.push(`<path d="M ${originX} ${region.top} V ${region.top + region.height} M ${region.left} ${originY} H ${region.left + region.width}" fill="none" stroke="${axis}" stroke-width="1.35"/>`);
  }
  return values.join("");
};

/** @param {*} scene @param {import("./model.js").ProjectDocumentV1} project @param {ExportOptions} options */
export const createSvgBlob = (scene, project, options, crop) => {
  const region = resolveRegion(scene, options.scope, crop);
  const viewport = scene.getViewport();
  let svg = scene.canvas.toSVG({
    suppressPreamble: true,
    width: region.width,
    height: region.height,
    viewBox: { x: region.left, y: region.top, width: region.width, height: region.height }
  });
  const background = svgGridMarkup(project, options, region, viewport);
  svg = svg.replace(/(<desc>.*?<\/desc>)/s, `$1${background}`);
  return new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
};

export const downloadPng = async (scene, project, options, crop) => {
  const blob = await renderPngBlob(scene, project, options, crop);
  downloadBlob(blob, safeFilename(project.meta.title, "png"));
};

export const downloadSvg = (scene, project, options, crop) => {
  const blob = createSvgBlob(scene, project, options, crop);
  downloadBlob(blob, safeFilename(project.meta.title, "svg"));
};

export const copyPng = async (scene, project, options, crop) => {
  const blob = await renderPngBlob(scene, project, options, crop);
  if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
    downloadBlob(blob, safeFilename(project.meta.title, "png"));
    return { fallback: true };
  }
  try {
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    return { fallback: false };
  } catch {
    downloadBlob(blob, safeFilename(project.meta.title, "png"));
    return { fallback: true };
  }
};

export const downloadProject = (project, serialized) => {
  downloadBlob(new Blob([serialized], { type: "application/json;charset=utf-8" }), safeFilename(project.meta.title, "qihai-geometry.json"));
};
