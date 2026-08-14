import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BackHandler,
  Dimensions,
  InteractionManager,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  FILTER_TYPE_OPTIONS,
  GENRE_MAP,
  RELEASE_ERAS,
  type Classification,
  type DeckFilters,
  type FilterPreset,
  type MediaFormat,
} from '@mubitracker/shared';
import { apiClient } from '@/lib/api';
import { useFilters } from '@/lib/filters';
import { useToast } from '@/components/Toast';
import { color, glassChip, radius, space, type } from '@/lib/theme';

const SHEET_TRAVEL = Dimensions.get('window').height;
const OPEN_MS = 320;
const CLOSE_MS = 260;

const GENRE_NAMES = Object.keys(GENRE_MAP);
const LANGUAGES = ['en', 'ja', 'ko', 'hi', 'bn', 'de', 'fr', 'es'];
const STATUSES = ['unwatched', 'watched', 'watch_later'] as const;

function typeIsSelected(filters: DeckFilters, opt: (typeof FILTER_TYPE_OPTIONS)[number]): boolean {
  const formats = filters.format ?? [];
  const classifications = filters.classification ?? [];
  if (opt.format && opt.classification) {
    return formats.includes(opt.format) && classifications.includes(opt.classification);
  }
  if (opt.format && !opt.classification) return formats.includes(opt.format);
  if (!opt.format && opt.classification) return classifications.includes(opt.classification);
  return false;
}

