/**
 * Mermaid, loaded only when a diagram is needed. Diagrams are rendered in
 * both palettes so the page can show the one matching the theme and print
 * always uses the light one.
 */
import type { MermaidConfig } from 'mermaid';

type Mermaid = typeof import('mermaid').default;
let loading: Promise<Mermaid> | null = null;

function load(): Promise<Mermaid> {
  loading ??= import('mermaid').then((m) => m.default);
  loading.catch(() => (loading = null));
  return loading;
}

const FONT = '"IBM Plex Sans", system-ui, sans-serif';

const PALETTES: Record<'dark' | 'light', MermaidConfig['themeVariables']> = {
  dark: {
    darkMode: true,
    background: '#15171A',
    mainBkg: '#1C1F23',
    primaryColor: '#1C1F23',
    primaryTextColor: '#E9EAEC',
    primaryBorderColor: '#8A9099',
    secondaryColor: '#15171A',
    tertiaryColor: '#0D0E10',
    textColor: '#E9EAEC',
    nodeBorder: '#8A9099',
    lineColor: '#8A9099',
    clusterBkg: '#15171A',
    clusterBorder: '#2B2F35',
    edgeLabelBackground: '#15171A',
    titleColor: '#E9EAEC',
    fontFamily: FONT,
    fontSize: '14px',
  },
  light: {
    darkMode: false,
    background: '#F6F6F7',
    mainBkg: '#E2E4E7',
    primaryColor: '#E2E4E7',
    primaryTextColor: '#101215',
    primaryBorderColor: '#5E656E',
    secondaryColor: '#F6F6F7',
    tertiaryColor: '#ECEDEF',
    textColor: '#101215',
    nodeBorder: '#5E656E',
    lineColor: '#5E656E',
    clusterBkg: '#ECEDEF',
    clusterBorder: '#C9CDD3',
    edgeLabelBackground: '#F6F6F7',
    titleColor: '#101215',
    fontFamily: FONT,
    fontSize: '14px',
  },
};

/** Mermaid's config is global, so renders run one at a time. */
let queue: Promise<unknown> = Promise.resolve();
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => undefined);
  return run;
}

function configure(m: Mermaid, theme: 'dark' | 'light') {
  m.initialize({
    startOnLoad: false,
    // Labels come from AI output: no HTML, no click handlers.
    securityLevel: 'strict',
    theme: 'base',
    themeVariables: PALETTES[theme],
    flowchart: { htmlLabels: false, curve: 'basis', padding: 12 },
  });
}

/** Remove code fences the model sometimes adds. */
export function cleanMermaid(code: string): string {
  return code
    .replace(/^\s*```(?:mermaid)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();
}

/** Returns null when the code parses, or Mermaid's error message. */
export function checkMermaid(code: string): Promise<string | null> {
  return serial(async () => {
    const m = await load();
    configure(m, 'light');
    try {
      await m.parse(code);
      return null;
    } catch (err) {
      return (err as Error).message?.split('\n').slice(0, 4).join('\n') || 'The diagram code could not be read.';
    }
  });
}

let seq = 0;

export function renderMermaid(code: string, theme: 'dark' | 'light'): Promise<string> {
  return serial(async () => {
    const m = await load();
    configure(m, theme);
    const { svg } = await m.render(`ds-mermaid-${++seq}`, code);
    return svg;
  });
}
