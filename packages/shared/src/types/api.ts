import type { DeckItem, MediaSummary } from './media.js';
import type {
  CollectionComparison,
  FilterPreset,
  Friendship,
  Profile,
  Recommendation,
  Review,
} from './user.js';

export interface ApiError {
  error: { code: string; message: string };
}

export interface SearchResponse {
  results: MediaSummary[];
  total: number;
}

export interface DeckResponse {
  items: DeckItem[];
  // v1 (generate.ts) shape:
  cursor?: string | null;
  sessionId?: string;
  message?: string;
  // v2 (bucket-service.ts) shape — present only when DECK_ENGINE=v2:
  bucketId?: string;
  position?: number;
  partial?: boolean;
  reason?: 'no_matches_for_filters' | 'corpus_exhausted';
}

export interface CollectionResponse {
  items: (MediaSummary & {
    status: string;
    reviewStatus: string;
    watchedAt: string | null;
  })[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ExportData {
  export_version: 1;
  exported_at: string;
  media: ExportMediaItem[];
}

export interface ExportMediaItem {
  provider: string;
  provider_id: string;
  title: string;
  format: string;
  classification: string;
  status: string;
  review_status: string;
  watched_at: string | null;
  review: { body: string; is_spoiler: boolean } | null;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

export type FriendsResponse = Friendship[];
export type RecommendationsResponse = Recommendation[];
export type PendingReviewsResponse = (MediaSummary & { reviewStatus: string })[];
export type FilterPresetsResponse = FilterPreset[];
export type CompareResponse = CollectionComparison;
