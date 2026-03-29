"use client";

import Link from "next/link";
import { Home, Search, ArrowLeft } from "lucide-react";

export default function NavigationActions() {
  return (
    <div className="mt-5 mb-5 flex flex-wrap items-center justify-center gap-4">
      
      {/* Primary CTA */}
      <Link
        href="/"
        className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-medium text-white shadow-md hover:bg-indigo-500 transition"
      >
        <Home size={18} />
        Back to Home
      </Link>

      {/* Secondary CTA */}
      <Link
        href="/interview-questions"
        className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-medium text-slate-700 hover:bg-slate-100 transition"
      >
        <Search size={18} />
        Browse Questions
      </Link>

      {/* Tertiary CTA */}
      <button
        onClick={() => window.history.back()}
        className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-medium text-slate-600 hover:text-slate-900 transition"
      >
        <ArrowLeft size={18} />
        Go Back
      </button>

    </div>
  );
}
