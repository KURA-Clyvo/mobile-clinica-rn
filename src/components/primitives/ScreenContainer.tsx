import React from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  StyleProp,
  ViewStyle,
  RefreshControlProps,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { useTheme } from '@theme/index';
import { lightColors, layout, spacing, type BreakpointKey } from '@theme/tokens';
import { useBreakpoint } from '@hooks/useBreakpoint';

/**
 * Filhos `position:'absolute'` ancoram na COLUNA DE CONTEÚDO centralizada
 * (a `View` de `maxWidth: layout.maxContentWidth`/`maxWidth` custom), não na
 * largura física da janela — porque essa coluna, e não o `SafeAreaView`
 * externo, é o container relativo mais próximo que o Yoga enxerga para um
 * `left:0`/`right:0`/`bottom:0` sem outro ancestral `position:relative` no
 * meio. Acima do breakpoint em que a coluna para de crescer (hoje
 * `layout.maxContentWidth` = 1200px), esses filhos deixam de tocar a borda
 * física do monitor — casos reais neste app (CQ-15, G2 Important #8/Vetor E):
 * o FAB de `pacientes/index.tsx` (`fabContainer`) e os rodapés de ação de
 * `consulta/[idPet].tsx` e `receituario/[idPet].tsx` (`footer`, ambos
 * `left:0, right:0, bottom:0`). Aceito como consequência do próprio
 * contrato do primitivo (a coluna de leitura é o que baliza a tela), não
 * como bug — corrigir exigiria uma API nova de slot "full-bleed" fora do
 * wrapper de `maxWidth`, fora do escopo até haver uma tela real que precise.
 */

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
  /**
   * Override explícito da largura máxima do conteúdo. Quando omitido, usa
   * `layout.maxContentWidth` (1200px, calibrado para largura de leitura de
   * painel de gestão). Telas de formulário centralizado — ex. login/registro
   * — querem algo bem menor (~400-480px); passar este prop em vez de tentar
   * sobrescrever via `style` (que só vence no modo flat, por ordem de array,
   * e não no modo scroll, onde `style` vai para o `ScrollView` — capacidade
   * acidental, não API. CQ-15, G2 vetor F).
   */
  maxWidth?: number;
  style?: StyleProp<ViewStyle>;
  /**
   * Bordas em que o `SafeAreaView` interno aplica o inset como padding.
   * Omitido = comportamento padrão da lib (todas as bordas). Uma tela cujo
   * próprio header pinta uma faixa de cor sob a status bar (ex.:
   * `colors.primary` full-bleed) deve excluir `'top'` daqui e voltar a
   * somar `insets.top` manualmente no padding desse header — do contrário
   * o `SafeAreaView` pinta o inset com `colors.bg` por baixo da faixa
   * colorida, abrindo uma tira clara acima dela (CQ-15, Important #1 da
   * G2). Ver `pacientes/[id].tsx` para o padrão de uso.
   *
   * Nativo (iOS/Android): uma borda ausente do array recebe `'off'` — o
   * `SafeAreaView` nativo desliga o inset dela de verdade (verificado em
   * `node_modules/react-native-safe-area-context/src/SafeAreaView.tsx`).
   * Web (`SafeAreaView.web.tsx`): uma borda ausente do array cai no `default`
   * do switch de `getEdgeValue`, que soma o inset do mesmo jeito que
   * `'additive'` — ou seja, no alvo web esta prop não desliga uma borda
   * excluída, só reforça as incluídas. Comportamento do upstream, não desta
   * prop; registrado aqui para não ser lido como "funciona igual nas duas
   * plataformas".
   */
  edges?: readonly Edge[];
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
  maxWidth,
  style,
  edges,
}: ScreenContainerProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const { breakpoint } = useBreakpoint();

  const resolvedPaddingHorizontal =
    paddingHorizontal ?? PADDING_HORIZONTAL_BY_BREAKPOINT[breakpoint];
  const resolvedMaxWidth = maxWidth ?? layout.maxContentWidth;

  const contentStyle = [
    styles.content,
    { maxWidth: resolvedMaxWidth, paddingHorizontal: resolvedPaddingHorizontal },
  ];

  return (
    <SafeAreaView style={styles.safeArea} edges={edges}>
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
