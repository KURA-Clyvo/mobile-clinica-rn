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

  const cardStyle = [styles.card, { elevation }, style];

  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.92} onPress={onPress} style={cardStyle} testID={testID}>
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={cardStyle} testID={testID}>{children}</View>;
}
