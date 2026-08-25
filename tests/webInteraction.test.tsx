// CQ-08 (dev VsClaude, KURA_BACKLOG_CLINICA_1) — fix wave 2a, Achado 2 da
// revisão G2: o Escopo 2 (hover/foco visível na web) tinha cobertura ZERO,
// não parcial. Reproduzido pela G2: `getWebInteractionStyle` reescrita como
// `return {}` passava 560/560; arrancar os 4 handlers
// (`onMouseEnter`/`onMouseLeave`/`onFocus`/`onBlur`) do `AppHeader` passava
// 560/560; `grep` em `tests/` por `webInteraction|hovered|onMouseEnter|
// outline` dava 0 ocorrências.
//
// ⚠️ Achado de processo, medido nesta rodada, não herdado de suposição:
// `Platform.OS` no ambiente Jest deste repo (`preset: 'jest-expo'`) é
// `'ios'`, nunca `'web'` — sem forçar `Platform.OS = 'web'` explicitamente,
// `getWebInteractionStyle` sempre devolve `{}` e qualquer asserção passaria
// vazia, que é exatamente o defeito que este arquivo corrige. Toda seção
// que precisa do ramo `web` força `Platform.OS` e restaura no `finally`
// (nunca deixa vazamento entre testes, mesmo se a asserção lançar).
//
// ⚠️ Achado de processo #2, confirmado lendo o código-fonte real de
// `node_modules/react-native` (não suposto): em Jest, este repo usa o
// `TouchableOpacity`/`Pressable` NATIVOS do pacote `react-native` — não o
// `react-native-web` (não há alias em `jest.config.js`). O `TouchableOpacity`
// nativo (`Libraries/Components/Touchable/TouchableOpacity.js`,
// `_createPressabilityConfig()`) só liga `onFocus`/`onBlur` de volta às
// props recebidas; `onHoverIn`/`onHoverOut` (o que `onMouseEnter`/
// `onMouseLeave` precisariam virar) NUNCA são setados a partir das props.
// O `Pressable` nativo (`Libraries/Components/Pressable/Pressable.js`)
// destructura `onFocus`/`onBlur` e os liga ao config; `onMouseEnter`/
// `onMouseLeave` caem em `restProps`, são espalhados na `View` PRIMEIRO, e
// depois SOBRESCRITOS pelo `onMouseEnter`/`onMouseLeave` sintéticos que o
// próprio `Pressability` gera (que só chamam `onHoverIn`/`onHoverOut`,
// nunca setados aqui). Ou seja: nos dois componentes, a prop de hover que
// este app passa é interceptada e descartada pela camada nativa de
// Pressability — só funciona de verdade no build real de web, via
// `react-native-web`, que tem sua PRÓPRIA implementação (documentada em
// `src/hooks/useWebInteractionState.ts:19-31`) que espalha props
// desconhecidas para o nó DOM. Medido com um spike descartável
// (`fireEvent(el, 'mouseEnter')` contra `AppHeader` sob `Platform.OS =
// 'web'`: o estilo de hover NUNCA aparece; o mesmo spike com `'focus'`
// aplica o anel de foco corretamente) antes de escrever este arquivo.
//
// Consequência para a estratégia de teste abaixo:
//   1. `getWebInteractionStyle` (helper puro) é testado direto, sem
//      renderizar componente nenhum — cobre os ramos hovered/focused/
//      nenhum/native, incluindo o `opacity: 0.88` que nenhum teste de
//      sítio consegue exercitar via evento simulado (ver achado #2 acima).
//   2. `useWebInteractionState` (hook puro) é testado via `renderHook`,
//      chamando os 4 handlers diretamente — prova que o ESTADO alterna
//      certo, independente de qualquer componente consumidor.
//   3. Nos 8 sítios de consumo, a prova por render+evento real cobre
//      `onFocus`/`onBlur` (que SÃO wired de verdade nesta camada nativa) —
//      é isso que derruba a mutação "arrancar os 4 handlers do AppHeader"
//      (a remoção tira onFocus/onBlur junto, então o teste de foco cai).
//      Hover em nível de sítio fica como limitação declarada (não como
//      cobertura inventada) — ver bloco de limitações no relatório da task.
import React from 'react';
import { Platform, StyleSheet, TouchableOpacity } from 'react-native';
import { render, fireEvent, renderHook, act } from '@testing-library/react-native';
import type { DrawerContentComponentProps } from '@react-navigation/drawer';
import { ThemeProvider } from '../src/theme';
import { getWebInteractionStyle } from '../src/theme/webInteraction';
import { useWebInteractionState } from '../src/hooks/useWebInteractionState';
import { useAuthStore } from '../src/store/authStore';
import { KCButton } from '../src/components/primitives/KCButton';
import { KCCard } from '../src/components/primitives/KCCard';
import { KCChip } from '../src/components/primitives/KCChip';
import { AppHeader } from '../src/components/layout/AppHeader';
import { NavDrawer } from '../src/components/layout/NavDrawer';
import { PetListItem } from '../src/components/domain/PetListItem';
import type { PetResponse } from '../src/types/api';

