'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { LayoutDashboard, Building2, Star, Rocket, Receipt, BarChart3, Users, UserCog, Tags, MapPin, ScrollText, LifeBuoy, LogOut } from 'lucide-react';
import { ClientSidebar, type SidebarTab } from '@/components/client/ClientSidebar';
import { useMe, useLogout, useAdminSupportThreads, useAdminPendingCounts } from '@/lib/hooks';
import { hasAdminPermission } from '@/lib/utils/adminPermissions';
import type { Locale } from '@/lib/i18n';

const ADMIN_ROLES = ['SUPER_ADMIN', 'MODERATOR', 'FINANCE_ADMIN', 'ADMIN'];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const { locale } = useParams<{ locale: Locale }>();
  const { data, isLoading, isError } = useMe();
  const role = data?.user?.role;
  const permissions = data?.user?.permissions;
  const logoutMutation = useLogout();
  const can = (bucket: Parameters<typeof hasAdminPermission>[2]) => hasAdminPermission(role, permissions, bucket);
  const canSupport = can('support');
  const { data: supportData } = useAdminSupportThreads(canSupport);
  const pendingSupportCount = canSupport
    ? (supportData?.threads ?? []).filter((th) => th.status !== 'COMPLETED' && th.lastMessageFrom !== 'admin').length
    : 0;
  const { data: pendingCounts } = useAdminPendingCounts(!!role);

  useEffect(() => {
    if (!isLoading && (isError || !role || !ADMIN_ROLES.includes(role))) {
      router.replace(`/${locale}/login?redirect=${encodeURIComponent(pathname)}`);
    }
  }, [isLoading, isError, role, router, locale, pathname]);

  const tabs = [
    { href: `/${locale}/admin/dashboard`, label: t('admin.dashboard'), icon: LayoutDashboard },
    can('businesses') && {
      href: `/${locale}/admin/businesses`,
      label: t('admin.businesses'),
      icon: Building2,
      badge: pendingCounts?.pendingBusinesses,
    },
    can('users') && {
      href: `/${locale}/admin/users`,
      label: t('admin.users'),
      icon: UserCog,
    },
    can('reviews') && {
      href: `/${locale}/admin/reviews`,
      label: t('admin.reviews'),
      icon: Star,
    },
    can('categories') && {
      href: `/${locale}/admin/categories`,
      label: t('admin.categories'),
      icon: Tags,
    },
    can('categories') && {
      href: `/${locale}/admin/cities`,
      label: t('admin.cities'),
      icon: MapPin,
    },
    can('topPlacements') && {
      href: `/${locale}/admin/top-placements`,
      label: t('admin.topPlacements'),
      icon: Rocket,
      badge: pendingCounts?.pendingTopPlacements,
    },
    can('finance') && {
      href: `/${locale}/admin/invoices`,
      label: t('admin.invoices'),
      icon: Receipt,
      badge: pendingCounts?.pendingInvoices,
    },
    { href: `/${locale}/admin/analytics`, label: t('admin.analytics'), icon: BarChart3 },
    role === 'SUPER_ADMIN' && { href: `/${locale}/admin/team`, label: t('admin.team'), icon: Users },
    role === 'SUPER_ADMIN' && { href: `/${locale}/admin/audit-log`, label: t('admin.auditLog'), icon: ScrollText },
  ].filter(Boolean) as SidebarTab[];

  if (canSupport) {
    tabs.push({
      href: `/${locale}/admin/support`,
      label: t('admin.support'),
      icon: LifeBuoy,
      badge: pendingSupportCount,
    });
  }

  tabs.push({
    label: t('client.logout'),
    icon: LogOut,
    danger: true,
    onClick: () => logoutMutation.mutate(undefined, { onSuccess: () => router.push(`/${locale}`) }),
  });

  if (isLoading || !role || !ADMIN_ROLES.includes(role)) return null;

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
      <div className="flex-1 px-5 py-6 sm:px-8 lg:py-9">{children}</div>
    </div>
  );
}
