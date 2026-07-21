'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { ArrowRight, CalendarPlus, Sparkles } from 'lucide-react';
import { Skeleton } from '@/components/ui/Skeleton';
import { TopPromotionCard } from '@/components/business/TopPromotionCard';
import { InfoModal } from '@/components/shared/InfoModal';
import { useBusinessMe, useBusinessStats, useBusinessBookings } from '@/lib/hooks';
import { toDateKey } from '@/lib/utils/dates';
import { freeCommissionDaysLeft } from '@/lib/utils/commission';
import type { Locale } from '@/lib/i18n';

const STATUS_STYLE: Record<string, string> = {
  confirmed: 'text-success bg-success/10',
  completed: 'text-text-muted bg-surface2',
  cancelled_by_client: 'text-danger bg-danger/10',
  cancelled_by_business: 'text-danger bg-danger/10',
  no_show: 'text-warning bg-warning/10',
};

export default function BusinessDashboardPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { locale } = useParams<{ locale: Locale }>();
  const { data: bizData } = useBusinessMe();
  const { data: stats, isLoading } = useBusinessStats();
  const [showRatingInfo, setShowRatingInfo] = useState(false);
  const today = toDateKey(new Date());
  const { data: bookingsData, isLoading: bookingsLoading } = useBusinessBookings(today);

  const business = bizData?.business;
  const freeDaysLeft = freeCommissionDaysLeft(business?.createdAt);

  const upcoming = (bookingsData?.bookings ?? [])
    .filter((b) => b.date === today && !b.status.startsWith('cancelled'))
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const statCards = stats
    ? [
        { label: t('biz.bookingsToday'), value: stats.bookingsToday },
        { label: t('biz.bookingsWeek'), value: stats.bookingsWeek },
        { label: t('biz.revenueToday'), value: `${stats.revenueToday}₴` },
        { label: t('biz.revenueMonth'), value: `${stats.revenueMonth}₴` },
      ]
    : [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold tracking-tight text-text">
          {business?.name ?? t('biz.dashboard')}
        </h1>
        <button
          onClick={() => router.push(`/${locale}/business-account/calendar`)}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-hover"
        >
          <CalendarPlus size={16} />
          {t('biz.manualBooking')}
        </button>
      </div>

      {freeDaysLeft !== null && (
        <div className="flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary-glow p-4 text-sm text-text shadow-sm">
          <Sparkles size={18} className="shrink-0 text-primary" />
          <span>{t('biz.freeCommissionBanner', { days: freeDaysLeft })}</span>
        </div>
      )}

      {business?.status === 'BLOCKED' && business.rejectionReason && (
        <div className="rounded-2xl border border-danger/40 bg-danger/10 p-4 text-sm text-danger">
          {t('biz.rejectedNotice', { reason: business.rejectionReason })}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)
          : statCards.map((card) => (
              <div
                key={card.label}
                className="flex flex-col gap-2.5 rounded-2xl border border-border bg-surface p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <span className="text-[13px] font-medium text-text-muted">{card.label}</span>
                <span className="font-mono font-tabular text-2xl font-bold text-text">{card.value}</span>
              </div>
            ))}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.6fr_1fr]">
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-bold text-text">{t('biz.upcomingBookings')}</h2>
            <button
              onClick={() => router.push(`/${locale}/business-account/calendar`)}
              className="flex items-center gap-1 text-xs font-semibold text-primary"
            >
              {t('biz.toCalendar')}
              <ArrowRight size={13} />
            </button>
          </div>

          {bookingsLoading && (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-14" />
              ))}
            </div>
          )}

          {!bookingsLoading && upcoming.length === 0 && (
            <p className="py-8 text-center text-sm text-text-muted">{t('biz.noBookingsToday')}</p>
          )}

          {!bookingsLoading && upcoming.length > 0 && (
            <div className="flex flex-col">
              {upcoming.map((bk) => (
                <div
                  key={bk._id}
                  className="flex items-center gap-3.5 border-b border-surface2 py-3 last:border-0"
                >
                  <span className="w-12 flex-none font-mono font-tabular text-sm font-bold text-text">
                    {bk.startTime}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-text">{bk.clientName}</div>
                    <div className="truncate text-xs text-text-muted">
                      {bk.service.name} · {bk.staff.name}
                    </div>
                  </div>
                  <span
                    className={`flex-none rounded-full px-2.5 py-1 text-xs font-semibold ${
                      STATUS_STYLE[bk.status] ?? 'bg-surface2 text-text-muted'
                    }`}
                  >
                    {t(`biz.status.${bk.status}`)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-5">
          {stats && (
            <button
              onClick={() => setShowRatingInfo(true)}
              className="rounded-2xl border border-border bg-surface p-5 text-left shadow-sm transition hover:border-primary"
            >
              <div className="mb-2 text-[13px] font-medium text-text-muted">{t('biz.rating')}</div>
              <div className="font-mono font-tabular text-2xl font-bold text-text">{stats.rating.toFixed(1)}</div>
              <div className="mt-1 text-[11px] font-semibold text-primary">{t('biz.ratingHowCalculated')}</div>
            </button>
          )}
          <TopPromotionCard />
        </div>
      </div>

      {showRatingInfo && (
        <InfoModal title={t('biz.ratingInfoTitle') as string} onClose={() => setShowRatingInfo(false)}>
          <p>{t('biz.ratingInfoPlatform')}</p>
          <p>{t('biz.ratingInfoGoogle')}</p>
        </InfoModal>
      )}
    </div>
  );
}
