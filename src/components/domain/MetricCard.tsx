import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { KCCard } from '@components/primitives/KCCard';
import { KCIcon } from '@components/primitives/KCIcon';
import { useTheme } from '@theme/index';
import { lightColors } from '@theme/tokens';
import type { KCIconName } from '@components/primitives/KCIcon';

export type MetricTone = 'ocean' | 'sage' | 'amber' | 'clay';

export interface MetricCardProps {
  label: string;
  value: number;
  icon: KCIconName;
  tone: MetricTone;
}

function getToneColors(tone: MetricTone, colors: typeof lightColors) {
  switch (tone) {
    case 'ocean': return { bg: colors.primaryPale, icon: colors.primary };
    case 'sage':  return { bg: colors.sagePale, icon: colors.sage };
    case 'amber': return { bg: colors.amberPale, icon: colors.amber };
    case 'clay':  return { bg: colors.clayPale, icon: colors.clay };
  }
}

const makeStyles = (colors: typeof lightColors) =>
  StyleSheet.create({
    card: { flex: 1 },
    iconCircle: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 10,
    },
    value: {
      fontFamily: 'Cormorant_500Medium',
      fontSize: 32,
      color: colors.text,
      lineHeight: 36,
    },
    label: {
      fontFamily: 'Lexend_400Regular',
      fontSize: 11,
      color: colors.textMute,
      marginTop: 2,
    },
  });

export function MetricCard({ label, value, icon, tone }: MetricCardProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const toneColors = getToneColors(tone, colors);

  return (
    <KCCard style={styles.card}>
      <View style={[styles.iconCircle, { backgroundColor: toneColors.bg }]}>
        <KCIcon name={icon} size={20} color={toneColors.icon} />
      </View>
      <Text style={styles.value} testID="metric-value">{value}</Text>
      <Text style={styles.label} numberOfLines={2} testID="metric-label">{label}</Text>
    </KCCard>
  );
}
