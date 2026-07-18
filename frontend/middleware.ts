import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Server-side gate for private sections — runs before any page code or client
// component executes. It only checks that an access-token cookie is present
// (the token itself is httpOnly and JWT-verified per request by the backend
// API on every call); actual role authorization stays enforced there and in
// the page-level guards, this just stops an unauthenticated request from ever
// rendering a protected route's markup.
const PROTECTED_PREFIXES = ['/client', '/business-account', '/admin'];

// CSP needs a per-request nonce so Next.js's own inline hydration/RSC-payload
// scripts are allowed to run — a static `script-src 'self'` (no nonce, no
// 'unsafe-inline') blocks those inline scripts in every browser, which silently
// breaks all client-side interactivity site-wide while SSR HTML still renders fine.
// Next.js dev mode compiles every module wrapped in eval() (webpack's
// eval-source-map devtool), so 'unsafe-eval' must be allowed in script-src
// during development or literally no client JS can execute — production
// builds don't use eval() and never get this relaxation.
const IS_DEV = process.env.NODE_ENV !== 'production';

function buildCsp(nonce: string) {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${IS_DEV ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    // Uploaded photos (business covers/galleries, staff, avatars) are served from
    // Cloudinary in production once CLOUDINARY_* env vars are set — without this,
    // the browser silently blocks every one of those images (broken img, alt text
    // shown instead) while the upload itself succeeds and the URL is perfectly valid.
    "img-src 'self' data: https://res.cloudinary.com",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
  ].join('; ');
}

export function middleware(req: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const csp = buildCsp(nonce);

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  const { pathname } = req.nextUrl;
  const segments = pathname.split('/').filter(Boolean);
  const withoutLocale = segments.length > 1 ? `/${segments.slice(1).join('/')}` : '/';
  const isProtected = PROTECTED_PREFIXES.some((prefix) => withoutLocale.startsWith(prefix));

  if (isProtected) {
    const hasSession = Boolean(req.cookies.get('accessToken') || req.cookies.get('refreshToken'));
    if (!hasSession) {
      const locale = segments[0] || 'uk';
      const loginUrl = new URL(`/${locale}/login`, req.url);
      loginUrl.searchParams.set('redirect', pathname);
      const redirect = NextResponse.redirect(loginUrl);
      redirect.headers.set('Content-Security-Policy', csp);
      return redirect;
    }
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
