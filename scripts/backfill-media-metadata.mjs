#!/usr/bin/env node
/**
 * One-off backfill (spec 21 §5-6, stage 1 items 1.1/1.3):
 *  - re-fetches TMDB details for every `media` row with zero `media_genres`
 *    links (series coverage was 46% because TV genre ids were missing from
 *    `genres` until this stage's migration) and inserts the links.
 *  - captures `adult` / `vote_count` on those rows and evaluates the
 *    content filter; rejected rows are deleted only if no user has ever
 *    recorded a user_media/review/recommendation against them, so this
 *    never destroys someone's tracked history.
 *
 * Run from repo root:
 *   node scripts/backfill-media-metadata.mjs
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
const TMDB_V3_KEY = env.TMDB_V3_API_KEY;
const TMDB_BEARER = env.TMDB_READ_ACCESS_TOKEN;

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
    headers: { ...sbHeaders, ...(init.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Supabase ${res.status}: ${body.slice(0, 300)}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

const CONTENT_KEYWORD_BLOCKLIST = [
  'xxx', 'pornographic', 'porn', 'erotica', 'erotic film',
  'hardcore sex', 'hentai', 'nsfw', 'striptease', 'strip tease',
];

function checkContentFilter({ title, overview, adult, voteCount, genreIds }) {
  if (adult) return { rejected: true, reason: 'tmdb_adult_flag' };
  const text = `${title} ${overview}`.toLowerCase();
  if (CONTENT_KEYWORD_BLOCKLIST.some((w) => text.includes(w))) {
    return { rejected: true, reason: 'keyword_blocklist' };
  }
  if (genreIds.length === 0 && voteCount < 50) {
    return { rejected: true, reason: 'genre_free_low_votes' };
  }
  if (voteCount < 10) return { rejected: true, reason: 'insufficient_votes' };
  return { rejected: false };
}

let lastCall = 0;
async function tmdbFetch(url) {
  const wait = 40 - (Date.now() - lastCall);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
  const headers = { accept: 'application/json' };
  const qs = new URLSearchParams();
  if (TMDB_V3_KEY) {
    qs.set('api_key', TMDB_V3_KEY);
  } else if (TMDB_BEARER) {
    headers.Authorization = `Bearer ${TMDB_BEARER}`;
  } else {
    throw new Error('Configure TMDB_V3_API_KEY or TMDB_READ_ACCESS_TOKEN');
  }
  const full = qs.toString() ? `${url}?${qs}` : url;
  const res = await fetch(full, { headers });
  if (res.status === 429) {
    await new Promise((r) => setTimeout(r, 2000));
    return tmdbFetch(url);
  }
  if (!res.ok) throw new Error(`TMDB ${res.status} for ${url}`);
  return res.json();
}

async function main() {
  console.log('Fetching genre-less media rows...');
  // media rows with no media_genres link, joined via left-join emulation:
  // fetch all media_genres media_ids once, diff against all media ids.
  const allMedia = await sb('media?select=id,format');
  const genreLinks = await sb('media_genres?select=media_id');
  const hasGenre = new Set(genreLinks.map((r) => r.media_id));
  const targets = allMedia.filter((m) => !hasGenre.has(m.id));
  console.log(`${targets.length} rows need a genre/metadata refresh (of ${allMedia.length} total).`);

  let updated = 0;
  let genresLinked = 0;
  let rejected = 0;
  let deleted = 0;
  let errors = 0;

  for (const [i, row] of targets.entries()) {
    try {
      const ext = await sb(
        `media_external_ids?media_id=eq.${row.id}&provider=eq.tmdb&select=external_id&limit=1`,
      );
      const externalId = ext?.[0]?.external_id;
      if (!externalId) continue;

      const endpoint = row.format === 'movie' ? 'movie' : 'tv';
      const details = await tmdbFetch(`https://api.themoviedb.org/3/${endpoint}/${externalId}`);
      const genreIds = (details.genres ?? []).map((g) => g.id);
      const adult = details.adult ?? false;
      const voteCount = details.vote_count ?? 0;

      await sb(`media?id=eq.${row.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ adult, vote_count: voteCount, popularity: details.popularity ?? 0 }),
      });
      updated++;

      if (genreIds.length > 0) {
        await Promise.all(
          genreIds.map((genreId) =>
            sb('media_genres', {
              method: 'POST',
              headers: { Prefer: 'resolution=ignore-duplicates' },
              body: JSON.stringify({ media_id: row.id, genre_id: genreId }),
            }).catch(() => {}),
          ),
        );
        genresLinked++;
      }

      const title = details.title ?? details.name ?? '';
      const overview = details.overview ?? '';
      const filterResult = checkContentFilter({ title, overview, adult, voteCount, genreIds });

      if (filterResult.rejected) {
        rejected++;
        const [um, rv, rc] = await Promise.all([
          sb(`user_media?media_id=eq.${row.id}&select=id&limit=1`),
          sb(`reviews?media_id=eq.${row.id}&select=id&limit=1`),
          sb(`recommendations?media_id=eq.${row.id}&select=id&limit=1`),
        ]);
        const referenced = (um?.length ?? 0) + (rv?.length ?? 0) + (rc?.length ?? 0) > 0;
        if (referenced) {
          console.log(`  KEEP (user-referenced) rejected=${filterResult.reason} "${title}"`);
        } else {
          await sb(`media?id=eq.${row.id}`, { method: 'DELETE' });
          deleted++;
          console.log(`  DELETE rejected=${filterResult.reason} "${title}"`);
        }
      }

      if ((i + 1) % 25 === 0) console.log(`  ${i + 1}/${targets.length}...`);
    } catch (e) {
      errors++;
      console.error(`  ERROR row ${row.id}: ${e instanceof Error ? e.message : e}`);
    }
  }

  console.log('---');
  console.log(
    `Done. updated=${updated} genresLinked=${genresLinked} rejected=${rejected} deleted=${deleted} errors=${errors}`,
  );
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
