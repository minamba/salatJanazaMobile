import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, TouchableWithoutFeedback,
  FlatList, TextInput, ScrollView, ActivityIndicator, Image, ImageBackground, Switch,
  KeyboardAvoidingView, Platform, useWindowDimensions, StatusBar, Keyboard,
} from 'react-native';
import { SafeAreaView, SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius } from '../../utils/theme';
import { COUNTRIES } from '../../utils/countries';
import { useTranslation } from 'react-i18next';
import { detectCountryFromIP } from '../../utils/detectCountry';

const ACC1_IMG = require('../../../assets/icons/icon3.png');
const INVOCATION_IMG = require('../../../assets/icons/invocation.png');
const MOTIF_IMG = require('../../../assets/icons/motif-islamique.png');

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: CURRENT_YEAR - 1920 + 1 }, (_, i) => CURRENT_YEAR - i);

const MONTHS_FR = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
const DAYS_FR = ['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'];

function formatDateFR(date) {
  if (!date) return '___';
  return `${DAYS_FR[date.getDay()]} ${date.getDate()} ${MONTHS_FR[date.getMonth()]} ${date.getFullYear()}`;
}

// Pays pluriels → "aux", masculins en -e → "au", reste : -e ou voyelle → "en", sinon "au"
const AUX_COUNTRIES = new Set([
  'États-Unis', 'Pays-Bas', 'Philippines', 'Maldives', 'Fidji',
  'Comores', 'Seychelles', 'Bahamas', 'Salomon', 'Marshall', 'Palaos',
]);
const EN_EXCEPTIONS = new Set([
  'Guinée-Bissau', 'Corée du Nord', 'Corée du Sud', 'Afrique du Sud', 'Soudan du Sud',
]);
const AU_EXCEPTIONS = new Set([
  'Mexique', 'Cambodge', 'Zimbabwe', 'Mozambique', 'Belize',
]);

function getPreposition(country) {
  if (!country) return 'en';
  if (AUX_COUNTRIES.has(country)) return 'aux';
  if (EN_EXCEPTIONS.has(country)) return 'en';
  if (AU_EXCEPTIONS.has(country)) return 'au';
  if (country.endsWith('e')) return 'en';
  if (/^[aàâeéèêëiîïoôuùûü]/i.test(country)) return 'en';
  return 'au';
}

// ─── Country Picker ──────────────────────────────────────────────────────────

function CountryPickerModal({ visible, selected, onSelect, onClose }) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!visible) setSearch('');
  }, [visible]);

  const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const filtered = search.trim()
    ? COUNTRIES.filter(c => norm(c).includes(norm(search)))
    : COUNTRIES;

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <View style={styles.cpOverlay}>
          <TouchableWithoutFeedback onPress={onClose}>
            <View style={StyleSheet.absoluteFillObject} />
          </TouchableWithoutFeedback>
          <View style={styles.cpSheet}>
            <View style={styles.cpHandle} />
            <Text style={styles.cpTitle}>{t('announcement.country_picker_title')}</Text>
            <View style={styles.cpSearchRow}>
              <Ionicons name="search-outline" size={16} color={colors.textMuted} />
              <TextInput
                style={styles.cpSearchInput}
                placeholder={t('announcement.country_search')}
                placeholderTextColor={colors.textMuted}
                value={search}
                onChangeText={setSearch}
                autoFocus
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                  <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>
            <FlatList
              data={filtered}
              keyExtractor={item => item}
              renderItem={({ item }) => {
                const isSel = item === selected;
                return (
                  <TouchableOpacity
                    style={[styles.cpItem, isSel && styles.cpItemSelected]}
                    onPress={() => { onSelect(item); onClose(); }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.cpItemText, isSel && styles.cpItemTextSelected]}>{item}</Text>
                    {isSel && <Ionicons name="checkmark" size={18} color={colors.primary} />}
                  </TouchableOpacity>
                );
              }}
              style={{ maxHeight: 200 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Year Picker ─────────────────────────────────────────────────────────────

function YearPickerModal({ visible, selected, onSelect, onClose, title }) {
  const initIdx = Math.max(0, YEARS.indexOf(selected));
  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.ypOverlay}>
          <TouchableWithoutFeedback>
            <View style={styles.ypSheet}>
              <View style={styles.ypHandle} />
              <Text style={styles.ypTitle}>{title}</Text>
              <FlatList
                data={YEARS}
                keyExtractor={item => String(item)}
                renderItem={({ item }) => {
                  const isSel = item === selected;
                  return (
                    <TouchableOpacity
                      style={[styles.ypItem, isSel && styles.ypItemSelected]}
                      onPress={() => { onSelect(item); onClose(); }}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.ypItemText, isSel && styles.ypItemTextSelected]}>{item}</Text>
                      {isSel && <Ionicons name="checkmark" size={18} color={colors.primary} />}
                    </TouchableOpacity>
                  );
                }}
                style={{ maxHeight: 320 }}
                showsVerticalScrollIndicator={false}
                initialScrollIndex={initIdx}
                getItemLayout={(_, idx) => ({ length: 52, offset: 52 * idx, index: idx })}
              />
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

