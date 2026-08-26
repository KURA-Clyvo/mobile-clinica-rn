import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Link } from 'expo-router';
import type { Href } from 'expo-router';
import { useTheme } from '@theme/index';
import { lightColors } from '@theme/tokens';
import { KCIcon } from './KCIcon';
import type { KCIconName } from './KCIcon';

// CQ-13 (dev VsClaude, KURA_BACKLOG_CLINICA_1) — item 1: substitui texto mudo
// de estado vazio por conteúdo instrutivo (ícone de linha + título +
// descrição + CTA opcional). Restrição de marca (inegociável, ver brief da
// task): mascote é VETADO na UI clínica — só ícone de linha do `KCIcon`,
// nunca ilustração de bichinho.
export interface KCEmptyStateAction {
  label: string;
  href: Href;
}

export interface KCEmptyStateProps {
  icon: KCIconName;
  title: string;
  description: string;
  action?: KCEmptyStateAction;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const makeStyles = (colors: typeof lightColors) =>
  StyleSheet.create({
    container: {
      alignItems: 'center',
      paddingVertical: 32,
      paddingHorizontal: 24,
    },
    title: {
      fontFamily: 'Lexend_500Medium',
      fontSize: 15,
      color: colors.text,
      textAlign: 'center',
      marginTop: 12,
    },
    description: {
      fontFamily: 'Lexend_400Regular',
      fontSize: 13,
      color: colors.textMute,
      textAlign: 'center',
      marginTop: 4,
    },
    // Armadilha #1 do brief: `<Link asChild>` descarta `style` em função ou
    // array — só objeto achatado sobrevive. `actionLink` é um único objeto
    // de `StyleSheet.create`, nunca combinado em array, de propósito.
    actionLink: {
      marginTop: 16,
      minHeight: 44,
      minWidth: 44,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 16,
    },
    actionText: {
      fontFamily: 'Lexend_500Medium',
      fontSize: 13,
      color: colors.primary,
    },
  });

export function KCEmptyState({ icon, title, description, action, style, testID }: KCEmptyStateProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  return (
    <View style={[styles.container, style]} testID={testID}>
      <KCIcon name={icon} size={40} color={colors.textMute} />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      {action && (
        <Link href={action.href} asChild>
          <TouchableOpacity
            style={styles.actionLink}
            testID={testID ? `${testID}-action` : undefined}
            accessibilityRole="button"
            accessibilityLabel={action.label}
          >
            <Text style={styles.actionText}>{action.label}</Text>
          </TouchableOpacity>
        </Link>
      )}
    </View>
  );
}
