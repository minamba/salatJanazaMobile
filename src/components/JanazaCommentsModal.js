import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, FlatList, ScrollView,
  TextInput, ActivityIndicator, Animated, PanResponder, Keyboard, Platform, Alert,
  DeviceEventEmitter,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography, shadow } from '../utils/theme';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { useTabNavigation } from '../navigation/MainNavigator';
import apiClient from '../lib/api/apiClient';

const AVATAR_PALETTE = [
  { bg: '#DBEAFE', text: '#1D4ED8' }, // blue
  { bg: '#EDE9FE', text: '#6D28D9' }, // violet
  { bg: '#E0F2FE', text: '#0369A1' }, // sky
  { bg: '#D1FAE5', text: '#065F46' }, // emerald
  { bg: '#BFDBFE', text: '#1E40AF' }, // indigo
  { bg: '#F0FDFA', text: '#0F766E' }, // teal
  { bg: '#FFEDD5', text: '#C2410C' }, // orange
  { bg: '#F0FDF4', text: '#15803D' }, // green
];

function getAvatarColor(name) {
  if (!name) return AVATAR_PALETTE[0];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h << 5) - h + name.charCodeAt(i);
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length];
}

function formatRelativeDate(dateStr, t) {
  const date = new Date(/Z$|[+-]\d{2}:/.test(dateStr) ? dateStr : dateStr + 'Z');
  const now = new Date();
  const diffMin = Math.floor((now - date) / 60000);
  const diffH = Math.floor(diffMin / 60);
  const diffD = Math.floor(diffH / 24);
  if (diffMin < 1) return t('comments.date_now', { defaultValue: "à l'instant" });
  if (diffMin < 60) return t('comments.date_min', { count: diffMin, defaultValue: `il y a ${diffMin} min` });
  if (diffH < 24) return t('comments.date_hours', { count: diffH, defaultValue: `il y a ${diffH}h` });
  if (diffD < 7) return t('comments.date_days', { count: diffD, defaultValue: `il y a ${diffD}j` });
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function CommentBubble({ comment, currentUserId, currentName, isAdmin, canComment, isReply, onDelete, onEdit, onToggleVisibility, onReply, onLike }) {
  const { t } = useTranslation();
  const isOwn = (currentUserId != null && comment.utilisateurId === currentUserId) ||
                (currentName != null && comment.utilisateurId == null && comment.auteurNom === currentName);
  const initiale = comment.auteurNom?.trim().charAt(0).toUpperCase() ?? '?';
  const avatarColor = getAvatarColor(comment.auteurNom);
  const likeAnim = useRef(new Animated.Value(1)).current;

  function triggerLike() {
    Animated.sequence([
      Animated.timing(likeAnim, { toValue: 1.5, duration: 120, useNativeDriver: true }),
      Animated.spring(likeAnim, { toValue: 1, friction: 4, useNativeDriver: true }),
    ]).start();
    onLike?.(comment);
  }

  return (
    <View style={[styles.bubble, comment.estCache && styles.bubbleHidden, isReply && styles.bubbleReply]}>
      <View style={[styles.bubbleAvatar, isReply && styles.bubbleAvatarSmall, { backgroundColor: avatarColor.bg }]}>
        <Text style={[styles.bubbleAvatarText, isReply && styles.bubbleAvatarTextSmall, { color: avatarColor.text }]}>{initiale}</Text>
      </View>
      <View style={[styles.bubbleBody, isOwn && styles.bubbleBodyOwn]}>
        <View style={styles.bubbleHeader}>
          <View style={styles.bubbleNameRow}>
            <Text style={[styles.bubbleAuthor, { color: avatarColor.text }]} numberOfLines={1}>
              {comment.auteurNom || t('comments.anonymous', { defaultValue: 'Anonyme' })}
            </Text>
            {comment.isAdmin && (
              <View style={styles.adminBadge}>
                <Ionicons name="shield-checkmark" size={12} color="#fff" />
                <Text style={styles.adminBadgeText}>Admin</Text>
              </View>
            )}
            {comment.mentionNom ? (
              <View style={styles.mentionChip}>
                <Ionicons name="return-down-forward-outline" size={10} color={colors.primary} />
                <Text style={styles.mentionChipText} numberOfLines={1}>{comment.mentionNom}</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.bubbleActions}>
            {comment.estCache && (
              <Ionicons name="eye-off-outline" size={12} color={colors.textMuted} style={{ marginRight: 4 }} />
            )}
            <Text style={styles.bubbleDate}>
              {formatRelativeDate(comment.dateCreation, t)}
              {comment.dateModification ? ` · ${t('comments.edited_label', { defaultValue: 'édité' })}` : ''}
            </Text>
            {isOwn && !comment.estCache && (
              <TouchableOpacity onPress={() => onEdit(comment)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                <Ionicons name="pencil-outline" size={14} color={colors.primary} />
              </TouchableOpacity>
            )}
            {isOwn && (
              <TouchableOpacity onPress={() => onDelete(comment)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                <Ionicons name="trash-outline" size={14} color={colors.error ?? '#dc2626'} />
              </TouchableOpacity>
            )}
            {isAdmin && (
              <TouchableOpacity onPress={() => onToggleVisibility(comment)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                <Ionicons
                  name={comment.estCache ? 'eye-outline' : 'eye-off-outline'}
                  size={14}
                  color={colors.warning}
                />
              </TouchableOpacity>
            )}
            {isAdmin && !isOwn && (
              <TouchableOpacity onPress={() => onDelete(comment)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                <Ionicons name="trash-outline" size={14} color={colors.error ?? '#dc2626'} />
              </TouchableOpacity>
            )}
          </View>
        </View>
        <Text style={[styles.bubbleText, comment.estCache && styles.bubbleTextHidden]}>
          {comment.contenu}
        </Text>
        {!comment.estCache && (
          <View style={styles.bubbleFooter}>
            {canComment && onReply && (
              <TouchableOpacity onPress={onReply} style={styles.replyBtn} hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}>
                <Ionicons name="return-down-forward-outline" size={11} color={colors.primary} />
                <Text style={styles.replyBtnText}>{t('comments.reply', { defaultValue: 'Répondre' })}</Text>
              </TouchableOpacity>
            )}
            <View style={{ flex: 1 }} />
            <TouchableOpacity
              onPress={canComment ? triggerLike : undefined}
              style={styles.likeBtn}
              activeOpacity={canComment ? 0.7 : 1}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Animated.View style={{ transform: [{ scale: likeAnim }] }}>
                <Ionicons
                  name={comment.isLikedByMe ? 'heart' : 'heart-outline'}
                  size={16}
                  color={comment.isLikedByMe ? '#ef4444' : colors.textMuted}
                />
              </Animated.View>
              {(comment.likeCount > 0) && (
                <Text style={[styles.likeBtnCount, comment.isLikedByMe && { color: '#ef4444' }]}>
                  {comment.likeCount}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const BASE_H = 0.75;

export default function JanazaCommentsModal({ visible, janazaId, janazaNom, onClose, onCountChange }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const { goTo } = useTabNavigation();

  const { isAuthenticated, isGuest, apiUser, user } = useSelector(s => s.auth);
  const canComment = isAuthenticated && !isGuest;
  const currentName = apiUser?.prenom?.trim() || apiUser?.nom?.trim() || user?.prenom?.trim() || user?.nom?.trim() || null;
  const hasName = !!currentName;
  const roleLC = user?.role?.toLowerCase();
  const isAdmin = roleLC === 'admin' || roleLC === 'superadmin';

  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [contenu, setContenu] = useState('');
  const [kbHeight, setKbHeight] = useState(0);
  const [successMsg, setSuccessMsg] = useState(false);
  const [editingComment, setEditingComment] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null); // { id, auteurNom }
  const [expandedReplies, setExpandedReplies] = useState(new Set());

  const listRef = useRef(null);
  const inputRef = useRef(null);
  const translateY = useRef(new Animated.Value(windowHeight)).current;
  const successTimer = useRef(null);

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, { dy }) => dy > 5,
    onPanResponderMove: (_, { dy }) => { if (dy > 0) translateY.setValue(dy); },
    onPanResponderRelease: (_, { dy, vy }) => {
      if (dy > 80 || vy > 0.8) {
        Animated.timing(translateY, { toValue: windowHeight, duration: 220, useNativeDriver: true })
          .start(onClose);
      } else {
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 80, friction: 10 }).start();
      }
    },
  })).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }).start();
      loadComments();
    } else {
      translateY.setValue(windowHeight);
      setComments([]);
      setContenu('');
      setKbHeight(0);
      setSuccessMsg(false);
      setEditingComment(null);
      setReplyingTo(null);
      setExpandedReplies(new Set());
      if (successTimer.current) clearTimeout(successTimer.current);
    }
  }, [visible, janazaId]);

  useEffect(() => {
    if (!visible) return;
    const listeners = Platform.OS === 'ios'
      ? [
          Keyboard.addListener('keyboardWillShow', (e) => setKbHeight(e.endCoordinates.height)),
          Keyboard.addListener('keyboardWillHide', () => setKbHeight(0)),
        ]
      : [
          Keyboard.addListener('keyboardDidShow', (e) => setKbHeight(e.endCoordinates.height)),
          Keyboard.addListener('keyboardDidHide', () => setKbHeight(0)),
        ];
    return () => listeners.forEach(l => l.remove());
  }, [visible]);

  // Mises à jour temps réel de la visibilité des commentaires
  useEffect(() => {
    if (!visible) return;
    const sub = DeviceEventEmitter.addListener('comment_visibility', ({ commentId, priereJanazaId, estCache }) => {
      if (priereJanazaId !== janazaId) return;
      setComments(prev => {
        const updated = prev.map(c => c.id === commentId ? { ...c, estCache } : c);
        onCountChange?.(janazaId, updated.filter(c => !c.estCache).length);
        return updated;
      });
    });
    return () => sub.remove();
  }, [visible, janazaId]);

  // Organisation des commentaires en threads
  const { topLevel, repliesByParent } = useMemo(() => {
    const visible_comments = isAdmin ? comments : comments.filter(c => !c.estCache);
    const topLevel = visible_comments.filter(c => !c.parentCommentaireId);
    const repliesByParent = {};
    visible_comments.forEach(c => {
      if (c.parentCommentaireId) {
        if (!repliesByParent[c.parentCommentaireId]) repliesByParent[c.parentCommentaireId] = [];
        repliesByParent[c.parentCommentaireId].push(c);
      }
    });
    return { topLevel, repliesByParent };
  }, [comments, isAdmin]);

  async function loadComments() {
    if (!janazaId) return;
    setLoading(true);
    try {
      const params = apiUser?.id ? { utilisateurId: apiUser.id } : undefined;
      const res = await apiClient.get(`/api/prierejanaza/${janazaId}/commentaires`, { params });
      const data = res.data ?? [];
      setComments(data);
      onCountChange?.(janazaId, data.filter(c => !c.estCache).length);
    } catch {
      // réseau indisponible
    } finally {
      setLoading(false);
    }
  }

  async function handleLike(comment) {
    if (!canComment || !apiUser?.id) return;
    const newIsLiked = !comment.isLikedByMe;
    const newCount = Math.max(0, (comment.likeCount || 0) + (newIsLiked ? 1 : -1));
    // Optimistic update
    setComments(prev => prev.map(c =>
      c.id === comment.id ? { ...c, isLikedByMe: newIsLiked, likeCount: newCount } : c
    ));
    try {
      const res = await apiClient.post(
        `/api/prierejanaza/${janazaId}/commentaires/${comment.id}/like`,
        { utilisateurId: apiUser.id }
      );
      setComments(prev => prev.map(c =>
        c.id === comment.id ? { ...c, isLikedByMe: res.data.liked, likeCount: res.data.likeCount } : c
      ));
    } catch {
      // Revert on error
      setComments(prev => prev.map(c =>
        c.id === comment.id ? { ...c, isLikedByMe: comment.isLikedByMe, likeCount: comment.likeCount || 0 } : c
      ));
    }
  }

  function handleEdit(comment) {
    setEditingComment(comment);
    setReplyingTo(null);
    setContenu(comment.contenu);
    setTimeout(() => inputRef.current?.focus(), 100);
  }

  function cancelEdit() {
    setEditingComment(null);
    setContenu('');
    Keyboard.dismiss();
  }

  function handleReply(comment, threadParentId) {
    // threadParentId fourni = on répond à une réponse (reste dans le même thread)
    setReplyingTo({
      id: threadParentId ?? comment.id,          // où la réponse est rattachée
      auteurNom: comment.auteurNom,              // pour la bannière "Répondre à X"
      mentionNom: threadParentId ? comment.auteurNom : null, // flèche "▶" seulement pour réponse à réponse
    });
    setEditingComment(null);
    setContenu('');
    const expandId = threadParentId ?? comment.id;
    setExpandedReplies(prev => new Set([...prev, expandId]));
    setTimeout(() => inputRef.current?.focus(), 100);
  }

  function cancelReply() {
    setReplyingTo(null);
    setContenu('');
    Keyboard.dismiss();
  }

  function toggleReplies(commentId) {
    setExpandedReplies(prev => {
      const next = new Set(prev);
      if (next.has(commentId)) next.delete(commentId); else next.add(commentId);
      return next;
    });
  }

  async function handleSend() {
    if (!contenu.trim()) return;
    setSending(true);
    try {
      const auteurNom = (
        apiUser?.prenom?.trim() || apiUser?.nom?.trim() ||
        user?.prenom?.trim() || user?.nom?.trim()
      ) || null;

      if (editingComment) {
        const res = await apiClient.put(
          `/api/prierejanaza/${janazaId}/commentaires/${editingComment.id}`,
          { auteurNom, contenu: contenu.trim(), utilisateurId: apiUser?.id ?? null }
        );
        setComments(prev => prev.map(c =>
          c.id === editingComment.id
            ? { ...c, ...res.data, utilisateurId: res.data.utilisateurId ?? c.utilisateurId ?? apiUser?.id }
            : c
        ));
        setEditingComment(null);
      } else {
        const res = await apiClient.post(`/api/prierejanaza/${janazaId}/commentaires`, {
          auteurNom,
          contenu: contenu.trim(),
          parentCommentaireId: replyingTo?.id ?? null,
          mentionNom: replyingTo?.mentionNom ?? null,
          utilisateurId: apiUser?.id ?? null,
        });
        const newComment = {
          ...res.data,
          utilisateurId: res.data.utilisateurId ?? apiUser?.id,
          isAdmin: res.data.isAdmin ?? isAdmin,
          likeCount: 0,
          isLikedByMe: false,
        };
        setComments(prev => {
          const updated = [...prev, newComment];
          onCountChange?.(janazaId, updated.filter(c => !c.estCache).length);
          return updated;
        });
        // Auto-expand le thread parent si c'est une réponse
        if (replyingTo?.id) {
          setExpandedReplies(prev => new Set([...prev, replyingTo.id]));
        }
        setReplyingTo(null);
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 150);
      }

      setContenu('');
      Keyboard.dismiss();
      setSuccessMsg(true);
      if (successTimer.current) clearTimeout(successTimer.current);
      successTimer.current = setTimeout(() => setSuccessMsg(false), 3000);
    } catch (err) {
      const detail = err?.response?.data?.detail ?? '';
      const msg = err?.response?.data?.error ?? err?.message ?? 'Erreur réseau';
      Alert.alert('Erreur', `${msg}${detail ? `\n${detail}` : ''}`);
    } finally {
      setSending(false);
    }
  }

  async function handleDelete(comment) {
    const isParent = !comment.parentCommentaireId;
    const replyCount = isParent ? (repliesByParent[comment.id]?.length ?? 0) : 0;
    const msg = isParent && replyCount > 0
      ? t('comments.delete_with_replies', { count: replyCount, defaultValue: `Supprimer ce commentaire et ses ${replyCount} réponses ?` })
      : t('comments.delete_single', { defaultValue: 'Supprimer ce commentaire définitivement ?' });

    Alert.alert(
      t('comments.delete_title', { defaultValue: 'Supprimer' }),
      msg,
      [
        { text: t('comments.delete_cancel', { defaultValue: 'Annuler' }), style: 'cancel' },
        {
          text: t('comments.delete_confirm', { defaultValue: 'Supprimer' }),
          style: 'destructive',
          onPress: async () => {
            try {
              const params = apiUser?.id ? { utilisateurId: apiUser.id } : undefined;
              await apiClient.delete(`/api/prierejanaza/${janazaId}/commentaires/${comment.id}`, { params });
              setComments(prev => {
                const updated = prev.filter(c => c.id !== comment.id && c.parentCommentaireId !== comment.id);
                onCountChange?.(janazaId, updated.filter(c => !c.estCache).length);
                return updated;
              });
            } catch {
              Alert.alert('Erreur', t('comments.error_delete', { defaultValue: 'Impossible de supprimer le commentaire.' }));
            }
          },
        },
      ]
    );
  }

  async function handleToggleVisibility(comment) {
    try {
      const res = await apiClient.patch(
        `/api/prierejanaza/${janazaId}/commentaires/${comment.id}/visibility`
      );
      setComments(prev => {
        const updated = prev.map(c => c.id === comment.id ? { ...c, estCache: res.data.estCache } : c);
        onCountChange?.(janazaId, updated.filter(c => !c.estCache).length);
        return updated;
      });
    } catch {
      Alert.alert('Erreur', t('comments.error_visibility', { defaultValue: 'Impossible de modifier la visibilité.' }));
    }
  }

  const sheetHeight = kbHeight > 0
    ? Math.min(windowHeight * BASE_H, windowHeight - kbHeight - 60)
    : windowHeight * BASE_H;
  const canSend = contenu.trim().length > 0 && !sending && hasName;

  const renderThread = ({ item: comment }) => {
    const replies = repliesByParent[comment.id] ?? [];
    const isExpanded = expandedReplies.has(comment.id);

    return (
      <View style={styles.thread}>
        <CommentBubble
          comment={comment}
          currentUserId={apiUser?.id}
          currentName={currentName}
          isAdmin={isAdmin}
          canComment={canComment && hasName}
          onDelete={handleDelete}
          onEdit={handleEdit}
          onToggleVisibility={handleToggleVisibility}
          onReply={() => handleReply(comment)}
          onLike={handleLike}
        />

        {replies.length > 0 && (
          <TouchableOpacity
            onPress={() => toggleReplies(comment.id)}
            style={styles.viewRepliesRow}
            activeOpacity={0.7}
          >
            <View style={styles.viewRepliesLine} />
            <Text style={styles.viewRepliesText}>
              {isExpanded
                ? t('comments.hide_replies', { defaultValue: 'Masquer les réponses' })
                : t('comments.view_replies', { count: replies.length, defaultValue: `Voir ${replies.length} réponses` })}
            </Text>
            <Ionicons
              name={isExpanded ? 'chevron-up' : 'chevron-down'}
              size={12}
              color={colors.primary}
            />
          </TouchableOpacity>
        )}

        {isExpanded && replies.length > 0 && (
          <View style={styles.repliesContainer}>
            <View style={styles.repliesLine} />
            <View style={styles.repliesList}>
              {replies.map(reply => (
                <CommentBubble
                  key={String(reply.id)}
                  comment={reply}
                  currentUserId={apiUser?.id}
                  currentName={currentName}
                  isAdmin={isAdmin}
                  canComment={canComment && hasName}
                  isReply
                  onDelete={handleDelete}
                  onEdit={handleEdit}
                  onToggleVisibility={handleToggleVisibility}
                  onReply={() => handleReply(reply, comment.id)}
                  onLike={handleLike}
                />
              ))}
            </View>
          </View>
        )}
      </View>
    );
  };

  return (
    <Modal transparent animationType="none" visible={visible} onRequestClose={onClose}>
      <View style={[styles.container, kbHeight > 0 && { paddingBottom: kbHeight }]}>
        <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />

        <Animated.View style={[styles.sheet, { height: sheetHeight, transform: [{ translateY }] }]}>

          {/* Handle */}
          <View style={styles.handleRow} {...panResponder.panHandlers}>
            <View style={styles.handle} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>{t('comments.title', { defaultValue: 'Commentaires' })}</Text>
              {janazaNom ? <Text style={styles.headerSub} numberOfLines={1}>{janazaNom}</Text> : null}
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* Bannière succès */}
          {successMsg && (
            <View style={styles.successBanner}>
              <Ionicons name="checkmark-circle" size={16} color="#166534" />
              <Text style={styles.successBannerText}>
                {editingComment
                  ? t('comments.edited', { defaultValue: 'Commentaire modifié !' })
                  : t('comments.sent', { defaultValue: 'Commentaire ajouté avec succès !' })
                }
              </Text>
            </View>
          )}

          {/* Liste */}
          {loading ? (
            <View style={styles.feedbackBox}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : topLevel.length === 0 ? (
            <View style={styles.feedbackBox}>
              <Ionicons name="chatbubbles-outline" size={38} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>{t('comments.empty_title', { defaultValue: 'Pas encore de commentaire' })}</Text>
              <Text style={styles.emptyText}>{t('comments.empty_sub', { defaultValue: 'Soyez le premier à écrire une dua' })}</Text>
            </View>
          ) : (
            <FlatList
              ref={listRef}
              data={topLevel}
              keyExtractor={(c) => String(c.id)}
              renderItem={renderThread}
              style={styles.list}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            />
          )}

          {/* Zone de saisie */}
          {canComment ? (
            <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
              {!hasName && (
                <View style={styles.nameWarning}>
                  <Ionicons name="information-circle-outline" size={15} color={colors.warning} />
                  <Text style={styles.nameWarningText}>
                    {t('comments.name_required', { defaultValue: 'Renseignez votre nom ou prénom dans votre profil pour commenter' })}
                  </Text>
                  <TouchableOpacity onPress={() => { onClose(); goTo('Profile'); }} activeOpacity={0.8}>
                    <Text style={styles.nameWarningLink}>{t('comments.go_profile', { defaultValue: 'Mon profil' })}</Text>
                  </TouchableOpacity>
                </View>
              )}
              {editingComment && (
                <View style={styles.contextBanner}>
                  <Ionicons name="pencil" size={13} color={colors.primary} />
                  <Text style={styles.contextBannerText}>{t('comments.edit_banner', { defaultValue: 'Modification du commentaire' })}</Text>
                  <TouchableOpacity onPress={cancelEdit} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                    <Ionicons name="close-circle" size={16} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>
              )}
              {replyingTo && !editingComment && (
                <View style={styles.contextBanner}>
                  <Ionicons name="return-down-forward" size={13} color={colors.primary} />
                  <Text style={styles.contextBannerText}>
                    {t('comments.reply_to', { defaultValue: 'Répondre à' })} <Text style={{ fontWeight: '700' }}>{replyingTo.auteurNom || t('comments.anonymous', { defaultValue: 'Anonyme' })}</Text>
                  </Text>
                  <TouchableOpacity onPress={cancelReply} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                    <Ionicons name="close-circle" size={16} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>
              )}
              <ScrollView
                keyboardShouldPersistTaps="always"
                scrollEnabled={false}
                style={{ flexShrink: 0 }}
                contentContainerStyle={styles.messageRow}
              >
                <TextInput
                  ref={inputRef}
                  style={[styles.messageInput, !hasName && styles.messageInputDisabled]}
                  placeholder={
                    replyingTo
                      ? t('comments.reply_placeholder', { name: replyingTo.auteurNom || t('comments.anonymous', { defaultValue: 'Anonyme' }), defaultValue: `Répondre à ${replyingTo.auteurNom || 'Anonyme'}…` })
                      : t('comments.message_placeholder', { defaultValue: 'Laisser un commentaire…' })
                  }
                  placeholderTextColor={colors.textMuted}
                  value={contenu}
                  onChangeText={setContenu}
                  multiline
                  maxLength={1000}
                  editable={hasName}
                />
                <TouchableOpacity
                  style={[styles.sendBtn, !canSend && styles.sendBtnDisabled, editingComment && styles.sendBtnEdit]}
                  onPressIn={canSend ? handleSend : undefined}
                  disabled={!canSend}
                  activeOpacity={0.75}
                >
                  {sending
                    ? <ActivityIndicator size="small" color={colors.white} />
                    : editingComment
                      ? <Ionicons name="checkmark" size={20} color={colors.white} />
                      : <Ionicons name="send" size={16} color={colors.white} />
                  }
                </TouchableOpacity>
              </ScrollView>
            </View>
          ) : (
            <View style={[styles.authBar, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
              <Ionicons name="lock-closed-outline" size={16} color={colors.textMuted} />
              <Text style={styles.authText}>
                {t('comments.login_required', { defaultValue: 'Inscrivez-vous pour laisser un commentaire' })}
              </Text>
              <TouchableOpacity style={styles.authBtn} onPress={() => { onClose(); goTo('Profile'); }} activeOpacity={0.8}>
                <Text style={styles.authBtnText}>{t('comments.login_cta', { defaultValue: 'Se connecter' })}</Text>
              </TouchableOpacity>
            </View>
          )}

        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    ...shadow.md,
  },
  handleRow: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  headerTitle: {
    ...typography.h3,
    fontSize: 17,
  },
  headerSub: {
    ...typography.caption,
    marginTop: 2,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: '#DCFCE7',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: '#BBF7D0',
  },
  successBannerText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#166534',
  },
  feedbackBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    ...typography.body,
    fontWeight: '600',
    textAlign: 'center',
    color: colors.textSecondary,
  },
  emptyText: {
    ...typography.bodySmall,
    textAlign: 'center',
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: spacing.md,
    gap: spacing.md,
  },
  // --- Thread ---
  thread: {
    gap: 2,
  },
  // --- Bubble ---
  bubble: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  bubbleReply: {
    marginTop: 6,
  },
  bubbleHidden: {
    opacity: 0.45,
  },
  bubbleAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  bubbleAvatarSmall: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  bubbleAvatarText: {
    fontSize: 14,
    fontWeight: '800',
  },
  bubbleAvatarTextSmall: {
    fontSize: 11,
  },
  bubbleBody: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 14,
    padding: spacing.sm,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.07, shadowRadius: 4 },
      android: { elevation: 2 },
    }),
  },
  bubbleBodyOwn: {
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  bubbleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  bubbleNameRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
    marginRight: 6,
    flexWrap: 'wrap',
  },
  bubbleAuthor: {
    fontSize: 13,
    fontWeight: '700',
    flexShrink: 1,
  },
  mentionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.primaryDim,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    flexShrink: 1,
  },
  mentionChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary,
    flexShrink: 1,
  },
  bubbleActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexShrink: 0,
  },
  bubbleDate: {
    ...typography.caption,
    color: colors.textMuted,
  },
  bubbleText: {
    ...typography.bodySmall,
    color: colors.text,
    lineHeight: 20,
  },
  bubbleTextHidden: {
    fontStyle: 'italic',
    color: colors.textMuted,
  },
  bubbleFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  replyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primaryDim,
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  replyBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  likeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  likeBtnCount: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  // --- Replies ---
  viewRepliesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 48,
    paddingVertical: 6,
  },
  viewRepliesLine: {
    width: 20,
    height: 1.5,
    backgroundColor: colors.primary,
    opacity: 0.3,
    borderRadius: 1,
  },
  viewRepliesText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  repliesContainer: {
    flexDirection: 'row',
    marginLeft: 48,
  },
  repliesLine: {
    width: 2,
    backgroundColor: colors.primary,
    opacity: 0.2,
    borderRadius: 1,
    marginRight: 8,
  },
  repliesList: {
    flex: 1,
    gap: 8,
  },
  // --- Input ---
  inputBar: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    gap: spacing.xs,
  },
  nameWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: '#FFFBEB',
    borderRadius: radius.sm,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  nameWarningText: {
    flex: 1,
    fontSize: 12,
    color: '#92400E',
  },
  nameWarningLink: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
    textDecorationLine: 'underline',
  },
  contextBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primaryDim,
    borderRadius: radius.sm,
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  contextBannerText: {
    flex: 1,
    fontSize: 12,
    color: colors.text,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  messageInput: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 14,
    color: colors.text,
    maxHeight: 120,
    lineHeight: 20,
  },
  messageInputDisabled: {
    opacity: 0.5,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: colors.border,
  },
  sendBtnEdit: {
    backgroundColor: '#16a34a',
  },
  authBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  authText: {
    flex: 1,
    ...typography.bodySmall,
    color: colors.textMuted,
  },
  authBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.full,
  },
  authBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.white,
  },
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.primary,
    borderRadius: 100,
    paddingHorizontal: 6,
    paddingVertical: 2,
    flexShrink: 0,
  },
  adminBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.3,
  },
});
