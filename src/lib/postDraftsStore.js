const DB_NAME = "qihai-blog";
const DB_VERSION = 1;
const STORE_NAME = "drafts";
const FALLBACK_KEY = "qihai_blog_drafts_fallback_v1";

const toJson = (value) => JSON.parse(JSON.stringify(value));

const withFallback = async (action, fallbackAction) => {
  try {
    return await action();
  } catch {
    return fallbackAction();
  }
};

const openDatabase = () =>
  new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("INDEXED_DB_UNAVAILABLE"));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error || new Error("DB_OPEN_FAILED"));
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
  });

const runTransaction = async (mode, work) => {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => {
      db.close();
      reject(transaction.error || new Error("DB_TX_FAILED"));
    };
    Promise.resolve(work(store, resolve, reject)).catch(reject);
  });
};

const readFallback = () => {
  try {
    const value = JSON.parse(localStorage.getItem(FALLBACK_KEY) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
};

const writeFallback = (drafts) => {
  localStorage.setItem(FALLBACK_KEY, JSON.stringify(drafts));
};

const sortDrafts = (drafts) =>
  drafts
    .filter((draft) => draft && typeof draft === "object" && draft.id)
    .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));

export const listPostDrafts = async () =>
  withFallback(
    () =>
      runTransaction("readonly", (store, resolve, reject) => {
        const request = store.getAll();
        request.onerror = () => reject(request.error || new Error("DB_READ_FAILED"));
        request.onsuccess = () => resolve(sortDrafts(request.result || []));
      }),
    () => Promise.resolve(sortDrafts(readFallback()))
  );

export const savePostDraft = async (draft) => {
  const value = toJson(draft);
  if (!value?.id) {
    throw new Error("DRAFT_ID_REQUIRED");
  }

  return withFallback(
    () =>
      runTransaction("readwrite", (store, resolve, reject) => {
        const request = store.put(value);
        request.onerror = () => reject(request.error || new Error("DB_WRITE_FAILED"));
        request.onsuccess = () => resolve(value);
      }),
    () => {
      const drafts = readFallback().filter((item) => item?.id !== value.id);
      drafts.push(value);
      writeFallback(drafts);
      return Promise.resolve(value);
    }
  );
};

export const deletePostDraft = async (id) => {
  const key = String(id || "");
  if (!key) return;

  return withFallback(
    () =>
      runTransaction("readwrite", (store, resolve, reject) => {
        const request = store.delete(key);
        request.onerror = () => reject(request.error || new Error("DB_DELETE_FAILED"));
        request.onsuccess = () => resolve();
      }),
    () => {
      writeFallback(readFallback().filter((draft) => draft?.id !== key));
      return Promise.resolve();
    }
  );
};
