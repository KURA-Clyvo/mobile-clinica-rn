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
}

const SIZE_SPEC = {
  sm: { height: 36, paddingHorizontal: 12, fontSize: 13 },
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

  return (
    <TouchableOpacity
      onPress={isDisabled ? undefined : onPress}
      activeOpacity={0.75}
      disabled={isDisabled}
      style={[
        styles.base,
        variantContainerStyle,
        {
          height: sizeSpec.height,
          paddingHorizontal: sizeSpec.paddingHorizontal,
          opacity: isDisabled ? 0.45 : 1,
          gap: 8,
        },
        style,
      ]}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      accessibilityLabel={accessibilityLabel}
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
