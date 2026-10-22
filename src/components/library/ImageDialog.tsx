import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import { enqueue, retag } from '../../lib/ingest';
import { groupLabel, groupsFor } from '../../lib/lenses';
import { similarTo } from '../../lib/search';
import { allLenses, findLens, useSettings } from '../../lib/settings';
import type { ImageRecord } from '../../lib/types';
import { ConfirmDialog, Dialog } from '../Dialog';
import { Swatch } from '../Swatch';
import { useLibrary } from './LibraryProvider';
import { forgetBlobUrls, useBlobUrl } from './useBlobUrl';

interface Props {
  imageId: string | null;
  /** The list the image was opened from, for previous / next. */
  order: string[];
  onNavigate: (id: string) => void;
  onClose: () => void;
}

export function ImageDialog({ imageId, order, onNavigate, onClose }: Props) {
  const { images } = useLibrary();
  const image = images.find((i) => i.id === imageId);

  // If the image disappears (deleted), close.
  useEffect(() => {
    if (imageId && images.length && !image) onClose();
  }, [imageId, image, images.length, onClose]);

  const idx = image ? order.indexOf(image.id) : -1;
  const prev = idx > 0 ? order[idx - 1] : undefined;
  const next = idx >= 0 && idx < order.length - 1 ? order[idx + 1] : undefined;

  function onKey(e: KeyboardEvent) {
    const t = e.target as HTMLElement;
    if (t.closest('input, textarea, select, [contenteditable]')) return;
    if (e.key === 'ArrowLeft' && prev) onNavigate(prev);
    if (e.key === 'ArrowRight' && next) onNavigate(next);
  }

  return (
    <Dialog open={Boolean(image)} onClose={onClose} title={image ? image.subject || image.name : 'Image'} hideTitle size="xl" className="idlg">
      {image && (
        <div className="idlg__wrap" onKeyDown={onKey}>
          <Detail key={image.id} image={image} onNavigate={onNavigate} onClose={onClose} />
          <div className="idlg__pager">
            <button type="button" className="btn btn--quiet" disabled={!prev} onClick={() => prev && onNavigate(prev)}>
              ← Previous
            </button>
            <span className="muted mono">
              {idx + 1} / {order.length}
            </span>
            <button type="button" className="btn btn--quiet" disabled={!next} onClick={() => next && onNavigate(next)}>
              Next →
            </button>
          </div>
        </div>
      )}
    </Dialog>
  );
}

