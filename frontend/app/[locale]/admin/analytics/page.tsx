'use client';

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Settings2, Pencil, TrendingUp, TrendingDown, AlertTriangle, Info, CheckCircle2 } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAdminAnalytics, useMonthPlatformLedger, usePlatformLedgerReport } from '@/lib/hooks';
import { PlatformMetricDefinitionsModal } from '@/components/admin/PlatformMetricDefinitionsModal';
import { EditPlatformMetricValueModal } from '@/components/admin/EditPlatformMetricValueModal';
import type { LedgerInsight, LedgerManualField, ReportPeriod } from '@/lib/utils/api';

const RANGE_OPTIONS: (7 | 30 | 90)[] = [7, 30, 90];

function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatFieldValue(field: LedgerManualField) {
  if (field.unit === 'text') return String(field.value || '—');
  if (field.unit === 'percent') return `${field.value}%`;
  if (field.unit === 'currency') return `${Number(field.value).toLocaleString('uk-UA')}₴`;
  return String(field.value);
}

const REPORT_PERIODS: { value: ReportPeriod; labelKey: string }[] = [
  { value: 'month', labelKey: 'admin.payoutPeriodMonth' },
  { value: 'quarter', labelKey: 'biz.reportPeriodQuarter' },
  { value: 'half-year', labelKey: 'biz.reportPeriodHalfYear' },
  { value: '9-months', labelKey: 'biz.reportPeriod9Months' },
  { value: 'year', labelKey: 'biz.reportPeriodYear' },
];

const INSIGHT_STYLE: Record<LedgerInsight['severity'], string> = {
  warning: 'border-warning/40 bg-warning/10 text-warning',
  positive: 'border-success/40 bg-success/10 text-success',
  info: 'border-primary/30 bg-primary-glow text-text',
};

const INSIGHT_ICON: Record<LedgerInsight['severity'], typeof AlertTriangle> = {
  warning: AlertTriangle,
  positive: CheckCircle2,
  info: Info,
};

function InsightList({ insights, emptyKey }: { insights: LedgerInsight[]; emptyKey: string }) {
  const { t } = useTranslation();
  if (insights.length === 0) {
    return <p className="text-sm text-text-muted">{t(emptyKey)}</p>;
  }
  return (
    <div className="flex flex-col gap-2">
      {insights.map((insight, i) => {
        const Icon = INSIGHT_ICON[insight.severity];
        return (
          <div key={i} className={`flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm ${INSIGHT_STYLE[insight.severity]}`}>
            <Icon size={16} className="mt-0.5 flex-none" />
            <span className="leading-relaxed">{insight.text}</span>
          </div>
        );
      })}
    </div>
  );
}

