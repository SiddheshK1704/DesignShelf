import { Link } from 'react-router-dom';
import { HERO_REFS } from '../lib/heroRefs';
import { useAuth } from './AuthProvider';
import './Cta.css';

export function Cta() {
  const { mode, openAuth } = useAuth();
  // Every swatch from the collage, twice over, standing on a shelf like spines.
  const swatches = HERO_REFS.flatMap((r) => r.swatches);
  const spines = [...swatches, ...swatches.slice().reverse()];

  return (
    <section className="cta" aria-labelledby="cta-title">
      <div className="container cta__inner">
        <div className="cta__spines" aria-hidden="true">
          {spines.map((c, i) => (
            <span key={`${c}-${i}`} style={{ background: c, height: `${48 + ((i * 37) % 52)}%` }} />
          ))}
        </div>
        <h2 id="cta-title" className="cta__title">
          Start your shelf.
        </h2>
        <p className="cta__sub">
          Add your first references and search them by feel in a few minutes. You don’t need an account to start.
        </p>
        <div className="cta__actions">
          <Link to="/library" className="btn btn--primary">
            Open the library
          </Link>
          {mode !== 'signed-in' && (
            <button type="button" className="btn" onClick={() => openAuth('sign-up')}>
              Create an account
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
