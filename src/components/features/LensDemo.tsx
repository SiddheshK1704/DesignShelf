import { useId, useState } from 'react';
import { findRef } from '../../lib/heroRefs';
import { DuotoneArt } from '../hero/DuotoneArt';

const LENSES = [
  {
    id: 'vehicle',
    label: 'Vehicle',
    asks: 'proportion, stance, surfaces',
    tags: ['step-through frame', 'small 10–12 inch wheels', 'upright seating', 'apron as leg shield', 'compact wheelbase'],
  },
  {
    id: 'cmf',
    label: 'CMF',
    asks: 'colour, material, finish',
    tags: ['sage gloss paint', 'cream lower band', 'satin black trim', 'stitched vinyl seat', 'two-tone split line'],
  },
  {
    id: 'ui',
    label: 'UI',
    asks: 'controls, displays, feedback',
    tags: ['single round headlamp', 'thumb-reach switches', 'glanceable speed readout', 'few, large controls'],
  },
  {
    id: 'packaging',
    label: 'Packaging',
    asks: 'shelf read, structure, branding',
    tags: ['silhouette reads small', 'two colours as brand cue', 'curved panels hard to flat-pack', 'side view as hero face'],
  },
  {
    id: 'custom',
    label: 'Custom',
    asks: 'you decide, e.g. repairability',
    tags: ['bolt-on body panels', 'separate front apron', 'exposed rear hub', 'easy-swap seat'],
  },
] as const;

export function LensDemo() {
  const scooter = findRef('step-through-scooter')!;
  const [lens, setLens] = useState<(typeof LENSES)[number]['id']>('vehicle');
  const uid = useId();
  const active = LENSES.find((l) => l.id === lens)!;

  return (
    <div className="demo demo--lens">
      <div className="demo__lens-art">
        <DuotoneArt variant={scooter.art} colors={scooter.swatches} />
      </div>
      <div className="demo__lens-body">
        <div className="demo__segmented" role="radiogroup" aria-label="Lens">
          {LENSES.map((l) => (
            <label key={l.id} className={l.id === lens ? 'is-on' : ''}>
              <input type="radio" name={`${uid}-lens`} value={l.id} checked={l.id === lens} onChange={() => setLens(l.id)} />
              {l.label}
            </label>
          ))}
        </div>
        <p className="demo__asks">
          {active.label === 'Custom' ? 'Your lens: repairability' : `${active.label} lens`}{' '}
          <span className="muted">looks at {active.asks}.</span>
        </p>
        <ul className="demo__tags" key={lens} aria-live="polite">
          {active.tags.map((t, i) => (
            <li key={t} style={{ animationDelay: `${i * 50}ms` }}>
              {t}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
