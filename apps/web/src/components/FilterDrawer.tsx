'use client';

import {
  FILTER_TYPE_OPTIONS,
  GENRE_MAP,
  RELEASE_ERAS,
  type Classification,
  type DeckFilters,
  type MediaFormat,
} from '@watchdeck/shared';
import type { WatchdeckClient } from '@watchdeck/shared';
import { IconSliders, IconX } from './icons';
import { useEffect, useState } from 'react';

interface FilterDrawerProps {
  filters: DeckFilters;
  onApply: (filters: DeckFilters) => void;
  onClose: () => void;
  client: WatchdeckClient;
}

const GENRE_NAMES = Object.keys(GENRE_MAP);
const LANGUAGES = ['en', 'ja', 'ko', 'hi', 'bn', 'de', 'fr', 'es'];

function typeIsSelected(
  filters: DeckFilters,
  opt: (typeof FILTER_TYPE_OPTIONS)[number],
): boolean {
  const formats = filters.format ?? [];
  const classifications = filters.classification ?? [];
  if (opt.format && opt.classification) {
    return formats.includes(opt.format) && classifications.includes(opt.classification);
  }
  if (opt.format && !opt.classification) {
    return formats.includes(opt.format);
  }
  if (!opt.format && opt.classification) {
    return classifications.includes(opt.classification);
  }
  return false;
}