function Detail({ image, onNavigate, onClose }: { image: ImageRecord; onNavigate: (id: string) => void; onClose: () => void }) {
  const { store, images, boards, boardImages } = useLibrary();
  const settings = useSettings();
  const lenses = allLenses(settings);
  const lens = findLens(image.lensId, settings);
  const url = useBlobUrl(store, image.id, 'full');
  const [lensChoice, setLensChoice] = useState(image.lensId);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string>();
  const edited = useRef(false);
  const uid = useId();

  // After tag edits, refresh the embedding once the dialog moves on.
  useEffect(
    () => () => {
      if (edited.current && settings.geminiKey) enqueue(store, [image.id], 'embed');
    },
    [],
  );

  async function save(patch: Partial<ImageRecord>, tagsChanged = false) {
    try {
      await store.updateImage(image.id, patch);
      if (tagsChanged) edited.current = true;
      setError(undefined);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const groupKeys = [...new Set([...groupsFor(lens).map((g) => g.key), ...Object.keys(image.tags)])];
  const onBoards = new Set(boardImages.filter((l) => l.imageId === image.id).map((l) => l.boardId));
  const similar = similarTo(image, images, 6);

  return (
    <div className="idlg__grid">
      <div className="idlg__media">
        <div className="idlg__frame" style={{ aspectRatio: `${image.width} / ${image.height}` }}>
          {url && <img src={url} alt={image.subject || image.name} />}
        </div>
        <p className="mono muted">
          {image.width} × {image.height} · added {new Date(image.createdAt).toLocaleDateString()}
        </p>
      </div>

      <div className="idlg__side">
        <label className="visually-hidden" htmlFor={`${uid}-name`}>
          Name
        </label>
        <input
          id={`${uid}-name`}
          className="idlg__name"
          defaultValue={image.name}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v && v !== image.name) void save({ name: v });
          }}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        />
        {image.subject && image.subject !== image.name && <p className="muted">{image.subject}</p>}

        <StatusLine image={image} hasKey={Boolean(settings.geminiKey)} onRetry={() => retag(store, image.id)} />
        {error && (
          <p className="notice notice--error" role="alert">
            {error}
          </p>
        )}

        <section className="idlg__sec">
          <h3 className="idlg__h">Description</h3>
          <textarea
            className="input idlg__desc"
            defaultValue={image.description ?? ''}
            placeholder={settings.geminiKey ? 'Tagging writes a short description here.' : 'Write what you notice in this image.'}
            rows={4}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v !== (image.description ?? '')) void save({ description: v }, true);
            }}
          />
        </section>

        <section className="idlg__sec">
          <h3 className="idlg__h">Tags</h3>
          <div className="idlg__groups">
            {groupKeys.map((key) => (
              <TagGroup
                key={key}
                label={groupLabel(key, lenses)}
                tags={image.tags[key] ?? []}
                onChange={(tags) => save({ tags: { ...image.tags, [key]: tags } }, true)}
              />
            ))}
            <TagGroup label="Your tags" tags={image.customTags} onChange={(customTags) => save({ customTags }, true)} />
          </div>
        </section>

        {image.swatches.length > 0 && (
          <section className="idlg__sec">
            <h3 className="idlg__h">Palette</h3>
            <div className="idlg__palette">
              {image.swatches.map((c, i) => (
                <Swatch key={`${c}-${i}`} hex={c} size="sm" />
              ))}
            </div>
          </section>
        )}

        <section className="idlg__sec">
          <h3 className="idlg__h">Boards</h3>
          <BoardList imageId={image.id} onBoards={onBoards} boardNames={boards} />
        </section>

        <section className="idlg__sec">
          <h3 className="idlg__h">Lens</h3>
          <div className="idlg__lens">
            <label className="visually-hidden" htmlFor={`${uid}-lens`}>
              Lens
            </label>
            <select id={`${uid}-lens`} className="input" value={lensChoice} onChange={(e) => setLensChoice(e.target.value)}>
              {lenses.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn btn--quiet"
              disabled={!settings.geminiKey || image.status === 'tagging' || image.status === 'pending'}
              onClick={() => retag(store, image.id, lensChoice)}
            >
              Tag again
            </button>
          </div>
          {!settings.geminiKey && (
            <p className="field__hint">
              <Link to="/settings">Add a Gemini key</Link> to tag with a lens.
            </p>
          )}
        </section>

        {image.source && (image.source.credit || image.source.url) && (
          <section className="idlg__sec">
            <h3 className="idlg__h">Source</h3>
            <p className="mono muted">
              {[image.source.credit, image.source.licence, image.source.provider].filter(Boolean).join(' · ')}
            </p>
            {image.source.url && (
              <a href={image.source.url} target="_blank" rel="noopener noreferrer">
                View source
              </a>
            )}
          </section>
        )}

        {similar.length > 0 && (
          <section className="idlg__sec">
            <h3 className="idlg__h">Similar on your shelf</h3>
            <ul className="idlg__similar">
              {similar.map((s) => (
                <li key={s.id}>
                  <SimilarThumb image={s} onOpen={() => onNavigate(s.id)} />
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="idlg__danger">
          <button type="button" className="btn btn--quiet btn--danger-text" onClick={() => setConfirmDelete(true)}>
            Delete image
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete image?"
        body={<p>It will be removed from your library and from every board. This can’t be undone.</p>}
        confirmLabel="Delete"
        danger
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => {
          setConfirmDelete(false);
          await store.deleteImages([image.id]);
          forgetBlobUrls([image.id]);
          onClose();
        }}
      />
    </div>
  );
}

function StatusLine({ image, hasKey, onRetry }: { image: ImageRecord; hasKey: boolean; onRetry: () => void }) {
  if (image.status === 'ready') return null;
  if (image.status === 'pending' || image.status === 'tagging') {
    return (
      <p className="notice">
        <span className="spinner" aria-hidden="true" /> {image.status === 'pending' ? 'Waiting to be tagged.' : 'Tagging now…'}
      </p>
    );
  }
  return (
    <div className={`notice ${image.status === 'error' ? 'notice--error' : ''}`}>
      <p>
        {image.status === 'error'
          ? `Tagging failed: ${image.error ?? 'unknown error.'}`
          : hasKey
            ? 'This image has no AI tags yet.'
            : 'This image has no AI tags. Add a Gemini key in Settings to tag it.'}
      </p>
      {hasKey ? (
        <button type="button" className="btn btn--quiet" onClick={onRetry}>
          {image.status === 'error' ? 'Try again' : 'Tag now'}
        </button>
      ) : (
        <Link to="/settings" className="btn btn--quiet">
          Open Settings
        </Link>
      )}
    </div>
  );
}

function TagGroup({ label, tags, onChange }: { label: string; tags: string[]; onChange: (tags: string[]) => void }) {
  const [draft, setDraft] = useState('');
  const id = useId();

  function add() {
    const t = draft.trim().toLowerCase();
    setDraft('');
    if (t && !tags.includes(t)) onChange([...tags, t]);
  }

  return (
    <div className="tg">
      <span className="tg__label" id={`${id}-l`}>
        {label}
      </span>
      <ul className="tg__list" aria-labelledby={`${id}-l`}>
        {tags.map((t) => (
          <li key={t} className="chip">
            {t}
            <button type="button" onClick={() => onChange(tags.filter((x) => x !== t))} aria-label={`Remove ${t}`}>
              ×
            </button>
          </li>
        ))}
        <li>
          <input
            className="tg__add"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                add();
              }
            }}
            onBlur={add}
            placeholder="+ add"
            aria-label={`Add a tag to ${label}`}
          />
        </li>
      </ul>
    </div>
  );
}

