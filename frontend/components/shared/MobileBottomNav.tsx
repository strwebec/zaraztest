'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';

export type BottomNavTab = { href: string; label: string; icon: LucideIcon; badge?: number };

export function MobileBottomNav({ tabs }: { tabs: BottomNavTab[] }) {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-surface/95 shadow-[0_-8px_24px_rgba(40,30,10,0.08)] backdrop-blur-xl lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {tabs.map((tab) => {
        const active = pathname === tab.href;
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-semibold transition-colors ${
              active ? 'text-primary' : 'text-text-muted'
            }`}
          >
            <span
              className={`relative flex h-8 w-8 items-center justify-center rounded-full ${
                active ? 'animate-navPop bg-primary-glow' : 'bg-transparent'
              }`}
            >
              <span className={active ? 'flex animate-navRing rounded-full' : 'flex rounded-full'}>
                <Icon size={19} strokeWidth={active ? 2.25 : 2} />
              </span>
              {!!tab.badge && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[9px] font-bold text-white">
                  {tab.badge > 9 ? '9+' : tab.badge}
                </span>
              )}
            </span>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
