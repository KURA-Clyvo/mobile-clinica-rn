import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '@theme/index';
import { lightColors } from '@theme/tokens';
import { KCIcon } from '@components/primitives/KCIcon';
import { ROUTES } from '@constants/routes';

export interface AppHeaderProps {
  title: string;
  onMenuPress: () => void;
  /**
   * CQ-05 (dev VsClaude, KURA_BACKLOG_CLINICA_1): esconde o botão de menu
   * quando a sidebar já está permanentemente visível — um botão que abre o
   * que já está aberto é ruído. Default `true` (comportamento anterior,
   * inalterado para qualquer consumidor que não passe a prop).
   */
  showMenuButton?: boolean;
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

export function AppHeader({ title, onMenuPress, showMenuButton = true }: AppHeaderProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.container}>
        {showMenuButton ? (
          <TouchableOpacity
            onPress={onMenuPress}
            style={styles.iconBtn}
            testID="app-header-menu"
            accessibilityLabel="Abrir menu"
          >
            <KCIcon name="menu" size={22} color={colors.text} />
          </TouchableOpacity>
        ) : (
          // Espaçador invisível do mesmo tamanho do botão — sem ele o título
          // (centralizado por `flex: 1` + `textAlign: 'center'`) perde a
          // simetria com o botão de busca do lado direito quando o de menu
          // some (sidebar permanente).
          <View style={styles.iconBtn} testID="app-header-menu-spacer" />
        )}

        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>

        <View style={styles.actions}>
          <TouchableOpacity
            onPress={() => router.push(ROUTES.app.pacientes)}
            style={styles.iconBtn}
            testID="app-header-search"
            accessibilityLabel="Buscar"
          >
            <KCIcon name="search" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}
