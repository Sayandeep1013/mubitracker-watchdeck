'use client';

import { tmdbPosterUrl } from '@watchdeck/shared';
import Image from 'next/image';
import { useCallback, useEffect, useState } from 'react';
import { useApiClient } from '@/hooks/useApiClient';

interface CollectionItem {
  id: string;
  title: string;
  year: number | null;
  displayType: string;
  posterPath: string | null;
  status: string;
  reviewStatus: string;
  format: string;
}

const TABS = [
  { label: 'All', format: '', classification: '' },
  { label: 'Movies', format: 'movie', classification: '' },
  { label: 'Series', format: 'series', classification: '' },
  { label: 'Anime', format: '', classification: 'anime' },
];

const SORTS = [
  { label: 'Recent', value: 'recent' },
  { label: 'Title A-Z', value: 'alpha' },
  { label: 'Year', value: 'year' },
];

export default function CollectionPage() {
  const client = useApiClient();
  const [items, setItems] = useState<CollectionItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [formatTab, setFormatTab] = useState<string>('');
  const [classificationTab, setClassificationTab] = useState<string>('');
  const [sort, setSort] = useState<string>('recent');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<'grid' | 'list'>('grid');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (q) params.set('q', q);
      if (sort) params.set('sort', sort);
      if (formatTab) params.set('format', formatTab);
      if (classificationTab) params.set('classification', classificationTab);
      params.set('page', String(page));
      const data = await client.getCollection(params);
      setItems(data.items as CollectionItem[]);
    } finally {
      setLoading(false);
    }
  }, [client, statusFilter, q, sort, formatTab, classificationTab, page]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Collection</h1>
        <button
          type="button"
          onClick={() => setView(view === 'grid' ? 'list' : 'grid')}
          className="rounded border border-neutral-800 px-2 py-1 text-xs text-neutral-500 hover:text-neutral-300"
        >
          {view === 'grid' ? 'List' : 'Grid'}
        </button>
      </div>

      {/* Format / classification tabs */}
      <div className="mb-3 flex gap-1">
        {TABS.map((tab) => {
          const active = formatTab === tab.format && classificationTab === tab.classification;
          return (
            <button
              key={tab.label}
              type="button"
              onClick={() => {
                setFormatTab(tab.format);
                setClassificationTab(tab.classification);
                setPage(1);
              }}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                active
                  ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                  : 'text-neutral-500 border border-neutral-800 hover:text-neutral-300'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {['', 'watched', 'unwatched'].map((s) => (
          <button
            key={s || 'all'}
            type="button"
            onClick={() => { setStatusFilter(s); setPage(1); }}
            className={`rounded-full border px-3 py-1 text-xs ${
              statusFilter === s ? 'border-red-500/40 text-red-400' : 'border-neutral-800 text-neutral-500'
            }`}
          >
            {s || 'All'}
          </button>
        ))}
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="rounded border border-neutral-800 bg-neutral-900 px-2 py-1 text-xs text-neutral-400"
        >
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setPage(1); }}
          placeholder="Search collection..."
          className="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-1 text-sm text-white placeholder-neutral-600"
        />
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-neutral-600">Loading...</div>
      ) : items.length === 0 ? (
        <div className="py-12 text-center text-sm text-neutral-600">No items found</div>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {items.map((item) => {
            const poster = tmdbPosterUrl(item.posterPath, 'card');
            return (
              <div key={item.id} className="rounded-lg border border-neutral-800/50 bg-neutral-900/30 p-2">
                <div className="relative mb-2 aspect-[2/3] overflow-hidden rounded bg-neutral-800">
                  {poster && <Image src={poster} alt="" fill className="object-cover" unoptimized />}
                </div>
                <p className="truncate text-sm font-medium text-white">{item.title}</p>
                <p className="text-xs text-neutral-500">{item.year} · {item.displayType}</p>
                <p className={`text-xs capitalize ${item.status === 'watched' ? 'text-green-400' : 'text-red-400'}`}>
                  {item.status}
                </p>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-1">
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-3 rounded border border-neutral-800/30 px-3 py-2">
              <span className={`text-xs font-medium ${item.status === 'watched' ? 'text-green-400' : 'text-red-400'}`}>
                {item.status === 'watched' ? '✓' : '×'}
              </span>
              <span className="flex-1 truncate text-sm text-white">{item.title}</span>
              <span className="text-xs text-neutral-600">{item.year}</span>
              <span className="text-xs text-neutral-600">{item.displayType}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
