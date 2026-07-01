import React, { useState, useRef, useEffect, useMemo, useCallback, createContext, useContext } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import PagerView from 'react-native-pager-view';
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions, Modal, TouchableWithoutFeedback, Alert, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import apiClient from '../lib/api/apiClient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSelector, useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { colors, spacing, radius, typography } from '../utils/theme';
import HomeScreen from '../screens/home/HomeScreen';
import MapScreen from '../screens/map/MapScreen';
import DeclareScreen from '../screens/declare/DeclareScreen';
import SubscriptionsScreen from '../screens/subscriptions/SubscriptionsScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';
import PriereScreen from '../screens/priere/PriereScreen';
import ContactScreen from '../screens/contact/ContactScreen';
import AdminScreen from '../screens/admin/AdminScreen';

// Context permettant aux écrans de changer d'onglet sans React Navigation
export const TabContext = createContext({ goTo: () => {}, activeIndex: 0 });
export function useTabNavigation() { return useContext(TabContext); }

const Stack = createNativeStackNavigator();

const TAB_ICONS = {
  Home:          ['home-outline',             'home'],
  Map:           ['map-outline',              'map'],
  Priere:        ['book-outline',             'book'],
  Subscriptions: ['notifications-outline',   'notifications'],
  Profile:       ['person-outline',           'person'],
  Contact:       ['mail-outline',             'mail'],
  Admin:         ['shield-checkmark-outline', 'shield-checkmark'],
};

const TAB_LABEL_KEYS = {
  Home:          'nav.home',
  Map:           'nav.map',
  Priere:        'nav.prayer',
  Subscriptions: 'nav.subscriptions',
  Profile:       'nav.profile',
  Contact:       'nav.contact',
  Admin:         'nav.admin',
};

const FAB_SIZE = 56;
const GUEST_RESTRICTED = ['Subscriptions', 'Contact', 'Profile'];

