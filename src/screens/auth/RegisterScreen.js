import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch } from 'react-redux';
import { colors, spacing, radius, typography } from '../../utils/theme';
import { register } from '../../lib/auth/authService';
import { useTranslation } from 'react-i18next';

export default function RegisterScreen({ navigation }) {
  const { t, i18n } = useTranslation();
  const dispatch = useDispatch();
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const FIELDS = [
    { key: 'firstName', label: t('register.first_name_label'), placeholder: t('register.first_name_placeholder'), autoComplete: 'given-name' },
    { key: 'lastName', label: t('register.last_name_label'), placeholder: t('register.last_name_placeholder'), autoComplete: 'family-name' },
    { key: 'email', label: t('register.email_label'), placeholder: t('register.email_placeholder'), keyboardType: 'email-address', autoComplete: 'email', autoCapitalize: 'none' },
    { key: 'phone', label: t('register.phone_label'), placeholder: t('register.phone_placeholder'), keyboardType: 'phone-pad', autoComplete: 'tel' },
    { key: 'password', label: t('register.password_label'), placeholder: t('register.password_placeholder'), secureTextEntry: true },
    { key: 'confirmPassword', label: t('register.confirm_label'), placeholder: t('register.confirm_placeholder'), secureTextEntry: true },
  ];

  function set(field) {
    return (value) => setForm((f) => ({ ...f, [field]: value }));
  }

  function validate() {
    if (!form.firstName || !form.lastName || !form.email || !form.password)
      return t('register.error_empty');
    if (form.password !== form.confirmPassword)
      return t('register.error_mismatch');
    if (form.password.length < 8)
      return t('register.error_too_short');
    return null;
  }

  async function handleRegister() {
    const err = validate();
    if (err) { setError(err); return; }
    setError(null);
    setLoading(true);
    try {
      const result = await register(form.firstName, form.lastName, form.email, form.password, form.phone ?? '', i18n.language ?? 'fr');
      dispatch({ type: 'AUTH_LOGIN_SUCCESS', payload: { user: result.user, token: result.accessToken, apiUser: result.apiUser } });
    } catch (e) {
      setError(e.message || t('register.error_failed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets={true}>
          {/* Header */}
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
            <Text style={styles.backText}>{t('register.back')}</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{t('register.title')}</Text>
          <Text style={styles.subtitle}>{t('register.subtitle')}</Text>

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={styles.form}>
            {FIELDS.map((f) => (
              <View key={f.key} style={styles.field}>
                <Text style={styles.label}>{f.label}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={f.placeholder}
                  placeholderTextColor={colors.textMuted}
                  value={form[f.key] ?? ''}
                  onChangeText={set(f.key)}
                  keyboardType={f.keyboardType ?? 'default'}
                  autoComplete={f.autoComplete}
                  autoCapitalize={f.autoCapitalize ?? 'words'}
                  secureTextEntry={f.secureTextEntry ?? false}
                />
              </View>
            ))}

            <TouchableOpacity
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={handleRegister}
              disabled={loading}
              activeOpacity={0.8}
            >
              <Text style={styles.btnText}>{loading ? t('register.loading') : t('register.submit')}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.loginRow}>
            <Text style={styles.loginText}>{t('register.login_prompt')} </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={styles.loginLink}>{t('register.login_link')}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xxl },
  back: { marginBottom: spacing.lg },
  backText: { ...typography.body, color: colors.primary },
  title: { ...typography.h1, marginBottom: spacing.xs },
  subtitle: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.xl },
  errorBox: {
    backgroundColor: 'rgba(248,81,73,0.12)',
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  errorText: { color: colors.error, fontSize: 14 },
  form: { gap: spacing.md },
  field: { gap: spacing.xs },
  label: { ...typography.label },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    color: colors.text,
    fontSize: 15,
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
  loginRow: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.xl },
  loginText: { ...typography.body, color: colors.textSecondary },
  loginLink: { ...typography.body, color: colors.primary, fontWeight: '600' },
});
