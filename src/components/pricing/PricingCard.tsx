'use client';

import clsx from 'clsx';
import { motion } from 'framer-motion';
import { Check, Loader2, X } from 'lucide-react';

import RecommendedBadge from './RecommendedBadge';
import type { Currency, PricingPlan } from './plan-config';

type PricingCardProps = {
  plan: PricingPlan;
  selectedCurrency: Currency;
  onSelectPlan: (planId: PricingPlan['id']) => void;
  loadingPlanId?: PricingPlan['id'] | null;
  firstTimeDiscountText?: string | null;
};

export default function PricingCard({
  plan,
  selectedCurrency,
  onSelectPlan,
  loadingPlanId,
  firstTimeDiscountText,
}: PricingCardProps) {
  const isLifetimePlan = plan.id === 'lifetime';
  const otherCurrency = selectedCurrency === 'INR' ? 'USD' : 'INR';
  const highlighted = plan.price[selectedCurrency];
  const secondary = plan.price[otherCurrency];
  const symbol = selectedCurrency === 'INR' ? '₹' : '$';
  const secondarySymbol = otherCurrency === 'INR' ? '₹' : '$';
  const isLoading = loadingPlanId === plan.id;

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={isLifetimePlan ? { scale: 1.025 } : { scale: 1.012 }}
      className={clsx(
        'relative flex h-full flex-col gap-5 rounded-3xl border p-6 transition-all',
        isLifetimePlan
          ? 'scale-[1.01] border-emerald-300 bg-gradient-to-b from-white to-emerald-50/30 shadow-[0_24px_60px_rgba(16,185,129,0.20)]'
          : 'border-slate-200 bg-white shadow-sm',
      )}
    >
      {isLifetimePlan ? (
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-px -z-10 rounded-3xl bg-gradient-to-r from-emerald-300/40 via-emerald-200/20 to-lime-200/30 blur-xl"
        />
      ) : null}

      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-slate-500">{plan.duration}</p>
          <h3 className="text-2xl font-bold text-slate-900">{plan.title}</h3>
          <p className="mt-1 text-sm text-slate-600">{plan.description}</p>
        </div>
        {plan.recommended ? <RecommendedBadge /> : null}
      </div>

      <div className="space-y-1">
        <div className="flex items-baseline gap-2 text-xl font-semibold text-slate-900">
          <span className="text-3xl">{`${symbol}${highlighted.toLocaleString()}`}</span>
          <span className="text-sm text-slate-500">/{plan.duration.toLowerCase()}</span>
        </div>
        <span className="text-sm text-slate-500">
          {symbol}
          {highlighted.toLocaleString()} / {secondarySymbol}
          {secondary.toLocaleString()}
        </span>
      </div>

      <p className={clsx('text-sm font-medium', isLifetimePlan ? 'text-emerald-700' : 'text-slate-700')}>
        {plan.highlightCopy}
      </p>

      {firstTimeDiscountText && plan.id === 'basic' ? (
        <div className="rounded-2xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
          {firstTimeDiscountText}
        </div>
      ) : null}

      <ul className="space-y-2 text-sm text-slate-700">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            <span>{feature}</span>
          </li>
        ))}
        <li className="flex items-start gap-2">
          {plan.pdfExport ? (
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          ) : (
            <X className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
          )}
          <span>PDF Export</span>
        </li>
      </ul>

      <div className="mt-auto pt-2">
        <button
          type="button"
          onClick={() => onSelectPlan(plan.id)}
          disabled={isLoading}
          className={clsx(
            'inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-70',
            isLifetimePlan
              ? 'bg-slate-900 text-white shadow-lg shadow-slate-700/10 hover:bg-slate-800'
              : 'border border-slate-300 bg-white text-slate-900 hover:border-slate-400',
          )}
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            'Unlock Now'
          )}
        </button>
      </div>
    </motion.div>
  );
}
