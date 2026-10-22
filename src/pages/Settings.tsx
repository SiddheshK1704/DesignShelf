import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { ConfirmDialog } from '../components/Dialog';
import { useAuth } from '../components/AuthProvider';
import { useLibrary } from '../components/library/LibraryProvider';
import { forgetBlobUrls } from '../components/library/useBlobUrl';
import { listModels, pickModels, type GeminiModel } from '../lib/gemini';
import { enqueue } from '../lib/ingest';
import { BASE_GROUPS, BUILT_IN_LENSES, slugKey } from '../lib/lenses';
import { downloadBlob, exportLibrary, importLibrary } from '../lib/portable';
import { clearSettings, updateSettings, useSettings } from '../lib/settings';
import { newId, type Lens, type TagGroupDef } from '../lib/types';
import './app.css';

export function Settings() {
  return (
    <div className="page page--narrow">
      <header className="page__head">
        <div>
          <h1 className="page__title">Settings</h1>
          <p className="muted">Your key, models and lenses are stored in this browser only.</p>
        </div>
      </header>
      <nav className="toc" aria-label="On this page">
        <a href="#key">Gemini key</a>
        <a href="#models">Models</a>
        <a href="#lenses">Lenses</a>
        <a href="#data">Your data</a>
      </nav>
      <KeySection />
      <ModelsSection />
      <LensesSection />
      <DataSection />
    </div>
  );
}

/* ---------- Key ---------- */

function KeySection() {
  const s = useSettings();
  const [draft, setDraft] = useState(s.geminiKey);
  const [show, setShow] = useState(false);
  const [status, setStatus] = useState<{ kind: 'idle' | 'testing' | 'ok' | 'error'; text?: string }>({ kind: 'idle' });
  const id = useId();

  async function save(e: FormEvent) {
    e.preventDefault();
    const key = draft.trim();
    if (!key) return;
    setStatus({ kind: 'testing' });
    try {
      const models = await listModels(key);
      const picked = pickModels(models);
      updateSettings({
        geminiKey: key,
        models: { generate: s.models.generate ?? picked.generate[0]?.name, embed: s.models.embed ?? picked.embed[0]?.name },
      });
      setStatus({ kind: 'ok', text: `Key saved and working. ${models.length} models available.` });
    } catch (err) {
      setStatus({ kind: 'error', text: (err as Error).message });
    }
  }

  return (
    <section id="key" className="set">
      <h2 className="set__title">Gemini API key</h2>
      <p>
        Design Shelf uses your own key to tag images and search by meaning. It’s saved in this browser and sent only to
        Google, with each request. Get a free key in{' '}
        <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">
          Google AI Studio
        </a>
        .
      </p>
      <form className="set__form" onSubmit={save}>
        <label className="field" htmlFor={id}>
          <span className="field__label">API key</span>
          <span className="input-row">
            <input
              id={id}
              className="input mono-input"
              type={show ? 'text' : 'password'}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="AIza…"
              autoComplete="off"
              spellCheck={false}
            />
            <button type="button" className="btn btn--quiet" onClick={() => setShow((v) => !v)} aria-pressed={show}>
              {show ? 'Hide' : 'Show'}
            </button>
          </span>
        </label>
        <div className="set__actions">
          <button type="submit" className="btn btn--primary" disabled={!draft.trim() || status.kind === 'testing'}>
            {status.kind === 'testing' ? 'Checking…' : 'Save and test'}
          </button>
          {s.geminiKey && (
            <button
              type="button"
              className="btn btn--quiet"
              onClick={() => {
                updateSettings({ geminiKey: '' });
                setDraft('');
                setStatus({ kind: 'idle' });
              }}
            >
              Remove key
            </button>
          )}
        </div>
        {status.kind === 'ok' && <p className="notice notice--ok">{status.text}</p>}
        {status.kind === 'error' && (
          <p className="notice notice--error" role="alert">
            {status.text}
          </p>
        )}
        {status.kind === 'idle' && s.geminiKey && <p className="field__hint">A key is saved. Paste a new one to replace it.</p>}
      </form>
    </section>
  );
}

/* ---------- Models ---------- */

