import { useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { HERO_REFS, type HeroRef } from '../../lib/heroRefs';
import { prefersReducedMotion } from '../../lib/theme';
import { DuotoneArt } from '../hero/DuotoneArt';

const SUGGESTIONS = ['calm, soft, premium', 'technical, precise', 'warm, crafted', 'bold, graphic', 'raw, heavy'];

function words(q: string) {
  return q
    .toLowerCase()
    .split(/[^a-z-]+/)
    .filter((w) => w.length > 1);
}

/** Feel words count double; tag and subject matches add a small boost. */
function score(ref: HeroRef, terms: string[]) {
  let s = 0;
  for (const t of terms) {
    if (ref.feel.includes(t)) s += 2;
    if (ref.tags.some((tag) => tag.includes(t)) || ref.subject.toLowerCase().includes(t)) s += 1;
  }
  return s;
}

export function SearchDemo() {
  const [query, setQuery] = useState('calm, soft, premium');
  const terms = words(query);
  const ranked = HERO_REFS.map((ref, i) => ({ ref, i, s: score(ref, terms) })).sort((a, b) => b.s - a.s || a.i - b.i);
  const matches = ranked.filter((r) => r.s > 0).length;

  // FLIP: animate tiles from their old positions to the new order.
  const gridRef = useRef<HTMLOListElement>(null);
  const positions = useRef(new Map<string, DOMRect>());
  useLayoutEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const items = [...grid.querySelectorAll<HTMLElement>('[data-slug]')];
    const reduce = prefersReducedMotion();
    for (const el of items) {
      const slug = el.dataset.slug!;
      const next = el.getBoundingClientRect();
      const prev = positions.current.get(slug);
      if (prev && !reduce) {
        const dx = prev.left - next.left;
        const dy = prev.top - next.top;
        if (dx || dy) {
          el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }], {
            duration: 520,
            easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)',
          });
        }
      }
      positions.current.set(slug, next);
    }
  });

  return (
    <div className="demo demo--search">
      <label className="demo__label" htmlFor="feel-search">
        Describe what you want
      </label>
      <div className="demo__search">
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="7" cy="7" r="4.5" />
          <path d="M10.5 10.5 14 14" />
        </svg>
        <input
          id="feel-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="calm, soft, premium"
          autoComplete="off"
        />
      </div>
      <div className="demo__chips" role="group" aria-label="Try a search">
        {SUGGESTIONS.map((s) => (
          <button key={s} type="button" aria-pressed={query === s} onClick={() => setQuery(s)}>
            {s}
          </button>
        ))}
      </div>
      <p className="demo__status" aria-live="polite">
        {terms.length === 0
          ? 'Type a few words to rank the references.'
          : matches === 0
            ? 'Nothing matches those words. Try one of the suggestions.'
            : `${matches} of ${HERO_REFS.length} references match. Best matches first.`}
      </p>
      <ol ref={gridRef} className="demo__grid">
        {ranked.map(({ ref, s }) => (
          <li key={ref.slug} data-slug={ref.slug} className={terms.length && s === 0 ? 'is-dim' : ''}>
            <Link to={`/ref/${ref.slug}`} className="mini" tabIndex={-1} aria-hidden="true">
              <DuotoneArt variant={ref.art} colors={ref.swatches} />
              <span className="mini__name">{ref.subject}</span>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
