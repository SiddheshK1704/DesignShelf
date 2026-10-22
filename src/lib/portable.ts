/**
 * Export and import the whole library as one JSON file, images included.
 */
import { blobToDataUrl, dataUrlToBlob } from './image';
import type { LibraryStore } from './store/LibraryStore';
import type { Board, BoardImage, ImageRecord } from './types';

interface ExportFile {
  app: 'designshelf';
  version: 1;
  exportedAt: string;
  images: (ImageRecord & { full: string; thumb: string })[];
  boards: Board[];
  boardImages: BoardImage[];
}

export async function exportLibrary(store: LibraryStore, onProgress?: (done: number, total: number) => void): Promise<Blob> {
  const images = await store.listImages();
  const out: ExportFile['images'] = [];
  for (const [i, img] of images.entries()) {
    const [full, thumb] = await Promise.all([store.getBlob(img.id, 'full'), store.getBlob(img.id, 'thumb')]);
    if (full && thumb) out.push({ ...img, full: await blobToDataUrl(full), thumb: await blobToDataUrl(thumb) });
    onProgress?.(i + 1, images.length);
  }
  const file: ExportFile = {
    app: 'designshelf',
    version: 1,
    exportedAt: new Date().toISOString(),
    images: out,
    boards: await store.listBoards(),
    boardImages: await store.listBoardImages(),
  };
  return new Blob([JSON.stringify(file)], { type: 'application/json' });
}

export interface ImportResult {
  added: number;
  skipped: number;
  boards: number;
}

export async function importLibrary(store: LibraryStore, file: File): Promise<ImportResult> {
  let data: ExportFile;
  try {
    data = JSON.parse(await file.text());
  } catch {
    throw new Error('This file isn’t valid JSON. Choose a file exported from Design Shelf.');
  }
  if (data?.app !== 'designshelf' || !Array.isArray(data.images)) {
    throw new Error('This file wasn’t exported from Design Shelf, so it can’t be imported.');
  }

  const existing = new Set((await store.listImages()).map((i) => i.id));
  let added = 0;
  let skipped = 0;
  for (const { full, thumb, ...record } of data.images) {
    if (existing.has(record.id)) {
      skipped++;
      continue;
    }
    await store.addImage(record, { full: await dataUrlToBlob(full), thumb: await dataUrlToBlob(thumb) });
    added++;
  }

  // Boards are matched by name so importing twice doesn't duplicate them.
  const boards = await store.listBoards();
  const idMap = new Map<string, string>();
  for (const b of data.boards ?? []) {
    const match = boards.find((x) => x.name === b.name) ?? (await store.createBoard(b.name));
    idMap.set(b.id, match.id);
  }
  for (const [oldId, newBoardId] of idMap) {
    const ids = (data.boardImages ?? []).filter((l) => l.boardId === oldId).map((l) => l.imageId);
    if (ids.length) await store.addToBoard(newBoardId, ids);
  }
  return { added, skipped, boards: idMap.size };
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
