import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createLocalStore } from '../../lib/store/localStore';
import type { LibraryStore } from '../../lib/store/LibraryStore';
import type { Board, BoardImage, ImageRecord } from '../../lib/types';

interface LibraryContextValue {
  store: LibraryStore;
  images: ImageRecord[];
  boards: Board[];
  boardImages: BoardImage[];
  loading: boolean;
  error?: string;
  reload: () => void;
}

const LibraryContext = createContext<LibraryContextValue | null>(null);

// One store for the app. The Supabase store is swapped in here later.
const localStore = createLocalStore();

export function LibraryProvider({ children }: { children: ReactNode }) {
  const store = localStore;
  const [images, setImages] = useState<ImageRecord[]>([]);
  const [boards, setBoards] = useState<Board[]>([]);
  const [boardImages, setBoardImages] = useState<BoardImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  const reload = useCallback(() => {
    Promise.all([store.listImages(), store.listBoards(), store.listBoardImages()])
      .then(([i, b, bi]) => {
        setImages(i);
        setBoards(b);
        setBoardImages(bi);
        setError(undefined);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [store]);

  useEffect(() => {
    reload();
    // Coalesce bursts of changes (e.g. a batch upload) into one reload per frame.
    let frame = 0;
    const unsub = store.subscribe(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(reload);
    });
    return () => {
      unsub();
      cancelAnimationFrame(frame);
    };
  }, [store, reload]);

  const value = useMemo(
    () => ({ store, images, boards, boardImages, loading, error, reload }),
    [store, images, boards, boardImages, loading, error, reload],
  );
  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

export function useLibrary() {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error('useLibrary must be used inside LibraryProvider');
  return ctx;
}
