// حفظ تلقائي في IndexedDB — أفضل جهد، بلا اعتماديات.
const DB_NAME = "lumen";
const DB_VERSION = 1;
const STORE = "autosave";
const KEY = "current";

export interface AutosaveRecord {
  savedAt: number;
  json: string;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      dbPromise = null;
      reject(req.error ?? new Error("IndexedDB unavailable"));
    };
  });
  return dbPromise;
}

function request<T>(store: IDBObjectStore, op: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const req = op(store);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB request failed"));
  });
}

export async function saveAutosave(json: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE, "readwrite");
  await request(tx.objectStore(STORE), (s) => s.put({ savedAt: Date.now(), json }, KEY));
}

export async function loadAutosave(): Promise<AutosaveRecord | null> {
  const db = await openDb();
  const tx = db.transaction(STORE, "readonly");
  const rec = await request<AutosaveRecord | undefined>(tx.objectStore(STORE), (s) => s.get(KEY));
  return rec ?? null;
}

export async function clearAutosave(): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE, "readwrite");
  await request(tx.objectStore(STORE), (s) => s.delete(KEY));
}
