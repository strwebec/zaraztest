'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { StarRating } from '@/components/shared/StarRating';

export function ReviewModal({
  businessName,
  onSubmit,
  onClose,
  isPending,
  error,
}: {
  businessName: string;
  onSubmit: (rating: number, text: string) => void;
  onClose: () => void;
  isPending?: boolean;
  error?: string | null;
}) {
  const { t } = useTranslation();
  const [rating, setRating] = useState(5);
  const [text, setText] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-md flex-col gap-4 rounded-t-2xl bg-surface p-6 shadow-lg sm:rounded-2xl"
      >
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-bold text-text">{t('client.leaveReview')}</h3>
          <button onClick={onClose} className="text-text-muted">
            <X size={20} />
          </button>
        </div>

        <p className="text-sm text-text-muted">{businessName}</p>

        <StarRating value={rating} onChange={setRating} size="lg" />

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t('client.reviewPlaceholder') as string}
          rows={4}
          className="resize-none rounded-xl border border-border bg-bg px-4 py-3 text-sm text-text outline-none focus:border-primary"
        />

        {error && <p className="text-sm text-danger">{error}</p>}

        <button
          disabled={isPending || !text.trim()}
          onClick={() => onSubmit(rating, text.trim())}
          className="rounded-xl bg-primary px-6 py-3 text-sm font-bold text-white transition disabled:opacity-50"
        >
          {t('client.submitReview')}
        </button>
      </div>
    </div>
  );
}
