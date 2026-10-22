/**
 * A small promise wrapper around IndexedDB for local mode.
 *
 * Stores:
 *   images       ImageRecord, keyed by id (metadata only, fast to list)
 *   blobs        { id, full, thumb } image data, read on demand
 *   boards       Board, keyed by id
 *   boardImages  { boardId, imageId }, keyed by [boardId, imageId]
 *   docs         saved design docs (used by the assistant)
 */

const DB_NAME = 'designshelf';
const DB_VERSION = 1;

export type StoreName = 'images' | 'blobs' | 'boards' | 'boardImages' | 'docs';

let dbPromise: Promise<IDBDatabase> | null = null;

export function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('This browser does not support IndexedDB, so the local library cannot be stored.'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('images')) {
        db.createObjectStore('images', { keyPath: 'id' }).createIndex('createdAt', 'createdAt');
      }
      if (!db.objectStoreNames.contains('blobs')) db.createObjectStore('blobs', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('boards')) db.createObjectStore('boards', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('boardImages')) {
        const s = db.createObjectStore('boardImages', { keyPath: ['boardId', 'imageId'] });
        s.createIndex('boardId', 'boardId');
        s.createIndex('imageId', 'imageId');
      }
      if (!db.objectStoreNames.contains('docs')) {
        db.createObjectStore('docs', { keyPath: 'id' }).createIndex('createdAt', 'createdAt');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Could not open the local library.'));
    req.onblocked = () => reject(new Error('The local library is open in another tab with an older version. Close other Design Shelf tabs and reload.'));
  });
  dbPromise.catch(() => (dbPromise = null));
  return dbPromise;
}

function wrap<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () =>
      reject(
        tx.error?.name === 'QuotaExceededError'
          ? new Error('Your browser is out of storage space for Design Shelf. Delete some images or export and clear the library.')
          : tx.error ?? new Error('The change was cancelled.'),
      );
  });
}

export async function getAll<T>(store: StoreName): Promise<T[]> {
  const db = await openDb();
  return wrap(db.transaction(store).objectStore(store).getAll()) as Promise<T[]>;
}

export async function get<T>(store: StoreName, key: IDBValidKey): Promise<T | undefined> {
  const db = await openDb();
  return wrap(db.transaction(store).objectStore(store).get(key)) as Promise<T | undefined>;
}

export async function getAllByIndex<T>(store: StoreName, index: string, key: IDBValidKey): Promise<T[]> {
  const db = await openDb();
  return wrap(db.transaction(store).objectStore(store).index(index).getAll(key)) as Promise<T[]>;
}

export async function put(store: StoreName, value: unknown): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(store, 'readwrite');
  tx.objectStore(store).put(value);
  return done(tx);
}

/** Run several writes across stores in one transaction. */
export async function write(stores: StoreName[], fn: (tx: IDBTransaction) => void): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(stores, 'readwrite');
  fn(tx);
  return done(tx);
}

export async function clearAll(): Promise<void> {
  const stores: StoreName[] = ['images', 'blobs', 'boards', 'boardImages', 'docs'];
  await write(stores, (tx) => stores.forEach((s) => tx.objectStore(s).clear()));
}
