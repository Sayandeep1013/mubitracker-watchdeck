#!/usr/bin/env node
/**
 * TMDB smoke test — run from repo root:
 *   TMDB_V3_API_KEY=xxx node scripts/tmdb-smoke-test.mjs
 * Or with read access token:
 *   TMDB_READ_ACCESS_TOKEN=xxx node scripts/tmdb-smoke-test.mjs
 */
const v3Key = process.env.TMDB_V3_API_KEY ?? process.env.TMDB_API_KEY;
const bearer = process.env.TMDB_READ_ACCESS_TOKEN;

let url = 'https://api.themoviedb.org/3/search/multi?query=The%20Prestige&include_adult=false';
const headers = { accept: 'application/json' };

if (v3Key && !v3Key.startsWith('eyJ')) {
  url += `&api_key=${v3Key}`;
} else if (bearer || (v3Key && v3Key.startsWith('eyJ'))) {
  headers.Authorization = `Bearer ${bearer ?? v3Key}`;
} else {
  console.error('Set TMDB_V3_API_KEY or TMDB_READ_ACCESS_TOKEN');
  process.exit(1);
}

const res = await fetch(url, { headers });

if (!res.ok) {
  console.error('TMDB request failed:', res.status, await res.text());
  process.exit(1);
}

const data = await res.json();
const first = data.results?.find((r) => r.media_type === 'movie' || r.media_type === 'tv');
if (!first) {
  console.error('No results');
  process.exit(1);
}

console.log('OK — found:', first.title || first.name);
