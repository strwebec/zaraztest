import { Providers } from '@/lib/providers';
import { Header } from '@/components/shared/Header';
import { GlobalMobileBottomNav } from '@/components/shared/GlobalMobileBottomNav';
import { SUPPORTED_LOCALES, type Locale } from '@/lib/i18n/locales';
import { notFound } from 'next/navigation';

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  if (!SUPPORTED_LOCALES.includes(rawLocale as Locale)) notFound();
  const locale = rawLocale as Locale;

  return (
    <Providers locale={locale}>
      <Header locale={locale} />
      <main className="min-h-screen bg-bg pb-bottom-nav-safe">{children}</main>
      <GlobalMobileBottomNav />
    </Providers>
  );
}
