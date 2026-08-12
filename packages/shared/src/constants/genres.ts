export const GENRE_MAP: Record<string, number> = {
  action: 28,
  adventure: 12,
  animation: 16,
  comedy: 35,
  crime: 80,
  documentary: 99,
  drama: 18,
  fantasy: 14,
  horror: 27,
  mystery: 9648,
  romance: 10749,
  'sci-fi': 878,
  thriller: 53,
  war: 10752,
  western: 37,
};

/** TV discover uses different IDs for some genres. */
export const TV_GENRE_MAP: Record<string, number> = {
  action: 10759,
  adventure: 10759,
  animation: 16,
  comedy: 35,
  crime: 80,
  documentary: 99,
  drama: 18,
  fantasy: 10765,
  horror: 9648,
  mystery: 9648,
  romance: 10749,
  'sci-fi': 10765,
  thriller: 53,
  war: 10768,
  western: 37,
};

export const GENRE_LABELS: Record<number, string> = Object.fromEntries(
  Object.entries(GENRE_MAP).map(([k, v]) => [v, k.charAt(0).toUpperCase() + k.slice(1)]),
);

export function genreNamesToIds(
  names: string[],
  format: 'movie' | 'series' = 'movie',
): number[] {
  const map = format === 'series' ? TV_GENRE_MAP : GENRE_MAP;
  return names
    .map((n) => {
      const key = n.toLowerCase().replace(/\s+/g, '-');
      return map[key] ?? GENRE_MAP[key];
    })
    .filter((id): id is number => id != null);
}

export function genreIdsToTmdbParam(ids: number[], mode: 'or' | 'and' = 'or'): string {
  return mode === 'or' ? ids.join('|') : ids.join(',');
}
