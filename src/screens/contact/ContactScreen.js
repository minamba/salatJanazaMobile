import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import ScreenBackground from '../../components/ScreenBackground';
import ScreenHeader from '../../components/ScreenHeader';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useSelector } from 'react-redux';
import { colors, spacing, radius, typography, shadow } from '../../utils/theme';
import apiClient from '../../lib/api/apiClient';
import { useTranslation } from 'react-i18next';

export default function ContactScreen() {
  const { t } = useTranslation();
  const user = useSelector(state => state.auth.user);

  const [nom, setNom] = useState(`${user?.prenom ?? ''} ${user?.nom ?? ''}`.trim());
  const [email, setEmail] = useState(user?.email ?? '');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [focused, setFocused] = useState(null);

  const emailRef = useRef(null);
  const messageRef = useRef(null);

  const handleSend = async () => {
    if (!nom.trim() || !email.trim() || !message.trim()) {
      Alert.alert(t('contact.missing_fields_title'), t('contact.missing_fields_message'));
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      Alert.alert(t('contact.invalid_email_title'), t('contact.invalid_email_message'));
      return;
    }
    setLoading(true);
    try {
      await apiClient.post('/api/Contact', { nom: nom.trim(), email: email.trim(), message: message.trim() });
      setSent(true);
      setMessage('');
    } catch {
      Alert.alert(t('contact.error_title'), t('contact.error_message'));
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.successWrap}>
          <View style={styles.successIconCircle}>
            <Ionicons name="checkmark" size={36} color={colors.white} />
          </View>
          <Text style={styles.successTitle}>{t('contact.success_title')}</Text>
          <Text style={styles.successText}>{t('contact.success_message', { email })}</Text>
          <TouchableOpacity style={styles.newMessageBtn} onPress={() => setSent(false)} activeOpacity={0.8}>
            <Text style={styles.newMessageBtnText}>{t('contact.send_another')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title={t('contact.title')} />
      <ScreenBackground>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        automaticallyAdjustKeyboardInsets
      >
        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name="mail" size={26} color={colors.primary} />
          </View>
          <Text style={styles.heroSub}>{t('contact.intro')}</Text>
        </View>

        {/* Grouped form card */}
        <View style={[styles.formCard, focused && styles.formCardFocused]}>

          {/* Nom */}
          <View style={[styles.row, focused === 'nom' && styles.rowFocused]}>
            <Ionicons name="person-outline" size={16} color={focused === 'nom' ? colors.primary : colors.textMuted} style={styles.rowIcon} />
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>{t('contact.name_label')}</Text>
              <TextInput
                style={styles.rowInput}
                value={nom}
                onChangeText={setNom}
                placeholder={t('contact.name_placeholder')}
                placeholderTextColor={colors.textMuted}
                returnKeyType="next"
                autoCapitalize="words"
                onFocus={() => setFocused('nom')}
                onBlur={() => setFocused(null)}
                onSubmitEditing={() => emailRef.current?.focus()}
              />
            </View>
          </View>

          <View style={styles.divider} />

          {/* Email */}
          <View style={[styles.row, focused === 'email' && styles.rowFocused]}>
            <Ionicons name="mail-outline" size={16} color={focused === 'email' ? colors.primary : colors.textMuted} style={styles.rowIcon} />
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>{t('contact.email_label')}</Text>
              <TextInput
                ref={emailRef}
                style={styles.rowInput}
                value={email}
                onChangeText={setEmail}
                placeholder={t('contact.email_placeholder')}
                placeholderTextColor={colors.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                returnKeyType="next"
                onFocus={() => setFocused('email')}
                onBlur={() => setFocused(null)}
                onSubmitEditing={() => messageRef.current?.focus()}
              />
            </View>
          </View>

          <View style={styles.divider} />

          {/* Message */}
          <View style={[styles.row, styles.rowMessage, focused === 'message' && styles.rowFocused]}>
            <Ionicons name="chatbubble-outline" size={16} color={focused === 'message' ? colors.primary : colors.textMuted} style={[styles.rowIcon, { marginTop: 2 }]} />
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>{t('contact.message_label')}</Text>
              <TextInput
                ref={messageRef}
                style={[styles.rowInput, styles.rowInputMultiline]}
                value={message}
                onChangeText={setMessage}
                placeholder={t('contact.message_placeholder')}
                placeholderTextColor={colors.textMuted}
                multiline
                textAlignVertical="top"
                onFocus={() => setFocused('message')}
                onBlur={() => setFocused(null)}
              />
              <Text style={styles.charCount}>{message.length} / 1000</Text>
            </View>
          </View>
        </View>

        {/* Send button */}
        <TouchableOpacity
          style={[styles.sendBtn, loading && styles.sendBtnDisabled]}
          onPress={handleSend}
          activeOpacity={0.85}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.white} size="small" />
          ) : (
            <>
              <Ionicons name="send" size={17} color={colors.white} />
              <Text style={styles.sendBtnText}>{t('contact.send')}</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Support info */}
        <View style={styles.supportCard}>
          <Ionicons name="information-circle-outline" size={15} color={colors.textMuted} />
          <Text style={styles.supportText}>
            {t('contact.support_info')}{' '}
            <Text style={styles.supportEmail}>{t('contact.support_email')}</Text>
          </Text>
        </View>
      </ScrollView>
      </ScreenBackground>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F7F5' },
  scroll: { padding: spacing.md, gap: spacing.lg, paddingBottom: spacing.xl * 2 },

  // Hero
  hero: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md },
  heroIcon: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.white,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.xs,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  heroTitle: { ...typography.h2, textAlign: 'center' },
  heroSub: { ...typography.bodySmall, color: colors.textSecondary, textAlign: 'center', lineHeight: 20, maxWidth: 280 },

  // Form card
  formCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadow.sm,
  },
  formCardFocused: { borderColor: colors.primary + '60' },

  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    backgroundColor: colors.surface,
  },
  rowFocused: { backgroundColor: colors.primary + '06' },
  rowMessage: { alignItems: 'flex-start' },
  rowIcon: { marginTop: 14, marginRight: spacing.sm },
  rowContent: { flex: 1, gap: 2 },
  rowLabel: { ...typography.caption, color: colors.textMuted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 },
  rowInput: { fontSize: 15, color: colors.text, paddingVertical: 4, minHeight: 28 },
  rowInputMultiline: { minHeight: 100, paddingTop: 4 },
  charCount: { ...typography.caption, color: colors.textMuted, textAlign: 'right', marginTop: spacing.xs, fontSize: 11 },

  divider: { height: 1, backgroundColor: colors.border, marginLeft: spacing.md + 16 + spacing.sm },

  // Send
  sendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingVertical: spacing.md + 2,
  },
  sendBtnDisabled: { opacity: 0.6 },
  sendBtnText: { ...typography.button, fontSize: 15, color: colors.white },

  // Success
  successWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  successIconCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  successTitle: { ...typography.h2, color: colors.primary, textAlign: 'center' },
  successText: { ...typography.body, textAlign: 'center', lineHeight: 22, color: colors.textSecondary },
  newMessageBtn: {
    marginTop: spacing.sm,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  newMessageBtnText: { ...typography.label, color: colors.primary },

  // Support
  supportCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  supportText: { flex: 1, ...typography.bodySmall, lineHeight: 20, color: colors.textSecondary },
  supportEmail: { color: colors.primary, fontWeight: '600' },
});
