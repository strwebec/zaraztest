'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LifeBuoy, Send, CheckCircle2, RotateCcw, Paperclip, X } from 'lucide-react';
import { RequireAdminRole } from '@/components/admin/RequireAdminRole';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  useAdminSupportThreads,
  useAdminSupportThread,
  useSendAdminSupportMessage,
  useMarkAdminSupportThreadRead,
  useResolveAdminSupportThread,
  useReopenAdminSupportThread,
} from '@/lib/hooks';
import type { SupportThread } from '@/lib/utils/api';

type StatusTab = 'PENDING' | 'ACTIVE' | 'COMPLETED';

function bucketOf(thread: SupportThread): StatusTab {
  if (thread.status === 'COMPLETED') return 'COMPLETED';
  return thread.lastMessageFrom === 'admin' ? 'ACTIVE' : 'PENDING';
}

export default function AdminSupportPage() {
  const { t } = useTranslation();
  const { data: listData, isLoading: listLoading } = useAdminSupportThreads();
  const [tab, setTab] = useState<StatusTab>('PENDING');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data: threadData, isLoading: threadLoading } = useAdminSupportThread(selectedId);
  const sendMessage = useSendAdminSupportMessage();
  const markRead = useMarkAdminSupportThreadRead();
  const resolveThread = useResolveAdminSupportThread();
  const reopenThread = useReopenAdminSupportThread();
  const [text, setText] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const allThreads = listData?.threads ?? [];
  const threads = allThreads.filter((th) => bucketOf(th) === tab);
  const messages = threadData?.messages ?? [];
  const selectedThread = threadData?.thread;

  const tabCounts = {
    PENDING: allThreads.filter((th) => bucketOf(th) === 'PENDING').length,
    ACTIVE: allThreads.filter((th) => bucketOf(th) === 'ACTIVE').length,
    COMPLETED: allThreads.filter((th) => bucketOf(th) === 'COMPLETED').length,
  };

  useEffect(() => {
    if (selectedThread && selectedThread.unreadByAdmin > 0) markRead.mutate(selectedThread._id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedThread?._id, selectedThread?.unreadByAdmin]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  function handleSend() {
    const trimmed = text.trim();
    if ((!trimmed && !image) || !selectedId) return;
    sendMessage.mutate(
      { id: selectedId, text: trimmed || undefined, image: image || undefined },
      { onSuccess: () => setImage(null) }
    );
    setText('');
  }

  return (
    <RequireAdminRole roles={['SUPER_ADMIN', 'MODERATOR']} permission="support">
      <div className="flex flex-col gap-5">
        <h1 className="font-display text-2xl font-bold text-text">{t('admin.support')}</h1>

        <div className="flex gap-1.5 rounded-xl border border-border bg-surface p-1 sm:w-fit">
          {(['PENDING', 'ACTIVE', 'COMPLETED'] as const).map((key) => (
            <button
              key={key}
              onClick={() => {
                setTab(key);
                setSelectedId(null);
              }}
              className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition sm:flex-none ${
                tab === key ? 'bg-primary text-white' : 'text-text-muted'
              }`}
            >
              {key === 'PENDING' ? t('admin.supportTabPending') : key === 'ACTIVE' ? t('admin.supportTabActive') : t('admin.supportTabCompleted')}
              {tabCounts[key] > 0 && <span className="ml-1.5 opacity-80">({tabCounts[key]})</span>}
            </button>
          ))}
        </div>

        <div className="flex h-[70vh] gap-4 overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
          <div className="flex w-full max-w-xs flex-none flex-col overflow-y-auto border-r border-border">
            {listLoading && (
              <div className="flex flex-col gap-2 p-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-16" />
                ))}
              </div>
            )}

            {!listLoading && threads.length === 0 && (
              <p className="p-5 text-center text-sm text-text-muted">{t('admin.supportNoThreads')}</p>
            )}

            {!listLoading &&
              threads.map((thread) => (
                <button
                  key={thread._id}
                  onClick={() => setSelectedId(thread._id)}
                  className={`flex flex-col gap-1 border-b border-border px-4 py-3 text-left transition hover:bg-surface2 ${
                    selectedId === thread._id ? 'bg-primary-glow' : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-bold text-text">{thread.userName}</span>
                    {thread.unreadByAdmin > 0 && (
                      <span className="flex h-5 min-w-5 flex-none items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-white">
                        {thread.unreadByAdmin}
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-semibold text-text-muted">
                    {thread.userRole === 'CLIENT' ? t('admin.clients') : t('admin.businessOwners')}
                  </span>
                  <span className="truncate text-xs text-text-muted">{thread.lastMessagePreview}</span>
                </button>
              ))}
          </div>

          <div className="flex flex-1 flex-col">
            {!selectedId && (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
                <LifeBuoy size={28} className="text-text-muted" />
                <p className="text-sm text-text-muted">{t('admin.supportSelectThread')}</p>
              </div>
            )}

            {selectedId && (
              <>
                <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
                  <div>
                    <div className="text-sm font-bold text-text">{selectedThread?.userName}</div>
                    <div className="text-xs text-text-muted">{selectedThread?.userEmail}</div>
                  </div>
                  {selectedThread?.status === 'COMPLETED' ? (
                    <button
                      onClick={() => reopenThread.mutate(selectedThread._id)}
                      disabled={reopenThread.isPending}
                      className="flex items-center gap-1.5 rounded-xl border border-border px-3.5 py-2 text-xs font-semibold text-text-muted transition hover:border-primary hover:text-primary"
                    >
                      <RotateCcw size={14} />
                      {t('admin.supportReopen')}
                    </button>
                  ) : (
                    selectedThread && (
                      <button
                        onClick={() => resolveThread.mutate(selectedThread._id)}
                        disabled={resolveThread.isPending}
                        className="flex items-center gap-1.5 rounded-xl border border-border px-3.5 py-2 text-xs font-semibold text-text-muted transition hover:border-success hover:text-success"
                      >
                        <CheckCircle2 size={14} />
                        {t('admin.supportResolve')}
                      </button>
                    )
                  )}
                </div>

                <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-5">
                  {threadLoading && <p className="text-center text-sm text-text-muted">{t('support.loading')}</p>}

                  {!threadLoading && messages.length === 0 && (
                    <p className="text-center text-sm text-text-muted">{t('support.empty')}</p>
                  )}

                  {messages.map((m) => (
                    <div key={m._id} className={`flex ${m.from === 'admin' ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`flex max-w-[80%] flex-col gap-1 rounded-2xl px-4 py-2.5 text-sm shadow-xs ${
                          m.from === 'admin' ? 'bg-primary text-white' : 'bg-surface2 text-text'
                        }`}
                      >
                        {m.from === 'admin' && <span className="text-xs font-bold opacity-70">{m.authorName}</span>}
                        {m.imageUrl && (
                          <a href={m.imageUrl} target="_blank" rel="noopener noreferrer">
                            <img src={m.imageUrl} alt="" className="max-h-56 max-w-full rounded-xl object-cover" />
                          </a>
                        )}
                        {m.text && <p className="whitespace-pre-line leading-relaxed">{m.text}</p>}
                        <span className={`text-[10px] ${m.from === 'admin' ? 'text-white/70' : 'text-text-muted'}`}>
                          {new Date(m.createdAt).toLocaleString('uk-UA', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </div>
                  ))}
                  <div ref={bottomRef} />
                </div>

                <div className="flex flex-col gap-2 border-t border-border p-3">
                  {image && (
                    <div className="flex w-fit items-center gap-2 rounded-xl bg-bg px-3 py-1.5 text-xs text-text-muted">
                      <span className="max-w-[200px] truncate">{image.name}</span>
                      <button onClick={() => setImage(null)} aria-label={t('support.removeImage') as string}>
                        <X size={13} />
                      </button>
                    </div>
                  )}
                  <div className="flex items-end gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => setImage(e.target.files?.[0] ?? null)}
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      aria-label={t('support.attachImage') as string}
                      className="flex h-10 w-10 flex-none items-center justify-center rounded-xl border border-border text-text-muted transition hover:border-primary hover:text-primary"
                    >
                      <Paperclip size={16} />
                    </button>
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
                      disabled={(!text.trim() && !image) || sendMessage.isPending}
                      aria-label={t('support.send') as string}
                      className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-primary text-white transition hover:bg-primary-hover disabled:opacity-40"
                    >
                      <Send size={16} />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </RequireAdminRole>
  );
}
