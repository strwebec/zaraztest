'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Clock3, LifeBuoy, LogOut } from 'lucide-react';
import { useLogout } from '@/lib/hooks';
import type { Locale } from '@/lib/i18n';

const REVIEW_WINDOW_MS = 15 * 60 * 1000;

function formatCountdown(ms: number) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// Shown in place of the whole business cabinet while a newly-registered
// business is still PENDING super-admin approval — createdAt anchors a
// one-time 15-minute countdown; once it elapses without approval, the
// message switches from "won't be long" to an apology plus a support link,
// since silently staying on the countdown forever would read as broken.
export function PendingReviewScreen({ businessName, createdAt }: { businessName: string; createdAt: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { locale } = useParams<{ locale: Locale }>();
  const logoutMutation = useLogout();
  const deadline = new Date(createdAt).getTime() + REVIEW_WINDOW_MS;
  const [remaining, setRemaining] = useState(() => deadline - Date.now());

  useEffect(() => {
    const id = setInterval(() => setRemaining(deadline - Date.now()), 1000);
    return () => clearInterval(id);
  }, [deadline]);

  const isOverdue = remaining <= 0;

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center gap-5 px-6 py-16 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-glow text-primary">
        <Clock3 size={30} />
      </span>
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-2xl font-bold text-text">{t('biz.pendingReviewTitle')}</h1>
        <p className="text-sm text-text-muted">{t('biz.pendingReviewHint', { name: businessName })}</p>
      </div>

      {!isOverdue ? (
        <div className="flex flex-col items-center gap-1.5 rounded-2xl border border-border bg-surface px-8 py-5">
          <span className="font-mono text-3xl font-bold tabular-nums text-primary">{formatCountdown(remaining)}</span>
          <span className="text-xs text-text-muted">{t('biz.pendingReviewCountdownLabel')}</span>
        </div>
      ) : (
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface px-6 py-5">
          <p className="text-sm text-text">{t('biz.pendingReviewOverdue')}</p>
          <Link
            href={`/${locale}/business-account/support`}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white transition hover:bg-primary-hover"
          >
            <LifeBuoy size={16} />
            {t('biz.pendingReviewContactSupport')}
          </Link>
        </div>
      )}

      <button
        type="button"
        onClick={() => logoutMutation.mutate(undefined, { onSuccess: () => router.push(`/${locale}`) })}
        className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-text-muted hover:text-danger"
      >
        <LogOut size={13} />
        {t('client.logout')}
      </button>
    </div>
  );
}
