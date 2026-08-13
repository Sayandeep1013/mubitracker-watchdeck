import type { PrivacyLevel, ReviewStatus, WatchStatus } from './enums.js';
import type { MediaSummary } from './media.js';

export interface Profile {
  id: string;
  username: string;
  avatarUrl: string | null;
  profileVisibility: PrivacyLevel;
  collectionVisibility: PrivacyLevel;
  reviewsVisibility: PrivacyLevel;
  watchedCount?: number;
  reviewCount?: number;
  friendsCount?: number;
}

export interface UserMedia {
  id: string;
  userId: string;
  mediaId: string;
  status: WatchStatus;
  reviewStatus: ReviewStatus;
  watchedAt: string | null;
}

export interface Review {
  id: string;
  userId: string;
  mediaId: string;
  body: string;
  isSpoiler: boolean;
  visibility: PrivacyLevel;
  createdAt: string;
  updatedAt: string;
  media?: MediaSummary;
}

export interface Friendship {
  id: string;
  requesterId: string;
  receiverId: string;
  status: string;
  friend?: Profile;
}

export interface Recommendation {
  id: string;
  senderId: string;
  receiverId: string;
  mediaId: string;
  message: string | null;
  createdAt: string;
  media?: MediaSummary;
  sender?: Profile;
}

export interface CollectionComparison {
  bothWatched: number;
  youOnly: number;
  friendOnly: number;
  bothWatchedItems: MediaSummary[];
  friendOnlyItems: MediaSummary[];
}

export interface FilterPreset {
  id: string;
  name: string;
  filterConfig: Record<string, string[]>;
}

export interface UndoAction {
  mediaId: string;
  previousStatus: WatchStatus;
  previousReviewStatus: ReviewStatus;
  previousRejectCount: number;
  previousHiddenUntil: string | null;
  timestamp: string;
}

export interface OfflineAction {
  mediaId: string;
  status: WatchStatus;
  reviewStatus: ReviewStatus;
  timestamp: string;
  synced: boolean;
}
