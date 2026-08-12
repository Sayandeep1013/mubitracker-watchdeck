/** Internal auth email domain — never shown in UI. Safe for later Google identity linking. */
export const AUTH_EMAIL_DOMAIN = 'users.mubitracker.local';

const USERNAME_RE = /^[a-z0-9_]{3,30}$/;

const RESERVED_USERNAMES = new Set([
  'admin',
  'api',
  'about',
  'deck',
  'search',
  'collection',
  'friends',
  'profile',
  'login',
  'signup',
  'mubitracker',
  'support',
  'help',
  'null',
  'undefined',
]);

/** Lowercase + trim. Stored form of every username. */
export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidUsername(username: string): boolean {
  return USERNAME_RE.test(username) && !RESERVED_USERNAMES.has(username);
}

export function parseUsername(raw: string): string {
  const username = normalizeUsername(raw);
  if (!isValidUsername(username)) {
    throw new Error(
      'Username must be 3–30 characters: lowercase letters, numbers, underscores only',
    );
  }
  return username;
}

/** Deterministic Supabase Auth email derived from username. */
export function usernameToAuthEmail(username: string): string {
  const normalized = normalizeUsername(username);
  return `${normalized}@${AUTH_EMAIL_DOMAIN}`;
}
