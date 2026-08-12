import {
  classifyMedia,
  type MediaFormat,
  type NormalizedMedia,
  TMDB_API_BASE,
} from '@mubitracker/shared';

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
}

let lastRequestTime = 0;
const MIN_INTERVAL_MS = 35; // ~30 req/s cap

async function rateLimitedFetch(url: string, init?: RequestInit): Promise<Response> {
  const now = Date.now();
  const wait = MIN_INTERVAL_MS - (now - lastRequestTime);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequestTime = Date.now();

  const res = await fetch(url, init);
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

function normalizeTmdbItem(item: TmdbResult, format: MediaFormat): NormalizedMedia {
  const isMovie = format === 'movie';
  const title = (isMovie ? item.title : item.name) ?? 'Unknown';
  const originalTitle = (isMovie ? item.original_title : item.original_name) ?? title;
  const releaseDate = (isMovie ? item.release_date : item.first_air_date) ?? null;
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
  };
}

export async function tmdbSearch(query: string, limit = 20): Promise<NormalizedMedia[]> {
  const url = buildTmdbUrl('/search/multi', {
    query,
    include_adult: 'false',
    page: '1',
  });
  const res = await rateLimitedFetch(url, getTmdbInit());
  if (!res.ok) throw new Error(`TMDB search failed: ${res.status}`);
  const data = (await res.json()) as { results: TmdbResult[] };
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
  const url = buildTmdbUrl(`/${endpoint}`, searchParams);
  const res = await rateLimitedFetch(url, getTmdbInit());
  if (!res.ok) throw new Error(`TMDB discover failed: ${res.status}`);
  const data = (await res.json()) as { results: TmdbResult[] };
  return data.results.map((item) => normalizeTmdbItem(item, format));
}

export async function tmdbGetDetails(
  providerId: string,
  format: MediaFormat,
): Promise<NormalizedMedia> {
  const endpoint = format === 'movie' ? `movie/${providerId}` : `tv/${providerId}`;
  const url = buildTmdbUrl(`/${endpoint}`);
  const res = await rateLimitedFetch(url, getTmdbInit());
  if (!res.ok) throw new Error(`TMDB details failed: ${res.status}`);
  const item = (await res.json()) as TmdbResult & { genres?: { id: number }[] };
  const normalized = normalizeTmdbItem(item, format);
  if (item.genres) normalized.genreIds = item.genres.map((g) => g.id);
  return normalized;
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
