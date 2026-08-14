import { Redirect } from 'expo-router';
import { useAuth } from '@/lib/auth';

/**
 * The declared match for "/" — see `_layout.tsx`'s comment on this
 * Stack.Screen for why this file exists at all. This component only ever
 * mounts once `useAuthGuard`'s `checked` is already true (RootLayout gates
 * the whole app tree on it), so there is nothing to await here: `authed` is
 * already resolved, and the redirect is immediate.
 */
export default function Index() {
  const { authed } = useAuth();
  return <Redirect href={authed ? '/(tabs)/deck' : '/login'} />;
}