// ─── Announcement Preview (the captured view) ─────────────────────────────────

const PREVIEW_LOCALE_MAP = { fr: 'fr-FR', en: 'en-US', ar: 'ar-SA' };

const AnnouncementPreview = React.forwardRef(function AnnouncementPreview({ data }, ref) {
  const { t, i18n } = useTranslation();
  const { familleNom, nomDefunt, nomAnonyme, genre, mosqueeNom, mosqueeAdresse, date, hour, minute, birthYear, deathYear, country, locationFrance, showYears, commentaire } = data;

  const dateLocale = PREVIEW_LOCALE_MAP[i18n.language?.split('-')[0]] ?? 'fr-FR';

  const civilite = genre === 'femme' ? t('announcement.civility_female') : genre === 'enfant' ? t('announcement.civility_child') : t('announcement.civility_male');
  const nameDisplay = nomAnonyme ? null : (nomDefunt || null);
  const anonymousLabel = genre === 'femme'
    ? t('announcement.sister_community')
    : genre === 'enfant'
      ? t('announcement.child_community')
      : t('announcement.brother_community');
  const anonymousSub = genre === 'femme'
    ? t('announcement.unknown_female')
    : genre === 'enfant'
      ? t('announcement.unknown_child')
      : t('announcement.unknown_male');
  const dateStr = date
    ? date.toLocaleDateString(dateLocale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : '___';
  const timeStr = `${String(hour ?? 12).padStart(2, '0')}h${String(minute ?? 0).padStart(2, '0')}`;
  const ageStr = (showYears && birthYear && deathYear) ? `${birthYear} – ${deathYear}` : null;
  const arabicDua = genre === 'femme'
    ? 'اللهم اغفر لها وارحمها وعافها واعف عنها'
    : 'اللهم اغفر له وارحمه وعافه واعف عنه';
  const prep = getPreposition(country);
  const burialPrefix = t(`announcement.burial_prep_${prep}`);

  return (
    <View ref={ref} style={styles.preview} collapsable={false}>
      {/* Header */}
      <View style={styles.prevHeader}>
        <Image source={ACC1_IMG} style={styles.prevHeaderIcon} resizeMode="contain" />
        <View>
          <Text style={styles.prevTitle}>Salat al-Janaza</Text>
          <Text style={styles.prevTitleSub}>{t('announcement.death_announcement')}</Text>
        </View>
      </View>

      {/* Invocation */}
      <ImageBackground source={MOTIF_IMG} resizeMode="cover" style={styles.prevInvocationBlock} imageStyle={styles.prevMotif}>
        <Image source={INVOCATION_IMG} style={styles.prevInvocationImg} resizeMode="contain" />
      </ImageBackground>

      <View style={styles.prevDivider} />

      {/* Body */}
      <ImageBackground source={MOTIF_IMG} resizeMode="cover" style={styles.prevBody} imageStyle={styles.prevMotif}>
        <Text style={styles.prevFamilyLine}>
          {nomAnonyme
            ? t('announcement.anonymous_announces')
            : familleNom
              ? t('announcement.family_announces_named', { name: familleNom.toUpperCase() })
              : t('announcement.family_announces_unnamed')}
        </Text>

        <View style={styles.prevNameBlock}>
          {nomAnonyme ? (
            <>
              <Text style={styles.prevName}>{anonymousLabel}</Text>
              <Text style={styles.prevYears}>{anonymousSub}</Text>
            </>
          ) : (
            <Text style={styles.prevName}>
              <Text style={styles.prevCivilite}>{civilite} </Text>
              {nameDisplay ? nameDisplay.toUpperCase() : ''}
            </Text>
          )}
          {ageStr && <Text style={styles.prevYears}>{ageStr}</Text>}
          {!!commentaire && (
            <View style={styles.prevCommentaireBlock}>
              <Text style={styles.prevCommentaire}>{commentaire}</Text>
            </View>
          )}
        </View>

        <View style={styles.prevSectionDivider} />

        <Text style={styles.prevSectionLabel}>{t('announcement.prayer_section')}</Text>
        <Text style={styles.prevInfoDate}>{dateStr}  ·  {timeStr}</Text>

        <View style={styles.prevSmallSpacer} />

        <View style={styles.prevMosqueBlock}>
          <View style={styles.prevMosqueLine} />
          <View style={{ flex: 1, paddingLeft: spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="location" size={13} color={colors.primary} />
              <Text style={styles.prevMosqueName}>{mosqueeNom || '___'}</Text>
            </View>
            {!!mosqueeAdresse && <Text style={styles.prevMosqueAddr}>{mosqueeAdresse}</Text>}
          </View>
        </View>

        {!!country && (
          <>
            <View style={styles.prevSmallSpacer} />
            <View style={styles.prevBurialBlock}>
              <Ionicons name="earth-outline" size={13} color={colors.primary} />
              <Text style={styles.prevBurialLine}>
                {`${burialPrefix} `}
                <Text style={{ fontWeight: '700', color: colors.text }}>
                  {`${country}${locationFrance ? `, ${locationFrance}` : ''}`}
                </Text>
              </Text>
            </View>
          </>
        )}
      </ImageBackground>

      <View style={styles.prevDivider} />

      {/* Dua */}
      <View style={styles.prevDuaBlock}>
        <Text style={styles.prevOrnament}>✦</Text>
        <Text style={styles.prevDuaAr}>{arabicDua}</Text>
        <Text style={styles.prevDuaFr}>{t('announcement.dua')}</Text>
      </View>

      {/* Footer */}
      <View style={styles.prevFooter}>
        <Text style={styles.prevFooterText}>{t('announcement.website')}</Text>
      </View>
    </View>
  );
});

// ─── Main Modal (2-step: form → preview) ──────────────────────────────────────

export default function AnnouncementGeneratorModal({ visible, onClose, onDataChange, onPublish, form, date, hour, minute, initialValues }) {
  const { t } = useTranslation();
  const { width: windowWidth } = useWindowDimensions();
  const [step, setStep] = useState('form');
  const [showYears, setShowYears] = useState(false);
  const [birthYear, setBirthYear] = useState(1950);
  const [deathYear, setDeathYear] = useState(CURRENT_YEAR);
  const [country, setCountry] = useState('');
  const [locationFrance, setLocationFrance] = useState('');
  const [commentaire, setCommentaire] = useState('');
  const [showBirth, setShowBirth] = useState(false);
  const [showDeath, setShowDeath] = useState(false);
  const [showCountry, setShowCountry] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [kbHeight, setKbHeight] = useState(0);

  const viewRef = useRef(null);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const show = Keyboard.addListener('keyboardDidShow', (e) => setKbHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKbHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  useEffect(() => {
    if (!visible) {
      setStep('form');
      setShowYears(false);
    } else {
      setCommentaire(form?.commentaire ?? '');
      const presetCountry = initialValues?.country;
      if (presetCountry) {
        setCountry(presetCountry);
      } else {
        detectCountryFromIP().then(c => { if (c) setCountry(c); });
      }
    }
  }, [visible]);

  const rawNom = form?.nomAnonyme ? '' : (form?.nomDefunt ?? '');
  const familleNom = rawNom.trim().split(/\s+/)[0] ?? '';

  const previewData = {
    familleNom,
    showYears,
    birthYear,
    deathYear,
    country,
    locationFrance,
    genre: form?.genre ?? 'homme',
    nomDefunt: form?.nomDefunt ?? '',
    nomAnonyme: form?.nomAnonyme ?? false,
    mosqueeNom: form?.mosqueeNom ?? '',
    mosqueeAdresse: form?.mosqueeAdresse ?? '',
    commentaire: form?.commentaire ?? '',
    date,
    hour,
    minute,
  };

  async function handleShare() {
    try {
      setSharing(true);
      const uri = await captureRef(viewRef, { format: 'png', quality: 1 });
      const available = await Sharing.isAvailableAsync();
      if (available) {
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: "Partager l'annonce" });
      }
    } catch (e) {
      console.warn('Capture/share error:', e);
    } finally {
      setSharing(false);
    }
  }

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <SafeAreaProvider>
      <SafeAreaView style={[styles.container, step === 'preview' && { justifyContent: 'flex-start' }]} edges={['top', 'bottom']}>

        {/* ── Step 1 : Form ── */}
        {step === 'form' && (
          <KeyboardAvoidingView
            style={styles.formSheet}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View style={styles.formHandle} />
            <View style={styles.formTopBar}>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={22} color={colors.text} />
              </TouchableOpacity>
              <Text style={styles.formTitle}>{t('announcement.title')}</Text>
              <View style={{ width: 22 }} />
            </View>
            <Text style={styles.formSubtitle}>{t('announcement.subtitle')}</Text>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: Platform.OS === 'android' ? kbHeight + spacing.xl : spacing.xl }}>
              {/* Toggle années */}
              <View style={styles.toggleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.toggleLabel}>{t('announcement.years_toggle')}</Text>
                  <Text style={styles.toggleDesc}>
                    {showYears ? t('announcement.years_toggle_description') : 'Activer si vous disposez de cette information'}
                  </Text>
                </View>
                <Switch
                  value={showYears}
                  onValueChange={setShowYears}
                  trackColor={{ false: '#9E9E9E', true: colors.primary }}
                  thumbColor={colors.white}
                />
              </View>

              {showYears && (
                <>
                  <View style={styles.formLabelRow}>
                    <Text style={[styles.formLabel, { marginTop: 0, marginBottom: 0 }]}>{t('announcement.birth_year')}</Text>
                    <Text style={styles.formLabelOptional}>optionnel</Text>
                  </View>
                  <TouchableOpacity style={styles.formPickerBtn} onPress={() => setShowBirth(true)} activeOpacity={0.7}>
                    <Ionicons name="calendar-outline" size={16} color={colors.textMuted} />
                    <Text style={[styles.formPickerText, { flex: 1 }]}>{birthYear}</Text>
                    <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
                  </TouchableOpacity>

                  <View style={styles.formLabelRow}>
                    <Text style={[styles.formLabel, { marginTop: 0, marginBottom: 0 }]}>{t('announcement.death_year')}</Text>
                    <Text style={styles.formLabelOptional}>optionnel</Text>
                  </View>
                  <TouchableOpacity style={styles.formPickerBtn} onPress={() => setShowDeath(true)} activeOpacity={0.7}>
                    <Ionicons name="calendar-outline" size={16} color={colors.textMuted} />
                    <Text style={[styles.formPickerText, { flex: 1 }]}>{deathYear}</Text>
                    <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
                  </TouchableOpacity>
                </>
              )}

              {/* Informations supplémentaires */}
              <View style={styles.formLabelRow}>
                <Text style={[styles.formLabel, { marginTop: 0, marginBottom: 0 }]}>{t('declare.info_section')}</Text>
                <Text style={styles.formLabelOptional}>optionnel</Text>
              </View>
              <View style={[styles.formInputRow, { alignItems: 'flex-start', paddingTop: spacing.sm }]}>
                <Ionicons name="chatbubble-outline" size={16} color={colors.textMuted} style={{ marginRight: spacing.sm, marginTop: 2 }} />
                <TextInput
                  style={[styles.formInput, { minHeight: 80, textAlignVertical: 'top' }]}
                  placeholder={t('declare.info_placeholder')}
                  placeholderTextColor={colors.textMuted}
                  value={commentaire}
                  onChangeText={setCommentaire}
                  multiline
                  numberOfLines={3}
                />
              </View>

              {/* Pays */}
              <View style={styles.formLabelRow}>
                <Text style={[styles.formLabel, { marginTop: 0, marginBottom: 0 }]}>{t('announcement.country')}</Text>
                <Text style={styles.formLabelRequired}>obligatoire</Text>
              </View>
              <TouchableOpacity style={styles.formPickerBtn} onPress={() => setShowCountry(true)} activeOpacity={0.7}>
                <Ionicons name="earth-outline" size={16} color={colors.textMuted} />
                <Text style={[styles.formPickerText, { flex: 1 }]}>{country || t('announcement.country_placeholder')}</Text>
                <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
              </TouchableOpacity>

              {/* Lieu */}
              <View style={styles.formLabelRow}>
                <Text style={[styles.formLabel, { marginTop: 0, marginBottom: 0 }]}>Ville / lieu d'enterrement</Text>
                <Text style={styles.formLabelOptional}>optionnel</Text>
              </View>
              <View style={styles.formInputRow}>
                <Ionicons name="location-outline" size={16} color={colors.textMuted} style={{ marginRight: spacing.sm }} />
                <TextInput
                  style={styles.formInput}
                  placeholder={t('announcement.location_placeholder')}
                  placeholderTextColor={colors.textMuted}
                  value={locationFrance}
                  onChangeText={setLocationFrance}
                />
              </View>

              <TouchableOpacity style={[styles.formBtn, styles.formBtnOutline]} onPress={() => {
                onDataChange?.({ birthYear, deathYear, country, locationFrance, showYears, commentaire });
                setStep('preview');
              }} activeOpacity={0.8}>
                <Ionicons name="eye-outline" size={18} color={colors.primary} />
                <Text style={[styles.formBtnText, styles.formBtnTextOutline]}>{t('announcement.preview')}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.formBtn, { marginTop: spacing.sm }]} onPress={() => {
                const data = { birthYear, deathYear, country, locationFrance, showYears, commentaire };
                onDataChange?.(data);
                onPublish?.(data);
              }} activeOpacity={0.8}>
                <Ionicons name="megaphone-outline" size={18} color={colors.white} />
                <Text style={styles.formBtnText}>Publier la prière</Text>
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        )}

        {/* ── Step 2 : Preview ── */}
        {step === 'preview' && (
          <View style={{ flex: 1, backgroundColor: colors.background }}>
            <View style={styles.prevTopBar}>
              <TouchableOpacity onPress={() => setStep('form')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="arrow-back" size={24} color={colors.text} />
              </TouchableOpacity>
              <Text style={styles.prevTopTitle}>{t('announcement.preview_title')}</Text>
              <TouchableOpacity style={styles.shareBtn} onPress={handleShare} disabled={sharing} activeOpacity={0.8}>
                {sharing
                  ? <ActivityIndicator size="small" color={colors.white} />
                  : (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name={Platform.OS === 'ios' ? 'share-social-outline' : 'share-outline'} size={16} color={colors.white} />
                      <Text style={styles.shareBtnText}>{t('announcement.share')}</Text>
                    </View>
                  )
                }
              </TouchableOpacity>
            </View>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.md }}>
              <AnnouncementPreview ref={viewRef} data={previewData} />
            </ScrollView>
          </View>
        )}
      </SafeAreaView>

      {/* Sub-pickers (rendered outside sheets so they float above) */}
      <YearPickerModal visible={showBirth} selected={birthYear} onSelect={setBirthYear} onClose={() => setShowBirth(false)} title={t('announcement.year_birth_title')} />
      <YearPickerModal visible={showDeath} selected={deathYear} onSelect={setDeathYear} onClose={() => setShowDeath(false)} title={t('announcement.year_death_title')} />
      <CountryPickerModal visible={showCountry} selected={country} onSelect={setCountry} onClose={() => setShowCountry(false)} />
      </SafeAreaProvider>
    </Modal>
  );
}

