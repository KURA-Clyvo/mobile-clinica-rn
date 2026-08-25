import { useCallback, useState } from 'react';

export interface WebInteractionState {
  hovered: boolean;
  focused: boolean;
}

export interface WebInteractionHandlers {
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onFocus: () => void;
  onBlur: () => void;
}

/**
 * CQ-08 (dev VsClaude, KURA_BACKLOG_CLINICA_1): estado de hover/foco para dar
 * feedback visível na web em primitivos que usam `TouchableOpacity`.
 *
 * Por que NÃO migramos para `Pressable` (que tem `hovered`/`focused` nativos
 * no callback de `style` do react-native-web): `TouchableOpacity` do RNW
 * (`node_modules/react-native-web/dist/exports/TouchableOpacity/index.js`)
 * já É focável por padrão (`focusable: !disabled && focusable !== false`,
 * repassado à `View` de baixo) e espalha props desconhecidas — incluindo
 * `onFocus`/`onBlur`/`onMouseEnter`/`onMouseLeave` — para essa `View` via
 * `{...rest}`, que por sua vez repassa ao nó DOM real. Ou seja, dá para obter
 * hover/foco sem trocar o componente por baixo — migrar pra `Pressable`
 * exigiria reimplementar `activeOpacity` à mão (não é built-in nela) e
 * quebraria em cascata os testes existentes que fazem
 * `UNSAFE_getByType(TouchableOpacity)` (`tests/KCButton.test.tsx`,
 * `tests/KCChip.test.tsx`, `tests/AppHeader.test.tsx`) — risco maior que o
 * ganho para o que esta task pede.
 *
 * No nativo (iOS/Android), `onMouseEnter`/`onMouseLeave` nunca disparam (sem
 * mouse) e `onFocus`/`onBlur` só disparam com teclado externo/leitor de tela
 * — `hovered`/`focused` ficam `false` na esmagadora maioria das sessões
 * nativas, sem custo real (só os 2 `useState`, que já existiam de forma
 * equivalente em outros primitivos deste app, ex. `KCTextField.isFocused`).
 */
export function useWebInteractionState(): WebInteractionState & WebInteractionHandlers {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);

  const onMouseEnter = useCallback(() => setHovered(true), []);
  const onMouseLeave = useCallback(() => setHovered(false), []);
  const onFocus = useCallback(() => setFocused(true), []);
  const onBlur = useCallback(() => setFocused(false), []);

  return { hovered, focused, onMouseEnter, onMouseLeave, onFocus, onBlur };
}
