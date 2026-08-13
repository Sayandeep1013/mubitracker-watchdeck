import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { color, radius, space, type } from '@/lib/theme';

export type ToastTone = 'neutral' | 'success' | 'warning' | 'review' | 'error';

export interface ToastOptions {
  message: string;
  tone?: ToastTone;
  onUndo?: () => void;
}

interface ToastState extends ToastOptions {
  id: number;
}

const ToastContext = createContext<((options: ToastOptions) => void) | null>(null);

const AUTO_DISMISS_MS = 2500;
const ANIM_MS = 180;

const TONE_BORDER: Record<ToastTone, string> = {
  neutral: color.border,
  success: color.success,
  warning: color.warning,
  review: color.review,
  error: color.danger,
};

export function useToast() {
  const show = useContext(ToastContext);
  if (!show) throw new Error('useToast must be used within a ToastProvider');
  return show;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<ToastState | null>(null);
  const idRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const translateY = useSharedValue(24);
  const opacity = useSharedValue(0);

  const dismiss = useCallback(() => {
    translateY.value = withTiming(24, { duration: ANIM_MS });
    opacity.value = withTiming(0, { duration: ANIM_MS });
    setTimeout(() => setToast(null), ANIM_MS);
  }, [opacity, translateY]);

  const show = useCallback(
    (options: ToastOptions) => {
      const id = ++idRef.current;
      if (timerRef.current) clearTimeout(timerRef.current);
      setToast({ id, ...options });
      translateY.value = 24;
      opacity.value = 0;
      translateY.value = withTiming(0, { duration: ANIM_MS });
      opacity.value = withTiming(1, { duration: ANIM_MS });
      timerRef.current = setTimeout(() => {
        setToast((t) => (t?.id === id ? null : t));
      }, AUTO_DISMISS_MS);
    },
    [opacity, translateY],
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && (
        <Animated.View
          style={[
            styles.container,
            { bottom: insets.bottom + 88, borderColor: TONE_BORDER[toast.tone ?? 'neutral'] },
            animatedStyle,
          ]}
          accessibilityLiveRegion="polite"
        >
          <Text style={styles.message}>{toast.message}</Text>
          {toast.onUndo && (
            <Pressable
              onPress={() => {
                if (timerRef.current) clearTimeout(timerRef.current);
                toast.onUndo?.();
                dismiss();
              }}
              hitSlop={8}
              style={styles.undoHit}
              accessibilityRole="button"
              accessibilityLabel="Undo last action"
            >
              <Text style={styles.undo}>Undo</Text>
            </Pressable>
          )}
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: space.lg,
    right: space.lg,
    maxWidth: 384,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
  },
  message: { flex: 1, color: color.text, fontSize: type.label.fontSize, fontWeight: type.label.fontWeight },
  undoHit: { minHeight: 48, minWidth: 48, alignItems: 'center', justifyContent: 'center' },
  undo: { color: color.primary, fontSize: type.label.fontSize, fontWeight: '700' },
});
