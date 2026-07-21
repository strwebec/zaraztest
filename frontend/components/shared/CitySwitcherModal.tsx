'use client';

import { useTranslation } from 'react-i18next';
import { X, MapPin } from 'lucide-react';
import { useCities } from '@/lib/hooks';
import { setSelectedCity, type SelectedCity } from '@/lib/utils/city';

export function CitySwitcherModal({
  current,
  onClose,
  onSelect,
}: {
  current: SelectedCity | null;
  onClose: () => void;
  onSelect: (city: SelectedCity) => void;
}) {
  const { t, i18n } = useTranslation();
  const { data, isLoading } = useCities();
  const cities = data?.cities ?? [];

  function choose(city: { slug: string; name: string; nameEn?: string }) {
    const next = { slug: city.slug, name: i18n.language === 'en' && city.nameEn ? city.nameEn : city.name };
    setSelectedCity(next);
    onSelect(next);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-6" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[80dvh] w-full flex-col gap-3 overflow-y-auto rounded-t-3xl bg-surface p-6 shadow-lg sm:max-w-sm sm:rounded-3xl"
      >
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-bold text-text">{t('nav.chooseCity')}</h3>
          <button onClick={onClose} className="rounded-full p-1.5 text-text-muted transition hover:bg-surface2 hover:text-text">
            <X size={18} />
          </button>
        </div>

        {isLoading && <p className="text-sm text-text-muted">{t('support.loading')}</p>}

        {!isLoading && cities.length === 0 && <p className="text-sm text-text-muted">{t('nav.noCitiesYet')}</p>}

        <div className="flex flex-col gap-1.5">
          {cities.map((c) => {
            const active = current?.slug === c.slug;
            return (
              <button
                key={c.slug}
                onClick={() => choose(c)}
                className={`flex items-center gap-2.5 rounded-xl border px-4 py-3 text-left text-sm font-semibold transition ${
                  active ? 'border-primary bg-primary-glow text-text' : 'border-border text-text-muted hover:border-primary/40'
                }`}
              >
                <MapPin size={15} className={active ? 'text-primary' : 'text-text-muted'} />
                {i18n.language === 'en' && c.nameEn ? c.nameEn : c.name}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
