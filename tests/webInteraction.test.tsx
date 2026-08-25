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
// Pressability **quando o evento é disparado no nó HOST** (é por isso que
// `fireEvent(el, 'mouseEnter')` nunca aplica o estilo de hover — medido com
// spike descartável contra `AppHeader` sob `Platform.OS = 'web'`; o mesmo
// spike com `'focus'` aplica o anel corretamente).
//
// ⚠️ CQ-08 fix wave 2a-bis — achado do maestro: a wave 2a leu o parágrafo
// acima e generalizou pra "hover por sítio não é verificável". Essa
// conclusão é FALSA — o parágrafo acima só prova que `fireEvent` (que
// dispara o evento no nó HOST) não serve pra hover; não prova que a prop
// não pode ser exercitada. `UNSAFE_getByType(TouchableOpacity)` devolve o
// fiber COMPOSITE — o elemento exatamente como ESTE código o escreveu em
// JSX. `.props.onMouseEnter` nesse fiber é literalmente
// `webInteraction.onMouseEnter` (a mesma referência de função, sem
// indireção da camada de Pressability) — chamá-la direto, dentro de
// `act(...)`, não depende de o Jest saber rotear um evento `mouseEnter`, e
// testa exatamente a mesma cadeia que o navegador real testaria via
// `react-native-web` (que — ver `useWebInteractionState.ts:19-31` — espalha
// essa prop pro nó DOM sem reescrevê-la, ao contrário do Pressability
// nativo). Mordida que prova isso não é papel: arrancar as 2 linhas de
// `onMouseEnter`/`onMouseLeave` de um sítio faz esse `.props.onMouseEnter`
// virar `undefined`; chamar `undefined()` estoura `TypeError`, e a mutação
// FICA VERMELHA — ver `task-CQ-08-report.md`, seção "Fix wave 2a-bis", pelas
// 2 mordidas medidas (`KCButton` + um segundo sítio).
//
// ⚠️ Achado de processo #3 (medido nesta rodada): para os sítios baseados em
// `TouchableOpacity`, `UNSAFE_getByType(TouchableOpacity)` já devolve o
// fiber composite certo (confirmado por probe descartável). Para o
// `Pressable` de `NavDrawerItem`, a mesma chamada
// (`UNSAFE_getAllByType(Pressable)`) devolve **ZERO** instâncias — raiz não
// determinada (possível mismatch de identidade de módulo dentro do registry
// do Jest), medido e não investigado a fundo por estar fora do escopo desta
// wave. Workaround verificado por medição: `UNSAFE_getAllByProps({ testID
// })` encontra as 3 entradas que carregam esse `testID` (composite
// `Pressable` + 2 `View` host que herdam a prop); filtrar por
// `typeof m.type !== 'string'` isola a composite — a única cujo
// `.props.onMouseEnter` é o nosso handler, não o wrapper sintético do
// Pressability. Ver `compositeComTestId` no describe dos sítios abaixo.
//
// Consequência para a estratégia de teste abaixo:
//   1. `getWebInteractionStyle` (helper puro) é testado direto, sem
//      renderizar componente nenhum — cobre os ramos hovered/focused/
//      nenhum/native.
//   2. `useWebInteractionState` (hook puro) é testado via `renderHook`,
//      chamando os 4 handlers diretamente — prova que o ESTADO alterna
//      certo, independente de qualquer componente consumidor.
//   3. Nos 8 sítios de consumo, foco E hover são provados por render real.
//      Foco por `fireEvent(el, 'focus'/'blur')` (a camada nativa liga
//      `onFocus`/`onBlur` de verdade). Hover por chamada direta de
//      `.props.onMouseEnter()`/`.props.onMouseLeave()` no fiber composite
//      (achado #2/#3 acima), dentro de `act(...)`, checando o estilo
//      achatado do nó RE-renderizado. O que continua NÃO provado — limite
//      real, não presumido — é o navegador de fato PINTAR o hover, ou um
//      `mouseenter` genuíno do DOM (depois de hidratação) disparar esse
//      handler; isso exigiria um browser real ou jsdom com eventos de
//      ponteiro, que este projeto não tem.
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

function expectHoverAplicado(estilo: Record<string, unknown>) {
  expect(estilo.opacity).toBe(0.88);
}

