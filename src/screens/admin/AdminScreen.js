import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, RefreshControl, TextInput,
  Modal, ScrollView, KeyboardAvoidingView, Platform, Switch, TouchableWithoutFeedback,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSelector, useDispatch } from 'react-redux';
import { colors, spacing, radius, typography } from '../../utils/theme';
import apiClient from '../../lib/api/apiClient';
import AnnouncementGeneratorModal from '../declare/AnnouncementGenerator';
import { useTranslation } from 'react-i18next';
import { searchMosquesByNameOSM, normalize } from '../../utils/mosqueSearch';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);
const CAL_LOCALE_MAP = { fr: 'fr-FR', en: 'en-US', ar: 'ar-SA' };

function CalendarModal({ visible, selectedDate, onSelect, onClose }) {
  const { i18n } = useTranslation();
  const dateLocale = CAL_LOCALE_MAP[i18n.language?.split('-')[0]] ?? 'fr-FR';
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
                      {day ? <Text style={[styles.calCellText, isSelected && styles.calCellTextSelected, isToday && !isSelected && styles.calCellTextToday]}>{day}</Text> : null}
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

const SUPER_ADMIN_EMAIL = 'ceo@salatjanaza.org';

const parseUtc = (raw) => raw ? new Date(/Z$|[+-]\d{2}:/.test(raw) ? raw : raw + 'Z') : null;

export default function AdminScreen() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const currentUser = useSelector(state => state.auth.user);
  const apiUser = useSelector(state => state.auth.apiUser);

  const [tab, setTab] = useState(0);
  const [mosqueSubTab, setMosqueSubTab] = useState(0); // 0=Toutes 1=En attente
  const [mosques, setMosques] = useState([]);
  const [pendingMosques, setPendingMosques] = useState([]);
  const [dbMosques, setDbMosques] = useState([]);
  const [dbLoading, setDbLoading] = useState(false);
  const [declarations, setDeclarations] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [editPendingMosque, setEditPendingMosque] = useState(null);
  const [editMosque, setEditMosque] = useState(null);
  const [editDbMosque, setEditDbMosque] = useState(null);
  const [editDbMosqueForm, setEditDbMosqueForm] = useState({ nom: '', adresse: '', latitude: '', longitude: '' });
  const [searchDbMosque, setSearchDbMosque] = useState('');

  const SECTIONS = [t('admin.tab_mosques'), 'Mosquées BDD', t('admin.tab_declarations'), t('admin.tab_users')];

  const [searchMosque, setSearchMosque] = useState('');
  const [searchPending, setSearchPending] = useState('');
  const [searchDecl, setSearchDecl] = useState('');
  const [searchUser, setSearchUser] = useState('');
  const [roleFilter, setRoleFilter] = useState('all'); // 'all' | 'user' | 'admin'

  const [genderFilter, setGenderFilter] = useState('all');
  const [addUserVisible, setAddUserVisible] = useState(false);
  const [editDecl, setEditDecl] = useState(null);
  const [editUser, setEditUser] = useState(null);
  const [pendingSelectMode, setPendingSelectMode] = useState(false);
  const [selectedPendingIds, setSelectedPendingIds] = useState(new Set());

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [mosRes, pendRes, decRes, usrRes] = await Promise.all([
        apiClient.get('/api/Mosquee/contributions'),
        apiClient.get('/api/Mosquee/pending'),
        apiClient.get('/api/PriereJanaza'),
        apiClient.get('/api/Utilisateur'),
      ]);
      setMosques(mosRes.data ?? []);
      setPendingMosques(pendRes.data ?? []);
      setDeclarations(decRes.data ?? []);
      setUsers(usrRes.data ?? []);
    } catch {
      Alert.alert(t('admin.add_error'), t('admin.load_error'));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadData(); loadDbMosques(); }, [loadData]));

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
    confirmDelete('/api/Mosquee', id, nom, () => setMosques(p => p.filter(m => m.id !== id)));

  const refuserMosque = (id, nom) =>
    confirmDelete('/api/Mosquee', id, nom, () => setPendingMosques(p => p.filter(m => m.id !== id)));

  const validerMosque = async (id) => {
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
    } catch {
      Alert.alert(t('admin.add_error'), t('admin.validate_error'));
    }
  };

  const enterSelectMode = () => { setPendingSelectMode(true); setSelectedPendingIds(new Set()); };
  const exitSelectMode = () => { setPendingSelectMode(false); setSelectedPendingIds(new Set()); };
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
              await Promise.all(filteredPending.map(m => apiClient.delete(`/api/Mosquee/${m.id}`)));
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

  const validerSelection = async () => {
    const toValidate = filteredPending.filter(m => selectedPendingIds.has(m.id));
    if (toValidate.length === 0) return;
    setLoading(true);
    try {
      await Promise.all(toValidate.map(m => apiClient.put(`/api/Mosquee/${m.id}/valider`)));
      setPendingMosques(p => p.filter(m => !selectedPendingIds.has(m.id)));
      setMosques(p => [...toValidate.map(m => ({ ...m, statut: 'Validee' })), ...p]);
      toValidate.forEach(m => dispatch({
        type: 'MOSQUE_REGISTER',
        payload: { id: `db_${m.id}`, nom: m.nom, adresse: m.adresse ?? '', latitude: m.latitude, longitude: m.longitude, source: 'user' },
      }));
      exitSelectMode();
    } catch {
      Alert.alert(t('admin.add_error'), t('admin.validate_all_error'));
    } finally {
      setLoading(false);
    }
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
              await Promise.all(toDelete.map(m => apiClient.delete(`/api/Mosquee/${m.id}`)));
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

  const deleteDeclaration = (id, label) =>
    confirmDelete('/api/PriereJanaza', id, label, () => setDeclarations(p => p.filter(d => d.id !== id)));

  const deleteUser = (id, label) =>
    confirmDelete('/api/Utilisateur', id, label, () => setUsers(p => p.filter(u => u.id !== id)));

  const deleteDbMosque = (id, nom) =>
    confirmDelete('/api/Mosquee', id, nom, () => setDbMosques(p => p.filter(m => m.id !== id)));

  const openEditDbMosque = (m) => {
    setEditDbMosque(m);
    setEditDbMosqueForm({ nom: m.nom ?? '', adresse: m.adresse ?? '', latitude: String(m.latitude ?? ''), longitude: String(m.longitude ?? '') });
  };

  const saveDbMosque = async () => {
    try {
      await apiClient.put(`/api/Mosquee/${editDbMosque.id}`, {
        nom: editDbMosqueForm.nom,
        adresse: editDbMosqueForm.adresse || null,
        latitude: parseFloat(editDbMosqueForm.latitude),
        longitude: parseFloat(editDbMosqueForm.longitude),
      });
      setDbMosques(p => p.map(m => m.id === editDbMosque.id
        ? { ...m, nom: editDbMosqueForm.nom, adresse: editDbMosqueForm.adresse || null, latitude: parseFloat(editDbMosqueForm.latitude), longitude: parseFloat(editDbMosqueForm.longitude) }
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
  const filteredMosques = mosques.filter(m =>
    !searchMosque || q(m.nom ?? '').includes(q(searchMosque)) || q(m.adresse ?? '').includes(q(searchMosque))
  );
  const filteredDbMosques = dbMosques.filter(m =>
    !searchDbMosque || q(m.nom ?? '').includes(q(searchDbMosque)) || q(m.adresse ?? '').includes(q(searchDbMosque))
  );
  const filteredPending = pendingMosques.filter(m =>
    !searchPending || q(m.nom ?? '').includes(q(searchPending)) || q(m.adresse ?? '').includes(q(searchPending))
  );
  const allPendingSelected = filteredPending.length > 0 && selectedPendingIds.size === filteredPending.length;
  const toggleSelectAllPending = () => {
    if (allPendingSelected) setSelectedPendingIds(new Set());
    else setSelectedPendingIds(new Set(filteredPending.map(m => m.id)));
  };

  useEffect(() => { setPendingSelectMode(false); setSelectedPendingIds(new Set()); }, [tab, mosqueSubTab]);
  const usersById = Object.fromEntries(users.map(u => [u.id, u]));

  const filteredDecl = declarations
    .filter(d => {
      const matchSearch = !searchDecl ||
        q(d.nomDefunt ?? '').includes(q(searchDecl)) ||
        q(d.mosqueeNom ?? '').includes(q(searchDecl)) ||
        q(d.commentaire ?? '').includes(q(searchDecl));
      const matchGender = genderFilter === 'all' || d.genre === genderFilter;
      return matchSearch && matchGender;
    })
    .sort((a, b) => new Date(b.dateCreation ?? b.dateHeurePriere) - new Date(a.dateCreation ?? a.dateHeurePriere));
  const filteredUsers = users.filter(u => {
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
  });

  const refreshControl = <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="shield-checkmark" size={20} color={colors.primary} />
        <Text style={styles.headerTitle}>{t('admin.title')}</Text>
      </View>

      <View style={styles.tabs}>
        {SECTIONS.map((s, i) => (
          <TouchableOpacity
            key={s}
            style={[styles.tab, tab === i && styles.tabActive]}
            onPress={() => setTab(i)}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, tab === i && styles.tabTextActive]}>{s}</Text>
            {tab === i && (
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
                  ListHeaderComponent={<SearchBar value={searchMosque} onChange={setSearchMosque} placeholder={t('admin.search_mosques')} />}
                  ListEmptyComponent={<EmptyState label={searchMosque ? t('admin.no_results') : t('admin.no_mosques')} icon="business-outline" />}
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
                <SearchBar value={searchDbMosque} onChange={setSearchDbMosque} placeholder="Rechercher par nom ou adresse…" />
              }
              ListEmptyComponent={
                dbLoading
                  ? <ActivityIndicator color={colors.primary} style={styles.loader} />
                  : <EmptyState label="Aucune mosquée en base" icon="business-outline" />
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
                </View>
              }
              ListEmptyComponent={<EmptyState label={searchDecl ? t('admin.no_results') : t('admin.no_declarations')} icon="moon-outline" />}
              renderItem={({ item }) => {
                const declarant = usersById[item.utilisateurId];
                const declarantNom = declarant
                  ? `${declarant.prenom ?? ''} ${declarant.nom ?? ''}`.trim()
                  : item.utilisateurId ? `#${item.utilisateurId}` : t('admin.anonymous_user');
                const fmt = (raw) => parseUtc(raw)?.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) ?? null;
                const dateDecl = fmt(item.dateCreation);
                return (
                  <Row
                    title={item.estAnonyme ? t('admin.edit_anonymous') : (item.nomDefunt ?? t('admin.deceased_unknown'))}
                    subtitle={[item.mosqueeNom, fmt(item.dateHeurePriere)].filter(Boolean).join(' · ')}
                    extra={[dateDecl ? t('admin.declared_on', { date: dateDecl }) : null, t('admin.declared_by', { name: declarantNom })].filter(Boolean).join(' · ')}
                    onEdit={() => setEditDecl(item)}
                    onDelete={() => deleteDeclaration(
                      item.id,
                      item.estAnonyme ? t('admin.edit_anonymous') : (item.nomDefunt ?? `#${item.id}`)
                    )}
                  />
                );
              }}
            />
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
        }}
      />

      <EditPendingMosqueModal
        item={editPendingMosque}
        onClose={() => setEditPendingMosque(null)}
        onSaved={(updated) => {
          setPendingMosques(p => p.map(m => m.id === updated.id ? { ...m, ...updated } : m));
          setEditPendingMosque(null);
        }}
      />

      <EditPendingMosqueModal
        item={editMosque}
        onClose={() => setEditMosque(null)}
        onSaved={(updated) => {
          setMosques(p => p.map(m => m.id === updated.id ? { ...m, ...updated } : m));
          setEditMosque(null);
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
function Row({ title, subtitle, extra, onEdit, onDelete, badgeType }) {
  const { t } = useTranslation();
  const badgeLabel = badgeType === 'super_admin' ? t('admin.super_admin') : badgeType === 'admin' ? t('admin.role_admin') : null;
  return (
    <View style={styles.row}>
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
    </View>
  );
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
  const [nomDefunt, setNomDefunt] = useState('');
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
  const [mosqueeSearch, setMosqueeSearch] = useState('');
  const [selectedMosque, setSelectedMosque] = useState(null);
  const [mosqueeOptions, setMosqueeOptions] = useState([]);
  const [loadingMosquees, setLoadingMosquees] = useState(false);
  const [showDrop, setShowDrop] = useState(false);
  const mosqDebounceRef = useRef(null);
  const mosqLatestRef = useRef('');

  useEffect(() => {
    if (!item) return;
    setNomDefunt(item.nomDefunt ?? '');
    setEstAnonyme(item.estAnonyme ?? false);
    setGenre(item.genre ?? 'homme');
    const raw = item.dateHeurePriere;
    const d = raw ? new Date(/Z|[+-]\d{2}:/.test(raw) ? raw : raw + 'Z') : new Date();
    setSelectedDate(new Date(d.getFullYear(), d.getMonth(), d.getDate()));
    setSelectedHour(d.getHours());
    setSelectedMinute(d.getMinutes());
    setCommentaire(item.commentaire ?? '');
    setMosqueeSearch(item.mosqueeNom ?? '');
    setSelectedMosque(item.mosqueeId ? { id: String(item.mosqueeId), _dbId: item.mosqueeId, nom: item.mosqueeNom ?? '' } : null);
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
    setMosqueeSearch(mosque.nom);
    setSelectedMosque(mosque);
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

  const handleSave = async () => {
    if (!selectedDate) {
      Alert.alert(t('admin.edit_missing_date'), t('admin.edit_missing_date_message'));
      return;
    }
    const d = new Date(selectedDate);
    d.setHours(selectedHour, selectedMinute, 0, 0);
    setLoading(true);
    try {
      const mosqueeId = await resolveMosqueeId();
      const res = await apiClient.put(`/api/PriereJanaza/${item.id}`, {
        mosqueeId,
        utilisateurId: item.utilisateurId,
        nomDefunt: estAnonyme ? null : nomDefunt,
        estAnonyme,
        genre,
        dateHeurePriere: d.toISOString(),
        commentaire,
      });
      onSaved(res.data);
    } catch {
      Alert.alert(t('admin.add_error'), t('admin.edit_declaration_error'));
    } finally {
      setLoading(false);
    }
  };

  const announcementForm = {
    nomAnonyme: estAnonyme,
    nomDefunt,
    genre,
    mosqueeNom: item?.mosqueeNom ?? '',
    mosqueeAdresse: item?.mosqueeAdresse ?? '',
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
            <View style={styles.searchInputRow}>
              <Ionicons name="search-outline" size={16} color={colors.textMuted} style={styles.searchIcon} />
              <TextInput
                style={[styles.searchInput, selectedMosque && { color: colors.primary }]}
                value={mosqueeSearch}
                onChangeText={handleMosqueeSearch}
                onFocus={() => mosqueeSearch.length >= 2 && setShowDrop(true)}
                placeholder={t('admin.edit_mosque_label')}
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
              />
              {loadingMosquees && <ActivityIndicator size="small" color={colors.primary} style={{ marginRight: spacing.sm }} />}
            </View>
            {showDrop && mosqueeOptions.length > 0 && (
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
            {showDrop && !loadingMosquees && mosqueeSearch.length >= 2 && mosqueeOptions.length === 0 && (
              <View style={styles.noResultBox}>
                <Ionicons name="search-outline" size={14} color={colors.textMuted} />
                <Text style={styles.noResultText}>Aucune mosquée trouvée</Text>
              </View>
            )}
          </View>

          {/* Anonyme */}
          <View style={styles.switchRow}>
            <Text style={styles.modalLabel}>{t('admin.edit_anonymous')}</Text>
            <Switch value={estAnonyme} onValueChange={setEstAnonyme} trackColor={{ true: colors.primary }} thumbColor={colors.white} />
          </View>

          {/* Nom du défunt */}
          {!estAnonyme && (
            <ModalField label={t('admin.edit_deceased_name')}>
              <TextInput
                style={styles.modalInput}
                value={nomDefunt}
                onChangeText={setNomDefunt}
                placeholder={t('admin.edit_deceased_placeholder')}
                placeholderTextColor={colors.textMuted}
              />
            </ModalField>
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
        visible={showAnnouncement}
        onClose={() => setShowAnnouncement(false)}
        form={announcementForm}
        date={selectedDate}
        hour={selectedHour}
        minute={selectedMinute}
        initialValues={{ country: item?.paysEnterrement ?? null }}
        onDataChange={(data) => { if (data?.commentaire !== undefined) setCommentaire(data.commentaire); }}
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

// ── Edit pending mosque modal ─────────────────────────────────────────────────
function EditPendingMosqueModal({ item, onClose, onSaved }) {
  const { t } = useTranslation();
  const [nom, setNom] = useState('');
  const [adresse, setAdresse] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!item) return;
    setNom(item.nom ?? '');
    setAdresse(item.adresse ?? '');
  }, [item]);

  const handleSave = async () => {
    if (!nom.trim()) { Alert.alert(t('admin.add_missing_fields'), t('admin.edit_name_required')); return; }
    setLoading(true);
    try {
      await apiClient.put(`/api/Mosquee/${item.id}`, {
        nom: nom.trim(),
        adresse: adresse.trim() || null,
        latitude: item.latitude,
        longitude: item.longitude,
        osmId: item.osmId ?? null,
      });
      onSaved({ ...item, nom: nom.trim(), adresse: adresse.trim() || null });
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
                {item?.latitude?.toFixed(6)}, {item?.longitude?.toFixed(6)}
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
  container: { flex: 1, backgroundColor: colors.background },

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

  // Sub-tabs
  subTabs: { flexDirection: 'row', backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  subTab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingVertical: spacing.sm },
  subTabActive: { borderBottomWidth: 2, borderBottomColor: colors.primary },
  subTabText: { fontSize: 13, fontWeight: '500', color: colors.textMuted },
  subTabTextActive: { color: colors.primary, fontWeight: '600' },
  subTabCount: { fontSize: 11, color: colors.textMuted },
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
});
