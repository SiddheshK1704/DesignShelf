import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import {
  AuthError,
  isAccountsConfigured,
  MIN_PASSWORD,
  resendConfirmation,
  sendPasswordReset,
  signInWithPassword,
  signUpWithPassword,
  validateEmail,
  validateNewPassword,
} from '../lib/auth';
import './AuthDialog.css';

export type AuthTab = 'sign-in' | 'sign-up';
type View = AuthTab | 'reset';

type Status =
  | { kind: 'idle' }
  | { kind: 'busy' }
  | { kind: 'error'; message: string; code?: AuthError['code']; field?: 'email' | 'password' }
  /** Sign-up done; the confirmation email is on its way. */
  | { kind: 'confirm'; email: string; resent?: boolean }
  /** Password reset email sent. */
  | { kind: 'reset-sent'; email: string };

interface Props {
  open: boolean;
  initialTab: AuthTab;
  isLocal: boolean;
  onClose: () => void;
  onContinueLocally: () => void;
}

// Abstract stand-ins for references: flat shapes on flat colour, three swatches each.
const SHEET = [
  { name: 'Stoneware cup', ratio: '4 / 5', variant: 'circle', swatches: ['#2A3540', '#C9B79C', '#8C7A62'] },
  { name: 'Night cluster UI', ratio: '1 / 1', variant: 'stripes', swatches: ['#141B1A', '#3F7A6E', '#E3A94A'] },
  { name: 'Walnut console', ratio: '3 / 4', variant: 'bar', swatches: ['#D8D2C4', '#5A3E2B', '#1D1F22'] },
  { name: 'Brushed aluminium', ratio: '1 / 1', variant: 'disc', swatches: ['#B9C0C7', '#7D858E', '#E9EAEC'] },
  { name: 'Saddle leather', ratio: '4 / 5', variant: 'arc', swatches: ['#3B2A22', '#A8673A', '#E2C9A6'] },
  { name: 'Linen poster', ratio: '3 / 4', variant: 'grid', swatches: ['#E7E1D6', '#B6402F', '#202124'] },
] as const;

const TITLES: Record<View, string> = {
  'sign-in': 'Welcome back.',
  'sign-up': 'Start your shelf.',
  reset: 'Reset your password.',
};

const LEDES: Record<View, string> = {
  'sign-in': 'Sign in to open your library on this device.',
  'sign-up': 'Keep your library and boards in sync across devices.',
  reset: 'Enter your account’s email and we’ll send a link to choose a new password.',
};

