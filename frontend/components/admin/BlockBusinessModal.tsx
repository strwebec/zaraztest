'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';

const PRESET_REASONS = [
  'fraudulentReceipt',
  'unpaidCommission',
  'repeatedCancellations',
  'clientComplaints',
  'fakeListing',
  'other',
] as const;

export function BlockBusinessModal({
  businessName,
  onConfirm,
  onClose,
  isPending,
}: {
  businessName: string;
  onConfirm: (payload: { reason?: string; durationDays?: number }) => void;
  onClose: () => void;
  isPending?: boolean;
}) {
  const { t } = useTranslation();
  const [presetReason, setPresetReason] = useState<(typeof PRESET_REASONS)[number]>('unpaidCommission');
  const [customReason, setCustomReason] = useState('');
  const [permanent, setPermanent] = useState(true);
  const [durationDays, setDurationDays] = useState('7');

  const reasonText =
    presetReason === 'other' ? customReason.trim() : (t(`admin.blockReasons.${presetReason}`) as string);

  function handleConfirm() {
    onConfirm({
      reason: reasonText || undefined,
      durationDays: permanent ? undefined : Math.max(1, Number(durationDays) || 1),
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-md flex-col gap-4 rounded-t-2xl bg-surface p-6 shadow-lg sm:rounded-2xl"
      >
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-bold text-text">{t('admin.blockModalTitle')}</h3>
          <button onClick={onClose} className="text-text-muted">
            <X size={20} />
          </button>
        </div>

        <p className="text-sm text-text-muted">{businessName}</p>

        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold uppercase tracking-wide text-text-muted">
            {t('admin.blockReasonLabel')}
          </label>
          <select
            value={presetReason}
            onChange={(e) => setPresetReason(e.target.value as (typeof PRESET_REASONS)[number])}
            className="rounded-xl border border-border bg-bg px-4 py-3 text-sm text-text outline-none focus:border-primary"
          >
            {PRESET_REASONS.map((r) => (
              <option key={r} value={r}>
                {t(`admin.blockReasons.${r}`)}
              </option>
            ))}
          </select>
          {presetReason === 'other' && (
            <textarea
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              placeholder={t('admin.blockReasonPlaceholder') as string}
              rows={3}
              className="resize-none rounded-xl border border-border bg-bg px-4 py-3 text-sm text-text outline-none focus:border-primary"
            />
          )}
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold uppercase tracking-wide text-text-muted">
            {t('admin.blockDurationLabel')}
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPermanent(true)}
              className={`flex-1 rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
                permanent ? 'border-primary bg-primary-glow text-text' : 'border-border text-text-muted'
              }`}
            >
              {t('admin.blockPermanent')}
            </button>
            <button
              type="button"
              onClick={() => setPermanent(false)}
              className={`flex-1 rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
                !permanent ? 'border-primary bg-primary-glow text-text' : 'border-border text-text-muted'
              }`}
            >
              {t('admin.blockForDays')}
            </button>
          </div>
          {!permanent && (
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                value={durationDays}
                onChange={(e) => setDurationDays(e.target.value)}
                className="w-24 rounded-xl border border-border bg-bg px-4 py-2.5 text-sm text-text outline-none focus:border-primary"
              />
              <span className="text-sm text-text-muted">{t('admin.blockDaysSuffix')}</span>
            </div>
          )}
        </div>

        <button
          disabled={isPending || (presetReason === 'other' && !customReason.trim())}
          onClick={handleConfirm}
          className="rounded-xl bg-danger px-6 py-3 text-sm font-bold text-white transition disabled:opacity-50"
        >
          {t('admin.block')}
        </button>
      </div>
    </div>
  );
}
