'use client';

import { useRouter, useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Calendar, MapPin, ChevronDown, ChevronUp } from 'lucide-react';
import { CategoryTile } from '@/components/catalog/CategoryTile';
import { BusinessCarouselRow } from '@/components/catalog/BusinessCarouselRow';
import { useCategories, useBusinesses, useMe, useFavorites, useAddFavorite, useRemoveFavorite } from '@/lib/hooks';
import { DEFAULT_CITY_SLUG, DEFAULT_CITY_NAME, getSelectedCity } from '@/lib/utils/city';
import { toDateKey } from '@/lib/utils/dates';
import type { CatalogBusiness } from '@/lib/utils/api';
import type { Locale } from '@/lib/i18n';

const MIN_CATEGORY_ROW_SIZE = 2;
const MAX_CATEGORY_ROWS = 2;
const VISIBLE_CATEGORY_COUNT = 8;

export default function HomePage() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { locale } = useParams<{ locale: Locale }>();
  const [query, setQuery] = useState('');
  const [date, setDate] = useState(() => toDateKey(new Date()));
  const [showAllCategories, setShowAllCategories] = useState(false);
  // Starts at the seeded default and swaps to the last-selected city right after
  // mount — reading localStorage during the initial render would mismatch the
  // server-rendered HTML and trip a hydration warning.
  const [city, setCity] = useState({ slug: DEFAULT_CITY_SLUG, name: DEFAULT_CITY_NAME });
  useEffect(() => setCity(getSelectedCity()), []);

  const { data: meData } = useMe();
  const isClient = meData?.user?.role === 'CLIENT';
  const { data: categoriesData } = useCategories();
  // requireSlot: false — these are inspirational browsing rows, not a live availability
  // search, so a business shouldn't vanish just because nobody's free this exact minute.
  const { data: businessesData, isLoading } = useBusinesses({ city: city.slug, sort: 'rating', requireSlot: false });
  const { data: favoritesData } = useFavorites(isClient);
  const addFavorite = useAddFavorite();
  const removeFavorite = useRemoveFavorite();

  const categories = categoriesData?.categories ?? [];
  const businesses = businessesData?.businesses ?? [];
  const favoriteIds = useMemo(() => new Set((favoritesData?.businesses ?? []).map((b) => b.id)), [favoritesData]);

  const categoriesByPopularity = useMemo(() => {
    const counts = new Map<string, number>();
    for (const b of businesses) counts.set(b.category, (counts.get(b.category) ?? 0) + 1);
    return [...categories].sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0));
  }, [categories, businesses]);
  const visibleCategories = showAllCategories
    ? categoriesByPopularity
    : categoriesByPopularity.slice(0, VISIBLE_CATEGORY_COUNT);

  const popular = businesses.slice(0, 8);
  const topPlaced = businesses.filter((b) => b.top);

  const categoryRows = useMemo(() => {
    const byCategory = new Map<string, CatalogBusiness[]>();
    for (const b of businesses) {
      if (!byCategory.has(b.category)) byCategory.set(b.category, []);
      byCategory.get(b.category)!.push(b);
    }
    return Array.from(byCategory.entries())
      .filter(([, list]) => list.length >= MIN_CATEGORY_ROW_SIZE)
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, MAX_CATEGORY_ROWS)
      .map(([categoryId, list]) => {
        const cat = categories.find((c) => c.id === categoryId);
        const name = cat ? (i18n.language === 'en' ? cat.nameEn : cat.name) : categoryId;
        return { categoryId, name, list };
      });
  }, [businesses, categories, i18n.language]);

  function goToBusiness(biz: CatalogBusiness) {
    router.push(`/${locale}/business/${biz.id}`);
  }

  function toggleFavorite(id: string) {
    if (!isClient) {
      router.push(`/${locale}/login?redirect=${encodeURIComponent(`/${locale}`)}`);
      return;
    }
    if (favoriteIds.has(id)) removeFavorite.mutate(id);
    else addFavorite.mutate(id);
  }

  function handleSearch() {
    const match = categories.find((c) =>
      (i18n.language === 'en' ? c.nameEn : c.name).toLowerCase().includes(query.trim().toLowerCase())
    );
    const params = new URLSearchParams();
    if (match) params.set('category', match.id);
    if (date) params.set('date', date);
    if (query.trim()) params.set('q', query.trim());
    const qs = params.toString();
    router.push(`/${locale}/catalog${qs ? `?${qs}` : ''}`);
  }

  return (
    <div className="flex flex-col">
      <section className="relative flex flex-col items-center gap-7 overflow-hidden px-6 pb-16 pt-20 text-center sm:pt-28">
        <div
          className="pointer-events-none absolute -right-32 -top-24 h-[420px] w-[420px] animate-floatOrb rounded-full opacity-[0.15] blur-[10px] sm:opacity-20"
          style={{ background: 'radial-gradient(circle, var(--color-primary) 0%, transparent 70%)' }}
        />
        <div
          className="pointer-events-none absolute -left-24 top-40 h-72 w-72 animate-floatOrbReverse rounded-full opacity-10 blur-[10px]"
          style={{ background: 'radial-gradient(circle, var(--color-secondary) 0%, transparent 70%)' }}
        />

        <h1 className="relative max-w-2xl text-balance font-display text-[clamp(32px,7vw,56px)] font-bold leading-[1.05] tracking-tight text-text">
          {t('home.title')}
        </h1>
        <p className="relative max-w-lg text-[17px] leading-relaxed text-text-muted">{t('home.subtitle')}</p>

        <div className="relative flex w-full max-w-2xl flex-col gap-0.5 rounded-2xl border border-border bg-surface p-1.5 shadow-md sm:flex-row sm:items-stretch">
          <div className="flex flex-1 items-center gap-2.5 rounded-xl px-3.5 py-3">
            <Search size={17} className="shrink-0 text-text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder={t('home.searchPlaceholder') as string}
              className="w-full flex-1 bg-transparent text-sm font-medium text-text outline-none placeholder:text-text-muted placeholder:font-normal"
            />
          </div>
          <div className="h-px w-full bg-border sm:h-auto sm:w-px" />
          <label className="flex items-center gap-2.5 px-3.5 py-3 text-sm text-text-muted">
            <Calendar size={17} className="shrink-0" />
            <input
              type="date"
              value={date}
              min={toDateKey(new Date())}
              onChange={(e) => setDate(e.target.value)}
              className="bg-transparent text-sm font-medium text-text outline-none"
            />
          </label>
          <div className="h-px w-full bg-border sm:h-auto sm:w-px" />
          <div className="flex items-center gap-2.5 px-3.5 py-3 text-sm text-text-muted">
            <MapPin size={17} className="shrink-0" />
            {city.name}
          </div>
          <button
            onClick={handleSearch}
            className="rounded-xl bg-primary px-7 py-3 text-sm font-semibold text-white transition hover:bg-primary-hover"
          >
            {t('home.search')}
          </button>
        </div>

        <div className="flex w-full max-w-4xl flex-col items-center gap-3">
          <div className="flex w-full flex-wrap justify-center gap-2.5">
            {visibleCategories.map((cat) => (
              <CategoryTile
                key={cat.id}
                id={cat.id}
                name={i18n.language === 'en' ? cat.nameEn : cat.name}
                onClick={() => router.push(`/${locale}/catalog?category=${cat.id}`)}
              />
            ))}
          </div>
          {categoriesByPopularity.length > VISIBLE_CATEGORY_COUNT && (
            <button
              onClick={() => setShowAllCategories((v) => !v)}
              className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold text-primary transition hover:bg-primary-glow"
            >
              {showAllCategories ? (
                <>
                  {t('home.showPopularCategories')}
                  <ChevronUp size={16} />
                </>
              ) : (
                <>
                  {t('home.showAllCategories')}
                  <ChevronDown size={16} />
                </>
              )}
            </button>
          )}
        </div>
      </section>

      <section className="mx-auto flex w-full max-w-[1400px] flex-col gap-12 px-6 pb-20">
        {!isLoading && businessesData?.cityBusinessCount === 0 && (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-surface px-6 py-12 text-center">
            <MapPin size={28} className="text-text-muted" />
            <p className="max-w-md text-sm text-text-muted">{t('home.noBusinessesInCity', { city: city.name })}</p>
          </div>
        )}

        <BusinessCarouselRow
          title={t('home.popularInCity') as string}
          seeAllLabel={t('home.allBusinesses') as string}
          onSeeAll={() => router.push(`/${locale}/catalog`)}
          businesses={popular}
          isLoading={isLoading}
          favoriteIds={favoriteIds}
          onToggleFavorite={toggleFavorite}
          onCardClick={goToBusiness}
        />

        <BusinessCarouselRow
          title={t('home.topPlaced') as string}
          businesses={topPlaced}
          favoriteIds={favoriteIds}
          onToggleFavorite={toggleFavorite}
          onCardClick={goToBusiness}
        />

        {categoryRows.map(({ categoryId, name, list }) => (
          <BusinessCarouselRow
            key={categoryId}
            title={t('home.categoryInCity', { category: name, city: city.name }) as string}
            seeAllLabel={t('home.allBusinesses') as string}
            onSeeAll={() => router.push(`/${locale}/catalog?category=${categoryId}`)}
            businesses={list}
            favoriteIds={favoriteIds}
            onToggleFavorite={toggleFavorite}
            onCardClick={goToBusiness}
          />
        ))}
      </section>
    </div>
  );
}
