import React from 'react';
import { TouchableOpacity, Pressable, StyleSheet } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { ThemeProvider } from '../src/theme';
import { AppHeader } from '../src/components/layout/AppHeader';
import { touchTarget } from '../src/theme/tokens';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

function wrap(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

beforeEach(() => {
  jest.clearAllMocks();
});

// CQ-08 fix wave 3 (achado Mi-6 da G2 rodada 2): `Pressable` é exportado
// como `React.memo(...)` (`Pressable.js:343-346`) — o test-renderer nunca
// expõe uma instância de teste cujo `.type` seja o WRAPPER de memo, então
// `UNSAFE_queryAllByType(Pressable)` (comparando contra a referência
// memoizada importada abaixo) NUNCA casa, mesmo com um `<Pressable>` real
// na árvore. Medido: um `<Pressable testID="botao-morto-mutante" ... />`
// SEM `onPress` injetado no `AppHeader` passava 6/6 antes desta wave — a
// guarda "todo TouchableOpacity/Pressable tem onPress" era cega a
// `Pressable`. Causa completa e a mesma técnica de contorno em
// `tests/webInteraction.test.tsx` (bloco "CAUSA DETERMINADA"). O
// componente INTERNO não-memoizado é acessível via `.type` no objeto de
// memo — usar ESSE como alvo da query resolve genericamente, sem depender
// de testID.
const PressableInner = (Pressable as unknown as { type: typeof Pressable }).type;

describe('AppHeader — CTAs vivos', () => {
  // Guarda derivada do próprio JSX renderizado, não de uma lista de testID escrita à mão:
  // varre TODOS os TouchableOpacity/Pressable da árvore e exige onPress em cada um.
  // Um botão morto novo (qualquer novo TouchableOpacity/Pressable sem onPress) quebra
  // este teste sem precisar editar a lista — é exatamente a garantia que falta hoje.
  it('todo TouchableOpacity/Pressable renderizado tem onPress como função', () => {
    const { UNSAFE_queryAllByType } = wrap(
      <AppHeader title="Dashboard" onMenuPress={() => {}} />,
    );

    const touchables = [
      ...UNSAFE_queryAllByType(TouchableOpacity),
      // Fix wave 3 (Mi-6): `UNSAFE_queryAllByType(Pressable)` sozinho nunca
      // casa (ver comentário acima) — consultar pelo componente INTERNO
      // não-memoizado é o que de fato encontra um `<Pressable>` na árvore.
      ...UNSAFE_queryAllByType(PressableInner),
    ];

    expect(touchables.length).toBeGreaterThan(0);

    touchables.forEach((touchable) => {
      const testID = touchable.props.testID ?? '(sem testID)';
      if (typeof touchable.props.onPress !== 'function') {
        throw new Error(`elemento tocável "${testID}" não tem onPress`);
      }
    });
  });

  it('botão de busca navega para a lista de pacientes', () => {
    const { getByTestId } = wrap(<AppHeader title="Dashboard" onMenuPress={() => {}} />);

    fireEvent.press(getByTestId('app-header-search'));

    expect(mockPush).toHaveBeenCalledTimes(1);
    // Trava a URL CANÔNICA de propósito (sem o segmento de grupo `(app)`):
    // task CQ-03 (dev VsClaude, KURA_BACKLOG_CLINICA_1) trocou ROUTES.app.*
    // para a forma sem grupo — grupo é organização de arquivo, não faz
    // parte da URL. Esta asserção existe para detectar regressão se alguém
    // reintroduzir o segmento de grupo em routes.ts; não afrouxar para um
    // matcher que aceite as duas formas.
    expect(mockPush).toHaveBeenCalledWith('/pacientes');
  });

  it('não renderiza mais o botão de notificações (sino) — sem feature por trás', () => {
    const { queryByTestId } = wrap(<AppHeader title="Dashboard" onMenuPress={() => {}} />);

    expect(queryByTestId('app-header-bell')).toBeNull();
  });

  // CQ-08 (dev VsClaude, KURA_BACKLOG_CLINICA_1) — item parqueado da G2 da
  // CQ-14: os 2 botões (menu, busca) tinham accessibilityLabel mas não
  // accessibilityRole="button" — leitor de tela não anunciava "botão".
  it.each(['app-header-menu', 'app-header-search'])(
    'botão "%s" tem accessibilityRole="button"',
    (testID) => {
      const { getByTestId } = wrap(<AppHeader title="Dashboard" onMenuPress={() => {}} />);
      expect(getByTestId(testID).props.accessibilityRole).toBe('button');
    },
  );

  // CQ-08 — item parqueado da G2 da CQ-05: o comentário do próprio código
  // ("espaçador invisível do MESMO TAMANHO do botão") nunca tinha asserção —
  // mutação sobrevivente. Trava que o espaçador resolve exatamente o mesmo
  // width/height do botão real (44×44, `touchTarget.min`), não um valor
  // solto que só "parece" igual.
  it('espaçador do menu (showMenuButton=false) tem o MESMO tamanho do botão de menu real', () => {
    const { getByTestId: getWithButton } = wrap(
      <AppHeader title="Dashboard" onMenuPress={() => {}} showMenuButton />,
    );
    const botaoReal = StyleSheet.flatten(getWithButton('app-header-menu').props.style);

    const { getByTestId: getWithSpacer } = wrap(
      <AppHeader title="Dashboard" onMenuPress={() => {}} showMenuButton={false} />,
    );
    const espacador = StyleSheet.flatten(getWithSpacer('app-header-menu-spacer').props.style);

    expect(espacador.width).toBe(botaoReal.width);
    expect(espacador.height).toBe(botaoReal.height);
    expect(espacador.width).toBeGreaterThanOrEqual(touchTarget.min);
    expect(espacador.height).toBeGreaterThanOrEqual(touchTarget.min);
  });
});
