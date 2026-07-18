'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Skeleton } from '@/components/ui/Skeleton';
import { StarRating } from '@/components/shared/StarRating';
import { useBusinessOwnReviews, useReplyToReview } from '@/lib/hooks';

export default function BusinessReviewsPage() {
  const { t } = useTranslation();
  const { data, isLoading } = useBusinessOwnReviews();
  const replyMutation = useReplyToReview();
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  const reviews = data?.reviews ?? [];

  async function handleSendReply(id: string) {
    if (!replyText.trim()) return;
    await replyMutation.mutateAsync({ id, text: replyText.trim() });
    setReplyingId(null);
    setReplyText('');
  }

  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-display text-2xl font-bold text-text">{t('biz.reviews')}</h1>

      <div className="flex flex-col gap-3">
        {isLoading && Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24" />)}

        {!isLoading && reviews.length === 0 && (
          <p className="py-10 text-center text-sm text-text-muted">{t('biz.noReviews')}</p>
        )}

        {!isLoading &&
          reviews.map((r) => (
            <div key={r._id} className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-text">{r.client.name}</span>
                <StarRating value={r.rating} size="sm" />
              </div>
              <p className="text-sm text-text-muted">{r.text}</p>

              {r.reply?.text ? (
                <div className="ml-4 flex flex-col gap-1 rounded-xl bg-bg p-3">
                  <span className="text-xs font-bold text-text">{t('biz.yourReply')}</span>
                  <p className="text-xs text-text-muted">{r.reply.text}</p>
                </div>
              ) : replyingId === r._id ? (
                <div className="flex flex-col gap-2">
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder={t('biz.replyPlaceholder') as string}
                    rows={2}
                    className="resize-none rounded-xl border border-border bg-bg px-4 py-2 text-sm text-text outline-none focus:border-primary"
                  />
                  <button
                    disabled={replyMutation.isPending || !replyText.trim()}
                    onClick={() => handleSendReply(r._id)}
                    className="self-start rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
                  >
                    {t('biz.sendReply')}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setReplyingId(r._id);
                    setReplyText('');
                  }}
                  className="self-start text-xs font-semibold text-primary"
                >
                  {t('biz.reply')}
                </button>
              )}
            </div>
          ))}
      </div>
    </div>
  );
}