function GuestModal({ visible, onClose, onLogin }) {
  const { t } = useTranslation();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback>
            <View style={styles.modalBox}>
              <Ionicons name="lock-closed-outline" size={36} color={colors.primary} style={{ marginBottom: spacing.md }} />
              <Text style={styles.modalTitle}>{t('nav.guest_modal_title')}</Text>
              <Text style={styles.modalText}>{t('nav.guest_modal_text')}</Text>
              <TouchableOpacity style={styles.modalBtn} onPress={onLogin} activeOpacity={0.8}>
                <Text style={styles.modalBtnText}>{t('nav.guest_modal_login')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={onClose} activeOpacity={0.7}>
                <Text style={styles.modalCancelText}>{t('nav.guest_modal_cancel')}</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

function DeclareChoiceModal({ visible, onClose, onSaisir }) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const apiUser = useSelector(state => state.auth.apiUser);
  const user = useSelector(state => state.auth.user);

  const [importLoading, setImportLoading] = useState(false);
  const [importStatus, setImportStatus] = useState(null);
  const [importMessage, setImportMessage] = useState('');
  const [importTimeUnknown, setImportTimeUnknown] = useState(false);
  const importPollRef = useRef(null);

  useEffect(() => {
    if (!visible) {
      if (importPollRef.current) { clearInterval(importPollRef.current); importPollRef.current = null; }
      setImportLoading(false);
      setImportStatus(null);
      setImportMessage('');
      setImportTimeUnknown(false);
    }
  }, [visible]);


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
                  payload: { id: `db_${m.id}`, nom: m.nom, adresse: m.adresse ?? '', latitude: m.latitude, longitude: m.longitude, source: 'user' },
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
          }
        } catch (_) {}
      }, 3000);

      setTimeout(() => {
        if (importPollRef.current) {
          clearInterval(importPollRef.current);
          importPollRef.current = null;
          setImportLoading(false);
          setImportStatus('error');
          setImportMessage(t('declare.import_timeout'));
        }
      }, 2 * 60 * 1000);
    } catch (e) {
      setImportLoading(false);
      setImportStatus('error');
      setImportMessage(e?.response?.data?.error || t('declare.import_error_generic'));
    }
  }

  const canImport = apiUser?.canImportFlyer || ['admin', 'superadmin'].includes(user?.role?.toLowerCase());

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={() => { if (!importLoading && importStatus !== 'success') onClose(); }}>
      <TouchableWithoutFeedback onPress={() => { if (!importLoading && importStatus !== 'success') onClose(); }}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback>
            <View style={styles.modalBox}>
              {importLoading ? (
                <>
                  <ActivityIndicator size="large" color={colors.primary} style={{ marginBottom: spacing.md }} />
                  <Text style={styles.modalTitle}>{t('nav.declare_import_loading')}</Text>
                  <Text style={styles.modalText}>{importMessage}</Text>
                </>
              ) : importStatus === 'success' ? (
                <>
                  <View style={styles.successIconCircle}>
                    <Ionicons name="checkmark-circle" size={48} color={colors.primary} />
                  </View>
                  <Text style={styles.modalTitle}>{t('declare.import_verify_title')}</Text>
                  {importTimeUnknown && (
                    <Text style={[styles.modalText, { color: '#b45309', fontWeight: '600' }]}>{t('declare.import_verify_time_unknown')}</Text>
                  )}
                  <Text style={styles.modalText}>{t('declare.import_verify_body')}</Text>
                  <TouchableOpacity style={styles.modalBtn} onPress={onClose} activeOpacity={0.8}>
                    <Text style={styles.modalBtnText}>OK</Text>
                  </TouchableOpacity>
                </>
              ) : importStatus === 'error' ? (
                <>
                  <Ionicons name="alert-circle-outline" size={36} color={colors.error ?? '#dc2626'} style={{ marginBottom: spacing.md }} />
                  <Text style={styles.modalTitle}>{t('nav.declare_import_error_title')}</Text>
                  <Text style={styles.modalText}>{importMessage}</Text>
                  <TouchableOpacity style={styles.modalBtn} onPress={() => { setImportStatus(null); setImportMessage(''); handleImportFlyer(); }} activeOpacity={0.8}>
                    <Text style={styles.modalBtnText}>{t('nav.declare_retry')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.modalCancelBtn} onPress={onClose} activeOpacity={0.7}>
                    <Text style={styles.modalCancelText}>{t('nav.declare_close')}</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Ionicons name="add-circle-outline" size={36} color={colors.primary} style={{ marginBottom: spacing.md }} />
                  <Text style={styles.modalTitle}>{t('nav.declare_modal_title')}</Text>
                  <Text style={styles.modalText}>{t('nav.declare_modal_subtitle')}</Text>
                  <TouchableOpacity style={styles.modalBtn} onPress={onSaisir} activeOpacity={0.8}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                      <Ionicons name="create-outline" size={18} color={colors.white} />
                      <Text style={styles.modalBtnText}>{t('nav.declare_manual')}</Text>
                    </View>
                  </TouchableOpacity>
                  {canImport && (
                    <TouchableOpacity style={[styles.modalBtn, styles.modalBtnOutline, { marginTop: spacing.sm }]} onPress={handleImportFlyer} activeOpacity={0.8}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                        <Ionicons name="cloud-upload-outline" size={18} color={colors.primary} />
                        <Text style={[styles.modalBtnText, { color: colors.primary }]}>{t('nav.declare_import')}</Text>
                      </View>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={styles.modalCancelBtn} onPress={onClose} activeOpacity={0.7}>
                    <Text style={styles.modalCancelText}>{t('nav.guest_modal_cancel')}</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

function CustomTabBar({ screens, activeIndex, onTabPress, onFabPress, isFabFocused, isGuest }) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const declareIdx = screens.findIndex(s => s.name === 'Declare');
  const leftScreens = screens.slice(0, declareIdx);
  const rightScreens = screens.slice(declareIdx + 1);

  const sideZone = (width - FAB_SIZE) / 2;
  const leftTabWidth = sideZone / leftScreens.length;
  const rightTabWidth = sideZone / rightScreens.length;

  const TAB_ROW_HEIGHT = 60;
  const fabBottom = insets.bottom + (TAB_ROW_HEIGHT - FAB_SIZE) / 2;

  const renderTab = (screen, tabWidth) => {
    const idx = screens.indexOf(screen);
    const isFocused = activeIndex === idx;
    const icons = TAB_ICONS[screen.name] ?? ['ellipse-outline', 'ellipse'];
    const labelKey = TAB_LABEL_KEYS[screen.name];
    const label = labelKey ? t(labelKey) : screen.name;
    const isRestricted = isGuest && GUEST_RESTRICTED.includes(screen.name);

    return (
      <TouchableOpacity
        key={screen.name}
        onPress={() => onTabPress(idx)}
        style={[styles.tabItem, { width: tabWidth }]}
        activeOpacity={0.7}
      >
        <View style={[styles.iconContainer, isFocused && !isRestricted && styles.iconFocused]}>
          <Ionicons
            name={isFocused && !isRestricted ? icons[1] : icons[0]}
            size={22}
            color={isRestricted ? colors.border : (isFocused ? colors.primary : colors.textMuted)}
          />
        </View>
        <Text
          style={[
            styles.tabLabel,
            isFocused && !isRestricted && styles.tabLabelActive,
            isRestricted && styles.tabLabelDisabled,
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border }}>
      <View style={styles.tabRow}>
        {leftScreens.map(s => renderTab(s, leftTabWidth))}
        <View style={{ width: FAB_SIZE }} />
        {rightScreens.map(s => renderTab(s, rightTabWidth))}
      </View>
      <View style={{ height: insets.bottom, backgroundColor: colors.surface }} />
      <TouchableOpacity
        style={[
          styles.fab,
          isFabFocused && !isGuest && styles.fabFocused,
          isGuest && styles.fabDisabled,
          { left: sideZone, bottom: fabBottom },
        ]}
        onPress={onFabPress}
        activeOpacity={0.85}
      >
        <Ionicons
          name="add"
          size={30}
          color={isGuest ? colors.border : (isFabFocused ? colors.white : colors.primary)}
        />
      </TouchableOpacity>
    </View>
  );
}

function MainTabs() {
  const user = useSelector(state => state.auth.user);
  const apiUser = useSelector(state => state.auth.apiUser);
  const isGuest = useSelector(s => s.auth.isGuest);
  const dispatch = useDispatch();
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
  const canImport = apiUser?.canImportFlyer || ['admin', 'superadmin'].includes(user?.role?.toLowerCase());

  const screens = useMemo(() => [
    { name: 'Home',          component: HomeScreen },
    { name: 'Map',           component: MapScreen },
    { name: 'Subscriptions', component: SubscriptionsScreen },
    { name: 'Declare',       component: DeclareScreen },
    { name: 'Priere',        component: PriereScreen },
    { name: 'Contact',       component: ContactScreen },
    { name: 'Profile',       component: ProfileScreen },
    ...(isAdmin ? [{ name: 'Admin', component: AdminScreen }] : []),
  ], [isAdmin]);

  const pagerRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [showDeclareModal, setShowDeclareModal] = useState(false);
  const activeIndexRef = useRef(0);
  // Pages visitées : rend l'écran seulement quand l'utilisateur y accède (comme Tab.Navigator lazy)
  const [visitedPages, setVisitedPages] = useState(() => new Set([0]));

  const DECLARE_IDX = screens.findIndex(s => s.name === 'Declare');

  const goTo = useCallback((nameOrIndex) => {
    const idx = typeof nameOrIndex === 'number'
      ? nameOrIndex
      : screens.findIndex(s => s.name === nameOrIndex);
    if (idx < 0) return;
    if (isGuest && GUEST_RESTRICTED.includes(screens[idx]?.name)) {
      setShowGuestModal(true);
      return;
    }
    pagerRef.current?.setPage(idx);
    activeIndexRef.current = idx;
    setActiveIndex(idx);
  }, [screens, isGuest]);

  function handlePageSelected(e) {
    const idx = e.nativeEvent.position;
    if (isGuest && GUEST_RESTRICTED.includes(screens[idx]?.name)) {
      pagerRef.current?.setPage(activeIndexRef.current);
      setShowGuestModal(true);
      return;
    }
    activeIndexRef.current = idx;
    setActiveIndex(idx);
    setVisitedPages(prev => {
      if (prev.has(idx)) return prev;
      const next = new Set(prev);
      next.add(idx);
      return next;
    });
  }

  function handleFabPress() {
    if (isGuest) { setShowGuestModal(true); return; }
    if (!canImport) { goTo(DECLARE_IDX); return; }
    setShowDeclareModal(true);
  }

  function handleGuestLogin() {
    setShowGuestModal(false);
    dispatch({ type: 'AUTH_LOGOUT' });
  }

  const tabCtx = useMemo(() => ({ goTo, activeIndex }), [goTo, activeIndex]);

  return (
    <TabContext.Provider value={tabCtx}>
      <View style={{ flex: 1 }}>
        <PagerView
          ref={pagerRef}
          style={{ flex: 1 }}
          initialPage={0}
          onPageSelected={handlePageSelected}
        >
          {screens.map((screen, index) => (
            <View key={screen.name} style={{ flex: 1 }}>
              {visitedPages.has(index) && <screen.component />}
            </View>
          ))}
        </PagerView>

        <CustomTabBar
          screens={screens}
          activeIndex={activeIndex}
          onTabPress={goTo}
          onFabPress={handleFabPress}
          isFabFocused={activeIndex === DECLARE_IDX}
          isGuest={isGuest}
        />

        <GuestModal
          visible={showGuestModal}
          onClose={() => setShowGuestModal(false)}
          onLogin={handleGuestLogin}
        />

        <DeclareChoiceModal
          visible={showDeclareModal}
          onClose={() => setShowDeclareModal(false)}
          onSaisir={() => { setShowDeclareModal(false); goTo(DECLARE_IDX); }}
        />
      </View>
    </TabContext.Provider>
  );
}

export default function MainNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={MainTabs} />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  tabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 60,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 60,
    gap: 2,
  },
  iconContainer: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  iconFocused: {
    backgroundColor: colors.primaryDim,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: colors.textMuted,
  },
  tabLabelActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    backgroundColor: colors.primaryDim,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabFocused: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  fabDisabled: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  tabLabelDisabled: {
    color: colors.border,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  modalBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    width: '100%',
  },
  modalTitle: {
    ...typography.h2,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  modalText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  modalBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    width: '100%',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  modalBtnText: {
    ...typography.button,
  },
  modalCancelBtn: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  modalCancelText: {
    ...typography.body,
    color: colors.textMuted,
  },
  modalBtnOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  successIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(35,134,54,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
});
