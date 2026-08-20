import React from 'react';
import { TouchableOpacity, Pressable } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { ThemeProvider } from '../src/theme';
import { AppHeader } from '../src/components/layout/AppHeader';

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
      ...UNSAFE_queryAllByType(Pressable),
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
});
