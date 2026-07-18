'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Send, LifeBuoy } from 'lucide-react';
import { useSupportThread, useSendSupportMessage, useMarkSupportThreadRead } from '@/lib/hooks';

export function SupportChat() {
  const { t } = useTranslation();
  const { data, isLoading } = useSupportThread();
  const sendMessage = useSendSupportMessage();
  const markRead = useMarkSupportThreadRead();
  const [text, setText] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const messages = data?.messages ?? [];
  const unreadByUser = data?.thread?.unreadByUser ?? 0;

  useEffect(() => {
    if (unreadByUser > 0) markRead.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unreadByUser]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  function handleSend() {
    const trimmed = text.trim();
    if (!trimmed) return;
    sendMessage.mutate(trimmed);
    setText('');
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2.5">
        <LifeBuoy size={20} className="text-primary" />
        <h1 className="font-display text-2xl font-bold text-text">{t('support.title')}</h1>
      </div>
      <p className="max-w-lg text-sm text-text-muted">{t('support.subtitle')}</p>

      <div className="flex h-[60vh] flex-col rounded-2xl border border-border bg-surface shadow-sm">
        <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-5">
          {isLoading && <p className="text-center text-sm text-text-muted">{t('support.loading')}</p>}

          {!isLoading && messages.length === 0 && (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
              <LifeBuoy size={28} className="text-text-muted" />
              <p className="text-sm text-text-muted">{t('support.empty')}</p>
            </div>
          )}

          {messages.map((m) => (
            <div key={m._id} className={`flex ${m.from === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`flex max-w-[80%] flex-col gap-1 rounded-2xl px-4 py-2.5 text-sm shadow-xs ${
                  m.from === 'user' ? 'bg-primary text-white' : 'bg-surface2 text-text'
                }`}
              >
                {m.from === 'admin' && <span className="text-xs font-bold opacity-70">{t('support.teamLabel')}</span>}
                <p className="whitespace-pre-line leading-relaxed">{m.text}</p>
                <span className={`text-[10px] ${m.from === 'user' ? 'text-white/70' : 'text-text-muted'}`}>
                  {new Date(m.createdAt).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <div className="flex items-end gap-2 border-t border-border p-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={t('support.placeholder') as string}
            rows={1}
            className="max-h-32 flex-1 resize-none rounded-xl border border-border bg-bg px-3.5 py-2.5 text-sm text-text outline-none focus:border-primary"
          />
          <button
            onClick={handleSend}
            disabled={!text.trim() || sendMessage.isPending}
            aria-label={t('support.send') as string}
            className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-primary text-white transition hover:bg-primary-hover disabled:opacity-40"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
