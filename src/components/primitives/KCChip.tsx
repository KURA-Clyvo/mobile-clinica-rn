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
import { lightColors } from '@theme/tokens';

export type ChipTone = 'sage' | 'amber' | 'clay' | 'ocean' | 'mute';

export interface KCChipProps {
  tone?: ChipTone;
  dot?: boolean;
  onPress?: () => void;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
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

export function KCChip({ tone = 'mute', dot = false, onPress, children, style }: KCChipProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const toneColors = getToneColors(tone, colors);

  const Container = onPress ? TouchableOpacity : View;

  return (
    <Container
      onPress={onPress}
      style={[
        styles.base,
        {
          backgroundColor: toneColors.bg,
          borderColor: toneColors.border,
        },
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
