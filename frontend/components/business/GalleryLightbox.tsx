'use client';

import { useEffect, useCallback, useRef } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

export function GalleryLightbox({
  urls,
  index,
  alt,
  onClose,
  onIndexChange,
}: {
  urls: string[];
  index: number;
  alt: string;
  onClose: () => void;
  onIndexChange: (index: number) => void;
}) {
  const touchStartX = useRef<number | null>(null);

  const goTo = useCallback(
    (next: number) => onIndexChange((next + urls.length) % urls.length),
    [onIndexChange, urls.length]
  );

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') goTo(index + 1);
      if (e.key === 'ArrowLeft') goTo(index - 1);
    }
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [goTo, index, onClose]);

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/90 backdrop-blur-sm"
      onClick={onClose}
      onTouchStart={(e) => {
        touchStartX.current = e.touches[0].clientX;
      }}
      onTouchEnd={(e) => {
        if (touchStartX.current === null) return;
        const delta = e.changedTouches[0].clientX - touchStartX.current;
        if (Math.abs(delta) > 40) goTo(delta < 0 ? index + 1 : index - 1);
        touchStartX.current = null;
      }}
    >
      <button
        onClick={onClose}
        aria-label="Close"
        className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
      >
        <X size={20} />
      </button>

      {urls.length > 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            goTo(index - 1);
          }}
          aria-label="Previous"
          className="absolute left-2 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 sm:flex"
        >
          <ChevronLeft size={22} />
        </button>
      )}

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={urls[index]}
        alt={alt}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] max-w-[92vw] select-none rounded-lg object-contain shadow-2xl"
      />

      {urls.length > 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            goTo(index + 1);
          }}
          aria-label="Next"
          className="absolute right-2 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 sm:flex"
        >
          <ChevronRight size={22} />
        </button>
      )}

      {urls.length > 1 && (
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 font-mono text-xs text-white">
          {index + 1} / {urls.length}
        </div>
      )}
    </div>
  );
}
