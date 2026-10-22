import { useMemo, useState, type FormEvent } from 'react';
import { HERO_REFS } from '../../lib/heroRefs';
import { allPhotos } from '../../lib/referencePhotos';

const TRY = ['scooter', 'poster', 'stair', 'knob', 'leather'];

export function FindDemo() {
  const [draft, setDraft] = useState('scooter');
  const [query, setQuery] = useState('scooter');

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return allPhotos()
      .filter((p) => {
        const ref = HERO_REFS.find((r) => r.slug === p.slug)!;
        return [p.title, ref.subject, ...ref.tags, ...ref.queries].join(' ').toLowerCase().includes(q);
      })
      .slice(0, 6);
  }, [query]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setQuery(draft);
  }

  return (
    <div className="demo demo--find">
      <form className="demo__find-form" onSubmit={onSubmit} role="search">
        <label htmlFor="find-q" className="visually-hidden">
          Search open-licensed photos
        </label>
        <input
          id="find-q"
          type="search"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Search, or paste a page URL in the app"
          autoComplete="off"
        />
        <button type="submit" className="btn btn--primary">
          Search
        </button>
      </form>
      <div className="demo__chips" role="group" aria-label="Try a search">
        {TRY.map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={query === t}
            onClick={() => {
              setDraft(t);
              setQuery(t);
            }}
          >
            {t}
          </button>
        ))}
      </div>
      <p className="demo__status" aria-live="polite">
        {results.length
          ? `${results.length} open-licensed photos, each with its credit.`
          : `No saved photos match “${query}”. Try one of the suggestions.`}
      </p>
      <ul className="demo__finds">
        {results.map((p) => (
          <li key={p.id}>
            <a href={p.sourceUrl} target="_blank" rel="noopener noreferrer">
              <span className="demo__find-img">
                <img src={p.src} alt={p.title} loading="lazy" decoding="async" referrerPolicy="no-referrer" />
              </span>
              <span className="demo__find-licence mono">{p.licence}</span>
              <span className="demo__find-credit mono">{p.creator}</span>
              <span className="visually-hidden"> (opens source in a new tab)</span>
            </a>
          </li>
        ))}
      </ul>
      <p className="demo__fine">This demo searches a saved sample. The app searches Openverse and Wikimedia Commons live.</p>
    </div>
  );
}
