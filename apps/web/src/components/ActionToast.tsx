'use client';

import Link from 'next/link';
import { IconBookmarkPlus, IconUndo, IconX } from './icons';

export type ToastTone = 'neutral' | 'review' | 'undo' | 'error';

export interface ToastState {
  id: number;
  message: string;
  tone?: ToastTone;
  href?: string;
  hrefLabel?: string;
  /** Spec 40 §7: friend-request toasts offer `[View] [Accept]`, not just a
   * link — accepting here shouldn't require navigating away first. */
  onAccept?: () => void;
  acceptLabel?: string;
}

interface ActionToastProps {
  toast: ToastState | null;
  onDismiss: () => void;
}

const toneStyles: Record<ToastTone, string> = {
  neutral: 'border-neutral-700 text-neutral-200',
  review: 'border-purple-500/40 text-purple-200 shadow-lg shadow-purple-500/10',
  undo: 'border-red-500/30 text-red-300 shadow-lg shadow-red-500/10',
  error: 'border-red-500/50 text-red-300',
};

export function ActionToast({ toast, onDismiss }: ActionToastProps) {
  if (!toast) return null;

  const tone = toast.tone ?? 'neutral';

  return (
    <div className="fixed bottom-24 left-1/2 z-[60] w-[min(92vw,24rem)] -translate-x-1/2 animate-toast-in">
      <div
        className={`flex items-start gap-3 rounded-xl border bg-neutral-950/95 px-4 py-3 backdrop-blur ${toneStyles[tone]}`}
        role="status"
      >
        {tone === 'review' ? (
          <IconBookmarkPlus className="mt-0.5 shrink-0 opacity-80" size={16} />
        ) : tone === 'undo' ? (
          <IconUndo className="mt-0.5 shrink-0 opacity-80" size={16} />
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-snug">{toast.message}</p>
          {(toast.href || toast.onAccept) && (
            <div className="mt-1 flex items-center gap-3">
              {toast.href && (
                <Link
                  href={toast.href}
                  className="text-xs text-purple-300 underline-offset-2 hover:underline"
                  onClick={onDismiss}
                >
                  {toast.hrefLabel ?? 'Open'}
                </Link>
              )}
              {toast.onAccept && (
                <button
                  type="button"
                  onClick={() => {
                    toast.onAccept?.();
                    onDismiss();
                  }}
                  className="text-xs font-semibold text-green-400 underline-offset-2 hover:underline"
                >
                  {toast.acceptLabel ?? 'Accept'}
                </button>
              )}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded p-0.5 text-neutral-500 hover:text-neutral-300"
          aria-label="Dismiss"
        >
          <IconX size={16} />
        </button>
      </div>
    </div>
  );
}
