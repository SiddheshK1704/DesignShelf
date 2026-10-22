import { useEffect, useRef, useState } from 'react';
import './Swatch.css';

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Clipboard API blocked (insecure context or permissions): fall back.
    const el = document.createElement('textarea');
    el.value = text;
    el.setAttribute('readonly', '');
    el.style.position = 'fixed';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand('copy');
    el.remove();
    return ok;
  }
}

/** A colour chip with its hex code. Click to copy. */
export function Swatch({ hex, size = 'md' }: { hex: string; size?: 'sm' | 'md' | 'lg' }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const timer = useRef<number>(0);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  async function onClick() {
    const ok = await copyText(hex);
    setState(ok ? 'copied' : 'failed');
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState('idle'), 1600);
  }

  return (
    <button type="button" className={`swatch swatch--${size}`} onClick={onClick} title={`Copy ${hex}`}>
      <span className="swatch__chip" style={{ background: hex }} aria-hidden="true" />
      <span className="swatch__hex mono">{state === 'copied' ? 'Copied' : state === 'failed' ? 'Press Ctrl+C' : hex}</span>
      <span className="visually-hidden" aria-live="polite">
        {state === 'copied' ? `${hex} copied to clipboard` : state === 'failed' ? 'Could not copy. Select the code and copy it.' : ''}
      </span>
    </button>
  );
}
