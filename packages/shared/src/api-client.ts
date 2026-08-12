import type {
  CollectionResponse,
  CompareResponse,
  DeckResponse,
  ExportData,
  FilterPresetsResponse,
  FriendsResponse,
  ImportResult,
  PendingReviewsResponse,
  RecommendationsResponse,
  SearchResponse,
} from './types/api.js';
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
}

export class MubitrackerClient {
  constructor(private options: MubitrackerClientOptions) {}

  private async fetch<T>(path: string, init?: RequestInit): Promise<T> {
    const token = await this.options.getAccessToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(init?.headers as Record<string, string>),
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${this.options.baseUrl}${path}`, { ...init, headers });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
      throw new Error(err.error?.message ?? 'Request failed');
    }
    return res.json() as Promise<T>;
  }

  search(q: string, limit = 20) {
    return this.fetch<SearchResponse>(`/api/v1/search?q=${encodeURIComponent(q)}&limit=${limit}`);
  }

  getMedia(id: string) {
    return this.fetch(`/api/v1/media/${id}`);
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
    return this.fetch('/api/v1/notifications', { method: 'POST', body: JSON.stringify(body) });
  }

  getFriendProfile(id: string) {
    return this.fetch<Profile>(`/api/v1/friends/${id}/profile`);
  }

  getFriendCollection(id: string, params?: URLSearchParams) {
    const qs = params?.toString();
    return this.fetch<CollectionResponse>(
      `/api/v1/friends/${id}/collection${qs ? `?${qs}` : ''}`,
    );
  }

  compareWithFriend(id: string) {
    return this.fetch<CompareResponse>(`/api/v1/friends/${id}/compare`);
  }

  getRecommendations() {
    return this.fetch<RecommendationsResponse>('/api/v1/recommendations');
  }

  sendRecommendation(body: { receiver_id: string; media_id: string; message?: string }) {
    return this.fetch('/api/v1/recommendations', { method: 'POST', body: JSON.stringify(body) });
  }
}
