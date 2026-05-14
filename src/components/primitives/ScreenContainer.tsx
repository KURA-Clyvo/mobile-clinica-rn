import React from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  StyleProp,
  ViewStyle,
  RefreshControlProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@theme/index';
import { lightColors } from '@theme/tokens';

export interface ScreenContainerProps {
  children: React.ReactNode;
  scroll?: boolean;
  refreshControl?: React.ReactElement<RefreshControlProps>;
  paddingHorizontal?: number;
  style?: StyleProp<ViewStyle>;
}

const makeStyles = (colors: typeof lightColors) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    scrollContent: {
      paddingBottom: 24,
    },
    flatContent: {
      flex: 1,
      paddingBottom: 24,
    },
  });

export function ScreenContainer({
  children,
  scroll = true,
  refreshControl,
  paddingHorizontal = 16,
  style,
}: ScreenContainerProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  return (
    <SafeAreaView style={styles.safeArea}>
      {scroll ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, { paddingHorizontal }]}
          refreshControl={refreshControl}
          style={style}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.flatContent, { paddingHorizontal }, style]}>
          {children}
        </View>
      )}
    </SafeAreaView>
  );
}
