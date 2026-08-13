// Spec 50 §6 — minimal client event set. Property keys are kept literally
// as the spec's snake_case names since these are write-only analytics rows,
// not typed API responses, and exact-matching the spec avoids case-mapping
// bugs between the two clients and the query surface.

export interface DeckBatchServedProps {
  count: number;
  latency_ms: number;
  filtered: boolean;
  filter_keys: string[];
  cursor_null: boolean;
  source: 'cold' | 'prefetch';
}

export interface MediaClassifiedProps {
  media_id: string;
  status: string;
  input: 'swipe' | 'key' | 'button';
  ms_since_card_shown: number;
  platform: 'web' | 'mobile';
}

export interface UndoUsedProps {
  depth: number;
  restored_status: string;
  platform: 'web' | 'mobile';
}

export interface DeckEmptyProps {
  filtered: boolean;
  filter_keys: string[];
  batches_served_this_session: number;
}

export interface FilterAppliedProps {
  filter_keys: string[];
  preset: boolean;
  latency_ms: number;
  result_count: number;
}

export type AnalyticsEvent =
  | { event: 'deck_batch_served'; properties: DeckBatchServedProps }
  | { event: 'media_classified'; properties: MediaClassifiedProps }
  | { event: 'undo_used'; properties: UndoUsedProps }
  | { event: 'deck_empty'; properties: DeckEmptyProps }
  | { event: 'filter_applied'; properties: FilterAppliedProps };

export type AnalyticsEventName = AnalyticsEvent['event'];
