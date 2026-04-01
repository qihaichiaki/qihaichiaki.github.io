const DB_NAME = "qihai-task-board";
const DB_VERSION = 1;
const STORE_NAME = "state";
const BOARD_KEY = "board";
const META_KEY = "meta";
const FALLBACK_BOARD_KEY = "qihai_task_board_fallback";
const FALLBACK_META_KEY = "qihai_task_meta_fallback";

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
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
  });

const runTransaction = async (mode, work) => {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);

    transaction.oncomplete = () => {
      db.close();
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error || new Error("DB_TX_FAILED"));
    };

    Promise.resolve(work(store, resolve, reject)).catch(reject);
  });
};

export const loadTaskState = async () =>
  withFallback(
    async () => {
      const board = await runTransaction("readonly", (store, resolve, reject) => {
        const request = store.get(BOARD_KEY);
        request.onerror = () => reject(request.error || new Error("DB_READ_FAILED"));
        request.onsuccess = () => resolve(request.result || null);
      });
      const meta = await runTransaction("readonly", (store, resolve, reject) => {
        const request = store.get(META_KEY);
        request.onerror = () => reject(request.error || new Error("DB_READ_FAILED"));
        request.onsuccess = () => resolve(request.result || null);
      });

      return {
        board,
        meta
      };
    },
    () => {
      try {
        return Promise.resolve({
          board: JSON.parse(localStorage.getItem(FALLBACK_BOARD_KEY) || "null"),
          meta: JSON.parse(localStorage.getItem(FALLBACK_META_KEY) || "null")
        });
      } catch {
        return Promise.resolve({ board: null, meta: null });
      }
    }
  );

export const saveTaskState = async ({ board, meta }) =>
  withFallback(
    async () => {
      await runTransaction("readwrite", (store, resolve, reject) => {
        const putBoard = store.put(toJson(board), BOARD_KEY);
        const putMeta = store.put(toJson(meta), META_KEY);

        putBoard.onerror = () => reject(putBoard.error || new Error("DB_WRITE_FAILED"));
        putMeta.onerror = () => reject(putMeta.error || new Error("DB_WRITE_FAILED"));
        putMeta.onsuccess = () => resolve(true);
      });
    },
    () => {
      localStorage.setItem(FALLBACK_BOARD_KEY, JSON.stringify(board));
      localStorage.setItem(FALLBACK_META_KEY, JSON.stringify(meta));
      return Promise.resolve();
    }
  );
