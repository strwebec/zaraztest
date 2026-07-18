'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAdminAnalytics } from '@/lib/hooks';

const RANGE_OPTIONS: (7 | 30 | 90)[] = [7, 30, 90];

export default function AdminAnalyticsPage() {
  const { t } = useTranslation();
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const { data, isLoading } = useAdminAnalytics(days);

  const daily = data?.daily ?? [];
  const categoryBreakdown = [...(data?.categoryBreakdown ?? [])].sort((a, b) => b.count - a.count);
  const maxCategoryCount = Math.max(1, ...categoryBreakdown.map((c) => c.count));
  const topBusinesses = data?.topBusinesses ?? [];
  const maxBusinessRevenue = Math.max(1, ...topBusinesses.map((b) => b.revenue));
  const summary = data?.summary;

  async function handleExport() {
    if (!data) return;
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();

    const dailySheet = XLSX.utils.json_to_sheet(
      daily.map((d) => ({
        [t('admin.exportColDate')]: d.date,
        [t('admin.completedBookings')]: d.completedBookings,
        [t('admin.clients')]: d.newClients,
        [t('admin.businesses')]: d.newBusinesses,
        [t('admin.exportColRevenue')]: Math.round(d.revenue),
      }))
    );
    XLSX.utils.book_append_sheet(wb, dailySheet, t('admin.platformTrend') as string);

    const categorySheet = XLSX.utils.json_to_sheet(
      categoryBreakdown.map((c) => ({
        [t('admin.exportColCategory')]: c.category,
        [t('admin.exportColCount')]: c.count,
      }))
    );
    XLSX.utils.book_append_sheet(wb, categorySheet, t('admin.categoryBreakdown') as string);

    const topBizSheet = XLSX.utils.json_to_sheet(
      topBusinesses.map((b) => ({
        [t('admin.exportColBusiness')]: b.name,
        [t('admin.completedBookings')]: b.bookings,
        [t('admin.exportColRevenue')]: Math.round(b.revenue),
      }))
    );
    XLSX.utils.book_append_sheet(wb, topBizSheet, t('admin.topBusinesses') as string);

    XLSX.writeFile(wb, `zaraz-analytics-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold tracking-tight text-text">{t('admin.analytics')}</h1>
        <button
          onClick={handleExport}
          disabled={isLoading || !data}
          className="flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-text transition hover:border-primary hover:text-primary disabled:opacity-50"
        >
          <Download size={15} />
          {t('admin.exportExcel')}
        </button>
      </div>

      <div className="flex gap-1.5 rounded-xl border border-border bg-surface p-1 sm:w-fit">
        {RANGE_OPTIONS.map((opt) => (
          <button
            key={opt}
            onClick={() => setDays(opt)}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition sm:flex-none ${
              days === opt ? 'bg-primary text-white' : 'text-text-muted'
            }`}
          >
            {t('biz.rangeDays', { count: opt })}
          </button>
        ))}
      </div>

      {isLoading && <Skeleton className="h-72" />}

      {!isLoading && summary && (
        <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
          <h2 className="mb-4 text-xs font-bold uppercase tracking-wide text-text-muted">{t('admin.financialSummary')}</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">{t('admin.totalGMV')}</span>
              <span className="font-mono text-lg font-bold text-text">{summary.totalGMV.toLocaleString('uk-UA')}₴</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">{t('admin.totalPlatformRevenue')}</span>
              <span className="font-mono text-lg font-bold text-success">{summary.totalPlatformRevenue.toLocaleString('uk-UA')}₴</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">{t('admin.paidThisMonth')}</span>
              <span className="font-mono text-lg font-bold text-text">{summary.paidThisMonth.toLocaleString('uk-UA')}₴</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">{t('admin.outstandingInvoices')}</span>
              <span className="font-mono text-lg font-bold text-warning">{summary.outstandingInvoices.toLocaleString('uk-UA')}₴</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">{t('admin.overdueInvoicesCount')}</span>
              <span className={`font-mono text-lg font-bold ${summary.overdueCount > 0 ? 'text-danger' : 'text-text'}`}>
                {summary.overdueCount}
              </span>
            </div>
          </div>
        </div>
      )}

      {!isLoading && (
        <>
          <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
            <h2 className="mb-4 text-xs font-bold uppercase tracking-wide text-text-muted">
              {t('admin.platformTrend')}
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
                <Line type="monotone" dataKey="completedBookings" name={t('admin.completedBookings') as string} stroke="var(--color-primary)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="newClients" name={t('admin.clients') as string} stroke="var(--color-secondary)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="newBusinesses" name={t('admin.businesses') as string} stroke="var(--color-warning)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
            <h2 className="mb-4 text-xs font-bold uppercase tracking-wide text-text-muted">
              {t('admin.revenueTrend')}
            </h2>
            <ResponsiveContainer width="100%" height={200}>
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
                  formatter={(v: unknown) => `${Math.round(Number(v))}₴`}
                  contentStyle={{
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                />
                <Line type="monotone" dataKey="revenue" name={t('admin.platformRevenue') as string} stroke="var(--color-success)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
              <h2 className="mb-4 text-xs font-bold uppercase tracking-wide text-text-muted">
                {t('admin.categoryBreakdown')}
              </h2>
              {categoryBreakdown.length === 0 && <p className="text-sm text-text-muted">{t('biz.noData')}</p>}
              <div className="flex flex-col gap-2.5">
                {categoryBreakdown.map((c) => (
                  <div key={c.category} className="flex items-center gap-3">
                    <span className="w-28 flex-none truncate text-xs text-text-muted">{c.category}</span>
                    <div className="h-2 flex-1 rounded-full bg-bg">
                      <div
                        className="h-2 rounded-full bg-primary"
                        style={{ width: `${(c.count / maxCategoryCount) * 100}%` }}
                      />
                    </div>
                    <span className="w-6 flex-none text-right font-mono text-xs text-text-muted">{c.count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
              <h2 className="mb-4 text-xs font-bold uppercase tracking-wide text-text-muted">
                {t('admin.topBusinesses')}
              </h2>
              {topBusinesses.length === 0 && <p className="text-sm text-text-muted">{t('biz.noData')}</p>}
              <div className="flex flex-col gap-2.5">
                {topBusinesses.map((b) => (
                  <div key={b.name} className="flex items-center gap-3">
                    <span className="w-28 flex-none truncate text-xs text-text-muted">{b.name}</span>
                    <div className="h-2 flex-1 rounded-full bg-bg">
                      <div
                        className="h-2 rounded-full bg-success"
                        style={{ width: `${(b.revenue / maxBusinessRevenue) * 100}%` }}
                      />
                    </div>
                    <span className="w-16 flex-none text-right font-mono font-tabular text-xs text-text-muted">
                      {Math.round(b.revenue)}₴
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
