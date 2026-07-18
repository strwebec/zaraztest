import type { Metadata, Viewport } from 'next';
import { Inter, Unbounded, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-inter',
});
const unbounded = Unbounded({
  subsets: ['latin', 'cyrillic'],
  weight: ['600', '700', '800'],
  variable: '--font-unbounded',
});
const jetbrains = JetBrains_Mono({
  subsets: ['latin', 'cyrillic'],
  weight: ['500', '600', '700'],
  variable: '--font-jetbrains',
});

export const metadata: Metadata = {
  title: 'ZARAZ — запис без дзвінків',
  description: 'Бронювання послуг краси та здоров’я у Стрию без дзвінків.',
};

// viewport-fit=cover lets fixed bars (bottom nav) extend under the notch/home
// indicator area instead of leaving a hard-edged gap — paired with the
// safe-area padding on those bars themselves.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#5e56a8',
};

// middleware.ts stamps a fresh CSP nonce on every request for Next's inline
// hydration scripts. Next's static Full Route Cache reuses one prerendered
// HTML response (with whatever nonce was baked in at render time) for every
// later request regardless of that header, so a cached page's scripts stop
// matching the nonce in the CSP it's served with and the browser blocks all
// of them. Forcing dynamic rendering keeps every response's nonce in sync
// with its own CSP header.
export const dynamic = 'force-dynamic';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uk">
      <body className={`${inter.variable} ${unbounded.variable} ${jetbrains.variable} font-body`}>
        {children}
      </body>
    </html>
  );
}
