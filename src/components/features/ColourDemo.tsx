import { useState } from 'react';
import { Link } from 'react-router-dom';
import { HERO_REFS, type HeroRef } from '../../lib/heroRefs';
import { DuotoneArt } from '../hero/DuotoneArt';
import { Swatch } from '../Swatch';

const PICKS = ['step-through-scooter', 'grid-poster', 'leather-tote', 'night-cluster'];

function rgb(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Average distance from each swatch to its nearest swatch in the other palette. */
function paletteDistance(a: string[], b: string[]) {
  const near = (x: string, list: string[]) =>
    Math.min(...list.map((y) => Math.hypot(...rgb(x).map((v, i) => v - rgb(y)[i]))));
  return (a.reduce((s, x) => s + near(x, b), 0) + b.reduce((s, y) => s + near(y, a), 0)) / (a.length + b.length);
}

function similar(ref: HeroRef) {
  return HERO_REFS.filter((r) => r.slug !== ref.slug)
    .map((r) => ({ r, d: paletteDistance(ref.swatches, r.swatches) }))
    .sort((x, y) => x.d - y.d)
    .slice(0, 3);
}

export function ColourDemo() {
  const [slug, setSlug] = useState(PICKS[0]);
  const ref = HERO_REFS.find((r) => r.slug === slug)!;

  return (
    <div className="demo demo--colour">
      <div className="demo__picker" role="radiogroup" aria-label="Choose a reference">
        {PICKS.map((s) => {
          const r = HERO_REFS.find((x) => x.slug === s)!;
          return (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={s === slug}
              aria-label={r.subject}
              onClick={() => setSlug(s)}
            >
              <DuotoneArt variant={r.art} colors={r.swatches} />
            </button>
          );
        })}
      </div>

      <div className="demo__colour-main">
        <div className="demo__colour-art">
          <DuotoneArt variant={ref.art} colors={ref.swatches} />
        </div>
        <div className="demo__colour-side">
          <p className="demo__label">Palette. Click a colour to copy it.</p>
          <div className="demo__swatches">
            {ref.swatches.map((c) => (
              <Swatch key={c} hex={c} size="lg" />
            ))}
          </div>
          <p className="demo__label">More like this</p>
          <ul className="demo__similar">
            {similar(ref).map(({ r }) => (
              <li key={r.slug}>
                <Link to={`/ref/${r.slug}`}>
                  <span className="demo__similar-art">
                    <DuotoneArt variant={r.art} colors={r.swatches} />
                  </span>
                  <span className="demo__similar-name">{r.subject}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
