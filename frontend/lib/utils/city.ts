export const DEFAULT_CITY_SLUG = 'stryi';
export const DEFAULT_CITY_NAME = 'Стрий';

const STORAGE_KEY = 'zaraz.selectedCity';

export type SelectedCity = { slug: string; name: string };

// The catalog and home page always search within "the last selected city" — this is
// the single source of truth for that, read by both pages and written by the header's
// city switcher. Falls back to the seeded default city for a first-time visitor who
// hasn't picked one yet.
export function getSelectedCity(): SelectedCity {
  if (typeof window === 'undefined') return { slug: DEFAULT_CITY_SLUG, name: DEFAULT_CITY_NAME };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.slug === 'string' && typeof parsed.name === 'string') return parsed;
    }
  } catch {
    /* ignore malformed storage */
  }
  return { slug: DEFAULT_CITY_SLUG, name: DEFAULT_CITY_NAME };
}

export function setSelectedCity(city: SelectedCity) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(city));
}
