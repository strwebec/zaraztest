'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { Skeleton } from '@/components/ui/Skeleton';
import { useBusinessAnalytics } from '@/lib/hooks';
import { Sparkles, TrendingUp, TrendingDown, Download } from 'lucide-react';

const RANGES = [7, 30, 90] as const;

export default function BusinessAnalyticsPage() {
  const { t } = useTranslation();
  const [days, setDays] = useState<(typeof RANGES)[number]>(30);
  const [staffId, setStaffId] = useState<string | undefined>(undefined);
  const { data, isLoading } = useBusinessAnalytics(days, staffId);

  const daily = data?.daily ?? [];
  const topServices = data?.topServices ?? [];
  const sourceSplit = data?.sourceSplit ?? { platform: 0, manual: 0 };
  const staffBreakdown = data?.staffBreakdown ?? [];
  const mvpStaffId = data?.mvpStaffId ?? null;
  const summary = data?.summary;

  async function handleExport() {
    if (!data) return;
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();

    const dailySheet = XLSX.utils.json_to_sheet(
      daily.map((d) => ({
        [t('biz.exportColDate')]: d.date,
        [t('biz.bookings')]: d.bookings,
        [t('biz.exportColRevenue')]: Math.round(d.revenue),
      }))
    );
    XLSX.utils.book_append_sheet(wb, dailySheet, t('biz.exportSheetTrend') as string);

    const servicesSheet = XLSX.utils.json_to_sheet(
      topServices.map((s) => ({
        [t('biz.exportColService')]: s.name,
        [t('biz.bookings')]: s.bookings,
        [t('biz.exportColRevenue')]: Math.round(s.revenue),
      }))
    );
    XLSX.utils.book_append_sheet(wb, servicesSheet, t('biz.exportSheetServices') as string);

    if (staffBreakdown.length > 0) {
      const staffSheet = XLSX.utils.json_to_sheet(
        staffBreakdown.map((s) => ({
          [t('biz.exportColStaff')]: s.name,
          [t('biz.bookings')]: s.bookings,
          [t('biz.exportColRevenue')]: Math.round(s.revenue),
        }))
      );
      XLSX.utils.book_append_sheet(wb, staffSheet, t('biz.exportSheetStaff') as string);
    }

    XLSX.writeFile(wb, `zaraz-analytics-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold text-text">{t('biz.analytics')}</h1>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 rounded-xl border border-border bg-surface p-1">
            {RANGES.map((r) => (
              <button
                key={r}
                onClick={() => setDays(r)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  days === r ? 'bg-primary text-white' : 'text-text-muted'
                }`}
              >
                {t('biz.rangeDays', { count: r })}
              </button>
            ))}
          </div>
          <button
            onClick={handleExport}
            disabled={isLoading || !data}
            className="flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-xs font-semibold text-text transition hover:border-primary hover:text-primary disabled:opacity-50"
          >
            <Download size={14} />
            {t('biz.exportExcel')}
          </button>
        </div>
      </div>

      {!isLoading && summary && (
        <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
          <h2 className="mb-4 text-xs font-bold uppercase tracking-wide text-text-muted">{t('biz.bookingsTrend', { count: days })}</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">{t('biz.bookings')}</span>
              <span className="font-mono text-xl font-bold text-text">{summary.completedBookings}</span>
              {summary.revenueChangePercent !== 0 && (
                <span
                  className={`flex items-center gap-1 text-xs font-semibold ${
                    summary.revenueChangePercent > 0 ? 'text-success' : 'text-danger'
                  }`}
                >
                  {summary.revenueChangePercent > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                  {summary.revenueChangePercent > 0 ? '+' : ''}
                  {summary.revenueChangePercent}% {t('biz.vsPreviousPeriod')}
                </span>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">{t('biz.averageCheck')}</span>
              <span className="font-mono text-xl font-bold text-text">{summary.averageCheck.toLocaleString('uk-UA')}₴</span>
            </div>
          </div>
        </div>
      )}

      {!isLoading && staffBreakdown.length >= 2 && (
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5 shadow-sm">
          <h2 className="text-xs font-bold uppercase tracking-wide text-text-muted">{t('biz.staffEarnings')}</h2>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setStaffId(undefined)}
              className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                !staffId ? 'border-primary bg-primary-glow text-text' : 'border-border text-text-muted hover:border-primary/40'
              }`}
            >
              {t('biz.allStaff')}
            </button>
            {staffBreakdown.map((s) => (
              <button
                key={s.staffId}
                onClick={() => setStaffId(s.staffId)}
                className={`relative flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                  staffId === s.staffId ? 'border-primary bg-primary-glow text-text' : 'border-border text-text-muted hover:border-primary/40'
                }`}
              >
                {s.staffId === mvpStaffId && <Sparkles size={14} className="text-primary" />}
                {s.name}
                <span className="font-mono text-xs opacity-70">{s.revenue}₴</span>
              </button>
            ))}
          </div>
          {mvpStaffId && (
            <p className="flex items-center gap-1.5 text-xs text-text-muted">
              <Sparkles size={13} className="text-primary" />
              {t('biz.mvpBadge')}: {staffBreakdown.find((s) => s.staffId === mvpStaffId)?.name}
            </p>
          )}
        </div>
      )}

      {isLoading && <Skeleton className="h-72" />}

      {!isLoading && (
        <>
          <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
            <h2 className="mb-4 text-xs font-bold uppercase tracking-wide text-text-muted">
              {t('biz.bookingsTrend', { count: days })}
            </h2>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={daily}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(d: string) => d.slice(5)}
                  tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
                  minTickGap={20}
                />
                <YAxis tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                />
                <Line type="monotone" dataKey="bookings" name={t('biz.bookings') as string} stroke="var(--color-primary)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="revenue" name={t('biz.revenue') as string} stroke="var(--color-secondary)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
              <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-text-muted">
                {t('biz.topServices')}
              </h2>
              {topServices.length === 0 && <p className="text-sm text-text-muted">{t('biz.noData')}</p>}
              <div className="flex flex-col gap-3">
                {topServices.map((s) => (
                  <div key={s.serviceId} className="flex items-center justify-between text-sm">
                    <span className="text-text">{s.name}</span>
                    <span className="font-mono text-text-muted">
                      {s.bookings} · {s.revenue}₴
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
              <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-text-muted">
                {t('biz.sourceSplit')}
              </h2>
              <div className="flex flex-col gap-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-text">{t('biz.platform')}</span>
                  <span className="font-mono text-text-muted">{sourceSplit.platform}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-text">{t('biz.manual')}</span>
                  <span className="font-mono text-text-muted">{sourceSplit.manual}</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
