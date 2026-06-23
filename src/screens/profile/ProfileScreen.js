import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Switch, Alert, TextInput,
  ActivityIndicator, Keyboard, Modal, Linking,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography, shadow } from '../../utils/theme';
import * as Location from 'expo-location';

import { useTranslation } from 'react-i18next';
import { startMovementTracking, stopMovementTracking } from '../../utils/movementNotif';
import apiClient from '../../lib/api/apiClient';
import { changePassword, deleteAccount, logout as authLogout } from '../../lib/auth/authService';
import { JanazaShareModal } from '../declare/AnnouncementGenerator';
import EditDeclarationModal from '../../components/EditDeclarationModal';
import Slider from '@react-native-community/slider';

const RADIUS_OPTIONS = [2, 5, 10, 20, 50, 80, 100];

const CEO_EMAIL = 'ceo@salatjanaza.org';
const CEO_SLIDER_MAX = 1000;
const CEO_KM_MIN = 2;
const CEO_KM_MAX = 40000;
const _LOG_MIN = Math.log(CEO_KM_MIN);
const _LOG_MAX = Math.log(CEO_KM_MAX);

function sliderToKm(pos) {
  return Math.round(Math.exp(_LOG_MIN + (pos / CEO_SLIDER_MAX) * (_LOG_MAX - _LOG_MIN)));
}
function kmToSlider(km) {
  const clamped = Math.max(CEO_KM_MIN, Math.min(CEO_KM_MAX, km));
  return Math.round(((Math.log(clamped) - _LOG_MIN) / (_LOG_MAX - _LOG_MIN)) * CEO_SLIDER_MAX);
}
const SIX_MONTHS_MS = 6 * 30 * 24 * 60 * 60 * 1000;

function formatExpiryDate(dateHeure) {
  if (!dateHeure) return null;
  const t = typeof dateHeure === 'number' ? dateHeure : new Date(dateHeure).getTime();
  if (!t) return null;
  const expiry = new Date(t + SIX_MONTHS_MS);
  const now = Date.now();
  const diffDays = Math.ceil((expiry.getTime() - now) / (24 * 60 * 60 * 1000));
  if (diffDays <= 0) return null;
  if (diffDays <= 30) return `Supprimée dans ${diffDays} jour${diffDays > 1 ? 's' : ''}`;
  const expiryStr = expiry.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  return `Supprimée automatiquement le ${expiryStr}`;
}

