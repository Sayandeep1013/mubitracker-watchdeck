#!/usr/bin/env node
/**
 * Corpus seed/refresh (spec 21). Varies TMDB discover axes — format × sort
 * × decade × page, plus targeted anime/animation/documentary passes — so
 * breadth comes from spreading across the catalogue, not paging deep into
 * one popularity list. Not request-path code: run manually or on a
 * schedule (spec 21 §7).
 *
 *   node scripts/ingest-corpus.mjs
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

// --- content filter (spec 21 §4) — kept identical to
// packages/shared/src/constants/content-filter.ts; scripts run as plain
// Node outside the Next.js build so it isn't imported, it's mirrored. ---
const CONTENT_KEYWORD_BLOCKLIST = [
  'xxx', 'pornographic', 'porn', 'erotica', 'erotic film',
  'hardcore sex', 'hentai', 'nsfw', 'striptease', 'strip tease',
];
function checkContentFilter({ title, overview, adult, voteCount, genreIds }) {
  if (adult) return { rejected: true, reason: 'tmdb_adult_flag' };
  const text = `${title ?? ''} ${overview ?? ''}`.toLowerCase();
  if (CONTENT_KEYWORD_BLOCKLIST.some((w) => text.includes(w))) {
    return { rejected: true, reason: 'keyword_blocklist' };
  }
  if (genreIds.length === 0 && voteCount < 50) {
    return { rejected: true, reason: 'genre_free_low_votes' };
  }
  if (voteCount < 10) return { rejected: true, reason: 'insufficient_votes' };
  return { rejected: false };
}

// --- classification (mirrors packages/shared/src/utils/classification.ts) ---
const GENRE_ANIMATION = 16;
const GENRE_DOCUMENTARY = 99;
function classifyMedia(genreIds, lang) {
  if (genreIds.includes(GENRE_DOCUMENTARY)) return 'documentary';
  if (genreIds.includes(GENRE_ANIMATION) && lang === 'ja') return 'anime';
  if (genreIds.includes(GENRE_ANIMATION)) return 'animation';
  return 'live_action';
}

let lastCall = 0;
async function tmdbFetch(pathname, params) {
  const wait = 40 - (Date.now() - lastCall);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
  const headers = { accept: 'application/json' };
  const qs = new URLSearchParams(params);
  if (TMDB_V3_KEY) {
    qs.set('api_key', TMDB_V3_KEY);
  } else if (TMDB_BEARER) {
    headers.Authorization = `Bearer ${TMDB_BEARER}`;
  } else {
    throw new Error('Configure TMDB_V3_API_KEY or TMDB_READ_ACCESS_TOKEN');
  }
  const url = `https://api.themoviedb.org/3${pathname}?${qs}`;
  const res = await fetch(url, { headers });
  if (res.status === 429) {
    const retryAfter = parseInt(res.headers.get('Retry-After') ?? '2', 10);
    await new Promise((r) => setTimeout(r, retryAfter * 1000));
    return tmdbFetch(pathname, params);
  }
  if (!res.ok) throw new Error(`TMDB ${res.status} for ${pathname}?${qs}`);
  return res.json();
}

function normalizeItem(item, format) {
  const isMovie = format === 'movie';
  const title = (isMovie ? item.title : item.name) ?? 'Unknown';
  const originalTitle = (isMovie ? item.original_title : item.original_name) ?? title;
  const releaseDate = (isMovie ? item.release_date : item.first_air_date) || null;
  const year = releaseDate ? parseInt(releaseDate.slice(0, 4), 10) : null;
  const genreIds = item.genre_ids ?? [];
  const lang = item.original_language ?? 'en';
  return {
    providerId: String(item.id),
    format,
    classification: classifyMedia(genreIds, lang),
    title,
    originalTitle,
    overview: item.overview ?? '',
    releaseDate,
    year: Number.isNaN(year) ? null : year,
    originalLanguage: lang,
    posterPath: item.poster_path ?? null,
    backdropPath: item.backdrop_path ?? null,
    runtime: null,
    genreIds,
    popularity: item.popularity ?? 0,
    adult: item.adult ?? false,
    voteCount: item.vote_count ?? 0,
  };
}

// --- discover axes (spec 21 §3) ---
const DECADES = [
  [1970, 1979], [1980, 1989], [1990, 1999],
  [2000, 2009], [2010, 2019], [2020, 2029],
];
const SORTS_BY_FORMAT = {
  // TMDB discover/tv has no `revenue.desc` — vote_count.desc is the closest
  // "established/well-known" substitute for the series axis.
  movie: ['popularity.desc', 'vote_average.desc', 'revenue.desc'],
  series: ['popularity.desc', 'vote_average.desc', 'vote_count.desc'],
};
const PAGES = (process.env.INGEST_PAGES ?? '1,2,3').split(',').map(Number);
const TARGETED_PAGES = (process.env.INGEST_TARGETED_PAGES ?? '1,2,3,4,5').split(',').map(Number);

function buildDiscoverCalls() {
  const calls = [];
  for (const format of ['movie', 'series']) {
    for (const sort of SORTS_BY_FORMAT[format]) {
      for (const [decadeStart, decadeEnd] of DECADES) {
        for (const page of PAGES) {
          const params = {
            include_adult: 'false',
            sort_by: sort,
            page: String(page),
          };
          const dateField = format === 'movie' ? 'primary_release_date' : 'first_air_date';
          params[`${dateField}.gte`] = `${decadeStart}-01-01`;
          params[`${dateField}.lte`] = `${decadeEnd}-12-31`;
          if (sort.startsWith('vote_average')) params['vote_count.gte'] = '200';
          calls.push({ format, params, tag: `${format}/${sort}/${decadeStart}s/p${page}` });
        }
      }
    }
  }
  // Targeted passes for under-represented classifications.
  for (const format of ['movie', 'series']) {
    for (const page of TARGETED_PAGES) {
      calls.push({
        format,
        params: { include_adult: 'false', sort_by: 'popularity.desc', page: String(page), with_genres: '16', with_original_language: 'ja' },
        tag: `${format}/anime/p${page}`,
      });
      calls.push({
        format,
        params: { include_adult: 'false', sort_by: 'popularity.desc', page: String(page), with_genres: '16' },
        tag: `${format}/animation/p${page}`,
      });
      calls.push({
        format,
        params: { include_adult: 'false', sort_by: 'popularity.desc', page: String(page), with_genres: '99' },
        tag: `${format}/documentary/p${page}`,
      });
    }
  }
  return calls;
}

async function main() {
  const startedAt = Date.now();
  console.log('Loading existing corpus + rejection cache...');
  const [existingLinks, rejected] = await Promise.all([
    sb('media_external_ids?provider=eq.tmdb&select=external_id,media_id'),
    sb('media_rejected?provider=eq.tmdb&select=external_id'),
  ]);
  const existingByExternalId = new Map(existingLinks.map((r) => [r.external_id, r.media_id]));
  const rejectedIds = new Set(rejected.map((r) => r.external_id));
  console.log(`  corpus: ${existingByExternalId.size} titles, ${rejectedIds.size} previously rejected`);

  const calls = buildDiscoverCalls();
  console.log(`Running ${calls.length} discover calls...`);

  let callsMade = 0;
  let titlesSeen = 0;
  let inserted = 0;
  let updated = 0;
  const rejectedByReason = {};
  let errors = 0;
  let passesWithZeroNewInserts = 0;

  for (const call of calls) {
    let insertedThisCall = 0;
    try {
      const endpoint = call.format === 'movie' ? '/discover/movie' : '/discover/tv';
      const data = await tmdbFetch(endpoint, call.params);
      callsMade++;
      const results = data.results ?? [];

      for (const item of results) {
        titlesSeen++;
        const externalId = String(item.id);
        if (rejectedIds.has(externalId)) continue;

        // One bad item must not abort the rest of this page — TMDB's
        // popularity-sorted pagination can drift between requests (ranks
        // shift live), so a title already seen on an earlier page can
        // legitimately reappear here as a unique-key conflict.
        try {
          const normalized = normalizeItem(item, call.format);
          const filterResult = checkContentFilter(normalized);
          if (filterResult.rejected) {
            rejectedByReason[filterResult.reason] = (rejectedByReason[filterResult.reason] ?? 0) + 1;
            rejectedIds.add(externalId);
            await sb('media_rejected?on_conflict=provider,external_id', {
              method: 'POST',
              headers: { Prefer: 'resolution=ignore-duplicates' },
              body: JSON.stringify({ provider: 'tmdb', external_id: externalId, reason: filterResult.reason }),
            }).catch(() => {});
            continue;
          }

          const existingMediaId = existingByExternalId.get(externalId);
          if (existingMediaId) {
            await sb(`media?id=eq.${existingMediaId}`, {
              method: 'PATCH',
              body: JSON.stringify({
                popularity: normalized.popularity,
                adult: normalized.adult,
                vote_count: normalized.voteCount,
              }),
            });
            updated++;
            continue;
          }

          const [row] = await sb('media', {
            method: 'POST',
            headers: { Prefer: 'return=representation' },
            body: JSON.stringify({
              format: normalized.format,
              classification: normalized.classification,
              title: normalized.title,
              original_title: normalized.originalTitle,
              overview: normalized.overview,
              release_date: normalized.releaseDate,
              year: normalized.year,
              original_language: normalized.originalLanguage,
              poster_path: normalized.posterPath,
              backdrop_path: normalized.backdropPath,
              popularity: normalized.popularity,
              adult: normalized.adult,
              vote_count: normalized.voteCount,
            }),
          });

          const linked = await sb('media_external_ids?on_conflict=provider,external_id', {
            method: 'POST',
            headers: { Prefer: 'return=representation,resolution=ignore-duplicates' },
            body: JSON.stringify({ media_id: row.id, provider: 'tmdb', external_id: externalId }),
          });

          if (!linked?.length) {
            // Lost a race — another ingestion path (deck/search, or an
            // earlier page in this same run after a popularity-rank
            // shift) already claimed this external id.
            await sb(`media?id=eq.${row.id}`, { method: 'DELETE' });
            const [winner] = await sb(
              `media_external_ids?provider=eq.tmdb&external_id=eq.${externalId}&select=media_id`,
            );
            if (winner) existingByExternalId.set(externalId, winner.media_id);
            continue;
          }

          if (normalized.genreIds.length > 0) {
            await Promise.all(
              normalized.genreIds.map((genreId) =>
                sb('media_genres?on_conflict=media_id,genre_id', {
                  method: 'POST',
                  headers: { Prefer: 'resolution=ignore-duplicates' },
                  body: JSON.stringify({ media_id: row.id, genre_id: genreId }),
                }).catch(() => {}),
              ),
            );
          }

          existingByExternalId.set(externalId, row.id);
          inserted++;
          insertedThisCall++;
        } catch (e) {
          errors++;
          console.error(`  ERROR ${call.tag} item=${externalId}: ${e instanceof Error ? e.message : e}`);
        }
      }
    } catch (e) {
      errors++;
      console.error(`  ERROR ${call.tag}: ${e instanceof Error ? e.message : e}`);
    }

    if (insertedThisCall === 0) passesWithZeroNewInserts++;
    if (callsMade % 20 === 0) {
      console.log(
        `  [${callsMade}/${calls.length}] seen=${titlesSeen} inserted=${inserted} updated=${updated} rejected=${Object.values(rejectedByReason).reduce((a, b) => a + b, 0)}`,
      );
    }
  }

  const durationSec = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log('---');
  console.log(
    `Done in ${durationSec}s. calls=${callsMade} seen=${titlesSeen} inserted=${inserted} updated=${updated} errors=${errors}`,
  );
  console.log('Rejected by reason:', rejectedByReason);
  if (passesWithZeroNewInserts > calls.length * 0.5) {
    console.warn(
      `WARNING: ${passesWithZeroNewInserts}/${calls.length} passes inserted 0 new titles — corpus may be saturated for these axes; consider widening them.`,
    );
  }
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