// ─── JanazaShareModal (aperçu direct depuis le fil / les cards) ──────────────

export function JanazaShareModal({ visible, onClose, janaza }) {
  const { t } = useTranslation();
  const [sharing, setSharing] = useState(false);
  const [topInset, setTopInset] = useState(Platform.OS === 'ios' ? 59 : 24);
  const viewRef = useRef(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (Platform.OS === 'ios') {
      const { StatusBarManager } = require('react-native').NativeModules;
      StatusBarManager?.getHeight?.((h) => {
        setTopInset((h?.height ?? 59) + 4);
      });
    }
  }, []);

  const date = janaza?.dateHeure ? new Date(janaza.dateHeure) : null;
  const rawNom = janaza?.estAnonyme ? '' : (janaza?.nomDefunt ?? '');
  const familleNom = rawNom.trim().split(/\s+/)[0] ?? '';

  const previewData = {
    familleNom,
    showYears: !!(janaza?.anneeNaissance && janaza?.anneeDeces),
    birthYear: janaza?.anneeNaissance ?? null,
    deathYear: janaza?.anneeDeces ?? null,
    country: janaza?.paysEnterrement ?? '',
    locationFrance: janaza?.villeEnterrement ?? '',
    genre: janaza?.genre ?? 'homme',
    nomDefunt: janaza?.nomDefunt ?? '',
    nomAnonyme: janaza?.estAnonyme ?? false,
    mosqueeNom: janaza?.mosquee ?? '',
    mosqueeAdresse: janaza?.adresse ?? '',
    commentaire: janaza?.commentaire ?? '',
    date,
    hour: date?.getHours() ?? 12,
    minute: date?.getMinutes() ?? 0,
  };

  async function handleShare() {
    try {
      setSharing(true);
      const uri = await captureRef(viewRef, { format: 'png', quality: 1 });
      const available = await Sharing.isAvailableAsync();
      if (available) {
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: "Partager l'annonce" });
      }
    } catch (e) {
      console.warn('Capture/share error:', e);
    } finally {
      setSharing(false);
    }
  }

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: Platform.OS === 'ios' ? topInset : (StatusBar.currentHeight ?? 24) }}>
        <View style={styles.prevTopBar}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.prevTopTitle}>{t('announcement.preview_title')}</Text>
          <TouchableOpacity style={styles.shareBtn} onPress={handleShare} disabled={sharing} activeOpacity={0.8}>
            {sharing
              ? <ActivityIndicator size="small" color={colors.white} />
              : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="share-outline" size={16} color={colors.white} />
                  <Text style={styles.shareBtnText}>{t('announcement.share')}</Text>
                </View>
              )
            }
          </TouchableOpacity>
        </View>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.md }}>
          <AnnouncementPreview ref={viewRef} data={previewData} />
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── ComplementaryInfoModal ───────────────────────────────────────────────────

