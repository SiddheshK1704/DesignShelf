import { useEffect, useId, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { AccountButton } from './AccountButton';
import { ThemeSwitch } from './ThemeSwitch';
import { Wordmark } from './Wordmark';
import './Navbar.css';

const LINKS = [
  { to: '/library', label: 'Library' },
  { to: '/find', label: 'Find references' },
  { to: '/boards', label: 'Boards' },
  { to: '/help', label: 'How it works' },
  { to: '/settings', label: 'Settings' },
];

export function Navbar() {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const { pathname } = useLocation();

  // Close the mobile menu on navigation.
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <header className="nav" data-open={open}>
      <div className="nav__inner container">
        <Wordmark />

        <nav aria-label="Main" className="nav__links" id={menuId}>
          <ul>
            {LINKS.map((l) => (
              <li key={l.to}>
                <NavLink to={l.to} className="nav__link">
                  {l.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="nav__end">
          <AccountButton />
          <ThemeSwitch />
          <button
            ref={toggleRef}
            type="button"
            className="nav__menu-btn"
            aria-expanded={open}
            aria-controls={menuId}
            onClick={() => setOpen((o) => !o)}
          >
            <span className="visually-hidden">Menu</span>
            <span className="nav__menu-icon" aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>
  );
}
