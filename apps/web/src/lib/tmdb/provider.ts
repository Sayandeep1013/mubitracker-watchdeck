import {
  classifyMedia,
  type MediaFormat,
  type NormalizedMedia,
  TMDB_API_BASE,
} from '@mubitracker/shared';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

interface TmdbResult {
  id: number;
  media_type?: string;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  overview?: string;
  release_date?: string;
  first_air_date?: string;
  original_language?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  genre_ids?: number[];
  popularity?: number;
  runtime?: number;
  adult?: boolean;
  vote_count?: number;
}

let lastRequestTime = 0;
const MIN_INTERVAL_MS = 35; // ~30 req/s cap — best-effort per-instance smoothing;
// tmdb_rate_limit_acquire() below is the real, shared-across-instances budget.

async function rateLimitedFetch(url: string, init?: RequestInit): Promise<Response> {
  const now = Date.now();
  const wait = MIN_INTERVAL_MS - (now - lastRequestTime);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequestTime = Date.now();

  const start = Date.now();
  const res = await fetch(url, init);
  const ms = Date.now() - start;
  // Spec 50 §6 structured log. This function only ever runs on a genuine
  // cache miss (see cachedTmdbRequest), so `cached` is always false here —
  // the `cached:true` line for a hit is logged by the caller instead.
  console.log(
    JSON.stringify({
      evt: 'tmdb.call',
      path: new URL(url).pathname,
      ms,
      status: res.status,
      cached: false,
    }),
  );

  if (res.status === 429) {
    const retryAfter = parseInt(res.headers.get('Retry-After') ?? '2', 10);
    await new Promise((r) => setTimeout(r, retryAfter * 1000));
    return rateLimitedFetch(url, init);
  }
  return res;
}

function isJwt(value: string): boolean {
  return value.startsWith('eyJ');
}

function getV3ApiKey(): string | null {
  return process.env.TMDB_V3_API_KEY ?? (process.env.TMDB_API_KEY && !isJwt(process.env.TMDB_API_KEY) ? process.env.TMDB_API_KEY : null);
}

function getBearerToken(): string | null {
  const token = process.env.TMDB_READ_ACCESS_TOKEN ?? process.env.TMDB_API_KEY;
  if (token && isJwt(token)) return token;
  return null;
}

function buildTmdbUrl(path: string, params: Record<string, string> = {}): string {
  const searchParams = new URLSearchParams(params);
  const v3Key = getV3ApiKey();
  if (v3Key) searchParams.set('api_key', v3Key);
  const qs = searchParams.toString();
  return `${TMDB_API_BASE}${path.startsWith('/') ? path : `/${path}`}${qs ? `?${qs}` : ''}`;
}

function getTmdbInit(): RequestInit {
  const headers: Record<string, string> = { accept: 'application/json' };
  const bearer = getBearerToken();
  if (bearer && !getV3ApiKey()) {
    headers.Authorization = `Bearer ${bearer}`;
  }
  if (!bearer && !getV3ApiKey()) {
    throw new Error('Configure TMDB_V3_API_KEY or TMDB_READ_ACCESS_TOKEN');
  }
  return { headers };
}

// --- Caching / in-flight dedup / rate limiting (spec 50 §7) ---------------

/** One promise per (instance, cache key) in flight at a time — concurrent
 * identical requests within this instance share one network call instead
 * of each independently hitting TMDB. */
const inFlight = new Map<string, Promise<unknown>>();

/** Never includes `api_key` — this key is what gets persisted to
 * `tmdb_cache`, and the cache table must never hold a secret. */
function cacheKeyFor(path: string, params: Record<string, string>): string {
  const qs = Object.entries(params)
    .filter(([k]) => k !== 'api_key')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
  return qs ? `${path}?${qs}` : path;
}

async function readCache(cacheKey: string): Promise<unknown | null> {
  try {
    const supabase = createSupabaseAdminClient();
    const { data } = await supabase
      .from('tmdb_cache')
      .select('response')
      .eq('cache_key', cacheKey)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();
    return data?.response ?? null;
  } catch {
    return null; // the cache is an optimization, never a hard dependency
  }
}

async function writeCache(cacheKey: string, response: unknown, ttlSeconds: number): Promise<void> {
  try {
    const supabase = createSupabaseAdminClient();
    await supabase.from('tmdb_cache').upsert({
      cache_key: cacheKey,
      response: response as never,
      expires_at: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
    });
  } catch {
    // best-effort — a failed cache write shouldn't fail the request that
    // already got its data
  }
}

/** Replaces the old per-instance 35ms sleep, which was meaningless on
 * serverless (N concurrent instances each kept their own timer, so the
 * real aggregate rate was never actually bounded). Fails open: if the RPC
 * itself errors, proceed anyway rather than let a rate-limiter outage take
 * the deck down with it. */
async function acquireRateSlot(): Promise<void> {
  try {
    const supabase = createSupabaseAdminClient();
    for (let attempt = 0; attempt < 5; attempt++) {
      const { data, error } = await supabase.rpc('tmdb_rate_limit_acquire');
      if (error || data) return;
      const backoffMs = 150 * (attempt + 1) + Math.random() * 100;
      await new Promise((r) => setTimeout(r, backoffMs));
    }
  } catch {
    // fail open
  }
}

