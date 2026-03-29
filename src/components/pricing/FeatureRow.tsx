'use client';

import { Check, X } from 'lucide-react';

type FeatureRowProps = {
  label: string;
  included: boolean;
};

export default function FeatureRow({ label, included }: FeatureRowProps) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm text-slate-700">
      <span>{label}</span>
      {included ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-emerald-600">
          <Check className="h-3 w-3" /> Yes
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-1 text-red-600">
          <X className="h-3 w-3" /> No
        </span>
      )}
    </div>
  );
}
