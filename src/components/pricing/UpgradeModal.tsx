'use client';

import { X } from 'lucide-react';

type UpgradeModalProps = {
  open: boolean;
  onClose: () => void;
};

export default function UpgradeModal({ open, onClose }: UpgradeModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40">
      <div className="mx-4 max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-500">Upgrade required</p>
            <h3 className="mt-1 text-xl font-bold text-slate-900">PDF export is lifetime-only</h3>
          </div>
          <button
            type="button"
            aria-label="Close"
            className="rounded-full border border-slate-200 p-1 text-slate-500"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-3 text-sm text-slate-600">
          Upgrade to Lifetime to download curated interview answers as polished PDFs and unlock advanced distribution tools.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            className="rounded-full border border-slate-300 px-4 py-1.5 text-sm font-semibold text-slate-600"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
