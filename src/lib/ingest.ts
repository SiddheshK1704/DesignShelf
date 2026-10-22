/**
 * The upload and tagging queue. Files are processed and saved first, so
 * nothing is lost if tagging fails. Tagging runs two at a time and backs off
 * when Gemini rate-limits.
 */
import { useSyncExternalStore } from 'react';
import { embed, embeddingText, GeminiError, tagImage, withBackoff } from './gemini';
import { ACCEPTED_TYPES, displayName, processImage, toAiImage } from './image';
import { findLens, getSettings } from './settings';
import type { LibraryStore } from './store/LibraryStore';
import { newId, type ImageRecord } from './types';

export interface IngestState {
  /** Items in the current batch (saving + tagging). */
  total: number;
  done: number;
  failed: number;
  phase: 'idle' | 'saving' | 'tagging';
  current?: string;
  /** Set while backing off after a rate limit. */
  waitingUntil?: number;
  /** Problems worth showing, newest last. */
  errors: { name: string; message: string }[];
  /** Set when the whole queue stopped, e.g. the key was rejected. */
  stopped?: string;
}

const IDLE: IngestState = { total: 0, done: 0, failed: 0, phase: 'idle', errors: [] };
let state: IngestState = IDLE;
const listeners = new Set<() => void>();

function set(patch: Partial<IngestState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export function useIngest(): IngestState {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => state,
  );
}

export function dismissIngest() {
  if (state.phase === 'idle') set({ ...IDLE });
}

const queue: { id: string; mode: 'tag' | 'embed' }[] = [];
let workers = 0;
const CONCURRENCY = 2;

function startBatch(extra: number) {
  if (state.phase === 'idle') set({ ...IDLE, total: extra, phase: 'saving' });
  else set({ total: state.total + extra });
}

function finishIfIdle() {
  if (workers === 0 && queue.length === 0 && state.phase !== 'idle') {
    set({ phase: 'idle', current: undefined, waitingUntil: undefined });
  }
}

/** Save files to the library, then queue them for tagging if there's a key. */
export async function addFiles(store: LibraryStore, files: File[], lensId: string): Promise<string[]> {
  const images = files.filter((f) => ACCEPTED_TYPES.includes(f.type) || /\.(jpe?g|png|webp|gif|avif)$/i.test(f.name));
  const skipped = files.filter((f) => !images.includes(f));
  if (!images.length && !skipped.length) return [];

  startBatch(images.length);
  if (skipped.length) {
    set({
      errors: [
        ...state.errors,
        ...skipped.map((f) => ({ name: f.name, message: 'Skipped: not an image Design Shelf can read (use JPEG, PNG, WebP, GIF or AVIF).' })),
      ],
    });
  }

  const hasKey = Boolean(getSettings().geminiKey);
  const ids: string[] = [];
  set({ phase: 'saving' });
  for (const file of images) {
    set({ current: file.name });
    try {
      const p = await processImage(file);
      const now = Date.now();
      const record: ImageRecord = {
        id: newId(),
        name: displayName(file.name),
        width: p.width,
        height: p.height,
        lensId,
        tags: {},
        customTags: [],
        swatches: p.swatches,
        status: hasKey ? 'pending' : 'untagged',
        createdAt: now,
        updatedAt: now,
      };
      await store.addImage(record, { full: p.full, thumb: p.thumb });
      ids.push(record.id);
      if (!hasKey) set({ done: state.done + 1 });
    } catch (err) {
      set({ failed: state.failed + 1, errors: [...state.errors, { name: file.name, message: (err as Error).message }] });
    }
  }
  // Ask the browser to keep this data even when space is low.
  navigator.storage?.persist?.().catch(() => undefined);

  if (hasKey && ids.length) enqueue(store, ids, 'tag');
  else finishIfIdle();
  if (!hasKey && ids.length) set({ phase: 'idle', current: undefined });
  return ids;
}

/** Queue existing images for tagging (or just embedding). */
export function enqueue(store: LibraryStore, ids: string[], mode: 'tag' | 'embed' = 'tag') {
  if (!ids.length) return;
  if (state.phase === 'idle') set({ ...IDLE, total: ids.length, phase: 'tagging' });
  else set({ phase: 'tagging' });
  if (state.stopped) set({ stopped: undefined });
  queue.push(...ids.map((id) => ({ id, mode })));
  while (workers < CONCURRENCY && queue.length) {
    workers++;
    void work(store).finally(() => {
      workers--;
      finishIfIdle();
    });
  }
}

function onWait(ms: number) {
  set({ waitingUntil: Date.now() + ms });
}

async function work(store: LibraryStore) {
  for (let job = queue.shift(); job; job = queue.shift()) {
    const img = await store.getImage(job.id);
    if (!img) continue;
    set({ current: img.name, waitingUntil: undefined });
    try {
      if (job.mode === 'tag') {
        await store.updateImage(img.id, { status: 'tagging', error: undefined });
        const blob = await store.getBlob(img.id, 'full');
        if (!blob) throw new Error('The image data is missing, so it cannot be tagged. Delete it and add it again.');
        const lens = findLens(img.lensId);
        const ai = await toAiImage(blob);
        const tagged = await withBackoff(() => tagImage(ai, lens), onWait);
        const merged = { ...img, ...tagged };
        const vec = await withBackoff(() => embed(embeddingText(merged), 'RETRIEVAL_DOCUMENT'), onWait);
        await store.updateImage(img.id, {
          ...tagged,
          embedding: vec.values,
          embeddingModel: vec.model,
          status: 'ready',
          error: undefined,
        });
      } else {
        const vec = await withBackoff(() => embed(embeddingText(img), 'RETRIEVAL_DOCUMENT'), onWait);
        await store.updateImage(img.id, { embedding: vec.values, embeddingModel: vec.model });
      }
      set({ done: state.done + 1, waitingUntil: undefined });
    } catch (err) {
      const message = (err as Error).message;
      const fatal = err instanceof GeminiError && (err.status === 401 || err.status === 403 || err.status === 0 || (err.status === 400 && /key/i.test(message)));
      if (job.mode === 'tag') await store.updateImage(img.id, { status: fatal ? 'untagged' : 'error', error: message }).catch(() => undefined);
      set({ failed: state.failed + 1, errors: [...state.errors, { name: img.name, message }] });
      if (fatal) {
        // Every remaining request would fail the same way; stop and keep them untagged.
        const rest = queue.splice(0);
        for (const r of rest) await store.updateImage(r.id, { status: 'untagged' }).catch(() => undefined);
        set({ stopped: message, failed: state.failed + rest.length });
        return;
      }
    }
  }
}

/** Re-tag with a (possibly different) lens. */
export async function retag(store: LibraryStore, id: string, lensId?: string) {
  if (lensId) await store.updateImage(id, { lensId });
  await store.updateImage(id, { status: 'pending', error: undefined });
  enqueue(store, [id], 'tag');
}
