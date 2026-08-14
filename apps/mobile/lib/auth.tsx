import { createContext, useContext } from 'react';

interface AuthContextValue {
  authed: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Runs the actual auth check (see `_layout.tsx`'s `useAuthGuard`, which
 * consumes this via `useAuth()`) and exposes just the resolved `authed`
 * flag — needed so `app/index.tsx` can issue a declarative `<Redirect>`
 * without re-running the check itself. `AuthProvider` only ever mounts
 * once `useAuthGuard`'s own `checked` is already true (see RootLayout), so
 * there is no loading state to expose here.
 */
export function AuthProvider({ authed, children }: { authed: boolean; children: React.ReactNode }) {
  return <AuthContext.Provider value={{ authed }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
