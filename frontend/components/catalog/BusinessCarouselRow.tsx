'use client';

import { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { BusinessCard } from './BusinessCard';
import { Skeleton } from '@/components/ui/Skeleton';
import type { CatalogBusiness } from '@/lib/utils/api';

export function BusinessCarouselRow({
  title,
  seeAllLabel,
  onSeeAll,
  businesses,
  isLoading,
  favoriteIds,
  onToggleFavorite,
  onCardClick,
}: {
  title: string;
  seeAllLabel?: string;
  onSeeAll?: () => void;
  businesses: CatalogBusiness[];
  isLoading?: boolean;
  favoriteIds?: Set<string>;
  onToggleFavorite?: (id: string) => void;
  onCardClick: (biz: CatalogBusiness) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  if (!isLoading && businesses.length === 0) return null;

  function scrollBy(dir: 1 | -1) {
    scrollRef.current?.scrollBy({ left: dir * 640, behavior: 'smooth' });
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-xl font-bold tracking-tight text-text sm:text-2xl">{title}</h2>
        {onSeeAll && seeAllLabel && (
          <button
            onClick={onSeeAll}
            className="text-sm font-semibold text-primary transition hover:text-primary-hover hover:underline"
          >
            {seeAllLabel}
          </button>
        )}
      </div>

      <div className="group/row relative -mx-1">
        <button
          onClick={() => scrollBy(-1)}
          aria-label="scroll left"
          className="absolute left-1 top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-bg text-text opacity-0 shadow-[0_4px_16px_rgba(26,26,26,0.12)] transition hover:scale-105 group-hover/row:opacity-100 sm:flex"
        >
          <ChevronLeft size={17} />
        </button>

        <div
          ref={scrollRef}
          className="flex gap-5 overflow-x-auto scroll-smooth px-1 pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {isLoading
            ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-64 w-72 flex-none" />)
            : businesses.map((biz, i) => (
                <div key={biz.id} className="w-72 flex-none">
                  <BusinessCard
                    biz={biz}
                    index={i}
                    onClick={() => onCardClick(biz)}
                    isFavorite={favoriteIds?.has(biz.id)}
                    onToggleFavorite={onToggleFavorite ? () => onToggleFavorite(biz.id) : undefined}
                  />
                </div>
              ))}
        </div>

        <button
          onClick={() => scrollBy(1)}
          aria-label="scroll right"
          className="absolute right-1 top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-bg text-text opacity-0 shadow-[0_4px_16px_rgba(26,26,26,0.12)] transition hover:scale-105 group-hover/row:opacity-100 sm:flex"
        >
          <ChevronRight size={17} />
        </button>
      </div>
    </section>
  );
}
