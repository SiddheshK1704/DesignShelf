import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { fileName, pickReferences, toMarkdown, vocabulary, writeDoc, type Stage } from '../../lib/designDoc';
import { ACCEPTED_TYPES, toAiImage } from '../../lib/image';
import { downloadBlob } from '../../lib/portable';
import { allLenses, findLens, useSettings } from '../../lib/settings';
import { newId, type SavedDoc } from '../../lib/types';
import { ConfirmDialog } from '../Dialog';
import { ImageDialog } from '../library/ImageDialog';
import { useLibrary } from '../library/LibraryProvider';
import { DocView } from './DocView';

const STAGE_TEXT: Record<Stage, string> = {
  writing: 'Writing the doc…',
  checking: 'Checking the diagram…',
  repairing: 'The diagram didn’t parse. Asking Gemini to fix it…',
  references: 'Gathering references from your shelf…',
};

const MAX_UPLOADS = 4;

export function DocPanel() {
  const { store, images, boards, boardImages } = useLibrary();
  const settings = useSettings();
  const lenses = allLenses(settings);
  const uid = useId();

  const [brief, setBrief] = useState('');
  const [lensId, setLensId] = useState(settings.defaultLensId);
  const [boardId, setBoardId] = useState('');
  const [uploads, setUploads] = useState<{ file: File; url: string }[]>([]);
  const [uploadNote, setUploadNote] = useState<string>();
  const fileRef = useRef<HTMLInputElement>(null);

  const [stage, setStage] = useState<Stage | null>(null);
  const [waitUntil, setWaitUntil] = useState<number>();
  const [error, setError] = useState<string>();
  const [current, setCurrent] = useState<{ saved: SavedDoc; isSaved: boolean } | null>(null);
  const [docs, setDocs] = useState<SavedDoc[]>([]);
  const [action, setAction] = useState<string>();
  const [confirmDelete, setConfirmDelete] = useState<SavedDoc | null>(null);
  const [open, setOpen] = useState<{ id: string; order: string[] } | null>(null);
  const docRef = useRef<HTMLDivElement>(null);

  // Tick the rate-limit countdown.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!waitUntil) return;
    const t = setInterval(() => setTick((n) => n + 1), 500);
    return () => clearInterval(t);
  }, [waitUntil]);

  // Saved docs, kept fresh when the store changes.
  useEffect(() => {
    const load = () => store.listDocs().then(setDocs).catch(() => undefined);
    load();
    return store.subscribe(load);
  }, [store]);

  function addUploads(list: File[]) {
    const imgs = list.filter((f) => ACCEPTED_TYPES.includes(f.type));
    const room = MAX_UPLOADS - uploads.length;
    setUploadNote(imgs.length > room ? `You can attach up to ${MAX_UPLOADS} images.` : list.length && !imgs.length ? 'Only JPEG, PNG, WebP, GIF or AVIF images can be attached.' : undefined);
    setUploads((u) => [...u, ...imgs.slice(0, Math.max(0, room)).map((file) => ({ file, url: URL.createObjectURL(file) }))]);
  }

  async function generate(e: FormEvent) {
    e.preventDefault();
    if (brief.trim().length < 20) {
      setError('Write a little more in the brief: what it is, who it’s for, and how it should feel.');
      return;
    }
    setError(undefined);
    setAction(undefined);
    try {
      const lens = findLens(lensId, settings);
      const board = boards.find((b) => b.id === boardId);
      const boardIds = board ? boardImages.filter((l) => l.boardId === board.id).sort((a, b) => b.addedAt - a.addedAt).map((l) => l.imageId) : [];
      const boardRecords = boardIds.map((id) => images.find((i) => i.id === id)).filter((i): i is NonNullable<typeof i> => Boolean(i));

      setStage('writing');
      const inlineUploads = await Promise.all(uploads.map((u) => toAiImage(u.file)));
      // Up to four board images go along as pictures, the rest as text notes.
      const boardInline = (
        await Promise.all(boardRecords.slice(0, 4).map(async (r) => {
          const blob = await store.getBlob(r.id, 'thumb');
          return blob ? toAiImage(blob) : null;
        }))
      ).filter((x): x is NonNullable<typeof x> => Boolean(x));

      const { doc, diagram } = await writeDoc(
        {
          brief,
          lens,
          uploads: inlineUploads,
          board: board ? { name: board.name, images: boardRecords, inline: boardInline } : undefined,
          vocabulary: vocabulary(images),
        },
        setStage,
        (ms) => setWaitUntil(Date.now() + ms),
      );
      setStage('references');
      const shelfIds = await pickReferences(images, brief, doc, boardRecords.map((r) => r.id), Boolean(settings.geminiKey), store);
      const now = Date.now();
      setCurrent({
        saved: { id: newId(), title: doc.title, brief: brief.trim(), lensId, boardId: board?.id, doc, shelfIds, diagram, createdAt: now, updatedAt: now },
        isSaved: false,
      });
      requestAnimationFrame(() => docRef.current?.scrollIntoView({ block: 'start' }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setStage(null);
      setWaitUntil(undefined);
    }
  }

  const shelf = current ? current.saved.shelfIds.map((id) => images.find((i) => i.id === id)).filter((i): i is NonNullable<typeof i> => Boolean(i)) : [];
  const lensName = current ? findLens(current.saved.lensId, settings).name : '';
  const boardName = current?.saved.boardId ? boards.find((b) => b.id === current.saved.boardId)?.name : undefined;

  async function markdown() {
    return current ? toMarkdown(current.saved, shelf, lensName, boardName) : '';
  }

  async function doDownload() {
    if (!current) return;
    setAction('Preparing the file…');
    const md = await markdown();
    downloadBlob(new Blob([md], { type: 'text/markdown;charset=utf-8' }), fileName(current.saved.doc.title));
    setAction('Downloaded as Markdown.');
  }

  async function doCopy() {
    try {
      await navigator.clipboard.writeText(await markdown());
      setAction('Markdown copied to the clipboard.');
    } catch {
      setAction('Copying was blocked by the browser. Use Download instead.');
    }
  }

  async function doSave() {
    if (!current) return;
    try {
      await store.saveDoc(current.saved);
      setCurrent({ ...current, isSaved: true });
      setAction('Saved. It’s listed under Saved docs.');
    } catch (err) {
      setAction(`Could not save: ${(err as Error).message}`);
    }
  }

  const busy = stage !== null;
  const waitSecs = waitUntil ? Math.max(0, Math.ceil((waitUntil - Date.now()) / 1000)) : 0;

  return (
    <div className="docmode">
      <div className="docmode__top">
        <form className="docform reg-frame" onSubmit={generate}>
          <h2 className="ask__h">Turn a brief into a design doc.</h2>
          <label className="field" htmlFor={`${uid}-brief`}>
            <span className="field__label">Brief</span>
            <textarea
              id={`${uid}-brief`}
              className="input docform__brief"
              rows={6}
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              placeholder="An electric scooter dashboard for city couriers. It should feel rugged but premium, work with gloves, and stay readable at night."
            />
          </label>
          <div className="docform__row">
            <label className="field" htmlFor={`${uid}-lens`}>
              <span className="field__label">Discipline lens</span>
              <select id={`${uid}-lens`} className="input" value={lensId} onChange={(e) => setLensId(e.target.value)}>
                {lenses.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field" htmlFor={`${uid}-board`}>
              <span className="field__label">References from a board (optional)</span>
              <select id={`${uid}-board`} className="input" value={boardId} onChange={(e) => setBoardId(e.target.value)}>
                <option value="">None</option>
                {boards.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({boardImages.filter((l) => l.boardId === b.id).length})
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="field">
            <span className="field__label">Images (optional)</span>
            <div className="docform__uploads">
              {uploads.map((u, i) => (
                <span key={u.url} className="docform__thumb">
                  <img src={u.url} alt={u.file.name} />
                  <button
                    type="button"
                    aria-label={`Remove ${u.file.name}`}
                    onClick={() => {
                      URL.revokeObjectURL(u.url);
                      setUploads((all) => all.filter((_, j) => j !== i));
                    }}
                  >
                    ×
                  </button>
                </span>
              ))}
              <button type="button" className="btn btn--quiet" onClick={() => fileRef.current?.click()} disabled={uploads.length >= MAX_UPLOADS}>
                Add images
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(e) => {
                  addUploads([...(e.target.files ?? [])]);
                  e.target.value = '';
                }}
              />
            </div>
            {uploadNote && <span className="field__hint">{uploadNote}</span>}
          </div>

          {!settings.geminiKey && (
            <p className="notice">
              Design docs are written by Gemini with your key. <Link to="/settings#key">Add it in Settings</Link>.
            </p>
          )}
          {error && (
            <p className="notice notice--error" role="alert">
              {error}
            </p>
          )}
          <div className="docform__actions">
            <button type="submit" className="btn btn--primary" disabled={busy || !settings.geminiKey}>
              {busy ? 'Writing…' : 'Write the design doc'}
            </button>
            {busy && (
              <span className="docform__stage" role="status">
                <span className="spinner" aria-hidden="true" /> {waitSecs ? `Gemini asked us to slow down. Trying again in ${waitSecs}s.` : stage ? STAGE_TEXT[stage] : ''}
              </span>
            )}
          </div>
        </form>

        <aside className="docsaved" aria-label="Saved docs">
          <h2 className="rail__title">Saved docs</h2>
          {docs.length === 0 ? (
            <p className="muted">Docs you save appear here, so you can open them again later.</p>
          ) : (
            <ul>
              {docs.map((d) => (
                <li key={d.id} className={current?.saved.id === d.id ? 'is-current' : ''}>
                  <button
                    type="button"
                    className="docsaved__open"
                    onClick={() => {
                      setCurrent({ saved: d, isSaved: true });
                      setAction(undefined);
                      requestAnimationFrame(() => docRef.current?.scrollIntoView({ block: 'start' }));
                    }}
                  >
                    <span>{d.title}</span>
                    <span className="muted">{new Date(d.updatedAt).toLocaleDateString()}</span>
                  </button>
                  <button type="button" className="docsaved__del" aria-label={`Delete ${d.title}`} onClick={() => setConfirmDelete(d)}>
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>

      {current && (
        <div ref={docRef} className="docwrap">
          <div className="doc__toolbar" role="toolbar" aria-label="Design doc actions">
            <button type="button" className="btn btn--primary" onClick={doDownload}>
              Download .md
            </button>
            <button type="button" className="btn btn--quiet" onClick={doCopy}>
              Copy Markdown
            </button>
            <button type="button" className="btn btn--quiet" onClick={() => window.print()}>
              Print or save as PDF
            </button>
            <button type="button" className="btn btn--quiet" onClick={doSave} disabled={current.isSaved}>
              {current.isSaved ? 'Saved' : 'Save doc'}
            </button>
            {action && (
              <span className="doc__action" role="status">
                {action}
              </span>
            )}
          </div>
          <DocView
            saved={current.saved}
            shelf={shelf}
            lensName={lensName}
            boardName={boardName}
            libraryEmpty={images.length === 0}
            onOpenImage={(id, order) => setOpen({ id, order })}
          />
        </div>
      )}

      <ImageDialog
        imageId={open?.id ?? null}
        order={open?.order ?? []}
        onNavigate={(id) => setOpen((o) => (o ? { ...o, id } : o))}
        onClose={() => setOpen(null)}
      />

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title="Delete saved doc?"
        body={<p>“{confirmDelete?.title}” will be removed from your saved docs. This can’t be undone.</p>}
        confirmLabel="Delete"
        danger
        onClose={() => setConfirmDelete(null)}
        onConfirm={async () => {
          const d = confirmDelete;
          setConfirmDelete(null);
          if (!d) return;
          await store.deleteDoc(d.id);
          if (current?.saved.id === d.id) setCurrent({ ...current, isSaved: false });
        }}
      />
    </div>
  );
}
