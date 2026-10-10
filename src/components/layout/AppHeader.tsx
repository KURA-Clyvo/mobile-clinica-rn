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
import { touchTarget, fontSize, fonts, spacing } from '@theme/tokens';
import { STRINGS } from '@constants/strings';

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
  /**
   * BR-CLI-T05 (C3, fecha o E27): quando presente, a tela é de AÇÃO/DETALHE (ficha do pet, consulta,
   * receituário, teleorientação) e a saída é um "Voltar" (ícone + rótulo, 44px) no lugar do
   * hambúrguer e da busca. Quem decide para onde volta é o chamador (`router.back()` com fallback
   * para a lista certa quando não há histórico — acesso direto por URL no web).
   */
  onBackPress?: () => void;
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
      width: touchTarget.min,
      height: touchTarget.min,
      alignItems: 'center',
      justifyContent: 'center',
    },
    backBtn: {
      minWidth: touchTarget.min,
      minHeight: touchTarget.min,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing[1],
      paddingHorizontal: spacing[2],
    },
    backLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: fontSize.base,
      color: colors.text,
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

export function AppHeader({ title, onMenuPress, showMenuButton = true, onBackPress }: AppHeaderProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const router = useRouter();
  // CQ-08: um estado de hover/foco POR botão — compartilhar um único estado
  // entre os 2 faria o botão de busca "acender" quando o de menu recebe
  // foco (e vice-versa), que é o oposto do que "foco visível" precisa provar.
  const menuInteraction = useWebInteractionState();
  const searchInteraction = useWebInteractionState();
  const backInteraction = useWebInteractionState();

  if (onBackPress) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.container}>
          <TouchableOpacity
            onPress={onBackPress}
            onMouseEnter={backInteraction.onMouseEnter}
            onMouseLeave={backInteraction.onMouseLeave}
            onFocus={backInteraction.onFocus}
            onBlur={backInteraction.onBlur}
            style={[styles.backBtn, getWebInteractionStyle(backInteraction, colors.borderFocus)]}
            testID="app-header-back"
            accessibilityRole="button"
            accessibilityLabel={STRINGS.saida.voltar}
          >
            <KCIcon name="back" size={22} color={colors.text} />
            <Text style={styles.backLabel}>{STRINGS.saida.voltar}</Text>
          </TouchableOpacity>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {/* Espaçador do mesmo tamanho do alvo de toque — mantém o título centrado em relação ao Voltar. */}
          <View style={styles.iconBtn} testID="app-header-back-spacer" />
        </View>
      </SafeAreaView>
    );
  }

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
