import type {
  CollectionResponse,
  CompareResponse,
  DeckResponse,
  ExportData,
  FilterPresetsResponse,
  FriendsResponse,
  ImportResult,
  PendingReviewsResponse,
  ReviewsResponse,
  SearchResponse,
} from './types/api.js';
import type { AnalyticsEvent } from './types/analytics.js';
import type { Profile, Review } from './types/user.js';
import type {
  CreateReviewInput,
  ImportInput,
  UpdateUserMediaInput,
} from './schemas/index.js';
import type { z } from 'zod';
import { filterPresetSchema, updateProfileSchema } from './schemas/index.js';

type FilterPresetInput = z.infer<typeof filterPresetSchema>;
type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export interface MubitrackerClientOptions {
  baseUrl: string;
  getAccessToken: () => Promise<string | null>;
  /** Hard ceiling on a single request, in ms. See DEFAULT_TIMEOUT_MS. */
  timeoutMs?: number;
}

/**
 * React Native's fetch has no default timeout, so a request that stalls —
 * flaky signal, a WiFi/cellular handover, the device sleeping mid-flight —
 * never settles. Callers await forever: on mobile `useFocusFetch` leaves
 * `loading` true with no error and no retry, which is a screen stuck on a
 * spinner indefinitely. A request that cannot finish must fail rather than
 * hang, so the UI can show an error and offer Retry.
 */
const DEFAULT_TIMEOUT_MS = 20_000;
const TIMEOUT_MESSAGE = 'Request timed out — check your connection';

export class MubitrackerClient {
  constructor(private options: MubitrackerClientOptions) {}

  private async fetch<T>(path: string, init?: RequestInit): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

    // `getAccessToken` is inside the deadline, not outside it: on mobile it
    // calls into Supabase, which may itself go to the network to refresh an
    // expired token. A hang there stalls the request before `fetch` is even
    // reached, and an AbortSignal alone would never cover it.
    const deadline = new Promise<never>((_, reject) => {
      controller.signal.addEventListener('abort', () => reject(new Error(TIMEOUT_MESSAGE)));
    });
    // Whichever leg loses the race stays pending; without this it would
    // surface as an unhandled rejection if the deadline fires later.
    deadline.catch(() => {});

