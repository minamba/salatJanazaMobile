import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, RefreshControl, TextInput,
  Modal, ScrollView, KeyboardAvoidingView, Platform, Switch, TouchableWithoutFeedback,
  Animated, PanResponder,
} from 'react-native';
import ScreenBackground from '../../components/ScreenBackground';
import ScreenHeader from '../../components/ScreenHeader';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSelector, useDispatch } from 'react-redux';
import { colors, spacing, radius, typography } from '../../utils/theme';
import { formatNomDefunt, buildNomDefunt, splitNomDefunt } from '../../utils/text';
import apiClient from '../../lib/api/apiClient';
import AnnouncementGeneratorModal from '../declare/AnnouncementGenerator';
import { useTranslation } from 'react-i18next';
import { searchMosquesByNameOSM, normalize } from '../../utils/mosqueSearch';
import { refreshAllData } from '../../utils/refreshStore';
import { geocodeAddress } from '../../utils/geocode';
import DashboardTab from './DashboardTab';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);
import { getDateLocale } from '../../utils/dateLocale';
import { getCountryName } from '../../utils/countryNames';

function CalendarModal({ visible, selectedDate, onSelect, onClose }) {
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
                {dayNames.map((d, i) => <Text key={i} style={styles.calDayName}>{d}</Text>)}
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

function ComboBoxModal({ visible, items, selected, onSelect, onClose, title }) {
  const { i18n } = useTranslation();
  const fmtN = (n) => i18n.language?.startsWith('ar')
    ? n.toLocaleString('ar-SA', { minimumIntegerDigits: 2 })
    : String(n).padStart(2, '0');
  const translateY = useRef(new Animated.Value(600)).current;
  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, { dy }) => dy > 5,
    onPanResponderMove: (_, { dy }) => { if (dy > 0) translateY.setValue(dy); },
    onPanResponderRelease: (_, { dy, vy }) => {
      if (dy > 80 || vy > 0.8) {
        Animated.timing(translateY, { toValue: 700, duration: 220, useNativeDriver: true }).start(() => { translateY.setValue(600); onClose(); });
      } else {
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 80, friction: 10 }).start();
      }
    },
  })).current;
  useEffect(() => { if (visible) Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }).start(); }, [visible]);
  return (
    <Modal transparent animationType="none" visible={visible} onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.comboOverlay}>
          <TouchableWithoutFeedback>
            <Animated.View style={[styles.comboSheet, { transform: [{ translateY }] }]}>
              <View style={{ paddingVertical: 10, alignItems: 'center' }} {...panResponder.panHandlers}>
                <View style={styles.comboHandle} />
              </View>
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
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const TOUTES = '__toutes__';

/**
 * Choix dans une liste de libellés — distinct de ComboBoxModal, qui formate
 * des nombres sur deux chiffres et ne convient qu'aux heures et minutes.
 *
 * Le champ de recherche n'est pas un ornement : les mosquées couvrent plus de
 * deux cents villes, et faire défiler une telle liste au doigt est plus long
 * que de taper trois lettres.
 */
function ListeChoixModal({ visible, items, selected, onSelect, onClose, titre, libelleTous }) {
  const [filtre, setFiltre] = useState('');

  const translateY = useRef(new Animated.Value(600)).current;
  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, { dy }) => dy > 5,
    onPanResponderMove: (_, { dy }) => { if (dy > 0) translateY.setValue(dy); },
    onPanResponderRelease: (_, { dy, vy }) => {
      if (dy > 80 || vy > 0.8) {
        Animated.timing(translateY, { toValue: 700, duration: 220, useNativeDriver: true }).start(() => { translateY.setValue(600); onClose(); });
      } else {
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 80, friction: 10 }).start();
      }
    },
  })).current;

  // Le filtre repart à vide à chaque ouverture : rouvrir la liste et n'y
  // trouver que le reliquat d'une recherche précédente donne l'impression
  // que les données ont disparu.
  useEffect(() => { if (visible) { setFiltre(''); Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }).start(); } }, [visible]);

  const q = (s) => normalize(s ?? '');
  const visibles = filtre ? items.filter(i => q(i).includes(q(filtre))) : items;

  const ligne = (valeur, libelle) => {
    const actif = valeur === selected;
    return (
      <TouchableOpacity
        style={[styles.comboItem, actif && styles.comboItemSelected]}
        onPress={() => { onSelect(valeur); onClose(); }}
        activeOpacity={0.7}
      >
        <Text style={[styles.comboItemText, actif && styles.comboItemTextSelected]} numberOfLines={1}>
          {libelle}
        </Text>
        {actif && <Ionicons name="checkmark" size={18} color={colors.primary} />}
      </TouchableOpacity>
    );
  };

  return (
    <Modal transparent animationType="none" visible={visible} onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.comboOverlay}>
          <TouchableWithoutFeedback>
            <Animated.View style={[styles.comboSheet, { transform: [{ translateY }] }]}>
              <View style={{ paddingVertical: 10, alignItems: 'center' }} {...panResponder.panHandlers}>
                <View style={styles.comboHandle} />
              </View>
              <Text style={styles.comboTitle}>{titre}</Text>
              <SearchBar value={filtre} onChange={setFiltre} placeholder="Filtrer…" />
              <FlatList
                data={visibles}
                keyExtractor={item => String(item)}
                renderItem={({ item }) => ligne(item, item)}
                ListHeaderComponent={ligne(TOUTES, libelleTous)}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                style={{ maxHeight: 340 }}
                ListEmptyComponent={
                  <Text style={styles.comboVide}>Aucun résultat pour « {filtre} »</Text>
                }
              />
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

/** Bouton d'ouverture d'un ListeChoixModal, façon liste déroulante. */
function BoutonCombo({ libelle, valeur, actif, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.filtreCombo, actif && styles.filtreComboActif]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.filtreComboLabel, actif && styles.filtreComboLabelActif]} numberOfLines={1}>
        {actif ? valeur : libelle}
      </Text>
      <Ionicons
        name="chevron-down"
        size={14}
        color={actif ? colors.primary : colors.textMuted}
      />
    </TouchableOpacity>
  );
}

/**
 * Bascule du tri par date. Deux états seulement : le plus récent d'abord, ou
 * l'inverse. Le libellé dit l'état COURANT, pas l'action — « Plus récentes »
 * signifie que la liste est déjà triée ainsi.
 */
function BoutonTri({ valeur, onChange }) {
  const recent = valeur === 'recent';
  return (
    <TouchableOpacity
      style={styles.boutonTri}
      onPress={() => onChange(recent ? 'ancien' : 'recent')}
      activeOpacity={0.7}
    >
      <Ionicons name={recent ? 'arrow-down' : 'arrow-up'} size={13} color={colors.primary} />
      <Text style={styles.boutonTriTexte}>{recent ? 'Plus récentes' : 'Plus anciennes'}</Text>
    </TouchableOpacity>
  );
}

