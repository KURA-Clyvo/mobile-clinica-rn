import React from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { useTheme } from '@theme/index';
import { lightColors, fontSize, radius } from '@theme/tokens';

export interface KCBadgeProps {
  count?: number;
  dot?: boolean;
  color?: string;
  style?: StyleProp<ViewStyle>;
}

const makeStyles = (colors: typeof lightColors) =>
  StyleSheet.create({
    dot: {
      width: 8,
      height: 8,
      borderRadius: radius.sm,
    },
    pill: {
      minWidth: 18,
      height: 18,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 4,
    },
    pillText: {
      fontSize: fontSize.xs,
      color: colors.textOnPrimary,
      fontFamily: 'Lexend_500Medium',
      lineHeight: 14,
    },
  });

export function KCBadge({ count, dot = false, color, style }: KCBadgeProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const bgColor = color ?? colors.clayInk;

  if (dot) {
    return <View style={[styles.dot, { backgroundColor: bgColor }, style]} testID="kc-badge-dot" />;
  }

  if (count === undefined || count === 0) return null;

  const label = count > 99 ? '99+' : String(count);

  return (
    <View style={[styles.pill, { backgroundColor: bgColor }, style]} testID="kc-badge-pill">
      <Text style={styles.pillText}>{label}</Text>
    </View>
  );
}
