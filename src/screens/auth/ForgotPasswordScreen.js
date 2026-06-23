import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography } from '../../utils/theme';
import { forgotPassword, resetPassword } from '../../lib/auth/authService';
import { useTranslation } from 'react-i18next';

export default function ForgotPasswordScreen({ navigation }) {
  const { t } = useTranslation();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  async function handleSendCode() {
    if (!email.trim()) { setError(t('forgot_password.email_required')); return; }
    setError('');
    setLoading(true);
    try {
      await forgotPassword(email.trim());
      setStep(2);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleReset() {
    if (!code.trim()) { setError(t('forgot_password.code_required')); return; }
    if (newPassword.length < 6) { setError(t('forgot_password.new_password_too_short')); return; }
    if (newPassword !== confirmPassword) { setError(t('forgot_password.mismatch')); return; }
    setError('');
    setLoading(true);
    try {
      await resetPassword(email.trim(), code.trim(), newPassword);
      setSuccess(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.successContainer}>
          <Ionicons name="checkmark-circle" size={64} color={colors.success} />
          <Text style={styles.successTitle}>{t('forgot_password.success_title')}</Text>
          <Text style={styles.successText}>{t('forgot_password.success_message')}</Text>
          <TouchableOpacity style={[styles.btn, styles.successBtn]} onPress={() => navigation.navigate('Login')} activeOpacity={0.8}>
            <Text style={styles.btnText}>{t('forgot_password.success_button')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets={true}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
            <Ionicons name="arrow-back" size={22} color={colors.primary} />
            <Text style={styles.backText}>{t('forgot_password.back')}</Text>
          </TouchableOpacity>

          <Text style={styles.title}>{t('forgot_password.title')}</Text>

          {step === 1 ? (
            <>
              <Text style={styles.subtitle}>{t('forgot_password.step1_subtitle')}</Text>
              {!!error && <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View>}
              <Text style={styles.label}>{t('forgot_password.email_label')}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('forgot_password.email_placeholder')}
                placeholderTextColor={colors.textMuted}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
              <TouchableOpacity
                style={[styles.btn, loading && styles.btnDisabled]}
                onPress={handleSendCode}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading
                  ? <ActivityIndicator color={colors.white} />
                  : <Text style={styles.btnText}>{t('forgot_password.send_code')}</Text>}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.subtitle}>{t('forgot_password.step2_subtitle', { email })}</Text>
              {!!error && <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View>}

              <Text style={styles.label}>{t('forgot_password.code_label')}</Text>
              <TextInput
                style={[styles.input, styles.codeInput]}
                placeholder={t('forgot_password.code_placeholder')}
                placeholderTextColor={colors.textMuted}
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                maxLength={6}
              />
              <Text style={[styles.label, { marginTop: spacing.md }]}>{t('forgot_password.new_password_label')}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('forgot_password.new_password_placeholder')}
                placeholderTextColor={colors.textMuted}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
              />
              <Text style={[styles.label, { marginTop: spacing.md }]}>{t('forgot_password.confirm_label')}</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor={colors.textMuted}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
              />
              <TouchableOpacity
                style={[styles.btn, loading && styles.btnDisabled, { marginTop: spacing.lg }]}
                onPress={handleReset}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading
                  ? <ActivityIndicator color={colors.white} />
                  : <Text style={styles.btnText}>{t('forgot_password.reset')}</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={styles.resendBtn} onPress={() => { setStep(1); setError(''); setCode(''); }}>
                <Text style={styles.resendText}>{t('forgot_password.resend')}</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xxl },
  back: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.xl },
  backText: { ...typography.body, color: colors.primary },
  title: { ...typography.h1, marginBottom: spacing.sm },
  subtitle: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.xl, lineHeight: 22 },
  errorBox: {
    backgroundColor: 'rgba(248,81,73,0.12)',
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  errorText: { color: colors.error, fontSize: 14 },
  label: { ...typography.label, marginBottom: spacing.xs },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    color: colors.text,
    fontSize: 15,
    marginBottom: spacing.sm,
  },
  codeInput: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 6,
    textAlign: 'center',
  },
  btn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { ...typography.button },
  resendBtn: { alignItems: 'center', marginTop: spacing.lg },
  resendText: { ...typography.body, color: colors.primary, fontWeight: '600' },
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  successTitle: { ...typography.h2, textAlign: 'center' },
  successText: { ...typography.body, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  successBtn: { alignSelf: 'stretch', marginTop: spacing.md },
});
