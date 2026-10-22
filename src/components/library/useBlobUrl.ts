import { useEffect, useState } from 'react';
import type { LibraryStore } from '../../lib/store/LibraryStore';

/** Object URLs are cached per image, so scrolling back doesn't re-read IndexedDB. */
const cache = new Map<string, Promise<string | undefined>>();

export function blobUrl(store: LibraryStore, id: string, which: 'full' | 'thumb') {
  const key = `${id}:${which}`;
  let hit = cache.get(key);
  if (!hit) {
    hit = store.getBlob(id, which).then((b) => (b ? URL.createObjectURL(b) : undefined));
    cache.set(key, hit);
  }
  return hit;
}

export function forgetBlobUrls(ids: string[]) {
  for (const id of ids) {
    for (const which of ['full', 'thumb'] as const) {
      const key = `${id}:${which}`;
      cache.get(key)?.then((u) => u && URL.revokeObjectURL(u));
      cache.delete(key);
    }
  }
}

/** Loads an image URL, optionally only once `enabled` (e.g. when scrolled into view). */
export function useBlobUrl(store: LibraryStore, id: string | undefined, which: 'full' | 'thumb', enabled = true) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!id || !enabled) return;
    let alive = true;
    blobUrl(store, id, which).then((u) => alive && setUrl(u));
    return () => {
      alive = false;
    };
  }, [store, id, which, enabled]);
  return url;
}
