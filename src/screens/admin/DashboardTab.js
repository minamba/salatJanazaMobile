import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet, Switch, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSelector, useDispatch } from 'react-redux';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from '../../lib/api/apiClient';
import { colors, spacing, radius, shadow } from '../../utils/theme';

const PERIODS = [
  { key: 'jour',    label: 'JOUR'    },
  { key: 'semaine', label: 'SEMAINE' },
  { key: 'mois',    label: 'MOIS'    },
  { key: 'annee',   label: 'ANNÉE'   },
];

const SHORT_MONTHS = ['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Aoû','Sep','Oct','Nov','Déc'];
const LONG_MONTHS  = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const DECL_COLOR   = '#10B981';
const USER_COLOR   = '#0284C7';

const DEFAULT_CARD_ORDER = ['decl', 'users', 'genre', 'pays', 'mosquee', 'global'];
const CARD_ORDER_KEY     = '@dashboard_card_order';

function getDateLabel(period, d) {
  if (period === 'jour') {
    return `${d.getDate()} ${SHORT_MONTHS[d.getMonth()]}. ${d.getFullYear()}`;
  }
  if (period === 'semaine') {
    const dow   = ((d.getDay() + 6) % 7);
    const start = new Date(d); start.setDate(d.getDate() - dow);
    const end   = new Date(start); end.setDate(start.getDate() + 6);
    return start.getMonth() === end.getMonth()
      ? `${start.getDate()} - ${end.getDate()} ${SHORT_MONTHS[end.getMonth()]}. ${end.getFullYear()}`
      : `${start.getDate()} ${SHORT_MONTHS[start.getMonth()]} - ${end.getDate()} ${SHORT_MONTHS[end.getMonth()]}. ${end.getFullYear()}`;
  }
  if (period === 'mois') return `${LONG_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  return String(d.getFullYear());
}

function isCurrentPeriod(period, d) {
  const now = new Date();
  if (period === 'jour')  return d.toDateString() === now.toDateString();
  if (period === 'mois')  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  if (period === 'annee') return d.getFullYear() === now.getFullYear();
  const dow = ((d.getDay() + 6) % 7);
  const ws  = new Date(d); ws.setDate(d.getDate() - dow);
  const we  = new Date(ws); we.setDate(ws.getDate() + 6);
  return now >= ws && now <= we;
}

function displayNom(nomDefunt, estAnonyme) {
  if (estAnonyme || !nomDefunt) return 'Anonyme';
  return nomDefunt.replace(/"/g, '').trim();
}

// ── BarChart ─────────────────────────────────────────────────────────────────
function BarChart({ series, color, onBarPress, selectedIndex, zoom }) {
  const CHART_H = zoom ? 180 : 100;
  const maxVal  = Math.max(...series.map(s => s.value), 1);
  const slotW   = zoom ? 48 : Math.min(28, Math.max(10, Math.floor(330 / series.length)));
  const barW    = zoom ? 24 : Math.max(6, slotW - 6);

  const bars = (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: CHART_H + (zoom ? 44 : 32) }}>
      {series.map((pt, i) => {
        const isSelected = selectedIndex === i;
        const isDimmed   = selectedIndex != null && !isSelected;
        return (
          <TouchableOpacity
            key={i}
            style={[
              { alignItems: 'center', justifyContent: 'flex-end', height: CHART_H + (zoom ? 44 : 32) },
              zoom ? { width: slotW + 8 } : { flex: 1 },
            ]}
            onPress={() => onBarPress?.(i, pt.label, pt.value)}
            activeOpacity={pt.value > 0 ? 0.7 : 1}
            disabled={!onBarPress}
          >
            {pt.value > 0 && (zoom || slotW >= 16) && (
              <Text style={[styles.barValue, {
                fontSize: zoom ? 10 : 8,
                fontWeight: isSelected ? '800' : '600',
                color: isSelected ? color : colors.textMuted,
              }]}>
                {pt.value}
              </Text>
            )}
            <View style={[styles.bar, {
              width: barW,
              height: Math.max(2, (pt.value / maxVal) * CHART_H),
              backgroundColor: color,
              opacity: isDimmed ? 0.25 : 1,
              ...(isSelected && {
                shadowColor: color,
                shadowOpacity: 0.45,
                shadowRadius: 6,
                shadowOffset: { width: 0, height: 2 },
              }),
            }]} />
            <Text style={[styles.barLabel, {
              fontSize: zoom ? 9 : (slotW < 14 ? 6 : 7),
              width: zoom ? slotW + 8 : slotW,
              fontWeight: isSelected ? '700' : '400',
              color: isSelected ? colors.text : colors.textMuted,
            }]} numberOfLines={1}>
              {pt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  if (zoom) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} bounces={false}>
        {bars}
      </ScrollView>
    );
  }
  return bars;
}

// ── Slot detail panels ───────────────────────────────────────────────────────
function DeclDetail({ slot, loading, onClose }) {
  if (!slot) return null;
  const count = slot.items?.length ?? 0;
  return (
    <View style={styles.detailPanel}>
      <View style={styles.detailHeader}>
        <Ionicons name="time-outline" size={13} color={DECL_COLOR} />
        <Text style={[styles.detailTitle, { color: DECL_COLOR }]}>
          {slot.label}
          {slot.items != null ? `  ·  ${count} janaza${count !== 1 ? 's' : ''}` : ''}
        </Text>
        <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="close-circle" size={16} color={colors.textMuted} />
        </TouchableOpacity>
      </View>
      {loading ? (
        <ActivityIndicator size="small" color={DECL_COLOR} style={{ marginVertical: 10 }} />
      ) : slot.error ? (
        <Text style={[styles.detailEmpty, { color: '#EF4444' }]}>Erreur de chargement</Text>
      ) : count === 0 ? (
        <Text style={styles.detailEmpty}>Aucune donnée</Text>
      ) : (
        slot.items.map((it, idx) => (
          <View key={idx} style={[styles.detailRow, idx > 0 && styles.detailRowBorder]}>
            <Text style={styles.detailNom} numberOfLines={1}>
              {displayNom(it.nomDefunt, it.estAnonyme)}
            </Text>
            <View style={styles.detailMeta}>
              <Text style={styles.detailMetaText} numberOfLines={1}>
                {it.declarantPrenom || it.declarantNom
                  ? `par ${(it.declarantPrenom ?? '')} ${(it.declarantNom ?? '').toUpperCase()}`.trim()
                  : 'Déclarant inconnu'}
              </Text>
              <View style={styles.detailDot} />
              <Text style={styles.detailTime}>{it.heureDeclaration}</Text>
            </View>
          </View>
        ))
      )}
    </View>
  );
}

function UserDetail({ slot, loading, onClose }) {
  if (!slot) return null;
  const count = slot.items?.length ?? 0;
  return (
    <View style={[styles.detailPanel, { borderLeftColor: USER_COLOR }]}>
      <View style={styles.detailHeader}>
        <Ionicons name="person-add-outline" size={13} color={USER_COLOR} />
        <Text style={[styles.detailTitle, { color: USER_COLOR }]}>
          {slot.label}
          {slot.items != null ? `  ·  ${count} inscription${count !== 1 ? 's' : ''}` : ''}
        </Text>
        <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="close-circle" size={16} color={colors.textMuted} />
        </TouchableOpacity>
      </View>
      {loading ? (
        <ActivityIndicator size="small" color={USER_COLOR} style={{ marginVertical: 10 }} />
      ) : slot.error ? (
        <Text style={[styles.detailEmpty, { color: '#EF4444' }]}>Erreur de chargement</Text>
      ) : count === 0 ? (
        <Text style={styles.detailEmpty}>Aucune donnée</Text>
      ) : (
        slot.items.map((it, idx) => (
          <View key={idx} style={[styles.detailRow, idx > 0 && styles.detailRowBorder]}>
            <Text style={styles.detailNom}>
              {it.prenom} {(it.nom ?? '').toUpperCase()}
            </Text>
          </View>
        ))
      )}
    </View>
  );
}

// ── GenreRow / RankList ──────────────────────────────────────────────────────
function GenreRow({ label, count, total, color }) {
  const pct = total > 0 ? (count / total) : 0;
  return (
    <View style={styles.rankItem}>
      <View style={styles.rankHeader}>
        <View style={[styles.genreDot, { backgroundColor: color }]} />
        <Text style={[styles.rankLabel, { flex: 1 }]}>{label}</Text>
        <Text style={styles.rankCount}>{count}</Text>
      </View>
      <View style={styles.trackBg}>
        <View style={[styles.trackFill, { width: `${pct * 100}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

function RankList({ items, labelKey, countKey, color }) {
  if (!items?.length) return <Text style={styles.emptyText}>Aucune donnée</Text>;
  const max = Math.max(...items.map(i => i[countKey]), 1);
  return items.map((item, idx) => (
    <View key={idx} style={styles.rankItem}>
      <View style={styles.rankHeader}>
        <Text style={[styles.rankLabel, { flex: 1, marginRight: 8 }]} numberOfLines={1}>{item[labelKey]}</Text>
        <Text style={styles.rankCount}>{item[countKey]}</Text>
      </View>
      <View style={styles.trackBg}>
        <View style={[styles.trackFill, { width: `${(item[countKey] / max) * 100}%`, backgroundColor: color }]} />
      </View>
    </View>
  ));
}

// ── Main component ───────────────────────────────────────────────────────────
export default function DashboardTab() {
  const [period,      setPeriod]      = useState('jour');
  const [refDate,     setRefDate]     = useState(new Date());
  const [genreFilter, setGenreFilter] = useState(null);
  const [stats,       setStats]       = useState(null);
  const [loading,     setLoading]     = useState(false);
  const [zoomMode,    setZoomMode]    = useState(false);
  const [editMode,    setEditMode]    = useState(false);
  const [cardOrder,   setCardOrder]   = useState(DEFAULT_CARD_ORDER);

  const [selectedDeclSlot, setSelectedDeclSlot] = useState(null);
  const [declSlotLoading,  setDeclSlotLoading]  = useState(false);
  const [selectedUserSlot, setSelectedUserSlot] = useState(null);
  const [userSlotLoading,  setUserSlotLoading]  = useState(false);

  const [savingFeature, setSavingFeature] = useState(false);

  const dispatch = useDispatch();
  const janazasCount   = useSelector(s => s.janazas?.list?.length ?? 0);
  const donationButtonVisible = useSelector(s => s.features?.donationButtonVisible ?? true);
  const prevJanazasRef = useRef(janazasCount);

  const toggleDonationButton = useCallback(async (value) => {
    // Mise à jour optimiste immédiate
    dispatch({ type: 'FEATURES_LOADED', payload: { donationButtonVisible: value } });
    setSavingFeature(true);
    try {
      const res = await apiClient.put('/api/features/donation-button', { visible: value });
      dispatch({ type: 'FEATURES_LOADED', payload: { donationButtonVisible: res.data.donationButtonVisible } });
    } catch (e) {
      // Rollback si erreur serveur
      dispatch({ type: 'FEATURES_LOADED', payload: { donationButtonVisible: !value } });
      Alert.alert('Erreur', `Impossible de sauvegarder (${e?.response?.status ?? 'réseau'})`);
    } finally {
      setSavingFeature(false);
    }
  }, [dispatch]);

  // Load saved card order on mount
  useEffect(() => {
    AsyncStorage.getItem(CARD_ORDER_KEY).then(val => {
      if (!val) return;
      try {
        const saved = JSON.parse(val);
        if (Array.isArray(saved) && DEFAULT_CARD_ORDER.every(k => saved.includes(k))) {
          setCardOrder(saved);
        }
      } catch {}
    }).catch(() => {});
  }, []);

  // Persist card order whenever it changes
  useEffect(() => {
    AsyncStorage.setItem(CARD_ORDER_KEY, JSON.stringify(cardOrder)).catch(() => {});
  }, [cardOrder]);

  const navigate = useCallback((dir) => {
    setRefDate(prev => {
      const d     = new Date(prev);
      const delta = dir === 'prev' ? -1 : 1;
      if      (period === 'jour')    d.setDate(d.getDate() + delta);
      else if (period === 'semaine') d.setDate(d.getDate() + delta * 7);
      else if (period === 'mois')    d.setMonth(d.getMonth() + delta);
      else                           d.setFullYear(d.getFullYear() + delta);
      return d;
    });
  }, [period]);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const dateStr          = refDate.toISOString().split('T')[0];
      const utcOffsetMinutes = -new Date().getTimezoneOffset();
      const res = await apiClient.get('/api/Dashboard/stats', {
        params: { period, date: dateStr, utcOffsetMinutes, ...(genreFilter ? { genre: genreFilter } : {}) },
      });
      setStats(res.data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [period, refDate, genreFilter]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  useEffect(() => {
    if (prevJanazasRef.current !== janazasCount) {
      prevJanazasRef.current = janazasCount;
      fetchStats();
    }
  }, [janazasCount, fetchStats]);

  useEffect(() => {
    setSelectedDeclSlot(null);
    setSelectedUserSlot(null);
  }, [period, refDate, genreFilter]);

  function slotParams(index, type) {
    const d = refDate;
    const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    return { period, date: dateStr, utcOffsetMinutes: -new Date().getTimezoneOffset(), slotIndex: index, type };
  }

  async function handleDeclBarPress(index, label, value) {
    if (value === 0) return;
    if (selectedDeclSlot?.index === index) { setSelectedDeclSlot(null); return; }
    setDeclSlotLoading(true);
    setSelectedDeclSlot({ index, label, items: null });
    try {
      const res = await apiClient.get('/api/Dashboard/slot-details', { params: slotParams(index, 'declarations') });
      setSelectedDeclSlot({ index, label, items: res.data });
    } catch {
      setSelectedDeclSlot({ index, label, items: [], error: true });
    } finally {
      setDeclSlotLoading(false);
    }
  }

  async function handleUserBarPress(index, label, value) {
    if (value === 0) return;
    if (selectedUserSlot?.index === index) { setSelectedUserSlot(null); return; }
    setUserSlotLoading(true);
    setSelectedUserSlot({ index, label, items: null });
    try {
      const res = await apiClient.get('/api/Dashboard/slot-details', { params: slotParams(index, 'utilisateurs') });
      setSelectedUserSlot({ index, label, items: res.data });
    } catch {
      setSelectedUserSlot({ index, label, items: [], error: true });
    } finally {
      setUserSlotLoading(false);
    }
  }

  const decl   = stats?.declarations;
  const users  = stats?.utilisateurs;
  const gTotal = decl
    ? decl.byGenre.homme + decl.byGenre.femme + decl.byGenre.enfant
    : 0;

  // Cards currently visible given the loaded data
  const visibleCards = cardOrder.filter(k => {
    if (k === 'genre')   return !!decl;
    if (k === 'pays')    return (decl?.byPays?.length ?? 0) > 0;
    if (k === 'mosquee') return (decl?.byMosquee?.length ?? 0) > 0;
    if (k === 'global')  return stats?.globalStats != null;
    return true;
  });

  function moveCard(visibleIdx, direction) {
    const newIdx = visibleIdx + direction;
    if (newIdx < 0 || newIdx >= visibleCards.length) return;
    const key1 = visibleCards[visibleIdx];
    const key2 = visibleCards[newIdx];
    setCardOrder(prev => {
      const next = [...prev];
      const i1 = next.indexOf(key1);
      const i2 = next.indexOf(key2);
      [next[i1], next[i2]] = [next[i2], next[i1]];
      return next;
    });
  }

  function renderCard(cardKey, visibleIdx) {
    const isFirst = visibleIdx === 0;
    const isLast  = visibleIdx === visibleCards.length - 1;

    const moveControls = editMode ? (
      <View style={styles.moveControls}>
        <TouchableOpacity
          onPress={() => moveCard(visibleIdx, -1)}
          hitSlop={{ top: 8, bottom: 4, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-up-circle" size={22} color={isFirst ? colors.border : colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => moveCard(visibleIdx, 1)}
          hitSlop={{ top: 4, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-down-circle" size={22} color={isLast ? colors.border : colors.primary} />
        </TouchableOpacity>
      </View>
    ) : null;

    switch (cardKey) {

      case 'decl': return (
        <View key="decl" style={[styles.card, editMode && styles.cardEditMode]}>
          <View style={styles.cardTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardLabel}>JANAZAS DÉCLARÉES</Text>
              <Text style={[styles.cardTotal, { color: DECL_COLOR }]}>{decl?.total ?? '—'}</Text>
            </View>
            <View style={[styles.dot, { backgroundColor: DECL_COLOR, marginRight: editMode ? 8 : 0 }]} />
            {moveControls}
          </View>
          {decl?.series?.length > 0 && (
            <>
              <BarChart
                series={decl.series}
                color={DECL_COLOR}
                onBarPress={handleDeclBarPress}
                selectedIndex={selectedDeclSlot?.index}
                zoom={zoomMode}
              />
              <DeclDetail
                slot={selectedDeclSlot}
                loading={declSlotLoading}
                onClose={() => setSelectedDeclSlot(null)}
              />
            </>
          )}
        </View>
      );

      case 'users': return (
        <View key="users" style={[styles.card, editMode && styles.cardEditMode]}>
          <View style={styles.cardTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardLabel}>NOUVELLES INSCRIPTIONS</Text>
              <Text style={[styles.cardTotal, { color: USER_COLOR }]}>{users?.total ?? '—'}</Text>
            </View>
            <View style={[styles.dot, { backgroundColor: USER_COLOR, marginRight: editMode ? 8 : 0 }]} />
            {moveControls}
          </View>
          {users?.series?.length > 0 && (
            <>
              <BarChart
                series={users.series}
                color={USER_COLOR}
                onBarPress={handleUserBarPress}
                selectedIndex={selectedUserSlot?.index}
                zoom={zoomMode}
              />
              <UserDetail
                slot={selectedUserSlot}
                loading={userSlotLoading}
                onClose={() => setSelectedUserSlot(null)}
              />
            </>
          )}
        </View>
      );

      case 'genre': return !decl ? null : (
        <View key="genre" style={[styles.card, editMode && styles.cardEditMode]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>PAR GENRE</Text>
            {moveControls}
          </View>
          <GenreRow label="Homme"  count={decl.byGenre.homme}  total={gTotal} color="#0284C7" />
          <GenreRow label="Femme"  count={decl.byGenre.femme}  total={gTotal} color="#EC4899" />
          <GenreRow label="Enfant" count={decl.byGenre.enfant} total={gTotal} color="#F59E0B" />
        </View>
      );

      case 'pays': return !(decl?.byPays?.length > 0) ? null : (
        <View key="pays" style={[styles.card, editMode && styles.cardEditMode]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>PAR PAYS</Text>
            {moveControls}
          </View>
          <RankList items={decl.byPays} labelKey="pays" countKey="count" color={DECL_COLOR} />
        </View>
      );

      case 'mosquee': return !(decl?.byMosquee?.length > 0) ? null : (
        <View key="mosquee" style={[styles.card, editMode && styles.cardEditMode]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>PAR MOSQUÉE</Text>
            {moveControls}
          </View>
          <RankList items={decl.byMosquee} labelKey="nom" countKey="count" color={colors.primary} />
        </View>
      );

      case 'global': return stats?.globalStats == null ? null : (
        <View key="global" style={[styles.card, editMode && styles.cardEditMode]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>UTILISATEURS INSCRITS</Text>
            {moveControls}
          </View>
          <Text style={[styles.cardTotal, { color: USER_COLOR, fontSize: 32, marginBottom: spacing.md }]}>
            {stats.globalStats.totalUtilisateurs}
          </Text>
          <View style={styles.platformRow}>
            <View style={styles.platformItem}>
              <Ionicons name="logo-android" size={22} color="#3DDC84" />
              <Text style={[styles.platformCount, { color: '#3DDC84' }]}>{stats.globalStats.android}</Text>
              <Text style={styles.platformLabel}>Android</Text>
            </View>
            <View style={styles.platformDivider} />
            <View style={styles.platformItem}>
              <Ionicons name="logo-apple" size={22} color={colors.text} />
              <Text style={[styles.platformCount, { color: colors.text }]}>{stats.globalStats.ios}</Text>
              <Text style={styles.platformLabel}>iOS</Text>
            </View>
            {stats.globalStats.inconnu > 0 && (
              <>
                <View style={styles.platformDivider} />
                <View style={styles.platformItem}>
                  <Ionicons name="phone-portrait-outline" size={22} color={colors.textMuted} />
                  <Text style={[styles.platformCount, { color: colors.textMuted }]}>{stats.globalStats.inconnu}</Text>
                  <Text style={styles.platformLabel}>Inconnu</Text>
                </View>
              </>
            )}
          </View>
        </View>
      );

      default: return null;
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

      {/* ── Period selector ─────────────────────────── */}
      <View style={styles.periodRow}>
        {PERIODS.map(p => (
          <TouchableOpacity
            key={p.key}
            style={[styles.periodBtn, period === p.key && styles.periodBtnActive]}
            onPress={() => { setPeriod(p.key); setRefDate(new Date()); }}
            activeOpacity={0.7}
          >
            <Text style={[styles.periodText, period === p.key && styles.periodTextActive]}>{p.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Date navigation ─────────────────────────── */}
      <View style={styles.dateNav}>
        <TouchableOpacity style={styles.navArrow} onPress={() => navigate('prev')}>
          <Ionicons name="chevron-back" size={18} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.dateLabel}>{getDateLabel(period, refDate)}</Text>
        <TouchableOpacity style={styles.navArrow} onPress={() => navigate('next')}>
          <Ionicons name="chevron-forward" size={18} color={colors.primary} />
        </TouchableOpacity>
        {!isCurrentPeriod(period, refDate) && (
          <TouchableOpacity style={styles.todayBtn} onPress={() => setRefDate(new Date())}>
            <Text style={styles.todayText}>Auj.</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Genre filter ─────────────────────────────── */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.sm }}>
        <View style={styles.genreRow}>
          {[
            { key: null,     label: 'Tous'   },
            { key: 'homme',  label: 'Homme'  },
            { key: 'femme',  label: 'Femme'  },
            { key: 'enfant', label: 'Enfant' },
          ].map(g => (
            <TouchableOpacity
              key={g.key ?? 'tous'}
              style={[styles.genreBtn, genreFilter === g.key && styles.genreBtnActive]}
              onPress={() => setGenreFilter(g.key)}
              activeOpacity={0.7}
            >
              <Text style={[styles.genreBtnText, genreFilter === g.key && styles.genreBtnTextActive]}>
                {g.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* ── Zoom toggle + Reorder button ─────────────── */}
      <View style={styles.viewToggleRow}>
        <View style={styles.viewToggle}>
          <TouchableOpacity
            style={[styles.viewToggleBtn, !zoomMode && styles.viewToggleBtnActive]}
            onPress={() => setZoomMode(false)}
            activeOpacity={0.7}
          >
            <Ionicons name="contract-outline" size={13} color={!zoomMode ? colors.white : colors.textMuted} />
            <Text style={[styles.viewToggleText, !zoomMode && styles.viewToggleTextActive]}>Vue globale</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.viewToggleBtn, zoomMode && styles.viewToggleBtnActive]}
            onPress={() => setZoomMode(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="expand-outline" size={13} color={zoomMode ? colors.white : colors.textMuted} />
            <Text style={[styles.viewToggleText, zoomMode && styles.viewToggleTextActive]}>Zoom</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.reorderBtn, editMode && styles.reorderBtnActive]}
          onPress={() => setEditMode(e => !e)}
          activeOpacity={0.7}
        >
          <Ionicons
            name={editMode ? 'checkmark-done-outline' : 'reorder-two-outline'}
            size={14}
            color={editMode ? colors.white : colors.textMuted}
          />
          <Text style={[styles.reorderBtnText, editMode && styles.reorderBtnTextActive]}>
            {editMode ? 'Terminer' : 'Réorganiser'}
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 60 }} />
      ) : (
        visibleCards.map((cardKey, idx) => renderCard(cardKey, idx))
      )}

      {/* ── Fonctionnalités ───────────────────────────── */}
      <View style={styles.featureCard}>
        <Text style={styles.featureCardTitle}>FONCTIONNALITÉS</Text>
        <View style={styles.featureRow}>
          <View style={styles.featureRowLeft}>
            <Ionicons name="heart-outline" size={18} color={colors.primary} style={{ marginRight: spacing.sm }} />
            <View>
              <Text style={styles.featureRowLabel}>Bouton "Nous soutenir"</Text>
              <Text style={styles.featureRowSub}>Visible sur mobile et web</Text>
            </View>
          </View>
          {savingFeature ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Switch
              value={donationButtonVisible}
              onValueChange={toggleDonationButton}
              trackColor={{ false: colors.border, true: colors.primary + '60' }}
              thumbColor={donationButtonVisible ? colors.primary : colors.textMuted}
            />
          )}
        </View>
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content:   { padding: spacing.md, paddingBottom: 48 },

  // Period selector
  periodRow:        { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.sm, padding: 3, marginBottom: spacing.md, ...shadow.sm },
  periodBtn:        { flex: 1, paddingVertical: 7, alignItems: 'center', borderRadius: radius.sm - 3 },
  periodBtnActive:  { backgroundColor: colors.primary },
  periodText:       { fontSize: 10, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.6 },
  periodTextActive: { color: colors.white },

  // Date nav
  dateNav:   { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  navArrow:  { padding: 7, borderRadius: radius.sm, backgroundColor: colors.surface, ...shadow.sm },
  dateLabel: { flex: 1, textAlign: 'center', fontSize: 14, fontWeight: '600', color: colors.text },
  todayBtn:  { marginLeft: 8, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full, backgroundColor: colors.primaryDim },
  todayText: { fontSize: 11, fontWeight: '700', color: colors.primary },

  // Genre filter
  genreRow:           { flexDirection: 'row', gap: 8, paddingHorizontal: 2 },
  genreBtn:           { paddingHorizontal: 14, paddingVertical: 6, borderRadius: radius.full, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border },
  genreBtnActive:     { backgroundColor: colors.primary, borderColor: colors.primary },
  genreBtnText:       { fontSize: 12, fontWeight: '500', color: colors.textSecondary },
  genreBtnTextActive: { color: colors.white },

  // Zoom toggle + reorder row
  viewToggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  viewToggle:    { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.sm, padding: 3, borderWidth: 1, borderColor: colors.border },
  viewToggleBtn:        { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 5, borderRadius: radius.sm - 3 },
  viewToggleBtnActive:  { backgroundColor: colors.primary },
  viewToggleText:       { fontSize: 11, fontWeight: '600', color: colors.textMuted },
  viewToggleTextActive: { color: colors.white },

  // Reorder button
  reorderBtn:           { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  reorderBtnActive:     { backgroundColor: colors.primary, borderColor: colors.primary },
  reorderBtnText:       { fontSize: 11, fontWeight: '600', color: colors.textMuted },
  reorderBtnTextActive: { color: colors.white },

  // Cards
  card:         { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md, ...shadow.sm },
  cardEditMode: { borderWidth: 1.5, borderColor: colors.primary + '30' },
  cardTop:      { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.sm },
  cardLabel:    { fontSize: 10, fontWeight: '700', color: colors.textMuted, letterSpacing: 1, marginBottom: 2 },
  cardTotal:    { fontSize: 36, fontWeight: '800', letterSpacing: -1 },
  dot:          { width: 10, height: 10, borderRadius: 5, marginTop: 8 },

  // Section header (label + move controls in a row)
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  sectionLabel:  { fontSize: 10, fontWeight: '700', color: colors.textMuted, letterSpacing: 1 },

  // Move controls (↑↓ buttons)
  moveControls: { flexDirection: 'column', alignItems: 'center', gap: 2, marginLeft: 4 },

  // Chart bars
  bar:      { borderRadius: 3 },
  barValue: { fontSize: 8, color: colors.textMuted, marginBottom: 2 },
  barLabel: { marginTop: 3, textAlign: 'center' },

  // Detail panel
  detailPanel: {
    marginTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: DECL_COLOR,
    paddingLeft: spacing.sm,
  },
  detailHeader:    { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.sm },
  detailTitle:     { flex: 1, fontSize: 13, fontWeight: '700', color: DECL_COLOR, letterSpacing: 0.2 },
  detailRow:       { paddingVertical: 7 },
  detailRowBorder: { borderTopWidth: 1, borderTopColor: colors.borderLight },
  detailNom:       { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 2 },
  detailMeta:      { flexDirection: 'row', alignItems: 'center', gap: 6 },
  detailMetaText:  { fontSize: 12, color: colors.textSecondary, flexShrink: 1 },
  detailDot:       { width: 3, height: 3, borderRadius: 2, backgroundColor: colors.textMuted },
  detailTime:      { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  detailEmpty:     { fontSize: 13, color: colors.textMuted, paddingVertical: 8 },

  // Rank items
  rankItem:   { marginBottom: 10 },
  rankHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  rankLabel:  { fontSize: 13, color: colors.text },
  rankCount:  { fontSize: 13, fontWeight: '700', color: colors.text },
  trackBg:    { height: 5, backgroundColor: colors.borderLight, borderRadius: 3 },
  trackFill:  { height: 5, borderRadius: 3 },
  genreDot:   { width: 8, height: 8, borderRadius: 4, marginRight: 8 },

  emptyText: { fontSize: 13, color: colors.textMuted },

  // Platform stats
  platformRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  platformItem:    { alignItems: 'center', gap: 4, flex: 1 },
  platformCount:   { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  platformLabel:   { fontSize: 11, fontWeight: '600', color: colors.textMuted, letterSpacing: 0.5 },
  platformDivider: { width: 1, height: 48, backgroundColor: colors.border },

  // Feature flags card
  featureCard:      { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md, ...shadow.sm },
  featureCardTitle: { fontSize: 10, fontWeight: '700', color: colors.textMuted, letterSpacing: 1, marginBottom: spacing.sm },
  featureRow:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  featureRowLeft:   { flexDirection: 'row', alignItems: 'center', flex: 1 },
  featureRowLabel:  { fontSize: 14, fontWeight: '600', color: colors.text },
  featureRowSub:    { fontSize: 12, color: colors.textMuted, marginTop: 2 },
});
