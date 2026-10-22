import { useRef, type KeyboardEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AskPanel } from '../components/assistant/AskPanel';
import './app.css';
import './assistant.css';

const TABS = [
  { id: 'ask', label: 'Ask' },
  { id: 'doc', label: 'Design doc' },
] as const;

export function Assistant() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'doc' ? 'doc' : 'ask';
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  function select(id: string) {
    setParams(id === 'ask' ? {} : { tab: id }, { replace: true });
  }

  function onKey(e: KeyboardEvent) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const next = TABS[(TABS.findIndex((t) => t.id === tab) + 1) % TABS.length].id;
    select(next);
    refs.current[next]?.focus();
  }

  return (
    <div className="page page--assistant">
      <header className="page__head">
        <div>
          <h1 className="page__title">Assistant</h1>
          <p className="muted">Ask for references, or turn a brief into a design doc.</p>
        </div>
      </header>

      <div role="tablist" aria-label="Assistant mode" className="tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[t.id] = el;
            }}
            type="button"
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            tabIndex={tab === t.id ? 0 : -1}
            className="tabs__tab"
            onClick={() => select(t.id)}
            onKeyDown={onKey}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="tabs__panel">
        {tab === 'ask' ? (
          <AskPanel />
        ) : (
          <div className="empty reg-frame">
            <h2>Design doc mode is next.</h2>
            <p>Soon you’ll be able to paste a brief and get a structured handoff document back, with references and a diagram.</p>
          </div>
        )}
      </div>
    </div>
  );
}
