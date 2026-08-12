import { NextRequest } from 'next/server';
import {
  authCredentialsSchema,
  isValidUsername,
  usernameToAuthEmail,
} from '@watchdeck/shared';
import { apiError, apiOk } from '@/lib/api/helpers';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const body = authCredentialsSchema.parse(await request.json());
    const username = body.username;

    if (!isValidUsername(username)) {
      return apiError('BAD_REQUEST', 'Username is reserved or invalid', 400);
    }

    const supabase = createSupabaseAdminClient();
    const email = usernameToAuthEmail(username);

    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', username)
      .maybeSingle();

    if (existing) {
      return apiError('CONFLICT', 'Username is already taken', 409);
    }

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password: body.password,
      email_confirm: true,
      user_metadata: { username },
    });

    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes('already') || msg.includes('registered')) {
        return apiError('CONFLICT', 'Username is already taken', 409);
      }
      return apiError('AUTH_ERROR', error.message, 400);
    }

    return apiOk({ id: data.user.id, username }, 201);
  } catch (e) {
    return apiError('BAD_REQUEST', e instanceof Error ? e.message : 'Invalid request', 400);
  }
}
