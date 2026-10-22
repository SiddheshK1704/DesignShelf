import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import type { HeroRef } from '../../lib/heroRefs';
import { DuotoneArt } from './DuotoneArt';

const TILT = [-1.2, 0.8, -0.5, 1, -0.9, 0.6, 1.3, -0.7, 0.4];

interface Props {
  item: HeroRef;
  index: number;
}

/** A framed reference in the collage. Links to its detail page. */
export function ReferenceTile({ item, index }: Props) {
  return (
    <Link
      to={`/ref/${item.slug}`}
      className="tile"
      style={{ '--tilt': `${TILT[index % TILT.length]}deg` } as CSSProperties}
      aria-label={`${item.subject}, ${item.discipline}. Tags: ${item.tags.join(', ')}. View details.`}
    >
      <figure className="tile__figure">
        <div className="tile__img" style={{ aspectRatio: item.ratio }}>
          <DuotoneArt variant={item.art} colors={item.swatches} />
          <ul className="tile__tags" aria-hidden="true">
            {item.tags.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
        <figcaption className="tile__cap" aria-hidden="true">
          <span className="tile__subject">{item.subject}</span>
          <span className="tile__swatches">
            {item.swatches.map((c) => (
              <i key={c} style={{ background: c }} />
            ))}
          </span>
        </figcaption>
      </figure>
    </Link>
  );
}
