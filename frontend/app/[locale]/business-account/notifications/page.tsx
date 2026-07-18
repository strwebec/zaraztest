'use client';

import { useTranslation } from 'react-i18next';
import { Skeleton } from '@/components/ui/Skeleton';
import { useBusinessNotifications, useMarkBusinessNotificationRead } from '@/lib/hooks';

export default function BusinessNotificationsPage() {
  const { t } = useTranslation();
  const { data, isLoading } = useBusinessNotifications();
  const markRead = useMarkBusinessNotificationRead();

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
          notifications.map((n) => (
            <button
              key={n._id}
              type="button"
              onClick={() => !n.read && markRead.mutate(n._id)}
              className={`flex w-full flex-col gap-1 rounded-xl border-l-2 bg-surface p-4 text-left transition ${
                n.read ? 'border-transparent' : 'border-primary'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-text">{n.title}</span>
                <span className="text-xs text-text-muted">{new Date(n.createdAt).toLocaleDateString()}</span>
              </div>
              <p className="text-sm text-text-muted">{n.text}</p>
            </button>
          ))}
      </div>
    </div>
  );
}
