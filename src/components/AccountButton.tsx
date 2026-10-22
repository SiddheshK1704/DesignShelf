import { useState } from 'react';
import { useIngest } from '../lib/ingest';
import { useAuth } from './AuthProvider';
import { ConfirmDialog } from './Dialog';

export function AccountButton() {
  const { mode, email, openAuth, signOut } = useAuth();
  const ingest = useIngest();
  const [confirming, setConfirming] = useState(false);

  if (mode === 'signed-in') {
    const working = ingest.phase !== 'idle';
    return (
      <>
        <button type="button" className="nav__account" onClick={() => setConfirming(true)} title={`Signed in as ${email}`}>
          <span className="nav__account-dot" aria-hidden="true" />
          <span className="nav__account-label">Sign out</span>
        </button>
        <ConfirmDialog
          open={confirming}
          title="Sign out?"
          body={
            <>
              <p>
                You’re signed in as <strong>{email}</strong>. Your library stays safe in your account, and you can sign
                back in any time with your email and password.
              </p>
              {working && (
                <p className="notice notice--error">
                  Images are still being uploaded or tagged. Signing out now stops that; anything unfinished can be
                  tagged again after you sign back in.
                </p>
              )}
            </>
          }
          confirmLabel="Sign out"
          onClose={() => setConfirming(false)}
          onConfirm={async () => {
            setConfirming(false);
            await signOut();
          }}
        />
      </>
    );
  }

  if (mode === 'local') {
    return (
      <button
        type="button"
        className="nav__account"
        onClick={() => openAuth('sign-up')}
        title="Your library is stored in this browser. Create an account to sync it."
      >
        <span className="nav__account-dot nav__account-dot--local" aria-hidden="true" />
        <span className="nav__account-label">Local</span>
        <span className="visually-hidden">library. Create an account</span>
      </button>
    );
  }

  return (
    <button type="button" className="nav__account" onClick={() => openAuth('sign-in')}>
      <span className="nav__account-label">Sign in</span>
    </button>
  );
}
