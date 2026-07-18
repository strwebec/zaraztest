'use client';

import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Service } from '@/lib/utils/api';

export function ServiceRow({ service, selected, onSelect }: { service: Service; selected: boolean; onSelect: () => void }) {
  const { t } = useTranslation();
  return (
    <button
      onClick={onSelect}
      className={`flex w-full items-center justify-between border-b border-border py-4 text-left transition ${
        selected ? 'px-3 -mx-3 rounded-xl bg-primary-glow' : ''
      }`}
    >
      <div className="flex items-center gap-3">
        <span
          className={`flex h-5 w-5 flex-none items-center justify-center rounded-md border transition ${
            selected ? 'border-primary bg-primary text-white' : 'border-border text-transparent'
          }`}
        >
          <Check size={13} strokeWidth={3} />
        </span>
        <div>
          <div className="text-sm font-semibold text-text sm:text-[15px]">{service.name}</div>
          <div className="mt-0.5 text-xs text-text-muted sm:text-[12.5px]">{service.durationMinutes} хв</div>
        </div>
      </div>
      <div
        className={`text-base font-semibold sm:text-[17px] ${
          service.isFree ? 'text-success' : 'font-mono text-text'
        }`}
      >
        {service.isFree ? t('business.free') : `${service.price}₴`}
      </div>
    </button>
  );
}
