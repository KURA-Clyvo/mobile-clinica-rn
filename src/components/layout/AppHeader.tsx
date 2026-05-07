import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@theme/index';
import { lightColors } from '@theme/tokens';
import { KCIcon } from '@components/primitives/KCIcon';

export interface AppHeaderProps {
  title: string;
  onMenuPress: () => void;
}

const makeStyles = (colors: typeof lightColors) =>
  StyleSheet.create({
    safe: { backgroundColor: colors.bg },
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      height: 56,
      paddingHorizontal: 4,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.bg,
    },
    iconBtn: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      flex: 1,
      fontSize: 17,
      fontFamily: 'Lexend_500Medium',
      color: colors.text,
      textAlign: 'center',
    },
    actions: {
      flexDirection: 'row',
    },
  });

export function AppHeader({ title, onMenuPress }: AppHeaderProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.container}>
        <TouchableOpacity
          onPress={onMenuPress}
          style={styles.iconBtn}
          testID="app-header-menu"
          accessibilityLabel="Abrir menu"
        >
          <KCIcon name="menu" size={22} color={colors.text} />
        </TouchableOpacity>

        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.iconBtn} testID="app-header-search" accessibilityLabel="Buscar">
            <KCIcon name="search" size={22} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} testID="app-header-bell" accessibilityLabel="Notificações">
            <KCIcon name="bell" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}
