/**
 * Account handling. Sign-in and sign-up both use a one-time email link, so
 * there are no passwords. "Local" mode keeps everything in this browser.
 *
 * Supabase is wired in later; until VITE_SUPABASE_* are set, sending a link
 * fails with a clear message and local mode is the way in.
 */

export type AuthMode = 'signed-out' | 'local' | 'signed-in';

export interface AuthState {
  mode: AuthMode;
  email?: string;
}

export const MODE_KEY = 'designshelf.mode';

export class AuthError extends Error {}

export function isAccountsConfigured(): boolean {
  return Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
}

export function loadAuthState(): AuthState {
  try {
    if (localStorage.getItem(MODE_KEY) === 'local') return { mode: 'local' };
  } catch {
    // Storage blocked: start signed out.
  }
  return { mode: 'signed-out' };
}

export function saveLocalMode(on: boolean) {
  try {
    if (on) localStorage.setItem(MODE_KEY, 'local');
    else localStorage.removeItem(MODE_KEY);
  } catch {
    // Storage blocked: local mode lasts for this visit only.
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(email: string): string | null {
  if (!email.trim()) return 'Enter your email address.';
  if (!EMAIL_RE.test(email.trim())) return 'That email address looks incomplete. Check it and try again.';
  return null;
}

/**
 * Send a one-time sign-in link. With `createAccount`, a new account is made
 * if none exists for this email.
 */
export async function sendEmailLink(_email: string, _opts: { createAccount: boolean }): Promise<void> {
  if (!isAccountsConfigured()) {
    throw new AuthError(
      'Accounts are not connected yet, so no email was sent. Choose "Continue without an account" to use Design Shelf in this browser now.',
    );
  }
  // Replaced by supabase.auth.signInWithOtp in the Supabase milestone.
  throw new AuthError('Sign-in is not available in this build yet. Continue without an account for now.');
}
