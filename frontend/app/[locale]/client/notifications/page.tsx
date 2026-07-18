'use client';

import { useTranslation } from 'react-i18next';
import { Skeleton } from '@/components/ui/Skeleton';
import { useNotifications, useMarkNotificationRead, useConfirmCancellation } from '@/lib/hooks';
import type { ClientNotification } from '@/lib/utils/api';

function needsResponse(n: ClientNotification) {
  return (
    n.type === 'booking_cancelled_by_business' &&
    n.relatedBooking &&
    n.relatedBooking.status === 'cancelled_by_business' &&
    !n.relatedBooking.cancellationConfirmation?.respondedAt
  );
}

export default function ClientNotificationsPage() {
  const { t } = useTranslation();
  const { data, isLoading } = useNotifications();
  const markRead = useMarkNotificationRead();
  const confirmCancellation = useConfirmCancellation();

  const notifications = data?.notifications ?? [];

  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-display text-2xl font-bold text-text">{t('client.notifications')}</h1>

      <div className="flex max-w-xl flex-col gap-2.5">
        {isLoading && Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16" />)}

        {!isLoading && notifications.length === 0 && (
          <p className="py-10 text-center text-sm text-text-muted">{t('client.noNotifications')}</p>
        )}

        {!isLoading &&
          notifications.map((n) => {
            const awaitingResponse = needsResponse(n);
            const bookingId = n.relatedBooking?._id;
            const alreadyResponded = n.relatedBooking?.cancellationConfirmation?.response;

            return (
              <div
                key={n._id}
                className={`flex flex-col gap-2 rounded-xl border-l-2 bg-surface p-4 transition ${
                  n.read ? 'border-transparent' : 'border-primary'
                }`}
              >
                <button
                  type="button"
                  onClick={() => !n.read && markRead.mutate(n._id)}
                  className="flex w-full flex-col gap-2 text-left"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-text">{n.title}</span>
                    <span className="text-xs text-text-muted">{new Date(n.createdAt).toLocaleDateString()}</span>
                  </div>
                  <p className="text-sm text-text-muted">{n.text}</p>
                </button>

                {awaitingResponse && bookingId && (
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      disabled={confirmCancellation.isPending}
                      onClick={() => confirmCancellation.mutate({ bookingId, response: 'yes' })}
                      className="rounded-lg border border-border px-4 py-1.5 text-xs font-semibold text-text transition hover:bg-bg disabled:opacity-50"
                    >
                      {t('client.cancellationWasMine')}
                    </button>
                    <button
                      disabled={confirmCancellation.isPending}
                      onClick={() => confirmCancellation.mutate({ bookingId, response: 'no' })}
                      className="rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-primary-hover disabled:opacity-50"
                    >
                      {t('client.cancellationWasNotMine')}
                    </button>
                  </div>
                )}

                {!awaitingResponse && alreadyResponded && (
                  <p className="pt-1 text-xs text-text-muted">
                    {alreadyResponded === 'yes' ? t('client.cancellationConfirmedYes') : t('client.cancellationConfirmedNo')}
                  </p>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
}
