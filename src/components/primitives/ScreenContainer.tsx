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
import { lightColors, layout, spacing, type BreakpointKey } from '@theme/tokens';
import { useBreakpoint } from '@hooks/useBreakpoint';

export interface ScreenContainerProps {
  children: React.ReactNode;
  scroll?: boolean;
  refreshControl?: React.ReactElement<RefreshControlProps>;
  /**
   * Override explícito do respiro horizontal do conteúdo. Quando omitido, o
   * valor é derivado do breakpoint atual (ver `PADDING_HORIZONTAL_BY_BREAKPOINT`
   * abaixo) — passar este prop sempre vence o responsivo, em qualquer viewport.
   */
  paddingHorizontal?: number;
  style?: StyleProp<ViewStyle>;
}

// Respiro horizontal padrão por breakpoint. Os valores vêm de `spacing`
// (tokens.ts), nunca de números soltos — CQ-04 exige que nenhum literal de
// viewport exista fora de tokens.ts, e por extensão nenhum novo "número
// mágico" de espaçamento deveria nascer aqui também. `lg`/`xl` compartilham
// o maior valor de propósito: acima de `lg` quem limita a largura do
// conteúdo é `layout.maxContentWidth`, não o padding.
const PADDING_HORIZONTAL_BY_BREAKPOINT: Record<BreakpointKey, number> = {
  sm: spacing[4], // 16 — mesmo valor que o componente já usava como fixo
  md: spacing[6], // 24
  lg: spacing[8], // 32
  xl: spacing[8], // 32
};

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
    // Aplicado ao wrapper de conteúdo em ambos os modos (scroll e flat):
    // limita a largura em telas grandes e centraliza o resultado, em vez de
    // deixar o conteúdo esticar de borda a borda num monitor.
    content: {
      width: '100%',
      alignSelf: 'center',
    },
  });

export function ScreenContainer({
  children,
  scroll = true,
  refreshControl,
  paddingHorizontal,
  style,
}: ScreenContainerProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const { breakpoint } = useBreakpoint();

  const resolvedPaddingHorizontal =
    paddingHorizontal ?? PADDING_HORIZONTAL_BY_BREAKPOINT[breakpoint];

  const contentStyle = [
    styles.content,
    { maxWidth: layout.maxContentWidth, paddingHorizontal: resolvedPaddingHorizontal },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      {scroll ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshControl={refreshControl}
          style={style}
        >
          <View style={contentStyle} testID="screen-container-content">
            {children}
          </View>
        </ScrollView>
      ) : (
        <View
          style={[styles.flatContent, contentStyle, style]}
          testID="screen-container-content"
        >
          {children}
        </View>
      )}
    </SafeAreaView>
  );
}
