import { Link } from 'react-router-dom';
import { HERO_REFS } from '../lib/heroRefs';
import { Wordmark } from './Wordmark';
import './Footer.css';

const COLUMNS = [
  {
    title: 'Use it',
    links: [
      { to: '/library', label: 'Library' },
      { to: '/assistant', label: 'Assistant' },
      { to: '/boards', label: 'Boards' },
    ],
  },
  {
    title: 'Learn',
    links: [
      { to: '/help', label: 'How it works' },
      { to: '/settings', label: 'Settings and your key' },
    ],
  },
];

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="container">
        <div className="footer__top">
          <div className="footer__brand">
            <Wordmark />
            <p className="muted">
              A reference library for designers of any discipline. Add images, let AI tag what a designer would notice,
              and search by feel.
            </p>
          </div>

          {COLUMNS.map((col) => (
            <nav key={col.title} className="footer__col" aria-label={col.title}>
              <h2 className="footer__h">{col.title}</h2>
              <ul>
                {col.links.map((l) => (
                  <li key={l.to}>
                    <Link to={l.to}>{l.label}</Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}

          <nav className="footer__col" aria-label="Example references">
            <h2 className="footer__h">Examples</h2>
            <ul className="footer__refs">
              {HERO_REFS.slice(0, 5).map((r) => (
                <li key={r.slug}>
                  <Link to={`/ref/${r.slug}`}>{r.subject}</Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="footer__col">
            <h2 className="footer__h">Project</h2>
            <ul>
              <li>
                <a href="https://github.com/SiddheshK1704/DesignShelf" target="_blank" rel="noopener noreferrer">
                  Source on GitHub
                </a>
              </li>
              <li>
                <a href="https://openverse.org" target="_blank" rel="noopener noreferrer">
                  Openverse
                </a>
              </li>
              <li>
                <a href="https://commons.wikimedia.org" target="_blank" rel="noopener noreferrer">
                  Wikimedia Commons
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="footer__bottom">
          <p>© {year} Design Shelf</p>
          <p className="muted">
            Reference photos come from Openverse and Wikimedia Commons and are credited where they appear.
          </p>
          <a href="#main" className="footer__top-link">
            Back to top
          </a>
        </div>
      </div>
    </footer>
  );
}
