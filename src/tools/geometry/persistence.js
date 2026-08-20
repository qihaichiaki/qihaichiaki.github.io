import { AUTOSAVE_DELAY_MS, validateProject } from "./model.js";

const DB_NAME = "qihai_geometry";
const DB_VERSION = 1;
const STORE_NAME = "projects";
const CURRENT_KEY = "current-project";

const openDatabase = () =>
  new Promise((resolve, reject) => {
    if (!("indexedDB" in globalThis)) {
      reject(new Error("当前浏览器不支持 IndexedDB。"));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("无法打开本地工程数据库。"));
  });

export const saveCurrentProject = async (project) => {
  const database = await openDatabase();
  try {
    await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put(project, CURRENT_KEY);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error("本地工程保存失败。"));
    });
  } finally {
    database.close();
  }
};

export const loadCurrentProject = async () => {
  const database = await openDatabase();
  try {
    const value = await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readonly");
      const request = transaction.objectStore(STORE_NAME).get(CURRENT_KEY);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error || new Error("本地工程读取失败。"));
    });
    return value ? validateProject(value) : null;
  } finally {
    database.close();
  }
};

export const createAutosaver = ({ getProject, onStatus = () => {} }) => {
  let timer = 0;
  let queued = false;

  const flush = async () => {
    clearTimeout(timer);
    timer = 0;
    if (!queued) return;
    queued = false;
    onStatus("saving");
    try {
      await saveCurrentProject(getProject());
      onStatus("saved");
    } catch (error) {
      onStatus("error", error);
    }
  };

  return {
    schedule() {
      queued = true;
      clearTimeout(timer);
      timer = setTimeout(flush, AUTOSAVE_DELAY_MS);
    },
    flush
  };
};
