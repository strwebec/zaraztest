import { addDays, format } from 'date-fns';
import { uk, enUS } from 'date-fns/locale';

export function nextDays(count: number) {
  const today = new Date();
  return Array.from({ length: count }, (_, i) => addDays(today, i));
}

export function toDateKey(date: Date) {
  return format(date, 'yyyy-MM-dd');
}

export function weekdayShort(date: Date, locale: 'uk' | 'en') {
  return format(date, 'EEE', { locale: locale === 'uk' ? uk : enUS });
}

export function dayNumber(date: Date) {
  return format(date, 'd');
}
