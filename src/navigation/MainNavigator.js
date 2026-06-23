import React, { useState, useRef, useMemo, useCallback, createContext, useContext } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import PagerView from 'react-native-pager-view';
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions, Modal, TouchableWithoutFeedback } from 'react-native';
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
  const isGuest = useSelector(s => s.auth.isGuest);
  const dispatch = useDispatch();
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

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
    goTo(DECLARE_IDX);
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
});
