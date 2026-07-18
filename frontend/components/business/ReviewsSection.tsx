'use client';

import { useTranslation } from 'react-i18next';
import { StarRating } from '@/components/shared/StarRating';
import { useBusinessReviewsPublic } from '@/lib/hooks';

export function ReviewsSection({ businessId }: { businessId: string }) {
  const { t } = useTranslation();
  const { data } = useBusinessReviewsPublic(businessId);
  const reviews = data?.reviews ?? [];

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs font-bold uppercase tracking-wide text-text-muted">{t('business.reviews')}</h2>

      {reviews.length === 0 && <p className="text-sm text-text-muted">{t('business.noReviews')}</p>}

      <div className="flex flex-col gap-3">
        {reviews.map((r) => (
          <div key={r._id} className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-text">{r.client.name}</span>
              <StarRating value={r.rating} size="sm" />
            </div>
            <p className="text-sm text-text-muted">{r.text}</p>
            {r.reply?.text && (
              <div className="ml-4 flex flex-col gap-1 rounded-xl bg-bg p-3">
                <span className="text-xs font-bold text-text">{t('business.reply')}</span>
                <p className="text-xs text-text-muted">{r.reply.text}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
