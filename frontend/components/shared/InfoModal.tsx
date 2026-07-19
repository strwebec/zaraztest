'use client';

import { X } from 'lucide-react';

export function InfoModal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-6" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-sm flex-col gap-3 rounded-t-3xl bg-surface p-6 shadow-lg sm:rounded-3xl"
      >
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-bold text-text">{title}</h3>
          <button onClick={onClose} className="rounded-full p-1.5 text-text-muted transition hover:bg-surface2 hover:text-text">
            <X size={18} />
          </button>
        </div>
        <div className="flex flex-col gap-2 text-sm text-text-muted">{children}</div>
      </div>
    </div>
  );
}
