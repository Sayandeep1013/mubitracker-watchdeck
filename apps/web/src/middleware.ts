import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const publicPaths = ['/login', '/about', '/api/v1/health'];

/** Every /api/v1/* response carries this (spec 50 §6) so a slow/erroring
 * request is traceable end-to-end: this header, the client analytics event,
 * and the `deck.generate`/`tmdb.call` structured log lines all share it. */
function withRequestId(request: NextRequest, response: NextResponse): NextResponse {
  if (!request.nextUrl.pathname.startsWith('/api/')) return response;
  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();
  response.headers.set('x-request-id', requestId);
  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Route handlers read the id back via request.headers.get('x-request-id')
  // to fold it into their own structured logs — set it before any early
  // return so every branch below forwards the same value.
  if (pathname.startsWith('/api/') && !request.headers.get('x-request-id')) {
    request.headers.set('x-request-id', crypto.randomUUID());
  }

  if (publicPaths.some((p) => pathname.startsWith(p))) {
    return withRequestId(request, NextResponse.next({ request }));
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !pathname.startsWith('/api/')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return withRequestId(request, response);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|.*\\.(?:ico|png|jpg|jpeg|svg|webp|gif)$).*)'],
};
