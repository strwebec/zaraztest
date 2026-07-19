'use client';

import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import i18next, { type Locale } from './i18n';

export function Providers({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // The Render free tier spins the backend down after ~15 min idle and takes
            // 20-50s to wake back up on the next request — the default 3 quick retries
            // (~7s total) give up well before that. Retrying longer here means a cold
            // start self-heals into a normal (if slightly slow) page load instead of
            // surfacing as an error or, worse, a silently-empty result list.
            retry: 5,
            retryDelay: (attemptIndex: number) => Math.min(2000 * 2 ** attemptIndex, 15000),
          },
        },
      })
  );

  useEffect(() => {
    i18next.changeLanguage(locale);
  }, [locale]);

  return (
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18next}>{children}</I18nextProvider>
    </QueryClientProvider>
  );
}
