import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Platform, Image,
} from 'react-native';

const ACC1_IMG = require('../../../assets/icons/acc1.png');
const ACC2_IMG = require('../../../assets/icons/acc2.png');
const ACC3_IMG = require('../../../assets/icons/acc3.png');
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { colors, spacing, radius, typography } from '../../utils/theme';
import { useTranslation } from 'react-i18next';

export default function OnboardingScreen({ navigation }) {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  const STEPS = [
    {
      title: t('onboarding.step1_title'),
      subtitle: t('onboarding.step1_subtitle'),
      description: t('onboarding.step1_description'),
    },
    {
      title: t('onboarding.step2_title'),
      subtitle: t('onboarding.step2_subtitle'),
      description: t('onboarding.step2_description'),
      permission: 'location',
    },
    {
      title: t('onboarding.step3_title'),
      subtitle: t('onboarding.step3_subtitle'),
      description: t('onboarding.step3_description'),
      permission: 'notifications',
    },
  ];

  const current = STEPS[step];

  async function handleNext() {
    if (current.permission === 'location') {
      setLoading(true);
      await Location.requestForegroundPermissionsAsync();
      setLoading(false);
    } else if (current.permission === 'notifications') {
      setLoading(true);
      if (Platform.OS !== 'web') {
        await Notifications.requestPermissionsAsync();
      }
      setLoading(false);
    }

    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
    } else {
      navigation.replace('Login');
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} bounces={false}>
        {/* Indicateurs de progression */}
        <View style={styles.dots}>
          {STEPS.map((_, i) => (
            <View key={i} style={[styles.dot, i === step && styles.dotActive]} />
          ))}
        </View>

        {/* Contenu */}
        {step === 0 ? (
          <>
            <Image source={ACC1_IMG} style={styles.acc1Img} resizeMode="contain" />
            <Text style={styles.acc1Title}>{t('onboarding.step1_title')}</Text>
          </>
        ) : step === 1 ? (
          <>
            <Image source={ACC2_IMG} style={styles.acc1Img} resizeMode="contain" />
            <Text style={styles.title}>{current.title}</Text>
          </>
        ) : (
          <>
            <Image source={ACC3_IMG} style={styles.acc1Img} resizeMode="contain" />
            <Text style={styles.title}>{current.title}</Text>
          </>
        )}
        <Text style={styles.subtitle}>{current.subtitle}</Text>
        <Text style={styles.description}>{current.description}</Text>
      </ScrollView>

      {/* Actions */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.btn, loading && styles.btnDisabled]}
          onPress={handleNext}
          disabled={loading}
          activeOpacity={0.8}
        >
          <Text style={styles.btnText}>
            {loading
              ? t('onboarding.loading')
              : step < STEPS.length - 1
              ? t('onboarding.continue')
              : t('onboarding.start')}
          </Text>
        </TouchableOpacity>

        {step > 0 && (
          <TouchableOpacity onPress={() => setStep((s) => s - 1)} style={styles.backBtn}>
            <Text style={styles.backText}>{t('onboarding.back')}</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
  },
  dots: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xxl },
  dot: {
    width: 8, height: 8, borderRadius: radius.full,
    backgroundColor: colors.border,
  },
  dotActive: { width: 24, backgroundColor: colors.primary },
  acc1Img: { width: 260, height: 260, marginBottom: spacing.sm },
  acc1Title: { fontSize: 26, fontWeight: '700', color: colors.text, textAlign: 'center', letterSpacing: 0.5, marginBottom: spacing.lg },
  emoji: { fontSize: 72, marginBottom: spacing.lg },
  title: { ...typography.h1, textAlign: 'center', marginBottom: spacing.sm },
  subtitle: {
    ...typography.h3,
    textAlign: 'center',
    color: colors.primary,
    marginBottom: spacing.md,
  },
  description: {
    ...typography.body,
    textAlign: 'center',
    color: colors.textSecondary,
    lineHeight: 24,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  btn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { ...typography.button },
  backBtn: { alignItems: 'center', paddingVertical: spacing.sm },
  backText: { ...typography.body, color: colors.textSecondary },
});
