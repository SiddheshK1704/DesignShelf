import { useState, type CSSProperties } from 'react';
import type { HeroPhoto, HeroRef } from '../../lib/heroRefs';
import { DuotoneArt } from './DuotoneArt';

const TILT = [-1.2, 0.8, -0.5, 1, -0.9, 0.6, 1.3, -0.7, 0.4];

interface Props {
  item: HeroRef;
  index: number;
  photo?: HeroPhoto;
  /** Overrides the item's own tags (used by the lens demo). */
  tags?: string[];
  eager?: boolean;
}

export function ReferenceTile({ item, index, photo, tags = item.tags, eager = false }: Props) {
  const [failed, setFailed] = useState(false);
  const showPhoto = photo && !failed;

  return (
    <figure className="tile" style={{ '--tilt': `${TILT[index % TILT.length]}deg` } as CSSProperties}>
      <div className="tile__img" style={{ aspectRatio: item.ratio }}>
        {showPhoto ? (
          <img
            src={`/hero/${photo.file}`}
            alt={item.subject}
            loading={eager ? 'eager' : 'lazy'}
            decoding="async"
            onError={() => setFailed(true)}
          />
        ) : (
          <DuotoneArt variant={item.art} colors={item.swatches} />
        )}
        <ul className="tile__tags" aria-label={`Tags for ${item.subject}`}>
          {tags.map((t) => (
            <li key={t}>{t}</li>
          ))}
          {showPhoto && photo.credit && (
            <li className="tile__credit">
              {photo.credit}
              {photo.licence ? ` · ${photo.licence}` : ''}
            </li>
          )}
        </ul>
      </div>
      <figcaption className="tile__cap">
        <span className="tile__subject">{item.subject}</span>
        <span className="tile__swatches" aria-hidden="true">
          {item.swatches.map((c) => (
            <i key={c} style={{ background: c }} />
          ))}
        </span>
      </figcaption>
    </figure>
  );
}