const mockPush = jest.fn();
jest.mock('expo-router', () => {
  const ReactForMock = require('react');
  return {
    useRouter: () => ({ push: mockPush }),
    Link: ({
      href,
      asChild,
      children,
    }: {
      href: string;
      asChild?: boolean;
      children: React.ReactNode;
    }) => {
      if (asChild && ReactForMock.isValidElement(children)) {
        return ReactForMock.cloneElement(children, { accessibilityHint: `href:${href}` });
      }
      return ReactForMock.createElement(ReactForMock.Fragment, null, children);
    },
  };
});

function wrap(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

function flat(style: unknown): Record<string, unknown> {
  return (StyleSheet.flatten(style) as Record<string, unknown>) ?? {};
}

/** Força `Platform.OS = 'web'` só durante `fn`, sempre restaurando o valor
 *  original — mesmo se `fn` lançar (asserção falha, por exemplo). Sanidade
 *  medida no topo deste arquivo: o valor original neste ambiente Jest é
 *  `'ios'`, nunca `'web'`, então sem isso `getWebInteractionStyle` some. */
function comPlataformaWeb(fn: () => void): void {
  const original = Platform.OS;
  expect(original).not.toBe('web'); // sanidade: confirma a premissa medida
  (Platform as unknown as { OS: string }).OS = 'web';
  try {
    fn();
  } finally {
    (Platform as unknown as { OS: string }).OS = original;
  }
}

function expectFocoAplicado(estilo: Record<string, unknown>, corEsperada: string) {
  expect(estilo.outlineWidth).toBe(2);
  expect(estilo.outlineStyle).toBe('solid');
  expect(estilo.outlineOffset).toBe(2);
  expect(estilo.outlineColor).toBe(corEsperada);
}

function expectSemFoco(estilo: Record<string, unknown>) {
  expect(estilo.outlineWidth).toBeUndefined();
  expect(estilo.outlineStyle).toBeUndefined();
  expect(estilo.outlineOffset).toBeUndefined();
}

describe('getWebInteractionStyle — helper puro (mata a mutação "return {} incondicional")', () => {
  it('web + hovered: devolve opacity 0.88, sem chaves de outline', () => {
    comPlataformaWeb(() => {
      const estilo = getWebInteractionStyle({ hovered: true, focused: false }, '#1A3A52');
      expect(estilo).toEqual({ opacity: 0.88 });
    });
  });

  it('web + focused: devolve as 4 chaves de outline, sem opacity', () => {
    comPlataformaWeb(() => {
      const estilo = getWebInteractionStyle({ hovered: false, focused: true }, '#1A3A52');
      expect(estilo).toEqual({
        outlineWidth: 2,
        outlineColor: '#1A3A52',
        outlineStyle: 'solid',
        outlineOffset: 2,
      });
    });
  });

  it('web + hovered E focused: devolve os dois conjuntos juntos', () => {
    comPlataformaWeb(() => {
      const estilo = getWebInteractionStyle({ hovered: true, focused: true }, '#1A3A52');
      expect(estilo).toEqual({
        opacity: 0.88,
        outlineWidth: 2,
        outlineColor: '#1A3A52',
        outlineStyle: 'solid',
        outlineOffset: 2,
      });
    });
  });

  it('web + nem hovered nem focused: devolve objeto vazio', () => {
    comPlataformaWeb(() => {
      const estilo = getWebInteractionStyle({ hovered: false, focused: false }, '#1A3A52');
      expect(estilo).toEqual({});
    });
  });

  // Guarda de plataforma: mesmo com hovered/focused true, fora da web o
  // resultado tem que continuar vazio — é a guarda `Platform.OS !== 'web'`
  // no início da função (webInteraction.ts:28).
  it('fora da web (nativo): devolve objeto vazio mesmo com hovered/focused true', () => {
    expect(Platform.OS).not.toBe('web'); // sanidade — sem forçar nada aqui
    const estilo = getWebInteractionStyle({ hovered: true, focused: true }, '#1A3A52');
    expect(estilo).toEqual({});
  });
});

describe('useWebInteractionState — hook puro', () => {
  it('alterna hovered/focused independentemente, chamando os 4 handlers direto', () => {
    const { result } = renderHook(() => useWebInteractionState());

    expect(result.current.hovered).toBe(false);
    expect(result.current.focused).toBe(false);

    act(() => result.current.onMouseEnter());
    expect(result.current.hovered).toBe(true);
    expect(result.current.focused).toBe(false);

    act(() => result.current.onFocus());
    expect(result.current.hovered).toBe(true);
    expect(result.current.focused).toBe(true);

    act(() => result.current.onMouseLeave());
    expect(result.current.hovered).toBe(false);
    expect(result.current.focused).toBe(true);

    act(() => result.current.onBlur());
    expect(result.current.hovered).toBe(false);
    expect(result.current.focused).toBe(false);
  });
});

// Os 8 sítios de consumo (KCButton, KCCard, KCChip, AppHeader×2,
// NavDrawer×2, PetListItem) — prova de foco por render + fireEvent real.
// `onMouseEnter`/`onMouseLeave` NÃO são exercitados aqui: medido (ver
// cabeçalho do arquivo) que a camada nativa de Pressability que o Jest usa
// intercepta e descarta essa prop antes que ela chegue a qualquer handler
// nosso — testar via `fireEvent(el, 'mouseEnter')` daria falso-positivo de
// cobertura (o evento "passa" sem nunca ter exercitado
// `webInteraction.onMouseEnter`). `onFocus`/`onBlur` SÃO wired de verdade
// nesta camada, e já bastam para derrubar a mutação "arrancar os 4
// handlers": removê-los tira onFocus/onBlur junto.
describe('sítios de consumo — onFocus/onBlur aplicam e removem o anel de foco (fireEvent real)', () => {
  it('KCButton.tsx::KCButton#1 — TouchableOpacity ganha o anel de foco', () => {
    comPlataformaWeb(() => {
      const { UNSAFE_getByType } = wrap(<KCButton>Texto</KCButton>);
      const touchable = UNSAFE_getByType(TouchableOpacity);
      expectSemFoco(flat(touchable.props.style));

      fireEvent(touchable, 'focus');
      expectFocoAplicado(flat(UNSAFE_getByType(TouchableOpacity).props.style), '#1A3A52');

      fireEvent(UNSAFE_getByType(TouchableOpacity), 'blur');
      expectSemFoco(flat(UNSAFE_getByType(TouchableOpacity).props.style));
    });
  });

  it('KCCard.tsx::KCCard#1 — TouchableOpacity (onPress) ganha o anel de foco', () => {
    comPlataformaWeb(() => {
      const { UNSAFE_getByType } = wrap(<KCCard onPress={() => {}}>conteúdo</KCCard>);
      const touchable = UNSAFE_getByType(TouchableOpacity);
      expectSemFoco(flat(touchable.props.style));

      fireEvent(touchable, 'focus');
      expectFocoAplicado(flat(UNSAFE_getByType(TouchableOpacity).props.style), '#1A3A52');

      fireEvent(UNSAFE_getByType(TouchableOpacity), 'blur');
      expectSemFoco(flat(UNSAFE_getByType(TouchableOpacity).props.style));
    });
  });

  it('KCChip.tsx::KCChip#1 — TouchableOpacity (onPress) ganha o anel de foco', () => {
    comPlataformaWeb(() => {
      const { UNSAFE_getByType } = wrap(<KCChip onPress={() => {}}>Chip</KCChip>);
      const touchable = UNSAFE_getByType(TouchableOpacity);
      expectSemFoco(flat(touchable.props.style));

      fireEvent(touchable, 'focus');
      expectFocoAplicado(flat(UNSAFE_getByType(TouchableOpacity).props.style), '#1A3A52');

      fireEvent(UNSAFE_getByType(TouchableOpacity), 'blur');
      expectSemFoco(flat(UNSAFE_getByType(TouchableOpacity).props.style));
    });
  });

  it('AppHeader.tsx::AppHeader#1 (botão de menu) ganha o anel de foco', () => {
    comPlataformaWeb(() => {
      const { getByTestId } = wrap(<AppHeader title="X" onMenuPress={() => {}} />);
      expectSemFoco(flat(getByTestId('app-header-menu').props.style));

      fireEvent(getByTestId('app-header-menu'), 'focus');
      expectFocoAplicado(flat(getByTestId('app-header-menu').props.style), '#1A3A52');

      fireEvent(getByTestId('app-header-menu'), 'blur');
      expectSemFoco(flat(getByTestId('app-header-menu').props.style));
    });
  });

  it('AppHeader.tsx::AppHeader#2 (botão de busca) ganha o anel de foco', () => {
    comPlataformaWeb(() => {
      const { getByTestId } = wrap(<AppHeader title="X" onMenuPress={() => {}} />);
      expectSemFoco(flat(getByTestId('app-header-search').props.style));

      fireEvent(getByTestId('app-header-search'), 'focus');
      expectFocoAplicado(flat(getByTestId('app-header-search').props.style), '#1A3A52');

      fireEvent(getByTestId('app-header-search'), 'blur');
      expectSemFoco(flat(getByTestId('app-header-search').props.style));
    });
  });

  // NavDrawer — os 2 sítios exigem o mesmo setup de `touchTargetRegistry.tsx`
  // (usuario logado para o footer de logout renderizar; DrawerContentComponentProps
  // mínimo para o item de nav renderizar).
  describe('NavDrawer', () => {
    function makeDrawerState(): DrawerContentComponentProps['state'] {
      return {
        index: 0,
        routes: [{ key: 'dashboard', name: 'dashboard' }],
      } as unknown as DrawerContentComponentProps['state'];
    }

    const navigationMock = {
      navigate: jest.fn(),
      toggleDrawer: jest.fn(),
    } as unknown as DrawerContentComponentProps['navigation'];

    function renderNavDrawerComUsuario() {
      useAuthStore.setState({
        token: 'tok',
        expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
        usuario: { id: 1, nmVeterinario: 'Dr. Felipe', nrCRMV: 'SP-12345', dsEmail: 'f@k.com' },
      });
      return wrap(
        <NavDrawer
          state={makeDrawerState()}
          navigation={navigationMock}
          descriptors={{} as DrawerContentComponentProps['descriptors']}
        />,
      );
    }

    afterEach(() => {
      act(() => {
        useAuthStore.setState({ token: null, expiresAt: null, usuario: null });
      });
    });

    it('NavDrawer.tsx::NavDrawerItem#1 (item de navegação) ganha o anel de foco', () => {
      comPlataformaWeb(() => {
        const { getByTestId } = renderNavDrawerComUsuario();
        expectSemFoco(flat(getByTestId('nav-item-dashboard').props.style));

        fireEvent(getByTestId('nav-item-dashboard'), 'focus');
        // Cor do anel neste sítio é `colors.textOnPrimary` (fundo escuro do
        // drawer), não `colors.borderFocus` — mesma distinção que o próprio
        // `NavDrawer.tsx:194`/`:278` fazem.
        expectFocoAplicado(flat(getByTestId('nav-item-dashboard').props.style), '#FFFCF7');

        fireEvent(getByTestId('nav-item-dashboard'), 'blur');
        expectSemFoco(flat(getByTestId('nav-item-dashboard').props.style));
      });
    });

    it('NavDrawer.tsx::NavDrawer#1 (botão de logout) ganha o anel de foco', () => {
      comPlataformaWeb(() => {
        const { getByTestId } = renderNavDrawerComUsuario();
        expectSemFoco(flat(getByTestId('nav-drawer-logout').props.style));

        fireEvent(getByTestId('nav-drawer-logout'), 'focus');
        expectFocoAplicado(flat(getByTestId('nav-drawer-logout').props.style), '#FFFCF7');

        fireEvent(getByTestId('nav-drawer-logout'), 'blur');
        expectSemFoco(flat(getByTestId('nav-drawer-logout').props.style));
      });
    });
  });

  it('PetListItem.tsx::PetListItem#1 — linha da lista ganha o anel de foco', () => {
    const pet: PetResponse = {
      id: 1,
      nmPet: 'Thor',
      nmEspecie: 'Cão',
      nmRaca: 'Labrador Retriever',
      dtNascimento: '2020-03-15T00:00:00.000Z',
      sgSexo: 'M',
      sgPorte: 'G',
      tutores: [{ id: 10, nmTutor: 'Carlos Mendes', dsTelefone: '11999990001', dsEmail: 'c@e.com' }],
    };
    comPlataformaWeb(() => {
      const { getByRole } = wrap(<PetListItem pet={pet} onPress={() => {}} />);
      expectSemFoco(flat(getByRole('button').props.style));

      fireEvent(getByRole('button'), 'focus');
      expectFocoAplicado(flat(getByRole('button').props.style), '#1A3A52');

      fireEvent(getByRole('button'), 'blur');
      expectSemFoco(flat(getByRole('button').props.style));
    });
  });
});
