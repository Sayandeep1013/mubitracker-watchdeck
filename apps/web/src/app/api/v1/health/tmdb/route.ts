import { tmdbSmokeTest } from '@/lib/tmdb/provider';
import { apiError, apiOk } from '@/lib/api/helpers';

export async function GET() {
  const result = await tmdbSmokeTest();
  if (!result.ok) return apiError('TMDB_ERROR', result.error ?? 'Smoke test failed', 503);
  return apiOk({ ok: true, sample: result.title });
}
