import React, { useEffect, useState } from 'react';
import { Platform, View, ActivityIndicator } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSelector, useDispatch } from 'react-redux';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import AuthNavigator from './AuthNavigator';
import MainNavigator from './MainNavigator';
import apiClient from '../lib/api/apiClient';
import { refreshAccessToken, loadPersistedAuth } from '../lib/auth/authService';
import { startMovementTracking, stopMovementTracking } from '../utils/movementNotif';

const Stack = createNativeStackNavigator();

const PROJECT_ID = Constants.expoConfig?.extra?.eas?.projectId ?? '63750b9a-4f66-4b30-89e3-710b99b598d7';

async function registerPushToken(apiUserId) {
  if (Platform.OS === 'web') return;
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;
    const token = await Notifications.getExpoPushTokenAsync({ projectId: PROJECT_ID });
    await apiClient.put(`/api/utilisateur/${apiUserId}`, { expoToken: token.data });
  } catch (e) {
    console.warn('[PushToken] échec enregistrement:', e?.message);
  }
}

export default function RootNavigator() {
  const dispatch = useDispatch();
  const isAuthenticated = useSelector((state) => state.auth.isAuthenticated);
  const isGuest = useSelector((state) => state.auth.isGuest);
  const apiUserId = useSelector((state) => state.auth.apiUser?.id);
  const notifMouvement = useSelector((state) => state.auth.apiUser?.notifMouvement ?? false);
  const [isRestoring, setIsRestoring] = useState(true);

  // Restaure la session au démarrage
  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      // 1. Affichage immédiat depuis SecureStore (pas de réseau nécessaire)
      const persisted = await loadPersistedAuth();
      if (persisted && !cancelled) {
        dispatch({ type: 'AUTH_LOGIN_SUCCESS', payload: { user: persisted.user, token: persisted.token, apiUser: persisted.apiUser } });
      }

      // 2. Rafraîchissement du token en arrière-plan
      try {
        const result = await refreshAccessToken();
        if (!cancelled) {
          dispatch({ type: 'AUTH_LOGIN_SUCCESS', payload: { user: result.user, token: result.accessToken, apiUser: result.apiUser } });
        }
      } catch (err) {
        // Déconnexion uniquement si le token est explicitement invalide (401)
        // Une erreur réseau ne déconnecte PAS l'utilisateur
        const isInvalidToken = err?.message?.includes('invalid_grant') || err?.message?.includes('invalid_token');
        if (!cancelled && !persisted) {
          // Pas de données locales et pas de réseau → rester sur l'écran de connexion
        } else if (!cancelled && isInvalidToken) {
          // Token vraiment expiré/révoqué → déconnexion
          dispatch({ type: 'AUTH_LOGOUT' });
        }
        // Sinon (erreur réseau avec données locales) → on garde la session en mémoire
      }

      if (!cancelled) setIsRestoring(false);
    }

    restoreSession();
    return () => { cancelled = true; };
  }, []);

  // Charge les janazas pour les invités
  useEffect(() => {
    if (!isGuest) return;
    apiClient.get('/api/prierejanaza/upcoming')
      .then(res => dispatch({ type: 'JANAZAS_LOADED', payload: res.data }))
      .catch(() => {});
  }, [isGuest]);

  // Charge les mosquées validées par les utilisateurs (pour tous — authentifié ou invité)
  useEffect(() => {
    if (!isAuthenticated && !isGuest) return;
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
  }, [isAuthenticated, isGuest]);

  // Charge les données une fois authentifié
  useEffect(() => {
    if (!apiUserId) return;
    apiClient.get(`/api/prierejanaza/utilisateur/${apiUserId}`)
      .then(res => dispatch({ type: 'MY_DECLARATIONS_LOADED', payload: res.data }))
      .catch(() => {});
    apiClient.get('/api/prierejanaza/upcoming')
      .then(res => dispatch({ type: 'JANAZAS_LOADED', payload: res.data }))
      .catch(() => {});
    apiClient.get(`/api/abonnement/utilisateur/${apiUserId}`)
      .then(res => dispatch({ type: 'SUBSCRIPTIONS_LOADED', payload: res.data }))
      .catch(() => {});
    registerPushToken(apiUserId);
  }, [apiUserId]);

  useEffect(() => {
    if (notifMouvement) {
      startMovementTracking();
    } else {
      stopMovementTracking();
    }
  }, [notifMouvement]);

  if (isRestoring) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F4FAF5' }}>
        <ActivityIndicator size="large" color="#238636" />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
      {isAuthenticated || isGuest ? (
        <Stack.Screen name="Main" component={MainNavigator} />
      ) : (
        <Stack.Screen name="Auth" component={AuthNavigator} />
      )}
    </Stack.Navigator>
  );
}
