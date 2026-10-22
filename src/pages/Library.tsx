import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FilterRail, matchesFilters } from '../components/library/FilterRail';
import { ImageDialog } from '../components/library/ImageDialog';
import { ImageGrid } from '../components/library/ImageGrid';
import { IngestBar } from '../components/library/IngestBar';
import { useLibrary } from '../components/library/LibraryProvider';
import { addFiles } from '../lib/ingest';
import { addSamples } from '../lib/samples';
import { search, type SearchResult } from '../lib/search';
import { allLenses, updateSettings, useSettings } from '../lib/settings';
import './app.css';

export function Library() {
  const { store, images, loading, error } = useLibrary();
  const settings = useSettings();
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const openId = params.get('image');
  const [draft, setDraft] = useState(q);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [filters, setFilters] = useState<Set<string>>(new Set());
  const [dragging, setDragging] = useState(false);
  const [railOpen, setRailOpen] = useState(false);
  const [sampleState, setSampleState] = useState<'idle' | 'adding' | string>('idle');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => setDraft(q), [q]);

  // Run the search whenever the query or the library changes.
  useEffect(() => {
    if (!q.trim()) {
      setResult(null);
      return;
    }
    let alive = true;
    setSearching(true);
    search(images, q, { useEmbeddings: Boolean(settings.geminiKey) })
      .then((r) => alive && setResult(r))
      .finally(() => alive && setSearching(false));
    return () => {
      alive = false;
    };
  }, [q, images, settings.geminiKey]);

  const shown = useMemo(() => {
    const base = result ? result.hits.map((h) => h.image) : images;
    return filters.size ? base.filter((i) => matchesFilters(i, filters)) : base;
  }, [result, images, filters]);

  const setParam = useCallback(
    (key: string, value: string | null) => {
      setParams(
        (p) => {
          const n = new URLSearchParams(p);
          if (value) n.set(key, value);
          else n.delete(key);
          return n;
        },
        { replace: key === 'image' ? false : true },
      );
    },
    [setParams],
  );

  function onSearch(e: FormEvent) {
    e.preventDefault();
    setParam('q', draft.trim() || null);
  }

  const upload = useCallback(
    (files: File[]) => {
      if (files.length) void addFiles(store, files, settings.defaultLensId);
    },
    [store, settings.defaultLensId],
  );

  // Paste images from the clipboard anywhere on the page (not into fields).
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, [contenteditable]')) return;
      const files = [...(e.clipboardData?.files ?? [])].filter((f) => f.type.startsWith('image/'));
      if (files.length) {
        e.preventDefault();
        upload(files);
      }
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [upload]);

  async function onSamples() {
    setSampleState('adding');
    try {
      const n = await addSamples(store);
      setSampleState(n ? 'idle' : 'The sample references are already on your shelf.');
    } catch (err) {
      setSampleState(`Could not add the samples: ${(err as Error).message}`);
    }
  }

  const empty = !loading && images.length === 0;

  return (
    <div
      className="page library"
      onDragEnter={(e) => {
        if (e.dataTransfer.types.includes('Files')) setDragging(true);
      }}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('Files')) e.preventDefault();
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target || !e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        upload([...e.dataTransfer.files]);
      }}
    >
      <header className="page__head">
        <div>
          <h1 className="page__title">Library</h1>
          <p className="muted">
            {images.length} {images.length === 1 ? 'reference' : 'references'}
            {!settings.geminiKey && images.length > 0 && (
              <>
                {' '}
                · <Link to="/settings">Add a Gemini key</Link> for AI tags and search by meaning
              </>
            )}
          </p>
        </div>
        <div className="page__actions">
          <label className="lens-pick">
            <span className="muted">Tag with</span>
            <select
              className="input input--sm"
              value={settings.defaultLensId}
              onChange={(e) => updateSettings({ defaultLensId: e.target.value })}
              aria-label="Lens for new images"
            >
              {allLenses(settings).map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} lens
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="btn btn--primary" onClick={() => fileRef.current?.click()}>
            Add images
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              upload([...(e.target.files ?? [])]);
              e.target.value = '';
            }}
          />
        </div>
      </header>

      <form className="searchbar" onSubmit={onSearch} role="search">
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="7" cy="7" r="4.5" />
          <path d="M10.5 10.5 14 14" />
        </svg>
        <label htmlFor="lib-q" className="visually-hidden">
          Search your library
        </label>
        <input
          id="lib-q"
          type="search"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            if (!e.target.value) setParam('q', null);
          }}
          placeholder="Describe it: calm, soft, premium"
          autoComplete="off"
        />
        <button type="submit" className="btn btn--primary">
          Search
        </button>
      </form>

      <IngestBar />

      {error && (
        <p className="notice notice--error" role="alert">
          The library could not be loaded: {error}
        </p>
      )}

      {empty ? (
        <EmptyLibrary
          hasKey={Boolean(settings.geminiKey)}
          onAdd={() => fileRef.current?.click()}
          onSamples={onSamples}
          sampleState={sampleState}
        />
      ) : (
        <div className="library__body" data-rail={railOpen}>
          <button type="button" className="btn btn--quiet library__rail-toggle" aria-expanded={railOpen} onClick={() => setRailOpen((o) => !o)}>
            Filters{filters.size ? ` (${filters.size})` : ''}
          </button>
          <aside className="library__rail" aria-label="Filters">
            <FilterRail
              images={result ? result.hits.map((h) => h.image) : images}
              selected={filters}
              onToggle={(key) =>
                setFilters((s) => {
                  const n = new Set(s);
                  if (n.has(key)) n.delete(key);
                  else n.add(key);
                  return n;
                })
              }
              onClear={() => setFilters(new Set())}
            />
          </aside>

          <section className="library__results" aria-label="Results" aria-busy={searching}>
            {(q || filters.size > 0) && (
              <p className="library__summary" aria-live="polite">
                {searching
                  ? 'Searching…'
                  : `${shown.length} ${shown.length === 1 ? 'match' : 'matches'}${q ? ` for “${q}”` : ''}${
                      result?.mode === 'keyword' && settings.geminiKey ? ' (keyword search)' : ''
                    }`}
                {q && (
                  <button type="button" className="linkbtn" onClick={() => setParam('q', null)}>
                    Clear search
                  </button>
                )}
              </p>
            )}
            {result?.note && <p className="notice">{result.note}</p>}

            {shown.length === 0 && !searching ? (
              <div className="empty empty--small">
                <h2>Nothing matches{q ? ` “${q}”` : ' these filters'}.</h2>
                <p className="muted">
                  {filters.size ? 'Remove a filter or two. ' : ''}
                  {settings.geminiKey
                    ? 'Try broader words, like a mood or a material.'
                    : 'Without a Gemini key, search only matches exact words in names and tags. Add a key in Settings to search by meaning.'}
                </p>
              </div>
            ) : (
              <ImageGrid images={shown} store={store} onOpen={(id) => setParam('image', id)} />
            )}
          </section>
        </div>
      )}

      {dragging && (
        <div className="dropzone" aria-hidden="true">
          <p>Drop images to add them to your shelf</p>
        </div>
      )}

      <ImageDialog
        imageId={openId}
        order={shown.map((i) => i.id)}
        onNavigate={(id) => setParams((p) => { const n = new URLSearchParams(p); n.set('image', id); return n; }, { replace: true })}
        onClose={() => setParam('image', null)}
      />
    </div>
  );
}

