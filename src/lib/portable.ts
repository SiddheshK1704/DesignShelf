/**
 * Export and import the whole library as one JSON file, images included.
 */
import { blobToDataUrl, dataUrlToBlob } from './image';
import type { LibraryStore } from './store/LibraryStore';
import type { Board, BoardImage, ImageRecord, SavedDoc } from './types';

interface ExportFile {
  app: 'designshelf';
  version: 1;
  exportedAt: string;
  images: (ImageRecord & { full: string; thumb: string })[];
  boards: Board[];
  boardImages: BoardImage[];
  /** Saved design docs. Missing in files from older versions. */
  docs?: SavedDoc[];
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
    docs: await store.listDocs(),
  };
  return new Blob([JSON.stringify(file)], { type: 'application/json' });
}

export interface ImportResult {
  added: number;
  skipped: number;
  boards: number;
  docs: number;
}

export interface CopyResult {
  copied: number;
  skipped: number;
  failed: { name: string; message: string }[];
  boards: number;
  docs: number;
}

/**
 * Copy one library into another (used to move this browser's library into
 * an account). Images keep their ids, so running it twice doesn't
 * duplicate anything. The source is left untouched.
 */
export async function copyLibrary(from: LibraryStore, to: LibraryStore, onProgress?: (done: number, total: number) => void): Promise<CopyResult> {
  const images = await from.listImages();
  const existing = new Set((await to.listImages()).map((i) => i.id));
  const result: CopyResult = { copied: 0, skipped: 0, failed: [], boards: 0, docs: 0 };

  for (const [i, img] of images.entries()) {
    onProgress?.(i, images.length);
    if (existing.has(img.id)) {
      result.skipped++;
      continue;
    }
    try {
      const [full, thumb] = await Promise.all([from.getBlob(img.id, 'full'), from.getBlob(img.id, 'thumb')]);
      if (!full || !thumb) throw new Error('The image data is missing in this browser.');
      // Images mid-tagging are copied as waiting; they can be tagged again there.
      const status = img.status === 'tagging' || img.status === 'pending' ? 'untagged' : img.status;
      await to.addImage({ ...img, status }, { full, thumb });
      existing.add(img.id);
      result.copied++;
    } catch (err) {
      result.failed.push({ name: img.name, message: (err as Error).message });
    }
  }
  onProgress?.(images.length, images.length);

  // Boards are matched by name; links only for images that made it across.
  const targetBoards = await to.listBoards();
  const idMap = new Map<string, string>();
  for (const b of await from.listBoards()) {
    const match = targetBoards.find((x) => x.name === b.name) ?? (await to.createBoard(b.name));
    if (!targetBoards.includes(match)) result.boards++;
    idMap.set(b.id, match.id);
  }
  const links = await from.listBoardImages();
  for (const [oldId, newId] of idMap) {
    const ids = links.filter((l) => l.boardId === oldId && existing.has(l.imageId)).map((l) => l.imageId);
    if (ids.length) await to.addToBoard(newId, ids);
  }

  const haveDocs = new Set((await to.listDocs()).map((d) => d.id));
  for (const d of await from.listDocs()) {
    if (haveDocs.has(d.id)) continue;
    await to.saveDoc({ ...d, boardId: d.boardId ? idMap.get(d.boardId) : undefined, shelfIds: d.shelfIds.filter((id) => existing.has(id)) });
    result.docs++;
  }
  return result;
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

  const haveDocs = new Set((await store.listDocs()).map((d) => d.id));
  let docs = 0;
  for (const d of data.docs ?? []) {
    if (haveDocs.has(d.id)) continue;
    await store.saveDoc({ ...d, boardId: d.boardId ? idMap.get(d.boardId) : undefined });
    docs++;
  }
  return { added, skipped, boards: idMap.size, docs };
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
