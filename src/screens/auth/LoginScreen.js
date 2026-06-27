import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, Image,
} from 'react-native';

const ACC1_IMG = require('../../../assets/icons/acc1.png');
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch } from 'react-redux';
import * as Google from 'expo-auth-session/providers/google';
import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';
// Lazy require — @react-native-google-signin est un module natif absent de Expo Go
// et des dev builds non-reconstruits. Le try/catch évite le crash au démarrage.
let GoogleSignin = null;
let statusCodes = null;
if (Platform.OS === 'android') {
  try {
    ({ GoogleSignin, statusCodes } = require('@react-native-google-signin/google-signin'));
  } catch {}
}
import * as AppleAuthentication from 'expo-apple-authentication';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography, shadow } from '../../utils/theme';
import { loginWithPassword, loginWithGoogle, loginWithApple } from '../../lib/auth/authService';
import { useTranslation } from 'react-i18next';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen({ navigation }) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // On iOS expo-auth-session exige iosClientId — on utilise le même webClientId pour Expo Go.
  // Fallback non-vide pour éviter l'invariant si l'env var n'est pas encore configurée.
  const _gWebId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '732343395714-ci6k0tov6ae769d83g2uqpvojcgj9k0b.apps.googleusercontent.com';
  const _gIosId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '174617961394-4kvqfhr46nc2mvtb8u3iu8pac2hm1nfr.apps.googleusercontent.com';
  const _gAndroidId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || '174617961394-6hescbb94kck78ipvc26d4v7ci7d2tl9.apps.googleusercontent.com';
  const googleConfigured = !!_gWebId && !!_gIosId;

  const isExpoGo = Constants.appOwnership === 'expo';
  // iOS natif : reverse client ID = com.googleusercontent.apps.{id-sans-suffix}
  const iosReverseScheme = `com.googleusercontent.apps.${_gIosId.replace('.apps.googleusercontent.com', '')}`;
  const googleRedirectUri = isExpoGo
    ? 'https://auth.expo.io/@minamba/qabr-mobile'
    : Platform.OS === 'android'
      ? makeRedirectUri({ native: `fr.myjanaza.qabr:/oauth2redirect/google` })
      : makeRedirectUri({ native: `${iosReverseScheme}:/` });

  // androidClientId requis par expo-auth-session pour éviter l'invariant sur Android,
  // mais le flow réel Android utilise @react-native-google-signin (handleGoogleAndroid).
  const [request, response, promptGoogleAsync] = Google.useAuthRequest({
    webClientId: _gWebId,
    iosClientId: isExpoGo ? _gWebId : _gIosId,
    androidClientId: _gAndroidId,
    redirectUri: googleRedirectUri,
  });

  useEffect(() => {
    if (Platform.OS === 'ios') {
      AppleAuthentication.isAvailableAsync()
        .then(setAppleAvailable)
        .catch(() => {});
    }
    if (Platform.OS === 'android' && GoogleSignin) {
      GoogleSignin.configure({
        scopes: ['email', 'profile'],
      });
    }
  }, []);

  useEffect(() => {
    if (response?.type === 'success') {
      fetchGoogleUser(response.authentication);
    } else if (response?.type === 'error') {
      setError('Erreur lors de la connexion Google.');
    }
  }, [response]);

  function set(field) {
    return (value) => setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleLogin() {
    if (!form.email || !form.password) {
      setError(t('login.error_empty'));
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const result = await loginWithPassword(form.email, form.password);
      dispatch({ type: 'AUTH_LOGIN_SUCCESS', payload: { user: result.user, token: result.accessToken, apiUser: result.apiUser } });
    } catch (e) {
      setError(e.message || t('login.error_credentials'));
    } finally {
      setLoading(false);
    }
  }

  async function fetchGoogleUser(auth) {
    if (!auth?.accessToken) {
      setError(t('login.error_google_token'));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await loginWithGoogle(auth.accessToken);
      dispatch({ type: 'AUTH_LOGIN_SUCCESS', payload: { user: result.user, token: result.accessToken, apiUser: result.apiUser } });
    } catch (e) {
      setError(e.message || t('login.error_google'));
    } finally {
      setLoading(false);
    }
  }

  async function handleAppleLogin() {
    setError(null);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      setLoading(true);
      const result = await loginWithApple(credential.identityToken);
      dispatch({ type: 'AUTH_LOGIN_SUCCESS', payload: { user: result.user, token: result.accessToken, apiUser: result.apiUser } });
    } catch (e) {
      if (e.code !== 'ERR_REQUEST_CANCELED') {
        setError(t('login.error_apple'));
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleAndroid() {
    // Fallback sur expo-auth-session si le module natif n'est pas dispo (Expo Go)
    if (!GoogleSignin) {
      promptGoogleAsync();
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      await GoogleSignin.signIn();
      const tokens = await GoogleSignin.getTokens();
      await fetchGoogleUser({ accessToken: tokens.accessToken });
    } catch (e) {
      if (e.code !== statusCodes?.SIGN_IN_CANCELLED) {
        setError(e.message || t('login.error_google'));
      }
      setLoading(false);
    } finally {
      GoogleSignin?.signOut().catch(() => {});
    }
  }

  const googleDisabled = loading || !googleConfigured || (Platform.OS === 'ios' && !request);

  return (
    <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets={true}>

          <View style={styles.logoWrap}>
            <Image source={ACC1_IMG} style={styles.logoImg} resizeMode="contain" />
          </View>
          <Text style={styles.title}>{t('login.title')}</Text>
          <Text style={styles.subtitle}>{t('login.subtitle')}</Text>

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Email / mot de passe */}
          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>{t('login.email_label')}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('login.email_placeholder')}
                placeholderTextColor={colors.textMuted}
                value={form.email}
                onChangeText={set('email')}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>{t('login.password_label')}</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.inputFlex}
                  placeholder={t('login.password_placeholder')}
                  placeholderTextColor={colors.textMuted}
                  value={form.password}
                  onChangeText={set('password')}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity onPress={() => setShowPassword(v => !v)} style={styles.eyeBtn} activeOpacity={0.7}>
                  <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading
                ? <ActivityIndicator color={colors.white} />
                : <Text style={styles.btnText}>{t('login.submit')}</Text>
              }
            </TouchableOpacity>

            <TouchableOpacity style={styles.forgotBtn} onPress={() => navigation.navigate('ForgotPassword')}>
              <Text style={styles.forgotText}>{t('login.forgot_password')}</Text>
            </TouchableOpacity>
          </View>

          {/* Séparateur */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>{t('login.divider')}</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Social login */}
          <View style={styles.socialRow}>
            <TouchableOpacity
              style={[styles.socialBtn, googleDisabled && styles.socialBtnDisabled]}
              onPress={() => {
                setError(null);
                Platform.OS === 'android' ? handleGoogleAndroid() : promptGoogleAsync();
              }}
              disabled={googleDisabled}
              activeOpacity={0.7}
            >
              <Ionicons name="logo-google" size={18} color={googleDisabled ? colors.textMuted : colors.text} />
              <Text style={[styles.socialText, googleDisabled && styles.socialTextDisabled]}>
                Google
              </Text>
            </TouchableOpacity>

            {appleAvailable && (
              <TouchableOpacity
                style={styles.socialBtn}
                onPress={handleAppleLogin}
                disabled={loading}
                activeOpacity={0.7}
              >
                <Ionicons name="logo-apple" size={20} color={colors.text} />
                <Text style={styles.socialText}>Apple</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Inscription */}
          <View style={styles.registerRow}>
            <Text style={styles.registerText}>{t('login.register_prompt')} </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Register')}>
              <Text style={styles.registerLink}>{t('login.register_link')}</Text>
            </TouchableOpacity>
          </View>

          {/* Invité */}
          <TouchableOpacity style={styles.guestBtn} onPress={() => dispatch({ type: 'AUTH_GUEST_LOGIN' })} activeOpacity={0.7}>
            <Text style={styles.guestText}>{t('login.guest')}</Text>
          </TouchableOpacity>

        </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.xxl },
  logoWrap: { alignItems: 'center', marginBottom: spacing.lg },
  logoImg: { width: 180, height: 180 },
  title: { ...typography.h1, textAlign: 'center' },
  subtitle: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.xl },
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
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  inputFlex: {
    flex: 1,
    padding: spacing.md,
    color: colors.text,
    fontSize: 15,
  },
  eyeBtn: { paddingHorizontal: spacing.md },
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
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.lg,
    gap: spacing.sm,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { ...typography.caption, color: colors.textMuted },
  socialRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.xl },
  socialBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
  },
  socialBtnDisabled: { opacity: 0.4 },
  socialText: { ...typography.body, fontWeight: '600' },
  socialTextDisabled: { color: colors.textMuted },
  forgotBtn: { alignItems: 'center', marginTop: spacing.sm },
  forgotText: { ...typography.bodySmall, color: colors.textSecondary },
  registerRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  registerText: { ...typography.body, color: colors.textSecondary },
  registerLink: { ...typography.body, color: colors.primary, fontWeight: '600' },
  guestBtn: { alignItems: 'center', marginTop: spacing.lg, paddingVertical: spacing.sm },
  guestText: { ...typography.body, color: colors.textMuted, textDecorationLine: 'underline' },
});
