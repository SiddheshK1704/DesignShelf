import { Link } from 'react-router-dom';
import { Cta } from '../components/Cta';
import { Features } from '../components/features/Features';
import { Collage } from '../components/hero/Collage';
import { HERO_REFS } from '../lib/heroRefs';
import './Landing.css';

export function Landing() {
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
              <Link to="/assistant" className="btn">
                Ask the assistant
              </Link>
            </div>
            <p className="hero__disciplines">
              For industrial, vehicle, CMF, UI/UX, graphic, interior and fashion design.
            </p>
          </div>
        </div>

        <div className="hero__collage" role="region" aria-label="Example references. Select one to see details.">
          <Collage items={HERO_REFS} parallax />
        </div>
      </section>

      <Features />
      <Cta />
    </>
  );
}
