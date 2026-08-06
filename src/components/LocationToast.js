import { useRef, useState, useCallback } from 'react';
import { Animated, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius } from '../utils/theme';

export function useLocationToast() {
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef(null);
  const [message, setMessage] = useState('');

  const show = useCallback((msg) => {
    setMessage(msg);
    if (timer.current) clearTimeout(timer.current);
    Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(2500),
      Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
    timer.current = setTimeout(() => setMessage(''), 3100);
  }, [opacity]);

  return { show, opacity, message };
}

export function LocationToast({ opacity, message }) {
  if (!message) return null;
  const isHome = message.includes('domicile');
  return (
    <Animated.View style={[styles.toast, { opacity }]} pointerEvents="none">
      <Ionicons name={isHome ? 'home' : 'navigate'} size={15} color={colors.white} />
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(30,30,30,0.88)',
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.lg,
    maxWidth: '85%',
    zIndex: 999,
  },
  text: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '500',
    flexShrink: 1,
  },
});
