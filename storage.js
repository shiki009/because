/**
 * Because — Storage layer
 * IndexedDB with localStorage fallback. Handles quota, private mode, migration.
 */

const DB_NAME = 'because_db';
const DB_VERSION = 1;
const STORE_NAME = 'items';
const LEGACY_KEY = 'because_items';

function openDB() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}

async function getFromIndexedDB() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function setToIndexedDB(items) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.clear();
    items.forEach((item) => store.put(item));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function getFromLocalStorage() {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setToLocalStorage(items) {
  try {
    localStorage.setItem(LEGACY_KEY, JSON.stringify(items));
    return true;
  } catch (e) {
    if (e.name === 'QuotaExceededError') {
      throw new Error('Storage full. Export your data to free space.');
    }
    throw e;
  }
}

let storageMode = null; // 'indexeddb' | 'localStorage'

export async function loadItems() {
  try {
    const items = await getFromIndexedDB();
    storageMode = 'indexeddb';
    if (items.length === 0) {
      const legacy = getFromLocalStorage();
      if (legacy.length > 0) {
        await setToIndexedDB(legacy);
        localStorage.removeItem(LEGACY_KEY);
        return legacy;
      }
    }
    return items;
  } catch {
    const items = getFromLocalStorage();
    storageMode = 'localStorage';
    return items;
  }
}

export async function saveItems(items) {
  try {
    if (storageMode === 'indexeddb' || storageMode === null) {
      await setToIndexedDB(items);
      storageMode = 'indexeddb';
      return;
    }
  } catch {
    storageMode = 'localStorage';
  }
  setToLocalStorage(items);
}
