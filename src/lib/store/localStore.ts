import * as db from '../db';
import { newId, type Board, type BoardImage, type ImageRecord } from '../types';
import type { LibraryStore } from './LibraryStore';

interface BlobRow {
  id: string;
  full: Blob;
  thumb: Blob;
}

/** Local mode: everything in this browser's IndexedDB. */
export function createLocalStore(): LibraryStore {
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((l) => l());

  return {
    kind: 'local',

    async listImages() {
      const all = await db.getAll<ImageRecord>('images');
      return all.sort((a, b) => b.createdAt - a.createdAt);
    },

    getImage: (id) => db.get<ImageRecord>('images', id),

    async addImage(record, blobs) {
      await db.write(['images', 'blobs'], (tx) => {
        tx.objectStore('images').put(record);
        tx.objectStore('blobs').put({ id: record.id, ...blobs } satisfies BlobRow);
      });
      emit();
    },

    async updateImage(id, patch) {
      const cur = await db.get<ImageRecord>('images', id);
      if (!cur) throw new Error('That image no longer exists. It may have been deleted in another tab.');
      const next = { ...cur, ...patch, id, updatedAt: Date.now() };
      await db.put('images', next);
      emit();
      return next;
    },

    async deleteImages(ids) {
      const links = (await db.getAll<BoardImage>('boardImages')).filter((l) => ids.includes(l.imageId));
      await db.write(['images', 'blobs', 'boardImages'], (tx) => {
        for (const id of ids) {
          tx.objectStore('images').delete(id);
          tx.objectStore('blobs').delete(id);
        }
        for (const l of links) tx.objectStore('boardImages').delete([l.boardId, l.imageId]);
      });
      emit();
    },

    async getBlob(id, which) {
      return (await db.get<BlobRow>('blobs', id))?.[which];
    },

    async listBoards() {
      return (await db.getAll<Board>('boards')).sort((a, b) => b.updatedAt - a.updatedAt);
    },

    async createBoard(name) {
      const now = Date.now();
      const board: Board = { id: newId(), name: name.trim() || 'Untitled board', createdAt: now, updatedAt: now };
      await db.put('boards', board);
      emit();
      return board;
    },

    async updateBoard(id, patch) {
      const cur = await db.get<Board>('boards', id);
      if (!cur) throw new Error('That board no longer exists.');
      await db.put('boards', { ...cur, ...patch, updatedAt: Date.now() });
      emit();
    },

    async deleteBoard(id) {
      const links = await db.getAllByIndex<BoardImage>('boardImages', 'boardId', id);
      await db.write(['boards', 'boardImages'], (tx) => {
        tx.objectStore('boards').delete(id);
        for (const l of links) tx.objectStore('boardImages').delete([l.boardId, l.imageId]);
      });
      emit();
    },

    listBoardImages: () => db.getAll<BoardImage>('boardImages'),

    async addToBoard(boardId, imageIds) {
      const now = Date.now();
      const board = await db.get<Board>('boards', boardId);
      await db.write(['boardImages', 'boards'], (tx) => {
        for (const imageId of imageIds) tx.objectStore('boardImages').put({ boardId, imageId, addedAt: now });
        if (board) tx.objectStore('boards').put({ ...board, updatedAt: now });
      });
      emit();
    },

    async removeFromBoard(boardId, imageIds) {
      await db.write(['boardImages'], (tx) => {
        for (const imageId of imageIds) tx.objectStore('boardImages').delete([boardId, imageId]);
      });
      emit();
    },

    async clear() {
      await db.clearAll();
      emit();
    },

    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
