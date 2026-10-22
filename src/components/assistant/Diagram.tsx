import { useEffect, useState } from 'react';
import { renderMermaid } from '../../lib/mermaid';

type State =
  | { status: 'loading' }
  | { status: 'done'; dark: string; light: string }
  | { status: 'error'; message: string };

/**
 * A Mermaid diagram rendered in both palettes. CSS shows the one that
 * matches the theme, and print always uses the light one.
 */
export function Diagram({ code, ok, error }: { code: string; ok: boolean; error?: string }) {
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    if (!ok) return;
    let alive = true;
    setState({ status: 'loading' });
    Promise.all([renderMermaid(code, 'dark'), renderMermaid(code, 'light')])
      .then(([dark, light]) => alive && setState({ status: 'done', dark, light }))
      .catch((err: Error) => alive && setState({ status: 'error', message: err.message }));
    return () => {
      alive = false;
    };
  }, [code, ok]);

  const failure = !ok ? error : state.status === 'error' ? state.message : null;

  if (failure != null) {
    return (
      <div className="diagram diagram--failed">
        <p className="notice notice--error">
          The diagram code didn’t pass Mermaid’s check{!ok ? ', even after one repair' : ''}. The code is below, so you
          can fix it by hand or paste it into a Mermaid editor.
        </p>
        {failure && <pre className="diagram__error mono">{failure}</pre>}
        <pre className="diagram__code mono">{code || '(empty)'}</pre>
      </div>
    );
  }

  return (
    <figure className="diagram">
      {state.status === 'done' ? (
        <>
          <div className="diagram__svg diagram__svg--dark" dangerouslySetInnerHTML={{ __html: state.dark }} />
          <div className="diagram__svg diagram__svg--light" dangerouslySetInnerHTML={{ __html: state.light }} />
        </>
      ) : (
        <div className="diagram__loading" role="status">
          <span className="spinner" aria-hidden="true" /> Drawing the diagram…
        </div>
      )}
      <details className="diagram__src">
        <summary>Show Mermaid code</summary>
        <pre className="mono">{code}</pre>
      </details>
    </figure>
  );
}
