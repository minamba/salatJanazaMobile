import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useSelector } from 'react-redux';
import { colors, spacing, radius, typography } from '../../utils/theme';
import apiClient from '../../lib/api/apiClient';
import { useTranslation } from 'react-i18next';

export default function ContactScreen() {
  const { t } = useTranslation();
  const user = useSelector(state => state.auth.user);
  const apiUser = useSelector(state => state.auth.apiUser);

  const [nom, setNom] = useState(`${user?.prenom ?? ''} ${user?.nom ?? ''}`.trim());
  const [email, setEmail] = useState(user?.email ?? '');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

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

  return (
    <SafeAreaView style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          automaticallyAdjustKeyboardInsets={true}
        >
          {/* Header */}
          <View style={styles.header}>
            <Ionicons name="mail-outline" size={20} color={colors.primary} />
            <Text style={styles.headerTitle}>{t('contact.title')}</Text>
          </View>

          <Text style={styles.intro}>{t('contact.intro')}</Text>

          {sent ? (
            <View style={styles.successCard}>
              <Ionicons name="checkmark-circle" size={48} color={colors.primary} />
              <Text style={styles.successTitle}>{t('contact.success_title')}</Text>
              <Text style={styles.successText}>{t('contact.success_message', { email })}</Text>
              <TouchableOpacity
                style={styles.newMessageBtn}
                onPress={() => setSent(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.newMessageBtnText}>{t('contact.send_another')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.form}>
              <Field label={t('contact.name_label')} icon="person-outline">
                <TextInput
                  style={styles.input}
                  value={nom}
                  onChangeText={setNom}
                  placeholder={t('contact.name_placeholder')}
                  placeholderTextColor={colors.textMuted}
                  returnKeyType="next"
                  autoCapitalize="words"
                />
              </Field>

              <Field label={t('contact.email_label')} icon="mail-outline">
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder={t('contact.email_placeholder')}
                  placeholderTextColor={colors.textMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  returnKeyType="next"
                />
              </Field>

              <Field label={t('contact.message_label')} icon="chatbubble-outline">
                <TextInput
                  style={[styles.input, styles.inputMultiline]}
                  value={message}
                  onChangeText={setMessage}
                  placeholder={t('contact.message_placeholder')}
                  placeholderTextColor={colors.textMuted}
                  multiline
                  numberOfLines={6}
                  textAlignVertical="top"
                  returnKeyType="default"
                />
              </Field>

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
                    <Ionicons name="send" size={18} color={colors.white} />
                    <Text style={styles.sendBtnText}>{t('contact.send')}</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Support info */}
          <View style={styles.supportCard}>
            <Ionicons name="information-circle-outline" size={16} color={colors.textMuted} />
            <Text style={styles.supportText}>
              {t('contact.support_info')}{' '}
              <Text style={styles.supportEmail}>{t('contact.support_email')}</Text>
            </Text>
          </View>
        </ScrollView>
    </SafeAreaView>
  );
}

function Field({ label, icon, children }) {
  return (
    <View style={styles.field}>
      <View style={styles.fieldLabel}>
        <Ionicons name={icon} size={14} color={colors.textMuted} />
        <Text style={styles.fieldLabelText}>{label}</Text>
      </View>
      <View style={styles.inputWrapper}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  scroll: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: { ...typography.h3 },

  intro: {
    ...typography.bodySmall,
    lineHeight: 20,
    color: colors.textSecondary,
  },

  // Form
  form: { gap: spacing.md },

  field: { gap: spacing.xs },
  fieldLabel: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  fieldLabelText: { ...typography.label, fontSize: 12 },

  inputWrapper: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  input: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: 15,
    color: colors.text,
  },
  inputMultiline: {
    minHeight: 120,
    paddingTop: spacing.sm + 2,
  },

  sendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    marginTop: spacing.xs,
  },
  sendBtnDisabled: { opacity: 0.6 },
  sendBtnText: { ...typography.button, fontSize: 15 },

  // Success
  successCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  successTitle: { ...typography.h3, color: colors.primary },
  successText: { ...typography.bodySmall, textAlign: 'center', lineHeight: 20 },
  newMessageBtn: {
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  newMessageBtnText: { ...typography.label, color: colors.primary },

  // Support info
  supportCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  supportText: { flex: 1, ...typography.bodySmall, lineHeight: 20 },
  supportEmail: { color: colors.primary, fontWeight: '600' },
});
