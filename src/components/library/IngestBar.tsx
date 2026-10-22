import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { dismissIngest, useIngest } from '../../lib/ingest';

/** Progress for the current upload batch, including rate-limit waits and failures. */
export function IngestBar() {
  const s = useIngest();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!s.waitingUntil) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [s.waitingUntil]);

  if (s.total === 0 && !s.errors.length && !s.stopped) return null;

  const finished = s.done + s.failed;
  const pct = s.total ? Math.round((finished / s.total) * 100) : 100;
  const waiting = s.waitingUntil && s.waitingUntil > now ? Math.ceil((s.waitingUntil - now) / 1000) : 0;
  const idle = s.phase === 'idle';

  let line: string;
  if (waiting) line = `Gemini asked us to slow down. Trying again in ${waiting}s.`;
  else if (s.phase === 'saving') line = `Saving ${Math.min(finished + 1, s.total)} of ${s.total}…`;
  else if (s.phase === 'tagging') line = `Tagging ${Math.min(finished + 1, s.total)} of ${s.total}${s.current ? `: ${s.current}` : ''}`;
  else if (s.failed) line = `Done. ${s.done} added, ${s.failed} need attention.`;
  else line = `Done. ${s.done} ${s.done === 1 ? 'image' : 'images'} added.`;

  return (
    <div className="ingest" role="status" aria-live="polite">
      <div className="ingest__row">
        <span>{line}</span>
        {idle && (
          <button type="button" className="linkbtn" onClick={dismissIngest}>
            Dismiss
          </button>
        )}
      </div>
      <div
        className="ingest__bar"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label="Upload progress"
      >
        <span style={{ width: `${pct}%` }} className={waiting ? 'is-waiting' : ''} />
      </div>
      {s.stopped && (
        <p className="ingest__stop">
          Tagging stopped: {s.stopped} Your images are saved without tags. <Link to="/settings">Open Settings</Link>, then
          use “Tag again” on each image.
        </p>
      )}
      {s.errors.length > 0 && (
        <details className="ingest__errors">
          <summary>
            {s.errors.length} {s.errors.length === 1 ? 'problem' : 'problems'}
          </summary>
          <ul>
            {s.errors.slice(-20).map((e, i) => (
              <li key={i}>
                <strong>{e.name}</strong>: {e.message}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
