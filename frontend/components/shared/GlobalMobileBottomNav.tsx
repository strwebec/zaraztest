'use client';

import { usePathname, useParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { LayoutGrid, CalendarDays, Heart, Bell, User } from 'lucide-react';
import { MobileBottomNav } from './MobileBottomNav';
import { useMe, useNotifications } from '@/lib/hooks';
import type { Locale } from '@/lib/i18n';

// /client/* renders its own copy of this bar inside ClientLayout (it also
// needs the sidebar-aware page padding that only that layout sets up), and a
// booking flow already ends in its own sticky "Confirm booking" button that
// this bar would sit on top of — everywhere else a logged-in client browses
// (home, catalog, their favorites/reviews reached from elsewhere) it should
// stay reachable rather than only existing inside the client cabinet.
const EXCLUDED_PREFIXES = ['/client', '/business/'];

export function GlobalMobileBottomNav() {
  const pathname = usePathname();
  const { t } = useTranslation();
  const { locale } = useParams<{ locale: Locale }>();
  const { data } = useMe();
  const isClient = !!data?.user && data.user.role === 'CLIENT';
  const { data: notificationsData } = useNotifications(isClient);
  const unreadCount = (notificationsData?.notifications ?? []).filter((n) => !n.read).length;

  if (!isClient) return null;

  const withoutLocale = pathname.replace(/^\/[a-z]{2}/, '') || '/';
  if (EXCLUDED_PREFIXES.some((prefix) => withoutLocale.startsWith(prefix))) return null;

  const tabs = [
    { href: `/${locale}`, label: t('nav.catalog') as string, icon: LayoutGrid },
    { href: `/${locale}/client/bookings`, label: t('client.bookings') as string, icon: CalendarDays },
    { href: `/${locale}/client/favorites`, label: t('client.favorites') as string, icon: Heart },
    { href: `/${locale}/client/notifications`, label: t('client.notifications') as string, icon: Bell, badge: unreadCount },
    { href: `/${locale}/client/profile`, label: t('client.profile') as string, icon: User },
  ];

  return <MobileBottomNav tabs={tabs} />;
}