function ModelsSection() {
  const s = useSettings();
  const { store, images } = useLibrary();
  const [models, setModels] = useState<GeminiModel[] | null>(null);
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  async function detect() {
    setLoading(true);
    setError(undefined);
    try {
      setModels(await listModels());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (s.geminiKey && !models) void detect();
  }, [s.geminiKey]);

  const picked = models ? pickModels(models) : null;
  // In account mode the vectors stay in the database, so the model name is what says one exists.
  const stale = images.filter((i) => i.embeddingModel && i.embeddingModel !== s.models.embed);
  const missing = images.filter((i) => (i.status === 'ready' || i.isDemo) && !i.embeddingModel && !i.embedding?.length);

  return (
    <section id="models" className="set">
      <h2 className="set__title">Models</h2>
      <p>Models are read from your key’s model list, so new ones show up here without an update.</p>
      {!s.geminiKey ? (
        <p className="muted">Save a key first to see the models it can use.</p>
      ) : (
        <>
          {error && (
            <p className="notice notice--error" role="alert">
              {error}
            </p>
          )}
          <div className="set__grid">
            <ModelSelect
              label="Tagging and assistant"
              hint="Reads images and writes tags."
              value={s.models.generate}
              options={picked?.generate ?? []}
              onChange={(generate) => updateSettings({ models: { ...s.models, generate } })}
            />
            <ModelSelect
              label="Search embeddings"
              hint="Turns tags and queries into vectors for search by meaning."
              value={s.models.embed}
              options={picked?.embed ?? []}
              onChange={(embed) => updateSettings({ models: { ...s.models, embed } })}
            />
          </div>
          <label className="check set__fast">
            <input type="checkbox" checked={s.fastMode} onChange={(e) => updateSettings({ fastMode: e.target.checked })} />
            <span>
              Faster answers
              <span className="field__hint"> Turns the model’s thinking off or down. Replies come much sooner; tags and answers are usually just as good. Turn it off for slower, more considered design docs.</span>
            </span>
          </label>
          <div className="set__actions">
            <button type="button" className="btn btn--quiet" onClick={detect} disabled={loading}>
              {loading ? 'Checking…' : 'Refresh model list'}
            </button>
            {(stale.length > 0 || missing.length > 0) && (
              <button
                type="button"
                className="btn"
                onClick={() => enqueue(store, [...stale, ...missing].map((i) => i.id), 'embed')}
              >
                Update search index for {stale.length + missing.length} {stale.length + missing.length === 1 ? 'image' : 'images'}
              </button>
            )}
          </div>
          {stale.length > 0 && (
            <p className="field__hint">
              {stale.length} images were indexed with a different embedding model. Update the search index so search compares like with like.
            </p>
          )}
        </>
      )}
    </section>
  );
}

function ModelSelect({
  label,
  hint,
  value,
  options,
  onChange,
}: {
  label: string;
  hint: string;
  value?: string;
  options: GeminiModel[];
  onChange: (v: string) => void;
}) {
  const id = useId();
  const list = value && !options.some((o) => o.name === value) ? [{ name: value, displayName: value, methods: [] }, ...options] : options;
  return (
    <label className="field" htmlFor={id}>
      <span className="field__label">{label}</span>
      <select id={id} className="input" value={value ?? ''} onChange={(e) => onChange(e.target.value)} disabled={!list.length}>
        {!list.length && <option value="">Loading models…</option>}
        {list.map((m) => (
          <option key={m.name} value={m.name}>
            {m.displayName} ({m.name})
          </option>
        ))}
      </select>
      <span className="field__hint">{hint}</span>
    </label>
  );
}

/* ---------- Lenses ---------- */

const EMPTY_LENS = (): Lens => ({ id: `custom-${newId().slice(0, 8)}`, name: '', focus: '', groups: [{ key: '', label: '', hint: '' }], custom: true });

