'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Skeleton } from '@/components/ui/Skeleton';
import { RequireAdminRole } from '@/components/admin/RequireAdminRole';
import { useMe, useAdminCities, useCreateAdminCity, useApproveAdminCity, useDeleteAdminCity, ApiError } from '@/lib/hooks';

type Tab = 'pending' | 'active' | 'all';

export default function AdminCitiesPage() {
  const { t } = useTranslation();
  const { data: meData } = useMe();
  const isSuperAdmin = meData?.user?.role === 'SUPER_ADMIN';
  const [tab, setTab] = useState<Tab>('pending');
  const { data, isLoading } = useAdminCities(tab);
  const approve = useApproveAdminCity();
  const createCity = useCreateAdminCity();
  const deleteCity = useDeleteAdminCity();

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [deleteErrorById, setDeleteErrorById] = useState<Record<string, string>>({});

  const cities = data?.cities ?? [];

  const tabs: { key: Tab; label: string }[] = [
    { key: 'pending', label: t('admin.cityTabPending') },
    { key: 'active', label: t('admin.cityTabActive') },
    { key: 'all', label: t('admin.cityTabAll') },
  ];

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);
    try {
      await createCity.mutateAsync({ name: name.trim(), nameEn: nameEn.trim() || undefined });
      setName('');
      setNameEn('');
      setShowForm(false);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'CITY_ALREADY_EXISTS') {
        setCreateError(t('admin.cityAlreadyExists') as string);
      } else {
        setCreateError(t('auth.genericError') as string);
      }
    }
  }

  function handleDelete(id: string, cityName: string) {
    if (!window.confirm(t('admin.deleteCityConfirm', { name: cityName }) as string)) return;
    setDeleteErrorById((prev) => {
      const { [id]: _removed, ...rest } = prev;
      return rest;
    });
    deleteCity.mutate(id, {
      onError: (err) => {
        const message =
          err instanceof ApiError && err.code === 'CITY_IN_USE'
            ? (t('admin.cityInUse', {
                businesses: (err.data?.businessCount as number) ?? 0,
                users: (err.data?.userCount as number) ?? 0,
              }) as string)
            : (t('auth.genericError') as string);
        setDeleteErrorById((prev) => ({ ...prev, [id]: message }));
      },
    });
  }

  return (
    <RequireAdminRole roles={['SUPER_ADMIN', 'MODERATOR']} permission="categories">
      <div className="flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl font-bold text-text">{t('admin.cities')}</h1>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white transition hover:-translate-y-0.5"
          >
            {t('admin.addCity')}
          </button>
        </div>
        <p className="text-xs text-text-muted">{t('admin.citiesHint')}</p>

        {showForm && (
          <form onSubmit={handleCreate} className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 shadow-sm sm:max-w-md">
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('admin.cityNameUk') as string}
              className="rounded-xl border border-border bg-bg px-4 py-3 text-sm text-text outline-none focus:border-primary"
            />
            <input
              value={nameEn}
              onChange={(e) => setNameEn(e.target.value)}
              placeholder={t('admin.cityNameEn') as string}
              className="rounded-xl border border-border bg-bg px-4 py-3 text-sm text-text outline-none focus:border-primary"
            />
            {createError && <p className="text-xs text-danger">{createError}</p>}
            <button
              type="submit"
              disabled={createCity.isPending}
              className="self-start rounded-xl bg-primary px-6 py-3 text-sm font-bold text-white disabled:opacity-60"
            >
              {t('admin.addCity')}
            </button>
          </form>
        )}

        <div className="flex gap-1.5 rounded-xl border border-border bg-surface p-1 sm:w-fit">
          {tabs.map((tb) => (
            <button
              key={tb.key}
              onClick={() => setTab(tb.key)}
              className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition sm:flex-none ${
                tab === tb.key ? 'bg-primary text-white' : 'text-text-muted'
              }`}
            >
              {tb.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-3">
          {isLoading && Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-16" />)}

          {!isLoading && cities.length === 0 && (
            <p className="py-10 text-center text-sm text-text-muted">{t('admin.noCitiesInTab')}</p>
          )}

          {!isLoading &&
            cities.map((city) => (
              <div key={city._id} className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-4 shadow-xs">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-text">{city.name}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          city.active ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'
                        }`}
                      >
                        {city.active ? t('admin.cityStatusActive') : t('admin.cityStatusPending')}
                      </span>
                    </div>
                    {city.nameEn && <div className="text-xs text-text-muted">{city.nameEn}</div>}
                  </div>
                  <div className="flex gap-2">
                    {!city.active && (
                      <button
                        onClick={() => approve.mutate(city._id)}
                        disabled={approve.isPending}
                        className="rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                      >
                        {t('admin.approve')}
                      </button>
                    )}
                    {isSuperAdmin && (
                      <button
                        onClick={() => handleDelete(city._id, city.name)}
                        disabled={deleteCity.isPending}
                        className="rounded-lg border border-danger/40 px-4 py-1.5 text-xs font-semibold text-danger disabled:opacity-60"
                      >
                        {t('admin.deleteCity')}
                      </button>
                    )}
                  </div>
                </div>
                {deleteErrorById[city._id] && <p className="text-xs text-danger">{deleteErrorById[city._id]}</p>}
              </div>
            ))}
        </div>
      </div>
    </RequireAdminRole>
  );
}
