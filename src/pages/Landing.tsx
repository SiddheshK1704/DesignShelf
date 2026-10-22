import { Link } from 'react-router-dom';
import './Landing.css';

// Milestone 2 stand-in: shows the type scale and buttons. The split hero
// with the image collage replaces this in milestone 3.
export function Landing() {
  return (
    <section className="landing-stub container">
      <h1 className="hero-title">Find any reference by feel.</h1>
      <p className="landing-stub__sub">
        Describe what you want in your own words and get matching references from your own library, for any kind of
        design.
      </p>
      <div className="landing-stub__actions">
        <Link to="/library" className="btn btn--primary">
          Open the library
        </Link>
        <Link to="/find" className="btn">
          Find references
        </Link>
      </div>
      <p className="mono muted">tokens · archivo wdth 125 · plex sans · plex mono · #E3A94A</p>
    </section>
  );
}
