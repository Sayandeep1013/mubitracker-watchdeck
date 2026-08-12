import { NextRequest } from 'next/server';
import { apiError, apiOk, AuthError, requireAuth } from '@/lib/api/helpers';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase
      .from('filter_presets')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);
    if (error) return apiError('DB_ERROR', error.message, 500);
    return apiOk({ deleted: true });
  } catch (e) {
    if (e instanceof AuthError) return apiError('UNAUTHORIZED', e.message, 401);
    return apiError('INTERNAL', 'Failed to delete preset', 500);
  }
}
