import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createCloudStore } from '../../lib/store/cloudStore';
import { createLocalStore } from '../../lib/store/localStore';
import type { LibraryStore } from '../../lib/store/LibraryStore';
import { supabase } from '../../lib/supabase';
import type { Board, BoardImage, ImageRecord } from '../../lib/types';
import { useAuth } from '../AuthProvider';
import { forgetAllBlobUrls } from './useBlobUrl';

interface LibraryContextValue {
  store: LibraryStore;
  /** The browser's own library, even when signed in (for copying it to the account). */
  localStore: LibraryStore;
  images: ImageRecord[];
  boards: Board[];
  boardImages: BoardImage[];
  loading: boolean;
  error?: string;
  reload: () => void;
}

const LibraryContext = createContext<LibraryContextValue | null>(null);

const localStore = createLocalStore();

export function LibraryProvider({ children }: { children: ReactNode }) {
  const { mode, userId, ready } = useAuth();
  // Signed in: the account's library. Otherwise: this browser's.
  const store = useMemo(
    () => (mode === 'signed-in' && userId && supabase ? createCloudStore(supabase, userId) : localStore),
    [mode, userId],
  );
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
    if (!ready) return;
    // A different library: drop what was shown and any cached image URLs.
    setLoading(true);
    setImages([]);
    setBoards([]);
    setBoardImages([]);
    forgetAllBlobUrls();
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
  }, [store, reload, ready]);

  const value = useMemo(
    () => ({ store, localStore, images, boards, boardImages, loading: loading || !ready, error, reload }),
    [store, images, boards, boardImages, loading, ready, error, reload],
  );
  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

export function useLibrary() {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error('useLibrary must be used inside LibraryProvider');
  return ctx;
}
