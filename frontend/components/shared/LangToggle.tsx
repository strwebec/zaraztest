'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { SUPPORTED_LOCALES, type Locale } from '@/lib/i18n';

export function LangToggle({ locale }: { locale: Locale }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function switchTo(next: Locale) {
    if (next === locale) return;
    const rest = pathname.split('/').slice(2).join('/');
    const query = searchParams.toString();
    router.push(`/${next}${rest ? `/${rest}` : ''}${query ? `?${query}` : ''}`);
  }

  return (
    <div className="flex gap-1 rounded-xl border border-border bg-surface p-1">
      {SUPPORTED_LOCALES.map((l) => (
        <button
          key={l}
          onClick={() => switchTo(l)}
          className={`rounded-lg px-3 py-2 font-mono text-xs font-bold tracking-wide transition ${
            locale === l ? 'bg-primary text-white' : 'text-text-muted hover:text-text'
          }`}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
