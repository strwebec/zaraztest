'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { Skeleton } from '@/components/ui/Skeleton';
import { RequireAdminRole } from '@/components/admin/RequireAdminRole';
import { RequisitesEditor } from '@/components/admin/RequisitesEditor';
import { useAdminInvoices, useAdminFinanceOverview, useMarkInvoicePaid, useRejectInvoiceReceipt } from '@/lib/hooks';
import type { Locale } from '@/lib/i18n';

const STATUS_STYLE: Record<string, string> = {
  PENDING: 'text-text-muted',
  AWAITING_VERIFICATION: 'text-primary',
  PAID: 'text-success',
  OVERDUE: 'text-warning',
  BLOCKED: 'text-danger',
};

const FILTERS = ['AWAITING_VERIFICATION', 'PENDING', 'OVERDUE', 'BLOCKED', 'PAID'] as const;

export default function AdminInvoicesPage() {
  const { t } = useTranslation();
  const { locale } = useParams<{ locale: Locale }>();
  const searchParams = useSearchParams();
  const business = searchParams.get('business') ?? undefined;
  const [status, setStatus] = useState<(typeof FILTERS)[number]>('AWAITING_VERIFICATION');
  const { data, isLoading } = useAdminInvoices(business ? { business } : { status });
  const { data: overview, isLoading: overviewLoading } = useAdminFinanceOverview();
  const markPaid = useMarkInvoicePaid();
  const rejectReceipt = useRejectInvoiceReceipt();

  const invoices = data?.invoices ?? [];

  const overviewCards = overview
    ? [
        { label: t('admin.financeOverdue'), count: overview.overdue.count, total: overview.overdue.total, tone: 'text-danger' },
        { label: t('admin.financePending'), count: overview.pending.count, total: overview.pending.total, tone: 'text-warning' },
        {
          label: t('admin.financeCollected'),
          count: overview.collectedThisMonth.count,
          total: overview.collectedThisMonth.total,
          tone: 'text-success',
        },
      ]
    : [];

  return (
    <RequireAdminRole roles={['SUPER_ADMIN', 'FINANCE_ADMIN']}>
    <div className="flex flex-col gap-5">
      {business && (
        <Link
          href={`/${locale}/admin/businesses/${business}`}
          className="flex w-fit items-center gap-1.5 text-xs font-semibold text-text-muted"
        >
          <ArrowLeft size={14} /> {t('admin.backToBusiness')}
        </Link>
      )}
      <h1 className="font-display text-2xl font-bold tracking-tight text-text">{t('admin.invoices')}</h1>

      {!business && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {overviewLoading
            ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24" />)
            : overviewCards.map((c) => (
                <div key={c.label} className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-5 shadow-sm">
                  <span className="text-[13px] font-medium text-text-muted">{c.label}</span>
                  <span className={`font-mono font-tabular text-2xl font-bold ${c.tone}`}>{c.total}₴</span>
                  <span className="text-xs text-text-muted">{t('admin.financeInvoiceCount', { count: c.count })}</span>
                </div>
              ))}
        </div>
      )}

      {!business && <RequisitesEditor />}

      {!business && (
        <div className="flex gap-1.5 overflow-x-auto rounded-xl border border-border bg-surface p-1 sm:w-fit">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setStatus(f)}
              className={`flex-none rounded-lg px-4 py-2 text-sm font-semibold transition ${
                status === f ? 'bg-primary text-white' : 'text-text-muted'
              }`}
            >
              {t(`biz.invoiceStatus.${f}`)}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col">
        {isLoading && Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="mb-2 h-16" />)}

        {!isLoading && invoices.length === 0 && (
          <p className="py-10 text-center text-sm text-text-muted">{t('admin.noInvoices')}</p>
        )}

        {!isLoading &&
          invoices.map((inv) => {
            const businessName = typeof inv.business === 'string' ? inv.business : inv.business.name;
            return (
              <div key={inv._id} className="flex flex-col gap-2 border-b border-border py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-text">
                      {businessName} · {inv.month}
                    </div>
                    <div className="text-xs text-text-muted">
                      {t('admin.invoiceDue', { date: new Date(inv.dueAt).toLocaleDateString() })}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-mono text-sm font-semibold text-text">{inv.totalCommission}₴</span>
                    <span className={`text-xs font-bold ${STATUS_STYLE[inv.status] ?? 'text-text-muted'}`}>
                      {t(`biz.invoiceStatus.${inv.status}`)}
                    </span>
                    {inv.status !== 'PAID' && (
                      <button
                        onClick={() => markPaid.mutate(inv._id)}
                        className="text-xs font-semibold text-primary"
                      >
                        {t('admin.markPaid')}
                      </button>
                    )}
                  </div>
                </div>
                {inv.status === 'AWAITING_VERIFICATION' && (
                  <div className="flex items-center gap-4">
                    {inv.receiptUrl && (
                      <a
                        href={inv.receiptUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-semibold text-primary underline"
                      >
                        {t('admin.viewReceipt')}
                      </a>
                    )}
                    <button
                      onClick={() => {
                        const reason = window.prompt(t('admin.rejectReceiptReasonPrompt') as string) ?? undefined;
                        rejectReceipt.mutate({ id: inv._id, reason });
                      }}
                      className="text-xs font-semibold text-danger"
                    >
                      {t('admin.rejectReceipt')}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
      </div>
    </div>
    </RequireAdminRole>
  );
}