/** Cached + deduped + rate-limited TMDB GET. On a cache hit, no network
 * call and no rate-limit slot are consumed at all. */
async function cachedTmdbRequest<T>(
  path: string,
  params: Record<string, string>,
  ttlSeconds: number,
): Promise<T> {
  const cacheKey = cacheKeyFor(path, params);

  const cached = await readCache(cacheKey);
  if (cached !== null) {
    console.log(JSON.stringify({ evt: 'tmdb.call', path, ms: 0, status: 200, cached: true }));
    return cached as T;
  }

  const existing = inFlight.get(cacheKey);
  if (existing) return existing as Promise<T>;

  const promise = (async () => {
    await acquireRateSlot();
    const url = buildTmdbUrl(path, params);
    const res = await rateLimitedFetch(url, getTmdbInit());
    if (!res.ok) throw new Error(`TMDB ${path} failed: ${res.status}`);
    const json = await res.json();
    await writeCache(cacheKey, json, ttlSeconds);
    return json;
  })();

  inFlight.set(cacheKey, promise);
  try {
    return (await promise) as T;
  } finally {
    inFlight.delete(cacheKey);
  }
}

const TTL_DISCOVER_SECONDS = 6 * 3600;
const TTL_DETAILS_SECONDS = 24 * 3600;
const TTL_SEARCH_SECONDS = 15 * 60;

// ---------------------------------------------------------------------------

function normalizeTmdbItem(item: TmdbResult, format: MediaFormat): NormalizedMedia {
  const isMovie = format === 'movie';
  const title = (isMovie ? item.title : item.name) ?? 'Unknown';
  const originalTitle = (isMovie ? item.original_title : item.original_name) ?? title;
  // TMDB returns "" (not null/omitted) for titles with no confirmed release date,
  // which Postgres rejects for a `date` column — normalize falsy values to null.
  const releaseDate = (isMovie ? item.release_date : item.first_air_date) || null;
  const year = releaseDate ? parseInt(releaseDate.slice(0, 4), 10) : null;
  const genreIds = item.genre_ids ?? [];
  const lang = item.original_language ?? 'en';

  return {
    provider: 'tmdb',
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
    runtime: item.runtime ?? null,
    genreIds,
    popularity: item.popularity ?? 0,
    adult: item.adult ?? false,
    voteCount: item.vote_count ?? 0,
  };
}

export async function tmdbSearch(query: string, limit = 20): Promise<NormalizedMedia[]> {
  const params = { query, include_adult: 'false', page: '1' };
  const data = await cachedTmdbRequest<{ results: TmdbResult[] }>(
    '/search/multi',
    params,
    TTL_SEARCH_SECONDS,
  );
  const results: NormalizedMedia[] = [];
  for (const item of data.results) {
    if (item.media_type === 'movie') results.push(normalizeTmdbItem(item, 'movie'));
    else if (item.media_type === 'tv') results.push(normalizeTmdbItem(item, 'series'));
    if (results.length >= limit) break;
  }
  return results;
}

export async function tmdbDiscover(
  format: MediaFormat,
  page: number,
  params: Record<string, string> = {},
): Promise<NormalizedMedia[]> {
  const endpoint = format === 'movie' ? 'discover/movie' : 'discover/tv';
  const searchParams: Record<string, string> = {
    include_adult: 'false',
    sort_by: 'popularity.desc',
    page: String(page),
    ...params,
  };
  const data = await cachedTmdbRequest<{ results: TmdbResult[] }>(
    `/${endpoint}`,
    searchParams,
    TTL_DISCOVER_SECONDS,
  );
  return data.results.map((item) => normalizeTmdbItem(item, format));
}

export async function tmdbGetDetails(
  providerId: string,
  format: MediaFormat,
): Promise<NormalizedMedia> {
  const endpoint = format === 'movie' ? `movie/${providerId}` : `tv/${providerId}`;
  const item = await cachedTmdbRequest<TmdbResult & { genres?: { id: number }[] }>(
    `/${endpoint}`,
    {},
    TTL_DETAILS_SECONDS,
  );
  const normalized = normalizeTmdbItem(item, format);
  if (item.genres) normalized.genreIds = item.genres.map((g) => g.id);
  return normalized;
}

export async function tmdbGetExternalIds(
  providerId: string,
  format: MediaFormat,
): Promise<{ imdbId: string | null }> {
  const endpoint = format === 'movie' ? `movie/${providerId}/external_ids` : `tv/${providerId}/external_ids`;
  const data = await cachedTmdbRequest<{ imdb_id?: string | null }>(
    `/${endpoint}`,
    {},
    TTL_DETAILS_SECONDS,
  );
  return { imdbId: data.imdb_id ?? null };
}

export async function tmdbSmokeTest(): Promise<{ ok: boolean; title?: string; error?: string }> {
  try {
    const results = await tmdbSearch('The Prestige', 1);
    if (results.length === 0) return { ok: false, error: 'No results' };
    return { ok: true, title: results[0].title };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unknown error' };
  }
}
