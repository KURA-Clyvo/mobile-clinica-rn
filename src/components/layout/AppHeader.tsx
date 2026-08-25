import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '@theme/index';
import { lightColors } from '@theme/tokens';
import { KCIcon } from '@components/primitives/KCIcon';
import { ROUTES } from '@constants/routes';
import { useWebInteractionState } from '@hooks/useWebInteractionState';
import { getWebInteractionStyle } from '@theme/webInteraction';

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
  // CQ-08: um estado de hover/foco POR botão — compartilhar um único estado
  // entre os 2 faria o botão de busca "acender" quando o de menu recebe
  // foco (e vice-versa), que é o oposto do que "foco visível" precisa provar.
  const menuInteraction = useWebInteractionState();
  const searchInteraction = useWebInteractionState();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.container}>
        {showMenuButton ? (
          <TouchableOpacity
            onPress={onMenuPress}
            onMouseEnter={menuInteraction.onMouseEnter}
            onMouseLeave={menuInteraction.onMouseLeave}
            onFocus={menuInteraction.onFocus}
            onBlur={menuInteraction.onBlur}
            style={[styles.iconBtn, getWebInteractionStyle(menuInteraction, colors.borderFocus)]}
            testID="app-header-menu"
            accessibilityRole="button"
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
            onMouseEnter={searchInteraction.onMouseEnter}
            onMouseLeave={searchInteraction.onMouseLeave}
            onFocus={searchInteraction.onFocus}
            onBlur={searchInteraction.onBlur}
            style={[styles.iconBtn, getWebInteractionStyle(searchInteraction, colors.borderFocus)]}
            testID="app-header-search"
            accessibilityRole="button"
            accessibilityLabel="Buscar"
          >
            <KCIcon name="search" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}
