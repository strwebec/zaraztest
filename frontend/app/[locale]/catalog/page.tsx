'use client';

import { Suspense, useEffect, useState } from 'react';
import { useParams, useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import { CategoryTile } from '@/components/catalog/CategoryTile';
import { BusinessCard } from '@/components/catalog/BusinessCard';
import { Skeleton } from '@/components/ui/Skeleton';
import { useCategories, useBusinesses } from '@/lib/hooks';
import { DEFAULT_CITY_SLUG } from '@/lib/utils/city';
import { toDateKey } from '@/lib/utils/dates';
import type { Locale } from '@/lib/i18n';

const CITY_SLUG = DEFAULT_CITY_SLUG;

export default function CatalogPage() {
  return (
    <Suspense fallback={null}>
      <CatalogPageInner />
    </Suspense>
  );
}

function CatalogPageInner() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const { locale } = useParams<{ locale: Locale }>();
  const searchParams = useSearchParams();

  const [category, setCategory] = useState<string | undefined>(searchParams.get('category') ?? undefined);
  const [sort, setSort] = useState<'rating' | 'price'>('rating');
  const [date, setDate] = useState(() => searchParams.get('date') || toDateKey(new Date()));
  const [query, setQuery] = useState(searchParams.get('q') ?? '');
  const [debouncedQuery, setDebouncedQuery] = useState(query);

  // Debounce so typing doesn't fire a request per keystroke, and keep the search
  // term in the URL so it survives a refresh or a shared link ("зберігається").
  useEffect(() => {
    const id = setTimeout(() => {
      setDebouncedQuery(query);
      const params = new URLSearchParams(searchParams.toString());
      if (query.trim()) params.set('q', query.trim());
      else params.delete('q');
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }, 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const { data: categoriesData } = useCategories();
  const { data, isLoading } = useBusinesses({ city: CITY_SLUG, category, date, sort, q: debouncedQuery.trim() || undefined });

  const categories = categoriesData?.categories ?? [];
  const businesses = data?.businesses ?? [];

  function goToBusiness(id: string) {
    router.push(`/${locale}/business/${id}`);
  }

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 px-4 py-8 sm:px-6 lg:flex-row lg:gap-0 lg:py-0">
      <aside className="hidden w-64 flex-none flex-col gap-6 border-r border-border py-8 pr-6 lg:flex">
        <h2 className="font-display text-lg font-bold text-text">{t('catalog.filters')}</h2>
        <div className="flex flex-col gap-2.5">
          <div className="text-xs font-bold uppercase tracking-wide text-text-muted">{t('catalog.service')}</div>
          <button
            onClick={() => setCategory(undefined)}
            className={`rounded-xl px-3 py-2 text-left text-sm font-medium transition ${
              !category ? 'bg-primary-glow text-text' : 'text-text-muted hover:text-text'
            }`}
          >
            {i18n.language === 'en' ? 'All' : 'Всі'}
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategory(cat.id)}
              className={`rounded-xl px-3 py-2 text-left text-sm font-medium transition ${
                category === cat.id ? 'bg-primary-glow text-text' : 'text-text-muted hover:text-text'
              }`}
            >
              {i18n.language === 'en' ? cat.nameEn : cat.name}
            </button>
          ))}
        </div>
      </aside>

      <div className="flex flex-1 flex-col gap-5 lg:py-8 lg:pl-8">
        <h1 className="font-display text-2xl font-bold text-text lg:hidden">{t('catalog.title')}</h1>

        <div className="flex items-center gap-2.5 rounded-2xl border border-border bg-surface px-4 py-3 shadow-[0_1px_2px_rgba(26,26,26,0.04)] focus-within:border-primary">
          <Search size={17} className="shrink-0 text-text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('home.searchPlaceholder') as string}
            className="w-full flex-1 bg-transparent text-sm font-medium text-text outline-none placeholder:text-text-muted placeholder:font-normal"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 lg:hidden">
          <CategoryTile
            id="all"
            name={i18n.language === 'en' ? 'All' : 'Всі'}
            active={!category}
            onClick={() => setCategory(undefined)}
          />
          {categories.map((cat) => (
            <CategoryTile
              key={cat.id}
              id={cat.id}
              name={i18n.language === 'en' ? cat.nameEn : cat.name}
              active={category === cat.id}
              onClick={() => setCategory(cat.id)}
            />
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm text-text-muted">
            {isLoading ? ' ' : t('catalog.results', { count: businesses.length })}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={date}
              min={toDateKey(new Date())}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-xl border border-border bg-surface px-3 py-1.5 text-xs text-text outline-none"
            />
            <div className="flex gap-1.5 rounded-xl border border-border bg-surface p-1">
              <button
                onClick={() => setSort('rating')}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  sort === 'rating' ? 'bg-primary text-white' : 'text-text-muted'
                }`}
              >
                {t('catalog.sortRating')}
              </button>
              <button
                onClick={() => setSort('price')}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  sort === 'price' ? 'bg-primary text-white' : 'text-text-muted'
                }`}
              >
                {t('catalog.sortPrice')}
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 pb-16 sm:grid-cols-2 xl:grid-cols-3">
          {isLoading &&
            Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-64" />)}

          {!isLoading && businesses.length === 0 && (
            <div className="col-span-full py-16 text-center text-sm text-text-muted">{t('catalog.noResults')}</div>
          )}

          {!isLoading &&
            businesses.map((biz, i) => (
              <BusinessCard key={biz.id} biz={biz} index={i} onClick={() => goToBusiness(biz.id)} />
            ))}
        </div>
      </div>
    </div>
  );
}
