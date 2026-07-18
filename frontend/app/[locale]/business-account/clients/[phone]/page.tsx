'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Phone } from 'lucide-react';
import { Skeleton } from '@/components/ui/Skeleton';
import { useBusinessClientDetail, useUpdateBusinessClient } from '@/lib/hooks';
import type { Locale } from '@/lib/i18n';

const STATUS_LABEL_KEY: Record<string, string> = {
  confirmed: 'client.upcoming',
  completed: 'client.past',
  cancelled_by_client: 'client.cancelled',
  cancelled_by_business: 'client.cancelled',
  no_show: 'biz.noShow',
};

export default function BusinessClientDetailPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { locale, phone } = useParams<{ locale: Locale; phone: string }>();
  const { data, isLoading } = useBusinessClientDetail(phone ?? null);
  const updateClient = useUpdateBusinessClient();

  const [notes, setNotes] = useState('');
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (data) {
      setNotes(data.notes);
      const initial: Record<string, string> = {};
      for (const field of data.fieldDefinitions) {
        const raw = data.customFieldValues[field.key];
        initial[field.key] = raw === undefined || raw === null ? '' : String(raw);
      }
      setFieldValues(initial);
    }
  }, [data]);

  if (isLoading || !data) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  function handleSave() {
    updateClient.mutate(
      { phone: phone as string, notes, customFieldValues: fieldValues },
      {
        onSuccess: () => {
          setSaved(true);
          setTimeout(() => setSaved(false), 2000);
        },
      }
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <button
        onClick={() => router.push(`/${locale}/business-account/clients`)}
        className="flex w-fit items-center gap-1.5 text-sm font-semibold text-text-muted transition hover:text-primary"
      >
        <ArrowLeft size={15} />
        {t('biz.backToClients')}
      </button>

      <div className="flex items-center gap-3">
        <span className="flex h-14 w-14 flex-none items-center justify-center rounded-full bg-primary-glow font-display text-xl font-bold text-primary">
          {data.name?.[0]?.toUpperCase() ?? '?'}
        </span>
        <div className="flex flex-col">
          <h1 className="font-display text-xl font-bold text-text">{data.name || data.displayPhone}</h1>
          <span className="flex items-center gap-1.5 font-mono text-sm text-text-muted">
            <Phone size={13} />
            {data.displayPhone}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5 shadow-sm">
          <h2 className="text-xs font-bold uppercase tracking-wide text-text-muted">{t('biz.clientNotes')}</h2>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t('biz.clientNotesPlaceholder') as string}
            rows={4}
            className="resize-none rounded-xl border border-border bg-bg px-4 py-3 text-sm text-text outline-none focus:border-primary"
          />

          {data.fieldDefinitions.length > 0 && (
            <>
              <h2 className="text-xs font-bold uppercase tracking-wide text-text-muted">{t('biz.clientCustomFields')}</h2>
              <div className="flex flex-col gap-3">
                {data.fieldDefinitions.map((field) => (
                  <label key={field._id} className="flex flex-col gap-1.5">
                    <span className="text-xs font-semibold text-text-muted">{field.label}</span>
                    {field.type === 'select' ? (
                      <select
                        value={fieldValues[field.key] ?? ''}
                        onChange={(e) => setFieldValues((v) => ({ ...v, [field.key]: e.target.value }))}
                        className="rounded-xl border border-border bg-bg px-4 py-2.5 text-sm text-text outline-none focus:border-primary"
                      >
                        <option value="" />
                        {field.options.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    ) : field.type === 'textarea' ? (
                      <textarea
                        value={fieldValues[field.key] ?? ''}
                        onChange={(e) => setFieldValues((v) => ({ ...v, [field.key]: e.target.value }))}
                        rows={2}
                        className="resize-none rounded-xl border border-border bg-bg px-4 py-2.5 text-sm text-text outline-none focus:border-primary"
                      />
                    ) : (
                      <input
                        type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                        value={fieldValues[field.key] ?? ''}
                        onChange={(e) => setFieldValues((v) => ({ ...v, [field.key]: e.target.value }))}
                        className="rounded-xl border border-border bg-bg px-4 py-2.5 text-sm text-text outline-none focus:border-primary"
                      />
                    )}
                  </label>
                ))}
              </div>
            </>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={updateClient.isPending}
              className="self-start rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white transition hover:-translate-y-0.5 disabled:opacity-60"
            >
              {t('biz.save')}
            </button>
            {saved && <span className="text-sm text-success">{t('biz.notesSaved')}</span>}
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5 shadow-sm">
          <h2 className="text-xs font-bold uppercase tracking-wide text-text-muted">{t('biz.clientHistory')}</h2>
          <div className="flex flex-col gap-2.5">
            {data.bookings.map((b) => (
              <div key={b._id} className="flex flex-col gap-1 rounded-xl border border-border bg-bg p-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-text">
                    {b.date} · {b.startTime}
                  </span>
                  <span className="font-mono text-xs font-bold text-text">{b.price}₴</span>
                </div>
                <span className="text-xs text-text-muted">
                  {b.service?.name} {b.staff && `· ${b.staff.name}`}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                    {t(STATUS_LABEL_KEY[b.status] ?? b.status)}
                  </span>
                  <span className="text-[10px] text-text-muted">
                    · {b.source === 'platform' ? t('biz.platform') : t('biz.manual')}
                  </span>
                </div>
                {b.comment && <p className="text-xs italic text-text-muted">{b.comment}</p>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
