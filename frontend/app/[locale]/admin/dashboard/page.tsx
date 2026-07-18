'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAdminOverview, useAdminBusinesses, useApproveBusiness, useRejectBusiness } from '@/lib/hooks';

export default function AdminDashboardPage() {
  const { t } = useTranslation();
  const { data: overview, isLoading } = useAdminOverview();
  const { data: pendingData, isLoading: pendingLoading } = useAdminBusinesses('PENDING');
  const approve = useApproveBusiness();
  const reject = useRejectBusiness();
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  function submitReject(id: string) {
    reject.mutate({ id, reason: rejectionReason.trim() || undefined });
    setRejectingId(null);
    setRejectionReason('');
  }

  const pending = pendingData?.businesses ?? [];

  const statCards = overview
    ? [
        { label: t('admin.activeBusinesses'), value: overview.activeBusinesses },
        { label: t('admin.pendingBusinesses'), value: overview.pendingBusinesses },
        { label: t('admin.clients'), value: overview.clients },
        { label: t('admin.platformRevenue'), value: `${overview.platformRevenue.toFixed(0)}₴` },
      ]
    : [];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-bold text-text">{t('admin.dashboard')}</h1>

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

      <div className="flex flex-col gap-3">
        <h2 className="text-xs font-bold uppercase tracking-wide text-text-muted">{t('admin.pendingApproval')}</h2>

        {pendingLoading && <Skeleton className="h-16" />}

        {!pendingLoading && pending.length === 0 && (
          <p className="py-6 text-sm text-text-muted">{t('admin.noPending')}</p>
        )}

        {!pendingLoading &&
          pending.map((biz) => (
            <div key={biz._id} className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-1.5">
                <div className="text-sm font-semibold text-text">{biz.name}</div>
                <div className="text-xs text-text-muted">
                  {biz.category} · {biz.owner?.name} · {biz.owner?.email}
                </div>
                {biz.description && <p className="max-w-lg text-xs text-text-muted">{biz.description}</p>}
                {(biz.address || biz.phone) && (
                  <div className="text-xs text-text-muted">
                    {[biz.address, biz.phone].filter(Boolean).join(' · ')}
                  </div>
                )}
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  onClick={() => approve.mutate(biz._id)}
                  className="rounded-lg bg-secondary px-3 py-2 text-xs font-bold text-white"
                >
                  {t('admin.approve')}
                </button>
                <button
                  onClick={() => {
                    setRejectingId(rejectingId === biz._id ? null : biz._id);
                    setRejectionReason('');
                  }}
                  className="rounded-lg border border-danger/40 px-3 py-2 text-xs font-bold text-danger"
                >
                  {t('admin.reject')}
                </button>
              </div>
            </div>
            {rejectingId === biz._id && (
              <div className="flex gap-2">
                <input
                  autoFocus
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder={t('admin.rejectReasonPlaceholder') as string}
                  className="flex-1 rounded-lg border border-border bg-bg px-3 py-2 text-xs text-text outline-none focus:border-danger"
                />
                <button
                  onClick={() => submitReject(biz._id)}
                  className="rounded-lg bg-danger px-3 py-2 text-xs font-bold text-white"
                >
                  {t('admin.reject')}
                </button>
              </div>
            )}
            </div>
          ))}
      </div>
    </div>
  );
}
