import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, KeyboardAvoidingView,
  Platform, Switch, Keyboard, ActivityIndicator, Image,
  Modal, TouchableWithoutFeedback, FlatList, Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import AnnouncementGeneratorModal, { ComplementaryInfoModal } from './AnnouncementGenerator';
import { capitalizeFirst } from '../../utils/text';
import { searchMosquesByNameOSM } from '../../utils/mosqueSearch';

const GENRE_IMAGES = {
  homme: require('../../../assets/icons/homme.png'),
  femme: require('../../../assets/icons/femme.png'),
  enfant: require('../../../assets/icons/enfant.png'),
};
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography } from '../../utils/theme';
import apiClient from '../../lib/api/apiClient';
import { useTranslation } from 'react-i18next';

const EMPTY_FORM = {
  mosqueeId: '',
  mosqueeNom: '',
  mosqueeAdresse: '',
  mosqueeLatitude: null,
  mosqueeLongitude: null,
  genre: 'homme',
  nomDefunt: '',
  dateHeure: '',
  nomAnonyme: false,
  commentaire: '',
};

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);
const CAL_LOCALE_MAP = { fr: 'fr-FR', en: 'en-US', ar: 'ar-SA' };

function CalendarModal({ visible, selectedDate, onSelect, onClose }) {
  const { i18n } = useTranslation();
  const dateLocale = CAL_LOCALE_MAP[i18n.language?.split('-')[0]] ?? 'fr-FR';
  const today = new Date();
  const [viewYear, setViewYear] = useState(selectedDate?.getFullYear() ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(selectedDate?.getMonth() ?? today.getMonth());
  const dayNames = Array.from({ length: 7 }, (_, i) =>
    new Date(2025, 0, 6 + i).toLocaleDateString(dateLocale, { weekday: 'short' })
  );
  const monthYearLabel = (() => {
    const label = new Date(viewYear, viewMonth, 1).toLocaleDateString(dateLocale, { month: 'long', year: 'numeric' });
    return label.charAt(0).toUpperCase() + label.slice(1);
  })();

  const offset = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells = [...Array(offset).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  }

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.calOverlay}>
          <TouchableWithoutFeedback>
            <View style={styles.calBox}>
              <View style={styles.calHeader}>
                <TouchableOpacity onPress={prevMonth} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name="chevron-back" size={22} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.calMonthTitle}>{monthYearLabel}</Text>
                <TouchableOpacity onPress={nextMonth} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name="chevron-forward" size={22} color={colors.text} />
                </TouchableOpacity>
              </View>
              <View style={styles.calDayNamesRow}>
                {dayNames.map((d, i) => <Text key={i} style={styles.calDayName}>{d}</Text>)}
              </View>
              <View style={styles.calGrid}>
                {cells.map((day, i) => {
                  const isSelected = selectedDate && day === selectedDate.getDate()
                    && viewMonth === selectedDate.getMonth() && viewYear === selectedDate.getFullYear();
                  const isToday = day === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear();
                  return (
                    <TouchableOpacity
                      key={i}
                      style={[styles.calCell, isSelected && styles.calCellSelected, isToday && !isSelected && styles.calCellToday]}
                      onPress={() => day && onSelect(new Date(viewYear, viewMonth, day))}
                      disabled={!day}
                      activeOpacity={0.7}
                    >
                      {day ? (
                        <Text style={[styles.calCellText, isSelected && styles.calCellTextSelected, isToday && !isSelected && styles.calCellTextToday]}>
                          {day}
                        </Text>
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

function ComboBoxModal({ visible, items, selected, onSelect, onClose, title }) {
  const { i18n } = useTranslation();
  const fmtN = (n) => i18n.language?.startsWith('ar')
    ? n.toLocaleString('ar-SA', { minimumIntegerDigits: 2 })
    : String(n).padStart(2, '0');
  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.comboOverlay}>
          <TouchableWithoutFeedback>
            <View style={styles.comboSheet}>
              <View style={styles.comboHandle} />
              <Text style={styles.comboTitle}>{title}</Text>
              <FlatList
                data={items}
                keyExtractor={(item) => String(item)}
                renderItem={({ item }) => {
                  const isSelected = item === selected;
                  return (
                    <TouchableOpacity
                      style={[styles.comboItem, isSelected && styles.comboItemSelected]}
                      onPress={() => { onSelect(item); onClose(); }}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.comboItemText, isSelected && styles.comboItemTextSelected]}>
                        {fmtN(item)}
                      </Text>
                      {isSelected && <Ionicons name="checkmark" size={18} color={colors.primary} />}
                    </TouchableOpacity>
                  );
                }}
                showsVerticalScrollIndicator={false}
                style={{ maxHeight: 320 }}
                initialScrollIndex={Math.max(0, items.indexOf(selected))}
                getItemLayout={(_, index) => ({ length: 52, offset: 52 * index, index })}
              />
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

function SectionHeader({ icon, label }) {
  return (
    <View style={styles.sectionHeader}>
      <Ionicons name={icon} size={15} color={colors.textSecondary} />
      <Text style={styles.sectionTitle}>{label}</Text>
    </View>
  );
}


export default function DeclareScreen() {
  const { t, i18n } = useTranslation();
  const dateLocale = CAL_LOCALE_MAP[i18n.language?.split('-')[0]] ?? 'fr-FR';
  const fmtTime = (n) => i18n.language?.startsWith('ar')
    ? n.toLocaleString('ar-SA', { minimumIntegerDigits: 2 })
    : String(n).padStart(2, '0');
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);

  const GENRES = [
    { key: 'homme', label: t('declare.male') },
    { key: 'femme', label: t('declare.female') },
    { key: 'enfant', label: t('declare.child') },
  ];
  const apiUser = useSelector((state) => state.auth.apiUser);
  const janazaList = useSelector((state) => state.janazas.list);

  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importStatus, setImportStatus] = useState(null); // null | 'pending' | 'success' | 'error'
  const [importMessage, setImportMessage] = useState('');
  const [showImportVerify, setShowImportVerify] = useState(false);
  const [importTimeUnknown, setImportTimeUnknown] = useState(false);
  const importPollRef = useRef(null);
  const [mosqueSearch, setMosqueSearch] = useState('');
  const [mosqueResults, setMosqueResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showDrop, setShowDrop] = useState(false);

  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedHour, setSelectedHour] = useState(12);
  const [selectedMinute, setSelectedMinute] = useState(0);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showHourPicker, setShowHourPicker] = useState(false);
  const [showMinutePicker, setShowMinutePicker] = useState(false);
  const [showAnnouncement, setShowAnnouncement] = useState(false);
  const [showComplementaryInfo, setShowComplementaryInfo] = useState(false);
  const [announcementData, setAnnouncementData] = useState(null);
  // Recherche textuelle directe en DB, sans limite de rayon
  const searchDebounceRef = useRef(null);
  const latestQueryRef = useRef('');

  function set(field) {
    return (value) => setForm((f) => ({ ...f, [field]: value }));
  }

  function mapDbMosque(m) {
    const numericOsmId = m.osmId ? m.osmId.replace(/^(node|way|relation)_/, '') : null;
    return {
      id: m.osmId ? `osm_${m.osmId}` : `db_${m.id}`,
      _dbId: m.id,
      osmId: numericOsmId,
      nom: m.nom,
      adresse: m.adresse ?? '',
      latitude: m.latitude,
      longitude: m.longitude,
      source: m.source ?? 'user',
    };
  }

  function handleMosqueSearch(text) {
    setMosqueSearch(text);
    latestQueryRef.current = text;
    setShowDrop(true);
    clearTimeout(searchDebounceRef.current);
    if (text.trim().length < 2) {
      setMosqueResults([]);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    searchDebounceRef.current = setTimeout(async () => {
      const query = text;
      try {
        const [dbRes, osmRes] = await Promise.allSettled([
          apiClient.get(`/api/mosquee/search?q=${encodeURIComponent(query.trim())}`),
          searchMosquesByNameOSM(query.trim()),
        ]);

        if (latestQueryRef.current !== query) return;

        const dbResults = dbRes.status === 'fulfilled' ? dbRes.value.data.map(mapDbMosque) : [];
        const osmResults = osmRes.status === 'fulfilled' ? osmRes.value : [];

        // Merge: DB results first, then OSM results not already in DB (dedup by osmId)
        const dbOsmIds = new Set(dbResults.map((m) => m.osmId).filter(Boolean));
        const uniqueOsm = osmResults.filter((m) => !dbOsmIds.has(m.osmId));

        setMosqueResults([...dbResults, ...uniqueOsm].slice(0, 20));
      } catch {
        if (latestQueryRef.current === query) setMosqueResults([]);
      } finally {
        if (latestQueryRef.current === query) setSearchLoading(false);
      }
    }, 300);
  }

  function selectMosque(mosque) {
    setForm((f) => ({
      ...f,
      mosqueeId: mosque.id,
      mosqueeDbId: mosque._dbId ?? null,
      mosqueeOsmId: mosque.osmId ?? null,
      mosqueeOsmType: mosque.osmType ?? null,
      mosqueeNom: capitalizeFirst(mosque.nom),
      mosqueeAdresse: mosque.adresse,
      mosqueeLatitude: mosque.latitude,
      mosqueeLongitude: mosque.longitude,
    }));
    setMosqueSearch('');
    setMosqueResults([]);
    setShowDrop(false);
    Keyboard.dismiss();
  }

  function clearMosque() {
    setForm((f) => ({ ...f, mosqueeId: '', mosqueeNom: '', mosqueeAdresse: '', mosqueeLatitude: null, mosqueeLongitude: null }));
    setMosqueSearch('');
  }

  function buildDateHeure() {
    if (!selectedDate) return null;
    const d = new Date(selectedDate);
    d.setHours(selectedHour, selectedMinute, 0, 0);
    return d;
  }

  function validate() {
    if (!form.mosqueeId) return 'Veuillez sélectionner une mosquée.';
    if (!selectedDate) return "Veuillez choisir une date pour la prière.";
    return null;
  }

  async function resolveMosqueeApiId() {
    const id = form.mosqueeId;
    // Mosquée déjà en DB (cache OSM ou contribution utilisateur)
    if (form.mosqueeDbId) return form.mosqueeDbId;
    if (id.startsWith('db_')) return parseInt(id.replace('db_', ''), 10);
    if (!id.startsWith('osm_')) return parseInt(id, 10);
    // Mosquée OSM fraîche pas encore dans le cache DB
    const osmId = form.mosqueeOsmId
      ? `${form.mosqueeOsmType === 'N' ? 'node' : 'way'}_${form.mosqueeOsmId}`
      : id.replace('osm_', '');
    try {
      const res = await apiClient.get(`/api/mosquee/osm/${osmId}`);
      return res.data.id;
    } catch (e) {
      if (e.response?.status === 404) {
        const created = await apiClient.post('/api/mosquee', {
          nom: form.mosqueeNom,
          adresse: form.mosqueeAdresse || null,
          latitude: form.mosqueeLatitude,
          longitude: form.mosqueeLongitude,
          osmId,
        });
        return created.data.id;
      }
      throw e;
    }
  }

  function handlePublishPress() {
    if (!form.nomAnonyme && !form.nomDefunt?.trim()) {
      Alert.alert(t('declare.error_name_title'), t('declare.error_name_body'));
      return;
    }
    const err = validate();
    if (err) { setError(err); return; }

    if (announcementData?.country) {
      doSubmit(announcementData);
    } else {
      setShowComplementaryInfo(true);
    }
  }

  async function doSubmit(extraData) {
    setError(null);
    setLoading(true);

    // Duplicate detection
    if (selectedDate) {
      const norm = (s) => (s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
      const proposedDay = `${selectedDate.getFullYear()}-${selectedDate.getMonth()}-${selectedDate.getDate()}`;

      const sameHourConflict = janazaList.find((j) => {
        if (!j.dateHeure) return false;
        const jDate = j.dateHeure instanceof Date ? j.dateHeure : new Date(j.dateHeure);
        const jDay = `${jDate.getFullYear()}-${jDate.getMonth()}-${jDate.getDate()}`;
        if (jDay !== proposedDay || jDate.getHours() !== selectedHour) return false;
        if (form.mosqueeDbId) return String(j.mosqueeId) === String(form.mosqueeDbId);
        return norm(j.mosquee) === norm(form.mosqueeNom);
      });

      if (sameHourConflict) {
        const isExactDuplicate = !form.nomAnonyme && form.nomDefunt?.trim()
          && norm(sameHourConflict.nomDefunt) === norm(form.nomDefunt);
        setError(
          isExactDuplicate
            ? 'Une janaza a déjà été déclarée pour cette personne dans cette mosquée à cette heure.'
            : 'Une salat janaza est déjà programmée pour cette heure dans cette mosquée.'
        );
        setLoading(false);
        return;
      }
    }

    try {
      const mosqueeApiId = await resolveMosqueeApiId();
      const dateHeure = buildDateHeure() ?? new Date();
      console.log('[Declare] apiUser.id:', apiUser?.id, 'mosqueeApiId:', mosqueeApiId);

      const res = await apiClient.post('/api/prierejanaza', {
        mosqueeId: mosqueeApiId,
        utilisateurId: apiUser?.id ?? apiUser?.Id ?? null,
        nomDefunt: form.nomAnonyme ? null : form.nomDefunt || null,
        estAnonyme: form.nomAnonyme,
        genre: form.genre,
        dateHeurePriere: dateHeure.toISOString(),
        utcOffsetMinutes: -dateHeure.getTimezoneOffset(),
        commentaire: extraData?.commentaire || null,
        paysEnterrement: extraData?.country || null,
        villeEnterrement: extraData?.locationFrance || null,
        anneeNaissance: (extraData?.showYears && extraData?.birthYear) ? extraData.birthYear : null,
        anneeDeces: (extraData?.showYears && extraData?.deathYear) ? extraData.deathYear : null,
      });

      const created = res.data;

      dispatch({
        type: 'MOSQUE_REGISTER',
        payload: {
          id: form.mosqueeId,
          nom: form.mosqueeNom,
          adresse: form.mosqueeAdresse,
          latitude: form.mosqueeLatitude,
          longitude: form.mosqueeLongitude,
          source: 'osm',
        },
      });

      dispatch({
        type: 'JANAZA_ADD',
        payload: {
          id: String(created.id),
          mosqueeId: String(mosqueeApiId),
          mosquee: form.mosqueeNom,
          adresse: form.mosqueeAdresse,
          latitude: form.mosqueeLatitude,
          longitude: form.mosqueeLongitude,
          dateHeure,
          statut: 'a_venir',
          genre: form.genre,
          nomDefunt: form.nomAnonyme ? '' : form.nomDefunt,
          estAnonyme: form.nomAnonyme,
          commentaire: form.commentaire,
          declarantEmail: user?.email ?? '',
          paysEnterrement: extraData?.country || null,
          villeEnterrement: extraData?.locationFrance || null,
          anneeNaissance: (extraData?.showYears && extraData?.birthYear) ? extraData.birthYear : null,
          anneeDeces: (extraData?.showYears && extraData?.deathYear) ? extraData.deathYear : null,
        },
      });

      setForm(EMPTY_FORM);
      setMosqueSearch('');
      setMosqueResults([]);
      setShowDrop(false);
      setSelectedDate(null);
      setSelectedHour(12);
      setSelectedMinute(0);
      setAnnouncementData(null);
      Keyboard.dismiss();
      setSuccess(true);
    } catch (e) {
      console.error('handleSubmit error:', e?.response?.status, e?.response?.data, e?.message);
      setError(t('declare.error_publish'));
    } finally {
      setLoading(false);
    }
  }

  async function handleImportFlyer() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('declare.import_permission_title'), t('declare.import_permission_body'));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 1,
    });

    if (result.canceled || !result.assets?.length) return;

    const asset = result.assets[0];
    const mime = asset.mimeType || (asset.uri.endsWith('.png') ? 'image/png' : 'image/jpeg');
    if (!['image/png', 'image/jpeg'].includes(mime)) {
      Alert.alert(t('declare.import_format_title'), t('declare.import_format_body'));
      return;
    }

    if (!apiUser?.id) {
      Alert.alert('', t('declare.import_login_required'));
      return;
    }

    setImportLoading(true);
    setImportStatus('pending');
    setImportMessage(t('declare.import_processing'));

    try {
      const fd = new FormData();
      fd.append('file', { uri: asset.uri, name: asset.fileName || 'flyer.jpg', type: mime });
      fd.append('utilisateurId', String(apiUser.id));

      const uploadResp = await apiClient.post('/api/flyer/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 30000,
      });
      const { importToken } = uploadResp.data;

      importPollRef.current = setInterval(async () => {
        try {
          const statusResp = await apiClient.get(`/api/flyer/import-status/${importToken}`);
          const { status: s, message, errorCode, timeUnknown } = statusResp.data;
          if (s === 'success') {
            clearInterval(importPollRef.current);
            importPollRef.current = null;
            setImportLoading(false);
            setImportStatus('success');
            setImportMessage(t('declare.import_success'));
            setImportTimeUnknown(!!timeUnknown);
            setShowImportVerify(true);
            // Rafraîchit toutes les données pour que la janaza et la mosquée
            // apparaissent immédiatement dans tous les onglets (carte, accueil, profil).
            dispatch({ type: 'FORCE_DATA_REFRESH' });
            apiClient.get('/api/prierejanaza/upcoming')
              .then(res => dispatch({ type: 'JANAZAS_LOADED', payload: res.data }))
              .catch(() => {});
            if (apiUser?.id) {
              apiClient.get(`/api/prierejanaza/utilisateur/${apiUser.id}`)
                .then(res => dispatch({ type: 'MY_DECLARATIONS_LOADED', payload: res.data }))
                .catch(() => {});
              apiClient.get(`/api/abonnement/utilisateur/${apiUser.id}`)
                .then(res => dispatch({ type: 'SUBSCRIPTIONS_LOADED', payload: res.data }))
                .catch(() => {});
            }
            apiClient.get('/api/mosquee/contributions')
              .then(res => {
                res.data.forEach(m => dispatch({
                  type: 'MOSQUE_REGISTER',
                  payload: {
                    id: `db_${m.id}`,
                    nom: m.nom,
                    adresse: m.adresse ?? '',
                    latitude: m.latitude,
                    longitude: m.longitude,
                    source: 'user',
                  },
                }));
              })
              .catch(() => {});
          } else if (s === 'error') {
            clearInterval(importPollRef.current);
            importPollRef.current = null;
            setImportLoading(false);
            setImportStatus('error');
            const errMsg = errorCode === 'IMAGE_QUALITY' ? t('declare.import_image_quality') : (message || t('declare.import_error_generic'));
            setImportMessage(errMsg);
            Alert.alert('', errMsg);
          }
        } catch (_) {}
      }, 3000);

      setTimeout(() => {
        if (importPollRef.current) {
          clearInterval(importPollRef.current);
          importPollRef.current = null;
          setImportLoading(false);
          setImportStatus('error');
          const timeoutMsg = t('declare.import_timeout');
          setImportMessage(timeoutMsg);
          Alert.alert('', timeoutMsg);
        }
      }, 2 * 60 * 1000);

    } catch (e) {
      setImportLoading(false);
      setImportStatus('error');
      const catchMsg = e?.response?.data?.error || t('declare.import_error_generic');
      setImportMessage(catchMsg);
      Alert.alert('', catchMsg);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets={true}>
          <Text style={styles.title}>{t('declare.title')}</Text>
          <Text style={styles.subtitle}>{t('declare.subtitle')}</Text>

          {error && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={18} color={colors.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Mosquée */}
          <View style={styles.section}>
            <SectionHeader icon="business-outline" label={t('declare.mosque_section')} />

            {form.mosqueeId ? (
              <View>
                <View style={styles.selectedMosque}>
                  <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.selectedMosqueText} numberOfLines={1}>{form.mosqueeNom}</Text>
                    {!!form.mosqueeAdresse && (
                      <Text style={styles.selectedMosqueAddr} numberOfLines={1}>{form.mosqueeAdresse}</Text>
                    )}
                  </View>
                  <TouchableOpacity onPress={clearMosque} style={styles.clearBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close-circle" size={20} color={colors.primary} />
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.comboboxWrapper}>
                <View style={styles.searchInputRow}>
                  <Ionicons name="search-outline" size={16} color={colors.textMuted} style={styles.searchIcon} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder={t('declare.mosque_placeholder')}
                    placeholderTextColor={colors.textMuted}
                    value={mosqueSearch}
                    onChangeText={handleMosqueSearch}
                    onFocus={() => mosqueSearch.length >= 2 && setShowDrop(true)}
                  />
                  {searchLoading && (
                    <ActivityIndicator size="small" color={colors.primary} style={{ marginLeft: spacing.sm }} />
                  )}
                </View>
                {showDrop && mosqueResults.length > 0 && (
                  <View style={styles.dropdown}>
                    {mosqueResults.map((m) => (
                      <TouchableOpacity
                        key={m.id}
                        style={styles.dropdownItem}
                        onPress={() => selectMosque(m)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="business-outline" size={14} color={colors.textMuted} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.dropdownItemText} numberOfLines={1}>{m.nom}</Text>
                          {!!m.adresse && (
                            <Text style={styles.dropdownItemAddr} numberOfLines={1}>{m.adresse}</Text>
                          )}
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                {showDrop && searchLoading && (
                  <View style={styles.noResultBox}>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={styles.noResultText}>{t('declare.mosque_loading')}</Text>
                  </View>
                )}
                {showDrop && !searchLoading && mosqueSearch.length >= 2 && mosqueResults.length === 0 && (
                  <View style={styles.noResultBox}>
                    <Ionicons name="search-outline" size={14} color={colors.textMuted} />
                    <Text style={styles.noResultText}>{t('declare.mosque_not_found')}</Text>
                  </View>
                )}
              </View>
            )}
          </View>

          {/* Date & Heure */}
          <View style={styles.section}>
            <SectionHeader icon="calendar-outline" label={t('declare.date_section')} />
            <TouchableOpacity style={styles.datePickerBtn} onPress={() => setShowCalendar(true)} activeOpacity={0.7}>
              <Ionicons name="calendar-outline" size={18} color={selectedDate ? colors.primary : colors.textMuted} />
              <Text style={[styles.datePickerText, !selectedDate && styles.datePickerPlaceholder]}>
                {selectedDate
                  ? selectedDate.toLocaleDateString(dateLocale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
                  : t('declare.date_placeholder')}
              </Text>
              <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
            </TouchableOpacity>

            {selectedDate && (
              <View style={styles.timeRow}>
                <Text style={styles.timeLabel}>{t('declare.time_label')}</Text>
                <TouchableOpacity style={styles.timePicker} onPress={() => setShowHourPicker(true)} activeOpacity={0.7}>
                  <Text style={styles.timePickerText}>{fmtTime(selectedHour)}</Text>
                  <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
                </TouchableOpacity>
                <Text style={styles.timeSeparator}>:</Text>
                <TouchableOpacity style={styles.timePicker} onPress={() => setShowMinutePicker(true)} activeOpacity={0.7}>
                  <Text style={styles.timePickerText}>{fmtTime(selectedMinute)}</Text>
                  <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Genre */}
          <View style={styles.section}>
            <SectionHeader icon="person-outline" label={t('declare.genre_section')} />
            <View style={styles.genreRow}>
              {GENRES.map((g) => (
                <TouchableOpacity
                  key={g.key}
                  style={[styles.genreOption, form.genre === g.key && styles.genreOptionActive]}
                  onPress={() => set('genre')(g.key)}
                  activeOpacity={0.7}
                >
                  <Image source={GENRE_IMAGES[g.key]} style={styles.genreImg} resizeMode="contain" />
                  <Text style={[styles.genreLabel, form.genre === g.key && styles.genreLabelActive]}>{g.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Nom */}
          <View style={styles.section}>
            <SectionHeader icon="document-text-outline" label={t('declare.name_section')} />
            <View style={styles.anonymeRow}>
              <Text style={styles.anonymeLabel}>{t('declare.name_anonymous')}</Text>
              <Switch value={form.nomAnonyme} onValueChange={set('nomAnonyme')} trackColor={{ false: colors.border, true: colors.primary }} thumbColor={colors.white} />
            </View>
            {!form.nomAnonyme && (
              <View style={styles.inputWrapper}>
                <Ionicons name="person-outline" size={16} color={colors.textMuted} style={styles.inputIcon} />
                <TextInput style={styles.inputWithIcon} placeholder={t('declare.name_placeholder')} placeholderTextColor={colors.textMuted} value={form.nomDefunt} onChangeText={set('nomDefunt')} />
              </View>
            )}
          </View>

          {form.mosqueeId && selectedDate && (
            <TouchableOpacity style={[styles.btn, styles.btnOutline]} onPress={() => setShowAnnouncement(true)} activeOpacity={0.8}>
              <Ionicons name="document-text-outline" size={18} color={colors.primary} />
              <Text style={[styles.btnText, styles.btnTextOutline]}>{t('declare.generate_announcement')}</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={[styles.btn, loading && styles.btnDisabled]} onPress={handlePublishPress} disabled={loading} activeOpacity={0.8}>
            {loading ? (
              <ActivityIndicator color={colors.white} size="small" />
            ) : (
              <>
                <Ionicons name="megaphone-outline" size={18} color={colors.white} />
                <Text style={styles.btnText}>{t('declare.publish')}</Text>
              </>
            )}
          </TouchableOpacity>

          {(apiUser?.canImportFlyer || ['admin', 'superadmin'].includes(user?.role?.toLowerCase())) && (
            <View>
              <TouchableOpacity
                style={[styles.btn, styles.btnOutline, styles.btnImport, importLoading && styles.btnDisabled]}
                onPress={handleImportFlyer}
                disabled={importLoading}
                activeOpacity={0.8}
              >
                {importLoading ? (
                  <ActivityIndicator color={colors.primary} size="small" />
                ) : (
                  <>
                    <Ionicons name="cloud-upload-outline" size={18} color={colors.primary} />
                    <Text style={[styles.btnText, styles.btnTextOutline]}>{t('declare.import_flyer')}</Text>
                  </>
                )}
              </TouchableOpacity>
              <Text style={styles.importHint}>{t('declare.import_hint')}</Text>
              {importStatus && (
                <View style={[
                  styles.importStatusBox,
                  importStatus === 'success' && styles.importStatusSuccess,
                  importStatus === 'error' && styles.importStatusError,
                  importStatus === 'pending' && styles.importStatusPending,
                ]}>
                  <Ionicons
                    name={importStatus === 'success' ? 'checkmark-circle-outline' : importStatus === 'error' ? 'alert-circle-outline' : 'time-outline'}
                    size={16}
                    color={importStatus === 'success' ? '#15803d' : importStatus === 'error' ? '#dc2626' : '#92400e'}
                  />
                  <Text style={[
                    styles.importStatusText,
                    importStatus === 'success' && styles.importStatusTextSuccess,
                    importStatus === 'error' && styles.importStatusTextError,
                    importStatus === 'pending' && styles.importStatusTextPending,
                  ]}>{importMessage}</Text>
                </View>
              )}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <CalendarModal
        visible={showCalendar}
        selectedDate={selectedDate}
        onSelect={(date) => { setSelectedDate(date); setShowCalendar(false); }}
        onClose={() => setShowCalendar(false)}
      />
      <ComboBoxModal
        visible={showHourPicker}
        items={HOURS}
        selected={selectedHour}
        onSelect={setSelectedHour}
        onClose={() => setShowHourPicker(false)}
        title="Heure"
      />
      <ComboBoxModal
        visible={showMinutePicker}
        items={MINUTES}
        selected={selectedMinute}
        onSelect={setSelectedMinute}
        onClose={() => setShowMinutePicker(false)}
        title="Minutes"
      />

      <AnnouncementGeneratorModal
        visible={showAnnouncement}
        onClose={() => setShowAnnouncement(false)}
        onDataChange={setAnnouncementData}
        onPublish={(data) => {
          setShowAnnouncement(false);
          setAnnouncementData(data);
          doSubmit(data);
        }}
        form={form}
        date={selectedDate}
        hour={selectedHour}
        minute={selectedMinute}
      />
      <ComplementaryInfoModal
        visible={showComplementaryInfo}
        onClose={() => setShowComplementaryInfo(false)}
        initialValues={announcementData}
        onSubmit={(data) => {
          setShowComplementaryInfo(false);
          setAnnouncementData(data);
          doSubmit(data);
        }}
      />

      {/* Popup vérification import IA */}
      <Modal transparent animationType="fade" visible={showImportVerify} onRequestClose={() => setShowImportVerify(false)}>
        <View style={styles.successOverlay}>
          <View style={styles.successModal}>
            <View style={styles.successIconCircle}>
              <Ionicons name="information-circle" size={48} color={colors.primary} />
            </View>
            <Text style={styles.successModalTitle}>{t('declare.import_verify_title')}</Text>
            {importTimeUnknown && (
              <Text style={[styles.successModalBody, { color: '#b45309', fontWeight: '600', marginBottom: 4 }]}>{t('declare.import_verify_time_unknown')}</Text>
            )}
            <Text style={styles.successModalBody}>{t('declare.import_verify_body')}</Text>
            <TouchableOpacity style={styles.successModalBtn} onPress={() => setShowImportVerify(false)} activeOpacity={0.8}>
              <Text style={styles.successModalBtnText}>{t('declare.import_verify_close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Popup succès */}
      <Modal transparent animationType="fade" visible={success} onRequestClose={() => setSuccess(false)}>
        <View style={styles.successOverlay}>
          <View style={styles.successModal}>
            <View style={styles.successIconCircle}>
              <Ionicons name="checkmark-circle" size={48} color={colors.success} />
            </View>
            <Text style={styles.successModalTitle}>{t('declare.success_popup_title')}</Text>
            <Text style={styles.successModalBody}>{t('declare.success_popup_body')}</Text>
            <TouchableOpacity style={styles.successModalBtn} onPress={() => setSuccess(false)} activeOpacity={0.8}>
              <Text style={styles.successModalBtnText}>{t('declare.success_popup_close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.xxl },
  title: { ...typography.h2, marginBottom: spacing.xs },
  subtitle: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.xl },

  successOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  successModal: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.xl, width: '100%', maxWidth: 360, alignItems: 'center' },
  successIconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(21,128,61,0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  successModalTitle: { ...typography.h3, textAlign: 'center', marginBottom: spacing.sm, color: colors.text },
  successModalBody: { ...typography.body, textAlign: 'center', color: colors.textSecondary, lineHeight: 22, marginBottom: spacing.lg },
  successModalBtn: { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing.md, paddingHorizontal: spacing.xl, alignSelf: 'stretch', alignItems: 'center' },
  successModalBtnText: { ...typography.button },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: 'rgba(220,38,38,0.08)', borderWidth: 1, borderColor: colors.error, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
  errorText: { color: colors.error, fontSize: 14, flex: 1 },

  section: { marginBottom: spacing.lg },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2, marginBottom: spacing.sm },
  sectionTitle: { ...typography.label },

  comboboxWrapper: { zIndex: 20 },
  searchInputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md },
  searchIcon: { marginRight: spacing.sm },
  searchInput: { flex: 1, paddingVertical: spacing.md, color: colors.text, fontSize: 15 },
  dropdown: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, marginTop: 4, overflow: 'hidden', maxHeight: 280 },
  dropdownItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  dropdownItemText: { ...typography.body, color: colors.text },
  dropdownItemAddr: { ...typography.caption, color: colors.textSecondary },
  noResultBox: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, backgroundColor: colors.surfaceElevated, borderRadius: radius.md, marginTop: 4 },
  noResultText: { ...typography.bodySmall, color: colors.textMuted, flex: 1 },
  selectedMosque: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.primaryDim, borderWidth: 1.5, borderColor: colors.primary, borderRadius: radius.md, padding: spacing.md },
  selectedMosqueText: { ...typography.body, color: colors.primary, fontWeight: '600' },
  selectedMosqueAddr: { ...typography.caption, color: colors.primary, opacity: 0.7 },
  clearBtn: {},

  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md },
  inputIcon: { marginRight: spacing.sm },
  inputWithIcon: { flex: 1, paddingVertical: spacing.md, color: colors.text, fontSize: 15 },
  textarea: { minHeight: 80 },

  genreRow: { flexDirection: 'row', gap: spacing.sm },
  genreOption: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface, gap: 4 },
  genreOptionActive: { borderColor: colors.primary, backgroundColor: colors.primaryDim },
  genreImg: { width: 72, height: 72 },
  genreLabel: { ...typography.bodySmall, color: colors.textSecondary, fontWeight: '600' },
  genreLabelActive: { color: colors.primary },

  anonymeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  anonymeLabel: { ...typography.body },

  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing.md, marginTop: spacing.sm },
  btnDisabled: { opacity: 0.6 },
  btnText: { ...typography.button },
  btnOutline: { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.primary },
  btnTextOutline: { color: colors.primary },
  btnImport: { marginTop: spacing.sm },
  importHint: { ...typography.caption, color: colors.textMuted, textAlign: 'center', marginTop: spacing.xs },
  importStatusBox: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.sm, borderWidth: 1 },
  importStatusSuccess: { backgroundColor: 'rgba(21,128,61,0.07)', borderColor: '#86efac' },
  importStatusError: { backgroundColor: 'rgba(220,38,38,0.07)', borderColor: '#fca5a5' },
  importStatusPending: { backgroundColor: '#fffbeb', borderColor: '#fcd34d' },
  importStatusText: { flex: 1, fontSize: 13, lineHeight: 19 },
  importStatusTextSuccess: { color: '#15803d' },
  importStatusTextError: { color: '#dc2626' },
  importStatusTextPending: { color: '#92400e' },

  // Date picker
  datePickerBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  datePickerText: { flex: 1, ...typography.body, color: colors.text, textTransform: 'capitalize' },
  datePickerPlaceholder: { color: colors.textMuted },

  // Time row
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  timeLabel: { ...typography.body, color: colors.textSecondary },
  timePicker: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.primary, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, minWidth: 70, justifyContent: 'center' },
  timePickerText: { fontSize: 22, fontWeight: '700', color: colors.primary },
  timeSeparator: { fontSize: 22, fontWeight: '700', color: colors.text },

  // Calendar modal
  calOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  calBox: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, width: '100%', maxWidth: 340 },
  calHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  calMonthTitle: { ...typography.h3, textTransform: 'capitalize' },
  calDayNamesRow: { flexDirection: 'row', marginBottom: spacing.sm },
  calDayName: { flex: 1, textAlign: 'center', ...typography.caption, fontWeight: '700', color: colors.textMuted },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calCell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: radius.full },
  calCellSelected: { backgroundColor: colors.primary },
  calCellToday: { borderWidth: 1.5, borderColor: colors.primary },
  calCellText: { fontSize: 14, fontWeight: '500', color: colors.text },
  calCellTextSelected: { color: colors.white, fontWeight: '700' },
  calCellTextToday: { color: colors.primary, fontWeight: '700' },

  // Combobox modal
  comboOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' },
  comboSheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, paddingBottom: spacing.xxl },
  comboHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: spacing.lg },
  comboTitle: { ...typography.h3, textAlign: 'center', marginBottom: spacing.md },
  comboItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.md, paddingHorizontal: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  comboItemSelected: { backgroundColor: colors.primaryDim },
  comboItemText: { fontSize: 18, fontWeight: '500', color: colors.text },
  comboItemTextSelected: { color: colors.primary, fontWeight: '700' },
});
