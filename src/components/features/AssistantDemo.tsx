import { useState } from 'react';
import { Link } from 'react-router-dom';
import { findRef } from '../../lib/heroRefs';
import { lookFurther } from '../../lib/lookFurther';
import { photosFor } from '../../lib/referencePhotos';
import { DuotoneArt } from '../hero/DuotoneArt';

/** Answers written ahead of time, shaped like the assistant's real JSON reply. */
const EXAMPLES = [
  {
    id: 'scooter',
    chip: 'Rugged scooter dashboard',
    question: 'I’m designing a rugged-but-premium dashboard for an electric scooter. What directions should I look at?',
    summary:
      'Treat rugged and premium as two layers. Let the structure feel tough, with thick bezels, sealed edges and big controls you can use with gloves on. Let the details feel premium, with fine knurling, crisp type and one warm accent colour.',
    directions: [
      { title: 'Instrument-grade clarity', why: 'Night-friendly clusters show how a few dim, warm elements can carry the whole display.' },
      { title: 'Machined controls', why: 'Knurled aluminium reads as both durable and expensive, and it works with gloves.' },
      { title: 'Enclosed, soft-edged body', why: 'Classic scooter bodywork shows how to wrap tough parts in friendly forms.' },
    ],
    shelf: ['night-cluster', 'aluminium-dial', 'step-through-scooter'],
    queries: [
      { label: 'Night clusters', query: 'motorcycle instrument cluster night', photos: 'night-cluster' },
      { label: 'Knurled controls', query: 'knurled aluminium knob', photos: 'aluminium-dial' },
      { label: 'Scooter cockpits', query: 'scooter handlebar display', photos: 'step-through-scooter' },
    ],
  },
  {
    id: 'cafe',
    chip: 'Calm café counter',
    question: 'A calm café counter in warm wood and stoneware. Where do I start?',
    summary:
      'Start from materials that age well and stay quiet. Oiled hardwood for the counter face, matte stoneware for the serving ware, and one raw mineral surface to ground it. Keep edges soft and colours few.',
    directions: [
      { title: 'Continuous wood faces', why: 'Grain that runs across doors and panels makes a long counter read as one calm surface.' },
      { title: 'Matte glazes', why: 'Stoneware glazes break over edges, adding depth without adding colour.' },
      { title: 'Raw mineral base', why: 'Board-formed concrete gives weight and texture beneath the warmer materials.' },
    ],
    shelf: ['walnut-sideboard', 'stoneware-cup', 'concrete-stair'],
    queries: [
      { label: 'Wood cabinetry', query: 'walnut cabinet grain', photos: 'walnut-sideboard' },
      { label: 'Stoneware glazes', query: 'matte stoneware mug glaze', photos: 'stoneware-cup' },
      { label: 'Board-formed concrete', query: 'board formed concrete wall', photos: 'concrete-stair' },
    ],
  },
] as const;

export function AssistantDemo() {
  const [id, setId] = useState<(typeof EXAMPLES)[number]['id']>('scooter');
  const ex = EXAMPLES.find((e) => e.id === id)!;

  return (
    <div className="demo demo--assistant">
      <div className="demo__chips" role="group" aria-label="Example questions">
        {EXAMPLES.map((e) => (
          <button key={e.id} type="button" aria-pressed={e.id === id} onClick={() => setId(e.id)}>
            {e.chip}
          </button>
        ))}
      </div>

      <p className="demo__ask">{ex.question}</p>

      <div className="demo__answer" aria-live="polite" key={ex.id}>
        <p>{ex.summary}</p>

        <ul className="demo__directions">
          {ex.directions.map((d) => (
            <li key={d.title}>
              <span className="demo__dir-title">{d.title}</span>
              <span className="muted">{d.why}</span>
            </li>
          ))}
        </ul>

        <p className="demo__label">From your shelf</p>
        <ul className="demo__shelf">
          {ex.shelf.map((slug) => {
            const r = findRef(slug)!;
            return (
              <li key={slug}>
                <Link to={`/ref/${slug}`} title={r.subject}>
                  <DuotoneArt variant={r.art} colors={r.swatches} />
                  <span className="visually-hidden">{r.subject}</span>
                </Link>
              </li>
            );
          })}
        </ul>

        <p className="demo__label">Open images</p>
        <ul className="demo__finds">
          {ex.queries.map((q) => {
            const p = photosFor(q.photos)[0];
            return (
              <li key={q.label}>
                <a href={p.sourceUrl} target="_blank" rel="noopener noreferrer">
                  <span className="demo__find-img">
                    <img src={p.src} alt={p.title} loading="lazy" decoding="async" referrerPolicy="no-referrer" />
                  </span>
                  <span className="demo__find-licence mono">{p.licence}</span>
                  <span className="demo__find-credit mono">{p.creator}</span>
                  <span className="visually-hidden"> (opens source in a new tab)</span>
                </a>
              </li>
            );
          })}
        </ul>

        <p className="demo__label">Look further</p>
        <ul className="demo__further">
          {ex.queries.map((q) => (
            <li key={q.label}>
              <span className="demo__further-q">{q.label}</span>
              <span className="demo__further-links">
                {lookFurther(q.query).map((l) => (
                  <a key={l.site} href={l.href} target="_blank" rel="noopener noreferrer">
                    {l.site}
                  </a>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <p className="demo__fine">
        Example answer, written ahead of time. In the app, Gemini answers your own question and can also turn a brief
        into a full design doc.
      </p>
    </div>
  );
}
