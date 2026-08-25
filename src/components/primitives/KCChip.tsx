import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { useTheme } from '@theme/index';
import { lightColors, touchTarget } from '@theme/tokens';
import { useWebInteractionState } from '@hooks/useWebInteractionState';
import { getWebInteractionStyle } from '@theme/webInteraction';

export type ChipTone = 'sage' | 'amber' | 'clay' | 'ocean' | 'mute';

export interface KCChipProps {
  tone?: ChipTone;
  dot?: boolean;
  onPress?: () => void;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const makeStyles = (colors: typeof lightColors) =>
  StyleSheet.create({
    base: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderRadius: 9999,
      paddingVertical: 4,
      paddingHorizontal: 10,
      alignSelf: 'flex-start',
      gap: 5,
    },
    label: {
      fontSize: 11,
      fontFamily: 'Lexend_500Medium',
    },
    dot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    // Alvo de toque WCAG 2.5.8/2.5.5 (ver `touchTarget` em tokens.ts). Aplicado
    // SOMENTE quando o chip é interativo (`onPress` presente, ver KCChip abaixo)
    // — os outros 12 usos de KCChip no app são rótulos (`Container` vira `View`)
    // e não são alvo de toque, então não devem crescer (CQ-07, ruling do
    // maestro: aplicar isso incondicionalmente em `base` regride 8 telas que
    // ninguém pediu para mexer).
    interactive: {
      minHeight: touchTarget.min,
      minWidth: touchTarget.min,
      justifyContent: 'center',
    },
  });

function getToneColors(
  tone: ChipTone,
  colors: typeof lightColors,
): { bg: string; border: string; text: string; dot: string } {
  switch (tone) {
    case 'sage':
      return { bg: colors.sagePale, border: colors.sage, text: colors.sage, dot: colors.sage };
    case 'amber':
      return { bg: colors.amberPale, border: colors.amber, text: colors.amber, dot: colors.amber };
    case 'clay':
      return { bg: colors.clayPale, border: colors.clay, text: colors.clay, dot: colors.clay };
    case 'ocean':
      return { bg: colors.primaryPale, border: colors.primary, text: colors.primary, dot: colors.primary };
    case 'mute':
      return { bg: colors.bgSunk, border: colors.border, text: colors.textMute, dot: colors.textMute };
  }
}

export function KCChip({ tone = 'mute', dot = false, onPress, children, style, testID }: KCChipProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const toneColors = getToneColors(tone, colors);

  const Container = onPress ? TouchableOpacity : View;

  // CQ-08: hover/foco visível na web — só faz sentido (e só é aplicado) no
  // caminho interativo, mesma ruling de escopo do `styles.interactive`
  // acima (CQ-07): os 12 usos-rótulo continuam `View` pura, sem handler de
  // mouse/foco nenhum.
  const webInteraction = useWebInteractionState();

  return (
    <Container
      onPress={onPress}
      testID={testID}
      // Mesmo raciocínio do spread condicional de `styles.interactive`
      // abaixo: só passar os handlers de mouse/foco quando `onPress` existe
      // evita props extras (mesmo que inertes) na variante-rótulo.
      {...(onPress
        ? {
            onMouseEnter: webInteraction.onMouseEnter,
            onMouseLeave: webInteraction.onMouseLeave,
            onFocus: webInteraction.onFocus,
            onBlur: webInteraction.onBlur,
          }
        : {})}
      style={[
        styles.base,
        {
          backgroundColor: toneColors.bg,
          borderColor: toneColors.border,
        },
        // Spread condicional (não `onPress && styles.interactive`) de propósito:
        // `&&` deixaria um `undefined` extra no array de estilo mesmo para chip
        // não-interativo, mudando o snapshot dos 5 tons sem mudar geometria
        // nenhuma — ruído puro. O spread mantém o array idêntico ao original
        // quando `onPress` está ausente.
        ...(onPress
          ? [styles.interactive, getWebInteractionStyle(webInteraction, colors.borderFocus)]
          : []),
        style,
      ]}
    >
      {dot && (
        <View style={[styles.dot, { backgroundColor: toneColors.dot }]} testID="chip-dot" />
      )}
      <Text style={[styles.label, { color: toneColors.text }]} numberOfLines={1}>
        {children}
      </Text>
    </Container>
  );
}