export function AuthDialog({ open, initialTab, isLocal, onClose, onContinueLocally }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const [view, setView] = useState<View>(initialTab);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const uid = useId();
  const titleId = `${uid}-title`;
  const errorId = `${uid}-error`;
  const pwHintId = `${uid}-pwhint`;

  // Open and close the native dialog; reset the form each time it opens.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setView(initialTab);
      setStatus({ kind: 'idle' });
      setPassword('');
      setShowPassword(false);
      dialog.showModal();
      requestAnimationFrame(() => emailRef.current?.focus());
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open, initialTab]);

  function go(next: View) {
    setView(next);
    setStatus({ kind: 'idle' });
    setPassword('');
    requestAnimationFrame(() => (email ? passwordRef.current ?? emailRef.current : emailRef.current)?.focus());
  }

  function fail(message: string, field: 'email' | 'password', code?: AuthError['code']) {
    setStatus({ kind: 'error', message, code, field });
    (field === 'email' ? emailRef : passwordRef).current?.focus();
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const emailProblem = validateEmail(email);
    if (emailProblem) return fail(emailProblem, 'email');

    if (view === 'reset') {
      setStatus({ kind: 'busy' });
      try {
        await sendPasswordReset(email);
        setStatus({ kind: 'reset-sent', email: email.trim() });
      } catch (err) {
        fail(err instanceof AuthError ? err.message : 'The email could not be sent. Try again.', 'email');
      }
      return;
    }

    if (view === 'sign-up') {
      const pwProblem = validateNewPassword(password);
      if (pwProblem) return fail(pwProblem, 'password');
    } else if (!password) {
      return fail('Enter your password.', 'password');
    }

    setStatus({ kind: 'busy' });
    try {
      if (view === 'sign-in') {
        await signInWithPassword(email, password);
        onClose();
      } else {
        const result = await signUpWithPassword(email, password);
        if (result === 'signed-in') onClose();
        else setStatus({ kind: 'confirm', email: email.trim() });
      }
      setPassword('');
    } catch (err) {
      const e2 = err instanceof AuthError ? err : new AuthError('Something went wrong. Check your connection and try again.');
      fail(e2.message, e2.code === 'bad-credentials' ? 'password' : 'email', e2.code);
    }
  }

  async function resend(target: string) {
    try {
      await resendConfirmation(target);
      setStatus({ kind: 'confirm', email: target, resent: true });
    } catch (err) {
      setStatus({ kind: 'error', message: err instanceof AuthError ? err.message : 'The email could not be sent.' });
    }
  }

  const hasError = status.kind === 'error';
  const badEmail = hasError && status.field !== 'password';
  const badPassword = hasError && status.field === 'password';
  const busy = status.kind === 'busy';

  return (
    <dialog
      ref={dialogRef}
      className="auth"
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        // A click on the dialog element itself is a click on the backdrop.
        if (e.target === dialogRef.current) onClose();
      }}
    >
      <div className="auth__card">
        <aside className="auth__sheet" aria-hidden="true">
          <p className="auth__sheet-title">
            Your references,
            <br />
            on every desk.
          </p>
          <div className="auth__tiles">
            {[0, 1, 2].map((col) => (
              <div className="auth__col" key={col}>
                {SHEET.filter((_, i) => i % 3 === col).map((t) => (
                  <figure className="auth__tile" key={t.name}>
                    <div className={`auth__img auth__img--${t.variant}`} style={{ aspectRatio: t.ratio }} />
                    <figcaption>
                      <span>{t.name}</span>
                      <span className="auth__swatches">
                        {t.swatches.map((c) => (
                          <i key={c} style={{ background: c }} />
                        ))}
                      </span>
                    </figcaption>
                  </figure>
                ))}
              </div>
            ))}
          </div>
        </aside>

        <div className="auth__main">
          <button type="button" className="auth__close" onClick={onClose}>
            <span className="visually-hidden">Close</span>
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />
            </svg>
          </button>

          {status.kind === 'confirm' ? (
            <div className="auth__body" role="status">
              <h2 id={titleId} className="auth__title">
                Confirm your email.
              </h2>
              <p className="auth__lede">
                We sent a confirmation link to <strong className="auth__email">{status.email}</strong>. Open it to activate
                your account. After that, you’ll sign in with your email and password.
              </p>
              <p className="auth__fine">
                {status.resent ? 'Sent again. ' : ''}Nothing there after a minute? Check spam, or send it again.
              </p>
              <div className="auth__actions">
                <button type="button" className="btn btn--quiet" onClick={() => resend(status.email)}>
                  Send the link again
                </button>
                <button type="button" className="btn btn--quiet" onClick={() => go('sign-in')}>
                  Back to sign in
                </button>
              </div>
            </div>
          ) : status.kind === 'reset-sent' ? (
            <div className="auth__body" role="status">
              <h2 id={titleId} className="auth__title">
                Check your inbox.
              </h2>
              <p className="auth__lede">
                If an account uses <strong className="auth__email">{status.email}</strong>, we’ve sent a link to choose a
                new password. Open it on this device.
              </p>
              <div className="auth__actions">
                <button type="button" className="btn btn--quiet" onClick={() => go('sign-in')}>
                  Back to sign in
                </button>
              </div>
            </div>
          ) : (
            <div className="auth__body">
              <h2 id={titleId} className="auth__title">
                {TITLES[view]}
              </h2>
              <p className="auth__lede">{LEDES[view]}</p>

              <form className="auth__form" onSubmit={onSubmit} noValidate>
                <label htmlFor={`${uid}-email`} className="auth__label">
                  Email address
                </label>
                <input
                  ref={emailRef}
                  id={`${uid}-email`}
                  className="auth__input"
                  type="email"
                  name="email"
                  autoComplete={view === 'sign-up' ? 'email' : 'username'}
                  inputMode="email"
                  spellCheck={false}
                  placeholder="you@studio.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (hasError) setStatus({ kind: 'idle' });
                  }}
                  aria-invalid={badEmail || undefined}
                  aria-describedby={badEmail ? errorId : undefined}
                />

                {view !== 'reset' && (
                  <>
                    <div className="auth__pwhead">
                      <label htmlFor={`${uid}-password`} className="auth__label">
                        Password
                      </label>
                      {view === 'sign-in' && (
                        <button type="button" className="auth__link auth__forgot" onClick={() => go('reset')}>
                          Forgot password?
                        </button>
                      )}
                    </div>
                    <div className="auth__pwrow">
                      <input
                        ref={passwordRef}
                        id={`${uid}-password`}
                        className="auth__input"
                        type={showPassword ? 'text' : 'password'}
                        name="password"
                        autoComplete={view === 'sign-up' ? 'new-password' : 'current-password'}
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          if (hasError) setStatus({ kind: 'idle' });
                        }}
                        aria-invalid={badPassword || undefined}
                        aria-describedby={[view === 'sign-up' ? pwHintId : '', badPassword ? errorId : ''].filter(Boolean).join(' ') || undefined}
                      />
                      <button
                        type="button"
                        className="auth__show"
                        aria-pressed={showPassword}
                        onClick={() => setShowPassword((v) => !v)}
                      >
                        {showPassword ? 'Hide' : 'Show'}
                      </button>
                    </div>
                    {view === 'sign-up' && (
                      <p id={pwHintId} className="auth__fine">
                        At least {MIN_PASSWORD} characters. We’ll email you once to confirm the address.
                      </p>
                    )}
                  </>
                )}

                {hasError && (
                  <div id={errorId} className="auth__error" role="alert">
                    <p>{status.message}</p>
                    {status.code === 'not-confirmed' && (
                      <button type="button" className="auth__link" onClick={() => resend(email)}>
                        Send the confirmation link again
                      </button>
                    )}
                    {status.code === 'exists' && (
                      <button type="button" className="auth__link" onClick={() => go('sign-in')}>
                        Sign in instead
                      </button>
                    )}
                    {status.code === 'bad-credentials' && (
                      <button type="button" className="auth__link" onClick={() => go('reset')}>
                        Reset your password
                      </button>
                    )}
                  </div>
                )}

                <button type="submit" className="btn btn--primary auth__submit" disabled={busy}>
                  {busy
                    ? view === 'reset'
                      ? 'Sending…'
                      : view === 'sign-up'
                        ? 'Creating account…'
                        : 'Signing in…'
                    : view === 'reset'
                      ? 'Send reset link'
                      : view === 'sign-up'
                        ? 'Create account'
                        : 'Sign in'}
                </button>
              </form>

              <p className="auth__switch">
                {view === 'sign-up' ? 'Already have an account?' : view === 'reset' ? 'Remembered it?' : 'New to Design Shelf?'}{' '}
                <button type="button" className="auth__link" onClick={() => go(view === 'sign-in' ? 'sign-up' : 'sign-in')}>
                  {view === 'sign-in' ? 'Create an account' : 'Sign in'}
                </button>
              </p>

              {view !== 'reset' && (
                <button type="button" className="auth__local" onClick={onContinueLocally}>
                  <span className="auth__local-text">
                    <span className="auth__local-title">
                      {isLocal ? 'Keep using this browser only' : 'Continue without an account'}
                    </span>
                    <span className="auth__local-sub">Everything stays in this browser. Move it to an account later.</span>
                  </span>
                  <svg viewBox="0 0 16 16" aria-hidden="true" className="auth__arrow">
                    <path d="M3 8h10M9 4l4 4-4 4" />
                  </svg>
                </button>
              )}

              {!isAccountsConfigured() && (
                <p className="auth__fine auth__notice">
                  Accounts are not connected in this build yet. Continue without an account to start now.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </dialog>
  );
}
