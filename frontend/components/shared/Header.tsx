'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { MapPin, LayoutGrid, CalendarDays, Heart, Bell, type LucideIcon } from 'lucide-react';
import { LogoZaraz } from '@/components/logo/LogoZaraz';
import { LangToggle } from './LangToggle';
import { useMe, useNotifications } from '@/lib/hooks';
import { roleHomeHref } from '@/lib/utils/roleHome';
import type { Locale } from '@/lib/i18n';

function HeaderNavTab({
  href,
  label,
  icon: Icon,
  active,
  badge,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  badge?: boolean;
}) {
  return (
    <Link href={href} className="group flex flex-col items-center gap-1 rounded-2xl px-3 py-1.5 transition">

      <span
        className={`relative flex h-9 w-9 items-center justify-center rounded-full transition ${
          active ? 'bg-primary-glow' : 'bg-transparent group-hover:bg-surface2'
        }`}
      >
        <Icon size={19} strokeWidth={active ? 2.25 : 2} className={active ? 'text-primary' : 'text-text-muted group-hover:text-text'} />
        {badge && <span className="absolute right-0 top-0 h-2 w-2 rounded-full bg-danger ring-2 ring-bg" />}
      </span>
      <span className={`text-[11px] font-semibold transition ${active ? 'text-text' : 'text-text-muted group-hover:text-text'}`}>
        {label}
      </span>
    </Link>
  );
}

export function Header({ locale, city }: { locale: Locale; city?: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const { data: meData } = useMe();
  const user = meData?.user;

  // Favorites/notifications are a client concept — business owners and admins have
  // their own equivalents inside their cabinet sidebar, so keep the header lean for them.
  const showClientTools = !user || user.role === 'CLIENT';
  const { data: notifData } = useNotifications(showClientTools && !!user);
  const unreadCount = notifData?.notifications.filter((n) => !n.read).length ?? 0;

  function clientHref(path: string) {
    return user ? `/${locale}/client/${path}` : `/${locale}/login?redirect=${encodeURIComponent(`/${locale}/client/${path}`)}`;
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-bg/85 shadow-xs backdrop-blur-xl transition-all">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex items-center gap-8">
          <Link href={`/${locale}`}>
            <LogoZaraz variant="compact" />
          </Link>
          {city && (
            <button className="hidden items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2 text-sm text-text-muted transition hover:text-text sm:flex">
              <MapPin size={15} className="text-primary" />
              {city}
            </button>
          )}
        </div>
        <nav className="hidden items-center gap-0.5 md:flex">
          <HeaderNavTab
            href={`/${locale}/catalog`}
            label={t('nav.catalog') as string}
            icon={LayoutGrid}
            active={pathname.startsWith(`/${locale}/catalog`)}
          />
          {showClientTools && (
            <>
              <HeaderNavTab
                href={clientHref('bookings')}
                label={t('client.bookings') as string}
                icon={CalendarDays}
                active={pathname.startsWith(`/${locale}/client/bookings`)}
              />
              <HeaderNavTab
                href={clientHref('favorites')}
                label={t('client.favorites') as string}
                icon={Heart}
                active={pathname.startsWith(`/${locale}/client/favorites`)}
              />
              <HeaderNavTab
                href={clientHref('notifications')}
                label={t('client.notifications') as string}
                icon={Bell}
                active={pathname.startsWith(`/${locale}/client/notifications`)}
                badge={unreadCount > 0}
              />
            </>
          )}
        </nav>
        <div className="flex items-center gap-2 sm:gap-3">
          {!user && (
            <Link
              href={`/${locale}/login?tab=register&type=business`}
              className="hidden text-sm font-medium text-text-muted transition hover:text-text lg:block"
            >
              {t('nav.forBusiness')}
            </Link>
          )}
          <Suspense fallback={<div className="h-9 w-[72px] rounded-xl border border-border bg-surface" />}>
            <LangToggle locale={locale} />
          </Suspense>
          {user ? (
            <button
              onClick={() => router.push(roleHomeHref(locale, user.role))}
              className="rounded-xl border border-border bg-surface px-4 py-2.5 text-xs font-semibold text-text transition hover:bg-surface2 sm:px-5 sm:py-3 sm:text-sm"
            >
              {user.name.split(' ')[0]}
            </button>
          ) : (
            <button
              onClick={() => router.push(`/${locale}/login`)}
              className="rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-white transition hover:-translate-y-0.5 hover:bg-primary-hover sm:px-6 sm:py-3 sm:text-sm"
            >
              {t('nav.login')}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
