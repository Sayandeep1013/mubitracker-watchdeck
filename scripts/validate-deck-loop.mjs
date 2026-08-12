import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../apps/web/.env.local');
const env = Object.fromEntries(
  fs
    .readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
    }),
);

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const stamp = Date.now().toString().slice(-8);
const username = process.env.TEST_USERNAME || `deck_${stamp}`;
const password = process.env.TEST_PASSWORD || 'MubitrackerTest123!';
const reuseExisting = Boolean(process.env.TEST_USERNAME);

function usernameToAuthEmail(u) {
  return `${u.toLowerCase()}@users.mubitracker.local`;
}

const results = [];
function log(step, ok, detail) {
  results.push({ step, ok, detail });
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${step}${detail ? ' — ' + detail : ''}`);
}

async function jsonOrText(res) {
  const text = await res.text();
  try {
    return { status: res.status, body: JSON.parse(text) };
  } catch {
    return { status: res.status, body: text.slice(0, 500) };
  }
}

async function signIn(user) {
  const signInRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: usernameToAuthEmail(user), password }),
  });
  const signed = await jsonOrText(signInRes);
  return { signInRes, signed, token: signed.body?.access_token };
}

try {
  const health = await jsonOrText(await fetch(`${BASE}/api/v1/health/tmdb`));
  log(
    'health/tmdb',
    health.status === 200 && health.body?.ok === true,
    JSON.stringify(health.body),
  );

  let token = null;

  if (reuseExisting) {
    log('auth.signUp', true, `reusing ${username}`);
  } else {
    const signUpRes = await jsonOrText(
      await fetch(`${BASE}/api/v1/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      }),
    );
    log(
      'auth.signUp',
      signUpRes.status === 201 && !!signUpRes.body?.username,
      `status=${signUpRes.status} user=${signUpRes.body?.username ?? JSON.stringify(signUpRes.body).slice(0, 200)}`,
    );
  }

  {
    const { signInRes, signed, token: t } = await signIn(username);
    token = t;
    log(
      'auth.signIn',
      signInRes.ok && !!token,
      token ? 'got access_token' : JSON.stringify(signed.body).slice(0, 300),
    );
  }

  if (!token) throw new Error('No access token — aborting');

  const authHeaders = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  const deckStart = Date.now();
  const deckRes = await jsonOrText(
    await fetch(`${BASE}/api/v1/deck?limit=5`, { headers: authHeaders }),
  );
  const deckMs = Date.now() - deckStart;
  const items = deckRes.body?.items ?? [];
  log(
    'deck.fetch',
    deckRes.status === 200 && items.length > 0,
    `status=${deckRes.status} count=${items.length} ms=${deckMs} sample=${items[0]?.title ?? 'n/a'}`,
  );
  if (deckRes.status !== 200) {
    console.log('deck body:', JSON.stringify(deckRes.body).slice(0, 800));
  }

  if (items[0]) {
    const r = await jsonOrText(
      await fetch(`${BASE}/api/v1/user-media/${items[0].id}`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({ status: 'watched' }),
      }),
    );
    log(
      'classify.watched',
      r.status === 200 && r.body?.status === 'watched',
      `status=${r.status} title=${items[0].title}`,
    );
  }

  const col = await jsonOrText(
    await fetch(`${BASE}/api/v1/collection`, { headers: authHeaders }),
  );
  const colItems = Array.isArray(col.body) ? col.body : (col.body?.items ?? []);
  log(
    'collection',
    col.status === 200 && Array.isArray(colItems) && colItems.length >= 1,
    `status=${col.status} len=${Array.isArray(colItems) ? colItems.length : 'n/a'}`,
  );

  // Duplicate username should fail
  if (!reuseExisting) {
    const dup = await jsonOrText(
      await fetch(`${BASE}/api/v1/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      }),
    );
    log('auth.usernameUnique', dup.status === 409, `status=${dup.status}`);
  }

  const failed = results.filter((r) => !r.ok);
  console.log('---');
  console.log(`SUMMARY: ${results.length - failed.length}/${results.length} passed`);
  if (failed.length) {
    console.log('FAILED:', failed.map((f) => f.step).join(', '));
    process.exitCode = 1;
  }
  console.log('TEST_USERNAME=' + username);
} catch (e) {
  console.error('FATAL:', e instanceof Error ? e.message : e);
  process.exitCode = 1;
}
