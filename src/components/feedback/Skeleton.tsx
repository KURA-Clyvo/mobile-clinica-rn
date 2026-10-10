import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@theme/index';
import { lightColors, radius, spacing } from '@theme/tokens';

// Skeleton único do app (BR-CLI-12): substitui os 7 skeletons feitos à mão. Fundo `bgSunk`
// (token do DS), SEM animação — assim não há o que desligar com Reduce Motion e o jest não
// fica com timer pendurado. `testID="skeleton"` em cada bloco preserva os testes de tela
// que contavam os blocos antigos.
export type SkeletonVariant = 'list' | 'card' | 'line';

export interface SkeletonProps {
  variant?: SkeletonVariant;
  /** Quantos blocos desenhar (list: linhas; card: cartões; line: linhas de texto). */
  count?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const ALTURA = { list: 64, card: 96, line: 14 } as const;
const PADRAO = { list: 4, card: 1, line: 1 } as const;

const makeStyles = (colors: typeof lightColors) =>
  StyleSheet.create({
    bloco: { backgroundColor: colors.bgSunk },
    list: { height: ALTURA.list, borderRadius: radius.lg },
    card: { height: ALTURA.card, borderRadius: radius.xl },
    line: { height: ALTURA.line, borderRadius: radius.sm },
    pilha: { gap: spacing[3] },
  });

export function Skeleton({ variant = 'list', count, style, testID = 'skeleton' }: SkeletonProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const n = count ?? PADRAO[variant];
  return (
    <View
      style={[styles.pilha, style]}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Carregando"
      importantForAccessibility="yes"
    >
      {Array.from({ length: n }, (_, i) => (
        <View key={i} testID={testID} style={[styles.bloco, styles[variant]]} />
      ))}
    </View>
  );
}
