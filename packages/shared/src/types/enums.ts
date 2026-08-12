export const MediaFormat = {
  MOVIE: 'movie',
  SERIES: 'series',
} as const;
export type MediaFormat = (typeof MediaFormat)[keyof typeof MediaFormat];

export const Classification = {
  LIVE_ACTION: 'live_action',
  ANIME: 'anime',
  DOCUMENTARY: 'documentary',
  ANIMATION: 'animation',
} as const;
export type Classification = (typeof Classification)[keyof typeof Classification];

export const WatchStatus = {
  WATCHED: 'watched',
  UNWATCHED: 'unwatched',
  WATCH_LATER: 'watch_later',
} as const;
export type WatchStatus = (typeof WatchStatus)[keyof typeof WatchStatus];

export const ReviewStatus = {
  NONE: 'none',
  PENDING: 'pending',
  WRITTEN: 'written',
} as const;
export type ReviewStatus = (typeof ReviewStatus)[keyof typeof ReviewStatus];

export const FriendshipStatus = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  BLOCKED: 'blocked',
} as const;
export type FriendshipStatus = (typeof FriendshipStatus)[keyof typeof FriendshipStatus];

export const PrivacyLevel = {
  PUBLIC: 'public',
  FRIENDS: 'friends',
  PRIVATE: 'private',
} as const;
export type PrivacyLevel = (typeof PrivacyLevel)[keyof typeof PrivacyLevel];

export const DeckSort = {
  RANDOM: 'random',
  POPULAR: 'popular',
  NEWEST: 'newest',
  OLDEST: 'oldest',
} as const;
export type DeckSort = (typeof DeckSort)[keyof typeof DeckSort];

export const MediaProvider = {
  TMDB: 'tmdb',
  IMDB: 'imdb',
  MAL: 'mal',
} as const;
export type MediaProvider = (typeof MediaProvider)[keyof typeof MediaProvider];