function BoardList({ imageId, onBoards, boardNames }: { imageId: string; onBoards: Set<string>; boardNames: { id: string; name: string }[] }) {
  const { store } = useLibrary();
  const [name, setName] = useState('');
  const id = useId();

  return (
    <div className="idlg__boards">
      {boardNames.length === 0 && <p className="muted">No boards yet. Name one below to create it and add this image.</p>}
      <ul>
        {boardNames.map((b) => (
          <li key={b.id}>
            <label className="check">
              <input
                type="checkbox"
                checked={onBoards.has(b.id)}
                onChange={(e) =>
                  e.target.checked ? store.addToBoard(b.id, [imageId]) : store.removeFromBoard(b.id, [imageId])
                }
              />
              {b.name}
            </label>
          </li>
        ))}
      </ul>
      <form
        className="idlg__newboard"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!name.trim()) return;
          const board = await store.createBoard(name);
          await store.addToBoard(board.id, [imageId]);
          setName('');
        }}
      >
        <label className="visually-hidden" htmlFor={id}>
          New board name
        </label>
        <input id={id} className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="New board" />
        <button type="submit" className="btn btn--quiet" disabled={!name.trim()}>
          Create and add
        </button>
      </form>
    </div>
  );
}

function SimilarThumb({ image, onOpen }: { image: ImageRecord; onOpen: () => void }) {
  const { store } = useLibrary();
  const url = useBlobUrl(store, image.id, 'thumb');
  return (
    <button type="button" className="idlg__sim" onClick={onOpen} title={image.subject || image.name}>
      {url && <img src={url} alt="" />}
      <span className="visually-hidden">Open {image.subject || image.name}</span>
    </button>
  );
}