function LensesSection() {
  const s = useSettings();
  const [editing, setEditing] = useState<Lens | null>(null);
  const id = useId();

  function saveLens(lens: Lens) {
    const groups: TagGroupDef[] = lens.groups
      .filter((g) => g.label.trim())
      .map((g) => ({ key: slugKey(g.label), label: g.label.trim(), hint: g.hint.trim() || g.label.trim() }))
      .filter((g) => !BASE_GROUPS.some((b) => b.key === g.key));
    const clean = { ...lens, name: lens.name.trim(), focus: lens.focus.trim(), groups, custom: true };
    const others = s.customLenses.filter((l) => l.id !== lens.id);
    updateSettings({ customLenses: [...others, clean] });
    setEditing(null);
  }

  return (
    <section id="lenses" className="set">
      <h2 className="set__title">Lenses</h2>
      <p>
        A lens tells the AI what to look for when it tags an image. Every lens tags form, material, colour, mood and
        details. Each adds one or more groups of its own.
      </p>
      <label className="field" htmlFor={id}>
        <span className="field__label">Default lens for new images</span>
        <select id={id} className="input" value={s.defaultLensId} onChange={(e) => updateSettings({ defaultLensId: e.target.value })}>
          {[...BUILT_IN_LENSES, ...s.customLenses].map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </label>

      <h3 className="set__h3">Your lenses</h3>
      {s.customLenses.length === 0 && !editing && <p className="muted">No custom lenses yet. Create one for anything the built-in lenses miss, such as repairability or accessibility.</p>}
      <ul className="lens-list">
        {s.customLenses.map((l) => (
          <li key={l.id}>
            <div>
              <strong>{l.name}</strong>
              <p className="muted">{l.focus}</p>
              {l.groups.length > 0 && <p className="mono muted">{l.groups.map((g) => g.label).join(' · ')}</p>}
            </div>
            <div className="lens-list__actions">
              <button type="button" className="btn btn--quiet" onClick={() => setEditing(structuredClone(l))}>
                Edit
              </button>
              <button
                type="button"
                className="btn btn--quiet btn--danger-text"
                onClick={() =>
                  updateSettings({
                    customLenses: s.customLenses.filter((x) => x.id !== l.id),
                    defaultLensId: s.defaultLensId === l.id ? 'general' : s.defaultLensId,
                  })
                }
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>

      {editing ? (
        <LensEditor lens={editing} onCancel={() => setEditing(null)} onSave={saveLens} />
      ) : (
        <button type="button" className="btn" onClick={() => setEditing(EMPTY_LENS())}>
          New lens
        </button>
      )}
    </section>
  );
}

function LensEditor({ lens, onCancel, onSave }: { lens: Lens; onCancel: () => void; onSave: (l: Lens) => void }) {
  const [draft, setDraft] = useState(lens);
  const [error, setError] = useState<string>();
  const id = useId();

  function setGroup(i: number, patch: Partial<TagGroupDef>) {
    setDraft((d) => ({ ...d, groups: d.groups.map((g, j) => (j === i ? { ...g, ...patch } : g)) }));
  }

  return (
    <form
      className="lens-editor reg-frame"
      onSubmit={(e) => {
        e.preventDefault();
        if (!draft.name.trim()) return setError('Give the lens a name.');
        if (!draft.focus.trim()) return setError('Describe what the lens should look at.');
        onSave(draft);
      }}
    >
      <h3 className="set__h3">{lens.name ? `Edit “${lens.name}”` : 'New lens'}</h3>
      <label className="field" htmlFor={`${id}-n`}>
        <span className="field__label">Name</span>
        <input id={`${id}-n`} className="input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Repairability" />
      </label>
      <label className="field" htmlFor={`${id}-f`}>
        <span className="field__label">What should it look at?</span>
        <textarea
          id={`${id}-f`}
          className="input"
          rows={2}
          value={draft.focus}
          onChange={(e) => setDraft({ ...draft, focus: e.target.value })}
          placeholder="how the product is assembled, which parts can be opened, swapped or repaired"
        />
      </label>
      <fieldset className="field">
        <legend className="field__label">Extra tag groups</legend>
        {draft.groups.map((g, i) => (
          <div className="group-row" key={i}>
            <input className="input" value={g.label} onChange={(e) => setGroup(i, { label: e.target.value })} placeholder="Group name, e.g. Fasteners" aria-label={`Group ${i + 1} name`} />
            <input className="input" value={g.hint} onChange={(e) => setGroup(i, { hint: e.target.value })} placeholder="What to list, e.g. screws, clips, glue" aria-label={`Group ${i + 1} description`} />
            <button type="button" className="btn btn--quiet" onClick={() => setDraft({ ...draft, groups: draft.groups.filter((_, j) => j !== i) })} aria-label={`Remove group ${i + 1}`}>
              ×
            </button>
          </div>
        ))}
        <button type="button" className="linkbtn" onClick={() => setDraft({ ...draft, groups: [...draft.groups, { key: '', label: '', hint: '' }] })}>
          + Add a group
        </button>
      </fieldset>
      {error && (
        <p className="notice notice--error" role="alert">
          {error}
        </p>
      )}
      <div className="set__actions">
        <button type="submit" className="btn btn--primary">
          Save lens
        </button>
        <button type="button" className="btn btn--quiet" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

/* ---------- Data ---------- */

function DataSection() {
  const { store, images, boards } = useLibrary();
  const { email } = useAuth();
  const where = store.kind === 'cloud' ? `your account (${email})` : 'this browser';
  const [usage, setUsage] = useState<string>();
  const [busy, setBusy] = useState<string>();
  const [message, setMessage] = useState<{ ok: boolean; text: string }>();
  const [confirm, setConfirm] = useState(false);
  const [alsoSettings, setAlsoSettings] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    navigator.storage
      ?.estimate?.()
      .then((e) => e.usage != null && setUsage(`${(e.usage / 1024 / 1024).toFixed(1)} MB used${e.quota ? ` of about ${Math.round(e.quota / 1024 / 1024 / 1024)} GB available` : ''}`))
      .catch(() => undefined);
  }, [images.length]);

  async function doExport() {
    setMessage(undefined);
    setBusy('Preparing export…');
    try {
      const blob = await exportLibrary(store, (d, t) => setBusy(`Preparing export… ${d} of ${t}`));
      downloadBlob(blob, `design-shelf-${new Date().toISOString().slice(0, 10)}.json`);
      setMessage({ ok: true, text: `Exported ${images.length} images and ${boards.length} boards.` });
    } catch (err) {
      setMessage({ ok: false, text: `Export failed: ${(err as Error).message}` });
    } finally {
      setBusy(undefined);
    }
  }

  async function doImport(file: File) {
    setMessage(undefined);
    setBusy('Importing…');
    try {
      const r = await importLibrary(store, file);
      setMessage({
        ok: true,
        text: `Imported ${r.added} ${r.added === 1 ? 'image' : 'images'}${r.skipped ? `, skipped ${r.skipped} already on your shelf` : ''}, ${r.boards} ${r.boards === 1 ? 'board' : 'boards'} and ${r.docs} saved ${r.docs === 1 ? 'doc' : 'docs'}.`,
      });
    } catch (err) {
      setMessage({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(undefined);
    }
  }

  return (
    <section id="data" className="set">
      <h2 className="set__title">Your data</h2>
      <p>
        Your library is stored in {where}: {images.length} {images.length === 1 ? 'image' : 'images'} and {boards.length}{' '}
        {boards.length === 1 ? 'board' : 'boards'}
        {usage ? `, ${usage}` : ''}. Export it to keep a backup or move it to another browser.
      </p>
      <div className="set__actions">
        <button type="button" className="btn" onClick={doExport} disabled={Boolean(busy) || images.length === 0}>
          Export library
        </button>
        <button type="button" className="btn" onClick={() => fileRef.current?.click()} disabled={Boolean(busy)}>
          Import a backup
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) void doImport(f);
          }}
        />
      </div>
      {busy && (
        <p className="notice" role="status">
          <span className="spinner" aria-hidden="true" /> {busy}
        </p>
      )}
      {message && (
        <p className={`notice ${message.ok ? 'notice--ok' : 'notice--error'}`} role={message.ok ? 'status' : 'alert'}>
          {message.text}
        </p>
      )}

      <div className="set__danger">
        <h3 className="set__h3">Delete everything</h3>
        <p className="muted">Removes every image, board and saved doc from {where}. Export first if you might want them back.</p>
        <button type="button" className="btn btn--danger" onClick={() => setConfirm(true)}>
          Delete all data
        </button>
      </div>

      <ConfirmDialog
        open={confirm}
        title="Delete all data?"
        body={<p>This removes {images.length} images and {boards.length} boards from {where}. It can’t be undone.</p>}
        confirmLabel="Delete everything"
        danger
        typeToConfirm="delete"
        onClose={() => setConfirm(false)}
        onConfirm={async () => {
          setConfirm(false);
          try {
            forgetBlobUrls(images.map((i) => i.id));
            await store.clear();
            if (alsoSettings) clearSettings();
            setMessage({ ok: true, text: alsoSettings ? 'All data and settings deleted.' : 'All images and boards deleted. Your key and lenses are kept.' });
          } catch (err) {
            setMessage({ ok: false, text: `Could not delete: ${(err as Error).message}` });
          }
        }}
      >
        <label className="check">
          <input type="checkbox" checked={alsoSettings} onChange={(e) => setAlsoSettings(e.target.checked)} />
          Also remove my Gemini key, models and lenses
        </label>
      </ConfirmDialog>
    </section>
  );
}
