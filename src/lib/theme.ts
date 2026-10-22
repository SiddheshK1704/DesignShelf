export type Theme = 'dark' | 'light';

export const THEME_KEY = 'designshelf.theme';

export function getTheme(): Theme {
  return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
}

export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function apply(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme);
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Storage blocked (private mode): the theme still applies for this visit.
  }
}

/**
 * Switch theme. With View Transitions, the new theme is revealed as a circle
 * growing from `origin` (the switch). Otherwise colours fade over 200ms.
 */
export function setTheme(theme: Theme, origin?: { x: number; y: number }) {
  const root = document.documentElement;

  if (prefersReducedMotion()) {
    apply(theme);
    return;
  }

  if (typeof document.startViewTransition !== 'function' || !origin) {
    root.classList.add('theme-fading');
    apply(theme);
    window.setTimeout(() => root.classList.remove('theme-fading'), 220);
    return;
  }

  const { x, y } = origin;
  const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  const transition = document.startViewTransition(() => apply(theme));

  transition.ready
    .then(() => {
      root.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        { duration: 520, easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)', pseudoElement: '::view-transition-new(root)' },
      );
    })
    .catch(() => {
      // Transition skipped (e.g. tab hidden). The theme is already applied.
    });
}
