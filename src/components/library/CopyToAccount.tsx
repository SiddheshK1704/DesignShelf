import { useEffect, useState } from 'react';
import { copyLibrary, type CopyResult } from '../../lib/portable';
import { useAuth } from '../AuthProvider';
import { ConfirmDialog } from '../Dialog';
import { useLibrary } from './LibraryProvider';

const dismissKey = (userId: string) => `designshelf.copyDismissed.${userId}`;

/**
 * Shown when signed in and this browser still holds references the account
 * doesn't have. Copies them across; the browser's copy can then be cleared.
 */
export function CopyToAccount() {
  const { store, localStore, images } = useLibrary();
  const { mode, userId, email } = useAuth();
  const [pending, setPending] = useState(0);
  const [state, setState] = useState<{ kind: 'idle' } | { kind: 'copying'; done: number; total: number } | { kind: 'done'; result: CopyResult }>({ kind: 'idle' });
  const [dismissed, setDismissed] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const active = mode === 'signed-in' && store.kind === 'cloud' && Boolean(userId);

  useEffect(() => {
    if (!active || !userId) return;
    try {
      setDismissed(localStorage.getItem(dismissKey(userId)) === '1');
    } catch {
      setDismissed(false);
    }
    const inAccount = new Set(images.map((i) => i.id));
    localStore
      .listImages()
      .then((local) => setPending(local.filter((i) => !inAccount.has(i.id)).length))
      .catch(() => setPending(0));
  }, [active, userId, images, localStore]);

  if (!active || dismissed) return null;
  if (state.kind === 'idle' && pending === 0) return null;

  async function copy() {
    setState({ kind: 'copying', done: 0, total: pending });
    const result = await copyLibrary(localStore, store, (done, total) => setState({ kind: 'copying', done, total }));
    setState({ kind: 'done', result });
  }

  function dismiss() {
    try {
      if (userId) localStorage.setItem(dismissKey(userId), '1');
    } catch {
      // Storage blocked: hide for this visit only.
    }
    setDismissed(true);
  }

  return (
    <div className="copybar" role="region" aria-label="Copy this browser’s library to your account">
      {state.kind === 'idle' && (
        <>
          <p>
            <strong>
              {pending} {pending === 1 ? 'reference is' : 'references are'} stored only in this browser.
            </strong>{' '}
            Copy {pending === 1 ? 'it' : 'them'} to your account ({email}) to see {pending === 1 ? 'it' : 'them'} on any device. Boards and saved docs come too.
          </p>
          <div className="copybar__actions">
            <button type="button" className="btn btn--primary" onClick={copy}>
              Copy to my account
            </button>
            <button type="button" className="btn btn--quiet" onClick={dismiss}>
              Not now
            </button>
          </div>
        </>
      )}
      {state.kind === 'copying' && (
        <div className="ingest" role="status" aria-live="polite">
          <span>
            Copying {Math.min(state.done + 1, state.total)} of {state.total}… Keep this tab open.
          </span>
          <div className="ingest__bar" role="progressbar" aria-valuemin={0} aria-valuemax={state.total} aria-valuenow={state.done} aria-label="Copy progress">
            <span style={{ width: `${state.total ? (state.done / state.total) * 100 : 100}%` }} />
          </div>
        </div>
      )}
      {state.kind === 'done' && (
        <>
          <p role="status">
            Copied {state.result.copied} {state.result.copied === 1 ? 'reference' : 'references'}
            {state.result.boards ? `, ${state.result.boards} ${state.result.boards === 1 ? 'board' : 'boards'}` : ''}
            {state.result.docs ? ` and ${state.result.docs} saved ${state.result.docs === 1 ? 'doc' : 'docs'}` : ''} to your account.
            {state.result.failed.length > 0 && ` ${state.result.failed.length} could not be copied: ${state.result.failed[0].message}`}
          </p>
          <div className="copybar__actions">
            {state.result.failed.length === 0 && (
              <button type="button" className="btn btn--quiet" onClick={() => setConfirmClear(true)}>
                Remove the copy from this browser
              </button>
            )}
            {state.result.failed.length > 0 && (
              <button type="button" className="btn" onClick={copy}>
                Try the rest again
              </button>
            )}
            <button type="button" className="btn btn--quiet" onClick={dismiss}>
              Done
            </button>
          </div>
        </>
      )}

      <ConfirmDialog
        open={confirmClear}
        title="Remove the browser copy?"
        body={<p>Everything is now in your account. This removes the copy stored in this browser only; your account keeps everything.</p>}
        confirmLabel="Remove browser copy"
        danger
        onClose={() => setConfirmClear(false)}
        onConfirm={async () => {
          setConfirmClear(false);
          await localStore.clear();
          dismiss();
        }}
      />
    </div>
  );
}
