import React from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { useTheme } from '@theme/index';
import { lightColors } from '@theme/tokens';

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
      borderRadius: 4,
    },
    pill: {
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 4,
    },
    pillText: {
      fontSize: 11,
      color: colors.textOnPrimary,
      fontFamily: 'Lexend_500Medium',
      lineHeight: 14,
    },
  });

export function KCBadge({ count, dot = false, color, style }: KCBadgeProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const bgColor = color ?? colors.clay;

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
