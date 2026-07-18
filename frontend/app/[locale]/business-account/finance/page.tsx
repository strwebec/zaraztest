'use client';

import { useMemo, useState } from 'react';
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
import { MetricDefinitionsModal } from '@/components/business/MetricDefinitionsModal';
import { EditMetricValueModal } from '@/components/business/EditMetricValueModal';
import { useMonthLedger, useLedgerReport, useBusinessExpenses, useCreateExpense, useDeleteExpense } from '@/lib/hooks';
import type { LedgerInsight, LedgerManualField, ReportPeriod } from '@/lib/utils/api';
import { Settings2, Pencil, TrendingUp, TrendingDown, AlertTriangle, Info, CheckCircle2, Plus, Trash2, Download } from 'lucide-react';
import { toDateKey } from '@/lib/utils/dates';

const EXPENSE_RANGES = [7, 30, 90] as const;

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

export default function BusinessFinancePage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'ledger' | 'reports'>('ledger');
  const [month, setMonth] = useState(currentMonthKey());
  const [period, setPeriod] = useState<ReportPeriod>('quarter');
  const [managingColumns, setManagingColumns] = useState(false);
  const [editingField, setEditingField] = useState<LedgerManualField | null>(null);

  const { data: ledger, isLoading: ledgerLoading } = useMonthLedger(month);
  const { data: report, isLoading: reportLoading } = useLedgerReport(period);

  const [expDays, setExpDays] = useState<(typeof EXPENSE_RANGES)[number]>(30);
  const { data: expensesData, isLoading: expensesLoading } = useBusinessExpenses(expDays);
  const createExpense = useCreateExpense();
  const deleteExpense = useDeleteExpense();
  const [expCategory, setExpCategory] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expDate, setExpDate] = useState(() => toDateKey(new Date()));
  const [expNote, setExpNote] = useState('');
  const [expError, setExpError] = useState<string | null>(null);
  const expenses = expensesData?.expenses ?? [];

  function handleAddExpense(e: React.FormEvent) {
    e.preventDefault();
    const amount = Number(expAmount);
    if (!expCategory.trim() || !Number.isFinite(amount) || amount <= 0) {
      setExpError(t('biz.invalidExpense') as string);
      return;
    }
    setExpError(null);
    createExpense.mutate(
      { category: expCategory.trim(), amount, date: expDate, note: expNote.trim() || undefined },
      {
        onSuccess: () => {
          setExpCategory('');
          setExpAmount('');
          setExpNote('');
        },
        onError: () => setExpError(t('auth.genericError') as string),
      }
    );
  }

  function handleDeleteExpense(exp: { _id: string; category: string; amount: number }) {
    if (!window.confirm(t('biz.deleteExpenseConfirm', { category: exp.category, amount: exp.amount }) as string)) return;
    setExpError(null);
    deleteExpense.mutate(exp._id, { onError: () => setExpError(t('auth.genericError') as string) });
  }

  const revenueFields = ledger?.manualFields.filter((f) => f.group === 'revenue') ?? [];
  const expenseFields = ledger?.manualFields.filter((f) => f.group === 'expense') ?? [];
  const infoFields = ledger?.manualFields.filter((f) => f.group === 'info') ?? [];

  const chartData = useMemo(
    () => (report?.months ?? []).map((m) => ({ month: m.month, netProfit: m.totals.netProfit, revenue: m.totals.grossRevenue })),
    [report]
  );

  async function handleExportLedger() {
    if (!ledger) return;
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();

    const totalsSheet = XLSX.utils.json_to_sheet([
      {
        [t('biz.ledgerGrossRevenue')]: Math.round(ledger.totals.grossRevenue),
        [t('biz.ledgerTotalExpenses')]: Math.round(ledger.totals.totalExpenses),
        [t('biz.ledgerNetProfit')]: Math.round(ledger.totals.netProfit),
        [t('biz.ledgerMargin')]: ledger.totals.marginPercent,
      },
    ]);
    XLSX.utils.book_append_sheet(wb, totalsSheet, t('biz.ledgerTotalsSheet') as string);

    if (ledger.manualFields.length > 0) {
      const fieldsSheet = XLSX.utils.json_to_sheet(
        ledger.manualFields.map((f) => ({
          [t('biz.metricLabel')]: f.label,
          [t('biz.exportColRevenue')]: f.value,
        }))
      );
      XLSX.utils.book_append_sheet(wb, fieldsSheet, t('biz.ledgerManualFields') as string);
    }

    if (expenses.length > 0) {
      const expensesSheet = XLSX.utils.json_to_sheet(
        expenses.map((exp) => ({
          [t('biz.expenseCategoryPlaceholder')]: exp.category,
          [t('biz.exportColDate')]: exp.date,
          [t('biz.expenseAmount')]: exp.amount,
          [t('biz.expenseNote')]: exp.note ?? '',
        }))
      );
      XLSX.utils.book_append_sheet(wb, expensesSheet, t('biz.expenses') as string);
    }

    XLSX.writeFile(wb, `zaraz-ledger-${ledger.month}.xlsx`);
  }

  async function handleExportReport() {
    if (!report) return;
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();

    const monthsSheet = XLSX.utils.json_to_sheet(
      report.months.map((m) => ({
        [t('biz.exportColDate')]: m.month,
        [t('biz.ledgerGrossRevenue')]: Math.round(m.totals.grossRevenue),
        [t('biz.ledgerTotalExpenses')]: Math.round(m.totals.totalExpenses),
        [t('biz.ledgerNetProfit')]: Math.round(m.totals.netProfit),
        [t('biz.ledgerMargin')]: m.totals.marginPercent,
      }))
    );
    XLSX.utils.book_append_sheet(wb, monthsSheet, t('biz.exportSheetTrend') as string);

    XLSX.writeFile(wb, `zaraz-report-${period}-${report.endMonth}.xlsx`);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold text-text">{t('biz.finance')}</h1>
        <div className="flex gap-1 rounded-xl border border-border bg-surface p-1">
          <button
            onClick={() => setTab('ledger')}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${tab === 'ledger' ? 'bg-primary text-white' : 'text-text-muted'}`}
          >
            {t('biz.financeLedgerTab')}
          </button>
          <button
            onClick={() => setTab('reports')}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${tab === 'reports' ? 'bg-primary text-white' : 'text-text-muted'}`}
          >
            {t('biz.financeReportsTab')}
          </button>
        </div>
      </div>

      {tab === 'ledger' && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-text outline-none focus:border-primary"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportLedger}
                disabled={!ledger}
                className="flex items-center gap-1.5 rounded-xl border border-border bg-surface px-4 py-2.5 text-xs font-bold text-text transition hover:border-primary disabled:opacity-50"
              >
                <Download size={14} />
                {t('biz.exportExcel')}
              </button>
              <button
                onClick={() => setManagingColumns(true)}
                className="flex items-center gap-1.5 rounded-xl border border-border bg-surface px-4 py-2.5 text-xs font-bold text-text transition hover:border-primary"
              >
                <Settings2 size={14} />
                {t('biz.ledgerManageColumns')}
              </button>
            </div>
          </div>

          {ledgerLoading && <Skeleton className="h-96" />}

          {!ledgerLoading && ledger && (
            <>
              <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
                <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-text-muted">{t('biz.ledgerInsightsTitle')}</h2>
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
                    <span className="text-xs text-text-muted">{t('biz.ledgerNetProfit')}</span>
                    <span className={`font-mono text-xl font-bold ${ledger.totals.netProfit >= 0 ? 'text-success' : 'text-danger'}`}>
                      {ledger.totals.netProfit.toLocaleString('uk-UA')}₴
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
                <h2 className="text-xs font-bold uppercase tracking-wide text-text-muted">{t('biz.ledgerAutoStats')}</h2>
                <p className="mt-1 text-xs text-text-muted">{t('biz.ledgerAutoStatsHint')}</p>
                <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6 [font-variant-numeric:tabular-nums]">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-text-muted">{t('biz.ledgerAutoRevenue')}</span>
                    <span className="font-mono text-sm font-bold text-text">{ledger.auto.revenue.toLocaleString('uk-UA')}₴</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-text-muted">{t('biz.ledgerCommission')}</span>
                    <span className="font-mono text-sm font-bold text-text">{ledger.auto.commission.toLocaleString('uk-UA')}₴</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-text-muted">{t('biz.ledgerAutoExpenses')}</span>
                    <span className="font-mono text-sm font-bold text-text">{ledger.auto.expenseTotal.toLocaleString('uk-UA')}₴</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-text-muted">{t('biz.ledgerBookingsCount')}</span>
                    <span className="font-mono text-sm font-bold text-text">{ledger.auto.bookingsCount}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-text-muted">{t('biz.ledgerAvgCheck')}</span>
                    <span className="font-mono text-sm font-bold text-text">{ledger.auto.averageCheck.toLocaleString('uk-UA')}₴</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-text-muted">{t('biz.ledgerCancellationRate')}</span>
                    <span className="font-mono text-sm font-bold text-text">{ledger.auto.cancellationRatePercent}%</span>
                  </div>
                </div>
                {ledger.auto.topExpenseCategory && (
                  <p className="mt-4 text-xs text-text-muted">
                    {t('biz.ledgerTopExpenseCategory', {
                      category: ledger.auto.topExpenseCategory.category,
                      amount: ledger.auto.topExpenseCategory.amount,
                    })}
                  </p>
                )}
              </div>

              {!expensesLoading && (
                <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-xs font-bold uppercase tracking-wide text-text-muted">{t('biz.expenses')}</h2>
                      <p className="mt-1 text-xs text-text-muted">{t('biz.expensesHint')}</p>
                    </div>
                    <div className="flex gap-1 rounded-xl border border-border bg-bg p-1">
                      {EXPENSE_RANGES.map((r) => (
                        <button
                          key={r}
                          onClick={() => setExpDays(r)}
                          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                            expDays === r ? 'bg-primary text-white' : 'text-text-muted'
                          }`}
                        >
                          {t('biz.rangeDays', { count: r })}
                        </button>
                      ))}
                    </div>
                  </div>

                  <form onSubmit={handleAddExpense} className="grid grid-cols-1 gap-3 sm:grid-cols-[1.5fr_1fr_1fr_1.5fr_auto]">
                    <input
                      value={expCategory}
                      onChange={(e) => setExpCategory(e.target.value)}
                      placeholder={t('biz.expenseCategoryPlaceholder') as string}
                      required
                      className="rounded-xl border border-border bg-bg px-3.5 py-2.5 text-sm text-text outline-none focus:border-primary"
                    />
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={expAmount}
                      onChange={(e) => setExpAmount(e.target.value)}
                      placeholder={t('biz.expenseAmount') as string}
                      required
                      className="rounded-xl border border-border bg-bg px-3.5 py-2.5 text-sm text-text outline-none focus:border-primary"
                    />
                    <input
                      type="date"
                      value={expDate}
                      max={toDateKey(new Date())}
                      onChange={(e) => setExpDate(e.target.value)}
                      required
                      className="rounded-xl border border-border bg-bg px-3.5 py-2.5 text-sm text-text outline-none focus:border-primary"
                    />
                    <input
                      value={expNote}
                      onChange={(e) => setExpNote(e.target.value)}
                      placeholder={t('biz.expenseNote') as string}
                      className="rounded-xl border border-border bg-bg px-3.5 py-2.5 text-sm text-text outline-none focus:border-primary"
                    />
                    <button
                      type="submit"
                      disabled={createExpense.isPending}
                      className="flex items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white transition hover:-translate-y-0.5 disabled:opacity-60"
                    >
                      <Plus size={15} />
                      <span className="sm:hidden">{t('biz.addExpense')}</span>
                    </button>
                  </form>

                  {expError && <p className="text-xs text-danger">{expError}</p>}

                  {expenses.length === 0 && <p className="text-sm text-text-muted">{t('biz.noExpensesYet')}</p>}

                  {expenses.length > 0 && (
                    <div className="flex flex-col gap-2">
                      {expenses.map((exp) => (
                        <div key={exp._id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-bg px-3.5 py-2.5">
                          <div className="flex flex-col">
                            <span className="text-sm font-semibold text-text">{exp.category}</span>
                            <span className="text-xs text-text-muted">
                              {exp.date}
                              {exp.note ? ` · ${exp.note}` : ''}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-sm font-bold text-danger">{exp.amount.toLocaleString('uk-UA')}₴</span>
                            <button
                              onClick={() => handleDeleteExpense(exp)}
                              disabled={deleteExpense.isPending}
                              className="rounded-lg p-1.5 text-text-muted transition hover:bg-danger/10 hover:text-danger disabled:opacity-60"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
                <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-text-muted">{t('biz.ledgerManualFields')}</h2>
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

      {tab === 'reports' && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
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
            <button
              onClick={handleExportReport}
              disabled={!report}
              className="flex items-center gap-1.5 rounded-xl border border-border bg-surface px-4 py-2.5 text-xs font-bold text-text transition hover:border-primary disabled:opacity-50"
            >
              <Download size={14} />
              {t('biz.exportExcel')}
            </button>
          </div>

          {reportLoading && <Skeleton className="h-96" />}

          {!reportLoading && report && (
            <>
              <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
                <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-text-muted">{t('biz.ledgerInsightsTitle')}</h2>
                <InsightList insights={report.insights} emptyKey="biz.ledgerNoInsights" />
              </div>

              <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
                <h2 className="mb-4 text-xs font-bold uppercase tracking-wide text-text-muted">{t('biz.reportTotals')}</h2>
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
                    <span className="text-xs text-text-muted">{t('biz.ledgerNetProfit')}</span>
                    <span className={`font-mono text-xl font-bold ${report.totals.netProfit >= 0 ? 'text-success' : 'text-danger'}`}>
                      {report.totals.netProfit.toLocaleString('uk-UA')}₴
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-text-muted">{t('biz.ledgerMargin')}</span>
                    <span className="font-mono text-xl font-bold text-text">{report.totals.marginPercent}%</span>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
                <h2 className="mb-4 text-xs font-bold uppercase tracking-wide text-text-muted">{t('biz.reportTrend')}</h2>
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
                    <Line type="monotone" dataKey="netProfit" name={t('biz.ledgerNetProfit') as string} stroke="var(--color-primary)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </>
      )}

      {managingColumns && <MetricDefinitionsModal onClose={() => setManagingColumns(false)} />}
      {editingField && ledger && (
        <EditMetricValueModal month={ledger.month} field={editingField} onClose={() => setEditingField(null)} />
      )}
    </div>
  );
}
