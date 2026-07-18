'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Search, Settings2, Users } from 'lucide-react';
import { Skeleton } from '@/components/ui/Skeleton';
import { CustomFieldsModal } from '@/components/business/CustomFieldsModal';
import { useBusinessClients } from '@/lib/hooks';
import type { Locale } from '@/lib/i18n';

export default function BusinessClientsPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { locale } = useParams<{ locale: Locale }>();
  const [query, setQuery] = useState('');
  const [fieldsOpen, setFieldsOpen] = useState(false);
  const { data, isLoading } = useBusinessClients(query || undefined);

  const clients = data?.clients ?? [];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold text-text">{t('biz.clients')}</h1>
        <button
          onClick={() => setFieldsOpen(true)}
          className="flex items-center gap-1.5 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-text-muted transition hover:border-primary hover:text-primary"
        >
          <Settings2 size={15} />
          {t('biz.manageFields')}
        </button>
      </div>

      <div className="flex items-center gap-2.5 rounded-xl border border-border bg-surface px-4 py-3">
        <Search size={16} className="shrink-0 text-text-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('biz.searchClients') as string}
          className="w-full flex-1 bg-transparent text-sm text-text outline-none placeholder:text-text-muted"
        />
      </div>

      {isLoading && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      )}

      {!isLoading && clients.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
          <Users size={28} className="text-text-muted" />
          <p className="max-w-xs text-sm text-text-muted">{query ? t('biz.noClientsFound') : t('biz.noClientsYet')}</p>
        </div>
      )}

      {clients.length > 0 && (
        <div className="flex flex-col gap-2">
          {clients.map((c) => (
            <button
              key={c.phone}
              onClick={() => router.push(`/${locale}/business-account/clients/${c.phone}`)}
              className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-surface px-4 py-3.5 text-left shadow-xs transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-primary-glow font-display text-sm font-bold text-primary">
                  {c.name?.[0]?.toUpperCase() ?? '?'}
                </span>
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-text">{c.name || c.displayPhone}</span>
                  <span className="font-mono text-xs text-text-muted">{c.displayPhone}</span>
                </div>
              </div>
              <div className="flex flex-none items-center gap-5 text-right">
                <div className="flex flex-col">
                  <span className="font-mono text-sm font-bold text-text">{c.visitsCount}</span>
                  <span className="text-[10px] uppercase tracking-wide text-text-muted">{t('biz.clientVisits')}</span>
                </div>
                <div className="hidden flex-col sm:flex">
                  <span className="font-mono text-sm font-bold text-text">{c.totalSpent.toLocaleString('uk-UA')}₴</span>
                  <span className="text-[10px] uppercase tracking-wide text-text-muted">{t('biz.clientTotalSpent')}</span>
                </div>
                <div className="hidden flex-col sm:flex">
                  <span className="font-mono text-xs text-text-muted">
                    {new Date(c.lastVisitAt).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                  </span>
                  <span className="text-[10px] uppercase tracking-wide text-text-muted">{t('biz.clientLastVisit')}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {fieldsOpen && <CustomFieldsModal onClose={() => setFieldsOpen(false)} />}
    </div>
  );
}
