'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAdminRequisites, useUpdateAdminRequisites } from '@/lib/hooks';
import { Skeleton } from '@/components/ui/Skeleton';

export function RequisitesEditor() {
  const { t } = useTranslation();
  const { data, isLoading } = useAdminRequisites();
  const update = useUpdateAdminRequisites();

  const [commission, setCommission] = useState('');
  const [topPlacement, setTopPlacement] = useState('');
  const [saved, setSaved] = useState<'commission' | 'top' | null>(null);

  useEffect(() => {
    if (data) {
      setCommission(data.commissionRequisites);
      setTopPlacement(data.topPlacementRequisites);
    }
  }, [data]);

  async function saveCommission() {
    await update.mutateAsync({ commissionRequisites: commission });
    setSaved('commission');
    setTimeout(() => setSaved(null), 2000);
  }

  async function saveTop() {
    await update.mutateAsync({ topPlacementRequisites: topPlacement });
    setSaved('top');
    setTimeout(() => setSaved(null), 2000);
  }

  if (isLoading) return <Skeleton className="h-64" />;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="flex flex-col gap-2.5 rounded-2xl border border-border bg-surface p-5 shadow-sm">
        <h3 className="text-xs font-bold uppercase tracking-wide text-text-muted">
          {t('admin.commissionRequisitesTitle')}
        </h3>
        <p className="text-xs text-text-muted">{t('admin.requisitesHint')}</p>
        <textarea
          value={commission}
          onChange={(e) => setCommission(e.target.value)}
          rows={6}
          className="resize-none rounded-xl border border-border bg-bg px-4 py-3 font-mono text-xs text-text outline-none focus:border-primary"
        />
        <button
          onClick={saveCommission}
          disabled={update.isPending}
          className="self-start rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white transition hover:bg-primary-hover disabled:opacity-60"
        >
          {saved === 'commission' ? t('admin.requisitesSaved') : t('admin.requisitesSave')}
        </button>
      </div>

      <div className="flex flex-col gap-2.5 rounded-2xl border border-border bg-surface p-5 shadow-sm">
        <h3 className="text-xs font-bold uppercase tracking-wide text-text-muted">
          {t('admin.topRequisitesTitle')}
        </h3>
        <p className="text-xs text-text-muted">{t('admin.requisitesHint')}</p>
        <textarea
          value={topPlacement}
          onChange={(e) => setTopPlacement(e.target.value)}
          rows={6}
          className="resize-none rounded-xl border border-border bg-bg px-4 py-3 font-mono text-xs text-text outline-none focus:border-primary"
        />
        <button
          onClick={saveTop}
          disabled={update.isPending}
          className="self-start rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white transition hover:bg-primary-hover disabled:opacity-60"
        >
          {saved === 'top' ? t('admin.requisitesSaved') : t('admin.requisitesSave')}
        </button>
      </div>
    </div>
  );
}
