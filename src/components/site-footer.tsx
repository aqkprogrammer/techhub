import Link from 'next/link';

export default function SiteFooter() {
  return (
    <footer className="border-t border-[rgb(var(--border))] bg-[rgb(var(--bg))]">
      <div className="mx-auto w-full max-w-6xl px-6 py-8">
        <div className="flex flex-col gap-4 text-sm text-[rgb(var(--muted))] lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p>© {new Date().getFullYear()} techhub.cafe. All rights reserved.</p>
            <p className="mt-1 text-xs">
              Coded with 🧡 using React in India 🇮🇳
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.2em]">
            <span>Built for developers</span>
            <span>Interview-first UX</span>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-[rgb(var(--border))] pt-4 text-xs">
          <Link href="/interview-questions" className="text-[rgb(var(--accent))] hover:underline">
            All questions
          </Link>
          <Link href="/interview-questions/fullstack" className="text-[rgb(var(--accent))] hover:underline">
            Full-Stack
          </Link>
          <Link href="/interview-questions/dsa" className="text-[rgb(var(--accent))] hover:underline">
            DSA
          </Link>
          <Link href="/interview-questions/system-design" className="text-[rgb(var(--accent))] hover:underline">
            System Design
          </Link>
          <Link href="/interview-questions/ml" className="text-[rgb(var(--accent))] hover:underline">
            ML
          </Link>
        </div>
      </div>
    </footer>
  );
}