export default function FiltersScreen() {
  const router = useRouter();
  const showToast = useToast();
  const { filters, setFilters } = useFilters();
  const [local, setLocal] = useState<DeckFilters>(filters);
  const [presetName, setPresetName] = useState('');
  const [presets, setPresets] = useState<FilterPreset[]>([]);
  const [saving, setSaving] = useState(false);

  // The sheet's motion is driven here rather than by the navigator's
  // `animation` option. On Android this version of react-native-screens
  // animates the vertical presets (`slide_from_bottom`, `fade_from_bottom`)
  // on push but cuts instantly on pop — established by high-rate on-device
  // capture: opening reliably produced mid-slide frames, closing produced
  // zero across every run, for both the Close button and hardware back.
  // Horizontal (`slide_from_right`) pops fine, which is why the rest of the
  // app uses it, but Filters should read as a sheet coming up and going back
  // down. Reanimated drives both directions itself, so the close is
  // symmetric with the open by construction — the same approach MenuDrawer
  // already uses here.
  const translateY = useSharedValue(SHEET_TRAVEL);
  const backdrop = useSharedValue(0);
  const dismissing = useRef(false);

  useEffect(() => {
    translateY.value = withTiming(0, { duration: OPEN_MS, easing: Easing.out(Easing.cubic) });
    backdrop.value = withTiming(1, { duration: OPEN_MS });
  }, [translateY, backdrop]);

  // `router.back()` only ever runs once the slide-down has finished, so the
  // screen is never torn out from under its own exit animation.
  const dismiss = useCallback(
    (onClosed?: () => void) => {
      if (dismissing.current) return;
      dismissing.current = true;
      const finish = () => {
        router.back();
        if (onClosed) InteractionManager.runAfterInteractions(onClosed);
      };
      // If the animation is interrupted rather than completed, the guard has
      // to be released. Leaving it latched would make every later close a
      // no-op — a sheet stuck open with no way out.
      const release = () => {
        dismissing.current = false;
      };
      backdrop.value = withTiming(0, { duration: CLOSE_MS });
      translateY.value = withTiming(
        SHEET_TRAVEL,
        { duration: CLOSE_MS, easing: Easing.in(Easing.cubic) },
        (finished) => {
          if (finished) runOnJS(finish)();
          else runOnJS(release)();
        },
      );
    },
    [router, translateY, backdrop],
  );

  // Hardware back has to run the same animated path, or it pops instantly and
  // the sheet vanishes without sliding down.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      dismiss();
      return true;
    });
    return () => sub.remove();
  }, [dismiss]);

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.value }));

  const loadPresets = () => {
    apiClient
      .getFilterPresets()
      .then((data) => setPresets(data as FilterPreset[]))
      .catch(() => {});
  };

  useEffect(() => {
    loadPresets();
  }, []);

  const toggleArray = <K extends keyof DeckFilters>(key: K, value: string) => {
    setLocal((prev) => {
      const arr = (prev[key] as string[] | undefined) ?? [];
      const next = arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
      return { ...prev, [key]: next.length ? next : undefined };
    });
  };

  const selectType = (opt: (typeof FILTER_TYPE_OPTIONS)[number]) => {
    setLocal((prev) => {
      const formats = new Set(prev.format ?? []);
      const classifications = new Set(prev.classification ?? []);
      const selected = typeIsSelected(prev, opt);
      if (selected) {
        if (opt.format) formats.delete(opt.format);
        if (opt.classification) classifications.delete(opt.classification);
      } else {
        if (opt.format) formats.add(opt.format);
        if (opt.classification) classifications.add(opt.classification);
      }
      return {
        ...prev,
        format: formats.size ? ([...formats] as MediaFormat[]) : undefined,
        classification: classifications.size ? ([...classifications] as Classification[]) : undefined,
      };
    });
  };

  const eraSelected = (yearFrom: number | null, yearTo: number | null) =>
    local.yearFrom === (yearFrom ?? undefined) && local.yearTo === (yearTo ?? undefined);

  const savePreset = async () => {
    if (!presetName.trim() || saving) return;
    setSaving(true);
    const config: Record<string, string[]> = {};
    if (local.format) config.format = local.format;
    if (local.classification) config.classification = local.classification;
    if (local.genres) config.genres = local.genres;
    if (local.language) config.language = local.language;
    if (local.status) config.status = local.status;
    if (local.yearFrom != null) config.year_from = [String(local.yearFrom)];
    if (local.yearTo != null) config.year_to = [String(local.yearTo)];
    try {
      await apiClient.createFilterPreset({ name: presetName.trim(), filter_config: config });
      setPresetName('');
      loadPresets();
      showToast({ message: `Saved preset "${presetName.trim()}"`, tone: 'success' });
    } catch (e) {
      showToast({ message: e instanceof Error ? e.message : 'Could not save preset', tone: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const applyPreset = (preset: FilterPreset) => {
    const config = preset.filterConfig;
    setLocal({
      format: config.format as DeckFilters['format'],
      classification: config.classification as DeckFilters['classification'],
      genres: config.genres,
      language: config.language,
      status: config.status as DeckFilters['status'],
      yearFrom: config.year_from?.[0] ? parseInt(config.year_from[0], 10) : undefined,
      yearTo: config.year_to?.[0] ? parseInt(config.year_to[0], 10) : undefined,
    });
  };

  const deletePreset = async (preset: FilterPreset) => {
    try {
      await apiClient.deleteFilterPreset(preset.id);
      loadPresets();
    } catch (e) {
      showToast({ message: e instanceof Error ? e.message : 'Could not delete preset', tone: 'error' });
    }
  };

  // `setFilters` fires Deck's `[filters]` effect (queue reset + refetch)
  // synchronously on the JS thread — done immediately before `router.back()`,
  // that re-render was competing with the native dismiss animation for
  // frames and made the close feel jarry. Firing `router.back()` first and
  // deferring the state update past the transition (`runAfterInteractions`)
  // keeps the dismiss animation on its own uncontested frames.
  // `setFilters` fires Deck's `[filters]` effect (a refetch) synchronously on
  // the JS thread, so it's deferred until after the sheet has finished
  // sliding down rather than competing with it for frames.
  const apply = () => dismiss(() => setFilters(local));

  const clear = () => dismiss(() => setFilters({}));

  return (
    <View style={styles.root}>
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => dismiss()}
          accessibilityRole="button"
          accessibilityLabel="Close filters"
        />
      </Animated.View>
      <Animated.View style={[styles.sheet, sheetStyle]}>
      <SafeAreaView style={styles.flex} edges={['bottom']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Filters</Text>
        <Pressable
          onPress={() => dismiss()}
          hitSlop={8}
          style={styles.closeHit}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <Text style={styles.closeText}>Close</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        <Section title="Type">
          {FILTER_TYPE_OPTIONS.map((opt) => (
            <Chip key={opt.id} label={opt.label} selected={typeIsSelected(local, opt)} onPress={() => selectType(opt)} />
          ))}
        </Section>

        <Section title="Genre">
          {GENRE_NAMES.map((g) => (
            <Chip
              key={g}
              label={g}
              capitalize
              selected={!!local.genres?.includes(g)}
              onPress={() => toggleArray('genres', g)}
            />
          ))}
        </Section>

        <Section title="Language">
          {LANGUAGES.map((lang) => (
            <Chip
              key={lang}
              label={lang.toUpperCase()}
              selected={!!local.language?.includes(lang)}
              onPress={() => toggleArray('language', lang)}
            />
          ))}
        </Section>

        <Section title="Release Era">
          {RELEASE_ERAS.map((era) => (
            <Chip
              key={era.label}
              label={era.label}
              selected={eraSelected(era.yearFrom, era.yearTo)}
              onPress={() =>
                setLocal((p) =>
                  eraSelected(era.yearFrom, era.yearTo)
                    ? { ...p, yearFrom: undefined, yearTo: undefined }
                    : { ...p, yearFrom: era.yearFrom ?? undefined, yearTo: era.yearTo ?? undefined },
                )
              }
            />
          ))}
        </Section>

        <Section title="Your Status">
          {STATUSES.map((s) => (
            <Chip
              key={s}
              label={s.replace('_', ' ')}
              capitalize
              selected={!!local.status?.includes(s)}
              onPress={() => toggleArray('status', s)}
            />
          ))}
        </Section>

        <View style={styles.presetsSection}>
          <Text style={styles.sectionTitle}>Saved Presets</Text>
          <View style={styles.presetRow}>
            <TextInput
              value={presetName}
              onChangeText={setPresetName}
              placeholder="Preset name"
              placeholderTextColor={color.textMuted}
              style={styles.presetInput}
              accessibilityLabel="New preset name"
            />
            <Pressable
              onPress={savePreset}
              disabled={!presetName.trim() || saving}
              style={({ pressed }) => [styles.saveBtn, glassChip(), pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="Save preset"
            >
              <Text style={styles.saveBtnText}>{saving ? '…' : 'Save'}</Text>
            </Pressable>
          </View>

          {presets.map((p) => (
            <View key={p.id} style={styles.presetPillRow}>
              <Pressable
                onPress={() => applyPreset(p)}
                style={({ pressed }) => [styles.presetPill, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={`Apply preset ${p.name}`}
              >
                <Text style={styles.presetPillText}>{p.name}</Text>
              </Pressable>
              <Pressable
                onPress={() => deletePreset(p)}
                hitSlop={8}
                style={styles.deletePresetHit}
                accessibilityRole="button"
                accessibilityLabel={`Delete preset ${p.name}`}
              >
                <Text style={styles.deletePresetText}>Delete</Text>
              </Pressable>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          onPress={clear}
          style={({ pressed }) => [styles.footerBtn, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Clear filters"
        >
          <Text style={styles.footerBtnText}>Clear</Text>
        </Pressable>
        <Pressable
          onPress={apply}
          style={({ pressed }) => [styles.footerBtn, styles.applyBtn, glassChip(), pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Apply filters"
        >
          <Text style={styles.applyBtnText}>Apply Filters</Text>
        </Pressable>
      </View>
      </SafeAreaView>
      </Animated.View>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.chipRow}>{children}</View>
    </View>
  );
}

function Chip({
  label,
  selected,
  onPress,
  capitalize,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  capitalize?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.chip, selected && glassChip(), pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected, capitalize && styles.capitalize]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Transparent so the Deck stays visible behind the sheet as it travels —
  // paired with `presentation: 'transparentModal'` on the route.
  root: { flex: 1 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    flex: 1,
    marginTop: 56,
    backgroundColor: color.bg,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    overflow: 'hidden',
    borderTopWidth: 1,
    borderColor: color.border,
  },
  flex: { flex: 1, backgroundColor: color.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: space.lg,
  },
  headerTitle: { color: color.text, ...type.title, fontSize: 18 },
  closeHit: { minHeight: 44, justifyContent: 'center' },
  closeText: { color: color.textMuted, fontWeight: '600' },
  body: { flex: 1 },
  bodyContent: { paddingHorizontal: space.lg, paddingBottom: space.xl },
  section: { marginBottom: space.lg },
  sectionTitle: {
    color: color.textMuted,
    fontSize: type.caption.fontSize,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: space.sm,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.border,
  },
  chipText: { color: color.textMuted, fontSize: 12 },
  chipTextSelected: { color: color.primary },
  capitalize: { textTransform: 'capitalize' },
  presetsSection: { borderTopWidth: 1, borderTopColor: color.border, paddingTop: space.lg, marginTop: space.sm },
  presetRow: { flexDirection: 'row', gap: space.sm, marginBottom: space.md },
  presetInput: {
    flex: 1,
    backgroundColor: color.surface,
    borderRadius: radius.sm,
    padding: space.md,
    color: color.text,
    minHeight: 44,
  },
  saveBtn: {
    paddingHorizontal: space.lg,
    minHeight: 44,
    justifyContent: 'center',
  },
  pressed: { opacity: 0.6 },
  saveBtnText: { color: color.primary, fontWeight: '700' },
  presetPillRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.sm },
  presetPill: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.border,
  },
  presetPillText: { color: color.text, fontSize: 12 },
  deletePresetHit: { minHeight: 36, justifyContent: 'center' },
  deletePresetText: { color: color.danger, fontSize: 11, fontWeight: '600' },
  footer: {
    flexDirection: 'row',
    gap: space.sm,
    padding: space.lg,
    borderTopWidth: 1,
    borderTopColor: color.border,
  },
  footerBtn: {
    flex: 1,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.border,
  },
  footerBtnText: { color: color.textMuted, fontWeight: '600' },
  applyBtn: {},
  applyBtnText: { color: color.primary, fontWeight: '700' },
});
