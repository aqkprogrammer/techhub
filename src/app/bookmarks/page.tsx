import BookmarksClient from './bookmarks-client';

export const dynamic = 'force-dynamic';

export default function BookmarksPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[rgb(var(--text))]">Bookmarks</h1>
        <p className="mt-1 text-sm text-[rgb(var(--muted))]">
          Your saved interview questions for quick review.
        </p>
      </div>
      <BookmarksClient />
    </main>
  );
}
