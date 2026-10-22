import { useEffect, useRef } from 'react';
import type { HeroRef } from '../../lib/heroRefs';
import { prefersReducedMotion } from '../../lib/theme';
import { ReferenceTile } from './ReferenceTile';
import './Collage.css';

interface Props {
  items: HeroRef[];
  /** Drift columns in opposite directions on scroll. */
  parallax?: boolean;
  className?: string;
}

/** Three staggered columns of framed references. Items fill columns left to right, row by row. */
export function Collage({ items, parallax = false, className = '' }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!parallax || !el || prefersReducedMotion()) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      // Only drift while the hero is near the viewport.
      const y = Math.min(window.scrollY, window.innerHeight * 1.5);
      el.style.setProperty('--drift', String(y));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
    };
  }, [parallax]);

  const columns = [0, 1, 2].map((c) => items.map((item, i) => ({ item, i })).filter(({ i }) => i % 3 === c));

  return (
    <div ref={ref} className={`collage ${className}`}>
      {columns.map((col, c) => (
        <div className="collage__col" key={c}>
          {col.map(({ item, i }) => (
            <ReferenceTile key={item.slug} item={item} index={i} />
          ))}
        </div>
      ))}
    </div>
  );
}
