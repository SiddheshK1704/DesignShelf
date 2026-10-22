import type { Board, BoardImage, ImageRecord } from '../types';

/**
 * Everything the UI needs from a library, whether it lives in this browser
 * (IndexedDB) or in a Supabase account. Screens only talk to this interface.
 */
export interface LibraryStore {
  readonly kind: 'local' | 'cloud';

  listImages(): Promise<ImageRecord[]>;
  getImage(id: string): Promise<ImageRecord | undefined>;
  addImage(record: ImageRecord, blobs: { full: Blob; thumb: Blob }): Promise<void>;
  updateImage(id: string, patch: Partial<ImageRecord>): Promise<ImageRecord>;
  deleteImages(ids: string[]): Promise<void>;
  getBlob(id: string, which: 'full' | 'thumb'): Promise<Blob | undefined>;

  listBoards(): Promise<Board[]>;
  createBoard(name: string): Promise<Board>;
  updateBoard(id: string, patch: Partial<Pick<Board, 'name' | 'description'>>): Promise<void>;
  deleteBoard(id: string): Promise<void>;
  listBoardImages(): Promise<BoardImage[]>;
  addToBoard(boardId: string, imageIds: string[]): Promise<void>;
  removeFromBoard(boardId: string, imageIds: string[]): Promise<void>;

  /** Remove every image, board and saved doc. */
  clear(): Promise<void>;

  /** Called after any change, so open screens can refresh. */
  subscribe(fn: () => void): () => void;
}