export function FilterDrawer({ filters, onApply, onClose, client }: FilterDrawerProps) {
  const [local, setLocal] = useState<DeckFilters>(filters);
  const [presetName, setPresetName] = useState('');
  const [presets, setPresets] = useState<
    { id: string; name: string; filterConfig: Record<string, string[]> }[]
  >([]);

  const toggleArray = <K extends keyof DeckFilters>(key: K, value: string) => {
    setLocal((prev) => {
      const arr = (prev[key] as string[] | undefined) ?? [];
      const next = arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
      return { ...prev, [key]: next.length ? next : undefined };
    });
  };

  const selectType = (opt: (typeof FILTER_TYPE_OPTIONS)[number]) => {
    setLocal((prev) => {
      const formats = new Set(prev.format ?? []);
      const classifications = new Set(prev.classification ?? []);
      const selected = typeIsSelected(prev, opt);

      if (selected) {
        if (opt.format) formats.delete(opt.format);
        if (opt.classification) classifications.delete(opt.classification);
      } else {
        if (opt.format) formats.add(opt.format);
        if (opt.classification) classifications.add(opt.classification);
      }

      return {
        ...prev,
        format: formats.size ? ([...formats] as MediaFormat[]) : undefined,
        classification: classifications.size
          ? ([...classifications] as Classification[])
          : undefined,
      };
    });
  };

  const loadPresets = async () => {
    try {
      const data = await client.getFilterPresets();
      setPresets(data as typeof presets);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadPresets();
  }, []);

  const savePreset = async () => {
    if (!presetName.trim()) return;
    const config: Record<string, string[]> = {};
    if (local.format) config.format = local.format;
    if (local.classification) config.classification = local.classification;
    if (local.genres) config.genres = local.genres;
    if (local.language) config.language = local.language;
    if (local.status) config.status = local.status;
    if (local.yearFrom != null) config.year_from = [String(local.yearFrom)];
    if (local.yearTo != null) config.year_to = [String(local.yearTo)];
    await client.createFilterPreset({ name: presetName, filter_config: config });
    setPresetName('');
    loadPresets();
  };

  const applyPreset = (config: Record<string, string[]>) => {
    setLocal({
      format: config.format as DeckFilters['format'],
      classification: config.classification as DeckFilters['classification'],
      genres: config.genres,
      language: config.language,
      status: config.status as DeckFilters['status'],
      yearFrom: config.year_from?.[0] ? parseInt(config.year_from[0], 10) : undefined,
      yearTo: config.year_to?.[0] ? parseInt(config.year_to[0], 10) : undefined,
    });
  };

  const eraSelected = (yearFrom: number | null, yearTo: number | null) =>
    local.yearFrom === (yearFrom ?? undefined) && local.yearTo === (yearTo ?? undefined);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 animate-fade-in md:items-center">
      <div className="max-h-[85vh] w-full max-w-lg animate-slide-up overflow-y-auto rounded-t-2xl border border-neutral-800 bg-neutral-950 p-6 md:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
            <IconSliders className="text-red-400" size={16} />
            Filters
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-900 hover:text-white"
            aria-label="Close filters"
          >
            <IconX size={20} />
          </button>
        </div>

        <section className="mb-4">
          <h3 className="mb-2 text-xs uppercase tracking-wide text-neutral-500">Type</h3>
          <div className="flex flex-wrap gap-2">
            {FILTER_TYPE_OPTIONS.map((opt) => {
              const selected = typeIsSelected(local, opt);
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => selectType(opt)}
                  className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                    selected
                      ? 'border-red-500/50 bg-red-500/15 text-red-300'
                      : 'border-neutral-700 text-neutral-400 hover:border-neutral-500'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </section>

        <section className="mb-4">
          <h3 className="mb-2 text-xs uppercase tracking-wide text-neutral-500">Genre</h3>
          <div className="flex flex-wrap gap-2">
            {GENRE_NAMES.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => toggleArray('genres', g)}
                className={`rounded-full border px-3 py-1.5 text-xs capitalize transition-colors ${
                  local.genres?.includes(g)
                    ? 'border-red-500/50 bg-red-500/15 text-red-300'
                    : 'border-neutral-700 text-neutral-400 hover:border-neutral-500'
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </section>

        <section className="mb-4">
          <h3 className="mb-2 text-xs uppercase tracking-wide text-neutral-500">Language</h3>
          <div className="flex flex-wrap gap-2">
            {LANGUAGES.map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => toggleArray('language', lang)}
                className={`rounded-full border px-3 py-1.5 text-xs uppercase transition-colors ${
                  local.language?.includes(lang)
                    ? 'border-red-500/50 bg-red-500/15 text-red-300'
                    : 'border-neutral-700 text-neutral-400 hover:border-neutral-500'
                }`}
              >
                {lang}
              </button>
            ))}
          </div>
        </section>

        <section className="mb-4">
          <h3 className="mb-2 text-xs uppercase tracking-wide text-neutral-500">Release Era</h3>
          <div className="flex flex-wrap gap-2">
            {RELEASE_ERAS.map((era) => (
              <button
                key={era.label}
                type="button"
                onClick={() =>
                  setLocal((p) =>
                    eraSelected(era.yearFrom, era.yearTo)
                      ? { ...p, yearFrom: undefined, yearTo: undefined }
                      : {
                          ...p,
                          yearFrom: era.yearFrom ?? undefined,
                          yearTo: era.yearTo ?? undefined,
                        },
                  )
                }
                className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                  eraSelected(era.yearFrom, era.yearTo)
                    ? 'border-red-500/50 bg-red-500/15 text-red-300'
                    : 'border-neutral-700 text-neutral-400 hover:border-neutral-500'
                }`}
              >
                {era.label}
              </button>
            ))}
          </div>
        </section>

        <section className="mb-4">
          <h3 className="mb-2 text-xs uppercase tracking-wide text-neutral-500">Your Status</h3>
          <div className="flex gap-2">
            {(['unwatched', 'watched', 'watch_later'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => toggleArray('status', s)}
                className={`rounded-full border px-3 py-1.5 text-xs capitalize transition-colors ${
                  local.status?.includes(s)
                    ? 'border-red-500/50 bg-red-500/15 text-red-300'
                    : 'border-neutral-700 text-neutral-400 hover:border-neutral-500'
                }`}
              >
                {s.replace('_', ' ')}
              </button>
            ))}
          </div>
        </section>

        <section className="mb-6 border-t border-neutral-800 pt-4">
          <h3 className="mb-2 text-xs uppercase tracking-wide text-neutral-500">Saved Presets</h3>
          <div className="mb-2 flex gap-2">
            <input
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="Preset name"
              className="flex-1 rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white"
            />
            <button
              type="button"
              onClick={savePreset}
              className="rounded-lg bg-neutral-800 px-3 text-sm text-neutral-200 hover:bg-neutral-700"
            >
              Save
            </button>
          </div>
          {presets.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => applyPreset(p.filterConfig)}
              className="mr-2 mt-2 rounded-full border border-neutral-700 px-3 py-1 text-xs text-neutral-300 hover:border-neutral-500"
            >
              {p.name}
            </button>
          ))}
        </section>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onApply({})}
            className="flex-1 rounded-lg border border-neutral-700 py-3 text-sm text-neutral-300 hover:bg-neutral-900"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={() => onApply(local)}
            className="flex-1 rounded-lg bg-red-600 py-3 text-sm font-medium text-white hover:bg-red-500"
          >
            Apply Filters
          </button>
        </div>
      </div>
    </div>
  );
}
