'use client';

import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles } from 'lucide-react';
import { Skeleton } from '@/components/ui/Skeleton';
import { useBusinessInvoices, useConfirmInvoicePayment, useBusinessPaymentRequisites, useBusinessMe } from '@/lib/hooks';
import { freeCommissionDaysLeft } from '@/lib/utils/commission';
import type { Invoice } from '@/lib/utils/api';

const STATUS_STYLE: Record<string, string> = {
  PENDING: 'text-text-muted',
  AWAITING_VERIFICATION: 'text-primary',
  PAID: 'text-success',
  OVERDUE: 'text-warning',
  BLOCKED: 'text-danger',
};

function ConfirmPaymentButton({ invoice }: { invoice: Invoice }) {
  const { t } = useTranslation();
  const confirmPayment = useConfirmInvoicePayment();
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={confirmPayment.isPending}
        className="self-start rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white transition hover:-translate-y-0.5 disabled:opacity-60"
      >
        {t('biz.confirmPayment')}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) confirmPayment.mutate({ id: invoice._id, receipt: file });
          e.target.value = '';
        }}
      />
    </>
  );
}

export default function BusinessBillingPage() {
  const { t } = useTranslation();
  const { data, isLoading } = useBusinessInvoices();
  const { data: requisites } = useBusinessPaymentRequisites();
  const { data: meData } = useBusinessMe();

  const invoices = data?.invoices ?? [];
  const freeDaysLeft = freeCommissionDaysLeft(meData?.business?.createdAt);

  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-display text-2xl font-bold text-text">{t('biz.billing')}</h1>

      {freeDaysLeft !== null && (
        <div className="flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary-glow p-4 text-sm text-text shadow-sm">
          <Sparkles size={18} className="shrink-0 text-primary" />
          <span>{t('biz.freeCommissionBanner', { days: freeDaysLeft })}</span>
        </div>
      )}

      {data?.billing.status !== 'CURRENT' && (
        <div className="rounded-2xl border border-warning/40 bg-warning/10 p-4 text-sm text-warning">
          {t('biz.billingOverdueNotice')}
        </div>
      )}

      <div className="rounded-2xl border border-border bg-surface p-4 text-xs text-text-muted shadow-xs">
        <p className="mb-1 font-bold uppercase tracking-wide">{t('biz.paymentRequisitesTitle')}</p>
        <p className="whitespace-pre-line">{requisites?.commissionRequisites || t('biz.paymentRequisitesText')}</p>
      </div>

      <div className="flex flex-col gap-3">
        {isLoading && Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-24" />)}

        {!isLoading && invoices.length === 0 && (
          <p className="py-10 text-center text-sm text-text-muted">{t('biz.noInvoices')}</p>
        )}

        {!isLoading &&
          invoices.map((inv) => (
            <div key={inv._id} className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-text">{inv.month}</span>
                <span className={`text-xs font-bold ${STATUS_STYLE[inv.status] ?? 'text-text-muted'}`}>
                  {t(`biz.invoiceStatus.${inv.status}`)}
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-xl font-bold text-text">{inv.totalCommission}₴</span>
                <span className="text-xs text-text-muted">{t('biz.invoiceItemsCount', { count: inv.items.length })}</span>
              </div>
              <div className="text-xs text-text-muted">
                {t('biz.invoiceDue', { date: new Date(inv.dueAt).toLocaleDateString() })}
              </div>
              {inv.receiptHistory && inv.receiptHistory.length > 0 && (
                <div className="flex flex-col gap-1 rounded-lg bg-bg p-2.5">
                  <span className="text-[11px] font-bold uppercase tracking-wide text-text-muted">
                    {t('biz.receiptHistory')}
                  </span>
                  {inv.receiptHistory.map((h, i) => (
                    <div key={i} className="text-xs text-text-muted">
                      {h.submittedAt && new Date(h.submittedAt).toLocaleDateString()} —{' '}
                      <span
                        className={
                          h.status === 'ACCEPTED'
                            ? 'text-success'
                            : h.status === 'REJECTED'
                              ? 'text-danger'
                              : 'text-primary'
                        }
                      >
                        {t(`biz.receiptHistoryStatus.${h.status}`)}
                      </span>
                      {h.status === 'REJECTED' && h.rejectedReason && `: ${h.rejectedReason}`}
                    </div>
                  ))}
                </div>
              )}
              {inv.status === 'AWAITING_VERIFICATION' ? (
                <p className="text-xs text-primary">{t('biz.awaitingVerification')}</p>
              ) : (
                inv.status !== 'PAID' && <ConfirmPaymentButton invoice={inv} />
              )}
            </div>
          ))}
      </div>
    </div>
  );
}
