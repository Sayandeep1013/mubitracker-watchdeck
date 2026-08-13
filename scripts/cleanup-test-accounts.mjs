#!/usr/bin/env node
/**
 * Deletes test accounts (spec 50 §5). Test accounts follow the `wqa*` (web
 * QA) / `mqa*` (mobile QA) / `deck_*` (validate-deck-loop.mjs default,
 * pre-wqa-rename) username prefixes and otherwise accumulate forever —
 * every E2E/manual verification run this session created a few more.
 *
 * Refuses to run without --dry-run or --confirm, and refuses any --prefix
 * outside the allowlist, per spec 50 §5's explicit acceptance criteria.
 *
 * Uses raw PostgREST/Auth Admin fetch calls (no @supabase/supabase-js) —
 * `scripts/` isn't inside any workspace package, so it can't resolve
 * apps/web's dependency; this mirrors backfill-media-metadata.mjs's `sb()`.
 *
 * Usage:
 *   node scripts/cleanup-test-accounts.mjs --older-than 24h --dry-run
 *   node scripts/cleanup-test-accounts.mjs --older-than 24h --confirm
 *   node scripts/cleanup-test-accounts.mjs --older-than 1h --prefix wqa --confirm
 */
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

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in apps/web/.env.local');
  process.exit(1);
}

const sbHeaders = {
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
};

async function sb(pathAndQuery, init = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${pathAndQuery}`, {
    ...init,
    headers: { ...sbHeaders, ...(init.method === 'DELETE' ? { Prefer: 'return=minimal' } : {}), ...(init.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Supabase ${res.status}: ${body.slice(0, 300)}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function deleteAuthUser(userId) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
    method: 'DELETE',
    headers: sbHeaders,
  });
  if (!res.ok && res.status !== 404) {
    const body = await res.text();
    throw new Error(`Auth admin delete ${res.status}: ${body.slice(0, 300)}`);
  }
}

const ALLOWED_PREFIXES = ['wqa', 'mqa', 'deck_'];

function parseArgs(argv) {
  const args = { dryRun: false, confirm: false, olderThan: '24h', prefixes: ALLOWED_PREFIXES };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--confirm') args.confirm = true;
    else if (a === '--older-than') args.olderThan = argv[++i];
    else if (a === '--prefix') args.prefixes = [argv[++i]];
    else {
      console.error(`Unknown argument: ${a}`);
      process.exit(1);
    }
  }
  return args;
}

function parseOlderThan(value) {
  const m = /^(\d+)([hd])$/.exec(value ?? '');
  if (!m) throw new Error(`--older-than must look like "24h" or "3d", got "${value}"`);
  const [, n, unit] = m;
  const ms = unit === 'h' ? Number(n) * 3600_000 : Number(n) * 86_400_000;
  return new Date(Date.now() - ms);
}

const args = parseArgs(process.argv.slice(2));

if (!args.dryRun && !args.confirm) {
  console.error('Refusing to run without --dry-run or --confirm.');
  process.exit(1);
}
if (args.dryRun && args.confirm) {
  console.error('Pass only one of --dry-run / --confirm.');
  process.exit(1);
}
for (const p of args.prefixes) {
  if (!ALLOWED_PREFIXES.includes(p)) {
    console.error(
      `Refusing prefix "${p}" — allowlist is ${ALLOWED_PREFIXES.map((x) => `"${x}"`).join(', ')}.`,
    );
    process.exit(1);
  }
}

let cutoff;
try {
  cutoff = parseOlderThan(args.olderThan);
} catch (e) {
  console.error(e.message);
  process.exit(1);
}

async function findCandidates() {
  // Prefix match applied client-side (keeps allowlist enforcement and the
  // query in the same place) — trivial at test-account volumes.
  const rows = await sb(
    `profiles?select=id,username,created_at&created_at=lt.${encodeURIComponent(cutoff.toISOString())}`,
  );
  return (rows ?? []).filter((p) =>
    args.prefixes.some((prefix) => p.username.toLowerCase().startsWith(prefix)),
  );
}

// Mirrors DELETE /api/v1/profile's cascade exactly (apps/web/src/app/api/v1/profile/route.ts)
// rather than relying only on the `auth.users` ON DELETE CASCADE, since a
// couple of these rows (friendships, recommendations) reference the user by
// two different foreign keys that a single FK cascade wouldn't catch both sides of.
async function deleteAccount(userId) {
  await sb(`user_media?user_id=eq.${userId}`, { method: 'DELETE' });
  await sb(`reviews?user_id=eq.${userId}`, { method: 'DELETE' });
  await sb(`friendships?or=(requester_id.eq.${userId},receiver_id.eq.${userId})`, { method: 'DELETE' });
  await sb(`filter_presets?user_id=eq.${userId}`, { method: 'DELETE' });
  await sb(`recommendations?or=(sender_id.eq.${userId},receiver_id.eq.${userId})`, { method: 'DELETE' });
  await sb(`profiles?id=eq.${userId}`, { method: 'DELETE' });
  await deleteAuthUser(userId);
}

try {
  const candidates = await findCandidates();
  console.log(
    `Found ${candidates.length} test account(s) older than ${args.olderThan} matching [${args.prefixes.join(', ')}]${args.dryRun ? ' (dry run)' : ''}.`,
  );
  for (const c of candidates) {
    console.log(`  ${c.username}  created=${c.created_at}  id=${c.id}`);
  }

  if (args.dryRun) {
    console.log('Dry run — nothing deleted.');
    process.exit(0);
  }

  let deleted = 0;
  let failed = 0;
  for (const c of candidates) {
    try {
      await deleteAccount(c.id);
      deleted++;
    } catch (e) {
      failed++;
      console.error(`  FAILED to delete ${c.username}: ${e instanceof Error ? e.message : e}`);
    }
  }
  console.log(`Deleted ${deleted}/${candidates.length} account(s).${failed ? ` ${failed} failed.` : ''}`);
  if (failed) process.exitCode = 1;
} catch (e) {
  console.error('FATAL:', e instanceof Error ? e.message : e);
  process.exit(1);
}
