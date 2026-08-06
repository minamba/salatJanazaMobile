import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, TouchableWithoutFeedback,
  FlatList, TextInput, ScrollView, ActivityIndicator, Image, ImageBackground, Switch,
  KeyboardAvoidingView, Platform, useWindowDimensions, StatusBar, Keyboard,
} from 'react-native';
import { SafeAreaView, SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius } from '../../utils/theme';
import { COUNTRIES } from '../../utils/countries';
import { useTranslation } from 'react-i18next';
import { detectCountryFromIP } from '../../utils/detectCountry';
import { parseNomDefunt } from '../../utils/text';
import { commentaireVisibleForLang, getCountryName, getCountriesForLang, isoFromName } from '../../utils/countryNames';
import { useShowCountryName } from '../../utils/preferences';

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

function CountryPickerModal({ visible, selected, onSelect, onClose, lang }) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!visible) setSearch('');
  }, [visible]);

  const allCountries = getCountriesForLang(lang ?? 'fr');
  const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const filtered = search.trim()
    ? allCountries.filter(c => norm(c.name).includes(norm(search)))
    : allCountries;

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
              keyExtractor={item => item.iso}
              renderItem={({ item }) => {
                const isSel = item.iso === selected;
                return (
                  <TouchableOpacity
                    style={[styles.cpItem, isSel && styles.cpItemSelected]}
                    onPress={() => { onSelect(item.iso); onClose(); }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.cpItemText, isSel && styles.cpItemTextSelected]}>{item.name}</Text>
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

import { getDateLocale } from '../../utils/dateLocale';

const PREVIEW_LANGS = [
  { code: 'fr', flag: '🇫🇷' }, { code: 'en', flag: '🇬🇧' }, { code: 'ar', flag: '🇸🇦' },
  { code: 'bm', flag: '🇲🇱' }, { code: 'nl', flag: '🇧🇪' }, { code: 'tr', flag: '🇹🇷' },
  { code: 'de', flag: '🇩🇪' }, { code: 'es', flag: '🇪🇸' }, { code: 'it', flag: '🇮🇹' },
  { code: 'pt', flag: '🇵🇹' }, { code: 'ru', flag: '🇷🇺' }, { code: 'ja', flag: '🇯🇵' },
  { code: 'ko', flag: '🇰🇷' }, { code: 'ms', flag: '🇲🇾' }, { code: 'id', flag: '🇮🇩' },
  { code: 'ur', flag: '🇵🇰' }, { code: 'bn', flag: '🇧🇩' },
];

function isoToFlag(iso) {
  if (!iso || iso.length < 2) return null;
  const A = 0x1F1E6;
  const code = iso.toUpperCase();
  return String.fromCodePoint(A + code.charCodeAt(0) - 65, A + code.charCodeAt(1) - 65);
}

// ─── Format de l'affiche partagée ────────────────────────────────────────────
//
// L'image sortait auparavant sans dimension imposée : `captureRef` rendait
// alors « the original pixel size », c'est-à-dire la largeur de la carte à
// l'écran multipliée par la densité du téléphone. Trois variables se
// multipliaient — largeur d'écran, densité, réglage de taille de police — et
// deux appareils produisaient des affiches très différentes.
//
// LA RÉFÉRENCE EST L'IPHONE 15 PRO MAX
// ------------------------------------
// C'est le rendu jugé bon. Son écran fait 430 points de large ; la carte, dans
// son conteneur à 16 points de marge de chaque côté, en occupait donc 398. Sa
// densité est de 3, d'où une image de 1194 pixels de large.
//
// Ces deux nombres sont désormais imposés à tous les appareils : la carte est
// mise en page à 398 points quel que soit l'écran, et l'export est calculé à
// densité 3. Un Samsung produit donc exactement la même affiche qu'un iPhone.
//
// LA HAUTEUR RESTE NATURELLE, ET LE FOND TRANSPARENT
// --------------------------------------------------
// Aucun format imposé à l'affiche elle-même : elle garde ses proportions
// propres et sa hauteur suit son contenu. Le PNG conserve la transparence
// autour de ses coins arrondis.
//
// La largeur a été portée de 398 à 440 points : l'affiche est un peu plus
// large, et comme le texte revient à la ligne moins souvent, elle est aussi
// un peu plus courte — donc moins rognée, et moins gourmande en marges.
const LARGEUR_CARTE = 440;      // points logiques — identique sur tout appareil
const DENSITE_EXPORT = 3;       // la densité de l'appareil de référence

// POURQUOI L'IMAGE EST PLUS LARGE QUE L'AFFICHE
// ---------------------------------------------
// WhatsApp et Telegram n'affichent une image en entier dans la conversation
// que si elle n'est pas plus haute que 5 pour 4. Au-delà, ils en montrent une
// bande centrale et il faut appuyer dessus pour voir le reste.
//
// Or l'affiche est bien plus haute que ça : mesurée à 398 points de large,
// même l'annonce la plus courte tombe à 0,71, et une annonce avec commentaire
// descend vers 0,50. Elle est donc rognée dans tous les cas.
//
// Réduire la taille n'y change rien : c'est le RAPPORT qui décide, pas le
// nombre de pixels. La seule façon de tout montrer est d'élargir l'image.
// Ces marges sont TRANSPARENTES — aucun fond n'est ajouté, l'affiche garde ses
// coins détourés et flotte simplement au milieu.
const RATIO_MINIMUM = 4 / 5;

// Une respiration TRANSPARENTE au-dessus et en dessous de l'affiche.
//
// Sans elle, la carte touche exactement les bords haut et bas de l'image : le
// moindre arrondi de bulle ou rognage d'un pixel par la messagerie mord alors
// sur l'en-tête et sur le pied de page. Ces points ne se voient pas — ils sont
// transparents — mais ils garantissent que rien du dessin ne soit jamais au
// contact du bord.
const MARGE_VERTICALE = 14;

// Le sous-titre « Annonce de décès » sous le nom du service, dans l'en-tête.
// Masqué à l'essai : un seul mot à changer pour le rétablir.
const AFFICHER_SOUS_TITRE = false;

/**
 * Les options de capture pour une carte d'une hauteur donnée (en points).
 *
 * La hauteur est TOUJOURS transmise avec la largeur : `captureRef` redimensionne
 * « from the View bound », et ne fournir que l'une des deux déformerait
 * l'affiche. Elle est mesurée à l'exécution, puisqu'elle dépend du contenu —
 * un nom long ou un commentaire allongent la carte.
 */
/** Hauteur totale de l'image : l'affiche plus ses respirations transparentes. */
const hauteurToile = (hauteurCarte) => hauteurCarte + MARGE_VERTICALE * 2;

/** Largeur de l'image, calculée pour que le rapport reste affichable en entier. */
const largeurToile = (hauteurCarte) =>
  Math.max(LARGEUR_CARTE, Math.round(hauteurToile(hauteurCarte) * RATIO_MINIMUM));

const optionsCapture = (hauteurCarte) => {
  // Pas encore mesurée : on n'impose rien plutôt que de demander une hauteur
  // de zéro, qui produirait une image vide. La capture retombe alors sur la
  // taille naturelle — moins régulière d'un appareil à l'autre, mais une
  // affiche correcte vaut mieux qu'un carré blanc.
  if (!hauteurCarte) return { format: 'png', quality: 1 };

  return {
    format: 'png',
    quality: 1,
    width: Math.round(largeurToile(hauteurCarte) * DENSITE_EXPORT),
    height: Math.round(hauteurToile(hauteurCarte) * DENSITE_EXPORT),
  };
};

const AnnouncementPreview = React.forwardRef(function AnnouncementPreview({ data, previewLang, showCommentaire = true, mosqueeIsoCode = null, showCountryName = true }, ref) {
  const { t: tGlobal, i18n } = useTranslation();
  const t = previewLang ? i18n.getFixedT(previewLang) : tGlobal;
  const { familleNom, nomDefunt, nomAnonyme, genre, mosqueeNom, mosqueeAdresse, date, hour, minute, birthYear, deathYear, country, locationFrance, showYears, commentaire } = data;

  const dateLocale = getDateLocale(previewLang ?? i18n.language);

  const parsedNom = parseNomDefunt(nomDefunt ?? '');
  const hasLastName = !!parsedNom.familleNom;
  const civilite = hasLastName
    ? (genre === 'femme' ? t('announcement.civility_female') : genre === 'enfant' ? t('announcement.civility_child') : t('announcement.civility_male'))
    : '';
  const nameDisplay = nomAnonyme ? null : (parsedNom.display || null);
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
    ? date.toLocaleDateString(dateLocale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
    : '___';
  const timeStr = `${String(hour ?? 12).padStart(2, '0')}h${String(minute ?? 0).padStart(2, '0')}`;
  const ageStr = (showYears && birthYear && deathYear) ? `${birthYear} – ${deathYear}` : null;
  const arabicDua = genre === 'femme'
    ? 'اللهم اغفر لها وارحمها وعافها واعف عنها'
    : 'اللهم اغفر له وارحمه وعافه واعف عنه';
  const countryIso = country?.length === 2 ? country : isoFromName(country);
  const countryDisplay = countryIso ? getCountryName(countryIso, previewLang) : country;
  const countryFr = countryIso ? getCountryName(countryIso, 'fr') : country;
  const prep = getPreposition(countryFr);
  const burialPrefix = t(`announcement.burial_prep_${prep}`);

  return (
    <View ref={ref} style={styles.preview} collapsable={false}>
      {/* Header */}
      <View style={styles.prevHeader}>
        <Image source={ACC1_IMG} style={styles.prevHeaderIcon} resizeMode="contain" />
        {/* `justifyContent: center` centre le titre sur la hauteur de l'en-tête.
            Sans lui, le bloc s'étire et le texte se cale en haut dès que le
            drapeau du pays rend la ligne plus haute que le titre seul. */}
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <Text allowFontScaling={false} style={styles.prevTitle}>Salat Janaza</Text>
          {/* Sous-titre masqué à l'essai. Repasser AFFICHER_SOUS_TITRE à true
              le fait revenir — le libellé traduit reste en place. */}
          {AFFICHER_SOUS_TITRE && (
            <Text allowFontScaling={false} style={styles.prevTitleSub}>{t('announcement.death_announcement')}</Text>
          )}
        </View>
        {mosqueeIsoCode ? (
          <View style={styles.prevHeaderCountry}>
            <Text allowFontScaling={false} style={styles.prevHeaderFlag}>{isoToFlag(mosqueeIsoCode)}</Text>
            {showCountryName && <Text allowFontScaling={false} style={styles.prevHeaderCountryName}>{getCountryName(mosqueeIsoCode, previewLang)}</Text>}
          </View>
        ) : null}
      </View>

      {/* Invocation */}
      <ImageBackground source={MOTIF_IMG} resizeMode="cover" style={styles.prevInvocationBlock} imageStyle={styles.prevMotif}>
        <Image source={INVOCATION_IMG} style={styles.prevInvocationImg} resizeMode="contain" />
      </ImageBackground>

      <View style={styles.prevDivider} />

      {/* Body */}
      <ImageBackground source={MOTIF_IMG} resizeMode="cover" style={styles.prevBody} imageStyle={styles.prevMotif}>
        <Text allowFontScaling={false} style={styles.prevFamilyLine}>
          {nomAnonyme
            ? t('announcement.anonymous_announces')
            : (() => {
                const names = familleNom
                  ? familleNom.split(',').map(s => s.trim()).filter(Boolean)
                  : [];
                if (names.length === 0) return t('announcement.family_announces_unnamed');
                const display = names.map(n => n.toUpperCase()).join(' & ');
                return t(
                  names.length > 1
                    ? 'announcement.family_announces_named_plural'
                    : 'announcement.family_announces_named',
                  { name: display }
                );
              })()}
        </Text>

        <View style={styles.prevNameBlock}>
          {nomAnonyme ? (
            <>
              <Text allowFontScaling={false} style={styles.prevName}>{anonymousLabel}</Text>
              <Text allowFontScaling={false} style={styles.prevYears}>{anonymousSub}</Text>
            </>
          ) : (
            <Text allowFontScaling={false} style={styles.prevName}>
              {civilite ? <Text allowFontScaling={false} style={styles.prevCivilite}>{civilite} </Text> : null}
              {nameDisplay ? nameDisplay.toUpperCase() : ''}
            </Text>
          )}
          {ageStr && <Text allowFontScaling={false} style={styles.prevYears}>{ageStr}</Text>}
          {!!commentaire && showCommentaire && (
            <View style={styles.prevCommentaireBlock}>
              <Text allowFontScaling={false} style={styles.prevCommentaire}>{commentaire}</Text>
            </View>
          )}
        </View>

        <View style={styles.prevSectionDivider} />

        <Text allowFontScaling={false} style={styles.prevSectionLabel}>{t('announcement.prayer_section')}</Text>
        <Text allowFontScaling={false} style={styles.prevInfoDate}>{dateStr}  ·  {timeStr}</Text>

        <View style={styles.prevSmallSpacer} />

        <View style={styles.prevMosqueBlock}>
          <View style={styles.prevMosqueLine} />
          <View style={{ flex: 1, paddingLeft: spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="location" size={13} color={colors.primary} />
              <Text allowFontScaling={false} style={styles.prevMosqueName}>{mosqueeNom || '___'}</Text>
            </View>
            {!!mosqueeAdresse && <Text allowFontScaling={false} style={styles.prevMosqueAddr}>{mosqueeAdresse}</Text>}
          </View>
        </View>

        {!!countryDisplay && (
          <>
            <View style={styles.prevSmallSpacer} />
            <View style={styles.prevBurialBlock}>
              <Ionicons name="earth-outline" size={13} color={colors.primary} />
              <Text allowFontScaling={false} style={styles.prevBurialLine}>
                {`${burialPrefix} `}
                <Text allowFontScaling={false} style={{ fontWeight: '700', color: colors.text }}>
                  {`${countryDisplay}${locationFrance ? `, ${locationFrance}` : ''}`}
                </Text>
              </Text>
            </View>
          </>
        )}
      </ImageBackground>

      <View style={styles.prevDivider} />

      {/* Dua — sans ornement : le texte remonte d'autant. */}
      <View style={styles.prevDuaBlock}>
        <Text allowFontScaling={false} style={styles.prevDuaAr}>{arabicDua}</Text>
        <Text allowFontScaling={false} style={styles.prevDuaFr}>{t('announcement.dua')}</Text>
      </View>

      {/* Footer */}
      <View style={styles.prevFooter}>
        <Text allowFontScaling={false} style={styles.prevFooterText}>{t('announcement.website')}</Text>
      </View>
    </View>
  );
});

/**
 * L'affiche telle qu'elle sera partagée : la carte à 398 points, centrée sur
 * une toile juste assez large pour ne pas être rognée par les messageries.
 *
 * La toile n'a AUCUN fond : les marges sont transparentes, l'affiche garde ses
 * coins détourés. C'est aussi cette vue qu'on montre à l'écran — l'utilisateur
 * voit donc exactement ce que recevront ses contacts.
 *
 * `largeurAffichage` ne sert qu'au confort de l'aperçu : quand la toile dépasse
 * l'écran, on réduit l'affichage par une transformation posée sur le PARENT.
 * La vue capturée garde ses dimensions propres, et de toute façon la capture
 * impose sa taille de sortie.
 *
 * `onHauteur` remonte la hauteur mesurée : elle dépend du contenu, et l'appelant
 * en a besoin pour demander une capture aux bonnes proportions.
 */
const AfficheAPartager = React.forwardRef(function AfficheAPartager(
  { largeurAffichage, onHauteur, ...props }, ref
) {
  const [hauteurCarte, setHauteurCarte] = useState(0);

  // La réduction se calcule sur la TOILE et non sur la carte : c'est la toile
  // qui doit tenir dans l'écran, et elle est plus large.
  const largeurCible = hauteurCarte ? largeurToile(hauteurCarte) : LARGEUR_CARTE;
  const reduction = largeurAffichage && largeurAffichage < largeurCible
    ? largeurAffichage / largeurCible
    : 1;

  const mesurer = (e) => {
    const h = e.nativeEvent.layout.height;
    if (h && Math.abs(h - hauteurCarte) > 0.5) {
      setHauteurCarte(h);
      onHauteur?.(h);
    }
  };

  // ON NE FORCE JAMAIS UNE DIMENSION NON MESURÉE
  // --------------------------------------------
  // Une version précédente posait `height: hauteurCarte * reduction` sur le
  // conteneur. Or `hauteurCarte` vaut 0 au premier rendu, avant que `onLayout`
  // n'ait mesuré quoi que ce soit : le conteneur s'écrasait à zéro, la carte
  // n'était plus visible, donc jamais mesurée — et l'aperçu restait vide pour
  // toujours. Hauteur et largeur ne sont contraintes qu'une fois connues.
  const largeur = largeurCible;

  return (
    <View
      style={{
        width: largeur * reduction,
        // `undefined` tant que la mesure n'a pas eu lieu : le conteneur prend
        // alors la hauteur de son contenu, qui peut donc se mesurer.
        height: hauteurCarte ? hauteurToile(hauteurCarte) * reduction : undefined,
        alignSelf: 'center',
      }}
    >
      <View
        style={{
          width: largeur,
          // TOUJOURS un tableau, même à l'échelle 1.
          //
          // Le passer à `undefined` quand aucune réduction n'est nécessaire
          // faisait planter le rendu : au changement de langue, la hauteur de
          // la carte change, donc la réduction aussi, et la propriété
          // disparaissait d'un rendu à l'autre. React Native compare alors
          // l'ancienne valeur à `null` et appelle `processTransform(null)`, qui
          // fait « Cannot read property 'forEach' of null ». Une échelle de 1
          // ne coûte rien et garde la propriété présente en permanence.
          transform: [{ scale: reduction }],
          // Sans cette origine, la réduction se fait depuis le centre et la
          // carte se décale hors de son propre encombrement.
          transformOrigin: 'top left',
        }}
      >
        {/* La vue capturée : aucun fond, donc des marges transparentes —
            sur les côtés comme en haut et en bas. */}
        <View
          ref={ref}
          collapsable={false}
          style={{
            width: largeur,
            paddingVertical: MARGE_VERTICALE,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <View style={{ width: LARGEUR_CARTE }} onLayout={mesurer}>
            <AnnouncementPreview {...props} />
          </View>
        </View>
      </View>
    </View>
  );
});

// ─── Main Modal (2-step: form → preview) ──────────────────────────────────────

export default function AnnouncementGeneratorModal({ visible, onClose, onDataChange, onPublish, publishLabel, form, date, hour, minute, initialValues }) {
  const { t, i18n } = useTranslation();
  const { width: windowWidth } = useWindowDimensions();
  const [step, setStep] = useState('form');
  const [previewLang, setPreviewLang] = useState(() => i18n.language?.split('-')[0] ?? 'fr');
  useEffect(() => { setPreviewLang(i18n.language?.split('-')[0] ?? 'fr'); }, [i18n.language]);
  const [showYears, setShowYears] = useState(false);
  const [birthYear, setBirthYear] = useState(1950);
  const [deathYear, setDeathYear] = useState(CURRENT_YEAR);
  const [country, setCountry] = useState('');
  const [countryKnown, setCountryKnown] = useState(true);
  const [locationFrance, setLocationFrance] = useState('');
  const [commentaire, setCommentaire] = useState('');
  const [showBirth, setShowBirth] = useState(false);
  const [showDeath, setShowDeath] = useState(false);
  const [showCountry, setShowCountry] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [kbHeight, setKbHeight] = useState(0);
  const [mosqueeIsoCode, setMosqueeIsoCode] = useState(null);
  const [showCountryName] = useShowCountryName();

  const viewRef = useRef(null);
  // La hauteur de la carte, mesurée à l.exécution : elle dépend du contenu, et
  // la capture en a besoin pour garder les proportions.
  const [hauteurAffiche, setHauteurAffiche] = useState(0);

  useEffect(() => {
    if (!form?.mosqueeLatitude || !form?.mosqueeeLongitude) return;
    Location.reverseGeocodeAsync({ latitude: form.mosqueeLatitude, longitude: form.mosqueeeLongitude })
      .then(results => setMosqueeIsoCode(results?.[0]?.isoCountryCode ?? null))
      .catch(() => {});
  }, [form?.mosqueeLatitude, form?.mosqueeeLongitude]);

  const showCommentaire = commentaireVisibleForLang(mosqueeIsoCode, previewLang);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const show = Keyboard.addListener('keyboardDidShow', (e) => setKbHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKbHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  // Initialize state once on mount (remount via key= when item changes)
  useEffect(() => {
    // commentaire: prefer initialValues (read from item prop, always fresh) over form state (may be stale at mount)
    setCommentaire(initialValues?.commentaire !== undefined ? (initialValues.commentaire ?? '') : (form?.commentaire ?? ''));
    setLocationFrance(initialValues?.locationFrance ?? '');
    if (initialValues?.showYears) setShowYears(true);
    if (initialValues?.birthYear != null) setBirthYear(initialValues.birthYear);
    if (initialValues?.deathYear != null) setDeathYear(initialValues.deathYear);
    const known = initialValues?.countryKnown ?? true;
    setCountryKnown(known);
    const presetCountry = initialValues?.country;
    if (presetCountry) {
      setCountry(isoFromName(presetCountry) ?? presetCountry);
    } else if (known) {
      detectCountryFromIP().then(c => { if (c) setCountry(isoFromName(c) ?? c); });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset to form step when closing (not state — state persists across open/close)
  useEffect(() => {
    if (!visible) setStep('form');
  }, [visible]);

  const rawNom = form?.nomAnonyme ? '' : (form?.nomDefunt ?? '');
  const familleNom = parseNomDefunt(rawNom).familleNom;

  function handleClose() {
    const countryFr = country?.length === 2 ? (getCountryName(country, 'fr') ?? country) : country;
    onClose({ showYears, birthYear, deathYear, country: countryFr, countryKnown, locationFrance, commentaire });
  }

  const previewData = {
    familleNom,
    showYears,
    birthYear,
    deathYear,
    country: countryKnown ? country : null,
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
      const uri = await captureRef(viewRef, optionsCapture(hauteurAffiche));
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
    <Modal transparent animationType="slide" visible={visible} onRequestClose={handleClose}>
      <SafeAreaProvider>
      <SafeAreaView style={[styles.container, step === 'preview' && { justifyContent: 'flex-start' }]} edges={['top', 'bottom']}>

        {/* ── Step 1 : Form ── */}
        {step === 'form' && (
          <KeyboardAvoidingView
            style={styles.formSheet}
            behavior="padding"
          >
            <View style={styles.formHandle} />
            <View style={styles.formTopBar}>
              <TouchableOpacity onPress={handleClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
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
                    {showYears ? t('announcement.years_toggle_description') : t('announcement.years_toggle_off_description')}
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
                    <Text style={styles.formLabelOptional}>{t('announcement.optional')}</Text>
                  </View>
                  <TouchableOpacity style={styles.formPickerBtn} onPress={() => setShowBirth(true)} activeOpacity={0.7}>
                    <Ionicons name="calendar-outline" size={16} color={colors.textMuted} />
                    <Text style={[styles.formPickerText, { flex: 1 }]}>{birthYear}</Text>
                    <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
                  </TouchableOpacity>

                  <View style={styles.formLabelRow}>
                    <Text style={[styles.formLabel, { marginTop: 0, marginBottom: 0 }]}>{t('announcement.death_year')}</Text>
                    <Text style={styles.formLabelOptional}>{t('announcement.optional')}</Text>
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
                <Text style={styles.formLabelOptional}>{t('announcement.optional')}</Text>
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
              <View style={styles.toggleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.toggleLabel}>{t('announcement.country')}</Text>
                  <Text style={styles.toggleDesc}>
                    {countryKnown ? t('announcement.country_toggle_on') : t('announcement.country_toggle_off')}
                  </Text>
                </View>
                <Switch
                  value={countryKnown}
                  onValueChange={setCountryKnown}
                  trackColor={{ false: '#9E9E9E', true: colors.primary }}
                  ios_backgroundColor="#9E9E9E"
                  thumbColor={colors.white}
                />
              </View>
              {countryKnown && (
                <TouchableOpacity style={styles.formPickerBtn} onPress={() => setShowCountry(true)} activeOpacity={0.7}>
                  <Ionicons name="earth-outline" size={16} color={colors.textMuted} />
                  <Text style={[styles.formPickerText, { flex: 1 }]}>{(country?.length === 2 ? (getCountryName(country, previewLang) ?? country) : country) || t('announcement.country_placeholder')}</Text>
                  <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
                </TouchableOpacity>
              )}

              {/* Lieu */}
              <View style={styles.formLabelRow}>
                <Text style={[styles.formLabel, { marginTop: 0, marginBottom: 0 }]}>{t('announcement.location')}</Text>
                <Text style={styles.formLabelOptional}>{t('announcement.optional')}</Text>
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
                onDataChange?.({ birthYear, deathYear, country: countryKnown ? country : null, locationFrance, showYears, commentaire, countryKnown });
                setStep('preview');
              }} activeOpacity={0.8}>
                <Ionicons name="eye-outline" size={18} color={colors.primary} />
                <Text style={[styles.formBtnText, styles.formBtnTextOutline]}>{t('announcement.preview')}</Text>
              </TouchableOpacity>

              {onPublish && (
                <TouchableOpacity style={[styles.formBtn, { marginTop: spacing.sm }]} onPress={() => {
                  const data = { birthYear, deathYear, country: countryKnown ? country : null, locationFrance, showYears, commentaire, countryKnown };
                  onDataChange?.(data);
                  onPublish(data);
                }} activeOpacity={0.8}>
                  <Ionicons name={publishLabel ? 'checkmark-outline' : 'megaphone-outline'} size={18} color={colors.white} />
                  <Text style={styles.formBtnText}>{publishLabel ?? t('declare.publish')}</Text>
                </TouchableOpacity>
              )}
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
            <ScrollView style={{ flex: 1 }} stickyHeaderIndices={[0]}>
              <View style={styles.langBar}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ height: 44 }} contentContainerStyle={{ paddingHorizontal: spacing.sm, alignItems: 'center', height: 44 }}>
                  {PREVIEW_LANGS.map(({ code, flag }) => (
                    <TouchableOpacity key={code} onPress={() => setPreviewLang(code)} style={[styles.langBtn, previewLang === code && styles.langBtnActive]} hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}>
                      <Text style={styles.langFlag}>{flag}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
              <View style={{ padding: spacing.md }}>
                <AfficheAPartager ref={viewRef} largeurAffichage={windowWidth - spacing.md * 2} onHauteur={setHauteurAffiche} data={previewData} previewLang={previewLang} showCommentaire={showCommentaire} mosqueeIsoCode={mosqueeIsoCode} showCountryName={showCountryName} />
              </View>
            </ScrollView>
          </View>
        )}
      </SafeAreaView>

      {/* Sub-pickers (rendered outside sheets so they float above) */}
      <YearPickerModal visible={showBirth} selected={birthYear} onSelect={setBirthYear} onClose={() => setShowBirth(false)} title={t('announcement.year_birth_title')} />
      <YearPickerModal visible={showDeath} selected={deathYear} onSelect={setDeathYear} onClose={() => setShowDeath(false)} title={t('announcement.year_death_title')} />
      <CountryPickerModal visible={showCountry} selected={country} onSelect={setCountry} onClose={() => setShowCountry(false)} lang={previewLang} />
      </SafeAreaProvider>
    </Modal>
  );
}

// ─── JanazaShareModal (aperçu direct depuis le fil / les cards) ──────────────

export function JanazaShareModal({ visible, onClose, janaza }) {
  const { t, i18n } = useTranslation();
  const { width: windowWidth } = useWindowDimensions();
  const [previewLang, setPreviewLang] = useState(() => i18n.language?.split('-')[0] ?? 'fr');
  useEffect(() => { setPreviewLang(i18n.language?.split('-')[0] ?? 'fr'); }, [i18n.language]);
  const [mosqueeIsoCode, setMosqueeIsoCode] = useState(null);
  const [showCountryName] = useShowCountryName();
  useEffect(() => {
    if (!janaza?.latitude || !janaza?.longitude) return;
    Location.reverseGeocodeAsync({ latitude: janaza.latitude, longitude: janaza.longitude })
      .then(results => setMosqueeIsoCode(results?.[0]?.isoCountryCode ?? null))
      .catch(() => {});
  }, [janaza?.latitude, janaza?.longitude]);
  const showCommentaire = commentaireVisibleForLang(mosqueeIsoCode, previewLang);
  const [sharing, setSharing] = useState(false);
  const [topInset, setTopInset] = useState(Platform.OS === 'ios' ? 59 : 24);
  const viewRef = useRef(null);
  // La hauteur de la carte, mesurée à l.exécution : elle dépend du contenu, et
  // la capture en a besoin pour garder les proportions.
  const [hauteurAffiche, setHauteurAffiche] = useState(0);
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
  const familleNom = parseNomDefunt(rawNom).familleNom;

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
    hour: date?.getUTCHours() ?? 12,
    minute: date?.getUTCMinutes() ?? 0,
  };

  async function handleShare() {
    try {
      setSharing(true);
      const uri = await captureRef(viewRef, optionsCapture(hauteurAffiche));
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
        <ScrollView style={{ flex: 1 }} stickyHeaderIndices={[0]}>
          <View style={styles.langBar}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ height: 44 }} contentContainerStyle={{ paddingHorizontal: spacing.sm, alignItems: 'center', height: 44 }}>
              {PREVIEW_LANGS.map(({ code, flag }) => (
                <TouchableOpacity key={code} onPress={() => setPreviewLang(code)} style={[styles.langBtn, previewLang === code && styles.langBtnActive]} hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}>
                  <Text style={styles.langFlag}>{flag}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
          <View style={{ padding: spacing.md }}>
            <AfficheAPartager ref={viewRef} largeurAffichage={windowWidth - spacing.md * 2} onHauteur={setHauteurAffiche} data={previewData} previewLang={previewLang} showCommentaire={showCommentaire} mosqueeIsoCode={mosqueeIsoCode} showCountryName={showCountryName} />
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── ComplementaryInfoModal ───────────────────────────────────────────────────

export function ComplementaryInfoModal({ visible, onClose, onSubmit, initialValues, form, date, hour, minute }) {
  const { t, i18n } = useTranslation();
  const { width: windowWidth } = useWindowDimensions();
  const [previewLang, setPreviewLang] = useState(() => i18n.language?.split('-')[0] ?? 'fr');
  useEffect(() => { setPreviewLang(i18n.language?.split('-')[0] ?? 'fr'); }, [i18n.language]);
  const [step, setStep] = useState('form');
  const [sharing, setSharing] = useState(false);
  const [showYears, setShowYears] = useState(false);
  const [birthYear, setBirthYear] = useState(1950);
  const [deathYear, setDeathYear] = useState(CURRENT_YEAR);
  const [country, setCountry] = useState('');
  const [countryKnown, setCountryKnown] = useState(true);
  const [locationFrance, setLocationFrance] = useState('');
  const [commentaire, setCommentaire] = useState('');
  const [showBirth, setShowBirth] = useState(false);
  const [showDeath, setShowDeath] = useState(false);
  const [showCountry, setShowCountry] = useState(false);
  const scrollRef = useRef(null);
  const viewRef = useRef(null);
  // La hauteur de la carte, mesurée à l.exécution : elle dépend du contenu, et
  // la capture en a besoin pour garder les proportions.
  const [hauteurAffiche, setHauteurAffiche] = useState(0);
  const [mosqueeIsoCode, setMosqueeIsoCode] = useState(null);
  const [showCountryName] = useShowCountryName();
  useEffect(() => {
    const lat = form?.mosqueeLatitude;
    const lon = form?.mosqueeLongitude ?? form?.mosqueeeLongitude ?? null;
    if (lat && lon) {
      Location.reverseGeocodeAsync({ latitude: lat, longitude: lon })
        .then(results => setMosqueeIsoCode(results?.[0]?.isoCountryCode ?? null))
        .catch(() => {});
    } else if (form?.mosqueeAdresse) {
      Location.geocodeAsync(form.mosqueeAdresse)
        .then(locs => locs?.[0]
          ? Location.reverseGeocodeAsync({ latitude: locs[0].latitude, longitude: locs[0].longitude })
          : null)
        .then(results => { if (results?.[0]) setMosqueeIsoCode(results[0].isoCountryCode ?? null); })
        .catch(() => {});
    }
  }, [form?.mosqueeLatitude, form?.mosqueeLongitude, form?.mosqueeeLongitude, form?.mosqueeAdresse]);
  const showCommentaire = commentaireVisibleForLang(mosqueeIsoCode, previewLang);

  const rawNom = form?.nomAnonyme ? '' : (form?.nomDefunt ?? '');
  const familleNom = parseNomDefunt(rawNom).familleNom;

  function handleClose() {
    const countryFr = country?.length === 2 ? (getCountryName(country, 'fr') ?? country) : country;
    onClose({ showYears, birthYear, deathYear, country: countryFr, countryKnown, locationFrance, commentaire });
  }

  const previewData = {
    familleNom,
    showYears,
    birthYear,
    deathYear,
    country: countryKnown ? country : null,
    locationFrance,
    commentaire,
    genre: form?.genre ?? 'homme',
    nomDefunt: form?.nomDefunt ?? '',
    nomAnonyme: form?.nomAnonyme ?? false,
    mosqueeNom: form?.mosqueeNom ?? '',
    mosqueeAdresse: form?.mosqueeAdresse ?? '',
    date,
    hour,
    minute,
  };

  async function handleShare() {
    try {
      setSharing(true);
      const uri = await captureRef(viewRef, optionsCapture(hauteurAffiche));
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

  // Initialize state once on mount (remount via key= when import/item changes)
  useEffect(() => {
    setShowYears(initialValues?.showYears ?? false);
    setBirthYear(initialValues?.birthYear ?? 1950);
    setDeathYear(initialValues?.deathYear ?? CURRENT_YEAR);
    setLocationFrance(initialValues?.locationFrance ?? '');
    setCommentaire(initialValues?.commentaire ?? '');
    const known = initialValues?.countryKnown ?? true;
    setCountryKnown(known);
    if (initialValues?.country) {
      setCountry(isoFromName(initialValues.country) ?? initialValues.country);
    } else {
      setCountry('');
      if (known) detectCountryFromIP().then(c => { if (c) setCountry(isoFromName(c) ?? c); });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Return to form step on open (not state — state persists across open/close)
  useEffect(() => {
    if (visible) setStep('form');
  }, [visible]);

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={step === 'preview' ? () => setStep('form') : handleClose}>

      {/* ── Step 1 : Formulaire ── */}
      {step === 'form' && (
        <View style={styles.container}>
          <KeyboardAvoidingView
            style={styles.formSheet}
            behavior="padding"
            keyboardVerticalOffset={0}
          >
              <View style={styles.formHandle} />
              <View style={styles.formTopBar}>
                <TouchableOpacity onPress={handleClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close" size={22} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.formTitle}>{t('announcement.modal_title')}</Text>
                <View style={{ width: 22 }} />
              </View>

              <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: spacing.xl }}>
              <View style={styles.toggleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.toggleLabel}>{t('announcement.years_toggle')}</Text>
                  <Text style={styles.toggleDesc}>
                    {showYears ? t('announcement.years_toggle_description') : t('announcement.years_toggle_off_description')}
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
                    <Text style={styles.formLabelOptional}>{t('announcement.optional')}</Text>
                  </View>
                  <TouchableOpacity style={styles.formPickerBtn} onPress={() => setShowBirth(true)} activeOpacity={0.7}>
                    <Ionicons name="calendar-outline" size={16} color={colors.textMuted} />
                    <Text style={[styles.formPickerText, { flex: 1 }]}>{birthYear}</Text>
                    <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
                  </TouchableOpacity>

                  <View style={styles.formLabelRow}>
                    <Text style={styles.formLabel}>{t('announcement.death_year')}</Text>
                    <Text style={styles.formLabelOptional}>{t('announcement.optional')}</Text>
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
                <Text style={styles.formLabelOptional}>{t('announcement.optional')}</Text>
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

              <View style={styles.toggleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.toggleLabel}>{t('announcement.country')}</Text>
                  <Text style={styles.toggleDesc}>
                    {countryKnown ? t('announcement.country_toggle_on') : t('announcement.country_toggle_off')}
                  </Text>
                </View>
                <Switch
                  value={countryKnown}
                  onValueChange={setCountryKnown}
                  trackColor={{ false: '#9E9E9E', true: colors.primary }}
                  ios_backgroundColor="#9E9E9E"
                  thumbColor={colors.white}
                />
              </View>
              {countryKnown && (
                <TouchableOpacity style={styles.formPickerBtn} onPress={() => setShowCountry(true)} activeOpacity={0.7}>
                  <Ionicons name="earth-outline" size={16} color={colors.textMuted} />
                  <Text style={[styles.formPickerText, { flex: 1, color: country ? colors.text : colors.textMuted }]}>
                    {(country?.length === 2 ? (getCountryName(country, previewLang) ?? country) : country) || t('announcement.country_placeholder')}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
                </TouchableOpacity>
              )}

              {countryKnown && (
                <>
                  <View style={styles.formLabelRow}>
                    <Text style={[styles.formLabel, { marginTop: 0, marginBottom: 0 }]}>{t('announcement.location')}</Text>
                    <Text style={styles.formLabelOptional}>{t('announcement.optional')}</Text>
                  </View>
                  <View style={styles.formInputRow}>
                    <Ionicons name="location-outline" size={16} color={colors.textMuted} style={{ marginRight: spacing.sm }} />
                    <TextInput
                      style={styles.formInput}
                      value={locationFrance}
                      onChangeText={setLocationFrance}
                      placeholder={t('announcement.location_placeholder')}
                      placeholderTextColor={colors.textMuted}
                      onFocus={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150)}
                    />
                  </View>
                </>
              )}

              <TouchableOpacity style={[styles.formBtn, styles.formBtnOutline]} onPress={() => setStep('preview')} activeOpacity={0.8}>
                <Ionicons name="eye-outline" size={18} color={colors.primary} />
                <Text style={[styles.formBtnText, styles.formBtnTextOutline]}>{t('announcement.preview')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.formBtn, { marginTop: spacing.sm }]}
                onPress={() => {
                  const countryFr = country?.length === 2 ? (getCountryName(country, 'fr') ?? country) : country;
                  onSubmit?.({ birthYear, deathYear, country: countryKnown ? countryFr : null, locationFrance, showYears, commentaire, countryKnown });
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="megaphone-outline" size={18} color={colors.white} />
                <Text style={styles.formBtnText}>{t('declare.publish')}</Text>
              </TouchableOpacity>
              </ScrollView>
          </KeyboardAvoidingView>
        </View>
      )}

      {/* ── Step 2 : Prévisualisation ── */}
      {step === 'preview' && (
        <SafeAreaProvider>
          <SafeAreaView style={[styles.container, { justifyContent: 'flex-start' }]} edges={['top', 'bottom']}>
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
              <ScrollView style={{ flex: 1 }} stickyHeaderIndices={[0]}>
                <View style={styles.langBar}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ height: 44 }} contentContainerStyle={{ paddingHorizontal: spacing.sm, alignItems: 'center', height: 44 }}>
                    {PREVIEW_LANGS.map(({ code, flag }) => (
                      <TouchableOpacity key={code} onPress={() => setPreviewLang(code)} style={[styles.langBtn, previewLang === code && styles.langBtnActive]} hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}>
                        <Text style={styles.langFlag}>{flag}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
                <View style={{ padding: spacing.md }}>
                  <AfficheAPartager ref={viewRef} largeurAffichage={windowWidth - spacing.md * 2} onHauteur={setHauteurAffiche} data={previewData} previewLang={previewLang} showCommentaire={showCommentaire} mosqueeIsoCode={mosqueeIsoCode} showCountryName={showCountryName} />
                </View>
              </ScrollView>
            </View>
          </SafeAreaView>
        </SafeAreaProvider>
      )}

      <YearPickerModal visible={showBirth} selected={birthYear} onSelect={setBirthYear} onClose={() => setShowBirth(false)} title={t('announcement.year_birth_title')} />
      <YearPickerModal visible={showDeath} selected={deathYear} onSelect={setDeathYear} onClose={() => setShowDeath(false)} title={t('announcement.year_death_title')} />
      <CountryPickerModal visible={showCountry} selected={country} onSelect={setCountry} onClose={() => setShowCountry(false)} lang={previewLang} />
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
  // Logo et titre réduits : l'en-tête prend moins de hauteur, ce qui joue aussi
  // sur le rapport de l'image — une affiche plus courte demande moins de marges
  // pour ne pas être rognée par les messageries.
  prevHeaderIcon: { width: 30, height: 30, alignSelf: 'center' },
  prevHeaderCountry: { alignItems: 'center' },
  prevHeaderFlag: { fontSize: 26, lineHeight: 30 },
  prevHeaderCountryName: { fontSize: 9, color: 'rgba(255,255,255,0.85)', marginTop: 2, textAlign: 'center', letterSpacing: 0.3 },
  prevTitle: { fontSize: 14, fontWeight: '800', color: colors.white, letterSpacing: 0.3 },
  prevTitleSub: { fontSize: 10, color: 'rgba(255,255,255,0.75)', letterSpacing: 0.5, marginTop: 1 },
  prevInvocationBlock: {
    alignItems: 'center',
    paddingVertical: 6,
    backgroundColor: colors.white,
  },
  // La calligraphie, réduite pour raccourcir le bloc.
  // `resizeMode="contain"` est déjà posé sur l'Image : baisser la hauteur ne
  // déforme donc rien, la largeur suit d'elle-même à l'intérieur des 85 %.
  prevInvocationImg: { width: '85%', height: 54 },
  prevDivider: { height: 2, backgroundColor: colors.primary },
  prevBody: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.white,
  },
  prevMotif: {
    opacity: 1,
  },
  // Espacements verticaux resserrés : c'est la hauteur de l'affiche qui décide
  // de la largeur des marges transparentes, donc de la place qu'elle occupe
  // dans une conversation. Chaque point gagné en hauteur en fait gagner sur
  // les côtés.
  prevFamilyLine: {
    fontSize: 14, color: colors.textSecondary, lineHeight: 19, marginBottom: spacing.sm,
    textAlign: 'center',
  },
  prevNameBlock: { alignItems: 'center', marginBottom: 4 },
  prevCivilite: { fontSize: 22, color: colors.text, fontWeight: '900' },
  prevName: { fontSize: 22, fontWeight: '900', color: colors.text, textAlign: 'center', letterSpacing: 0.5 },
  prevYears: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  prevSmallSpacer: { height: 6 },
  prevSectionDivider: { height: 1, backgroundColor: colors.borderLight, marginVertical: 10 },
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
    paddingVertical: 10,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
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
    // Le texte touchait le bas de la carte, d'autant que les coins arrondis
    // mordent dessus. Une marge des deux côtés le décolle du bord.
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
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

  // ── Language selector bar ──
  langBar: {
    height: 44,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  langBtn: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'transparent',
    marginHorizontal: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  langBtnActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryDim,
  },
  langFlag: {
    fontSize: 20,
    lineHeight: 24,
  },
});