function EmptyLibrary({
  hasKey,
  onAdd,
  onSamples,
  sampleState,
}: {
  hasKey: boolean;
  onAdd: () => void;
  onSamples: () => void;
  sampleState: string;
}) {
  return (
    <div className="empty reg-frame">
      <h2>Your shelf is empty.</h2>
      <p>Add images by dropping them on this page, choosing files, or pasting from the clipboard. They’re stored in this browser.</p>
      <p className="muted">
        {hasKey
          ? 'Each image is tagged for form, material, colour and mood, so you can search by feel straight away.'
          : 'Add a Gemini key in Settings to tag images with AI and search by meaning. Without one, images are still saved and you can tag them yourself.'}
      </p>
      <div className="empty__actions">
        <button type="button" className="btn btn--primary" onClick={onAdd}>
          Add images
        </button>
        <button type="button" className="btn" onClick={onSamples} disabled={sampleState === 'adding'}>
          {sampleState === 'adding' ? 'Adding samples…' : 'Try with sample references'}
        </button>
        {!hasKey && (
          <Link to="/settings" className="btn btn--quiet">
            Add a Gemini key
          </Link>
        )}
      </div>
      {sampleState !== 'idle' && sampleState !== 'adding' && <p className="notice">{sampleState}</p>}
    </div>
  );
}
