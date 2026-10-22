import { useEffect, useRef, useState } from 'react';
import { lookFurther } from '../../lib/lookFurther';
import { searchOpenImages, type OpenSearchResult } from '../../lib/sources';
import type { ImageRecord } from '../../lib/types';
import { useLibrary } from '../library/LibraryProvider';
import { useBlobUrl } from '../library/useBlobUrl';
import { Link } from 'react-router-dom';

/** Thumbnails from the designer's own library. */
export function ShelfMatches({ images, onOpen, libraryEmpty }: { images: ImageRecord[]; onOpen: (id: string, order: string[]) => void; libraryEmpty: boolean }) {
  if (libraryEmpty) {
    return (
      <p className="muted">
        Your shelf is empty, so there’s nothing to match yet. <Link to="/library">Add images to your library</Link> and they’ll show up here.
      </p>
    );
  }
  if (!images.length) return <p className="muted">Nothing on your shelf matches this yet.</p>;
  const order = images.map((i) => i.id);
  return (
    <ul className="as-shelf">
      {images.map((img) => (
        <li key={img.id}>
          <ShelfThumb image={img} onOpen={() => onOpen(img.id, order)} />
        </li>
      ))}
    </ul>
  );
}

function ShelfThumb({ image, onOpen }: { image: ImageRecord; onOpen: () => void }) {
  const { store } = useLibrary();
  const url = useBlobUrl(store, image.id, 'thumb');
  const label = image.subject || image.name;
  return (
    <button type="button" className="as-shelf__item" onClick={onOpen} title={label}>
      <span className="as-shelf__img">{url && <img src={url} alt="" />}</span>
      <span className="as-shelf__name">{label}</span>
      <span className="visually-hidden">Open {label}</span>
    </button>
  );
}

/** Live results from Openverse and Wikimedia Commons for one query. */
export function OpenImages({ label, query, limit = 4 }: { label: string; query: string; limit?: number }) {
  const [state, setState] = useState<{ status: 'loading' } | { status: 'done'; result: OpenSearchResult } | { status: 'error'; message: string }>({
    status: 'loading',
  });
  const [attempt, setAttempt] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  // Only search once the row is near the screen, so a long answer doesn't fire every search at once.
  useEffect(() => {
    const el = boxRef.current;
    if (!el || visible) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: '300px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    let alive = true;
    setState({ status: 'loading' });
    searchOpenImages(query, limit)
      .then((result) => alive && setState({ status: 'done', result }))
      .catch((err: Error) => alive && setState({ status: 'error', message: err.message }));
    return () => {
      alive = false;
    };
  }, [query, limit, attempt, visible]);

  return (
    <div className="as-open" ref={boxRef}>
      <p className="as-open__label">
        {label} <span className="muted mono">“{query}”</span>
      </p>
      {state.status === 'error' ? (
        <p className="notice notice--error">
          {state.message}
          <button type="button" className="linkbtn" onClick={() => setAttempt((a) => a + 1)}>
            Try again
          </button>
        </p>
      ) : (
        <>
          <ul className="as-open__grid" aria-busy={state.status === 'loading'}>
            {state.status === 'loading'
              ? Array.from({ length: limit }, (_, i) => <li key={i} className="as-open__skeleton" aria-hidden="true" />)
              : state.result.images.map((img) => (
                  <li key={img.id}>
                    <figure className="as-open__item">
                      <a href={img.sourceUrl} target="_blank" rel="noopener noreferrer" className="as-open__img">
                        <img src={img.thumb} alt={img.title} loading="lazy" decoding="async" referrerPolicy="no-referrer" />
                        <span className="visually-hidden"> (opens source in a new tab)</span>
                      </a>
                      <figcaption>
                        <span className="mono as-open__licence">
                          {img.licenceUrl ? (
                            <a href={img.licenceUrl} target="_blank" rel="noopener noreferrer">
                              {img.licence}
                            </a>
                          ) : (
                            img.licence
                          )}
                        </span>
                        <span className="as-open__credit">{img.creator}</span>
                        <a href={img.sourceUrl} target="_blank" rel="noopener noreferrer" className="as-open__src">
                          View source
                        </a>
                      </figcaption>
                    </figure>
                  </li>
                ))}
          </ul>
          {state.status === 'done' && state.result.usedQuery && (
            <p className="field__hint">Nothing matched the full phrase, so these are for “{state.result.usedQuery}”.</p>
          )}
          {state.status === 'done' && state.result.images.length === 0 && (
            <p className="muted">No open-licensed photos found for this one. Try the links below.</p>
          )}
          {state.status === 'done' && state.result.warnings.length > 0 && <p className="field__hint">{state.result.warnings.join(' ')}</p>}
        </>
      )}
    </div>
  );
}

/** Links that open real image results on other sites. */
export function LookFurther({ queries }: { queries: { label: string; query: string }[] }) {
  return (
    <ul className="as-further">
      {queries.map((q) => (
        <li key={q.query}>
          <span className="as-further__q">{q.label}</span>
          <span className="as-further__links">
            {lookFurther(q.query).map((l) => (
              <a key={l.site} href={l.href} target="_blank" rel="noopener noreferrer">
                {l.site}
                <span className="visually-hidden"> (opens in a new tab)</span>
              </a>
            ))}
          </span>
        </li>
      ))}
    </ul>
  );
}
