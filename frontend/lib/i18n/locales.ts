export const SUPPORTED_LOCALES = ['uk', 'en'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
