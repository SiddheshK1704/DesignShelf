import { useEffect, useId, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../components/AuthProvider';
import { AuthError, MIN_PASSWORD, updatePassword, validateNewPassword } from '../lib/auth';
import { supabase } from '../lib/supabase';
import './app.css';

/**
 * Where the password-reset email lands. Supabase signs the user in from the
 * link (a short-lived recovery session); this page sets the new password.
 */
export function ResetPassword() {
  const { mode, ready, openAuth } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [state, setState] = useState<{ kind: 'idle' | 'busy' | 'done' } | { kind: 'error'; message: string }>({ kind: 'idle' });
  const [linkError, setLinkError] = useState<string>();
  const id = useId();

  // Supabase reports expired or reused links in the URL.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search + window.location.hash.replace(/^#/, '&'));
    const desc = params.get('error_description');
    if (desc) setLinkError(desc.replace(/\+/g, ' '));
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const problem = validateNewPassword(password);
    if (problem) return setState({ kind: 'error', message: problem });
    setState({ kind: 'busy' });
    try {
      await updatePassword(password);
      setPassword('');
      setState({ kind: 'done' });
      setTimeout(() => navigate('/library'), 1500);
    } catch (err) {
      setState({ kind: 'error', message: err instanceof AuthError ? err.message : 'The password could not be changed. Try again.' });
    }
  }

  const waiting = !ready;
  const noSession = ready && mode !== 'signed-in';

  return (
    <div className="page page--narrow">
      <header className="page__head">
        <div>
          <h1 className="page__title">Set a new password</h1>
          <p className="muted">Choose a password you don’t use anywhere else.</p>
        </div>
      </header>

      {!supabase ? (
        <p className="notice">Accounts are not connected in this build.</p>
      ) : waiting ? (
        <p className="notice" role="status">
          <span className="spinner" aria-hidden="true" /> Checking your reset link…
        </p>
      ) : noSession ? (
        <div className="empty reg-frame">
          <h2>This link has expired or was already used.</h2>
          <p>{linkError ? `Supabase said: ${linkError}. ` : ''}Reset links work once and expire after a while. Ask for a new one from the sign-in dialog.</p>
          <div className="empty__actions">
            <button type="button" className="btn btn--primary" onClick={() => openAuth('sign-in')}>
              Open sign in
            </button>
          </div>
        </div>
      ) : state.kind === 'done' ? (
        <p className="notice notice--ok" role="status">
          Password changed. Taking you to your library…
        </p>
      ) : (
        <form className="set__form" onSubmit={onSubmit} noValidate>
          <label className="field" htmlFor={id}>
            <span className="field__label">New password</span>
            <span className="input-row">
              <input
                id={id}
                className="input"
                type={show ? 'text' : 'password'}
                autoComplete="new-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (state.kind === 'error') setState({ kind: 'idle' });
                }}
                aria-invalid={state.kind === 'error' || undefined}
              />
              <button type="button" className="btn btn--quiet" aria-pressed={show} onClick={() => setShow((v) => !v)}>
                {show ? 'Hide' : 'Show'}
              </button>
            </span>
            <span className="field__hint">At least {MIN_PASSWORD} characters.</span>
          </label>
          {state.kind === 'error' && (
            <p className="notice notice--error" role="alert">
              {state.message}
            </p>
          )}
          <div className="set__actions">
            <button type="submit" className="btn btn--primary" disabled={state.kind === 'busy'}>
              {state.kind === 'busy' ? 'Saving…' : 'Save new password'}
            </button>
            <Link to="/library" className="btn btn--quiet">
              Cancel
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}
