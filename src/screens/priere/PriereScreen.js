import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography } from '../../utils/theme';
import { useTranslation } from 'react-i18next';

export default function PriereScreen() {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === 'ar' || i18n.language?.startsWith('ar-');
  const [expanded, setExpanded] = useState({ 0: true });

  const STEPS = [
    {
      number: 1,
      title: t('prayer.takbir_1_title'),
      icon: 'hand-right-outline',
      intro: t('prayer.takbir_1_intro'),
      duas: [
        {
          arabic: 'اللَّهُ أَكْبَرُ',
          transliteration: 'Allahu Akbar',
          french: t('prayer.takbir_fr'),
          type: 'takbir',
        },
        {
          label: t('prayer.al_fatiha'),
          arabic: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ ۝ الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ ۝ الرَّحْمَٰنِ الرَّحِيمِ ۝ مَالِكِ يَوْمِ الدِّينِ ۝ إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ ۝ اهْدِنَا الصِّرَاطَ الْمُسْتَقِيمَ ۝ صِرَاطَ الَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ الْمَغْضُوبِ عَلَيْهِمْ وَلَا الضَّالِّينَ',
          transliteration: 'Bismi-llāhi r-raḥmāni r-raḥīm. Al-ḥamdu li-llāhi rabbi l-ʿālamīn. Ar-raḥmāni r-raḥīm. Māliki yawmi d-dīn. Iyyāka naʿbudu wa-iyyāka nastaʿīn. Ihdinā ṣ-ṣirāṭa l-mustaqīm. Ṣirāṭa llaḏīna anʿamta ʿalayhim ġayri l-maġḍūbi ʿalayhim wa-lā ḍ-ḍāllīn.',
          french: t('prayer.fatiha_fr'),
        },
      ],
    },
    {
      number: 2,
      title: t('prayer.takbir_2_title'),
      icon: 'star-outline',
      intro: t('prayer.takbir_2_intro'),
      duas: [
        {
          arabic: 'اللَّهُ أَكْبَرُ',
          transliteration: 'Allahu Akbar',
          french: t('prayer.takbir_fr'),
          type: 'takbir',
        },
        {
          arabic: 'اللَّهُمَّ صَلِّ عَلَى مُحَمَّدٍ وَعَلَى آلِ مُحَمَّدٍ، كَمَا صَلَّيْتَ عَلَى إِبْرَاهِيمَ وَعَلَى آلِ إِبْرَاهِيمَ، إِنَّكَ حَمِيدٌ مَجِيدٌ، اللَّهُمَّ بَارِكْ عَلَى مُحَمَّدٍ وَعَلَى آلِ مُحَمَّدٍ، كَمَا بَارَكْتَ عَلَى إِبْرَاهِيمَ وَعَلَى آلِ إِبْرَاهِيمَ، إِنَّكَ حَمِيدٌ مَجِيدٌ',
          transliteration: 'Allāhumma ṣalli ʿalā Muḥammad wa-ʿalā āli Muḥammad, kamā ṣallayta ʿalā Ibrāhīma wa-ʿalā āli Ibrāhīm, innaka Ḥamīdun Majīd. Allāhumma bārik ʿalā Muḥammad wa-ʿalā āli Muḥammad, kamā bārakta ʿalā Ibrāhīma wa-ʿalā āli Ibrāhīm, innaka Ḥamīdun Majīd.',
          french: t('prayer.salat_ibrahimiyya_fr'),
        },
      ],
    },
    {
      number: 3,
      title: t('prayer.takbir_3_title'),
      icon: 'heart-outline',
      intro: t('prayer.takbir_3_intro'),
      duas: [
        {
          arabic: 'اللَّهُ أَكْبَرُ',
          transliteration: 'Allahu Akbar',
          french: t('prayer.takbir_fr'),
          type: 'takbir',
        },
        {
          label: t('prayer.takbir_3_for_man'),
          arabic: 'اللَّهُمَّ اغْفِرْ لَهُ وَارْحَمْهُ، وَعَافِهِ وَاعْفُ عَنْهُ، وَأَكْرِمْ نُزُلَهُ، وَوَسِّعْ مُدْخَلَهُ، وَاغْسِلْهُ بِالْمَاءِ وَالثَّلْجِ وَالْبَرَدِ، وَنَقِّهِ مِنَ الْخَطَايَا كَمَا نَقَّيْتَ الثَّوْبَ الْأَبْيَضَ مِنَ الدَّنَسِ، وَأَبْدِلْهُ دَارًا خَيْرًا مِنْ دَارِهِ، وَأَهْلًا خَيْرًا مِنْ أَهْلِهِ، وَزَوْجًا خَيْرًا مِنْ زَوْجِهِ، وَأَدْخِلْهُ الْجَنَّةَ، وَأَعِذْهُ مِنْ عَذَابِ الْقَبْرِ وَعَذَابِ النَّارِ',
          transliteration: 'Allāhumma-ghfir lahu wa-rḥamhu, wa-ʿāfihi wa-ʿfu ʿanhu, wa-akrim nuzulahu, wa-wassiʿ mudkhalahu, wa-ghsilhu bi-l-māʾi wa-th-thalji wa-l-barad, wa-naqqihi min al-khaṭāyā kamā naqqayta th-thawba l-abyaḍa min ad-danas, wa-abdilhu dāran khayran min dārihi, wa-ahlan khayran min ahlihi, wa-zawjan khayran min zawjihi, wa-adkhilhu l-jannata, wa-aʿiḏhu min ʿaḏābi l-qabri wa-ʿaḏābi n-nār.',
          french: t('prayer.dua_man_fr'),
        },
        {
          label: t('prayer.takbir_3_for_woman'),
          arabic: 'اللَّهُمَّ اغْفِرْ لَهَا وَارْحَمْهَا، وَعَافِهَا وَاعْفُ عَنْهَا، وَأَكْرِمْ نُزُلَهَا، وَوَسِّعْ مُدْخَلَهَا...',
          transliteration: 'Allāhumma-ghfir lahā wa-rḥamhā, wa-ʿāfihā wa-ʿfu ʿanhā, wa-akrim nuzulahā, wa-wassiʿ mudkhalahā...',
          french: t('prayer.dua_woman_note'),
        },
      ],
      note: t('prayer.takbir_3_note'),
    },
    {
      number: 4,
      title: t('prayer.takbir_4_title'),
      icon: 'checkmark-circle-outline',
      intro: t('prayer.takbir_4_intro'),
      duas: [
        {
          arabic: 'اللَّهُ أَكْبَرُ',
          transliteration: 'Allahu Akbar',
          french: t('prayer.takbir_fr'),
          type: 'takbir',
        },
        {
          arabic: 'اللَّهُمَّ لَا تَحْرِمْنَا أَجْرَهُ، وَلَا تَفْتِنَّا بَعْدَهُ، وَاغْفِرْ لَنَا وَلَهُ',
          transliteration: 'Allāhumma lā taḥrimnā ajrahu, wa-lā taftinanā baʿdahu, wa-ghfir lanā wa-lahu.',
          french: t('prayer.dua_final_fr'),
        },
        {
          label: t('prayer.salam'),
          arabic: 'السَّلَامُ عَلَيْكُمْ وَرَحْمَةُ اللَّهِ',
          transliteration: 'As-salāmu ʿalaykum wa-raḥmatu-llāh',
          french: t('prayer.salam_fr'),
          type: 'salam',
        },
      ],
    },
  ];

  const MERITS = [
    {
      icon: 'people-outline',
      title: t('prayer.merit_1_title'),
      body: t('prayer.merit_1_body'),
    },
    {
      icon: 'gift-outline',
      title: t('prayer.merit_2_title'),
      body: t('prayer.merit_2_body'),
    },
    {
      icon: 'heart-outline',
      title: t('prayer.merit_3_title'),
      body: t('prayer.merit_3_body'),
    },
  ];

  const TIPS = [
    { icon: 'information-circle-outline', text: t('prayer.tip_1') },
    { icon: 'people-outline', text: t('prayer.tip_2') },
    { icon: 'moon-outline', text: t('prayer.tip_3') },
    { icon: 'body-outline', text: t('prayer.tip_4') },
  ];

  const toggle = (i) => setExpanded(prev => ({ ...prev, [i]: !prev[i] }));

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerArabic}>صَلَاةُ الجَنَازَةِ</Text>
          {!isArabic && <Text style={styles.headerTitle}>{t('prayer.title')}</Text>}
          {!isArabic && <Text style={styles.headerSub}>{t('prayer.subtitle')}</Text>}
        </View>

        {/* Steps */}
        {STEPS.map((step, i) => (
          <View key={i} style={styles.stepCard}>
            <TouchableOpacity
              style={styles.stepHeader}
              onPress={() => toggle(i)}
              activeOpacity={0.7}
            >
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>{step.number}</Text>
              </View>
              <View style={styles.stepTitleBlock}>
                <Text style={styles.stepTitle}>{step.title}</Text>
              </View>
              <Ionicons
                name={expanded[i] ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={colors.textMuted}
              />
            </TouchableOpacity>

            {expanded[i] && (
              <View style={styles.stepBody}>
                <Text style={styles.stepIntro}>{step.intro}</Text>

                {step.duas.map((dua, j) => (
                  <View key={j} style={styles.duaBlock}>
                    {dua.label && (
                      <Text style={styles.duaLabel}>{dua.label}</Text>
                    )}
                    <View style={[
                      styles.duaCard,
                      dua.type === 'takbir' && styles.duaCardTakbir,
                      dua.type === 'salam' && styles.duaCardSalam,
                    ]}>
                      <Text style={[
                        styles.duaArabic,
                        dua.type === 'takbir' && styles.duaArabicTakbir,
                      ]}>{dua.arabic}</Text>
                      <View style={styles.duaDivider} />
                      <Text style={styles.duaTranslit}>{dua.transliteration}</Text>
                      <Text style={styles.duaFrench}>{dua.french}</Text>
                    </View>
                  </View>
                ))}

                {step.note && (
                  <View style={styles.noteRow}>
                    <Ionicons name="information-circle-outline" size={14} color={colors.textMuted} />
                    <Text style={styles.noteText}>{step.note}</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        ))}

        {/* Tips */}
        <View style={styles.tipsCard}>
          <Text style={styles.tipsTitle}>{t('prayer.tips_title')}</Text>
          {TIPS.map((tip, i) => (
            <View key={i} style={styles.tipRow}>
              <Ionicons name={tip.icon} size={16} color={colors.primary} style={styles.tipIcon} />
              <Text style={styles.tipText}>{tip.text}</Text>
            </View>
          ))}
        </View>

        {/* Mérites */}
        <View style={styles.meritsCard}>
          <Text style={styles.meritsTitle}>{t('prayer.merits_title')}</Text>
          <Text style={styles.meritsSub}>{t('prayer.merits_subtitle')}</Text>
          {MERITS.map((m, i) => (
            <View key={i} style={[styles.meritRow, i < MERITS.length - 1 && styles.meritRowBorder]}>
              <View style={styles.meritIconWrap}>
                <Ionicons name={m.icon} size={18} color={colors.white} />
              </View>
              <View style={styles.meritContent}>
                <Text style={styles.meritTitle}>{m.title}</Text>
                <Text style={styles.meritBody}>{m.body}</Text>
              </View>
            </View>
          ))}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },

  // Header
  header: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.xs,
  },
  headerArabic: {
    fontSize: 26,
    color: colors.white,
    fontFamily: 'System',
    textAlign: 'center',
    lineHeight: 40,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.white,
    letterSpacing: 0.3,
  },
  headerSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.75)',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },

  // Step card
  stepCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.sm,
  },
  stepBadge: {
    width: 30,
    height: 30,
    borderRadius: radius.full,
    backgroundColor: colors.primaryDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBadgeText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  stepTitleBlock: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  stepBody: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  stepIntro: {
    ...typography.bodySmall,
    paddingTop: spacing.sm,
    lineHeight: 20,
  },

  // Dua block
  duaBlock: {
    gap: spacing.xs,
  },
  duaLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  duaCard: {
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    padding: spacing.md,
    gap: spacing.xs,
    borderLeftWidth: 3,
    borderLeftColor: colors.primaryLight,
  },
  duaCardTakbir: {
    backgroundColor: colors.primaryDim,
    borderLeftColor: colors.primary,
  },
  duaCardSalam: {
    backgroundColor: 'rgba(92,128,98,0.06)',
    borderLeftColor: colors.primary,
  },
  duaArabic: {
    fontSize: 20,
    color: colors.text,
    textAlign: 'right',
    lineHeight: 36,
    fontFamily: 'System',
  },
  duaArabicTakbir: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.primary,
    textAlign: 'center',
  },
  duaDivider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginVertical: spacing.xs,
  },
  duaTranslit: {
    fontSize: 13,
    color: colors.textSecondary,
    fontStyle: 'italic',
    lineHeight: 20,
  },
  duaFrench: {
    ...typography.bodySmall,
    lineHeight: 20,
  },

  // Note
  noteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
  noteText: {
    flex: 1,
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 18,
  },

  // Tips
  tipsCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  tipsTitle: {
    ...typography.label,
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  tipIcon: {
    marginTop: 1,
  },
  tipText: {
    flex: 1,
    ...typography.bodySmall,
    lineHeight: 20,
  },

  // Mérites
  meritsCard: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
    shadowColor: colors.primary,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  meritsTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.white,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  meritsSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 18,
    fontStyle: 'italic',
    marginBottom: spacing.xs,
  },
  meritRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  meritRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.15)',
  },
  meritIconWrap: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    flexShrink: 0,
  },
  meritContent: {
    flex: 1,
    gap: 4,
  },
  meritTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.white,
    lineHeight: 20,
  },
  meritBody: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.82)',
    lineHeight: 20,
  },

  // Hadith
  hadithCard: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  hadithArabic: {
    fontSize: 16,
    color: colors.white,
    textAlign: 'right',
    lineHeight: 28,
    opacity: 0.95,
  },
  hadithFrench: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    fontStyle: 'italic',
    lineHeight: 20,
  },
});
