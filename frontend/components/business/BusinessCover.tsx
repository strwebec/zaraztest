'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, Heart } from 'lucide-react';
import { coverGradient } from '@/lib/utils/categoryStyle';
import { TopBadge } from '@/components/catalog/TopBadge';
import type { BusinessDetail } from '@/lib/utils/api';

function stars(rating: number) {
  const full = Math.round(rating);
  return '★'.repeat(full) + '☆'.repeat(5 - full);
}

export function BusinessCover({
  business,
  backHref,
  isFavorite,
  onToggleFavorite,
}: {
  business: BusinessDetail;
  backHref: string;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
}) {
  const router = useRouter();
  const rating = business.googleRating * 0.6 + (business.platformRating || business.googleRating) * 0.4;
  const reviews = business.googleReviewsCount + business.platformReviewsCount;

  const backgroundImage = business.coverPhotoUrl
    ? `linear-gradient(180deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.55) 100%), url(${business.coverPhotoUrl})`
    : coverGradient(business.category);

  return (
    <div
      className="relative flex h-56 items-end bg-cover bg-center sm:h-72"
      style={{ backgroundImage }}
    >
      <button
        onClick={() => router.push(backHref)}
        aria-label="Назад"
        className="absolute left-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white transition hover:bg-black/60 sm:left-6 sm:top-5"
      >
        <ArrowLeft size={18} />
      </button>
      <div className="absolute right-4 top-4 flex items-center gap-2 sm:right-6 sm:top-5">
        {business.top?.active && <TopBadge />}
        {onToggleFavorite && (
          <button
            onClick={onToggleFavorite}
            aria-label="Favorite"
            className={`flex h-9 w-9 items-center justify-center rounded-full bg-black/40 transition hover:bg-black/60 ${
              isFavorite ? 'text-primary' : 'text-white'
            }`}
          >
            <Heart size={17} fill={isFavorite ? 'currentColor' : 'none'} />
          </button>
        )}
      </div>
      <div className="relative flex w-full flex-col gap-2 px-5 pb-5 sm:px-10 sm:pb-7">
        <h1 className="font-display text-3xl font-extrabold text-white sm:text-[34px]">{business.name}</h1>
        <div className="flex items-center gap-2.5 text-sm text-white/70 sm:text-[14px]">
          <span className="tracking-wider text-top">{stars(rating)}</span>
          <span>
            {rating.toFixed(1)} · {reviews} відгуків{business.district ? ` · ${business.district}` : ''}
          </span>
        </div>
      </div>
    </div>
  );
}
