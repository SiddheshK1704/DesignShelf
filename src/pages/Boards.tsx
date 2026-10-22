import { useId, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ConfirmDialog } from '../components/Dialog';
import { ImageDialog } from '../components/library/ImageDialog';
import { ImageGrid } from '../components/library/ImageGrid';
import { useLibrary } from '../components/library/LibraryProvider';
import { useBlobUrl } from '../components/library/useBlobUrl';
import type { Board } from '../lib/types';
import { Placeholder } from './Placeholder';
import './app.css';

export function Boards() {
  const { store, boards, boardImages, loading } = useLibrary();
  const [name, setName] = useState('');
  const [error, setError] = useState<string>();
  const navigate = useNavigate();
  const id = useId();

  async function create(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      const b = await store.createBoard(name);
      setName('');
      navigate(`/boards/${b.id}`);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="page">
      <header className="page__head">
        <div>
          <h1 className="page__title">Boards</h1>
          <p className="muted">Group references by project, client or idea.</p>
        </div>
        <form className="inline-form" onSubmit={create}>
          <label htmlFor={id} className="visually-hidden">
            New board name
          </label>
          <input id={id} className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="New board name" />
          <button type="submit" className="btn btn--primary" disabled={!name.trim()}>
            Create board
          </button>
        </form>
      </header>
      {error && (
        <p className="notice notice--error" role="alert">
          {error}
        </p>
      )}

      {!loading && boards.length === 0 ? (
        <div className="empty reg-frame">
          <h2>No boards yet.</h2>
          <p>Name a board above, for example “Scooter refresh” or “Café fit-out”. Then open any image in the Library and tick the board to add it.</p>
          <div className="empty__actions">
            <Link to="/library" className="btn">
              Go to the library
            </Link>
          </div>
        </div>
      ) : (
        <ul className="boards">
          {boards.map((b) => (
            <li key={b.id}>
              <BoardCard board={b} imageIds={boardImages.filter((l) => l.boardId === b.id).sort((x, y) => y.addedAt - x.addedAt).map((l) => l.imageId)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function BoardCard({ board, imageIds }: { board: Board; imageIds: string[] }) {
  return (
    <Link to={`/boards/${board.id}`} className="board">
      <span className="board__cover" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <Cover key={i} id={imageIds[i]} />
        ))}
      </span>
      <span className="board__name">{board.name}</span>
      <span className="muted board__meta">
        {imageIds.length} {imageIds.length === 1 ? 'reference' : 'references'} · updated {new Date(board.updatedAt).toLocaleDateString()}
      </span>
    </Link>
  );
}

function Cover({ id }: { id?: string }) {
  const { store } = useLibrary();
  const url = useBlobUrl(store, id, 'thumb');
  return <span className="board__cell">{url && <img src={url} alt="" />}</span>;
}

export function BoardDetail() {
  const { boardId = '' } = useParams();
  const { store, boards, images, boardImages, loading } = useLibrary();
  const [params, setParams] = useSearchParams();
  const [confirm, setConfirm] = useState(false);
  const navigate = useNavigate();
  const board = boards.find((b) => b.id === boardId);

  if (loading) return null;
  if (!board) return <Placeholder title="Board not found" notFound />;

  const ids = new Set(boardImages.filter((l) => l.boardId === board.id).map((l) => l.imageId));
  const list = images.filter((i) => ids.has(i.id));
  const openId = params.get('image');

  return (
    <div className="page">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link to="/boards">Boards</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{board.name}</span>
      </nav>
      <header className="page__head">
        <div>
          <label htmlFor="board-name" className="visually-hidden">
            Board name
          </label>
          <input
            id="board-name"
            key={board.id}
            className="page__title page__title--input"
            defaultValue={board.name}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v && v !== board.name) void store.updateBoard(board.id, { name: v });
            }}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          />
          <p className="muted">
            {list.length} {list.length === 1 ? 'reference' : 'references'}. Click the name to rename the board.
          </p>
        </div>
        <div className="page__actions">
          <button type="button" className="btn btn--quiet btn--danger-text" onClick={() => setConfirm(true)}>
            Delete board
          </button>
        </div>
      </header>

      {list.length === 0 ? (
        <div className="empty reg-frame">
          <h2>This board is empty.</h2>
          <p>Open any image in the Library and tick “{board.name}” under Boards to add it here.</p>
          <div className="empty__actions">
            <Link to="/library" className="btn">
              Go to the library
            </Link>
          </div>
        </div>
      ) : (
        <ImageGrid images={list} store={store} onOpen={(id) => setParams({ image: id })} />
      )}

      <ImageDialog
        imageId={openId}
        order={list.map((i) => i.id)}
        onNavigate={(id) => setParams({ image: id }, { replace: true })}
        onClose={() => setParams({})}
      />

      <ConfirmDialog
        open={confirm}
        title={`Delete “${board.name}”?`}
        body={<p>The board is removed. Its images stay in your library.</p>}
        confirmLabel="Delete board"
        danger
        onClose={() => setConfirm(false)}
        onConfirm={async () => {
          setConfirm(false);
          await store.deleteBoard(board.id);
          navigate('/boards');
        }}
      />
    </div>
  );
}
