'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { useUpdateMonthLedger } from '@/lib/hooks';
import type { LedgerManualField } from '@/lib/utils/api';

// A single field gets its own small window rather than one crammed form — entering
// "Оренда" shouldn't require scrolling past fourteen unrelated columns to reach it.
export function EditMetricValueModal({
  month,
  field,
  onClose,
}: {
  month: string;
  field: LedgerManualField;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const updateLedger = useUpdateMonthLedger();
  const [value, setValue] = useState(String(field.value ?? ''));
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    updateLedger.mutate(
      { month, values: { [field.key]: value } },
      { onSuccess: onClose, onError: () => setError(t('auth.genericError') as string) }
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-6" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex w-full flex-col gap-4 rounded-t-3xl bg-surface p-6 shadow-lg sm:max-w-sm sm:rounded-3xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-text">
            {t('biz.editMetricValueTitle', { label: field.label, month })}
          </h2>
          <button onClick={onClose} className="rounded-full p-1.5 text-text-muted transition hover:bg-surface2 hover:text-text">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            autoFocus
            type={field.unit === 'text' ? 'text' : 'number'}
            step={field.unit === 'percent' ? '0.1' : field.unit === 'text' ? undefined : '1'}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="rounded-xl border border-border bg-bg px-4 py-3 text-lg font-semibold text-text outline-none focus:border-primary"
          />
          {error && <p className="text-xs text-danger">{error}</p>}
          <button
            type="submit"
            disabled={updateLedger.isPending}
            className="rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5 disabled:opacity-60"
          >
            {t('biz.saveValue')}
          </button>
        </form>
      </div>
    </div>
  );
}