function AdminCommentairesTab() {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState({});
  const [search, setSearch] = useState('');

  useEffect(() => { loadComments(); }, []);

  async function loadComments() {
    setLoading(true);
    try {
      const res = await apiClient.get('/api/prierejanaza/commentaires/all');
      setComments(res.data ?? []);
    } catch {
      Alert.alert('Erreur', 'Impossible de charger les commentaires.');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(comment) {
    Alert.alert('Supprimer', 'Supprimer ce commentaire définitivement ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer', style: 'destructive',
        onPress: async () => {
          try {
            await apiClient.delete(`/api/prierejanaza/${comment.priereJanazaId}/commentaires/${comment.id}`);
            setComments(p => p.filter(c => c.id !== comment.id));
          } catch { Alert.alert('Erreur', 'Suppression impossible.'); }
        },
      },
    ]);
  }

  async function handleToggle(comment) {
    try {
      const res = await apiClient.patch(`/api/prierejanaza/${comment.priereJanazaId}/commentaires/${comment.id}/visibility`);
      setComments(p => p.map(c => c.id === comment.id ? { ...c, estCache: res.data.estCache } : c));
    } catch { Alert.alert('Erreur', 'Modification impossible.'); }
  }

  const filtered = comments.filter(c => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      c.auteurNom?.toLowerCase().includes(q) ||
      c.nomDefunt?.toLowerCase().includes(q) ||
      c.contenu?.toLowerCase().includes(q)
    );
  });

  if (loading) return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.sm }}>
        <TextInput
          style={adminComStyles.searchInput}
          placeholder="Rechercher (défunt, auteur, contenu)…"
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        <Text style={adminComStyles.count}>{filtered.length} commentaire{filtered.length !== 1 ? 's' : ''}</Text>
      </View>
      <FlatList
        data={filtered}
        keyExtractor={c => String(c.id)}
        refreshing={loading}
        onRefresh={loadComments}
        contentContainerStyle={{ paddingHorizontal: spacing.md, paddingBottom: spacing.xl }}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        renderItem={({ item: c }) => {
          const isOpen = !!expanded[c.id];
          return (
            <TouchableOpacity
              style={[adminComStyles.card, c.estCache && adminComStyles.cardHidden]}
              onPress={() => setExpanded(p => ({ ...p, [c.id]: !p[c.id] }))}
              activeOpacity={0.85}
            >
              <View style={adminComStyles.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={adminComStyles.defunt} numberOfLines={1}>
                    {c.estAnonyme ? 'Anonyme' : (c.nomDefunt || 'Défunt inconnu')}
                  </Text>
                  <View style={adminComStyles.metaRow}>
                    <Ionicons name="person-outline" size={11} color={colors.textMuted} />
                    <Text style={adminComStyles.meta}>{c.auteurNom || 'Anonyme'}</Text>
                    <Text style={adminComStyles.metaSep}>·</Text>
                    <Text style={adminComStyles.meta}>
                      {new Date(c.dateCreation).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </Text>
                    {c.estCache && (
                      <>
                        <Text style={adminComStyles.metaSep}>·</Text>
                        <Ionicons name="eye-off-outline" size={11} color={colors.warning} />
                        <Text style={[adminComStyles.meta, { color: colors.warning }]}>Caché</Text>
                      </>
                    )}
                  </View>
                </View>
                <View style={adminComStyles.actions}>
                  <TouchableOpacity onPress={() => handleToggle(c)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons
                      name={c.estCache ? 'eye-outline' : 'eye-off-outline'}
                      size={18}
                      color={colors.warning}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDelete(c)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="trash-outline" size={18} color={colors.error ?? '#dc2626'} />
                  </TouchableOpacity>
                  <Ionicons
                    name={isOpen ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={colors.textMuted}
                  />
                </View>
              </View>
              {isOpen && (
                <Text style={adminComStyles.content}>{c.contenu}</Text>
              )}
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const adminComStyles = StyleSheet.create({
  searchInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    height: 36,
    fontSize: 13,
    color: colors.text,
    backgroundColor: colors.surfaceElevated,
    marginBottom: 4,
  },
  count: {
    fontSize: 12,
    color: colors.textMuted,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.md,
  },
  cardHidden: {
    borderColor: colors.warning,
    opacity: 0.75,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  defunt: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
    flexWrap: 'wrap',
  },
  meta: {
    fontSize: 11,
    color: colors.textMuted,
  },
  metaSep: {
    fontSize: 11,
    color: colors.border,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flexShrink: 0,
  },
  content: {
    marginTop: spacing.sm,
    fontSize: 13,
    color: colors.text,
    lineHeight: 20,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingTop: spacing.sm,
  },
});

const SUPER_ADMIN_EMAIL = 'ceo@salatjanaza.org';

const parseUtc = (raw) => raw ? new Date(/Z$|[+-]\d{2}:/.test(raw) ? raw : raw + 'Z') : null;

export default function AdminScreen() {
  const { t, i18n } = useTranslation();
  const dispatch = useDispatch();
  const currentUser = useSelector(state => state.auth.user);
  const apiUser = useSelector(state => state.auth.apiUser);

  const [tab, setTab] = useState(0);
  const [mosqueSubTab, setMosqueSubTab] = useState(0); // 0=Toutes 1=En attente
  const [declSubTab, setDeclSubTab] = useState(0); // 0=Déclarations 1=Importation 2=En attente 3=Import TXT
  const [pendingDeclarations, setPendingDeclarations] = useState([]);
  const [importTxtContent, setImportTxtContent] = useState('');
  const [importTxtLoading, setImportTxtLoading] = useState(false);
  const [importTxtResult, setImportTxtResult] = useState(null);
  const [importTxtPolling, setImportTxtPolling] = useState(false);
  const [importSummary, setImportSummary] = useState(null);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const pollIntervalRef = useRef(null);
  const [importSearchUser, setImportSearchUser] = useState('');
  const [importBulkLoading, setImportBulkLoading] = useState(false);
  const [mosques, setMosques] = useState([]);
  const [pendingMosques, setPendingMosques] = useState([]);
  const [dbMosques, setDbMosques] = useState([]);
  const [dbLoading, setDbLoading] = useState(false);
  const [normLoading, setNormLoading] = useState(false);
  const [declarations, setDeclarations] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [editPendingMosque, setEditPendingMosque] = useState(null);
  const [editMosque, setEditMosque] = useState(null);
  const [editDbMosque, setEditDbMosque] = useState(null);
  const [editDbMosqueForm, setEditDbMosqueForm] = useState({ nom: '', adresse: '', latitude: '', longitude: '' });
  const [searchDbMosque, setSearchDbMosque] = useState('');
  const [showAddDbMosque, setShowAddDbMosque] = useState(false);

  const SECTIONS = ['Masadjid', 'Masadjid BDD', 'Janazas', 'Users', 'Dashboard'];

  const [searchMosque, setSearchMosque] = useState('');
  const [searchPending, setSearchPending] = useState('');
  const [searchDecl, setSearchDecl] = useState('');
  const [searchUser, setSearchUser] = useState('');
  const [roleFilter, setRoleFilter] = useState('all'); // 'all' | 'user' | 'admin'

  // Filtres de lieu. Un jeu par onglet : les deux listes ne contiennent pas
  // les mêmes mosquées, et une ville présente dans l'une peut être absente de
  // l'autre. Les partager ferait apparaître des filtres sans effet.
  const [villeMosque, setVilleMosque] = useState(TOUTES);
  const [paysMosque, setPaysMosque] = useState(TOUTES);
  const [villeDb, setVilleDb] = useState(TOUTES);
  const [paysDb, setPaysDb] = useState(TOUTES);
  const [comboOuvert, setComboOuvert] = useState(null); // 'villeMosque' | 'paysMosque' | 'villeDb' | 'paysDb'

  // Tri par date : 'recent' (le plus récent d'abord) ou 'ancien'.
  const [triMosque, setTriMosque] = useState('recent');
  const [triDb, setTriDb] = useState('recent');
  const [triUser, setTriUser] = useState('recent');

  const [rattrapageLoading, setRattrapageLoading] = useState(false);
  const [rattrapageEtat, setRattrapageEtat] = useState(null);

  const [genderFilter, setGenderFilter] = useState('all');
  const [addUserVisible, setAddUserVisible] = useState(false);
  const [editDecl, setEditDecl] = useState(null);
  const [editUser, setEditUser] = useState(null);
  const [pendingSelectMode, setPendingSelectMode] = useState(false);
  const [selectedPendingIds, setSelectedPendingIds] = useState(new Set());
  const [declSelectMode, setDeclSelectMode] = useState(false);
  const [selectedDeclIds, setSelectedDeclIds] = useState(new Set());
  const [declDateFrom, setDeclDateFrom] = useState(null);
  const [declDateTo, setDeclDateTo] = useState(null);
  const [showDeclCalFrom, setShowDeclCalFrom] = useState(false);
  const [showDeclCalTo, setShowDeclCalTo] = useState(false);
  const [searchHisto, setSearchHisto] = useState('');
  const [historique, setHistorique] = useState([]);
  const [histoLoading, setHistoLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [mosRes, pendRes, decRes, usrRes, pendDeclRes] = await Promise.all([
        apiClient.get('/api/Mosquee/contributions'),
        apiClient.get('/api/Mosquee/pending'),
        apiClient.get('/api/PriereJanaza'),
        apiClient.get('/api/Utilisateur'),
        apiClient.get('/api/prierejanaza/en-attente'),
      ]);
      setMosques(mosRes.data ?? []);
      setPendingMosques(pendRes.data ?? []);
      setDeclarations(decRes.data ?? []);
      setUsers(usrRes.data ?? []);
      setPendingDeclarations(pendDeclRes.data ?? []);
    } catch {
      Alert.alert(t('admin.add_error'), t('admin.load_error'));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadHistorique = useCallback(async () => {
    setHistoLoading(true);
    try {
      const res = await apiClient.get('/api/PriereJanaza/historique');
      setHistorique(res.data ?? []);
    } catch {}
    finally { setHistoLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { loadData(); loadDbMosques(); }, [loadData]));

  useEffect(() => {
    if (declSubTab === 4) loadHistorique();
  }, [declSubTab, loadHistorique]);

  const loadDbMosques = async () => {
    setDbLoading(true);
    try {
      const res = await apiClient.get('/api/mosquee');
      setDbMosques(res.data ?? []);
    } catch {}
    finally { setDbLoading(false); }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadData(), loadDbMosques()]);
    setRefreshing(false);
  }, [loadData]);

  const normaliserSansNom = () => {
    Alert.alert(
      'Normaliser mosquées',
      'Cette opération va :\n\n• Renommer les mosquées "Mosquée" d\'après leur ville\n• Supprimer celles sans adresse valide (nom de rue + code postal)\n• Supprimer les doublons (même nom + même adresse, même si GPS différents)',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer', style: 'destructive',
          onPress: async () => {
            setNormLoading(true);
            try {
              const { data } = await apiClient.post('/api/Mosquee/normaliser-sans-nom');
              await loadDbMosques();
              refreshAllData(dispatch, apiUser?.id);
              const doublons = [
                ...(data.supprimes ?? []).filter(s => s.raison?.startsWith('Doublon supprimé')),
                ...(data.ignores ?? []).filter(s => s.raison?.startsWith('Doublon désactivé')),
              ].length;
              const invalides = (data.supprimes ?? []).filter(s => s.raison?.startsWith('Adresse invalide')).length;
              const desactives = (data.ignores ?? []).filter(s => s.raison?.startsWith('Janazas')).length;
              Alert.alert(
                'Normalisation terminée',
                `Renommées : ${data.renommes?.length ?? 0}\nSupprimées (adresse invalide) : ${invalides}\nDoublons supprimés : ${doublons}\nDésactivées (janazas liées) : ${desactives}`,
              );
            } catch {
              Alert.alert('Erreur', 'La normalisation a échoué.');
            } finally {
              setNormLoading(false);
            }
          },
        },
      ],
    );
  };

  const confirmDelete = (endpoint, id, label, onSuccess) => {
    Alert.alert(t('admin.delete'), t('admin.delete_confirm_message', { name: label }), [
      { text: t('admin.delete_cancel'), style: 'cancel' },
      {
        text: t('admin.delete_confirm'), style: 'destructive',
        onPress: async () => {
          try {
            await apiClient.delete(`${endpoint}/${id}`);
            onSuccess();
          } catch (e) {
            const status = e?.response?.status;
            Alert.alert(t('admin.add_error'), status
              ? t('admin.delete_error_http', { status })
              : t('admin.delete_error_network'));
          }
        },
      },
    ]);
  };

  const deleteMosque = (id, nom) =>
    confirmDelete('/api/Mosquee', id, nom, () => {
      setMosques(p => p.filter(m => m.id !== id));
      refreshAllData(dispatch, apiUser?.id);
    });

  const refuserMosque = (id, nom) => {
    Alert.alert(t('admin.reject'), t('admin.delete_confirm_message', { name: nom }), [
      { text: t('admin.delete_cancel'), style: 'cancel' },
      {
        text: t('admin.reject'), style: 'destructive',
        onPress: async () => {
          try {
            await apiClient.put(`/api/Mosquee/${id}/refuser`);
            setPendingMosques(p => p.filter(m => m.id !== id));
            setPendingDeclarations(p => p.filter(d => d.mosqueeId !== id));
          } catch (e) {
            const status = e?.response?.status;
            Alert.alert(t('admin.add_error'), status
              ? t('admin.delete_error_http', { status })
              : t('admin.delete_error_network'));
          }
        },
      },
    ]);
  };

  const validerMosque = (id) => {
    const target = pendingMosques.find(x => x.id === id);
    Alert.alert(
      t('admin.validate'),
      t('admin.validate_confirm_message', { name: target?.nom ?? '' }),
      [
        { text: t('admin.delete_cancel'), style: 'cancel' },
        {
          text: t('admin.validate_confirm_btn'),
          onPress: async () => {
            try {
              await apiClient.put(`/api/Mosquee/${id}/valider`);
              const validated = pendingMosques.find(m => m.id === id);
              setPendingMosques(p => p.filter(m => m.id !== id));
              if (validated) {
                setMosques(p => [{ ...validated, statut: 'Validee' }, ...p]);
                dispatch({
                  type: 'MOSQUE_REGISTER',
                  payload: {
                    id: `db_${validated.id}`,
                    nom: validated.nom,
                    adresse: validated.adresse ?? '',
                    latitude: validated.latitude,
                    longitude: validated.longitude,
                    source: 'user',
                  },
                });
              }
              if (apiUser?.id) {
                apiClient.get(`/api/abonnement/utilisateur/${apiUser.id}`)
                  .then(res => dispatch({ type: 'SUBSCRIPTIONS_LOADED', payload: res.data }))
                  .catch(() => {});
              }
            } catch {
              Alert.alert(t('admin.add_error'), t('admin.validate_error'));
            }
          },
        },
      ]
    );
  };

  const enterSelectMode = () => { setPendingSelectMode(true); setSelectedPendingIds(new Set()); };
  const exitSelectMode = () => { setPendingSelectMode(false); setSelectedPendingIds(new Set()); };
  const enterDeclSelectMode = () => { setDeclSelectMode(true); setSelectedDeclIds(new Set()); };
  const exitDeclSelectMode = () => { setDeclSelectMode(false); setSelectedDeclIds(new Set()); };
  const toggleDeclSelect = (id) => setSelectedDeclIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const togglePendingSelect = (id) => setSelectedPendingIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const supprimerAll = () => {
    if (filteredPending.length === 0) return;
    Alert.alert(
      t('admin.delete_all'),
      t('admin.delete_all_confirm', { count: filteredPending.length }),
      [
        { text: t('admin.delete_cancel'), style: 'cancel' },
        {
          text: t('admin.delete_all'),
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              await Promise.all(filteredPending.map(m => apiClient.put(`/api/Mosquee/${m.id}/refuser`)));
              const deleted = filteredPending;
              setPendingMosques(p => p.filter(m => !deleted.some(v => v.id === m.id)));
            } catch {
              Alert.alert(t('admin.add_error'), t('admin.delete_all_error'));
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const validerSelection = () => {
    const toValidate = filteredPending.filter(m => selectedPendingIds.has(m.id));
    if (toValidate.length === 0) return;
    Alert.alert(
      t('admin.validate_all'),
      t('admin.validate_selection_confirm', { count: toValidate.length }),
      [
        { text: t('admin.delete_cancel'), style: 'cancel' },
        {
          text: t('admin.validate_confirm_btn'),
          onPress: async () => {
            setLoading(true);
            try {
              await Promise.all(toValidate.map(m => apiClient.put(`/api/Mosquee/${m.id}/valider`)));
              setPendingMosques(p => p.filter(m => !selectedPendingIds.has(m.id)));
              setMosques(p => [...toValidate.map(m => ({ ...m, statut: 'Validee' })), ...p]);
              toValidate.forEach(m => dispatch({
                type: 'MOSQUE_REGISTER',
                payload: { id: `db_${m.id}`, nom: m.nom, adresse: m.adresse ?? '', latitude: m.latitude, longitude: m.longitude, source: 'user' },
              }));
              if (apiUser?.id) {
                apiClient.get(`/api/abonnement/utilisateur/${apiUser.id}`)
                  .then(res => dispatch({ type: 'SUBSCRIPTIONS_LOADED', payload: res.data }))
                  .catch(() => {});
              }
              exitSelectMode();
            } catch {
              Alert.alert(t('admin.add_error'), t('admin.validate_all_error'));
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const supprimerSelection = () => {
    const toDelete = filteredPending.filter(m => selectedPendingIds.has(m.id));
    if (toDelete.length === 0) return;
    Alert.alert(
      t('admin.delete_all'),
      t('admin.delete_selection_confirm', { count: toDelete.length }),
      [
        { text: t('admin.delete_cancel'), style: 'cancel' },
        {
          text: t('admin.delete_selection', { count: toDelete.length }),
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              await Promise.all(toDelete.map(m => apiClient.put(`/api/Mosquee/${m.id}/refuser`)));
              setPendingMosques(p => p.filter(m => !selectedPendingIds.has(m.id)));
              exitSelectMode();
            } catch {
              Alert.alert(t('admin.add_error'), t('admin.delete_all_error'));
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const validerAll = () => {
    if (filteredPending.length === 0) return;
    Alert.alert(
      t('admin.validate_all'),
      t('admin.validate_all_confirm', { count: filteredPending.length }),
      [
        { text: t('admin.delete_cancel'), style: 'cancel' },
        {
          text: t('admin.validate_all'),
          onPress: async () => {
            setLoading(true);
            try {
              await Promise.all(filteredPending.map(m => apiClient.put(`/api/Mosquee/${m.id}/valider`)));
              const validated = filteredPending;
              setPendingMosques(p => p.filter(m => !validated.some(v => v.id === m.id)));
              setMosques(p => [...validated.map(m => ({ ...m, statut: 'Validee' })), ...p]);
              validated.forEach(m => dispatch({
                type: 'MOSQUE_REGISTER',
                payload: { id: `db_${m.id}`, nom: m.nom, adresse: m.adresse ?? '', latitude: m.latitude, longitude: m.longitude, source: 'user' },
              }));
              if (apiUser?.id) {
                apiClient.get(`/api/abonnement/utilisateur/${apiUser.id}`)
                  .then(res => dispatch({ type: 'SUBSCRIPTIONS_LOADED', payload: res.data }))
                  .catch(() => {});
              }
            } catch {
              Alert.alert(t('admin.add_error'), t('admin.validate_all_error'));
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const deleteSelectedDecl = () => {
    const toDelete = filteredDecl.filter(d => selectedDeclIds.has(d.id));
    if (toDelete.length === 0) return;
    Alert.alert(
      t('admin.decl_delete_selected_title'),
      t('admin.decl_delete_selected_confirm', { count: toDelete.length }),
      [
        { text: t('admin.delete_cancel'), style: 'cancel' },
        {
          text: t('admin.delete_selection', { count: toDelete.length }),
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              await Promise.all(toDelete.map(d => apiClient.delete(`/api/PriereJanaza/${d.id}`)));
              const deletedIds = new Set(toDelete.map(d => d.id));
              setDeclarations(p => p.filter(d => !deletedIds.has(d.id)));
              toDelete.forEach(d => dispatch({ type: 'JANAZA_DELETE', payload: { id: String(d.id) } }));
              dispatch({ type: 'FORCE_DATA_REFRESH' });
              apiClient.get('/api/prierejanaza/upcoming').then(res => dispatch({ type: 'JANAZAS_LOADED', payload: res.data })).catch(() => {});
              if (apiUser?.id) {
                apiClient.get(`/api/prierejanaza/utilisateur/${apiUser.id}`)
                  .then(res => dispatch({ type: 'MY_DECLARATIONS_LOADED', payload: res.data }))
                  .catch(() => {});
              }
              exitDeclSelectMode();
            } catch {
              Alert.alert(t('admin.add_error'), t('admin.delete_all_error'));
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const deleteDeclByDateRange = () => {
    if (filteredDecl.length === 0) return;
    Alert.alert(
      t('admin.decl_date_range_delete_title'),
      t('admin.decl_date_range_delete_confirm', { count: filteredDecl.length }),
      [
        { text: t('admin.delete_cancel'), style: 'cancel' },
        {
          text: t('admin.delete_all'),
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              await Promise.all(filteredDecl.map(d => apiClient.delete(`/api/PriereJanaza/${d.id}`)));
              const deletedIds = new Set(filteredDecl.map(d => d.id));
              setDeclarations(p => p.filter(d => !deletedIds.has(d.id)));
              filteredDecl.forEach(d => dispatch({ type: 'JANAZA_DELETE', payload: { id: String(d.id) } }));
              dispatch({ type: 'FORCE_DATA_REFRESH' });
              setDeclDateFrom(null);
              setDeclDateTo(null);
              apiClient.get('/api/prierejanaza/upcoming').then(res => dispatch({ type: 'JANAZAS_LOADED', payload: res.data })).catch(() => {});
              if (apiUser?.id) {
                apiClient.get(`/api/prierejanaza/utilisateur/${apiUser.id}`)
                  .then(res => dispatch({ type: 'MY_DECLARATIONS_LOADED', payload: res.data }))
                  .catch(() => {});
              }
            } catch {
              Alert.alert(t('admin.add_error'), t('admin.delete_all_error'));
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const deleteDeclaration = (id, label) =>
    confirmDelete('/api/PriereJanaza', id, label, () => {
      setDeclarations(p => p.filter(d => d.id !== id));
      dispatch({ type: 'JANAZA_DELETE', payload: { id: String(id) } });
      dispatch({ type: 'FORCE_DATA_REFRESH' });
      apiClient.get('/api/prierejanaza/upcoming')
        .then(res => dispatch({ type: 'JANAZAS_LOADED', payload: res.data }))
        .catch(() => {});
      if (apiUser?.id) {
        apiClient.get(`/api/prierejanaza/utilisateur/${apiUser.id}`)
          .then(res => dispatch({ type: 'MY_DECLARATIONS_LOADED', payload: res.data }))
          .catch(() => {});
      }
    });

  const deleteUser = (id, label) =>
    confirmDelete('/api/Utilisateur', id, label, () => setUsers(p => p.filter(u => u.id !== id)));

  const deleteDbMosque = (id, nom) =>
    confirmDelete('/api/Mosquee', id, nom, () => {
      setDbMosques(p => p.filter(m => m.id !== id));
      refreshAllData(dispatch, apiUser?.id);
    });

  const openEditDbMosque = (m) => {
    setEditDbMosque(m);
    setEditDbMosqueForm({ nom: m.nom ?? '', adresse: m.adresse ?? '', latitude: String(m.latitude ?? ''), longitude: String(m.longitude ?? '') });
  };

  const saveDbMosque = async () => {
    try {
      let lat = parseFloat(editDbMosqueForm.latitude);
      let lon = parseFloat(editDbMosqueForm.longitude);
      const adresseChanged = (editDbMosqueForm.adresse || null) !== (editDbMosque.adresse ?? null);
      if (adresseChanged && editDbMosqueForm.adresse.trim()) {
        const c = await geocodeAddress(editDbMosqueForm.adresse.trim());
        if (c) {
          lat = c.lat;
          lon = c.lon;
          setEditDbMosqueForm(f => ({ ...f, latitude: String(lat), longitude: String(lon) }));
        }
      }
      await apiClient.put(`/api/Mosquee/${editDbMosque.id}`, {
        nom: editDbMosqueForm.nom,
        adresse: editDbMosqueForm.adresse || null,
        latitude: lat,
        longitude: lon,
      });
      setDbMosques(p => p.map(m => m.id === editDbMosque.id
        ? { ...m, nom: editDbMosqueForm.nom, adresse: editDbMosqueForm.adresse || null, latitude: lat, longitude: lon }
        : m
      ));
      setEditDbMosque(null);
      dispatch({ type: 'FORCE_DATA_REFRESH' });
      apiClient.get('/api/prierejanaza/upcoming')
        .then(res => dispatch({ type: 'JANAZAS_LOADED', payload: res.data }))
        .catch(() => {});
      if (apiUser?.id) {
        apiClient.get(`/api/abonnement/utilisateur/${apiUser.id}`)
          .then(res => dispatch({ type: 'SUBSCRIPTIONS_LOADED', payload: res.data }))
          .catch(() => {});
        apiClient.get(`/api/prierejanaza/utilisateur/${apiUser.id}`)
          .then(res => dispatch({ type: 'MY_DECLARATIONS_LOADED', payload: res.data }))
          .catch(() => {});
      }
    } catch {
      Alert.alert(t('admin.add_error'), t('admin.validate_error'));
    }
  };

  // Filtered lists
  const q = (s) => normalize(s);

  /**
   * Ville et pays viennent du géocodage inverse fait à l'enregistrement, pas
   * d'une lecture de l'adresse : la base les porte en colonnes. Une mosquée
   * peut n'en avoir aucun — Nominatim ne connaît pas tous les points — et
   * elle doit alors rester visible tant qu'aucun filtre n'est posé, sans quoi
   * elle disparaîtrait de l'administration sans explication.
   */
  const correspondLieu = (m, ville, pays) =>
    (ville === TOUTES || m.ville === ville) &&
    (pays === TOUTES || m.pays === pays);

  const listerLieux = (liste, champ, pays) => {
    const vues = new Set();
    for (const m of liste) {
      if (pays && pays !== TOUTES && m.pays !== pays) continue;
      if (m[champ]) vues.add(m[champ]);
    }
    return [...vues].sort((a, b) => a.localeCompare(b, 'fr'));
  };

  // Les villes proposées se restreignent au pays choisi : proposer Montréal
  // quand « France » est sélectionné offre un filtre qui ne rendra rien.
  //
  // L'onglet Masadjid couvre DEUX listes — les validées et celles en attente —
  // qui partagent le même filtre. Les options doivent donc venir des deux :
  // sinon une ville présente uniquement parmi les mosquées en attente serait
  // introuvable dans la liste déroulante du sous-onglet qui l'affiche.
  const toutesMosquesOnglet = [...mosques, ...pendingMosques];
  const villesMosque = listerLieux(toutesMosquesOnglet, 'ville', paysMosque);
  const paysMosqueOptions = listerLieux(toutesMosquesOnglet, 'pays', null);
  const villesDb = listerLieux(dbMosques, 'ville', paysDb);
  const paysDbOptions = listerLieux(dbMosques, 'pays', null);

  // Le tri s'applique APRÈS le filtrage, sur la copie déjà produite par
  // .filter() — trier la source réordonnerait les listes des autres onglets.
  const parDate = (liste, champ, sens) =>
    liste.sort((a, b) => {
      const da = new Date(a[champ] ?? 0), db_ = new Date(b[champ] ?? 0);
      return sens === 'recent' ? db_ - da : da - db_;
    });

  const filteredMosques = parDate(mosques.filter(m =>
    (!searchMosque || q(m.nom ?? '').includes(q(searchMosque)) || q(m.adresse ?? '').includes(q(searchMosque)))
    && correspondLieu(m, villeMosque, paysMosque)
  ), 'dateCreation', triMosque);

  const filteredDbMosques = parDate(dbMosques.filter(m =>
    (!searchDbMosque || q(m.nom ?? '').includes(q(searchDbMosque)) || q(m.adresse ?? '').includes(q(searchDbMosque)))
    && correspondLieu(m, villeDb, paysDb)
  ), 'dateCreation', triDb);

  const filteredPending = parDate(pendingMosques.filter(m =>
    (!searchPending || q(m.nom ?? '').includes(q(searchPending)) || q(m.adresse ?? '').includes(q(searchPending)))
    && correspondLieu(m, villeMosque, paysMosque)
  ), 'dateCreation', triMosque);
  const allPendingSelected = filteredPending.length > 0 && selectedPendingIds.size === filteredPending.length;
  const toggleSelectAllPending = () => {
    if (allPendingSelected) setSelectedPendingIds(new Set());
    else setSelectedPendingIds(new Set(filteredPending.map(m => m.id)));
  };

  useEffect(() => { setPendingSelectMode(false); setSelectedPendingIds(new Set()); }, [tab, mosqueSubTab]);
  useEffect(() => { setDeclSubTab(0); setImportSearchUser(''); }, [tab]);
  useEffect(() => { setDeclSelectMode(false); setSelectedDeclIds(new Set()); setDeclDateFrom(null); setDeclDateTo(null); }, [tab]);
  const usersById = Object.fromEntries(users.map(u => [u.id, u]));

  const filteredDecl = declarations
    .filter(d => {
      const matchSearch = !searchDecl ||
        q(d.nomDefunt ?? '').includes(q(searchDecl)) ||
        q(d.mosqueeNom ?? '').includes(q(searchDecl)) ||
        q(d.commentaire ?? '').includes(q(searchDecl));
      const matchGender = genderFilter === 'all' || d.genre === genderFilter;
      const dDate = parseUtc(d.dateHeurePriere);
      const matchFrom = !declDateFrom || (dDate && dDate >= declDateFrom);
      const matchTo = !declDateTo || (dDate && dDate <= new Date(declDateTo.getFullYear(), declDateTo.getMonth(), declDateTo.getDate(), 23, 59, 59, 999));
      return matchSearch && matchGender && matchFrom && matchTo;
    })
    .sort((a, b) => new Date(b.dateCreation ?? b.dateHeurePriere) - new Date(a.dateCreation ?? a.dateHeurePriere));
  const allDeclSelected = filteredDecl.length > 0 && selectedDeclIds.size === filteredDecl.length;
  const histoDecl = historique.filter(h => {
    if (!searchHisto) return true;
    const qS = q(searchHisto);
    return q(h.nomDefunt ?? '').includes(qS) ||
      q(h.mosqueeNom ?? '').includes(qS) ||
      q(h.villeEnterrement ?? '').includes(qS) ||
      q(h.pays ?? '').includes(qS) ||
      q(getCountryName(h.pays, 'fr') ?? '').includes(qS) ||
      q(`${h.declarantPrenom ?? ''} ${h.declarantNom ?? ''}`).includes(qS);
  });
  const toggleSelectAllDecl = () => {
    if (allDeclSelected) setSelectedDeclIds(new Set());
    else setSelectedDeclIds(new Set(filteredDecl.map(d => d.id)));
  };
  const filteredUsers = parDate(users.filter(u => {
    const matchSearch = !searchUser ||
      q(u.prenom ?? '').includes(q(searchUser)) ||
      q(u.nom ?? '').includes(q(searchUser)) ||
      q(u.email ?? '').includes(q(searchUser));
    const isAdmin = u.email === SUPER_ADMIN_EMAIL || u._role === 'Admin';
    const matchRole =
      roleFilter === 'all' ||
      (roleFilter === 'admin' && isAdmin) ||
      (roleFilter === 'user' && !isAdmin);
    return matchSearch && matchRole;
  }), 'dateInscription', triUser);

  const filteredImportUsers = users.filter(u => {
    const isAdmin = u.email === SUPER_ADMIN_EMAIL || u._role === 'Admin';
    if (isAdmin) return false;
    return !importSearchUser ||
      q(u.prenom ?? '').includes(q(importSearchUser)) ||
      q(u.nom ?? '').includes(q(importSearchUser)) ||
      q(u.email ?? '').includes(q(importSearchUser));
  });

  const handleToggleImport = async (userId, newValue) => {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, canImportFlyer: newValue } : u));
    try {
      const res = await apiClient.put(`/api/utilisateur/${userId}/import-flyer`, { canImportFlyer: newValue });
      console.log('[Admin] import-flyer updated →', res.data?.canImportFlyer, 'for user', userId);
    } catch (err) {
      console.error('[Admin] import-flyer error:', err?.response?.status, err?.response?.data);
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, canImportFlyer: !newValue } : u));
      Alert.alert(t('admin.add_error'), err?.response?.data?.error ?? t('admin.import_permission_error'));
    }
  };

  const handleAutoriserTous = async () => {
    setImportBulkLoading(true);
    try {
      await apiClient.put('/api/utilisateur/import-flyer/bulk', { canImportFlyer: true });
      setUsers(prev => prev.map(u => {
        const isAdmin = u.email === SUPER_ADMIN_EMAIL || u._role === 'Admin';
        return isAdmin ? u : { ...u, canImportFlyer: true };
      }));
    } catch {
      Alert.alert(t('admin.add_error'), t('admin.import_bulk_error'));
    } finally {
      setImportBulkLoading(false);
    }
  };

  const handleRefuserTous = async () => {
    setImportBulkLoading(true);
    try {
      await apiClient.put('/api/utilisateur/import-flyer/bulk', { canImportFlyer: false });
      setUsers(prev => prev.map(u => {
        const isAdmin = u.email === SUPER_ADMIN_EMAIL || u._role === 'Admin';
        return isAdmin ? u : { ...u, canImportFlyer: false };
      }));
    } catch {
      Alert.alert(t('admin.add_error'), t('admin.import_bulk_error'));
    } finally {
      setImportBulkLoading(false);
    }
  };

  async function handleImportTxt() {
    if (!importTxtContent.trim()) return;
    setImportTxtLoading(true);
    setImportTxtResult(null);
    setImportSummary(null);
    try {
      const res = await apiClient.post('/api/admin/textimport', { text: importTxtContent });
      const token = res.data.token;
      setImportTxtResult({ url: res.data.url, filename: res.data.filename, token });
      setImportTxtLoading(false);
      // Démarrer le polling pour récupérer le résumé une fois que n8n a tout traité
      setImportTxtPolling(true);
      let attempts = 0;
      const maxAttempts = 60; // 5 minutes max (5s * 60)
      pollIntervalRef.current = setInterval(async () => {
        attempts++;
        try {
          const poll = await apiClient.get(`/api/admin/textimport/${token}/summary`);
          if (poll.data?.ready) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
            setImportTxtPolling(false);
            setImportSummary(poll.data);
            setShowSummaryModal(true);
            refreshAllData(dispatch, apiUser?.id);
          }
        } catch {}
        if (attempts >= maxAttempts) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
          setImportTxtPolling(false);
        }
      }, 5000);
    } catch (err) {
      setImportTxtResult({ error: err?.response?.data?.error ?? t('admin.import_txt_error') });
      setImportTxtLoading(false);
    }
  }

  useEffect(() => {
    return () => { if (pollIntervalRef.current) clearInterval(pollIntervalRef.current); };
  }, []);

  const refreshControl = <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />;

  /**
   * Lance le remplissage de ville et pays, par lots.
   *
   * Nominatim impose une requête par seconde : les 480 mosquées prennent
   * environ huit minutes, bien au-delà de ce qu'une requête HTTP supporte.
   * On enchaîne donc des lots de soixante jusqu'à ce qu'il ne reste rien, et
   * on rafraîchit entre chaque — la progression est visible au lieu d'être
   * une attente aveugle.
   */
  /**
   * Donne le départ du rattrapage, puis suit son avancement.
   *
   * POURQUOI LE TÉLÉPHONE NE FAIT PLUS LE TRAVAIL
   * ---------------------------------------------
   * La version précédente enchaînait les lots depuis l'application : sept
   * cents mosquées à une requête par seconde, c'était une douzaine de minutes
   * pendant lesquelles il fallait garder l'écran allumé, l'application au
   * premier plan et le réseau stable. Un verrouillage, une navigation, un
   * appel entrant, et la chaîne se brisait.
   *
   * Désormais le serveur travaille seul. L'application donne le départ, puis
   * demande l'avancement toutes les cinq secondes — et peut être fermée sans
   * rien interrompre.
   */
  const lancerRattrapage = async () => {
    setRattrapageLoading(true);
    setRattrapageEtat(null);
    try {
      await apiClient.post('/api/Mosquee/lieux/rattrapage');
    } catch (e) {
      // Le motif est nommé : « échec » sans cause laisse chercher au hasard
      // entre un serveur pas à jour, une panne réseau et un délai dépassé.
      const statut = e?.response?.status;
      const cause =
        e?.code === 'ECONNABORTED' ? 'Délai d’attente dépassé.'
        : statut === 404 ? 'Fonction absente du serveur : l’API n’est pas encore à jour.'
        : statut ? `Le serveur a répondu ${statut}.`
        : 'Serveur injoignable.';

      setRattrapageLoading(false);
      Alert.alert('Localisation impossible', cause);
    }
  };

  // Le suivi : tant qu'un rattrapage tourne, on demande l'avancement. L'effet
  // se nettoie tout seul, donc quitter l'écran n'arrête que la surveillance —
  // jamais le travail, qui se poursuit sur le serveur.
  useEffect(() => {
    if (!rattrapageLoading) return;

    let vivant = true;
    let minuteur;

    const interroger = async () => {
      try {
        const { data } = await apiClient.get('/api/Mosquee/lieux/etat');
        if (!vivant) return;
        setRattrapageEtat(data);

        if (data.enCours) {
          minuteur = setTimeout(interroger, 5000);
          return;
        }

        setRattrapageLoading(false);
        await loadDbMosques();
        await loadData();
        Alert.alert(
          'Localisation terminée',
          `${data.traitees ?? 0} mosquée(s) localisée(s).` +
          (data.restantes > 0
            ? `\n\n${data.restantes} sans résultat : le service ne reconnaît pas leurs coordonnées. ` +
              `Elles restent visibles et seront retentées au prochain lancement.`
            : '')
        );
      } catch {
        if (!vivant) return;
        // Une interrogation ratée n'est pas un échec du traitement : le
        // serveur continue. On réessaiera au prochain tour.
        minuteur = setTimeout(interroger, 5000);
      }
    };

    interroger();
    return () => { vivant = false; clearTimeout(minuteur); };
  }, [rattrapageLoading, loadData]);

  /** Les deux listes déroulantes de lieu et la bascule de tri, sous la recherche. */
  const barreFiltres = ({ villeSel, paysSel, cleVille, clePays, tri, setTri }) => (
    <View style={styles.barreFiltres}>
      <BoutonCombo
        libelle="Toutes les villes"
        valeur={villeSel}
        actif={villeSel !== TOUTES}
        onPress={() => setComboOuvert(cleVille)}
      />
      <BoutonCombo
        libelle="Tous les pays"
        valeur={paysSel}
        actif={paysSel !== TOUTES}
        onPress={() => setComboOuvert(clePays)}
      />
      <BoutonTri valeur={tri} onChange={setTri} />
    </View>
  );

  // Une seule fenêtre pour les quatre listes déroulantes : `comboOuvert` dit
  // laquelle est ouverte. Quatre composants montés en permanence ne feraient
  // que quadrupler l'état pour un seul visible à la fois.
  const comboCourant = {
    villeMosque: { items: villesMosque, selected: villeMosque, onSelect: setVilleMosque, titre: 'Ville', tous: 'Toutes les villes' },
    paysMosque:  { items: paysMosqueOptions, selected: paysMosque, onSelect: setPaysMosque, titre: 'Pays', tous: 'Tous les pays' },
    villeDb:     { items: villesDb, selected: villeDb, onSelect: setVilleDb, titre: 'Ville', tous: 'Toutes les villes' },
    paysDb:      { items: paysDbOptions, selected: paysDb, onSelect: setPaysDb, titre: 'Pays', tous: 'Tous les pays' },
  }[comboOuvert];

  return (
    <SafeAreaView style={styles.container}>
      <ScreenBackground>

      <ListeChoixModal
        visible={!!comboCourant}
        items={comboCourant?.items ?? []}
        selected={comboCourant?.selected ?? TOUTES}
        onSelect={v => comboCourant?.onSelect(v)}
        onClose={() => setComboOuvert(null)}
        titre={comboCourant?.titre ?? ''}
        libelleTous={comboCourant?.tous ?? ''}
      />

      <CalendarModal visible={showDeclCalFrom} selectedDate={declDateFrom} onSelect={d => { setDeclDateFrom(d); setShowDeclCalFrom(false); }} onClose={() => setShowDeclCalFrom(false)} />
      <CalendarModal visible={showDeclCalTo} selectedDate={declDateTo} onSelect={d => { setDeclDateTo(d); setShowDeclCalTo(false); }} onClose={() => setShowDeclCalTo(false)} />

      {/* Modal résumé d'importation texte */}
      <Modal
        visible={showSummaryModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSummaryModal(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowSummaryModal(false)}>
          <View style={styles.summaryOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.summaryBox}>
                <View style={styles.summaryHeader}>
                  <Ionicons name="checkmark-circle" size={22} color={colors.success} />
                  <Text style={styles.summaryTitle}>{t('admin.import_summary_title')}</Text>
                </View>
                <Text style={styles.summaryStats}>
                  {t('admin.import_summary_stats', {
                    total: importSummary?.total ?? 0,
                    success: importSummary?.success ?? 0,
                    skipped: importSummary?.skipped ?? 0,
                  })}
                </Text>
                {importSummary?.skipped > 0 && (
                  <>
                    <Text style={styles.summarySkippedTitle}>{t('admin.import_summary_skipped_title')}</Text>
                    <ScrollView style={styles.summarySkippedList} nestedScrollEnabled>
                      {(importSummary?.skippedEntries ?? []).map((e, i) => (
                        <View key={i} style={styles.summarySkippedItem}>
                          <Ionicons name="location-outline" size={13} color={colors.textMuted} />
                          <View style={{ flex: 1, marginLeft: 6 }}>
                            <Text style={styles.summarySkippedMosque}>{e.mosqueeNom}</Text>
                            {e.nomDefunt ? <Text style={styles.summarySkippedDefunt}>{formatNomDefunt(e.nomDefunt)}</Text> : null}
                            <Text style={styles.summarySkippedReason}>
                              {e.reason === 'GEOCODING_FAILED' ? t('admin.import_skip_geocoding') : t('admin.import_skip_conflict')}
                            </Text>
                          </View>
                        </View>
                      ))}
                    </ScrollView>
                  </>
                )}
                <TouchableOpacity style={styles.summaryCloseBtn} onPress={() => setShowSummaryModal(false)} activeOpacity={0.8}>
                  <Text style={styles.summaryCloseBtnText}>{t('admin.import_summary_close')}</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
      <ScreenHeader title={t('admin.title')} icon="shield-checkmark" />

      <View style={styles.tabs}>
        {SECTIONS.map((s, i) => (
          <TouchableOpacity
            key={s}
            style={[styles.tab, tab === i && styles.tabActive]}
            onPress={() => setTab(i)}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, tab === i && styles.tabTextActive]}>{s}</Text>
            {tab === i && i !== 4 && (
              <Text style={styles.tabCount}>
                {i === 0 ? filteredMosques.length : i === 1 ? filteredDbMosques.length : i === 2 ? filteredDecl.length : filteredUsers.length}
              </Text>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {loading && !refreshing ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : (
        <>
          {/* MOSQUÉES */}
          {tab === 0 && (
            <>
              <View style={styles.subTabs}>
                <TouchableOpacity style={[styles.subTab, mosqueSubTab === 0 && styles.subTabActive]} onPress={() => setMosqueSubTab(0)} activeOpacity={0.7}>
                  <Text style={[styles.subTabText, mosqueSubTab === 0 && styles.subTabTextActive]}>{t('admin.filter_all')}</Text>
                  <Text style={[styles.subTabCount, mosqueSubTab === 0 && styles.subTabCountActive]}>{filteredMosques.length}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.subTab, mosqueSubTab === 1 && styles.subTabActive]} onPress={() => setMosqueSubTab(1)} activeOpacity={0.7}>
                  <Text style={[styles.subTabText, mosqueSubTab === 1 && styles.subTabTextActive]}>{t('admin.pending')}</Text>
                  {pendingMosques.length > 0 && (
                    <View style={styles.pendingBadge}><Text style={styles.pendingBadgeText}>{pendingMosques.length}</Text></View>
                  )}
                </TouchableOpacity>
              </View>

              {mosqueSubTab === 0 ? (
                <FlatList
                  data={filteredMosques}
                  keyExtractor={item => String(item.id)}
                  contentContainerStyle={styles.list}
                  refreshControl={refreshControl}
                  ListHeaderComponent={
                    <View>
                      <SearchBar value={searchMosque} onChange={setSearchMosque} placeholder={t('admin.search_mosques')} />
                      {barreFiltres({
                        villeSel: villeMosque, paysSel: paysMosque,
                        cleVille: 'villeMosque', clePays: 'paysMosque',
                        tri: triMosque, setTri: setTriMosque,
                      })}
                    </View>
                  }
                  ListEmptyComponent={
                    // Un filtre de ville actif produit une liste vide sans
                    // qu'aucune recherche soit saisie : dire « aucune mosquée »
                    // laisserait croire que la base est vide.
                    <EmptyState
                      label={(searchMosque || villeMosque !== TOUTES || paysMosque !== TOUTES)
                        ? t('admin.no_results')
                        : t('admin.no_mosques')}
                      icon="business-outline"
                    />
                  }
                  renderItem={({ item }) => (
                    <Row title={item.nom} subtitle={item.adresse ?? '—'} onEdit={() => setEditMosque(item)} onDelete={() => deleteMosque(item.id, item.nom)} />
                  )}
                />
              ) : (
                <FlatList
                  data={filteredPending}
                  keyExtractor={item => String(item.id)}
                  contentContainerStyle={styles.list}
                  refreshControl={refreshControl}
                  ListHeaderComponent={
                    <View>
                      <SearchBar value={searchPending} onChange={setSearchPending} placeholder={t('admin.search_mosques')} />
                      {barreFiltres({
                        villeSel: villeMosque, paysSel: paysMosque,
                        cleVille: 'villeMosque', clePays: 'paysMosque',
                        tri: triMosque, setTri: setTriMosque,
                      })}
                      {filteredPending.length > 0 && (
                        pendingSelectMode ? (
                          <View>
                            <View style={styles.selectHeader}>
                              <TouchableOpacity style={styles.selectAllBtn} onPress={toggleSelectAllPending} activeOpacity={0.7}>
                                <Ionicons name={allPendingSelected ? 'checkbox' : 'square-outline'} size={20} color={colors.primary} />
                                <Text style={styles.selectAllText}>
                                  {allPendingSelected ? t('admin.deselect_all') : t('admin.select_all')}
                                </Text>
                              </TouchableOpacity>
                              <TouchableOpacity onPress={exitSelectMode} style={styles.selectCancelBtn} activeOpacity={0.7}>
                                <Text style={styles.selectCancelText}>{t('admin.delete_cancel')}</Text>
                              </TouchableOpacity>
                            </View>
                            {selectedPendingIds.size > 0 && (
                              <View style={styles.selectionActionsRow}>
                                <TouchableOpacity style={[styles.selectionActionBtn, { backgroundColor: '#22c55e' }]} onPress={validerSelection} activeOpacity={0.85}>
                                  <Ionicons name="checkmark-done-outline" size={15} color={colors.white} />
                                  <Text style={styles.selectionActionText}>{t('admin.validate_selection', { count: selectedPendingIds.size })}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.selectionActionBtn, { backgroundColor: colors.error }]} onPress={supprimerSelection} activeOpacity={0.85}>
                                  <Ionicons name="trash-outline" size={15} color={colors.white} />
                                  <Text style={styles.selectionActionText}>{t('admin.delete_selection', { count: selectedPendingIds.size })}</Text>
                                </TouchableOpacity>
                              </View>
                            )}
                          </View>
                        ) : (
                          <View>
                            <TouchableOpacity style={styles.validateAllBtn} onPress={validerAll} activeOpacity={0.85}>
                              <Ionicons name="checkmark-done-outline" size={16} color={colors.white} />
                              <Text style={styles.validateAllBtnText}>{t('admin.validate_all')} ({filteredPending.length})</Text>
                            </TouchableOpacity>
                            <View style={styles.pendingBulkRow}>
                              <TouchableOpacity style={[styles.bulkBtn, { backgroundColor: colors.error }]} onPress={supprimerAll} activeOpacity={0.85}>
                                <Ionicons name="trash-outline" size={15} color={colors.white} />
                                <Text style={styles.validateAllBtnText}>{t('admin.delete_all')}</Text>
                              </TouchableOpacity>
                              <TouchableOpacity style={[styles.bulkBtn, styles.bulkBtnOutline]} onPress={enterSelectMode} activeOpacity={0.85}>
                                <Ionicons name="checkbox-outline" size={15} color={colors.primary} />
                                <Text style={styles.bulkBtnOutlineText}>{t('admin.select_mode')}</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        )
                      )}
                    </View>
                  }
                  ListEmptyComponent={<EmptyState label={t('admin.no_pending')} icon="checkmark-circle-outline" />}
                  renderItem={({ item }) => (
                    <PendingMosqueRow
                      item={item}
                      onValider={() => validerMosque(item.id)}
                      onRefuser={() => refuserMosque(item.id, item.nom)}
                      onEdit={() => setEditPendingMosque(item)}
                      selectMode={pendingSelectMode}
                      selected={selectedPendingIds.has(item.id)}
                      onToggle={() => togglePendingSelect(item.id)}
                    />
                  )}
                />
              )}
            </>
          )}

          {/* MOSQUÉES BDD */}
          {tab === 1 && (
            <FlatList
              data={filteredDbMosques}
              keyExtractor={item => String(item.id)}
              contentContainerStyle={styles.list}
              refreshControl={refreshControl}
              ListHeaderComponent={
                <>
                  <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm }}>
                    <TouchableOpacity
                      style={[styles.normBtn, normLoading && styles.normBtnDisabled, { flex: 1 }]}
                      onPress={normaliserSansNom}
                      disabled={normLoading}
                      activeOpacity={0.7}
                    >
                      {normLoading
                        ? <ActivityIndicator size="small" color="#fff" />
                        : <Text style={styles.normBtnText}>Normalisation / Suppression doublon</Text>
                      }
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.normBtn, { paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', gap: 4 }]}
                      onPress={() => setShowAddDbMosque(true)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="add" size={18} color="#fff" />
                      <Text style={styles.normBtnText}>Ajouter</Text>
                    </TouchableOpacity>
                  </View>
                  {/* Renseigne ville et pays par géocodage inverse des
                      coordonnées. À relancer après chaque import OSM : il ne
                      traite que les mosquées qui n'ont pas encore de ville. */}
                  <TouchableOpacity
                    style={[styles.normBtn, styles.rattrapageBtn, rattrapageLoading && styles.normBtnDisabled]}
                    onPress={lancerRattrapage}
                    disabled={rattrapageLoading}
                    activeOpacity={0.7}
                  >
                    {rattrapageLoading
                      ? <>
                          <ActivityIndicator size="small" color="#fff" />
                          {/* L'avancement chiffré : sans lui, une douzaine de
                              minutes de rotation ressemble à un blocage. */}
                          <Text style={styles.normBtnText}>
                            {rattrapageEtat
                              ? `Localisation… ${rattrapageEtat.traitees ?? 0} sur ${rattrapageEtat.total ?? 0}`
                              : 'Localisation…'}
                          </Text>
                        </>
                      : <>
                          <Ionicons name="location-outline" size={16} color="#fff" />
                          <Text style={styles.normBtnText}>Localiser les mosquées (ville / pays)</Text>
                        </>
                    }
                  </TouchableOpacity>
                  <SearchBar value={searchDbMosque} onChange={setSearchDbMosque} placeholder="Rechercher par nom ou adresse…" />
                  {barreFiltres({
                    villeSel: villeDb, paysSel: paysDb,
                    cleVille: 'villeDb', clePays: 'paysDb',
                    tri: triDb, setTri: setTriDb,
                  })}
                </>
              }
              ListEmptyComponent={
                dbLoading
                  ? <ActivityIndicator color={colors.primary} style={styles.loader} />
                  : <EmptyState
                      label={(searchDbMosque || villeDb !== TOUTES || paysDb !== TOUTES)
                        ? 'Aucun résultat pour ces filtres'
                        : 'Aucune mosquée en base'}
                      icon="business-outline"
                    />
              }
              renderItem={({ item }) => (
                <View style={styles.dbMosqueRow}>
                  <View style={styles.dbMosqueInfo}>
                    <Text style={styles.dbMosqueNom} numberOfLines={1}>{item.nom}</Text>
                    {item.adresse ? <Text style={styles.dbMosqueAdresse} numberOfLines={1}>{item.adresse}</Text> : null}
                    <Text style={styles.dbMosqueCoords}>{item.latitude?.toFixed(5)}, {item.longitude?.toFixed(5)}</Text>
                  </View>
                  <View style={styles.dbMosqueActions}>
                    <TouchableOpacity style={styles.dbMosqueEditBtn} onPress={() => openEditDbMosque(item)} activeOpacity={0.7}>
                      <Ionicons name="pencil-outline" size={16} color={colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.dbMosqueDeleteBtn} onPress={() => deleteDbMosque(item.id, item.nom)} activeOpacity={0.7}>
                      <Ionicons name="trash-outline" size={16} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            />
          )}

          {/* DÉCLARATIONS */}
          {tab === 2 && (
            <>
              <View style={styles.subTabs}>
                <TouchableOpacity
                  style={[styles.subTab, declSubTab === 0 && styles.subTabActive]}
                  onPress={() => setDeclSubTab(0)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.subTabText, declSubTab === 0 && styles.subTabTextActive]}>Annonces</Text>
                  <Text style={[styles.subTabCount, declSubTab === 0 && styles.subTabCountActive]}>{filteredDecl.length}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.subTab, declSubTab === 1 && styles.subTabActive]}
                  onPress={() => setDeclSubTab(1)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.subTabText, declSubTab === 1 && styles.subTabTextActive]}>Import</Text>
                  <Text style={[styles.subTabCount, declSubTab === 1 && styles.subTabCountActive]}>{filteredImportUsers.length}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.subTab, declSubTab === 2 && styles.subTabActive]}
                  onPress={() => setDeclSubTab(2)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.subTabText, declSubTab === 2 && styles.subTabTextActive]}>Attente</Text>
                  {pendingDeclarations.length > 0 && (
                    <View style={styles.pendingBadge}><Text style={styles.pendingBadgeText}>{pendingDeclarations.length}</Text></View>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.subTab, declSubTab === 3 && styles.subTabActive]}
                  onPress={() => { setDeclSubTab(3); setImportTxtResult(null); }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.subTabText, declSubTab === 3 && styles.subTabTextActive]}>TXT</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.subTab, declSubTab === 4 && styles.subTabActive]}
                  onPress={() => { setDeclSubTab(4); setSearchHisto(''); }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.subTabText, declSubTab === 4 && styles.subTabTextActive]}>Historique</Text>
                  <Text style={[styles.subTabCount, declSubTab === 4 && styles.subTabCountActive]}>{histoDecl.length}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.subTab, declSubTab === 5 && styles.subTabActive]}
                  onPress={() => setDeclSubTab(5)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.subTabText, declSubTab === 5 && styles.subTabTextActive]}>Coms</Text>
                </TouchableOpacity>
              </View>

              {declSubTab === 0 && (
                <FlatList
                  data={filteredDecl}
                  keyExtractor={item => String(item.id)}
                  contentContainerStyle={styles.list}
                  refreshControl={refreshControl}
                  ListHeaderComponent={
                    <View>
                      <SearchBar value={searchDecl} onChange={setSearchDecl} placeholder={t('admin.search_declarations')} />
                      <View style={styles.genderFilterRow}>
                        {[
                          { key: 'all', label: t('admin.filter_all') },
                          { key: 'homme', label: t('admin.edit_male') },
                          { key: 'femme', label: t('admin.edit_female') },
                          { key: 'enfant', label: t('admin.edit_child') },
                        ].map(opt => (
                          <TouchableOpacity
                            key={opt.key}
                            style={[styles.filterChip, genderFilter === opt.key && styles.filterChipActive]}
                            onPress={() => setGenderFilter(opt.key)}
                            activeOpacity={0.7}
                          >
                            <Text style={[styles.filterChipText, genderFilter === opt.key && styles.filterChipTextActive]}>
                              {opt.label}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>

                      {/* Filtre par période */}
                      <View style={styles.declDateRangeRow}>
                        <TouchableOpacity style={styles.declDateRangeBtn} onPress={() => setShowDeclCalFrom(true)} activeOpacity={0.7}>
                          <Ionicons name="calendar-outline" size={13} color={declDateFrom ? colors.primary : colors.textMuted} />
                          <Text style={[styles.declDateRangeBtnText, !declDateFrom && { color: colors.textMuted }]} numberOfLines={1}>
                            {declDateFrom ? declDateFrom.toLocaleDateString(getDateLocale(i18n.language), { day: '2-digit', month: '2-digit', year: 'numeric' }) : t('admin.decl_date_from')}
                          </Text>
                        </TouchableOpacity>
                        <Text style={styles.declDateRangeSep}>→</Text>
                        <TouchableOpacity style={styles.declDateRangeBtn} onPress={() => setShowDeclCalTo(true)} activeOpacity={0.7}>
                          <Ionicons name="calendar-outline" size={13} color={declDateTo ? colors.primary : colors.textMuted} />
                          <Text style={[styles.declDateRangeBtnText, !declDateTo && { color: colors.textMuted }]} numberOfLines={1}>
                            {declDateTo ? declDateTo.toLocaleDateString(getDateLocale(i18n.language), { day: '2-digit', month: '2-digit', year: 'numeric' }) : t('admin.decl_date_to')}
                          </Text>
                        </TouchableOpacity>
                        {(declDateFrom || declDateTo) && (
                          <TouchableOpacity onPress={() => { setDeclDateFrom(null); setDeclDateTo(null); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                          </TouchableOpacity>
                        )}
                      </View>

                      {/* Supprimer par période */}
                      {(declDateFrom || declDateTo) && filteredDecl.length > 0 && !declSelectMode && (
                        <TouchableOpacity style={styles.declDateRangeDeleteBtn} onPress={deleteDeclByDateRange} activeOpacity={0.85}>
                          <Ionicons name="trash-outline" size={14} color={colors.white} />
                          <Text style={styles.declDateRangeDeleteBtnText}>{t('admin.decl_date_range_delete', { count: filteredDecl.length })}</Text>
                        </TouchableOpacity>
                      )}

                      {/* Mode sélection */}
                      {!declSelectMode ? (
                        <TouchableOpacity style={styles.declSelectModeBtn} onPress={enterDeclSelectMode} activeOpacity={0.85}>
                          <Ionicons name="checkbox-outline" size={15} color={colors.primary} />
                          <Text style={styles.declSelectModeBtnText}>{t('admin.select_mode')}</Text>
                        </TouchableOpacity>
                      ) : (
                        <View>
                          <View style={styles.selectHeader}>
                            <TouchableOpacity style={styles.selectAllBtn} onPress={toggleSelectAllDecl} activeOpacity={0.7}>
                              <Ionicons name={allDeclSelected ? 'checkbox' : 'square-outline'} size={20} color={colors.primary} />
                              <Text style={styles.selectAllText}>
                                {allDeclSelected ? t('admin.deselect_all') : t('admin.select_all')}
                              </Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={exitDeclSelectMode} style={styles.selectCancelBtn} activeOpacity={0.7}>
                              <Text style={styles.selectCancelText}>{t('admin.delete_cancel')}</Text>
                            </TouchableOpacity>
                          </View>
                          {selectedDeclIds.size > 0 && (
                            <TouchableOpacity style={[styles.selectionActionBtn, { backgroundColor: colors.error, marginBottom: spacing.sm }]} onPress={deleteSelectedDecl} activeOpacity={0.85}>
                              <Ionicons name="trash-outline" size={15} color={colors.white} />
                              <Text style={styles.selectionActionText}>{t('admin.delete_selection', { count: selectedDeclIds.size })}</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      )}
                    </View>
                  }
                  ListEmptyComponent={<EmptyState label={searchDecl ? t('admin.no_results') : t('admin.no_declarations')} icon="moon-outline" />}
                  renderItem={({ item }) => {
                    const declarant = usersById[item.utilisateurId];
                    const declarantNom = declarant
                      ? `${declarant.prenom ?? ''} ${declarant.nom ?? ''}`.trim()
                      : item.utilisateurId ? `#${item.utilisateurId}` : t('admin.anonymous_user');
                    const _dloc = getDateLocale(i18n.language);
                    const fmt = (raw) => parseUtc(raw)?.toLocaleDateString(_dloc, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) ?? null;
                    const fmtLocal = (raw) => parseUtc(raw)?.toLocaleDateString(_dloc, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) ?? null;
                    const dateDecl = fmtLocal(item.dateCreation);
                    return (
                      <Row
                        title={item.estAnonyme ? t('admin.edit_anonymous') : (formatNomDefunt(item.nomDefunt) || t('admin.deceased_unknown'))}
                        subtitle={[item.mosqueeNom, fmt(item.dateHeurePriere)].filter(Boolean).join(' · ')}
                        extra={[dateDecl ? t('admin.declared_on', { date: dateDecl }) : null, t('admin.declared_by', { name: declarantNom })].filter(Boolean).join(' · ')}
                        onEdit={declSelectMode ? null : () => setEditDecl(item)}
                        onDelete={declSelectMode ? null : () => deleteDeclaration(
                          item.id,
                          item.estAnonyme ? t('admin.edit_anonymous') : (formatNomDefunt(item.nomDefunt) || `#${item.id}`)
                        )}
                        selectMode={declSelectMode}
                        selected={selectedDeclIds.has(item.id)}
                        onToggle={() => toggleDeclSelect(item.id)}
                      />
                    );
                  }}
                />
              )}

              {declSubTab === 1 && (
                <FlatList
                  data={filteredImportUsers}
                  keyExtractor={item => String(item.id)}
                  contentContainerStyle={styles.list}
                  refreshControl={refreshControl}
                  ListHeaderComponent={
                    <View>
                      <SearchBar
                        value={importSearchUser}
                        onChange={setImportSearchUser}
                        placeholder={t('admin.import_search_placeholder')}
                      />
                      <View style={styles.importBulkRow}>
                        <TouchableOpacity
                          style={[styles.importBulkBtn, styles.importBulkBtnGreen, importBulkLoading && { opacity: 0.6 }]}
                          onPress={handleAutoriserTous}
                          disabled={importBulkLoading}
                          activeOpacity={0.8}
                        >
                          {importBulkLoading
                            ? <ActivityIndicator size="small" color={colors.white} />
                            : <><Ionicons name="checkmark-circle-outline" size={15} color={colors.white} /><Text style={styles.importBulkBtnText}>{t('admin.import_authorize_all')}</Text></>
                          }
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.importBulkBtn, styles.importBulkBtnRed, importBulkLoading && { opacity: 0.6 }]}
                          onPress={handleRefuserTous}
                          disabled={importBulkLoading}
                          activeOpacity={0.8}
                        >
                          {importBulkLoading
                            ? <ActivityIndicator size="small" color={colors.white} />
                            : <><Ionicons name="close-circle-outline" size={15} color={colors.white} /><Text style={styles.importBulkBtnText}>{t('admin.import_refuse_all')}</Text></>
                          }
                        </TouchableOpacity>
                      </View>
                    </View>
                  }
                  ListEmptyComponent={<EmptyState label={t('admin.import_no_users')} icon="people-outline" />}
                  renderItem={({ item }) => (
                    <View style={styles.importUserRow}>
                      <View style={styles.importUserInfo}>
                        <Text style={styles.importUserName} numberOfLines={1}>
                          {`${item.prenom ?? ''} ${item.nom ?? ''}`.trim() || '—'}
                        </Text>
                        <Text style={styles.importUserEmail} numberOfLines={1}>{item.email ?? '—'}</Text>
                      </View>
                      <View style={styles.importUserRight}>
                        <Text style={[styles.importPermLabel, item.canImportFlyer && styles.importPermLabelActive]}>
                          {t('admin.import_permission_label')}
                        </Text>
                        <Switch
                          value={item.canImportFlyer ?? false}
                          onValueChange={(v) => handleToggleImport(item.id, v)}
                          trackColor={{ false: colors.border, true: colors.primary }}
                          thumbColor={colors.white}
                        />
                      </View>
                    </View>
                  )}
                />
              )}

              {declSubTab === 2 && (
                <FlatList
                  data={pendingDeclarations}
                  keyExtractor={item => String(item.id)}
                  contentContainerStyle={styles.list}
                  refreshControl={refreshControl}
                  ListEmptyComponent={<EmptyState label={t('admin.no_declarations')} icon="time-outline" />}
                  renderItem={({ item }) => {
                    const _dloc = getDateLocale(i18n.language);
                    const fmt = (raw) => parseUtc(raw)?.toLocaleDateString(_dloc, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) ?? null;
                    const fmtLocal = (raw) => parseUtc(raw)?.toLocaleDateString(_dloc, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) ?? null;
                    return (
                      <Row
                        title={item.estAnonyme ? t('admin.edit_anonymous') : (formatNomDefunt(item.nomDefunt) || t('admin.deceased_unknown'))}
                        subtitle={[item.mosqueeNom, fmt(item.dateHeurePriere)].filter(Boolean).join(' · ')}
                        extra={t('admin.declared_on', { date: fmtLocal(item.dateCreation) ?? '—' })}
                      />
                    );
                  }}
                />
              )}

              {declSubTab === 3 && (
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
                  <ScrollView contentContainerStyle={styles.importTxtContainer} keyboardShouldPersistTaps="handled">
                    <Text style={styles.importTxtLabel}>{t('admin.import_txt_label')}</Text>
                    <View style={{ position: 'relative' }}>
                      <TextInput
                        style={styles.importTxtInput}
                        multiline
                        value={importTxtContent}
                        onChangeText={setImportTxtContent}
                        placeholder={t('admin.import_txt_placeholder')}
                        placeholderTextColor={colors.textMuted}
                        textAlignVertical="top"
                      />
                      {!!importTxtContent && (
                        <TouchableOpacity
                          onPress={() => { setImportTxtContent(''); setImportTxtResult(null); }}
                          style={styles.importTxtClear}
                          activeOpacity={0.7}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons name="close-circle" size={20} color={colors.textMuted} />
                        </TouchableOpacity>
                      )}
                    </View>
                    <TouchableOpacity
                      style={[styles.importTxtBtn, (!importTxtContent.trim() || importTxtLoading) && { opacity: 0.5 }]}
                      onPress={handleImportTxt}
                      disabled={!importTxtContent.trim() || importTxtLoading}
                      activeOpacity={0.8}
                    >
                      {importTxtLoading
                        ? <ActivityIndicator size="small" color={colors.white} />
                        : (
                          <>
                            <Ionicons name="cloud-upload-outline" size={17} color={colors.white} />
                            <Text style={styles.importTxtBtnText}>{t('admin.import_txt_send')}</Text>
                          </>
                        )
                      }
                    </TouchableOpacity>

                    {importTxtResult && !importTxtResult.error && (
                      <View style={styles.importTxtSuccess}>
                        <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.importTxtSuccessText}>{t('admin.import_txt_success')}</Text>
                          <Text style={styles.importTxtFilename} numberOfLines={1}>{importTxtResult.filename}</Text>
                        </View>
                      </View>
                    )}
                    {importTxtPolling && (
                      <View style={styles.importTxtPolling}>
                        <ActivityIndicator size="small" color={colors.primary} />
                        <Text style={styles.importTxtPollingText}>{t('admin.import_txt_processing')}</Text>
                      </View>
                    )}

                    {importTxtResult?.error && (
                      <View style={styles.importTxtError}>
                        <Ionicons name="alert-circle-outline" size={20} color={colors.error} />
                        <Text style={styles.importTxtErrorText}>{importTxtResult.error}</Text>
                      </View>
                    )}
                  </ScrollView>
                </KeyboardAvoidingView>
              )}

              {declSubTab === 4 && (
                <FlatList
                  data={histoDecl}
                  keyExtractor={item => String(item.id)}
                  contentContainerStyle={styles.list}
                  refreshing={histoLoading}
                  onRefresh={loadHistorique}
                  ListHeaderComponent={
                    <SearchBar value={searchHisto} onChange={setSearchHisto} placeholder="Rechercher dans l'historique..." />
                  }
                  ListEmptyComponent={<EmptyState label="Aucun historique" icon="time-outline" />}
                  renderItem={({ item }) => {
                    const _dloc = getDateLocale(i18n.language);
                    const fmtLocal = (raw) => parseUtc(raw)?.toLocaleDateString(_dloc, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) ?? null;
                    const dateDecl = fmtLocal(item.dateCreation);
                    const declarantNom = `${item.declarantPrenom ?? ''} ${item.declarantNom ?? ''}`.trim() || t('admin.anonymous_user');
                    return (
                      <Row
                        title={item.estAnonyme ? t('admin.edit_anonymous') : (formatNomDefunt(item.nomDefunt) || t('admin.deceased_unknown'))}
                        subtitle={[item.mosqueeNom, item.pays?.length === 2 ? (getCountryName(item.pays, i18n.language) ?? item.pays) : item.pays].filter(Boolean).join(' · ')}
                        extra={[dateDecl ? t('admin.declared_on', { date: dateDecl }) : null, t('admin.declared_by', { name: declarantNom })].filter(Boolean).join(' · ')}
                        onDelete={() => confirmDelete(
                          '/api/PriereJanaza/historique',
                          item.id,
                          item.estAnonyme ? t('admin.edit_anonymous') : (formatNomDefunt(item.nomDefunt) || `#${item.id}`),
                          () => setHistorique(p => p.filter(h => h.id !== item.id))
                        )}
                      />
                    );
                  }}
                />
              )}

              {declSubTab === 5 && <AdminCommentairesTab />}
            </>
          )}

          {/* UTILISATEURS */}
          {tab === 3 && (
            <FlatList
              data={filteredUsers}
              keyExtractor={item => String(item.id)}
              contentContainerStyle={styles.list}
              refreshControl={refreshControl}
              ListHeaderComponent={
                <View style={styles.usersHeader}>
                  <SearchBar value={searchUser} onChange={setSearchUser} placeholder={t('admin.search_users')} />
                  <View style={styles.usersToolbar}>
                    <View style={styles.roleFilterRow}>
                      {[
                        { key: 'all',   label: t('admin.filter_all') },
                        { key: 'user',  label: t('admin.filter_users') },
                        { key: 'admin', label: t('admin.filter_admins') },
                      ].map(opt => (
                        <TouchableOpacity
                          key={opt.key}
                          style={[styles.filterChip, roleFilter === opt.key && styles.filterChipActive]}
                          onPress={() => setRoleFilter(opt.key)}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.filterChipText, roleFilter === opt.key && styles.filterChipTextActive]}>
                            {opt.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <TouchableOpacity style={styles.addBtn} onPress={() => setAddUserVisible(true)} activeOpacity={0.8}>
                      <Ionicons name="person-add-outline" size={16} color={colors.white} />
                      <Text style={styles.addBtnText}>{t('admin.add_user')}</Text>
                    </TouchableOpacity>
                  </View>
                  {/* Pas de ville ni de pays ici : un compte n'a pas de lieu.
                      Seul le tri par date d'inscription a un sens. */}
                  <View style={styles.barreFiltres}>
                    <BoutonTri valeur={triUser} onChange={setTriUser} />
                  </View>
                </View>
              }
              ListEmptyComponent={<EmptyState label={searchUser ? t('admin.no_results') : t('admin.no_users')} icon="people-outline" />}
              renderItem={({ item }) => {
                const isSuper = item.email === SUPER_ADMIN_EMAIL;
                const badgeType = isSuper ? 'super_admin' : (item._role === 'Admin' ? 'admin' : null);
                return (
                  <Row
                    title={`${item.prenom ?? ''} ${item.nom ?? ''}`.trim() || '—'}
                    subtitle={item.email ?? '—'}
                    onEdit={isSuper ? null : () => setEditUser(item)}
                    onDelete={isSuper ? null : () => deleteUser(item.id, `${item.prenom ?? ''} ${item.nom ?? ''}`.trim())}
                    badgeType={badgeType}
                  />
                );
              }}
            />
          )}

          {/* DASHBOARD */}
          {tab === 4 && <DashboardTab />}

        </>
      )}

      <AddUserModal
        visible={addUserVisible}
        onClose={() => setAddUserVisible(false)}
        onCreated={(newUser) => {
          setUsers(p => [newUser, ...p]);
          setAddUserVisible(false);
        }}
      />

      <EditDeclarationModal
        item={editDecl}
        mosques={mosques}
        onClose={() => setEditDecl(null)}
        onSaved={(updated) => {
          setDeclarations(p => p.map(d => d.id === updated.id ? { ...d, ...updated } : d));
          dispatch({ type: 'JANAZA_UPDATE', payload: updated });
          setEditDecl(null);
          dispatch({ type: 'FORCE_DATA_REFRESH' });
          apiClient.get('/api/prierejanaza/upcoming')
            .then(res => dispatch({ type: 'JANAZAS_LOADED', payload: res.data }))
            .catch(() => {});
          if (apiUser?.id) {
            apiClient.get(`/api/prierejanaza/utilisateur/${apiUser.id}`)
              .then(res => dispatch({ type: 'MY_DECLARATIONS_LOADED', payload: res.data }))
              .catch(() => {});
          }
        }}
      />

      <AddDbMosqueModal
        visible={showAddDbMosque}
        onClose={() => setShowAddDbMosque(false)}
        onSaved={(created) => {
          setDbMosques(p => [created, ...p]);
          setShowAddDbMosque(false);
          refreshAllData(dispatch, apiUser?.id);
        }}
      />

      <EditPendingMosqueModal
        item={editPendingMosque}
        onClose={() => setEditPendingMosque(null)}
        onSaved={(updated) => {
          setPendingMosques(p => p.map(m => m.id === updated.id ? { ...m, ...updated } : m));
          setEditPendingMosque(null);
          refreshAllData(dispatch, apiUser?.id);
        }}
      />

      <EditPendingMosqueModal
        item={editMosque}
        onClose={() => setEditMosque(null)}
        onSaved={(updated) => {
          setMosques(p => p.map(m => m.id === updated.id ? { ...m, ...updated } : m));
          setEditMosque(null);
          refreshAllData(dispatch, apiUser?.id);
        }}
      />

      <EditPendingMosqueModal
        item={editDbMosque}
        onClose={() => setEditDbMosque(null)}
        onSaved={(updated) => {
          setDbMosques(p => p.map(m => m.id === updated.id ? { ...m, ...updated } : m));
          setEditDbMosque(null);
          dispatch({ type: 'FORCE_DATA_REFRESH' });
          apiClient.get('/api/prierejanaza/upcoming')
            .then(res => dispatch({ type: 'JANAZAS_LOADED', payload: res.data }))
            .catch(() => {});
          if (apiUser?.id) {
            apiClient.get(`/api/abonnement/utilisateur/${apiUser.id}`)
              .then(res => dispatch({ type: 'SUBSCRIPTIONS_LOADED', payload: res.data }))
              .catch(() => {});
            apiClient.get(`/api/prierejanaza/utilisateur/${apiUser.id}`)
              .then(res => dispatch({ type: 'MY_DECLARATIONS_LOADED', payload: res.data }))
              .catch(() => {});
          }
        }}
      />

      <EditUserModal
        item={editUser}
        onClose={() => setEditUser(null)}
        onSaved={(updated) => {
          setUsers(p => p.map(u => u.id === updated.id ? { ...u, ...updated } : u));
          setEditUser(null);
        }}
      />
      </ScreenBackground>
    </SafeAreaView>
  );
}

// ── Search bar ────────────────────────────────────────────────────────────────
function SearchBar({ value, onChange, placeholder }) {
  return (
    <View style={styles.searchBar}>
      <Ionicons name="search-outline" size={16} color={colors.textMuted} />
      <TextInput
        style={styles.searchInput}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        returnKeyType="search"
        autoCapitalize="none"
        clearButtonMode="while-editing"
      />
      {!!value && (
        <TouchableOpacity onPress={() => onChange('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="close-circle" size={16} color={colors.textMuted} />
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Row ───────────────────────────────────────────────────────────────────────
function Row({ title, subtitle, extra, onEdit, onDelete, badgeType, selectMode, selected, onToggle }) {
  const { t } = useTranslation();
  const badgeLabel = badgeType === 'super_admin' ? t('admin.super_admin') : badgeType === 'admin' ? t('admin.role_admin') : null;
  const inner = (
    <>
      {selectMode && (
        <Ionicons name={selected ? 'checkbox' : 'square-outline'} size={22} color={colors.primary} style={{ marginRight: spacing.sm }} />
      )}
      <View style={styles.rowInfo}>
        <View style={styles.rowTitleRow}>
          <Text style={styles.rowTitle} numberOfLines={1}>{title}</Text>
          {badgeLabel && (
            <View style={[styles.badge, badgeType === 'super_admin' ? styles.badgeSuper : styles.badgeAdmin]}>
              <Text style={[styles.badgeText, badgeType === 'super_admin' ? styles.badgeSuperText : styles.badgeAdminText]}>
                {badgeLabel}
              </Text>
            </View>
          )}
        </View>
        {!!subtitle && <Text style={styles.rowSub} numberOfLines={1}>{subtitle}</Text>}
        {!!extra && <Text style={styles.rowExtra} numberOfLines={1}>{extra}</Text>}
      </View>
      {!selectMode && (
        <View style={styles.rowActions}>
          {onEdit && (
            <TouchableOpacity onPress={onEdit} style={styles.editBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="create-outline" size={18} color={colors.primary} />
            </TouchableOpacity>
          )}
          {onDelete && (
            <TouchableOpacity onPress={onDelete} style={styles.deleteBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="trash-outline" size={18} color={colors.error} />
            </TouchableOpacity>
          )}
        </View>
      )}
    </>
  );
  if (selectMode) {
    return (
      <TouchableOpacity style={[styles.row, selected && styles.rowSelected]} onPress={onToggle} activeOpacity={0.7}>
        {inner}
      </TouchableOpacity>
    );
  }
  return <View style={styles.row}>{inner}</View>;
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState({ label, icon }) {
  return (
    <View style={styles.empty}>
      <Ionicons name={icon} size={36} color={colors.textMuted} />
      <Text style={styles.emptyText}>{label}</Text>
    </View>
  );
}

// ── Add user modal ────────────────────────────────────────────────────────────
function AddUserModal({ visible, onClose, onCreated }) {
  const { t } = useTranslation();
  const [prenom, setPrenom] = useState('');
  const [nom, setNom] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('User');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const reset = () => { setPrenom(''); setNom(''); setEmail(''); setPassword(''); setRole('User'); };

  const handleCreate = async () => {
    if (!prenom.trim() || !nom.trim() || !email.trim() || !password.trim()) {
      Alert.alert(t('admin.add_missing_fields'), t('admin.add_missing_message'));
      return;
    }
    setLoading(true);
    try {
      const res = await apiClient.post('/api/Utilisateur/admin/create', {
        prenom: prenom.trim(),
        nom: nom.trim(),
        email: email.trim(),
        password,
        role,
      });
      onCreated({ ...res.data, _role: role });
      reset();
    } catch (e) {
      const msg = e?.response?.data?.error ?? t('admin.add_error');
      Alert.alert(t('admin.add_error'), msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <SafeAreaView style={styles.modalContainer}>
          {/* Modal header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t('admin.add_user_title')}</Text>
            <TouchableOpacity onPress={() => { reset(); onClose(); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.modalScroll} keyboardShouldPersistTaps="handled">
            <ModalField label={t('admin.add_first_name')}>
              <TextInput style={styles.modalInput} value={prenom} onChangeText={setPrenom}
                placeholder={t('admin.add_first_name_placeholder')} placeholderTextColor={colors.textMuted} autoCapitalize="words" />
            </ModalField>

            <ModalField label={t('admin.add_last_name')}>
              <TextInput style={styles.modalInput} value={nom} onChangeText={setNom}
                placeholder={t('admin.add_last_name_placeholder')} placeholderTextColor={colors.textMuted} autoCapitalize="words" />
            </ModalField>

            <ModalField label={t('admin.add_email')}>
              <TextInput style={styles.modalInput} value={email} onChangeText={setEmail}
                placeholder={t('admin.add_email_placeholder')} placeholderTextColor={colors.textMuted}
                keyboardType="email-address" autoCapitalize="none" />
            </ModalField>

            <ModalField label={t('admin.add_password')}>
              <View style={styles.passwordRow}>
                <TextInput style={[styles.modalInput, styles.passwordInput]} value={password} onChangeText={setPassword}
                  placeholder={t('admin.add_password_placeholder')} placeholderTextColor={colors.textMuted}
                  secureTextEntry={!showPassword} autoCapitalize="none" />
                <TouchableOpacity onPress={() => setShowPassword(s => !s)} style={styles.eyeBtn}>
                  <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
            </ModalField>

            <ModalField label={t('admin.add_role')}>
              <View style={styles.roleRow}>
                {['User', 'Admin'].map(r => (
                  <TouchableOpacity
                    key={r}
                    style={[styles.roleOption, role === r && styles.roleOptionActive]}
                    onPress={() => setRole(r)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={r === 'Admin' ? 'shield-checkmark-outline' : 'person-outline'}
                      size={16}
                      color={role === r ? colors.white : colors.textSecondary}
                    />
                    <Text style={[styles.roleOptionText, role === r && styles.roleOptionTextActive]}>
                      {r === 'Admin' ? t('admin.role_admin') : t('admin.role_user')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ModalField>

            <TouchableOpacity
              style={[styles.createBtn, loading && { opacity: 0.6 }]}
              onPress={handleCreate}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color={colors.white} size="small" />
                : <><Ionicons name="person-add-outline" size={18} color={colors.white} /><Text style={styles.createBtnText}>{t('admin.add_submit')}</Text></>
              }
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Edit declaration modal ────────────────────────────────────────────────────
const GENRES = ['homme', 'femme', 'enfant'];

function EditDeclarationModal({ item, onClose, onSaved, mosques = [] }) {
  const { t, i18n } = useTranslation();
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
  const mosqDebounceRef = useRef(null);
  const mosqLatestRef = useRef('');

  useEffect(() => {
    if (!item) return;
    setAnnouncementDraft(null);
    const split = splitNomDefunt(item.nomDefunt ?? '');
    setNomFamille(split.nom);
    setPrenomDefunt(split.prenom);
    setEstAnonyme(item.estAnonyme ?? false);
    setGenre(item.genre ?? 'homme');
    const raw = item.dateHeurePriere;
    const d = raw ? new Date(/Z|[+-]\d{2}:/.test(raw) ? raw : raw + 'Z') : new Date();
    setSelectedDate(new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    setSelectedHour(d.getUTCHours());
    setSelectedMinute(d.getUTCMinutes());
    setCommentaire(item.commentaire ?? '');
    setMosqueeSearch('');
    setSelectedMosque(item.mosqueeId ? { id: String(item.mosqueeId), _dbId: item.mosqueeId, nom: item.mosqueeNom ?? '', adresse: item.mosqueeAdresse ?? item.adresse ?? null, latitude: item.mosqueeLatitude ?? null, longitude: item.mosqueeLongitude ?? null } : null);
    setMosqueeOptions([]);
    setShowDrop(false);
  }, [item]);

  function handleMosqueeSearch(text) {
    setMosqueeSearch(text);
    setSelectedMosque(null);
    setShowDrop(true);
    if (mosqDebounceRef.current) clearTimeout(mosqDebounceRef.current);
    if (text.trim().length < 2) { setMosqueeOptions([]); setLoadingMosquees(false); return; }
    const query = text.trim();
    mosqLatestRef.current = query;
    setLoadingMosquees(true);
    mosqDebounceRef.current = setTimeout(async () => {
      try {
        const [dbRes, osmRes] = await Promise.allSettled([
          apiClient.get(`/api/mosquee/search?q=${encodeURIComponent(query)}`),
          searchMosquesByNameOSM(query),
        ]);
        if (mosqLatestRef.current !== query) return;
        const dbResults = dbRes.status === 'fulfilled' ? (dbRes.value.data ?? []) : [];
        const osmResults = osmRes.status === 'fulfilled' ? (osmRes.value ?? []) : [];
        const dbOsmIds = new Set(dbResults.map(m => m.osmId).filter(Boolean));
        const uniqueOsm = osmResults.filter(m => !dbOsmIds.has(m.osmId));
        setMosqueeOptions([...dbResults, ...uniqueOsm].slice(0, 20));
      } catch {
        if (mosqLatestRef.current === query) setMosqueeOptions([]);
      } finally {
        if (mosqLatestRef.current === query) setLoadingMosquees(false);
      }
    }, 300);
  }

  function selectMosque(mosque) {
    mosqLatestRef.current = '';
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
        utcOffsetMinutes: item.utcOffsetMinutes ?? 0,
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
    setShowAnnouncement(false);
    setTimeout(() => saveDeclaration(finalCommentaire, announcementData), 350);
  };

  const announcementForm = {
    nomAnonyme: estAnonyme,
    nomDefunt: buildNomDefunt(nomFamille, prenomDefunt),
    genre,
    mosqueeNom: selectedMosque?.nom ?? item?.mosqueeNom ?? '',
    mosqueeAdresse: selectedMosque?.adresse ?? item?.mosqueeAdresse ?? '',
    mosqueeLatitude: selectedMosque?.latitude ?? item?.mosqueeLatitude ?? null,
    mosqueeeLongitude: selectedMosque?.longitude ?? item?.mosqueeLongitude ?? null,
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

        <ScrollView
          contentContainerStyle={styles.modalScroll}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={true}
        >
          {/* Mosquée (modifiable) */}
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
                    placeholder={t('admin.edit_mosque_label')}
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
                    <Text style={styles.noResultText}>Aucune mosquée trouvée</Text>
                  </View>
                )}
              </>
            )}
          </View>

          {/* Anonyme */}
          <View style={styles.switchRow}>
            <Text style={styles.modalLabel}>{t('admin.edit_anonymous')}</Text>
            <Switch value={estAnonyme} onValueChange={setEstAnonyme} trackColor={{ true: colors.primary }} thumbColor={colors.white} />
          </View>

          {/* Nom du défunt */}
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

          {/* Genre */}
          <ModalField label={t('admin.edit_genre')}>
            <View style={styles.roleRow}>
              {GENRES.map(g => (
                <TouchableOpacity
                  key={g}
                  style={[styles.roleOption, genre === g && styles.roleOptionActive]}
                  onPress={() => setGenre(g)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.roleOptionText, genre === g && styles.roleOptionTextActive]}>
                    {g === 'homme' ? t('admin.edit_male') : g === 'femme' ? t('admin.edit_female') : t('admin.edit_child')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ModalField>

          {/* Date */}
          <View style={styles.modalField}>
            <Text style={styles.modalLabel}>{t('admin.edit_prayer_date')}</Text>
            <TouchableOpacity style={styles.datePickerBtn} onPress={() => setShowCalendar(true)} activeOpacity={0.7}>
              <Ionicons name="calendar-outline" size={18} color={selectedDate ? colors.primary : colors.textMuted} />
              <Text style={[styles.datePickerText, !selectedDate && styles.datePickerPlaceholder]}>
                {selectedDate
                  ? selectedDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
                  : t('admin.edit_date_placeholder')}
              </Text>
              <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Heure */}
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

          {/* Aperçu annonce */}
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
        key={item?.id ?? 'admin'}
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

function ModalField({ label, children }) {
  return (
    <View style={styles.modalField}>
      <Text style={styles.modalLabel}>{label}</Text>
      <View style={styles.modalInputWrapper}>{children}</View>
    </View>
  );
}

// ── Pending mosque row ────────────────────────────────────────────────────────
function PendingMosqueRow({ item, onValider, onRefuser, onEdit, selectMode, selected, onToggle }) {
  return (
    <TouchableOpacity
      style={[styles.pendingRow, selectMode && selected && { borderColor: colors.primary, borderLeftColor: colors.primary, borderWidth: 1.5 }]}
      onPress={selectMode ? onToggle : undefined}
      activeOpacity={selectMode ? 0.7 : 1}
    >
      {selectMode && (
        <Ionicons
          name={selected ? 'checkbox' : 'square-outline'}
          size={22}
          color={selected ? colors.primary : colors.textMuted}
          style={{ marginRight: spacing.sm }}
        />
      )}
      <View style={styles.rowInfo}>
        <Text style={styles.rowTitle} numberOfLines={1}>{item.nom}</Text>
        {!!item.adresse && <Text style={styles.rowSub} numberOfLines={1}>{item.adresse}</Text>}
        <Text style={styles.rowExtra}>{item.latitude?.toFixed(5)}, {item.longitude?.toFixed(5)}</Text>
      </View>
      {!selectMode && (
        <View style={styles.pendingActions}>
          <TouchableOpacity onPress={onEdit} style={styles.pendingBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="create-outline" size={18} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={onValider} style={styles.pendingBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="checkmark-circle-outline" size={20} color="#22c55e" />
          </TouchableOpacity>
          <TouchableOpacity onPress={onRefuser} style={styles.pendingBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle-outline" size={20} color={colors.error} />
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ── Add mosque BDD modal ──────────────────────────────────────────────────────
function AddDbMosqueModal({ visible, onClose, onSaved }) {
  const [nom, setNom] = useState('');
  const [adresse, setAdresse] = useState('');
  const [loading, setLoading] = useState(false);

  const reset = () => { setNom(''); setAdresse(''); };

  const handleSave = async () => {
    if (!nom.trim() || !adresse.trim()) {
      Alert.alert('Champs manquants', 'Le nom et l\'adresse sont obligatoires.');
      return;
    }
    setLoading(true);
    const coords = await geocodeAddress(adresse.trim());
    setLoading(false);

    if (!coords) {
      Alert.alert('Adresse introuvable', 'Impossible de géolocaliser cette adresse. Vérifiez l\'adresse et réessayez.');
      return;
    }

    Alert.alert(
      'Confirmer l\'enregistrement',
      `Nom : ${nom.trim()}\nAdresse : ${adresse.trim()}\nCoordonnées : ${coords.lat.toFixed(5)}, ${coords.lon.toFixed(5)}`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Enregistrer',
          onPress: async () => {
            setLoading(true);
            try {
              const res = await apiClient.post('/api/Mosquee', {
                nom: nom.trim(),
                adresse: adresse.trim(),
                latitude: coords.lat,
                longitude: coords.lon,
              });
              reset();
              onSaved(res.data);
            } catch {
              Alert.alert('Erreur', 'Impossible d\'enregistrer la mosquée.');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Ajouter une mosquée</Text>
            <TouchableOpacity onPress={() => { reset(); onClose(); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalScroll} keyboardShouldPersistTaps="handled">
            <ModalField label="Nom">
              <TextInput style={styles.modalInput} value={nom} onChangeText={setNom}
                placeholder="Nom de la mosquée" placeholderTextColor={colors.textMuted} autoCapitalize="words" />
            </ModalField>
            <ModalField label="Adresse">
              <TextInput style={styles.modalInput} value={adresse} onChangeText={setAdresse}
                placeholder="Adresse complète (rue, code postal, ville)" placeholderTextColor={colors.textMuted} />
            </ModalField>
            <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: spacing.lg }}>
              Les coordonnées GPS seront calculées automatiquement depuis l'adresse.
            </Text>
            <TouchableOpacity
              style={[styles.createBtn, loading && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color={colors.white} size="small" />
                : <><Ionicons name="checkmark-outline" size={18} color={colors.white} /><Text style={styles.createBtnText}>Enregistrer</Text></>
              }
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Edit pending mosque modal ─────────────────────────────────────────────────
function EditPendingMosqueModal({ item, onClose, onSaved }) {
  const { t } = useTranslation();
  const [nom, setNom] = useState('');
  const [adresse, setAdresse] = useState('');
  const [coords, setCoords] = useState({ lat: null, lon: null });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!item) return;
    setNom(item.nom ?? '');
    setAdresse(item.adresse ?? '');
    setCoords({ lat: item.latitude ?? null, lon: item.longitude ?? null });
  }, [item]);

  const handleSave = async () => {
    if (!nom.trim()) { Alert.alert(t('admin.add_missing_fields'), t('admin.edit_name_required')); return; }
    setLoading(true);
    try {
      let finalCoords = coords;
      const adresseChanged = (adresse.trim() || null) !== (item.adresse ?? null);
      if (adresseChanged && adresse.trim()) {
        const c = await geocodeAddress(adresse.trim());
        if (c) { finalCoords = c; setCoords(c); }
      }
      await apiClient.put(`/api/Mosquee/${item.id}`, {
        nom: nom.trim(),
        adresse: adresse.trim() || null,
        latitude: finalCoords.lat,
        longitude: finalCoords.lon,
        osmId: item.osmId ?? null,
      });
      onSaved({ ...item, nom: nom.trim(), adresse: adresse.trim() || null, latitude: finalCoords.lat, longitude: finalCoords.lon });
    } catch {
      Alert.alert(t('admin.add_error'), t('admin.edit_error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={!!item} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t('admin.edit_mosque_title')}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalScroll} keyboardShouldPersistTaps="handled">
            <ModalField label={t('admin.edit_name_label')}>
              <TextInput style={styles.modalInput} value={nom} onChangeText={setNom}
                placeholder={t('admin.edit_name_placeholder')} placeholderTextColor={colors.textMuted} autoCapitalize="words" />
            </ModalField>
            <ModalField label={t('admin.edit_address_label')}>
              <TextInput style={styles.modalInput} value={adresse} onChangeText={setAdresse}
                placeholder={t('admin.edit_address_placeholder')} placeholderTextColor={colors.textMuted} />
            </ModalField>
            <ModalField label={t('admin.edit_coords_label')}>
              <Text style={[styles.modalInput, { color: colors.textMuted }]}>
                {coords.lat?.toFixed(6) ?? '—'}, {coords.lon?.toFixed(6) ?? '—'}
              </Text>
            </ModalField>
            <TouchableOpacity
              style={[styles.createBtn, loading && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color={colors.white} size="small" />
                : <><Ionicons name="checkmark-outline" size={18} color={colors.white} /><Text style={styles.createBtnText}>{t('admin.edit_save')}</Text></>
              }
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Edit user modal ───────────────────────────────────────────────────────────
function EditUserModal({ item, onClose, onSaved }) {
  const { t } = useTranslation();
  const [prenom, setPrenom] = useState('');
  const [nom, setNom] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('User');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!item) return;
    setPrenom(item.prenom ?? '');
    setNom(item.nom ?? '');
    setEmail(item.email ?? '');
    setRole(item._role === 'Admin' ? 'Admin' : 'User');
  }, [item]);

  const handleSave = async () => {
    if (!prenom.trim() || !nom.trim()) {
      Alert.alert(t('admin.add_missing_fields'), t('admin.add_missing_message'));
      return;
    }
    setLoading(true);
    try {
      const res = await apiClient.put(`/api/Utilisateur/${item.id}`, {
        prenom: prenom.trim(),
        nom: nom.trim(),
      });
      const originalRole = item._role === 'Admin' ? 'Admin' : 'User';
      if (role !== originalRole) {
        await apiClient.put(`/api/Utilisateur/${item.id}/role`, { role });
      }
      onSaved({ ...res.data, id: item.id, _role: role });
    } catch (e) {
      const msg = e?.response?.data?.error ?? t('admin.edit_user_error');
      Alert.alert(t('admin.add_error'), msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={!!item} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t('admin.edit_user_title')}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.modalScroll} keyboardShouldPersistTaps="handled">
            <ModalField label={t('admin.add_first_name')}>
              <TextInput style={styles.modalInput} value={prenom} onChangeText={setPrenom}
                placeholder={t('admin.add_first_name_placeholder')} placeholderTextColor={colors.textMuted} autoCapitalize="words" />
            </ModalField>

            <ModalField label={t('admin.add_last_name')}>
              <TextInput style={styles.modalInput} value={nom} onChangeText={setNom}
                placeholder={t('admin.add_last_name_placeholder')} placeholderTextColor={colors.textMuted} autoCapitalize="words" />
            </ModalField>

            <ModalField label={t('admin.add_email')}>
              <TextInput style={[styles.modalInput, { color: colors.textMuted }]} value={email}
                editable={false} keyboardType="email-address" autoCapitalize="none" />
            </ModalField>

            <ModalField label={t('admin.add_role')}>
              <View style={styles.roleRow}>
                {['User', 'Admin'].map(r => (
                  <TouchableOpacity
                    key={r}
                    style={[styles.roleOption, role === r && styles.roleOptionActive]}
                    onPress={() => setRole(r)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={r === 'Admin' ? 'shield-checkmark-outline' : 'person-outline'}
                      size={16}
                      color={role === r ? colors.white : colors.textSecondary}
                    />
                    <Text style={[styles.roleOptionText, role === r && styles.roleOptionTextActive]}>
                      {r === 'Admin' ? t('admin.role_admin') : t('admin.role_user')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ModalField>

            <TouchableOpacity
              style={[styles.createBtn, loading && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color={colors.white} size="small" />
                : <><Ionicons name="checkmark-outline" size={18} color={colors.white} /><Text style={styles.createBtnText}>{t('admin.edit_user_save')}</Text></>
              }
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: '#F8F7F5' },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.md,
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerTitle: { ...typography.h3 },

  tabs: { flexDirection: 'row', backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  tab: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm + 2, gap: 2 },
  tabActive: { borderBottomWidth: 2, borderBottomColor: colors.primary },
  tabText: { ...typography.label, color: colors.textMuted },
  tabTextActive: { color: colors.primary },
  tabCount: { fontSize: 11, color: colors.primary, fontWeight: '700' },

  loader: { marginTop: spacing.xl },
  list: { padding: spacing.md, gap: spacing.sm },

  // Search
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.surface, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.text },

  // Filtres de lieu et tri, sous la barre de recherche.
  // `flexWrap` parce que trois contrôles côte à côte débordent sur les petits
  // écrans dès qu'une ville porte un nom long comme Villeneuve-d'Ascq.
  barreFiltres: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    flexWrap: 'wrap', marginBottom: spacing.sm,
  },
  filtreCombo: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    // Une largeur minimale et non fixe : le bouton porte tantôt « Toutes les
    // villes », tantôt le nom choisi, et il ne doit pas sauter de taille.
    minWidth: 118, maxWidth: 190,
    paddingVertical: 6, paddingHorizontal: spacing.sm,
    borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  // Un filtre actif se voit au liseré, pas au remplissage : il reste lisible
  // et se distingue des puces de rôle, qui elles se remplissent quand on les
  // choisit.
  filtreComboActif: { borderColor: colors.primary, backgroundColor: colors.surface },
  filtreComboLabel: { flex: 1, fontSize: 12, fontWeight: '600', color: colors.textMuted },
  filtreComboLabelActif: { color: colors.primary },

  boutonTri: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingVertical: 6, paddingHorizontal: spacing.sm,
    borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  boutonTriTexte: { fontSize: 12, fontWeight: '600', color: colors.primary },

  comboVide: {
    ...typography.body, color: colors.textMuted,
    textAlign: 'center', paddingVertical: spacing.lg,
  },

  rattrapageBtn: {
    flexDirection: 'row', justifyContent: 'center', gap: spacing.xs,
    backgroundColor: colors.textMuted,
  },

  genderFilterRow: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap', marginBottom: spacing.sm },

  // Users header
  usersHeader: { gap: spacing.sm, marginBottom: spacing.xs },
  usersToolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  roleFilterRow: { flexDirection: 'row', gap: spacing.xs, flex: 1 },
  filterChip: {
    paddingVertical: 5, paddingHorizontal: spacing.sm,
    borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterChipText: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  filterChipTextActive: { color: colors.white },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    backgroundColor: colors.primary, borderRadius: radius.md,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
  },
  addBtnText: { fontSize: 13, fontWeight: '600', color: colors.white },

  // Row
  row: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 1,
  },
  rowInfo: { flex: 1, gap: 3 },
  rowTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  rowTitle: { fontSize: 14, fontWeight: '600', color: colors.text, flexShrink: 1 },
  rowSub: { ...typography.bodySmall },
  rowExtra: { ...typography.bodySmall, color: colors.textMuted, marginTop: 1 },
  rowActions: { flexDirection: 'row', alignItems: 'center' },
  editBtn: { paddingLeft: spacing.sm },
  deleteBtn: { paddingLeft: spacing.sm },
  badge: { borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  badgeAdmin: { backgroundColor: colors.primaryDim },
  badgeAdminText: { color: colors.primary },
  badgeSuper: { backgroundColor: 'rgba(180,83,9,0.12)' },
  badgeSuperText: { color: '#B45309' },

  // Empty
  empty: { alignItems: 'center', marginTop: spacing.xl * 2, gap: spacing.sm },
  emptyText: { ...typography.bodySmall, textAlign: 'center' },

  // Modal
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
  passwordRow: { flexDirection: 'row', alignItems: 'center' },
  passwordInput: { flex: 1 },
  eyeBtn: { paddingHorizontal: spacing.md },

  roleRow: { flexDirection: 'row', gap: spacing.sm },
  roleOption: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.xs, paddingVertical: spacing.sm + 2,
    borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  roleOptionActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  roleOptionText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  roleOptionTextActive: { color: colors.white },

  mosqueeDropdown: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, marginTop: 4, overflow: 'hidden',
  },
  mosqueeDropdownItem: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  },
  mosqueeDropdownName: { fontSize: 14, fontWeight: '600', color: colors.text },
  mosqueeDropdownAddr: { fontSize: 12, color: colors.textMuted, marginTop: 1 },

  searchInputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: spacing.sm,
  },
  searchIcon: { marginRight: spacing.xs },
  dropdown: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, marginTop: 4, overflow: 'hidden', maxHeight: 200,
  },
  dropdownItem: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  },
  dropdownItemText: { fontSize: 14, fontWeight: '600', color: colors.text },
  dropdownItemAddr: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  noResultBox: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    padding: spacing.sm, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, marginTop: 4,
  },
  noResultText: { fontSize: 13, color: colors.textMuted },

  selectedMosque: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.primary, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2 },
  selectedMosqueText: { fontSize: 14, fontWeight: '600', color: colors.text },
  selectedMosqueAddr: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  clearBtn: { padding: 2 },

  // Date/time picker
  datePickerBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  datePickerText: { flex: 1, ...typography.body, color: colors.text, textTransform: 'capitalize' },
  datePickerPlaceholder: { color: colors.textMuted },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  timePicker: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.primary, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, minWidth: 70, justifyContent: 'center' },
  timePickerText: { fontSize: 22, fontWeight: '700', color: colors.primary },
  timeSeparator: { fontSize: 22, fontWeight: '700', color: colors.text },

  // Announce button
  announceBtnOutline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing.md, marginTop: spacing.xs },
  announceBtnText: { ...typography.button, color: colors.primary, fontSize: 15 },

  // Calendar modal
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

  // Combobox modal
  comboOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' },
  comboSheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, paddingBottom: spacing.xxl },
  comboHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: spacing.lg },
  comboTitle: { ...typography.h3, textAlign: 'center', marginBottom: spacing.md },
  comboItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.md, paddingHorizontal: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  comboItemSelected: { backgroundColor: colors.primaryDim },
  comboItemText: { fontSize: 18, fontWeight: '500', color: colors.text },
  comboItemTextSelected: { color: colors.primary, fontWeight: '700' },

  // Sub-tabs
  subTabs: { flexDirection: 'row', backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  subTab: { flex: 1, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, paddingVertical: 6 },
  subTabActive: { borderBottomWidth: 2, borderBottomColor: colors.primary },
  subTabText: { fontSize: 12, fontWeight: '500', color: colors.textMuted },
  subTabTextActive: { color: colors.primary, fontWeight: '600' },
  subTabCount: { fontSize: 10, color: colors.textMuted },
  subTabCountActive: { color: colors.primary, fontWeight: '700' },
  pendingBadge: { backgroundColor: colors.error, borderRadius: 10, minWidth: 18, paddingHorizontal: 4, alignItems: 'center' },
  pendingBadgeText: { color: colors.white, fontSize: 10, fontWeight: '700' },

  // Validate all button
  validateAllBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.xs, backgroundColor: '#22c55e',
    borderRadius: radius.md, paddingVertical: spacing.sm + 2,
    marginBottom: spacing.sm,
  },
  validateAllBtnText: { fontSize: 13, fontWeight: '700', color: colors.white },

  // Pending bulk actions
  pendingBulkRow: {
    flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.sm,
  },
  bulkBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, borderRadius: radius.md, paddingVertical: spacing.sm + 2,
  },
  bulkBtnOutline: {
    backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.primary,
  },
  bulkBtnOutlineText: { fontSize: 13, fontWeight: '600', color: colors.primary },

  // Select mode
  selectHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: spacing.xs, paddingVertical: spacing.xs,
  },
  selectAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  selectAllText: { fontSize: 13, fontWeight: '600', color: colors.primary },
  selectCancelBtn: { paddingVertical: spacing.xs, paddingHorizontal: spacing.sm },
  selectCancelText: { fontSize: 13, color: colors.textSecondary },
  selectionActionsRow: {
    flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.sm,
  },
  selectionActionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, borderRadius: radius.md, paddingVertical: spacing.sm + 2,
  },
  selectionActionText: { fontSize: 13, fontWeight: '700', color: colors.white },

  // Pending row
  pendingRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md,
    borderLeftWidth: 3, borderLeftColor: '#f59e0b',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 1,
  },
  pendingActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pendingBtn: { paddingLeft: spacing.xs },

  createBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, backgroundColor: colors.primary,
    borderRadius: radius.md, paddingVertical: spacing.md, marginTop: spacing.sm,
  },
  createBtnText: { ...typography.button, fontSize: 15 },

  // Import permission tab
  importBulkRow: {
    flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.sm,
  },
  importBulkBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, borderRadius: radius.md, paddingVertical: spacing.sm + 2,
  },
  importBulkBtnGreen: { backgroundColor: '#22c55e' },
  importBulkBtnRed: { backgroundColor: colors.error },
  importBulkBtnText: { fontSize: 13, fontWeight: '700', color: colors.white },
  importUserRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 1,
  },
  importUserInfo: { flex: 1, gap: 2 },
  importUserName: { fontSize: 14, fontWeight: '600', color: colors.text },
  importUserEmail: { fontSize: 12, color: colors.textMuted },
  importUserRight: { alignItems: 'flex-end', gap: 2 },
  importPermLabel: { fontSize: 11, color: colors.textMuted, fontWeight: '500' },
  importPermLabelActive: { color: colors.primary },

  // DB Mosquées tab
  dbMosqueRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md,
    marginBottom: spacing.sm,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 1,
  },
  dbMosqueInfo: { flex: 1, gap: 2 },
  dbMosqueNom: { fontSize: 14, fontWeight: '600', color: colors.text },
  dbMosqueAdresse: { fontSize: 12, color: colors.textSecondary },
  dbMosqueCoords: { fontSize: 11, color: colors.textMuted, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  dbMosqueActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginLeft: spacing.sm },
  dbMosqueEditBtn: { padding: spacing.xs },
  dbMosqueDeleteBtn: { padding: spacing.xs },
  normBtn: {
    backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 10,
    alignItems: 'center', marginBottom: spacing.sm,
  },
  normBtnDisabled: { opacity: 0.6 },
  normBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },

  // Import TXT tab
  importTxtContainer: { padding: spacing.lg, paddingBottom: spacing.xl },
  importTxtLabel: { ...typography.label, color: colors.textMuted, marginBottom: spacing.sm },
  importTxtInput: {
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, padding: spacing.md, minHeight: 240,
    ...typography.body, marginBottom: spacing.md, textAlignVertical: 'top',
  },
  importTxtClear: {
    position: 'absolute', top: spacing.sm, right: spacing.sm,
  },
  importTxtBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, backgroundColor: colors.primary, borderRadius: radius.md,
    paddingVertical: spacing.md, paddingHorizontal: spacing.lg,
  },
  importTxtBtnText: { ...typography.body, color: colors.white, fontWeight: '700' },
  importTxtSuccess: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: 'rgba(74,122,78,0.10)', borderRadius: radius.md,
    padding: spacing.md, marginTop: spacing.md,
  },
  importTxtSuccessText: { ...typography.body, color: colors.success, fontWeight: '600' },
  importTxtFilename: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  importTxtError: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: 'rgba(220,38,38,0.08)', borderRadius: radius.md,
    padding: spacing.md, marginTop: spacing.md,
  },
  importTxtErrorText: { ...typography.body, color: colors.error, fontWeight: '600', flex: 1 },

  importTxtPolling: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: spacing.md },
  importTxtPollingText: { ...typography.small, color: colors.textMuted },

  // Modale résumé importation
  summaryOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  summaryBox: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, width: '100%', maxHeight: '75%' },
  summaryHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.sm },
  summaryTitle: { ...typography.h3, color: colors.text, fontWeight: '700' },
  summaryStats: { ...typography.body, color: colors.text, marginBottom: spacing.md },
  summarySkippedTitle: { ...typography.label, color: colors.error, fontWeight: '600', marginBottom: spacing.xs },
  summarySkippedList: { maxHeight: 220, marginBottom: spacing.md },
  summarySkippedItem: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 6,
    borderBottomWidth: 1, borderBottomColor: colors.border },
  summarySkippedMosque: { ...typography.body, color: colors.text, fontWeight: '600' },
  summarySkippedDefunt: { ...typography.small, color: colors.textMuted },
  summarySkippedReason: { ...typography.small, color: colors.error },
  summaryCloseBtn: { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 10,
    alignItems: 'center', marginTop: spacing.sm },
  summaryCloseBtnText: { color: colors.white, fontWeight: '700', fontSize: 14 },

  // Declaration select / date range
  rowSelected: { backgroundColor: colors.primaryDim },
  declDateRangeRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm,
  },
  declDateRangeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.sm,
    backgroundColor: colors.surface,
  },
  declDateRangeBtnText: { fontSize: 12, fontWeight: '600', color: colors.text, flex: 1 },
  declDateRangeSep: { fontSize: 14, color: colors.textMuted },
  declDateRangeDeleteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, backgroundColor: colors.error, borderRadius: radius.md,
    paddingVertical: spacing.sm + 2, marginBottom: spacing.sm,
  },
  declDateRangeDeleteBtnText: { fontSize: 13, fontWeight: '700', color: colors.white },
  declSelectModeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, borderWidth: 1.5, borderColor: colors.primary, borderRadius: radius.md,
    paddingVertical: spacing.sm, marginBottom: spacing.sm,
  },
  declSelectModeBtnText: { fontSize: 13, fontWeight: '600', color: colors.primary },
});
