import React, { useEffect, useState } from 'react';
import { useTabNavigation } from '../../navigation/MainNavigator';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, Alert, Image,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const MOSQUE_ICON_IMG = require('../../../assets/icons/mosquee_icon.png');
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector, useDispatch } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography, shadow } from '../../utils/theme';
import apiClient from '../../lib/api/apiClient';
import { useTranslation } from 'react-i18next';
import { MosqueDetailModal } from '../map/MapScreen';
import { JanazaShareModal } from '../declare/AnnouncementGenerator';
import { capitalizeFirst } from '../../utils/text';

function SubscriptionCard({ item, onUnsubscribe, onToggleNotif, onPress }) {
  const { t } = useTranslation();
  return (
    <TouchableOpacity style={styles.card} onPress={() => onPress?.(item)} activeOpacity={0.85}>
      <View style={styles.cardTop}>
        <View style={styles.mosqueIconWrapper}>
          <View style={styles.mosqueIconBox}>
            <Image source={MOSQUE_ICON_IMG} style={styles.mosqueIconImg} resizeMode="cover" />
          </View>
          {item.janazaCount > 0 && (
            <View style={styles.janazaCountBadge}>
              <Text style={styles.janazaCountBadgeText}>{item.janazaCount}</Text>
            </View>
          )}
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.mosqueName}>{capitalizeFirst(item.nom)}</Text>
          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={12} color={colors.textMuted} />
            <Text style={styles.mosqueMeta}>
              {item.distance != null ? `${item.distance.toFixed(1)} km · ` : ''}{item.janazaCount} prière{item.janazaCount !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => onUnsubscribe(item.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="close-circle-outline" size={22} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.notifBtn, item.notifActive && styles.notifBtnActive]}
        onPress={() => onToggleNotif(item.id)}
        activeOpacity={0.7}
      >
        <Ionicons
          name={item.notifActive ? 'notifications' : 'notifications-off-outline'}
          size={15}
          color={item.notifActive ? colors.primary : colors.textMuted}
        />
        <Text style={[styles.notifBtnText, item.notifActive && styles.notifBtnTextActive]}>
          {item.notifActive ? t('subscriptions.notifications_active') : t('subscriptions.notifications_disabled')}
        </Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

export default function SubscriptionsScreen() {
  const { goTo } = useTabNavigation();
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const subscriptions = useSelector((state) => state.mosques.subscriptions);
  const janazaList = useSelector((state) => state.janazas.list);
  const apiUser = useSelector((state) => state.auth.apiUser);
  const user = useSelector((state) => state.auth.user);
  const [selectedMosque, setSelectedMosque] = useState(null);
  const [shareItem, setShareItem] = useState(null);

  useEffect(() => {
    if (!apiUser?.id) return;
    apiClient.get(`/api/abonnement/utilisateur/${apiUser.id}`)
      .then(res => dispatch({ type: 'SUBSCRIPTIONS_LOADED', payload: res.data }))
      .catch(() => {});
  }, [apiUser?.id]);

  useEffect(() => {
    AsyncStorage.getItem('subscriptions_info_seen').then(seen => {
      if (seen) return;
      const timer = setTimeout(() => {
        Alert.alert(t('subscriptions.title'), t('subscriptions.subtitle'));
        AsyncStorage.setItem('subscriptions_info_seen', '1');
      }, 500);
      return () => clearTimeout(timer);
    });
  }, []);

  const subs = subscriptions.map((s) => ({
    ...s,
    janazaCount: s.mosqueeId ? janazaList.filter((j) => String(j.mosqueeId) === s.mosqueeId).length : 0,
  }));

  function handleUnsubscribe(id) {
    const sub = subscriptions.find(s => s.id === id);
    Alert.alert(
      t('subscriptions.unsubscribe_title'),
      t('subscriptions.unsubscribe_message'),
      [
        { text: t('subscriptions.unsubscribe_cancel'), style: 'cancel' },
        {
          text: t('subscriptions.unsubscribe_confirm'),
          style: 'destructive',
          onPress: async () => {
            if (sub?.apiId) {
              await apiClient.delete(`/api/abonnement/${sub.apiId}`).catch(() => {});
            }
            dispatch({ type: 'MOSQUE_UNSUBSCRIBE', payload: { id } });
          },
        },
      ]
    );
  }

  function handlePressMosque(sub) {
    const mosqueJanazas = janazaList.filter((j) => String(j.mosqueeId) === String(sub.mosqueeId));
    const ref = mosqueJanazas[0];
    setSelectedMosque({
      id: sub.mosqueeId,
      nom: sub.nom,
      adresse: ref?.adresse ?? null,
      latitude: ref?.latitude ?? null,
      longitude: ref?.longitude ?? null,
    });
  }

  function handleDelete(id) {
    Alert.alert(
      t('home.delete_title'),
      t('home.delete_message'),
      [
        { text: t('home.delete_cancel'), style: 'cancel' },
        {
          text: t('home.delete_confirm'),
          style: 'destructive',
          onPress: async () => {
            try { await apiClient.delete(`/api/prierejanaza/${id}`); } catch {}
            dispatch({ type: 'JANAZA_DELETE', payload: { id } });
          },
        },
      ]
    );
  }

  async function handleToggleNotif(id) {
    const sub = subscriptions.find(s => s.id === id);
    if (sub?.apiId) {
      await apiClient.put(`/api/abonnement/${sub.apiId}/notif`, { notifActive: !sub.notifActive }).catch(() => {});
    }
    dispatch({ type: 'MOSQUE_TOGGLE_NOTIF', payload: { id } });
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.headerTitle}>{t('subscriptions.title')}</Text>
            <TouchableOpacity onPress={() => Alert.alert(t('subscriptions.title'), t('subscriptions.subtitle'))} activeOpacity={0.7}>
              <Ionicons name="information-circle-outline" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
          <Text style={styles.headerSub}>
            {subs.length} {subs.length <= 1 ? t('subscriptions.mosque_singular') : t('subscriptions.mosque_plural')}
          </Text>
        </View>
      </View>

      <FlatList
        data={subs}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <SubscriptionCard
            item={item}
            onUnsubscribe={handleUnsubscribe}
            onToggleNotif={handleToggleNotif}
            onPress={handlePressMosque}
          />
        )}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIconBox}>
              <Ionicons name="notifications-outline" size={40} color={colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>{t('subscriptions.empty_title')}</Text>
            <Text style={styles.emptyText}>{t('subscriptions.empty_message')}</Text>
            <TouchableOpacity
              style={styles.discoverBtn}
              onPress={() => goTo('Map')}
              activeOpacity={0.8}
            >
              <Ionicons name="map-outline" size={16} color={colors.white} />
              <Text style={styles.discoverBtnText}>{t('subscriptions.discover')}</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {selectedMosque && (
        <MosqueDetailModal
          mosque={selectedMosque}
          distKm={null}
          janazas={janazaList.filter((j) => String(j.mosqueeId) === String(selectedMosque.id))}
          onClose={() => setSelectedMosque(null)}
          onShare={(janaza) => { setSelectedMosque(null); setTimeout(() => setShareItem(janaza), 350); }}
          onDelete={handleDelete}
          currentUserId={apiUser?.id}
          currentUserRole={user?.role}
        />
      )}
      <JanazaShareModal
        visible={shareItem !== null}
        onClose={() => setShareItem(null)}
        janaza={shareItem}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundSecondary },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: { ...typography.h2 },
  headerSub: { ...typography.caption, marginTop: 2 },

  list: { padding: spacing.lg, gap: spacing.md },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.sm,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  mosqueIconWrapper: { position: 'relative' },
  janazaCountBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    minWidth: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  janazaCountBadgeText: { color: colors.white, fontSize: 11, fontWeight: '700' },
  mosqueIconBox: {
    width: 80, height: 80,
    borderRadius: radius.md,
    backgroundColor: colors.primaryDim,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  mosqueIconImg: { width: 80, height: 80 },
  cardInfo: { flex: 1 },
  mosqueName: { ...typography.body, fontWeight: '700', marginBottom: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  mosqueMeta: { ...typography.caption },

  notifBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  notifBtnActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryDim,
  },
  notifBtnText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  notifBtnTextActive: { color: colors.primary },

  empty: {
    alignItems: 'center',
    paddingTop: spacing.xxl,
    paddingHorizontal: spacing.xl,
  },
  emptyIconBox: {
    width: 80, height: 80,
    borderRadius: radius.full,
    backgroundColor: colors.primaryDim,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyTitle: { ...typography.h3, marginBottom: spacing.sm },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  discoverBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  discoverBtnText: { ...typography.button },
});
