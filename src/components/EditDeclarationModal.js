import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView,
  TextInput, Switch, Alert, FlatList, ActivityIndicator,
  TouchableWithoutFeedback, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography } from '../utils/theme';
import apiClient from '../lib/api/apiClient';
import AnnouncementGeneratorModal from '../screens/declare/AnnouncementGenerator';
import { useTranslation } from 'react-i18next';
import { searchMosquesByNameOSM } from '../utils/mosqueSearch';
import { buildNomDefunt, splitNomDefunt } from '../utils/text';

import { getDateLocale } from '../utils/dateLocale';
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);
const GENRES = ['homme', 'femme', 'enfant'];

export function CalendarModal({ visible, selectedDate, onSelect, onClose }) {
  const { i18n } = useTranslation();
  const dateLocale = getDateLocale(i18n.language);
  const today = new Date();
  const [viewYear, setViewYear] = useState(selectedDate?.getFullYear() ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(selectedDate?.getMonth() ?? today.getMonth());
  const offset = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells = [...Array(offset).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const dayNames = Array.from({ length: 7 }, (_, i) =>
    new Date(2025, 0, 6 + i).toLocaleDateString(dateLocale, { weekday: 'short' })
  );
  const monthYearLabel = (() => {
    const label = new Date(viewYear, viewMonth, 1).toLocaleDateString(dateLocale, { month: 'long', year: 'numeric' });
    return label.charAt(0).toUpperCase() + label.slice(1);
  })();

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); } else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); } else setViewMonth(m => m + 1);
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
                {dayNames.map(d => <Text key={d} style={styles.calDayName}>{d}</Text>)}
              </View>
              <View style={styles.calGrid}>
                {Array.from({ length: Math.ceil(cells.length / 7) }, (_, ri) => (
                  <View key={ri} style={styles.calRow}>
                    {Array.from({ length: 7 }, (_, ci) => {
                      const day = cells[ri * 7 + ci] ?? null;
                      const isSelected = selectedDate && day === selectedDate.getDate()
                        && viewMonth === selectedDate.getMonth() && viewYear === selectedDate.getFullYear();
                      const isToday = day === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear();
                      return (
                        <TouchableOpacity
                          key={ci}
                          style={[styles.calCell, isSelected && styles.calCellSelected, isToday && !isSelected && styles.calCellToday]}
                          onPress={() => day && onSelect(new Date(viewYear, viewMonth, day))}
                          disabled={!day}
                          activeOpacity={0.7}
                        >
                          {day ? <Text style={[styles.calCellText, isSelected && styles.calCellTextSelected, isToday && !isSelected && styles.calCellTextToday]}>{day}</Text> : null}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ))}
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

export function ComboBoxModal({ visible, items, selected, onSelect, onClose, title }) {
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
                keyExtractor={item => String(item)}
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

export function ModalField({ label, children }) {
  return (
    <View style={styles.modalField}>
      <Text style={styles.modalLabel}>{label}</Text>
      <View style={styles.modalInputWrapper}>{children}</View>
    </View>
  );
}

export default function EditDeclarationModal({ item, onClose, onSaved }) {
  const { t, i18n } = useTranslation();
  const dateLocale = getDateLocale(i18n.language);
  const fmtTime = (n) => i18n.language?.startsWith('ar')
    ? n.toLocaleString('ar-SA', { minimumIntegerDigits: 2 })
    : String(n).padStart(2, '0');
  const [nomFamille, setNomFamille] = useState('');
  const [prenomDefunt, setPrenomDefunt] = useState('');
  const [estAnonyme, setEstAnonyme] = useState(false);
  const [genre, setGenre] = useState('homme');
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedHour, setSelectedHour] = useState(12);
  const [selectedMinute, setSelectedMinute] = useState(0);
  const [commentaire, setCommentaire] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showHourPicker, setShowHourPicker] = useState(false);
  const [showMinutePicker, setShowMinutePicker] = useState(false);
  const [showAnnouncement, setShowAnnouncement] = useState(false);
  const [announcementDraft, setAnnouncementDraft] = useState(null);
  const [mosqueeSearch, setMosqueeSearch] = useState('');
  const [selectedMosque, setSelectedMosque] = useState(null);
  const [mosqueeOptions, setMosqueeOptions] = useState([]);
  const [loadingMosquees, setLoadingMosquees] = useState(false);
  const [showDrop, setShowDrop] = useState(false);
  const debounceRef = useRef(null);
  const latestQueryRef = useRef('');

  useEffect(() => {
    if (!item) return;
    setAnnouncementDraft(null);
    const split = splitNomDefunt(item.nomDefunt ?? '');
    setNomFamille(split.nom);
    setPrenomDefunt(split.prenom);
    setEstAnonyme(item.estAnonyme ?? false);
    setGenre(item.genre ?? 'homme');
    const rawApi = item.dateHeurePriere;
    const rawLocal = item.dateHeure
      ? (typeof item.dateHeure === 'number'
        ? new Date(item.dateHeure).toISOString()
        : item.dateHeure instanceof Date
          ? item.dateHeure.toISOString()
          : item.dateHeure)
      : null;
    const raw = rawApi ?? rawLocal;
    const d = raw ? new Date(/Z|[+-]\d{2}:/.test(raw) ? raw : raw + 'Z') : new Date();
    // dateHeure is stored as wall-clock UTC — read directly
    setSelectedDate(new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    setSelectedHour(d.getUTCHours());
    setSelectedMinute(d.getUTCMinutes());
    setCommentaire(item.commentaire ?? '');
    setMosqueeSearch('');
    setSelectedMosque(item.mosqueeId ? {
      id: String(item.mosqueeId), _dbId: item.mosqueeId,
      nom: item.mosqueeNom ?? item.mosquee ?? '',
      adresse: item.mosqueeAdresse ?? item.adresse ?? null,
      latitude: item.latitude,
      longitude: item.longitude,
    } : null);
    setMosqueeOptions([]);
    setShowDrop(false);

  }, [item]);

  function handleMosqueeSearch(text) {
    setMosqueeSearch(text);
    setSelectedMosque(null);
    setShowDrop(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.trim().length < 2) { setMosqueeOptions([]); setLoadingMosquees(false); return; }
    const query = text.trim();
    latestQueryRef.current = query;
    setLoadingMosquees(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const [dbRes, osmRes] = await Promise.allSettled([
          apiClient.get(`/api/mosquee/search?q=${encodeURIComponent(query)}`),
          searchMosquesByNameOSM(query),
        ]);
        if (latestQueryRef.current !== query) return;
        const dbResults = dbRes.status === 'fulfilled' ? (dbRes.value.data ?? []) : [];
        const osmResults = osmRes.status === 'fulfilled' ? (osmRes.value ?? []) : [];
        const dbOsmIds = new Set(dbResults.map(m => m.osmId).filter(Boolean));
        const uniqueOsm = osmResults.filter(m => !dbOsmIds.has(m.osmId));
        setMosqueeOptions([...dbResults, ...uniqueOsm].slice(0, 20));
      } catch {
        if (latestQueryRef.current === query) setMosqueeOptions([]);
      } finally {
        if (latestQueryRef.current === query) setLoadingMosquees(false);
      }
    }, 300);
  }

  function selectMosque(mosque) {
    latestQueryRef.current = '';  // invalide toute requête en vol
    setLoadingMosquees(false);
    setMosqueeSearch('');
    setSelectedMosque(mosque);
    setMosqueeOptions([]);
    setShowDrop(false);
  }

  function clearMosque() {
    setSelectedMosque(null);
    setMosqueeSearch('');
    setMosqueeOptions([]);
    setShowDrop(false);
  }

  async function resolveMosqueeId() {
    if (!selectedMosque) return item.mosqueeId ?? null;
    const id = selectedMosque.id;
    if (selectedMosque._dbId) return selectedMosque._dbId;
    if (String(id).startsWith('db_')) return parseInt(id.replace('db_', ''), 10);
    if (!String(id).startsWith('osm_')) return parseInt(id, 10);
    const osmId = selectedMosque.osmId
      ? `${selectedMosque.osmType === 'N' ? 'node' : 'way'}_${selectedMosque.osmId}`
      : String(id).replace('osm_', '');
    try {
      const res = await apiClient.get(`/api/mosquee/osm/${osmId}`);
      return res.data.id;
    } catch (e) {
      if (e.response?.status === 404) {
        const created = await apiClient.post('/api/mosquee', {
          nom: selectedMosque.nom,
          adresse: selectedMosque.adresse ?? null,
          latitude: selectedMosque.latitude,
          longitude: selectedMosque.longitude,
          osmId,
        });
        return created.data.id;
      }
      throw e;
    }
  }

  const saveDeclaration = async (finalCommentaire, extraData) => {
    if (!selectedDate) {
      Alert.alert(t('admin.edit_missing_date'), t('admin.edit_missing_date_message'));
      return false;
    }
    const wallClockMs = Date.UTC(
      selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(),
      selectedHour, selectedMinute, 0, 0,
    );
    const d = new Date(wallClockMs);
    setLoading(true);
    try {
      const mosqueeId = await resolveMosqueeId();
      const res = await apiClient.put(`/api/PriereJanaza/${item.id}`, {
        mosqueeId,
        utilisateurId: item.utilisateurId,
        nomDefunt: estAnonyme ? null : buildNomDefunt(nomFamille, prenomDefunt),
        estAnonyme,
        genre,
        dateHeurePriere: d.toISOString(),
        commentaire: finalCommentaire ?? commentaire,
        utcOffsetMinutes: 0,
        ...(extraData ? {
          paysEnterrement: extraData.country || null,
          villeEnterrement: extraData.locationFrance || null,
          anneeNaissance: extraData.showYears ? (extraData.birthYear || null) : null,
          anneeDeces: extraData.showYears ? (extraData.deathYear || null) : null,
        } : {
          paysEnterrement: item.paysEnterrement ?? null,
          villeEnterrement: item.villeEnterrement ?? null,
          anneeNaissance: item.anneeNaissance ?? null,
          anneeDeces: item.anneeDeces ?? null,
        }),
      });
      Alert.alert(
        t('admin.edit_declaration_success_title'),
        t('admin.edit_declaration_success_body'),
        [{ text: 'OK', onPress: () => onSaved(res.data) }],
      );
      return true;
    } catch {
      Alert.alert(t('admin.add_error'), t('admin.edit_declaration_error'));
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleSave = () => saveDeclaration(commentaire);

  const handleSaveFromAnnouncement = (announcementData) => {
    const finalCommentaire = announcementData?.commentaire ?? commentaire;
    setCommentaire(finalCommentaire);
    // Ferme d'abord la modal pour éviter les conflits Alert/Modal imbriquées sur Android
    setShowAnnouncement(false);
    setTimeout(() => saveDeclaration(finalCommentaire, announcementData), 350);
  };

  const announcementForm = {
    nomAnonyme: estAnonyme,
    nomDefunt: buildNomDefunt(nomFamille, prenomDefunt),
    genre,
    mosqueeNom: selectedMosque?.nom ?? mosqueeSearch,
    mosqueeAdresse: item?.mosqueeAdresse ?? item?.adresse ?? '',
    mosqueeLatitude: selectedMosque?.latitude ?? item?.latitude ?? null,
    mosqueeeLongitude: selectedMosque?.longitude ?? item?.longitude ?? null,
    commentaire,
  };

  return (
    <Modal visible={!!item} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{t('admin.edit_declaration_title')}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}>
        <ScrollView
          contentContainerStyle={styles.modalScroll}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={true}
        >
          <View style={styles.modalField}>
            <Text style={styles.modalLabel}>{t('admin.edit_mosque_label')}</Text>
            {selectedMosque ? (
              <View style={styles.selectedMosque}>
                <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.selectedMosqueText} numberOfLines={1}>{selectedMosque.nom}</Text>
                  {!!selectedMosque.adresse && <Text style={styles.selectedMosqueAddr} numberOfLines={1}>{selectedMosque.adresse}</Text>}
                </View>
                <TouchableOpacity onPress={clearMosque} style={styles.clearBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close-circle" size={20} color={colors.primary} />
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <View style={styles.searchInputRow}>
                  <Ionicons name="search-outline" size={16} color={colors.textMuted} style={styles.searchIcon} />
                  <TextInput
                    style={styles.searchInput}
                    value={mosqueeSearch}
                    onChangeText={handleMosqueeSearch}
                    onFocus={() => mosqueeSearch.trim().length >= 2 && setShowDrop(true)}
                    placeholder={t('map.search_placeholder')}
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="none"
                  />
                  {loadingMosquees && <ActivityIndicator size="small" color={colors.primary} style={{ marginRight: spacing.sm }} />}
                </View>
                {showDrop && mosqueeSearch.trim().length >= 2 && mosqueeOptions.length > 0 && (
                  <View style={styles.dropdown}>
                    {mosqueeOptions.map(m => (
                      <TouchableOpacity key={m.id} style={styles.dropdownItem} onPress={() => selectMosque(m)} activeOpacity={0.7}>
                        <Ionicons name="business-outline" size={14} color={colors.textMuted} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.dropdownItemText} numberOfLines={1}>{m.nom}</Text>
                          {!!m.adresse && <Text style={styles.dropdownItemAddr} numberOfLines={1}>{m.adresse}</Text>}
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                {showDrop && !loadingMosquees && mosqueeSearch.trim().length >= 2 && mosqueeOptions.length === 0 && (
                  <View style={styles.noResultBox}>
                    <Ionicons name="search-outline" size={14} color={colors.textMuted} />
                    <Text style={styles.noResultText}>{t('map.no_mosques')}</Text>
                  </View>
                )}
              </>
            )}
          </View>

          <View style={styles.switchRow}>
            <Text style={styles.modalLabel}>{t('admin.edit_anonymous')}</Text>
            <Switch value={estAnonyme} onValueChange={setEstAnonyme} trackColor={{ true: colors.primary }} thumbColor={colors.white} />
          </View>

          {!estAnonyme && (
            <>
              <ModalField label={t('admin.edit_deceased_nom')}>
                <TextInput
                  style={styles.modalInput}
                  value={nomFamille}
                  onChangeText={setNomFamille}
                  placeholder={t('admin.edit_deceased_nom_placeholder')}
                  placeholderTextColor={colors.textMuted}
                />
              </ModalField>
              <ModalField label={t('admin.edit_deceased_prenom')}>
                <TextInput
                  style={styles.modalInput}
                  value={prenomDefunt}
                  onChangeText={setPrenomDefunt}
                  placeholder={t('admin.edit_deceased_prenom_placeholder')}
                  placeholderTextColor={colors.textMuted}
                />
              </ModalField>
            </>
          )}

          <ModalField label={t('admin.edit_genre')}>
            <View style={styles.genreRow}>
              {GENRES.map(g => (
                <TouchableOpacity
                  key={g}
                  style={[styles.genreOption, genre === g && styles.genreOptionActive]}
                  onPress={() => setGenre(g)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.genreOptionText, genre === g && styles.genreOptionTextActive]}>
                    {g === 'homme' ? t('admin.edit_male') : g === 'femme' ? t('admin.edit_female') : t('admin.edit_child')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ModalField>

          <View style={styles.modalField}>
            <Text style={styles.modalLabel}>{t('admin.edit_prayer_date')}</Text>
            <TouchableOpacity style={styles.datePickerBtn} onPress={() => setShowCalendar(true)} activeOpacity={0.7}>
              <Ionicons name="calendar-outline" size={18} color={selectedDate ? colors.primary : colors.textMuted} />
              <Text style={[styles.datePickerText, !selectedDate && styles.datePickerPlaceholder]}>
                {selectedDate
                  ? selectedDate.toLocaleDateString(dateLocale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
                  : t('admin.edit_date_placeholder')}
              </Text>
              <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {selectedDate && (
            <View style={styles.modalField}>
              <Text style={styles.modalLabel}>{t('admin.edit_time')}</Text>
              <View style={styles.timeRow}>
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
            </View>
          )}

          {selectedDate && (
            <TouchableOpacity style={styles.announceBtnOutline} onPress={() => setShowAnnouncement(true)} activeOpacity={0.8}>
              <Ionicons name="document-text-outline" size={18} color={colors.primary} />
              <Text style={styles.announceBtnText}>{t('admin.edit_preview')}</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.createBtn, loading && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color={colors.white} size="small" />
              : <><Ionicons name="checkmark-outline" size={18} color={colors.white} /><Text style={styles.createBtnText}>{t('admin.edit_declaration_save')}</Text></>
            }
          </TouchableOpacity>
        </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

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
        title={t('admin.edit_time')}
      />
      <ComboBoxModal
        visible={showMinutePicker}
        items={MINUTES}
        selected={selectedMinute}
        onSelect={setSelectedMinute}
        onClose={() => setShowMinutePicker(false)}
        title={t('admin.edit_time')}
      />
      <AnnouncementGeneratorModal
        key={item?.id ?? 'edit'}
        visible={showAnnouncement}
        onClose={(draft) => { setShowAnnouncement(false); if (draft) setAnnouncementDraft({ ...draft, _forItemId: item?.id }); }}
        form={announcementForm}
        date={selectedDate ? new Date(Date.UTC(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate())) : null}
        hour={selectedHour}
        minute={selectedMinute}
        initialValues={(announcementDraft?._forItemId === item?.id ? announcementDraft : null) ?? {
          country: item?.paysEnterrement ?? null,
          countryKnown: item?.paysEnterrement != null,
          locationFrance: item?.villeEnterrement ?? '',
          birthYear: item?.anneeNaissance ?? null,
          deathYear: item?.anneeDeces ?? null,
          showYears: !!(item?.anneeNaissance || item?.anneeDeces),
          commentaire: item?.commentaire ?? '',
        }}
        onDataChange={(data) => { if (data?.commentaire !== undefined) setCommentaire(data.commentaire); }}
        onPublish={handleSaveFromAnnouncement}
        publishLabel={t('admin.edit_declaration_save')}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: { flex: 1, backgroundColor: colors.background },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  modalTitle: { ...typography.h3 },
  modalScroll: { padding: spacing.md, gap: spacing.md },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm },
  modalField: { gap: spacing.xs },
  modalLabel: { ...typography.label, fontSize: 12 },
  modalInputWrapper: {
    backgroundColor: colors.surface, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, overflow: 'hidden',
  },
  modalInput: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, fontSize: 15, color: colors.text },

  genreRow: { flexDirection: 'row', gap: spacing.sm },
  genreOption: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.xs, paddingVertical: spacing.sm + 2,
    borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  genreOptionActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  genreOptionText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  genreOptionTextActive: { color: colors.white },

  datePickerBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  datePickerText: { flex: 1, ...typography.body, color: colors.text, textTransform: 'capitalize' },
  datePickerPlaceholder: { color: colors.textMuted },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  timePicker: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.primary, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, minWidth: 70, justifyContent: 'center' },
  timePickerText: { fontSize: 22, fontWeight: '700', color: colors.primary },
  timeSeparator: { fontSize: 22, fontWeight: '700', color: colors.text },

  selectedMosque: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.primary, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2 },
  selectedMosqueText: { fontSize: 14, fontWeight: '600', color: colors.text },
  selectedMosqueAddr: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  clearBtn: { padding: 2 },
  searchInputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  searchIcon: { marginRight: spacing.sm },
  searchInput: { flex: 1, fontSize: 15, color: colors.text, paddingVertical: spacing.xs },
  dropdown: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, marginTop: 4, overflow: 'hidden' },
  dropdownItem: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  dropdownItemText: { fontSize: 14, fontWeight: '600', color: colors.text },
  dropdownItemAddr: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  noResultBox: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md },
  noResultText: { fontSize: 13, color: colors.textMuted },

  announceBtnOutline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing.md, marginTop: spacing.xs },
  announceBtnText: { ...typography.button, color: colors.primary, fontSize: 15 },

  createBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, backgroundColor: colors.primary,
    borderRadius: radius.md, paddingVertical: spacing.md, marginTop: spacing.sm,
  },
  createBtnText: { ...typography.button, fontSize: 15 },

  calOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  calBox: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, width: '100%', maxWidth: 340 },
  calHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  calMonthTitle: { ...typography.h3, textTransform: 'capitalize' },
  calDayNamesRow: { flexDirection: 'row', marginBottom: spacing.sm },
  calDayName: { flex: 1, textAlign: 'center', ...typography.caption, fontWeight: '700', color: colors.textMuted },
  calGrid: {},
  calRow: { flexDirection: 'row' },
  calCell: { flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: radius.full },
  calCellSelected: { backgroundColor: colors.primary },
  calCellToday: { borderWidth: 1.5, borderColor: colors.primary },
  calCellText: { fontSize: 14, fontWeight: '500', color: colors.text },
  calCellTextSelected: { color: colors.white, fontWeight: '700' },
  calCellTextToday: { color: colors.primary, fontWeight: '700' },

  comboOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' },
  comboSheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, paddingBottom: spacing.xxl },
  comboHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: spacing.lg },
  comboTitle: { ...typography.h3, textAlign: 'center', marginBottom: spacing.md },
  comboItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.md, paddingHorizontal: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  comboItemSelected: { backgroundColor: colors.primaryDim },
  comboItemText: { fontSize: 18, fontWeight: '500', color: colors.text },
  comboItemTextSelected: { color: colors.primary, fontWeight: '700' },
});