    try {
      const token = await Promise.race([this.options.getAccessToken(), deadline]);
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(init?.headers as Record<string, string>),
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${this.options.baseUrl}${path}`, {
        ...init,
        headers,
        signal: controller.signal,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
        throw new Error(err.error?.message ?? 'Request failed');
      }
      return (await res.json()) as T;
    } catch (e) {
      // An abort surfaces as a DOMException/AbortError, which reads as
      // nothing useful in a toast — report why it actually failed.
      if (controller.signal.aborted) throw new Error(TIMEOUT_MESSAGE);
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }

  search(q: string, limit = 20) {
    return this.fetch<SearchResponse>(`/api/v1/search?q=${encodeURIComponent(q)}&limit=${limit}`);
  }

  getMedia(id: string) {
    return this.fetch(`/api/v1/media/${id}`);
  }

  getImdbLink(mediaId: string) {
    return this.fetch<{ imdbId: string | null; imdbUrl: string | null }>(
      `/api/v1/media/${mediaId}/imdb`,
    );
  }

  getDeck(params?: URLSearchParams) {
    const qs = params?.toString();
    return this.fetch<DeckResponse>(`/api/v1/deck${qs ? `?${qs}` : ''}`);
  }

  updateUserMedia(mediaId: string, body: UpdateUserMediaInput) {
    return this.fetch(`/api/v1/user-media/${mediaId}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  reviewLater(mediaId: string) {
    return this.fetch('/api/v1/user-media/review-later', {
      method: 'POST',
      body: JSON.stringify({ media_id: mediaId }),
    });
  }

  watchLater(mediaId: string) {
    return this.fetch('/api/v1/user-media/watch-later', {
      method: 'POST',
      body: JSON.stringify({ media_id: mediaId }),
    });
  }

  getWatchLater() {
    return this.fetch<PendingReviewsResponse>('/api/v1/user-media/watch-later');
  }

  getCollection(params?: URLSearchParams) {
    const qs = params?.toString();
    return this.fetch<CollectionResponse>(`/api/v1/collection${qs ? `?${qs}` : ''}`);
  }

  getReviews() {
    return this.fetch<ReviewsResponse>('/api/v1/reviews');
  }

  getReview(id: string) {
    return this.fetch<Review>(`/api/v1/reviews/${id}`);
  }

  getPendingReviews() {
    return this.fetch<PendingReviewsResponse>('/api/v1/reviews/pending');
  }

  createReview(body: CreateReviewInput) {
    return this.fetch<Review>('/api/v1/reviews', { method: 'POST', body: JSON.stringify(body) });
  }

  updateReview(id: string, body: Partial<CreateReviewInput>) {
    return this.fetch<Review>(`/api/v1/reviews/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  }

  deleteReview(id: string) {
    return this.fetch<{ deleted: boolean }>(`/api/v1/reviews/${id}`, { method: 'DELETE' });
  }

  exportData() {
    return this.fetch<ExportData>('/api/v1/export');
  }

  importData(body: ImportInput) {
    return this.fetch<ImportResult>('/api/v1/import', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  getProfile() {
    return this.fetch<Profile>('/api/v1/profile');
  }

  updateProfile(body: UpdateProfileInput) {
    return this.fetch<Profile>('/api/v1/profile', {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  }

  deleteProfile() {
    return this.fetch<void>('/api/v1/profile', { method: 'DELETE' });
  }

  getFilterPresets() {
    return this.fetch<FilterPresetsResponse>('/api/v1/filter-presets');
  }

  createFilterPreset(body: FilterPresetInput) {
    return this.fetch('/api/v1/filter-presets', { method: 'POST', body: JSON.stringify(body) });
  }

  deleteFilterPreset(id: string) {
    return this.fetch(`/api/v1/filter-presets/${id}`, { method: 'DELETE' });
  }

  undo(body: {
    media_id: string;
    previous_status: string;
    previous_review_status: string;
    previous_reject_count?: number;
    previous_hidden_until?: string | null;
  }) {
    return this.fetch('/api/v1/user-media/undo', { method: 'POST', body: JSON.stringify(body) });
  }

  getFriends(status?: string) {
    const qs = status ? `?status=${encodeURIComponent(status)}` : '';
    return this.fetch<FriendsResponse>(`/api/v1/friends${qs}`);
  }

  searchFriends(q: string) {
    return this.fetch<{ results: { id: string; username: string; avatarUrl: string | null }[] }>(
      `/api/v1/friends/search?q=${encodeURIComponent(q)}`,
    );
  }

  sendFriendRequest(body: { username?: string; user_id?: string }) {
    return this.fetch('/api/v1/friends', { method: 'POST', body: JSON.stringify(body) });
  }

  acceptFriend(id: string) {
    return this.fetch(`/api/v1/friends/${id}/accept`, { method: 'POST' });
  }

  declineFriend(id: string) {
    return this.fetch(`/api/v1/friends/${id}/decline`, { method: 'POST' });
  }

  cancelFriend(id: string) {
    return this.fetch(`/api/v1/friends/${id}/cancel`, { method: 'POST' });
  }

  blockFriend(id: string) {
    return this.fetch(`/api/v1/friends/${id}/block`, { method: 'POST' });
  }

  unblockFriend(id: string) {
    return this.fetch(`/api/v1/friends/${id}/block`, { method: 'DELETE' });
  }

  getNotifications(unread = false) {
    return this.fetch<{
      unreadCount: number;
      items: {
        id: string;
        type: string;
        friendshipId: string | null;
        readAt: string | null;
        createdAt: string;
        actor: { id: string; username: string; avatarUrl: string | null } | null;
      }[];
    }>(`/api/v1/notifications${unread ? '?unread=1' : ''}`);
  }

  markNotificationsRead(body: { ids?: string[]; all?: boolean }) {
    return this.fetch('/api/v1/notifications/read', { method: 'POST', body: JSON.stringify(body) });
  }

  getFriendProfile(id: string) {
    return this.fetch<Profile>(`/api/v1/friends/${id}/profile`);
  }

  compareWithFriend(id: string) {
    return this.fetch<CompareResponse>(`/api/v1/friends/${id}/compare`);
  }

  /** Fire-and-forget: analytics must never break the UX it's measuring. */
  trackEvent(event: AnalyticsEvent): void {
    this.fetch('/api/v1/analytics/events', {
      method: 'POST',
      body: JSON.stringify(event),
    }).catch(() => {});
  }
}
