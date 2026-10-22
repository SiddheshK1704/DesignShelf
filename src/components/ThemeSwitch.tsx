import { useEffect, useState, type MouseEvent } from 'react';
import { getTheme, setTheme, THEME_KEY, type Theme } from '../lib/theme';
import './ThemeSwitch.css';

/**
 * A physical slide switch. "On" means dark theme. The glyph of the active
 * theme is lit; the ridged knob rests at the other end.
 */
export function ThemeSwitch() {
  const [theme, setLocal] = useState<Theme>(getTheme);
  const isDark = theme === 'dark';

  // Keep in sync if another tab changes the theme.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === THEME_KEY && (e.newValue === 'dark' || e.newValue === 'light')) {
        document.documentElement.setAttribute('data-theme', e.newValue);
        setLocal(e.newValue);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  function toggle(e: MouseEvent<HTMLButtonElement>) {
    const next: Theme = isDark ? 'light' : 'dark';
    const rect = e.currentTarget.getBoundingClientRect();
    setLocal(next);
    setTheme(next, { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label="Dark theme"
      title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      className="theme-switch"
      data-state={theme}
      onClick={toggle}
    >
      <span className="theme-switch__track" aria-hidden="true">
        <svg className="theme-switch__glyph theme-switch__glyph--moon" viewBox="0 0 16 16">
          <path d="M10.6 2.2a6 6 0 1 0 3.2 9.6A5 5 0 0 1 10.6 2.2Z" />
        </svg>
        <svg className="theme-switch__glyph theme-switch__glyph--sun" viewBox="0 0 16 16">
          <circle cx="8" cy="8" r="2.8" />
          <path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4" />
        </svg>
        <span className="theme-switch__knob" />
      </span>
    </button>
  );
}