/** `opacidadePadrao` existe porque nem todo sítio tem `opacity` ausente
 *  quando não-hovered: `KCButton` explicita `opacity: isDisabled ? 0.45 : 1`
 *  na base do array de `style` (`KCButton.tsx:140`), então "sem hover" ali é
 *  `1`, não `undefined` — os outros 7 sítios não têm `opacity` na base, e
 *  usam o default. */
function expectHoverAusente(
  estilo: Record<string, unknown>,
  opacidadePadrao: number | undefined = undefined,
) {
  expect(estilo.opacity).toBe(opacidadePadrao);
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
// NavDrawer×2, PetListItem) — prova de foco E hover por render real (fix
// wave 2a-bis fecha o hover, que a 2a tinha deixado como limitação
// presumida — ver achado de processo #2 no cabeçalho do arquivo). Foco por
// `fireEvent(el, 'focus'/'blur')` — a camada nativa de Pressability que o
// Jest usa liga `onFocus`/`onBlur` de verdade. Hover por chamada direta de
// `.props.onMouseEnter()`/`.props.onMouseLeave()` no fiber COMPOSITE (não
// no host, que carregaria o wrapper sintético/ausente do Pressability),
// dentro de `act(...)` — `fireEvent(el, 'mouseEnter')` continua não
// servindo pra hover (medido, cabeçalho do arquivo), simplesmente não é o
// mecanismo usado aqui.
function compositeComTestId(
  getAllByProps: (props: Record<string, unknown>) => ReadonlyArray<{ type: unknown }>,
  testID: string,
) {
  const achados = getAllByProps({ testID });
  const composite = achados.find((no) => typeof no.type !== 'string');
  if (!composite) {
    throw new Error(`Nenhum fiber composite encontrado para testID="${testID}"`);
  }
  return composite as { type: unknown; props: Record<string, unknown> & { onMouseEnter: () => void; onMouseLeave: () => void; style?: unknown } };
}

describe('sítios de consumo — onFocus/onBlur e onMouseEnter/onMouseLeave aplicam e removem o estilo de interação (render real)', () => {
  it('KCButton.tsx::KCButton#1 — TouchableOpacity ganha o anel de foco E o estilo de hover', () => {
    comPlataformaWeb(() => {
      const { UNSAFE_getByType } = wrap(<KCButton>Texto</KCButton>);
      const touchable = UNSAFE_getByType(TouchableOpacity);
      expectSemFoco(flat(touchable.props.style));
      // Baseline de opacidade é `1`, não `undefined` — `KCButton` explicita
      // `opacity: isDisabled ? 0.45 : 1` na base do array (KCButton.tsx:140).
      expectHoverAusente(flat(touchable.props.style), 1);

      // Hover: chamada direta na prop do fiber composite (achado #2/#3 do
      // cabeçalho do arquivo) — é a mordida que a fix wave 2a-bis fecha.
      act(() => {
        UNSAFE_getByType(TouchableOpacity).props.onMouseEnter();
      });
      expectHoverAplicado(flat(UNSAFE_getByType(TouchableOpacity).props.style));

      act(() => {
        UNSAFE_getByType(TouchableOpacity).props.onMouseLeave();
      });
      expectHoverAusente(flat(UNSAFE_getByType(TouchableOpacity).props.style), 1);

      fireEvent(UNSAFE_getByType(TouchableOpacity), 'focus');
      expectFocoAplicado(flat(UNSAFE_getByType(TouchableOpacity).props.style), '#1A3A52');

      fireEvent(UNSAFE_getByType(TouchableOpacity), 'blur');
      expectSemFoco(flat(UNSAFE_getByType(TouchableOpacity).props.style));
    });
  });

  it('KCCard.tsx::KCCard#1 — TouchableOpacity (onPress) ganha o anel de foco E o estilo de hover', () => {
    comPlataformaWeb(() => {
      const { UNSAFE_getByType } = wrap(<KCCard onPress={() => {}}>conteúdo</KCCard>);
      const touchable = UNSAFE_getByType(TouchableOpacity);
      expectSemFoco(flat(touchable.props.style));
      expectHoverAusente(flat(touchable.props.style));

      act(() => {
        UNSAFE_getByType(TouchableOpacity).props.onMouseEnter();
      });
      expectHoverAplicado(flat(UNSAFE_getByType(TouchableOpacity).props.style));

      act(() => {
        UNSAFE_getByType(TouchableOpacity).props.onMouseLeave();
      });
      expectHoverAusente(flat(UNSAFE_getByType(TouchableOpacity).props.style));

      fireEvent(UNSAFE_getByType(TouchableOpacity), 'focus');
      expectFocoAplicado(flat(UNSAFE_getByType(TouchableOpacity).props.style), '#1A3A52');

      fireEvent(UNSAFE_getByType(TouchableOpacity), 'blur');
      expectSemFoco(flat(UNSAFE_getByType(TouchableOpacity).props.style));
    });
  });

  it('KCChip.tsx::KCChip#1 — TouchableOpacity (onPress) ganha o anel de foco E o estilo de hover', () => {
    comPlataformaWeb(() => {
      const { UNSAFE_getByType } = wrap(<KCChip onPress={() => {}}>Chip</KCChip>);
      const touchable = UNSAFE_getByType(TouchableOpacity);
      expectSemFoco(flat(touchable.props.style));
      expectHoverAusente(flat(touchable.props.style));

      act(() => {
        UNSAFE_getByType(TouchableOpacity).props.onMouseEnter();
      });
      expectHoverAplicado(flat(UNSAFE_getByType(TouchableOpacity).props.style));

      act(() => {
        UNSAFE_getByType(TouchableOpacity).props.onMouseLeave();
      });
      expectHoverAusente(flat(UNSAFE_getByType(TouchableOpacity).props.style));

      fireEvent(UNSAFE_getByType(TouchableOpacity), 'focus');
      expectFocoAplicado(flat(UNSAFE_getByType(TouchableOpacity).props.style), '#1A3A52');

      fireEvent(UNSAFE_getByType(TouchableOpacity), 'blur');
      expectSemFoco(flat(UNSAFE_getByType(TouchableOpacity).props.style));
    });
  });

  it('AppHeader.tsx::AppHeader#1 (botão de menu) ganha o anel de foco E o estilo de hover', () => {
    comPlataformaWeb(() => {
      const { getByTestId, UNSAFE_getAllByType } = wrap(
        <AppHeader title="X" onMenuPress={() => {}} />,
      );
      expectSemFoco(flat(getByTestId('app-header-menu').props.style));
      // Hover precisa do fiber COMPOSITE, não do host que `getByTestId`
      // devolve — medido (probe descartável) que o host de AppHeader TEM
      // `onMouseEnter` como função, mas é um wrapper que NÃO aplica o
      // estilo (chamá-lo deixa `opacity` inalterado); só o composite chama
      // de fato `menuInteraction.onMouseEnter`. Ver achado #2/#3, cabeçalho.
      const buscarMenuComposite = () =>
        UNSAFE_getAllByType(TouchableOpacity).find((t) => t.props.testID === 'app-header-menu')!;
      expectHoverAusente(flat(buscarMenuComposite().props.style));

      act(() => {
        buscarMenuComposite().props.onMouseEnter();
      });
      expectHoverAplicado(flat(buscarMenuComposite().props.style));

      act(() => {
        buscarMenuComposite().props.onMouseLeave();
      });
      expectHoverAusente(flat(buscarMenuComposite().props.style));

      fireEvent(getByTestId('app-header-menu'), 'focus');
      expectFocoAplicado(flat(getByTestId('app-header-menu').props.style), '#1A3A52');

      fireEvent(getByTestId('app-header-menu'), 'blur');
      expectSemFoco(flat(getByTestId('app-header-menu').props.style));
    });
  });

  it('AppHeader.tsx::AppHeader#2 (botão de busca) ganha o anel de foco E o estilo de hover', () => {
    comPlataformaWeb(() => {
      const { getByTestId, UNSAFE_getAllByType } = wrap(
        <AppHeader title="X" onMenuPress={() => {}} />,
      );
      expectSemFoco(flat(getByTestId('app-header-search').props.style));
      const buscarBuscaComposite = () =>
        UNSAFE_getAllByType(TouchableOpacity).find((t) => t.props.testID === 'app-header-search')!;
      expectHoverAusente(flat(buscarBuscaComposite().props.style));

      act(() => {
        buscarBuscaComposite().props.onMouseEnter();
      });
      expectHoverAplicado(flat(buscarBuscaComposite().props.style));

      act(() => {
        buscarBuscaComposite().props.onMouseLeave();
      });
      expectHoverAusente(flat(buscarBuscaComposite().props.style));

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

    it('NavDrawer.tsx::NavDrawerItem#1 (item de navegação) ganha o anel de foco E o estilo de hover', () => {
      comPlataformaWeb(() => {
        const { getByTestId, UNSAFE_getAllByProps } = renderNavDrawerComUsuario();
        expectSemFoco(flat(getByTestId('nav-item-dashboard').props.style));
        // Hover precisa do fiber COMPOSITE do `Pressable` — achado de
        // processo #3 do cabeçalho: `UNSAFE_getAllByType(Pressable)` mede 0
        // instâncias neste ambiente, e o host que `getByTestId` devolve
        // carrega o wrapper SINTÉTICO de hover do Pressability nativo (que
        // só chama `onHoverIn`/`onHoverOut`, nunca setados aqui) — chamá-lo
        // não move `hovered` nenhum. `compositeComTestId` isola o composite.
        const itemComposite = () => compositeComTestId(UNSAFE_getAllByProps, 'nav-item-dashboard');
        expectHoverAusente(flat(itemComposite().props.style));

        act(() => {
          itemComposite().props.onMouseEnter();
        });
        // Cor do anel/hover neste sítio é `colors.textOnPrimary` (fundo
        // escuro do drawer) — só o anel de FOCO usa cor, o hover é opacity
        // pura (ver `getWebInteractionStyle`), então aqui basta opacity.
        expectHoverAplicado(flat(itemComposite().props.style));

        act(() => {
          itemComposite().props.onMouseLeave();
        });
        expectHoverAusente(flat(itemComposite().props.style));

        fireEvent(getByTestId('nav-item-dashboard'), 'focus');
        // Cor do anel neste sítio é `colors.textOnPrimary` (fundo escuro do
        // drawer), não `colors.borderFocus` — mesma distinção que o próprio
        // `NavDrawer.tsx:194`/`:278` fazem.
        expectFocoAplicado(flat(getByTestId('nav-item-dashboard').props.style), '#FFFCF7');

        fireEvent(getByTestId('nav-item-dashboard'), 'blur');
        expectSemFoco(flat(getByTestId('nav-item-dashboard').props.style));
      });
    });

    it('NavDrawer.tsx::NavDrawer#1 (botão de logout) ganha o anel de foco E o estilo de hover', () => {
      comPlataformaWeb(() => {
        const { getByTestId, UNSAFE_getByType } = renderNavDrawerComUsuario();
        expectSemFoco(flat(getByTestId('nav-drawer-logout').props.style));
        // Logout é `TouchableOpacity` (não `Pressable`) — 1 única instância
        // na árvore com usuário logado, então `UNSAFE_getByType` já basta
        // (mesmo padrão de KCButton/KCCard/KCChip/PetListItem).
        const logoutComposite = () => UNSAFE_getByType(TouchableOpacity);
        expectHoverAusente(flat(logoutComposite().props.style));

        act(() => {
          logoutComposite().props.onMouseEnter();
        });
        expectHoverAplicado(flat(logoutComposite().props.style));

        act(() => {
          logoutComposite().props.onMouseLeave();
        });
        expectHoverAusente(flat(logoutComposite().props.style));

        fireEvent(getByTestId('nav-drawer-logout'), 'focus');
        expectFocoAplicado(flat(getByTestId('nav-drawer-logout').props.style), '#FFFCF7');

        fireEvent(getByTestId('nav-drawer-logout'), 'blur');
        expectSemFoco(flat(getByTestId('nav-drawer-logout').props.style));
      });
    });
  });

  it('PetListItem.tsx::PetListItem#1 — linha da lista ganha o anel de foco E o estilo de hover', () => {
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
      const { getByRole, UNSAFE_getByType } = wrap(<PetListItem pet={pet} onPress={() => {}} />);
      expectSemFoco(flat(getByRole('button').props.style));
      // Hover precisa do fiber composite (mesmo achado #2/#3 do cabeçalho);
      // única `TouchableOpacity` na árvore, `UNSAFE_getByType` já isola.
      const linhaComposite = () => UNSAFE_getByType(TouchableOpacity);
      expectHoverAusente(flat(linhaComposite().props.style));

      act(() => {
        linhaComposite().props.onMouseEnter();
      });
      expectHoverAplicado(flat(linhaComposite().props.style));

      act(() => {
        linhaComposite().props.onMouseLeave();
      });
      expectHoverAusente(flat(linhaComposite().props.style));

      fireEvent(getByRole('button'), 'focus');
      expectFocoAplicado(flat(getByRole('button').props.style), '#1A3A52');

      fireEvent(getByRole('button'), 'blur');
      expectSemFoco(flat(getByRole('button').props.style));
    });
  });
});
