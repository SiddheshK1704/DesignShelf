import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Collage } from '../components/hero/Collage';
import { HERO_REFS, loadHeroPhotos, type HeroPhoto } from '../lib/heroRefs';
import './Landing.css';

export function Landing() {
  const [photos, setPhotos] = useState<Map<string, HeroPhoto>>(() => new Map());

  useEffect(() => {
    let alive = true;
    loadHeroPhotos().then((p) => alive && setPhotos(p));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <>
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero__copy">
          <div className="hero__copy-inner">
            <h1 id="hero-title" className="hero__title">
              Find any reference by feel.
            </h1>
            <p className="hero__sub">
              Describe what you want in your own words and get matching references from your own library, for any
              kind of design.
            </p>
            <div className="hero__actions">
              <Link to="/library" className="btn btn--primary">
                Open the library
              </Link>
              <Link to="/find" className="btn">
                Find references
              </Link>
            </div>
            <p className="hero__disciplines">
              For industrial, vehicle, CMF, UI/UX, graphic, interior and fashion design.
            </p>
          </div>
        </div>

        <div className="hero__collage" role="region" aria-label="Example references with their tags">
          <Collage items={HERO_REFS} photos={photos} parallax />
        </div>
      </section>
    </>
  );
}
