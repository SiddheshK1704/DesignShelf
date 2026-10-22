import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { AuthError, isAccountsConfigured, sendEmailLink, validateEmail } from '../lib/auth';
import './AuthDialog.css';

export type AuthTab = 'sign-in' | 'sign-up';

type Status = { kind: 'idle' } | { kind: 'sending' } | { kind: 'sent'; email: string } | { kind: 'error'; message: string };

const TABS: { id: AuthTab; label: string }[] = [
  { id: 'sign-in', label: 'Sign in' },
  { id: 'sign-up', label: 'Create account' },
];

interface Props {
  open: boolean;
  initialTab: AuthTab;
  isLocal: boolean;
  onClose: () => void;
  onContinueLocally: () => void;
}

export function AuthDialog({ open, initialTab, isLocal, onClose, onContinueLocally }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const tabRefs = useRef<Record<AuthTab, HTMLButtonElement | null>>({ 'sign-in': null, 'sign-up': null });
  const [tab, setTab] = useState<AuthTab>(initialTab);
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const uid = useId();
  const titleId = `${uid}-title`;
  const panelId = `${uid}-panel`;
  const errorId = `${uid}-error`;

  // Open and close the native dialog; reset the form each time it opens.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setTab(initialTab);
      setStatus({ kind: 'idle' });
      dialog.showModal();
      requestAnimationFrame(() => emailRef.current?.focus());
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open, initialTab]);

  function selectTab(next: AuthTab) {
    setTab(next);
    if (status.kind === 'error') setStatus({ kind: 'idle' });
  }

  function onTabKey(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'Home' && e.key !== 'End') return;
    e.preventDefault();
    const i = TABS.findIndex((t) => t.id === tab);
    const next =
      e.key === 'Home' ? TABS[0] : e.key === 'End' ? TABS[TABS.length - 1] : TABS[(i + (e.key === 'ArrowRight' ? 1 : -1) + TABS.length) % TABS.length];
    selectTab(next.id);
    tabRefs.current[next.id]?.focus();
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
      await sendEmailLink(email.trim(), { createAccount: tab === 'sign-up' });
      setStatus({ kind: 'sent', email: email.trim() });
    } catch (err) {
      const message =
        err instanceof AuthError
          ? err.message
          : 'The link could not be sent. Check your connection and try again.';
      setStatus({ kind: 'error', message });
    }
  }

  const isSignUp = tab === 'sign-up';
  const hasError = status.kind === 'error';

  return (
    <dialog
      ref={dialogRef}
      className="auth"
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        // Clicking the backdrop (the dialog element itself, outside the card) closes it.
        if (e.target === dialogRef.current) onClose();
      }}
    >
      <div className="auth__card reg-frame">
        <span className="auth__tape" aria-hidden="true">
          Your shelf
        </span>

        <button type="button" className="auth__close" onClick={onClose}>
          <span className="visually-hidden">Close</span>
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />
          </svg>
        </button>

        {status.kind === 'sent' ? (
          <div className="auth__sent" role="status">
            <h2 id={titleId} className="auth__title">
              Check your inbox
            </h2>
            <p>
              We sent a link to <span className="mono auth__email">{status.email}</span>. Open it on this device to{' '}
              {isSignUp ? 'finish creating your account' : 'sign in'}. The link works once and expires after an hour.
            </p>
            <p className="muted">Nothing there after a minute? Check spam, or send it again.</p>
            <div className="auth__row">
              <button type="button" className="btn btn--quiet" onClick={() => setStatus({ kind: 'idle' })}>
                Use a different email
              </button>
            </div>
          </div>
        ) : (
          <>
            <div role="tablist" aria-label="Account" className="auth__tabs">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  ref={(el) => {
                    tabRefs.current[t.id] = el;
                  }}
                  type="button"
                  role="tab"
                  id={`${uid}-${t.id}`}
                  aria-selected={tab === t.id}
                  aria-controls={panelId}
                  tabIndex={tab === t.id ? 0 : -1}
                  className="auth__tab"
                  onClick={() => selectTab(t.id)}
                  onKeyDown={onTabKey}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div role="tabpanel" id={panelId} aria-labelledby={`${uid}-${tab}`} className="auth__panel">
              <h2 id={titleId} className="auth__title">
                {isSignUp ? 'Start your shelf' : 'Welcome back'}
              </h2>
              <p className="muted">
                {isSignUp
                  ? 'An account keeps your library and boards in sync across devices. No password: we email you a link.'
                  : 'Enter your email and we will send you a one-time link. No password needed.'}
              </p>

              <form className="auth__form" onSubmit={onSubmit} noValidate>
                <label htmlFor={`${uid}-email`} className="auth__label">
                  Email
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
                  aria-describedby={hasError ? errorId : undefined}
                />
                {hasError && (
                  <p id={errorId} className="auth__error" role="alert">
                    {status.message}
                  </p>
                )}
                <button type="submit" className="btn btn--primary auth__submit" disabled={status.kind === 'sending'}>
                  {status.kind === 'sending'
                    ? 'Sending link…'
                    : isSignUp
                      ? 'Email me a sign-up link'
                      : 'Email me a sign-in link'}
                </button>
                {!isAccountsConfigured() && (
                  <p className="mono muted auth__note">Accounts are not connected in this build yet.</p>
                )}
              </form>
            </div>

            <div className="auth__divider" aria-hidden="true">
              <span>or</span>
            </div>

            <div className="auth__local">
              <button type="button" className="btn auth__local-btn" onClick={onContinueLocally}>
                {isLocal ? 'Keep using this browser only' : 'Continue without an account'}
              </button>
              <p className="muted">
                Your references stay in this browser. You can create an account later and move them over.
              </p>
            </div>
          </>
        )}
      </div>
    </dialog>
  );
}
