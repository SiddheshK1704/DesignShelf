import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { DuotoneArt } from '../components/hero/DuotoneArt';
import { Swatch } from '../components/Swatch';
import { findRef, HERO_REFS, type HeroRef } from '../lib/heroRefs';
import { photosFor } from '../lib/referencePhotos';
import { Placeholder } from './Placeholder';
import './Reference.css';

/** References that share the most feel words with this one. */
function related(ref: HeroRef, count = 3): HeroRef[] {
  return HERO_REFS.filter((r) => r.slug !== ref.slug)
    .map((r) => ({ r, score: r.feel.filter((f) => ref.feel.includes(f)).length }))
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    .map(({ r }) => r);
}

export function Reference() {
  const { slug = '' } = useParams();
  const ref = findRef(slug);

  useEffect(() => {
    document.title = ref ? `${ref.subject} · Design Shelf` : 'Not found · Design Shelf';
    return () => {
      document.title = 'Design Shelf';
    };
  }, [ref]);

  if (!ref) return <Placeholder title="Reference not found" notFound />;

  const photos = photosFor(ref.slug);
  const index = HERO_REFS.indexOf(ref);
  const prev = HERO_REFS[(index - 1 + HERO_REFS.length) % HERO_REFS.length];
  const next = HERO_REFS[(index + 1) % HERO_REFS.length];

  return (
    <article className="ref container">
      <nav className="ref__crumbs" aria-label="Breadcrumb">
        <Link to="/">Home</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{ref.subject}</span>
      </nav>

      <header className="ref__head">
        <div className="ref__art reg-frame" style={{ aspectRatio: ref.ratio }}>
          <DuotoneArt variant={ref.art} colors={ref.swatches} />
        </div>

        <div className="ref__intro">
          <p className="ref__meta">
            <span>{ref.discipline}</span>
            <span aria-hidden="true">·</span>
            <span>{photos.length} real-world photos</span>
          </p>
          <h1 className="ref__title">{ref.subject}</h1>
          {ref.about.map((p) => (
            <p key={p.slice(0, 24)} className="ref__about">
              {p}
            </p>
          ))}

          <div className="ref__block">
            <h2 className="ref__h">Tags</h2>
            <ul className="ref__tags">
              {[...ref.tags, ...ref.feel.slice(0, 3)].map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>

          <div className="ref__block">
            <h2 className="ref__h">Palette</h2>
            <div className="ref__palette">
              {ref.swatches.map((c) => (
                <Swatch key={c} hex={c} />
              ))}
            </div>
          </div>
        </div>
      </header>

      <section className="ref__section ref__notice" aria-labelledby="notice-h">
        <h2 id="notice-h" className="ref__h2">
          What to look at
        </h2>
        <ul>
          {ref.notice.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </section>

      <section className="ref__section" aria-labelledby="photos-h">
        <div className="ref__section-head">
          <h2 id="photos-h" className="ref__h2">
            Real-world references
          </h2>
          <p className="muted">
            Photos from Openverse and Wikimedia Commons, shown under each author’s licence. Select a photo to open its
            source.
          </p>
        </div>

        {photos.length === 0 ? (
          <p className="muted">No photos saved for this reference yet. Run npm run refs:fetch to collect some.</p>
        ) : (
          <div className="ref__photos">
            {photos.map((p) => (
              <figure key={p.id} className="ref__photo">
                <a href={p.sourceUrl} target="_blank" rel="noopener noreferrer" className="ref__photo-link">
                  <img
                    src={p.src}
                    alt={p.title}
                    width={p.width}
                    height={p.height}
                    loading="lazy"
                    decoding="async"
                    referrerPolicy="no-referrer"
                  />
                  <span className="visually-hidden"> (opens source in a new tab)</span>
                </a>
                <figcaption>
                  <span className="ref__photo-title">{p.title}</span>
                  <span className="ref__credit mono">
                    {p.creatorUrl ? (
                      <a href={p.creatorUrl} target="_blank" rel="noopener noreferrer">
                        {p.creator}
                      </a>
                    ) : (
                      p.creator
                    )}
                    {' · '}
                    {p.licenceUrl ? (
                      <a href={p.licenceUrl} target="_blank" rel="noopener noreferrer">
                        {p.licence}
                      </a>
                    ) : (
                      p.licence
                    )}
                    {' · '}
                    {p.provider}
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </section>

      <section className="ref__section" aria-labelledby="more-h">
        <h2 id="more-h" className="ref__h2">
          More like this
        </h2>
        <ul className="ref__related">
          {related(ref).map((r) => (
            <li key={r.slug}>
              <Link to={`/ref/${r.slug}`} className="ref__related-link">
                <span className="ref__related-art">
                  <DuotoneArt variant={r.art} colors={r.swatches} />
                </span>
                <span className="ref__related-name">{r.subject}</span>
                <span className="ref__related-why muted">
                  {r.feel.filter((f) => ref.feel.includes(f)).slice(0, 3).join(', ')}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <nav className="ref__pager" aria-label="Other references">
        <Link to={`/ref/${prev.slug}`} rel="prev">
          <span className="muted">Previous</span>
          <span className="ref__pager-name">{prev.subject}</span>
        </Link>
        <Link to={`/ref/${next.slug}`} rel="next" className="ref__pager-next">
          <span className="muted">Next</span>
          <span className="ref__pager-name">{next.subject}</span>
        </Link>
      </nav>
    </article>
  );
}
