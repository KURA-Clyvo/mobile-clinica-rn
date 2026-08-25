import React from 'react';
import {
  TouchableOpacity,
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { useTheme } from '@theme/index';
import { lightColors } from '@theme/tokens';
import { useWebInteractionState } from '@hooks/useWebInteractionState';
import { getWebInteractionStyle } from '@theme/webInteraction';

export interface KCButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
  onPress?: () => void;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
}

// CQ-08 (dev VsClaude, KURA_BACKLOG_CLINICA_1): `sm` era 36px — abaixo do
// alvo de toque mínimo (`touchTarget.min`, tokens.ts, 44px, WCAG 2.5.5/AAA).
// Decisão (não allowlist): subir para 44, não parquear. Diferente da ruling
// de `KCChip` (CQ-07), que aplicou geometria SÓ no caminho interativo porque
// `KCChip` tem uso misto (12 usos-rótulo + 2 interativos) — TODO uso de
// `KCButton` é interativo por contrato da própria API (sempre um botão, nunca
// um rótulo), então não há população não-interativa para regredir. Os 5 usos
// reais de `size="sm"` no app (`pacientes/[id].tsx` back button + 3 botões de
// ação; `teleorientacao/[idPet].tsx` 1 botão) são todos texto curto em linha
// com espaço de sobra — +8px de altura não força quebra de layout em nenhum.
const SIZE_SPEC = {
  sm: { height: 44, paddingHorizontal: 12, fontSize: 13 },
  md: { height: 48, paddingHorizontal: 18, fontSize: 15 },
  lg: { height: 54, paddingHorizontal: 24, fontSize: 17 },
} as const;

const makeStyles = (colors: typeof lightColors) =>
  StyleSheet.create({
    base: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 10,
    },
    textBase: {
      fontFamily: 'Lexend_500Medium',
    },
    textPrimary: { color: colors.textOnPrimary },
    textSecondary: { color: colors.text },
    textGhost: { color: colors.primary },
    textDanger: { color: colors.danger },
  });

function getVariantContainerStyle(
  variant: NonNullable<KCButtonProps['variant']>,
  colors: typeof lightColors,
): ViewStyle {
  switch (variant) {
    case 'primary':
      return { backgroundColor: colors.primary };
    case 'secondary':
      return { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.border };
    case 'ghost':
      return { backgroundColor: 'transparent' };
    case 'danger':
      return { backgroundColor: colors.dangerBg, borderWidth: 1, borderColor: colors.danger };
  }
}

function getTextColor(
  variant: NonNullable<KCButtonProps['variant']>,
  colors: typeof lightColors,
): string {
  switch (variant) {
    case 'primary': return colors.textOnPrimary;
    case 'secondary': return colors.text;
    case 'ghost': return colors.primary;
    case 'danger': return colors.danger;
  }
}

export function KCButton({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  iconLeft,
  iconRight,
  onPress,
  children,
  style,
  accessibilityLabel,
  testID,
}: KCButtonProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const sizeSpec = SIZE_SPEC[size];
  const isDisabled = disabled || loading;
  const textColor = getTextColor(variant, colors);
  const variantContainerStyle = getVariantContainerStyle(variant, colors);
  const textStyleKey = `text${variant.charAt(0).toUpperCase()}${variant.slice(1)}` as
    | 'textPrimary'
    | 'textSecondary'
    | 'textGhost'
    | 'textDanger';
  // CQ-08: hover/foco visível na web. `hovered`/`focused` são forçados a
  // `false` quando desabilitado — sem essa guarda, passar o mouse sobre um
  // botão desabilitado ganharia o mesmo tratamento visual de um habilitado
  // (opacidade de hover por cima da opacidade de disabled), mentindo estado.
  const webInteractionRaw = useWebInteractionState();
  const webInteraction = {
    hovered: webInteractionRaw.hovered && !isDisabled,
    focused: webInteractionRaw.focused && !isDisabled,
  };

  return (
    <TouchableOpacity
      onPress={isDisabled ? undefined : onPress}
      activeOpacity={0.75}
      disabled={isDisabled}
      onMouseEnter={webInteractionRaw.onMouseEnter}
      onMouseLeave={webInteractionRaw.onMouseLeave}
      onFocus={webInteractionRaw.onFocus}
      onBlur={webInteractionRaw.onBlur}
      style={[
        styles.base,
        variantContainerStyle,
        {
          height: sizeSpec.height,
          paddingHorizontal: sizeSpec.paddingHorizontal,
          opacity: isDisabled ? 0.45 : 1,
          gap: 8,
        },
        getWebInteractionStyle(webInteraction, colors.borderFocus),
        style,
      ]}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
    >
      {iconLeft && !loading && <View>{iconLeft}</View>}
      {loading ? (
        <ActivityIndicator color={textColor} size="small" />
      ) : (
        <Text style={[styles.textBase, styles[textStyleKey], { fontSize: sizeSpec.fontSize }]}>
          {children}
        </Text>
      )}
      {iconRight && !loading && <View>{iconRight}</View>}
    </TouchableOpacity>
  );
}
