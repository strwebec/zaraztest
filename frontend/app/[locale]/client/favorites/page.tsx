'use client';

import { useParams, useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Heart } from 'lucide-react';
import { BusinessCard } from '@/components/catalog/BusinessCard';
import { Skeleton } from '@/components/ui/Skeleton';
import { useFavorites, useRemoveFavorite } from '@/lib/hooks';
import type { Locale } from '@/lib/i18n';

export default function ClientFavoritesPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { locale } = useParams<{ locale: Locale }>();
  const { data, isLoading } = useFavorites();
  const removeFavorite = useRemoveFavorite();

  const businesses = data?.businesses ?? [];

  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-display text-2xl font-bold text-text">{t('client.favorites')}</h1>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {isLoading && Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-64" />)}

        {!isLoading && businesses.length === 0 && (
          <p className="col-span-full py-10 text-center text-sm text-text-muted">{t('client.noFavorites')}</p>
        )}

        {!isLoading &&
          businesses.map((biz, i) => (
            <div key={biz.id} className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeFavorite.mutate(biz.id);
                }}
                aria-label="Remove favorite"
                className="absolute right-2.5 top-2.5 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/92 text-danger backdrop-blur-sm transition hover:bg-white"
              >
                <Heart size={15} fill="currentColor" />
              </button>
              <BusinessCard
                biz={{ ...biz, nextSlot: null }}
                index={i}
                onClick={() => router.push(`/${locale}/business/${biz.id}`)}
              />
            </div>
          ))}
      </div>
    </div>
  );
}
