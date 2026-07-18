'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { LayoutDashboard, CalendarRange, Scissors, Users, Star, Receipt, BarChart3, Settings, Bell, LifeBuoy, LogOut, Contact, Wallet } from 'lucide-react';
import { ClientSidebar } from '@/components/client/ClientSidebar';
import { PendingReviewScreen } from '@/components/business/PendingReviewScreen';
import { useMe, useLogout, useBusinessMe, useBusinessNotifications, useBusinessInvoices } from '@/lib/hooks';
import type { Locale } from '@/lib/i18n';

export default function BusinessAccountLayout({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const { locale } = useParams<{ locale: Locale }>();
  const { data, isLoading, isError } = useMe();
  const logoutMutation = useLogout();
  const isBusinessOwner = !!data?.user && data.user.role === 'BUSINESS_OWNER';
  const { data: businessData } = useBusinessMe({
    refetchInterval: (query) => (query.state.data?.business?.status === 'PENDING' && isBusinessOwner ? 20000 : false),
  });
  const { data: notificationsData } = useBusinessNotifications();
  const unreadCount = (notificationsData?.notifications ?? []).filter((n) => !n.read).length;
  const { data: invoicesData } = useBusinessInvoices();
  const overdueInvoicesCount = (invoicesData?.invoices ?? []).filter((inv) => inv.status === 'OVERDUE').length;

  useEffect(() => {
    if (!isLoading && (isError || !data?.user || data.user.role !== 'BUSINESS_OWNER')) {
      router.replace(`/${locale}/login?redirect=${encodeURIComponent(pathname)}`);
    }
  }, [isLoading, isError, data, router, locale, pathname]);

  const tabs = [
    { href: `/${locale}/business-account/dashboard`, label: t('biz.dashboard'), icon: LayoutDashboard },
    { href: `/${locale}/business-account/notifications`, label: t('client.notifications'), icon: Bell, badge: unreadCount },
    { href: `/${locale}/business-account/settings`, label: t('biz.settings'), icon: Settings },
    { href: `/${locale}/business-account/calendar`, label: t('biz.calendar'), icon: CalendarRange },
    { href: `/${locale}/business-account/clients`, label: t('biz.clients'), icon: Contact },
    { href: `/${locale}/business-account/services`, label: t('biz.services'), icon: Scissors },
    { href: `/${locale}/business-account/staff`, label: t('biz.staff'), icon: Users },
    { href: `/${locale}/business-account/reviews`, label: t('biz.reviews'), icon: Star },
    { href: `/${locale}/business-account/billing`, label: t('biz.billing'), icon: Receipt, badge: overdueInvoicesCount },
    { href: `/${locale}/business-account/analytics`, label: t('biz.analytics'), icon: BarChart3 },
    { href: `/${locale}/business-account/finance`, label: t('biz.finance'), icon: Wallet },
    { href: `/${locale}/business-account/support`, label: t('biz.supportLink'), icon: LifeBuoy },
    {
      label: t('client.logout'),
      icon: LogOut,
      danger: true,
      onClick: () => logoutMutation.mutate(undefined, { onSuccess: () => router.push(`/${locale}`) }),
    },
  ];

  if (isLoading || !data?.user || data.user.role !== 'BUSINESS_OWNER') return null;

  if (!businessData) return null;
  if (businessData.business.status === 'PENDING') {
    return <PendingReviewScreen businessName={businessData.business.name} createdAt={businessData.business.createdAt ?? new Date().toISOString()} />;
  }

  return (
    <div className="mx-auto flex w-full max-w-[1300px] flex-col lg:flex-row">
      <div className="flex gap-2 overflow-x-auto border-b border-border px-5 py-3 lg:hidden">
        {tabs.map((tab) =>
          tab.href ? (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex-none rounded-xl px-4 py-2 text-sm font-semibold transition ${
                pathname === tab.href ? 'bg-primary-glow text-text' : 'text-text-muted'
              }`}
            >
              {tab.label}
              {!!tab.badge && (
                <span className="ml-1.5 rounded-full bg-primary px-1.5 py-0.5 text-[10px] text-white">
                  {tab.badge > 99 ? '99+' : tab.badge}
                </span>
              )}
            </Link>
          ) : (
            <button
              key={tab.label}
              type="button"
              onClick={tab.onClick}
              className="flex-none rounded-xl px-4 py-2 text-sm font-semibold text-danger"
            >
              {tab.label}
            </button>
          )
        )}
      </div>
      <ClientSidebar tabs={tabs} />
      <div className="min-w-0 flex-1 px-5 py-6 sm:px-8 lg:py-9">{children}</div>
    </div>
  );
}
