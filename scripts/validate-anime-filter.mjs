import fs from 'fs';

const env = Object.fromEntries(
  fs
    .readFileSync('apps/web/.env.local', 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
    }),
);

const BASE = 'http://localhost:3000';
const email = 'deck_99149876@users.watchdeck.local';
const password = 'WatchdeckTest123!';

const signIn = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: {
    apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ email, password }),
});
const signed = await signIn.json();
const token = signed.access_token;
if (!token) {
  console.log('signin fail', signed);
  process.exit(1);
}

const headers = { Authorization: `Bearer ${token}` };
const anime = await fetch(`${BASE}/api/v1/deck?limit=8&classification=anime`, { headers });
const body = await anime.json();
console.log(
  'status',
  anime.status,
  'count',
  body.items?.length,
  'sample',
  (body.items || []).slice(0, 5).map((i) => ({
    title: i.title,
    classification: i.classification,
    lang: i.originalLanguage,
    type: i.displayType,
  })),
);
if (body.message) console.log('message', body.message);
if (body.error) console.log('error', body.error);
const allAnime = (body.items || []).every((i) => i.classification === 'anime');
console.log('allAnime', allAnime, 'pass', anime.status === 200 && (body.items?.length ?? 0) > 0 && allAnime);
