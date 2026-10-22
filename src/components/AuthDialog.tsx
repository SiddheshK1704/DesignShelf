import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { AuthError, isAccountsConfigured, sendEmailLink, validateEmail } from '../lib/auth';
import './AuthDialog.css';

export type AuthTab = 'sign-in' | 'sign-up';

type Status = { kind: 'idle' } | { kind: 'sending' } | { kind: 'sent'; email: string } | { kind: 'error'; message: string };

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

export function AuthDialog({ open, initialTab, isLocal, onClose, onContinueLocally }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<AuthTab>(initialTab);
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const uid = useId();
  const titleId = `${uid}-title`;
  const errorId = `${uid}-error`;
  const hintId = `${uid}-hint`;

  // Open and close the native dialog; reset the form each time it opens.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setMode(initialTab);
      setStatus({ kind: 'idle' });
      dialog.showModal();
      requestAnimationFrame(() => emailRef.current?.focus());
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open, initialTab]);

  function switchMode() {
    setMode((m) => (m === 'sign-in' ? 'sign-up' : 'sign-in'));
    setStatus({ kind: 'idle' });
    emailRef.current?.focus();
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const problem = validateEmail(email);
    if (problem) {
      setStatus({ kind: 'error', message: problem });
      emailRef.current?.focus();
      return;
    }
    setStatus({ kind: 'sending' });
    try {
      await sendEmailLink(email.trim(), { createAccount: mode === 'sign-up' });
      setStatus({ kind: 'sent', email: email.trim() });
    } catch (err) {
      setStatus({
        kind: 'error',
        message: err instanceof AuthError ? err.message : 'The link could not be sent. Check your connection and try again.',
      });
    }
  }

  const isSignUp = mode === 'sign-up';
  const hasError = status.kind === 'error';

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

          {status.kind === 'sent' ? (
            <div className="auth__body" role="status">
              <h2 id={titleId} className="auth__title">
                Check your inbox.
              </h2>
              <p className="auth__lede">
                We sent a link to <strong className="auth__email">{status.email}</strong>. Open it on this device to{' '}
                {isSignUp ? 'finish creating your account' : 'sign in'}.
              </p>
              <p className="auth__fine">The link works once and expires after an hour. Not there? Check spam.</p>
              <div className="auth__actions">
                <button type="button" className="btn btn--quiet" onClick={() => setStatus({ kind: 'idle' })}>
                  Use a different email
                </button>
              </div>
            </div>
          ) : (
            <div className="auth__body">
              <h2 id={titleId} className="auth__title">
                {isSignUp ? 'Start your shelf.' : 'Welcome back.'}
              </h2>
              <p className="auth__lede">
                {isSignUp
                  ? 'Keep your library and boards in sync across devices.'
                  : 'Sign in to open your library on this device.'}
              </p>

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
                  autoComplete="email"
                  inputMode="email"
                  spellCheck={false}
                  placeholder="you@studio.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (hasError) setStatus({ kind: 'idle' });
                  }}
                  aria-invalid={hasError || undefined}
                  aria-describedby={hasError ? `${errorId} ${hintId}` : hintId}
                />
                <p id={hintId} className="auth__fine">
                  No password. We email you a one-time link.
                </p>
                {hasError && (
                  <p id={errorId} className="auth__error" role="alert">
                    {status.message}
                  </p>
                )}
                <button type="submit" className="btn btn--primary auth__submit" disabled={status.kind === 'sending'}>
                  {status.kind === 'sending' ? 'Sending…' : isSignUp ? 'Create account' : 'Send sign-in link'}
                </button>
              </form>

              <p className="auth__switch">
                {isSignUp ? 'Already have an account?' : 'New to Design Shelf?'}{' '}
                <button type="button" className="auth__link" onClick={switchMode}>
                  {isSignUp ? 'Sign in' : 'Create an account'}
                </button>
              </p>

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
