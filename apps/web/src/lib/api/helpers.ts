import { NextRequest } from 'next/server';
import type { ZodIssue } from 'zod';
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

/**
 * A ZodError's own `.message` is `JSON.stringify(issues, null, 2)` — every
 * route's `catch (e) { ... e instanceof Error ? e.message : fallback }`
 * pattern was putting that raw JSON straight into the API response and, from
 * there, straight onto screen (e.g. mobile signup's password-too-short
 * error). Use the first issue's own human-readable message instead.
 *
 * Duck-typed rather than `instanceof ZodError`: confirmed live that the
 * instanceof check silently fails here — `@mubitracker/shared`'s schemas and
 * this route's `catch` block end up with two distinct ZodError constructor
 * references (Turbopack gives each compiled route its own module instance
 * of a workspace-linked dependency), so `e instanceof ZodError` was false
 * even for a genuine ZodError. `issues` is zod's own public error shape and
 * doesn't depend on constructor identity.
 */
function isZodIssueArray(value: unknown): value is ZodIssue[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    typeof (value[0] as { message?: unknown })?.message === 'string'
  );
}

export function errorMessage(e: unknown, fallback: string): string {
  const issues = (e as { issues?: unknown })?.issues;
  if (isZodIssueArray(issues)) {
    return issues[0].message;
  }
  return e instanceof Error ? e.message : fallback;
}
