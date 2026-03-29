'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ShieldCheck, Sparkles, X } from 'lucide-react';
import { useRouter } from 'next/navigation';

import PricingShell from '@/components/pricing/PricingShell';
import type { Currency } from '@/components/pricing/plan-config';

type UnlockAnswersModalProps = {
  open: boolean;
  onClose: () => void;
  answerCount?: number;
};

let cachedTotalQuestions: number | null = null;

export default function UnlockAnswersModal({
  open,
  onClose,
  answerCount = 0,
}: UnlockAnswersModalProps) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [defaultCurrency, setDefaultCurrency] = useState<Currency>('USD');
  const [totalQuestions, setTotalQuestions] = useState<number | null>(cachedTotalQuestions);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    if (typeof window === 'undefined') return;
    const locale = (window.navigator.language ?? 'en-US').toLowerCase();
    const timeZone = (Intl.DateTimeFormat().resolvedOptions().timeZone ?? '').toLowerCase();
    const inIndia = locale.includes('-in') || timeZone.includes('kolkata');
    setDefaultCurrency(inIndia ? 'INR' : 'USD');
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (answerCount > 0) return;
    if (cachedTotalQuestions !== null) {
      setTotalQuestions(cachedTotalQuestions);
      return;
    }

    let active = true;
    fetch('/api/questions/count', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { total?: number } | null) => {
        if (!active) return;
        const total = typeof payload?.total === 'number' ? payload.total : null;
        cachedTotalQuestions = total;
        setTotalQuestions(total);
      })
      .catch(() => {
        if (!active) return;
        setTotalQuestions(null);
      });

    return () => {
      active = false;
    };
  }, [answerCount, open]);

  useEffect(() => {
    if (!open) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', onEscape);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onEscape);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  const countLabel = useMemo(() => {
    const count = answerCount > 0 ? answerCount : totalQuestions;
    return count !== null ? count.toLocaleString() : 'all';
  }, [answerCount, totalQuestions]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-[120] p-3 sm:p-6" role="dialog" aria-modal>
          <motion.button
            type="button"
            onClick={onClose}
            aria-label="Close pricing modal"
            className="absolute inset-0 bg-slate-950/55 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          <div className="relative mx-auto flex min-h-full w-full max-w-6xl items-start justify-center sm:items-center">
            <motion.section
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="relative w-full overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 shadow-[0_30px_120px_rgba(15,23,42,0.35)]"
            >
              <button
                type="button"
                onClick={onClose}
                className="absolute right-4 top-4 z-20 rounded-full border border-slate-200 bg-white/95 p-2 text-slate-500 transition hover:text-slate-900"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="border-b border-slate-200 px-6 py-6 sm:px-8">
                <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.18em] text-slate-500">
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-2.5 py-1 font-semibold text-white">
                    <Sparkles className="h-3.5 w-3.5" />
                    Unlock Answers
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Premium Access
                  </span>
                </div>
                <h2 className="mt-3 text-2xl font-bold text-slate-900 sm:text-3xl">
                  Crack your next interview faster
                </h2>
                <p className="mt-2 text-sm text-slate-600 sm:text-base">
                  Open{' '}
                  <span className="rounded-md bg-indigo-50 px-1.5 py-0.5 font-semibold text-indigo-700">
                    {countLabel}
                  </span>{' '}
                  full answers, deep explanations, and real-world examples.
                </p>
              </div>

              <div className="px-4 py-5 sm:px-6 sm:py-6">
                <PricingShell
                  defaultCurrency={defaultCurrency}
                  userPlan={null}
                  isIndiaVisitor={defaultCurrency === 'INR'}
                  showFirstTimeOffer={defaultCurrency === 'INR'}
                  compact
                  onPaymentSuccess={() => {
                    router.refresh();
                    onClose();
                  }}
                />
              </div>
            </motion.section>
          </div>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}