function SectionHeader({ icon, label }) {
  return (
    <View style={styles.sectionHeaderRow}>
      <Ionicons name={icon} size={15} color={colors.textSecondary} />
      <Text style={styles.sectionTitle}>{label}</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  const apiUser = useSelector((state) => state.auth.apiUser);
  const mesDeclarations = useSelector((state) => state.myDeclarations.list);
  const isCeo = user?.email === CEO_EMAIL;

  // Recharge les déclarations à chaque fois que l'onglet prend le focus
  // (gère les suppressions ou modifications faites depuis le web)
  useFocusEffect(
    useCallback(() => {
      const userId = apiUser?.id;
      if (!userId) return;
      apiClient.get(`/api/prierejanaza/utilisateur/${userId}`)
        .then(res => dispatch({ type: 'MY_DECLARATIONS_LOADED', payload: res.data }))
        .catch(() => {});
    }, [apiUser?.id, dispatch])
  );
  const showRadiusSlider = isCeo || user?.role === 'Admin';

  const [showHistorique, setShowHistorique] = useState(false);
  const [selectedJanaza, setSelectedJanaza] = useState(null);
  const [editDecl, setEditDecl] = useState(null);
  const pendingShareRef = useRef(null);
  const pendingEditRef = useRef(null);

  // Modal — Modifier profil
  const [showEditProfil, setShowEditProfil] = useState(false);
  const [editPrenom, setEditPrenom] = useState('');
  const [editNom, setEditNom] = useState('');
  const [editTel, setEditTel] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  // Modal — Changer mot de passe
  const [showChangePwd, setShowChangePwd] = useState(false);
  const [pwdCurrent, setPwdCurrent] = useState('');
  const [pwdNew, setPwdNew] = useState('');
  const [pwdConfirm, setPwdConfirm] = useState('');
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdError, setPwdError] = useState('');
  const [pwdSuccess, setPwdSuccess] = useState(false);

  useEffect(() => {
    if (!showHistorique && pendingShareRef.current) {
      const janaza = pendingShareRef.current;
      pendingShareRef.current = null;
      const t = setTimeout(() => setSelectedJanaza(janaza), 350);
      return () => clearTimeout(t);
    }
  }, [showHistorique]);

  useEffect(() => {
    if (!showHistorique && pendingEditRef.current) {
      const janaza = pendingEditRef.current;
      pendingEditRef.current = null;
      const t = setTimeout(() => setEditDecl(janaza), 350);
      return () => clearTimeout(t);
    }
  }, [showHistorique]);

  const [rayon, setRayon] = useState(5);
  const [notifMouvement, setNotifMouvement] = useState(false);
  const [adresse, setAdresse] = useState('');
  const [selectedCoords, setSelectedCoords] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const debounceRef = useRef(null);

  useEffect(() => {
    if (!apiUser) return;
    setAdresse(apiUser.adresseDomicile ?? '');
    setRayon(apiUser.rayonNotification ?? 5);
    setNotifMouvement(apiUser.notifMouvement ?? false);
    if (apiUser.latitudeDomicile && apiUser.longitudeDomicile) {
      setSelectedCoords({ lat: apiUser.latitudeDomicile, lon: apiUser.longitudeDomicile });
    }
  }, [apiUser?.id]);

  function handleAdresseChange(text) {
    setAdresse(text);
    setSaveSuccess(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.length < 3) { setSuggestions([]); return; }
    debounceRef.current = setTimeout(() => fetchSuggestions(text), 500);
  }

  async function fetchSuggestions(query) {
    setLoadingSuggestions(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1`,
        { headers: { 'User-Agent': 'QabrApp/1.0' } }
      );
      const data = await res.json();
      setSuggestions(data);
    } catch {
      setSuggestions([]);
    } finally {
      setLoadingSuggestions(false);
    }
  }

  function selectSuggestion(item) {
    setAdresse(item.display_name);
    setSelectedCoords({ lat: parseFloat(item.lat), lon: parseFloat(item.lon) });
    setSuggestions([]);
    Keyboard.dismiss();
  }

  async function handleSave() {
    setSaving(true);
    const updates = {
      adresseDomicile: adresse || null,
      latitudeDomicile: selectedCoords?.lat ?? null,
      longitudeDomicile: selectedCoords?.lon ?? null,
      rayonNotification: rayon,
      notifMouvement,
    };
    try {
      const res = await apiClient.put(`/api/utilisateur/${apiUser.id}`, updates);
      dispatch({ type: 'AUTH_API_USER_UPDATED', payload: res.data });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e) {
      const msg = e?.response?.data?.error ?? e?.message ?? 'Erreur lors de la sauvegarde.';
      Alert.alert('Erreur', msg);
    } finally {
      setSaving(false);
    }
  }

  function openEditProfil() {
    setEditPrenom(apiUser?.prenom ?? user?.prenom ?? '');
    setEditNom(apiUser?.nom ?? user?.nom ?? '');
    setEditTel(apiUser?.telephone ?? '');
    setEditError('');
    setShowEditProfil(true);
  }

  async function handleSaveProfil() {
    if (!editPrenom.trim()) { setEditError(t('profile.edit_first_name_required')); return; }
    setEditSaving(true);
    setEditError('');
    try {
      const res = await apiClient.put(`/api/utilisateur/${apiUser.id}`, {
        prenom: editPrenom.trim(),
        nom: editNom.trim() || null,
        telephone: editTel.trim() || null,
      });
      dispatch({ type: 'AUTH_API_USER_UPDATED', payload: res.data });
      dispatch({ type: 'USER_UPDATE_PROFILE', payload: { prenom: editPrenom.trim(), nom: editNom.trim() } });
      setShowEditProfil(false);
    } catch {
      setEditError(t('profile.edit_error'));
    } finally {
      setEditSaving(false);
    }
  }

  async function handleChangePwd() {
    if (!pwdCurrent) { setPwdError(t('profile.password_current_required')); return; }
    if (pwdNew.length < 6) { setPwdError(t('profile.password_new_too_short')); return; }
    if (pwdNew !== pwdConfirm) { setPwdError(t('profile.password_mismatch')); return; }
    setPwdSaving(true);
    setPwdError('');
    try {
      await changePassword(user?.email, pwdCurrent, pwdNew);
      setPwdSuccess(true);
      setPwdCurrent(''); setPwdNew(''); setPwdConfirm('');
      setTimeout(() => { setPwdSuccess(false); setShowChangePwd(false); }, 2000);
    } catch (e) {
      setPwdError(e.message);
    } finally {
      setPwdSaving(false);
    }
  }

  function handleDeleteDeclaration(janaza) {
    Alert.alert(
      'Supprimer la déclaration',
      'Cette annonce sera définitivement supprimée de l\'application. Continuer ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiClient.delete(`/api/prierejanaza/${janaza.id}`);
            } catch {}
            dispatch({ type: 'MY_DECLARATION_DELETE', payload: { id: janaza.id } });
            dispatch({ type: 'JANAZA_DELETE', payload: { id: String(janaza.id) } });
          },
        },
      ]
    );
  }

  async function handleDeleteAccount() {
    Alert.alert(
      t('profile.delete_title'),
      t('profile.delete_message'),
      [
        { text: t('profile.delete_cancel'), style: 'cancel' },
        {
          text: t('profile.delete_confirm'),
          style: 'destructive',
          onPress: async () => {
            try {
              if (apiUser?.id) {
                await apiClient.delete(`/api/utilisateur/${apiUser.id}`);
              }
            } catch {}
            dispatch({ type: 'AUTH_LOGOUT' });
          },
        },
      ]
    );
  }

  function handleLogout() {
    Alert.alert(t('profile.logout_title'), t('profile.logout_confirm_message'), [
      { text: t('profile.logout_cancel'), style: 'cancel' },
      {
        text: t('profile.logout_confirm'),
        style: 'destructive',
        onPress: async () => { await authLogout(); dispatch({ type: 'AUTH_LOGOUT' }); },
      },
    ]);
  }

  async function handleLanguageChange(code) {
    if (i18n.language === code || i18n.language?.startsWith(code + '-')) return;
    await i18n.changeLanguage(code);
    if (apiUser?.id) {
      apiClient.put(`/api/utilisateur/${apiUser.id}`, { language: code }).catch(() => {});
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Avatar */}
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(apiUser?.prenom || user?.prenom || user?.name || user?.email || '?')[0].toUpperCase()}
            </Text>
          </View>
          <Text style={styles.userName}>
            {(apiUser?.prenom || user?.prenom)
              ? `${apiUser?.prenom || user?.prenom} ${apiUser?.nom || user?.nom || ''}`.trim()
              : user?.name || user?.email || 'Mon compte'}
          </Text>
          {user?.email && (
            user.email.includes('privaterelay.appleid.com') ? (
              <View style={styles.providerBadge}>
                <Ionicons name="logo-apple" size={14} color={colors.textSecondary} />
                <Text style={styles.providerText}>Connecté via Apple</Text>
              </View>
            ) : (
              <Text style={styles.userEmail} numberOfLines={1}>{user.email}</Text>
            )
          )}
        </View>

        {/* Préférences */}
        <View style={styles.section}>
          <SectionHeader icon="settings-outline" label={t('profile.preferences_section')} />

          {/* Adresse */}
          <Text style={styles.fieldLabel}>{t('profile.address_label')}</Text>
          <Text style={styles.fieldDesc}>{t('profile.address_description')}</Text>
          <View style={styles.autocompleteWrapper}>
            <View style={styles.inputRow}>
              <Ionicons name="home-outline" size={16} color={colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder={t('profile.address_placeholder')}
                placeholderTextColor={colors.textMuted}
                value={adresse}
                onChangeText={handleAdresseChange}
                onFocus={() => adresse.length >= 3 && fetchSuggestions(adresse)}
              />
              {loadingSuggestions && (
                <ActivityIndicator size="small" color={colors.primary} style={{ marginLeft: spacing.sm }} />
              )}
            </View>

            {suggestions.length > 0 && (
              <View style={styles.suggestionsList}>
                {suggestions.map((item) => (
                  <TouchableOpacity
                    key={item.place_id}
                    style={styles.suggestionItem}
                    onPress={() => selectSuggestion(item)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="location-outline" size={14} color={colors.textMuted} />
                    <Text style={styles.suggestionText} numberOfLines={2}>
                      {item.display_name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Rayon */}
          <Text style={styles.fieldLabel}>{t('profile.radius_label')}</Text>
          <Text style={styles.fieldDesc}>{t('profile.radius_description')}</Text>
          {showRadiusSlider ? (
            <View style={styles.ceoSliderWrapper}>
              <View style={styles.ceoSliderRow}>
                <Text style={styles.ceoSliderBound}>2 km</Text>
                <Text style={styles.ceoSliderValue}>{rayon.toLocaleString('fr-FR')} km</Text>
                <Text style={styles.ceoSliderBound}>40 000 km</Text>
              </View>
              <Slider
                style={styles.ceoSlider}
                minimumValue={0}
                maximumValue={CEO_SLIDER_MAX}
                step={1}
                value={kmToSlider(rayon)}
                onValueChange={(pos) => { setRayon(sliderToKm(pos)); setSaveSuccess(false); }}
                minimumTrackTintColor={colors.primary}
                maximumTrackTintColor={colors.border}
                thumbTintColor={colors.primary}
              />
            </View>
          ) : (
            <View style={styles.rayonGrid}>
              {RADIUS_OPTIONS.map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[styles.rayonOption, rayon === r && styles.rayonOptionActive]}
                  onPress={() => { setRayon(r); setSaveSuccess(false); }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.rayonText, rayon === r && styles.rayonTextActive]}>
                    {r} km
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Mouvement */}
          <View style={styles.toggleRow}>
            <View style={styles.toggleIcon}>
              <Ionicons name="car-outline" size={20} color={colors.primary} />
            </View>
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleTitle}>{t('profile.movement_title')}</Text>
              <Text style={styles.toggleDesc}>{t('profile.movement_description')}</Text>
            </View>
            <Switch
              value={notifMouvement}
              onValueChange={async (v) => {
                if (v) {
                  const { status } = await Location.requestBackgroundPermissionsAsync().catch(() => ({ status: 'denied' }));
                  if (status !== 'granted') {
                    Alert.alert(
                      t('profile.movement_permission_title'),
                      t('profile.movement_permission_message'),
                      [
                        { text: 'OK', style: 'cancel' },
                        { text: t('profile.movement_permission_settings'), onPress: () => Linking.openSettings() },
                      ],
                    );
                    return;
                  }
                  startMovementTracking();
                  Alert.alert(
                    '⚡',
                    t('profile.movement_battery'),
                    [{ text: 'OK', style: 'default' }],
                  );
                } else {
                  stopMovementTracking();
                }
                setNotifMouvement(v);
                setSaveSuccess(false);
              }}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.white}
            />
          </View>
          {notifMouvement && (
            <View style={styles.infoBox}>
              <Ionicons name="information-circle-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.infoText}>{t('profile.movement_active')}</Text>
            </View>
          )}

          {/* Save */}
          {saveSuccess ? (
            <View style={styles.successBox}>
              <Ionicons name="checkmark-circle" size={18} color={colors.success} />
              <Text style={styles.successText}>{t('profile.saved')}</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.8}
            >
              {saving ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <>
                  <Ionicons name="cloud-upload-outline" size={18} color={colors.white} />
                  <Text style={styles.saveBtnText}>{t('profile.save')}</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Compte */}
        <View style={styles.section}>
          <SectionHeader icon="person-outline" label={t('profile.account_section')} />

          {[
            { label: t('profile.edit_profile'), icon: 'create-outline', onPress: openEditProfil },
            { label: t('profile.change_password'), icon: 'lock-closed-outline', onPress: () => { setPwdError(''); setPwdSuccess(false); setShowChangePwd(true); } },
            { label: t('profile.history'), icon: 'list-outline', onPress: () => {
              dispatch({ type: 'MY_DECLARATIONS_EXPIRE' });
              setShowHistorique(true);
            }},
          ].map((item) => (
            <TouchableOpacity key={item.label} style={styles.menuItem} onPress={item.onPress} activeOpacity={0.7}>
              <View style={styles.menuItemLeft}>
                <View style={styles.menuItemIcon}>
                  <Ionicons name={item.icon} size={17} color={colors.primary} />
                </View>
                <Text style={styles.menuItemText}>{item.label}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          ))}

          <TouchableOpacity style={styles.deleteAccountBtn} onPress={handleDeleteAccount} activeOpacity={0.7}>
            <View style={styles.deleteAccountLeft}>
              <View style={styles.deleteAccountIcon}>
                <Ionicons name="trash-outline" size={17} color={colors.error} />
              </View>
              <View>
                <Text style={styles.deleteAccountText}>{t('profile.delete_account')}</Text>
                <Text style={styles.deleteAccountWarning}>{t('profile.delete_warning')}</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.error} />
          </TouchableOpacity>
        </View>

        {/* Langue */}
        <View style={styles.section}>
          <SectionHeader icon="globe-outline" label={t('profile.language_section')} />
          {[
            { code: 'fr', label: t('profile.lang_fr') },
            { code: 'ar', label: t('profile.lang_ar') },
            { code: 'en', label: t('profile.lang_en') },
          ].map((lang) => {
            const isActive = i18n.language === lang.code || i18n.language?.startsWith(lang.code + '-');
            return (
              <TouchableOpacity
                key={lang.code}
                style={styles.menuItem}
                onPress={() => handleLanguageChange(lang.code)}
                activeOpacity={0.7}
              >
                <View style={styles.menuItemLeft}>
                  <View style={styles.menuItemIcon}>
                    <Ionicons name="globe-outline" size={17} color={colors.primary} />
                  </View>
                  <Text style={styles.menuItemText}>{lang.label}</Text>
                </View>
                {isActive && (
                  <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Déconnexion */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={18} color={colors.error} />
          <Text style={styles.logoutText}>{t('profile.logout')}</Text>
        </TouchableOpacity>

        <Text style={styles.version}>{t('profile.version')}</Text>
      </ScrollView>

      {/* Modal historique */}
      <Modal
        visible={showHistorique}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowHistorique(false)}
        onDismiss={() => {
          if (pendingShareRef.current) {
            setSelectedJanaza(pendingShareRef.current);
            pendingShareRef.current = null;
          }
        }}
      >
        <View style={{ flex: 1, backgroundColor: colors.backgroundSecondary, paddingTop: insets.top }}>
          <View style={styles.histoHeader}>
            <TouchableOpacity onPress={() => setShowHistorique(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.histoTitle}>{t('profile.history_title')}</Text>
            <View style={{ width: 24 }} />
          </View>
          <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}>
            {mesDeclarations.length === 0 ? (
              <View style={styles.histoEmpty}>
                <Ionicons name="document-outline" size={40} color={colors.textMuted} />
                <Text style={styles.histoEmptyText}>{t('profile.history_empty')}</Text>
              </View>
            ) : (
              [...mesDeclarations]
                .sort((a, b) => new Date(b.dateCreation ?? b.dateHeure) - new Date(a.dateCreation ?? a.dateHeure))
                .map((j) => {
                const dateObj = j.dateHeure ? new Date(j.dateHeure) : null;
                const dateStr = dateObj
                  ? dateObj.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
                  : '';
                const timeStr = dateObj
                  ? dateObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
                  : '';
                const createdObj = j.dateCreation ? new Date(j.dateCreation) : null;
                const createdStr = createdObj
                  ? createdObj.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                  : null;
                return (
                  <View key={j.id} style={styles.histoCard}>
                    {!!createdStr && (
                      <View style={styles.histoCreatedRow}>
                        <Ionicons name="time-outline" size={11} color={colors.textMuted} />
                        <Text style={styles.histoCreatedText}>Déclaré le {createdStr}</Text>
                      </View>
                    )}
                    <View style={styles.histoCardRow}>
                      <Ionicons name="business-outline" size={14} color={colors.primary} />
                      <Text style={styles.histoMosquee} numberOfLines={1}>{j.mosquee}</Text>
                    </View>
                    {!!j.adresse && <Text style={styles.histoAdresse} numberOfLines={1}>{j.adresse}</Text>}
                    <Text style={styles.histoDate}>{dateStr} à {timeStr}</Text>
                    {!j.estAnonyme && !!j.nomDefunt && (
                      <Text style={styles.histoNom}>{j.nomDefunt}</Text>
                    )}
                    {!!formatExpiryDate(j.dateHeure) && (
                      <View style={styles.histoExpiry}>
                        <Ionicons name="time-outline" size={11} color={colors.textMuted} />
                        <Text style={styles.histoExpiryText}>{formatExpiryDate(j.dateHeure)}</Text>
                      </View>
                    )}
                    <View style={styles.histoCardActions}>
                      <TouchableOpacity
                        style={styles.histoShareBtn}
                        onPress={() => {
                          pendingShareRef.current = j;
                          setShowHistorique(false);
                        }}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="share-outline" size={15} color={colors.primary} />
                        <Text style={styles.histoShareBtnText}>{t('profile.share')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.histoEditBtn}
                        onPress={() => {
                          pendingEditRef.current = j;
                          setShowHistorique(false);
                        }}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="create-outline" size={15} color={colors.primary} />
                        <Text style={styles.histoEditBtnText}>{t('profile.edit')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.histoDeleteBtn}
                        onPress={() => handleDeleteDeclaration(j)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="trash-outline" size={15} color={colors.error} />
                        <Text style={styles.histoDeleteBtnText}>{t('profile.delete')}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>
        </View>
      </Modal>
      {/* Modal — Modifier profil */}
      <Modal visible={showEditProfil} animationType="slide" transparent={false} onRequestClose={() => setShowEditProfil(false)}>
        <View style={{ flex: 1, backgroundColor: colors.backgroundSecondary, paddingTop: insets.top }}>
          <View style={styles.histoHeader}>
            <TouchableOpacity onPress={() => setShowEditProfil(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.histoTitle}>{t('profile.edit_title')}</Text>
            <TouchableOpacity onPress={handleSaveProfil} disabled={editSaving} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              {editSaving
                ? <ActivityIndicator size="small" color={colors.primary} />
                : <Text style={styles.modalSaveText}>{t('profile.edit_save')}</Text>}
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: spacing.lg }} keyboardShouldPersistTaps="handled">
            {!!editError && (
              <View style={styles.modalErrorBox}>
                <Ionicons name="alert-circle-outline" size={16} color={colors.error} />
                <Text style={styles.modalErrorText}>{editError}</Text>
              </View>
            )}
            <Text style={styles.fieldLabel}>{t('profile.edit_first_name')}</Text>
            <View style={styles.inputRow}>
              <Ionicons name="person-outline" size={16} color={colors.textMuted} style={styles.inputIcon} />
              <TextInput style={styles.input} value={editPrenom} onChangeText={setEditPrenom} placeholder={t('profile.edit_first_name_placeholder')} placeholderTextColor={colors.textMuted} autoCapitalize="words" />
            </View>
            <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>{t('profile.edit_last_name')}</Text>
            <View style={styles.inputRow}>
              <Ionicons name="person-outline" size={16} color={colors.textMuted} style={styles.inputIcon} />
              <TextInput style={styles.input} value={editNom} onChangeText={setEditNom} placeholder={t('profile.edit_last_name_placeholder')} placeholderTextColor={colors.textMuted} autoCapitalize="words" />
            </View>
            <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>{t('profile.edit_phone')}</Text>
            <View style={styles.inputRow}>
              <Ionicons name="call-outline" size={16} color={colors.textMuted} style={styles.inputIcon} />
              <TextInput style={styles.input} value={editTel} onChangeText={setEditTel} placeholder={t('profile.edit_phone_placeholder')} placeholderTextColor={colors.textMuted} keyboardType="phone-pad" maxLength={20} />
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Modal — Changer mot de passe */}
      <Modal visible={showChangePwd} animationType="slide" transparent={false} onRequestClose={() => setShowChangePwd(false)}>
        <View style={{ flex: 1, backgroundColor: colors.backgroundSecondary, paddingTop: insets.top }}>
          <View style={styles.histoHeader}>
            <TouchableOpacity onPress={() => setShowChangePwd(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.histoTitle}>{t('profile.password_title')}</Text>
            <View style={{ width: 24 }} />
          </View>
          <ScrollView contentContainerStyle={{ padding: spacing.lg }} keyboardShouldPersistTaps="handled">
            {!!pwdError && (
              <View style={styles.modalErrorBox}>
                <Ionicons name="alert-circle-outline" size={16} color={colors.error} />
                <Text style={styles.modalErrorText}>{pwdError}</Text>
              </View>
            )}
            {pwdSuccess && (
              <View style={styles.successBox}>
                <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                <Text style={styles.successText}>{t('profile.password_changed')}</Text>
              </View>
            )}
            <Text style={styles.fieldLabel}>{t('profile.password_current')}</Text>
            <View style={styles.inputRow}>
              <Ionicons name="lock-closed-outline" size={16} color={colors.textMuted} style={styles.inputIcon} />
              <TextInput style={styles.input} value={pwdCurrent} onChangeText={setPwdCurrent} placeholder="••••••••" placeholderTextColor={colors.textMuted} secureTextEntry />
            </View>
            <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>{t('profile.password_new')}</Text>
            <View style={styles.inputRow}>
              <Ionicons name="lock-open-outline" size={16} color={colors.textMuted} style={styles.inputIcon} />
              <TextInput style={styles.input} value={pwdNew} onChangeText={setPwdNew} placeholder={t('profile.password_new_placeholder')} placeholderTextColor={colors.textMuted} secureTextEntry />
            </View>
            <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>{t('profile.password_confirm')}</Text>
            <View style={styles.inputRow}>
              <Ionicons name="lock-open-outline" size={16} color={colors.textMuted} style={styles.inputIcon} />
              <TextInput style={styles.input} value={pwdConfirm} onChangeText={setPwdConfirm} placeholder="••••••••" placeholderTextColor={colors.textMuted} secureTextEntry />
            </View>
            <TouchableOpacity
              style={[styles.saveBtn, pwdSaving && styles.saveBtnDisabled, { marginTop: spacing.xl }]}
              onPress={handleChangePwd}
              disabled={pwdSaving}
              activeOpacity={0.8}
            >
              {pwdSaving
                ? <ActivityIndicator color={colors.white} size="small" />
                : <><Ionicons name="key-outline" size={18} color={colors.white} /><Text style={styles.saveBtnText}>{t('profile.password_change')}</Text></>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      <EditDeclarationModal
        item={editDecl}
        onClose={() => setEditDecl(null)}
        onSaved={(updated) => {
          dispatch({ type: 'JANAZA_UPDATE', payload: updated });
          setEditDecl(null);
        }}
      />

      <JanazaShareModal
        visible={selectedJanaza !== null}
        onClose={() => setSelectedJanaza(null)}
        janaza={selectedJanaza}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundSecondary },
  content: { paddingBottom: spacing.xxl },

  avatarSection: { alignItems: 'center', paddingVertical: spacing.xl },
  avatar: {
    width: 80, height: 80,
    borderRadius: radius.full,
    backgroundColor: colors.primaryDim,
    borderWidth: 2.5, borderColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.md,
    ...shadow.sm,
  },
  avatarText: { fontSize: 32, color: colors.primary, fontWeight: '700' },
  userName: { ...typography.h3, marginBottom: 4 },
  userEmail: { ...typography.bodySmall, maxWidth: 260 },
  providerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 2,
  },
  providerText: { ...typography.bodySmall, color: colors.textSecondary, fontWeight: '600' },

  section: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    marginBottom: spacing.sm,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },
  sectionTitle: { ...typography.label },

  fieldLabel: { ...typography.label, marginBottom: spacing.xs, color: colors.text },
  fieldDesc: { ...typography.bodySmall, marginBottom: spacing.sm },

  autocompleteWrapper: { marginBottom: spacing.lg, zIndex: 10 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  inputIcon: { marginRight: spacing.sm },
  input: {
    flex: 1,
    paddingVertical: spacing.md,
    color: colors.text,
    fontSize: 15,
  },
  suggestionsList: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    marginTop: 4,
    overflow: 'hidden',
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  suggestionText: { ...typography.bodySmall, color: colors.text, flex: 1 },

  ceoSliderWrapper: { marginBottom: spacing.lg },
  ceoSliderRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: spacing.xs,
  },
  ceoSliderBound: { ...typography.bodySmall, color: colors.textMuted },
  ceoSliderValue: { fontSize: 18, fontWeight: '800', color: colors.primary },
  ceoSlider: { width: '100%', height: 40 },

  rayonGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  rayonOption: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  rayonOptionActive: { borderColor: colors.primary, backgroundColor: colors.primaryDim },
  rayonText: { ...typography.body, color: colors.textSecondary, fontWeight: '600' },
  rayonTextActive: { color: colors.primary },

  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  toggleIcon: {
    width: 36, height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.primaryDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleInfo: { flex: 1 },
  toggleTitle: { ...typography.body, fontWeight: '600', marginBottom: 2 },
  toggleDesc: { ...typography.bodySmall },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  infoText: { ...typography.bodySmall, color: colors.textSecondary, flex: 1 },

  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { ...typography.button },
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(21,128,61,0.08)',
    borderWidth: 1,
    borderColor: colors.success,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  successText: { color: colors.success, fontWeight: '600', fontSize: 14 },

  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  menuItemLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  menuItemIcon: {
    width: 32, height: 32,
    borderRadius: radius.sm,
    backgroundColor: colors.primaryDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuItemText: { ...typography.body },

  soonBadge: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    marginLeft: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  soonText: { fontSize: 11, fontWeight: '600', color: colors.textMuted },

  deleteAccountBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  deleteAccountLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 },
  deleteAccountIcon: {
    width: 32, height: 32,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(220,38,38,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteAccountText: { fontSize: 15, fontWeight: '600', color: colors.error },
  deleteAccountWarning: { fontSize: 11, color: colors.error, opacity: 0.7, marginTop: 1 },

  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginTop: spacing.xl,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.error,
  },
  logoutText: { color: colors.error, fontWeight: '600', fontSize: 15 },
  version: { ...typography.caption, textAlign: 'center', marginTop: spacing.lg },

  histoHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.borderLight,
    backgroundColor: colors.surface,
  },
  histoTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  histoEmpty: { alignItems: 'center', gap: spacing.md, marginTop: spacing.xxl },
  histoEmptyText: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
  histoCard: {
    backgroundColor: colors.surface, borderRadius: radius.md,
    padding: spacing.md, marginBottom: spacing.md,
    borderWidth: 1, borderColor: colors.borderLight,
  },
  histoCardRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: 4 },
  histoMosquee: { fontSize: 15, fontWeight: '700', color: colors.text, flex: 1 },
  histoAdresse: { fontSize: 13, color: colors.textSecondary, marginBottom: 6 },
  histoDate: { fontSize: 14, color: colors.primary, fontWeight: '600' },
  histoNom: { fontSize: 13, color: colors.textSecondary, marginTop: 4, fontStyle: 'italic' },
  modalSaveText: { fontSize: 15, fontWeight: '700', color: colors.primary },
  modalErrorBox: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: 'rgba(220,38,38,0.08)', borderWidth: 1, borderColor: colors.error,
    borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.lg,
  },
  modalErrorText: { color: colors.error, fontSize: 14, flex: 1 },
  histoCreatedRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  histoCreatedText: { fontSize: 11, color: colors.textMuted, fontStyle: 'italic' },
  histoExpiry: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    marginTop: spacing.xs,
  },
  histoExpiryText: { fontSize: 11, color: colors.textMuted, fontStyle: 'italic' },
  histoCardActions: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm,
  },
  histoShareBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    borderWidth: 1, borderColor: colors.primary,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md, paddingVertical: 5,
  },
  histoShareBtnText: { fontSize: 13, fontWeight: '600', color: colors.primary },
  histoEditBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    borderWidth: 1, borderColor: colors.primary,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md, paddingVertical: 5,
  },
  histoEditBtnText: { fontSize: 13, fontWeight: '600', color: colors.primary },
  histoDeleteBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    borderWidth: 1, borderColor: colors.error,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md, paddingVertical: 5,
  },
  histoDeleteBtnText: { fontSize: 13, fontWeight: '600', color: colors.error },
});