export function ComplementaryInfoModal({ visible, onClose, onSubmit, initialValues }) {
  const { t } = useTranslation();
  const [showYears, setShowYears] = useState(false);
  const [birthYear, setBirthYear] = useState(1950);
  const [deathYear, setDeathYear] = useState(CURRENT_YEAR);
  const [country, setCountry] = useState('');
  const [locationFrance, setLocationFrance] = useState('');
  const [commentaire, setCommentaire] = useState('');
  const [showBirth, setShowBirth] = useState(false);
  const [showDeath, setShowDeath] = useState(false);
  const [showCountry, setShowCountry] = useState(false);
  const [kbHeight, setKbHeight] = useState(0);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const show = Keyboard.addListener('keyboardDidShow', (e) => setKbHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKbHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  useEffect(() => {
    if (visible) {
      setShowYears(initialValues?.showYears ?? false);
      setBirthYear(initialValues?.birthYear ?? 1950);
      setDeathYear(initialValues?.deathYear ?? CURRENT_YEAR);
      setLocationFrance(initialValues?.locationFrance ?? '');
      setCommentaire(initialValues?.commentaire ?? '');
      if (initialValues?.country) {
        setCountry(initialValues.country);
      } else {
        setCountry('');
        detectCountryFromIP().then(c => { if (c) setCountry(c); });
      }
    }
  }, [visible]);

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.formSheet}>
            <View style={styles.formHandle} />
            <View style={styles.formTopBar}>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={22} color={colors.text} />
              </TouchableOpacity>
              <Text style={styles.formTitle}>Informations complémentaires</Text>
              <View style={{ width: 22 }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: Platform.OS === 'android' ? kbHeight + spacing.xl : spacing.xl }}>
            <View style={styles.toggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.toggleLabel}>{t('announcement.years_toggle')}</Text>
                <Text style={styles.toggleDesc}>
                  {showYears ? t('announcement.years_toggle_description') : 'Activer si vous disposez de cette information'}
                </Text>
              </View>
              <Switch
                value={showYears}
                onValueChange={setShowYears}
                trackColor={{ false: '#9E9E9E', true: colors.primary }}
                ios_backgroundColor="#9E9E9E"
                thumbColor={colors.white}
              />
            </View>

            {showYears && (
              <>
                <View style={styles.formLabelRow}>
                  <Text style={[styles.formLabel, { marginTop: 0, marginBottom: 0 }]}>{t('announcement.birth_year')}</Text>
                  <Text style={styles.formLabelOptional}>optionnel</Text>
                </View>
                <TouchableOpacity style={styles.formPickerBtn} onPress={() => setShowBirth(true)} activeOpacity={0.7}>
                  <Ionicons name="calendar-outline" size={16} color={colors.textMuted} />
                  <Text style={[styles.formPickerText, { flex: 1 }]}>{birthYear}</Text>
                  <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
                </TouchableOpacity>

                <View style={styles.formLabelRow}>
                  <Text style={styles.formLabel}>{t('announcement.death_year')}</Text>
                  <Text style={styles.formLabelOptional}>optionnel</Text>
                </View>
                <TouchableOpacity style={styles.formPickerBtn} onPress={() => setShowDeath(true)} activeOpacity={0.7}>
                  <Ionicons name="calendar-outline" size={16} color={colors.textMuted} />
                  <Text style={[styles.formPickerText, { flex: 1 }]}>{deathYear}</Text>
                  <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
                </TouchableOpacity>
              </>
            )}

            <View style={styles.formLabelRow}>
              <Text style={[styles.formLabel, { marginTop: 0, marginBottom: 0 }]}>{t('declare.info_section')}</Text>
              <Text style={styles.formLabelOptional}>optionnel</Text>
            </View>
            <View style={[styles.formInputRow, { alignItems: 'flex-start', paddingTop: spacing.sm }]}>
              <Ionicons name="chatbubble-outline" size={16} color={colors.textMuted} style={{ marginRight: spacing.sm, marginTop: 2 }} />
              <TextInput
                style={[styles.formInput, { minHeight: 80, textAlignVertical: 'top' }]}
                placeholder={t('declare.info_placeholder')}
                placeholderTextColor={colors.textMuted}
                value={commentaire}
                onChangeText={setCommentaire}
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.formLabelRow}>
              <Text style={[styles.formLabel, { marginTop: 0, marginBottom: 0 }]}>{t('announcement.country')}</Text>
              <Text style={styles.formLabelRequired}>obligatoire</Text>
            </View>
            <TouchableOpacity style={styles.formPickerBtn} onPress={() => setShowCountry(true)} activeOpacity={0.7}>
              <Ionicons name="earth-outline" size={16} color={colors.textMuted} />
              <Text style={[styles.formPickerText, { flex: 1, color: country ? colors.text : colors.textMuted }]}>
                {country || t('announcement.country_placeholder')}
              </Text>
              <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
            </TouchableOpacity>

            <View style={styles.formLabelRow}>
              <Text style={[styles.formLabel, { marginTop: 0, marginBottom: 0 }]}>Ville / lieu d'enterrement</Text>
              <Text style={styles.formLabelOptional}>optionnel</Text>
            </View>
            <View style={styles.formInputRow}>
              <Ionicons name="location-outline" size={16} color={colors.textMuted} style={{ marginRight: spacing.sm }} />
              <TextInput
                style={styles.formInput}
                value={locationFrance}
                onChangeText={setLocationFrance}
                placeholder={t('announcement.location_placeholder')}
                placeholderTextColor={colors.textMuted}
              />
            </View>

            <TouchableOpacity
              style={styles.formBtn}
              onPress={() => onSubmit?.({ birthYear, deathYear, country, locationFrance, showYears, commentaire })}
              activeOpacity={0.8}
            >
              <Ionicons name="megaphone-outline" size={18} color={colors.white} />
              <Text style={styles.formBtnText}>Publier la prière</Text>
            </TouchableOpacity>
            </ScrollView>
          </View>
        </View>

      <YearPickerModal visible={showBirth} selected={birthYear} onSelect={setBirthYear} onClose={() => setShowBirth(false)} title={t('announcement.year_birth_title')} />
      <YearPickerModal visible={showDeath} selected={deathYear} onSelect={setDeathYear} onClose={() => setShowDeath(false)} title={t('announcement.year_death_title')} />
      <CountryPickerModal visible={showCountry} selected={country} onSelect={setCountry} onClose={() => setShowCountry(false)} />
    </Modal>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },

  // ── Form sheet ──
  formSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl ?? 40,
    maxHeight: '92%',
  },
  formHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center', marginTop: spacing.sm, marginBottom: spacing.md,
  },
  formTopBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  formTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  formSubtitle: { fontSize: 13, color: colors.textSecondary, marginBottom: spacing.lg },
  formLabel: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 6, marginTop: spacing.md },
  formLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md, marginBottom: 6 },
  formLabelOptional: { fontSize: 11, color: colors.textMuted, fontStyle: 'italic', marginTop: 0 },
  formLabelRequired: { fontSize: 11, color: colors.error, fontWeight: '600', marginTop: 0 },
  formInputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: spacing.md,
  },
  formInput: { flex: 1, paddingVertical: spacing.md, color: colors.text, fontSize: 15 },
  formPickerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md,
  },
  formPickerText: { fontSize: 15, color: colors.text },
  formBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    backgroundColor: colors.primary, borderRadius: radius.md,
    paddingVertical: spacing.md, marginTop: spacing.xl ?? 24,
  },
  formBtnText: { fontSize: 15, fontWeight: '700', color: colors.white },
  formBtnOutline: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.primary },
  formBtnTextOutline: { color: colors.primary },

  // ── Toggle row ──
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.borderLight,
    marginBottom: spacing.xs,
  },
  toggleLabel: { fontSize: 14, fontWeight: '600', color: colors.text },
  toggleDesc: { fontSize: 12, color: colors.textMuted, marginTop: 2 },

  // ── Preview top bar ──
  prevTopBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  },
  prevTopTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  shareBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.primary, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: 8, minWidth: 90, minHeight: 36,
  },
  shareBtnText: { fontSize: 14, fontWeight: '700', color: colors.white },

  // ── Announcement Preview card ──
  preview: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  prevHeader: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  prevHeaderIcon: { width: 38, height: 38 },
  prevTitle: { fontSize: 17, fontWeight: '800', color: colors.white, letterSpacing: 0.3 },
  prevTitleSub: { fontSize: 10, color: 'rgba(255,255,255,0.75)', letterSpacing: 0.5, marginTop: 1 },
  prevInvocationBlock: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    backgroundColor: colors.white,
  },
  prevInvocationImg: { width: '85%', height: 70 },
  prevDivider: { height: 2, backgroundColor: colors.primary },
  prevBody: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.white,
  },
  prevMotif: {
    opacity: 1,
  },
  prevFamilyLine: {
    fontSize: 14, color: colors.textSecondary, lineHeight: 20, marginBottom: spacing.md,
    textAlign: 'center',
  },
  prevNameBlock: { alignItems: 'center', marginBottom: spacing.sm },
  prevCivilite: { fontSize: 22, color: colors.text, fontWeight: '900' },
  prevName: { fontSize: 22, fontWeight: '900', color: colors.text, textAlign: 'center', letterSpacing: 0.5 },
  prevYears: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  prevSmallSpacer: { height: spacing.sm },
  prevSectionDivider: { height: 1, backgroundColor: colors.borderLight, marginVertical: spacing.md },
  prevSectionLabel: {
    fontSize: 10, fontWeight: '700', color: colors.primary,
    textAlign: 'center', letterSpacing: 2, textTransform: 'uppercase',
    marginBottom: 4,
  },
  prevInfoDate: { fontSize: 20, fontWeight: '900', color: colors.text, textAlign: 'center', textTransform: 'capitalize', letterSpacing: 0.2 },
  prevMosqueBlock: {
    flexDirection: 'row', alignItems: 'stretch',
    marginTop: spacing.sm,
  },
  prevMosqueLine: {
    width: 3, borderRadius: 2,
    backgroundColor: colors.primary,
  },
  prevMosqueName: { fontSize: 14, fontWeight: '700', color: colors.text },
  prevMosqueAddr: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  prevBurialBlock: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, marginTop: spacing.xs,
  },
  prevBurialLine: { fontSize: 13, color: colors.textSecondary },
  prevCommentaireBlock: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    width: '100%',
  },
  prevCommentaire: {
    fontSize: 12,
    color: colors.textSecondary,
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 18,
  },

  // Dua
  prevDuaBlock: {
    backgroundColor: colors.background,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  prevOrnament: {
    fontSize: 16, color: colors.primary,
    textAlign: 'center', marginBottom: spacing.sm,
  },
  prevDuaAr: {
    fontSize: 19, color: colors.primary, fontWeight: '700',
    textAlign: 'center', width: '100%',
    marginBottom: spacing.sm, lineHeight: 30,
  },
  prevDuaFr: {
    fontSize: 12, color: colors.textSecondary, fontStyle: 'italic',
    textAlign: 'center', lineHeight: 18,
  },

  // Footer
  prevFooter: {
    backgroundColor: colors.primary,
    paddingVertical: 6,
    alignItems: 'center',
  },
  prevFooterText: { fontSize: 10, color: 'rgba(255,255,255,0.7)', letterSpacing: 1.5, textTransform: 'uppercase' },

  // ── Country Picker ──
  cpOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  cpSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    padding: spacing.lg, paddingBottom: spacing.xxl,
  },
  cpHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: spacing.md },
  cpTitle: { fontSize: 17, fontWeight: '700', color: colors.text, textAlign: 'center', marginBottom: spacing.md },
  cpSearchRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  cpSearchInput: { flex: 1, fontSize: 15, color: colors.text, paddingVertical: 4 },
  cpItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: spacing.md, paddingHorizontal: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  },
  cpItemSelected: { backgroundColor: colors.primaryDim },
  cpItemText: { fontSize: 15, color: colors.text },
  cpItemTextSelected: { color: colors.primary, fontWeight: '700' },

  // ── Year Picker ──
  ypOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' },
  ypSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    padding: spacing.lg, paddingBottom: spacing.xxl ?? 40,
  },
  ypHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: spacing.md },
  ypTitle: { fontSize: 17, fontWeight: '700', color: colors.text, textAlign: 'center', marginBottom: spacing.md },
  ypItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: spacing.md, paddingHorizontal: spacing.lg,
    borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  },
  ypItemSelected: { backgroundColor: colors.primaryDim },
  ypItemText: { fontSize: 18, fontWeight: '500', color: colors.text },
  ypItemTextSelected: { color: colors.primary, fontWeight: '700' },
});
