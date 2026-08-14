import { NextRequest } from 'next/server';
import { apiError, apiOk } from '@/lib/api/helpers';

const MAX_FIELD_LEN = 2000;

function truncate(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  return v.length > MAX_FIELD_LEN ? v.slice(0, MAX_FIELD_LEN) : v;
}

/** No auth required — a render error can happen before login (e.g. on
 * /login itself), and this only ever writes to server logs, never a
 * table, so an unauthenticated caller can't do anything worse than emit
 * one bounded log line. Spec 50 §6's error-reporting substitute: no
 * Sentry account exists yet, so Vercel's log dashboard is the "dashboard"
 * this satisfies until one is set up. */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.error(
      JSON.stringify({
        evt: 'client.error',
        message: truncate(body?.message) ?? 'Unknown client error',
        stack: truncate(body?.stack),
        digest: truncate(body?.digest),
        url: truncate(body?.url),
        platform: body?.platform === 'mobile' ? 'mobile' : 'web',
        req_id: request.headers.get('x-request-id'),
      }),
    );
    return apiOk({ ok: true }, 202);
  } catch {
    return apiError('BAD_REQUEST', 'Invalid error report', 400);
  }
}
