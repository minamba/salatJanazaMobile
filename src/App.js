import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ActivityIndicator, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { Provider } from 'react-redux';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import * as Updates from 'expo-updates';
import { useTranslation } from 'react-i18next';
import './utils/movementNotif'; // enregistre la tâche background
import store from './lib/stores/store';
import RootNavigator from './navigation/RootNavigator';
import ErrorBoundary from './components/ErrorBoundary';
import { colors } from './utils/theme';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const navigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.primary,
    background: colors.background,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
    notification: colors.primary,
  },
};

function UpdateBanner() {
  const insets = useSafeAreaInsets();
  const slideY = useRef(new Animated.Value(100)).current;
  const iconScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(slideY, {
      toValue: 0, useNativeDriver: true, tension: 70, friction: 11,
    }).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(iconScale, { toValue: 1.2, duration: 700, useNativeDriver: true }),
        Animated.timing(iconScale, { toValue: 1,   duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View style={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      transform: [{ translateY: slideY }],
    }}>
      <View style={{
        margin: 12,
        marginBottom: 12 + insets.bottom,
        backgroundColor: colors.primary,
        borderRadius: 18,
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 18,
        gap: 14,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.18,
        shadowRadius: 12,
        elevation: 8,
      }}>
        <Animated.View style={{
          width: 42, height: 42, borderRadius: 21,
          backgroundColor: 'rgba(255,255,255,0.18)',
          justifyContent: 'center', alignItems: 'center',
          transform: [{ scale: iconScale }],
        }}>
          <Ionicons name="cloud-download" size={22} color="#fff" />
        </Animated.View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700', letterSpacing: 0.1 }}>
            Mise à jour disponible
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 2 }}>
            L'application redémarre dans un instant…
          </Text>
        </View>
        <ActivityIndicator size="small" color="rgba(255,255,255,0.8)" />
      </View>
    </Animated.View>
  );
}

function AppContent() {
  const { i18n } = useTranslation();
  const [updating, setUpdating] = useState(false);
  const isRTL = i18n.language === 'ar';

  useEffect(() => {
    if (__DEV__) return;
    Updates.checkForUpdateAsync()
      .then(({ isAvailable }) => {
        if (!isAvailable) return;
        setUpdating(true);
        return Updates.fetchUpdateAsync()
          .then(() => new Promise(r => setTimeout(r, 3000)))
          .then(() => Updates.reloadAsync());
      })
      .catch(() => {});
  }, []);

  return (
    <View style={{ flex: 1, direction: isRTL ? 'rtl' : 'ltr' }}>
      <StatusBar style="dark" backgroundColor={colors.background} />
      <RootNavigator />
      {updating && <UpdateBanner />}
    </View>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <Provider store={store}>
        <SafeAreaProvider>
          <NavigationContainer theme={navigationTheme}>
            <AppContent />
          </NavigationContainer>
        </SafeAreaProvider>
      </Provider>
    </ErrorBoundary>
  );
}
