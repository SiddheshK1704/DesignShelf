import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { loadAuthState, saveLocalMode, type AuthState } from '../lib/auth';
import { AuthDialog, type AuthTab } from './AuthDialog';

interface AuthContextValue extends AuthState {
  openAuth: (tab?: AuthTab) => void;
  continueLocally: () => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(loadAuthState);
  const [dialog, setDialog] = useState<{ open: boolean; tab: AuthTab }>({ open: false, tab: 'sign-in' });

  const openAuth = useCallback((tab: AuthTab = 'sign-in') => setDialog({ open: true, tab }), []);
  const closeAuth = useCallback(() => setDialog((d) => ({ ...d, open: false })), []);

  const continueLocally = useCallback(() => {
    saveLocalMode(true);
    setState({ mode: 'local' });
    closeAuth();
  }, [closeAuth]);

  const signOut = useCallback(() => {
    saveLocalMode(false);
    setState({ mode: 'signed-out' });
  }, []);

  const value = useMemo(
    () => ({ ...state, openAuth, continueLocally, signOut }),
    [state, openAuth, continueLocally, signOut],
  );

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
