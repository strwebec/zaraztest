'use client';

import { useEffect } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { CalendarDays, Heart, Bell, User, LifeBuoy, LogOut } from 'lucide-react';
import { ClientSidebar } from '@/components/client/ClientSidebar';
import { MobileBottomNav } from '@/components/shared/MobileBottomNav';
import { useMe, useLogout, useNotifications } from '@/lib/hooks';
import type { Locale } from '@/lib/i18n';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const { locale } = useParams<{ locale: Locale }>();
  const { data, isLoading, isError } = useMe();
  const logoutMutation = useLogout();
  const isClient = !!data?.user && data.user.role === 'CLIENT';
  const { data: notificationsData } = useNotifications(isClient);
  const unreadCount = (notificationsData?.notifications ?? []).filter((n) => !n.read).length;

  useEffect(() => {
    if (!isLoading && (isError || !data?.user || data.user.role !== 'CLIENT')) {
      router.replace(`/${locale}/login?redirect=${encodeURIComponent(pathname)}`);
    }
  }, [isLoading, isError, data, router, locale, pathname]);

  const tabs = [
    { href: `/${locale}/client/bookings`, label: t('client.bookings'), icon: CalendarDays },
    { href: `/${locale}/client/favorites`, label: t('client.favorites'), icon: Heart },
    { href: `/${locale}/client/notifications`, label: t('client.notifications'), icon: Bell, badge: unreadCount },
    { href: `/${locale}/client/profile`, label: t('client.profile'), icon: User },
  ];

  const sidebarTabs = [
    ...tabs,
    { href: `/${locale}/client/support`, label: t('client.supportLink'), icon: LifeBuoy },
    {
      label: t('client.logout'),
      icon: LogOut,
      danger: true,
      onClick: () => logoutMutation.mutate(undefined, { onSuccess: () => router.push(`/${locale}`) }),
    },
  ];

  if (isLoading || !data?.user || data.user.role !== 'CLIENT') return null;

  return (
    <div className="pb-bottom-nav-safe mx-auto flex w-full max-w-[1200px]">
      <ClientSidebar tabs={sidebarTabs} />
      <div className="flex-1 px-5 py-6 sm:px-8 lg:py-9">{children}</div>
      <MobileBottomNav tabs={tabs} />
    </div>
  );
}
