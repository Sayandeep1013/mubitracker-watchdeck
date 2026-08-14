import { NextRequest } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

export async function getAuthUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

export async function requireAuth(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) {
    throw new AuthError('Unauthorized');
  }
  return user;
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

export function apiError(code: string, message: string, status = 400) {
  if (status >= 500) {
    // Every route funnels its error responses through here, so this is the
    // one place that needs to log for "an error reporter captures an API
    // error" (spec 50 §6) to hold everywhere, without touching 30 files.
    console.error(JSON.stringify({ evt: 'api.error', code, message, status }));
  }
  return Response.json({ error: { code, message } }, { status });
}

export function apiOk<T>(data: T, status = 200) {
  return Response.json(data, { status });
}
