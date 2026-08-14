import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { tmdbPosterUrl } from '@mubitracker/shared';
import { apiClient } from '@/lib/api';
import { ScreenState } from '@/components/ScreenState';
import { color, glassCard, glassChip, radius, space, type } from '@/lib/theme';

interface CollectionItem {
  id: string;
  title: string;
  posterPath: string | null;
  status: string;
  reviewStatus: string;
}

const PAGE_SIZE = 24;

type StatusFilter = 'all' | 'watched' | 'watch_later';
type ReviewFilter = 'all' | 'pending' | 'written';
type FormatFilter = 'all' | 'movie' | 'series';

const STATUS_OPTIONS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'watched', label: 'Watched' },
  { key: 'watch_later', label: 'Watch Later' },
];
const REVIEW_OPTIONS: { key: ReviewFilter; label: string }[] = [
  { key: 'all', label: 'Any review' },
  { key: 'pending', label: 'Review Later' },
  { key: 'written', label: 'Reviewed' },
];
const FORMAT_OPTIONS: { key: FormatFilter; label: string }[] = [
  { key: 'all', label: 'All types' },
  { key: 'movie', label: 'Movies' },
  { key: 'series', label: 'Series' },
];
// Exact TMDB genre names as seeded into the `genres` table (see
// supabase/migrations/20250812000000_initial_schema.sql and
// 20260813000000_seed_tv_genre_ids.sql) — movie and TV sometimes use a
// different name for the same concept (movie "Science Fiction" vs TV
// "Sci-Fi & Fantasy"), so a chip can carry more than one exact name and the
// backend matches any of them, joined with a comma.
const GENRE_OPTIONS: { label: string; names: string[] }[] = [
  { label: 'Action', names: ['Action', 'Action & Adventure'] },
  { label: 'Adventure', names: ['Adventure'] },
  { label: 'Animation', names: ['Animation'] },
  { label: 'Comedy', names: ['Comedy'] },
  { label: 'Crime', names: ['Crime'] },
  { label: 'Documentary', names: ['Documentary'] },
  { label: 'Drama', names: ['Drama'] },
  { label: 'Family', names: ['Family'] },
  { label: 'Fantasy', names: ['Fantasy', 'Sci-Fi & Fantasy'] },
  { label: 'History', names: ['History'] },
  { label: 'Horror', names: ['Horror'] },
  { label: 'Kids', names: ['Kids'] },
  { label: 'Music', names: ['Music'] },
  { label: 'Mystery', names: ['Mystery'] },
  { label: 'Reality', names: ['Reality'] },
  { label: 'Romance', names: ['Romance'] },
  { label: 'Sci-Fi', names: ['Science Fiction', 'Sci-Fi & Fantasy'] },
  { label: 'Thriller', names: ['Thriller'] },
  { label: 'War', names: ['War', 'War & Politics'] },
  { label: 'Western', names: ['Western'] },
];
const LANGUAGE_OPTIONS: { code: string; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ko', label: 'Korean' },
  { code: 'hi', label: 'Hindi' },
  { code: 'zh', label: 'Chinese' },
  { code: 'it', label: 'Italian' },
  { code: 'pt', label: 'Portuguese' },
];

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={4}
      style={[styles.chip, active ? glassChip() : styles.chipInactive]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

export default function CollectionScreen() {
  const [status, setStatus] = useState<StatusFilter>('all');
  const [reviewStatus, setReviewStatus] = useState<ReviewFilter>('all');
  const [format, setFormat] = useState<FormatFilter>('all');
  const [genre, setGenre] = useState<string | null>(null);
  const [language, setLanguage] = useState<string | null>(null);
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);

  const [items, setItems] = useState<CollectionItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Guards against a slow page-2 response landing after a filter change
  // already started a fresh page-1 fetch — only the latest request's
  // result is allowed to touch state.
  const requestId = useRef(0);

  const buildParams = useCallback(
    (pageNum: number) => {
      const params = new URLSearchParams();
      params.set('page', String(pageNum));
      params.set('page_size', String(PAGE_SIZE));
      if (status !== 'all') params.set('status', status);
      if (reviewStatus !== 'all') params.set('review_status', reviewStatus);
      if (format !== 'all') params.set('format', format);
      if (genre) params.set('genre', genre);
      if (language) params.set('language', language);
      return params;
    },
    [status, reviewStatus, format, genre, language],
  );

  const load = useCallback(
    async (pageNum: number, replace: boolean) => {
      const id = ++requestId.current;
      if (replace) setLoading(true);
      else setLoadingMore(true);
      setError(null);
      try {
        const res = await apiClient.getCollection(buildParams(pageNum));
        if (id !== requestId.current) return;
        setItems((prev) => (replace ? (res.items as CollectionItem[]) : [...prev, ...(res.items as CollectionItem[])]));
        setTotal(res.total);
        setPage(pageNum);
      } catch (e) {
        if (id !== requestId.current) return;
        setError(e instanceof Error ? e.message : 'Something went wrong');
      } finally {
        if (id === requestId.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [buildParams],
  );

  // Mount + every filter change.
  useEffect(() => {
    load(1, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, reviewStatus, format, genre, language]);

  // Refresh on refocus (e.g. classified something on Deck) — skip the
  // very first focus, which coincides with the mount effect above and
  // would otherwise double-fetch.
  const didMount = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!didMount.current) {
        didMount.current = true;
        return;
      }
      load(1, true);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const loadMore = () => {
    if (loading || loadingMore || items.length >= total) return;
    load(page + 1, false);
  };

  const showState = !!error || (!loading && items.length === 0);

  return (
    <View style={styles.list}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterRow}
      >
        {STATUS_OPTIONS.map((opt) => (
          <Chip key={opt.key} label={opt.label} active={status === opt.key} onPress={() => setStatus(opt.key)} />
        ))}
        <View style={styles.chipDivider} />
        {REVIEW_OPTIONS.map((opt) => (
          <Chip
            key={opt.key}
            label={opt.label}
            active={reviewStatus === opt.key}
            onPress={() => setReviewStatus(opt.key)}
          />
        ))}
        <View style={styles.chipDivider} />
        {FORMAT_OPTIONS.map((opt) => (
          <Chip key={opt.key} label={opt.label} active={format === opt.key} onPress={() => setFormat(opt.key)} />
        ))}
        <View style={styles.chipDivider} />
        <Chip
          label={moreFiltersOpen ? 'Genre / language ▲' : 'Genre / language ▼'}
          active={moreFiltersOpen || Boolean(genre) || Boolean(language)}
          onPress={() => setMoreFiltersOpen((v) => !v)}
        />
      </ScrollView>

      {moreFiltersOpen && (
        <View style={styles.moreFilters}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filterScroll}
            contentContainerStyle={styles.filterRow}
          >
            <Chip label="Any genre" active={genre == null} onPress={() => setGenre(null)} />
            {GENRE_OPTIONS.map((g) => {
              const value = g.names.join(',');
              return (
                <Chip
                  key={g.label}
                  label={g.label}
                  active={genre === value}
                  onPress={() => setGenre(genre === value ? null : value)}
                />
              );
            })}
          </ScrollView>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filterScroll}
            contentContainerStyle={styles.filterRow}
          >
            <Chip label="Any language" active={language == null} onPress={() => setLanguage(null)} />
            {LANGUAGE_OPTIONS.map((l) => (
              <Chip
                key={l.code}
                label={l.label}
                active={language === l.code}
                onPress={() => setLanguage(language === l.code ? null : l.code)}
              />
            ))}
          </ScrollView>
        </View>
      )}

      {showState ? (
        <ScreenState
          loading={loading && items.length === 0}
          error={error}
          empty={!loading && !error && items.length === 0}
          emptyText="Nothing tracked yet — classify a few titles on the Deck."
          onRetry={() => load(1, true)}
        />
      ) : (
        <FlatList
          style={styles.list}
          data={items}
          numColumns={2}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.container}
          refreshing={loading}
          onRefresh={() => load(1, true)}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={loadingMore ? <ActivityIndicator color={color.primary} style={styles.footerSpinner} /> : null}
          renderItem={({ item }) => {
            const poster = tmdbPosterUrl(item.posterPath, 'card');
            return (
              <View style={[styles.card, glassCard()]} accessibilityLabel={`${item.title}, ${item.status.replace('_', ' ')}`}>
                {poster ? (
                  <Image source={{ uri: poster }} style={styles.poster} />
                ) : (
                  <View style={[styles.poster, styles.posterPlaceholder]} />
                )}
                <Text style={styles.title} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={styles.status}>{item.status.replace('_', ' ')}</Text>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: color.bg },
  container: { padding: space.sm },
  // Without an explicit `flexGrow: 0`, a bare horizontal ScrollView inside
  // this flex-column screen stretched to fill the leftover space the
  // FlatList's `flex: 1` didn't claim yet, leaving its (short) chip content
  // vertically centered inside a much taller empty box — confirmed live,
  // this was the "collection layout messed up" gap between the filter
  // chips and the poster grid.
  filterScroll: { flexGrow: 0, flexShrink: 0 },
  filterRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingHorizontal: space.sm, paddingVertical: space.sm },
  chipDivider: { width: 1, height: 20, backgroundColor: color.border, marginHorizontal: space.xs },
  chip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: radius.pill },
  chipInactive: { backgroundColor: color.surface, borderWidth: 1, borderColor: color.border },
  chipText: { color: color.textMuted, fontSize: type.caption.fontSize, fontWeight: '600' },
  chipTextActive: { color: color.primary },
  moreFilters: { borderTopWidth: 1, borderTopColor: color.border, paddingTop: space.xs },
  footerSpinner: { marginVertical: space.lg },
  card: { flex: 1, margin: space.xs, padding: space.sm },
  poster: { width: '100%', aspectRatio: 2 / 3, borderRadius: radius.sm / 2, marginBottom: space.xs },
  posterPlaceholder: { backgroundColor: color.surfaceHigh },
  title: { color: color.text, fontSize: type.caption.fontSize },
  status: { color: color.textMuted, fontSize: 10, textTransform: 'capitalize' },
});
