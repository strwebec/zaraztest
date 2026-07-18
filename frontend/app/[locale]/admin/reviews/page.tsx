'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Skeleton } from '@/components/ui/Skeleton';
import { StarRating } from '@/components/shared/StarRating';
import { RequireAdminRole } from '@/components/admin/RequireAdminRole';
import {
  useAdminReviews,
  useApproveReview,
  useRejectReview,
  useRemoveReviewReply,
  useClearReplyFlag,
  useResolveReviewDispute,
} from '@/lib/hooks';

type Tab = 'pending' | 'flagged' | 'disputed';

function daysSince(dateStr: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(dateStr).getTime()) / (24 * 60 * 60 * 1000)));
}

export default function AdminReviewsPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('pending');
  const [noteByReview, setNoteByReview] = useState<Record<string, string>>({});
  const { data, isLoading } = useAdminReviews(
    tab === 'pending' ? { status: 'PENDING' } : tab === 'disputed' ? { status: 'DISPUTED' } : { flaggedReplies: true }
  );
  const approve = useApproveReview();
  const reject = useRejectReview();
  const removeReply = useRemoveReviewReply();
  const clearFlag = useClearReplyFlag();
  const resolveDispute = useResolveReviewDispute();

  const reviews = data?.reviews ?? [];

  return (
    <RequireAdminRole roles={['SUPER_ADMIN', 'MODERATOR']} permission="reviews">
    <div className="flex flex-col gap-5">
      <h1 className="font-display text-2xl font-bold text-text">{t('admin.reviews')}</h1>

      <div className="flex flex-wrap gap-1.5 rounded-xl border border-border bg-surface p-1 sm:w-fit">
        <button
          onClick={() => setTab('pending')}
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition sm:flex-none ${
            tab === 'pending' ? 'bg-primary text-white' : 'text-text-muted'
          }`}
        >
          {t('admin.reviews')}
        </button>
        <button
          onClick={() => setTab('flagged')}
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition sm:flex-none ${
            tab === 'flagged' ? 'bg-primary text-white' : 'text-text-muted'
          }`}
        >
          {t('admin.flaggedReplies')}
        </button>
        <button
          onClick={() => setTab('disputed')}
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition sm:flex-none ${
            tab === 'disputed' ? 'bg-primary text-white' : 'text-text-muted'
          }`}
        >
          {t('admin.reviewDisputes')}
        </button>
      </div>

      <div className="flex flex-col gap-3">
        {isLoading && Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24" />)}

        {!isLoading && reviews.length === 0 && (
          <p className="py-10 text-center text-sm text-text-muted">
            {tab === 'pending'
              ? t('admin.noPendingReviews')
              : tab === 'disputed'
                ? t('admin.noReviewDisputes')
                : t('admin.noFlaggedReplies')}
          </p>
        )}

        {!isLoading &&
          reviews.map((r) => {
            const businessName = typeof r.business === 'string' ? r.business : r.business.name;
            return (
              <div key={r._id} className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-4 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-text">
                    {businessName} · {r.client.name}
                  </span>
                  <StarRating value={r.rating} size="sm" />
                </div>
                {r.text && <p className="text-sm text-text-muted">{r.text}</p>}
                {tab === 'pending' && (
                  <span className="text-xs text-text-muted">
                    {t('admin.pendingSince', { count: daysSince(r.createdAt) })}
                  </span>
                )}

                {tab === 'pending' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => approve.mutate(r._id)}
                      className="rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-white"
                    >
                      {t('admin.approve')}
                    </button>
                    <button
                      onClick={() => reject.mutate(r._id)}
                      className="rounded-lg border border-danger/40 px-4 py-1.5 text-xs font-semibold text-danger"
                    >
                      {t('admin.reject')}
                    </button>
                  </div>
                )}

                {tab === 'flagged' && r.reply?.text && (
                  <>
                    <div className="ml-4 flex flex-col gap-1 rounded-xl bg-bg p-3">
                      <span className="text-xs font-bold text-text">{t('biz.yourReply')}</span>
                      <p className="text-xs text-text-muted">{r.reply.text}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => clearFlag.mutate(r._id)}
                        className="rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-white"
                      >
                        {t('admin.clearFlag')}
                      </button>
                      <button
                        onClick={() => removeReply.mutate(r._id)}
                        className="rounded-lg border border-danger/40 px-4 py-1.5 text-xs font-semibold text-danger"
                      >
                        {t('admin.removeReply')}
                      </button>
                    </div>
                  </>
                )}

                {tab === 'disputed' && r.dispute && (
                  <div className="flex flex-col gap-2">
                    <div className="rounded-xl border border-warning/40 bg-warning/5 p-3 text-xs">
                      <span className="font-bold text-text">{t('admin.disputeBusinessReason')}:</span>{' '}
                      <span className="text-text-muted">{r.dispute.reason}</span>
                    </div>
                    <div className="rounded-xl bg-bg p-3 text-xs">
                      <span className="font-bold text-text">{t('admin.disputeClientResponse')}:</span>{' '}
                      <span className="text-text-muted">
                        {r.dispute.clientResponse || t('admin.disputeNoClientResponse')}
                      </span>
                    </div>
                    <textarea
                      value={noteByReview[r._id] ?? ''}
                      onChange={(e) => setNoteByReview((prev) => ({ ...prev, [r._id]: e.target.value }))}
                      placeholder={t('admin.disputeResolutionNotePlaceholder') as string}
                      rows={2}
                      className="resize-none rounded-lg border border-border bg-bg px-3 py-2 text-xs text-text outline-none focus:border-primary"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() =>
                          resolveDispute.mutate({ id: r._id, decision: 'UPHELD', note: noteByReview[r._id] })
                        }
                        disabled={resolveDispute.isPending}
                        className="rounded-lg bg-success px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                      >
                        {t('admin.disputeUphold')}
                      </button>
                      <button
                        onClick={() =>
                          resolveDispute.mutate({ id: r._id, decision: 'DISMISSED', note: noteByReview[r._id] })
                        }
                        disabled={resolveDispute.isPending}
                        className="rounded-lg border border-danger/40 px-4 py-1.5 text-xs font-semibold text-danger disabled:opacity-50"
                      >
                        {t('admin.disputeDismiss')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
      </div>
    </div>
    </RequireAdminRole>
  );
}
