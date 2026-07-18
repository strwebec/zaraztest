// Content-Security-Policy is set dynamically per-request in middleware.ts (it needs a
// nonce for Next.js's own inline hydration scripts) — do not add a static CSP header
// here too: browsers intersect multiple CSP headers, so a static no-nonce script-src
// here would still block scripts even with the middleware's nonce present.
const SECURITY_HEADERS = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  async headers() {
    return [
      {
        // The CSP nonce is regenerated per-request in middleware.ts, so a cached
        // HTML document — whose inline scripts were stamped with an earlier
        // request's nonce — no longer matches the fresh CSP header on a later
        // response, and the browser blocks every script on the page. Prevent any
        // CDN/proxy from serving a stale copy; this only affects HTML documents,
        // not the content-hashed, natively-immutable /_next/static assets.
        source: '/:path*',
        headers: [...SECURITY_HEADERS, { key: 'Cache-Control', value: 'no-store' }],
      },
      {
        source: '/api/:path*',
        headers: [...SECURITY_HEADERS, { key: 'Cache-Control', value: 'no-store' }],
      },
      {
        source: '/:locale/admin/:path*',
        headers: [
          ...SECURITY_HEADERS,
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, private' },
        ],
      },
    ];
  },
  async rewrites() {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:4000';
    return [
      { source: '/api/:path*', destination: `${backendUrl}/api/:path*` },
      { source: '/uploads/:path*', destination: `${backendUrl}/uploads/:path*` },
    ];
  },
};

module.exports = nextConfig;
