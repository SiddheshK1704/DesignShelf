/**
 * Account handling with email and password. New accounts confirm their
 * email once; after that, users sign in with their password. "Local" mode
 * keeps everything in this browser without an account.
 */
import type { AuthError as SupabaseAuthError } from '@supabase/supabase-js';
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
export const MIN_PASSWORD = 8;

export class AuthError extends Error {
  constructor(
    message: string,
    /** Lets the dialog offer the right follow-up, e.g. resending the confirmation email. */
    public code?: 'not-confirmed' | 'exists' | 'bad-credentials',
  ) {
    super(message);
  }
}

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

export function validateNewPassword(password: string): string | null {
  if (password.length < MIN_PASSWORD) return `Use at least ${MIN_PASSWORD} characters for your password.`;
  if (password.trim().length === 0) return 'The password can’t be only spaces.';
  return null;
}

function client() {
  if (!supabase) {
    throw new AuthError('Accounts are not connected in this build. Choose “Continue without an account” to use Design Shelf in this browser.');
  }
  return supabase;
}

/** Turns Supabase's errors into messages that say what to do next. */
function explain(error: SupabaseAuthError): AuthError {
  const msg = error.message.toLowerCase();
  const code = (error as { code?: string }).code ?? '';
  if (code === 'invalid_credentials' || msg.includes('invalid login credentials')) {
    return new AuthError('That email and password don’t match. Check them, or reset your password.', 'bad-credentials');
  }
  if (code === 'email_not_confirmed' || msg.includes('email not confirmed')) {
    return new AuthError('Confirm your email first: open the link we sent when you created the account.', 'not-confirmed');
  }
  if (code === 'user_already_exists' || msg.includes('already registered')) {
    return new AuthError('An account already uses this email. Sign in instead.', 'exists');
  }
  if (code === 'weak_password' || msg.includes('password should')) {
    return new AuthError(`That password is too weak: ${error.message}`);
  }
  if (error.status === 429 || msg.includes('rate limit') || msg.includes('security purposes')) {
    return new AuthError('Too many attempts. Wait a minute, then try again.');
  }
  if (msg.includes('redirect')) {
    return new AuthError('This address isn’t allowed in Supabase’s URL settings. Add it under Authentication > URL Configuration.');
  }
  if (msg.includes('fetch') || msg.includes('network')) {
    return new AuthError('Could not reach the account service. Check your connection and try again.');
  }
  return new AuthError(error.message);
}

export async function signInWithPassword(email: string, password: string): Promise<void> {
  const { error } = await client().auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw explain(error);
}

/**
 * Create an account. Returns 'signed-in' when the project doesn't require
 * email confirmation, otherwise 'confirm' (a confirmation email was sent).
 */
export async function signUpWithPassword(email: string, password: string): Promise<'signed-in' | 'confirm'> {
  const { data, error } = await client().auth.signUp({
    email: email.trim(),
    password,
    options: { emailRedirectTo: `${window.location.origin}/library` },
  });
  if (error) throw explain(error);
  // Supabase hides whether an email is taken: an existing, confirmed user comes back with no identities.
  if (data.user && data.user.identities?.length === 0) {
    throw new AuthError('An account already uses this email. Sign in instead.', 'exists');
  }
  return data.session ? 'signed-in' : 'confirm';
}

export async function resendConfirmation(email: string): Promise<void> {
  const { error } = await client().auth.resend({
    type: 'signup',
    email: email.trim(),
    options: { emailRedirectTo: `${window.location.origin}/library` },
  });
  if (error) throw explain(error);
}

export async function sendPasswordReset(email: string): Promise<void> {
  const { error } = await client().auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  if (error) throw explain(error);
}

export async function updatePassword(password: string): Promise<void> {
  const { error } = await client().auth.updateUser({ password });
  if (error) throw explain(error);
}

export async function signOutAccount(): Promise<void> {
  await supabase?.auth.signOut();
}
