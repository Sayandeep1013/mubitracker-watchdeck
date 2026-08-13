import Image from 'next/image';
import Link from 'next/link';

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-lg p-4">
      <Link href="/profile" className="mb-4 inline-block text-sm text-zinc-500">
        ← Back
      </Link>
      <h1 className="mb-4 text-2xl font-bold">About Mubitracker</h1>
      <p className="mb-6 text-sm text-zinc-400">
        Mubitracker is a frictionless personal media memory system. Track what you&apos;ve watched
        with one decision per title.
      </p>

      <section className="rounded-xl border border-zinc-800 p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase text-zinc-500">Data Attribution</h2>
        <div className="mb-4 flex items-center gap-4">
          <Image src="/tmdb.svg" alt="TMDB" width={120} height={16} />
        </div>
        <p className="text-sm text-zinc-400">
          This product uses the TMDB API but is not endorsed or certified by TMDB.
        </p>
        <a
          href="https://www.themoviedb.org/"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block text-sm text-blue-400 hover:underline"
        >
          The Movie Database (TMDB)
        </a>
      </section>
    </div>
  );
}
