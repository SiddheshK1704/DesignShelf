import { useState } from 'react';
import { HERO_REFS } from '../../lib/heroRefs';
import { DuotoneArt } from '../hero/DuotoneArt';

const BOARDS = [
  { id: 'scooter', name: 'Scooter refresh' },
  { id: 'cafe', name: 'Café fit-out' },
];

const START: Record<string, string[]> = {
  scooter: ['step-through-scooter', 'night-cluster'],
  cafe: ['stoneware-cup', 'walnut-sideboard'],
};

export function BoardsDemo() {
  const [boards, setBoards] = useState(START);
  const [active, setActive] = useState(BOARDS[0].id);

  function toggle(slug: string) {
    setBoards((b) => {
      const list = b[active];
      return { ...b, [active]: list.includes(slug) ? list.filter((s) => s !== slug) : [...list, slug] };
    });
  }

  const activeName = BOARDS.find((b) => b.id === active)!.name;

  return (
    <div className="demo demo--boards">
      <div className="demo__boards">
        {BOARDS.map((b) => (
          <button
            key={b.id}
            type="button"
            className="demo__board"
            aria-pressed={b.id === active}
            onClick={() => setActive(b.id)}
          >
            <span className="demo__board-stack" aria-hidden="true">
              {boards[b.id].slice(-4).map((slug, i) => {
                const r = HERO_REFS.find((x) => x.slug === slug)!;
                return (
                  <span key={slug} style={{ rotate: `${(i % 2 ? 1 : -1) * (i + 1) * 1.1}deg` }}>
                    <DuotoneArt variant={r.art} colors={r.swatches} />
                  </span>
                );
              })}
              {boards[b.id].length === 0 && <span className="demo__board-empty">Empty</span>}
            </span>
            <span className="demo__board-name">{b.name}</span>
            <span className="demo__board-count muted">
              {boards[b.id].length} {boards[b.id].length === 1 ? 'reference' : 'references'}
            </span>
          </button>
        ))}
      </div>

      <p className="demo__label">Add to “{activeName}”</p>
      <ul className="demo__board-pool">
        {HERO_REFS.map((r) => {
          const on = boards[active].includes(r.slug);
          return (
            <li key={r.slug}>
              <button
                type="button"
                aria-pressed={on}
                aria-label={`${on ? 'Remove' : 'Add'} ${r.subject} ${on ? 'from' : 'to'} ${activeName}`}
                onClick={() => toggle(r.slug)}
              >
                <DuotoneArt variant={r.art} colors={r.swatches} />
                <span className="demo__board-mark" aria-hidden="true">
                  {on ? '✓' : '+'}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
