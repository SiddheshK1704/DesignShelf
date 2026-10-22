import { useAuth } from './AuthProvider';

export function AccountButton() {
  const { mode, email, openAuth, signOut } = useAuth();

  if (mode === 'signed-in') {
    return (
      <button type="button" className="nav__account" onClick={signOut} title={`Signed in as ${email}. Click to sign out.`}>
        <span className="nav__account-dot" aria-hidden="true" />
        <span className="nav__account-label">Sign out</span>
      </button>
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
