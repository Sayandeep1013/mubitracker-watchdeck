'use client';

import type { MediaSummary } from '@watchdeck/shared';
import { FILTER_TYPE_OPTIONS, tmdbPosterUrl } from '@watchdeck/shared';
import Image from 'next/image';
import { useMemo, useState } from 'react';
import { useApiClient } from '@/hooks/useApiClient';

export default function SearchPage() {
  const client = useApiClient();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MediaSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [tracked, setTracked] = useState<Set<string>>(new Set());
  const [formats, setFormats] = useState<string[]>([]);
  const [classifications, setClassifications] = useState<string[]>([]);
  const [language, setLanguage] = useState('');

  const search = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const data = await client.search(query.trim());
      setResults(data.results);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    return results.filter((r) => {
      if (formats.length && !formats.includes(r.format)) return false;
      if (classifications.length && !classifications.includes(r.classification)) return false;
      if (language && r.originalLanguage !== language) return false;
      return true;
    });
  }, [results, formats, classifications, language]);

  const toggle = (list: string[], value: string, set: (v: string[]) => void) => {
    set(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);
  };

  const track = async (mediaId: string, status: 'watched' | 'unwatched' | 'watch_later') => {
    try {
      if (status === 'watch_later') await client.watchLater(mediaId);
      else await client.updateUserMedia(mediaId, { status, review_status: 'none' });
      setTracked((s) => new Set(s).add(mediaId));
    } catch {
      /* ignore */
    }
  };

  const reviewLater = async (mediaId: string) => {
    try {
      await client.reviewLater(mediaId);
      setTracked((s) => new Set(s).add(mediaId));
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="mx-auto max-w-2xl p-4">
      <h1 className="mb-4 text-2xl font-bold text-white">Search</h1>
      <div className="mb-4 flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && search()}
          placeholder="Find a title..."
          className="flex-1 rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-2.5 text-sm text-white placeholder-neutral-600 focus:border-red-500/50 focus:outline-none"
        />
        <button
          type="button"
          onClick={search}
          disabled={loading}
          className="rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
        >
          {loading ? '...' : 'Search'}
        </button>
      </div>

      <div className="mb-4 space-y-2 rounded-xl border border-neutral-800 p-3">
        <p className="text-[10px] uppercase tracking-wide text-neutral-500">Filters</p>
        <div className="flex flex-wrap gap-2">
          {FILTER_TYPE_OPTIONS.map((opt) => {
            const active = opt.format
              ? formats.includes(opt.format) &&
                (!opt.classification || classifications.includes(opt.classification))
              : opt.classification
                ? classifications.includes(opt.classification)
                : false;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  if (opt.format) toggle(formats, opt.format, setFormats);
                  if (opt.classification)
                    toggle(classifications, opt.classification, setClassifications);
                }}
                className={`rounded-full border px-2.5 py-1 text-[11px] ${
                  active
                    ? 'border-red-500/40 text-red-300'
                    : 'border-neutral-700 text-neutral-500'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-2">
          {['', 'en', 'ja', 'ko', 'hi'].map((lang) => (
            <button
              key={lang || 'any'}
              type="button"
              onClick={() => setLanguage(lang)}
              className={`rounded-full border px-2.5 py-1 text-[11px] uppercase ${
                language === lang
                  ? 'border-red-500/40 text-red-300'
                  : 'border-neutral-700 text-neutral-500'
              }`}
            >
              {lang || 'any lang'}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {filtered.map((item) => {
          const poster = tmdbPosterUrl(item.posterPath, 'card');
          const isTracked = tracked.has(item.id);
          return (
            <div
              key={item.id}
              className="flex gap-4 rounded-xl border border-neutral-800/50 bg-neutral-900/30 p-3"
            >
              <div className="relative h-24 w-16 shrink-0 overflow-hidden rounded bg-neutral-800">
                {poster && <Image src={poster} alt="" fill className="object-cover" unoptimized />}
              </div>
              <div className="flex flex-1 flex-col justify-between">
                <div>
                  <p className="font-medium text-white">{item.title}</p>
                  <p className="text-xs text-neutral-500">
                    {item.year} · {item.displayType} · {item.originalLanguage}
                  </p>
                </div>
                {!isTracked ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => track(item.id, 'watched')}
                      className="text-xs text-green-400"
                    >
                      Watched
                    </button>
                    <button
                      type="button"
                      onClick={() => track(item.id, 'unwatched')}
                      className="text-xs text-red-400"
                    >
                      Haven&apos;t
                    </button>
                    <button
                      type="button"
                      onClick={() => track(item.id, 'watch_later')}
                      className="text-xs text-amber-400"
                    >
                      Watch Later
                    </button>
                    <button
                      type="button"
                      onClick={() => reviewLater(item.id)}
                      className="text-xs text-purple-400"
                    >
                      Review Later
                    </button>
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-neutral-500">Saved</p>
                )}
              </div>
            </div>
          );
        })}
        {!loading && results.length > 0 && filtered.length === 0 && (
          <p className="text-sm text-neutral-600">No results match filters</p>
        )}
      </div>
    </div>
  );
}
