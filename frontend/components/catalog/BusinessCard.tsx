'use client';

import { useTranslation } from 'react-i18next';
import { Heart } from 'lucide-react';
import { coverGradient } from '@/lib/utils/categoryStyle';
import { TopBadge } from './TopBadge';
import type { CatalogBusiness } from '@/lib/utils/api';

export function BusinessCard({
  biz,
  onClick,
  index = 0,
  isFavorite,
  onToggleFavorite,
}: {
  biz: CatalogBusiness;
  onClick?: () => void;
  index?: number;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div
      onClick={onClick}
      style={{ animationDelay: `${index * 50}ms` }}
      className="group animate-fadeInUp cursor-pointer overflow-hidden rounded-2xl border border-border bg-surface opacity-0 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
    >
      <div
        className="relative h-[120px] bg-cover bg-center"
        style={
          biz.coverPhotoUrl
            ? { backgroundImage: `url(${biz.coverPhotoUrl})` }
            : { backgroundImage: coverGradient(biz.category) }
        }
      >
        {biz.top && <TopBadge />}
        {onToggleFavorite && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite();
            }}
            aria-label={t('client.favorites') as string}
            className="absolute right-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-full bg-bg/70 backdrop-blur-sm transition hover:scale-110 hover:bg-bg/90"
          >
            <Heart
              size={15}
              className={isFavorite ? 'fill-danger text-danger' : 'text-text'}
              strokeWidth={2}
            />
          </button>
        )}
      </div>
      <div className="flex flex-col gap-1.5 p-4">
        <div className="font-semibold text-text">{biz.name}</div>
        <div className="text-xs text-text-muted">{biz.district}</div>
        <div className="flex flex-wrap items-center gap-x-1 font-tabular text-[13px] text-text-muted">
          <span>★ {biz.rating.toFixed(1)}</span>
          {biz.priceFrom != null && (
            <>
              <span>·</span>
              <span>
                {t('catalog.priceFrom')} {biz.priceFrom}₴
              </span>
            </>
          )}
          {biz.nextSlot && (
            <>
              <span>·</span>
              <span>
                {t('home.freeAt')} {biz.nextSlot}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
