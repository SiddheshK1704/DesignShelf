import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { loadLocalMode, saveLocalMode, signOutAccount, type AuthState } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { AuthDialog, type AuthTab } from './AuthDialog';

interface AuthContextValue extends AuthState {
  openAuth: (tab?: AuthTab) => void;
  continueLocally: () => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() => ({ mode: loadLocalMode(), ready: !supabase }));
  const [dialog, setDialog] = useState<{ open: boolean; tab: AuthTab }>({ open: false, tab: 'sign-in' });

  // Follow the Supabase session: restored on load, set after the email link, cleared on sign-out.
  useEffect(() => {
    if (!supabase) return;
    const apply = (session: { user: { id: string; email?: string } } | null) =>
      setState(
        session
          ? { mode: 'signed-in', userId: session.user.id, email: session.user.email, ready: true }
          : { mode: loadLocalMode(), ready: true },
      );
    supabase.auth.getSession().then(({ data }) => apply(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => apply(session));
    return () => data.subscription.unsubscribe();
  }, []);

  const openAuth = useCallback((tab: AuthTab = 'sign-in') => setDialog({ open: true, tab }), []);
  const closeAuth = useCallback(() => setDialog((d) => ({ ...d, open: false })), []);

  const continueLocally = useCallback(() => {
    saveLocalMode(true);
    setState((s) => (s.mode === 'signed-in' ? s : { mode: 'local', ready: true }));
    closeAuth();
  }, [closeAuth]);

  const signOut = useCallback(async () => {
    await signOutAccount();
    saveLocalMode(false);
    setState({ mode: 'signed-out', ready: true });
  }, []);

  const value = useMemo(() => ({ ...state, openAuth, continueLocally, signOut }), [state, openAuth, continueLocally, signOut]);

  return (
    <AuthContext.Provider value={value}>
      {children}
      <AuthDialog
        open={dialog.open}
        initialTab={dialog.tab}
        onClose={closeAuth}
        onContinueLocally={continueLocally}
        isLocal={state.mode === 'local'}
      />
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
