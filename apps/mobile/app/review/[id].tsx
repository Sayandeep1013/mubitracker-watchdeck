import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { MediaSummary } from '@mubitracker/shared';
import { tmdbPosterUrl } from '@mubitracker/shared';
import { apiClient } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { color, glassChip, radius, space, type } from '@/lib/theme';

export default function WriteReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [body, setBody] = useState('');
  const [media, setMedia] = useState<MediaSummary | null>(null);
  const [mediaError, setMediaError] = useState(false);
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const showToast = useToast();

  useEffect(() => {
    if (!id) return;
    let active = true;
    apiClient
      .getMedia(id)
      .then((data) => {
        if (active) setMedia(data as MediaSummary);
      })
      .catch(() => {
        if (active) setMediaError(true);
      });
    return () => {
      active = false;
    };
  }, [id]);

  const save = async () => {
    if (!body.trim() || !id || saving) return;
    setSaving(true);
    try {
      await apiClient.createReview({ media_id: id, body: body.trim() });
      router.back();
    } catch (e) {
      showToast({
        message: e instanceof Error ? e.message : 'Could not save your review — try again',
        tone: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  const poster = media ? tmdbPosterUrl(media.posterPath, 'card') : null;

  return (
    <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.header}>
          {poster ? (
            <Image source={{ uri: poster }} style={styles.poster} />
          ) : (
            <View style={[styles.poster, styles.posterPlaceholder]} />
          )}
          <View style={styles.headerBody}>
            {media ? (
              <>
                <Text style={styles.title} numberOfLines={2}>
                  {media.title}
                </Text>
                <Text style={styles.meta}>
                  {media.year ?? '—'} · {media.displayType}
                </Text>
              </>
            ) : mediaError ? (
              <Text style={styles.meta}>Title unavailable</Text>
            ) : (
              <ActivityIndicator color={color.primary} style={styles.headerLoading} />
            )}
          </View>
        </View>

        <TextInput
          value={body}
          onChangeText={setBody}
          multiline
          placeholder="Your review…"
          placeholderTextColor={color.textMuted}
          style={styles.input}
          accessibilityLabel="Review text"
        />
        <Pressable
          style={({ pressed }) => [
            styles.btn,
            glassChip(),
            (pressed || saving) && styles.pressed,
            !body.trim() && styles.disabled,
          ]}
          onPress={save}
          disabled={!body.trim() || saving}
          accessibilityRole="button"
          accessibilityLabel="Save review"
          accessibilityState={{ disabled: !body.trim() || saving }}
        >
          <Text style={styles.btnText}>{saving ? 'Saving…' : 'Save'}</Text>
        </Pressable>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: color.bg },
  header: { flexDirection: 'row', gap: space.md, padding: space.lg },
  poster: { width: 56, height: 84, borderRadius: radius.sm },
  posterPlaceholder: { backgroundColor: color.surfaceHigh },
  headerBody: { flex: 1, justifyContent: 'center' },
  headerLoading: { alignSelf: 'flex-start' },
  title: { color: color.text, ...type.title, fontSize: 18 },
  meta: { color: color.textMuted, fontSize: type.caption.fontSize, marginTop: 2 },
  input: {
    flex: 1,
    backgroundColor: color.surface,
    borderRadius: radius.sm,
    padding: space.lg,
    marginHorizontal: space.lg,
    color: color.text,
    textAlignVertical: 'top',
  },
  btn: {
    padding: space.lg,
    margin: space.lg,
    minHeight: 48,
    justifyContent: 'center',
  },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.8 },
  btnText: { color: color.primary, textAlign: 'center', fontWeight: '700' },
});
