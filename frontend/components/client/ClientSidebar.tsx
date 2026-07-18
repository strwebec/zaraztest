'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';

export type SidebarTab = {
  href?: string;
  onClick?: () => void;
  label: string;
  icon?: LucideIcon;
  badge?: number;
  danger?: boolean;
};

export function ClientSidebar({ tabs }: { tabs: SidebarTab[] }) {
  const pathname = usePathname();

  return (
    <aside className="hidden w-60 flex-none flex-col gap-1.5 border-r border-border bg-surface2 py-8 pr-5 lg:flex">
      {tabs.map((tab) => {
        const active = !!tab.href && (pathname === tab.href || pathname.startsWith(`${tab.href}/`));
        const Icon = tab.icon;
        const className = `flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition ${
          active ? 'bg-primary-glow text-text shadow-xs' : tab.danger ? 'text-danger hover:bg-danger/10' : 'text-text-muted hover:bg-surface2 hover:text-text'
        }`;
        const content = (
          <>
            {Icon && <Icon size={18} />}
            <span className="flex-1">{tab.label}</span>
            {!!tab.badge && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-white">
                {tab.badge > 99 ? '99+' : tab.badge}
              </span>
            )}
          </>
        );

        if (tab.href) {
          return (
            <Link key={tab.href} href={tab.href} className={className}>
              {content}
            </Link>
          );
        }

        return (
          <button key={tab.label} type="button" onClick={tab.onClick} className={className}>
            {content}
          </button>
        );
      })}
    </aside>
  );
}
