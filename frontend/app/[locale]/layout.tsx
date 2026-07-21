import { Providers } from '@/lib/providers';
import { Header } from '@/components/shared/Header';
import { GlobalMobileBottomNav } from '@/components/shared/GlobalMobileBottomNav';
import { SUPPORTED_LOCALES, type Locale } from '@/lib/i18n/locales';
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
      <Header locale={locale} />
      <main className="min-h-screen bg-bg pb-bottom-nav-safe">{children}</main>
      <GlobalMobileBottomNav />
    </Providers>
  );
}
