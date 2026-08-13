/**
 * Adult-content rejection rules (spec 21 §4). `include_adult=false` on TMDB
 * requests is necessary but not sufficient — TMDB only flags titles
 * explicitly registered as adult, and a fresh account was served a 2001
 * R-18 title as card #2 that TMDB itself did not flag.
 */

/** Substring match against lowercased title + overview. Keep narrow — this
 * targets explicit/pornographic content, not mature-but-legitimate genres
 * (R-rated horror, war, thriller are fine). */
export const CONTENT_KEYWORD_BLOCKLIST = [
  'xxx',
  'pornographic',
  'porn',
  'erotica',
  'erotic film',
  'hardcore sex',
  'hentai',
  'nsfw',
  'striptease',
  'strip tease',
];

export interface ContentFilterInput {
  title: string;
  overview: string;
  adult: boolean;
  voteCount: number;
  genreIds: number[];
}

export interface ContentFilterResult {
  rejected: boolean;
  reason?: 'tmdb_adult_flag' | 'genre_free_low_votes' | 'keyword_blocklist' | 'insufficient_votes';
}

export function checkContentFilter(input: ContentFilterInput): ContentFilterResult {
  if (input.adult) return { rejected: true, reason: 'tmdb_adult_flag' };

  const text = `${input.title} ${input.overview}`.toLowerCase();
  if (CONTENT_KEYWORD_BLOCKLIST.some((word) => text.includes(word))) {
    return { rejected: true, reason: 'keyword_blocklist' };
  }

  if (input.genreIds.length === 0 && input.voteCount < 50) {
    return { rejected: true, reason: 'genre_free_low_votes' };
  }

  if (input.voteCount < 10) {
    return { rejected: true, reason: 'insufficient_votes' };
  }

  return { rejected: false };
}
