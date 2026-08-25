import React from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { useTheme } from '@theme/index';
import { lightColors } from '@theme/tokens';
import { useWebInteractionState } from '@hooks/useWebInteractionState';
import { getWebInteractionStyle } from '@theme/webInteraction';

export interface KCCardProps {
  children: React.ReactNode;
  onPress?: () => void;
  elevated?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const makeStyles = (colors: typeof lightColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 20,
      padding: 18,
      shadowColor: colors.text,
      shadowOpacity: 0.06,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
    },
  });

export function KCCard({ children, onPress, elevated = false, style, testID }: KCCardProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const elevation = elevated ? 4 : 2;
  // CQ-08: hook chamado incondicionalmente (regra dos hooks) — só USADO no
  // ramo `onPress` abaixo, igual ao padrão já usado por `KCChip`/`KCButton`.
  const webInteraction = useWebInteractionState();

  const cardStyle = [styles.card, { elevation }, style];

  if (onPress) {
    return (
      <TouchableOpacity
        activeOpacity={0.92}
        onPress={onPress}
        onMouseEnter={webInteraction.onMouseEnter}
        onMouseLeave={webInteraction.onMouseLeave}
        onFocus={webInteraction.onFocus}
        onBlur={webInteraction.onBlur}
        style={[...cardStyle, getWebInteractionStyle(webInteraction, colors.borderFocus)]}
        testID={testID}
        accessibilityRole="button"
      >
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={cardStyle} testID={testID}>{children}</View>;
}