function PlatformPayoutSection() {
  const { t } = useTranslation();
  const [subTab, setSubTab] = useState<'ledger' | 'reports'>('ledger');
  const [month, setMonth] = useState(currentMonthKey());
  const [period, setPeriod] = useState<ReportPeriod>('quarter');
  const [managingColumns, setManagingColumns] = useState(false);
  const [editingField, setEditingField] = useState<LedgerManualField | null>(null);

  const { data: ledger, isLoading: ledgerLoading } = useMonthPlatformLedger(month);
  const { data: report, isLoading: reportLoading } = usePlatformLedgerReport(period);

  const revenueFields = ledger?.manualFields.filter((f) => f.group === 'revenue') ?? [];
  const expenseFields = ledger?.manualFields.filter((f) => f.group === 'expense') ?? [];
  const infoFields = ledger?.manualFields.filter((f) => f.group === 'info') ?? [];

  const chartData = useMemo(
    () => (report?.months ?? []).map((m) => ({ month: m.month, netPayout: m.totals.netPayout, revenue: m.totals.grossRevenue })),
    [report]
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold text-text">{t('admin.payoutTitle')}</h2>
          <p className="mt-1 max-w-2xl text-xs text-text-muted">{t('admin.payoutHint')}</p>
        </div>
        <div className="flex gap-1 rounded-xl border border-border bg-surface p-1">
          <button
            onClick={() => setSubTab('ledger')}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${subTab === 'ledger' ? 'bg-primary text-white' : 'text-text-muted'}`}
          >
            {t('biz.financeLedgerTab')}
          </button>
          <button
            onClick={() => setSubTab('reports')}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${subTab === 'reports' ? 'bg-primary text-white' : 'text-text-muted'}`}
          >
            {t('biz.financeReportsTab')}
          </button>
        </div>
      </div>

      {subTab === 'ledger' && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-text outline-none focus:border-primary"
            />
            <button
              onClick={() => setManagingColumns(true)}
              className="flex items-center gap-1.5 rounded-xl border border-border bg-surface px-4 py-2.5 text-xs font-bold text-text transition hover:border-primary"
            >
              <Settings2 size={14} />
              {t('biz.ledgerManageColumns')}
            </button>
          </div>

          {ledgerLoading && <Skeleton className="h-96" />}

          {!ledgerLoading && ledger && (
            <>
              <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
                <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-text-muted">{t('biz.ledgerInsightsTitle')}</h3>
                <InsightList insights={ledger.insights} emptyKey="biz.ledgerNoInsights" />
              </div>

              <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 [font-variant-numeric:tabular-nums]">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-text-muted">{t('biz.ledgerGrossRevenue')}</span>
                    <span className="font-mono text-xl font-bold text-text">{ledger.totals.grossRevenue.toLocaleString('uk-UA')}₴</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-text-muted">{t('biz.ledgerTotalExpenses')}</span>
                    <span className="font-mono text-xl font-bold text-danger">{ledger.totals.totalExpenses.toLocaleString('uk-UA')}₴</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-text-muted">{t('admin.payoutNetPayout')}</span>
                    <span className={`font-mono text-xl font-bold ${ledger.totals.netPayout >= 0 ? 'text-success' : 'text-danger'}`}>
                      {ledger.totals.netPayout.toLocaleString('uk-UA')}₴
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-text-muted">{t('biz.ledgerMargin')}</span>
                    <span className="flex items-center gap-1 font-mono text-xl font-bold text-text">
                      {ledger.totals.marginPercent >= 0 ? (
                        <TrendingUp size={16} className="text-success" />
                      ) : (
                        <TrendingDown size={16} className="text-danger" />
                      )}
                      {ledger.totals.marginPercent}%
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
                <h3 className="text-xs font-bold uppercase tracking-wide text-text-muted">{t('admin.payoutAutoStats')}</h3>
                <p className="mt-1 text-xs text-text-muted">{t('admin.payoutAutoStatsHint')}</p>
                <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 [font-variant-numeric:tabular-nums]">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-text-muted">{t('admin.payoutCollectedCommission')}</span>
                    <span className="font-mono text-sm font-bold text-text">{ledger.auto.collectedCommission.toLocaleString('uk-UA')}₴</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-text-muted">{t('admin.payoutCollectedTop')}</span>
                    <span className="font-mono text-sm font-bold text-text">{ledger.auto.collectedTopPlacements.toLocaleString('uk-UA')}₴</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-text-muted">{t('admin.payoutAccruedCommission')}</span>
                    <span className="font-mono text-sm font-bold text-text-muted">{ledger.auto.accruedCommission.toLocaleString('uk-UA')}₴</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-text-muted">{t('admin.payoutInvoicesPaidCount')}</span>
                    <span className="font-mono text-sm font-bold text-text">{ledger.auto.invoicesPaidCount}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-text-muted">{t('admin.payoutTopPlacementsCount')}</span>
                    <span className="font-mono text-sm font-bold text-text">{ledger.auto.topPlacementsPaidCount}</span>
                  </div>
                </div>
                <p className="mt-4 text-xs text-text-muted">{t('admin.payoutAccruedHint')}</p>
              </div>

              <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
                <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-text-muted">{t('biz.ledgerManualFields')}</h3>
                {ledger.manualFields.length === 0 ? (
                  <p className="text-sm text-text-muted">{t('biz.ledgerNoManualFields')}</p>
                ) : (
                  <div className="flex flex-col gap-4">
                    {[
                      { key: 'revenue', fields: revenueFields },
                      { key: 'expense', fields: expenseFields },
                      { key: 'info', fields: infoFields },
                    ]
                      .filter((g) => g.fields.length > 0)
                      .map((g) => (
                        <div key={g.key} className="flex flex-col gap-2">
                          <span className="text-[11px] font-bold uppercase tracking-wide text-text-muted">
                            {t(`biz.ledgerGroup${g.key === 'revenue' ? 'Revenue' : g.key === 'expense' ? 'Expense' : 'Info'}`)}
                          </span>
                          {g.fields.map((f) => (
                            <div
                              key={f.key}
                              className="flex items-center justify-between gap-3 rounded-xl border border-border bg-bg px-3.5 py-2.5"
                            >
                              <span className="text-sm font-semibold text-text">{f.label}</span>
                              <div className="flex items-center gap-3">
                                <span className="font-mono text-sm text-text">{formatFieldValue(f)}</span>
                                <button
                                  onClick={() => setEditingField(f)}
                                  className="rounded-lg p-1.5 text-text-muted transition hover:bg-primary-glow hover:text-primary"
                                >
                                  <Pencil size={14} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}

      {subTab === 'reports' && (
        <>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {REPORT_PERIODS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={`flex-none rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                  period === p.value ? 'border-primary bg-primary-glow text-text' : 'border-border text-text-muted hover:border-primary/40'
                }`}
              >
                {t(p.labelKey)}
              </button>
            ))}
          </div>

          {reportLoading && <Skeleton className="h-96" />}

          {!reportLoading && report && (
            <>
              <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
                <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-text-muted">{t('biz.ledgerInsightsTitle')}</h3>
                <InsightList insights={report.insights} emptyKey="biz.ledgerNoInsights" />
              </div>

              <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
                <h3 className="mb-4 text-xs font-bold uppercase tracking-wide text-text-muted">{t('biz.reportTotals')}</h3>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-text-muted">{t('biz.ledgerGrossRevenue')}</span>
                    <span className="font-mono text-xl font-bold text-text">{report.totals.grossRevenue.toLocaleString('uk-UA')}₴</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-text-muted">{t('biz.ledgerTotalExpenses')}</span>
                    <span className="font-mono text-xl font-bold text-danger">{report.totals.totalExpenses.toLocaleString('uk-UA')}₴</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-text-muted">{t('admin.payoutNetPayout')}</span>
                    <span className={`font-mono text-xl font-bold ${report.totals.netPayout >= 0 ? 'text-success' : 'text-danger'}`}>
                      {report.totals.netPayout.toLocaleString('uk-UA')}₴
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-text-muted">{t('biz.ledgerMargin')}</span>
                    <span className="font-mono text-xl font-bold text-text">{report.totals.marginPercent}%</span>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
                <h3 className="mb-4 text-xs font-bold uppercase tracking-wide text-text-muted">{t('biz.reportTrend')}</h3>
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} />
                    <Tooltip
                      contentStyle={{
                        background: 'var(--color-surface)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 12,
                        fontSize: 12,
                      }}
                    />
                    <Line type="monotone" dataKey="revenue" name={t('biz.ledgerGrossRevenue') as string} stroke="var(--color-secondary)" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="netPayout" name={t('admin.payoutNetPayout') as string} stroke="var(--color-primary)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </>
      )}

      {managingColumns && <PlatformMetricDefinitionsModal onClose={() => setManagingColumns(false)} />}
      {editingField && ledger && (
        <EditPlatformMetricValueModal month={ledger.month} field={editingField} onClose={() => setEditingField(null)} />
      )}
    </div>
  );
}

export default function AdminAnalyticsPage() {
  const { t } = useTranslation();
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const [mainTab, setMainTab] = useState<'overview' | 'payout'>('overview');
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
        {mainTab === 'overview' && (
          <button
            onClick={handleExport}
            disabled={isLoading || !data}
            className="flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-text transition hover:border-primary hover:text-primary disabled:opacity-50"
          >
            <Download size={15} />
            {t('admin.exportExcel')}
          </button>
        )}
      </div>

      <div className="flex gap-1.5 rounded-xl border border-border bg-surface p-1 sm:w-fit">
        <button
          onClick={() => setMainTab('overview')}
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition sm:flex-none ${
            mainTab === 'overview' ? 'bg-primary text-white' : 'text-text-muted'
          }`}
        >
          {t('admin.analyticsOverviewTab')}
        </button>
        <button
          onClick={() => setMainTab('payout')}
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition sm:flex-none ${
            mainTab === 'payout' ? 'bg-primary text-white' : 'text-text-muted'
          }`}
        >
          {t('admin.payoutTab')}
        </button>
      </div>

      {mainTab === 'payout' && <PlatformPayoutSection />}

      {mainTab === 'overview' && (
        <>
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
        </>
      )}
    </div>
  );
}
