'use client';

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { Skeleton } from '@/components/ui/Skeleton';
import { RequireAdminRole } from '@/components/admin/RequireAdminRole';
import { useAdminTopPlacements, useConfirmTopPlacement, useRejectTopPlacement } from '@/lib/hooks';
import type { Locale } from '@/lib/i18n';

const PACKAGE_LABEL: Record<string, string> = {
  '1week': '1 тиждень',
  '2weeks': '2 тижні',
  '1month': '1 місяць',
};

export default function AdminTopPlacementsPage() {
  const { t } = useTranslation();
  const { locale } = useParams<{ locale: Locale }>();
  const searchParams = useSearchParams();
  const business = searchParams.get('business') ?? undefined;

  const { data, isLoading } = useAdminTopPlacements(business ? { business } : { status: 'AWAITING_ACTIVATION' });
  const confirm = useConfirmTopPlacement();
  const reject = useRejectTopPlacement();

  const placements = data?.placements ?? [];

  return (
    <RequireAdminRole roles={['SUPER_ADMIN', 'MODERATOR']}>
    <div className="flex flex-col gap-5">
      {business && (
        <Link
          href={`/${locale}/admin/businesses/${business}`}
          className="flex w-fit items-center gap-1.5 text-xs font-semibold text-text-muted"
        >
          <ArrowLeft size={14} /> {t('admin.backToBusiness')}
        </Link>
      )}
      <h1 className="font-display text-2xl font-bold text-text">{t('admin.topPlacements')}</h1>
      {!business && <p className="text-xs text-text-muted">{t('admin.topPlacementsHint')}</p>}

      <div className="flex flex-col gap-3">
        {isLoading && Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20" />)}

        {!isLoading && placements.length === 0 && (
          <p className="py-10 text-center text-sm text-text-muted">{t('admin.noPendingTopPlacements')}</p>
        )}

        {!isLoading &&
          placements.map((p) => {
            const businessName = typeof p.business === 'string' ? p.business : p.business.name;
            return (
              <div
                key={p._id}
                className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="text-sm font-bold text-text">{businessName}</div>
                  <div className="text-xs text-text-muted">
                    {PACKAGE_LABEL[p.package] ?? p.package} · {p.amount}₴ · {t(`biz.topStatus.${p.status}`)}
                  </div>
                  {p.activateAt && p.status === 'AWAITING_ACTIVATION' && (
                    <div className="text-xs text-primary">
                      {t('admin.autoActivatesAt', { time: new Date(p.activateAt).toLocaleTimeString() })}
                    </div>
                  )}
                  {p.rejectionReason && (
                    <div className="text-xs text-danger">
                      {t('admin.rejectionReasonLabel')}: {p.rejectionReason}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {p.receiptUrl && (
                    <a
                      href={p.receiptUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-semibold text-primary underline"
                    >
                      {t('admin.viewReceipt')}
                    </a>
                  )}
                  {p.status === 'AWAITING_ACTIVATION' && (
                    <>
                      <button
                        onClick={() => confirm.mutate(p._id)}
                        className="rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-white"
                      >
                        {t('admin.approve')}
                      </button>
                      <button
                        onClick={() => {
                          const reason = window.prompt(t('admin.rejectReceiptReasonPrompt') as string) ?? undefined;
                          reject.mutate({ id: p._id, reason });
                        }}
                        className="rounded-lg border border-danger/40 px-4 py-1.5 text-xs font-semibold text-danger"
                      >
                        {t('admin.reject')}
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
      </div>
    </div>
    </RequireAdminRole>
  );
}
