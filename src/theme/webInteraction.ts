import { Platform, ViewStyle } from 'react-native';
import type { WebInteractionState } from '@hooks/useWebInteractionState';

/**
 * CQ-08 (dev VsClaude, KURA_BACKLOG_CLINICA_1): estilo de hover + foco
 * visível na web, a partir do estado de `useWebInteractionState`. `{}` em
 * qualquer plataforma nativa — `Platform.OS !== 'web'` é a guarda, não
 * `hovered`/`focused` (que já seriam sempre `false` lá, mas a guarda
 * explícita documenta a intenção em vez de depender só do valor).
 *
 * `outlineWidth`/`outlineColor`/`outlineStyle`/`outlineOffset` são
 * propriedades CSS que o react-native-web entende e traduz para `outline`
 * real do DOM — não existem no `ViewStyle` nativo do RN (por isso o cast no
 * fim da função), mas só são incluídas no objeto quando `Platform.OS ===
 * 'web'`, então o cast nunca produz um valor usado no nativo.
 *
 * Limite honesto (ver relatório da task): isto prova que o ESTILO que
 * habilita hover/foco está presente no array de `style` quando
 * `hovered`/`focused` são `true` — não prova que o navegador de fato pinta o
 * anel ou que um clique real de mouse/Tab dispara esses handlers depois de
 * hidratação. `react-test-renderer` não executa DOM nem eventos de
 * navegador.
 */
export function getWebInteractionStyle(
  state: Pick<WebInteractionState, 'hovered' | 'focused'>,
  focusRingColor: string,
): ViewStyle {
  if (Platform.OS !== 'web') return {};

  return {
    ...(state.hovered ? { opacity: 0.88 } : null),
    ...(state.focused
      ? {
          outlineWidth: 2,
          outlineColor: focusRingColor,
          outlineStyle: 'solid',
          outlineOffset: 2,
        }
      : null),
  } as ViewStyle;
}
