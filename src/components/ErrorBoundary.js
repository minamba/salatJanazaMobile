import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import * as Updates from 'expo-updates';
import i18n from '../i18n';
import { colors, spacing, typography } from '../utils/theme';
import logo from '../../assets/icons/icon3.png';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info);
  }

  async handleReload() {
    try {
      await Updates.reloadAsync();
    } catch {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const t = (key) => i18n.t(key);

    return (
      <View style={styles.container}>
        <Image source={logo} style={styles.logo} resizeMode="contain" />
        <Text style={styles.title}>{t('errors.crash_title')}</Text>
        <Text style={styles.message}>{t('errors.crash_message')}</Text>
        <TouchableOpacity style={styles.button} onPress={() => this.handleReload()} activeOpacity={0.8}>
          <Text style={styles.buttonText}>{t('errors.reload_button')}</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  logo: {
    width: 72,
    height: 72,
    marginBottom: spacing.lg,
    opacity: 0.7,
  },
  title: {
    ...typography.h2,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  message: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.xl,
  },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: 12,
  },
  buttonText: {
    ...typography.button,
    color: '#fff',
  },
});
