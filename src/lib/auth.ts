/**
 * Account handling. Sign-in and sign-up both use a one-time email link, so
 * there are no passwords. "Local" mode keeps everything in this browser.
 */
import { supabase } from './supabase';

export type AuthMode = 'signed-out' | 'local' | 'signed-in';

export interface AuthState {
  mode: AuthMode;
  email?: string;
  userId?: string;
  /** False until a stored session has been checked, so screens don't flash the wrong library. */
  ready: boolean;
}

export const MODE_KEY = 'designshelf.mode';

export class AuthError extends Error {}

export function isAccountsConfigured(): boolean {
  return supabase !== null;
}

export function loadLocalMode(): AuthMode {
  try {
    if (localStorage.getItem(MODE_KEY) === 'local') return 'local';
  } catch {
    // Storage blocked: start signed out.
  }
  return 'signed-out';
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
 * if none exists for this email; without it, unknown emails are refused.
 */
export async function sendEmailLink(email: string, opts: { createAccount: boolean }): Promise<void> {
  if (!supabase) {
    throw new AuthError(
      'Accounts are not connected in this build, so no email was sent. Choose "Continue without an account" to use Design Shelf in this browser.',
    );
  }
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: opts.createAccount, emailRedirectTo: `${window.location.origin}/library` },
  });
  if (!error) return;

  const msg = error.message.toLowerCase();
  if (msg.includes('signups not allowed') || msg.includes('user not found')) {
    throw new AuthError('No account uses that email yet. Choose “Create an account” instead.');
  }
  if (error.status === 429 || msg.includes('rate limit') || msg.includes('security purposes')) {
    throw new AuthError('Too many links were requested. Wait a minute, then try again.');
  }
  if (msg.includes('redirect')) {
    throw new AuthError('This address isn’t allowed to receive sign-in links. Add it under Authentication > URL Configuration in Supabase.');
  }
  throw new AuthError(`The link could not be sent: ${error.message}`);
}

export async function signOutAccount(): Promise<void> {
  await supabase?.auth.signOut();
}
