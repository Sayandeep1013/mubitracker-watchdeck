import { createContext, useCallback, useContext, useState } from 'react';
import type { DeckFilters } from '@mubitracker/shared';

interface FiltersContextValue {
  filters: DeckFilters;
  setFilters: (f: DeckFilters) => void;
  activeCount: number;
}

const FiltersContext = createContext<FiltersContextValue | null>(null);

/** Shared filter state (spec 06) between the Deck tab and the filters
 * modal — expo-router has no "return a result" navigation primitive, so
 * this plays the role web's local `useState` in DeckView.tsx does, just
 * lifted so a separate route can read/write it. Friend-mode requests
 * (friend_id set) ignore these server-side, same as web — no special
 * casing needed here. */
export function useFilters() {
  const ctx = useContext(FiltersContext);
  if (!ctx) throw new Error('useFilters must be used within a FiltersProvider');
  return ctx;
}

export function FiltersProvider({ children }: { children: React.ReactNode }) {
  const [filters, setFiltersState] = useState<DeckFilters>({});

  const setFilters = useCallback((f: DeckFilters) => setFiltersState(f), []);

  const activeCount = Object.values(filters).filter((v) =>
    Array.isArray(v) ? v.length > 0 : v != null && v !== '',
  ).length;

  return (
    <FiltersContext.Provider value={{ filters, setFilters, activeCount }}>
      {children}
    </FiltersContext.Provider>
  );
}
