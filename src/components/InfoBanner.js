import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSelector } from 'react-redux';
import { spacing } from '../utils/theme';

export default function InfoBanner() {
  const infoMessage = useSelector(s => s.features?.infoMessage);
  if (!infoMessage?.active || !infoMessage?.message) return null;

  return (
    <View style={styles.wrapper}>
      <View style={styles.card}>
        <View style={styles.accent} />
        <View style={styles.body}>
          <View style={styles.labelRow}>
            <Ionicons name="information-circle" size={14} color="#B45309" />
            <Text style={styles.label}>INFORMATION</Text>
          </View>
          <Text style={styles.message}>{infoMessage.message}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: '#FFFBEB',
    borderBottomWidth: 1,
    borderBottomColor: '#FDE68A',
  },
  card: {
    flexDirection: 'row',
    backgroundColor: '#FEF3C7',
    borderRadius: 10,
    overflow: 'hidden',
    shadowColor: '#B45309',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.10,
    shadowRadius: 4,
    elevation: 2,
  },
  accent: {
    width: 4,
    backgroundColor: '#F59E0B',
  },
  body: {
    flex: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
    gap: 4,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  label: {
    fontSize: 10,
    fontWeight: '800',
    color: '#B45309',
    letterSpacing: 0.8,
  },
  message: {
    fontSize: 13,
    color: '#78350F',
    lineHeight: 19,
  },
});
