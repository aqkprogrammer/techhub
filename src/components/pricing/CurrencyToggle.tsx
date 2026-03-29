'use client';

import clsx from 'clsx';
import type { Currency } from './plan-config';

type CurrencyToggleProps = {
  value: Currency;
  onChange: (value: Currency) => void;
};

export default function CurrencyToggle({ value, onChange }: CurrencyToggleProps) {
  return (
    <div className="inline-flex rounded-full border border-slate-300 bg-white p-1 text-xs font-semibold text-slate-600">
      {(['INR', 'USD'] as Currency[]).map((currency) => (
        <button
          key={currency}
          type="button"
          onClick={() => onChange(currency)}
          className={clsx(
            'rounded-full px-3 py-1 transition',
            value === currency
              ? 'bg-slate-900 text-white shadow-sm'
              : 'hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-1'
          )}
        >
          {currency}
        </button>
      ))}
    </div>
  );
}
