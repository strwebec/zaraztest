'use client';

import { Check, Minus, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Service } from '@/lib/utils/api';

export function ServiceRow({
  service,
  quantity,
  onToggle,
  onIncrement,
  onDecrement,
}: {
  service: Service;
  quantity: number;
  onToggle: () => void;
  onIncrement: () => void;
  onDecrement: () => void;
}) {
  const { t } = useTranslation();
  const selected = quantity > 0;
  const lineTotal = service.price * (quantity || 1);

  return (
    <div
      className={`flex w-full items-center justify-between gap-3 border-b border-border py-4 text-left transition ${
        selected ? 'px-3 -mx-3 rounded-xl bg-primary-glow' : ''
      }`}
    >
      <button onClick={onToggle} className="flex flex-1 items-center gap-3 text-left">
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
          {service.description && (
            <div className="mt-1 max-w-xs text-xs text-text-muted sm:text-[12.5px]">{service.description}</div>
          )}
        </div>
      </button>

      <div className="flex flex-none flex-col items-end gap-1.5">
        <div
          className={`text-base font-semibold sm:text-[17px] ${
            service.isFree ? 'text-success' : 'font-mono text-text'
          }`}
        >
          {service.isFree ? t('business.free') : `${lineTotal}₴`}
        </div>
        {selected && (
          <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-1.5 py-1">
            <button
              onClick={onDecrement}
              aria-label={t('business.decreaseQuantity') as string}
              className="flex h-5 w-5 items-center justify-center rounded text-text-muted transition hover:bg-bg hover:text-text"
            >
              <Minus size={12} />
            </button>
            <span className="w-4 text-center font-mono text-xs font-semibold text-text">{quantity}</span>
            <button
              onClick={onIncrement}
              aria-label={t('business.increaseQuantity') as string}
              className="flex h-5 w-5 items-center justify-center rounded text-text-muted transition hover:bg-bg hover:text-text"
            >
              <Plus size={12} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
