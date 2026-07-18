import { Providers } from '@/lib/providers';
import { Header } from '@/components/shared/Header';
import { SUPPORTED_LOCALES, type Locale } from '@/lib/i18n/locales';
import { DEFAULT_CITY_NAME } from '@/lib/utils/city';
import { notFound } from 'next/navigation';

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

export default function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  if (!SUPPORTED_LOCALES.includes(params.locale as Locale)) notFound();
  const locale = params.locale as Locale;

  return (
    <Providers locale={locale}>
      <Header locale={locale} city={DEFAULT_CITY_NAME} />
      <main className="min-h-screen bg-bg">{children}</main>
    </Providers>
  );
}
